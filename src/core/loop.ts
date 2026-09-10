/**
 * Fixed-timestep update with a variable render. Gameplay always advances in
 * even 1/60s slices so movement, animation timing and physics stay identical
 * regardless of monitor refresh rate; rendering happens once per frame.
 */

export const FIXED_DT = 1 / 60;
/** Never simulate more than this in one frame — prevents a spiral of death
 *  after the tab has been in the background. */
const MAX_FRAME_TIME = 0.25;

export interface LoopCallbacks {
  update(dt: number): void;
  render(alpha: number): void;
}

export class Loop {
  private running = false;
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;

  /** Smoothed frames-per-second, for the debug overlay. */
  fps = 60;
  /** Milliseconds spent inside update+render last frame. */
  frameMs = 0;

  constructor(private cb: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    let frameTime = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (frameTime > MAX_FRAME_TIME) frameTime = MAX_FRAME_TIME;
    if (frameTime > 0) this.fps += ((1 / frameTime) - this.fps) * 0.1;

    const started = performance.now();
    this.accumulator += frameTime;
    while (this.accumulator >= FIXED_DT) {
      this.cb.update(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }
    this.cb.render(this.accumulator / FIXED_DT);
    this.frameMs += (performance.now() - started - this.frameMs) * 0.1;
  };
}
