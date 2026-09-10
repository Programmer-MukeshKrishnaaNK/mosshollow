/**
 * Area data types. Content lives in files like homestead.ts; nothing in here
 * knows how to draw or simulate anything.
 */

export interface PropPlacement {
  /** Prop definition id, or a list to pick from deterministically. */
  def: string | string[];
  /** Position in tiles. Fractions are fine and encouraged — a world on exact
   *  tile centres looks like a spreadsheet. */
  tx: number;
  ty: number;
  /** Key into the inspect table. Overrides the prop definition's default. */
  inspect?: string;
}

export interface FenceRun {
  /** Start and end in tiles. Runs must be axis-aligned. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface AreaData {
  id: string;
  name: string;
  seed: number;
  /** ASCII terrain. See materials.ts for the legend. */
  map: readonly string[];
  /** Where the player starts, in tiles. */
  spawn: { tx: number; ty: number };
  /** The farmhouse anchor, in tiles. */
  house?: { tx: number; ty: number };
  props: readonly PropPlacement[];
  fences: readonly FenceRun[];
  /** Tiles forced walkable after props are stamped — bridges, docks, gateways. */
  walkable?: readonly { tx: number; ty: number }[];
  /** Rectangles the automatic decoration scatter must leave alone, in tiles. */
  keepClear?: readonly { x: number; y: number; w: number; h: number }[];
  /** How many tiles of dense forest wrap the playable area. */
  forestBorder: number;
}
