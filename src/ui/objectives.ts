/**
 * THE OBJECTIVE CARD
 *
 * A small slip of paper pinned in the corner, in the same aged stock and thin
 * wood as the almanac, the dialogue box and the satchel. It is drawn with the
 * game's own panel and its own font — there is no second interface language
 * here, and there should never be one.
 *
 * The warmth the brief asks for comes from the palette the valley already
 * owns: `cream0` paper, `wood3` ink, `gold` for the one accent. Gold is used
 * sparingly on purpose — it is the colour this game reserves for a thing that
 * has just happened, and if the card glows all the time it stops meaning
 * anything.
 *
 * It anchors to the top right of the *live* viewport rather than to a fixed
 * pixel position, and it steps out of the way of the touch pause button when
 * there is one.
 */

import { PALETTE } from '../art/palette.ts';
import { clamp } from '../core/math.ts';
import type { Pointer } from '../core/pointer.ts';
import type { ObjectiveRow } from '../systems/objectives.ts';
import { drawText, textWidth, wrapText } from './font.ts';
import { drawPanel } from './panel.ts';

const PAD = 7;
const LINE = 9;
const TITLE_H = 12;
const MARGIN = 6;
/** Wide enough for a sentence at this font, narrow enough to stay a HUD element. */
const WIDTH = 132;
/** Space between the mark and its line. Eight had them touching. */
const GUTTER = 10;
const COLLAPSED_H = TITLE_H + PAD + 2;

export class ObjectiveCard {
  /** Follows the rest of the HUD, so a screen opening hides it with the hotbar. */
  alpha = 0;
  collapsed = false;
  /** Rises when the contents change, for a brief settle rather than a snap. */
  private shift = 0;
  private lastSignature = '';
  private rect = { x: 0, y: 0, w: 0, h: 0 };

  /** Was the card tapped or clicked this frame? Toggles collapse. */
  hitTest(pointer: Pointer): boolean {
    const r = this.rect;
    if (r.w <= 0 || this.alpha < 0.5) return false;
    return pointer.clicked(r.x, r.y, r.w, r.h);
  }

  update(dt: number, rows: ObjectiveRow[]): void {
    const sig = rows.map((r) => `${r.def.id}${r.complete ? '+' : ''}`).join('|');
    if (sig !== this.lastSignature) {
      this.lastSignature = sig;
      this.shift = 1;
    }
    this.shift = Math.max(0, this.shift - dt * 3.4);
  }

  draw(
    ctx: CanvasRenderingContext2D,
    rows: ObjectiveRow[],
    viewW: number,
    time: number,
    insetTop: number,
  ): void {
    if (this.alpha <= 0.02 || rows.length === 0) {
      this.rect = { x: 0, y: 0, w: 0, h: 0 };
      return;
    }

    // Lay the text out first: the card is sized to its contents, never padded
    // to a round number.
    const innerW = WIDTH - PAD * 2 - GUTTER;
    const wrapped = rows.map((r) => wrapText(r.def.text, innerW));
    const lineCount = wrapped.reduce((n, w) => n + w.length, 0);
    const bodyH = lineCount * LINE + (rows.length - 1) * 2;
    const h = this.collapsed ? COLLAPSED_H : TITLE_H + bodyH + PAD + 2;
    const x = Math.round(viewW - WIDTH - MARGIN);
    const y = Math.round(MARGIN + insetTop);
    this.rect = { x, y, w: WIDTH, h };

    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * this.alpha;

    drawPanel(ctx, x, y, WIDTH, h, { tone: 'paper' });

    // --- header ----------------------------------------------------------
    const title = 'OBJECTIVES';
    drawText(ctx, title, x + PAD, y + 4, PALETTE.wood2);
    // A hairline under the header, the same rule the satchel uses over its
    // footer, so the card reads as the same stationery.
    ctx.fillStyle = PALETTE.wood1;
    ctx.globalAlpha = prev * this.alpha * 0.5;
    ctx.fillRect(x + PAD, y + TITLE_H - 2, WIDTH - PAD * 2, 1);
    ctx.globalAlpha = prev * this.alpha;

    // The collapse affordance: a small chevron, pointing the way it will go.
    const cx = x + WIDTH - PAD - 4;
    const cy = y + 6;
    ctx.fillStyle = PALETTE.wood2;
    for (let i = 0; i < 3; i++) {
      const dy = this.collapsed ? 2 - i : i;
      ctx.fillRect(cx - 2 + i, cy + dy, 1, 1);
      ctx.fillRect(cx + 2 - i, cy + dy, 1, 1);
    }

    if (this.collapsed) {
      ctx.globalAlpha = prev;
      return;
    }

    // --- rows --------------------------------------------------------------
    let ly = y + TITLE_H + 1 + Math.round(this.shift * 2);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lines = wrapped[i];
      const rowH = lines.length * LINE;

      // A finished line is briefly warm, then settles to plain paper. The glow
      // is the whole completion animation — no popup, no particles.
      if (row.complete) {
        const glow = clamp(1 - row.age * 2.4, 0, 1);
        if (glow > 0.01) {
          ctx.globalAlpha = prev * this.alpha * glow * 0.34;
          ctx.fillStyle = PALETTE.gold;
          ctx.fillRect(x + 3, ly - 1, WIDTH - 6, rowH + 1);
          ctx.globalAlpha = prev * this.alpha;
        }
      }

      // The mark: a hollow ring while it is open, a tick once it is not.
      const mx = x + PAD;
      const my = ly + 1;
      if (row.complete) {
        drawTick(ctx, mx, my, PALETTE.wood1);
      } else {
        drawRing(ctx, mx, my, PALETTE.wood2);
      }

      const tint = row.complete ? PALETTE.stone3 : PALETTE.wood3;
      for (let l = 0; l < lines.length; l++) {
        drawText(ctx, lines[l], mx + GUTTER, ly + l * LINE, tint);
      }
      // Struck through, faintly, so a finished line reads as finished even
      // with the colour taken away.
      if (row.complete) {
        ctx.globalAlpha = prev * this.alpha * 0.45;
        ctx.fillStyle = PALETTE.stone3;
        const last = lines[lines.length - 1];
        ctx.fillRect(mx + GUTTER, ly + (lines.length - 1) * LINE + 3, textWidth(last), 1);
        ctx.globalAlpha = prev * this.alpha;
      }
      ly += rowH + 2;
    }

    void time;
    ctx.globalAlpha = prev;
  }
}

/** An open objective: a small hollow circle. */
function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y, 3, 1);
  ctx.fillRect(x + 1, y + 4, 3, 1);
  ctx.fillRect(x, y + 1, 1, 3);
  ctx.fillRect(x + 4, y + 1, 1, 3);
}

/** A done one: a tick, hand-shaped rather than a font glyph. */
function drawTick(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y + 2, 1, 1);
  ctx.fillRect(x + 1, y + 3, 1, 1);
  ctx.fillRect(x + 2, y + 4, 1, 1);
  ctx.fillRect(x + 3, y + 2, 1, 1);
  ctx.fillRect(x + 4, y + 1, 1, 1);
  ctx.fillRect(x + 5, y, 1, 1);
}
