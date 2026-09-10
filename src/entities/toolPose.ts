/**
 * Where the tool sits in the player's hands, per facing and per phase.
 *
 * Offsets are from the player's ground position to the tool sprite's top-left.
 * They are data rather than code so the swing can be tuned by looking at it,
 * which is the only way this kind of thing ever gets tuned.
 */

import type { Facing } from './player.ts';

export interface ToolAnchor {
  x: number;
  y: number;
  /** Mirror the tool sprite — used for the left-facing poses. */
  flip?: boolean;
  /** Draw the tool behind the character rather than in front. */
  behind?: boolean;
}

export interface FacingAnchors {
  raise: ToolAnchor;
  strike: ToolAnchor;
}

export const HOE_ANCHORS: Record<Facing, FacingAnchors> = {
  // Facing the camera: wound up over the right shoulder with the blade high,
  // then round and down so the blade finishes in the dirt in front of the
  // feet. The strike sprite is mirrored so the blade travels down the same
  // side it went up — a right-handed swing, not a windmill.
  down: {
    raise: { x: -3, y: -38, behind: true },
    strike: { x: -6, y: -9, flip: true },
  },
  // Facing away, the whole arc happens behind the body.
  up: {
    raise: { x: -3, y: -38, behind: true },
    strike: { x: -4, y: -34, behind: true },
  },
  right: {
    raise: { x: -1, y: -38, behind: true },
    strike: { x: 6, y: -12 },
  },
  left: {
    raise: { x: -13, y: -38, flip: true, behind: true },
    strike: { x: -20, y: -12, flip: true },
  },
};

export const CAN_ANCHORS: Record<Facing, FacingAnchors> = {
  // The can barely moves: it is carried at the hip, tipped forward, and held
  // there. Pouring is not a swing and should not be animated like one.
  //
  // It sits low and off-centre rather than square on the chest. Centred, a
  // 14px can covers a 12px character's whole torso and face, and the pour
  // reads as the character disappearing behind a bucket.
  down: {
    raise: { x: 1, y: -20 },
    strike: { x: 0, y: -14 },
  },
  up: {
    raise: { x: 1, y: -22, behind: true },
    strike: { x: 2, y: -18, behind: true },
  },
  right: {
    raise: { x: 3, y: -20 },
    strike: { x: 6, y: -14 },
  },
  left: {
    raise: { x: -18, y: -20, flip: true },
    strike: { x: -20, y: -14, flip: true },
  },
};

/**
 * Swing timings, in seconds.
 *
 * The hoe is a blow: wind up, hold — that hold is the anticipation, and it is
 * what the whole thing rests on — snap through, then a long recovery you can
 * cancel out of by walking. The can is a pour: no snap, and the payoff lasts.
 */
export interface ToolTiming {
  raise: number;
  hold: number;
  strike: number;
  recover: number;
  /** Camera shake on impact. Zero for the can. */
  shake: number;
  /** The can keeps emitting for the length of the pour. */
  sustained: boolean;
}

export const TOOL_TIMING = {
  // The strike is the impact hold, and it was originally 60ms — under four
  // frames, which the eye skips straight past. At 100ms the blow lands and you
  // see it land, which is the entire difference between a swing and a sprite
  // swap.
  hoe: { raise: 0.13, hold: 0.08, strike: 0.1, recover: 0.22, shake: 1.15, sustained: false },
  can: { raise: 0.14, hold: 0.04, strike: 0.34, recover: 0.24, shake: 0, sustained: true },
} as const;
