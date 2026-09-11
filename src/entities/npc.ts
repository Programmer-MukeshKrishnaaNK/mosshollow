/**
 * AN NPC
 *
 * Deliberately thin. It owns a position, a facing, an Animator and a target,
 * and that is the whole of it — the schedule lives in data, the decision about
 * where to be lives in `systems/village.ts`, and the drawing goes through the
 * world's existing depth-sorted pass.
 *
 * It is shaped to be a `Drawable` with `shadowX/shadowY/shadowW`, which is the
 * exact shape `playerDrawable` already has. That is not a coincidence: it
 * means an NPC joins the sorted list, gets its shadow laid down in the
 * shadows-first pass with the sun's own direction, interleaves correctly with
 * trees, crops, the player and particles, and needs not one line of change in
 * `world.ts`.
 *
 * Pathing is an L. Out to the lane, along the lane, in to the target. Bell Row
 * is one corridor with things on either side of it, so a search would only be
 * a more expensive way to produce the same route with more ways to fail.
 */

import { mirrored, sprite, type PixelMap, type Sprite } from '../art/pixel.ts';
import { Animator, type Clip } from './animator.ts';
import type { Act, NpcDef } from '../data/npcs.ts';
import type { Facing } from './player.ts';

export interface NpcArt {
  down: PixelMap[];
  side: PixelMap[];
  up: PixelMap[];
  poses: Partial<Record<Act, PixelMap[]>>;
}

const CLIPS: Record<string, Clip> = {
  idle: { frames: [0], fps: 1, loop: true },
  // The same [A, pass, B, pass] the player uses, with the pass frames lifted a
  // pixel by the animator. Without that lift a walk slides instead of walking,
  // and an NPC without it beside a player with it looks broken.
  walk: { frames: [1, 0, 2, 0], fps: 8, loop: true, offsets: [0, -1, 0, -1], events: [0, 2] },
  sweep: { frames: [0, 1, 0, 1], fps: 5, loop: true, offsets: [0, 0, 0, -1], events: [1] },
  work: { frames: [0, 1], fps: 3, loop: true, events: [1] },
  sit: { frames: [0], fps: 1, loop: true },
  lean: { frames: [0], fps: 1, loop: true },
  tend: { frames: [0, 1], fps: 2, loop: true },
};

export class Npc {
  readonly def: NpcDef;
  x = 0;
  y = 0;
  facing: Facing = 'down';
  /** Indoors. Still simulated, simply not drawn and not talkable. */
  hidden = false;
  act: Act = 'idle';
  /** Where the schedule wants them. Null once they have arrived. */
  private target: { x: number; y: number } | null = null;
  private route: { x: number; y: number }[] = [];
  private anim: Animator;
  private walkSets: Record<Facing, Sprite[]>;
  private poseSets: Partial<Record<Act, Sprite[]>>;
  private bob = 0;
  onFootstep: ((x: number, y: number) => void) | null = null;
  onWorkBeat: ((x: number, y: number) => void) | null = null;

  constructor(def: NpcDef, art: NpcArt) {
    this.def = def;
    const mk = (m: PixelMap): Sprite => sprite(m, 8, 23);
    const right = art.side.map(mk);
    this.walkSets = {
      down: art.down.map(mk),
      up: art.up.map(mk),
      right,
      left: right.map(mirrored),
    };
    this.poseSets = {};
    for (const [k, maps] of Object.entries(art.poses)) {
      if (maps) this.poseSets[k as Act] = maps.map(mk);
    }
    this.anim = new Animator(CLIPS, 'idle');
    this.anim.onEvent = (clip) => {
      if (clip === 'walk') this.onFootstep?.(this.x, this.y);
      else if (clip === 'work') this.onWorkBeat?.(this.x, this.y);
    };
    // Each of them walks at their own rate. It is one number and it is most of
    // what tells them apart at a distance.
    this.anim.rate = def.fps / 8;
  }

  get sortY(): number { return this.y; }
  get shadowX(): number { return this.x; }
  get shadowY(): number { return this.y; }
  get shadowW(): number { return this.def.box.w + 2; }

