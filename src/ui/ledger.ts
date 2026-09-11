/**
 * THE LEDGER
 *
 * One screen with three tabs — what you are carrying, what you can make, and
 * what you can build. Three separate screens would have been easier and would
 * have felt like three separate menus bolted onto the same game.
 *
 * It is drawn as the same object the almanac and the dialogue box are made of:
 * aged paper in a thin wooden frame, with index tabs down the top edge. There
 * is no chrome in this game that is not made of wood or paper.
 *
 * Input is pointer-first and keyboard-complete. Every control is a rectangle in
 * game coordinates that can be clicked, tapped, or reached with the arrow keys,
 * because the game has to stay playable on a keyboard today and has to be
 * touchable on a phone later without any of this being rewritten.
 */

import { clamp } from '../core/math.ts';
import type { Input } from '../core/input.ts';
import type { Pointer } from '../core/pointer.ts';
import { PALETTE } from '../art/palette.ts';
import { ITEMS, item, type ItemDef } from '../data/items.ts';
import { RECIPES, type RecipeDef } from '../data/recipes.ts';
import type { ProjectDef } from '../data/projects.ts';
import { timesAffordable } from '../systems/crafting.ts';
import { HOTBAR_SIZE, type Inventory } from '../systems/inventory.ts';
import type { Projects, ProjectState } from '../systems/projects.ts';
import { LINE_HEIGHT, drawText, drawTextShadowed, textWidth, wrapText } from './font.ts';
import { drawPanel } from './panel.ts';

export type LedgerTab = 'items' | 'craft' | 'build';

const TABS: { id: LedgerTab; label: string }[] = [
  { id: 'items', label: 'Satchel' },
  { id: 'craft', label: 'Workbench' },
  { id: 'build', label: 'Projects' },
];

// --- layout, all in game pixels --------------------------------------------
const PANEL = { x: 34, y: 22, w: 412, h: 224 };
const TAB_H = 14;
const BODY = { x: PANEL.x + 10, y: PANEL.y + TAB_H + 8, w: PANEL.w - 20, h: 132 };
const FOOT_Y = PANEL.y + PANEL.h - 56;
const SLOT = 26;
const GAP = 3;
const COLS = 8;
const ROWS = 4;
const GRID_W = COLS * SLOT + (COLS - 1) * GAP;
const GRID_X = PANEL.x + Math.round((PANEL.w - GRID_W) / 2);
const GRID_Y = BODY.y + 12;
// Six rows of 22 fill the body exactly. Five of 26 left the sixth project
// reachable by keyboard and invisible to a pointer, which is the worst of
// both.
const ROW_H = 22;
const LIST_ROWS = 6;

export interface LedgerHooks {
  inventory: Inventory;
  projects: Projects;
  /** Which projects can be started here, already filtered. */
  visibleProjects: ProjectDef[];
  onCraft(r: RecipeDef): void;
  onBuild(p: ProjectDef): void;
  onMoved(): void;
  onCursor(): void;
  onClose(): void;
}

interface Held {
  id: string;
  count: number;
  from: number;
}

export class Ledger {
  open = false;
  tab: LedgerTab = 'items';
  /** 0 closed, 1 open. Drives the grow-in. */
  anim = 0;
  /** Keyboard cursor position within the current tab. */
  private cursor = 0;
  private scroll = 0;
  private held: Held | null = null;
  /** Row that just flashed, for craft/build feedback. */
  private flash = -1;
  private flashT = 0;

  get active(): boolean {
    return this.open || this.anim > 0.01;
  }

  get carrying(): Held | null {
    return this.held;
  }

  show(tab: LedgerTab = 'items'): void {
    this.open = true;
    this.tab = tab;
    this.cursor = 0;
    this.scroll = 0;
  }

  hide(inv: Inventory): void {
    // Anything in hand goes back where it came from rather than vanishing.
    this.returnHeld(inv);
    this.open = false;
  }

