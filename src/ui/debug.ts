/**
 * Debug overlay. Toggled with the backquote key and off by default; nothing in
 * here ships enabled, but all of it stays in the build because the moment it
 * is deleted is the moment it is needed.
 */

import { PALETTE } from '../art/palette.ts';
import type { Loop } from '../core/loop.ts';
import type { Player } from '../entities/player.ts';
import type { Particles } from '../systems/particles.ts';
import type { TimeOfDay } from '../systems/time.ts';
import type { Weather } from '../systems/weather.ts';
import type { World } from '../world/world.ts';
import { TILE } from '../world/materials.ts';
import { drawText } from './font.ts';

export class DebugOverlay {
  enabled = false;
  showCollision = false;

  toggle(): void {
    if (!this.enabled) this.enabled = true;
    else if (!this.showCollision) this.showCollision = true;
    else {
      this.enabled = false;
      this.showCollision = false;
    }
  }

  drawWorld(ctx: CanvasRenderingContext2D, world: World, player: Player, camX: number, camY: number): void {
    if (!this.enabled || !this.showCollision) return;
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = PALETTE.red;
    const r = player.collider;
    ctx.fillRect(Math.round(r.x - camX), Math.round(r.y - camY), r.w, r.h);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = PALETTE.violet;
    for (const p of world.props) {
      const c = p.def.collider;
      if (!c) continue;
      const sx = Math.round(p.x + c.dx - camX);
      const sy = Math.round(p.y + c.dy - camY);
      if (sx < -40 || sy < -40 || sx > 520 || sy > 310) continue;
      ctx.fillRect(sx, sy, c.w, c.h);
    }
    const ip = player.interactPoint();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(Math.round(ip.x - camX) - 1, Math.round(ip.y - camY) - 1, 3, 3);
    ctx.globalAlpha = 1;
  }

  drawUi(
    ctx: CanvasRenderingContext2D,
    loop: Loop,
    player: Player,
    world: World,
    clock: TimeOfDay,
    weather: Weather,
    particles: Particles,
    viewW = 480,
  ): void {
    if (!this.enabled) return;
    const lines = [
      `${loop.fps.toFixed(0)} fps   ${loop.frameMs.toFixed(2)} ms`,
      `xy ${player.x.toFixed(1)} ${player.y.toFixed(1)}`,
      `tile ${Math.floor(player.x / TILE)} ${Math.floor(player.y / TILE)}  mat ${world.materialAt(player.x, player.y)}`,
      `spd ${player.speed.toFixed(1)}  ${player.facing}  ${player.anim.current}`,
      `${clock.label}  day ${clock.day}  dark ${clock.darkness.toFixed(2)}`,
      `wind ${weather.wind.toFixed(2)}  particles ${particles.liveCount}`,
      `props ${world.props.length}`,
    ];
    const w = 152;
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = PALETTE.inkCool;
    ctx.fillRect(viewW - w - 4, 4, w, lines.length * 9 + 6);
    ctx.globalAlpha = 1;
    lines.forEach((line, i) => {
      drawText(ctx, line, viewW - w, 8 + i * 9, PALETTE.fol1);
    });
    if (this.showCollision) drawText(ctx, 'collision', viewW - w, 8 + lines.length * 9, PALETTE.orange);
  }
}
