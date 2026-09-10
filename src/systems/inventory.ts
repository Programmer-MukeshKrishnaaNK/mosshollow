/**
 * INVENTORY
 *
 * A flat list of slots with a selected index. The first row is the hotbar and
 * is all the player sees for now; the array is sized for a backpack so that
 * adding one later is a UI change, not a data migration.
 */

import { clamp } from '../core/math.ts';
import { ITEMS, item, type ItemDef } from '../data/items.ts';

export interface Slot {
  id: string | null;
  count: number;
}

/**
 * Eight, not six. Six was exactly the size of the starting kit, so the first
 * thing the player ever picked up went into a slot they could not see.
 */
export const HOTBAR_SIZE = 8;

export class Inventory {
  readonly slots: Slot[];
  selected = 0;
  /** Bumped whenever contents change, so the HUD can flash the slot. */
  lastChanged = -1;
  lastChangedAt = 0;

  constructor(size = HOTBAR_SIZE * 2) {
    this.slots = Array.from({ length: size }, () => ({ id: null, count: 0 }));
  }

  get selectedItem(): ItemDef | null {
    const s = this.slots[this.selected];
    return s.id ? item(s.id) : null;
  }

  select(index: number): void {
    this.selected = clamp(index, 0, HOTBAR_SIZE - 1);
  }

  cycle(delta: number): void {
    this.selected = (this.selected + delta + HOTBAR_SIZE) % HOTBAR_SIZE;
  }

  count(id: string): number {
    let n = 0;
    for (const s of this.slots) if (s.id === id) n += s.count;
    return n;
  }

  /** Adds what it can and returns the remainder. */
  add(id: string, count: number, time = 0): number {
    const def = ITEMS[id];
    if (!def) throw new Error(`No item definition "${id}"`);
    let left = count;
    // Top up existing stacks before opening a new slot, so a pickup does not
    // scatter one item across three slots.
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      const s = this.slots[i];
      if (s.id !== id || s.count >= def.stack) continue;
      const room = def.stack - s.count;
      const take = Math.min(room, left);
      s.count += take;
      left -= take;
      this.lastChanged = i;
      this.lastChangedAt = time;
    }
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      const s = this.slots[i];
      if (s.id !== null) continue;
      const take = Math.min(def.stack, left);
      s.id = id;
      s.count = take;
      left -= take;
      this.lastChanged = i;
      this.lastChangedAt = time;
    }
    return left;
  }

  /** Removes up to `count`; returns how many were actually taken. */
  remove(id: string, count: number): number {
    let left = count;
    for (let i = this.slots.length - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (s.id !== id) continue;
      const take = Math.min(s.count, left);
      s.count -= take;
      left -= take;
      if (s.count === 0) s.id = null;
    }
    return count - left;
  }

  /** Replace all slots, e.g. from a save file. Tolerates a short list. */
  restore(slots: readonly Slot[], selected: number): void {
    for (let i = 0; i < this.slots.length; i++) {
      const s = slots[i];
      this.slots[i].id = s?.id ?? null;
      this.slots[i].count = s?.id ? s.count : 0;
    }
    this.selected = clamp(selected, 0, HOTBAR_SIZE - 1);
    this.lastChanged = -1;
  }

  /** Consume one of the selected stack. Used when planting a seed. */
  consumeSelected(): boolean {
    const s = this.slots[this.selected];
    if (!s.id || s.count <= 0) return false;
    s.count--;
    if (s.count === 0) s.id = null;
    return true;
  }
}
