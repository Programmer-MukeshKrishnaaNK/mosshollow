/**
 * BARKS
 *
 * A line that floats over somebody's head and goes away on its own. No input,
 * no freeze, no box. It is the difference between a settlement that is
 * populated and one that is staffed.
 *
 * Drawn in the world pass rather than the UI pass, because it has to sit above
 * a specific person and move with them — but it uses the UI font and a small
 * paper slip, so it belongs to the same interface as everything else.
 */

import { PALETTE } from '../art/palette.ts';
import { drawText, textWidth } from './font.ts';

interface Bark {
  text: string;
  /** Who it belongs to, so it follows them. */
  at: () => { x: number; y: number } | null;
  life: number;
  age: number;
}

const RISE = 4;

export class Barks {
  private list: Bark[] = [];

  show(text: string, at: () => { x: number; y: number } | null, life = 2.6): void {
    // One at a time per speaker: a stack of slips over one head is noise.
    this.list = this.list.filter((b) => b.at() !== at());
    this.list.push({ text, at, life, age: 0 });
  }

  clear(): void { this.list.length = 0; }

  update(dt: number): void {
    for (const b of this.list) b.age += dt;
    this.list = this.list.filter((b) => b.age < b.life);
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    for (const b of this.list) {
      const p = b.at();
      if (!p) continue;
      const t = b.age / b.life;
      // In fast, hold, out slow. A slip that fades symmetrically reads as a
      // mistake rather than as speech.
      const alpha = t < 0.12 ? t / 0.12 : t > 0.76 ? (1 - t) / 0.24 : 1;
      if (alpha <= 0.02) continue;
      const w = textWidth(b.text) + 8;
      const h = 11;
      const x = Math.round(p.x - camX - w / 2);
      const y = Math.round(p.y - camY - 32 - Math.min(RISE, t * RISE * 3));
      ctx.save();
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = PALETTE.cream0;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = PALETTE.cream1;
      ctx.fillRect(x, y + h - 1, w, 1);
      // a tail, so the slip is attached to somebody
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(x + w / 2 - 2, y + h + 1, 3, 1);
      ctx.fillRect(x + w / 2 - 1, y + h + 2, 1, 1);
      ctx.fillStyle = PALETTE.cream0;
      ctx.fillRect(x + w / 2 - 1, y + h, 2, 1);
      drawText(ctx, b.text, x + 4, y + 3, PALETTE.wood3);
      ctx.restore();
    }
  }
}
