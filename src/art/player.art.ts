/**
 * THE KEEPER — the player character.
 *
 * 16x24, on a three-frame walk cycle per facing: a contact pose for each foot
 * plus the neutral pose used as the pass frame. The cycle is
 * [stepA, pass, stepB, pass], with the pass frames lifted a pixel by the
 * animator, which is what gives the walk its bounce without needing eight
 * authored frames per direction.
 *
 * Design notes, because at 16 pixels wide every one of these is a decision:
 *  - The head is deliberately two pixels wider than the shoulders. That is
 *    what makes the character read as a person rather than a barrel.
 *  - Hands are single skin-coloured pixels at the ends of the sleeves. Without
 *    them the coat is a rectangle and the character appears to have no arms.
 *  - The cream placket runs down the centre of the coat: a vertical highlight
 *    that anchors the eye and separates left from right when walking.
 *  - The scarf under the jaw is the one warm accent up near the face, which is
 *    where you want the eye to go.
 *  - Boots are a full value darker than the trousers, or the legs turn into
 *    one dark mass at speed.
 *
 * Light comes from above and slightly to the left, in this and every sprite in
 * the game.
 */

import type { PixelMap } from './pixel.ts';

// --- facing the camera ------------------------------------------------------

export const DOWN_PASS: PixelMap = [
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
  '....kQQNNWWk....',
  '...kQQQNNWWWk...',
  '...kQQQNNWWWk...',
  '...kQQQNNWWWk...',
  '...kAQQNNWWAk...',
  '...kAQQNNWWAk...',
  '...kTTTTTTTTk...',
  '...keeekkeeek...',
  '...keeekkeeek...',
  '...kvvvkkvvvk...',
  '...kkkk..kkkk...',
  '................',
];

export const DOWN_STEP_A: PixelMap = [
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
  '....kQQNNWWk....',
  '...kQQQNNWWWk...',
  '...kQQQNNWWAk...',
  '...kQQQNNWWAk...',
  '...kAQQNNWWWk...',
  '...kAQQNNWWWk...',
  '...kTTTTTTTTk...',
  '...keeekkeeek...',
  '..keeeekkeeek...',
  '..kvvvvk.kvvk...',
  '..kkkkk...kkk...',
  '................',
];

export const DOWN_STEP_B: PixelMap = [
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
  '....kQQNNWWk....',
  '...kQQQNNWWWk...',
  '...kAQQNNWWWk...',
  '...kAQQNNWWWk...',
  '...kQQQNNWWAk...',
  '...kQQQNNWWAk...',
  '...kTTTTTTTTk...',
  '...keeekkeeek...',
  '...keeekkeeeek..',
  '...kvvk.kvvvvk..',
  '...kkkk..kkkkk..',
  '................',
];

// --- walking away from the camera -------------------------------------------
// The back of the head is all hair, tied off with a short knot so the up-facing
// sprite has a silhouette of its own rather than being a featureless dome.

export const UP_PASS: PixelMap = [
  '................',
  '....kHHHHHHk....',
  '...kHHHHHHHHk...',
  '..kHHJJJJJJLLk..',
  '..kHJJJJJJJJLk..',
  '..kJJJJJJJJLLk..',
  '..kJJJJJJJJJLk..',
  '..kJJJJJJJJJLk..',
  '..kJJJJLLJJJLk..',
  '...kJJLLLLJJk...',
  '....kLLLLLLk....',
  '...kTRRRRRRTk...',
  '....kQQQQWWk....',
  '...kQQQQQWWWk...',
  '...kQQQQQWWWk...',
  '...kQQQQQWWWk...',
  '...kAQQQQWWAk...',
  '...kAQQQQWWAk...',
  '...kTTTTTTTTk...',
  '...keeekkeeek...',
  '...keeekkeeek...',
  '...kvvvkkvvvk...',
  '...kkkk..kkkk...',
  '................',
];

export const UP_STEP_A: PixelMap = [
  '................',
  '....kHHHHHHk....',
  '...kHHHHHHHHk...',
  '..kHHJJJJJJLLk..',
  '..kHJJJJJJJJLk..',
  '..kJJJJJJJJLLk..',
  '..kJJJJJJJJJLk..',
  '..kJJJJJJJJJLk..',
  '..kJJJJLLJJJLk..',
  '...kJJLLLLJJk...',
  '....kLLLLLLk....',
  '...kTRRRRRRTk...',
  '....kQQQQWWk....',
  '...kQQQQQWWWk...',
  '...kQQQQQWWAk...',
  '...kQQQQQWWAk...',
  '...kAQQQQWWWk...',
  '...kAQQQQWWWk...',
  '...kTTTTTTTTk...',
  '...keeekkeeek...',
  '..keeeekkeeek...',
  '..kvvvvk.kvvk...',
  '..kkkkk...kkk...',
  '................',
];

export const UP_STEP_B: PixelMap = [
  '................',
  '....kHHHHHHk....',
  '...kHHHHHHHHk...',
  '..kHHJJJJJJLLk..',
  '..kHJJJJJJJJLk..',
  '..kJJJJJJJJLLk..',
  '..kJJJJJJJJJLk..',
  '..kJJJJJJJJJLk..',
  '..kJJJJLLJJJLk..',
  '...kJJLLLLJJk...',
  '....kLLLLLLk....',
  '...kTRRRRRRTk...',
  '....kQQQQWWk....',
  '...kQQQQQWWWk...',
  '...kAQQQQWWWk...',
  '...kAQQQQWWWk...',
  '...kQQQQQWWAk...',
  '...kQQQQQWWAk...',
  '...kTTTTTTTTk...',
  '...keeekkeeek...',
  '...keeekkeeeek..',
  '...kvvk.kvvvvk..',
  '...kkkk..kkkkk..',
  '................',
];

// --- in profile, facing right (mirrored at build time for left) -------------
// Narrower than the front view, with the nose breaking the silhouette on the
// right and the near arm swinging clear of the body.

export const SIDE_PASS: PixelMap = [
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
  '....kBBBBBk.....',
  '...kTRRRRRTk....',
  '....kQQQWWk.....',
  '...kQQQQQWWk....',
  '...kQQQQQWWk....',
  '...kQQQQQWWk....',
  '...kAQQQQWWk....',
  '...kAQQQQWWk....',
  '...kTTTTTTTk....',
  '....keeeeek.....',
  '....keeeeek.....',
  '....kvvvvvk.....',
  '.....kkkkk......',
  '................',
];

export const SIDE_STEP_A: PixelMap = [
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
  '....kBBBBBk.....',
  '...kTRRRRRTk....',
  '....kQQQWWk.....',
  '...kQQQQQWWk....',
  '..kAQQQQQWWk....',
  '..kAQQQQQWWk....',
  '...kQQQQQWWk....',
  '...kQQQQQWWk....',
  '...kTTTTTTTk....',
  '...keeeekeek....',
  '..keeeekkeek....',
  '..kvvvvk.kvvk...',
  '..kkkkk...kkk...',
  '................',
];

export const SIDE_STEP_B: PixelMap = [
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
  '....kBBBBBk.....',
  '...kTRRRRRTk....',
  '....kQQQWWk.....',
  '...kQQQQQWWk....',
  '...kQQQQQWWAk...',
  '...kQQQQQWWAk...',
  '...kQQQQQWWk....',
  '...kQQQQQWWk....',
  '...kTTTTTTTk....',
  '....keekeeek....',
  '....keekkeeek...',
  '...kvvk.kvvvk...',
  '...kkkk..kkkk...',
  '................',
];
