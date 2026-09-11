/**
 * BELL ROW'S FURNITURE
 *
 * The things that make a lane look lived on rather than built. Every one of
 * these is here to say something, and none of them says it out loud:
 *
 *  - THE BELL FRAME stands where the lane stops. Hand-cut timber, a headstock,
 *    and an iron bracket with nothing hanging from it — the same empty bracket
 *    as the three standing stones out in the valley. It is the fourth, and it
 *    is the only one somebody built a whole frame for.
 *  - THE WELL is the reason the lane is where it is.
 *  - THE WASHING LINE is the one piece of Bell Row that moves with the wind,
 *    which is the cheapest possible proof that this place is part of the same
 *    valley as the grass and the canopies.
 *  - THE BENCH sits outside the house nobody lives in.
 *  - THE BOWL by Nan's door is full. Nothing else about it is explained.
 */

import type { PixelMap } from './pixel.ts';

/** The frame at the end of the lane. 26x40, foot at the bottom centre. */
export const BELL_FRAME: PixelMap = [
  '......GGGGGGGGGGGG........',
  '.....GkkkkkkkkkkkG........',
  '.....Gk..........kG.......',
  '....kGk...........kG......',
  '...kzxk............k......',
  '..kzxxck..................',
  '..kzxck...................',
  '.kzxxck...........kzxck...',
  '.kzxck............kzxck...',
  'kzxxck............kzxxck..',
  'kzxck.............kzxck...',
  'kzxck.............kzxck...',
  'kzxck.............kzxck...',
  'kzxck.............kzxck...',
  'kzxck.............kzxck...',
  'kzxck.....kzxck...kzxck...',
  'kzxck.....kzxck...kzxck...',
  'kzxck.....kzxck...kzxck...',
  'kzxck.....kzxck...kzxck...',
  'kzxck.....kzxck...kzxck...',
  'kzxck.....kzxck...kzxck...',
  'kzxck.....kzxck...kzxck...',
  'kzxck.....kzxck...kzxck...',
  'kzxck.....kzxck...kzxck...',
  'kzxck.....kzxck...kzxck...',
  'kzxck.....kzxck...kzxck...',
  'kzxck.....kzxck...kzxck...',
  'kzxck.....kzxck...kzxck...',
  'kzxck.....kzxck...kzxck...',
  'kzxvk.....kzxvk...kzxvk...',
  'kzvvk.....kzvvk...kzvvk...',
  'kvvvk.....kvvvk...kvvvk...',
  '.kkk.......kkk.....kkk....',
  '..........................',
  '..........................',
  '..........................',
  '..........................',
  '..........................',
  '..........................',
  '..........................',
];

/** The headstock and the bracket, drawn over the frame's crown. */
export const BELL_BRACKET: PixelMap = [
  '..kkkkkkkkkkkkkk..',
  '.kVGGGGGGGGGGGGVk.',
  '.kVGkkkkkkkkkkGVk.',
  '.kVGk........kGVk.',
  '..kGk........kGk..',
  '...kk........kk...',
  '...kV........Vk...',
  '...kV........Vk...',
  '....k........k....',
];

/** A well: dressed stone drum, a timber frame and a bucket. 24x34. */
export const WELL: PixelMap = [
  '........kzxck...........',
  '.......kzxxck...........',
  '.......kzxck............',
  'kkkkkkkzxckkkkkkkk......',
  'kzxxxxxxxxxxxxxxzk......',
  'kzxxxxxxxxxxxxxxzk......',
  'kkkkkkkkkkkkkkkkkk......',
  '..kzxck......kzxck......',
  '..kzxck..GG..kzxck......',
  '..kzxck..GG..kzxck......',
  '..kzxck..GG..kzxck......',
  '..kzxck..GG..kzxck......',
  '..kzxck.kGGk.kzxck......',
  '..kzxck.kzxk.kzxck......',
  '..kzxck.kzxk.kzxck......',
  '..kzxck.kzzk.kzxck......',
  '..kzxck.kkkk.kzxck......',
  'kkkkkkkkkkkkkkkkkkkk....',
  'kasssssssssssssssssk....',
  'kasdddddddddddddddsk....',
  'kasdKKKKKKKKKKKKKdsk....',
  'kasdKbhhhhhhhhhbKdsk....',
  'kasdKhjjjjjjjjjhKdsk....',
  'kasdKKKKKKKKKKKKKdsk....',
  'kasdddddddddddddddsk....',
  'kasssssssssssssssssk....',
  'kaddddddddddddddddsk....',
  'kaddffffffffffffddsk....',
  'kasddddddddddddddssk....',
  'kassssssssssssssssdk....',
  'kaddddddddddddddddsk....',
  'kkkkkkkkkkkkkkkkkkkk....',
  '.kfffffffffffffffffk....',
  '..kkkkkkkkkkkkkkkkk.....',
];

