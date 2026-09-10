/**
 * Hand-authored prop pixel maps. Anything with a deliberate silhouette — worked
 * wood, stone the valley's people cut, small plants — is drawn by hand here.
 * The rounded organic masses (canopies, boulders, bushes) are generated in
 * organic.ts instead, so they can vary without repeating.
 */

import type { PixelMap } from './pixel.ts';

export const OAK_TRUNK: PixelMap = [
  '.....kxxxk......',
  '....kzxxxck.....',
  '....kzxxxck.....',
  '....kzxxvck.....',
  '....kzxxxck.....',
  '...kzxxxxck.....',
  '...kzxxxxcck....',
  '...kzxxvxxck....',
  '..kzxxxxxxck....',
  '..kzxxxxxxcck...',
  '.kzzxxxvxxxck...',
  '.kzxxxxxxxxck...',
  'kzzxxxxxxxxcck..',
  'kzxxxxxxxxxxxck.',
  'kkxxxxxxxxxxxkk.',
  '.kkxxxxxxxxxkk..',
  '..kk5555555kk...',
  '....k55555k.....',
];

export const BIRCH_TRUNK: PixelMap = [
  '..kzzNk...',
  '..kzNNk...',
  '..kNNzk...',
  '..kzNNk...',
  '..kNvNk...',
  '..kNNzk...',
  '..kzNNk...',
  '..kNNvk...',
  '..kvNNk...',
  '..kNNzk...',
  '..kzNNk...',
  '..kNNNk...',
  '..kNvNk...',
  '.kzNNNzk..',
  '.kNNNNNk..',
  'kzNNNNNzk.',
  'kkNNNNNkk.',
  '.kk555kk..',
];

export const STUMP: PixelMap = [
  '..kkkkkkkkkk..',
  '.kxzzzzzzzzxk.',
  'kzxxwwwwwxxzk.',
  'kzxwqqqqqwxzk.',
  'kzxwqewweqwxk.',
  'kzxwqqqqqwxzk.',
  'kzxxwwwwwxxzk.',
  'kzxxxxxxxxxck.',
  'kzxxxvxxxxxck.',
  '.kxxxxxxxxck..',
  '..kk55555kk...',
  '....kkkkk.....',
];

export const FENCE_POST: PixelMap = [
  '.kkkk.',
  'kzxxck',
  'kzxxck',
  'kzxvck',
  'kzxxck',
  'kzxxck',
  'kzxxck',
  'kzxvck',
  'kzxxck',
  'kzxxck',
  'kzxxck',
  'kzxxck',
  '.k55k.',
  '..kk..',
];

/** Horizontal rail, drawn between posts. Tiles seamlessly along x. */
export const FENCE_RAIL: PixelMap = [
  'kkkkkkkkkkkkkkkk',
  'zzzzzzzzzzzzzzzz',
  'xxxxxxxxxxxxxxxx',
  'xxxxvxxxxxxvxxxx',
  'cccccccccccccccc',
  'kkkkkkkkkkkkkkkk',
];

export const LANTERN_POST: PixelMap = [
  '..kkkk..',
  '.kGVVGk.',
  '.kGIIGk.',
  'kGIUUIGk',
  'kVIUUIVk',
  'kGIUUIGk',
  '.kGIIGk.',
  '.kkVVkk.',
  '...kk...',
  '..kVVk..',
  '..kVVk..',
  '..kVVk..',
  '..kVVk..',
  '..kVVk..',
  '..kVVk..',
  '..kVVk..',
  '..kVVk..',
  '..kVVk..',
  '..kVVk..',
  '..kVVk..',
  '.kgVVgk.',
  '.kg55gk.',
  '..kkkk..',
];

export const SIGN_POST: PixelMap = [
  '.kkkkkkkkkkkk.',
  'kzxwwwwwwwwxck',
  'kzwqqqqqqqqwck',
  'kzwqrrrrqqqwck',
  'kzwqqqqqrrqwck',
  'kzwqrrqqqqqwck',
  'kzwqqqqqqqqwck',
  'kzxwwwwwwwwxck',
  '.kkkkzxxckkkk.',
  '.....kzxck....',
  '.....kzxck....',
  '.....kzxck....',
  '.....kzxck....',
  '.....k55ck....',
  '......kkk.....',
];

