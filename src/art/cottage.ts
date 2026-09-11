/**
 * BELL ROW'S COTTAGES
 *
 * A sibling of `building.ts`, not a generalisation of it. The farmhouse is the
 * hero building and it stays that way: rewriting its builder to serve both
 * would put stable, finished work at risk to save duplicating forty lines of
 * drawing idiom, and a cottage that matches the farmhouse in size steals the
 * one thing Phase 6 spent its whole length earning.
 *
 * So these are smaller — 72x64 against the farmhouse's 104x96 — and they
 * reuse the conventions rather than the code: an honest roof slope computed
 * row by row, the same shingle courses and moss noise, the same palette ramps,
 * and light from above and slightly to the left.
 *
 * Four of them, and the differences are all load-bearing:
 *
 *  - NAN's is kept. New-ish shingles, shutters hung straight, a flower box,
 *    and the only chimney that smokes all day.
 *  - ORRIN's has the open-sided shed built onto it. That shed is why he can
 *    work through the rain without the game having to explain itself.
 *  - RUE's is sound but plain. Nobody here has spare time for it.
 *  - The FOURTH is shuttered. Boards across the glass, moss in every course,
 *    a cold chimney. It is never lit, in any weather, at any hour.
 */

import { hash2, noise2 } from '../core/rng.ts';
import { PALETTE } from './palette.ts';
import { ctxOf, makeCanvas, type Sprite } from './pixel.ts';

export type CottageKind = 'nan' | 'orrin' | 'rue' | 'empty';

export interface Cottage {
  sprite: Sprite;
  /** Warm window light, relative to the sprite's top-left. Empty when shuttered. */
  windows: { x: number; y: number }[];
  /** Where chimney smoke is born, or null for a cold house. */
  smoke: { x: number; y: number } | null;
  /** Centre of the doorway, relative to the sprite's top-left. */
  door: { x: number; y: number };
  /** Solid footprint in pixels, relative to the sprite's top-left. */
  solid: { x: number; y: number; w: number; h: number };
}

const W = 76;
const H = 64;

const ROOF_TOP = 9;
const ROOF_BOTTOM = 32;
const WALL_TOP = 30;
const WALL_BOTTOM = 56;
const FOUNDATION_BOTTOM = 60;
const WALL_LEFT = 10;
const WALL_RIGHT = 57;

interface Recipe {
  /** 0 = mossy and neglected, 1 = kept. Drives roof value and weathering. */
  upkeep: number;
  chimney: 'left' | 'right';
  shutters: boolean;
  boarded: boolean;
  flowers: boolean;
  smokes: boolean;
  /** Painted door. The only saturated colour on any of these buildings. */
  doorTint: string | null;
  seed: number;
}

const RECIPES: Record<CottageKind, Recipe> = {
  nan:   { upkeep: 0.92, chimney: 'right', shutters: true,  boarded: false, flowers: true,  smokes: true,  doorTint: PALETTE.clothA1, seed: 41 },
  orrin: { upkeep: 0.66, chimney: 'left',  shutters: true,  boarded: false, flowers: false, smokes: true,  doorTint: null,           seed: 77 },
  rue:   { upkeep: 0.48, chimney: 'right', shutters: false, boarded: false, flowers: false, smokes: true,  doorTint: PALETTE.clothB1, seed: 13 },
  empty: { upkeep: 0.05, chimney: 'left',  shutters: true,  boarded: true,  flowers: false, smokes: false, doorTint: null,           seed: 99 },
};

