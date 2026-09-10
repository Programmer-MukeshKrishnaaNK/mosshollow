/**
 * PROPS
 *
 * Every standing object in the world: trees, rocks, fences, lanterns. A prop
 * definition is data — its layers, how each layer bends in the wind, what it
 * blocks, whether it emits light or particles — and the world just places
 * instances of them.
 *
 * Trees are built from an authored trunk plus a generated canopy. Authoring
 * twelve near-identical canopies by hand would be slower *and* look worse:
 * generating them from the shared shading model means every tree in the valley
 * is lit identically and no two have the same silhouette.
 */

import { makeRng } from '../core/rng.ts';
import { FOLIAGE_RAMP, STONE_RAMP, makeBlob } from '../art/organic.ts';
import { sprite, type Sprite } from '../art/pixel.ts';
import {
  BELL_MARKER, BIRCH_TRUNK, CRATE, DOCK_PLANK, FENCE_POST, FENCE_RAIL,
  FLOWER_RED, FLOWER_VIOLET, FLOWER_WHITE, LANTERN_POST, OAK_TRUNK, PEBBLE,
  REED, SIGN_POST, STUMP, TUFT_A, TUFT_B,
} from '../art/props.art.ts';
import type { PaletteKey } from '../art/palette.ts';

export interface PropLayer {
  sprite: Sprite;
  /** Offset from the prop's ground anchor to the layer's top-left. */
  dx: number;
  dy: number;
  /** Peak sideways bend in pixels at the top of the layer. 0 = rigid. */
  sway: number;
  /** Bend concentrated toward the top (2) or spread evenly (1). */
  swayBias?: number;
}

export interface PropLight {
  dx: number;
  dy: number;
  radius: number;
  color: string;
  intensity: number;
  flickerAmount?: number;
  /** Only lit after dark. */
  nightOnly?: boolean;
}

export interface PropDef {
  id: string;
  layers: PropLayer[];
  /** Blocking box relative to the ground anchor. Omit for decoration. */
  collider?: { dx: number; dy: number; w: number; h: number };
  lights?: PropLight[];
  /** Depth-sort key offset, for things that should sort behind their base. */
  sortBias?: number;
  /** Sheds leaves from this height while the wind blows. */
  sheds?: { rate: number; height: number; spread: number };
  /** Default entry in the inspect table. A placement can override it. */
  inspect?: string;
}

export interface Prop {
  def: PropDef;
  x: number;
  y: number;
  /** Per-instance inspect key, so two identical stones can say different things. */
  inspect?: string;
  /** Per-instance phase so no two things sway in unison. */
  phase: number;
  /** Per-instance sway scale, so a stand of trees is not one organism. */
  swayScale: number;
}

// --- sprite construction ----------------------------------------------------

function oakCanopy(seed: number): Sprite {
  return makeBlob({
    w: 58, h: 44, seed, ramp: FOLIAGE_RAMP, rim: 'fol1', rimAmount: 0.1,
    clumpCount: 11, clumpRadius: [8, 13], envelope: [19, 10],
    grounding: 0.52, grain: 0.08, squash: 1.18,
    ragged: 0.3, raggedScale: 0.26, crease: 0.2, bias: 1.75,
  });
}

function birchCanopy(seed: number): Sprite {
  return makeBlob({
    w: 38, h: 46, seed, ramp: FOLIAGE_RAMP, rim: 'fol1', rimAmount: 0.12,
    clumpCount: 9, clumpRadius: [6, 9.5], envelope: [11, 14],
    grounding: 0.46, grain: 0.09, squash: 0.86,
    ragged: 0.34, raggedScale: 0.3, crease: 0.2, bias: 1.6,
  });
}

function bushSprite(seed: number): Sprite {
  return makeBlob({
    w: 28, h: 20, seed, ramp: FOLIAGE_RAMP, rim: 'fol1', rimAmount: 0.1,
    clumpCount: 6, clumpRadius: [5, 7.5], envelope: [9, 4],
    grounding: 0.56, grain: 0.08, squash: 1.5,
    ragged: 0.3, raggedScale: 0.34, crease: 0.22, bias: 1.7,
  });
}

function rockSprite(seed: number, big: boolean): Sprite {
  return makeBlob({
    w: big ? 26 : 18, h: big ? 19 : 13, seed,
    // Deliberately skipping stone0: reserved for the brightest catch of light
    // on cut stone. A field boulder that reaches it looks like a marshmallow.
    ramp: STONE_RAMP.slice(1), outline: 'inkCool', rim: 'stone0', rimAmount: 0.12,
    clumpCount: big ? 5 : 4, clumpRadius: big ? [6.5, 10] : [4.5, 6.5],
    envelope: big ? [7, 3.5] : [4.5, 2.5],
    grounding: 0.58, grain: 0.05, squash: 1.5,
    crease: 0.16, ragged: 0.16, raggedScale: 0.44, bias: 1.9,
  });
}

const LEAF_RAMP: PaletteKey[] = ['fol2', 'fol3', 'fol4'];

