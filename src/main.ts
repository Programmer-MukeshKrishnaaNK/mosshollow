/**
 * MOSSHOLLOW — entry point.
 *
 * Wires the systems together and owns the frame. Everything interesting lives
 * in the modules this imports; this file should stay short enough to read in
 * one sitting, which is the whole reason the rest of the game is split up the
 * way it is.
 */

import './style.css';

import { Input } from './core/input.ts';
import { FIXED_DT, Loop } from './core/loop.ts';
import { clamp } from './core/math.ts';
import { HOMESTEAD } from './data/homestead.ts';
import { Player } from './entities/player.ts';
import { Camera } from './render/camera.ts';
import { CloudShadows } from './render/clouds.ts';
import { Rain } from './render/rain.ts';
import { Lighting, type Light } from './render/lighting.ts';
import { Renderer, VIEW_H, VIEW_W } from './render/renderer.ts';
import { GameAudio, type Ground } from './systems/audio.ts';
import { Farm, type Plot } from './systems/farm.ts';
import { Inventory } from './systems/inventory.ts';
import { Music } from './systems/music.ts';
import { FX, Particles } from './systems/particles.ts';
import { TimeOfDay } from './systems/time.ts';
import { Weather } from './systems/weather.ts';
import { DebugOverlay } from './ui/debug.ts';
import { Hotbar } from './ui/hotbar.ts';
import { Hud, TitleCard } from './ui/hud.ts';
import { drawTarget, type TargetKind } from './ui/target.ts';
import { drawVignette } from './ui/panel.ts';
import { Mat, TILE } from './world/materials.ts';
import { World, type Drawable } from './world/world.ts';

class Game {
  private renderer: Renderer;
  private input = new Input();
  private clock = new TimeOfDay(7.6);
  private weather = new Weather();
  private particles = new Particles();
  private lighting = new Lighting(VIEW_W + 1, VIEW_H + 1);
  private clouds: CloudShadows;
  private rain = new Rain(VIEW_W + 1, VIEW_H + 1);
  private audio = new GameAudio();
  private music = new Music();
  /** Sampled a few times a second, not per frame — it only drives a volume. */
  private waterNearness = 0;
  private waterSampleTimer = 0;
  private world: World;
  private player: Player;
  private camera: Camera;
  private hud = new Hud();
  private hotbar = new Hotbar();
  private inventory = new Inventory();
  private farm: Farm;
  /** The tile the player is facing, and what acting on it would do. */
  private targetTx = 0;
  private targetTy = 0;
  private targetKind: TargetKind = null;
  private lastDay = 1;
  /** Set while it is raining hard enough to count as watering overnight. */
  private rainedToday = false;
  /**
   * Reusable drawable wrappers so the crops can join the world's depth sort
   * without allocating a closure per plant per frame.
   */
  private cropDraws: CropDraw[] = [];
  private title = new TitleCard();
  private debug = new DebugOverlay();
  private loop: Loop;
  private time = 0;
  /** The player, wrapped so the world's depth sort can treat it like a prop. */
  private playerDrawable: Drawable & { shadowX: number; shadowY: number; shadowW: number };

