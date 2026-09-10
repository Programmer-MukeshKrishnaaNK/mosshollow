/**
 * TOOLS AND ITEMS
 *
 * Tools are drawn as separate sprites from the character, positioned by the
 * animation at authored grip points. That means a new tool needs one sprite,
 * not a new set of poses for every facing — and it lets the tool lead the
 * swing, arriving at the ground a frame before the body follows through.
 *
 * Each tool has two orientations: wound up, and struck. The side-facing
 * versions are mirrored at build time.
 */

import type { PixelMap } from './pixel.ts';

/** Hoe, wound back over the shoulder. */
export const HOE_UP: PixelMap = [
  '.........kk...',
  '........kGGk..',
  '.......kGVGk..',
  '.......kGVk...',
  '......kxzk....',
  '......kxz.....',
  '.....kxz......',
  '.....kxz......',
  '....kxz.......',
  '....kxz.......',
  '...kxz........',
  '...kxz........',
  '..kxz.........',
  '..kxk.........',
  '..kk..........',
  '..............',
];

/** Hoe, blade in the dirt. */
export const HOE_DOWN: PixelMap = [
  '..........kk..',
  '.........kxk..',
  '.........kxz..',
  '........kxz...',
  '........kxz...',
  '.......kxz....',
  '.......kxz....',
  '......kxz.....',
  '......kxz.....',
  '.....kxz......',
  '.....kxz......',
  '....kxzk......',
  '...kGVGk......',
  '..kGVVk.......',
  '..kGVk........',
  '...kk.........',
];

/** Watering can, carried. */
export const CAN_UP: PixelMap = [
  '..............',
  '.....kkkk.....',
  '....kGGGGk....',
  '...kGVVVVGk...',
  '..kkGGGGGGk...',
  '.kGkGVVVVGk...',
  'kGGkGGGGGGk...',
  'kGVkGVVVVGk...',
  '.kGkGGGGGGk...',
  '..kkGVVVVGk...',
  '....kGGGGk....',
  '....kkkkkk....',
  '..............',
  '..............',
];

/** Watering can, tipped. The stream itself is particles, not pixels. */
export const CAN_POUR: PixelMap = [
  '..............',
  '.........kkk..',
  '........kGGGk.',
  '...kkkkkGVVGk.',
  '..kGGGGGGGGGk.',
  '.kGVVVVVVVVGk.',
  '.kGGGGGGGGGk..',
  '..kkGVVVVGk...',
  '....kGGGGk....',
  '.....kkkk.....',
  '..............',
  '..............',
  '..............',
  '..............',
];

// --- inventory icons --------------------------------------------------------

export const ICON_HOE: PixelMap = [
  '..............',
  '..........kk..',
  '.........kxk..',
  '........kxz...',
  '.......kxz....',
  '......kxz.....',
  '.....kxz......',
  '....kxzk......',
  '...kGVGk......',
  '..kGVVk.......',
  '..kGVk........',
  '...kk.........',
  '..............',
  '..............',
];

export const ICON_CAN: PixelMap = [
  '..............',
  '.....kkkk.....',
  '....kGGGGk....',
  '...kGVVVVGk...',
  '..kkGGGGGGk...',
  '.kGkGVVVVGk...',
  'kGGkGGGGGGk...',
  'kGVkGVVVVGk...',
  '.kGkGGGGGGk...',
  '..kkGVVVVGk...',
  '....kGGGGk....',
  '....kkkkkk....',
  '..............',
  '..............',
];

export const ICON_SEED_BELLROOT: PixelMap = [
  '..............',
  '...kkkkkkkk...',
  '...kMNNNNMk...',
  '...kNMMMMNk...',
  '...kN.NN.Nk...',
  '...kNNFFNNk...',
  '...kN4FF4Nk...',
  '...kNM45MNk...',
  '...kMNNNNMk...',
  '...kkkkkkkk...',
  '..............',
  '..............',
  '..............',
  '..............',
];

