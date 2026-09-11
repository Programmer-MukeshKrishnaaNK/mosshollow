/**
 * WHAT THE THREE OF THEM SAY
 *
 * Same idiom as `inspect.ts` — an entry is a function of what the player has
 * already done — widened from one argument to a context, because a person can
 * notice more than a signpost can. `systems/dialogue.ts` is not touched: it
 * was written speaker-and-page-aware on day one and the `speaker` tab in
 * `dialogueBox.ts` has been drawn and unused ever since. This is what it was
 * for.
 *
 * Selection order is: first meeting, then anything newly unlocked, then a line
 * for today's hour and weather, then a repeat. Repeats are written *as*
 * repeats. People in small places say the same thing twice and pretending
 * otherwise is what makes a village feel like a menu.
 *
 * On the bells: Nan gives exactly one hard new fact and takes the question
 * somewhere larger. She does not explain, and she is not being coy for the
 * sake of it — she is telling the truth about the part she will talk about.
 * The rest is not Phase 5's to give away.
 */

import type { DialogueLine } from '../systems/dialogue.ts';
import type { Phase } from '../systems/time.ts';
import type { Sky } from '../systems/weather.ts';

export interface TalkCtx {
  /** Story beats that have landed. Phase 7's thread runs on these. */
  story: ReadonlySet<string>;
  /** Inspect keys read. */
  seen: ReadonlySet<string>;
  /** Finished projects. */
  done: ReadonlySet<string>;
  day: number;
  phase: Phase;
  sky: Sky;
  met: boolean;
  lastDay: number;
  topics: ReadonlySet<string>;
}

export interface TalkResult {
  lines: readonly (DialogueLine | string)[];
  /** Remembered once delivered, so it is never offered as news twice. */
  unlock?: string;
  /** A story beat this conversation lands. */
  beat?: string;
}

const say = (speaker: string, ...text: string[]): DialogueLine[] =>
  text.map((t) => ({ speaker, text: t }));

// --- NAN ---------------------------------------------------------------------

const NAN = 'Nan Hollis';

function nan(c: TalkCtx): TalkResult {
  if (!c.met) {
    return {
      lines: say(NAN,
        'You will be the one who took the old place up the road.',
        'I am not going to ask how you are finding it. You will tell me when you have decided.',
        'Nan Hollis. The step you are standing on is mine, so mind it.',
      ),
      unlock: 'met',
    };
  }

  // The payoff of the three standing stones. One new fact, a larger question.
  const bells = ['bell_wood', 'bell_pond', 'bell_ruin'].every((k) => c.seen.has(k));
  if (bells && !c.topics.has('bells')) {
    return {
      lines: say(NAN,
        'You have been out at the stones.',
        'Do not look like that. There is nothing clever about it — you have mud to the knee and there is only one place in this valley you get that colour of mud.',
        'There were bells. That is not a secret, it is just old. Nine of them, between the stones and the frame at the end of my lane.',
        'They came down in one night.',
        'And before you ask: nobody stole them. We took them down. Every one of us who could hold a spanner, and we worked until it was light.',
        'Somebody asked us to. We thought it was a reasonable thing to be asked.',
        'That is the part I will talk about.',
      ),
      unlock: 'bells',
      beat: 'nan_bells',
    };
  }

  // The end of the thread. She has been waiting to be asked by somebody who
  // already knew, and now somebody does.
  if (c.story.has('the_note') && !c.topics.has('answer')) {
    return {
      lines: say(NAN,
        'You have it, then.',
        'Do not hold it out to me. I know what it looks like. I carried two of them down that hill myself and my hands remember the weight better than my head remembers the year.',
        'You want to know who asked.',
        'The house with the boards on it. That is whose step I sweep, and now you know why I do not make a speech about it.',
        'They did not explain and we did not require it. That is what a valley is — you are owed an explanation by nobody you trust.',
        'They went in the spring and they did not come back, and eleven years later a girl who was five then walks past that door every day and has never once asked me about it.',
        'So. You have your answer and it is a smaller one than you wanted.',
        'They are all smaller than you wanted. Go home, it is getting dark.',
      ),
      unlock: 'answer',
      beat: 'nan_answer',
    };
  }

  if (c.done.has('roof') && !c.topics.has('roof')) {
    return {
      lines: say(NAN,
        'You have had that roof off and on again.',
        'I can see it from my step, you know. It has looked like a wet hat for eleven years and now it does not.',
        'Do not thank me for noticing. I have nothing else to look at.',
      ),
      unlock: 'roof',
    };
  }

  if (c.done.has('fence') && !c.topics.has('fence')) {
    return {
      lines: say(NAN,
        'The field fence is up.',
        'The man who let it fall down was a good man and a terrible farmer, and he would be pleased, and he would not have done it himself.',
      ),
      unlock: 'fence',
    };
  }

  if (c.sky === 'rain') {
    return { lines: say(NAN, 'I am not standing out in that and neither should you.', 'Go on. It will keep.') };
  }
  if (c.phase === 'dawn' || c.phase === 'morning') {
    return { lines: say(NAN, 'Morning. There is a broom against the wall if you are going to stand there.') };
  }
  if (c.phase === 'dusk' || c.phase === 'night') {
    return { lines: say(NAN, 'Late for a walk.', 'Not a criticism. I have made a career of them.') };
  }
  return { lines: say(NAN, 'Still here, then.', 'So am I. That is the whole of the news.') };
}

