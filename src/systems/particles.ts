/**
 * PARTICLES
 *
 * One pooled system for everything: chimney smoke, pollen drifting through a
 * shaft of morning light, fireflies, the puff a boot lifts off a dry path,
 * splashes, falling leaves.
 *
 * Particles carry a `z` height above the ground as well as a world position.
 * That is what lets a leaf fall *down* onto the grass and a firefly hover
 * above it, and it means every particle can be y-sorted into the same depth
 * pass as the props — so smoke can pass behind a tree.
 */

import { clamp, TAU } from '../core/math.ts';
import { makeRng, randRange, type Rng } from '../core/rng.ts';
import { PALETTE, type PaletteKey } from '../art/palette.ts';

export interface EmitOptions {
  x: number;
  y: number;
  z?: number;
  count?: number;
  /** Initial velocity, world px/s. */
  vx?: [number, number];
  vy?: [number, number];
  vz?: [number, number];
  life?: [number, number];
  size?: [number, number];
  /** Colour ramp; the particle walks it from index 0 to the end as it ages. */
  ramp: readonly PaletteKey[];
  gravity?: number;
  drag?: number;
  /** How strongly the ambient wind pushes this particle. */
  windBias?: number;
  /** Sideways wander; how smoke curls and fireflies meander. */
  wander?: number;
  /** Drawn additively — for anything that emits its own light. */
  additive?: boolean;
  /** Fades in over this fraction of its life instead of popping in. */
  fadeIn?: number;
  /** Blinks; fireflies only. */
  blink?: boolean;
  /** Spread the spawn point over a radius rather than a single pixel. */
  spread?: number;
  /** Particles below this z stop falling and settle for the rest of their life. */
  settles?: boolean;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  ramp: readonly string[];
  gravity: number;
  drag: number;
  windBias: number;
  wander: number;
  phase: number;
  additive: boolean;
  fadeIn: number;
  blink: boolean;
  settles: boolean;
  settled: boolean;
}

const MAX_PARTICLES = 1400;

export class Particles {
  private pool: Particle[] = [];
  private rng: Rng;
  /** Rolling index so we always overwrite the oldest slot under pressure. */
  private cursor = 0;
  /** Ambient wind, set by the weather system. */
  windX = 5;
  windY = 0;

  constructor(seed = 1337) {
    this.rng = makeRng(seed);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push(blank());
    }
  }

  get liveCount(): number {
    let n = 0;
    for (const p of this.pool) if (p.active) n++;
    return n;
  }

  emit(o: EmitOptions): void {
    const count = o.count ?? 1;
    const ramp = o.ramp.map((k) => PALETTE[k]);
    for (let i = 0; i < count; i++) {
      const p = this.next();
      const spreadA = this.rng() * TAU;
      const spreadR = o.spread ? Math.sqrt(this.rng()) * o.spread : 0;
      p.active = true;
      p.x = o.x + Math.cos(spreadA) * spreadR;
      p.y = o.y + Math.sin(spreadA) * spreadR * 0.6;
      p.z = o.z ?? 0;
      p.vx = randRange(this.rng, o.vx?.[0] ?? 0, o.vx?.[1] ?? 0);
      p.vy = randRange(this.rng, o.vy?.[0] ?? 0, o.vy?.[1] ?? 0);
      p.vz = randRange(this.rng, o.vz?.[0] ?? 0, o.vz?.[1] ?? 0);
      p.maxLife = randRange(this.rng, o.life?.[0] ?? 0.5, o.life?.[1] ?? 1);
      p.life = p.maxLife;
      p.size = Math.round(randRange(this.rng, o.size?.[0] ?? 1, o.size?.[1] ?? 1));
      p.ramp = ramp;
      p.gravity = o.gravity ?? 0;
      p.drag = o.drag ?? 0;
      p.windBias = o.windBias ?? 0;
      p.wander = o.wander ?? 0;
      p.phase = this.rng() * TAU;
      p.additive = o.additive ?? false;
      p.fadeIn = o.fadeIn ?? 0;
      p.blink = o.blink ?? false;
      p.settles = o.settles ?? false;
      p.settled = false;
    }
  }

  update(dt: number, time: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      if (p.settled) continue;

      if (p.wander > 0) {
        // Two out-of-phase sines: wandering that never resolves into a circle.
        p.vx += Math.sin(time * 1.7 + p.phase) * p.wander * dt;
        p.vy += Math.cos(time * 2.3 + p.phase * 1.4) * p.wander * 0.6 * dt;
      }
      if (p.windBias > 0) {
        p.vx += (this.windX - p.vx) * p.windBias * dt;
        p.vy += (this.windY - p.vy) * p.windBias * dt;
      }
      p.vz -= p.gravity * dt;
      if (p.drag > 0) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
        p.vz *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.z <= 0) {
        p.z = 0;
        if (p.settles) {
          p.settled = true;
          p.vx = p.vy = p.vz = 0;
        } else if (p.gravity > 0) {
          p.active = false;
        }
      }
    }
  }

  /**
   * Draw every live particle. `sortBias` lets the caller draw only particles
   * whose ground y falls within a depth slice, so they interleave with props.
   */
  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, time: number, yMin = -Infinity, yMax = Infinity): void {
    let additiveOn = false;
    for (const p of this.pool) {
      if (!p.active) continue;
      if (p.y < yMin || p.y >= yMax) continue;
      const t = 1 - p.life / p.maxLife;
      let alpha = 1;
      if (p.fadeIn > 0 && t < p.fadeIn) alpha = t / p.fadeIn;
      // Everything fades out over its last third rather than blinking away.
      if (t > 0.66) alpha *= 1 - (t - 0.66) / 0.34;
      if (p.blink) {
        const b = Math.sin(time * 3.1 + p.phase) * 0.5 + 0.5;
        alpha *= clamp(b * 1.6 - 0.35, 0, 1);
      }
      if (alpha <= 0.02) continue;

      const idx = clamp(Math.floor(t * p.ramp.length), 0, p.ramp.length - 1);
      if (p.additive !== additiveOn) {
        ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over';
        additiveOn = p.additive;
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.ramp[idx];
      ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - p.z - camY), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    if (additiveOn) ctx.globalCompositeOperation = 'source-over';
  }

  private next(): Particle {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      if (!p.active) return p;
    }
    // Everything is busy — recycle whatever the cursor is pointing at.
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % MAX_PARTICLES;
    return p;
  }

  clear(): void {
    for (const p of this.pool) p.active = false;
  }
}

