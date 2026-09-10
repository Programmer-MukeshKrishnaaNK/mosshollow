/**
 * GROUND BAKER
 *
 * Tile-based ground usually gives itself away in one of two ways: the same
 * grass tile repeating in a visible lattice, or hard 90-degree corners where
 * one material meets another. This module avoids both.
 *
 * Instead of stamping tiles, each material is treated as a *field*. The tile
 * grid is sampled bilinearly, perturbed by two octaves of value noise, and
 * thresholded per pixel. A path edge therefore wanders the way a trodden path
 * actually wanders, and no two square metres of grass are identical — while
 * the underlying data is still a clean, editable tile map.
 *
 * The whole map is baked once into an offscreen canvas at load. Water is baked
 * as a mask rather than pixels, because it has to move.
 */

import { hash2, noise2 } from '../core/rng.ts';
import { PALETTE, hexToRgb } from '../art/palette.ts';
import { ctxOf, makeCanvas } from '../art/pixel.ts';
import { Mat, TILE } from '../world/materials.ts';
import type { Tilemap } from '../world/tilemap.ts';

export interface BakedTerrain {
  ground: HTMLCanvasElement;
  /** Opaque where there is water, transparent elsewhere. */
  waterMask: HTMLCanvasElement;
  /** The narrow band just inside the waterline, where foam gathers. */
  foamMask: HTMLCanvasElement;
}

type Rgb = [number, number, number];

const C = {
  fol0: hexToRgb(PALETTE.fol0),
  fol1: hexToRgb(PALETTE.fol1),
  fol2: hexToRgb(PALETTE.fol2),
  fol3: hexToRgb(PALETTE.fol3),
  fol4: hexToRgb(PALETTE.fol4),
  fol5: hexToRgb(PALETTE.fol5),
  fol6: hexToRgb(PALETTE.fol6),
  dirt0: hexToRgb(PALETTE.dirt0),
  dirt1: hexToRgb(PALETTE.dirt1),
  dirt2: hexToRgb(PALETTE.dirt2),
  dirt3: hexToRgb(PALETTE.dirt3),
  dirt4: hexToRgb(PALETTE.dirt4),
  soil0: hexToRgb(PALETTE.soil0),
  soil1: hexToRgb(PALETTE.soil1),
  soil2: hexToRgb(PALETTE.soil2),
  stone0: hexToRgb(PALETTE.stone0),
  stone1: hexToRgb(PALETTE.stone1),
  stone2: hexToRgb(PALETTE.stone2),
  stone3: hexToRgb(PALETTE.stone3),
  stone4: hexToRgb(PALETTE.stone4),
};

/**
 * Bilinear sample of a material's presence, in tile space. Tile centres sit at
 * (tx + 0.5), so sampling is offset by half a tile.
 */
