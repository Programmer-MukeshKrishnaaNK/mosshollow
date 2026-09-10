/**
 * DEV TOOL — the art sheet.
 *
 * Served at /art.html?p=N. Draws the game's sprites into one fixed 1280x720
 * canvas at whole-number zoom, so a screenshot of it lands on exact pixel
 * boundaries and the art can actually be judged. Paged, because at a useful
 * zoom the assets do not fit on one screen.
 *
 * Not part of the game build path — nothing imports it.
 */

import './style.css';
import { PALETTE } from './art/palette.ts';
import { ctxOf, makeCanvas, mirrored, sprite, type Sprite } from './art/pixel.ts';
import { buildFarmhouse } from './art/building.ts';
import * as P from './art/player.art.ts';
import { buildProps, type PropDef } from './world/props.ts';
import { drawText } from './ui/font.ts';
import { buildSoilTiles } from './art/soil.ts';
import { Player } from './entities/player.ts';
import { Input } from './core/input.ts';
import { BELLROOT, EMBERWHEAT } from './art/crops.art.ts';

const W = 1280;
const H = 720;

const page = Number(new URLSearchParams(location.search).get('p') ?? 1);

const canvas = makeCanvas(W, H);
canvas.style.cssText = 'position:fixed;left:0;top:0;width:1280px;height:720px;image-rendering:pixelated';
document.body.appendChild(canvas);
document.body.style.cssText = 'margin:0;overflow:hidden;background:#141119';
const ctx = ctxOf(canvas);
ctx.fillStyle = '#141119';
ctx.fillRect(0, 0, W, H);

function label(text: string, x: number, y: number, color = '#93c45c'): void {
  drawText(ctx, text, x, y, color);
}

/** Draw a sprite at `zoom`, on a swatch of ground, with a caption. */
function tile(spr: Sprite, x: number, y: number, zoom: number, caption: string, bg: string): number {
  const w = spr.w * zoom;
  const h = spr.h * zoom;
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spr.canvas, 0, 0, spr.w, spr.h, x, y, w, h);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  label(caption, x, y + h + 3, '#7d8593');
  return w;
}

