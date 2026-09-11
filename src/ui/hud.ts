/**
 * THE HUD
 *
 * Deliberately sparse. The point of this game is looking at the valley, so the
 * interface stays out of the way: a small almanac card in the top-left with
 * the day, the time and a dial showing where the sun is, and nothing else
 * unless the player needs it.
 */

import { TAU, clamp } from '../core/math.ts';
import { PALETTE } from '../art/palette.ts';
import type { TimeOfDay } from '../systems/time.ts';
import { drawText, drawTextShadowed, textWidth } from './font.ts';
import { drawPanel } from './panel.ts';

const CARD_W = 74;
const CARD_H = 32;

export class Hud {
  /** 0-1; the HUD fades in after the title card clears. */
  alpha = 0;

  draw(ctx: CanvasRenderingContext2D, clock: TimeOfDay): void {
    if (this.alpha <= 0.01) return;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * this.alpha;

    const x = 6;
    const y = 6;
    drawPanel(ctx, x, y, CARD_W, CARD_H);

    drawText(ctx, `Day ${clock.day}`, x + 7, y + 6, PALETTE.wood2);
    drawTextShadowed(ctx, clock.label, x + 7, y + 17, PALETTE.wood3, PALETTE.cream0);

    drawDial(ctx, x + CARD_W - 15, y + CARD_H / 2, clock);

    ctx.globalAlpha = prev;
  }
}

/**
 * A little sun/moon dial. It costs almost nothing and it means the player can
 * read the time of day at a glance without parsing digits.
 */
function drawDial(ctx: CanvasRenderingContext2D, cx: number, cy: number, clock: TimeOfDay): void {
  const r = 8;
  // dial face
  ctx.fillStyle = PALETTE.wood3;
  circle(ctx, cx, cy, r);
  ctx.fillStyle = clock.darkness > 0.5 ? PALETTE.stone4 : PALETTE.glass0;
  circle(ctx, cx, cy, r - 1);

  // horizon line
  ctx.fillStyle = PALETTE.wood2;
  ctx.fillRect(cx - r + 1, cy, (r - 1) * 2, 1);

  // The marker runs a full circle over 24 hours, above the line by day.
  const t = clock.hour / 24;
  const angle = (t - 0.25) * TAU;
  const mx = Math.round(cx + Math.cos(angle) * (r - 3.5));
  const my = Math.round(cy + Math.sin(angle) * (r - 3.5));
  const night = clock.darkness > 0.5;
  ctx.fillStyle = night ? PALETTE.cream0 : PALETTE.gold;
  ctx.fillRect(mx - 1, my - 1, 3, 3);
  ctx.fillStyle = night ? PALETTE.cream1 : PALETTE.orange;
  ctx.fillRect(mx - 1, my, 1, 1);
  ctx.fillRect(mx + 1, my, 1, 1);
}

function circle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
    ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}

/**
 * A brief line at the bottom of the screen: saved, inventory full, that kind of
 * thing. Deliberately small and short-lived — it should be noticed and then
 * forgotten, never dismissed.
 */
export class Toast {
  private text = '';
  private life = 0;
  private maxLife = 2.4;

  show(text: string, seconds = 2.4): void {
    this.text = text;
    this.life = seconds;
    this.maxLife = seconds;
  }

  update(dt: number): void {
    if (this.life > 0) this.life -= dt;
  }

  draw(ctx: CanvasRenderingContext2D, viewW: number, viewH: number): void {
    if (this.life <= 0) return;
    const t = this.life / this.maxLife;
    // Rises a little as it goes, which reads as it leaving rather than
    // vanishing.
    const rise = (1 - t) * 3;
    const alpha = Math.min(1, t * 3.2);
    const w = textWidth(this.text);
    const x = Math.round((viewW - w) / 2);
    const y = Math.round(viewH - 52 - rise);
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * alpha;
    drawTextShadowed(ctx, this.text, x, y, PALETTE.cream0, PALETTE.ink);
    ctx.globalAlpha = prev;
  }
}

/**
 * The opening title. Fades up over the world, holds, then clears on any key —
 * the player is looking at the actual game the whole time, which is a better
 * first impression than a separate menu screen.
 */
/**
 * TURN THE PHONE
 *
 * Moss Hollow is framed in landscape — the valley reads across, the row of
 * cottages is a row, and the camera leads horizontally. In portrait the honest
 * options are to show half the map or to ask, so it asks, in the same paper
 * and ink as everything else. It is not a modal: the game keeps running behind
 * it and the moment the phone turns it is gone.
 */
export function drawRotateHint(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  time: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = PALETTE.inkCool;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.globalAlpha = 1;

  const cx = Math.round(viewW / 2);
  const cy = Math.round(viewH / 2);
  // A phone, tipping. The tilt is the instruction; the words only confirm it.
  const tilt = Math.sin(time * 1.6) * 0.16 - 0.16;
  ctx.translate(cx, cy - 14);
  ctx.rotate(tilt);
  const w = 26;
  const h = 42;
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2);
  ctx.fillStyle = PALETTE.wood2;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = PALETTE.cream1;
  ctx.fillRect(-w / 2 + 3, -h / 2 + 5, w - 6, h - 11);
  ctx.fillStyle = PALETTE.wood3;
  ctx.fillRect(-3, h / 2 - 4, 6, 1);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const line = 'turn your phone';
  drawTextShadowed(ctx, line, cx - Math.round(textWidth(line) / 2), cy + 26, PALETTE.cream0, PALETTE.ink);
  const sub = 'the valley reads sideways';
  drawText(ctx, sub, cx - Math.round(textWidth(sub) / 2), cy + 38, PALETTE.stone2);
  ctx.restore();
}

export class TitleCard {
  t = 0;
  dismissed = false;
  private fade = 0;

  update(dt: number, anyInput: boolean): void {
    this.t += dt;
    if (!this.dismissed && anyInput && this.t > 1.2) this.dismissed = true;
    if (this.t > 9) this.dismissed = true;
    const target = this.dismissed ? 0 : clamp((this.t - 0.4) / 1.6, 0, 1);
    this.fade += (target - this.fade) * (this.dismissed ? 0.06 : 0.05);
  }

  get done(): boolean {
    return this.dismissed && this.fade < 0.02;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.fade <= 0.01) return;
    const a = this.fade;
    ctx.globalAlpha = a * 0.55;
    ctx.fillStyle = PALETTE.inkCool;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = a;

    const title = 'MOSSHOLLOW';
    // Letter-spaced by hand: the title should not look like body copy.
    const spacing = 4;
    let width = -spacing;
    for (const ch of title) width += textWidth(ch) + spacing;
    let tx = Math.round((w - width) / 2);
    const ty = Math.round(h / 2 - 16);
    for (const ch of title) {
      drawText(ctx, ch, tx, ty + 1, PALETTE.inkCool);
      drawText(ctx, ch, tx, ty, PALETTE.cream0);
      tx += textWidth(ch) + spacing;
    }

    const sub = 'the valley remembers';
    drawTextShadowed(ctx, sub, Math.round((w - textWidth(sub)) / 2), ty + 16, PALETTE.fol2, PALETTE.inkCool);

    if (this.t > 2.4) {
      const pulse = 0.55 + 0.45 * Math.sin(this.t * 2.4);
      ctx.globalAlpha = a * pulse;
      const hint = 'press any key';
      drawTextShadowed(ctx, hint, Math.round((w - textWidth(hint)) / 2), h - 40, PALETTE.cream1, PALETTE.inkCool);
    }
    ctx.globalAlpha = 1;
  }
}
