/**
 * OBJECTIVES
 *
 * A first-time player opens Moss Hollow in a field with six tools and no idea
 * that a satchel, a project board or a standing stone exist. This exists to
 * answer "what matters right now" and nothing else.
 *
 * Two rules it is built around:
 *
 *  1. **Guide, do not instruct.** Every line here names a purpose, never a
 *     button and never a direction. "Find the three standing stones" is a
 *     reason to walk about; "press E on the stone by the pond" is a chore list.
 *     The player still gets to find out how.
 *  2. **Never spoil.** The valley's whole appeal is three facts and no
 *     explanation, so an objective may say what you are looking for and must
 *     not say what it means. "Learn what happened to the bells" is fine.
 *     "Learn that the valley took its own bells down" is the game, given away
 *     in a HUD box.
 *
 * There is no progression system in here. Every objective is a *question asked
 * of state that already exists* — the inspect keys you have read, the story
 * beats you have landed, the projects you have finished, the plots in your
 * field. The only thing stored is which ones have already come true, because
 * "you have planted a crop" stops being visible in the world the moment you
 * harvest it, and an objective that un-completes itself is worse than none.
 */

import type { Plot } from './farm.ts';

/**
 * What an objective is allowed to look at. Deliberately borrowed rather than
 * copied: an earlier version built two fresh Sets out of the story beats and
 * the finished projects on every single frame, which is a lot of garbage to
 * make sixty times a second for a question whose answer changes once an hour.
 */
export interface ObjectiveCtx {
  /** How many areas the player has actually been to. */
  areasVisited: number;
  /** Inspect keys read — the live set, not a copy. */
  seen: ReadonlySet<string>;
  /** Asks the story directly instead of snapshotting it. */
  hasStory(id: string): boolean;
  /** Asks the project list directly. */
  projectCount: number;
  plots: Iterable<Plot>;
}

export interface ObjectiveDef {
  id: string;
  /** Shown to the player. Kept apart from the id so wording can change freely. */
  text: string;
  /** Hidden until all of these are complete, so the list is never a roadmap. */
  after?: readonly string[];
  /** True when existing state says this has happened. */
  done(c: ObjectiveCtx): boolean;
}

const anyPlot = (plots: Iterable<Plot>, f: (p: Plot) => boolean): boolean => {
  for (const p of plots) if (f(p)) return true;
  return false;
};

/**
 * The chain. Early entries are a little more explicit because somebody has to
 * learn that this is a game with a field in it; later ones are the valley's own
 * questions, in the valley's own voice.
 */
export const OBJECTIVES: ObjectiveDef[] = [
  {
    id: 'early_explore',
    text: 'Explore the valley.',
    done: (c) => c.areasVisited > 1,
  },
  {
    id: 'first_crop',
    text: 'Plant your first crop.',
    after: ['early_explore'],
    done: (c) => anyPlot(c.plots, (p) => p.crop !== null),
  },
  {
    id: 'water_crops',
    text: 'Keep your crops watered.',
    after: ['first_crop'],
    // Growth only happens on a watered day, so a plant that has moved on at all
    // is proof the lesson landed.
    done: (c) => anyPlot(c.plots, (p) => p.crop !== null && p.stage >= 1),
  },
  {
    id: 'restore_home',
    text: 'Begin putting the farmhouse right.',
    after: ['first_crop'],
    done: (c) => c.projectCount > 0,
  },
  {
    id: 'standing_stones',
    text: 'Find the three standing stones.',
    after: ['restore_home'],
    done: (c) => c.seen.has('bell_wood') && c.seen.has('bell_pond') && c.seen.has('bell_ruin'),
  },
  {
    id: 'the_bells',
    text: 'Learn what happened to the bells.',
    after: ['standing_stones'],
    done: (c) => c.hasStory('nan_bells'),
  },
  {
    id: 'warm_stone',
    text: 'Find out why the pond stone is warm.',
    after: ['the_bells'],
    // Rue is the one who can name the place nobody has ever got into.
    done: (c) => c.hasStory('rue_place'),
  },
  {
    id: 'beneath_stone',
    text: 'Discover what is beneath the warm stone.',
    after: ['warm_stone'],
    done: (c) => c.hasStory('the_note'),
  },
  {
    id: 'who_asked',
    text: 'There is one person who will know.',
    after: ['beneath_stone'],
    done: (c) => c.hasStory('nan_answer'),
  },
];

const KNOWN = new Set(OBJECTIVES.map((o) => o.id));

/** How long a finished objective stays on the card with its tick. */
const HOLD = 4.2;
/** Most rows shown at once. A list longer than this is a backlog, not a guide. */
export const MAX_ROWS = 3;

export interface ObjectiveRow {
  def: ObjectiveDef;
  complete: boolean;
  /** 0 at the moment of completion, rising to 1. Drives the tick and the glow. */
  age: number;
}

export class Objectives {
  /** Ids that have come true. The only thing here that is remembered. */
  private done = new Set<string>();
  /** Completion times, for the brief moment a finished line stays up. */
  private finishedAt = new Map<string, number>();
  private time = 0;
  /** Raised for one frame when something completes, so the game can chime. */
  justCompleted: string | null = null;

  has(id: string): boolean {
    return this.done.has(id);
  }

  private revealed(o: ObjectiveDef): boolean {
    return (o.after ?? []).every((id) => this.done.has(id));
  }

  /**
   * Re-ask every question. Cheap — a handful of set lookups and one pass over
   * the field — and it means the card can never disagree with the world.
   */
  private since = 0;

  update(dt: number, c: ObjectiveCtx): void {
    this.time += dt;
    this.justCompleted = null;
    // Four times a second is far faster than anything here can change, and it
    // keeps the per-frame cost of the guidance system at one float add.
    this.since += dt;
    if (this.since < 0.25) return;
    this.since = 0;
    for (const o of OBJECTIVES) {
      if (this.done.has(o.id)) continue;
      if (!this.revealed(o)) continue;
      if (!o.done(c)) continue;
      this.done.add(o.id);
      this.finishedAt.set(o.id, this.time);
      this.justCompleted = o.id;
    }
  }

  /**
   * What the card shows: anything just finished, then the live objectives,
   * capped. A restored save shows no ticks — those are for things that happened
   * while you were watching.
   */
  rows(): ObjectiveRow[] {
    const out: ObjectiveRow[] = [];
    for (const o of OBJECTIVES) {
      if (!this.done.has(o.id)) continue;
      const at = this.finishedAt.get(o.id);
      if (at === undefined) continue;
      const age = (this.time - at) / HOLD;
      if (age >= 1) {
        this.finishedAt.delete(o.id);
        continue;
      }
      out.push({ def: o, complete: true, age });
    }
    for (const o of OBJECTIVES) {
      if (this.done.has(o.id) || !this.revealed(o)) continue;
      out.push({ def: o, complete: false, age: 1 });
      if (out.length >= MAX_ROWS) break;
    }
    return out.slice(0, MAX_ROWS);
  }

  get list(): string[] {
    return [...this.done];
  }

  restore(ids: readonly string[]): void {
    // Unknown ids are dropped rather than carried forward for ever, quietly
    // matching nothing — the same rule projects, story beats and npcs follow.
    this.done = new Set(
      (Array.isArray(ids) ? ids : []).filter((i) => typeof i === 'string' && KNOWN.has(i)),
    );
    this.finishedAt.clear();
  }
}
