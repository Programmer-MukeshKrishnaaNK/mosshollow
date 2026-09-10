/**
 * ORGANIC PROP GENERATOR
 *
 * Canopies, bushes and boulders are all the same problem: a lumpy mass that
 * needs to read as rounded volume, sit in the same light as everything else,
 * and never look like the lump standing next to it.
 *
 * Rather than hand-authoring a dozen near-identical trees, one shading model
 * builds all of them from overlapping spherical clumps. Every prop is lit by
 * the same vector, quantised to the same palette ramp and outlined the same
 * way, so a boulder and an oak look like they grew in the same valley — while
 * the seed keeps any two of them from being twins.
 */

import { hash2, makeRng, noise2, randRange, type Rng } from '../core/rng.ts';
import { PALETTE, hexToRgb, type PaletteKey } from './palette.ts';
import { ctxOf, makeCanvas, type Sprite } from './pixel.ts';

/** The single light direction the whole game is lit by: high, front-left. */
const LIGHT: [number, number, number] = [-0.44, -0.62, 0.65];

interface Clump {
  x: number;
  y: number;
  r: number;
}

export interface BlobOptions {
  w: number;
  h: number;
  seed: number;
  /** Light-to-dark ramp. Five or six entries reads best. */
  ramp: readonly PaletteKey[];
  outline?: PaletteKey;
  /** Sparse top-left sparkle, e.g. sun catching the outer leaves. */
  rim?: PaletteKey;
  rimAmount?: number;
  /** How many spherical masses make up the silhouette. */
  clumpCount?: number;
  clumpRadius?: [number, number];
  /** Silhouette envelope the clump centres are scattered inside. */
  envelope?: [number, number];
  /** Pushes shading darker toward the bottom — contact shadow under the mass. */
  grounding?: number;
  /** Breaks up the quantisation bands so they never look like contour lines. */
  grain?: number;
  /** Flattens the blob vertically; boulders sit, canopies dome. */
  squash?: number;
  /**
   * Perturbs each clump's radius per pixel. A clean spherical edge reads as a
   * balloon; a ragged one reads as foliage. Keep it near zero for stone.
   */
  ragged?: number;
  /** Frequency of that perturbation — small values give big lobes. */
  raggedScale?: number;
  /**
   * Darkens pixels near the edge of whichever clump owns them, which cuts
   * creases between overlapping masses so the lumps read separately.
   */
  crease?: number;
  /**
   * Skews where the mass sits in its ramp. Above 1 pushes it darker, which is
   * what foliage needs: a canopy lit evenly across the whole ramp goes pale
   * and stops reading against the grass behind it.
   */
  bias?: number;
}

