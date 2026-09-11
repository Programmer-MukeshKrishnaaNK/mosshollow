/**
 * THE THREAD
 *
 * Phase 7. The valley has been asking one question since the first standing
 * stone in Phase 4, and this is where it gets answered — the human half of it,
 * anyway. One thing stays unexplained on purpose, because a mystery that is
 * fully accounted for stops being one.
 *
 * A beat is a flag and nothing more. There is no quest log, no objective
 * marker and no arrow: the thread is carried entirely by what people say and
 * what the world lets you do next, which is the same way the environmental
 * storytelling has worked since the beginning. If the player cannot follow it
 * without a journal then the writing is wrong and a journal would only hide
 * that.
 *
 * The order is enforced because each beat is somebody telling you the piece
 * only they could know:
 *
 *   nan_bells      Nan   — nine of them, one night, and the valley did it
 *                          itself because somebody asked.
 *   orrin_cradles  Orrin — he built what they were carried in, so he knows
 *                          they were carried and not carted, and therefore
 *                          that they did not go far.
 *   rue_place      Rue   — she has been everywhere inside that radius, because
 *                          she is bored and has had eleven years. There is one
 *                          place she has never been able to get into.
 *   stone_lifted         — you lever it up. It is a Phase 6 project, because
 *                          the player already knows how those work and the
 *                          answer should arrive through a door they have used.
 *   the_note             — what is under it.
 *   nan_answer     Nan   — who asked. She will tell you once you are holding
 *                          the proof, and not one minute before.
 */

export const BEATS = [
  'nan_bells',
  'orrin_cradles',
  'rue_place',
  'stone_lifted',
  'the_note',
  'nan_answer',
] as const;

export type Beat = (typeof BEATS)[number];

const KNOWN = new Set<string>(BEATS);

export class Story {
  private flags = new Set<Beat>();

  has(b: Beat): boolean {
    return this.flags.has(b);
  }

  /** True once every listed beat has landed. */
  all(...bs: Beat[]): boolean {
    return bs.every((b) => this.flags.has(b));
  }

  mark(b: Beat): void {
    this.flags.add(b);
  }

  get list(): string[] {
    return [...this.flags];
  }

  /** How far along the thread is, for a one-line debug read. */
  get depth(): number {
    let n = 0;
    for (const b of BEATS) {
      if (!this.flags.has(b)) break;
      n++;
    }
    return n;
  }

  restore(ids: readonly string[]): void {
    // Unknown beats are dropped rather than carried in every future save,
    // quietly matching nothing — the same rule projects and npc ids follow.
    this.flags = new Set(
      (Array.isArray(ids) ? ids : []).filter((i): i is Beat => typeof i === 'string' && KNOWN.has(i)),
    );
  }
}
