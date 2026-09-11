type ToneOptions = {
  type?: OscillatorType;
  gain?: number;
  glideTo?: number;
};

/**
 * A real bottlenose recording, used for the recruit call. Every other sound here is synthesised,
 * but a dolphin greeting is one thing synthesis does not get close to: the real call is a low,
 * descending, burst-pulsed squawk whose second harmonic is nearly as loud as its fundamental,
 * and an oscillator sweep always lands somewhere between a bird and a theremin.
 */
const RECRUIT_SAMPLE = 'dolphin-recruit.mp3';
/**
 * A real crunch, used for the bite. Grain-shaped noise gets close to the texture but never quite
 * to the irregularity of the real thing. Only the crunch is sampled: the recording is dry and
 * close-mic'd, so the impact and the water closing over it are still synthesised underneath, or
 * it sounds like someone eating crisps rather than something happening underwater.
 */
const BITE_SAMPLE = 'shark-bite.mp3';
/**
 * The impact when a boosting pod destroys a large shark. Paired with the freeze-frame and screen
 * shake in Game.triggerBigKillFeedback, so it wants weight rather than brightness - this take is
 * 12% above 2kHz, which is why it reads as a body blow instead of a slap.
 */
const BIG_KILL_SAMPLE = 'big-kill.mp3';

class SfxEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private volume = 1;
  private stormNodes: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private sampleCache = new Map<string, AudioBuffer>();
  private sampleLoading = new Set<string>();

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
    this.preloadSample(RECRUIT_SAMPLE);
    this.preloadSample(BITE_SAMPLE);
    this.preloadSample(BIG_KILL_SAMPLE);
  }

  /** Fetches and decodes a sample once, caching the result. Safe to call repeatedly. */
  private preloadSample(name: string): void {
    const url = `${import.meta.env.BASE_URL}sfx/${name}`;
    if (this.sampleCache.has(url) || this.sampleLoading.has(url)) return;
    this.sampleLoading.add(url);
    const ctx = this.ensureContext();
    fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        this.sampleCache.set(url, buffer);
      })
      .catch((err) => {
        console.warn(`Sound ${name} could not be loaded; using the synthesised fallback.`, err);
      })
      .finally(() => {
        this.sampleLoading.delete(url);
      });
  }

  /**
   * Plays a cached sample, returning false if it is not ready yet so the caller can fall back to
   * its synthesised version - the sample is runtime-cached rather than precached, so the very
   * first play of a session can land before the file has arrived.
   */
  private playSample(name: string, gain: number): boolean {
    const url = `${import.meta.env.BASE_URL}sfx/${name}`;
    const buffer = this.sampleCache.get(url);
    if (!buffer) {
      this.preloadSample(name);
      return false;
    }
    const ctx = this.ensureContext();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const level = ctx.createGain();
    level.gain.value = gain;
    source.connect(level);
    level.connect(this.masterGain!);
    source.start();
    return true;
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

  /**
   * Losing a dolphin. This used to be a 130Hz sine dropping to 40Hz under a noise burst, which
   * lands as a comic pop - the wrong reading for the worst thing that happens to you. Three
   * layers instead: the impact, a dolphin cry bending downward and cut short, and a low
   * dissonant swell under both. Falling pitch and the tritone are what make it read as alarm.
   */
  /**
   * Grain-shaped noise: short uneven bursts rather than a smooth hiss. Plain filtered noise reads
   * as a "shh"; grains a few milliseconds long read as something breaking.
   */
  private crunchBuffer(ctx: AudioContext, duration: number, grainMs: number, decay: number): AudioBuffer {
    const sr = ctx.sampleRate;
    const size = Math.max(1, Math.floor(sr * duration));
    const buffer = ctx.createBuffer(1, size, sr);
    const data = buffer.getChannelData(0);
    const grain = Math.max(3, Math.floor((sr * grainMs) / 1000));
    let i = 0;
    while (i < size) {
      const len = Math.max(3, Math.floor(grain * (0.45 + Math.random() * 1.1)));
      const amp = Math.pow(Math.random(), 1.4);
      for (let j = 0; j < len && i < size; j++, i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * j) / len) * amp;
      }
    }
    for (let k = 0; k < size; k++) data[k] *= Math.pow(1 - k / size, decay);
    return buffer;
  }

  private crunch(
    ctx: AudioContext,
    start: number,
    opts: { dur: number; grainMs: number; from: number; to: number; peak: number; q?: number; decay?: number },
  ): void {
    const src = ctx.createBufferSource();
    src.buffer = this.crunchBuffer(ctx, opts.dur, opts.grainMs, opts.decay ?? 1.6);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(opts.from, start);
    bp.frequency.exponentialRampToValueAtTime(opts.to, start + opts.dur);
    bp.Q.value = opts.q ?? 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(opts.peak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + opts.dur + 0.02);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.masterGain!);
    src.start(start);
    src.stop(start + opts.dur + 0.03);
  }

  /**
   * Losing a dolphin: a shark bite. This was a 130Hz sine dropping to 40Hz under a noise burst,
   * which lands as a comic pop - the wrong reading for the worst thing that happens to you. Now
   * it is a chomp wrapped in water: a muffled impact, a real recorded crunch, and a low swell
   * underneath as the water closes over it.
   */
  playBite(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    // The impact - dull and close, not a bright pop.
    const thud = ctx.createBufferSource();
    thud.buffer = this.noiseBuffer(ctx, 0.2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, now);
    lp.frequency.exponentialRampToValueAtTime(110, now + 0.2);
    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0.55, now);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    thud.connect(lp);
    lp.connect(thudGain);
    thudGain.connect(this.masterGain!);
    thud.start(now);
    thud.stop(now + 0.23);

    // The crunch itself: the recording where it has loaded, otherwise two passes of grain-shaped
    // noise, the second coarser and lower - jaws closing, then again.
    if (!this.playSample(BITE_SAMPLE, 0.9)) {
      this.crunch(ctx, now + 0.01, { dur: 0.26, grainMs: 6, from: 1100, to: 260, peak: 0.42, q: 0.9 });
      this.crunch(ctx, now + 0.16, { dur: 0.22, grainMs: 9, from: 620, to: 180, peak: 0.3, q: 1.2 });
    }

    // Water closing over it.
    this.tone(ctx, 62, now + 0.02, 0.7, { type: 'sine', gain: 0.34, glideTo: 38 });
  }

  /**
   * Destroying a large shark: the moment the pod's boost lands. Sits under the combo blip that
   * every kill plays, so this carries the weight and the blip keeps carrying the streak.
   */
  playBigKill(): void {
    if (this.playSample(BIG_KILL_SAMPLE, 0.9)) return;

    // Synthesised stand-in, used only until the recording has loaded.
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    this.tone(ctx, 150, now, 0.34, { type: 'sine', gain: 0.5, glideTo: 46 });
    this.crunch(ctx, now, { dur: 0.16, grainMs: 5, from: 1600, to: 300, peak: 0.4, q: 0.8 });
  }

  /** Short percussive kill blip whose pitch climbs with the combo step (0-based), then caps. */
  playSharkKill(step: number): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    const semis = Math.min(Math.max(step, 0), 14) * 1.4;
    const base = 300 * Math.pow(2, semis / 12);

    this.tone(ctx, base, now, 0.1, { type: 'square', gain: 0.16, glideTo: base * 1.5 });
    this.tone(ctx, base * 2, now + 0.015, 0.08, { type: 'triangle', gain: 0.09 });

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx, 0.05);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    noise.connect(hp);
    hp.connect(gain);
    gain.connect(this.masterGain!);
    noise.start(now);
    noise.stop(now + 0.06);
  }

  /** A single broadband tick - one echolocation click. */
  private click(ctx: AudioContext, start: number, peak: number): void {
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx, 0.02);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.02);
    noise.connect(hp);
    hp.connect(gain);
    gain.connect(this.masterGain!);
    noise.start(start);
    noise.stop(start + 0.03);
  }

  /**
   * A frequency-modulated whistle: the oscillator sweeps through `points` while a second
   * oscillator wobbles it. Real dolphin whistles are swept, warbling tones rather than steady
   * pitches, and that warble is most of what makes a synthesised tone read as an animal.
   */
  private whistle(
    ctx: AudioContext,
    start: number,
    duration: number,
    points: [number, number][],
    opts: { peak: number; vibratoHz: number; vibratoDepth: number; attack?: number },
  ): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(points[0][1], start);
    for (const [frac, freq] of points.slice(1)) {
      osc.frequency.exponentialRampToValueAtTime(freq, start + duration * frac);
    }

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = opts.vibratoHz;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = opts.vibratoDepth;
    lfo.connect(lfoDepth);
    lfoDepth.connect(osc.frequency);

    const attack = opts.attack ?? 0.02;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(opts.peak, start + attack);
    gain.gain.setValueAtTime(opts.peak, start + duration * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(start);
    osc.stop(start + duration + 0.02);
    lfo.start(start);
    lfo.stop(start + duration + 0.02);
  }

  /**
   * A dolphin greeting: two echolocation clicks, then a whistle that sweeps up and settles back
   * down. The rise-then-fall contour plus the warble is what separates this from a game chime -
   * a pair of clean triangle notes, which is what this used to be, just sounds like a menu blip.
   */
  playRecruit(): void {
    if (this.playSample(RECRUIT_SAMPLE, 0.85)) return;

    // Synthesised stand-in, used only until the recording has loaded.
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    this.click(ctx, now, 0.1);
    this.click(ctx, now + 0.045, 0.075);

    this.whistle(
      ctx,
      now + 0.08,
      0.34,
      [
        [0, 1150],
        [0.5, 2600],
        [0.72, 2400],
        [1, 1800],
      ],
      { peak: 0.24, vibratoHz: 38, vibratoDepth: 110 },
    );
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
