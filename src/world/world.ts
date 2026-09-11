/**
 * THE WORLD
 *
 * Assembles an area from its data: bakes the ground, places its props, grows
 * the forest that wraps it, scatters the decoration that makes it feel lived
 * in, and then each frame draws the whole thing in correct depth order with
 * everything bending in the same wind.
 */

import { TAU, type Rect, rectsOverlap } from '../core/math.ts';
import { chance, hash2, makeRng, noise2, randRange, type Rng } from '../core/rng.ts';
import { drawSheared, type Sprite } from '../art/pixel.ts';
import { buildFarmhouse, type Building } from '../art/building.ts';
import type { AreaData, AreaExit } from '../data/area.ts';
import { bakeTerrain, type BakedTerrain } from '../render/terrain.ts';
import { WaterSurface } from '../render/water.ts';
import { drawShadow } from '../render/shadow.ts';
import type { Light } from '../render/lighting.ts';
import { FX, type Particles } from '../systems/particles.ts';
import type { TimeOfDay } from '../systems/time.ts';
import type { Weather } from '../systems/weather.ts';
import { Mat, TILE } from './materials.ts';
import { buildProps, type Prop, type PropChange, type PropDef } from './props.ts';
import { Tilemap } from './tilemap.ts';

/** Anything drawn in the depth-sorted pass. */
export interface Drawable {
  /** Sort key — the y of the object's contact with the ground. */
  sortY: number;
  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, w: World): void;
}

export class World {
  readonly data: AreaData;
  readonly map: Tilemap;
  readonly terrain: BakedTerrain;
  readonly water: WaterSurface;
  readonly defs: Record<string, PropDef>;
  readonly props: Prop[] = [];
  house: Building | null = null;
  /** Which farmhouse the projects have built so far. */
  houseLevel = 1;
  /**
   * Projects already carried out here. Effects like "add three lanterns" are
   * not idempotent, so applying the same project twice would leave two
   * lanterns in every post hole.
   */
  private applied = new Set<string>();
  housePos = { x: 0, y: 0 };

  /**
   * Blocking rectangles, each remembering the prop it belongs to so that
   * felling a tree actually opens the ground it was standing on.
   */
  private colliders: Collider[] = [];
  /** Coarse spatial buckets so collision never scans the whole list. */
  private buckets = new Map<number, Collider[]>();
  private static readonly BUCKET = 64;

  /** Props that shed leaves, cached so the ambient pass need not filter. */
  private shedders: Prop[] = [];
  /** Props with a chimney, cached so the ambient pass need not filter. */
  private smokers: Prop[] = [];
  /** Props currently ringing from a blow, so the update is not a full scan. */
  private struck: Prop[] = [];
  /**
   * Everything the player has done to the props, keyed by the position it
   * happened at. Saving mutations rather than the whole prop list means the
   * two thousand trees the seed generates never touch the save file, and a
   * change to the world's layout does not invalidate anyone's game.
   */
  private changes = new Map<string, PropChange>();
  private ambientTimer = 0;
  private smokeTimer = 0;
  time = 0;

  constructor(data: AreaData, ctx: CanvasRenderingContext2D, viewW: number, viewH: number) {
    this.data = data;
    this.map = new Tilemap(data.map);
    this.terrain = bakeTerrain(this.map, data.seed);
    this.water = new WaterSurface(viewW, viewH, ctx);
    this.defs = buildProps();

    const rng = makeRng(data.seed ^ 0x5f3a);

    if (data.house) {
      this.house = buildFarmhouse(1);
      this.housePos = { x: data.house.tx * TILE, y: data.house.ty * TILE };
    }

    this.growForest(rng);
    this.placeAuthored(rng);
    this.raiseFences();
    this.plantReeds(rng);
    this.scatterDecoration(rng);

    // Depth order is fixed for static props, so sort once rather than per frame.
    this.props.sort((a, b) => (a.y + (a.def.sortBias ?? 0)) - (b.y + (b.def.sortBias ?? 0)));
    this.buildColliders();
    this.shedders = this.props.filter((p) => p.def.sheds);
    this.smokers = this.props.filter((p) => p.def.smoke);
  }

  /**
   * The window changed shape. Only the water's scratch buffer is view-sized;
   * the terrain bake is world-sized and the props do not care.
   */
  resizeView(viewW: number, viewH: number, ctx: CanvasRenderingContext2D): void {
    this.water.resize(viewW, viewH, ctx);
  }

  // --- construction ---------------------------------------------------------