function fieldAt(map: Tilemap, wx: number, wy: number, mat: Mat): number {
  const fx = wx / TILE - 0.5;
  const fy = wy / TILE - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const a = map.presence(x0, y0, mat);
  const b = map.presence(x0 + 1, y0, mat);
  const c = map.presence(x0, y0 + 1, mat);
  const d = map.presence(x0 + 1, y0 + 1, mat);
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

/**
 * Push a field value away from its clean bilinear ramp with noise, so the
 * threshold that follows produces an organic edge. Only worth doing near a
 * boundary — deep inside or far outside, the answer is already certain.
 */
function roughen(field: number, wx: number, wy: number, salt: number, amount: number): number {
  if (field <= 0.04 || field >= 0.96) return field;
  const coarse = noise2(wx * 0.09, wy * 0.09, salt) - 0.5;
  const fine = noise2(wx * 0.31, wy * 0.31, salt + 17) - 0.5;
  return field + coarse * amount + fine * amount * 0.45;
}

export function bakeTerrain(map: Tilemap, seed: number): BakedTerrain {
  const W = map.pixelW;
  const H = map.pixelH;

  const ground = makeCanvas(W, H);
  const gctx = ctxOf(ground);
  const img = gctx.createImageData(W, H);
  const data = img.data;

  const waterMask = makeCanvas(W, H);
  const wctx = ctxOf(waterMask);
  const wimg = wctx.createImageData(W, H);
  const wdata = wimg.data;

  const foamMask = makeCanvas(W, H);
  const fctx = ctxOf(foamMask);
  const fimg = fctx.createImageData(W, H);
  const fdata = fimg.data;

  const put = (i: number, c: Rgb): void => {
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
    data[i + 3] = 255;
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;

      // 1. grass everywhere, as the substrate
      put(i, grassAt(x, y, seed));

      // 2. the old field: bare earth reclaimed in patches by grass
      const fField = roughen(fieldAt(map, x, y, Mat.Field), x, y, seed + 71, 0.5);
      if (fField > 0.5) {
        // Grass creeps back in wherever the soil was never turned over again.
        const reclaim = noise2(x * 0.06, y * 0.06, seed + 91);
        if (reclaim > 0.5) put(i, grassAt(x, y, seed));
        else put(i, fieldEarthAt(x, y, seed));
      }

      // 3. tilled beds
      const sField = roughen(fieldAt(map, x, y, Mat.Soil), x, y, seed + 31, 0.34);
      if (sField > 0.5) put(i, soilAt(x, y, seed));

      // 4. the path, worn through whatever it crosses
      const pField = roughen(fieldAt(map, x, y, Mat.Path), x, y, seed + 13, 0.44);
      if (pField > 0.5) put(i, pathAt(x, y, seed, pField));
      else if (pField > 0.38) {
        // trampled fringe: grass thinning out toward the path
        if (hash2(x, y, seed + 5) < (pField - 0.38) * 5) put(i, C.fol5);
      }

      // 5. laid flagstone — cut by people, so its edge stays crisp
      const stField = fieldAt(map, x, y, Mat.Stone);
      if (stField > 0.5) put(i, flagstoneAt(x, y, seed));

      // 6. water: shoreline sand goes into the ground layer, the water itself
      //    becomes a mask the renderer animates.
      const aField = roughen(fieldAt(map, x, y, Mat.Water), x, y, seed + 47, 0.42);
      if (aField > 0.3) {
        const t = (aField - 0.3) / 0.2; // 0 at the sand's outer edge, 1 at the waterline
        put(i, shoreAt(x, y, seed, Math.min(1, t)));
      }
      if (aField > 0.5) {
        // The bed is painted into the ground layer and the moving water is
        // drawn over it semi-transparent, so the pond genuinely reads as
        // deeper in the middle instead of being one flat blue shape.
        const depth = Math.min(1, (aField - 0.5) * 3.6);
        put(i, bedAt(x, y, seed, depth));
        wdata[i + 3] = 255;
      }
      if (aField > 0.5 && aField < 0.585) fdata[i + 3] = 255;
    }
  }

  gctx.putImageData(img, 0, 0);
  wctx.putImageData(wimg, 0, 0);
  fctx.putImageData(fimg, 0, 0);
  return { ground, waterMask, foamMask };
}

/**
 * Grass. Two scales of variation: broad drifts that read as the ground rolling
 * and catching light differently, and per-pixel speckle that reads as blades.
 */
function grassAt(x: number, y: number, seed: number): Rgb {
  const broad = noise2(x * 0.021, y * 0.028, seed);
  const drift = noise2(x * 0.075, y * 0.085, seed + 3);
  const v = broad * 0.62 + drift * 0.38;
  const speck = hash2(x, y, seed + 9);
  let base: Rgb = v > 0.58 ? C.fol2 : v > 0.4 ? C.fol3 : C.fol4;
  if (speck > 0.945 && v > 0.46) base = C.fol1;
  else if (speck < 0.06) base = v > 0.5 ? C.fol4 : C.fol5;
  // Rare single-pixel sun catches, sparse enough to stay a highlight.
  if (speck > 0.9965 && v > 0.55) base = C.fol0;
  return base;
}

/** Earth in the old field: drier and greyer than a walked path. */
function fieldEarthAt(x: number, y: number, seed: number): Rgb {
  const n = noise2(x * 0.09, y * 0.11, seed + 41);
  const speck = hash2(x, y, seed + 43);
  if (speck > 0.985) return C.dirt0;
  if (speck < 0.04) return C.dirt4;
  return n > 0.58 ? C.dirt2 : n > 0.36 ? C.dirt3 : C.dirt4;
}

