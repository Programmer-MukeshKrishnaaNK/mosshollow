/**
 * MOSSHOLLOW HOMESTEAD
 *
 * The first thing anyone sees. Everything here is placed on purpose:
 *
 *  - The house sits north-west, so the path leads the eye down and to the
 *    right, into the rest of the valley.
 *  - The pond is low and west, framed by reeds and two leaning birches. The
 *    dock is the only thing in the area that reaches out over water, which is
 *    what makes it worth walking to.
 *  - The old field east of the path is fenced, tilled in beds, and clearly
 *    hasn't been worked in years — grass is coming back through it.
 *  - Two bell markers stand where nobody would put a useful thing: one in the
 *    trees north-east, one at the water's edge. Neither is explained.
 *
 * Positions are in tiles and deliberately off-grid.
 */

import type { AreaData } from './area.ts';

const MAP = [
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............======..........................................',
  '............======..........................................',
  '.............::.............................................',
  '.............::.............................................',
  '.............::.............................................',
  '.............::.............................................',
  '.............::.............................................',
  '.............::.............................................',
  '.............::::::::::::::::::::::::::::::::::::::::::::...',
  '.............::::::::::::::::::::::::::::::::::::::::::::...',
  '....................::........::............................',
  '....................::........::............................',
  '....................::........::...ddddddddddddd............',
  '....................::........::...d###########d............',
  '....................::........::...d###########d............',
  '.......~~~~.........::........::...ddddddddddddd............',
  '......~~~~~~~~~~....::........::...d###########d............',
  '......~~~~~~~~~~~...::........::...d###########d............',
  '......~~~~~~~~~~~~.:::........::...ddddddddddddd............',
  '.....~~~~~~~~~~~~~~...........::...d###########d............',
  '.....~~~~~~~~~~~~~~~..........::...ddddddddddddd............',
  '....~~~~~~~~~~~~~~~...........::............................',
  '....~~~~~~~~~~~~~~............::............................',
  '.......~~~~~~.................::............................',
  '........~~~~..................::............................',
  '..............................::............................',
  '..............................::............................',
  '..............................::............................',
  '..............................::............................',
  '..............................::............................',
  '..............................::............................',
];