  private add(defId: string, x: number, y: number, rng: Rng, inspect?: string): void {
    const def = this.defs[defId];
    if (!def) throw new Error(`No prop definition "${defId}"`);
    this.props.push({
      def,
      x,
      y,
      inspect: inspect ?? def.inspect,
      phase: rng() * TAU,
      // A spread of stiffness across a stand of trees: some move a lot more
      // than others, which is most of what stops them looking like clones.
      swayScale: randRange(rng, 0.72, 1.34),
    });
  }

  private pickDef(def: string | string[], x: number, y: number): string {
    if (typeof def === 'string') return def;
    return def[Math.floor(hash2(Math.round(x), Math.round(y), 3) * def.length) % def.length];
  }

  private placeAuthored(rng: Rng): void {
    for (const p of this.data.props) {
      this.add(this.pickDef(p.def, p.tx, p.ty), p.tx * TILE, p.ty * TILE, rng, p.inspect);
    }
  }

  /**
   * The wall of trees that closes the area in. Placed on a jittered grid so it
   * reads as woodland rather than a hedge, and thickened at the very edge so
   * the player never sees daylight through the back of it.
   */
  private growForest(rng: Rng): void {
    const b = this.data.forestBorder;
    const oaks = ['oak0', 'oak1', 'oak2'];
    const birches = ['birch0', 'birch1'];
    for (let ty = -1; ty < this.map.h + 1; ty++) {
      for (let tx = -1; tx < this.map.w + 1; tx++) {
        const edgeDist = Math.min(tx, ty, this.map.w - 1 - tx, this.map.h - 1 - ty);
        if (edgeDist > b) continue;
        // Denser at the outside, thinning where it meets the clearing.
        const density = edgeDist < 0 ? 1 : 0.94 - (edgeDist / (b + 1)) * 0.55;
        if (!chance(rng, density * 0.62)) continue;
        const x = (tx + 0.5 + (rng() - 0.5) * 0.9) * TILE;
        const y = (ty + 0.5 + (rng() - 0.5) * 0.9) * TILE;
        if (this.inExit(tx, ty, 1)) continue; // a gate has to be a gate
        // Nothing grows in the water. Where a stream runs out through the tree
        // line this was planting oaks mid-current — forty-eight of them in the
        // meadow, where the water leaves the map at both ends. The test is on
        // the jittered position rather than the loop's tile, because the jitter
        // is up to half a tile and will happily walk a trunk into the stream.
        if (this.map.matAt(Math.floor(x / TILE), Math.floor(y / TILE)) === Mat.Water) continue;
        const onPath = this.map.matAt(tx, ty) === Mat.Path;
        if (onPath) {
          // Where the track leaves the clearing, the way is grown over rather
          // than walled off — you can see there is somewhere to go.
          if (edgeDist <= b - 1 && chance(rng, 0.7)) {
            this.add(rng() > 0.5 ? 'bush0' : 'bush2', x, y, rng);
          }
          continue;
        }
        const kind = chance(rng, 0.74) ? oaks : birches;
        this.add(kind[Math.floor(rng() * kind.length)], x, y, rng);
        // The tiles under the border stay solid whatever happens to the trees
        // on them, so felling one would leave a gap you still could not walk
        // through. Better that the deep woods simply do not yield.
        this.props[this.props.length - 1].guarded = true;
        if (edgeDist >= b - 1 && chance(rng, 0.34)) {
          // Undergrowth sits below its tree, by up to most of a tile, so it
          // needs the same water test the tree just passed — otherwise a bush
          // slides off a dry bank into the stream on its own.
          const bushId = `bush${Math.floor(rng() * 3)}`;
          const bx = x + randRange(rng, -10, 10);
          const by = y + randRange(rng, 6, 14);
          if (this.map.matAt(Math.floor(bx / TILE), Math.floor(by / TILE)) !== Mat.Water) {
            this.add(bushId, bx, by, rng);
          }
        }
      }
    }
  }

