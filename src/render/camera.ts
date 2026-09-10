/**
 * CAMERA
 *
 * Damped follow with a small lead in the direction of travel, clamped to the
 * map so the player never sees past the edge of the world. Position is kept as
 * a float; the renderer splits it into an integer origin (which everything is
 * drawn against, keeping the pixel grid honest) and a fractional remainder
 * (applied to the final blit, so motion is smooth at screen resolution rather
 * than juddering one low-res pixel at a time).
 */

import { clamp, damp } from '../core/math.ts';

export class Camera {
  x = 0;
  y = 0;
  private leadX = 0;
  private leadY = 0;
  private shakeAmp = 0;
  private shakeDecay = 6;
  private shakeTime = 0;
  private shakeX = 0;
  private shakeY = 0;

  constructor(
    public viewW: number,
    public viewH: number,
    public worldW: number,
    public worldH: number,
  ) {}

  /** Snap straight to the target — used when entering an area. */
  snapTo(cx: number, cy: number): void {
    this.x = cx - this.viewW / 2;
    this.y = cy - this.viewH / 2;
    this.clampToWorld();
  }

  /**
   * @param cx,cy   the point to keep centred (usually the player's chest)
   * @param vx,vy   the target's velocity, used for a subtle lead
   */
  follow(cx: number, cy: number, vx: number, vy: number, dt: number): void {
    // Look slightly ahead of the player so there is more world visible in the
    // direction they are heading. Small — a big lead makes the camera feel
    // like it is fighting you.
    this.leadX = damp(this.leadX, clamp(vx * 0.28, -18, 18), 3.2, dt);
    this.leadY = damp(this.leadY, clamp(vy * 0.28, -14, 14), 3.2, dt);

    const targetX = cx + this.leadX - this.viewW / 2;
    const targetY = cy + this.leadY - this.viewH / 2;
    this.x = damp(this.x, targetX, 9.5, dt);
    this.y = damp(this.y, targetY, 9.5, dt);
    this.clampToWorld();

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      this.shakeAmp = damp(this.shakeAmp, 0, this.shakeDecay, dt);
      // Alternating sign rather than pure noise: reads as an impact, not static.
      const t = this.shakeTime * 47;
      this.shakeX = Math.sin(t) * this.shakeAmp;
      this.shakeY = Math.cos(t * 1.37) * this.shakeAmp * 0.7;
      if (this.shakeTime <= 0) {
        this.shakeAmp = 0;
        this.shakeX = 0;
        this.shakeY = 0;
      }
    }
  }

  /** Brief, small, and always tied to something hitting something else. */
  shake(amplitude: number, duration = 0.22, decay = 9): void {
    this.shakeAmp = Math.max(this.shakeAmp, amplitude);
    this.shakeTime = Math.max(this.shakeTime, duration);
    this.shakeDecay = decay;
  }

  private clampToWorld(): void {
    if (this.worldW <= this.viewW) this.x = (this.worldW - this.viewW) / 2;
    else this.x = clamp(this.x, 0, this.worldW - this.viewW);
    if (this.worldH <= this.viewH) this.y = (this.worldH - this.viewH) / 2;
    else this.y = clamp(this.y, 0, this.worldH - this.viewH);
  }

  /** Integer camera origin used for every world-space draw call. */
  get originX(): number {
    return Math.floor(this.x + this.shakeX);
  }

  get originY(): number {
    return Math.floor(this.y + this.shakeY);
  }

  /** Sub-pixel remainder, handed to the final upscale blit. */
  get fracX(): number {
    const v = this.x + this.shakeX;
    return v - Math.floor(v);
  }

  get fracY(): number {
    const v = this.y + this.shakeY;
    return v - Math.floor(v);
  }
}
