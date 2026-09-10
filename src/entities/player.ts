/**
 * THE PLAYER
 *
 * Movement is the first thing anyone judges a game by, so it gets more care
 * than it strictly needs: separate acceleration and braking curves, the
 * newest-key-wins direction handling from Input, axis-separated collision that
 * slides along walls instead of sticking, and a walk cycle whose playback rate
 * is tied to actual speed so the feet never skate.
 *
 * The collision box is a small rectangle at the feet, not the whole sprite.
 * That is what lets the character's head overlap a fence or a tree canopy and
 * still read as standing in front of it.
 */

import { clamp } from '../core/math.ts';
import type { Input } from '../core/input.ts';
import type { Rect } from '../core/math.ts';
import { mirrored, sprite, type Sprite } from '../art/pixel.ts';
import {
  DOWN_RAISE, DOWN_STRIKE, SIDE_RAISE, SIDE_STRIKE, UP_RAISE, UP_STRIKE,
} from '../art/playerTool.art.ts';
import {
  AXE_DOWN, AXE_UP, CAN_POUR, CAN_UP, HOE_DOWN, HOE_UP, PICK_DOWN, PICK_UP,
} from '../art/tools.art.ts';
import type { ToolKind } from '../data/items.ts';
import { CAN_ANCHORS, SWING_ANCHORS, TOOL_TIMING, type FacingAnchors } from './toolPose.ts';
import {
  DOWN_PASS, DOWN_STEP_A, DOWN_STEP_B,
  SIDE_PASS, SIDE_STEP_A, SIDE_STEP_B,
  UP_PASS, UP_STEP_A, UP_STEP_B,
} from '../art/player.art.ts';
import { Animator, type Clip } from './animator.ts';

export type Facing = 'down' | 'up' | 'left' | 'right';

/** Where a swing is in its arc. */
export type SwingPhase = 'raise' | 'hold' | 'strike' | 'recover';

const WALK_SPEED = 46;
const RUN_SPEED = 79;
const ACCEL = 620;
const BRAKE = 900;

/** Feet collider, in pixels, relative to the player's ground position. */
const BOX_W = 9;
const BOX_H = 7;

const CLIPS: Record<string, Clip> = {
  idle: { frames: [0], fps: 1, loop: true },
  // stepA, pass, stepB, pass — the pass frames lifted a pixel for bounce.
  walk: {
    frames: [1, 0, 2, 0],
    fps: 8,
    loop: true,
    offsets: [0, -1, 0, -1],
    events: [0, 2],
  },
};

export class Player {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  facing: Facing = 'down';
  running = false;
  /** Set by the game while a cutscene or menu owns input. */
  frozen = false;

  readonly anim: Animator;
  private sprites: Record<Facing, Sprite[]>;
  private poses: Record<Facing, { raise: Sprite; strike: Sprite }>;
  private toolArt: Record<ToolKind, { raise: Sprite; strike: Sprite; raiseFlip: Sprite; strikeFlip: Sprite }>;
  private breath = 0;
  /** Distance walked since the last footfall, for step effects. */
  private stepAccum = 0;
  onFootstep: ((x: number, y: number) => void) | null = null;

  // --- tool use ------------------------------------------------------------
  private swingTool: ToolKind | null = null;
  private phase: SwingPhase = 'raise';
  private phaseTime = 0;
  /** Fires once, at the moment the tool reaches the ground. */
  onToolImpact: ((tool: ToolKind) => void) | null = null;
  /** Fires every frame of a sustained tool, e.g. while the can is pouring. */
  onToolSustain: ((tool: ToolKind, dt: number) => void) | null = null;
  /** Fires when the swing finishes and control returns. */
  onToolEnd: ((tool: ToolKind) => void) | null = null;

  get swinging(): boolean {
    return this.swingTool !== null;
  }

  /** True while the swing owns the character — movement is locked out. */
  get swingLocked(): boolean {
    return this.swingTool !== null && this.phase !== 'recover';
  }

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const down = [DOWN_PASS, DOWN_STEP_A, DOWN_STEP_B].map((m) => sprite(m, 8, 23));
    const up = [UP_PASS, UP_STEP_A, UP_STEP_B].map((m) => sprite(m, 8, 23));
    const right = [SIDE_PASS, SIDE_STEP_A, SIDE_STEP_B].map((m) => sprite(m, 8, 23));
    const left = right.map(mirrored);
    this.sprites = { down, up, right, left };

    const sideRaise = sprite(SIDE_RAISE, 8, 23);
    const sideStrike = sprite(SIDE_STRIKE, 8, 23);
    this.poses = {
      down: { raise: sprite(DOWN_RAISE, 8, 23), strike: sprite(DOWN_STRIKE, 8, 23) },
      up: { raise: sprite(UP_RAISE, 8, 23), strike: sprite(UP_STRIKE, 8, 23) },
      right: { raise: sideRaise, strike: sideStrike },
      left: { raise: mirrored(sideRaise), strike: mirrored(sideStrike) },
    };

