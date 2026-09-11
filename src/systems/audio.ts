/**
 * AUDIO
 *
 * Every sound in Mosshollow is synthesised at runtime. There are no audio
 * files, for the same reason there are no image files: the game should be one
 * self-contained thing, and a valley that sounds like it was assembled from a
 * sample pack does not sound like one place.
 *
 * The layers:
 *   ambience — wind through the trees, rain, water at the shore
 *   life     — birds by day, crickets after dark, a lantern's hum up close
 *   sfx      — footsteps keyed to what you are standing on, interactions
 *
 * Ambience is a handful of long-lived nodes whose gains and filter frequencies
 * are driven each frame. One-shots build and discard their own small graphs.
 *
 * Nothing starts until the player touches a key: browsers require a gesture,
 * and starting silent-but-running would waste the audio thread on a tab nobody
 * is listening to.
 */

import { clamp } from '../core/math.ts';

export type Ground = 'grass' | 'dirt' | 'stone' | 'wood' | 'soil';

/**
 * Level of the water ambience when the player is right beside it. It sits under
 * the soundtrack, the weather and every interaction sound on purpose: this is
 * something you should notice because you walked to the water, not something
 * you have to listen past.
 *
 * Set by measuring each source on its own at the master bus, which is the only
 * way to get a reproducible number here — comparing full-mix levels is useless
 * because the wind alone swings the bed by about ten decibels.
 *
 * The old figure of 0.055 was written for a signal the broken LFO was inflating
 * tenfold. With the routing fixed it measured -39 dBFS at the water's edge,
 * which is *below* the valley's own floor of birds and crickets — quieter than
 * the incidental sound, and effectively inaudible. This puts the shore level
 * with the wind and about five decibels under the soundtrack: something you
 * can hear when you are standing on the bank, and never something competing.
 */
const WATER_LEVEL = 0.105;

