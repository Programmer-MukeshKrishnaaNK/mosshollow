/**
 * FARMING
 *
 * Holds the state of every worked tile and the rules that move it forward:
 * turned, watered, planted, growing, ready, or withered.
 *
 * State is kept in a sparse map keyed by tile, not a dense grid, because a
 * player works a corner of a large area — and because a sparse map is what a
 * save file wants to be.
 *
 * Growth is driven by the day rolling over, never by elapsed frames. A crop
 * advances only on days it was watered, which is what makes the watering can
 * a real decision rather than a chore with no consequence.
 */

import { clamp } from '../core/math.ts';
import { hash2 } from '../core/rng.ts';
import { buildSoilTiles, drawSoilEdges, type SoilTiles } from '../art/soil.ts';
import { sprite, type Sprite } from '../art/pixel.ts';
import { CROPS, type CropDef } from '../data/crops.ts';
import { Mat, TILE } from '../world/materials.ts';
import type { Tilemap } from '../world/tilemap.ts';
import type { PlotSave } from './save.ts';

export interface Plot {
  tx: number;
  ty: number;
  /** Turned over and plantable. */
  tilled: boolean;
  /** Watered today. */
  wet: boolean;
  crop: string | null;
  stage: number;
  /** Days accumulated toward the next stage. */
  progress: number;
  /** Consecutive days without water. */
  thirst: number;
  withered: boolean;
  /** How many harvests a regrowing crop has left. */
  regrowLeft: number;
  /** Set on harvest, for a brief pop animation. */
  pop: number;
}

export interface HarvestResult {
  item: string;
  count: number;
  crop: CropDef;
}

export class Farm {
  private plots = new Map<number, Plot>();
  private soil: SoilTiles;
  private cropArt = new Map<string, Sprite[]>();

  constructor(private map: Tilemap) {
    this.soil = buildSoilTiles();
    for (const crop of Object.values(CROPS)) {
      this.cropArt.set(crop.id, crop.art.map((m) => sprite(m, 8, m.length)));
    }
  }

  private key(tx: number, ty: number): number {
    return ty * this.map.w + tx;
  }

  get(tx: number, ty: number): Plot | undefined {
    return this.plots.get(this.key(tx, ty));
  }

  get all(): Iterable<Plot> {
    return this.plots.values();
  }

  get count(): number {
    return this.plots.size;
  }

  /** Ground you are allowed to put a hoe into. */
  canTill(tx: number, ty: number, blocked: boolean): boolean {
    if (blocked) return false;
    const mat = this.map.matAt(tx, ty);
    if (mat !== Mat.Grass && mat !== Mat.Field && mat !== Mat.Soil) return false;
    const plot = this.get(tx, ty);
    return !plot || !plot.tilled;
  }

  till(tx: number, ty: number): boolean {
    if (!this.map.inBounds(tx, ty)) return false;
    const k = this.key(tx, ty);
    const existing = this.plots.get(k);
    if (existing) {
      if (existing.tilled) return false;
      existing.tilled = true;
      return true;
    }
    this.plots.set(k, {
      tx, ty, tilled: true, wet: false, crop: null, stage: 0,
      progress: 0, thirst: 0, withered: false, regrowLeft: 0, pop: 0,
    });
    return true;
  }

  canWater(tx: number, ty: number): boolean {
    const p = this.get(tx, ty);
    return !!p && p.tilled && !p.wet;
  }

  water(tx: number, ty: number): boolean {
    const p = this.get(tx, ty);
    if (!p || !p.tilled || p.wet) return false;
    p.wet = true;
    p.thirst = 0;
    return true;
  }

  canPlant(tx: number, ty: number): boolean {
    const p = this.get(tx, ty);
    return !!p && p.tilled && !p.crop;
  }

  plant(tx: number, ty: number, cropId: string): boolean {
    const p = this.get(tx, ty);
    if (!p || !p.tilled || p.crop) return false;
    const crop = CROPS[cropId];
    if (!crop) return false;
    p.crop = cropId;
    p.stage = 0;
    p.progress = 0;
    p.withered = false;
    p.thirst = 0;
    p.regrowLeft = crop.regrowTo !== undefined ? 2 : 0;
    return true;
  }

  isReady(tx: number, ty: number): boolean {
    const p = this.get(tx, ty);
    if (!p || !p.crop || p.withered) return false;
    return p.stage >= CROPS[p.crop].art.length - 1;
  }

  harvest(tx: number, ty: number, roll: number): HarvestResult | null {
    const p = this.get(tx, ty);
    if (!p || !p.crop || p.withered) return null;
    const crop = CROPS[p.crop];
    if (p.stage < crop.art.length - 1) return null;

    const span = crop.yieldMax - crop.yieldMin + 1;
    const count = crop.yieldMin + Math.floor(roll * span);
    const result: HarvestResult = { item: crop.yieldItem, count, crop };

    if (crop.regrowTo !== undefined && p.regrowLeft > 0) {
      p.regrowLeft--;
      p.stage = crop.regrowTo;
      p.progress = 0;
    } else {
      p.crop = null;
      p.stage = 0;
      p.progress = 0;
      p.regrowLeft = 0;
    }
    p.pop = 1;
    return result;
  }

  /** Clear a withered plant so the tile can be used again. */
  clear(tx: number, ty: number): boolean {
    const p = this.get(tx, ty);
    if (!p || !p.crop) return false;
    if (!p.withered) return false;
    p.crop = null;
    p.withered = false;
    p.stage = 0;
    p.progress = 0;
    p.pop = 1;
    return true;
  }