export const ICON_SEED_WHEAT: PixelMap = [
  '..............',
  '...kkkkkkkk...',
  '...kMNNNNMk...',
  '...kNMMMMNk...',
  '...kN.II.Nk...',
  '...kNIOOINk...',
  '...kNIqqINk...',
  '...kNMwwMNk...',
  '...kMNNNNMk...',
  '...kkkkkkkk...',
  '..............',
  '..............',
  '..............',
  '..............',
];

export const ICON_BELLROOT: PixelMap = [
  '..............',
  '.....2.2......',
  '....k343k.....',
  '.....k4k......',
  '....kFFFk.....',
  '...kFNNNFk....',
  '...kNNFNNk....',
  '...kNNNNNk....',
  '....kNNNk.....',
  '.....kNk......',
  '......k.......',
  '..............',
  '..............',
  '..............',
];

export const ICON_WHEAT: PixelMap = [
  '..............',
  '....I..I......',
  '...IOI.OI.....',
  '...OqO.qO.....',
  '...kOq.qOk....',
  '....w..w......',
  '....w..w......',
  '....ww.w......',
  '.....www......',
  '....kwwwk.....',
  '.....kwk......',
  '..............',
  '..............',
  '..............',
];

/** Axe, wound back. The head is a wedge, wider at the cutting edge. */
export const AXE_UP: PixelMap = [
  '.......kkkk...',
  '......kGGGGk..',
  '......kGVVGk..',
  '.......kGGk...',
  '......kxzk....',
  '......kxz.....',
  '.....kxz......',
  '.....kxz......',
  '....kxz.......',
  '....kxz.......',
  '...kxz........',
  '...kxz........',
  '..kxz.........',
  '..kxk.........',
  '..kk..........',
  '..............',
];

/** Axe, buried in the trunk. */
export const AXE_DOWN: PixelMap = [
  '..........kk..',
  '.........kxk..',
  '.........kxz..',
  '........kxz...',
  '........kxz...',
  '.......kxz....',
  '.......kxz....',
  '......kxz.....',
  '......kxz.....',
  '.....kxz......',
  '.....kxzk.....',
  '....kGVGk.....',
  '...kGVVGk.....',
  '...kGVVGk.....',
  '....kGGk......',
  '.....kk.......',
];

/** Pick, wound back. The head is a bar, tapered to points at both ends. */
export const PICK_UP: PixelMap = [
  '...kkkkkkkk...',
  '..kGVVVVVVGk..',
  '...kkkGGkkk...',
  '......kzk.....',
  '......kxz.....',
  '.....kxz......',
  '.....kxz......',
  '....kxz.......',
  '....kxz.......',
  '...kxz........',
  '...kxz........',
  '..kxz.........',
  '..kxz.........',
  '..kxk.........',
  '..kk..........',
  '..............',
];

/** Pick, in the stone. */
export const PICK_DOWN: PixelMap = [
  '..........kk..',
  '.........kxk..',
  '.........kxz..',
  '........kxz...',
  '........kxz...',
  '.......kxz....',
  '.......kxz....',
  '......kxz.....',
  '......kxz.....',
  '.....kxz......',
  '.....kzk......',
  '..kkkGGkkk....',
  '.kGVVVVVVGk...',
  '..kkkkkkkk....',
  '..............',
  '..............',
];

export const ICON_AXE: PixelMap = [
  '..............',
  '........kkkk..',
  '.......kGGGGk.',
  '.......kGVVGk.',
  '........kGGk..',
  '.......kxzk...',
  '......kxz.....',
  '.....kxz......',
  '....kxz.......',
  '...kxz........',
  '...kxk........',
  '...kk.........',
  '..............',
  '..............',
];

export const ICON_PICK: PixelMap = [
  '..............',
  '..kkkkkkkk....',
  '.kGVVVVVVGk...',
  '..kkkGGkkk....',
  '.....kzk......',
  '.....kxz......',
  '....kxz.......',
  '....kxz.......',
  '...kxz........',
  '...kxz........',
  '...kxk........',
  '...kk.........',
  '..............',
  '..............',
];

