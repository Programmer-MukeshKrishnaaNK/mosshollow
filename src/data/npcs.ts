/**
 * THE RESIDENTS OF BELL ROW
 *
 * Three, not four. Four houses with four people in them is a functioning
 * village, and a functioning village contradicts everything the valley has
 * said so far. Three residents and one shuttered door says the place is
 * ending, and these are what is left. The empty house is the fourth character
 * and it costs a prop and a swept step.
 *
 * Everything here is data. Identity, palette, gait and the whole day. A
 * schedule is a list of keyframed hours against named waypoints, which is the
 * same shape the ambient colour keyframes in `time.ts` already use, so the
 * codebase learns no second concept.
 *
 * Three details in the tables below are doing character work rather than
 * systems work, and they should survive any future tidying:
 *
 *  - Nan sweeps two steps every morning. Hers, and then the one belonging to
 *    the house nobody lives in. It is never mentioned by anybody.
 *  - Rue has no `work` state anywhere in her day. Everyone else's hours have a
 *    shape and hers does not. That is the character.
 *  - Orrin is at his bench at 08:00 every single day without exception, which
 *    is what would make the one morning he is not mean something later.
 */

export type Act = 'idle' | 'walk' | 'sweep' | 'work' | 'sit' | 'lean' | 'tend' | 'in';

export interface ScheduleEntry {
  /** Hour this begins. Entries run until the next one starts. */
  at: number;
  /** Named waypoint in the area's data. */
  spot: string;
  act: Act;
  /**
   * Swapped in once a project is finished. Rue's evening moves to the top of
   * the road when the track is lit, because that is when she can get home in
   * the dark — the lamps you built are what let the settlement reach you.
   */
  ifDone?: { project: string; spot: string };
}

export interface NpcDef {
  id: string;
  name: string;
  area: string;
  /** Pixels per second. A gait is a character trait and it is free. */
  speed: number;
  /** Walk cycle frames per second at full speed. */
  fps: number;
  /** Feet collider, for the player's collision query. */
  box: { w: number; h: number };
  /** Where they sleep, and where they go when it rains — if they go at all. */
  home: string;
  /**
   * What they do when it rains. `in` is the obvious one; Orrin's shed has a
   * roof, which is *why* it is drawn, so he simply carries on; and Rue goes
   * and stands in it on purpose.
   */
  rain: { act: Act; spot: string | null };
  /**
   * Places a `walk` act drifts between. Chosen from the hour rather than from
   * a random number, so a roaming character is still perfectly reproducible —
   * which is what lets the schedule be tested at all.
   */
  wander?: string[];
  schedule: ScheduleEntry[];
}

export const NPCS: NpcDef[] = [
  {
    id: 'nan',
    name: 'Nan Hollis',
    area: 'bellrow',
    speed: 24,
    fps: 6,
    box: { w: 9, h: 6 },
    home: 'nan_step',
    // Old, and it is wet. She goes in and that is the end of it.
    rain: { act: 'in', spot: 'nan_step' },
    schedule: [
      { at: 5.0, spot: 'nan_step', act: 'sweep' },
      { at: 7.0, spot: 'shut_step', act: 'sweep' },
      { at: 9.0, spot: 'nan_bench', act: 'sit' },
      { at: 12.0, spot: 'nan_step', act: 'in' },
      { at: 13.0, spot: 'nan_bench', act: 'sit' },
      { at: 17.0, spot: 'nan_pots', act: 'tend' },
      { at: 19.0, spot: 'nan_step', act: 'in' },
    ],
  },
  {
    id: 'rue',
    name: 'Rue',
    area: 'bellrow',
    speed: 52,
    fps: 9,
    box: { w: 8, h: 6 },
    home: 'rue_step',
    // Deliberately.
    rain: { act: 'idle', spot: null },
    // She has no `work` state anywhere in her day and she does not stand still
    // either. Everyone else's hours have a shape; hers is a loop of the same
    // forty metres.
    wander: ['lane_mid', 'well', 'shut_bench', 'lane_west', 'frame', 'rue_step'],
    schedule: [
      { at: 5.0, spot: 'rue_step', act: 'in' },
      { at: 7.0, spot: 'rue_step', act: 'idle' },
      { at: 9.0, spot: 'lane_mid', act: 'walk' },
      { at: 12.0, spot: 'well', act: 'lean' },
      { at: 13.0, spot: 'frame', act: 'lean' },
      {
        at: 17.0,
        spot: 'rue_step',
        act: 'lean',
        // The lit track is the whole reward. Before it, she stays on her step.
        ifDone: { project: 'lamps', spot: 'road_top' },
      },
      { at: 19.0, spot: 'lane_west', act: 'idle' },
      { at: 21.5, spot: 'rue_step', act: 'in' },
    ],
  },
  {
    id: 'orrin',
    name: 'Orrin Fell',
    area: 'bellrow',
    speed: 36,
    fps: 7,
    box: { w: 10, h: 6 },
    home: 'orrin_step',
    // The shed has a roof. That is what it is for.
    rain: { act: 'work', spot: 'orrin_bench' },
    schedule: [
      { at: 5.0, spot: 'orrin_step', act: 'in' },
      { at: 7.0, spot: 'orrin_bench', act: 'work' },
      { at: 12.0, spot: 'orrin_step', act: 'sit' },
      { at: 13.0, spot: 'orrin_bench', act: 'work' },
      { at: 17.0, spot: 'lane_west', act: 'walk' },
      { at: 18.2, spot: 'lane_east', act: 'walk' },
      { at: 19.0, spot: 'orrin_step', act: 'sit' },
      { at: 21.0, spot: 'orrin_step', act: 'in' },
    ],
  },
];

export function npc(id: string): NpcDef | undefined {
  return NPCS.find((n) => n.id === id);
}

/** Which entry of a schedule is in force at this hour. */
export function entryAt(def: NpcDef, hour: number): ScheduleEntry {
  const s = def.schedule;
  let chosen = s[s.length - 1];
  for (const e of s) {
    if (hour >= e.at) chosen = e;
  }
  // Before the first entry of the day, the last one is still running.
  if (hour < s[0].at) chosen = s[s.length - 1];
  return chosen;
}
