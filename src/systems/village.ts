/**
 * THE VILLAGE
 *
 * Owns an area's residents: builds them, decides where the clock says they
 * should be, and holds what the player has got out of them so far.
 *
 * Two decisions worth keeping:
 *
 *  - **Position is derived, never stored.** Where somebody is standing is a
 *    function of the hour and the weather, so entering an area evaluates it
 *    rather than replaying it, the save has nothing to desync from, and an
 *    area nobody is standing in costs nothing at all. It is the same call
 *    `projects.ts` made about world state, for the same reason.
 *  - **Relationship state is not a number.** `met`, the day you last spoke,
 *    and a set of topics that have come up. A bar that fills is the exact
 *    generic-RPG texture this settlement was built to avoid.
 */

import { NPCS, entryAt, type Act, type NpcDef } from '../data/npcs.ts';
import { Npc, type NpcArt } from '../entities/npc.ts';
import * as A from '../art/npc.art.ts';
import type { AreaData } from '../data/area.ts';
import { TILE } from '../world/materials.ts';
import type { Sky } from './weather.ts';

const ART: Record<string, NpcArt> = {
  nan: {
    down: [A.NAN_DOWN_PASS, A.NAN_DOWN_STEP_A, A.NAN_DOWN_STEP_B],
    side: [A.NAN_SIDE_PASS, A.NAN_SIDE_STEP_A, A.NAN_SIDE_STEP_B],
    up: [A.NAN_UP_PASS, A.NAN_UP_STEP_A, A.NAN_UP_STEP_B],
    poses: { sweep: [A.NAN_SWEEP_A, A.NAN_SWEEP_B], sit: [A.NAN_SIT], tend: [A.NAN_SWEEP_B, A.NAN_SWEEP_A] },
  },
  rue: {
    down: [A.RUE_DOWN_PASS, A.RUE_DOWN_STEP_A, A.RUE_DOWN_STEP_B],
    side: [A.RUE_SIDE_PASS, A.RUE_SIDE_STEP_A, A.RUE_SIDE_STEP_B],
    up: [A.RUE_UP_PASS, A.RUE_UP_STEP_A, A.RUE_UP_STEP_B],
    poses: { lean: [A.RUE_LEAN] },
  },
  orrin: {
    down: [A.ORRIN_DOWN_PASS, A.ORRIN_DOWN_STEP_A, A.ORRIN_DOWN_STEP_B],
    side: [A.ORRIN_SIDE_PASS, A.ORRIN_SIDE_STEP_A, A.ORRIN_SIDE_STEP_B],
    up: [A.ORRIN_UP_PASS, A.ORRIN_UP_STEP_A, A.ORRIN_UP_STEP_B],
    poses: { work: [A.ORRIN_WORK_A, A.ORRIN_WORK_B], sit: [A.ORRIN_SIT] },
  },
};

export interface TalkState {
  met: boolean;
  lastDay: number;
  topics: Set<string>;
}

export class Village {
  readonly people: Npc[] = [];
  private data: AreaData;
  /** What the last evaluation decided, so we only re-route on a real change. */
  private lastKey = new Map<string, string>();

  constructor(area: AreaData) {
    this.data = area;
    for (const def of NPCS) {
      if (def.area !== area.id) continue;
      const art = ART[def.id];
      if (!art) continue;
      this.people.push(new Npc(def, art));
    }
  }

  get empty(): boolean { return this.people.length === 0; }

  private spot(name: string): { x: number; y: number } | null {
    const w = this.data.waypoints?.[name];
    return w ? { x: w.tx * TILE, y: w.ty * TILE } : null;
  }

  /**
   * What this person should be doing right now. Weather overrides the day's
   * plan, and each of the three overrides it differently, because how somebody
   * behaves in the rain is character rather than a feature.
   */
  private decide(def: NpcDef, hour: number, sky: Sky, done: ReadonlySet<string>): { spot: string; act: Act } {
    const wet = sky === 'rain';
    const e = entryAt(def, hour);
    let spot = e.spot;
    let act: Act = e.act;
    // A finished project can move where somebody spends their evening.
    if (e.ifDone && done.has(e.ifDone.project)) spot = e.ifDone.spot;
    // A roaming act drifts, on a cadence taken from the clock so that it is
    // still reproducible frame for frame.
    if (act === 'walk' && def.wander && def.wander.length) {
      spot = def.wander[Math.floor(hour * 3) % def.wander.length];
    }
    if (wet && act !== 'in') {
      const r = def.rain;
      act = r.act;
      // A null rain spot means "wherever you already are" — Rue stands in it.
      if (r.spot) spot = r.spot;
    }
    return { spot, act };
  }

  /** Evaluate everybody for this instant and walk them there. */
  update(dt: number, time: number, hour: number, sky: Sky, done: ReadonlySet<string>, snap: boolean): void {
    const corridor = (this.data.corridorY ?? 14) * TILE;
    for (const p of this.people) {
      const { spot, act } = this.decide(p.def, hour, sky, done);
      const key = `${spot}|${act}`;
      if (this.lastKey.get(p.def.id) !== key) {
        this.lastKey.set(p.def.id, key);
        const at = this.spot(spot) ?? this.spot(p.def.home);
        if (at) {
          if (snap) p.placeAt(at.x, at.y, act);
          else p.goTo(at.x, at.y, corridor, act);
        }
      }
      // Indoors is not drawn and not talkable, but only once they have got
      // there — walking home has to be visible or the row empties by magic.
      p.hidden = act === 'in' && !p.walking;
      p.update(dt, time);
    }
  }

  /** Re-seat everybody for the current hour with no walking. */
  snapTo(hour: number, sky: Sky, done: ReadonlySet<string>): void {
    this.lastKey.clear();
    this.update(0, 0, hour, sky, done, true);
  }

  /** The nearest person close enough to talk to, if any. */
  nearest(x: number, y: number, within = 26): Npc | null {
    let best: Npc | null = null;
    let bestD = within * within;
    for (const p of this.people) {
      if (p.hidden) continue;
      const dx = p.x - x;
      const dy = p.y - y - 4;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  byId(id: string): Npc | undefined {
    return this.people.find((p) => p.def.id === id);
  }
}

/** Talk state for everybody, across every area. Small on purpose. */
export class TalkBook {
  private map = new Map<string, TalkState>();

  get(id: string): TalkState {
    let s = this.map.get(id);
    if (!s) {
      s = { met: false, lastDay: -1, topics: new Set() };
      this.map.set(id, s);
    }
    return s;
  }

  serialize(): Record<string, { met: boolean; lastDay: number; topics: string[] }> {
    const out: Record<string, { met: boolean; lastDay: number; topics: string[] }> = {};
    for (const [id, s] of this.map) out[id] = { met: s.met, lastDay: s.lastDay, topics: [...s.topics] };
    return out;
  }

  restore(raw: Record<string, { met: boolean; lastDay: number; topics: string[] }>, day: number): void {
    this.map.clear();
    const known = new Set(NPCS.map((n) => n.id));
    for (const [id, v] of Object.entries(raw ?? {})) {
      // An id this build no longer has is dropped rather than carried forward
      // in every future save, quietly matching nothing — the same rule
      // `Projects.restore` follows.
      if (!known.has(id)) continue;
      this.map.set(id, {
        met: v.met === true,
        lastDay: Math.max(-1, Math.min(day, Math.floor(Number(v.lastDay) || -1))),
        topics: new Set(Array.isArray(v.topics) ? v.topics.filter((t) => typeof t === 'string').slice(0, 64) : []),
      });
    }
  }
}