function composed(def: PropDef): Sprite {
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  for (const l of def.layers) {
    minX = Math.min(minX, l.dx);
    minY = Math.min(minY, l.dy);
    maxX = Math.max(maxX, l.dx + l.sprite.w);
    maxY = Math.max(maxY, l.dy + l.sprite.h);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const c = makeCanvas(w, h);
  const cx = ctxOf(c);
  for (const l of def.layers) cx.drawImage(l.sprite.canvas, l.dx - minX, l.dy - minY);
  return { canvas: c, w, h, ox: -minX, oy: -minY };
}

const GRASS = PALETTE.fol3;
const EARTH = PALETTE.dirt2;

if (page === 1) {
  label('THE KEEPER — 8x, on grass then on earth', 8, 8);
  const frames: [string, Sprite][] = [
    ['down', sprite(P.DOWN_PASS)],
    ['down A', sprite(P.DOWN_STEP_A)],
    ['down B', sprite(P.DOWN_STEP_B)],
    ['up', sprite(P.UP_PASS)],
    ['up A', sprite(P.UP_STEP_A)],
    ['up B', sprite(P.UP_STEP_B)],
    ['side', sprite(P.SIDE_PASS)],
    ['side A', sprite(P.SIDE_STEP_A)],
    ['side B', sprite(P.SIDE_STEP_B)],
    ['flipped', mirrored(sprite(P.SIDE_PASS))],
  ];
  frames.forEach(([name, spr], i) => {
    tile(spr, i * 128, 22, 8, name, GRASS);
    tile(spr, i * 128, 22 + 192 + 18, 8, name, EARTH);
  });

  label('TYPE', 8, 452);
  ctx.fillStyle = PALETTE.cream1;
  ctx.fillRect(8, 466, 700, 92);
  drawText(ctx, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 14, 472, PALETTE.wood3);
  drawText(ctx, 'abcdefghijklmnopqrstuvwxyz', 14, 484, PALETTE.wood3);
  drawText(ctx, '0123456789 .,:;!?\'"-+=/()[]', 14, 496, PALETTE.wood3);
  drawText(ctx, 'The valley remembers.  Day 4, 6:40 am', 14, 512, PALETTE.wood3);
  drawText(ctx, 'Quick brown foxes jumped over lazy dogs', 14, 528, PALETTE.wood2);
  // and again at 3x, to check the letterforms themselves
  const t = makeCanvas(240, 40);
  const tc = ctxOf(t);
  tc.fillStyle = PALETTE.cream1;
  tc.fillRect(0, 0, 240, 40);
  drawText(tc, 'Abgjpqy 0123 Mosshollow', 3, 4, PALETTE.wood3);
  drawText(tc, 'the valley remembers', 3, 18, PALETTE.wood3);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(t, 0, 0, 240, 40, 728, 466, 240 * 2, 40 * 2);

  label('PALETTE', 8, 580);
  Object.entries(PALETTE).forEach(([name, hex], i) => {
    const x = 8 + (i % 26) * 48;
    const y = 594 + Math.floor(i / 26) * 44;
    ctx.fillStyle = hex;
    ctx.fillRect(x, y, 44, 26);
    label(name.slice(0, 7), x, y + 28, '#6b7280');
  });
}

if (page === 2) {
  label('FARMHOUSE — 6x', 8, 8);
  tile(buildFarmhouse(1).sprite, 8, 22, 6, 'farmhouse', PALETTE.fol4);
  const defs = buildProps();
  label('TREES — 5x', 660, 8);
  ['oak0', 'oak1', 'birch0'].forEach((id, i) => {
    tile(composed(defs[id]), 660 + i * 200, 22, 5, id, GRASS);
  });
}

if (page === 3) {
  const defs = buildProps();
  const ids = Object.keys(defs).filter((k) => !k.startsWith('oak') && !k.startsWith('birch'));
  label('PROPS — 5x', 8, 8);
  let x = 8;
  let y = 22;
  let rowH = 0;
  for (const id of ids) {
    const spr = composed(defs[id]);
    const w = spr.w * 5;
    const h = spr.h * 5;
    if (x + w > W - 8) {
      x = 8;
      y += rowH + 20;
      rowH = 0;
    }
    tile(spr, x, y, 5, id, GRASS);
    x += w + 14;
    rowH = Math.max(rowH, h);
  }
}

if (page === 4) {
  label('CROPS — 5x, dry soil then wet', 8, 8);
  const soil = buildSoilTiles();
  const stages = [BELLROOT, EMBERWHEAT];
  const names = ['bellroot', 'emberwheat'];
  stages.forEach((crop, row) => {
    crop.forEach((map, i) => {
      const spr = sprite(map, 8, map.length);
      const x = 8 + i * 130;
      const y = 24 + row * 230;
      // Draw it standing in its furrow, which is the only way to judge it.
      const bed = makeCanvas(16, 24);
      const bc = ctxOf(bed);
      bc.drawImage(soil[row === 0 ? 'dry' : 'wet'][i % 4], 0, 8);
      bc.drawImage(spr.canvas, 0, 24 - spr.h - 6);
      tile({ canvas: bed, w: 16, h: 24, ox: 8, oy: 24 }, x, y, 5, `${names[row]} ${i}`, GRASS);
    });
  });
  label('SOIL — 8x, four dry variants then four wet', 8, 470);
  soil.dry.forEach((c, i) => tile({ canvas: c, w: 16, h: 16, ox: 0, oy: 0 }, 8 + i * 140, 486, 8, `dry ${i}`, GRASS));
  soil.wet.forEach((c, i) => tile({ canvas: c, w: 16, h: 16, ox: 0, oy: 0 }, 600 + i * 140, 486, 8, `wet ${i}`, GRASS));
}

if (page === 5) {
  // A real filmstrip: an actual Player is driven through a real swing and
  // drawn every few frames. Judging animation from static poses is guesswork —
  // what matters is the spacing between them.
  const strip = (tool: 'hoe' | 'can' | 'axe' | 'pick', facing: 'down' | 'right' | 'up', y: number): void => {
    label(`${tool} — facing ${facing}`, 8, y - 12);
    const p = new Player(24, 40);
    p.facing = facing;
    p.useTool(tool);
    const input = new Input(new EventTarget());
    const noBlock = (): boolean => false;
    let t = 0;
    const shots = 11;
    // Sample evenly across the whole swing so the strip shows its real timing.
    const total = tool === 'can' ? 0.76 : tool === 'hoe' ? 0.53 : 0.65;
    const stepDt = total / (shots - 1);
    for (let i = 0; i < shots; i++) {
      const cell = makeCanvas(40, 48);
      const cc = ctxOf(cell);
      cc.fillStyle = GRASS;
      cc.fillRect(0, 0, 40, 48);
      // The player draws in world space; offset the camera to centre it.
      p.draw(cc, 24 - 20, 40 - 40);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(cell, 0, 0, 40, 48, 8 + i * 114, y, 40 * 2.8, 48 * 2.8);
      ctx.strokeStyle = '#000';
      ctx.strokeRect(8 + i * 114 + 0.5, y + 0.5, 40 * 2.8 - 1, 48 * 2.8 - 1);
      label(`${(t * 1000).toFixed(0)}ms`, 8 + i * 114, y + 48 * 2.8 + 4, '#7d8593');
      // advance
      const sub = 4;
      for (let k = 0; k < sub; k++) p.update(stepDt / sub, input, noBlock, t + (k * stepDt) / sub);
      t += stepDt;
    }
  };
  strip('axe', 'right', 24);
  strip('pick', 'right', 214);
  strip('hoe', 'down', 404);
  strip('can', 'down', 594);
}

// Page links, so the next screenshot can just navigate.
label(`page ${page} of 5   —   /art.html?p=1..5`, 8, H - 12, '#4a833f');
