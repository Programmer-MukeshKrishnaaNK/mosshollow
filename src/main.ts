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
import { Pointer } from './core/pointer.ts';
import { FIXED_DT, Loop } from './core/loop.ts';
import { clamp } from './core/math.ts';
import { AREAS, START_AREA, area as areaData } from './data/areas.ts';
import type { AreaExit } from './data/area.ts';
import { PROJECTS } from './data/projects.ts';
import { Pickups, type Drop } from './entities/pickup.ts';
import { Player } from './entities/player.ts';
import { Camera } from './render/camera.ts';
import { CloudShadows } from './render/clouds.ts';
import { Rain } from './render/rain.ts';
import { Lighting, type Light } from './render/lighting.ts';
import { Renderer, VIEW_H, VIEW_W } from './render/renderer.ts';
import { GameAudio, type Ground } from './systems/audio.ts';
import { Farm, type Plot } from './systems/farm.ts';
import { item, type ToolKind } from './data/items.ts';
import type { Prop } from './world/props.ts';
import { Inventory } from './systems/inventory.ts';
import { Transition } from './systems/transition.ts';
import { craft } from './systems/crafting.ts';
import { Projects } from './systems/projects.ts';
import type { ProjectDef } from './data/projects.ts';
import { RECIPES, type RecipeDef } from './data/recipes.ts';
import { Dialogue } from './systems/dialogue.ts';
import { resolveInspect } from './data/inspect.ts';
import * as Save from './systems/save.ts';
import { Music } from './systems/music.ts';
import { FX, Particles } from './systems/particles.ts';
import { TimeOfDay } from './systems/time.ts';
import { Weather } from './systems/weather.ts';
import { DebugOverlay } from './ui/debug.ts';
import { Hotbar } from './ui/hotbar.ts';
import { Ledger } from './ui/ledger.ts';
import { Menu } from './ui/menu.ts';
import { Hud, TitleCard, Toast } from './ui/hud.ts';
import { drawDialogue } from './ui/dialogueBox.ts';
import { drawLookHint, drawTarget, type TargetKind } from './ui/target.ts';
import { drawVignette } from './ui/panel.ts';
import { Mat, TILE } from './world/materials.ts';
import { World, type Drawable } from './world/world.ts';

class Game {
  private renderer: Renderer;
  private input = new Input();
  private pointer = new Pointer();
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
  /** Areas are built on first visit and kept; a bake is not cheap. */
  private worlds = new Map<string, World>();
  private farms = new Map<string, Farm>();
  private dropPools = new Map<string, Pickups>();
  private areaId = START_AREA;
  private transition = new Transition();
  private player: Player;
  private camera: Camera;
  private hud = new Hud();
  private hotbar = new Hotbar();
  private toast = new Toast();
  /** The prop the current swing is aimed at, locked in when it starts. */
  private swingProp: Prop | null = null;
  /** What an axe or pick could work on right now. */
  private harvestTarget: Prop | null = null;
  private dialogue = new Dialogue();
  private ledger = new Ledger();
  private menu = new Menu();
  private projects = new Projects();
  /** Inspect keys the player has read, so the world can notice. */
  private seen = new Set<string>();
  /** The thing the player could look at right now, if anything. */
  private lookTarget: { key: string; x: number; y: number; top: number } | null = null;
  /** The title card hands control over exactly once. */
  private titleReleased = false;
  /** Set while a Start Over is in flight, to stop the autosave rewriting it. */
  private wiping = false;
  private inventory = new Inventory();
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
  private pickupDraws: PickupDraw[] = [];
  /** The frame's sun direction, shared with anything that casts a shadow. */
  private sun = { dx: 0, dy: 1, alpha: 0.3 };
  private title = new TitleCard();
  private debug = new DebugOverlay();
  private loop: Loop;
  private time = 0;
  /** The player, wrapped so the world's depth sort can treat it like a prop. */
  private playerDrawable: Drawable & { shadowX: number; shadowY: number; shadowW: number };