export interface AudioState {
  /** -1..1 from the weather system. */
  wind: number;
  /** 0 by day, 1 in the dead of night. */
  darkness: number;
  /** 0..1, how hard it is raining. */
  rain: number;
  /** 0..1, how close the listener is to open water. */
  water: number;
  /** Master mute. */
  muted?: boolean;
  /**
   * The pause menu is up. The valley does not stop existing, but it stops
   * competing: the bed drops well back so the menu feels like a step outside
   * the game rather than the game continuing without you. A hard cut to
   * silence reads as a fault, so this is a duck and not a mute.
   */
  paused?: boolean;
  /**
   * 0..1. How far to pull the *ambience and music* down without touching the
   * sound effects — used while somebody is talking. A conversation in a valley
   * this noisy was competing with its own weather, and the cheapest way to make
   * words feel important is to take the room away from underneath them.
   */
  duck?: number;
}

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus: GainNode | null = null;
  /**
   * Resting level of the soundtrack bus. "Where the Valley Sleeps" is mastered
   * to a peak of -0.01 dBFS and an RMS of -14.4, which is a finished record and
   * far hotter than anything this game synthesises. It has to be brought down
   * to sit beneath the weather and the footsteps rather than on top of them.
   * Ducking multiplies this rather than replacing it.
   *
   * Set by measurement at the master bus, not by ear: at 0.34 the soundtrack
   * ran 3.2 dB above the ambience bed, which for a game this quiet is the
   * music leading rather than accompanying. 0.24 puts it level with the
   * weather, where it is unmistakably present and still underneath a footstep.
   */
  private musicLevel = 0.24;

  /** Player-facing music level, 0..1, on top of the resting level. */
  musicVolume = 1;
  /**
   * The player's setting, 0..1. Deferred since Phase 1 and listed as such in
   * the status file every milestone since; a game you cannot turn down is a
   * game people play on mute.
   */
  volume = 0.7;
  private ambienceBus!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;

  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private rainGain!: GainNode;
  private rainFilter!: BiquadFilterNode;
  private waterGain!: GainNode;
  private waterFilter!: BiquadFilterNode;

  private birdTimer = 3;
  private cricketTimer = 1;
  private started = false;
  private lastFootstep = 0;

  get running(): boolean {
    return this.started;
  }

  /** Call from a real user gesture. Safe to call repeatedly. */
  start(): void {
    if (this.started) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    // A gentle limiter on the way out. Nothing in this game is mixed loudly,
    // but the bell sums seven partials and measured a peak of 1.05 — it
    // clipped. Catching it here means a future sound cannot reintroduce the
    // same fault, and at these levels the limiter is otherwise inaudible.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.18;
    this.master.connect(limiter).connect(ctx.destination);
    // Fade the whole mix up, so enabling audio is never a click in the ear.
    this.master.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 1.4);

    this.ambienceBus = ctx.createGain();
    this.ambienceBus.gain.value = 1;
    this.ambienceBus.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 1;
    this.sfxBus.connect(this.master);

    this.noise = makeNoiseBuffer(ctx, 4);

    // --- wind: noise through a band-pass whose frequency and gain follow the
    //     weather system, so a gust is audible before you see it arrive.
    const windSrc = loopNoise(ctx, this.noise);
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 480;
    this.windFilter.Q.value = 0.7;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.0;
    windSrc.connect(this.windFilter).connect(this.windGain).connect(this.ambienceBus);
    windSrc.start();

    // --- rain: broad noise, rolled off so it is a hiss on leaves rather than
    //     static, plus individual drips scheduled while it falls.
    const rainSrc = loopNoise(ctx, this.noise);
    this.rainFilter = ctx.createBiquadFilter();
    this.rainFilter.type = 'lowpass';
    this.rainFilter.frequency.value = 3800;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rainSrc.connect(this.rainFilter).connect(this.rainGain).connect(this.ambienceBus);
    rainSrc.start();

    // --- water: slow, low, and modulated so it laps rather than hisses.
    //
    // Two stages, and the split matters. `lap` carries the shore's rhythm and
    // `waterGain` carries the distance to it; the signal passes through both,
    // so the two multiply.
    //
    // They used to be one node: the LFO was connected straight to
    // `waterGain.gain`. Modulation of an AudioParam is *added* to its value, so
    // the effective gain was (distance * 0.05) + 0.5*sin(t) — a swing ten times
    // larger than anything proximity could contribute. The shore therefore
    // played at close to full depth wherever the player was standing, and
    // walking to the pond changed the level by a few per cent. That is why it
    // sounded like permanent background noise instead of like water.
    const waterSrc = loopNoise(ctx, this.noise);
    this.waterFilter = ctx.createBiquadFilter();
    this.waterFilter.type = 'lowpass';
    this.waterFilter.frequency.value = 700;
    const lap = ctx.createGain();
    lap.gain.value = 1;
    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0;
    waterSrc.connect(this.waterFilter).connect(lap).connect(this.waterGain).connect(this.ambienceBus);
    waterSrc.start();
    // The rhythm rides on `lap`, centred on one, so it shapes the sound without
    // ever deciding how loud it is.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.24;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.35;
    lfo.connect(lfoDepth).connect(lap.gain);
    lfo.start();

    this.started = true;
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /**
   * Stop making noise into a tab nobody is looking at. Browsers throttle a
   * hidden tab's timers but not its audio graph, so without this the valley
   * carries on in the background — which on a phone means it carries on while
   * somebody is reading a message.
   */
  setPageVisible(visible: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.started) return;
    if (visible) {
      if (ctx.state === 'suspended') void ctx.resume();
    } else if (ctx.state === 'running') {
      void ctx.suspend();
    }
  }

  update(dt: number, s: AudioState): void {
    if (!this.ctx || !this.started) return;
    const t = this.ctx.currentTime;
    const gust = Math.abs(s.wind);

    // One master, scaled by the player's setting. Ambience and music sit on
    // their own bus underneath it so they can be ducked without the footsteps
    // and the axe going quiet with them.
    this.master.gain.setTargetAtTime(s.muted ? 0 : 0.85 * this.volume, t, 0.15);
    // Tuned by measurement, twice. At 0.62 the change was thirteen percent and
    // audible only to a meter; at 0.85 the valley vanished, which reads as the
    // sound having broken rather than as somebody speaking. This sits near
    // sixty percent: the weather is still there, it has just stepped back.
    // Pause ducks harder than dialogue and settles more slowly, so opening the
    // menu feels like stepping back rather than like the sound breaking.
    const pause = s.paused ? 0.72 : 0;
    const duck = 1 - Math.max((s.duck ?? 0) * 0.6, pause);
    this.ambienceBus.gain.setTargetAtTime(duck, t, s.paused ? 0.3 : 0.22);
    // The score goes further down than the weather: a line of dialogue over a
    // melody is a competition, over wind it is a scene.
    if (this.musicBus) {
      const target = this.musicLevel * this.musicVolume * (1 - Math.max((s.duck ?? 0) * 0.85, pause));
      // Never to absolute zero: an exponential approach to silence is what
      // makes a duck breathe rather than gate.
      this.musicBus.gain.setTargetAtTime(Math.max(0.0001, target), t, s.paused ? 0.4 : 0.3);
    }

    // Wind gets louder and brighter as it picks up. Rain masks it.
    const windLevel = (0.012 + gust * 0.055) * (1 - s.rain * 0.4);
    this.windGain.gain.setTargetAtTime(windLevel, t, 0.5);
    this.windFilter.frequency.setTargetAtTime(360 + gust * 700, t, 0.6);

    this.rainGain.gain.setTargetAtTime(s.rain * 0.17, t, 0.8);
    this.rainFilter.frequency.setTargetAtTime(2600 + s.rain * 2600, t, 0.8);

    // One continuous loop whose level follows the distance to the nearest
    // water. It is never started or stopped — crossing the audible boundary is
    // a ramp on a node that has been running since the game began, so there is
    // nothing to click, restart or duplicate.
    //
    // Asymmetric: arriving at the water is a little quicker than leaving it,
    // which is how approaching a sound actually feels and which stops the level
    // pumping if the player walks the boundary.
    const water = s.water * WATER_LEVEL;
    const rising = water > this.waterGain.gain.value;
    this.waterGain.gain.setTargetAtTime(water, t, rising ? 0.5 : 0.95);

    // --- birds by day, crickets after dark -------------------------------
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      const active = s.darkness < 0.35 && s.rain < 0.5;
      this.birdTimer = active ? 1.6 + Math.random() * 5.5 : 2 + Math.random() * 3;
      if (active) this.birdCall();
    }
    this.cricketTimer -= dt;
    if (this.cricketTimer <= 0) {
      const active = s.darkness > 0.55 && s.rain < 0.35;
      this.cricketTimer = active ? 0.28 + Math.random() * 0.5 : 1.5;
      if (active) this.cricket(0.5 + Math.random() * 0.5);
    }
    if (s.rain > 0.2 && Math.random() < dt * s.rain * 12) this.drip();
  }

  /** A footstep. The ground decides what it sounds like. */
  footstep(ground: Ground, running: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.started) return;
    // Cheap guard against two steps landing on the same millisecond.
    if (ctx.currentTime - this.lastFootstep < 0.04) return;
    this.lastFootstep = ctx.currentTime;

    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;

    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    let peak = running ? 0.16 : 0.1;
    let decay = 0.09;

    switch (ground) {
      case 'grass':
        // A soft brush, mostly high frequencies, no body.
        filter.type = 'bandpass';
        filter.frequency.value = 2400 + Math.random() * 900;
        filter.Q.value = 0.6;
        peak *= 0.7;
        decay = 0.075;
        break;
      case 'dirt':
        filter.type = 'lowpass';
        filter.frequency.value = 900 + Math.random() * 300;
        decay = 0.07;
        break;
      case 'soil':
        filter.type = 'lowpass';
        filter.frequency.value = 620 + Math.random() * 200;
        peak *= 1.05;
        decay = 0.085;
        break;
      case 'stone':
        filter.type = 'highpass';
        filter.frequency.value = 1500;
        peak *= 0.9;
        decay = 0.05;
        break;
      case 'wood':
        // Hollow: a resonant peak is what makes a board sound like a board.
        filter.type = 'bandpass';
        filter.frequency.value = 320 + Math.random() * 90;
        filter.Q.value = 4.5;
        peak *= 1.5;
        decay = 0.13;
        break;
    }

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(filter).connect(gain).connect(this.sfxBus);
    src.start(t);
    src.stop(t + decay + 0.02);
  }

  /** Soft confirmation blip for interactions and UI. */
  blip(semitone = 0, level = 0.06): void {
    const ctx = this.ctx;
    if (!ctx || !this.started) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 440 * Math.pow(2, semitone / 12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  /** Two or three notes with a pitch bend on each — a bird, not a beep. */
  private birdCall(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const notes = 2 + Math.floor(Math.random() * 2);
    const base = 1900 + Math.random() * 1300;
    for (let i = 0; i < notes; i++) {
      const t = ctx.currentTime + i * (0.09 + Math.random() * 0.06);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const f0 = base * (0.9 + Math.random() * 0.3);
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * (1.15 + Math.random() * 0.35), t + 0.05);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.92, t + 0.1);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.02, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      osc.connect(gain).connect(this.ambienceBus);
      osc.start(t);
      osc.stop(t + 0.13);
    }
  }

  /** A short high trill. Several overlapping ones read as a field at night. */
  private cricket(level: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + Math.random() * 0.1;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 4200 + Math.random() * 700;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    // Chirp-chirp-chirp rather than one continuous tone.
    for (let i = 0; i < 3; i++) {
      const s = t + i * 0.055;
      gain.gain.exponentialRampToValueAtTime(0.006 * level, s + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, s + 0.035);
    }
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 4600;
    filter.Q.value = 8;
    osc.connect(filter).connect(gain).connect(this.ambienceBus);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /** A single drop landing — the detail that makes rain feel close. */
  private drip(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + Math.random() * 0.3;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const f = 900 + Math.random() * 1400;
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.05);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.012, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(gain).connect(this.ambienceBus);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  /** Bus for the music layer to hang itself off. */
  get context(): AudioContext | null {
    return this.ctx;
  }

  /**
   * Music gets its own bus rather than going straight to the master, so a
   * conversation can duck the score without ducking the axe.
   */
  get musicDestination(): GainNode | null {
    if (!this.started || !this.ctx) return null;
    if (!this.musicBus) {
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicLevel;
      this.musicBus.connect(this.master);
    }
    return this.musicBus;
  }

  /**
   * A struck bronze bell. There is exactly one of these in the game and it is
   * the moment the valley's question gets its answer, so it is the only sound
   * here built from a real partial series rather than one oscillator: a bell's
   * character is entirely in its inharmonic overtones, and a sine with a decay
   * envelope sounds like a doorbell.
   */
  bellTone(level = 0.5): void {
    const ctx = this.ctx;
    if (!ctx || !this.started) return;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    // Seven partials do not sum to one. Normalising by their total keeps the
    // strike under unity however many of them there are.
    const TOTAL = 2.68;
    out.gain.value = level / TOTAL;
    out.connect(this.sfxBus);
    // Hum, prime, tierce, quint, nominal — the ratios a founder tunes for.
    const partials: [number, number, number][] = [
      [0.5, 0.5, 5.5],
      [1.0, 1.0, 4.6],
      [1.2, 0.42, 3.4],
      [1.5, 0.26, 2.6],
      [2.0, 0.3, 2.0],
      [2.5, 0.12, 1.3],
      [3.0, 0.08, 0.9],
    ];
    const base = 196;
    for (const [ratio, amp, decay] of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    }
    // The strike itself: a scrape of noise that is gone before you place it.
    const n = ctx.createBufferSource();
    n.buffer = makeNoiseBuffer(ctx, 0.12);
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 2400;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime((level / TOTAL) * 0.9, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    n.connect(nf).connect(ng).connect(out);
    n.start(t);
  }
}

function makeNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    // Lightly integrated: pure white noise is harsh and reads as tape hiss.
    last = last * 0.72 + white * 0.28;
    data[i] = clamp(last * 2.4, -1, 1);
  }
  return buffer;
}

function loopNoise(ctx: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}
