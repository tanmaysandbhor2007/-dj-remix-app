/**
 * AudioAnalyzer - Deep song analysis engine
 * Detects: BPM, musical key, energy curve, beat grid, sections (intro/verse/chorus/outro),
 *          and finds optimal mix-in / mix-out cue points
 */

// Krumhansl-Kessler key profiles (major and minor)
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const NOTE_NAMES    = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// Camelot wheel codes for harmonic mixing
const CAMELOT_MAJOR = ['8B','3B','10B','5B','12B','7B','2B','9B','4B','11B','6B','1B'];
const CAMELOT_MINOR = ['5A','12A','7A','2A','9A','4A','11A','6A','1A','8A','3A','10A'];

export class AudioAnalyzer {
  /**
   * Full analysis of an AudioBuffer
   * @returns {Promise<AnalysisResult>}
   */
  static async analyze(audioBuffer) {
    const sampleRate = audioBuffer.sampleRate;
    // Always work on a mono mix
    const mono = this._toMono(audioBuffer);

    const bpm       = this._detectBPM(mono, sampleRate);
    const key       = this._detectKey(mono, sampleRate);
    const energyMap = this._computeEnergyMap(mono, sampleRate);
    const beatGrid  = this._buildBeatGrid(bpm, audioBuffer.duration);
    const sections  = this._detectSections(energyMap);
    const mixPoints = this._findMixPoints(energyMap, sections, beatGrid, bpm, sampleRate);

    return { bpm, key, energyMap, beatGrid, sections, mixPoints, duration: audioBuffer.duration };
  }

