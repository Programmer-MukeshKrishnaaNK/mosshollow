/**
 * DROPPED ITEMS
 *
 * When something gives up its wood or its stone, the wood and stone land on
 * the ground and you walk over to get them. Adding straight to the inventory
 * would be one line of code and it would throw away the best half-second of
 * the interaction.
 *
 * The behaviour that sells it, in order:
 *  - Items pop *out* of whatever produced them, with an arc and a bounce.
 *  - They will not come to you immediately. A short delay means you see them
 *    land, and it stops a drop snapping back into your pocket before it has
 *    read as an object at all.
 *  - After that they home in, accelerating, so collecting a scatter of five
 *    feels like a sweep rather than five separate events.
 *  - A full inventory leaves them lying there rather than deleting them.
 */

import { TAU } from '../core/math.ts';
import { PALETTE } from '../art/palette.ts';
import { item } from '../data/items.ts';
import { drawShadow } from '../render/shadow.ts';

interface Drop {
  active: boolean;
  id: string;
  count: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Seconds since it landed on the ground. */
  age: number;
  /** Set once it starts homing, so it never gives up part-way. */
  homing: boolean;
  bounced: boolean;
  phase: number;
}

const MAX_DROPS = 120;
/** How long a drop lies there before it will come to you. */
const SETTLE_DELAY = 0.42;
const MAGNET_RADIUS = 34;
const COLLECT_RADIUS = 7;

export class Pickups {
  private pool: Drop[] = [];

  constructor() {
    for (let i = 0; i < MAX_DROPS; i++) {
      this.pool.push({
        active: false, id: '', count: 0, x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0, age: 0, homing: false, bounced: false, phase: 0,
      });
    }
  }

  get liveCount(): number {
    let n = 0;
    for (const d of this.pool) if (d.active) n++;
    return n;
  }

  /** Scatter `count` of an item out of a point. */
  spawn(id: string, count: number, x: number, y: number, roll: () => number): void {
    // One entity per unit, up to a sane limit — five things bouncing out reads
    // as a haul in a way that one thing labelled "x5" never does.
    const entities = Math.min(count, 6);
    const per = Math.floor(count / entities);
    let remainder = count - per * entities;
    for (let i = 0; i < entities; i++) {
      const d = this.free();
      if (!d) return;
      const angle = (i / entities) * TAU + roll() * 0.9;
      // Enough to actually travel: with the drag below, 14-34 px/s moved a
      // drop about five pixels, and the burst read as items appearing rather
      // than being thrown clear.
      const speed = 34 + roll() * 46;
      d.active = true;
      d.id = id;
      d.count = per + (remainder-- > 0 ? 1 : 0);
      d.x = x + Math.cos(angle) * 2;
      d.y = y + Math.sin(angle) * 1.4;
      d.z = 6 + roll() * 4;
      d.vx = Math.cos(angle) * speed;
      d.vy = Math.sin(angle) * speed * 0.6;
      d.vz = 26 + roll() * 26;
      d.age = 0;
      d.homing = false;
      d.bounced = false;
      d.phase = roll() * TAU;
    }
  }

  /**
   * @param collect returns how many of the stack could not be taken.
   */
  update(
    dt: number,
    px: number,
    py: number,
    collect: (id: string, count: number) => number,
    onCollected: (id: string, count: number, x: number, y: number) => void,
  ): void {
    for (const d of this.pool) {
      if (!d.active) continue;

      if (d.homing) {
        const dx = px - d.x;
        const dy = py - 6 - d.y;
        const dist = Math.hypot(dx, dy) || 1;
        // Accelerating rather than moving at a fixed speed: a drop that starts
        // slow and arrives fast reads as being pulled.
        const pull = 340;
        d.vx += (dx / dist) * pull * dt;
        d.vy += (dy / dist) * pull * dt;
        d.vx *= 0.86;
        d.vy *= 0.86;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.z += (5 - d.z) * Math.min(1, 8 * dt);
        if (dist < COLLECT_RADIUS) {
          const left = collect(d.id, d.count);
          if (left <= 0) {
            onCollected(d.id, d.count, d.x, d.y);
            d.active = false;
          } else {
            // Nowhere to put it: drop it back where it stands.
            d.count = left;
            d.homing = false;
            d.age = 0;
            d.vx = 0;
            d.vy = 0;
          }
        }
        continue;
      }

      if (d.z > 0 || d.vz !== 0) {
        d.vz -= 190 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.z += d.vz * dt;
        d.vx *= 0.92;
        d.vy *= 0.92;
        if (d.z <= 0) {
          d.z = 0;
          if (!d.bounced && d.vz < -30) {
            // One small bounce. Two looks like a physics demo.
            d.bounced = true;
            d.vz = -d.vz * 0.34;
          } else {
            d.vz = 0;
            d.vx = 0;
            d.vy = 0;
          }
        }
      } else {
        d.age += dt;
      }

      if (d.age > SETTLE_DELAY) {
        const dx = px - d.x;
        const dy = py - 6 - d.y;
        if (dx * dx + dy * dy < MAGNET_RADIUS * MAGNET_RADIUS) d.homing = true;
      }
    }
  }

  /** Everything currently on the ground, for the world's depth sort. */
  forEach(fn: (d: Readonly<Drop>) => void): void {
    for (const d of this.pool) if (d.active) fn(d);
  }

  static draw(
    ctx: CanvasRenderingContext2D,
    d: Readonly<Drop>,
    camX: number,
    camY: number,
    time: number,
    sun: { dx: number; dy: number; alpha: number },
  ): void {
    const def = item(d.id);
    // A settled drop breathes; one in the air does not.
    const bob = d.z === 0 && !d.homing ? Math.sin(time * 3 + d.phase) * 1.2 : 0;
    const sx = Math.round(d.x - camX);
    const sy = Math.round(d.y - camY);
    drawShadow(ctx, sx, sy, 8, 4, sun, 1 - Math.min(0.6, d.z / 22));
    ctx.drawImage(
      def.icon.canvas,
      sx - Math.floor(def.icon.w / 2),
      Math.round(sy - d.z - def.icon.h + 2 + bob),
    );
  }

  /** Sort key — where the drop touches the ground. */
  static sortY(d: Readonly<Drop>): number {
    return d.y;
  }

  clear(): void {
    for (const d of this.pool) d.active = false;
  }

  /** Everything on the ground, flattened for the save file. */
  serialize(): { id: string; count: number; x: number; y: number }[] {
    const out: { id: string; count: number; x: number; y: number }[] = [];
    for (const d of this.pool) {
      if (d.active) out.push({ id: d.id, count: d.count, x: d.x, y: d.y });
    }
    return out;
  }

  /** Put saved drops back, settled and ready to be walked over. */
  restore(list: readonly { id: string; count: number; x: number; y: number }[]): void {
    this.clear();
    for (const s of list) {
      const d = this.free();
      if (!d) return;
      d.active = true;
      d.id = s.id;
      d.count = s.count;
      d.x = s.x;
      d.y = s.y;
      d.z = 0;
      d.vx = d.vy = d.vz = 0;
      // Already settled: reloading should not make you wait for them again.
      d.age = SETTLE_DELAY;
      d.homing = false;
      d.bounced = true;
      d.phase = Math.random() * TAU;
    }
  }

  private free(): Drop | null {
    for (const d of this.pool) if (!d.active) return d;
    return null;
  }
}

export type { Drop };
void PALETTE;
