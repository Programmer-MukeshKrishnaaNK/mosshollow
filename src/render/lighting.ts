/**
 * LIGHTING
 *
 * The world is drawn at full brightness, then a light buffer is multiplied
 * over it. The buffer starts as the ambient colour for the current time of
 * day, and every light source adds its own falloff on top. Where a lantern
 * reaches, the multiply is close to white and the art shows through in full
 * colour; away from it, everything sinks into the ambient tint.
 *
 * The important detail is that the falloff is *quantised and dithered* rather
 * than a smooth gradient. A smooth radial gradient at 480x270 looks like a
 * photographic vignette pasted onto pixel art — instantly wrong. Stepped,
 * dithered falloff reads as part of the same picture.
 */

import { hexToRgb } from '../art/palette.ts';

/** Just enough of CloudShadows for lighting to drive it, without the import cycle. */
export interface CloudLayer {
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, camX: number, camY: number, strength: number): void;
}
import { ctxOf, makeCanvas } from '../art/pixel.ts';

export interface Light {
  x: number;
  y: number;
  radius: number;
  color: string;
  /** 0-1. Multiplied into the falloff. */
  intensity: number;
  /** Per-light flicker phase, so two lanterns never pulse in unison. */
  flicker?: number;
  flickerAmount?: number;
}

/** 4x4 ordered dither. The pattern is small enough to read as texture. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const STEPS = 5;

export class Lighting {
  private buffer: HTMLCanvasElement;
  private bctx: CanvasRenderingContext2D;
  private cache = new Map<string, HTMLCanvasElement>();
  /** Lights submitted this frame. Cleared every frame; no allocation churn. */
  private lights: Light[] = [];

  constructor(
    private w: number,
    private h: number,
  ) {
    this.buffer = makeCanvas(w, h);
    this.bctx = ctxOf(this.buffer);
  }

  begin(): void {
    this.lights.length = 0;
  }

  add(light: Light): void {
    this.lights.push(light);
  }

  /**
   * Composite the frame's lighting onto `ctx`.
   * @param camX,camY integer camera origin
   * @param time      seconds, for flicker
   * @param glow      how much additive bloom to lay over the top (0 by day)
   */
  render(
    ctx: CanvasRenderingContext2D,
    ambientCss: string,
    camX: number,
    camY: number,
    time: number,
    glow: number,
    opts: { clouds?: CloudLayer; cloudStrength?: number; desaturate?: number } = {},
  ): void {
    const { bctx, w, h } = this;
    bctx.globalCompositeOperation = 'source-over';
    bctx.fillStyle = ambientCss;
    bctx.fillRect(0, 0, w, h);

    // Cloud shadows go in before the lights, so a lantern still burns through
    // one — which is both correct and the reason they read as *shadows*.
    if (opts.clouds && (opts.cloudStrength ?? 0) > 0.01) {
      opts.clouds.draw(bctx, w, h, camX, camY, opts.cloudStrength ?? 0);
    }

    bctx.globalCompositeOperation = 'lighter';
    for (const l of this.lights) {
      const flick = l.flickerAmount
        ? 1 - l.flickerAmount * (0.5 + 0.5 * Math.sin(time * 6.3 + (l.flicker ?? 0)) * Math.sin(time * 2.1 + (l.flicker ?? 0) * 1.7))
        : 1;
      const strength = l.intensity * flick;
      if (strength <= 0.01) continue;
      const spr = this.lightSprite(l.radius, l.color);
      const sx = Math.round(l.x - camX - l.radius);
      const sy = Math.round(l.y - camY - l.radius);
      if (sx > w || sy > h || sx + l.radius * 2 < 0 || sy + l.radius * 2 < 0) continue;
      bctx.globalAlpha = Math.min(1, strength);
      bctx.drawImage(spr, sx, sy);
    }
    bctx.globalAlpha = 1;
    bctx.globalCompositeOperation = 'source-over';

    // Moonlight carries almost no colour information, so the world loses its
    // saturation after dark before the blue ambient is laid over it. Doing it
    // in this order is what makes lit windows read as warm against a silver
    // night rather than as yellow against green.
    if ((opts.desaturate ?? 0) > 0.01) {
      ctx.globalCompositeOperation = 'saturation';
      ctx.globalAlpha = Math.min(1, opts.desaturate ?? 0);
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.buffer, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    // A second, additive pass at low alpha. This is what makes a lit window at
    // night feel like it is actually emitting rather than just being pale.
    if (glow > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      for (const l of this.lights) {
        if (l.intensity <= 0.01) continue;
        const spr = this.lightSprite(Math.round(l.radius * 0.6), l.color);
        ctx.globalAlpha = Math.min(0.5, l.intensity * glow * 0.5);
        ctx.drawImage(spr, Math.round(l.x - camX - l.radius * 0.6), Math.round(l.y - camY - l.radius * 0.6));
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /** Stepped, dithered radial falloff, built once per radius/colour pair. */
  private lightSprite(radius: number, color: string): HTMLCanvasElement {
    const r = Math.max(2, Math.round(radius));
    const key = `${r}|${color}`;
    const hit = this.cache.get(key);
    if (hit) return hit;

    const size = r * 2;
    const c = makeCanvas(size, size);
    const cx = ctxOf(c);
    const img = cx.createImageData(size, size);
    const d = img.data;
    const [cr, cg, cb] = hexToRgb(color);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - r + 0.5;
        const dy = y - r + 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy) / r;
        if (dist >= 1) continue;
        // A slightly concave falloff: bright core, quick shoulder, long tail.
        const v = Math.pow(1 - dist, 1.9);
        const bayer = BAYER[(y & 3) * 4 + (x & 3)] / 16;
        const q = Math.min(1, Math.floor(v * STEPS + bayer) / STEPS);
        if (q <= 0) continue;
        const i = (y * size + x) * 4;
        d[i] = cr * q;
        d[i + 1] = cg * q;
        d[i + 2] = cb * q;
        d[i + 3] = 255;
      }
    }
    cx.putImageData(img, 0, 0);
    this.cache.set(key, c);
    return c;
  }
}