export function buildCottage(kind: CottageKind): Cottage {
  const r = RECIPES[kind];
  const canvas = makeCanvas(W, H);
  const ctx = ctxOf(canvas);
  const px = (x: number, y: number, w: number, h: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  // --- footing: rubble stone, the part that outlives everything else --------
  for (let y = WALL_BOTTOM; y < FOUNDATION_BOTTOM; y++) {
    for (let x = WALL_LEFT - 2; x <= WALL_RIGHT + 2; x++) {
      const n = hash2(Math.floor(x / 4), Math.floor(y / 2), r.seed);
      px(x, y, 1, 1, n < 0.3 ? PALETTE.stone1 : n < 0.72 ? PALETTE.stone2 : PALETTE.stone3);
      if (y === WALL_BOTTOM || x % 4 === (y < WALL_BOTTOM + 2 ? 0 : 2)) px(x, y, 1, 1, PALETTE.stone4);
    }
  }
  px(WALL_LEFT - 2, FOUNDATION_BOTTOM, WALL_RIGHT - WALL_LEFT + 5, 1, PALETTE.inkCool);

  // --- limewashed wall. A neglected one has gone grey and green at the base --
  for (let y = WALL_TOP; y < WALL_BOTTOM; y++) {
    for (let x = WALL_LEFT; x <= WALL_RIGHT; x++) {
      const n = hash2(x, y, r.seed + 3);
      let c: string = n < 0.18 ? PALETTE.cream1 : PALETTE.cream0;
      // Damp climbs the wall from the footing up, and only on a tired house.
      const damp = (1 - r.upkeep) * Math.max(0, (y - WALL_TOP) / (WALL_BOTTOM - WALL_TOP) - 0.45);
      if (noise2(x * 0.13, y * 0.2, r.seed + 9) > 1 - damp * 1.5) c = PALETTE.fol5;
      else if (n > 0.93 && r.upkeep < 0.6) c = PALETTE.stone1;
      px(x, y, 1, 1, c);
    }
  }
  // corner posts and the rail under the eave
  for (const sx of [WALL_LEFT, WALL_RIGHT - 3]) {
    px(sx, WALL_TOP, 4, WALL_BOTTOM - WALL_TOP, PALETTE.wood2);
    px(sx, WALL_TOP, 1, WALL_BOTTOM - WALL_TOP, PALETTE.wood1);
    px(sx + 3, WALL_TOP, 1, WALL_BOTTOM - WALL_TOP, PALETTE.wood3);
  }
  px(WALL_LEFT, WALL_TOP, WALL_RIGHT - WALL_LEFT + 1, 2, PALETTE.wood2);
  px(WALL_LEFT, WALL_BOTTOM - 3, WALL_RIGHT - WALL_LEFT + 1, 3, PALETTE.wood2);
  px(WALL_LEFT, WALL_BOTTOM - 3, WALL_RIGHT - WALL_LEFT + 1, 1, PALETTE.wood1);

  // --- one window, off-centre, and the door beside it -----------------------
  const windows: { x: number; y: number }[] = [];
  const winX = 16;
  const winY = 36;
  const winW = 14;
  const winH = 13;
  drawPane(ctx, winX, winY, winW, winH, r.boarded);
  if (r.shutters) drawShutter(ctx, winX, winY, winW, winH, r.upkeep);
  if (r.flowers) drawBox(ctx, winX - 2, winY + winH + 4, winW + 4, r.seed);
  if (!r.boarded) windows.push({ x: winX + winW / 2, y: winY + winH / 2 });

  const doorX = 38;
  const doorW = 14;
  const doorTop = 38;
  drawDoor(ctx, doorX, doorTop, doorW, WALL_BOTTOM - doorTop, r.doorTint, r.boarded);

  // --- roof ------------------------------------------------------------------
  const ridgeHalf = 15;
  const eaveHalf = 35;
  const cx = W / 2 - 4;
  for (let y = ROOF_TOP; y <= ROOF_BOTTOM; y++) {
    const t = (y - ROOF_TOP) / (ROOF_BOTTOM - ROOF_TOP);
    const half = Math.round(ridgeHalf + (eaveHalf - ridgeHalf) * t);
    const x0 = Math.round(cx - half);
    const x1 = Math.round(cx + half);
    const course = Math.floor((y - ROOF_TOP) / 4);
    for (let x = x0; x <= x1; x++) {
      const stagger = course % 2 === 0 ? 0 : 3;
      const seam = (x + stagger) % 6 === 0;
      const rowTop = (y - ROOF_TOP) % 4 === 0;
      const n = hash2(Math.floor((x + stagger) / 6), course, r.seed + 11);
      const sideT = (x - x0) / Math.max(1, x1 - x0);
      // Same rake of light as the farmhouse, and a kept roof sits a step up.
      const lit = (1 - sideT) + r.upkeep * 0.24;
      let color: string;
      if (lit > 0.72) color = n > 0.7 ? PALETTE.wood0 : PALETTE.wood1;
      else if (lit > 0.4) color = n > 0.78 ? PALETTE.wood1 : PALETTE.wood2;
      else color = n > 0.8 ? PALETTE.wood2 : PALETTE.wood3;
      const patch = noise2(x * 0.1, y * 0.17, r.seed + 23);
      const mossiness = (Math.max(0, t - 0.2) * 0.7 + (sideT > 0.6 ? 0.06 : 0)) * (1 - r.upkeep) * 1.35;
      if (patch > 1 - mossiness) color = patch > 1 - mossiness * 0.35 ? PALETTE.fol6 : PALETTE.fol5;
      px(x, y, 1, 1, color);
      if (rowTop) px(x, y, 1, 1, lit > 0.5 ? PALETTE.wood2 : PALETTE.wood3);
      if (seam && !rowTop) px(x, y, 1, 1, lit > 0.5 ? PALETTE.wood2 : PALETTE.wood3);
    }
    if (y === ROOF_BOTTOM) px(x0, y + 1, x1 - x0 + 1, 2, PALETTE.wood3);
    px(x0 - 1, y, 1, 1, PALETTE.ink);
    px(x1 + 1, y, 1, 1, PALETTE.ink);
  }
  px(cx - ridgeHalf - 1, ROOF_TOP - 2, ridgeHalf * 2 + 3, 3, PALETTE.wood3);
  px(cx - ridgeHalf - 1, ROOF_TOP - 2, ridgeHalf * 2 + 3, 1, PALETTE.wood1);
  px(cx - ridgeHalf - 2, ROOF_TOP - 3, ridgeHalf * 2 + 5, 1, PALETTE.ink);

  // --- chimney, on whichever gable this house put it ------------------------
  const chW = 9;
  const chx = r.chimney === 'left' ? cx - ridgeHalf - 2 : cx + ridgeHalf - chW + 2;
  for (let y = 2; y < 22; y++) {
    for (let x = chx; x < chx + chW; x++) {
      const n = hash2(Math.floor(x / 3), Math.floor(y / 3), r.seed + 5);
      px(x, y, 1, 1, n < 0.3 ? PALETTE.stone2 : n < 0.7 ? PALETTE.stone3 : PALETTE.stone1);
      if (y % 3 === 0) px(x, y, 1, 1, PALETTE.stone4);
      // A cold chimney grows things. It is the quietest way to say nobody is in.
      if (!r.smokes && noise2(x * 0.3, y * 0.3, r.seed + 31) > 0.74) px(x, y, 1, 1, PALETTE.fol5);
    }
  }
  px(chx - 1, 2, chW + 2, 3, PALETTE.stone1);
  px(chx - 1, 4, chW + 2, 1, PALETTE.stone3);
  px(chx, 3, chW, 2, PALETTE.stone4);
  ctx.fillStyle = PALETTE.inkCool;
  ctx.fillRect(chx - 2, 2, 1, 20);
  ctx.fillRect(chx + chW + 1, 2, 1, 20);

  outline(ctx);

  return {
    sprite: { canvas, w: W, h: H, ox: Math.floor(W / 2), oy: FOUNDATION_BOTTOM + 1 },
    windows,
    smoke: r.smokes ? { x: chx + chW / 2, y: 2 } : null,
    door: { x: doorX + doorW / 2, y: WALL_BOTTOM + 3 },
    solid: { x: WALL_LEFT - 2, y: WALL_TOP + 4, w: WALL_RIGHT - WALL_LEFT + 5, h: FOUNDATION_BOTTOM - WALL_TOP - 4 },
  };
}

/**
 * ORRIN'S SHED
 *
 * Separate from his cottage so it can sit beside it at its own depth, and so
 * the bench he works at is a thing in the world rather than a detail painted
 * on a wall. Open on three sides with a lean-to roof: that roof is the entire
 * reason he can keep working through a downpour, and it has to be visible for
 * the behaviour to read as sense rather than as a bug.
 */
export function buildShed(): { sprite: Sprite; bench: { x: number; y: number }; solid: { x: number; y: number; w: number; h: number } } {
  const w = 46;
  const h = 44;
  const canvas = makeCanvas(w, h);
  const ctx = ctxOf(canvas);
  const px = (x: number, y: number, ww: number, hh: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x, y, ww, hh); };

  // four posts, the back pair shorter so the roof sheds to the front
  for (const [pxx, top] of [[3, 12], [38, 12], [7, 6], [34, 6]] as const) {
    px(pxx, top, 3, 34 - top + 6, PALETTE.wood2);
    px(pxx, top, 1, 34 - top + 6, PALETTE.wood1);
    px(pxx + 2, top, 1, 34 - top + 6, PALETTE.wood3);
  }
  // lean-to roof: boards running front to back, high at the back
  for (let y = 4; y < 16; y++) {
    const t = (y - 4) / 12;
    const x0 = Math.round(2 + t * 2);
    const x1 = Math.round(w - 3 - t * 2);
    for (let x = x0; x <= x1; x++) {
      const n = hash2(x, Math.floor(y / 2), 57);
      const lit = 1 - (x - x0) / Math.max(1, x1 - x0);
      let c: string = lit > 0.6 ? (n > 0.6 ? PALETTE.wood0 : PALETTE.wood1) : n > 0.7 ? PALETTE.wood1 : PALETTE.wood2;
      if (y % 3 === 0) c = PALETTE.wood3;
      px(x, y, 1, 1, c);
    }
    px(x0 - 1, y, 1, 1, PALETTE.ink);
    px(x1 + 1, y, 1, 1, PALETTE.ink);
  }
  // the bench itself
  const by = 30;
  px(8, by, 30, 4, PALETTE.wood1);
  px(8, by, 30, 1, PALETTE.wood0);
  px(8, by + 3, 30, 1, PALETTE.wood3);
  px(10, by + 4, 3, 8, PALETTE.wood2);
  px(33, by + 4, 3, 8, PALETTE.wood2);
  // work laid out on it: a plank, and a tool that catches the light
  px(13, by - 2, 14, 2, PALETTE.wood0);
  px(13, by - 2, 14, 1, PALETTE.cream1);
  px(29, by - 3, 5, 1, PALETTE.metal0);
  px(30, by - 2, 2, 2, PALETTE.metal1);
  // shavings underfoot
  for (let i = 0; i < 26; i++) {
    const n = hash2(i, 3, 71);
    px(6 + Math.floor(n * 34), 38 + Math.floor(hash2(i, 5, 72) * 4), 2, 1, n > 0.5 ? PALETTE.wood0 : PALETTE.cream1);
  }
  outlineRect(ctx, w, h);
  return {
    sprite: { canvas, w, h, ox: Math.floor(w / 2), oy: h - 1 },
    bench: { x: 22, y: by },
    solid: { x: 4, y: 26, w: 38, h: 14 },
  };
}

