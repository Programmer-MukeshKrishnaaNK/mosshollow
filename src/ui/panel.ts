/**
 * UI panels, drawn as pixel art rather than styled boxes.
 *
 * The look: a sheet of aged paper in a thin wooden frame, bevelled so the
 * light on it matches the light on the world. Corners are notched a pixel so
 * nothing in the interface has a hard 90-degree point, which is what makes a
 * canvas HUD read as handmade instead of as a div.
 */

import { PALETTE } from '../art/palette.ts';

export interface PanelStyle {
  /** Paper, or the darker slate used for dialogue. */
  tone?: 'paper' | 'night';
  /** 0-1; panels fade in rather than appearing. */
  alpha?: number;
}

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  style: PanelStyle = {},
): void {
  const { tone = 'paper', alpha = 1 } = style;
  if (alpha <= 0.01) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * alpha;

  const body = tone === 'paper' ? PALETTE.cream1 : PALETTE.stone4;
  const bodyLit = tone === 'paper' ? PALETTE.cream0 : PALETTE.stone3;
  const frame = tone === 'paper' ? PALETTE.wood2 : PALETTE.wood3;
  const frameLit = tone === 'paper' ? PALETTE.wood1 : PALETTE.wood2;
  const frameDark = PALETTE.wood3;

  const rect = (rx: number, ry: number, rw: number, rh: number, c: string): void => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(rx), Math.round(ry), Math.round(rw), Math.round(rh));
  };

  // outer contour, with the corners knocked off
  rect(x + 1, y, w - 2, 1, PALETTE.ink);
  rect(x + 1, y + h - 1, w - 2, 1, PALETTE.ink);
  rect(x, y + 1, 1, h - 2, PALETTE.ink);
  rect(x + w - 1, y + 1, 1, h - 2, PALETTE.ink);

  // frame
  rect(x + 1, y + 1, w - 2, h - 2, frame);
  rect(x + 1, y + 1, w - 2, 1, frameLit);
  rect(x + 1, y + h - 2, w - 2, 1, frameDark);

  // paper, lit slightly from the top
  rect(x + 3, y + 3, w - 6, h - 6, body);
  rect(x + 3, y + 3, w - 6, 2, bodyLit);
  rect(x + 3, y + 3, 1, h - 6, bodyLit);

  ctx.globalAlpha = prev;
}

/** A soft vignette that pulls the eye toward the middle of the screen. */
export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number): void {
  if (strength <= 0.01) return;
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.34, w / 2, h / 2, h * 0.92);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(14,10,20,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
