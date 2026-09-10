/**
 * THE PAUSE MENU, AND STARTING OVER
 *
 * Small, wooden, and two screens deep. The second screen exists entirely so
 * that "Start over" cannot be reached by one stray keypress: erasing a valley
 * somebody has spent evenings on is the single most destructive thing this
 * game can do, so it asks, it says plainly what will be lost, and the safe
 * option is the one already selected.
 */

import { clamp } from '../core/math.ts';
import type { Input } from '../core/input.ts';
import type { Pointer } from '../core/pointer.ts';
import { PALETTE } from '../art/palette.ts';
import { drawText, drawTextShadowed, textWidth, wrapText } from './font.ts';
import { drawPanel } from './panel.ts';

export type MenuScreen = 'root' | 'confirm';

export interface MenuHooks {
  onResume(): void;
  onStartOver(): void;
  onCursor(): void;
  /** Line shown under the title: where and when you are. */
  status(): string;
}

const PANEL = { w: 178, h: 104 };
const BTN_H = 18;

export class Menu {
  open = false;
  screen: MenuScreen = 'root';
  anim = 0;
  private cursor = 0;

  get active(): boolean {
    return this.open || this.anim > 0.01;
  }

  show(): void {
    this.open = true;
    this.screen = 'root';
    this.cursor = 0;
  }

  hide(): void {
    this.open = false;
    this.screen = 'root';
    this.cursor = 0;
  }

  private options(): string[] {
    // On the confirmation screen the harmless option is first, and therefore
    // the one the cursor starts on.
    return this.screen === 'root'
      ? ['Resume', 'Start over']
      : ['Keep the valley', 'Start over'];
  }

  update(dt: number, input: Input, pointer: Pointer, viewW: number, viewH: number, hooks: MenuHooks): void {
    const target = this.open ? 1 : 0;
    this.anim += (target - this.anim) * Math.min(1, (this.open ? 18 : 14) * dt);
    if (!this.open) return;

    const opts = this.options();
    if (input.wasPressed('up')) {
      this.cursor = clamp(this.cursor - 1, 0, opts.length - 1);
      hooks.onCursor();
    }
    if (input.wasPressed('down')) {
      this.cursor = clamp(this.cursor + 1, 0, opts.length - 1);
      hooks.onCursor();
    }

    let chosen = -1;
    for (let i = 0; i < opts.length; i++) {
      const r = buttonRect(i, viewW, viewH, this.screen);
      if (pointer.over(r.x, r.y, r.w, r.h) && pointer.hovering) this.cursor = i;
      if (pointer.clicked(r.x, r.y, r.w, r.h)) chosen = i;
    }
    if (input.wasPressed('interact')) chosen = this.cursor;

    if (chosen < 0) return;
    if (this.screen === 'root') {
      if (chosen === 0) hooks.onResume();
      else {
        this.screen = 'confirm';
        this.cursor = 0;
        hooks.onCursor();
      }
    } else if (chosen === 0) {
      this.screen = 'root';
      this.cursor = 0;
      hooks.onCursor();
    } else {
      hooks.onStartOver();
    }
  }

  draw(ctx: CanvasRenderingContext2D, viewW: number, viewH: number, pointer: Pointer, hooks: MenuHooks): void {
    if (this.anim <= 0.01) return;
    const a = this.anim;
    ctx.globalAlpha = a * 0.66;
    ctx.fillStyle = PALETTE.inkCool;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.globalAlpha = Math.min(1, a * 1.4);

    const confirm = this.screen === 'confirm';
    const h = confirm ? PANEL.h + 30 : PANEL.h;
    const x = Math.round((viewW - PANEL.w) / 2);
    const y = Math.round((viewH - h) / 2);
    drawPanel(ctx, x, y, PANEL.w, h);

    if (!confirm) {
      const title = 'Mosshollow';
      drawText(ctx, title, x + Math.round((PANEL.w - textWidth(title)) / 2), y + 12, PALETTE.wood3);
      const status = hooks.status();
      drawText(ctx, status, x + Math.round((PANEL.w - textWidth(status)) / 2), y + 24, PALETTE.wood2);
    } else {
      const title = 'Start over?';
      drawText(ctx, title, x + Math.round((PANEL.w - textWidth(title)) / 2), y + 12, PALETTE.wood3);
      // Say what is actually lost. "Are you sure?" tells nobody anything.
      const body = 'The farm, everything you have built, and everything you have read will be gone. This cannot be undone.';
      wrapText(body, PANEL.w - 24).forEach((line, i) => {
        drawText(ctx, line, x + 12, y + 26 + i * 10, PALETTE.wood2);
      });
    }

    const opts = this.options();
    for (let i = 0; i < opts.length; i++) {
      const r = buttonRect(i, viewW, viewH, this.screen);
      const focused = i === this.cursor;
      const hot = pointer.hovering && pointer.over(r.x, r.y, r.w, r.h);
      // The destructive option is the only red thing in the interface.
      const danger = (this.screen === 'root' && i === 1) || (confirm && i === 1);
      drawButton(ctx, r.x, r.y, r.w, r.h, opts[i], focused || hot, danger);
    }
    ctx.globalAlpha = 1;
  }
}

function buttonRect(i: number, viewW: number, viewH: number, screen: MenuScreen): { x: number; y: number; w: number; h: number } {
  const confirm = screen === 'confirm';
  const h = confirm ? PANEL.h + 30 : PANEL.h;
  const x = Math.round((viewW - PANEL.w) / 2);
  const y = Math.round((viewH - h) / 2);
  const top = y + h - 12 - (2 - i) * (BTN_H + 4);
  return { x: x + 14, y: top, w: PANEL.w - 28, h: BTN_H };
}

function drawButton(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, focused: boolean, danger: boolean): void {
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(x + 1, y, w - 2, 1);
  ctx.fillRect(x + 1, y + h - 1, w - 2, 1);
  ctx.fillRect(x, y + 1, 1, h - 2);
  ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
  ctx.fillStyle = focused ? PALETTE.wood1 : PALETTE.wood2;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = focused ? PALETTE.cream0 : PALETTE.cream1;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  if (focused) {
    ctx.fillStyle = danger ? PALETTE.red : PALETTE.gold;
    ctx.fillRect(x + 2, y + h - 3, w - 4, 1);
  }
  const tone = danger ? PALETTE.red : PALETTE.wood3;
  drawTextShadowed(ctx, label, x + Math.round((w - textWidth(label)) / 2), y + 5, tone, PALETTE.cream0);
}
