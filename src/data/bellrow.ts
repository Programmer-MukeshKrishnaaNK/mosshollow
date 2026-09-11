/**
 * BELL ROW
 *
 * South down the old spur, which has run off the bottom of the homestead map
 * since the first day and never gone anywhere. It goes here.
 *
 * The design rule for this place is that it is a *row*, not a town. You should
 * be able to see the whole of it from where the road arrives, and the first
 * thing you should notice is that it is too short.
 *
 *  - The lane runs east-west and the road arrives perpendicular to it, so the
 *    hamlet presents itself broadside: every door in one look. Arriving along
 *    a street instead shows you one house at a time and reads as a corridor.
 *  - Houses stand on the north side only. The south side is the beck and open
 *    sky. One-sided lanes are what places look like when they grew along a
 *    watercourse, and it halves the buildings while doubling the sense of
 *    somewhere.
 *  - The ground in front of each door is worn through to earth, and each patch
 *    is sized to how much that door is used. The east one runs a tile further
 *    back than the others. One plot has no worn ground at all — the grass goes
 *    right up to the step. That is the whole story of who still lives here,
 *    told in three edits to an ASCII map and not one word of dialogue.
 *
 *    Those approaches were laid as cut Stone first and it was wrong: Stone in
 *    this game is the ruin floor and the farmhouse footing, so a patch of it on
 *    grass reads as rubble rather than as a doorstep, and at this scale it is
 *    only ever a grey smudge. Worn earth is what a path in front of a cottage
 *    actually is, and it joins the lane instead of floating above it.
 *  - The lane stops at the west end, because there is nothing past it.
 *
 * The four plots and the west end are held clear by `keepClear` so the
 * decoration scatter leaves room for what is built on them.
 *
 * Positions are in tiles and deliberately off-grid.
 */

import type { AreaData } from './area.ts';

const MAP = [
  '...................::...................',
  '...................::...................',
  '...................::...................',
  '...................::...................',
  '...................::...................',
  '...................::...................',
  '...................::...................',
  '...................::...................',
  '...................::...................',
  '...................::...................',
  '...................::...................',
  '...................::........:::........',
  '.........:::.......::.:::....:::........',
  '....:::::::::::::::::::::::::::::::.....',
  '....:::::::::::::::::::::::::::::::.....',
  '........................................',
  '........................................',
  '..........~~~~~~~.......................',
  '...~~~~~~~~~~~~~~~~~~~~~.......~~~~~~...',
  '...~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~...',
  '...~~~~~~~.......~~~~~~~~~~~~~~~~~~~~...',
  '........................~~~~~~~.........',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
];
export const BELLROW: AreaData = {
  id: 'bellrow',
  name: 'Bell Row',
  seed: 460711,
  map: MAP,
  spawn: { tx: 20, ty: 5 },
  forestBorder: 3,
  exits: [
    // North, back up the spur to the homestead.
    { x: 18, y: 0, w: 4, h: 3, to: 'homestead', entryTx: 31, entryTy: 39.6, facing: 'up' },
  ],
  fences: [],
  walkable: [],
  keepClear: [
    { x: 18, y: 3, w: 4, h: 11 },  // the road down
    { x: 4, y: 12, w: 31, h: 4 },  // the lane itself
    { x: 3, y: 11, w: 5, h: 6 },   // the west end, where the lane stops
    { x: 7, y: 7, w: 6, h: 6 },    // the west plot
    { x: 13, y: 7, w: 6, h: 6 },   // the plot nobody lives on
    { x: 20, y: 7, w: 7, h: 6 },   // the middle plot, and room for a shed
    { x: 27, y: 7, w: 7, h: 6 },   // the east plot
  ],
  props: [
    // --- the road down ----------------------------------------------------
    // Dense where it leaves the homestead's woods, open by the time the lane
    // is in sight. The road should feel like it is letting you out of
    // something rather than leading you into somewhere.
    { def: 'sign', tx: 17.6, ty: 4.3, inspect: 'sign_bellrow' },
    { def: 'oak1', tx: 15.4, ty: 4.8 },
    { def: 'oak0', tx: 24.2, ty: 5.4 },
    { def: 'birch0', tx: 16.1, ty: 7.6 },
    { def: 'bush1', tx: 23.1, ty: 8.2 },
    { def: 'oak2', tx: 25.8, ty: 9.6 },
    { def: 'bush0', tx: 16.8, ty: 10.4 },
    { def: 'rock2', tx: 22.6, ty: 6.7 },

    // --- the bank behind the row ------------------------------------------
    // The roofs have to be read against something. This is the only place in
    // Bell Row where trees are placed for the benefit of what stands in front
    // of them rather than for their own sake.
    { def: 'oak0', tx: 6.4, ty: 6.8 },
    { def: 'oak2', tx: 8.9, ty: 5.4 },
    { def: 'birch1', tx: 11.4, ty: 4.6 },
    { def: 'oak1', tx: 13.8, ty: 6.1 },
    { def: 'oak2', tx: 18.4, ty: 5.2 },
    { def: 'birch0', tx: 20.9, ty: 4.4 },
    { def: 'oak0', tx: 28.2, ty: 4.8 },
    { def: 'oak1', tx: 30.8, ty: 6.2 },
    { def: 'birch1', tx: 33.4, ty: 5.1 },
    { def: 'oak2', tx: 35.4, ty: 7.8 },
    { def: 'bush1', tx: 27.1, ty: 8.4 },
    { def: 'bush2', tx: 34.6, ty: 10.2 },

    // --- the west end -----------------------------------------------------
    // Where the lane gives up. Left deliberately bare — one old oak leaning
    // over the spot and nothing else competing for the eye.
    { def: 'oak0', tx: 4.6, ty: 9.8 },
    { def: 'bush2', tx: 3.9, ty: 12.6 },
    { def: 'stump', tx: 5.4, ty: 15.7, inspect: 'stump_bellrow' },
    { def: 'rock1', tx: 3.6, ty: 16.2 },

    // --- the east end of the lane -----------------------------------------
    // It stops at the trees, the same as the west end, but untidily. This end
    // was still being used when it stopped being looked after.
    { def: 'crate', tx: 34.6, ty: 12.6, inspect: 'crate_bellrow' },
    { def: 'fencePost', tx: 33.4, ty: 15.4 },
    { def: 'fencePost', tx: 35.1, ty: 15.8 },
    { def: 'bush0', tx: 36.1, ty: 13.4 },
    { def: 'rock2', tx: 32.1, ty: 16.4 },

    // --- the verge --------------------------------------------------------
    // Two tiles of grass between the lane and the water, and almost nothing on
    // it. The reeds plant themselves anywhere touching the beck, so the bank
    // only needs what would not grow there on its own.
    { def: 'rock0', tx: 13.6, ty: 16.2 },
    { def: 'rock2', tx: 27.8, ty: 16.6 },
    { def: 'pebble', tx: 18.4, ty: 15.6 },
    { def: 'pebble', tx: 24.9, ty: 16.1 },
    { def: 'bush1', tx: 9.6, ty: 15.9 },

    // --- the far bank ------------------------------------------------------
    // Across the water, unreachable, and that is the point: the beck is where
    // this place stops, not a thing to be crossed.
    { def: 'birch1', tx: 11.8, ty: 23.4 },
    { def: 'bush0', tx: 15.4, ty: 22.8 },
    { def: 'oak2', tx: 20.4, ty: 23.8 },
    { def: 'oak0', tx: 28.8, ty: 23.2 },
    { def: 'bush2', tx: 24.6, ty: 22.6 },
    { def: 'rock2', tx: 33.2, ty: 23.1 },
  ],
};
