/**
 * RENDERER
 *
 * Owns the three drawing surfaces and the only copy of the viewport. Sizes
 * come from `core/viewport.ts`; nothing here decides anything for itself.
 *
 *   world  — one pixel larger than the view in each axis, so the sub-pixel
 *            camera offset has something to slide into
 *   ui     — exactly view-sized and never offset, so HUD pixels stay on the grid
 *   light  — the lighting buffer, multiplied over the world
 *
 * The logical size can now change at runtime, so the surfaces are rebuilt when
 * it does and anybody holding a buffer of their own is told to do the same.
 */

import { ctxOf, makeCanvas } from '../art/pixel.ts';
import { computeViewport, LOGICAL_H, REFERENCE_W, sameLogical, type ViewportSize } from '../core/viewport.ts';

/** The 16:9 reference size. Used for defaults only — ask the renderer for live values. */
export const VIEW_W = REFERENCE_W;
export const VIEW_H = LOGICAL_H;

export class Renderer {
  readonly display: HTMLCanvasElement;
  readonly dctx: CanvasRenderingContext2D;
  world!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;
  ui!: HTMLCanvasElement;
  uctx!: CanvasRenderingContext2D;

  view: ViewportSize;
  /** Raised when the logical size changes, so buffers elsewhere can follow. */
  onLogicalResize: ((v: ViewportSize) => void) | null = null;

  get vw(): number { return this.view.vw; }
  get vh(): number { return this.view.vh; }
  get scale(): number { return this.view.scale; }

  constructor(container: HTMLElement) {
    this.display = makeCanvas(REFERENCE_W, LOGICAL_H);
    this.display.className = 'game-canvas';
    container.appendChild(this.display);
    this.dctx = ctxOf(this.display);

    const vv0 = window.visualViewport;
    this.lastW = vv0 ? vv0.width : window.innerWidth;
    this.lastH = vv0 ? vv0.height : window.innerHeight;
    this.view = this.measure();
    this.buildSurfaces();
    this.applyDisplay();

    window.addEventListener('resize', this.resize);
    // Orientation and the mobile address bar both change the usable area
    // without always firing `resize` on every browser.
    window.addEventListener('orientationchange', this.resize);
    window.visualViewport?.addEventListener('resize', this.resize);
  }

  private measure(): ViewportSize {
    // visualViewport is the only honest width and height on a phone: it
    // excludes the address bar, and it is what actually gets painted.
    const vv = window.visualViewport;
    const w = vv ? vv.width : window.innerWidth;
    const h = vv ? vv.height : window.innerHeight;
    return computeViewport(w, h, window.devicePixelRatio || 1);
  }

  private buildSurfaces(): void {
    const { vw, vh } = this.view;
    this.world = makeCanvas(vw + 1, vh + 1);
    this.ctx = ctxOf(this.world);
    this.ui = makeCanvas(vw, vh);
    this.uctx = ctxOf(this.ui);
  }

  private applyDisplay(): void {
    const { bufW, bufH, cssW, cssH } = this.view;
    this.display.width = bufW;
    this.display.height = bufH;
    this.display.style.width = `${cssW}px`;
    this.display.style.height = `${cssH}px`;
    this.dctx.imageSmoothingEnabled = false;
  }

  /**
   * Called every frame. Two float comparisons, and it is the only thing that
   * makes this reliable on a phone: mobile browsers do not consistently fire
   * `resize` when the address bar collapses, and an orientation change often
   * reports the old dimensions for a frame or two afterwards. Polling the
   * measurement we already trust costs nothing and cannot be missed.
   */
  syncSize(): void {
    const vv = window.visualViewport;
    const w = vv ? vv.width : window.innerWidth;
    const h = vv ? vv.height : window.innerHeight;
    if (Math.abs(w - this.lastW) < 0.5 && Math.abs(h - this.lastH) < 0.5) return;
    this.resize();
  }

  private lastW = -1;
  private lastH = -1;

  resize = (): void => {
    const vv0 = window.visualViewport;
    this.lastW = vv0 ? vv0.width : window.innerWidth;
    this.lastH = vv0 ? vv0.height : window.innerHeight;
    const next = this.measure();
    const logicalChanged = !sameLogical(this.view, next);
    this.view = next;
    if (logicalChanged) {
      this.buildSurfaces();
      this.onLogicalResize?.(next);
    }
    this.applyDisplay();
  };

  /** Blit world (with sub-pixel offset) then UI (aligned) to the display. */
  present(fracX: number, fracY: number): void {
    const { vw, vh, store } = this.view;
    this.dctx.imageSmoothingEnabled = false;
    this.dctx.drawImage(
      this.world,
      0, 0, vw + 1, vh + 1,
      -Math.round(fracX * store),
      -Math.round(fracY * store),
      (vw + 1) * store,
      (vh + 1) * store,
    );
    this.dctx.drawImage(this.ui, 0, 0, vw, vh, 0, 0, vw * store, vh * store);
  }

  clearWorld(): void {
    this.ctx.clearRect(0, 0, this.view.vw + 1, this.view.vh + 1);
  }

  clearUi(): void {
    this.uctx.clearRect(0, 0, this.view.vw, this.view.vh);
  }
}
