/**
 * MOSSHOLLOW TYPE — a 5x8 bitmap font, drawn by hand.
 *
 * Canvas text rendering is useless at this resolution: it antialiases, so every
 * label would sit on the pixel grid like a smudge. So the game carries its own
 * font. Caps are six rows, lowercase four, with ascenders and true descenders,
 * which gives mixed-case text a readable rhythm at 480x270.
 *
 * Each glyph is eight rows of five columns; '#' is ink, '.' is nothing.
 * Glyphs are rendered to tinted canvases on demand and cached per colour.
 */

import { ctxOf, makeCanvas } from '../art/pixel.ts';

const GW = 5;
const GH = 8;

/** One entry per glyph: eight five-character rows, separated by '|'. */
const GLYPHS: Record<string, string> = {
  ' ': '.....|.....|.....|.....|.....|.....|.....|.....',
  A: '.###.|#...#|#...#|#####|#...#|#...#|.....|.....',
  B: '####.|#...#|####.|#...#|#...#|####.|.....|.....',
  C: '.###.|#...#|#....|#....|#...#|.###.|.....|.....',
  D: '####.|#...#|#...#|#...#|#...#|####.|.....|.....',
  E: '#####|#....|####.|#....|#....|#####|.....|.....',
  F: '#####|#....|####.|#....|#....|#....|.....|.....',
  G: '.###.|#....|#....|#..##|#...#|.####|.....|.....',
  H: '#...#|#...#|#####|#...#|#...#|#...#|.....|.....',
  I: '.###.|..#..|..#..|..#..|..#..|.###.|.....|.....',
  J: '...##|....#|....#|....#|#...#|.###.|.....|.....',
  K: '#...#|#..#.|###..|#..#.|#..#.|#...#|.....|.....',
  L: '#....|#....|#....|#....|#....|#####|.....|.....',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|.....|.....',
  N: '#...#|##..#|#.#.#|#.#.#|#..##|#...#|.....|.....',
  O: '.###.|#...#|#...#|#...#|#...#|.###.|.....|.....',
  P: '####.|#...#|#...#|####.|#....|#....|.....|.....',
  Q: '.###.|#...#|#...#|#.#.#|#..#.|.##.#|.....|.....',
  R: '####.|#...#|#...#|####.|#..#.|#...#|.....|.....',
  S: '.####|#....|.###.|....#|#...#|.###.|.....|.....',
  T: '#####|..#..|..#..|..#..|..#..|..#..|.....|.....',
  U: '#...#|#...#|#...#|#...#|#...#|.###.|.....|.....',
  V: '#...#|#...#|#...#|#...#|.#.#.|..#..|.....|.....',
  W: '#...#|#...#|#.#.#|#.#.#|##.##|#...#|.....|.....',
  X: '#...#|.#.#.|..#..|..#..|.#.#.|#...#|.....|.....',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|.....|.....',
  Z: '#####|....#|...#.|..#..|.#...|#####|.....|.....',
  a: '.....|.....|.###.|....#|.####|#..##|.....|.....',
  b: '#....|#....|####.|#...#|#...#|####.|.....|.....',
  c: '.....|.....|.###.|#....|#....|.###.|.....|.....',
  d: '....#|....#|.####|#...#|#...#|.####|.....|.....',
  e: '.....|.....|.###.|#.###|##...|.###.|.....|.....',
  f: '..##.|.#...|####.|.#...|.#...|.#...|.....|.....',
  g: '.....|.....|.####|#...#|.####|....#|####.|.....',
  h: '#....|#....|####.|#...#|#...#|#...#|.....|.....',
  i: '..#..|.....|.##..|..#..|..#..|.###.|.....|.....',
  j: '...#.|.....|..##.|...#.|...#.|...#.|#..#.|.##..',
  k: '#....|#....|#..#.|###..|#.#..|#..#.|.....|.....',
  l: '.##..|..#..|..#..|..#..|..#..|.###.|.....|.....',
  m: '.....|.....|##.#.|#.#.#|#.#.#|#...#|.....|.....',
  n: '.....|.....|####.|#...#|#...#|#...#|.....|.....',
  o: '.....|.....|.###.|#...#|#...#|.###.|.....|.....',
  p: '.....|.....|####.|#...#|#...#|####.|#....|#....',
  q: '.....|.....|.####|#...#|#...#|.####|....#|....#',
  r: '.....|.....|#.##.|##..#|#....|#....|.....|.....',
  s: '.....|.....|.####|##...|...##|####.|.....|.....',
  t: '.#...|.#...|####.|.#...|.#...|..##.|.....|.....',
  u: '.....|.....|#...#|#...#|#...#|.####|.....|.....',
  v: '.....|.....|#...#|#...#|.#.#.|..#..|.....|.....',
  w: '.....|.....|#...#|#.#.#|#.#.#|.#.#.|.....|.....',
  x: '.....|.....|#...#|.#.#.|.#.#.|#...#|.....|.....',
  y: '.....|.....|#...#|#...#|.####|....#|####.|.....',
  z: '.....|.....|#####|...#.|.#...|#####|.....|.....',
  '0': '.###.|#..##|#.#.#|#.#.#|##..#|.###.|.....|.....',
  '1': '..#..|.##..|..#..|..#..|..#..|.###.|.....|.....',
  '2': '.###.|#...#|....#|..##.|.#...|#####|.....|.....',
  '3': '####.|....#|..##.|....#|#...#|.###.|.....|.....',
  '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|.....|.....',
  '5': '#####|#....|####.|....#|#...#|.###.|.....|.....',
  '6': '..##.|.#...|#....|####.|#...#|.###.|.....|.....',
  '7': '#####|....#|...#.|..#..|.#...|.#...|.....|.....',
  '8': '.###.|#...#|.###.|#...#|#...#|.###.|.....|.....',
  '9': '.###.|#...#|#...#|.####|....#|.##..|.....|.....',
  '.': '.....|.....|.....|.....|.....|..#..|.....|.....',
  ',': '.....|.....|.....|.....|.....|..#..|..#..|.#...',
  ':': '.....|.....|..#..|.....|.....|..#..|.....|.....',
  ';': '.....|.....|..#..|.....|.....|..#..|..#..|.#...',
  '!': '..#..|..#..|..#..|..#..|.....|..#..|.....|.....',
  '?': '.###.|#...#|...#.|..#..|.....|..#..|.....|.....',
  "'": '..#..|..#..|.....|.....|.....|.....|.....|.....',
  '"': '.#.#.|.#.#.|.....|.....|.....|.....|.....|.....',
  '-': '.....|.....|.....|.###.|.....|.....|.....|.....',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....|.....',
  '=': '.....|.....|#####|.....|#####|.....|.....|.....',
  '/': '....#|...#.|..#..|..#..|.#...|#....|.....|.....',
  '(': '...#.|..#..|.#...|.#...|..#..|...#.|.....|.....',
  ')': '.#...|..#..|...#.|...#.|..#..|.#...|.....|.....',
  '[': '.###.|.#...|.#...|.#...|.#...|.###.|.....|.....',
  ']': '.###.|...#.|...#.|...#.|...#.|.###.|.....|.....',
  '*': '.....|#.#.#|.###.|#####|.###.|#.#.#|.....|.....',
  '%': '#...#|...#.|..#..|..#..|.#...|#...#|.....|.....',
  '&': '.##..|#..#.|.##..|#.#.#|#..#.|.##.#|.....|.....',
  '#': '.#.#.|#####|.#.#.|.#.#.|#####|.#.#.|.....|.....',
  '<': '...#.|..#..|.#...|.#...|..#..|...#.|.....|.....',
  '>': '.#...|..#..|...#.|...#.|..#..|.#...|.....|.....',
  '~': '.....|.....|.##.#|#..#.|.....|.....|.....|.....',
  '•': '.....|.....|.##..|.##..|.....|.....|.....|.....',
  // Used as a separator in the HUD and menus. Without it the font's fallback
  // renders a question mark, which is how "Mosshollow · Day 1" spent a while
  // reading as "Mosshollow ? Day 1".
  '·': '.....|.....|.....|..#..|.....|.....|.....|.....',
  '—': '.....|.....|.....|#####|.....|.....|.....|.....',
};

