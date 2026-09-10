/**
 * The tile grid: what material each tile is, and what the player can walk on.
 * Materials drive how the ground is painted; solidity is kept separate so
 * props can block movement without pretending to be terrain.
 */

import { MAT_FROM_CHAR, Mat, TILE } from './materials.ts';

export class Tilemap {
  readonly w: number;
  readonly h: number;
  readonly mats: Uint8Array;
  private solid: Uint8Array;

  constructor(rows: readonly string[]) {
    this.h = rows.length;
    this.w = rows[0].length;
    this.mats = new Uint8Array(this.w * this.h);
    this.solid = new Uint8Array(this.w * this.h);
    for (let y = 0; y < this.h; y++) {
      const row = rows[y];
      if (row.length !== this.w) throw new Error(`Map row ${y} is ${row.length} wide, expected ${this.w}`);
      for (let x = 0; x < this.w; x++) {
        const mat = MAT_FROM_CHAR[row[x]];
        if (mat === undefined) throw new Error(`Unknown map character "${row[x]}" at ${x},${y}`);
        this.mats[y * this.w + x] = mat;
        if (mat === Mat.Water) this.solid[y * this.w + x] = 1;
      }
    }
  }

  get pixelW(): number {
    return this.w * TILE;
  }

  get pixelH(): number {
    return this.h * TILE;
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h;
  }

  matAt(tx: number, ty: number): Mat {
    if (!this.inBounds(tx, ty)) return Mat.Grass;
    return this.mats[ty * this.w + tx] as Mat;
  }

  setMat(tx: number, ty: number, mat: Mat): void {
    if (!this.inBounds(tx, ty)) return;
    this.mats[ty * this.w + tx] = mat;
  }

  /** Presence of a material as a 0/1 field, sampled outside the map as 0. */
  presence(tx: number, ty: number, mat: Mat): number {
    if (!this.inBounds(tx, ty)) return 0;
    return this.mats[ty * this.w + tx] === mat ? 1 : 0;
  }

  isSolidTile(tx: number, ty: number): boolean {
    if (!this.inBounds(tx, ty)) return true; // the world ends; you may not.
    return this.solid[ty * this.w + tx] === 1;
  }

  setSolid(tx: number, ty: number, value: boolean): void {
    if (!this.inBounds(tx, ty)) return;
    this.solid[ty * this.w + tx] = value ? 1 : 0;
  }

  /** Solidity in world pixels — what movement code actually asks. */
  isSolidAt(px: number, py: number): boolean {
    return this.isSolidTile(Math.floor(px / TILE), Math.floor(py / TILE));
  }

  matAtPixel(px: number, py: number): Mat {
    return this.matAt(Math.floor(px / TILE), Math.floor(py / TILE));
  }
}