  private returnHeld(inv: Inventory): void {
    if (!this.held) return;
    const slot = inv.slots[this.held.from];
    if (slot && slot.id === null) {
      slot.id = this.held.id;
      slot.count = this.held.count;
    } else {
      inv.add(this.held.id, this.held.count);
    }
    this.held = null;
  }

  update(dt: number, input: Input, pointer: Pointer, hooks: LedgerHooks): void {
    const target = this.open ? 1 : 0;
    this.anim += (target - this.anim) * Math.min(1, (this.open ? 16 : 12) * dt);
    if (this.flashT > 0) this.flashT -= dt;
    if (!this.open) return;

    // A tap on the world outside the panel closes it. On a phone there is no
    // Escape key, and the alternative is hunting for a close button that would
    // have to sit somewhere in this layout and earn its space.
    if (
      pointer.kind === 'touch' &&
      pointer.released &&
      !pointer.over(PANEL.x, PANEL.y - TAB_H, PANEL.w, PANEL.h + TAB_H) &&
      !this.held
    ) {
      hooks.onClose();
      return;
    }

    // --- tabs ---------------------------------------------------------------
    for (let i = 0; i < TABS.length; i++) {
      const r = tabRect(i);
      if (pointer.clicked(r.x, r.y, r.w, r.h)) {
        this.setTab(TABS[i].id, hooks);
      }
    }
    if (input.wasPressed('tabNext')) {
      const i = TABS.findIndex((t) => t.id === this.tab);
      this.setTab(TABS[(i + 1) % TABS.length].id, hooks);
    }

    if (this.tab === 'items') this.updateItems(input, pointer, hooks);
    else this.updateList(input, pointer, hooks);

    if (pointer.wheel !== 0) {
      this.scroll = clamp(this.scroll + pointer.wheel, 0, Math.max(0, this.rowCount(hooks) - LIST_ROWS));
    }
  }

  private setTab(tab: LedgerTab, hooks: LedgerHooks): void {
    if (this.tab === tab) return;
    this.returnHeld(hooks.inventory);
    this.tab = tab;
    this.cursor = 0;
    this.scroll = 0;
    hooks.onCursor();
  }

  private rowCount(hooks: LedgerHooks): number {
    return this.tab === 'craft' ? RECIPES.length : hooks.visibleProjects.length;
  }

  // --- the satchel ----------------------------------------------------------

  private updateItems(input: Input, pointer: Pointer, hooks: LedgerHooks): void {
    const inv = hooks.inventory;
    const total = COLS * ROWS;

    // keyboard cursor
    const dx = input.axisX();
    const dy = input.axisY();
    if (input.wasPressed('left') || input.wasPressed('right') || input.wasPressed('up') || input.wasPressed('down')) {
      const nx = (this.cursor % COLS) + (input.wasPressed('left') ? -1 : input.wasPressed('right') ? 1 : 0);
      const ny = Math.floor(this.cursor / COLS) + (input.wasPressed('up') ? -1 : input.wasPressed('down') ? 1 : 0);
      this.cursor = clamp(ny, 0, ROWS - 1) * COLS + clamp(nx, 0, COLS - 1);
      hooks.onCursor();
    }
    void dx;
    void dy;

    let acted = -1;
    for (let i = 0; i < total; i++) {
      const r = slotRect(i);
      if (pointer.over(r.x, r.y, r.w, r.h) && pointer.hovering) this.cursor = i;
      if (pointer.clicked(r.x, r.y, r.w, r.h)) acted = i;
    }
    if (input.wasPressed('interact')) acted = this.cursor;

    if (acted >= 0 && acted < inv.slots.length) this.takeOrPlace(acted, inv, hooks);
  }