export const ICON_WOOD: PixelMap = [
  '..............',
  '...kkkkkk.....',
  '..kzxxxxzk....',
  '.kzwqqwxxzk...',
  '.kxwqewqxxk...',
  '.kzwqqwxxzk...',
  '..kxxxxxxk....',
  '..kkkkkkkk....',
  '...kzxxzk.....',
  '..kzwqqwzk....',
  '..kxwqewxk....',
  '..kzxxxxzk....',
  '...kkkkkk.....',
  '..............',
];

export const ICON_STONE: PixelMap = [
  '..............',
  '.....kkkk.....',
  '....kassak....',
  '...kasssdak...',
  '..kassdddsak..',
  '..kasdddddak..',
  '..kfsddddfak..',
  '...kffddffk...',
  '....kkffkk....',
  '...kask.......',
  '..kassdk......',
  '..kfsddk......',
  '...kffk.......',
  '....kk........',
];

// --- refined materials ------------------------------------------------------

export const ICON_PLANK: PixelMap = [
  '..............',
  '..kkkkkkkkkk..',
  '.kzzzzzzzzzzk.',
  '.kxxxxxxxxxxk.',
  '.kzxxxxxxxxzk.',
  '.kkkkkkkkkkkk.',
  '..kkkkkkkkkk..',
  '..kzzzzzzzzk..',
  '..kxxxxxxxxk..',
  '..kzxxxxxxzk..',
  '..kkkkkkkkkk..',
  '..............',
  '..............',
  '..............',
];

export const ICON_BLOCK: PixelMap = [
  '..............',
  '..kkkkkkkkkk..',
  '.kaaassaaassk.',
  '.kassdsassdsk.',
  '.kkkkkkkkkkkk.',
  '.kssaaassaaak.',
  '.ksddsassdsak.',
  '.kkkkkkkkkkkk.',
  '..kaaassaaak..',
  '..kassdsassk..',
  '..kkkkkkkkkk..',
  '..............',
  '..............',
  '..............',
];

export const ICON_COMPOST: PixelMap = [
  '..............',
  '.....kkk......',
  '....k454k.....',
  '...k45o45k....',
  '..kop4o4pok...',
  '..kpoolopok...',
  '.kopllooplok..',
  '.klooplpoolk..',
  '.kplllplllpk..',
  '..klllpllllk..',
  '...kkkkkkkk...',
  '..............',
  '..............',
  '..............',
];

/**
 * The project board. Two posts, a plank face, and notices pinned to it — the
 * one piece of interface furniture that lives in the world rather than on the
 * screen.
 */
export const PROJECT_BOARD: PixelMap = [
  '........................',
  '.kkkkkkkkkkkkkkkkkkkkkk.',
  'kzxxxxxxxxxxxxxxxxxxxxck',
  'kzxwwwwwwwwwwwwwwwwwwxck',
  'kzxwNNNNwwwwNNNNNNwwwxck',
  'kzxwNMMNwwwwNMMMMNwwwxck',
  'kzxwNMMNwwwwNMMMMNwwwxck',
  'kzxwNNNNwwwwNNNNNNwwwxck',
  'kzxwwwwwwwwwwwwwwwwwwxck',
  'kzxwwNNNNNNwwwwNNNNwwxck',
  'kzxwwNMMMMNwwwwNMMNwwxck',
  'kzxwwNNNNNNwwwwNNNNwwxck',
  'kzxwwwwwwwwwwwwwwwwwwxck',
  'kzxxxxxxxxxxxxxxxxxxxxck',
  '.kkkkkkkkkkkkkkkkkkkkkk.',
  '.....kzxck......kzxck...',
  '.....kzxck......kzxck...',
  '.....kzxck......kzxck...',
  '.....kzxck......kzxck...',
  '.....kzxck......kzxck...',
  '.....kzxck......kzxck...',
  '.....k55ck......k55ck...',
  '......kkk........kkk....',
];