export const CRATE: PixelMap = [
  'kkkkkkkkkkkkkk',
  'kzzzzzzzzzzzzk',
  'kzxxxxxxxxxxck',
  'kzxvxxxxxxvxck',
  'kzxxxxxxxxxxck',
  'kzxxxzzzzxxxck',
  'kzxxxxxxxxxxck',
  'kzxvxxxxxxvxck',
  'kzxxxxxxxxxxck',
  'kzccccccccccck',
  'kkkkkkkkkkkkkk',
];

/**
 * A wind-bell marker. Nobody in the valley will tell you what they were for.
 * The stone is old; the bell that hung from it is not always still there.
 */
export const BELL_MARKER: PixelMap = [
  '.....kkkk.....',
  '....kaGGak....',
  '....kGVVGk....',
  '.....kVVk.....',
  '.....kVVk.....',
  '....kGIIGk....',
  '...kGIUUIGk...',
  '...kVIUUIVk...',
  '....kGIIGk....',
  '.....kkkk.....',
  '..kkasssakk...',
  '.kaasdddsaak..',
  'kasdddddddsak.',
  'kasdd6ddddsak.',
  'kasddddd6dsak.',
  'kasd66dddssak.',
  'kasddddddssak.',
  'kasdd6dddssak.',
  'kasddddddssak.',
  'kasdddddssfak.',
  'kfsddddssfffk.',
  'kfsdddssffffk.',
  '.kffsssfffgk..',
  '..kkfffggkk...',
  '...kk5555k....',
  '.....kkkk.....',
];

export const REED: PixelMap = [
  '....5.....',
  '...45.4...',
  '...45.4...',
  '..k45.45..',
  '..545.454.',
  '..545k454.',
  '.4545.454.',
  '.4545.4544',
  '.4545.4544',
  '.45455454.',
  '.45455454.',
  '.5545k5454',
  '.5545.5454',
  '.6545.5456',
  '.6555.5556',
  '.66556555.',
  '..6656556.',
  '...kkkkk..',
];

export const TUFT_A: PixelMap = [
  '...2..2...',
  '..32.43...',
  '.,32.434..',
  '.343.434..',
  '.343543454',
  '.453554545',
  '..455545..',
  '...k5k5k..',
];

export const TUFT_B: PixelMap = [
  '..2....2..',
  '..32..43..',
  '.343..434.',
  '.343.4434.',
  '.45355434.',
  '..4555454.',
  '...45554..',
  '....kkk...',
];

export const FLOWER_RED: PixelMap = [
  '........',
  '..kXXk..',
  '.kXOOXk.',
  '.kXXXXk.',
  '..kXXk..',
  '...4k...',
  '..24k...',
  '...43...',
  '...4....',
  '...k....',
];

export const FLOWER_VIOLET: PixelMap = [
  '........',
  '..kZZk..',
  '.kZPPZk.',
  '.kZZZZk.',
  '..kZZk..',
  '...4k...',
  '..24k...',
  '...43...',
  '...4....',
  '...k....',
];

export const FLOWER_WHITE: PixelMap = [
  '........',
  '..kFFk..',
  '.kFIIFk.',
  '.kFFFFk.',
  '..kFFk..',
  '...4k...',
  '..24k...',
  '...43...',
  '...4....',
  '...k....',
];

/** A single dock plank section, tiled along the pier. */
export const DOCK_PLANK: PixelMap = [
  'kxxxxxxxxxxxxxxk',
  'kzzzzzzzzzzzzzzk',
  'kxxxxxxxxxxxxxxk',
  'kxxxxxxxxxxxxxxk',
  'kcccccccccccccck',
  'kxxxxxxxxxxxxxxk',
  'kzzzzzzzzzzzzzzk',
  'kxxxxxxxxxxxxxxk',
  'kxxxxxxxxxxxxxxk',
  'kcccccccccccccck',
  'kxxxxxxxxxxxxxxk',
  'kzzzzzzzzzzzzzzk',
  'kxxxxxxxxxxxxxxk',
  'kxxxxxxxxxxxxxxk',
  'kcccccccccccccck',
  'kkkkkkkkkkkkkkkk',
];

export const PEBBLE: PixelMap = [
  '.kkk..',
  'kasak.',
  'kssdk.',
  '.kddk.',
  '..kk..',
];
