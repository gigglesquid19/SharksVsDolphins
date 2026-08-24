type ToneOptions = {
  type?: OscillatorType;
  gain?: number;
  glideTo?: number;
};

class SfxEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private volume = 1;
  private stormNodes: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.effectiveGain();
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private effectiveGain(): number {
    return this.muted ? 0 : this.volume;
  }

  resume(): void {
    this.ensureContext();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.effectiveGain();
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.effectiveGain();
    }
  }

  private noiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const size = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private tone(ctx: AudioContext, freq: number, start: number, duration: number, options?: ToneOptions): void {
    const osc = ctx.createOscillator();
    osc.type = options?.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (options?.glideTo) {
      osc.frequency.exponentialRampToValueAtTime(options.glideTo, start + duration);
    }

    const gain = ctx.createGain();
    const peak = options?.gain ?? 0.25;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  playBite(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    this.tone(ctx, 130, now, 0.18, { type: 'sine', gain: 0.5, glideTo: 40 });

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx, 0.15);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    noise.start(now);
    noise.stop(now + 0.15);
  }

  playRecruit(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    this.tone(ctx, 660, now, 0.15, { type: 'triangle', gain: 0.3 });
    this.tone(ctx, 880, now + 0.1, 0.2, { type: 'triangle', gain: 0.3 });
  }

  playShrimp(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      this.tone(ctx, freq, now + i * 0.06, 0.12, { type: 'triangle', gain: 0.22 });
    });
  }

  playAchievement(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, i) => {
      this.tone(ctx, freq, now + i * 0.07, 0.18, { type: 'triangle', gain: 0.25 });
    });
  }

  startStormRumble(): void {
    const ctx = this.ensureContext();
    if (this.stormNodes) return;

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer(ctx, 4);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 1.5);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    source.start();

    this.stormNodes = { source, gain };
  }

  stopStormRumble(): void {
    if (!this.stormNodes || !this.ctx) return;
    const { source, gain } = this.stormNodes;
    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + 1);
    source.stop(now + 1.05);
    this.stormNodes = null;
  }
}

export const sfx = new SfxEngine();