/** Per-glyph advance width, trimmed so text does not look gappy. */
const ADVANCE: Record<string, number> = { ' ': 3, i: 3, j: 4, l: 4, '.': 2, ',': 3, ':': 2, ';': 3, "'": 2, '!': 2, I: 4, '-': 4, '·': 2 };

const cache = new Map<string, HTMLCanvasElement>();

function glyphSheet(color: string): HTMLCanvasElement {
  const hit = cache.get(color);
  if (hit) return hit;
  const keys = Object.keys(GLYPHS);
  const sheet = makeCanvas(keys.length * GW, GH);
  const ctx = ctxOf(sheet);
  ctx.fillStyle = color;
  keys.forEach((key, index) => {
    const rows = GLYPHS[key].split('|');
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '#') ctx.fillRect(index * GW + x, y, 1, 1);
      }
    }
  });
  cache.set(color, sheet);
  return sheet;
}

const INDEX: Record<string, number> = {};
Object.keys(GLYPHS).forEach((k, i) => {
  INDEX[k] = i;
});

/**
 * Characters asked for that the font does not have. They render as '?', which
 * is visible but easy to miss in a screenshot — so in development each one is
 * reported the first time it is used. A UI that quietly says "Day ? 1" is the
 * kind of thing that ships.
 */
const missing = new Set<string>();

function noteMissing(ch: string): void {
  if (missing.has(ch)) return;
  missing.add(ch);
  console.warn(
    `[font] no glyph for ${JSON.stringify(ch)} (U+${ch.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}) — rendering '?'`,
  );
}

export function charWidth(ch: string): number {
  return (ADVANCE[ch] ?? GW) + 1;
}

export function textWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch);
  return Math.max(0, w - 1);
}

export const LINE_HEIGHT = 10;

/** Draw a single line. Returns the width drawn. */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
): number {
  const sheet = glyphSheet(color);
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const ch of text) {
    let idx = INDEX[ch];
    if (idx === undefined) {
      if (import.meta.env.DEV) noteMissing(ch);
      idx = INDEX['?'];
    }
    ctx.drawImage(sheet, idx * GW, 0, GW, GH, cx, cy, GW, GH);
    cx += charWidth(ch);
  }
  return cx - Math.round(x) - 1;
}

/**
 * Draw text with a one-pixel drop shadow. Almost every label in the game uses
 * this — over a busy world, unshadowed text is unreadable no matter how good
 * the letterforms are.
 */
export function drawTextShadowed(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  shadow = '#2b2029',
): number {
  drawText(ctx, text, x, y + 1, shadow);
  return drawText(ctx, text, x, y, color);
}

/** Greedy word wrap. Returns the lines; does not draw. */
export function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}
