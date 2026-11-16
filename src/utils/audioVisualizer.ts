// Real-time Web Audio API Analyser service for reactive Bauhaus/Brutalist visualizations

const EMPTY_ARRAY = new Uint8Array(0);

class AudioVisualizerService {
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array | null = null;
  private timeData: Uint8Array | null = null;
  private listeners: Set<(freq: Uint8Array, time: Uint8Array) => void> = new Set();
  private rafId: number | null = null;

  init(analyserNode: AnalyserNode) {
    this.analyser = analyserNode;
    this.freqData = new Uint8Array(analyserNode.frequencyBinCount);
    this.timeData = new Uint8Array(analyserNode.frequencyBinCount);
    if (this.listeners.size > 0 && this.rafId === null) {
      this.startLoop();
    }
  }

  isReady(): boolean {
    return this.analyser !== null;
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyser || !this.freqData) {
      return EMPTY_ARRAY;
    }
    this.analyser.getByteFrequencyData(this.freqData);
    return this.freqData;
  }

  getTimeDomainData(): Uint8Array {
    if (!this.analyser || !this.timeData) {
      return EMPTY_ARRAY;
    }
    this.analyser.getByteTimeDomainData(this.timeData);
    return this.timeData;
  }

  /**
   * Returns normalized energy metrics (0.0 to 1.0)
   * bass: sub-bass & kick (bins 0-12, ~0-350Hz)
   * mid: vocals, synths (bins 12-60, ~350-2500Hz)
   * treble: hi-hats, air (bins 60-140, ~2500-12000Hz)
   * overall: average energy across all frequencies
   * peak: highest instantaneous frequency amplitude
   */
  getEnergy(_isPlaying = true): { bass: number; mid: number; treble: number; overall: number; peak: number } {
    const data = this.getFrequencyData();
    const len = data ? data.length : 0;

    let bassSum = 0;
    let midSum = 0;
    let trebleSum = 0;
    let peak = 0;

    const bassEnd = Math.min(12, len);
    const midEnd = Math.min(60, len);

    if (len > 0) {
      for (let i = 0; i < len; i++) {
        const val = data[i];
        if (val > peak) peak = val;

        if (i < bassEnd) {
          bassSum += val;
        } else if (i < midEnd) {
          midSum += val;
        } else {
          trebleSum += val;
        }
      }
    }

    const bassCount = bassEnd || 1;
    const midCount = Math.max(1, midEnd - bassEnd);
    const trebleCount = Math.max(1, len - midEnd);

    let rawBass = bassSum / (bassCount * 255);
    let rawMid = midSum / (midCount * 255);
    let rawTreble = trebleSum / (trebleCount * 255);
    let rawPeak = peak / 255;
    let rawOverall = (bassSum + midSum + trebleSum) / ((len || 1) * 255);

    return {
      bass: Math.min(1, rawBass),
      mid: Math.min(1, rawMid),
      treble: Math.min(1, rawTreble),
      overall: Math.min(1, rawOverall),
      peak: Math.min(1, rawPeak),
    };
  }

  /**
   * Subscribe to 60fps tick callback
   */
  subscribe(cb: (freq: Uint8Array, time: Uint8Array) => void): () => void {
    this.listeners.add(cb);
    if (this.rafId === null && this.analyser) {
      this.startLoop();
    }
    return () => {
      this.listeners.delete(cb);
      if (this.listeners.size === 0 && this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    };
  }

  private startLoop() {
    const tick = () => {
      if (this.listeners.size === 0) {
        this.rafId = null;
        return;
      }
      const f = this.getFrequencyData();
      const t = this.getTimeDomainData();
      this.listeners.forEach((cb) => cb(f, t));
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }
}

export const audioVisualizer = new AudioVisualizerService();
