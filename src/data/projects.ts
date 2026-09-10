/**
 * PROJECTS
 *
 * The reason wood and stone exist. Every entry here spends refined material
 * and changes something you can walk up to and look at — a roof, a fence, a
 * length of dock, a lamp that was not lit before.
 *
 * Nothing on this list improves a number. That is on purpose: a progression
 * system whose rewards are invisible is a spreadsheet, and the whole appeal of
 * a place like this is watching it come back.
 *
 * Effects are declarative so that completing a project can be replayed from a
 * save by re-applying it, rather than by storing what the world looked like.
 */

import type { Ingredient } from './recipes.ts';

export type ProjectEffect =
  /** Rebuild the farmhouse at a new level. */
  | { kind: 'houseLevel'; level: number }
  /** Put new props into the world. */
  | { kind: 'addProps'; props: { def: string; tx: number; ty: number; inspect?: string }[] }
  /** Make tiles walkable — decking laid over water, mostly. */
  | { kind: 'walkable'; at: { tx: number; ty: number }[] };

export interface ProjectDef {
  id: string;
  name: string;
  /** Which area the change happens in. */
  area: string;
  /** One line on the board, in the voice of somebody who has looked at it. */
  blurb: string;
  cost: readonly Ingredient[];
  /** Must be finished first. */
  requires?: readonly string[];
  effects: readonly ProjectEffect[];
  /** Said once, when it is finished. */
  done: string;
}

export const PROJECTS: ProjectDef[] = [
  {
    id: 'roof',
    name: 'Re-shingle the roof',
    area: 'homestead',
    blurb: 'Half the shingles are moss and the other half are optimism.',
    cost: [{ item: 'plank', count: 8 }, { item: 'block', count: 4 }],
    effects: [{ kind: 'houseLevel', level: 2 }],
    done: 'The roof is sound. It looks like somebody lives here.',
  },
  {
    id: 'porch',
    name: 'Build the porch',
    area: 'homestead',
    blurb: 'There are two post holes by the door and nothing in them.',
    cost: [{ item: 'plank', count: 14 }, { item: 'block', count: 8 }],
    requires: ['roof'],
    effects: [{ kind: 'houseLevel', level: 3 }],
    done: 'Posts, a rail, and a box under each window. It is a house again.',
  },
  {
    id: 'fence',
    name: 'Close the field fence',
    area: 'homestead',
    blurb: 'The south run came down years ago and nobody put it back up.',
    cost: [{ item: 'plank', count: 6 }],
    effects: [
      {
        kind: 'addProps',
        props: [
          { def: 'fenceRail', tx: 38, ty: 34 }, { def: 'fenceRail', tx: 39, ty: 34 },
          { def: 'fenceRail', tx: 40, ty: 34 }, { def: 'fenceRail', tx: 41, ty: 34 },
          { def: 'fenceRail', tx: 42, ty: 34 }, { def: 'fenceRail', tx: 43, ty: 34 },
          { def: 'fencePost', tx: 39, ty: 34 }, { def: 'fencePost', tx: 40, ty: 34 },
          { def: 'fencePost', tx: 41, ty: 34 }, { def: 'fencePost', tx: 42, ty: 34 },
          { def: 'fencePost', tx: 43, ty: 34 },
        ],
      },
    ],
    done: 'The field is closed. Whatever it was keeping out can stay out.',
  },
  {
    id: 'dock',
    name: 'Finish the dock',
    area: 'homestead',
    blurb: 'Somebody re-laid the planks and stopped three feet short of the old posts.',
    cost: [{ item: 'plank', count: 5 }],
    effects: [
      {
        kind: 'addProps',
        props: [
          { def: 'dock', tx: 14, ty: 31 },
          { def: 'dock', tx: 13, ty: 31 },
          { def: 'dock', tx: 12, ty: 31 },
        ],
      },
      {
        kind: 'walkable',
        at: [{ tx: 14, ty: 31 }, { tx: 13, ty: 31 }, { tx: 12, ty: 31 }],
      },
    ],
    done: 'It reaches the posts now. You can stand out over the water.',
  },
  {
    id: 'lamps',
    name: 'Light the track',
    area: 'homestead',
    blurb: 'The track is a long way to walk in the dark, and you have walked it.',
    cost: [{ item: 'plank', count: 6 }, { item: 'block', count: 4 }],
    requires: ['roof'],
    effects: [
      {
        kind: 'addProps',
        props: [
          { def: 'lantern', tx: 21.2, ty: 20.3 },
          { def: 'lantern', tx: 35.4, ty: 20.3 },
          { def: 'lantern', tx: 46.8, ty: 20.3 },
        ],
      },
    ],
    done: 'The track is lit end to end. It changes the walk home entirely.',
  },
  {
    id: 'ruin_lamp',
    name: 'Hang a lamp at the ruin',
    area: 'meadow',
    blurb: 'You would like to see that floor after dark. You are not sure why.',
    cost: [{ item: 'plank', count: 2 }, { item: 'block', count: 2 }],
    requires: ['lamps'],
    effects: [
      {
        kind: 'addProps',
        props: [{ def: 'lantern', tx: 45.6, ty: 15.4 }],
      },
    ],
    done: 'Lit, the floor shows every joint. Somebody cut those stones to fit.',
  },
];

export function project(id: string): ProjectDef | undefined {
  return PROJECTS.find((p) => p.id === id);
}
