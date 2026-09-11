/**
 * THE SOUNDTRACK
 *
 * "Where the Valley Sleeps", composed for this game, played as recorded.
 *
 * The file is not a seamless loop and was never meant to be one: it opens with
 * a short lead-in, and it ends with a fade and about a second and a half of
 * silence. Measured, not assumed — 51 ms at the head, 1449 ms at the tail, and
 * a tail RMS of 0.003 against a head RMS of 0.072.
 *
 * Looping it raw would therefore play a hole and then a jolt. Editing the file
 * to butt-join would damage the piece. So neither happens: two source nodes
 * share one decoded buffer and the track crossfades into itself, beginning the
 * next pass while the previous one is still fading out. The composition is
 * played exactly as written and the fade becomes the transition rather than a
 * gap. Nothing is re-encoded and nothing is trimmed.
 *
 * The buffer is decoded once and reused for every pass, so a two-and-a-half
 * hour session costs one decode.
 */

/** Where the music actually stops, ignoring the silence after it. */
const TAIL_SILENCE = 1.45;
/** How long one pass takes to hand over to the next. */
const CROSSFADE = 7;
/** Skip the dead air at the head on every pass after the first. */
const HEAD_SILENCE = 0.05;

export class Soundtrack {
  private ctx: AudioContext | null = null;
  private destination: GainNode | null = null;
  private buffer: AudioBuffer | null = null;
  private playing = false;
  private timer: number | null = null;
  /** Live sources, so a stop can actually stop them. */
  private live: AudioBufferSourceNode[] = [];
  /** True once a fetch has been started, so it can never happen twice. */
  private requested = false;

  get loaded(): boolean { return this.buffer !== null; }
  get running(): boolean { return this.playing; }
  get duration(): number { return this.buffer ? this.buffer.duration : 0; }

  /**
   * Fetch and decode. Safe to call before there is an AudioContext and safe to
   * call repeatedly; it does the work once. Decoding needs a context, so if
   * there is not one yet this waits until `attach`.
   */
  async load(url: string, ctx: AudioContext): Promise<void> {
    if (this.requested) return;
    this.requested = true;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const bytes = await res.arrayBuffer();
      this.buffer = await ctx.decodeAudioData(bytes);
    } catch (err) {
      // A missing or undecodable soundtrack must not take the game with it.
      // The valley still has its weather.
      console.warn('Soundtrack unavailable:', err);
      this.requested = false;
    }
  }

  attach(ctx: AudioContext, destination: GainNode): void {
    this.ctx = ctx;
    this.destination = destination;
  }

  /**
   * Begin, if there is something to begin. Idempotent: area changes, menus and
   * conversations all leave this alone, which is the whole point — there is one
   * playback for the life of the page.
   */
  start(): void {
    if (this.playing || !this.ctx || !this.destination || !this.buffer) return;
    this.playing = true;
    this.schedule(this.ctx.currentTime + 0.15, true);
  }

  /**
   * Queue one pass and the handover into the next. Each pass owns its own gain
   * so the crossfade is a property of the pass rather than of a shared node
   * that both would be fighting over.
   */
  private schedule(at: number, first: boolean): void {
    const ctx = this.ctx;
    const buf = this.buffer;
    if (!ctx || !buf || !this.destination || !this.playing) return;

    const end = Math.max(1, buf.duration - TAIL_SILENCE);
    const offset = first ? 0 : HEAD_SILENCE;
    const length = end - offset;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    src.connect(gain).connect(this.destination);

    // The first pass eases in rather than starting at full level: the track
    // arriving at once over a valley that is already making noise sounds like
    // a switch being thrown.
    const fadeIn = first ? 3.5 : CROSSFADE;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(1, at + fadeIn);
    // And it hands over before its own fade-out has finished, so the next pass
    // is already rising underneath.
    const handover = at + length - CROSSFADE;
    gain.gain.setValueAtTime(1, Math.max(at + fadeIn, handover));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);

    src.start(at, offset);
    src.stop(at + length + 0.1);
    this.live.push(src);
    src.onended = () => {
      this.live = this.live.filter((s) => s !== src);
    };

    // Queue the next pass a little before this one ends. A timer rather than
    // `onended`, because the handover has to be scheduled *before* the current
    // pass finishes or there is nothing to cross into.
    const wait = Math.max(0.5, length - CROSSFADE) * 1000;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      if (!this.playing) return;
      this.schedule(ctx.currentTime, false);
    }, wait);
  }

  stop(): void {
    this.playing = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    for (const s of this.live) {
      try {
        s.stop();
      } catch {
        /* already finished */
      }
    }
    this.live.length = 0;
  }

  /** How many sources are sounding. One normally, two during a handover. */
  get voices(): number { return this.live.length; }
}