  /** Click a slot: pick the stack up, or put down what you are holding. */
  private takeOrPlace(index: number, inv: Inventory, hooks: LedgerHooks): void {
    const slot = inv.slots[index];
    if (!this.held) {
      if (!slot.id) return;
      this.held = { id: slot.id, count: slot.count, from: index };
      slot.id = null;
      slot.count = 0;
      hooks.onMoved();
      return;
    }
    if (slot.id === this.held.id) {
      // Same item: merge up to the stack limit and keep the overflow in hand.
      const max = ITEMS[slot.id]?.stack ?? 99;
      const room = Math.max(0, max - slot.count);
      const move = Math.min(room, this.held.count);
      slot.count += move;
      this.held.count -= move;
      if (this.held.count <= 0) this.held = null;
      hooks.onMoved();
      return;
    }
    // Different item, or an empty slot: straight swap.
    const swapId = slot.id;
    const swapCount = slot.count;
    slot.id = this.held.id;
    slot.count = this.held.count;
    if (swapId) this.held = { id: swapId, count: swapCount, from: index };
    else this.held = null;
    hooks.onMoved();
  }

  // --- workbench and projects ----------------------------------------------

  private updateList(input: Input, pointer: Pointer, hooks: LedgerHooks): void {
    const rows = this.rowCount(hooks);
    if (input.wasPressed('up')) {
      this.cursor = clamp(this.cursor - 1, 0, Math.max(0, rows - 1));
      hooks.onCursor();
    }
    if (input.wasPressed('down')) {
      this.cursor = clamp(this.cursor + 1, 0, Math.max(0, rows - 1));
      hooks.onCursor();
    }
    this.scroll = clamp(this.scroll, Math.max(0, this.cursor - LIST_ROWS + 1), Math.max(0, Math.min(this.cursor, rows - LIST_ROWS)));
    if (rows <= LIST_ROWS) this.scroll = 0;

    let acted = -1;
    for (let v = 0; v < Math.min(LIST_ROWS, rows); v++) {
      const i = v + this.scroll;
      const r = rowRect(v);
      if (pointer.over(r.x, r.y, r.w, r.h) && pointer.hovering) this.cursor = i;
      if (pointer.clicked(r.x, r.y, r.w, r.h)) acted = i;
    }
    if (input.wasPressed('interact')) acted = this.cursor;
    if (acted < 0) return;

    if (this.tab === 'craft') {
      const r = RECIPES[acted];
      if (r) {
        hooks.onCraft(r);
        this.flash = acted;
        this.flashT = 0.32;
      }
    } else {
      const p = hooks.visibleProjects[acted];
      if (p) {
        hooks.onBuild(p);
        this.flash = acted;
        this.flashT = 0.32;
      }
    }
  }

  // --- drawing --------------------------------------------------------------

  draw(ctx: CanvasRenderingContext2D, viewW: number, viewH: number, hooks: LedgerHooks, pointer: Pointer, time: number): void {
    if (this.anim <= 0.01) return;
    const a = this.anim;
    const ease = 1 - (1 - a) * (1 - a);

    // The world dims behind it rather than disappearing: you should still see
    // where you were standing.
    ctx.globalAlpha = a * 0.62;
    ctx.fillStyle = PALETTE.inkCool;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.globalAlpha = 1;

    if (ease < 0.55) return;
    ctx.globalAlpha = Math.min(1, (ease - 0.4) / 0.4);

    drawPanel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    this.drawTabs(ctx, pointer);

    if (this.tab === 'items') this.drawItems(ctx, hooks, pointer, time);
    else if (this.tab === 'craft') this.drawCraft(ctx, hooks);
    else this.drawBuild(ctx, hooks);

    // A held stack rides the pointer, or sits by the cursor on a keyboard.
    if (this.held) {
      const def = item(this.held.id);
      const hx = pointer.hovering ? pointer.x : slotRect(this.cursor).x + SLOT / 2;
      const hy = pointer.hovering ? pointer.y : slotRect(this.cursor).y + SLOT / 2;
      ctx.drawImage(def.icon.canvas, Math.round(hx - def.icon.w / 2), Math.round(hy - def.icon.h / 2));
      if (this.held.count > 1) {
        const label = String(this.held.count);
        drawTextShadowed(ctx, label, Math.round(hx + 4), Math.round(hy + 2), PALETTE.cream0, PALETTE.ink);
      }
    }

    // The hint has to describe the device in the player's hand. A phone has
    // no Tab and no Escape, and telling somebody to press a key they do not
    // have is worse than saying nothing.
    const hint = pointer.kind === 'touch'
      ? 'tap a tab to switch  ·  tap outside to close'
      : pointer.everUsed
        ? 'Tab / Esc to close'
        : 'Tab to switch  ·  Esc to close';
    drawText(ctx, hint, PANEL.x + 10, PANEL.y + PANEL.h - 12, PALETTE.wood2);
    ctx.globalAlpha = 1;
  }

