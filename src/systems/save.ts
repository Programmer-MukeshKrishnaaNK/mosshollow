/**
 * SAVE / LOAD
 *
 * Built now rather than later, because retrofitting persistence onto systems
 * that were written without it is how save files end up half-complete.
 *
 * Two rules the loader follows, and they matter more than the format:
 *
 *  1. **Every field is optional on the way in.** Reading is done through
 *     helpers that take a default. A save written by an older build is missing
 *     fields the current build expects; a save written by a newer build has
 *     fields this one has never heard of. Neither may throw.
 *  2. **Content ids are validated against the data, not trusted.** A save
 *     naming a crop or item that no longer exists drops that one entry and
 *     keeps the rest. Losing a plant is a bug report; losing the farm is a
 *     ruined afternoon.
 *
 * The version number exists so that a real migration can be added later
 * without guessing what an old file contained.
 */

import { CROPS } from '../data/crops.ts';
import { ITEMS } from '../data/items.ts';
import type { Facing } from '../entities/player.ts';
import type { Plot } from './farm.ts';
import type { Slot } from './inventory.ts';
import type { Sky } from './weather.ts';
import type { PropChange } from '../world/props.ts';

export const SAVE_VERSION = 1;
const KEY = 'mosshollow.save.v1';

export interface SaveData {
  version: number;
  savedAt: number;
  area: string;
  player: { x: number; y: number; facing: Facing };
  clock: { minutes: number; day: number };
  weather: { sky: Sky; rain: number; overcast: number };
  inventory: { slots: Slot[]; selected: number };
  farm: PlotSave[];
  /** Only what the player changed — the two thousand generated props are not
   *  in here, because the seed reproduces them exactly. */
  props: PropChange[];
  /** Items still lying on the ground. */
  drops: DropSave[];
}

export interface DropSave {
  id: string;
  count: number;
  x: number;
  y: number;
}

export interface PlotSave {
  tx: number;
  ty: number;
  tilled: boolean;
  wet: boolean;
  crop: string | null;
  stage: number;
  progress: number;
  thirst: number;
  withered: boolean;
  regrowLeft: number;
}

// --- defensive readers ------------------------------------------------------

type Unknown = Record<string, unknown>;

function obj(v: unknown): Unknown {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Unknown) : {};
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function str<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

const FACINGS: Facing[] = ['down', 'up', 'left', 'right'];
const SKIES: Sky[] = ['clear', 'gathering', 'rain', 'clearing'];

// --- writing ----------------------------------------------------------------

export function serializePlots(plots: Iterable<Plot>): PlotSave[] {
  const out: PlotSave[] = [];
  for (const p of plots) {
    // Bare, unworked tiles carry no information worth storing.
    if (!p.tilled && !p.crop) continue;
    out.push({
      tx: p.tx, ty: p.ty, tilled: p.tilled, wet: p.wet, crop: p.crop,
      stage: p.stage, progress: p.progress, thirst: p.thirst,
      withered: p.withered, regrowLeft: p.regrowLeft,
    });
  }
  return out;
}

