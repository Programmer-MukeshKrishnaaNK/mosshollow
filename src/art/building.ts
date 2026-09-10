/**
 * THE FARMHOUSE
 *
 * Built by code rather than authored as one big pixel map, for two reasons:
 * the roof slope needs to stay geometrically honest row by row, and the house
 * is meant to visibly change as the player repairs it. A builder takes a level
 * and returns a sprite plus the anchor points the world needs — where the
 * windows glow, where the chimney smokes, where the door is.
 */

import { hash2, noise2 } from '../core/rng.ts';
import { PALETTE } from './palette.ts';
import { ctxOf, makeCanvas, type Sprite } from './pixel.ts';

export interface Building {
  sprite: Sprite;
  /** Warm light sources, relative to the sprite's top-left. */
  windows: { x: number; y: number }[];
  /** Where chimney smoke is born. */
  smoke: { x: number; y: number };
  /** Centre of the doorway, relative to the sprite's top-left. */
  door: { x: number; y: number };
  /** Solid footprint in pixels, relative to the sprite's top-left. */
  solid: { x: number; y: number; w: number; h: number };
}

const W = 104;
const H = 96;

const ROOF_TOP = 15;
const ROOF_BOTTOM = 46;
const WALL_TOP = 44;
const WALL_BOTTOM = 84;
const FOUNDATION_BOTTOM = 90;
const WALL_LEFT = 12;
const WALL_RIGHT = 91;

/**
 * Three houses, not one house with a flag on it.
 *
 * Level 1 is the place as you found it: moss in the courses, bare windows,
 * two empty post holes by the door.
 * Level 2 is a sound roof — new shingles, the moss gone, shutters hung.
 * Level 3 is somebody living here — porch posts and a rail, a box of flowers
 * under each window, and a vane on the ridge.
 *
 * Each step has to be readable from across the yard, which is why they change
 * the silhouette and the overall value of the roof rather than adding detail.
 */