  constructor(container: HTMLElement) {
    this.renderer = new Renderer(container);
    this.clouds = new CloudShadows(this.renderer.ctx);
    this.world = new World(HOMESTEAD, this.renderer.ctx, VIEW_W + 1, VIEW_H + 1);

    this.farm = new Farm(this.world.map);

    const spawn = this.world.spawn;
    this.player = new Player(spawn.x, spawn.y);
    this.player.onFootstep = (x, y) => this.onFootstep(x, y);
    this.player.onToolImpact = (tool) => this.onToolImpact(tool);
    this.player.onToolSustain = (tool, dt) => this.onToolSustain(tool, dt);
    this.player.frozen = true; // released when the title card clears

    // What was left in the shed, and what somebody bothered to label.
    this.inventory.add('hoe', 1);
    this.inventory.add('can', 1);
    this.inventory.add('seed_bellroot', 12);
    this.inventory.add('seed_emberwheat', 12);

    this.camera = new Camera(VIEW_W + 1, VIEW_H + 1, this.world.map.pixelW, this.world.map.pixelH);
    this.camera.snapTo(this.player.x, this.player.focusY);

    this.playerDrawable = {
      sortY: this.player.y,
      shadowX: this.player.x,
      shadowY: this.player.y,
      shadowW: 11,
      draw: (ctx, camX, camY) => this.player.draw(ctx, camX, camY),
    };

    this.loop = new Loop({ update: (dt) => this.update(dt), render: () => this.render() });
    this.loop.start();

    if (import.meta.env.DEV) {
      // A handle for automated visual QA: lets a test drive the clock and read
      // player state without reaching through the render loop.
      (window as unknown as { mosshollow?: unknown }).mosshollow = {
        game: this,
        state: () => ({
          x: this.player.x, y: this.player.y, vx: this.player.vx, vy: this.player.vy,
          facing: this.player.facing, frozen: this.player.frozen,
          clip: this.player.anim.current, hour: this.clock.hour,
          titleDone: this.title.done, fps: this.loop.fps,
        }),
        setHour: (h: number) => { this.clock.minutes = h * 60; },
        teleport: (x: number, y: number) => { this.player.x = x; this.player.y = y; this.camera.snapTo(x, this.player.focusY); },
        skipTitle: () => { this.title.dismissed = true; this.title.t = 99; this.title.update(0, true); },
        setSky: (sky: 'clear' | 'gathering' | 'rain' | 'clearing', hold = 600) => this.weather.setSky(sky, hold),
        weather: () => ({ wind: this.weather.wind, rain: this.weather.rain, overcast: this.weather.overcast, sky: this.weather.sky }),
        farm: this.farm,
        inventory: this.inventory,
        target: () => ({ tx: this.targetTx, ty: this.targetTy, kind: this.targetKind }),
        select: (i: number) => this.inventory.select(i),
        nextDay: () => { this.clock.minutes = 0; this.clock.day++; this.lastDay = this.clock.day; this.farm.advanceDay(this.rainedToday); this.rainedToday = false; },
        plots: () => [...this.farm.all].map((p) => ({ tx: p.tx, ty: p.ty, tilled: p.tilled, wet: p.wet, crop: p.crop, stage: p.stage, withered: p.withered })),
        /**
         * Advance the simulation by whole frames and redraw, without waiting
         * for requestAnimationFrame. Automated visual checks run headless or
         * in a hidden tab, where rAF never fires; this lets them drive the
         * game deterministically instead of sleeping and hoping.
         */
        /** Stop the real frame loop so scripted checks are deterministic. */
        pause: () => this.loop.stop(),
        resume: () => this.loop.start(),
        step: (frames = 1) => {
          for (let i = 0; i < frames; i++) this.update(FIXED_DT);
          this.render();
        },
        press: (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code })),
        release: (code: string) => window.dispatchEvent(new KeyboardEvent('keyup', { code })),
      };
    }
  }

  private onFootstep(x: number, y: number): void {
    const mat = this.world.materialAt(x, y);
    // The ground answers back differently depending on what it is — in the
    // particles it throws up and in the sound it makes.
    let ground: Ground = 'grass';
    if (mat === Mat.Path || mat === Mat.Field) {
      ground = 'dirt';
      this.particles.emit(FX.footstepDust(x, y - 1));
    } else if (mat === Mat.Grass) {
      this.particles.emit(FX.grassBrush(x, y - 1));
    } else if (mat === Mat.Soil) {
      ground = 'soil';
      this.particles.emit({ ...FX.footstepDust(x, y - 1), ramp: ['soil0', 'soil1', 'soil2'] });
    } else if (mat === Mat.Stone) {
      ground = 'stone';
    }
    // Wet ground splashes rather than puffs.
    if (this.weather.rain > 0.3 && ground !== 'grass') {
      this.particles.emit({ ...FX.splash(x, y - 1), count: 3, vz: [8, 16] });
    }
    this.audio.footstep(ground, this.player.running);
  }

  /** Which tile the player is facing, and what pressing E there would do. */
  private updateTarget(): void {
    const p = this.player.interactPoint();
    this.targetTx = Math.floor(p.x / TILE);
    this.targetTy = Math.floor(p.y / TILE);
    this.targetKind = this.actionAt(this.targetTx, this.targetTy);
  }

  private actionAt(tx: number, ty: number): TargetKind {
    const plot = this.farm.get(tx, ty);
    if (plot?.withered) return 'clear';
    if (this.farm.isReady(tx, ty)) return 'harvest';
    const held = this.inventory.selectedItem;
    if (!held) return null;
    if (held.tool === 'hoe') {
      const blocked = this.world.blocked({ x: tx * TILE + 2, y: ty * TILE + 2, w: TILE - 4, h: TILE - 4 });
      return this.farm.canTill(tx, ty, blocked) ? 'till' : null;
    }
    if (held.tool === 'can') return this.farm.canWater(tx, ty) ? 'water' : null;
    if (held.plants) return this.farm.canPlant(tx, ty) ? 'plant' : null;
    return null;
  }

  /** Press E. The held item and the tile decide what happens. */
  private act(): void {
    const kind = this.targetKind;
    if (!kind) return;
    const tx = this.targetTx;
    const ty = this.targetTy;

    switch (kind) {
      case 'till':
        this.player.useTool('hoe');
        break;
      case 'clear':
        this.player.useTool('hoe');
        break;
      case 'water':
        this.player.useTool('can');
        break;
      case 'plant': {
        const held = this.inventory.selectedItem;
        if (!held?.plants) return;
        if (!this.farm.plant(tx, ty, held.plants)) return;
        this.inventory.consumeSelected();
        // Planting is a light action, so it resolves instantly — a swing
        // animation here would make putting a seed in the ground feel like
        // work, which is the opposite of what it should feel like.
        this.particles.emit({
          ...FX.footstepDust(tx * TILE + 8, ty * TILE + 12),
          count: 5, ramp: ['soil0', 'soil1', 'soil2'], vz: [6, 14],
        });
        this.audio.blip(4, 0.045);
        break;
      }
      case 'harvest': {
        const result = this.farm.harvest(tx, ty, Math.random());
        if (!result) return;
        const left = this.inventory.add(result.item, result.count, this.time);
        this.harvestBurst(tx, ty, result.crop.id);
        this.audio.blip(12, 0.07);
        this.audio.blip(19, 0.05);
        this.camera.shake(0.5, 0.12, 14);
        if (left > 0) {
          // Nowhere to put it. Say so rather than silently eating the crop.
          this.audio.blip(-8, 0.05);
        }
        break;
      }
    }
  }

  /** The moment a tool connects. */
  private onToolImpact(tool: 'hoe' | 'can'): void {
    const tx = this.targetTx;
    const ty = this.targetTy;
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE - 2;

    if (tool === 'hoe') {
      const cleared = this.farm.clear(tx, ty);
      const tilled = cleared ? false : this.farm.till(tx, ty);
      if (tilled || cleared) {
        this.particles.emit(FX.impactChips(cx, cy, ['soil0', 'soil1', 'soil2']));
        this.particles.emit({ ...FX.footstepDust(cx, cy), count: 6, spread: 5, ramp: ['dirt1', 'dirt2', 'dirt3'] });
        this.camera.shake(1.15, 0.16, 16);
        this.audio.footstep('soil', true);
        this.audio.blip(-14, 0.05);
      } else {
        // A miss still lands — it just does not achieve anything.
        this.particles.emit({ ...FX.footstepDust(cx, cy), count: 3 });
        this.camera.shake(0.55, 0.1, 20);
        this.audio.footstep('stone', false);
      }
    }
  }

  /** Every frame the can is pouring. */
  private onToolSustain(tool: 'hoe' | 'can', dt: number): void {
    if (tool !== 'can') return;
    const tx = this.targetTx;
    const ty = this.targetTy;
    const p = this.player;
    // The stream leaves the spout, not the player's feet.
    const sx = p.x + (p.facing === 'left' ? -11 : p.facing === 'right' ? 11 : 0);
    const sy = p.y - 20;
    const dx = tx * TILE + TILE / 2 - sx;
    const dy = ty * TILE + TILE / 2 - sy;
    this.particles.emit({
      x: sx, y: sy, z: 0, count: 2, spread: 1.5,
      vx: [dx * 1.6, dx * 2.2], vy: [dy * 1.6, dy * 2.2], vz: [2, 6],
      life: [0.28, 0.42], size: [1, 1], gravity: 40, drag: 0.6,
      ramp: ['water0', 'water1', 'water2'],
    });
    if (this.farm.water(tx, ty)) {
      this.particles.emit({ ...FX.splash(tx * TILE + 8, ty * TILE + 10), count: 5, vz: [8, 18] });
      this.audio.blip(-2, 0.03);
    }
    void dt;
  }

  private harvestBurst(tx: number, ty: number, cropId: string): void {
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + 8;
    const ramp = cropId === 'emberwheat'
      ? (['gold', 'orange', 'dirt1'] as const)
      : (['cream0', 'fol1', 'fol3'] as const);
    this.particles.emit({
      x: cx, y: cy, z: 8, count: 11, spread: 5,
      vx: [-22, 22], vy: [-10, 10], vz: [16, 36],
      life: [0.4, 0.75], size: [1, 2], gravity: 90, drag: 1.1,
      ramp: [...ramp],
    });
    // A couple of leaves torn loose, settling rather than vanishing.
    this.particles.emit({ ...FX.leafFall(cx, cy, 12), count: 3 });
  }

  private handleHotbar(): void {
    const keys = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;
    for (let i = 0; i < keys.length; i++) {
      if (this.input.wasPressed(keys[i])) {
        this.inventory.select(i);
        this.audio.blip(7, 0.035);
      }
    }
  }

  /** Player plus every visible plant, for the world's depth-sorted pass. */
  private buildDrawables(): Drawable[] {
    const list: Drawable[] = [this.playerDrawable];
    let i = 0;
    for (const plot of this.farm.all) {
      if (!plot.crop) continue;
      let d = this.cropDraws[i];
      if (!d) {
        d = new CropDraw(this.farm, this);
        this.cropDraws[i] = d;
      }
      d.bind(plot);
      list.push(d);
      i++;
    }
    return list;
  }

  /** Read by CropDraw; kept together so the wrapper stays a thin adapter. */
  get renderTime(): number {
    return this.time;
  }

  get renderWind(): number {
    return this.weather.wind;
  }

  private update(dt: number): void {
    this.time += dt;

    // Browsers will not let audio start without a gesture, so the first key
    // press is what brings the valley's sound up.
    if (this.input.anyInputYet && !this.audio.running) {
      this.audio.start();
      const ctx = this.audio.context;
      const dest = this.audio.musicDestination;
      if (ctx && dest) this.music.attach(ctx, dest);
    }
    this.audio.resume();

    if (this.input.wasPressed('debug')) this.debug.toggle();
    // T steps the clock on an hour. The fastest way to check that dusk still
    // looks right after touching the lighting.
    if (this.input.wasPressed('timeWarp')) {
      this.clock.minutes = (Math.floor(this.clock.minutes / 60) + 1) * 60;
      if (this.clock.minutes >= 1440) {
        this.clock.minutes -= 1440;
        this.clock.day++;
      }
    }

    this.title.update(dt, this.input.anyInputYet);
    if (this.title.done && this.player.frozen) this.player.frozen = false;
    this.hud.alpha = clamp(this.hud.alpha + (this.title.dismissed ? dt * 1.4 : -dt * 2), 0, 1);
    this.hotbar.alpha = this.hud.alpha;

    this.clock.update(dt);
    this.weather.update(dt);

    // A new day: crops that were watered advance, the rest get thirstier.
    if (this.clock.day !== this.lastDay) {
      this.lastDay = this.clock.day;
      this.farm.advanceDay(this.rainedToday);
      this.rainedToday = false;
    }
    // Rain waters everything while it falls, and counts for the night.
    if (this.weather.rain > 0.35) {
      this.farm.soak();
      this.rainedToday = true;
    }
    this.farm.update(dt);

    this.player.update(dt, this.input, this.world.blocked, this.time);
    this.updateTarget();
    this.handleHotbar();
    if (this.input.wasPressed('interact') && !this.player.swinging && !this.player.frozen) {
      this.act();
    }
    this.hotbar.update(dt, this.inventory);
    this.world.update(
      dt, this.time, this.weather, this.clock, this.particles,
      this.camera.originX, this.camera.originY, VIEW_W, VIEW_H,
    );
    this.particles.update(dt, this.time);
    this.clouds.update(dt, this.weather.wind);
    this.rain.update(dt, this.weather.rain, this.weather.wind, this.camera.originX, this.camera.originY);

    this.waterSampleTimer -= dt;
    if (this.waterSampleTimer <= 0) {
      this.waterSampleTimer = 0.3;
      this.waterNearness = this.world.waterProximity(this.player.x, this.player.y);
    }
    this.audio.update(dt, {
      wind: this.weather.wind,
      darkness: this.clock.darkness,
      rain: this.weather.rain,
      water: this.waterNearness,
    });
    this.music.update(this.clock.darkness, this.weather.rain, this.title.dismissed ? 1 : 0.4);
    this.camera.follow(this.player.x, this.player.focusY, this.player.vx, this.player.vy, dt);

    this.playerDrawable.sortY = this.player.y;
    this.playerDrawable.shadowX = this.player.x;
    this.playerDrawable.shadowY = this.player.y;

    this.input.endFrame();
  }

  private render(): void {
    const { renderer, camera, world, clock } = this;
    const ctx = renderer.ctx;
    const camX = camera.originX;
    const camY = camera.originY;

    renderer.clearWorld();
    world.drawGround(ctx, camX, camY, VIEW_W + 1, VIEW_H + 1, clock);
    // Worked soil sits on the ground, above the terrain and below everything
    // that stands on it.
    this.farm.drawSoil(ctx, camX, camY, VIEW_W + 1, VIEW_H + 1);
    drawTarget(ctx, this.targetTx, this.targetTy, camX, camY, this.targetKind, this.time);
    // Ripples belong on the water surface; splashes belong on the ground, under
    // anything standing on it.
    this.rain.drawWaterRings(ctx, this.time, this.weather.rain, camX, camY, world.isWater);
    this.rain.drawSplashes(ctx, camX, camY);
    world.drawSorted(
      ctx, camX, camY, VIEW_W + 1, VIEW_H + 1,
      this.buildDrawables(), this.particles, clock, this.weather,
    );

    // Lighting last, over the finished picture.
    this.lighting.begin();
    world.collectLights((l: Light) => this.lighting.add(l), clock, this.weather.overcast * 0.45);
    // Clouds only cast while the sun is high enough to make a shadow at all,
    // and not at all once the sky has closed over.
    const sunUp = 1 - clock.darkness;
    const overcast = this.weather.overcast;
    // Wet ground is darker ground. Folding rain into the overcast term is
    // enough to make the whole valley read as soaked.
    const gloom = Math.min(1, overcast + this.weather.rain * 0.22);
    this.lighting.render(ctx, clock.ambientCss(gloom), camX, camY, this.time, clock.lampStrength, {
      clouds: this.clouds,
      cloudStrength: sunUp * sunUp * 0.85 * (1 - overcast),
      // Rain washes the colour out of everything, and so does moonlight.
      desaturate: Math.max(clock.darkness * 0.72, this.weather.rain * 0.4),
    });

    // Falling rain goes on last, over the lit picture. It is between the camera
    // and the world rather than part of it, so the valley's ambient light has
    // no business darkening it — put it before the multiply and a downpour
    // vanishes into an overcast scene, which is exactly what happened first.
    this.rain.drawFall(ctx, this.weather.rain, this.weather.wind);

    this.debug.drawWorld(ctx, world, this.player, camX, camY);

    renderer.clearUi();
    const uctx = renderer.uctx;
    drawVignette(uctx, VIEW_W, VIEW_H, 0.18 + clock.darkness * 0.12);
    this.hud.draw(uctx, clock);
    this.hotbar.draw(uctx, this.inventory, VIEW_W, VIEW_H, this.time);
    this.title.draw(uctx, VIEW_W, VIEW_H);
    this.debug.drawUi(uctx, this.loop, this.player, world, clock, this.weather, this.particles);

    renderer.present(camera.fracX, camera.fracY);
  }
}

/**
 * Adapter that lets a farm plot take part in the world's depth sort. Bound to a
 * different plot each frame rather than recreated, so a hundred plants cost no
 * allocations.
 */
class CropDraw implements Drawable {
  sortY = 0;
  private plot: Plot | null = null;

  constructor(private farm: Farm, private game: Game) {}

  bind(plot: Plot): void {
    this.plot = plot;
    this.sortY = Farm.sortY(plot);
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    if (!this.plot) return;
    this.farm.drawCrop(ctx, this.plot, camX, camY, this.game.renderTime, this.game.renderWind);
  }
}

function boot(): void {
  const stage = document.getElementById('stage');
  if (!stage) throw new Error('No #stage element');
  // A timer, not requestAnimationFrame: rAF never fires while the tab is in
  // the background, and a game that refuses to load until you look at it is
  // not a game that loads. The delay just lets the boot card paint before the
  // terrain bake blocks the thread.
  setTimeout(() => {
    try {
      new Game(stage);
      document.getElementById('boot')?.classList.add('gone');
    } catch (err) {
      console.error(err);
      const el = document.getElementById('boot');
      if (el) el.innerHTML = `<span>the valley did not grow</span><small>${String(err)}</small>`;
    }
  }, 40);
}

boot();