/** The step she sweeps that is not hers. Only offered if you have read it. */
function nanShut(c: TalkCtx): TalkResult | null {
  if (!c.seen.has('house_shut') || c.topics.has('shut')) return null;
  return {
    lines: say(NAN,
      'You have been looking at the shut house.',
      'I sweep the step. It takes a minute and it costs me nothing.',
      'No, I am not going to tell you whose it is. You can work out that I would not sweep it if it were nobody\'s.',
    ),
    unlock: 'shut',
  };
}

// --- RUE ---------------------------------------------------------------------

const RUE = 'Rue';

function rue(c: TalkCtx): TalkResult {
  if (!c.met) {
    return {
      lines: say(RUE,
        'You are the new one.',
        'Do not worry, everybody knows. There are three of us. A cat could keep up.',
        'Rue. What is it like out there?',
        'Not the valley. *Out* there.',
      ),
      unlock: 'met',
    };
  }

  if (c.done.has('lamps') && !c.topics.has('lamps')) {
    return {
      lines: say(RUE,
        'You lit the track.',
        'Do you know what that means? I can walk down it. After dark. Without Nan doing the face.',
        'That is the furthest I have been allowed to go since I was eleven, and it is a road to a farm.',
        'I am not complaining. I am telling you I noticed.',
      ),
      unlock: 'lamps',
    };
  }

  if (c.done.has('porch') && !c.topics.has('porch')) {
    return {
      lines: say(RUE,
        'Orrin says you have put a porch on it. He said it twice.',
        'Can I see it? Not now. Sometime.',
        'I have never been in a house that was not one of these four.',
      ),
      unlock: 'porch',
    };
  }

  // She is the only one who could possibly know this, and the reason she knows
  // it is the reason she is desperate to leave.
  if (c.story.has('orrin_cradles') && !c.topics.has('place')) {
    return {
      lines: say(RUE,
        'Orrin has been talking. He never talks.',
        'A night\'s walk there and back, carrying. I can save you the trouble — I have done every inch of that and I did it out of boredom, which is a better motive than yours.',
        'The ruin, the outcrop, the grove, both banks of the beck, under the dock, the well. I have been down the well. Do not tell Nan.',
        'There is exactly one place in this valley I have never got into, and it is not a place, it is a stone.',
        'The flat one at the water\'s edge by your farm. The warm one.',
        'I have had a crowbar under that stone and I have had Orrin\'s brother-in-law under that stone and it does not move. Nobody has ever moved it.',
        'You have a whole workshop up there now, though. Haven\'t you.',
      ),
      unlock: 'place',
      beat: 'rue_place',
    };
  }

  if (c.sky === 'rain') {
    return {
      lines: say(RUE,
        'I know.',
        'It is the only thing that happens here that was not decided forty years ago.',
      ),
    };
  }
  if (c.phase === 'night' || c.phase === 'dusk') {
    return { lines: say(RUE, 'I am not lost. I live eleven metres that way.', 'I am just not going in yet.') };
  }
  return {
    lines: say(RUE,
      'Where were you before?',
      'You do not have to say. Everyone here answers that one with the weather.',
    ),
  };
}

// --- ORRIN --------------------------------------------------------------------

const ORRIN = 'Orrin Fell';