// --- pieces -----------------------------------------------------------------

function drawPane(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, boarded: boolean): void {
  ctx.fillStyle = PALETTE.wood3;
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  for (let py = 0; py < h; py++) {
    ctx.fillStyle = py / h < 0.45 ? PALETTE.glass0 : PALETTE.glass1;
    ctx.fillRect(x, y + py, w, 1);
  }
  ctx.fillStyle = PALETTE.cream0;
  for (let i = 0; i < 5; i++) ctx.fillRect(x + 2 + i, y + 7 - i, 2, 1);
  ctx.fillStyle = PALETTE.wood2;
  ctx.fillRect(x + w / 2 - 1, y, 2, h);
  ctx.fillRect(x, y + h / 2 - 1, w, 2);
  ctx.fillStyle = PALETTE.wood1;
  ctx.fillRect(x - 3, y + h, w + 6, 2);
  ctx.fillStyle = PALETTE.wood3;
  ctx.fillRect(x - 3, y + h + 2, w + 6, 1);
  if (boarded) {
    // Two boards, nailed on at an angle by somebody who was not coming back.
    for (const [oy, slope] of [[3, 0.28], [9, -0.2]] as const) {
      for (let i = -3; i < w + 3; i++) {
        const yy = y + oy + Math.round(i * slope);
        ctx.fillStyle = i % 7 === 0 ? PALETTE.wood3 : PALETTE.wood1;
        ctx.fillRect(x + i, yy, 1, 4);
        ctx.fillStyle = PALETTE.wood3;
        ctx.fillRect(x + i, yy + 3, 1, 1);
      }
    }
  }
}