  constructor(container: HTMLElement) {
    this.renderer = new Renderer(container);
    this.pointer.attach(this.renderer.display, VIEW_W, VIEW_H);
    this.clouds = new CloudShadows(this.renderer.ctx);
    this.enterAreaData(START_AREA);

    const spawn = this.world.spawn;
    this.player = new Player(spawn.x, spawn.y);
    this.player.onFootstep = (x, y) => this.onFootstep(x, y);
    this.player.onToolImpact = (tool) => this.onToolImpact(tool);
    this.player.onToolSustain = (tool, dt) => this.onToolSustain(tool, dt);

    // What was left in the shed, and what somebody bothered to label.
    this.inventory.add('hoe', 1);
    this.inventory.add('can', 1);
    this.inventory.add('axe', 1);
    this.inventory.add('pick', 1);
    this.inventory.add('seed_bellroot', 12);
    this.inventory.add('seed_emberwheat', 12);

    // The camera has to exist before the save is applied: restoring a game
    // moves the player, and the camera has to be told where they went.
    this.camera = new Camera(VIEW_W + 1, VIEW_H + 1, this.world.map.pixelW, this.world.map.pixelH);

    // ?fresh starts a new valley without touching the existing save, which is
    // what automated checks and a stuck player both need.
    const fresh = new URLSearchParams(location.search).has('fresh');
    if (!fresh) this.loadGame();
    this.lastDay = this.clock.day;
    this.camera.snapTo(this.player.x, this.player.focusY);

    // Save when the tab goes away. 'pagehide' is the one event that reliably
    // fires on mobile and on tab close; 'beforeunload' does not.
    window.addEventListener('pagehide', () => this.saveGame(false));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.saveGame(false);
    });

    this.playerDrawable = {
      sortY: this.player.y,
      shadowX: this.player.x,
      shadowY: this.player.y,
      shadowW: 11,
      draw: (ctx, camX, camY) => this.player.draw(ctx, camX, camY),
    };

    // Control comes back when the box has finished closing, not the instant
    // the last line is dismissed — otherwise you walk away mid-animation.
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
        pickups: () => this.pickups.liveCount,
        areaId: () => this.areaId,
        areas: () => [...this.worlds.keys()],
        transition: () => ({ active: this.transition.active, phase: this.transition.phase, cover: +this.transition.cover.toFixed(2) }),
        props: () => this.world.props.filter((p) => !p.gone).length,
        harvestTarget: () => this.harvestTarget && { id: this.harvestTarget.def.id, hp: this.harvestTarget.hp, x: this.harvestTarget.x, y: this.harvestTarget.y },
        ledger: () => ({ open: this.ledger.open, tab: this.ledger.tab, anim: +this.ledger.anim.toFixed(2), carrying: this.ledger.carrying }),
        openLedger: (tab: 'items' | 'craft' | 'build' = 'items') => this.openLedger(tab),
        closeLedger: () => this.closeLedger(),
        menu: () => ({ open: this.menu.open, screen: this.menu.screen }),
        openMenu: () => this.menu.show(),
        projectStates: () => this.projects.visible().map((p) => ({ id: p.id, state: this.projects.state(p, this.inventory) })),
        doneProjects: () => this.projects.doneList,
        houseLevel: () => this.world.houseLevel,
        give: (id: string, n: number) => this.inventory.add(id, n, this.time),
        craftId: (id: string) => { const r = RECIPES.find((x) => x.id === id); if (r) this.tryCraft(r); },
        buildId: (id: string) => { const p = PROJECTS.find((x) => x.id === id); if (p) this.tryBuild(p); },
        click: (x: number, y: number) => { this.pointer.x = x; this.pointer.y = y; this.pointer.pressX = x; this.pointer.pressY = y; this.pointer.hovering = true; this.pointer.everUsed = true; this.pointer.released = true; },
        inventory: this.inventory,
        target: () => ({ tx: this.targetTx, ty: this.targetTy, kind: this.targetKind }),
        select: (i: number) => this.inventory.select(i),
        dialogue: () => ({ open: +this.dialogue.open.toFixed(2), blocking: this.dialogue.blocking, text: this.dialogue.visibleText, page: this.dialogue.pageIndex, pages: this.dialogue.pageCount, complete: this.dialogue.lineComplete }),
        look: () => this.lookTarget,
        seen: () => [...this.seen],
        save: () => this.saveGame(true),
        load: () => this.loadGame(),
        wipeSave: () => Save.clear(),
        readSave: () => Save.read(),
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

  get world(): World {
    return this.worlds.get(this.areaId)!;
  }

  get farm(): Farm {
    return this.farms.get(this.areaId)!;
  }

  get pickups(): Pickups {
    return this.dropPools.get(this.areaId)!;
  }

  /**
   * Build an area if this is the first time. Any projects already finished
   * there are re-applied as it is built, so a place you have not visited since
   * commissioning the work still shows it when you arrive.
   */
  private ensureArea(id: string): World {
    let world = this.worlds.get(id);
    if (!world) {
      world = new World(areaData(id), this.renderer.ctx, VIEW_W + 1, VIEW_H + 1);
      this.worlds.set(id, world);
      this.farms.set(id, new Farm(world.map));
      this.dropPools.set(id, new Pickups());
      this.applyProjectsFor(id);
    }
    return world;
  }

  private enterAreaData(id: string): void {
    this.ensureArea(id);
    this.areaId = id;
  }

  /** Re-apply every finished project belonging to an area. */
  private applyProjectsFor(id: string): void {
    for (const p of PROJECTS) {
      if (p.area === id && this.projects.isDone(p.id)) this.applyEffects(p);
    }
  }

  /** Carry out a project's declared changes on the world it belongs to. */
  private applyEffects(p: ProjectDef): void {
    const world = this.worlds.get(p.area);
    if (!world) return;
    // Adding props is not idempotent, so a project is only ever carried out
    // once per world.
    if (!world.claimProject(p.id)) return;
    for (const e of p.effects) {
      if (e.kind === 'houseLevel') {
        world.setHouseLevel(e.level);
      } else if (e.kind === 'addProps') {
        for (const np of e.props) world.addProp(np.def, np.tx * TILE, np.ty * TILE, np.inspect);
      } else if (e.kind === 'walkable') {
        for (const t of e.at) world.setWalkable(t.tx, t.ty);
      }
    }
  }

  /** Make one of a recipe, with the noise and the flash that go with it. */
  private tryCraft(r: RecipeDef): void {
    if (craft(this.inventory, r, this.time)) {
      this.audio.blip(9, 0.05);
      this.audio.blip(16, 0.04);
      this.toast.show(`${item(r.out.item).name} x${r.out.count}`, 1.4);
    } else {
      this.audio.blip(-14, 0.045);
    }
  }

  /**
   * Commission a project. The world changes immediately, and loudly — this is
   * the payoff for an hour of chopping and it should not be a quiet number.
   */
  private tryBuild(p: ProjectDef): void {
    if (!this.projects.build(p, this.inventory)) {
      this.audio.blip(-14, 0.045);
      return;
    }
    this.applyEffects(p);
    this.buildCelebration(p);
    this.saveGame(false);
  }

  private buildCelebration(p: ProjectDef): void {
    // Sawdust and a rising chord, wherever the work happened.
    const world = this.worlds.get(p.area);
    let fx = this.player.x;
    let fy = this.player.y - 8;
    if (world === this.world) {
      const spot = firstEffectSpot(p);
      if (spot) {
        fx = spot.tx * TILE;
        fy = spot.ty * TILE;
      } else if (world.house) {
        fx = world.housePos.x;
        fy = world.housePos.y - 20;
      }
    }
    this.particles.emit({
      x: fx, y: fy, z: 6, count: 26, spread: 16,
      vx: [-26, 26], vy: [-14, 14], vz: [18, 52],
      life: [0.6, 1.2], size: [1, 2], gravity: 62, drag: 0.9,
      ramp: ['gold', 'cream0', 'wood0', 'wood1'],
    });
    this.camera.shake(2.2, 0.3, 10);
    [0, 4, 7, 12].forEach((n, i) => {
      window.setTimeout(() => this.audio.blip(n, 0.055), i * 70);
    });
    this.toast.show(p.done, 4.2);
  }

  /** Wipe everything and begin again. Only ever reached through a confirm. */
  private startOver(): void {
    this.wiping = true;
    Save.clear();
    // Reload rather than rebuilding in place: it is the one path guaranteed to
    // leave no trace of the old valley in any system's memory.
    location.reload();
  }

  /** Walk through a gate. */
  private takeExit(exit: AreaExit): void {
    if (!AREAS[exit.to]) return;
    this.transition.begin(() => {
      // Everything in here happens on a fully black screen, including the
      // terrain bake the first time an area is visited.
      this.enterAreaData(exit.to);
      this.player.x = exit.entryTx * TILE;
      this.player.y = exit.entryTy * TILE;
      this.player.facing = exit.facing;
      this.player.vx = 0;
      this.player.vy = 0;
      this.particles.clear();
      this.camera.worldW = this.world.map.pixelW;
      this.camera.worldH = this.world.map.pixelH;
      this.camera.snapTo(this.player.x, this.player.focusY);
      this.lastDay = this.clock.day;
      this.toast.show(this.world.data.name, 2.2);
      // Saved after arriving, not before: a save taken on the way out puts you
      // back in the doorway you just used.
      this.saveGame(false);
    });
  }

  /** Write the whole world state. `announce` shows the toast. */
  private saveGame(announce = true): void {
    // A Start Over is in flight; writing now would put the valley straight back.
    if (this.wiping) return;
    const ok = Save.write({
      version: Save.SAVE_VERSION,
      savedAt: Date.now(),
      area: this.world.data.id,
      player: { x: this.player.x, y: this.player.y, facing: this.player.facing },
      clock: { minutes: this.clock.minutes, day: this.clock.day },
      weather: { sky: this.weather.sky, rain: this.weather.rain, overcast: this.weather.overcast },
      inventory: { slots: this.inventory.slots, selected: this.inventory.selected },
      // Every area that has ever been built, not just the one you are standing
      // in — walking away from a farm must not wipe it.
      areas: Object.fromEntries(
        [...this.worlds.keys()].map((id) => [id, {
          farm: Save.serializePlots(this.farms.get(id)!.all),
          props: this.worlds.get(id)!.serializeChanges(),
          drops: this.dropPools.get(id)!.serialize(),
        }]),
      ),
      seen: [...this.seen],
      projects: this.projects.doneList,
    });
    if (announce) this.toast.show(ok ? 'saved' : 'could not save');
  }

  /** Restore a save if there is one. Never throws on a bad file. */
  private loadGame(): boolean {
    const data = Save.read();
    if (!data) return false;
    // Build whatever areas the save knows about before restoring into them,
    // then stand in the one the player left off in.
    for (const id of Object.keys(data.areas)) {
      if (AREAS[id]) this.enterAreaData(id);
    }
    this.enterAreaData(AREAS[data.area] ? data.area : START_AREA);
    this.camera.worldW = this.world.map.pixelW;
    this.camera.worldH = this.world.map.pixelH;
    this.player.x = data.player.x;
    this.player.y = data.player.y;
    this.player.facing = data.player.facing;
    this.clock.minutes = data.clock.minutes;
    this.clock.day = data.clock.day;
    this.weather.restore(data.weather.sky, data.weather.rain, data.weather.overcast);
    // A save from before the inventory had a given item leaves that slot empty
    // rather than shifting everything along.
    if (data.inventory.slots.length) {
      this.inventory.restore(data.inventory.slots, data.inventory.selected);
    }
    for (const [id, a] of Object.entries(data.areas)) {
      const farm = this.farms.get(id);
      const world = this.worlds.get(id);
      const drops = this.dropPools.get(id);
      if (!farm || !world || !drops) continue; // an area this build no longer has
      farm.restore(a.farm);
      world.restoreChanges(a.props);
      drops.restore(a.drops);
    }
    this.seen = new Set(data.seen);
    // Restored before the areas are re-applied below, so a finished project is
    // reflected in every world the save knew about.
    this.projects.restore(data.projects);
    for (const id of this.worlds.keys()) this.applyProjectsFor(id);
    this.camera.snapTo(this.player.x, this.player.focusY);
    return true;
  }

  /**
   * The hotbar steps aside for anything drawn over it. Called from every
   * branch of update, because the branches that open a screen are exactly the
   * ones that return before the main path runs — which is why the hotbar sat
   * visible underneath the pause menu on the first attempt.
   */
  private updateHudFade(dt: number): void {
    const uiUp = this.dialogue.active || this.ledger.active || this.menu.active;
    this.hotbar.alpha = clamp(this.hotbar.alpha + (uiUp ? -dt * 6 : dt * 4), 0, this.hud.alpha);
    this.hotbar.update(dt, this.inventory);
    this.toast.update(dt);
  }

  private ledgerHooks() {
    return {
      inventory: this.inventory,
      projects: this.projects,
      visibleProjects: this.projects.visible(),
      onCraft: (r: RecipeDef) => this.tryCraft(r),
      onBuild: (p: ProjectDef) => this.tryBuild(p),
      onMoved: () => this.audio.blip(4, 0.035),
      onCursor: () => this.audio.blip(8, 0.025),
      onClose: () => this.closeLedger(),
    };
  }

  private openLedger(tab: 'items' | 'craft' | 'build'): void {
    this.ledger.show(tab);
    this.player.vx = 0;
    this.player.vy = 0;
    this.audio.blip(5, 0.045);
  }

  private closeLedger(): void {
    this.ledger.hide(this.inventory);
    this.audio.blip(0, 0.04);
  }

  /**
   * The single place that decides whether the player may move.
   *
   * This used to be half a dozen scattered `frozen = true/false` writes, and
   * they fought: the title card's release ran every frame and undid the
   * dialogue's hold, so control came back while the box was still closing.
   * Derived state cannot disagree with itself.
   */
  private syncFreeze(): void {
    this.player.frozen =
      !this.titleReleased ||
      this.transition.active ||
      this.menu.active ||
      this.ledger.active ||
      this.dialogue.active;
  }

  /** Which tile the player is facing, and what pressing E there would do. */
  private updateTarget(): void {
    const p = this.player.interactPoint();
    this.targetTx = Math.floor(p.x / TILE);
    this.targetTy = Math.floor(p.y / TILE);
    // A swung tool aims at a *thing*, not at a square of ground, so the
    // harvest target is resolved first and wins if it finds anything.
    this.harvestTarget = null;
    const held = this.inventory.selectedItem;
    if (held?.tool === 'axe' || held?.tool === 'pick') {
      const prop = this.world.harvestableAt(p.x, p.y);
      if (prop?.def.harvest?.tool === held.tool) this.harvestTarget = prop;
    }
    this.targetKind = this.harvestTarget
      ? (held?.tool === 'axe' ? 'chop' : 'mine')
      : this.actionAt(this.targetTx, this.targetTy);
    this.lookTarget = this.findLookTarget(p.x, p.y);
  }

  /** The nearest thing worth looking at — a prop, or the farmhouse door. */
  private findLookTarget(x: number, y: number): { key: string; x: number; y: number; top: number } | null {
    const prop = this.world.inspectableAt(x, y);
    if (prop?.inspect) {
      // Anchor the hint to the top of the actual sprite. A fixed offset floats
      // uselessly high over a signpost and buries itself in a standing stone.
      let top = 0;
      for (const layer of prop.def.layers) top = Math.min(top, layer.dy);
      return { key: prop.inspect, x: prop.x, y: prop.y, top: prop.y + top };
    }
    const door = this.world.doorPoint;
    if (door) {
      const dx = door.x - x;
      const dy = door.y - y;
      if (dx * dx + dy * dy < 16 * 16) return { key: 'house_door', x: door.x, y: door.y, top: door.y - 26 };
    }
    return null;
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
    // Something unread directly in front of you wins over farming: standing at
    // a standing stone with a hoe and pressing E, you meant to read it. Once
    // you have, the same key falls through to the tool — so the world tells
    // you a thing once and then gets out of the way.
    // The board is a piece of interface that lives in the world: walking up to
    // it and pressing E is how you find out that any of this exists.
    if (this.lookTarget?.key === 'board') {
      this.openLedger('build');
      return;
    }
    if (this.lookTarget && (!this.seen.has(this.lookTarget.key) || !kind)) {
      const lines = resolveInspect(this.lookTarget.key, this.seen);
      if (lines) {
        this.dialogue.say(lines);
        this.seen.add(this.lookTarget.key);
        this.audio.blip(2, 0.04);
        return;
      }
    }
    if (!kind) return;
    const tx = this.targetTx;
    const ty = this.targetTy;

    switch (kind) {
      case 'chop':
      case 'mine':
        this.swingProp = this.harvestTarget;
        this.player.useTool(kind === 'chop' ? 'axe' : 'pick');
        break;
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
        this.harvestBurst(tx, ty, result.crop.id);
        // The crop pops out of the plant and comes to you, the same as
        // everything else the valley gives up.
        this.pickups.spawn(result.item, result.count, tx * TILE + TILE / 2, ty * TILE + TILE - 4, Math.random);
        this.audio.blip(12, 0.07);
        this.audio.blip(19, 0.05);
        this.camera.shake(0.5, 0.12, 14);
        break;
      }
    }
  }

  /** The moment a tool connects. */
  private onToolImpact(tool: ToolKind): void {
    const tx = this.targetTx;
    const ty = this.targetTy;
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE - 2;

    if (tool === 'axe' || tool === 'pick') {
      this.strike(tool);
      return;
    }

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

  /** An axe or pick landing on something. */
  private strike(tool: 'axe' | 'pick'): void {
    const prop = this.swingProp;
    this.swingProp = null;
    if (!prop || prop.gone) {
      // A swing at nothing still lands; it just achieves nothing.
      const p = this.player.interactPoint();
      this.particles.emit({ ...FX.footstepDust(p.x, p.y), count: 3 });
      this.camera.shake(0.55, 0.1, 20);
      this.audio.footstep('stone', false);
      return;
    }

    const h = prop.def.harvest!;
    const result = this.world.strikeProp(prop, Math.random);
    if (!result) return;

    // Chips fly from where the head bit, not from the base of the trunk.
    const hitY = prop.y - 10;
    this.particles.emit(FX.impactChips(prop.x, hitY, h.chips));
    this.camera.shake(tool === 'pick' ? 1.9 : 1.6, 0.18, 15);
    this.audio.footstep(tool === 'pick' ? 'stone' : 'wood', true);
    this.audio.blip(tool === 'pick' ? -20 : -16, 0.055);

    if (result.destroyed) {
      // A bigger burst, a leaf-fall for trees, and the drops themselves.
      this.particles.emit({
        ...FX.impactChips(prop.x, hitY, h.chips), count: 16, spread: 6,
        vz: [26, 58], life: [0.5, 0.95],
      });
      if (tool === 'axe') {
        for (let i = 0; i < 6; i++) {
          this.particles.emit(FX.leafFall(prop.x + (Math.random() - 0.5) * 26, prop.y - 8, 34));
        }
      }
      this.camera.shake(2.6, 0.3, 11);
      this.audio.blip(-26, 0.09);
      for (const drop of result.drops) {
        this.pickups.spawn(drop.item, drop.count, prop.x, prop.y - 4, Math.random);
      }
    }
  }

  /** Every frame the can is pouring. */
  private onToolSustain(tool: ToolKind, dt: number): void {
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
    const keys = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8'] as const;
    for (let i = 0; i < keys.length; i++) {
      if (this.input.wasPressed(keys[i])) {
        this.inventory.select(i);
        this.audio.blip(7, 0.035);
      }
    }
  }

  /** Player, plants and dropped items, for the world's depth-sorted pass. */
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
    let j = 0;
    this.pickups.forEach((drop) => {
      let d = this.pickupDraws[j];
      if (!d) {
        d = new PickupDraw(this);
        this.pickupDraws[j] = d;
      }
      d.bind(drop);
      list.push(d);
      j++;
    });
    return list;
  }

  /** Read by CropDraw; kept together so the wrapper stays a thin adapter. */
  get renderTime(): number {
    return this.time;
  }

  get renderWind(): number {
    return this.weather.wind;
  }

  get renderSun(): { dx: number; dy: number; alpha: number } {
    return this.sun;
  }

  private update(dt: number): void {
    this.time += dt;

    // --- screens, in priority order ---------------------------------------
    // Each one takes the keyboard entirely while it is up. Anything below it
    // in this list does not run at all, which is what keeps "Escape closes the
    // thing in front of me" from needing a state machine.
    this.menu.update(dt, this.input, this.pointer, VIEW_W, VIEW_H, {
      onResume: () => { this.menu.hide(); this.audio.blip(2, 0.04); },
      onStartOver: () => this.startOver(),
      onCursor: () => this.audio.blip(6, 0.03),
      status: () => `${this.world.data.name} · Day ${this.clock.day} · ${this.clock.label}`,
    });
    if (this.menu.open) {
      this.syncFreeze();
      this.updateHudFade(dt);
      if (this.input.wasPressed('menu')) { this.menu.hide(); this.audio.blip(2, 0.04); }
      this.input.endFrame();
      this.pointer.endFrame();
      return;
    }

    if (this.ledger.open) {
      this.syncFreeze();
      this.ledger.update(dt, this.input, this.pointer, this.ledgerHooks());
      if (this.input.wasPressed('menu') || this.input.wasPressed('ledger')) this.closeLedger();
      this.updateHudFade(dt);
      this.input.endFrame();
      this.pointer.endFrame();
      return;
    }
    this.ledger.update(dt, this.input, this.pointer, this.ledgerHooks());

    // Browsers will not let audio start without a gesture, so the first key
    // press is what brings the valley's sound up.
    if (this.input.anyInputYet && !this.audio.running) {
      this.audio.start();
      const ctx = this.audio.context;
      const dest = this.audio.musicDestination;
      if (ctx && dest) this.music.attach(ctx, dest);
    }
    this.audio.resume();

    if (this.input.wasPressed('ledger') && !this.dialogue.blocking && !this.transition.active) {
      this.openLedger('items');
    }
    if (this.input.wasPressed('menu')) {
      if (this.dialogue.blocking) this.dialogue.dismiss();
      else if (!this.transition.active) { this.menu.show(); this.audio.blip(2, 0.04); }
    }

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
    if (this.title.done && !this.titleReleased) this.titleReleased = true;
    this.hud.alpha = clamp(this.hud.alpha + (this.title.dismissed ? dt * 1.4 : -dt * 2), 0, 1);
    // The hotbar steps aside while the box is open; it is the one piece of UI
    // that would sit directly behind it.
    this.updateHudFade(dt);

    this.clock.update(dt);
    this.weather.update(dt);

    // A new day: crops that were watered advance, the rest get thirstier.
    if (this.clock.day !== this.lastDay) {
      this.lastDay = this.clock.day;
      this.farm.advanceDay(this.rainedToday);
      this.rainedToday = false;
      // A day is the natural unit of progress here, so it is also the natural
      // autosave point — you can never lose more than one day's work.
      this.saveGame(false);
      this.toast.show(`Day ${this.clock.day}`);
    }
    // Rain waters everything while it falls, and counts for the night.
    if (this.weather.rain > 0.35) {
      this.farm.soak();
      this.rainedToday = true;
    }
    this.farm.update(dt);

    this.dialogue.update(dt);
    if (this.dialogue.blocking) {
      // The box has the keyboard. Nothing else reads input this frame.
      if (this.input.wasPressed('interact')) {
        this.dialogue.advance();
        this.audio.blip(this.dialogue.blocking ? 5 : 0, 0.03);
      } else if (this.input.wasPressed('menu')) {
        this.dialogue.dismiss();
      }
      this.syncFreeze();
      this.player.update(dt, this.input, this.world.blocked, this.time);
      this.updateHudFade(dt);
      this.input.endFrame();
      this.pointer.endFrame();
      this.camera.follow(this.player.x, this.player.focusY, 0, 0, dt);
      this.playerDrawable.sortY = this.player.y;
      this.playerDrawable.shadowX = this.player.x;
      this.playerDrawable.shadowY = this.player.y;
      return;
    }

    // The transition owns the player while it runs; nothing else reads input.
    this.transition.update(dt);
    if (this.transition.active) {
      this.syncFreeze();
      this.player.update(dt, this.input, this.world.blocked, this.time);
      this.camera.follow(this.player.x, this.player.focusY, 0, 0, dt);
      this.updateHudFade(dt);
      this.playerDrawable.sortY = this.player.y;
      this.playerDrawable.shadowX = this.player.x;
      this.playerDrawable.shadowY = this.player.y;
      this.input.endFrame();
      this.pointer.endFrame();
      return;
    }
    this.syncFreeze();
    this.player.update(dt, this.input, this.world.blocked, this.time);

    // Walking into a gate takes it. No key press: a gate you have to confirm
    // is a door, and this is a gap in a hedge.
    const exit = this.world.exitAt(this.player.x, this.player.y - 3);
    if (exit) {
      this.takeExit(exit);
      this.input.endFrame();
      this.pointer.endFrame();
      return;
    }

    this.updateTarget();
    this.handleHotbar();
    if (this.input.wasPressed('interact') && !this.player.swinging && !this.player.frozen) {
      this.act();
    }
    this.world.update(
      dt, this.time, this.weather, this.clock, this.particles,
      this.camera.originX, this.camera.originY, VIEW_W, VIEW_H,
    );
    this.pickups.update(
      dt, this.player.x, this.player.y,
      (id, count) => this.inventory.add(id, count, this.time),
      (id, count) => {
        this.audio.blip(14 + Math.random() * 4, 0.045);
        const name = item(id).name;
        this.toast.show(count > 1 ? `${name} x${count}` : name, 1.4);
      },
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
    this.pointer.endFrame();
  }

  private render(): void {
    const { renderer, camera, world, clock } = this;
    const ctx = renderer.ctx;
    const camX = camera.originX;
    const camY = camera.originY;

    this.sun = clock.shadow(this.weather.overcast);

    renderer.clearWorld();
    world.drawGround(ctx, camX, camY, VIEW_W + 1, VIEW_H + 1, clock);
    // Worked soil sits on the ground, above the terrain and below everything
    // that stands on it.
    this.farm.drawSoil(ctx, camX, camY, VIEW_W + 1, VIEW_H + 1);
    // For a swung tool the bracket goes round the thing being struck; for a
    // farm action it goes round the square of ground.
    const brackX = this.harvestTarget ? Math.floor(this.harvestTarget.x / TILE) : this.targetTx;
    const brackY = this.harvestTarget ? Math.floor((this.harvestTarget.y - 4) / TILE) : this.targetTy;
    drawTarget(ctx, brackX, brackY, camX, camY, this.targetKind, this.time);
    // Shown exactly when E would open the box — a hint that lies about what a
    // key does is worse than no hint at all.
    const wouldRead = this.lookTarget && (!this.seen.has(this.lookTarget.key) || !this.targetKind);
    if (wouldRead && this.lookTarget && !this.dialogue.active) {
      drawLookHint(ctx, this.lookTarget.x, this.lookTarget.top - 5, camX, camY, this.time);
    }
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
    this.toast.draw(uctx, VIEW_W, VIEW_H);
    drawDialogue(uctx, this.dialogue, VIEW_W, VIEW_H, this.time);
    this.ledger.draw(uctx, VIEW_W, VIEW_H, this.ledgerHooks(), this.pointer, this.time);
    this.menu.draw(uctx, VIEW_W, VIEW_H, this.pointer, {
      onResume: () => {},
      onStartOver: () => {},
      onCursor: () => {},
      status: () => `${this.world.data.name} · Day ${this.clock.day} · ${this.clock.label}`,
    });
    if (this.transition.cover > 0.001) {
      uctx.globalAlpha = this.transition.cover;
      uctx.fillStyle = '#0d0b11';
      uctx.fillRect(0, 0, VIEW_W, VIEW_H);
      uctx.globalAlpha = 1;
    }
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

/** Same adapter trick as CropDraw, for items lying on the ground. */
class PickupDraw implements Drawable {
  sortY = 0;
  private drop: Readonly<Drop> | null = null;

  constructor(private game: Game) {}

  bind(drop: Readonly<Drop>): void {
    this.drop = drop;
    this.sortY = Pickups.sortY(drop);
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    if (!this.drop) return;
    Pickups.draw(ctx, this.drop, camX, camY, this.game.renderTime, this.game.renderSun);
  }
}

/** Where a project's work happens, for aiming the celebration at it. */
function firstEffectSpot(p: ProjectDef): { tx: number; ty: number } | null {
  for (const e of p.effects) {
    if (e.kind === 'addProps' && e.props.length) {
      const mid = e.props[Math.floor(e.props.length / 2)];
      return { tx: mid.tx, ty: mid.ty };
    }
  }
  return null;
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
