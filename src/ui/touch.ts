/**
 * TOUCH CONTROLS
 *
 * The last thing standing between this and a phone. Everything underneath was
 * built for it — one pointer path, every control a rectangle in game
 * coordinates, presses that cancel if you slide off — so this layer only has
 * to add the two things a finger has and a keyboard does not: somewhere to
 * push, and something to push.
 *
 * Decisions worth keeping:
 *
 *  - **The stick floats.** It appears wherever your thumb lands in the left
 *    half and recentres there. A stick painted at a fixed spot is a stick you
 *    miss, and you miss it while something is walking towards you.
 *  - **It is analog.** Push it halfway and you walk. The player's movement
 *    clamps to the unit circle rather than snapping, so this is free.
 *  - **Nothing is drawn until a finger is used.** A mouse player never sees any
 *    of it, and the moment a finger touches the glass it fades in and stays.
 *  - **Controls live in the margins.** The stick zone stops short of the
 *    hotbar and the action cluster sits clear of it, so the two things a thumb
 *    reaches for are never stacked.
 *  - **Everything is at least 22 game pixels across**, which on a phone at this
 *    scale is a comfortable target. The hotbar grows to match when touch is in
 *    use rather than asking a finger to hit a 20-pixel square.
 */

import { PALETTE } from '../art/palette.ts';
import type { Action } from '../core/input.ts';
import type { Input } from '../core/input.ts';
import type { Pointer } from '../core/pointer.ts';

const EMPTY: ReadonlySet<Action> = new Set<Action>();

/** Radius the stick's knob can travel from its origin, in game pixels. */
const STICK_R = 20;
/** Below this fraction of travel nothing moves, so a resting thumb does not drift. */
const DEAD = 0.16;

export interface TouchButton {
  action: Action;
  label: string;
  x: number;
  y: number;
  r: number;
}

export class TouchControls {
  /** Rises once a finger has been used; the whole layer rides on it. */
  alpha = 0;
  enabled = false;

  private stickId: number | null = null;
  private originX = 0;
  private originY = 0;
  private knobX = 0;
  private knobY = 0;
  /** Buttons currently held down, by pointerId, so a slide-off releases them. */
  private heldBy = new Map<number, Action>();
  private buttons: TouchButton[] = [];
  private viewW = 480;
  private viewH = 270;
  /**
   * A rectangle the stick must not claim — the hotbar. Without this the bar's
   * left-hand slots sit inside the stick zone and tapping one starts a thumb
   * drag instead of choosing a tool, which is the sort of thing that makes a
   * touch port feel broken without anybody being able to say why.
   */
  private reserved: { x: number; y: number; w: number; h: number } | null = null;

  reserve(r: { x: number; y: number; w: number; h: number } | null): void {
    this.reserved = r;
  }

  layout(viewW: number, viewH: number, inset = { top: 0, right: 0, bottom: 0, left: 0 }): void {
    this.viewW = viewW;
    this.viewH = viewH;
    // Insets arrive in CSS pixels and the layout is in logical ones, so they
    // are converted by the caller; what matters here is that nothing ends up
    // under a home indicator where a press is swallowed by the system.
    const r = inset.right;
    const b = inset.bottom;
    const t = inset.top;
    // The primary action sits under the right thumb; the two smaller ones sit
    // above and inboard of it, where a thumb rolls rather than stretches.
    this.buttons = [
      // Radii chosen so that at a typical phone scale every one of these is at
      // least the 44 CSS pixels both platform guidelines ask for. Measured at
      // 43, 38 and 41 before this and they were all fractionally too small to
      // hit without looking.
      { action: 'interact', label: 'E', x: viewW - 42 - r, y: viewH - 44 - b, r: 22 },
      { action: 'ledger', label: 'BAG', x: viewW - 84 - r, y: viewH - 34 - b, r: 17 },
      { action: 'menu', label: '||', x: viewW - 22 - r, y: 22 + t, r: 16 },
    ];
  }

  /** The stick may be started anywhere in here. Kept clear of the hotbar. */
  private inStickZone(x: number, y: number): boolean {
    if (x >= this.viewW * 0.44 || y <= this.viewH * 0.32) return false;
    const r = this.reserved;
    // Two pixels of margin, so a thumb landing on the very edge of a slot gets
    // the slot rather than half-starting a drag.
    if (r && x >= r.x - 2 && x < r.x + r.w + 2 && y >= r.y - 2 && y < r.y + r.h + 2) return false;
    return true;
  }

  private buttonAt(x: number, y: number): TouchButton | null {
    for (const b of this.buttons) {
      const dx = x - b.x;
      const dy = y - b.y;
      // A generous ring: the drawn radius plus four, because a finger's
      // contact point and where the owner thinks they touched differ.
      if (dx * dx + dy * dy <= (b.r + 4) * (b.r + 4)) return b;
    }
    return null;
  }