  /** Fence runs become posts every tile with a rail spanning between them. */
  private raiseFences(): void {
    const rng = makeRng(this.data.seed + 991);
    for (const run of this.data.fences) {
      const dx = Math.sign(run.x1 - run.x0);
      const dy = Math.sign(run.y1 - run.y0);
      const steps = Math.max(Math.abs(run.x1 - run.x0), Math.abs(run.y1 - run.y0));
      for (let i = 0; i <= steps; i++) {
        const tx = run.x0 + dx * i;
        const ty = run.y0 + dy * i;
        if (dx !== 0 && i < steps) this.add('fenceRail', tx * TILE, ty * TILE, rng);
        if (dy !== 0 && i < steps) {
          // A vertical run still uses horizontal rails, just short ones set
          // between posts — same as a real post-and-rail fence turning a corner.
          this.add('fencePost', tx * TILE, (ty + 0.5) * TILE, rng);
        }
        this.add('fencePost', tx * TILE, ty * TILE, rng);
      }
    }
  }

  /** Reeds crowd the waterline wherever the bank is gentle. */
  private plantReeds(rng: Rng): void {
    for (let ty = 1; ty < this.map.h - 1; ty++) {
      for (let tx = 1; tx < this.map.w - 1; tx++) {
        if (this.map.matAt(tx, ty) === Mat.Water) continue;
        const touchesWater =
          this.map.matAt(tx - 1, ty) === Mat.Water ||
          this.map.matAt(tx + 1, ty) === Mat.Water ||
          this.map.matAt(tx, ty - 1) === Mat.Water ||
          this.map.matAt(tx, ty + 1) === Mat.Water;
        if (!touchesWater) continue;
        if (this.isKeptClear(tx, ty) || this.inExit(tx, ty, 1)) continue;
        const clump = noise2(tx * 0.35, ty * 0.35, this.data.seed + 61);
        if (clump < 0.42) continue;
        const n = 1 + Math.floor(clump * 3);
        for (let i = 0; i < n; i++) {
          this.add('reed', (tx + rng()) * TILE, (ty + 0.35 + rng() * 0.6) * TILE, rng);
        }
      }
    }
  }

  /**
   * Grass tufts, flowers and pebbles. Densities come from low-frequency noise
   * so the meadow has drifts and clearings instead of an even sprinkle — the
   * dead giveaway of scattered decoration is uniform density.
   */
  private scatterDecoration(rng: Rng): void {
    const seed = this.data.seed;
    for (let ty = 1; ty < this.map.h - 1; ty++) {
      for (let tx = 1; tx < this.map.w - 1; tx++) {
        const mat = this.map.matAt(tx, ty);
        if (mat === Mat.Water || mat === Mat.Stone || mat === Mat.Soil) continue;
        if (this.isKeptClear(tx, ty) || this.inExit(tx, ty)) continue;
        const meadow = noise2(tx * 0.09, ty * 0.11, seed + 17);
        const bloom = noise2(tx * 0.14, ty * 0.13, seed + 29);

        if (mat === Mat.Grass) {
          const tufts = Math.floor(meadow * 3.4);
          for (let i = 0; i < tufts; i++) {
            if (!chance(rng, 0.55)) continue;
            this.add(rng() > 0.5 ? 'tuftA' : 'tuftB', (tx + rng()) * TILE, (ty + rng()) * TILE, rng);
          }
          if (bloom > 0.7 && chance(rng, (bloom - 0.7) * 2.2)) {
            const kind = bloom > 0.86 ? 'flowerWhite' : rng() > 0.5 ? 'flowerRed' : 'flowerViolet';
            const n = 1 + Math.floor(rng() * 2);
            for (let i = 0; i < n; i++) {
              this.add(kind, (tx + rng()) * TILE, (ty + rng()) * TILE, rng);
            }
          }
        }
        if (chance(rng, mat === Mat.Path ? 0.06 : 0.025)) {
          this.add('pebble', (tx + rng()) * TILE, (ty + rng()) * TILE, rng);
        }
      }
    }
  }

  /** Is this tile inside an exit, optionally with a margin in tiles? */
  private inExit(tx: number, ty: number, pad = 0): boolean {
    for (const e of this.data.exits ?? []) {
      if (tx >= e.x - pad && tx < e.x + e.w + pad && ty >= e.y - pad && ty < e.y + e.h + pad) return true;
    }
    return false;
  }

  /** The exit the player is standing in, if any. */
  exitAt(x: number, y: number): AreaExit | null {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    for (const e of this.data.exits ?? []) {
      if (tx >= e.x && tx < e.x + e.w && ty >= e.y && ty < e.y + e.h) return e;
    }
    return null;
  }

  private isKeptClear(tx: number, ty: number): boolean {
    if (!this.data.keepClear) return false;
    for (const r of this.data.keepClear) {
      if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return true;
    }
    return false;
  }

  // --- collision ------------------------------------------------------------