function drawShutter(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, upkeep: number): void {
  for (const [sx, lean] of [[x - 7, 0], [x + w + 1, upkeep > 0.5 ? 0 : 1]] as const) {
    ctx.fillStyle = PALETTE.wood2;
    ctx.fillRect(sx, y - 1 + lean, 6, h + 2);
    ctx.fillStyle = PALETTE.wood1;
    ctx.fillRect(sx, y - 1 + lean, 1, h + 2);
    ctx.fillStyle = PALETTE.wood3;
    ctx.fillRect(sx + 5, y - 1 + lean, 1, h + 2);
    for (let i = 2; i < h; i += 4) {
      ctx.fillStyle = PALETTE.wood3;
      ctx.fillRect(sx + 1, y - 1 + lean + i, 4, 1);
    }
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(sx - 1, y - 1 + lean, 1, h + 2);
    ctx.fillRect(sx + 6, y - 1 + lean, 1, h + 2);
  }
}

function drawBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, seed: number): void {
  ctx.fillStyle = PALETTE.wood2;
  ctx.fillRect(x, y, w, 6);
  ctx.fillStyle = PALETTE.wood1;
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(x - 1, y, 1, 6);
  ctx.fillRect(x + w, y, 1, 6);
  ctx.fillRect(x, y + 6, w, 1);
  const blooms = [PALETTE.red, PALETTE.gold, PALETTE.pink, PALETTE.violet, PALETTE.white];
  for (let i = 0; i < w; i++) {
    const n = hash2(x + i, y, seed + 61);
    ctx.fillStyle = n > 0.5 ? PALETTE.fol3 : PALETTE.fol4;
    ctx.fillRect(x + i, y - 1, 1, 1);
    if (n > 0.79) {
      ctx.fillStyle = blooms[Math.floor(hash2(x + i, y, seed + 62) * blooms.length) % blooms.length];
      ctx.fillRect(x + i, y - 2, 1, 1);
    }
  }
}