  get walking(): boolean { return this.route.length > 0 || this.target !== null; }

  /** Feet box, for the player's collision query. */
  rect(): { x: number; y: number; w: number; h: number } {
    const b = this.def.box;
    return { x: this.x - b.w / 2, y: this.y - b.h, w: b.w, h: b.h };
  }

  /** Drop them somewhere with no walking — used when an area is first entered. */
  placeAt(x: number, y: number, act: Act, facing: Facing = 'down'): void {
    this.x = x;
    this.y = y;
    this.facing = facing;
    this.route.length = 0;
    this.target = null;
    this.setAct(act);
  }

  /**
   * Send them somewhere. `corridorY` is the lane: they leave whatever they are
   * standing beside, travel along it, and turn in at the far end.
   */
  goTo(x: number, y: number, corridorY: number, act: Act): void {
    this.act = act;
    const near = Math.abs(this.x - x) < 1.5 && Math.abs(this.y - y) < 1.5;  // pixels
    if (near) {
      this.route.length = 0;
      this.target = null;
      this.setAct(act);
      return;
    }
    this.route.length = 0;
    // Only bother with the corridor when actually travelling along it. This
    // threshold is in pixels: comparing it against a tile count sent everybody
    // out to the middle of the lane to shuffle one step sideways.
    if (Math.abs(this.x - x) > 2.5 * 16) {
      this.route.push({ x: this.x, y: corridorY });
      this.route.push({ x, y: corridorY });
    }
    this.route.push({ x, y });
    this.target = this.route.shift()!;
    this.anim.play('walk');
  }

  private setAct(act: Act): void {
    this.act = act;
    const clip = act === 'in' || act === 'walk' ? 'idle' : act;
    this.anim.play(CLIPS[clip] ? clip : 'idle');
  }

  update(dt: number, time: number): void {
    this.bob = time;
    if (!this.target) {
      this.anim.update(dt);
      return;
    }
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const step = this.def.speed * dt;
    if (dist <= step) {
      this.x = this.target.x;
      this.y = this.target.y;
      this.target = this.route.shift() ?? null;
      if (!this.target) {
        // Arrived. Face the way the activity wants rather than the way the
        // last leg happened to end, or everybody finishes facing sideways.
        if (this.act === 'work' || this.act === 'tend' || this.act === 'sweep') this.facing = 'up';
        else if (this.act === 'sit' || this.act === 'lean' || this.act === 'idle') this.facing = 'down';
        this.setAct(this.act);
      }
      this.anim.update(dt);
      return;
    }
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    // Newest-axis-wins, the same rule the player's input uses, so a turn reads
    // as a turn rather than as a slow rotation.
    if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
    else this.facing = dy > 0 ? 'down' : 'up';
    if (this.anim.current !== 'walk') this.anim.play('walk');
    this.anim.update(dt);
  }

  /** Turn and look at something — the player, usually. */
  lookAt(px: number, py: number): void {
    if (this.walking) return;
    const dx = px - this.x;
    const dy = py - this.y;
    if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
    else this.facing = dy > 0 ? 'down' : 'up';
  }

  private currentSprite(): Sprite {
    const poses = this.poseSets[this.act];
    if (poses && !this.walking) {
      return poses[Math.min(this.anim.frame, poses.length - 1)] ?? poses[0];
    }
    const set = this.walkSets[this.facing];
    return set[Math.min(this.anim.frame, set.length - 1)] ?? set[0];
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    if (this.hidden) return;
    const spr = this.currentSprite();
    // Standing still, they breathe. It is two pixels a second and it is the
    // difference between a person and a cardboard cut-out.
    const breath = !this.walking && Math.sin(this.bob * 1.6 + this.x) > 0.7 ? 1 : 0;
    const dy = this.anim.offset + breath;
    ctx.drawImage(
      spr.canvas,
      Math.round(this.x - camX - spr.ox),
      Math.round(this.y - camY - spr.oy + dy),
    );
  }
}
