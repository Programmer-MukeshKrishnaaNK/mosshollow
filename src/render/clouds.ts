/**
 * CLOUD SHADOWS
 *
 * The single cheapest thing that stops a big green field looking flat. Soft
 * dark shapes drift across the valley on the wind; the ground breathes between
 * bright and shaded, and the eye is given something slow to follow.
 *
 * The shadows are drawn into the *lighting* buffer rather than over the
 * finished picture, which means a lantern still burns through one and the
 * shadows fade out honestly at dusk when there is no longer a sun to cast them.
 *
 * The texture is built from summed sine waves at whole-number frequencies, so
 * it tiles seamlessly by construction, and quantised with an ordered dither so
 * the edges read as pixel art rather than as an airbrush.
 */

import { TAU } from '../core/math.ts';
import { ctxOf, makeCanvas } from '../art/pixel.ts';

const SIZE = 256;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Frequency pairs and phases. Whole numbers, so the field wraps at SIZE. */
const WAVES: [number, number, number, number][] = [
  // fx, fy, phase, amplitude
  [1, 1, 0.0, 1.0],
  [1, 2, 2.1, 0.62],
  [2, 1, 4.3, 0.55],
  [2, 3, 1.2, 0.34],
  [3, 2, 5.1, 0.3],
  [4, 3, 0.7, 0.16],
  [3, 5, 3.4, 0.12],
];

export class CloudShadows {
  private pattern: CanvasPattern;
  private offsetX = 0;
  private offsetY = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    const p = ctx.createPattern(buildTexture(), 'repeat');
    if (!p) throw new Error('Could not create cloud pattern');
    this.pattern = p;
  }

  /** Clouds move with the wind, but always onward — never backwards. */
  update(dt: number, wind: number): void {
    this.offsetX += (7 + wind * 9) * dt;
    this.offsetY += 2.4 * dt;
    if (this.offsetX > SIZE) this.offsetX -= SIZE;
    if (this.offsetY > SIZE) this.offsetY -= SIZE;
  }

  /**
   * Multiply the shadow field into a lighting buffer.
   * @param strength 0 at night (no sun to cast them), up to ~1 at midday.
   */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, camX: number, camY: number, strength: number): void {
    if (strength <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = strength;
    // Parallax: the shadows sit on the ground, so they scroll with the camera.
    ctx.translate(-((camX + this.offsetX) % SIZE), -((camY + this.offsetY) % SIZE));
    ctx.fillStyle = this.pattern;
    ctx.fillRect(0, 0, w + SIZE, h + SIZE);
    ctx.restore();
  }
}

function buildTexture(): HTMLCanvasElement {
  const c = makeCanvas(SIZE, SIZE);
  const ctx = ctxOf(c);
  const img = ctx.createImageData(SIZE, SIZE);
  const d = img.data;
  let amplitude = 0;
  for (const wv of WAVES) amplitude += wv[3];

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = (x / SIZE) * TAU;
      const v = (y / SIZE) * TAU;
      let sum = 0;
      for (const [fx, fy, phase, amp] of WAVES) {
        sum += Math.sin(fx * u + fy * v + phase) * amp;
      }
      const t = sum / amplitude; // -1..1
      // Only the deeper troughs become shadow, so the ground is mostly lit and
      // a passing cloud is an event rather than a permanent mottle.
      const shade = Math.max(0, -t - 0.06) / 0.94;
      const bayer = BAYER[(y & 3) * 4 + (x & 3)] / 16;
      const q = Math.min(3, Math.floor(shade * 3.4 + bayer));
      const value = 255 - q * 26;
      const i = (y * SIZE + x) * 4;
      d[i] = value;
      d[i + 1] = value;
      d[i + 2] = Math.min(255, value + 6); // shadows lean very slightly blue
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
