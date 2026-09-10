/**
 * RECIPES
 *
 * Pure data. The crafting system knows how to turn inputs into outputs; it does
 * not know what any of them are.
 *
 * The set is deliberately small and each entry answers a question the player
 * will already have asked:
 *
 *  - Wood and stone pile up with nothing to do. Planks and blocks are what
 *    every project in the valley is actually built from, so refining is the
 *    step that gives raw material a point.
 *  - Twelve seeds run out. Turning produce back into seed closes the farming
 *    loop, and returning two for one means a field can grow rather than only
 *    sustain itself.
 *  - Waiting is the cost of farming, so the one thing worth crafting from a
 *    harvest is a way to wait less.
 */

export interface Ingredient {
  item: string;
  count: number;
}

export interface RecipeDef {
  id: string;
  /** What it makes. */
  out: Ingredient;
  in: readonly Ingredient[];
  /** Shown under the name in the crafting list. */
  blurb: string;
}

export const RECIPES: RecipeDef[] = [
  {
    id: 'plank',
    out: { item: 'plank', count: 2 },
    in: [{ item: 'wood', count: 3 }],
    blurb: 'Three lengths, cut square.',
  },
  {
    id: 'block',
    out: { item: 'block', count: 2 },
    in: [{ item: 'stone', count: 3 }],
    blurb: 'Dressed with the pick, badly.',
  },
  {
    id: 'seed_bellroot',
    out: { item: 'seed_bellroot', count: 2 },
    in: [{ item: 'bellroot', count: 1 }],
    blurb: 'One root, saved back, is two next year.',
  },
  {
    id: 'seed_emberwheat',
    out: { item: 'seed_emberwheat', count: 2 },
    in: [{ item: 'emberwheat', count: 1 }],
    blurb: 'Threshed out over a sheet.',
  },
  {
    id: 'compost',
    out: { item: 'compost', count: 1 },
    in: [
      { item: 'emberwheat', count: 2 },
      { item: 'bellroot', count: 1 },
    ],
    blurb: 'Everything you did not eat, turned twice.',
  },
];

export function recipe(id: string): RecipeDef | undefined {
  return RECIPES.find((r) => r.id === id);
}
