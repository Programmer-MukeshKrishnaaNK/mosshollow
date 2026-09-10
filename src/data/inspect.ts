/**
 * WHAT THINGS SAY WHEN YOU LOOK AT THEM
 *
 * The valley's narration. All of it is written to do one of two jobs: tell you
 * that somebody lived here and stopped, or tell you that something here is not
 * quite ordinary — without ever explaining which.
 *
 * An entry can be a function of what the player has already read, so the world
 * can notice that you have been paying attention. That is cheap to do and it is
 * most of what makes environmental storytelling feel authored rather than
 * placed.
 */

import type { DialogueLine } from '../systems/dialogue.ts';

export type InspectEntry =
  | readonly (DialogueLine | string)[]
  | ((seen: ReadonlySet<string>) => readonly (DialogueLine | string)[]);

export const INSPECT: Record<string, InspectEntry> = {
  house_door: [
    'Yours, as of yesterday.',
    'The key was under the step, exactly where the letter said it would be. The letter did not say much else.',
  ],

  sign_crossroads: [
    'The signboard has weathered blank. Four arms, and not a word left on any of them.',
    'Someone has cut a single letter into the post, low down, where the rain does not reach. B.',
  ],

  // The first marker. Deliberately gives you three facts and no explanation.
  bell_wood: [
    'A standing stone, waist high, cut square by hand.',
    'There is an iron bracket at the top. Whatever hung from it is gone.',
    'Nothing grows within a foot of the base. Not moss, not grass, not bramble — and everything here is bramble.',
  ],

  // The second one changes if you have already found the first, because
  // noticing the pattern is the discovery, not the stone.
  bell_pond: (seen) =>
    seen.has('bell_wood')
      ? [
          'The same square stone. The same empty bracket.',
          'So there are two.',
          'This one is warm. It has been raining on and off all week, and this one is warm.',
        ]
      : [
          'A standing stone at the water\'s edge, waist high, cut square.',
          'There is an iron bracket at the top with nothing hanging from it.',
          'It is warm, which stone at a waterside in the morning has no business being.',
        ],

  crate_yard: [
    'Seed packets, a spare tool handle, and a ledger.',
    'The ledger is weather and yields in a small careful hand, going back further than you want to count.',
    'The last nine years have been torn out.',
  ],

  dock: [
    'The planks are newer than anything else here. Someone replaced them, and not long ago.',
    'They stop three feet short of where the old posts still stand in the water.',
  ],

  lantern_yard: [
    'The wick is trimmed and the glass has been wiped clean on the inside.',
    'You have not lit these.',
  ],

  stump_old: [
    'Cut clean, and a long time ago.',
    'You start counting rings out of habit and lose your place somewhere after sixty.',
  ],
};

/** Resolve an entry against what the player has already read. */
export function resolveInspect(
  key: string,
  seen: ReadonlySet<string>,
): readonly (DialogueLine | string)[] | null {
  const entry = INSPECT[key];
  if (!entry) return null;
  return typeof entry === 'function' ? entry(seen) : entry;
}
