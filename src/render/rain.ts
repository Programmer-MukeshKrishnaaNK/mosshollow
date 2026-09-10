/**
 * RAIN
 *
 * Drawn as a dedicated screen-space layer rather than through the particle
 * system: a convincing downpour needs several hundred drops on screen at once,
 * which is the one case where a general-purpose pooled emitter is the wrong
 * tool.
 *
 * Two halves, and the second is what sells it. Falling streaks are easy and on
 * their own read as a filter over the picture. What makes rain feel like it is
 * happening *in* the world is that every drop lands: each one ends at a ground
 * height, leaves a splash mark in world space, and the splashes stay put while
 * the camera moves.
 */

import { TAU } from '../core/math.ts';
import { PALETTE } from '../art/palette.ts';

interface Drop {
  /** Screen space — rain does not need parallax to convince. */
  x: number;
  y: number;
  /** Where this drop lands, giving the volume its depth. */
  groundY: number;
  speed: number
  len: number;
  /** Near drops are brighter and longer than far ones. */
  depth: number;
}

interface Splash {
  /** World space, so a splash stays where it landed. */
  wx: number;
  wy: number;
  t: number;
  depth: number;
}

const MAX_DROPS = 420;
const MAX_SPLASHES = 160;

export class Rain {
  private drops: Drop[] = [];
  private splashes: Splash[] = [];
  private splashCursor = 0;

  constructor(private w: number, private h: number) {
    for (let i = 0; i < MAX_DROPS; i++) this.drops.push(this.spawn(Math.random() * h));
    for (let i = 0; i < MAX_SPLASHES; i++) this.splashes.push({ wx: 0, wy: 0, t: 0, depth: 0 });
  }

  private spawn(y: number): Drop {
    const depth = Math.random();
    return {
      x: Math.random() * (this.w + 60) - 30,
      y,
      // Land somewhere below where it started, biased by depth so near drops
      // land low on screen and far ones land high.
      groundY: y + 40 + Math.random() * this.h * 0.7,
      speed: 320 + depth * 340,
      len: 4 + Math.round(depth * 6),
      depth,
    };
  }

  update(dt: number, intensity: number, wind: number, camX: number, camY: number): void {
    const active = Math.floor(this.drops.length * intensity);
    const slant = wind * 26;
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      if (i >= active) continue;
      d.y += d.speed * dt * (0.75 + intensity * 0.35);
      d.x += slant * dt * (0.6 + d.depth * 0.8);
      if (d.y >= d.groundY) {
        this.addSplash(d.x + camX, d.groundY + camY, d.depth);
        const fresh = this.spawn(-10 - Math.random() * 40);
        d.x = fresh.x;
        d.y = fresh.y;
        d.groundY = fresh.groundY;
        d.speed = fresh.speed;
        d.len = fresh.len;
        d.depth = fresh.depth;
      }
      if (d.x < -40) d.x += this.w + 60;
      if (d.x > this.w + 40) d.x -= this.w + 60;
    }
    for (const s of this.splashes) {
      if (s.t > 0) s.t -= dt;
    }
  }

  private addSplash(wx: number, wy: number, depth: number): void {
    const s = this.splashes[this.splashCursor];
    this.splashCursor = (this.splashCursor + 1) % this.splashes.length;
    s.wx = wx;
    s.wy = wy;
    s.t = 0.26;
    s.depth = depth;
  }

  /** Splashes only — drawn under the depth-sorted pass, on the ground. */
  drawSplashes(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    for (const s of this.splashes) {
      if (s.t <= 0) continue;
      const age = 1 - s.t / 0.26;
      const x = Math.round(s.wx - camX);
      const y = Math.round(s.wy - camY);
      if (x < -8 || y < -8 || x > this.w + 8 || y > this.h + 8) continue;
      ctx.globalAlpha = (1 - age) * (0.3 + s.depth * 0.4);
      ctx.fillStyle = PALETTE.water0;
      // An opening ring, two pixels wide, flattened by the viewing angle.
      const r = Math.round(age * 3.2);
      if (r <= 0) {
        ctx.fillRect(x, y, 1, 1);
      } else {
        ctx.fillRect(x - r, y, 1, 1);
        ctx.fillRect(x + r, y, 1, 1);
        const ry = Math.max(1, Math.round(r * 0.45));
        ctx.fillRect(x, y - ry, 1, 1);
        ctx.fillRect(x, y + ry, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** The falling streaks — drawn over everything, including the player. */
  drawFall(ctx: CanvasRenderingContext2D, intensity: number, wind: number): void {
    if (intensity <= 0.01) return;
    const active = Math.floor(this.drops.length * intensity);
    const lean = Math.round(wind * 1.6);
    for (let i = 0; i < active; i++) {
      const d = this.drops[i];
      const x = Math.round(d.x);
      const y = Math.round(d.y);
      ctx.globalAlpha = 0.22 + d.depth * 0.4;
      ctx.fillStyle = d.depth > 0.6 ? PALETTE.water0 : PALETTE.water1;
      if (lean === 0) {
        ctx.fillRect(x, y, 1, d.len);
      } else {
        // Slanted drops are drawn as a short stair, which keeps them on the
        // pixel grid instead of turning into an antialiased line.
        const steps = d.len;
        for (let s = 0; s < steps; s++) {
          ctx.fillRect(x + Math.round((s / steps) * lean), y + s, 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Rings spreading on open water. Cheap, and the pond looks dead without it. */
  drawWaterRings(ctx: CanvasRenderingContext2D, time: number, intensity: number, camX: number, camY: number, isWater: (wx: number, wy: number) => boolean): void {
    if (intensity <= 0.01) return;
    const count = Math.floor(26 * intensity);
    ctx.fillStyle = PALETTE.water0;
    for (let i = 0; i < count; i++) {
      // A deterministic scatter that recycles on a stagger, so rings appear all
      // over the water rather than marching in step.
      const phase = (time * 0.9 + i * 0.37) % 1;
      const seedA = Math.sin(i * 12.9898 + Math.floor(time * 0.9 + i * 0.37) * 78.233);
      const seedB = Math.sin(i * 39.346 + Math.floor(time * 0.9 + i * 0.37) * 11.135);
      const wx = camX + (seedA * 0.5 + 0.5) * this.w;
      const wy = camY + (seedB * 0.5 + 0.5) * this.h;
      if (!isWater(wx, wy)) continue;
      const r = phase * 5;
      ctx.globalAlpha = (1 - phase) * 0.45;
      const x = Math.round(wx - camX);
      const y = Math.round(wy - camY);
      const rx = Math.round(r);
      const ry = Math.max(1, Math.round(r * 0.5));
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * TAU;
        ctx.fillRect(x + Math.round(Math.cos(ang) * rx), y + Math.round(Math.sin(ang) * ry), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }
}