export function buildFarmhouse(level = 1): Building {
  const canvas = makeCanvas(W, H);
  const ctx = ctxOf(canvas);

  const px = (x: number, y: number, w: number, h: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  // --- stone foundation: the oldest part of the house, and it shows --------
  for (let y = WALL_BOTTOM; y < FOUNDATION_BOTTOM; y++) {
    for (let x = WALL_LEFT - 2; x <= WALL_RIGHT + 2; x++) {
      const n = hash2(Math.floor(x / 5), Math.floor(y / 3), 7);
      const shade = n < 0.28 ? PALETTE.stone1 : n < 0.72 ? PALETTE.stone2 : PALETTE.stone3;
      px(x, y, 1, 1, shade);
      // mortar lines between courses
      if (y === WALL_BOTTOM || (x % 5 === (y < WALL_BOTTOM + 3 ? 0 : 2))) px(x, y, 1, 1, PALETTE.stone4);
    }
  }
  px(WALL_LEFT - 2, FOUNDATION_BOTTOM, WALL_RIGHT - WALL_LEFT + 5, 1, PALETTE.inkCool);

  // --- plastered wall with exposed timber framing --------------------------
  for (let y = WALL_TOP; y < WALL_BOTTOM; y++) {
    for (let x = WALL_LEFT; x <= WALL_RIGHT; x++) {
      const n = hash2(x, y, 3);
      px(x, y, 1, 1, n < 0.16 ? PALETTE.cream1 : PALETTE.cream0);
    }
  }
  // vertical studs
  for (const sx of [WALL_LEFT, 30, 50, 70, WALL_RIGHT - 3]) {
    px(sx, WALL_TOP, 4, WALL_BOTTOM - WALL_TOP, PALETTE.wood2);
    px(sx, WALL_TOP, 1, WALL_BOTTOM - WALL_TOP, PALETTE.wood1);
    px(sx + 3, WALL_TOP, 1, WALL_BOTTOM - WALL_TOP, PALETTE.wood3);
  }
  // horizontal sill and head rails
  px(WALL_LEFT, WALL_TOP, WALL_RIGHT - WALL_LEFT + 1, 3, PALETTE.wood2);
  px(WALL_LEFT, WALL_BOTTOM - 4, WALL_RIGHT - WALL_LEFT + 1, 4, PALETTE.wood2);
  px(WALL_LEFT, WALL_BOTTOM - 4, WALL_RIGHT - WALL_LEFT + 1, 1, PALETTE.wood1);

  // --- windows --------------------------------------------------------------
  const windows: { x: number; y: number }[] = [];
  for (const wx of [18, 74]) {
    drawWindow(ctx, wx, 52, 18, 18);
    if (level >= 2) drawShutters(ctx, wx, 52, 18, 18);
    if (level >= 3) drawFlowerBox(ctx, wx - 3, 74, 24);
    windows.push({ x: wx + 9, y: 61 });
  }

  // --- door -----------------------------------------------------------------
  const doorX = 44;
  const doorW = 18;
  const doorTop = 54;
  drawDoor(ctx, doorX, doorTop, doorW, WALL_BOTTOM - doorTop);

  // --- roof: shingles, laid in courses, mossy on the shaded side -----------
  const ridgeHalf = 24;
  const eaveHalf = 46;
  for (let y = ROOF_TOP; y <= ROOF_BOTTOM; y++) {
    const t = (y - ROOF_TOP) / (ROOF_BOTTOM - ROOF_TOP);
    const half = Math.round(ridgeHalf + (eaveHalf - ridgeHalf) * t);
    const cx = W / 2;
    const x0 = Math.round(cx - half);
    const x1 = Math.round(cx + half);
    const course = Math.floor((y - ROOF_TOP) / 5);
    for (let x = x0; x <= x1; x++) {
      // Stagger every other course so the shingles interlock.
      const stagger = course % 2 === 0 ? 0 : 3;
      const seam = (x + stagger) % 6 === 0;
      const rowTop = (y - ROOF_TOP) % 5 === 0;
      // Shingles vary, but only by a little. Wide per-shingle contrast turns a
      // roof into a patchwork quilt, which is exactly what it did on the first
      // pass — most of the read should come from the courses, not the colour.
      const n = hash2(Math.floor((x + stagger) / 6), course, 11);
      const sideT = (x - x0) / Math.max(1, x1 - x0);
      // Light rakes across from the left, so the far slope sits a step darker.
      // A re-shingled roof is lifted a whole step: the point of the upgrade is
      // that the house reads as brighter from the far side of the yard.
      const lit = (1 - sideT) + (level >= 2 ? 0.2 : 0);
      let color: string;
      if (lit > 0.72) color = n > 0.7 ? PALETTE.wood0 : PALETTE.wood1;
      else if (lit > 0.4) color = n > 0.78 ? PALETTE.wood1 : PALETTE.wood2;
      else color = n > 0.8 ? PALETTE.wood2 : PALETTE.wood3;
      // Moss takes the lower courses and the shaded edge first, and it grows
      // in patches: low-frequency noise, not a per-shingle coin flip.
      const patch = noise2(x * 0.09, y * 0.16, 23);
      // Only the damp lower courses, only a little, and in the two darkest
      // greens — bright moss on a roof reads as paint, not as weather.
      // New shingles have not had time to grow anything.
      const weathering = level >= 3 ? 0.06 : level >= 2 ? 0.14 : 1;
      const mossiness = (Math.max(0, t - 0.28) * 0.62 + (sideT > 0.62 ? 0.05 : 0)) * weathering;
      if (patch > 1 - mossiness) {
        color = patch > 1 - mossiness * 0.35 ? PALETTE.fol6 : PALETTE.fol5;
      }
      px(x, y, 1, 1, color);
      // The courses carry the pattern: a dark shadow line under each overlap
      // and a short vertical seam between shingles.
      if (rowTop) px(x, y, 1, 1, lit > 0.5 ? PALETTE.wood2 : PALETTE.wood3);
      if (seam && !rowTop) px(x, y, 1, 1, lit > 0.5 ? PALETTE.wood2 : PALETTE.wood3);
    }
    // eave shadow cast onto the wall
    if (y === ROOF_BOTTOM) px(x0, y + 1, x1 - x0 + 1, 2, PALETTE.wood3);
    px(x0 - 1, y, 1, 1, PALETTE.ink);
    px(x1 + 1, y, 1, 1, PALETTE.ink);
  }
  // ridge cap
  px(W / 2 - ridgeHalf - 1, ROOF_TOP - 2, ridgeHalf * 2 + 3, 3, PALETTE.wood3);
  px(W / 2 - ridgeHalf - 1, ROOF_TOP - 2, ridgeHalf * 2 + 3, 1, PALETTE.wood1);
  px(W / 2 - ridgeHalf - 2, ROOF_TOP - 3, ridgeHalf * 2 + 5, 1, PALETTE.ink);

  // --- chimney ---------------------------------------------------------------
  const chx = 33;
  for (let y = 6; y < 30; y++) {
    for (let x = chx; x < chx + 13; x++) {
      const n = hash2(Math.floor(x / 4), Math.floor(y / 3), 5);
      px(x, y, 1, 1, n < 0.3 ? PALETTE.stone2 : n < 0.7 ? PALETTE.stone3 : PALETTE.stone1);
      if (y % 3 === 0 || x % 4 === (Math.floor(y / 3) % 2 === 0 ? chx % 4 : (chx + 2) % 4)) {
        px(x, y, 1, 1, PALETTE.stone4);
      }
    }
  }
  px(chx - 1, 6, 15, 4, PALETTE.stone1);
  px(chx - 1, 9, 15, 1, PALETTE.stone3);
  px(chx, 7, 13, 2, PALETTE.stone4); // the flue, dark inside
  outlineColumn(ctx, chx - 1, 6, 15, 24);

  // --- porch: a plank step and two posts, added when the house is repaired ---
  if (level >= 1) {
    px(doorX - 3, WALL_BOTTOM - 1, doorW + 6, 5, PALETTE.wood1);
    px(doorX - 3, WALL_BOTTOM - 1, doorW + 6, 1, PALETTE.wood0);
    px(doorX - 3, WALL_BOTTOM + 3, doorW + 6, 1, PALETTE.wood3);
    px(doorX - 4, WALL_BOTTOM - 1, 1, 6, PALETTE.ink);
    px(doorX + doorW + 3, WALL_BOTTOM - 1, 1, 6, PALETTE.ink);
    px(doorX - 3, WALL_BOTTOM + 4, doorW + 6, 1, PALETTE.ink);
  }

  // --- the porch, and the vane that says somebody is watching the weather ---
  if (level >= 3) {
    drawPorch(ctx, doorX - 4, doorW + 8, WALL_BOTTOM);
    drawVane(ctx, W / 2 + ridgeHalf - 6, ROOF_TOP - 3);
  }

  outlineSprite(ctx);

  return {
    sprite: { canvas, w: W, h: H, ox: Math.floor(W / 2), oy: FOUNDATION_BOTTOM + 1 },
    windows,
    smoke: { x: chx + 6, y: 6 },
    door: { x: doorX + doorW / 2, y: WALL_BOTTOM + 4 },
    solid: { x: WALL_LEFT - 2, y: WALL_TOP + 6, w: WALL_RIGHT - WALL_LEFT + 5, h: FOUNDATION_BOTTOM - WALL_TOP - 6 },
  };
}

/** Board shutters, pinned back either side of the glass. */
function drawShutters(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  for (const sx of [x - 8, x + w + 2]) {
    ctx.fillStyle = PALETTE.wood2;
    ctx.fillRect(sx, y - 1, 6, h + 2);
    ctx.fillStyle = PALETTE.wood1;
    ctx.fillRect(sx, y - 1, 1, h + 2);
    ctx.fillStyle = PALETTE.wood3;
    ctx.fillRect(sx + 5, y - 1, 1, h + 2);
    // slats
    for (let i = 2; i < h; i += 4) {
      ctx.fillStyle = PALETTE.wood3;
      ctx.fillRect(sx + 1, y - 1 + i, 4, 1);
    }
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(sx - 1, y - 1, 1, h + 2);
    ctx.fillRect(sx + 6, y - 1, 1, h + 2);
  }
}

/** A box under the sill, planted. The one bit of pure colour on the house. */
function drawFlowerBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.fillStyle = PALETTE.wood2;
  ctx.fillRect(x, y, w, 7);
  ctx.fillStyle = PALETTE.wood1;
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = PALETTE.wood3;
  ctx.fillRect(x, y + 6, w, 1);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(x - 1, y, 1, 7);
  ctx.fillRect(x + w, y, 1, 7);
  // Planting: leaves along the top, with blossoms picked from the accents so
  // it stays inside the same palette as the meadow it is looking at.
  const blooms = [PALETTE.red, PALETTE.gold, PALETTE.pink, PALETTE.violet, PALETTE.white];
  for (let i = 0; i < w; i++) {
    const n = hash2(x + i, y, 61);
    ctx.fillStyle = n > 0.5 ? PALETTE.fol3 : PALETTE.fol4;
    ctx.fillRect(x + i, y - 1, 1, 1);
    if (n > 0.82) {
      ctx.fillStyle = blooms[Math.floor(hash2(x + i, y, 62) * blooms.length) % blooms.length];
      ctx.fillRect(x + i, y - 2, 1, 1);
    }
  }
}

