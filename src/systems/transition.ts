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

export type Phase = 'idle' | 'out' | 'in';

export class Transition {
  phase: Phase = 'idle';
  private t = 0;
  /** Called once, at full black. */
  private onBlack: (() => void) | null = null;

  get active(): boolean {
    return this.phase !== 'idle';
  }

  /** 0 = clear, 1 = black. */
  get cover(): number {
    if (this.phase === 'out') return clamp(this.t / OUT, 0, 1);
    if (this.phase === 'in') return 1 - clamp(this.t / IN, 0, 1);
    return 0;
  }

  begin(onBlack: () => void): boolean {
    if (this.active) return false;
    this.phase = 'out';
    this.t = 0;
    this.onBlack = onBlack;
    return true;
  }

  update(dt: number): void {
    if (this.phase === 'idle') return;
    this.t += dt;
    if (this.phase === 'out' && this.t >= OUT) {
      // Full black. Do the expensive thing here and nobody sees it.
      const fn = this.onBlack;
      this.onBlack = null;
      fn?.();
      this.phase = 'in';
      this.t = 0;
    } else if (this.phase === 'in' && this.t >= IN) {
      this.phase = 'idle';
      this.t = 0;
    }
  }
}
