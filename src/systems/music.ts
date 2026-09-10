/**
 * MUSIC
 *
 * A quiet, endless, generated score. Not a loop — loops in a game you are meant
 * to spend hours in become furniture you resent.
 *
 * The rules that keep it from sounding like an algorithm:
 *  - One key, one scale (D major pentatonic). Pentatonic has no semitone
 *    clashes, so any note against any chord is consonant. Randomness cannot
 *    produce a wrong note, only a less interesting one.
 *  - Notes are *sparse*. Most beats are silent. The gaps are the music.
 *  - A slow pad underneath moves through four chords, so the harmony drifts
 *    even when nothing is being played over it.
 *  - Register and density follow the time of day: bright and open at midday,
 *    low and spare after dark.
 *
 * Scheduling uses the standard Web Audio lookahead: the game loop calls
 * update(), which schedules any notes falling inside the next window. Timing
 * comes from the audio clock, never from the frame rate.
 */

const LOOKAHEAD = 0.7;

/** D major pentatonic across three octaves, in Hz. */
const SCALE = [
  146.83, 164.81, 185.00, 220.00, 246.94, // D3 E3 F#3 A3 B3
  293.66, 329.63, 369.99, 440.00, 493.88, // D4 E4 F#4 A4 B4
  587.33, 659.25, 739.99, 880.00, 987.77, // D5 E5 F#5 A5 B5
];

/** Four chords, as indices into SCALE. Root, third-ish, fifth-ish. */
const PROGRESSION = [
  [0, 2, 4], // D
  [3, 0, 2], // A / D
  [1, 3, 0], // Em-ish
  [2, 4, 1], // F#m-ish
];

export class Music {
  private ctx: AudioContext | null = null;
  private bus!: GainNode;
  private filter!: BiquadFilterNode;
  private nextNote = 0;
  private step = 0;
  private chord = 0;
  private padVoices: { osc: OscillatorNode; gain: GainNode }[] = [];
  private started = false;
  /** Seconds per eighth note. ~58 bpm — slow enough to be scenery. */
  private spb = 0.52;

  attach(ctx: AudioContext, destination: GainNode): void {
    if (this.started) return;
    this.ctx = ctx;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2400;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.0;
    this.filter.connect(this.bus).connect(destination);
    this.bus.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 6);

    // Three pad voices, held forever, retuned at each chord change. Retuning
    // rather than retriggering means the harmony slides instead of restarting.
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.value = SCALE[PROGRESSION[0][i]];
      // A few cents apart, so the pad breathes instead of sitting still.
      osc.detune.value = (i - 1) * 6;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(this.filter);
      osc.start();
      this.padVoices.push({ osc, gain });
    }

    this.nextNote = ctx.currentTime + 1;
    this.started = true;
  }

  /**
   * @param darkness 0 by day, 1 at night — thins the score and drops it lower
   * @param rain     0..1 — closes the filter, as if heard from indoors
   * @param level    overall volume, 0 mutes
   */
  update(darkness: number, rain: number, level = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.started) return;
    const now = ctx.currentTime;

    this.bus.gain.setTargetAtTime(0.4 * level, now, 1.2);
    this.filter.frequency.setTargetAtTime(2400 - rain * 1400 - darkness * 700, now, 2);

    while (this.nextNote < now + LOOKAHEAD) {
      this.scheduleStep(this.nextNote, darkness);
      this.nextNote += this.spb;
      this.step++;
      // Sixteen eighth-notes to a chord: roughly eight seconds each.
      if (this.step % 16 === 0) {
        this.chord = (this.chord + 1) % PROGRESSION.length;
        this.retunePad(this.nextNote, darkness);
      }
    }
  }

  private retunePad(at: number, darkness: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const notes = PROGRESSION[this.chord];
    // Drop the whole pad an octave after dark.
    const shift = darkness > 0.5 ? 0 : 5;
    this.padVoices.forEach((v, i) => {
      const target = SCALE[Math.min(SCALE.length - 1, notes[i] + shift)];
      v.osc.frequency.setTargetAtTime(target, at, 1.6);
      v.gain.gain.setTargetAtTime(0.02 + (1 - darkness) * 0.012, at, 2.2);
    });
  }

  private scheduleStep(at: number, darkness: number): void {
    const beat = this.step % 16;
    // Downbeats are likelier than offbeats, and the whole thing thins out at
    // night. Most steps produce nothing at all — that is the point.
    let chance = beat % 4 === 0 ? 0.42 : beat % 2 === 0 ? 0.2 : 0.09;
    chance *= 1 - darkness * 0.55;
    if (Math.random() > chance) return;

    const chordNotes = PROGRESSION[this.chord];
    const octave = darkness > 0.5 ? 0 : Math.random() < 0.62 ? 5 : 10;
    // Chord tones on strong beats, any scale tone on weak ones.
    const idx = beat % 4 === 0
      ? chordNotes[Math.floor(Math.random() * chordNotes.length)] + octave
      : Math.floor(Math.random() * 5) + octave;
    this.pluck(at, SCALE[Math.min(SCALE.length - 1, idx)], beat % 4 === 0 ? 1 : 0.7);

    // Occasionally a second note a fifth up, struck a moment later.
    if (beat % 8 === 0 && Math.random() < 0.35) {
      this.pluck(at + this.spb * 0.5, SCALE[Math.min(SCALE.length - 1, idx + 3)], 0.55);
    }
  }

  /** A soft struck tone: fast attack, long tail, slight detuned double. */
  private pluck(at: number, freq: number, level: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      osc.detune.value = i === 0 ? 0 : 7;
      const gain = ctx.createGain();
      const peak = 0.05 * level * (i === 0 ? 1 : 0.5);
      const tail = 1.1 + Math.random() * 0.7;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + tail);
      osc.connect(gain).connect(this.filter);
      osc.start(at);
      osc.stop(at + tail + 0.05);
    }
  }
}
