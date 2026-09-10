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
import { Music } from './systems/music.ts';
import { FX, Particles } from './systems/particles.ts';
import { TimeOfDay } from './systems/time.ts';
import { Weather } from './systems/weather.ts';
import { DebugOverlay } from './ui/debug.ts';
import { Hud, TitleCard } from './ui/hud.ts';
import { drawVignette } from './ui/panel.ts';
import { Mat } from './world/materials.ts';
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

    const spawn = this.world.spawn;
    this.player = new Player(spawn.x, spawn.y);
    this.player.onFootstep = (x, y) => this.onFootstep(x, y);
    this.player.frozen = true; // released when the title card clears

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
        /**
         * Advance the simulation by whole frames and redraw, without waiting
         * for requestAnimationFrame. Automated visual checks run headless or
         * in a hidden tab, where rAF never fires; this lets them drive the
         * game deterministically instead of sleeping and hoping.
         */
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

    this.clock.update(dt);
    this.weather.update(dt);
    this.player.update(dt, this.input, this.world.blocked, this.time);
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
    // Ripples belong on the water surface; splashes belong on the ground, under
    // anything standing on it.
    this.rain.drawWaterRings(ctx, this.time, this.weather.rain, camX, camY, world.isWater);
    this.rain.drawSplashes(ctx, camX, camY);
    world.drawSorted(
      ctx, camX, camY, VIEW_W + 1, VIEW_H + 1,
      [this.playerDrawable], this.particles, clock, this.weather,
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
    this.title.draw(uctx, VIEW_W, VIEW_H);
    this.debug.drawUi(uctx, this.loop, this.player, world, clock, this.weather, this.particles);

    renderer.present(camera.fracX, camera.fracY);
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
