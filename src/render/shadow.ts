/**
 * Drop shadows, drawn as hard-edged pixel ellipses rather than blurred blobs.
 *
 * They stretch and lean with the sun, so a character's shadow points west in
 * the morning, tucks under them at noon and stretches east at dusk. It is a
 * small thing that does an unreasonable amount of work in convincing the eye
 * that the world has a sky over it.
 */

import { ctxOf, makeCanvas } from '../art/pixel.ts';
import { PALETTE } from '../art/palette.ts';

const cache = new Map<string, HTMLCanvasElement>();

function ellipseSprite(w: number, h: number): HTMLCanvasElement {
  const key = `${w}x${h}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = makeCanvas(w, h);
  const ctx = ctxOf(c);
  ctx.fillStyle = PALETTE.inkCool;
  const rx = w / 2;
  const ry = h / 2;
  for (let y = 0; y < h; y++) {
    const dy = (y + 0.5 - ry) / ry;
    const half = Math.sqrt(Math.max(0, 1 - dy * dy)) * rx;
    const x0 = Math.round(rx - half);
    const x1 = Math.round(rx + half);
    if (x1 > x0) ctx.fillRect(x0, y, x1 - x0, 1);
  }
  cache.set(key, c);
  return c;
}

/**
 * @param x,y   the object's ground contact point in screen space
 * @param width the object's footprint width
 * @param sun   direction and strength from TimeOfDay.shadow()
 */
export function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  sun: { dx: number; dy: number; alpha: number },
  scale = 1,
): void {
  const w = Math.max(3, Math.round(width * scale + Math.abs(sun.dx) * 0.5));
  const h = Math.max(2, Math.round(height * scale));
  if (sun.alpha <= 0.01) return;
  const spr = ellipseSprite(w, h);
  ctx.globalAlpha = sun.alpha;
  ctx.drawImage(spr, Math.round(x - w / 2 + sun.dx * 0.4), Math.round(y - h / 2 + sun.dy));
  ctx.globalAlpha = 1;
}