export const HOMESTEAD: AreaData = {
  id: 'homestead',
  name: 'The Homestead',
  seed: 20260910,
  map: MAP,
  spawn: { tx: 14.5, ty: 17.2 },
  house: { tx: 14.5, ty: 13 },
  forestBorder: 3,
  exits: [
    // East, through the gate, into the meadow. The track already ran this way;
    // now it goes somewhere.
    { x: 57, y: 20, w: 3, h: 4, to: 'meadow', entryTx: 4, entryTy: 20.6, facing: 'right' },
  ],
  fences: [
    // The old field, fenced on three sides. The south side fell down years ago
    // and nobody put it back up.
    { x0: 34, y0: 24, x1: 48, y1: 24 },
    { x0: 34, y0: 24, x1: 34, y1: 34 },
    { x0: 48, y0: 24, x1: 48, y1: 34 },
    { x0: 34, y0: 34, x1: 38, y1: 34 },
    { x0: 44, y0: 34, x1: 48, y1: 34 },
  ],
  walkable: [
    { tx: 18, ty: 31 }, { tx: 17, ty: 31 }, { tx: 16, ty: 31 }, { tx: 15, ty: 31 },
    { tx: 41, ty: 34 }, { tx: 42, ty: 34 },
  ],
  keepClear: [
    { x: 10, y: 11, w: 12, h: 6 },   // the yard in front of the house
    { x: 12, y: 14, w: 4, h: 9 },    // the path down from the door
    { x: 33, y: 23, w: 17, h: 13 },  // the field
    { x: 14, y: 28, w: 8, h: 5 },    // the way down to the dock
  ],
  props: [
    // --- the yard ---------------------------------------------------------
    { def: 'lantern', tx: 11.4, ty: 15.6, inspect: 'lantern_yard' },
    { def: 'lantern', tx: 18.2, ty: 15.6 },
    { def: 'crate', tx: 19.6, ty: 14.4, inspect: 'crate_yard' },
    { def: 'projectBoard', tx: 9.8, ty: 19.4, inspect: 'board' },
    { def: 'crate', tx: 20.7, ty: 15.1 },
    { def: 'oak0', tx: 8.3, ty: 12.4 },
    { def: 'bush1', tx: 9.6, ty: 15.2 },
    { def: 'bush2', tx: 20.4, ty: 12.1 },
    { def: 'rock2', tx: 10.2, ty: 17.4 },

    // --- the crossroads ---------------------------------------------------
    { def: 'sign', tx: 16.1, ty: 20.4, inspect: 'sign_crossroads' },
    { def: 'lantern', tx: 29.0, ty: 20.3 },
    { def: 'stump', tx: 24.6, ty: 19.2, inspect: 'stump_old' },
    { def: 'rock0', tx: 35.4, ty: 19.6 },
    { def: 'bush0', tx: 36.9, ty: 20.3 },
    { def: 'oak1', tx: 41.6, ty: 18.7 },
    { def: 'birch0', tx: 45.2, ty: 19.9 },
    { def: 'birch1', tx: 47.0, ty: 18.4 },

    // --- the field --------------------------------------------------------
    { def: 'crate', tx: 33.2, ty: 22.6 },
    { def: 'stump', tx: 50.4, ty: 27.1 },
    { def: 'rock1', tx: 51.2, ty: 30.6 },
    { def: 'bush1', tx: 50.6, ty: 33.8 },
    { def: 'oak2', tx: 52.4, ty: 24.2 },

    // --- the pond ---------------------------------------------------------
    { def: 'dock', tx: 18, ty: 31, inspect: 'dock' },
    { def: 'dock', tx: 17, ty: 31 },
    { def: 'dock', tx: 16, ty: 31 },
    { def: 'dock', tx: 15, ty: 31 },
    { def: 'birch0', tx: 4.6, ty: 27.3 },
    { def: 'birch1', tx: 6.2, ty: 25.8 },
    { def: 'oak2', tx: 3.8, ty: 37.6 },
    { def: 'rock0', tx: 19.8, ty: 34.2 },
    { def: 'rock2', tx: 21.1, ty: 36.0 },
    { def: 'bush0', tx: 20.6, ty: 27.4 },
    { def: 'stump', tx: 22.4, ty: 33.1 },

    // --- the two markers --------------------------------------------------
    { def: 'bellMarker', tx: 50.6, ty: 8.4, inspect: 'bell_wood' },
    { def: 'bush2', tx: 49.1, ty: 9.2 },
    { def: 'bush0', tx: 52.2, ty: 9.4 },
    { def: 'rock1', tx: 51.4, ty: 6.6 },
    { def: 'bellMarker', tx: 22.9, ty: 29.6, inspect: 'bell_pond' },
    { def: 'bush1', tx: 24.1, ty: 30.4 },

    // --- odds and ends that suggest the place was lived in -----------------
    { def: 'stump', tx: 27.2, ty: 12.6 },
    { def: 'rock2', tx: 26.4, ty: 13.9 },
    { def: 'oak0', tx: 31.8, ty: 10.2 },
    { def: 'oak1', tx: 36.4, ty: 8.6 },
    { def: 'birch0', tx: 40.1, ty: 11.4 },
    { def: 'bush2', tx: 33.4, ty: 13.1 },
    { def: 'oak2', tx: 8.6, ty: 21.9 },
    { def: 'bush0', tx: 7.2, ty: 24.1 },
    { def: 'rock1', tx: 25.7, ty: 39.4 },
    { def: 'oak0', tx: 24.1, ty: 41.2 },
    { def: 'birch1', tx: 36.2, ty: 38.6 },
    { def: 'oak1', tx: 39.4, ty: 40.1 },
    { def: 'bush1', tx: 37.8, ty: 40.8 },
  ],
};
