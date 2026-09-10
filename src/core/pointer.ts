/**
 * POINTER
 *
 * Mouse and touch, reported in *game* coordinates rather than screen pixels.
 * Every interface in the game is laid out on a 480x270 surface, so hit-testing
 * a button against raw client coordinates would mean every panel doing the
 * same scale arithmetic. This does it once.
 *
 * Written against pointer events rather than mouse events, so a finger and a
 * mouse arrive through the same path. That is the whole reason this exists
 * now: the interface built on top of it should not need rewriting to be
 * touched instead of clicked.
 *
 * `hovering` is false on touch, because a finger has no hover state — panels
 * use it to decide whether to show a highlight that a touch user would never
 * see and would only be confused by.
 */

export type PointerKind = 'mouse' | 'touch' | 'pen';

export class Pointer {
  /** Position in game coordinates. Clamped to the surface. */
  x = 0;
  y = 0;
  /** True while a button or finger is down. */
  down = false;
  /** True for exactly one frame, on the frame the press began. */
  pressed = false;
  /** True for exactly one frame, on the frame it was released. */
  released = false;
  /** Where the current press began, for drag detection. */
  pressX = 0;
  pressY = 0;
  /** The device in use. A finger has no hover, so panels check this. */
  kind: PointerKind = 'mouse';
  /** False on touch: there is nothing to highlight under a finger. */
  hovering = false;
  /** True once any pointer has been used, so the cursor can stay hidden. */
  everUsed = false;
  /** Scroll wheel delta accumulated this frame, in notches. */
  wheel = 0;

  private surface: HTMLCanvasElement | null = null;
  private viewW = 1;
  private viewH = 1;

  /** Attach to the display canvas. Call again if the canvas is replaced. */
  attach(canvas: HTMLCanvasElement, viewW: number, viewH: number): void {
    this.detach();
    this.surface = canvas;
    this.viewW = viewW;
    this.viewH = viewH;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('wheel', this.onWheel, { passive: true });
    // Up and cancel go on the window: releasing outside the canvas must still
    // end the press, or a drag off the edge leaves a button stuck down.
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    // A long-press on touch otherwise raises the context menu mid-game.
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  detach(): void {
    const c = this.surface;
    if (!c) return;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerleave', this.onLeave);
    c.removeEventListener('wheel', this.onWheel);
    c.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.surface = null;
  }

  private toGame(ev: PointerEvent): void {
    const c = this.surface;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    // The canvas is displayed at a whole-number multiple of the game surface,
    // so this is a straight divide — but use the measured rect rather than the
    // assumed scale, because CSS or a zoomed browser can disagree.
    const sx = rect.width / this.viewW;
    const sy = rect.height / this.viewH;
    this.x = Math.min(this.viewW - 1, Math.max(0, (ev.clientX - rect.left) / sx));
    this.y = Math.min(this.viewH - 1, Math.max(0, (ev.clientY - rect.top) / sy));
  }

  private onDown = (ev: PointerEvent): void => {
    this.kind = (ev.pointerType as PointerKind) || 'mouse';
    this.hovering = this.kind === 'mouse' || this.kind === 'pen';
    this.everUsed = true;
    this.toGame(ev);
    this.down = true;
    this.pressed = true;
    this.pressX = this.x;
    this.pressY = this.y;
    // Keep receiving moves even if the finger slides off the canvas.
    this.surface?.setPointerCapture?.(ev.pointerId);
  };

  private onMove = (ev: PointerEvent): void => {
    this.kind = (ev.pointerType as PointerKind) || 'mouse';
    this.hovering = this.kind === 'mouse' || this.kind === 'pen';
    this.everUsed = true;
    this.toGame(ev);
  };

  private onUp = (ev: PointerEvent): void => {
    if (!this.down) return;
    this.toGame(ev);
    this.down = false;
    this.released = true;
  };

  private onLeave = (): void => {
    this.hovering = false;
  };

  private onWheel = (ev: WheelEvent): void => {
    this.wheel += Math.sign(ev.deltaY);
  };

  private onContextMenu = (ev: Event): void => {
    ev.preventDefault();
  };

  /** Is the pointer inside this rectangle, in game coordinates? */
  over(x: number, y: number, w: number, h: number): boolean {
    return this.x >= x && this.x < x + w && this.y >= y && this.y < y + h;
  }

  /** Was a press *completed* inside this rectangle this frame? */
  clicked(x: number, y: number, w: number, h: number): boolean {
    if (!this.released) return false;
    // Both ends of the press must be inside, so sliding off a control cancels
    // it — the behaviour a touch user expects from every other app they own.
    const startedInside =
      this.pressX >= x && this.pressX < x + w && this.pressY >= y && this.pressY < y + h;
    return startedInside && this.over(x, y, w, h);
  }

  /** Call once at the end of each frame. */
  endFrame(): void {
    this.pressed = false;
    this.released = false;
    this.wheel = 0;
  }
}
