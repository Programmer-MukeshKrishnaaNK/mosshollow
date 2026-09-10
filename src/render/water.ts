/**
 * WATER
 *
 * The pond bed is already baked into the ground layer, so the water itself is
 * a semi-transparent animated surface drawn over it and clipped to the water
 * mask. Depth therefore comes through honestly: shallows show their pebbles,
 * the middle goes dark.
 *
 * The surface is eight pre-rendered, seamlessly tiling frames. Building them
 * once at load costs a few milliseconds and means the per-frame work is a
 * single pattern fill plus a mask — cheap enough to never think about again.
 */

import { TAU } from '../core/math.ts';
import { hash2 } from '../core/rng.ts';
import { PALETTE, hexToRgb } from '../art/palette.ts';
import { ctxOf, makeCanvas } from '../art/pixel.ts';

const TILE_SIZE = 64;
const FRAMES = 8;

export class WaterSurface {
  private frames: CanvasPattern[] = [];
  private foamFrames: CanvasPattern[] = [];
  private scratch: HTMLCanvasElement;
  private sctx: CanvasRenderingContext2D;

  constructor(viewW: number, viewH: number, ctx: CanvasRenderingContext2D) {
    this.scratch = makeCanvas(viewW, viewH);
    this.sctx = ctxOf(this.scratch);
    for (let f = 0; f < FRAMES; f++) {
      const phase = (f / FRAMES) * TAU;
      this.frames.push(makePattern(ctx, buildSurfaceTile(phase)));
      this.foamFrames.push(makePattern(ctx, buildFoamTile(phase)));
    }
  }

  /**
   * Draw the animated surface into `ctx`, clipped to the baked water mask.
   * `camX/camY` are the integer camera origin in world pixels.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    mask: HTMLCanvasElement,
    foam: HTMLCanvasElement,
    camX: number,
    camY: number,
    time: number,
    tint: string,
    tintAmount: number,
  ): void {
    const { scratch, sctx } = this;
    const frame = Math.floor(time * 7) % FRAMES;
    sctx.clearRect(0, 0, scratch.width, scratch.height);

    // The pattern scrolls with the camera so ripples stay put in the world,
    // and drifts slowly on its own so the surface is never still.
    sctx.save();
    const driftX = Math.sin(time * 0.19) * 5;
    const driftY = time * 2.1;
    sctx.translate(-camX + driftX, -camY + driftY);
    sctx.fillStyle = this.frames[frame];
    sctx.fillRect(camX - driftX, camY - driftY, scratch.width, scratch.height);
    sctx.restore();

    // Water takes the colour of the sky above it, which is most of what sells
    // a pond at dusk.
    if (tintAmount > 0.001) {
      sctx.globalCompositeOperation = 'source-atop';
      sctx.globalAlpha = tintAmount;
      sctx.fillStyle = tint;
      sctx.fillRect(0, 0, scratch.width, scratch.height);
      sctx.globalAlpha = 1;
    }

    sctx.globalCompositeOperation = 'destination-in';
    sctx.drawImage(mask, -camX, -camY);
    sctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(scratch, 0, 0);

    // Foam along the waterline, breathing in and out like a shore lap.
    sctx.clearRect(0, 0, scratch.width, scratch.height);
    sctx.save();
    sctx.translate(-camX, -camY);
    sctx.fillStyle = this.foamFrames[frame];
    sctx.fillRect(camX, camY, scratch.width, scratch.height);
    sctx.restore();
    sctx.globalCompositeOperation = 'destination-in';
    const lap = Math.round(Math.sin(time * 1.3) * 0.6);
    sctx.drawImage(foam, -camX, -camY + lap);
    sctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.55 + Math.sin(time * 1.7) * 0.12;
    ctx.drawImage(scratch, 0, 0);
    ctx.globalAlpha = 1;
  }
}

function makePattern(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): CanvasPattern {
  const p = ctx.createPattern(canvas, 'repeat');
  if (!p) throw new Error('Could not create water pattern');
  return p;
}

/**
 * One seamlessly tiling frame of surface. Everything is built from sine waves
 * whose periods divide the tile size exactly, which is what makes it tile.
 */
function buildSurfaceTile(phase: number): HTMLCanvasElement {
  const c = makeCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = ctxOf(c);
  const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  const d = img.data;
  const deep = hexToRgb(PALETTE.water3);
  const mid = hexToRgb(PALETTE.water2);
  const light = hexToRgb(PALETTE.water1);
  const foam = hexToRgb(PALETTE.water0);

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const u = (x / TILE_SIZE) * TAU;
      const v = (y / TILE_SIZE) * TAU;
      // Three crossing wave trains at different scales and speeds; the sum
      // never repeats visibly inside one tile.
      const wave =
        Math.sin(u * 1 + v * 2 + phase) * 0.5 +
        Math.sin(u * 3 - v * 1 - phase * 1.7) * 0.3 +
        Math.sin(u * 2 + v * 4 + phase * 0.6) * 0.2;
      const grain = hash2(x, y, 401) * 0.16;
      const t = wave * 0.5 + 0.5 + grain - 0.08;
      const i = (y * TILE_SIZE + x) * 4;
      let c3: number[];
      let alpha: number;
      if (t > 0.88) {
        c3 = foam;
        alpha = 250;
      } else if (t > 0.7) {
        c3 = light;
        alpha = 235;
      } else if (t > 0.42) {
        c3 = mid;
        alpha = 210;
      } else {
        c3 = deep;
        alpha = 196;
      }
      d[i] = c3[0];
      d[i + 1] = c3[1];
      d[i + 2] = c3[2];
      d[i + 3] = alpha;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Broken white flecks for the waterline — deliberately sparse. */
function buildFoamTile(phase: number): HTMLCanvasElement {
  const c = makeCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = ctxOf(c);
  const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  const d = img.data;
  const foam = hexToRgb(PALETTE.water0);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const u = (x / TILE_SIZE) * TAU;
      const v = (y / TILE_SIZE) * TAU;
      const wave = Math.sin(u * 2 + v * 1 + phase * 1.4) * 0.6 + Math.sin(u * 5 - v * 3 - phase) * 0.4;
      const t = wave * 0.5 + 0.5;
      const on = t > 0.58 && hash2(x, y, 907) > 0.42;
      const i = (y * TILE_SIZE + x) * 4;
      d[i] = foam[0];
      d[i + 1] = foam[1];
      d[i + 2] = foam[2];
      d[i + 3] = on ? 255 : 0;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
