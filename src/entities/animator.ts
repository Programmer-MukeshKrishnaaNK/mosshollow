/**
 * A small clip-based animator. Clips are data: a list of frame indices, a
 * frame rate, whether they loop, and an optional per-frame vertical offset.
 *
 * That last field is what turns a three-frame walk into a real one — the pass
 * frames are lifted a pixel, so the character rises between footfalls instead
 * of sliding. Timing and spacing live in the data, not in gameplay code.
 */

export interface Clip {
  frames: readonly number[];
  fps: number;
  loop: boolean;
  /** Per-frame y offset in pixels, applied when drawing. */
  offsets?: readonly number[];
  /** Frame indices that should fire a callback (footfalls, tool impacts). */
  events?: readonly number[];
}

export class Animator {
  private clip: Clip;
  private name = '';
  private t = 0;
  private index = 0;
  finished = false;
  /** Multiplies the clip's own fps — running plays the same clip faster. */
  rate = 1;
  onEvent: ((clipName: string, frame: number) => void) | null = null;

  constructor(private clips: Record<string, Clip>, initial: string) {
    this.clip = clips[initial];
    this.name = initial;
  }

  get current(): string {
    return this.name;
  }

  get frame(): number {
    return this.clip.frames[this.index];
  }

  get offset(): number {
    return this.clip.offsets?.[this.index] ?? 0;
  }

  /** Restart only if the clip actually changed, unless `force` is set. */
  play(name: string, force = false): void {
    if (this.name === name && !force) return;
    const next = this.clips[name];
    if (!next) throw new Error(`No animation clip named "${name}"`);
    this.clip = next;
    this.name = name;
    this.t = 0;
    this.index = 0;
    this.finished = false;
    this.fireEvent();
  }

  update(dt: number): void {
    if (this.finished) return;
    const step = 1 / (this.clip.fps * this.rate);
    this.t += dt;
    while (this.t >= step) {
      this.t -= step;
      this.index++;
      if (this.index >= this.clip.frames.length) {
        if (this.clip.loop) {
          this.index = 0;
        } else {
          this.index = this.clip.frames.length - 1;
          this.finished = true;
          return;
        }
      }
      this.fireEvent();
    }
  }

  private fireEvent(): void {
    if (!this.onEvent || !this.clip.events) return;
    if (this.clip.events.includes(this.index)) this.onEvent(this.name, this.index);
  }
}