    const pair = (up: typeof HOE_UP, down: typeof HOE_DOWN) => {
      const raise = sprite(up);
      const strike = sprite(down);
      return { raise, strike, raiseFlip: mirrored(raise), strikeFlip: mirrored(strike) };
    };
    this.toolArt = {
      hoe: pair(HOE_UP, HOE_DOWN),
      axe: pair(AXE_UP, AXE_DOWN),
      pick: pair(PICK_UP, PICK_DOWN),
      can: pair(CAN_UP, CAN_POUR),
    };

    this.anim = new Animator(CLIPS, 'idle');
  }

  /** Begin a swing. Ignored if one is already under way. */
  useTool(tool: ToolKind): boolean {
    if (this.swingTool !== null || this.frozen) return false;
    this.swingTool = tool;
    this.phase = 'raise';
    this.phaseTime = 0;
    this.vx = 0;
    this.vy = 0;
    return true;
  }

  private updateSwing(dt: number): void {
    const tool = this.swingTool;
    if (!tool) return;
    const timing = TOOL_TIMING[tool];
    this.phaseTime += dt;
    switch (this.phase) {
      case 'raise':
        if (this.phaseTime >= timing.raise) {
          this.phaseTime -= timing.raise;
          this.phase = 'hold';
        }
        break;
      case 'hold':
        if (this.phaseTime >= timing.hold) {
          this.phaseTime -= timing.hold;
          this.phase = 'strike';
          // The blow lands as the strike begins, not when it ends: the impact
          // should precede the follow-through, or it reads as lag.
          this.onToolImpact?.(tool);
        }
        break;
      case 'strike':
        if (timing.sustained) this.onToolSustain?.(tool, dt);
        if (this.phaseTime >= timing.strike) {
          this.phaseTime -= timing.strike;
          this.phase = 'recover';
        }
        break;
      case 'recover':
        if (this.phaseTime >= timing.recover) {
          this.onToolEnd?.(tool);
          this.swingTool = null;
        }
        break;
    }
  }

  /** How far into the current phase, 0-1. Drives the tool's interpolation. */
  private phaseProgress(): number {
    const tool = this.swingTool;
    if (!tool) return 0;
    const timing = TOOL_TIMING[tool];
    const span = timing[this.phase];
    return span <= 0 ? 1 : clamp(this.phaseTime / span, 0, 1);
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vy);
  }

  /** The point the camera centres on — the chest, not the feet. */
  get focusY(): number {
    return this.y - 10;
  }

  get collider(): Rect {
    return { x: this.x - BOX_W / 2, y: this.y - BOX_H, w: BOX_W, h: BOX_H };
  }

  /** Where an interaction reaches, one tile ahead of where the player faces. */
  interactPoint(): { x: number; y: number } {
    const reach = 13;
    switch (this.facing) {
      case 'up': return { x: this.x, y: this.y - reach };
      case 'down': return { x: this.x, y: this.y + reach * 0.7 };
      case 'left': return { x: this.x - reach, y: this.y - 2 };
      default: return { x: this.x + reach, y: this.y - 2 };
    }
  }

  update(dt: number, input: Input, blocked: (r: Rect) => boolean, time: number): void {
    if (this.swingTool !== null) this.updateSwing(dt);
    const locked = this.frozen || this.swingLocked;
    let ix = locked ? 0 : input.axisX();
    let iy = locked ? 0 : input.axisY();
    this.running = !locked && input.isDown('run');

    // Normalise diagonals so corners are not a speed boost.
    if (ix !== 0 && iy !== 0) {
      const inv = Math.SQRT1_2;
      ix *= inv;
      iy *= inv;
    }

    const target = this.running ? RUN_SPEED : WALK_SPEED;
    const tvx = ix * target;
    const tvy = iy * target;
    // Accelerating and stopping use different rates: quick to get going,
    // quicker to stop, which is what makes the character feel planted.
    const rateX = ix === 0 ? BRAKE : ACCEL;
    const rateY = iy === 0 ? BRAKE : ACCEL;
    this.vx = moveToward(this.vx, tvx, rateX * dt);
    this.vy = moveToward(this.vy, tvy, rateY * dt);

    this.moveAxis(this.vx * dt, 0, blocked);
    this.moveAxis(0, this.vy * dt, blocked);

    if (ix !== 0 || iy !== 0) {
      // Face the dominant axis, and prefer the vertical on an exact tie so
      // turning a corner never flickers between two facings.
      if (Math.abs(ix) > Math.abs(iy)) this.facing = ix < 0 ? 'left' : 'right';
      else this.facing = iy < 0 ? 'up' : 'down';
    }

    const spd = this.speed;
    if (spd > 4) {
      this.anim.play('walk');
      // Tie playback to real speed so the feet always match the ground.
      this.anim.rate = clamp(spd / WALK_SPEED, 0.55, 2.1);
      this.stepAccum += spd * dt;
      const stride = this.running ? 17 : 14;
      if (this.stepAccum >= stride) {
        this.stepAccum -= stride;
        this.onFootstep?.(this.x, this.y);
      }
    } else {
      this.anim.play('idle');
      this.anim.rate = 1;
      this.stepAccum = 0;
    }
    this.anim.update(dt);

    // Slow breath while standing still. Two seconds a cycle, one pixel of
    // travel — any more and it reads as hovering.
    this.breath = this.anim.current === 'idle' ? (Math.sin(time * 1.9) > 0.35 ? 1 : 0) : 0;
  }

  /** Move along one axis and stop cleanly on contact — no tunnelling, no stick. */
  private moveAxis(dx: number, dy: number, blocked: (r: Rect) => boolean): void {
    if (dx === 0 && dy === 0) return;
    const steps = Math.max(1, Math.ceil((Math.abs(dx) + Math.abs(dy)) / 3));
    const sx = dx / steps;
    const sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      const nx = this.x + sx;
      const ny = this.y + sy;
      const box: Rect = { x: nx - BOX_W / 2, y: ny - BOX_H, w: BOX_W, h: BOX_H };
      if (blocked(box)) {
        if (dx !== 0) this.vx = 0;
        if (dy !== 0) this.vy = 0;
        return;
      }
      this.x = nx;
      this.y = ny;
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    if (this.swingTool !== null) {
      this.drawSwing(ctx, camX, camY, this.swingTool);
      return;
    }
    const set = this.sprites[this.facing];
    const spr = set[this.anim.frame];
    const dx = Math.round(this.x - camX - spr.ox);
    const dy = Math.round(this.y - camY - spr.oy) + this.anim.offset;
    ctx.drawImage(spr.canvas, dx, dy);
    // Breathing: redraw the head and shoulders one pixel lower on the exhale.
    // Drawing over the top rather than offsetting the whole sprite keeps the
    // feet planted, which is the entire point.
    if (this.breath) {
      ctx.drawImage(spr.canvas, 0, 0, spr.w, 11, dx, dy + 1, spr.w, 11);
    }
  }

  private drawSwing(ctx: CanvasRenderingContext2D, camX: number, camY: number, tool: ToolKind): void {
    const pose = this.poses[this.facing];
    const anchors: FacingAnchors = (tool === 'can' ? CAN_ANCHORS : SWING_ANCHORS[tool])[this.facing];
    const art = this.toolArt[tool];
    const t = this.phaseProgress();

    // Which body pose, and where between the two tool anchors we are.
    let body: Sprite;
    let blend: number;
    switch (this.phase) {
      case 'raise':
        body = pose.raise;
        // Ease out: the wind-up decelerates into the held pose.
        blend = (1 - (1 - t) * (1 - t)) * -0.12;
        break;
      case 'hold':
        body = pose.raise;
        // Drifts a hair further back during the hold. Perfect stillness reads
        // as a paused animation rather than as a held breath.
        blend = -0.12 - t * 0.05;
        break;
      case 'strike':
        body = pose.strike;
        blend = 1;
        break;
      default:
        body = pose.strike;
        // Recovery drifts back toward the carry, but only a little: pull it
        // too far and the tool visibly rises back up through the swing it just
        // finished, which reads as the animation running backwards.
        blend = 1 - t * 0.28;
        break;
    }

    const useStrikeArt = this.phase === 'strike' || (this.phase === 'recover' && t < 0.45);
    // Mirroring and draw order follow whichever anchor is active, not a single
    // setting for the whole swing: the tool can pass behind the shoulder on the
    // way up and land in front of the body on the way down.
    const active = useStrikeArt ? anchors.strike : anchors.raise;
    const flip = active.flip ?? false;
    const behind = active.behind ?? false;
    const toolSpr = useStrikeArt
      ? (flip ? art.strikeFlip : art.strike)
      : (flip ? art.raiseFlip : art.raise);

    const ax = anchors.raise.x + (anchors.strike.x - anchors.raise.x) * clamp(blend, -0.3, 1);
    const ay = anchors.raise.y + (anchors.strike.y - anchors.raise.y) * clamp(blend, -0.3, 1);

    const bx = Math.round(this.x - camX - body.ox);
    const by = Math.round(this.y - camY - body.oy);
    const tx = Math.round(this.x - camX + ax);
    const ty = Math.round(this.y - camY + ay);

    if (behind) ctx.drawImage(toolSpr.canvas, tx, ty);
    ctx.drawImage(body.canvas, bx, by);
    if (!behind) ctx.drawImage(toolSpr.canvas, tx, ty);
  }

  /** Bounding box of the drawn sprite, for depth sorting and culling. */
  get spriteHeight(): number {
    return 24;
  }
}

function moveToward(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return target;
}