  /* ─── MONO MIX ──────────────────────────────────────────── */
  static _toMono(audioBuffer) {
    const L = audioBuffer.getChannelData(0);
    if (audioBuffer.numberOfChannels === 1) return L;
    const R = audioBuffer.getChannelData(1);
    const mono = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) * 0.5;
    return mono;
  }

  /* ─── BPM DETECTION ─────────────────────────────────────── */
  static _detectBPM(mono, sampleRate) {
    // Downsample 8x for speed
    const DS = 8;
    const len = Math.floor(mono.length / DS);
    const down = new Float32Array(len);
    for (let i = 0; i < len; i++) down[i] = Math.abs(mono[i * DS]);

    // High-pass onset strength (difference between adjacent samples)
    const onset = new Float32Array(len);
    for (let i = 1; i < len; i++) onset[i] = Math.max(0, down[i] - down[i - 1]);

    // Autocorrelation over BPM range 60-200
    const sr = sampleRate / DS;
    const minLag = Math.round((60 / 200) * sr);
    const maxLag = Math.round((60 / 60)  * sr);
    let bestLag = minLag, bestCorr = -Infinity;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      const N = Math.min(len - lag, 4 * sr); // use at most 4 seconds
      for (let i = 0; i < N; i++) corr += onset[i] * onset[i + lag];
      if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }

    let bpm = 60 / (bestLag / sr);
    // Normalise to 70–175
    while (bpm < 70)  bpm *= 2;
    while (bpm > 175) bpm /= 2;
    return Math.round(bpm);
  }

  /* ─── KEY DETECTION (Krumhansl-Schmuckler) ──────────────── */
  static _detectKey(mono, sampleRate) {
    // Build chroma vector from the middle 30 s of the track
    const startSec = Math.max(0, (mono.length / sampleRate) * 0.2);
    const durationSec = Math.min(30, mono.length / sampleRate * 0.6);
    const start = Math.floor(startSec * sampleRate);
    const end   = Math.min(mono.length, start + Math.floor(durationSec * sampleRate));

    const chroma = new Float32Array(12);
    const fftSize = 4096;
    const hop    = 2048;

    for (let pos = start; pos + fftSize < end; pos += hop) {
      // Simple DFT for each of the 12 pitch classes
      for (let pc = 0; pc < 12; pc++) {
        const freq = 440 * Math.pow(2, (pc - 9) / 12); // pitch class → Hz (A4=440)
        let re = 0, im = 0;
        for (let i = 0; i < fftSize; i++) {
          const angle = (2 * Math.PI * freq * i) / sampleRate;
          re += mono[pos + i] * Math.cos(angle);
          im += mono[pos + i] * Math.sin(angle);
        }
        chroma[pc] += Math.sqrt(re * re + im * im);
      }
    }

    // Normalise
    const maxC = Math.max(...chroma);
    if (maxC > 0) for (let i = 0; i < 12; i++) chroma[i] /= maxC;

    // Correlate with major and minor profiles for each root
    let bestScore = -Infinity, bestKey = 'C', bestMode = 'Major';
    for (let root = 0; root < 12; root++) {
      const major = this._correlate(chroma, MAJOR_PROFILE, root);
      const minor = this._correlate(chroma, MINOR_PROFILE, root);
      if (major > bestScore) { bestScore = major; bestKey = NOTE_NAMES[root]; bestMode = 'Major'; }
      if (minor > bestScore) { bestScore = minor; bestKey = NOTE_NAMES[root]; bestMode = 'Minor'; }
    }

    const rootIdx = NOTE_NAMES.indexOf(bestKey);
    const camelot = bestMode === 'Major' ? CAMELOT_MAJOR[rootIdx] : CAMELOT_MINOR[rootIdx];
    return { root: bestKey, mode: bestMode, camelot, chroma: Array.from(chroma) };
  }

  static _correlate(chroma, profile, shift) {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < 12; i++) {
      const a = chroma[i];
      const b = profile[(i - shift + 12) % 12];
      dot  += a * b;
      magA += a * a;
      magB += b * b;
    }
    return dot / (Math.sqrt(magA * magB) + 1e-9);
  }

  /* ─── ENERGY MAP ─────────────────────────────────────────── */
  static _computeEnergyMap(mono, sampleRate) {
    const windowSec = 2.0;
    const hopSec    = 0.5;
    const winSamples = Math.floor(windowSec * sampleRate);
    const hopSamples = Math.floor(hopSec    * sampleRate);
    const frames = [];

    for (let pos = 0; pos + winSamples < mono.length; pos += hopSamples) {
      let rms = 0;
      for (let i = 0; i < winSamples; i++) rms += mono[pos + i] ** 2;
      frames.push({ time: pos / sampleRate, energy: Math.sqrt(rms / winSamples) });
    }

    // Normalise 0–1
    const maxE = Math.max(...frames.map(f => f.energy)) || 1;
    frames.forEach(f => { f.energy = f.energy / maxE; });
    return frames;
  }

  /* ─── BEAT GRID ──────────────────────────────────────────── */
  static _buildBeatGrid(bpm, duration) {
    const beatDuration = 60 / bpm;
    const beats = [];
    for (let t = 0; t < duration; t += beatDuration) beats.push(t);
    return { bpm, beatDuration, beats };
  }

  /* ─── SECTION DETECTION ─────────────────────────────────── */
  static _detectSections(energyMap) {
    if (energyMap.length < 4) return [];

    // Smooth energy with a 5-frame rolling mean
    const smoothed = energyMap.map((f, i, arr) => {
      const slice = arr.slice(Math.max(0, i - 2), Math.min(arr.length, i + 3));
      return { time: f.time, energy: slice.reduce((s, x) => s + x.energy, 0) / slice.length };
    });

    // Label sections by energy quartile
    const sorted = [...smoothed].sort((a, b) => a.energy - b.energy);
    const q1 = sorted[Math.floor(sorted.length * 0.25)].energy;
    const q3 = sorted[Math.floor(sorted.length * 0.75)].energy;

    const labeled = smoothed.map(f => ({
      ...f,
      label: f.energy < q1 ? 'intro/outro'
           : f.energy < q3 ? 'verse/breakdown'
           : 'chorus/drop',
    }));

    // Merge consecutive same-label frames into sections
    const sections = [];
    let cur = null;
    for (const f of labeled) {
      if (!cur || cur.label !== f.label) {
        if (cur) sections.push(cur);
        cur = { start: f.time, end: f.time + 2, label: f.label, energy: f.energy };
      } else {
        cur.end = f.time + 2;
        cur.energy = Math.max(cur.energy, f.energy);
      }
    }
    if (cur) sections.push(cur);
    return sections;
  }

  /* ─── OPTIMAL MIX POINTS ─────────────────────────────────── */
  static _findMixPoints(energyMap, sections, beatGrid, bpm, sampleRate) {
    const duration = energyMap.length > 0 ? energyMap[energyMap.length - 1].time + 2 : 0;
    const beatsPerBar = 4;
    const barDuration = beatsPerBar * (60 / bpm);
    const loopBars = 8; // 8-bar loop
    const loopDuration = loopBars * barDuration;

    // Mix-out: find highest-energy section in last 40% of track, snapped to 8-bar boundary
    let mixOutTime = duration * 0.6;
    const lastSections = sections.filter(s => s.start > duration * 0.4);
    if (lastSections.length > 0) {
      const best = lastSections.reduce((a, b) => b.energy > a.energy ? b : a);
      // Snap to nearest 8-bar boundary
      mixOutTime = this._snapToBar(best.start, barDuration, loopBars);
    }

    // Mix-in: find highest-energy section in first 40% of track
    let mixInTime = duration * 0.08;
    const firstSections = sections.filter(s => s.start < duration * 0.5);
    if (firstSections.length > 0) {
      const best = firstSections.reduce((a, b) => b.energy > a.energy ? b : a);
      mixInTime = this._snapToBar(best.start, barDuration, 1);
    }
    mixInTime = Math.max(mixInTime, 2);

    // Best loop: highest-energy section of at least loopDuration length
    let loopStart = mixOutTime;
    let loopEnd   = loopStart + loopDuration;
    const highEnergy = sections.filter(s => s.label === 'chorus/drop' && (s.end - s.start) >= loopDuration);
    if (highEnergy.length > 0) {
      const best = highEnergy.reduce((a, b) => b.energy > a.energy ? b : a);
      loopStart = this._snapToBar(best.start, barDuration, 1);
      loopEnd   = loopStart + loopDuration;
    }
    loopEnd = Math.min(loopEnd, duration - 2);

    return { mixInTime, mixOutTime, loopStart, loopEnd, loopDuration, barDuration };
  }

  static _snapToBar(time, barDuration, bars) {
    return Math.round(time / (barDuration * bars)) * (barDuration * bars);
  }

  /* ─── HARMONIC COMPATIBILITY ─────────────────────────────── */
  static camelotCompatible(keyA, keyB) {
    if (!keyA?.camelot || !keyB?.camelot) return 'unknown';
    const a = keyA.camelot, b = keyB.camelot;
    if (a === b) return 'perfect'; // same key
    const aNum = parseInt(a), bNum = parseInt(b);
    const aMode = a.slice(-1), bMode = b.slice(-1);
    if (aMode === bMode) {
      const diff = Math.abs(aNum - bNum);
      if (diff === 1 || diff === 11) return 'good'; // adjacent on wheel
    }
    if (aNum === bNum && aMode !== bMode) return 'good'; // parallel major/minor
    return 'risky';
  }

  /* ─── BPM RANGE CHECK ────────────────────────────────────── */
  static bpmCompatibility(bpmA, bpmB) {
    const ratio = bpmA / bpmB;
    if (Math.abs(ratio - 1) < 0.06) return { compatible: true, ratio };
    if (Math.abs(ratio - 2) < 0.06) return { compatible: true, ratio: ratio / 2 }; // double-time
    if (Math.abs(ratio - 0.5) < 0.03) return { compatible: true, ratio: ratio * 2 }; // half-time
    return { compatible: false, ratio };
  }
}
