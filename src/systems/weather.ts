/**
 * WIND (and, later, everything else the sky does)
 *
 * Wind is not decoration here — it is the shared clock that every moving plant
 * in the world reads from. One value, layered from three sine waves plus
 * occasional gusts, drives grass, canopies, reeds, smoke and drifting
 * particles. Because they all bend from the same number, a gust crossing the
 * valley moves everything together, which is what makes it read as weather
 * rather than as a lot of objects wobbling independently.
 */

import { clamp, damp } from '../core/math.ts';
import { makeRng, type Rng } from '../core/rng.ts';

export type Sky = 'clear' | 'overcast';

export class Weather {
  /** -1..1. Direction and force of the wind right now. */
  wind = 0;
  /** 0..1, the slow envelope. Gusts ride on top of this. */
  breeze = 0.35;
  sky: Sky = 'clear';
  private gust = 0;
  private gustTimer = 6;
  private rng: Rng;
  private t = 0;

  constructor(seed = 4242) {
    this.rng = makeRng(seed);
  }

  update(dt: number): void {
    this.t += dt;
    this.gustTimer -= dt;
    if (this.gustTimer <= 0) {
      // Gusts arrive irregularly and vary in size; a metronome would give the
      // whole valley a tell.
      this.gustTimer = 4 + this.rng() * 11;
      this.gust = 0.35 + this.rng() * 0.65;
    }
    this.gust = damp(this.gust, 0, 0.55, dt);

    const slow = Math.sin(this.t * 0.23) * 0.5 + Math.sin(this.t * 0.41 + 1.7) * 0.3;
    const fast = Math.sin(this.t * 1.31 + 0.6) * 0.2;
    this.wind = clamp((slow + fast) * (this.breeze + this.gust), -1.6, 1.6);
  }

  /** Horizontal drift applied to airborne particles, in world px/s. */
  get driftX(): number {
    return this.wind * 11;
  }
}