function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tint: string | null, dead: boolean): void {
  ctx.fillStyle = PALETTE.wood3;
  ctx.fillRect(x - 2, y - 2, w + 4, h + 2);
  for (let i = 0; i < w; i++) {
    const seam = i % 4 === 0;
    ctx.fillStyle = tint && !seam ? (i % 4 === 1 ? PALETTE.cream1 : tint) : seam ? PALETTE.wood3 : PALETTE.wood2;
    ctx.fillRect(x + i, y, 1, h);
  }
  ctx.fillStyle = PALETTE.metal1;
  ctx.fillRect(x, y + 3, w, 2);
  ctx.fillRect(x, y + h - 6, w, 2);
  ctx.fillStyle = PALETTE.metal0;
  ctx.fillRect(x, y + 3, w, 1);
  if (!dead) {
    ctx.fillStyle = PALETTE.metal0;
    ctx.fillRect(x + w - 4, y + Math.floor(h / 2), 2, 3);
  }
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(x - 2, y - 2, w + 4, 1);
}

function outline(ctx: CanvasRenderingContext2D): void { outlineRect(ctx, W, H); }

function outlineRect(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const src = img.data;
  const out = ctx.createImageData(w, h);
  out.data.set(src);
  const ink = [0x2b, 0x20, 0x29];
  const solid = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] > 0) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        out.data[i] = ink[0]; out.data[i + 1] = ink[1]; out.data[i + 2] = ink[2]; out.data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(out, 0, 0);
}
