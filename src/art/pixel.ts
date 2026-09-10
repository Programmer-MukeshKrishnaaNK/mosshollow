/**
 * The pixel-art toolkit.
 *
 * Sprites are authored as arrays of strings — one character per pixel, drawn
 * from the shared palette. That keeps the art hand-placed and reviewable in a
 * diff, and makes it impossible to accidentally introduce an off-palette
 * colour. This module turns those strings into canvases the renderer can blit.
 */

import { charToColor } from './palette.ts';

export type PixelMap = readonly string[];

export interface Sprite {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  /** Where the sprite's "feet" sit, used for depth sorting and placement. */
  ox: number;
  oy: number;
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctxOf(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', { willReadFrequently: false });
  if (!ctx) throw new Error('2D context unavailable');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** Build a sprite from an authored pixel map. */
export function sprite(map: PixelMap, ox = 0, oy = 0): Sprite {
  const h = map.length;
  const w = map.reduce((m, row) => Math.max(m, row.length), 0);
  const canvas = makeCanvas(w, h);
  const ctx = ctxOf(canvas);
  paintInto(ctx, map, 0, 0);
  return { canvas, w, h, ox, oy };
}

/** Paint a pixel map into an existing context at an offset. */
export function paintInto(ctx: CanvasRenderingContext2D, map: PixelMap, dx: number, dy: number): void {
  for (let y = 0; y < map.length; y++) {
    const row = map[y];
    let x = 0;
    while (x < row.length) {
      const color = charToColor(row[x]);
      if (color === null) {
        x++;
        continue;
      }
      // Collapse runs of identical colour into one fillRect: far fewer draw
      // calls when building the atlas, and the result is pixel-identical.
      let run = 1;
      while (x + run < row.length && row[x + run] === row[x]) run++;
      ctx.fillStyle = color;
      ctx.fillRect(dx + x, dy + y, run, 1);
      x += run;
    }
  }
}

/** Horizontal mirror — lets one authored side-view serve both directions. */
export function mirrored(src: Sprite): Sprite {
  const canvas = makeCanvas(src.w, src.h);
  const ctx = ctxOf(canvas);
  ctx.translate(src.w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src.canvas, 0, 0);
  return { canvas, w: src.w, h: src.h, ox: src.w - src.ox, oy: src.oy };
}

/**
 * Recolour a sprite by swapping palette entries. Used for seasonal foliage and
 * for NPC clothing variants, so one authored body can dress a whole village
 * without duplicating pixel data.
 */
export function recolored(src: Sprite, swaps: Record<string, string>): Sprite {
  const canvas = makeCanvas(src.w, src.h);
  const ctx = ctxOf(canvas);
  ctx.drawImage(src.canvas, 0, 0);
  const img = ctx.getImageData(0, 0, src.w, src.h);
  const data = img.data;
  const from: number[][] = [];
  const to: number[][] = [];
  for (const key of Object.keys(swaps)) {
    from.push(parseHex(key));
    to.push(parseHex(swaps[key]));
  }
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    for (let k = 0; k < from.length; k++) {
      if (data[i] === from[k][0] && data[i + 1] === from[k][1] && data[i + 2] === from[k][2]) {
        data[i] = to[k][0];
        data[i + 1] = to[k][1];
        data[i + 2] = to[k][2];
        break;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return { canvas, w: src.w, h: src.h, ox: src.ox, oy: src.oy };
}

function parseHex(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * A solid silhouette of a sprite in one colour. Used for the "impact flash"
 * when a tool connects and for soft drop shadows.
 */
export function silhouette(src: Sprite, color: string): Sprite {
  const canvas = makeCanvas(src.w, src.h);
  const ctx = ctxOf(canvas);
  ctx.drawImage(src.canvas, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, src.w, src.h);
  ctx.globalCompositeOperation = 'source-over';
  return { canvas, w: src.w, h: src.h, ox: src.ox, oy: src.oy };
}

/**
 * Draw a sprite with a per-row horizontal offset. This is how everything in
 * the world sways: a tree canopy shears sideways with the wind while its trunk
 * stays put, which reads as flexible material rather than a sliding image.
 *
 * `bend(rowFromBottom01)` returns the offset in pixels for that row.
 */
export function drawSheared(
  ctx: CanvasRenderingContext2D,
  src: Sprite,
  dx: number,
  dy: number,
  bend: (t: number) => number,
): void {
  for (let y = 0; y < src.h; y++) {
    // t is 0 at the base of the sprite, 1 at the top: things bend more the
    // further they are from where they are rooted.
    const t = 1 - y / Math.max(1, src.h - 1);
    const off = Math.round(bend(t));
    ctx.drawImage(src.canvas, 0, y, src.w, 1, dx + off, dy + y, src.w, 1);
  }
}