  private buildColliders(): void {
    for (const p of this.props) this.addPropCollider(p);
    if (this.house && this.data.house) {
      const s = this.house.solid;
      const ox = this.housePos.x - this.house.sprite.ox;
      const oy = this.housePos.y - this.house.sprite.oy;
      this.pushCollider({ rect: { x: ox + s.x, y: oy + s.y, w: s.w, h: s.h } });
    }
    // The forest border is solid regardless of where individual trunks landed,
    // so there is no gap to squeeze through.
    const b = this.data.forestBorder;
    for (let ty = 0; ty < this.map.h; ty++) {
      for (let tx = 0; tx < this.map.w; tx++) {
        const edgeDist = Math.min(tx, ty, this.map.w - 1 - tx, this.map.h - 1 - ty);
        if (edgeDist < b) this.map.setSolid(tx, ty, true);
      }
    }
    // Exits are cut back out of the border afterwards, so the order of these
    // two loops is the difference between a gate and a wall.
    for (const e of this.data.exits ?? []) {
      for (let ty = e.y; ty < e.y + e.h; ty++) {
        for (let tx = e.x; tx < e.x + e.w; tx++) this.map.setSolid(tx, ty, false);
      }
    }
    for (const t of this.data.walkable ?? []) this.map.setSolid(t.tx, t.ty, false);
  }

  private addPropCollider(p: Prop): void {
    const c = p.def.collider;
    if (!c) return;
    this.pushCollider({ rect: { x: p.x + c.dx, y: p.y + c.dy, w: c.w, h: c.h }, prop: p });
  }

