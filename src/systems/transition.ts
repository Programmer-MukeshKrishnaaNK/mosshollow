/**
 * AREA TRANSITIONS
 *
 * Fade out, swap, fade in. The swap happens at the exact moment the screen is
 * fully black, which matters more than it sounds: building an area bakes its
 * terrain, and that costs a couple of hundred milliseconds. Done during the
 * fade it would visibly stall the fade; done on a black screen it is invisible.
 *
 * The fade in is slower than the fade out. Leaving somewhere should feel
 * brisker than arriving.
 */

import { clamp } from '../core/math.ts';

const OUT = 0.28;
const IN = 0.42;

const smooth = (t: number): number => t * t * (3 - 2 * t);

export type Phase = 'idle' | 'out' | 'in';

export class Transition {
  phase: Phase = 'idle';
  private t = 0;
  /** This fade's durations. A doorway is brisk; a night should not be. */
  private out = OUT;
  private in_ = IN;
  /** Called once, at full black. */
  private onBlack: (() => void) | null = null;

  get active(): boolean {
    return this.phase !== 'idle';
  }

  /** 0 = clear, 1 = black. */
  get cover(): number {
    // Eased rather than linear. A linear fade spends the same time at every
    // value, so it reads as a mechanism moving at a constant rate; a
    // smoothstep leaves and arrives gently and only hurries through the middle,
    // which is what a fade in a film does and why nobody notices one.
    if (this.phase === 'out') return smooth(clamp(this.t / this.out, 0, 1));
    if (this.phase === 'in') return 1 - smooth(clamp(this.t / this.in_, 0, 1));
    return 0;
  }

  /**
   * Returns false if a fade is already running, which is also what stops a
   * held key from starting a second one.
   */
  begin(onBlack: () => void, outSec = OUT, inSec = IN): boolean {
    if (this.active) return false;
    this.phase = 'out';
    this.t = 0;
    this.out = outSec;
    this.in_ = inSec;
    this.onBlack = onBlack;
    return true;
  }

  update(dt: number): void {
    if (this.phase === 'idle') return;
    this.t += dt;
    if (this.phase === 'out' && this.t >= this.out) {
      // Full black. Do the expensive thing here and nobody sees it.
      const fn = this.onBlack;
      this.onBlack = null;
      fn?.();
      this.phase = 'in';
      this.t = 0;
    } else if (this.phase === 'in' && this.t >= this.in_) {
      this.phase = 'idle';
      this.t = 0;
    }
  }
}