function orrin(c: TalkCtx): TalkResult {
  if (!c.met) {
    return {
      lines: say(ORRIN,
        'Mind the shavings, they get everywhere — no, come in, there is room.',
        'Orrin Fell. Joiner. There is no joinery, but the title stays with you like a limp.',
        'You have the look of somebody who has been pulling things down. That is the easy half.',
      ),
      unlock: 'met',
    };
  }

  if (c.done.has('porch') && !c.topics.has('porch')) {
    return {
      lines: say(ORRIN,
        'The porch. Did you halve the joints or just butt them and nail through?',
        '...',
        'Butted them. That is fine. That is fine, it will stand.',
        'Come to me before you do the next one and I will show you a lap joint. It takes four more minutes and it lasts forty more years.',
      ),
      unlock: 'porch',
    };
  }

  // He cannot tell you this until Nan has told you there were bells at all,
  // because otherwise it is a man describing some boxes.
  if (c.story.has('nan_bells') && !c.topics.has('cradles')) {
    return {
      lines: say(ORRIN,
        'Nan told you about the bells. I can see it on you.',
        'Then you may as well have my half. I built the cradles they came down in. Eleven of them, two spare, ash and rope, and I was twenty-nine and very proud of them.',
        'Here is the thing I have never said out loud, because there was never anybody to say it to who would follow it.',
        'They were cradles. For carrying. Shoulder poles, four men to a bell. If you were putting them on a cart you would not want a cradle, you would want a crate, and I could have built crates in half the time.',
        'Nobody ordered crates.',
        'So they went somewhere four men could carry them to and back before it got light. That is not far. That is *here*.',
      ),
      unlock: 'cradles',
      beat: 'orrin_cradles',
    };
  }

  if (!c.topics.has('planks')) {
    return {
      lines: say(ORRIN,
        'You have been felling. I can hear it from here — three strokes and a pause, so you are letting the axe do it. Good.',
        'Do not build with it round. Rive it, square it, let it sit. Three lengths gives you two boards worth having and a pile of what people sell as boards.',
        'That is the whole of my trade and I have just given it to you for nothing.',
      ),
      unlock: 'planks',
    };
  }

  if (c.sky === 'rain') {
    return {
      lines: say(ORRIN,
        'I have a roof on this. It is the entire reason it is here.',
        'Rain is good for the timber and bad for the glue, and I am mostly doing timber today.',
      ),
    };
  }
  if (c.phase === 'evening' || c.phase === 'dusk') {
    return { lines: say(ORRIN, 'Walking the lane. I do it to stop looking at the bench.', 'It does not work.') };
  }
  return {
    lines: say(ORRIN,
      'Four barrels, eleven years ago. That is the last order this row took.',
      'I still sort the offcuts by length. You may draw your own conclusions and I would rather you did not say them out loud.',
    ),
  };
}

const TABLE: Record<string, (c: TalkCtx) => TalkResult> = { nan, rue, orrin };
const EXTRA: Record<string, ((c: TalkCtx) => TalkResult | null)[]> = { nan: [nanShut] };

export function resolveTalk(id: string, ctx: TalkCtx): TalkResult | null {
  for (const fn of EXTRA[id] ?? []) {
    const r = fn(ctx);
    if (r) return r;
  }
  const base = TABLE[id];
  return base ? base(ctx) : null;
}

/**
 * The short line that floats over somebody's head the first time you come near
 * them in a day. Not the dialogue box — no input, no freeze. This is what makes
 * a settlement feel populated; forcing a modal panel for "morning" is what
 * makes it feel like a menu with legs.
 */
export function bark(id: string, ctx: TalkCtx): string {
  const wet = ctx.sky === 'rain';
  if (id === 'nan') {
    if (wet) return 'Inside. Both of us.';
    if (!ctx.met) return 'Mm.';
    return ctx.phase === 'dawn' || ctx.phase === 'morning' ? 'Morning.' : 'Still here.';
  }
  if (id === 'rue') {
    if (wet) return 'Best day all week.';
    if (!ctx.met) return 'Oh — hello.';
    return ctx.phase === 'night' || ctx.phase === 'dusk' ? 'I am not going in.' : 'Anything happen?';
  }
  if (wet) return 'Dry under here.';
  if (!ctx.met) return 'Mind the shavings.';
  return 'Aye.';
}
