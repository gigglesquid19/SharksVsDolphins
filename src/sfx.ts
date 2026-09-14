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
/**
 * Landing a hit on the Matriarch. Longer and far lower than the large-shark impact - all of its
 * energy sits below 2kHz and it rings for over a second - because she takes three hits to bring
 * down and each one should feel like it moved something enormous.
 */
const MATRIARCH_HIT_SAMPLE = 'matriarch-hit.mp3';
/** Stings for the two moments a run changes state. Both are phrases, not impacts. */
const LEVEL_COMPLETE_SAMPLE = 'level-complete.mp3';
const GAME_OVER_SAMPLE = 'game-over.mp3';

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
    this.preloadSample(MATRIARCH_HIT_SAMPLE);
    this.preloadSample(LEVEL_COMPLETE_SAMPLE);
    this.preloadSample(GAME_OVER_SAMPLE);
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

  /** Landing a hit on the Matriarch - heavier and longer than an ordinary large-shark kill. */
  playMatriarchHit(): void {
    if (this.playSample(MATRIARCH_HIT_SAMPLE, 0.95)) return;

    // Synthesised stand-in, used only until the recording has loaded.
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    this.tone(ctx, 110, now, 0.9, { type: 'sine', gain: 0.5, glideTo: 38 });
    this.tone(ctx, 78, now + 0.04, 0.8, { type: 'triangle', gain: 0.3 });
    this.crunch(ctx, now, { dur: 0.22, grainMs: 7, from: 1200, to: 200, peak: 0.4, q: 0.9 });
  }

  /** Clearing a level. Roughly 2.4 seconds of fanfare. */
  playLevelComplete(): void {
    if (this.playSample(LEVEL_COMPLETE_SAMPLE, 0.9)) return;

    // Synthesised stand-in, used only until the recording has loaded.
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      this.tone(ctx, freq, now + i * 0.1, 0.3, { type: 'triangle', gain: 0.24 });
    });
  }

  /** The end of a run. Roughly 5 seconds, so the music ducks under it - see Game.gameOver. */
  playGameOver(): void {
    if (this.playSample(GAME_OVER_SAMPLE, 0.9)) return;

    // Synthesised stand-in, used only until the recording has loaded.
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    [392, 349.23, 293.66, 261.63].forEach((freq, i) => {
      this.tone(ctx, freq, now + i * 0.22, 0.5, { type: 'triangle', gain: 0.26 });
    });
    this.tone(ctx, 98, now + 0.66, 1.2, { type: 'sine', gain: 0.3, glideTo: 55 });
  }

  /**
   * The Echolocation ping. Synthesised rather than sampled: a sonar ping is a clean swept tone
   * with a long tail, which is the one thing oscillators do better than a recording of a room.
   */
  playEcho(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    this.click(ctx, now, 0.06, 4000);
    // Two detuned partials sliding down together give the ping its metallic ring.
    this.tone(ctx, 1760, now + 0.01, 1.1, { type: 'sine', gain: 0.22, glideTo: 900 });
    this.tone(ctx, 2640, now + 0.01, 0.9, { type: 'sine', gain: 0.1, glideTo: 1360 });
    this.tone(ctx, 440, now + 0.02, 1.3, { type: 'sine', gain: 0.12, glideTo: 300 });
  }

  /**
   * The kraken arriving: a long, low groan of moving water with nothing sharp in it.
   *
   * Deliberately not a sting. The hazard is slow and positional, and the sound is the cue to start
   * choosing a lane rather than to flinch - a sharp attack would ask for the wrong reaction.
   */
  playKraken(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    this.tone(ctx, 58, now, 2.2, { type: 'sine', gain: 0.2, glideTo: 38 });
    this.tone(ctx, 87, now + 0.15, 1.9, { type: 'triangle', gain: 0.1, glideTo: 52 });
    this.tone(ctx, 150, now + 0.3, 1.4, { type: 'sine', gain: 0.06, glideTo: 90 });
  }

  /**
   * The megamouth passing: a slow rising swell, more presence than threat.
   *
   * It climbs where the kraken's falls, because this one is not closing on anybody - it is simply
   * enormous and going somewhere, and the sound should read as something surfacing into view.
   */
  playMegamouth(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    this.tone(ctx, 44, now, 2.4, { type: 'sine', gain: 0.18, glideTo: 70 });
    this.tone(ctx, 132, now + 0.25, 1.8, { type: 'sine', gain: 0.07, glideTo: 190 });
  }
  /**
   * A large cookiecutter has singled a dolphin out: two rising notes, repeated, over a low pulse.
   *
   * Deliberately unlike anything else down here. It is the only warning the player gets, and it
   * has to be recognisable while a banner is being read and a pod is being steered - so it climbs,
   * where the bite and the game-over both fall, and it repeats rather than ringing once.
   */
  playLockOnWarning(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    for (const at of [0, 0.28]) {
      this.tone(ctx, 520, now + at, 0.16, { type: 'square', gain: 0.11, glideTo: 900 });
      this.tone(ctx, 780, now + at + 0.1, 0.18, { type: 'square', gain: 0.08, glideTo: 1300 });
    }
    this.tone(ctx, 90, now, 0.6, { type: 'sine', gain: 0.16, glideTo: 60 });
  }

  /** The run itself: the warning's climb, completed and gone in a quarter of a second. */
  playLockOnStrike(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    this.click(ctx, now, 0.05, 2600);
    this.tone(ctx, 900, now, 0.22, { type: 'sawtooth', gain: 0.14, glideTo: 2200 });
    this.tone(ctx, 140, now, 0.3, { type: 'sine', gain: 0.16, glideTo: 70 });
  }

  /** The frilled shark throwing its head out: a low sweep opening rather than a snap. */
  playFrilledStrike(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    this.tone(ctx, 200, now, 0.45, { type: 'sawtooth', gain: 0.1, glideTo: 520 });
    this.tone(ctx, 70, now, 0.5, { type: 'sine', gain: 0.14, glideTo: 130 });
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
  private click(ctx: AudioContext, start: number, peak: number, highpassHz = 3000): void {
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx, 0.02);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = highpassHz;
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

  /** Ghost Shrimp: a soft swell that falls away to nothing, like sinking out of sight. */
  playGhostShrimp(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    this.tone(ctx, 880, now, 0.9, { type: 'sine', gain: 0.18, glideTo: 220 });
    this.tone(ctx, 1320, now + 0.05, 0.7, { type: 'sine', gain: 0.1, glideTo: 330 });
    // A breath of noise under it so it reads as water closing over the pod rather than a chime.
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx, 0.9);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(1200, now);
    band.frequency.exponentialRampToValueAtTime(180, now + 0.9);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    noise.connect(band);
    band.connect(gain);
    gain.connect(this.masterGain!);
    noise.start(now);
    noise.stop(now + 0.9);
  }

  /** Pistol Shrimp: the snap itself, then the cavitation bubble collapsing. */
  playPistolShrimp(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    this.click(ctx, now, 0.5, 2000);
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx, 0.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3200, now);
    lp.frequency.exponentialRampToValueAtTime(240, now + 0.45);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    noise.connect(lp);
    lp.connect(gain);
    gain.connect(this.masterGain!);
    noise.start(now);
    noise.stop(now + 0.5);
    // The low thump that sells it as a pressure wave rather than a hi-hat.
    this.tone(ctx, 140, now + 0.01, 0.35, { type: 'sine', gain: 0.3, glideTo: 45 });
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