  private drawTabs(ctx: CanvasRenderingContext2D, pointer: Pointer): void {
    for (let i = 0; i < TABS.length; i++) {
      const t = TABS[i];
      const r = tabRect(i);
      const on = t.id === this.tab;
      const hot = pointer.hovering && pointer.over(r.x, r.y, r.w, r.h);
      // The active tab sits a pixel proud of the panel edge and is paler, the
      // way a card pulled forward in a real index would be.
      const y = on ? r.y - 1 : r.y + 1;
      const h = on ? r.h + 2 : r.h;
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(r.x, y, r.w, h);
      ctx.fillStyle = on ? PALETTE.wood1 : hot ? PALETTE.wood2 : PALETTE.wood3;
      ctx.fillRect(r.x + 1, y + 1, r.w - 2, h - 2);
      ctx.fillStyle = on ? PALETTE.cream0 : PALETTE.cream1;
      ctx.fillRect(r.x + 2, y + 2, r.w - 4, h - 4);
      const label = t.label;
      drawText(ctx, label, r.x + Math.round((r.w - textWidth(label)) / 2), y + 4, on ? PALETTE.wood3 : PALETTE.wood2);
    }
  }

  private drawItems(ctx: CanvasRenderingContext2D, hooks: LedgerHooks, pointer: Pointer, time: number): void {
    const inv = hooks.inventory;
    for (let i = 0; i < COLS * ROWS; i++) {
      const r = slotRect(i);
      const slot = inv.slots[i];
      const isHotbar = i < HOTBAR_SIZE;
      const focused = i === this.cursor && (pointer.hovering || !pointer.everUsed);
      drawItemSlot(ctx, r.x, r.y, isHotbar, focused);
      if (slot?.id) {
        const def = item(slot.id);
        ctx.drawImage(def.icon.canvas, r.x + Math.round((SLOT - def.icon.w) / 2), r.y + Math.round((SLOT - def.icon.h) / 2));
        if (slot.count > 1) {
          const label = String(slot.count);
          drawTextShadowed(ctx, label, r.x + SLOT - textWidth(label) - 3, r.y + SLOT - 10, PALETTE.wood3, PALETTE.cream0);
        }
      }
    }

    // The hotbar row is labelled, because it is the one that matters outside.
    // Set above the grid rather than beside it: at eight columns there is no
    // margin left to put it in.
    drawText(ctx, 'quick slots  1-8', GRID_X, GRID_Y - 9, PALETTE.wood2);

    const slot = inv.slots[this.cursor];
    const def: ItemDef | null = slot?.id ? item(slot.id) : null;
    this.drawFooter(ctx, def ? def.name : 'Empty', def ? def.blurb : 'Nothing in this pocket.', def ? `${slot.count}` : '');
    void time;
  }