/** Two posts, a beam and a rail. The step was always there waiting for it. */
function drawPorch(ctx: CanvasRenderingContext2D, x: number, w: number, baseY: number): void {
  const top = baseY - 22;
  for (const px of [x, x + w - 3]) {
    ctx.fillStyle = PALETTE.wood2;
    ctx.fillRect(px, top, 3, 24);
    ctx.fillStyle = PALETTE.wood1;
    ctx.fillRect(px, top, 1, 24);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(px - 1, top, 1, 24);
    ctx.fillRect(px + 3, top, 1, 24);
  }
  // beam across the top
  ctx.fillStyle = PALETTE.wood2;
  ctx.fillRect(x - 2, top, w + 4, 4);
  ctx.fillStyle = PALETTE.wood1;
  ctx.fillRect(x - 2, top, w + 4, 1);
  ctx.fillStyle = PALETTE.wood3;
  ctx.fillRect(x - 2, top + 3, w + 4, 1);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(x - 3, top - 1, w + 6, 1);
  // low rail either side of the doorway, leaving the middle open to walk through
  const railY = baseY - 9;
  for (const seg of [[x + 3, 9], [x + w - 12, 9]]) {
    ctx.fillStyle = PALETTE.wood1;
    ctx.fillRect(seg[0], railY, seg[1], 2);
    ctx.fillStyle = PALETTE.wood3;
    ctx.fillRect(seg[0], railY + 2, seg[1], 1);
  }
}