  /**
   * Roll the farm forward one day.
   * @param rained true if it rained overnight — the sky waters for you.
   */
  advanceDay(rained: boolean): void {
    for (const p of this.plots.values()) {
      const watered = p.wet || rained;
      if (p.crop && !p.withered) {
        const crop = CROPS[p.crop];
        if (watered) {
          p.thirst = 0;
          const last = crop.art.length - 1;
          if (p.stage < last) {
            p.progress++;
            const need = crop.stageDays[p.stage] ?? 1;
            if (p.progress >= need) {
              p.progress = 0;
              p.stage++;
            }
          }
        } else {
          p.thirst++;
          if (p.thirst > crop.thirstDays) p.withered = true;
        }
      }
      // Water does not last: soil dries overnight unless it rains.
      p.wet = rained;
      // Bare ground you turned over and then never planted slowly goes back to
      // the valley. Roughly a week of neglect and there is nothing to show you
      // were ever there, which is the whole premise of the place.
      if (!p.crop && !p.wet && Math.random() < 0.14) p.tilled = false;
    }
    // Drop tiles that have fully reverted, so the map does not accumulate junk.
    for (const [k, p] of this.plots) {
      if (!p.tilled && !p.crop) this.plots.delete(k);
    }
  }

  /** Rain wets every worked tile while it falls. */
  soak(): void {
    for (const p of this.plots.values()) {
      p.wet = true;
      p.thirst = 0;
    }
  }

  /** Replace all plot state, e.g. from a save file. */
  restore(saved: readonly PlotSave[]): void {
    this.plots.clear();
    // Guarded because this is public API reached from a file on disk. The save
    // reader already guarantees an array; a caller passing anything else should
    // get an empty farm, not a thrown TypeError halfway through loading.
    if (!Array.isArray(saved)) return;
    for (const s of saved) {
      if (!this.map.inBounds(s.tx, s.ty)) continue;
      this.plots.set(this.key(s.tx, s.ty), {
        tx: s.tx, ty: s.ty, tilled: s.tilled, wet: s.wet, crop: s.crop,
        stage: s.stage, progress: s.progress, thirst: s.thirst,
        withered: s.withered, regrowLeft: s.regrowLeft, pop: 0,
      });
    }
  }

  update(dt: number): void {
    for (const p of this.plots.values()) {
      if (p.pop > 0) p.pop = Math.max(0, p.pop - dt * 3.4);
    }
  }

  // --- drawing -------------------------------------------------------------

  /** Soil goes down with the ground, under everything that stands on it. */
  drawSoil(ctx: CanvasRenderingContext2D, camX: number, camY: number, viewW: number, viewH: number): void {
    for (const p of this.plots.values()) {
      if (!p.tilled) continue;
      const x = p.tx * TILE - camX;
      const y = p.ty * TILE - camY;
      if (x < -TILE || y < -TILE || x > viewW || y > viewH) continue;
      const set = p.wet ? this.soil.wet : this.soil.dry;
      const variant = Math.floor(hash2(p.tx, p.ty, 3) * set.length) % set.length;
      ctx.drawImage(set[variant], x, y);
      let mask = 0;
      if (this.isTilled(p.tx, p.ty - 1)) mask |= 1;
      if (this.isTilled(p.tx + 1, p.ty)) mask |= 2;
      if (this.isTilled(p.tx, p.ty + 1)) mask |= 4;
      if (this.isTilled(p.tx - 1, p.ty)) mask |= 8;
      drawSoilEdges(ctx, x, y, mask, p.wet);
    }
  }

  private isTilled(tx: number, ty: number): boolean {
    const p = this.get(tx, ty);
    return !!p && p.tilled;
  }

  /** Draw one plant. Called from the world's depth-sorted pass. */
  drawCrop(ctx: CanvasRenderingContext2D, p: Plot, camX: number, camY: number, time: number, wind: number): void {
    if (!p.crop) return;
    const frames = this.cropArt.get(p.crop);
    if (!frames) return;
    const spr = frames[clamp(p.stage, 0, frames.length - 1)];
    const baseX = Math.round(p.tx * TILE + TILE / 2 - camX - spr.ox);
    let baseY = Math.round(p.ty * TILE + TILE - camY - spr.h + 2);

    // A short hop when harvested, so taking something off the plant registers.
    if (p.pop > 0) baseY -= Math.round(Math.sin(p.pop * Math.PI) * 3);

    ctx.save();
    if (p.withered) {
      // Withered plants keep their shape and lose their colour, which reads as
      // dead far better than swapping in a brown sprite would.
      ctx.globalAlpha = 0.85;
      ctx.filter = 'grayscale(1) brightness(0.62) sepia(0.5)';
    }
    // Taller plants catch more wind, same as everything else in the valley.
    const flex = (spr.h / 20) * 1.6;
    const phase = hash2(p.tx, p.ty, 17) * 6.28;
    for (let row = 0; row < spr.h; row++) {
      const t = 1 - row / Math.max(1, spr.h - 1);
      const bend = Math.sin(time * 1.6 + phase + p.tx * 0.05) * wind * flex * Math.pow(t, 1.9);
      ctx.drawImage(spr.canvas, 0, row, spr.w, 1, baseX + Math.round(bend), baseY + row, spr.w, 1);
    }
    ctx.restore();
  }

  /** Sort key for a plant: the bottom of the tile it grows in. */
  static sortY(p: Plot): number {
    return p.ty * TILE + TILE;
  }
}
