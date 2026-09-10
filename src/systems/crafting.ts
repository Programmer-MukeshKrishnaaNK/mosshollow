/**
 * CRAFTING
 *
 * Deliberately thin. It checks a recipe against an inventory and moves items,
 * and that is all — no stations, no queues, no timers. Everything interesting
 * about progression in this game happens at the project board; crafting is the
 * step that turns what you gathered into what the board asks for.
 */

import type { Ingredient, RecipeDef } from '../data/recipes.ts';
import type { Inventory } from './inventory.ts';

export function has(inv: Inventory, needs: readonly Ingredient[]): boolean {
  return needs.every((n) => inv.count(n.item) >= n.count);
}

/** How many times over the inventory could satisfy this list. */
export function timesAffordable(inv: Inventory, needs: readonly Ingredient[]): number {
  let best = Infinity;
  for (const n of needs) {
    if (n.count <= 0) continue;
    best = Math.min(best, Math.floor(inv.count(n.item) / n.count));
  }
  return best === Infinity ? 0 : best;
}

/**
 * Make one. Returns false without touching anything if the ingredients are not
 * all there, or if there is nowhere to put the result — a craft that consumes
 * your inputs and then drops the output on the floor is worse than one that
 * refuses.
 */
export function craft(inv: Inventory, r: RecipeDef, time = 0): boolean {
  if (!has(inv, r.in)) return false;
  if (!inv.canFit(r.out.item, r.out.count)) return false;
  for (const n of r.in) inv.remove(n.item, n.count);
  const left = inv.add(r.out.item, r.out.count, time);
  // canFit said there was room, so this should never happen; if it somehow
  // does, put the inputs back rather than silently eating them.
  if (left > 0) {
    inv.remove(r.out.item, r.out.count - left);
    for (const n of r.in) inv.add(n.item, n.count, time);
    return false;
  }
  return true;
}
