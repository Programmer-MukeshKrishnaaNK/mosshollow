/**
 * RENDERER
 *
 * Everything is drawn at 480x270 and scaled up by a whole number, which is the
 * only way pixel art stays pixel art. Three surfaces:
 *
 *   world  — one pixel larger than the view in each axis, so the sub-pixel
 *            camera offset has something to slide into
 *   ui     — exactly view-sized and never offset, so HUD pixels stay on the grid
 *   light  — the lighting buffer, multiplied over the world
 *
 * The upscale is done with image smoothing off and a CSS size that is always
 * an exact multiple of the internal resolution.
 */

import { ctxOf, makeCanvas } from '../art/pixel.ts';

export const VIEW_W = 480;
export const VIEW_H = 270;

export class Renderer {
  readonly display: HTMLCanvasElement;
  readonly dctx: CanvasRenderingContext2D;
  /** World surface, VIEW_W+1 x VIEW_H+1. Draw world-space content here. */
  readonly world: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** UI surface, exactly view-sized. */
  readonly ui: HTMLCanvasElement;
  readonly uctx: CanvasRenderingContext2D;

  scale = 1;
  /** Whole-number scale of the backing store, which the blit uses. */
  storeScale = 1;

  constructor(container: HTMLElement) {
    this.display = makeCanvas(VIEW_W, VIEW_H);
    this.display.className = 'game-canvas';
    container.appendChild(this.display);
    this.dctx = ctxOf(this.display);

    this.world = makeCanvas(VIEW_W + 1, VIEW_H + 1);
    this.ctx = ctxOf(this.world);
    this.ui = makeCanvas(VIEW_W, VIEW_H);
    this.uctx = ctxOf(this.ui);

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  private resize = (): void => {
    const pad = 0;
    const availW = window.innerWidth - pad;
    const availH = window.innerHeight - pad;
    // Integer scale only. Anything else resamples the pixel grid and the art
    // immediately starts to shimmer as the camera moves.
    const raw = Math.min(availW / VIEW_W, availH / VIEW_H);
    // Whole numbers wherever they are worth having: anything else resamples
    // the pixel grid and the art shimmers as the camera moves, so a desktop
    // window that can afford 2x, 3x or 4x always gets one.
    //
    // Under 2x there is no whole number left worth taking. Rounding 1.44 down
    // to 1 on a phone leaves the game sitting in the middle of the screen at
    // barely half its width, which is a worse crime against the art than a
    // fractional composite that a phone's pixel density makes invisible. So
    // below 2x it fills what it is given and letterboxes the difference.
    const scale = raw >= 2 ? Math.floor(raw) : raw;
    this.scale = scale;
    // The backing store stays on whole pixels even when the CSS size does not,
    // so the upscale itself is still nearest-neighbour and only the final
    // browser composite is fractional.
    const store = Math.max(1, Math.ceil(scale));
    this.display.width = VIEW_W * store;
    this.display.height = VIEW_H * store;
    this.storeScale = store;
    this.display.style.width = `${VIEW_W * scale}px`;
    this.display.style.height = `${VIEW_H * scale}px`;
    this.dctx.imageSmoothingEnabled = false;
  };

  /** Blit world (with sub-pixel offset) then UI (aligned) to the display. */
  present(fracX: number, fracY: number): void {
    const s = this.storeScale;
    this.dctx.imageSmoothingEnabled = false;
    this.dctx.drawImage(
      this.world,
      0,
      0,
      VIEW_W + 1,
      VIEW_H + 1,
      -Math.round(fracX * s),
      -Math.round(fracY * s),
      (VIEW_W + 1) * s,
      (VIEW_H + 1) * s,
    );
    this.dctx.drawImage(this.ui, 0, 0, VIEW_W, VIEW_H, 0, 0, VIEW_W * s, VIEW_H * s);
  }

  clearWorld(): void {
    this.ctx.clearRect(0, 0, VIEW_W + 1, VIEW_H + 1);
  }

  clearUi(): void {
    this.uctx.clearRect(0, 0, VIEW_W, VIEW_H);
  }
}
