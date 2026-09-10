/**
 * The tile the player is about to act on.
 *
 * Four corner brackets rather than a full outline: a closed box reads as a
 * selection cursor from a strategy game, while corners read as "this square,
 * lightly" and leave the art underneath visible. It only appears when the
 * action would actually do something, so the highlight itself is the prompt —
 * no text needed.
 */

import { PALETTE } from '../art/palette.ts';
import { TILE } from '../world/materials.ts';

export type TargetKind = 'till' | 'water' | 'plant' | 'harvest' | 'clear' | null;

const COLOR: Record<Exclude<TargetKind, null>, string> = {
  till: PALETTE.cream0,
  water: PALETTE.water0,
  plant: PALETTE.fol1,
  harvest: PALETTE.gold,
  clear: PALETTE.stone1,
};

export function drawTarget(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  camX: number,
  camY: number,
  kind: TargetKind,
  time: number,
): void {
  if (!kind) return;
  const x = tx * TILE - camX;
  const y = ty * TILE - camY;
  // A slow breath, never a blink — this sits on screen the whole time you are
  // standing in front of something.
  const pulse = 0.45 + 0.2 * Math.sin(time * 3.4);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = COLOR[kind];
  const L = 4;
  // top-left
  ctx.fillRect(x, y, L, 1);
  ctx.fillRect(x, y, 1, L);
  // top-right
  ctx.fillRect(x + TILE - L, y, L, 1);
  ctx.fillRect(x + TILE - 1, y, 1, L);
  // bottom-left
  ctx.fillRect(x, y + TILE - 1, L, 1);
  ctx.fillRect(x, y + TILE - L, 1, L);
  // bottom-right
  ctx.fillRect(x + TILE - L, y + TILE - 1, L, 1);
  ctx.fillRect(x + TILE - 1, y + TILE - L, 1, L);
  ctx.globalAlpha = 1;
}