export function write(data: SaveData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    // Private browsing, a full quota, or storage disabled entirely. The game
    // keeps running; it just will not remember.
    console.warn('Could not write save:', err);
    return false;
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

export function exists(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

// --- reading ----------------------------------------------------------------

/** Returns null when there is nothing to load or the file is unusable. */
export function read(): SaveData | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('Save file is not valid JSON; ignoring it.');
    return null;
  }

  const root = obj(parsed);
  const version = num(root.version, 0);
  if (version > SAVE_VERSION) {
    // Written by a newer build. Reading it would silently discard whatever it
    // knows that we do not, so refuse rather than quietly downgrade the file.
    console.warn(`Save is version ${version}, this build reads ${SAVE_VERSION}. Not loading.`);
    return null;
  }

  const player = obj(root.player);
  const clock = obj(root.clock);
  const weather = obj(root.weather);
  const inventory = obj(root.inventory);

  return {
    version: SAVE_VERSION,
    savedAt: num(root.savedAt, 0),
    area: typeof root.area === 'string' ? root.area : 'homestead',
    player: {
      x: num(player.x, 232),
      y: num(player.y, 275),
      facing: str(player.facing, FACINGS, 'down'),
    },
    clock: {
      minutes: Math.max(0, Math.min(1439, num(clock.minutes, 7.6 * 60))),
      // Clamped as well as floored: a corrupt file offering day 1e9 will not
      // crash anything, but it will render as nonsense in the almanac forever.
      day: Math.max(1, Math.min(999_999, Math.floor(num(clock.day, 1)))),
    },
    weather: {
      sky: str(weather.sky, SKIES, 'clear'),
      rain: Math.max(0, Math.min(1, num(weather.rain, 0))),
      overcast: Math.max(0, Math.min(1, num(weather.overcast, 0))),
    },
    inventory: {
      selected: Math.max(0, Math.floor(num(inventory.selected, 0))),
      slots: readSlots(inventory.slots),
    },
    farm: readPlots(root.farm),
    props: readPropChanges(root.props),
    drops: readDrops(root.drops),
  };
}

function readPropChanges(v: unknown): PropChange[] {
  const out: PropChange[] = [];
  for (const entry of arr(v)) {
    const c = obj(entry);
    const x = num(c.x, NaN);
    const y = num(c.y, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const change: PropChange = { x, y };
    // `to` distinguishes three states: absent (damaged only), null (removed),
    // and a string (became something else). Only those three are accepted.
    if (c.to === null) change.to = null;
    else if (typeof c.to === 'string') change.to = c.to;
    if (typeof c.hp === 'number' && Number.isFinite(c.hp)) {
      change.hp = Math.max(0, Math.floor(c.hp));
    }
    out.push(change);
  }
  return out;
}

function readDrops(v: unknown): DropSave[] {
  const out: DropSave[] = [];
  for (const entry of arr(v)) {
    const d = obj(entry);
    const id = typeof d.id === 'string' && d.id in ITEMS ? d.id : null;
    if (!id) continue; // an item this build no longer has; leave it behind
    const count = Math.max(1, Math.floor(num(d.count, 1)));
    const x = num(d.x, NaN);
    const y = num(d.y, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ id, count, x, y });
  }
  return out;
}

function readSlots(v: unknown): Slot[] {
  return arr(v).map((entry) => {
    const s = obj(entry);
    const id = typeof s.id === 'string' && s.id in ITEMS ? s.id : null;
    const count = id ? Math.max(0, Math.floor(num(s.count, 0))) : 0;
    // A slot naming an item this build no longer has becomes an empty slot
    // rather than a crash or a phantom stack.
    return count > 0 ? { id, count } : { id: null, count: 0 };
  });
}

function readPlots(v: unknown): PlotSave[] {
  const out: PlotSave[] = [];
  for (const entry of arr(v)) {
    const p = obj(entry);
    const tx = Math.floor(num(p.tx, NaN));
    const ty = Math.floor(num(p.ty, NaN));
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;

    let crop: string | null = typeof p.crop === 'string' ? p.crop : null;
    if (crop && !(crop in CROPS)) crop = null; // the crop was removed; the bed survives

    const maxStage = crop ? CROPS[crop].art.length - 1 : 0;
    out.push({
      tx,
      ty,
      tilled: bool(p.tilled, true),
      wet: bool(p.wet, false),
      crop,
      stage: Math.max(0, Math.min(maxStage, Math.floor(num(p.stage, 0)))),
      progress: Math.max(0, Math.floor(num(p.progress, 0))),
      thirst: Math.max(0, Math.floor(num(p.thirst, 0))),
      withered: bool(p.withered, false),
      regrowLeft: Math.max(0, Math.floor(num(p.regrowLeft, 0))),
    });
  }
  return out;
}