/** Builds every prop definition once, at load. */
export function buildProps(): Record<string, PropDef> {
  const defs: Record<string, PropDef> = {};
  const rng = makeRng(20260910);

  // --- oaks: the valley's oldest residents --------------------------------
  for (let v = 0; v < 3; v++) {
    const trunk = sprite(OAK_TRUNK, 8, 18);
    const canopy = oakCanopy(1000 + v * 37);
    defs[`oak${v}`] = {
      id: `oak${v}`,
      layers: [
        { sprite: trunk, dx: -8, dy: -18, sway: 0.6, swayBias: 2.4 },
        { sprite: canopy, dx: -29, dy: -57, sway: 3.1, swayBias: 1.5 },
      ],
      collider: { dx: -6, dy: -6, w: 12, h: 6 },
      sheds: { rate: 0.22, height: 34, spread: 22 },
    };
  }

  // --- birches: lighter, thinner, they move more ---------------------------
  for (let v = 0; v < 2; v++) {
    const trunk = sprite(BIRCH_TRUNK, 5, 18);
    const canopy = birchCanopy(2000 + v * 53);
    defs[`birch${v}`] = {
      id: `birch${v}`,
      layers: [
        { sprite: trunk, dx: -5, dy: -18, sway: 1.1, swayBias: 2.6 },
        { sprite: canopy, dx: -19, dy: -58, sway: 4.4, swayBias: 1.4 },
      ],
      collider: { dx: -4, dy: -5, w: 8, h: 5 },
      sheds: { rate: 0.3, height: 32, spread: 15 },
    };
  }

  for (let v = 0; v < 3; v++) {
    const s = bushSprite(3000 + v * 29);
    defs[`bush${v}`] = {
      id: `bush${v}`,
      layers: [{ sprite: s, dx: -14, dy: -20, sway: 1.5, swayBias: 1.8 }],
      collider: { dx: -9, dy: -5, w: 18, h: 5 },
    };
  }

  for (let v = 0; v < 3; v++) {
    const big = v < 2;
    const s = rockSprite(4000 + v * 41, big);
    defs[`rock${v}`] = {
      id: `rock${v}`,
      layers: [{ sprite: s, dx: -Math.floor(s.w / 2), dy: -s.h, sway: 0 }],
      collider: { dx: -Math.floor(s.w / 2) + 2, dy: -4, w: s.w - 4, h: 5 },
    };
  }

  const pebble = sprite(PEBBLE, 3, 5);
  defs.pebble = { id: 'pebble', layers: [{ sprite: pebble, dx: -3, dy: -5, sway: 0 }] };

  const stump = sprite(STUMP, 7, 12);
  defs.stump = {
    id: 'stump',
    layers: [{ sprite: stump, dx: -7, dy: -12, sway: 0 }],
    collider: { dx: -6, dy: -4, w: 12, h: 4 },
  };

  const post = sprite(FENCE_POST, 3, 14);
  defs.fencePost = {
    id: 'fencePost',
    layers: [{ sprite: post, dx: -3, dy: -14, sway: 0 }],
    collider: { dx: -3, dy: -3, w: 6, h: 3 },
  };
  const rail = sprite(FENCE_RAIL, 0, 6);
  defs.fenceRail = {
    id: 'fenceRail',
    layers: [{ sprite: rail, dx: 0, dy: -12, sway: 0 }],
    collider: { dx: 0, dy: -3, w: 16, h: 3 },
    sortBias: -1,
  };

  const lantern = sprite(LANTERN_POST, 4, 23);
  defs.lantern = {
    id: 'lantern',
    layers: [{ sprite: lantern, dx: -4, dy: -23, sway: 0 }],
    collider: { dx: -3, dy: -3, w: 6, h: 3 },
    lights: [
      { dx: 0, dy: -19, radius: 46, color: '#ffbe63', intensity: 1, flickerAmount: 0.1, nightOnly: true },
    ],
  };

  const signPost = sprite(SIGN_POST, 7, 15);
  defs.sign = {
    id: 'sign',
    layers: [{ sprite: signPost, dx: -7, dy: -15, sway: 0.4, swayBias: 2 }],
    collider: { dx: -5, dy: -3, w: 10, h: 3 },
  };

  const crate = sprite(CRATE, 7, 11);
  defs.crate = {
    id: 'crate',
    layers: [{ sprite: crate, dx: -7, dy: -11, sway: 0 }],
    collider: { dx: -7, dy: -5, w: 14, h: 5 },
  };

  const bell = sprite(BELL_MARKER, 7, 26);
  defs.bellMarker = {
    id: 'bellMarker',
    layers: [{ sprite: bell, dx: -7, dy: -26, sway: 0 }],
    collider: { dx: -6, dy: -4, w: 12, h: 4 },
    lights: [
      // Barely there. You should not be sure you saw it.
      { dx: 0, dy: -19, radius: 22, color: '#ffd884', intensity: 0.45, flickerAmount: 0.35, nightOnly: true },
    ],
  };

  const reed = sprite(REED, 5, 18);
  defs.reed = {
    id: 'reed',
    layers: [{ sprite: reed, dx: -5, dy: -18, sway: 2.6, swayBias: 2.2 }],
  };

  const plank = sprite(DOCK_PLANK, 8, 16);
  defs.dock = {
    id: 'dock',
    layers: [{ sprite: plank, dx: -8, dy: -12, sway: 0 }],
    sortBias: -400, // planks lie flat on the water and never occlude anything
  };

  // --- ground decoration: no collision, all of it moves --------------------
  for (const [name, map] of [['tuftA', TUFT_A], ['tuftB', TUFT_B]] as const) {
    const s = sprite(map, 5, 8);
    defs[name] = { id: name, layers: [{ sprite: s, dx: -5, dy: -8, sway: 1.3, swayBias: 2 }] };
  }
  for (const [name, map] of [
    ['flowerRed', FLOWER_RED],
    ['flowerViolet', FLOWER_VIOLET],
    ['flowerWhite', FLOWER_WHITE],
  ] as const) {
    const s = sprite(map, 4, 10);
    defs[name] = { id: name, layers: [{ sprite: s, dx: -4, dy: -10, sway: 1.1, swayBias: 2.6 }] };
  }

  void rng;
  return defs;
}

export { LEAF_RAMP };