  private drawCraft(ctx: CanvasRenderingContext2D, hooks: LedgerHooks): void {
    const inv = hooks.inventory;
    const visible = Math.min(LIST_ROWS, RECIPES.length);
    for (let v = 0; v < visible; v++) {
      const i = v + this.scroll;
      const r = RECIPES[i];
      if (!r) continue;
      const can = timesAffordable(inv, r.in) > 0 && inv.canFit(r.out.item, r.out.count);
      this.drawRow(ctx, v, i, item(r.out.item).name, can ? 'ready' : 'short', () => {
        // Ingredients as icons and counts, which is far quicker to read than
        // a sentence and does not need translating.
        let x = BODY.x + 148;
        for (const n of r.in) {
          const d = item(n.item);
          const have = inv.count(n.item);
          ctx.drawImage(d.icon.canvas, x, rowRect(v).y + 3);
          const label = `${have}/${n.count}`;
          drawText(ctx, label, x + 15, rowRect(v).y + 7, have >= n.count ? PALETTE.wood2 : PALETTE.red);
          x += 15 + textWidth(label) + 8;
        }
        // and what you get
        const out = item(r.out.item);
        const rx = BODY.x + BODY.w - 40;
        drawText(ctx, `x${r.out.count}`, rx + 16, rowRect(v).y + 7, PALETTE.wood2);
        ctx.drawImage(out.icon.canvas, rx, rowRect(v).y + 3);
      });
    }
    drawScrollHint(ctx, this.scroll, RECIPES.length);
    const sel = RECIPES[this.cursor];
    if (sel) {
      const can = timesAffordable(inv, sel.in) > 0;
      this.drawFooter(
        ctx,
        item(sel.out.item).name,
        sel.blurb,
        can ? 'ready' : 'not enough',
        can ? PALETTE.fol4 : PALETTE.red,
      );
    }
  }

  private drawBuild(ctx: CanvasRenderingContext2D, hooks: LedgerHooks): void {
    const list = hooks.visibleProjects;
    if (!list.length) {
      drawText(ctx, 'Nothing to build yet. Bring wood and stone.', BODY.x, BODY.y + 20, PALETTE.wood2);
      return;
    }
    const visible = Math.min(LIST_ROWS, list.length);
    for (let v = 0; v < visible; v++) {
      const i = v + this.scroll;
      const p = list[i];
      if (!p) continue;
      const state = hooks.projects.state(p, hooks.inventory);
      this.drawRow(ctx, v, i, p.name, state, () => {
        if (state === 'done') {
          drawText(ctx, 'done', BODY.x + BODY.w - 34, rowRect(v).y + 7, PALETTE.fol4);
          return;
        }
        if (state === 'locked') {
          drawText(ctx, 'locked', BODY.x + BODY.w - 42, rowRect(v).y + 7, PALETTE.stone3);
          return;
        }
        let x = BODY.x + 176;
        for (const c of p.cost) {
          const d = item(c.item);
          const have = hooks.inventory.count(c.item);
          ctx.drawImage(d.icon.canvas, x, rowRect(v).y + 3);
          const label = `${have}/${c.count}`;
          drawText(ctx, label, x + 15, rowRect(v).y + 7, have >= c.count ? PALETTE.wood2 : PALETTE.red);
          x += 15 + textWidth(label) + 8;
        }
      });
    }
    drawScrollHint(ctx, this.scroll, list.length);
    const sel = list[this.cursor];
    if (sel) {
      const state = hooks.projects.state(sel, hooks.inventory);
      const note =
        state === 'done' ? 'finished' :
        state === 'locked' ? 'finish the one before it' :
        state === 'ready' ? 'ready to build' : 'not enough';
      const tone =
        state === 'done' ? PALETTE.fol4 :
        state === 'ready' ? PALETTE.fol4 : state === 'locked' ? PALETTE.stone3 : PALETTE.red;
      this.drawFooter(ctx, sel.name, state === 'done' ? sel.done : sel.blurb, note, tone);
    }
  }

  /** One row of a list, with its own highlight and completion flash. */
  private drawRow(
    ctx: CanvasRenderingContext2D,
    v: number,
    index: number,
    title: string,
    state: ProjectState | 'ready' | 'short',
    body: () => void,
  ): void {
    const r = rowRect(v);
    const focused = index === this.cursor;
    ctx.fillStyle = focused ? PALETTE.cream0 : PALETTE.cream1;
    ctx.fillRect(r.x, r.y, r.w, r.h - 2);
    if (focused) {
      ctx.fillStyle = PALETTE.wood1;
      ctx.fillRect(r.x, r.y, 2, r.h - 2);
    }
    ctx.fillStyle = PALETTE.wood2;
    ctx.fillRect(r.x, r.y + r.h - 2, r.w, 1);

    if (this.flash === index && this.flashT > 0) {
      ctx.globalAlpha = (this.flashT / 0.32) * 0.7;
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(r.x, r.y, r.w, r.h - 2);
      ctx.globalAlpha = 1;
    }

    const dim = state === 'locked' || state === 'done';
    drawText(ctx, title, r.x + 6, r.y + 7, dim ? PALETTE.stone3 : PALETTE.wood3);
    body();
  }

