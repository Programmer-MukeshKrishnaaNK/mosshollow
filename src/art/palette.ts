/**
 * THE PALETTE
 *
 * Every pixel in Mosshollow comes from this list. Nothing else is allowed to
 * invent a colour. That single rule is what keeps a hand-authored world
 * looking like one game instead of a pile of assets.
 *
 * Each material is a ramp from light to dark, and every ramp is hue-shifted:
 * highlights drift toward warm yellow (sunlight), shadows drift toward cool
 * blue (skylight bouncing into shade). Flat value-only ramps are the single
 * biggest tell of amateur pixel art, so there are none here.
 *
 * Outlines are never pure black — #2b2029 is a warm near-black that sits in
 * the same world as the rest of the colours.
 */

export const PALETTE = {
  // --- foliage: leaves, grass blades, canopies ---------------------------
  fol0: '#e8ec9a', // sun through leaves
  fol1: '#c2dc74',
  fol2: '#93c45c',
  fol3: '#69a44a',
  fol4: '#4a833f',
  fol5: '#356234',
  fol6: '#22412a', // deep canopy shadow, blue-shifted

  // --- earth: paths, cliff faces, bare ground ---------------------------
  dirt0: '#d6b183',
  dirt1: '#b98c5e',
  dirt2: '#96683f',
  dirt3: '#6f4a2d',
  dirt4: '#4b3122',

  // --- stone: walls, rocks, markers -------------------------------------
  stone0: '#dcd9c8',
  stone1: '#b3b1a2',
  stone2: '#87877e',
  stone3: '#5e6062',
  stone4: '#3d4148',

  // --- worked wood: fences, beams, crates -------------------------------
  wood0: '#c9945c',
  wood1: '#9c6b3f',
  wood2: '#6f4a2c',
  wood3: '#48301f',

  // --- water -------------------------------------------------------------
  water0: '#cdf0ea', // foam
  water1: '#7fcfd6',
  water2: '#4ba3bd',
  water3: '#2f7396',
  water4: '#204a6e',

  // --- tilled soil --------------------------------------------------------
  soil0: '#7a5335',
  soil1: '#5d3e28',
  soil2: '#422c1d',

  // --- people -------------------------------------------------------------
  skin0: '#f6d3ac',
  skin1: '#dda87c',
  skin2: '#ac7752',
  hair0: '#8e5c3f',
  hair1: '#6b4430',
  hair2: '#412718',

  // cloth A — the player's coat, a muted valley teal
  clothA0: '#5b8fbd',
  clothA1: '#3f6a97',
  clothA2: '#2b4a6e',
  // cloth B — warm terracotta, the accent that ties characters to the earth
  clothB0: '#d97f57',
  clothB1: '#b05a3c',
  clothB2: '#7d3b28',

  cream0: '#f4efdc',
  cream1: '#d9d0b4',
  metal0: '#c8ccd4',
  metal1: '#7d8593',

  // --- accents: used sparingly, so they always mean something -------------
  red: '#e0574c',
  orange: '#f0983e',
  gold: '#ffd884',
  pink: '#eda3c0',
  violet: '#9b7ad0',
  white: '#fdfbf0',
  glass0: '#a9d3e0', // cold daytime window
  glass1: '#3c5068', // unlit interior
  lamp: '#ffbe63', // the one colour reserved for living light

  // --- outlines ------------------------------------------------------------
  ink: '#2b2029', // warm near-black, default contour
  inkCool: '#1b1f2b', // cool near-black, for stone and night-side edges
} as const;

export type PaletteKey = keyof typeof PALETTE;

/**
 * Single-character aliases used when authoring sprites as text. Grouped by
 * material so a sprite reads like a material map, not a code.
 *
 *   1-7  foliage (light to dark)     q w e r t  earth
 *   a s d f g  stone                 z x c v    wood
 *   b h j y u  water                 o p l      tilled soil
 *   A B C  skin      H J L  hair     Q W E  teal cloth   R T Y  warm cloth
 *   N M  cream       G V  metal      k K  outlines
 */
export const CHARS: Record<string, PaletteKey> = {
  '1': 'fol0', '2': 'fol1', '3': 'fol2', '4': 'fol3', '5': 'fol4', '6': 'fol5', '7': 'fol6',
  q: 'dirt0', w: 'dirt1', e: 'dirt2', r: 'dirt3', t: 'dirt4',
  a: 'stone0', s: 'stone1', d: 'stone2', f: 'stone3', g: 'stone4',
  z: 'wood0', x: 'wood1', c: 'wood2', v: 'wood3',
  b: 'water0', h: 'water1', j: 'water2', y: 'water3', u: 'water4',
  o: 'soil0', p: 'soil1', l: 'soil2',
  A: 'skin0', B: 'skin1', C: 'skin2',
  H: 'hair0', J: 'hair1', L: 'hair2',
  Q: 'clothA0', W: 'clothA1', E: 'clothA2',
  R: 'clothB0', T: 'clothB1', Y: 'clothB2',
  N: 'cream0', M: 'cream1',
  G: 'metal0', V: 'metal1',
  X: 'red', O: 'orange', I: 'gold', P: 'pink', Z: 'violet', F: 'white',
  S: 'glass0', D: 'glass1', U: 'lamp',
  k: 'ink', K: 'inkCool',
};

/** Resolve an authoring character to a CSS colour, or null for transparent. */
export function charToColor(ch: string): string | null {
  if (ch === '.' || ch === ' ' || ch === ',') return null;
  const key = CHARS[ch];
  if (!key) throw new Error(`Unknown palette character: "${ch}"`);
  return PALETTE[key];
}

/** Parse "#rrggbb" once, for tinting and lighting maths. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToCss(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export function mixHex(a: string, b: string, t: number): [number, number, number] {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return [ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t];
}
