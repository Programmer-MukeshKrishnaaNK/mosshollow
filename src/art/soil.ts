/**
 * TILLED SOIL
 *
 * Generated rather than authored, so it can share the terrain baker's grain
 * and stay in the same material family as the ground it is cut into.
 *
 * Edges are drawn per side rather than per tile: a bed's outer edge gets a dark
 * lip and a lit top, and where two tilled tiles meet, nothing is drawn at all.
 * That is what makes a block of beds read as one worked patch instead of a grid
 * of separate squares, without needing a 47-piece autotile set.
 */

import { hash2, noise2 } from '../core/rng.ts';
import { PALETTE } from './palette.ts';
import { ctxOf, makeCanvas } from './pixel.ts';
import { TILE } from '../world/materials.ts';

export interface SoilTiles {
  /** Four dry variants, four wet. Indexed by a hash of the tile position. */
  dry: HTMLCanvasElement[];
  wet: HTMLCanvasElement[];
}

const VARIANTS = 4;

export function buildSoilTiles(): SoilTiles {
  const dry: HTMLCanvasElement[] = [];
  const wet: HTMLCanvasElement[] = [];
  for (let v = 0; v < VARIANTS; v++) {
    dry.push(soilTile(v, false));
    wet.push(soilTile(v, true));
  }
  return { dry, wet };
}

function soilTile(variant: number, isWet: boolean): HTMLCanvasElement {
  const c = makeCanvas(TILE, TILE);
  const ctx = ctxOf(c);
  const seed = 500 + variant * 37;

  // Dry soil is turned earth — tan, dusty, and clearly lighter than the grass
  // around it. Wet soil is a full two steps darker. The first pass used the
  // soil ramp for both and a freshly hoed bed read as scorched ground.
  const light = isWet ? PALETTE.soil0 : PALETTE.dirt1;
  const mid = isWet ? PALETTE.soil1 : PALETTE.soil0;
  // The darkest wet tone is deliberately a cool grey rather than a browner
  // brown. Wet earth does not just get darker, it goes cold, and that is the
  // part the eye actually reads as "damp" at a glance across a field.
  const dark = isWet ? PALETTE.stone4 : PALETTE.soil1;

  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      // Furrows every four pixels: a ridge with a lit crest and a shadowed
      // trough, which is what tells you from above that it has been turned.
      const furrow = (y + variant) % 4;
      const grain = hash2(x, y, seed);
      const drift = noise2(x * 0.3, y * 0.3, seed + 11);
      let color: string;
      if (furrow === 0) color = dark;
      else if (furrow === 1) color = grain > 0.55 ? light : mid;
      else color = grain < 0.16 ? dark : mid;
      if (drift > 0.78 && furrow !== 0) color = light;
      if (grain > 0.985) color = isWet ? PALETTE.soil0 : PALETTE.dirt0; // a clod
      // A very occasional glint of standing water in the furrow bottoms.
      if (isWet && furrow === 0 && grain > 0.93) color = PALETTE.water3;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

/** Bitmask of tilled neighbours: 1 = north, 2 = east, 4 = south, 8 = west. */
export function drawSoilEdges(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  mask: number,
  isWet: boolean,
): void {
  const lip = isWet ? PALETTE.soil2 : PALETTE.soil1;
  const crest = isWet ? PALETTE.soil0 : PALETTE.dirt0;
  // North: the cut edge catches light, so it gets the crest.
  if (!(mask & 1)) {
    ctx.fillStyle = crest;
    ctx.fillRect(x, y, TILE, 1);
  }
  // South: the near lip falls into shadow.
  if (!(mask & 4)) {
    ctx.fillStyle = lip;
    ctx.fillRect(x, y + TILE - 1, TILE, 1);
  }
  if (!(mask & 8)) {
    ctx.fillStyle = crest;
    ctx.fillRect(x, y, 1, TILE);
  }
  if (!(mask & 2)) {
    ctx.fillStyle = lip;
    ctx.fillRect(x + TILE - 1, y, 1, TILE);
  }
}