  update(dt: number, pointer: Pointer, input: Input): void {
    this.enabled = pointer.touchUsed;
    const target = this.enabled ? 1 : 0;
    this.alpha += (target - this.alpha) * Math.min(1, dt * 7);
    if (!this.enabled) {
      input.stickX = 0;
      input.stickY = 0;
      input.setTouchHeld(EMPTY);
      return;
    }

    // --- claim new contacts ---------------------------------------------
    for (const t of pointer.touches.values()) {
      if (!t.fresh) continue;
      const b = this.buttonAt(t.startX, t.startY);
      if (b) {
        this.heldBy.set(t.id, b.action);
        continue;
      }
      if (this.stickId === null && this.inStickZone(t.startX, t.startY)) {
        this.stickId = t.id;
        this.originX = t.startX;
        this.originY = t.startY;
        this.knobX = t.startX;
        this.knobY = t.startY;
      }
    }

    // --- drop contacts that have lifted ----------------------------------
    if (this.stickId !== null && !pointer.touches.has(this.stickId)) this.stickId = null;
    for (const id of [...this.heldBy.keys()]) {
      if (!pointer.touches.has(id)) this.heldBy.delete(id);
    }

    // --- the stick --------------------------------------------------------
    let sx = 0;
    let sy = 0;
    if (this.stickId !== null) {
      const t = pointer.touches.get(this.stickId)!;
      let dx = t.x - this.originX;
      let dy = t.y - this.originY;
      const d = Math.hypot(dx, dy);
      if (d > STICK_R) {
        // Drag the origin along rather than clamping dead: pushing further
        // should keep working, the way it does on every phone game worth
        // playing. The knob stays under the thumb.
        this.originX += dx * (1 - STICK_R / d);
        this.originY += dy * (1 - STICK_R / d);
        dx = t.x - this.originX;
        dy = t.y - this.originY;
      }
      this.knobX = this.originX + dx;
      this.knobY = this.originY + dy;
      const mag = Math.hypot(dx, dy) / STICK_R;
      if (mag > DEAD) {
        // Rescale past the dead zone so the first millimetre of real travel is
        // a slow walk rather than a jump to a third of full speed.
        const scaled = (mag - DEAD) / (1 - DEAD);
        const inv = 1 / Math.max(0.0001, Math.hypot(dx, dy));
        sx = dx * inv * scaled;
        sy = dy * inv * scaled;
      }
    }
    input.stickX = sx;
    input.stickY = sy;

    input.setTouchHeld(new Set(this.heldBy.values()));
  }

  /** True if this point is on a control, so the world does not also get the tap. */
  consumes(x: number, y: number): boolean {
    if (!this.enabled) return false;
    return this.buttonAt(x, y) !== null || this.inStickZone(x, y);
  }

  /**
   * Faded back while the dialogue box is up. The box occupies the bottom strip
   * the action cluster also lives in, and a solid button sitting on a line of
   * text is the sort of overlap that makes an interface feel unfinished. The
   * buttons stay live — you still need E to turn the page — they just stop
   * competing with the words.
   */
  dim = 1;

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.alpha <= 0.02) return;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * this.alpha * this.dim;

    if (this.stickId !== null) {
      ring(ctx, this.originX, this.originY, STICK_R, PALETTE.cream0, 0.34);
      disc(ctx, this.knobX, this.knobY, 9, PALETTE.cream0, 0.62);
      ring(ctx, this.knobX, this.knobY, 9, PALETTE.ink, 0.5);
    } else {
      // A resting hint, low enough that it is not part of the picture.
      ring(ctx, this.viewW * 0.16, this.viewH * 0.74, STICK_R, PALETTE.cream0, 0.12);
    }

    for (const b of this.buttons) {
      const held = [...this.heldBy.values()].includes(b.action);
      disc(ctx, b.x, b.y, b.r, held ? PALETTE.cream0 : PALETTE.ink, held ? 0.5 : 0.34);
      ring(ctx, b.x, b.y, b.r, PALETTE.cream0, held ? 0.9 : 0.44);
      label(ctx, b.label, b.x, b.y, held ? PALETTE.ink : PALETTE.cream0, held ? 0.95 : 0.6);
    }
    ctx.globalAlpha = prev;
  }
}

// --- drawing helpers. Circles, on a pixel grid, without antialiasing. -------

function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, a: number): void {
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * a;
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
  ctx.globalAlpha = prev;
}

function ring(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, a: number): void {
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * a;
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const w = Math.sqrt(Math.max(0, r * r - y * y));
    const inner = Math.sqrt(Math.max(0, (r - 1.4) * (r - 1.4) - y * y));
    const x0 = Math.round(cx - w);
    const x1 = Math.round(cx + w);
    if (inner <= 0.5) {
      ctx.fillRect(x0, Math.round(cy + y), x1 - x0 + 1, 1);
    } else {
      const i0 = Math.round(cx - inner);
      const i1 = Math.round(cx + inner);
      ctx.fillRect(x0, Math.round(cy + y), i0 - x0, 1);
      ctx.fillRect(i1, Math.round(cy + y), x1 - i1 + 1, 1);
    }
  }
  ctx.globalAlpha = prev;
}

/** Tiny centred caption. The font is 5px tall, so this is hand-placed. */
function label(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, color: string, a: number): void {
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * a;
  ctx.fillStyle = color;
  const w = text.length * 4 - 1;
  drawTiny(ctx, text, Math.round(cx - w / 2), Math.round(cy - 2));
  ctx.globalAlpha = prev;
}

/** A 3x5 glyph set, only the characters these buttons use. */
const TINY: Record<string, string[]> = {
  E: ['111', '100', '110', '100', '111'],
  B: ['110', '101', '110', '101', '110'],
  A: ['010', '101', '111', '101', '101'],
  G: ['011', '100', '101', '101', '011'],
  '|': ['010', '010', '010', '010', '010'],
};

function drawTiny(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  for (let i = 0; i < text.length; i++) {
    const g = TINY[text[i]];
    if (!g) continue;
    for (let row = 0; row < g.length; row++) {
      for (let col = 0; col < 3; col++) {
        if (g[row][col] === '1') ctx.fillRect(x + i * 4 + col, y + row, 1, 1);
      }
    }
  }
}
