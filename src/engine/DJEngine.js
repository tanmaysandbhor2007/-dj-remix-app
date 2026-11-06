/**
 * DJEngine v2 - Intelligent auto-DJ engine
 *
 * Features:
 * - Beatmatching via AudioBufferSourceNode.playbackRate
 * - Bass EQ swap (the hallmark of real DJ transitions)
 * - 3-band EQ per deck (low / mid / high)
 * - Smart mix points from AudioAnalyzer
 * - 8-bar loop engine
 * - Harmonic track selection (Camelot wheel)
 * - Build-up effects (echo, filter sweep, reverb tail)
 * - Reverb send on transitions
 */
import { AudioAnalyzer } from './AudioAnalyzer.js';

export class DJEngine {
  constructor() {
    this.ctx = null;
    this.tracks     = [];          // { id, name, buffer, analysis }
    this.currentDeck = 0;
    this.decks       = [null, null];       // AudioBufferSourceNode
    this.gainNodes   = [null, null];       // master gain per deck
    this.eqLow       = [null, null];       // bass shelf
    this.eqMid       = [null, null];       // mid peaking
    this.eqHigh      = [null, null];       // treble shelf
    this.analyserNodes = [null, null];
    this.masterGain  = null;
    this.reverbNode  = null;
    this.reverbSend  = [null, null];

    this.isPlaying        = false;
    this.autoMixEnabled   = true;
    this.onStateChange    = null;
    this.onBeatPulse      = null;
    this.onAnalysisUpdate = null;

    this.crossfadeTimeout  = null;
    this._beatInterval     = null;
    this.trackQueue        = [];

    // Per-deck state
    this.deckBuffers   = [null, null];
    this.deckAnalysis  = [null, null];
    this.deckStartTime = [0, 0];
    this.deckOffset    = [0, 0];
    this.deckName      = ['', ''];
    this.deckBpm       = [128, 128];
    this.deckDuration  = [0, 0];
    this.deckKey       = [null, null];
    this.deckSections  = [[], []];
    this.deckMixPoints = [null, null];

    this.crossfaderValue = 0.5;
    this.isLooping       = [false, false];
    this._loopTimeout    = [null, null];
  }

  /* ═══════════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════════ */
  async _initCtx() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.9;
    this.masterGain.connect(this.ctx.destination);

    // Reverb (impulse response generated procedurally)
    this.reverbNode = await this._buildReverb(2.5);
    this.reverbNode.connect(this.masterGain);