/** A plank bench, worn pale on the seat. Outside the house nobody uses. */
export const BENCH: PixelMap = [
  '..................',
  'kzzzzzzzzzzzzzzzzk',
  'kNNNNNNNNNNNNNNNNk',
  'kxxxxxxxxxxxxxxxxk',
  'kcccccccccccccccck',
  '.k..kxxk....kxxk.k',
  '.k..kxck....kxck.k',
  '.k..kxck....kxck.k',
  '....kxck....kxck..',
  '....kvck....kvck..',
  '....kkkk....kkkk..',
];

/** A bowl by a door. It is full. */
export const BOWL: PixelMap = [
  '..kkkkkk..',
  '.kddddddk.',
  'kdaaaaaadk',
  'kdaeeeeadk',
  'kdaeeeeadk',
  '.kdaaaadk.',
  '..kddddk..',
  '...kkkk...',
];

/** Offcuts, stacked the way somebody stacks things they still mean to use. */
export const OFFCUTS: PixelMap = [
  '................',
  '....kzzzzzzk....',
  '...kzNNNNNNzk...',
  '..kzxxxxxxxxzk..',
  '.kzxcccccccxxzk.',
  'kzxxxxxxxxxxxxzk',
  'kzNNzxxxxzNNzxzk',
  'kxxxxccccxxxxxxk',
  'kzzxxxxxxxxzzxck',
  'kxccxxzzxxccxxck',
  '.kkkkkkkkkkkkkk.',
];

/** A line post. The rope and what hangs on it are drawn in code, so it moves. */
export const LINE_POST: PixelMap = [
  '..kzxck..',
  '..kzxck..',
  'kkkzxckkk',
  'kzxxxxxck',
  'kkkzxckkk',
  '..kzxck..',
  '..kzxck..',
  '..kzxck..',
  '..kzxck..',
  '..kzxck..',
  '..kzxck..',
  '..kzxck..',
  '..kzxck..',
  '..kzxck..',
  '..kzxck..',
  '..kzvck..',
  '..kzvvk..',
  '...kkk...',
];

/** Sheets on the line. Four of them, each its own small pixel map. */
export const SHEETS: PixelMap[] = [
  [
    'kkkkkkkkkk',
    'kFFFFFFFFk',
    'kFNNNNNNFk',
    'kFNNNNNNFk',
    'kFNNNNNNFk',
    'kFNNNNNNFk',
    'kFNNNNNNFk',
    'kMMMMMMMMk',
    '.kkkkkkkk.',
  ],
  [
    'kkkkkkkk',
    'kQQQQQQk',
    'kQWWWWQk',
    'kQWWWWQk',
    'kQWWWWQk',
    'kWWWWWWk',
    'kkkkkkkk',
  ],
  [
    'kkkkkkkkkkk',
    'kNNNNNNNNNk',
    'kNMMMMMMMNk',
    'kNMMMMMMMNk',
    'kNMMMMMMMNk',
    'kNMMMMMMMNk',
    'kMMMMMMMMMk',
    'kMMMMMMMMMk',
    '.kkkkkkkkk.',
  ],
  [
    'kkkkkkkkk',
    'kRRRRRRRk',
    'kRTTTTTRk',
    'kRTTTTTRk',
    'kTTTTTTTk',
    'kkkkkkkkk',
  ],
];
