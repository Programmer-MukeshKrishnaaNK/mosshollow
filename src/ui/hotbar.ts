/**
 * THE HOTBAR
 *
 * Six slots, drawn as pixel art in the same wood-and-paper language as the
 * almanac card. The selected slot lifts two pixels and brightens — position is
 * a stronger signal than a border, and it reads instantly at this size.
 *
 * The selected item's name and its one line of flavour appear above the bar
 * and fade out after a few seconds, so the interface tells you what you are
 * holding without permanently occupying the screen.
 */

import { clamp } from '../core/math.ts';
import { PALETTE } from '../art/palette.ts';
import { item } from '../data/items.ts';
import { HOTBAR_SIZE, type Inventory } from '../systems/inventory.ts';
import { drawText, drawTextShadowed, textWidth } from './font.ts';

const SLOT = 20;
const GAP = 2;
/**
 * A finger needs more than twenty pixels. On touch the bar grows and the gaps
 * grow with it, which costs width the layout has to spare and buys a target a
 * thumb can actually hit without looking.
 */
const TOUCH_SLOT = 26;
const TOUCH_GAP = 3;

export class Hotbar {
  alpha = 0;
  /** Set by the game each frame. Grows the slots for a finger. */
  touch = false;
  /** Where each slot ended up last frame, so a tap can be hit-tested. */
  private rects: { x: number; y: number; w: number; h: number }[] = [];
  /** Counts down after a selection change; the label rides on it. */
  private labelTime = 0;
  private lastSelected = -1;

  /** The whole bar's footprint, so the touch layer can keep its hands off it. */
  bounds(): { x: number; y: number; w: number; h: number } | null {
    if (!this.rects.length) return null;
    const first = this.rects[0];
    const last = this.rects[this.rects.length - 1];
    return { x: first.x, y: first.y, w: last.x + last.w - first.x, h: first.h };
  }

  /** Which slot a point falls in, or -1. Used for tap-to-select on touch. */
  slotAt(x: number, y: number): number {
    for (let i = 0; i < this.rects.length; i++) {
      const r = this.rects[i];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
    }
    return -1;
  }

  update(dt: number, inv: Inventory): void {
    if (inv.selected !== this.lastSelected) {
      this.lastSelected = inv.selected;
      this.labelTime = 3.2;
    }
    if (this.labelTime > 0) this.labelTime -= dt;
  }

  draw(ctx: CanvasRenderingContext2D, inv: Inventory, viewW: number, viewH: number, time: number): void {
    if (this.alpha <= 0.01) return;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * this.alpha;

    const slotW = this.touch ? TOUCH_SLOT : SLOT;
    const gap = this.touch ? TOUCH_GAP : GAP;
    const totalW = HOTBAR_SIZE * slotW + (HOTBAR_SIZE - 1) * gap;
    const x0 = Math.round((viewW - totalW) / 2);
    const y0 = viewH - slotW - (this.touch ? 6 : 8);
    this.rects.length = 0;

    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = inv.slots[i];
      const selected = i === inv.selected;
      const x = x0 + i * (slotW + gap);
      const y = selected ? y0 - 2 : y0;
      this.rects.push({ x, y: y0 - 2, w: slotW, h: slotW + 4 });

      // A slot that just received something pulses briefly.
      const fresh = inv.lastChanged === i ? clamp(1 - (time - inv.lastChangedAt) / 0.45, 0, 1) : 0;

      drawSlot(ctx, x, y, selected, fresh, slotW);

      if (slot.id) {
        const def = item(slot.id);
        const icon = def.icon;
        ctx.drawImage(
          icon.canvas,
          x + Math.round((slotW - icon.w) / 2),
          y + Math.round((slotW - icon.h) / 2) + 1,
        );
        if (slot.count > 1) {
          const label = String(slot.count);
          drawTextShadowed(ctx, label, x + slotW - textWidth(label) - 2, y + slotW - 9, PALETTE.wood3, PALETTE.cream0);
        }
      }

      // Slot number, small and dim — a reminder, not a label.
      if (!slot.id) {
        drawText(ctx, String(i + 1), x + 3, y + 3, PALETTE.cream1);
      }
    }

    // --- the name of what you are holding --------------------------------
    const def = inv.selectedItem;
    if (def && this.labelTime > 0) {
      const fade = clamp(this.labelTime / 0.6, 0, 1);
      ctx.globalAlpha = prev * this.alpha * fade;
      const nameW = textWidth(def.name);
      drawTextShadowed(ctx, def.name, Math.round((viewW - nameW) / 2), y0 - 15, PALETTE.cream0, PALETTE.ink);
      const blurbW = textWidth(def.blurb);
      ctx.globalAlpha = prev * this.alpha * fade * 0.72;
      drawTextShadowed(ctx, def.blurb, Math.round((viewW - blurbW) / 2), y0 - 26, PALETTE.cream1, PALETTE.ink);
    }

    ctx.globalAlpha = prev;
  }
}

function drawSlot(ctx: CanvasRenderingContext2D, x: number, y: number, selected: boolean, fresh: number, SLOT: number): void {
  const rect = (rx: number, ry: number, rw: number, rh: number, c: string): void => {
    ctx.fillStyle = c;
    ctx.fillRect(rx, ry, rw, rh);
  };
  // contour with the corners knocked off, same as the panels
  rect(x + 1, y, SLOT - 2, 1, PALETTE.ink);
  rect(x + 1, y + SLOT - 1, SLOT - 2, 1, PALETTE.ink);
  rect(x, y + 1, 1, SLOT - 2, PALETTE.ink);
  rect(x + SLOT - 1, y + 1, 1, SLOT - 2, PALETTE.ink);

  rect(x + 1, y + 1, SLOT - 2, SLOT - 2, selected ? PALETTE.wood1 : PALETTE.wood2);
  rect(x + 1, y + 1, SLOT - 2, 1, selected ? PALETTE.wood0 : PALETTE.wood1);
  rect(x + 1, y + SLOT - 2, SLOT - 2, 1, PALETTE.wood3);

  // Both states get a light well. A dark one looked tidier and made every
  // wooden-handled tool invisible against it.
  const well = selected ? PALETTE.cream0 : PALETTE.cream1;
  rect(x + 2, y + 2, SLOT - 4, SLOT - 4, well);
  rect(x + 2, y + 2, SLOT - 4, 1, selected ? PALETTE.white : PALETTE.cream0);
  rect(x + 2, y + SLOT - 3, SLOT - 4, 1, selected ? PALETTE.cream1 : PALETTE.wood1);
  // The selected slot is underlined in gold as well as lifted.
  if (selected) rect(x + 3, y + SLOT, SLOT - 6, 1, PALETTE.gold);

  if (fresh > 0) {
    ctx.globalAlpha *= 1;
    const prevA = ctx.globalAlpha;
    ctx.globalAlpha = prevA * fresh * 0.8;
    rect(x + 2, y + 2, SLOT - 4, SLOT - 4, PALETTE.gold);
    ctx.globalAlpha = prevA;
  }
}