  private pushCollider(entry: Collider): void {
    this.colliders.push(entry);
    const r = entry.rect;
    const b = World.BUCKET;
    const x0 = Math.floor(r.x / b);
    const x1 = Math.floor((r.x + r.w) / b);
    const y0 = Math.floor(r.y / b);
    const y1 = Math.floor((r.y + r.h) / b);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const key = y * 4096 + x;
        let list = this.buckets.get(key);
        if (!list) {
          list = [];
          this.buckets.set(key, list);
        }
        list.push(entry);
      }
    }
  }

  /** The only question movement code asks the world. */
  blocked = (r: Rect): boolean => {
    // Tiles first: water and the world's edge.
    const x0 = Math.floor(r.x / TILE);
    const x1 = Math.floor((r.x + r.w - 0.001) / TILE);
    const y0 = Math.floor(r.y / TILE);
    const y1 = Math.floor((r.y + r.h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.map.isSolidTile(tx, ty)) return true;
      }
    }
    const b = World.BUCKET;
    const bx0 = Math.floor(r.x / b);
    const bx1 = Math.floor((r.x + r.w) / b);
    const by0 = Math.floor(r.y / b);
    const by1 = Math.floor((r.y + r.h) / b);
    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        const list = this.buckets.get(by * 4096 + bx);
        if (!list) continue;
        for (const c of list) {
          if (c.prop?.gone) continue;
          if (rectsOverlap(r, c.rect)) return true;
        }
      }
    }
    return false;
  };

  // --- per-frame ------------------------------------------------------------

  update(dt: number, time: number, weather: Weather, clock: TimeOfDay, particles: Particles, camX: number, camY: number, viewW: number, viewH: number): void {
    this.time = time;
    particles.windX = weather.driftX;

    for (const p of this.struck) {
      p.shake = Math.max(0, (p.shake ?? 0) - dt * 9);
    }
    if (this.struck.length) this.struck = this.struck.filter((p) => (p.shake ?? 0) > 0);

    // Chimney smoke, but only while somebody would have a fire lit.
    const cold = clock.hour < 8.5 || clock.hour > 17;
    this.smokeTimer -= dt;
    const puff = this.smokeTimer <= 0;
    if (puff) this.smokeTimer = 0.16;
    if (this.house && cold && puff) {
      const ox = this.housePos.x - this.house.sprite.ox + this.house.smoke.x;
      const oy = this.housePos.y - this.house.sprite.oy + this.house.smoke.y;
      particles.emit({ ...FX.chimneySmoke(ox, oy + 2), z: 0 });
    }
    // Cottages carry their own. One of Bell Row's four has no chimney entry at
    // all, so it never smokes at any hour, in any weather — which is the whole
    // story of that house told without a word.
    if (puff) {
      for (const p of this.smokers) {
        const sm = p.def.smoke!;
        if (!sm.allDay && !cold) continue;
        particles.emit({ ...FX.chimneySmoke(p.x + sm.dx, p.y + sm.dy), z: 0 });
      }
    }

    // Ambient life, spawned only inside the visible area plus a margin, so the
    // budget is spent on what the player can actually see.
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 0.09;
      const dark = clock.darkness;
      const rng = Math.random;
      const px = camX - 24 + rng() * (viewW + 48);
      const py = camY - 24 + rng() * (viewH + 48);
      const mat = this.map.matAtPixel(px, py);
      // Nothing small flies in the rain. The valley emptying out when the sky
      // closes over is most of what makes the weather feel like weather.
      if (weather.fair) {
        if (dark > 0.55) {
          // Fireflies gather over grass, and never over the path.
          if (mat === Mat.Grass && rng() < 0.5) particles.emit(FX.firefly(px, py));
        } else if (dark < 0.3) {
          if (mat !== Mat.Water && rng() < 0.45) particles.emit(FX.pollen(px, py));
        }
      }
      // Leaves come off the trees in proportion to the wind.
      // Wind strips more leaves in a squall than on a still afternoon.
      const gust = Math.abs(weather.wind) * (1 + weather.rain);
      if (gust > 0.35 && this.shedders.length && rng() < gust * 0.5) {
        const p = this.shedders[Math.floor(rng() * this.shedders.length)];
        if (p.x > camX - 40 && p.x < camX + viewW + 40 && p.y > camY - 80 && p.y < camY + viewH + 40) {
          const s = p.def.sheds!;
          particles.emit(FX.leafFall(p.x + randRange(rng, -s.spread, s.spread), p.y - 6, s.height));
        }
      }
    }
  }

  /**
   * Lights for this frame, gathered from props and the house.
   * @param gloom extra darkness from weather — people light lamps early when
   *              the sky closes over, and that is a nice thing to see happen.
   */
  collectLights(out: (l: Light) => void, clock: TimeOfDay, gloom = 0): void {
    const lamp = Math.min(1, clock.lampStrength + gloom);
    for (const p of this.props) {
      if (!p.def.lights) continue;
      for (const l of p.def.lights) {
        const intensity = l.nightOnly ? l.intensity * lamp : l.intensity;
        if (intensity <= 0.01) continue;
        out({
          x: p.x + l.dx,
          y: p.y + l.dy,
          radius: l.radius,
          color: l.color,
          intensity,
          flicker: p.phase,
          flickerAmount: l.flickerAmount,
        });
      }
    }
    if (this.house && lamp > 0.01) {
      const ox = this.housePos.x - this.house.sprite.ox;
      const oy = this.housePos.y - this.house.sprite.oy;
      for (const wdw of this.house.windows) {
        out({
          x: ox + wdw.x,
          y: oy + wdw.y,
          radius: 54,
          color: '#ffbe63',
          intensity: lamp * 0.95,
          flicker: wdw.x,
          flickerAmount: 0.05,
        });
      }
    }
  }

  // --- drawing --------------------------------------------------------------

  drawGround(ctx: CanvasRenderingContext2D, camX: number, camY: number, viewW: number, viewH: number, clock: TimeOfDay): void {
    ctx.drawImage(this.terrain.ground, -camX, -camY);
    const skyMix = 0.16 + clock.darkness * 0.28;
    this.water.draw(ctx, this.terrain.waterMask, this.terrain.foamMask, camX, camY, this.time, clock.skyCss(), skyMix);
    void viewW;
    void viewH;
  }

  /**
   * The depth-sorted pass. Props, the house, the player and particles are all
   * interleaved by their ground y, so the player walks in front of a tree's
   * trunk and behind its canopy without either being a special case.
   */
  drawSorted(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    viewW: number,
    viewH: number,
    extras: Drawable[],
    particles: Particles,
    clock: TimeOfDay,
    weather: Weather,
  ): void {
    const sun = clock.shadow(weather.overcast);
    const top = camY - 90;
    const bottom = camY + viewH + 40;
    const left = camX - 70;
    const right = camX + viewW + 70;

    // Shadows go down first, all of them, so no shadow ever lands on top of a
    // sprite that should be standing in front of it.
    for (const p of this.props) {
      if (p.gone) continue;
      if (p.y < top || p.y > bottom || p.x < left || p.x > right) continue;
      const foot = p.def.collider;
      if (!foot || p.def.sortBias === -400) continue;
      drawShadow(ctx, p.x - camX, p.y - camY, foot.w + 3, Math.max(3, foot.h), sun);
    }
    if (this.house) {
      const hx = this.housePos.x - camX;
      const hy = this.housePos.y - camY;
      drawShadow(ctx, hx, hy - 2, 88, 16, sun);
    }
    for (const e of extras) {
      const anyE = e as unknown as { shadowX?: number; shadowY?: number; shadowW?: number };
      if (anyE.shadowX !== undefined) {
        drawShadow(ctx, anyE.shadowX - camX, anyE.shadowY! - camY, anyE.shadowW ?? 10, 5, sun);
      }
    }

    // Build the frame's draw list: visible props, the house, and the extras.
    const list: { sortY: number; prop?: Prop; extra?: Drawable; house?: boolean }[] = [];
    for (const p of this.props) {
      if (p.gone) continue;
      if (p.y < top || p.y > bottom || p.x < left || p.x > right) continue;
      list.push({ sortY: p.y + (p.def.sortBias ?? 0), prop: p });
    }
    if (this.house) list.push({ sortY: this.housePos.y, house: true });
    for (const e of extras) list.push({ sortY: e.sortY, extra: e });
    list.sort((a, b) => a.sortY - b.sortY);

    // Particles are drawn in bands between depth slices rather than sorted
    // individually — same visual result, a fraction of the cost.
    const BANDS = 7;
    let band = 0;
    const bandAt = (i: number): number => top + ((bottom - top) * i) / BANDS;

    for (const item of list) {
      while (band < BANDS && bandAt(band + 1) <= item.sortY) {
        particles.draw(ctx, camX, camY, this.time, bandAt(band), bandAt(band + 1));
        band++;
      }
      if (item.prop) this.drawProp(ctx, item.prop, camX, camY, weather);
      else if (item.house && this.house) {
        ctx.drawImage(
          this.house.sprite.canvas,
          Math.round(this.housePos.x - camX - this.house.sprite.ox),
          Math.round(this.housePos.y - camY - this.house.sprite.oy),
        );
      } else if (item.extra) item.extra.draw(ctx, camX, camY, this);
    }
    while (band < BANDS) {
      particles.draw(ctx, camX, camY, this.time, bandAt(band), bandAt(band + 1));
      band++;
    }
    // Anything above or below the banded range (high smoke, mostly).
    particles.draw(ctx, camX, camY, this.time, -Infinity, top);
    particles.draw(ctx, camX, camY, this.time, bottom, Infinity);
  }

  private drawProp(ctx: CanvasRenderingContext2D, p: Prop, camX: number, camY: number, weather: Weather): void {
    const wind = weather.wind * p.swayScale;
    // A struck prop rings: a fast decaying oscillation, strongest at the top,
    // which is what makes an axe blow land on something rather than near it.
    const jolt = p.shake ? Math.sin(this.time * 46) * p.shake * (p.shakeDir ?? 1) : 0;
    for (const layer of p.def.layers) {
      const dx = Math.round(p.x - camX + layer.dx);
      const dy = Math.round(p.y - camY + layer.dy);
      if (layer.sway <= 0 && jolt === 0) {
        ctx.drawImage(layer.sprite.canvas, dx, dy);
        continue;
      }
      // A travelling phase term means a gust visibly crosses the valley rather
      // than every plant flexing at once.
      const travel = p.x * 0.012 + p.y * 0.006;
      const amp = layer.sway * wind;
      const bias = layer.swayBias ?? 1.6;
      drawSheared(ctx, layer.sprite, dx, dy, (t) => {
        const s = Math.sin(this.time * 1.5 + p.phase + travel) * 0.62 + Math.sin(this.time * 3.7 + p.phase * 1.9) * 0.38;
        return s * amp * Math.pow(t, bias) + jolt * Math.pow(t, 1.3);
      });
    }
  }

  /**
   * The nearest thing a tool could be used on, within reach of a point.
   * Guarded scenery and already-felled props are invisible to this.
   */
  harvestableAt(x: number, y: number, radius = 17): Prop | null {
    let best: Prop | null = null;
    let bestD = radius * radius;
    for (const p of this.props) {
      if (!p.def.harvest || p.guarded || p.gone) continue;
      const dx = p.x - x;
      const dy = p.y - 3 - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /**
   * Land a blow. Returns what came loose, and whether that was the last one.
   * The prop is mutated in place; the caller handles the effects.
   */
  strikeProp(prop: Prop, roll: () => number): { destroyed: boolean; drops: { item: string; count: number }[] } | null {
    const h = prop.def.harvest;
    if (!h || prop.gone || prop.guarded) return null;
    if (prop.hp === undefined) prop.hp = h.hp;
    prop.hp--;
    // Every blow knocks the thing sideways, away from the swing.
    prop.shake = 2.4;
    prop.shakeDir = roll() > 0.5 ? 1 : -1;
    if (!this.struck.includes(prop)) this.struck.push(prop);

    if (prop.hp > 0) {
      this.recordChange(prop, { hp: prop.hp });
      return { destroyed: false, drops: [] };
    }

    const drops = h.drops.map((d) => ({
      item: d.item,
      count: d.min + Math.floor(roll() * (d.max - d.min + 1)),
    }));
    // Clearing hp matters: what stands here now is a different prop with its
    // own durability. Carrying the felled tree's last hit point over would
    // leave the stump one blow from gone on every reload.
    if (h.becomes) {
      this.replaceProp(prop, h.becomes);
      this.recordChange(prop, { to: h.becomes, hp: undefined });
    } else {
      this.retireProp(prop);
      this.recordChange(prop, { to: null, hp: undefined });
    }
    return { destroyed: true, drops };
  }

  private static posKey(x: number, y: number): string {
    return `${x.toFixed(2)}:${y.toFixed(2)}`;
  }

  private recordChange(prop: Prop, patch: Partial<PropChange>): void {
    const key = World.posKey(prop.x, prop.y);
    const existing = this.changes.get(key) ?? { x: prop.x, y: prop.y };
    this.changes.set(key, { ...existing, ...patch });
  }

  /** Everything the player has changed about the props, for the save file. */
  serializeChanges(): PropChange[] {
    return [...this.changes.values()];
  }

  /**
   * Re-apply saved changes to a freshly generated world. Anything that no
   * longer matches — a prop the layout moved, a definition that was renamed —
   * is skipped rather than fatal.
   */
  restoreChanges(list: readonly PropChange[]): void {
    if (!Array.isArray(list)) return;
    let touched = false;
    for (const c of list) {
      if (typeof c.x !== 'number' || typeof c.y !== 'number') continue;
      const key = World.posKey(c.x, c.y);
      const prop = this.props.find((p) => !p.gone && World.posKey(p.x, p.y) === key);
      if (!prop) continue;
      this.changes.set(key, c);
      if (c.to !== undefined) {
        if (c.to === null) {
          this.retireProp(prop);
        } else if (this.defs[c.to]) {
          this.retireProp(prop);
          this.props.push({
            def: this.defs[c.to], x: prop.x, y: prop.y,
            phase: prop.phase, swayScale: prop.swayScale,
            hp: c.hp,
          });
          touched = true;
        }
      } else if (typeof c.hp === 'number') {
        prop.hp = c.hp;
      }
    }
    if (touched) {
      this.props.sort((a, b) => (a.y + (a.def.sortBias ?? 0)) - (b.y + (b.def.sortBias ?? 0)));
    }
    // Colliders and shedders are derived state; rebuild them from scratch
    // rather than trying to patch them in place.
    this.colliders.length = 0;
    this.buckets.clear();
    this.buildColliders();
    this.shedders = this.props.filter((p) => p.def.sheds && !p.gone);
  }

  /**
   * Rebuild the farmhouse at a new level. The solid footprint is the same at
   * every level by design, so the collider does not need touching — the house
   * changes what it looks like, not where it is.
   */
  setHouseLevel(level: number): void {
    if (!this.data.house) return;
    this.house = buildFarmhouse(level);
    this.houseLevel = level;
  }

  /** True the first time it is asked about a project, false afterwards. */
  claimProject(id: string): boolean {
    if (this.applied.has(id)) return false;
    this.applied.add(id);
    return true;
  }

  /** Put a new prop into the world, e.g. when a project finishes. */
  addProp(defId: string, x: number, y: number, inspect?: string): Prop | null {
    const def = this.defs[defId];
    if (!def) return null;
    const rng = makeRng(Math.round(x * 131 + y * 977));
    const prop: Prop = {
      def,
      x,
      y,
      phase: rng() * TAU,
      swayScale: randRange(rng, 0.72, 1.34),
      inspect: inspect ?? def.inspect,
    };
    this.props.push(prop);
    this.props.sort((a, b) => (a.y + (a.def.sortBias ?? 0)) - (b.y + (b.def.sortBias ?? 0)));
    this.addPropCollider(prop);
    if (def.sheds) this.shedders.push(prop);
    return prop;
  }

  /** Open a tile up — decking laid over water, mostly. */
  setWalkable(tx: number, ty: number): void {
    this.map.setSolid(tx, ty, false);
  }

  /** Swap a prop for another definition in place — a tree for its stump. */
  private replaceProp(prop: Prop, defId: string): void {
    const def = this.defs[defId];
    if (!def) throw new Error(`No prop definition "${defId}"`);
    this.retireProp(prop);
    const replacement: Prop = {
      def,
      x: prop.x,
      y: prop.y,
      phase: prop.phase,
      swayScale: prop.swayScale,
    };
    this.props.push(replacement);
    // Static props are sorted once at construction; felling one is rare enough
    // that re-sorting beats maintaining an insertion index.
    this.props.sort((a, b) => (a.y + (a.def.sortBias ?? 0)) - (b.y + (b.def.sortBias ?? 0)));
    this.addPropCollider(replacement);
    this.shedders = this.props.filter((p) => p.def.sheds && !p.gone);
  }

  /** Take a prop out of the world without disturbing the arrays. */
  private retireProp(prop: Prop): void {
    prop.gone = true;
    this.shedders = this.shedders.filter((p) => p !== prop);
  }

  /**
   * The nearest thing worth looking at, within reach of a point. Props are
   * measured from their base, and the search is a plain scan of the visible
   * set — there are never enough inspectable props for this to be worth
   * indexing, and pretending otherwise would be the wrong kind of clever.
   */
  inspectableAt(x: number, y: number, radius = 15): Prop | null {
    let best: Prop | null = null;
    let bestD = radius * radius;
    for (const p of this.props) {
      if (!p.inspect || p.gone) continue;
      const dx = p.x - x;
      const dy = (p.y - 4) - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /** Where the farmhouse door is in world pixels, or null if there is no house. */
  get doorPoint(): { x: number; y: number } | null {
    if (!this.house) return null;
    return {
      x: this.housePos.x - this.house.sprite.ox + this.house.door.x,
      y: this.housePos.y - this.house.sprite.oy + this.house.door.y,
    };
  }

  /** What the ground is made of at a point — used for footstep effects. */
  materialAt(x: number, y: number): Mat {
    return this.map.matAtPixel(x, y);
  }

  /** Is this world point open water? Used by the rain's ripple pass. */
  isWater = (x: number, y: number): boolean => this.map.matAtPixel(x, y) === Mat.Water;

  /**
   * How loud the water should be from here, 0..1, from the distance to the
   * nearest open water.
   *
   * This used to sample a coarse ring and weight the hits, which saturated
   * almost immediately — a single water tile anywhere in the inner ring
   * returned a fifth of full level, and the value barely changed as the player
   * walked. Distance to the nearest water tile is both cheaper to reason about
   * and what the ear actually responds to.
   *
   * The radii are in tiles. Three is close enough to be standing on the bank
   * or out on the dock; eleven is roughly a third of the screen's width at the
   * usual view size, which is about as far as running water carries before it
   * stops being something you are near and becomes something you can hear.
   * Between them the curve is a smoothstep, so there is no edge to cross and
   * no step to hear.
   */
  waterProximity(x: number, y: number): number {
    const px = x / TILE;
    const py = y / TILE;
    const cx = Math.floor(px);
    const cy = Math.floor(py);
    const R = WATER_OUTER;
    let best = Infinity;
    for (let dy = -R; dy <= R; dy++) {
      const ty = cy + dy;
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > R * R) continue;
        if (this.map.matAt(cx + dx, ty) !== Mat.Water) continue;
        const d = Math.hypot(cx + dx + 0.5 - px, ty + 0.5 - py);
        if (d < best) {
          best = d;
          // Nothing closer is possible once we are inside the flat part.
          if (best <= WATER_INNER) return 1;
        }
      }
    }
    if (best >= R) return 0;
    const t = 1 - (best - WATER_INNER) / (WATER_OUTER - WATER_INNER);
    return t * t * (3 - 2 * t);
  }

  get spawn(): { x: number; y: number } {
    return { x: this.data.spawn.tx * TILE, y: this.data.spawn.ty * TILE };
  }
}

/** Full water ambience at or inside this many tiles. */
const WATER_INNER = 3;
/** Silent at or beyond this many tiles. */
const WATER_OUTER = 11;

/** A blocking rectangle and, for props, the thing that put it there. */
interface Collider {
  rect: Rect;
  prop?: Prop;
}

export type { Sprite };
