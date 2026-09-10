/** Ground materials. The authored ASCII map maps directly onto these. */
export const enum Mat {
  Grass = 0,
  Path = 1,
  Stone = 2,
  Water = 3,
  Soil = 4,
  Field = 5,
}

export const MAT_FROM_CHAR: Record<string, Mat> = {
  '.': Mat.Grass,
  ':': Mat.Path,
  '=': Mat.Stone,
  '~': Mat.Water,
  '#': Mat.Soil,
  d: Mat.Field,
};

export const TILE = 16;
