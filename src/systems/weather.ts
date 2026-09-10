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

export type Sky = 'clear' | 'gathering' | 'rain' | 'clearing';

export class Weather {
  /** -1..1. Direction and force of the wind right now. */
  wind = 0;
  /** 0..1, the slow envelope. Gusts ride on top of this. */
  breeze = 0.35;
  /** 0..1, how hard it is raining. */
  rain = 0;
  /** 0..1, how much cloud is over the valley. Leads and outlasts the rain. */
  overcast = 0;
  sky: Sky = 'clear';
  private stateTimer = 90;
  private rainTarget = 0;
  private overcastTarget = 0;
  private gust = 0;
  private gustTimer = 6;
  private rng: Rng;
  private t = 0;

  constructor(seed = 4242) {
    this.rng = makeRng(seed);
  }

  /** Force a state, for testing and for scripted story weather. */
  setSky(sky: Sky, holdSeconds = 60): void {
    this.sky = sky;
    this.stateTimer = holdSeconds;
    this.applyState();
  }

  private applyState(): void {
    switch (this.sky) {
      case 'clear':
        this.rainTarget = 0;
        this.overcastTarget = 0;
        break;
      case 'gathering':
        // The sky closes over well before the first drop falls.
        this.rainTarget = 0;
        this.overcastTarget = 0.75;
        break;
      case 'rain':
        this.rainTarget = 0.45 + this.rng() * 0.5;
        this.overcastTarget = 0.9;
        break;
      case 'clearing':
        this.rainTarget = 0;
        this.overcastTarget = 0.35;
        break;
    }
  }

  update(dt: number): void {
    this.t += dt;

    // --- the sky's own slow state machine --------------------------------
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      switch (this.sky) {
        case 'clear':
          this.sky = this.rng() < 0.45 ? 'gathering' : 'clear';
          this.stateTimer = this.sky === 'gathering' ? 25 + this.rng() * 30 : 120 + this.rng() * 180;
          break;
        case 'gathering':
          this.sky = 'rain';
          this.stateTimer = 70 + this.rng() * 150;
          break;
        case 'rain':
          this.sky = 'clearing';
          this.stateTimer = 30 + this.rng() * 40;
          break;
        case 'clearing':
          this.sky = 'clear';
          this.stateTimer = 150 + this.rng() * 240;
          break;
      }
      this.applyState();
      // Wind picks up ahead of the weather and drops away after it.
      this.breeze = this.sky === 'gathering' ? 0.7 : this.sky === 'rain' ? 0.55 : 0.32;
    }
    // Rain arrives and leaves gradually; nothing about weather is a switch.
    this.rain = damp(this.rain, this.rainTarget, this.rainTarget > this.rain ? 0.22 : 0.35, dt);
    this.overcast = damp(this.overcast, this.overcastTarget, 0.3, dt);

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

  /** True when the sky is dry enough for pollen, butterflies and birdsong. */
  get fair(): boolean {
    return this.rain < 0.12 && this.overcast < 0.5;
  }
}