  /** The strip along the bottom: what is selected, and what it is for. */
  private drawFooter(ctx: CanvasRenderingContext2D, title: string, blurb: string, note: string, noteTone: string = PALETTE.wood2): void {
    const x = PANEL.x + 10;
    const w = PANEL.w - 20;
    ctx.fillStyle = PALETTE.wood2;
    ctx.fillRect(x, FOOT_Y - 4, w, 1);
    drawText(ctx, title, x, FOOT_Y + 2, PALETTE.wood3);
    if (note) {
      drawText(ctx, note, x + w - textWidth(note), FOOT_Y + 2, noteTone);
    }
    const lines = wrapText(blurb, w);
    lines.slice(0, 2).forEach((line, i) => {
      drawText(ctx, line, x, FOOT_Y + 14 + i * LINE_HEIGHT, PALETTE.wood2);
    });
  }
}

// --- geometry ---------------------------------------------------------------

function tabRect(i: number): { x: number; y: number; w: number; h: number } {
  const w = 62;
  return { x: PANEL.x + 8 + i * (w + 4), y: PANEL.y + 3, w, h: TAB_H };
}

function slotRect(i: number): { x: number; y: number; w: number; h: number } {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return { x: GRID_X + col * (SLOT + GAP), y: GRID_Y + row * (SLOT + GAP), w: SLOT, h: SLOT };
}

function rowRect(v: number): { x: number; y: number; w: number; h: number } {
  return { x: BODY.x, y: BODY.y + 4 + v * ROW_H, w: BODY.w, h: ROW_H };
}

/**
 * Small chevrons at the right edge when a list runs past the panel. Without
 * them a pointer user has no way of knowing there is more, and no reason to
 * try the wheel.
 */
function drawScrollHint(ctx: CanvasRenderingContext2D, scroll: number, total: number): void {
  if (total <= LIST_ROWS) return;
  const x = BODY.x + BODY.w - 4;
  ctx.fillStyle = PALETTE.wood2;
  if (scroll > 0) {
    ctx.fillRect(x - 2, BODY.y + 2, 5, 1);
    ctx.fillRect(x - 1, BODY.y + 1, 3, 1);
    ctx.fillRect(x, BODY.y, 1, 1);
  }
  if (scroll + LIST_ROWS < total) {
    const by = BODY.y + BODY.h - 2;
    ctx.fillRect(x - 2, by - 2, 5, 1);
    ctx.fillRect(x - 1, by - 1, 3, 1);
    ctx.fillRect(x, by, 1, 1);
  }
}

/** A slot well. Hotbar slots are framed in wood so the first row reads apart. */
function drawItemSlot(ctx: CanvasRenderingContext2D, x: number, y: number, hotbar: boolean, focused: boolean): void {
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(x + 1, y, SLOT - 2, 1);
  ctx.fillRect(x + 1, y + SLOT - 1, SLOT - 2, 1);
  ctx.fillRect(x, y + 1, 1, SLOT - 2);
  ctx.fillRect(x + SLOT - 1, y + 1, 1, SLOT - 2);
  ctx.fillStyle = hotbar ? PALETTE.wood1 : PALETTE.wood2;
  ctx.fillRect(x + 1, y + 1, SLOT - 2, SLOT - 2);
  ctx.fillStyle = focused ? PALETTE.white : PALETTE.cream1;
  ctx.fillRect(x + 2, y + 2, SLOT - 4, SLOT - 4);
  ctx.fillStyle = focused ? PALETTE.cream0 : PALETTE.cream1;
  ctx.fillRect(x + 2, y + 2, SLOT - 4, 1);
  if (focused) {
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(x + 1, y + SLOT - 2, SLOT - 2, 1);
  }
}
