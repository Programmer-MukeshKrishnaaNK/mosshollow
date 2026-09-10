/**
 * Crop definitions. Pure data — the farm system knows how to grow a crop, not
 * which crops exist.
 */

import { BELLROOT, EMBERWHEAT } from '../art/crops.art.ts';
import type { PixelMap } from '../art/pixel.ts';

export interface CropDef {
  id: string;
  name: string;
  /** Days to spend in each stage. The final stage is the harvestable one. */
  stageDays: number[];
  seedItem: string;
  yieldItem: string;
  yieldMin: number;
  yieldMax: number;
  /**
   * If set, harvesting returns the plant to this stage rather than clearing
   * the tile — the difference between a root crop and one that keeps giving.
   */
  regrowTo?: number;
  /** Days it can survive unwatered before it withers. */
  thirstDays: number;
  art: PixelMap[];
}

export const CROPS: Record<string, CropDef> = {
  bellroot: {
    id: 'bellroot',
    name: 'Bellroot',
    // Slow to start, then it puts up the bell almost overnight.
    stageDays: [2, 2, 2, 1, 0],
    seedItem: 'seed_bellroot',
    yieldItem: 'bellroot',
    yieldMin: 1,
    yieldMax: 2,
    thirstDays: 2,
    art: BELLROOT,
  },
  emberwheat: {
    id: 'emberwheat',
    name: 'Emberwheat',
    stageDays: [1, 2, 2, 2, 0],
    seedItem: 'seed_emberwheat',
    yieldItem: 'emberwheat',
    yieldMin: 2,
    yieldMax: 3,
    // Cut it and it comes back from the crown, twice, before it gives up.
    regrowTo: 2,
    thirstDays: 3,
    art: EMBERWHEAT,
  },
};
