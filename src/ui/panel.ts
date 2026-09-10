/**
 * UI panels, drawn as pixel art rather than styled boxes.
 *
 * The look: a sheet of aged paper in a thin wooden frame, bevelled so the
 * light on it matches the light on the world. Corners are notched a pixel so
 * nothing in the interface has a hard 90-degree point, which is what makes a
 * canvas HUD read as handmade instead of as a div.
 */

import { hash2 } from '../core/rng.ts';
import { PALETTE } from '../art/palette.ts';
import { ctxOf, makeCanvas } from '../art/pixel.ts';

export interface PanelStyle {
  /** Paper, or the darker slate used for dialogue. */
  tone?: 'paper' | 'night';
  /** 0-1; panels fade in rather than appearing. */
  alpha?: number;
}

/**
 * Panels are cached by size and tone. The paper grain is a per-pixel pass, and
 * a full-screen panel is ninety thousand pixels — cheap once, wasteful sixty
 * times a second, and the difference between comfortable and marginal on a
 * phone.
 */
const cache = new Map<string, HTMLCanvasElement>();

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  style: PanelStyle = {},
): void {
  const { tone = 'paper', alpha = 1 } = style;
  if (alpha <= 0.01 || w < 4 || h < 4) return;
  const key = `${w}x${h}|${tone}`;
  let sheet = cache.get(key);
  if (!sheet) {
    sheet = renderPanel(w, h, tone);
    cache.set(key, sheet);
  }
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * alpha;
  ctx.drawImage(sheet, Math.round(x), Math.round(y));
  ctx.globalAlpha = prev;
}

/** Draw one panel face into its own canvas. Called once per size. */
function renderPanel(w: number, h: number, tone: 'paper' | 'night'): HTMLCanvasElement {
  const canvas = makeCanvas(w, h);
  const ctx = ctxOf(canvas);

  const body = tone === 'paper' ? PALETTE.cream1 : PALETTE.stone4;
  const bodyLit = tone === 'paper' ? PALETTE.cream0 : PALETTE.stone3;
  const frame = tone === 'paper' ? PALETTE.wood2 : PALETTE.wood3;
  const frameLit = tone === 'paper' ? PALETTE.wood1 : PALETTE.wood2;
  const frameDark = PALETTE.wood3;

  const rect = (rx: number, ry: number, rw: number, rh: number, c: string): void => {
    ctx.fillStyle = c;
    ctx.fillRect(rx, ry, rw, rh);
  };

  // outer contour, with the corners knocked off
  rect(1, 0, w - 2, 1, PALETTE.ink);
  rect(1, h - 1, w - 2, 1, PALETTE.ink);
  rect(0, 1, 1, h - 2, PALETTE.ink);
  rect(w - 1, 1, 1, h - 2, PALETTE.ink);

  // frame
  rect(1, 1, w - 2, h - 2, frame);
  rect(1, 1, w - 2, 1, frameLit);
  rect(1, h - 2, w - 2, 1, frameDark);

  // paper, lit slightly from the top
  rect(3, 3, w - 6, h - 6, body);
  rect(3, 3, w - 6, 2, bodyLit);
  rect(3, 3, 1, h - 6, bodyLit);

  // Grain. A flat fill reads as a UI rectangle; a few hundred barely-visible
  // specks read as paper.
  const grain = tone === 'paper' ? PALETTE.cream0 : PALETTE.stone3;
  const fleck = tone === 'paper' ? PALETTE.wood1 : PALETTE.inkCool;
  ctx.fillStyle = grain;
  for (let py = 4; py < h - 4; py++) {
    for (let px = 4; px < w - 4; px++) {
      if (hash2(px, py, 313) > 0.976) ctx.fillRect(px, py, 1, 1);
    }
  }
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = fleck;
  for (let py = 5; py < h - 5; py++) {
    for (let px = 5; px < w - 5; px++) {
      if (hash2(px, py, 977) > 0.9965) ctx.fillRect(px, py, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
  return canvas;
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