export function makeBlob(opts: BlobOptions): Sprite {
  const {
    w,
    h,
    seed,
    ramp,
    outline = 'ink',
    rim,
    rimAmount = 0.1,
    clumpCount = 7,
    clumpRadius = [w * 0.18, w * 0.3],
    envelope = [w * 0.34, h * 0.3],
    grounding = 0.35,
    grain = 0.07,
    squash = 1,
    ragged = 0,
    raggedScale = 0.22,
    crease = 0,
    bias = 1,
  } = opts;

  const rng = makeRng(seed);
  const clumps = scatterClumps(rng, w, h, clumpCount, clumpRadius, envelope, squash);
  const mask = new Float32Array(w * h); // 0 outside, >0 inside
  const shade = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = -Infinity;
      let bestLambert = 0;
      // One noise lookup per pixel, shared by every clump, so a lobe of leaves
      // bulges or bites in consistently rather than each clump fraying alone.
      const wobble = ragged > 0
        ? 1 + (noise2(x * raggedScale, y * raggedScale, seed + 313) - 0.5) * ragged
        : 1;
      for (const c of clumps) {
        const nx = (x + 0.5 - c.x) / (c.r * wobble);
        const ny = ((y + 0.5 - c.y) / (c.r * wobble)) * squash;
        const d2 = nx * nx + ny * ny;
        if (d2 >= 1) continue;
        // Treat each clump as a sphere and light it properly, so the mass
        // reads as a bunch of rounded volumes instead of a flat cutout.
        const nz = Math.sqrt(1 - d2);
        const lam = -(nx * LIGHT[0] + ny * LIGHT[1]) * 0.5 + nz * LIGHT[2];
        const depth = nz;
        if (depth > best) {
          best = depth;
          bestLambert = lam;
        }
      }
      if (best === -Infinity) continue;
      const i = y * w + x;
      mask[i] = 1;
      // Blend the per-clump lighting with a global top-down gradient so the
      // whole mass still has one overall light, not seven independent ones.
      const heightTerm = 1 - y / h;
      let v = bestLambert * 0.62 + heightTerm * 0.38;
      v -= (y / h) * grounding;
      // Crease: the further this pixel is from the centre of the clump that
      // owns it, the deeper into shadow it falls. Where two clumps meet, both
      // are near their edges, so a dark seam appears between them.
      if (crease > 0) v -= (1 - Math.min(1, best / 0.55)) * crease;
      v += (hash2(x, y, seed) - 0.5) * grain;
      shade[i] = v;
    }
  }

  // Normalise so every prop uses the full ramp regardless of its proportions.
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < shade.length; i++) {
    if (!mask[i]) continue;
    if (shade[i] < lo) lo = shade[i];
    if (shade[i] > hi) hi = shade[i];
  }
  const span = Math.max(0.0001, hi - lo);

  const canvas = makeCanvas(w, h);
  const ctx = ctxOf(canvas);
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const rgbRamp = ramp.map((k) => hexToRgb(PALETTE[k]));
  const inkRgb = hexToRgb(PALETTE[outline]);
  const rimRgb = rim ? hexToRgb(PALETTE[rim]) : null;

  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const t = bias === 1 ? (shade[i] - lo) / span : Math.pow((shade[i] - lo) / span, bias);
    // t = 1 is the brightest point, so index from the light end of the ramp.
    let band = Math.floor((1 - t) * ramp.length);
    if (band < 0) band = 0;
    if (band >= ramp.length) band = ramp.length - 1;
    const c = rgbRamp[band];
    const o = i * 4;
    data[o] = c[0];
    data[o + 1] = c[1];
    data[o + 2] = c[2];
    data[o + 3] = 255;
  }

  // Rim light: a few pixels on the upper-left silhouette catch the sun.
  if (rimRgb) {
    for (let y = 1; y < h; y++) {
      for (let x = 1; x < w; x++) {
        const i = y * w + x;
        if (!mask[i]) continue;
        const exposed = !mask[i - 1] || !mask[i - w];
        if (!exposed) continue;
        // Only the top half, and only the side the sun is actually on.
        if (y > h * 0.55) continue;
        if (hash2(x, y, seed + 91) > rimAmount) continue;
        const o = i * 4;
        data[o] = rimRgb[0];
        data[o + 1] = rimRgb[1];
        data[o + 2] = rimRgb[2];
      }
    }
  }

  // Contour: every transparent pixel touching the mass becomes outline.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mask[i]) continue;
      const touching =
        (x > 0 && mask[i - 1]) ||
        (x < w - 1 && mask[i + 1]) ||
        (y > 0 && mask[i - w]) ||
        (y < h - 1 && mask[i + w]);
      if (!touching) continue;
      const o = i * 4;
      data[o] = inkRgb[0];
      data[o + 1] = inkRgb[1];
      data[o + 2] = inkRgb[2];
      data[o + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return { canvas, w, h, ox: Math.floor(w / 2), oy: h };
}

function scatterClumps(
  rng: Rng,
  w: number,
  h: number,
  count: number,
  radius: [number, number],
  envelope: [number, number],
  squash: number,
): Clump[] {
  const clumps: Clump[] = [];
  const cx = w / 2;
  const cy = h / 2;
  // One dominant central mass keeps the silhouette from turning into soup;
  // the rest ring it to break up the outline.
  clumps.push({ x: cx, y: cy - h * 0.04, r: radius[1] * 1.05 });
  for (let i = 1; i < count; i++) {
    const a = (i / (count - 1)) * Math.PI * 2 + rng() * 0.8;
    const rad = randRange(rng, 0.45, 1) ;
    const x = cx + Math.cos(a) * envelope[0] * rad;
    const y = cy + (Math.sin(a) * envelope[1] * rad) / squash;
    clumps.push({ x, y, r: randRange(rng, radius[0], radius[1]) });
  }
  return clumps;
}

/** The foliage ramp, light to dark. Shared by every leafy thing in the game. */
export const FOLIAGE_RAMP: PaletteKey[] = ['fol1', 'fol2', 'fol3', 'fol4', 'fol5', 'fol6'];
export const STONE_RAMP: PaletteKey[] = ['stone0', 'stone1', 'stone2', 'stone3', 'stone4'];
