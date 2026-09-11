/**
 * PROJECTS — state and rules.
 *
 * Tracks which projects are finished and decides what may be started. It does
 * not touch the world: applying an effect needs the areas, which belong to the
 * game, so the game does that part. Keeping the split means this file stays
 * testable and the save only has to store a list of ids.
 */

import { PROJECTS, type ProjectDef } from '../data/projects.ts';
import { has } from './crafting.ts';
import type { Inventory } from './inventory.ts';
import type { Story } from './story.ts';

export type ProjectState = 'done' | 'ready' | 'short' | 'locked';

export class Projects {
  private completed = new Set<string>();
  /**
   * Consulted for projects that are gated on the story rather than on other
   * projects. Set once by the game; the rules stay in here either way.
   */
  private story: Story | null = null;

  bindStory(s: Story): void {
    this.story = s;
  }

  private storyReady(p: ProjectDef): boolean {
    if (!p.requiresStory) return true;
    return !!this.story && this.story.has(p.requiresStory as never);
  }

  get doneList(): string[] {
    return [...this.completed];
  }

  isDone(id: string): boolean {
    return this.completed.has(id);
  }

  restore(ids: readonly string[]): void {
    // Ids this build does not recognise are dropped rather than carried
    // forward: a project removed from the game should not sit in every save
    // file for ever, quietly matching nothing.
    const known = new Set(PROJECTS.map((p) => p.id));
    this.completed = new Set(
      Array.isArray(ids) ? ids.filter((i) => typeof i === 'string' && known.has(i)) : [],
    );
  }

  /**
   * Everything the board should show. Locked entries are included but greyed:
   * seeing what the next one will be is half of why a board is worth having.
   */
  visible(): ProjectDef[] {
    return PROJECTS.filter((p) => {
      if (this.completed.has(p.id)) return true;
      // A story-gated project is not merely locked, it is absent. Showing it
      // greyed out would advertise the ending.
      if (!this.storyReady(p)) return false;
      // Hide anything two steps away, so the board is a short list of real
      // options rather than a roadmap.
      const reqs = p.requires ?? [];
      return reqs.every((r) => this.completed.has(r) || this.oneAway(r));
    });
  }

  private oneAway(id: string): boolean {
    const p = PROJECTS.find((x) => x.id === id);
    if (!p) return false;
    return (p.requires ?? []).every((r) => this.completed.has(r));
  }

  state(p: ProjectDef, inv: Inventory): ProjectState {
    if (this.completed.has(p.id)) return 'done';
    if (!this.storyReady(p)) return 'locked';
    if ((p.requires ?? []).some((r) => !this.completed.has(r))) return 'locked';
    return has(inv, p.cost) ? 'ready' : 'short';
  }

  /** Spend the materials and mark it done. The caller applies the effects. */
  build(p: ProjectDef, inv: Inventory): boolean {
    if (this.state(p, inv) !== 'ready') return false;
    for (const c of p.cost) inv.remove(c.item, c.count);
    this.completed.add(p.id);
    return true;
  }

  /** Used when loading: mark done without spending anything. */
  markDone(id: string): void {
    this.completed.add(id);
  }
}