function blank(): Particle {
  return {
    active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    life: 0, maxLife: 1, size: 1, ramp: [], gravity: 0, drag: 0,
    windBias: 0, wander: 0, phase: 0, additive: false, fadeIn: 0,
    blink: false, settles: false, settled: false,
  };
}

/** Named emitter presets. Data, so tuning one never means editing gameplay code. */
export const FX = {
  footstepDust: (x: number, y: number): EmitOptions => ({
    x, y, count: 3, spread: 2,
    vx: [-7, 7], vy: [-3, 3], vz: [4, 11],
    life: [0.24, 0.42], size: [1, 1], gravity: 26, drag: 3.2,
    ramp: ['dirt0', 'dirt1', 'dirt2'],
  }),
  grassBrush: (x: number, y: number): EmitOptions => ({
    x, y, count: 2, spread: 3,
    vx: [-9, 9], vy: [-4, 4], vz: [6, 14],
    life: [0.3, 0.5], size: [1, 1], gravity: 30, drag: 2.6,
    ramp: ['fol1', 'fol2', 'fol3'],
  }),
  splash: (x: number, y: number): EmitOptions => ({
    x, y, count: 7, spread: 3,
    vx: [-16, 16], vy: [-7, 7], vz: [14, 30],
    life: [0.3, 0.55], size: [1, 2], gravity: 70, drag: 1.2,
    ramp: ['water0', 'water1', 'water2'],
  }),
  chimneySmoke: (x: number, y: number): EmitOptions => ({
    x, y, z: 0, count: 1, spread: 1.5,
    vx: [-2, 2], vy: [-1, 1], vz: [7, 12],
    life: [2.6, 4.2], size: [1, 2], gravity: -1.5, drag: 0.25,
    windBias: 0.5, wander: 5, fadeIn: 0.22,
    ramp: ['cream1', 'stone1', 'stone2', 'stone3'],
  }),
  pollen: (x: number, y: number): EmitOptions => ({
    x, y, z: 0, count: 1,
    vx: [-3, 6], vy: [-2, 2], vz: [1, 5],
    life: [4, 8], size: [1, 1], gravity: 0.4, drag: 0.1,
    windBias: 0.25, wander: 3, fadeIn: 0.25,
    ramp: ['gold', 'fol1', 'cream0'],
  }),
  firefly: (x: number, y: number): EmitOptions => ({
    x, y, z: 6, count: 1,
    vx: [-5, 5], vy: [-3, 3], vz: [-2, 2],
    life: [6, 12], size: [1, 1], drag: 0.6, wander: 9,
    additive: true, blink: true, fadeIn: 0.15,
    ramp: ['gold', 'lamp', 'gold'],
  }),
  leafFall: (x: number, y: number, z: number): EmitOptions => ({
    x, y, z, count: 1,
    vx: [-4, 4], vy: [-1, 3], vz: [-3, -1],
    life: [3.5, 6], size: [1, 2], gravity: 2.4, drag: 0.5,
    windBias: 0.32, wander: 7, settles: true,
    ramp: ['fol2', 'fol3', 'fol4'],
  }),
  impactChips: (x: number, y: number, ramp: readonly PaletteKey[]): EmitOptions => ({
    x, y, count: 8, spread: 3,
    vx: [-26, 26], vy: [-12, 12], vz: [18, 44],
    life: [0.35, 0.7], size: [1, 2], gravity: 130, drag: 0.8,
    ramp,
  }),
} as const;
