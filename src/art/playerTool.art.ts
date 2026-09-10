/**
 * THE KEEPER — tool poses.
 *
 * Two per facing: wound up, and struck. The animator holds the wound-up pose
 * for a beat before releasing it, which is the anticipation that makes the
 * strike land with weight; without it a swing reads as a sprite swap.
 *
 * The struck poses sit a pixel lower than the idle body, so the character
 * drops into the blow and rises out of it during recovery.
 */

import type { PixelMap } from './pixel.ts';

// --- facing the camera ------------------------------------------------------

export const DOWN_RAISE: PixelMap = [
  '................',
  '....kHHHHHHk....',
  '...kHHHHHHHHk...',
  '..kHHJJJJJJLLk..',
  '..kHJJJJJJJJLk..',
  '..kJJAAAAAALLk..',
  '..kJAAAAAAAALk..',
  '..kJAkAAAAkALk..',
  '..kJABAAAABALk..',
  '.kAkABBAABBAkAk.',
  '.kQkkBBBBBBkkWk.',
  '.kQkTRRRRRRTkWk.',
  '.kQQkQQNNWWkWWk.',
  '...kQQQNNWWWk...',
  '...kQQQNNWWWk...',
  '...kQQQNNWWWk...',
  '...kQQQNNWWWk...',
  '...kTTTTTTTTk...',
  '...keeekkeeek...',
  '...keeekkeeek...',
  '...kvvvkkvvvk...',
  '...kkkk..kkkk...',
  '................',
  '................',
];

export const DOWN_STRIKE: PixelMap = [
  '................',
  '................',
  '....kHHHHHHk....',
  '...kHHHHHHHHk...',
  '..kHHJJJJJJLLk..',
  '..kHJJJJJJJJLk..',
  '..kJJAAAAAALLk..',
  '..kJAAAAAAAALk..',
  '..kJAkAAAAkALk..',
  '..kJABAAAABALk..',
  '...kABBAABBAk...',
  '....kBBBBBBk....',
  '...kTRRRRRRTk...',
  '...kQQQNNWWWk...',
  '...kQQQNNWWWk...',
  '..kAQQQNNWWWAk..',
  '..kAAQQNNWWAAk..',
  '...kTTTTTTTTk...',
  '...keeekkeeek...',
  '...keeekkeeek...',
  '...kvvvkkvvvk...',
  '...kkkk..kkkk...',
  '................',
  '................',
];

// --- facing away ------------------------------------------------------------

export const UP_RAISE: PixelMap = [
  '................',
  '....kHHHHHHk....',
  '...kHHHHHHHHk...',
  '..kHHJJJJJJLLk..',
  '..kHJJJJJJJJLk..',
  '..kJJJJJJJJLLk..',
  '..kJJJJJJJJJLk..',
  '..kJJJJJJJJJLk..',
  '..kJJJJLLJJJLk..',
  '.kAkJJLLLLJJkAk.',
  '.kQkkLLLLLLkkWk.',
  '.kQkTRRRRRRTkWk.',
  '.kQQkQQQQWWkWWk.',
  '...kQQQQQWWWk...',
  '...kQQQQQWWWk...',
  '...kQQQQQWWWk...',
  '...kQQQQQWWWk...',
  '...kTTTTTTTTk...',
  '...keeekkeeek...',
  '...keeekkeeek...',
  '...kvvvkkvvvk...',
  '...kkkk..kkkk...',
  '................',
  '................',
];

export const UP_STRIKE: PixelMap = [
  '................',
  '................',
  '....kHHHHHHk....',
  '...kHHHHHHHHk...',
  '..kHHJJJJJJLLk..',
  '..kHJJJJJJJJLk..',
  '..kJJJJJJJJLLk..',
  '..kJJJJJJJJJLk..',
  '..kJJJJLLJJJLk..',
  '...kJJLLLLJJk...',
  '....kLLLLLLk....',
  '...kTRRRRRRTk...',
  '...kQQQQQWWWk...',
  '...kQQQQQWWWk...',
  '...kQQQQQWWWk...',
  '..kAQQQQQWWWAk..',
  '..kAAQQQQWWAAk..',
  '...kTTTTTTTTk...',
  '...keeekkeeek...',
  '...keeekkeeek...',
  '...kvvvkkvvvk...',
  '...kkkk..kkkk...',
  '................',
  '................',
];

// --- in profile, facing right ----------------------------------------------

export const SIDE_RAISE: PixelMap = [
  '................',
  '....kHHHHHk.....',
  '...kHHHHHHHk....',
  '..kHHJJJJJJJk...',
  '..kHJJJJJAAAk...',
  '..kJJJJAAAAAk...',
  '..kJJJAAkAAAk...',
  '..kJJJAAAAAAAk..',
  '..kJJAAAABBBk...',
  '...kJAABBBBk.A..',
  '....kBBBBBk.kAk.',
  '...kTRRRRRTkQWk.',
  '....kQQQWWQQWk..',
  '...kQQQQQWWk....',
  '...kQQQQQWWk....',
  '...kQQQQQWWk....',
  '...kQQQQQWWk....',
  '...kTTTTTTTk....',
  '....keeeeek.....',
  '....keeeeek.....',
  '....kvvvvvk.....',
  '.....kkkkk......',
  '................',
  '................',
];

export const SIDE_STRIKE: PixelMap = [
  '................',
  '................',
  '....kHHHHHk.....',
  '...kHHHHHHHk....',
  '..kHHJJJJJJJk...',
  '..kHJJJJJAAAk...',
  '..kJJJJAAAAAk...',
  '..kJJJAAkAAAk...',
  '..kJJJAAAAAAAk..',
  '..kJJAAAABBBk...',
  '...kJAABBBBk....',
  '...kTRRRRRTk....',
  '....kQQQWWk.....',
  '...kQQQQQWWk....',
  '...kQQQQQWWAk...',
  '...kQQQQQWWAAk..',
  '...kQQQQQWWkAk..',
  '...kTTTTTTTk....',
  '....keeeeek.....',
  '....keeeeek.....',
  '....kvvvvvk.....',
  '.....kkkkk......',
  '................',
  '................',
];