    for (let i = 0; i < 2; i++) {
      // 3-band EQ chain: source → low → mid → high → gain → analyser → master
      this.eqLow[i]  = this._makeBiquad('lowshelf',  200,  0);
      this.eqMid[i]  = this._makeBiquad('peaking',  1000,  0);
      this.eqHigh[i] = this._makeBiquad('highshelf', 8000,  0);

      this.gainNodes[i] = this.ctx.createGain();
      this.gainNodes[i].gain.value = i === 0 ? 1 : 0;

      this.analyserNodes[i] = this.ctx.createAnalyser();
      this.analyserNodes[i].fftSize = 512;

      // Reverb send
      this.reverbSend[i] = this.ctx.createGain();
      this.reverbSend[i].gain.value = 0;

      // Chain
      this.eqLow[i].connect(this.eqMid[i]);
      this.eqMid[i].connect(this.eqHigh[i]);
      this.eqHigh[i].connect(this.gainNodes[i]);
      this.gainNodes[i].connect(this.analyserNodes[i]);
      this.analyserNodes[i].connect(this.masterGain);

      // Reverb send parallel
      this.eqHigh[i].connect(this.reverbSend[i]);
      this.reverbSend[i].connect(this.reverbNode);
    }
  }

  _makeBiquad(type, frequency, gain = 0) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.gain.value = gain;
    return f;
  }

  async _buildReverb(durationSec) {
    const convolver = this.ctx.createConvolver();
    const len    = this.ctx.sampleRate * durationSec;
    const ir     = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      }
    }
    convolver.buffer = ir;
    return convolver;
  }

  /* ═══════════════════════════════════════════════════════════
     TRACK LOADING
  ═══════════════════════════════════════════════════════════ */
  async loadTrack(arrayBuffer, name) {
    await this._initCtx();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

    // Start fast BPM detection immediately so we can return quickly
    const fastBpm = AudioAnalyzer._detectBPM(AudioAnalyzer._toMono(audioBuffer), audioBuffer.sampleRate);

    const track = {
      id: Date.now() + Math.random(),
      name,
      buffer: audioBuffer,
      bpm: fastBpm,
      duration: audioBuffer.duration,
      analysis: null,   // filled in by deep analysis
      analyzing: true,
    };
    this.tracks.push(track);
    this._notifyState();

    // Deep analysis in background (doesn't block the return)
    this._deepAnalyze(track, audioBuffer).then((analysis) => {
      track.analysis  = analysis;
      track.bpm       = analysis.bpm;
      track.key       = analysis.key;
      track.sections  = analysis.sections;
      track.mixPoints = analysis.mixPoints;
      track.analyzing = false;
      this._notifyState();
      if (this.onAnalysisUpdate) this.onAnalysisUpdate(track);
    });

    return track;
  }

  async _deepAnalyze(track, audioBuffer) {
    return AudioAnalyzer.analyze(audioBuffer);
  }

  /* ═══════════════════════════════════════════════════════════
     START / STOP
  ═══════════════════════════════════════════════════════════ */
  async start() {
    await this._initCtx();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.tracks.length === 0) return;

    this.trackQueue = this._buildSmartQueue();
    this.isPlaying  = true;

    const first = this.trackQueue.shift();
    this._loadOnDeck(0, first);
    this._playDeck(0, first.analysis?.mixPoints?.mixInTime ?? 0);
    this._scheduleNextMix(0);
    this._notifyState();
    this._startBeatPulse();
  }

  stop() {
    this.isPlaying = false;
    clearTimeout(this.crossfadeTimeout);
    clearInterval(this._beatInterval);
    for (let i = 0; i < 2; i++) {
      clearTimeout(this._loopTimeout[i]);
      try { this.decks[i]?.stop(); } catch (_) {}
    }
    this._notifyState();
  }

  /* ═══════════════════════════════════════════════════════════
     SMART QUEUE — orders tracks for harmonic compatibility
  ═══════════════════════════════════════════════════════════ */
  _buildSmartQueue() {
    if (this.tracks.length <= 1) return [...this.tracks];
    const queue = [];
    const remaining = [...this.tracks];

    // Start with a random track
    let cur = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0];
    queue.push(cur);

    while (remaining.length > 0) {
      // Find most harmonically compatible next track with similar BPM
      let best = null, bestScore = -Infinity;
      for (const t of remaining) {
        const harmonic = AudioAnalyzer.camelotCompatible(cur.analysis?.key, t.analysis?.key);
        const { compatible } = AudioAnalyzer.bpmCompatibility(cur.bpm, t.bpm);
        const score = (harmonic === 'perfect' ? 2 : harmonic === 'good' ? 1 : 0)
                    + (compatible ? 1 : 0);
        if (score > bestScore) { bestScore = score; best = t; }
      }
      best = best ?? remaining[0];
      remaining.splice(remaining.indexOf(best), 1);
      queue.push(best);
      cur = best;
    }
    return queue;
  }

  /* ═══════════════════════════════════════════════════════════
     DECK MANAGEMENT
  ═══════════════════════════════════════════════════════════ */
  _loadOnDeck(deckIdx, track) {
    this.deckBuffers[deckIdx]   = track.buffer;
    this.deckAnalysis[deckIdx]  = track.analysis;
    this.deckBpm[deckIdx]       = track.bpm;
    this.deckDuration[deckIdx]  = track.duration;
    this.deckName[deckIdx]      = track.name;
    this.deckKey[deckIdx]       = track.key ?? null;
    this.deckSections[deckIdx]  = track.sections ?? [];
    this.deckMixPoints[deckIdx] = track.mixPoints ?? null;
  }

  _playDeck(deckIdx, offset = 0, loop = false, loopStart = 0, loopEnd = 0) {
    if (this.decks[deckIdx]) {
      try { this.decks[deckIdx].stop(); } catch (_) {}
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.deckBuffers[deckIdx];

    // Beatmatch: adjust playback rate so both decks lock to same BPM
    const targetBPM   = this.deckBpm[this.currentDeck];
    const trackBPM    = this.deckBpm[deckIdx];
    const { compatible, ratio } = AudioAnalyzer.bpmCompatibility(targetBPM, trackBPM);
    src.playbackRate.value = compatible ? ratio : 1;

    if (loop && loopEnd > loopStart) {
      src.loop      = true;
      src.loopStart = loopStart;
      src.loopEnd   = loopEnd;
    }

    src.connect(this.eqLow[deckIdx]);
    this.decks[deckIdx]       = src;
    this.deckStartTime[deckIdx] = this.ctx.currentTime;
    this.deckOffset[deckIdx]    = offset;

    src.start(0, Math.max(0, offset));
    return src;
  }

  /* ═══════════════════════════════════════════════════════════
     AUTO-MIX SCHEDULING
  ═══════════════════════════════════════════════════════════ */
  _scheduleNextMix(fromDeck) {
    const toDeck      = fromDeck === 0 ? 1 : 0;
    const mixPts      = this.deckMixPoints[fromDeck];
    const duration    = this.deckDuration[fromDeck];
    const mixOutTime  = mixPts?.mixOutTime ?? duration * 0.65;
    const currentOffset = this.deckOffset[fromDeck];
    const delay       = Math.max(4, (mixOutTime - currentOffset)) * 1000;

    this.crossfadeTimeout = setTimeout(async () => {
      if (!this.isPlaying) return;

      // Replenish queue if needed
      if (this.trackQueue.length === 0) {
        this.trackQueue = this._buildSmartQueue();
      }
      const nextTrack = this.trackQueue.shift();
      this._loadOnDeck(toDeck, nextTrack);

      // Log harmonic compatibility
      const harmony = AudioAnalyzer.camelotCompatible(
        this.deckAnalysis[fromDeck]?.key,
        nextTrack.analysis?.key
      );
      if (this.onMixLog) {
        this.onMixLog(`🎚️ Mixing: "${nextTrack.name.replace(/\.[^/.]+$/, '')}" — ${nextTrack.bpm} BPM — Key: ${nextTrack.analysis?.key?.camelot ?? '?'} (${harmony})`);
      }

      const mixIn    = nextTrack.analysis?.mixPoints?.mixInTime ?? nextTrack.duration * 0.08;
      const crossDur = 8; // seconds

      // 1. START TRANSITION SEQUENCE
      this._transitionSequence(fromDeck, toDeck, mixIn, crossDur);

      // Schedule next mix from toDeck
      setTimeout(() => {
        if (this.isPlaying) this._scheduleNextMix(toDeck);
      }, (crossDur + 2) * 1000);

    }, delay);
  }

  /* ═══════════════════════════════════════════════════════════
     TRANSITION SEQUENCE
     Real DJ 8-step transition:
     1. Loop the outgoing track's best section
     2. Filter sweep incoming track in
     3. Crossfade gains
     4. Bass swap (cut bass out → bring bass in)
     5. Reverb tail on outgoing
     6. Full handoff
  ═══════════════════════════════════════════════════════════ */
  _transitionSequence(fromDeck, toDeck, mixInOffset, crossDur) {
    const now = this.ctx.currentTime;

    // ── Step 1: Loop the outgoing track's best section ──────
    const fromMixPts = this.deckMixPoints[fromDeck];
    if (fromMixPts?.loopStart && fromMixPts?.loopEnd) {
      this.isLooping[fromDeck] = true;
      this._playDeck(fromDeck, fromMixPts.loopStart, true, fromMixPts.loopStart, fromMixPts.loopEnd);
      this.deckStartTime[fromDeck] = now;
    }

    // ── Step 2: Bring in incoming track with filter sweep ───
    this._playDeck(toDeck, mixInOffset, false);

    // Filter sweep: start very low-pass, open up over crossDur/2
    const filterIn = this.ctx.createBiquadFilter();
    // Start incoming with filter closed
    this.eqLow[toDeck].frequency.setValueAtTime(150, now);
    this.eqLow[toDeck].frequency.linearRampToValueAtTime(200, now + crossDur * 0.5);
    this.eqMid[toDeck].gain.setValueAtTime(-6, now);
    this.eqMid[toDeck].gain.linearRampToValueAtTime(0, now + crossDur * 0.7);

    // ── Step 3: Crossfade gains (equal power) ───────────────
    const fromGain = this.gainNodes[fromDeck].gain;
    const toGain   = this.gainNodes[toDeck].gain;

    fromGain.setValueAtTime(fromGain.value, now);
    fromGain.linearRampToValueAtTime(0, now + crossDur);

    toGain.setValueAtTime(0, now);
    toGain.linearRampToValueAtTime(1, now + crossDur);

    // ── Step 4: Bass EQ swap ─────────────────────────────────
    // Cut bass on outgoing at t=0, bring bass on incoming at t=crossDur/2
    this.eqLow[fromDeck].gain.setValueAtTime(0, now);
    this.eqLow[fromDeck].gain.linearRampToValueAtTime(-24, now + crossDur * 0.4);

    this.eqLow[toDeck].gain.setValueAtTime(-24, now);
    this.eqLow[toDeck].gain.linearRampToValueAtTime(0, now + crossDur * 0.6);

    // ── Step 5: Reverb tail on outgoing ─────────────────────
    this.reverbSend[fromDeck].gain.setValueAtTime(0, now);
    this.reverbSend[fromDeck].gain.linearRampToValueAtTime(0.4, now + crossDur * 0.5);
    this.reverbSend[fromDeck].gain.linearRampToValueAtTime(0, now + crossDur);

    // ── Animate crossfader ───────────────────────────────────
    const startTime = Date.now();
    const animate = () => {
      const elapsed  = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / crossDur, 1);
      this.crossfaderValue = fromDeck === 0 ? progress : 1 - progress;
      this._notifyState();
      if (progress < 1 && this.isPlaying) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    // ── Step 6: Handoff after crossfade ─────────────────────
    setTimeout(() => {
      if (!this.isPlaying) return;
      this.isLooping[fromDeck] = false;
      try { this.decks[fromDeck]?.stop(); } catch (_) {}
      // Reset EQ on outgoing deck
      this.eqLow[fromDeck].gain.setValueAtTime(0, this.ctx.currentTime);
      this.reverbSend[fromDeck].gain.setValueAtTime(0, this.ctx.currentTime);
      this.currentDeck = toDeck;
      this._notifyState();
    }, crossDur * 1000 + 200);
  }

  /* ═══════════════════════════════════════════════════════════
     MANUAL CONTROLS
  ═══════════════════════════════════════════════════════════ */
  skipToNext() {
    clearTimeout(this.crossfadeTimeout);
    const toDeck = this.currentDeck === 0 ? 1 : 0;
    if (this.trackQueue.length === 0) this.trackQueue = this._buildSmartQueue();
    const next = this.trackQueue.shift();
    this._loadOnDeck(toDeck, next);
    const mixIn = next.analysis?.mixPoints?.mixInTime ?? next.duration * 0.08;
    this._transitionSequence(this.currentDeck, toDeck, mixIn, 5);
    setTimeout(() => { if (this.isPlaying) this._scheduleNextMix(toDeck); }, 6000);
    if (this.onMixLog) this.onMixLog(`⏭ Skipped → "${next.name.replace(/\.[^/.]+$/, '')}"`);
    this._notifyState();
  }

  /**
   * Trigger an 8-bar auto-loop on the current deck
   */
  triggerLoop(deckIdx) {
    if (!this.isPlaying || !this.deckAnalysis[deckIdx]) return;
    const mp = this.deckMixPoints[deckIdx];
    if (!mp) return;
    this.isLooping[deckIdx] = true;
    this._playDeck(deckIdx, mp.loopStart, true, mp.loopStart, mp.loopEnd);
    if (this.onMixLog) this.onMixLog(`🔁 Looping deck ${deckIdx === 0 ? 'A' : 'B'} at ${mp.loopStart.toFixed(1)}s`);
    this._notifyState();
  }

  /**
   * Stop loop on deck, resume normal playback from loop end
   */
  stopLoop(deckIdx) {
    if (!this.isLooping[deckIdx]) return;
    this.isLooping[deckIdx] = false;
    const mp = this.deckMixPoints[deckIdx];
    this._playDeck(deckIdx, mp?.loopEnd ?? 0, false);
    this._notifyState();
  }

  setCrossfader(value) {
    this.crossfaderValue = value;
    if (!this.ctx) return;
    const L = Math.cos(value * Math.PI * 0.5);
    const R = Math.cos((1 - value) * Math.PI * 0.5);
    this.gainNodes[0].gain.setTargetAtTime(L, this.ctx.currentTime, 0.05);
    this.gainNodes[1].gain.setTargetAtTime(R, this.ctx.currentTime, 0.05);
    this._notifyState();
  }

  /**
   * Set 3-band EQ for a deck
   * @param {number} deckIdx
   * @param {{ low?: number, mid?: number, high?: number }} bands  — dB (-12 to +12)
   */
  setEQ(deckIdx, { low, mid, high } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (low  !== undefined) this.eqLow[deckIdx].gain.setTargetAtTime(low, t, 0.05);
    if (mid  !== undefined) this.eqMid[deckIdx].gain.setTargetAtTime(mid, t, 0.05);
    if (high !== undefined) this.eqHigh[deckIdx].gain.setTargetAtTime(high, t, 0.05);
  }

  setMasterVolume(vol) {
    if (this.masterGain) this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
  }

  /* ═══════════════════════════════════════════════════════════
     FX PADS
  ═══════════════════════════════════════════════════════════ */
  triggerEffect(effectName) {
    if (!this.ctx || !this.isPlaying) return;
    const deck = this.currentDeck;
    const now  = this.ctx.currentTime;
    const gain = this.gainNodes[deck].gain;
    const low  = this.eqLow[deck].gain;

    switch (effectName) {
      case 'echo':
        // 8th-note stutters at current BPM
        const bpm8th = (60 / this.deckBpm[deck]) * 0.5;
        for (let i = 0; i < 8; i++) {
          gain.setValueAtTime(i % 2 === 0 ? 1 : 0.15, now + i * bpm8th);
        }
        gain.setValueAtTime(1, now + 8 * bpm8th);
        break;

      case 'filter_sweep':
        // Open filter sweep — dramatic build
        this.eqLow[deck].frequency.setValueAtTime(80, now);
        this.eqLow[deck].frequency.linearRampToValueAtTime(300, now + 3);
        this.eqMid[deck].gain.setValueAtTime(-8, now);
        this.eqMid[deck].gain.linearRampToValueAtTime(0, now + 3);
        break;

      case 'drop':
        // Silence → reverb burst → slam back
        gain.setValueAtTime(1, now);
        gain.linearRampToValueAtTime(0, now + 0.6);
        this.reverbSend[deck].gain.setValueAtTime(0.8, now);
        this.reverbSend[deck].gain.linearRampToValueAtTime(0, now + 1.5);
        low.setValueAtTime(-24, now);
        gain.setValueAtTime(1, now + 0.65);
        low.linearRampToValueAtTime(0, now + 1.5);
        break;

      case 'reverb_tail':
        // Add reverb for 3 seconds then fade out
        this.reverbSend[deck].gain.setValueAtTime(0, now);
        this.reverbSend[deck].gain.linearRampToValueAtTime(0.6, now + 0.5);
        this.reverbSend[deck].gain.linearRampToValueAtTime(0, now + 3);
        break;

      case 'bass_boost':
        low.setValueAtTime(8, now);
        setTimeout(() => {
          if (this.ctx) low.setTargetAtTime(0, this.ctx.currentTime, 0.3);
        }, 2000);
        break;
    }
  }

  /* ═══════════════════════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════════════════════ */
  _startBeatPulse() {
    clearInterval(this._beatInterval);
    this._beatInterval = setInterval(() => {
      if (this.isPlaying && this.onBeatPulse) this.onBeatPulse(this.deckBpm[this.currentDeck]);
    }, 100);
  }

  _notifyState() {
    if (this.onStateChange) {
      this.onStateChange({
        tracks:          this.tracks,
        currentDeck:     this.currentDeck,
        isPlaying:       this.isPlaying,
        deckBpm:         [...this.deckBpm],
        deckName:        [...this.deckName],
        deckDuration:    [...this.deckDuration],
        deckKey:         [...this.deckKey],
        deckSections:    [...this.deckSections],
        deckMixPoints:   [...this.deckMixPoints],
        crossfaderValue: this.crossfaderValue,
        isLooping:       [...this.isLooping],
      });
    }
  }

  getDeckCurrentTime(deckIdx) {
    if (!this.ctx || !this.isPlaying) return 0;
    return this.ctx.currentTime - this.deckStartTime[deckIdx] + this.deckOffset[deckIdx];
  }

  getAnalyserData(deckIdx) {
    if (!this.analyserNodes[deckIdx]) return new Uint8Array(256);
    const data = new Uint8Array(this.analyserNodes[deckIdx].frequencyBinCount);
    this.analyserNodes[deckIdx].getByteFrequencyData(data);
    return data;
  }
}
