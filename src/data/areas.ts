/**
 * Every area in the valley, and how they join up.
 *
 * Exits name their destination by id and are resolved through this table, so
 * adding a place is a data change: write its map, list its props, and point an
 * exit at it.
 */

import type { AreaData } from './area.ts';
import { HOMESTEAD } from './homestead.ts';
import { MEADOW } from './meadow.ts';

export const AREAS: Record<string, AreaData> = {
  homestead: HOMESTEAD,
  meadow: MEADOW,
};

export const START_AREA = 'homestead';

export function area(id: string): AreaData {
  const a = AREAS[id];
  if (!a) throw new Error(`No area "${id}"`);
  return a;
}