/** Tilled soil: dark, damp, and cut into furrows you can read from above. */
function soilAt(x: number, y: number, seed: number): Rgb {
  const furrow = (y % 5) as number;
  const speck = hash2(x, y, seed + 61);
  if (furrow === 0) return C.soil2;
  if (furrow === 1) return speck > 0.7 ? C.soil0 : C.soil1;
  if (speck > 0.93) return C.soil0;
  if (speck < 0.12) return C.soil2;
  return C.soil1;
}

/** A walked path: compacted centre, looser gravel toward the edges. */
function pathAt(x: number, y: number, seed: number, field: number): Rgb {
  const n = noise2(x * 0.13, y * 0.15, seed + 23);
  const speck = hash2(x, y, seed + 27);
  // The middle of the path is packed smooth; the shoulders keep their grit.
  const packed = Math.min(1, (field - 0.5) * 3.2);
  // Grit: small stones trodden into the surface. These grey flecks are what
  // stop bare earth reading as a stripe of raw clay.
  if (speck > 0.988) return C.stone2;
  if (speck > 0.968) return C.stone3;
  if (speck > 0.95) return C.dirt1;
  if (speck < 0.05) return C.dirt4;
  const v = n * (0.55 + packed * 0.45);
  return v > 0.5 ? C.dirt2 : v > 0.28 ? C.dirt3 : C.dirt4;
}

/**
 * Flagstone. A jittered grid gives irregular slabs; the joints between them
 * are cut dark, and each slab takes its own tone so the paving never reads as
 * one flat sheet.
 */
function flagstoneAt(x: number, y: number, seed: number): Rgb {
  const cellY = Math.floor(y / 11);
  const offset = (cellY % 2) * 7;
  const cellX = Math.floor((x + offset) / 13);
  const jx = (hash2(cellX, cellY, seed + 77) - 0.5) * 3;
  const jy = (hash2(cellX, cellY, seed + 78) - 0.5) * 3;
  const lx = (x + offset) % 13;
  const ly = y % 11;
  if (lx < 1 + jx || ly < 1 + jy) return C.stone4; // joint
  const tone = hash2(cellX, cellY, seed + 79);
  const grain = hash2(x, y, seed + 80);
  let c: Rgb = tone > 0.72 ? C.stone1 : tone > 0.3 ? C.stone2 : C.stone3;
  if (grain > 0.94) c = C.stone0;
  else if (grain < 0.07) c = C.stone3;
  // Warm the paving toward the earth it is set into, so a stone yard does not
  // read as a slab of concrete dropped into a green field.
  if (grain > 0.34 && grain < 0.56) c = tone > 0.5 ? C.dirt0 : C.dirt1;
  // moss finds the joints first
  if ((lx < 2.5 + jx || ly < 2.5 + jy) && hash2(x, y, seed + 81) > 0.72) c = C.fol5;
  return c;
}

/** The pond bed, seen through the water: pebbles in the shallows, dark below. */
function bedAt(x: number, y: number, seed: number, depth: number): Rgb {
  const speck = hash2(x, y, seed + 57);
  if (depth < 0.28) {
    if (speck > 0.9) return C.stone2;
    return speck > 0.5 ? C.dirt3 : C.dirt4;
  }
  if (depth < 0.62) {
    if (speck > 0.96) return C.stone3;
    return speck > 0.55 ? C.dirt4 : C.soil2;
  }
  return speck > 0.9 ? C.soil2 : C.fol6;
}

/** Shore: pebbly sand drying out away from the water, wet and dark at the line. */
function shoreAt(x: number, y: number, seed: number, t: number): Rgb {
  const speck = hash2(x, y, seed + 55);
  if (speck > 0.97) return C.stone1; // pebbles
  if (speck > 0.93) return C.stone2;
  if (t > 0.75) return speck > 0.5 ? C.dirt3 : C.dirt4; // wet margin
  if (t > 0.4) return speck > 0.6 ? C.dirt1 : C.dirt2;
  return speck > 0.55 ? C.dirt0 : C.dirt1;
}
