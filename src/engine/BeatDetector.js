/**
 * BeatDetector - Detects BPM from an AudioBuffer using peak analysis
 */
export class BeatDetector {
  /**
   * Analyze an AudioBuffer and return estimated BPM
   * @param {AudioBuffer} audioBuffer
   * @returns {Promise<number>} estimated BPM
   */
  static async detect(audioBuffer) {
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);

    // Downsample for performance
    const downsampleRate = 4;
    const length = Math.floor(channelData.length / downsampleRate);
    const data = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      data[i] = Math.abs(channelData[i * downsampleRate]);
    }

    // Apply low-pass-like smoothing (rolling average)
    const windowSize = Math.floor(sampleRate / downsampleRate / 100);
    const smoothed = new Float32Array(length);
    for (let i = windowSize; i < length; i++) {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) sum += data[i - j];
      smoothed[i] = sum / windowSize;
    }

    // Find peaks above threshold
    const threshold = this._mean(smoothed) * 1.5;
    const minGap = Math.floor((sampleRate / downsampleRate) * 0.3); // min 300ms between beats
    const peaks = [];
    let lastPeak = -minGap;

    for (let i = 1; i < length - 1; i++) {
      if (
        smoothed[i] > threshold &&
        smoothed[i] > smoothed[i - 1] &&
        smoothed[i] > smoothed[i + 1] &&
        i - lastPeak > minGap
      ) {
        peaks.push(i);
        lastPeak = i;
      }
    }

    if (peaks.length < 4) return 128; // fallback BPM

    // Calculate intervals between peaks
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }

    const medianInterval = this._median(intervals);
    const secondsPerBeat = medianInterval / (sampleRate / downsampleRate);
    const bpm = 60 / secondsPerBeat;

    // Normalize to common range 70-180
    let normalizedBpm = bpm;
    while (normalizedBpm < 70) normalizedBpm *= 2;
    while (normalizedBpm > 180) normalizedBpm /= 2;

    return Math.round(normalizedBpm);
  }

  static _mean(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  static _median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
}