/** A vane on the ridge. Small, and the first thing you notice has changed. */
function drawVane(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = PALETTE.metal1;
  ctx.fillRect(x, y - 12, 1, 12);
  ctx.fillStyle = PALETTE.metal0;
  // an arrow, pointing the way the wind was going when it stopped
  ctx.fillRect(x - 4, y - 11, 9, 1);
  ctx.fillRect(x + 3, y - 12, 1, 3);
  ctx.fillRect(x + 4, y - 11, 1, 1);
  ctx.fillRect(x - 4, y - 12, 1, 3);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(x, y - 14, 1, 2);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(x - 1, y - 10, 1, 1);
  ctx.fillRect(x + 1, y - 10, 1, 1);
}

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = PALETTE.wood3;
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = PALETTE.wood1;
  ctx.fillRect(x - 2, y - 2, w + 4, 1);
  ctx.fillStyle = PALETTE.glass1;
  ctx.fillRect(x, y, w, h);
  // Panes: lighter at the top where they catch sky, darker toward the sill.
  for (let py = 0; py < h; py++) {
    const t = py / h;
    ctx.fillStyle = t < 0.45 ? PALETTE.glass0 : PALETTE.glass1;
    ctx.fillRect(x, y + py, w, 1);
  }
  // a diagonal glint, the tell that a flat rectangle is actually glass
  ctx.fillStyle = PALETTE.cream0;
  for (let i = 0; i < 6; i++) ctx.fillRect(x + 2 + i, y + 8 - i, 2, 1);
  ctx.fillStyle = PALETTE.wood2;
  ctx.fillRect(x + w / 2 - 1, y, 2, h);
  ctx.fillRect(x, y + h / 2 - 1, w, 2);
  ctx.fillStyle = PALETTE.wood1;
  ctx.fillRect(x - 3, y + h, w + 6, 3); // sill
  ctx.fillStyle = PALETTE.wood3;
  ctx.fillRect(x - 3, y + h + 3, w + 6, 1);
}

function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = PALETTE.wood3;
  ctx.fillRect(x - 2, y - 2, w + 4, h + 2);
  for (let px2 = 0; px2 < w; px2++) {
    const seam = px2 % 5 === 0;
    ctx.fillStyle = seam ? PALETTE.wood3 : px2 % 5 === 1 ? PALETTE.wood1 : PALETTE.wood2;
    ctx.fillRect(x + px2, y, 1, h);
  }
  // iron bands
  ctx.fillStyle = PALETTE.metal1;
  ctx.fillRect(x, y + 4, w, 2);
  ctx.fillRect(x, y + h - 8, w, 2);
  ctx.fillStyle = PALETTE.metal0;
  ctx.fillRect(x, y + 4, w, 1);
  ctx.fillRect(x, y + h - 8, w, 1);
  // handle
  ctx.fillStyle = PALETTE.metal0;
  ctx.fillRect(x + w - 5, y + h / 2, 2, 3);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(x - 2, y - 2, w + 4, 1);
}

/** Ink the left and right edges of a rectangular column of pixels. */
function outlineColumn(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = PALETTE.inkCool;
  ctx.fillRect(x - 1, y, 1, h);
  ctx.fillRect(x + w, y, 1, h);
}

/** Wrap the whole finished silhouette in a single-pixel contour. */
function outlineSprite(ctx: CanvasRenderingContext2D): void {
  const img = ctx.getImageData(0, 0, W, H);
  const src = img.data;
  const out = ctx.createImageData(W, H);
  out.data.set(src);
  const ink = [0x2b, 0x20, 0x29];
  const solid = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < W && y < H && src[(y * W + x) * 4 + 3] > 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (src[i + 3] > 0) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        out.data[i] = ink[0];
        out.data[i + 1] = ink[1];
        out.data[i + 2] = ink[2];
        out.data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(out, 0, 0);
}
