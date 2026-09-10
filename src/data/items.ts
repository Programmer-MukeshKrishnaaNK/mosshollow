/**
 * Item definitions and their icons. Data plus one build step; nothing here
 * knows about gameplay.
 */

import { sprite, type Sprite } from '../art/pixel.ts';
import {
  ICON_BELLROOT, ICON_CAN, ICON_HOE, ICON_SEED_BELLROOT,
  ICON_SEED_WHEAT, ICON_WHEAT,
} from '../art/tools.art.ts';

export type ToolKind = 'hoe' | 'can';

export interface ItemDef {
  id: string;
  name: string;
  kind: 'tool' | 'seed' | 'produce';
  /** How many fit in one slot. Tools never stack. */
  stack: number;
  /** Tools only. */
  tool?: ToolKind;
  /** Seeds only: the crop this plants. */
  plants?: string;
  /** A line shown when the item is selected. Flavour, and a hint. */
  blurb: string;
  icon: Sprite;
}

function def(d: Omit<ItemDef, 'icon'>, icon: Sprite): ItemDef {
  return { ...d, icon };
}

export const ITEMS: Record<string, ItemDef> = {
  hoe: def(
    { id: 'hoe', name: 'Hoe', kind: 'tool', stack: 1, tool: 'hoe', blurb: 'Turns over ground worth planting in.' },
    sprite(ICON_HOE, 7, 14),
  ),
  can: def(
    { id: 'can', name: 'Watering Can', kind: 'tool', stack: 1, tool: 'can', blurb: 'Dry seed does nothing at all.' },
    sprite(ICON_CAN, 7, 14),
  ),
  seed_bellroot: def(
    { id: 'seed_bellroot', name: 'Bellroot Seed', kind: 'seed', stack: 99, plants: 'bellroot', blurb: 'Somebody saved these, and labelled them twice.' },
    sprite(ICON_SEED_BELLROOT, 7, 14),
  ),
  seed_emberwheat: def(
    { id: 'seed_emberwheat', name: 'Emberwheat Seed', kind: 'seed', stack: 99, plants: 'emberwheat', blurb: 'Cut it and it comes back. Twice.' },
    sprite(ICON_SEED_WHEAT, 7, 14),
  ),
  bellroot: def(
    { id: 'bellroot', name: 'Bellroot', kind: 'produce', stack: 99, blurb: 'Pale, heavy, and faintly sweet.' },
    sprite(ICON_BELLROOT, 7, 14),
  ),
  emberwheat: def(
    { id: 'emberwheat', name: 'Emberwheat', kind: 'produce', stack: 99, blurb: 'It turns all at once, on a day nobody predicts.' },
    sprite(ICON_WHEAT, 7, 14),
  ),
};

export function item(id: string): ItemDef {
  const it = ITEMS[id];
  if (!it) throw new Error(`No item definition "${id}"`);
  return it;
}
