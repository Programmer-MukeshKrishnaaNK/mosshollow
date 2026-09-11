/**
 * THE VIEWPORT
 *
 * One authoritative calculation, and everything downstream reads it: the
 * render surfaces, the camera, every panel, and the transform that turns a
 * finger on the glass into a position in the game. Before this there were
 * three different opinions about how big the game was — a pair of constants,
 * a scale on the renderer, and a bounding rectangle measured at input time —
 * and they only agreed because the answer never changed.
 *
 * Four quantities, kept deliberately distinct because conflating any two of
 * them is where viewport bugs live:
 *
 *   LOGICAL      the world the game thinks in. Height is fixed at 270 so a
 *                person is always the same number of pixels tall and the
 *                valley always feels the same size; width flexes with the
 *                display's shape so a wide screen shows a wider room rather
 *                than the same room with curtains either side.
 *   DISPLAY      how many CSS pixels one logical pixel occupies.
 *   BACKING      the canvas's real pixel buffer. Sized against
 *                devicePixelRatio, because a 960x540 buffer shown across
 *                1280 device pixels is upscaled by the browser with
 *                smoothing — which is exactly how a pixel-art game ends up
 *                looking soft on every modern phone.
 *   CSS          the element's laid-out size.
 *
 * Why the width clamps: the narrow end stops a 4:3 display from squeezing the
 * playable room to a slot, and the wide end stays inside the smallest map in
 * the game (Bell Row, 640px) so the camera always has somewhere to clamp to
 * and an ultrawide monitor cannot see past the edge of the world.
 */

/** The reference. A character is this fraction of a 16:9 screen's height. */
export const LOGICAL_H = 270;
/** The 16:9 reference. At this aspect nothing changes from how it always was. */
export const REFERENCE_W = 480;
const MIN_W = 384;
const MAX_W = 608;
/**
 * The logical height may grow on displays that are taller than 16:9 so a 4:3
 * monitor fills completely instead of banding. Capped well under the shortest
 * map in the game (Bell Row, 448px) so the camera always has room to clamp.
 */
const MAX_H = 360;
/**
 * Buffer ceiling as a pixel budget rather than a flat multiplier. A flat cap
 * of four left a 1440p desktop being upscaled by the browser — the exact blur
 * this is here to avoid — while still permitting an enormous buffer on an
 * ultrawide. A budget bounds the memory and lets the multiplier go as high as
 * it usefully can on any given shape of screen.
 */
const MAX_BUFFER_PX = 9_000_000;

export interface ViewportSize {
  /** Logical game pixels. The camera, the UI and hit-testing all use these. */
  vw: number;
  vh: number;
  /** CSS pixels per logical pixel. May be fractional on small displays. */
  scale: number;
  /** Whole-number multiplier of the backing buffer. */
  store: number;
  cssW: number;
  cssH: number;
  bufW: number;
  bufH: number;
  /** True when the display is so tall that the game should ask to be turned. */
  portrait: boolean;
}

const even = (n: number): number => Math.round(n / 2) * 2;

export function computeViewport(availW: number, availH: number, dpr = 1): ViewportSize {
  const w = Math.max(1, availW);
  const h = Math.max(1, availH);
  const aspect = w / h;

  // Width flexes with the display's shape: a wide screen gets a wider room
  // rather than the same room with curtains either side.
  const vw = Math.min(MAX_W, Math.max(MIN_W, even(LOGICAL_H * aspect)));
  let vh = LOGICAL_H;

  // If the display is taller than the width allows, spend the slack on height
  // instead of leaving it as bars. This is what makes 4:3 fill completely.
  const scaleFromW = w / vw;
  if (h / vh > scaleFromW) {
    vh = Math.min(MAX_H, Math.max(LOGICAL_H, even(h / scaleFromW)));
  }

  const scale = Math.min(w / vw, h / vh);

  // Cover the device pixels the element actually occupies. Covering and
  // letting the browser scale down is sharp; falling short and letting it
  // scale up is the blur. Then pull back if the budget says so.
  let store = Math.max(1, Math.ceil(scale * Math.max(1, dpr)));
  while (store > 1 && vw * store * vh * store > MAX_BUFFER_PX) store--;

  return {
    vw,
    vh,
    scale,
    store,
    cssW: vw * scale,
    cssH: vh * scale,
    bufW: vw * store,
    bufH: vh * store,
    // Below this the game is more letterbox than game and asking the player to
    // turn the phone is honest; the alternative is showing half the map.
    portrait: aspect < 0.86,
  };
}

export interface SafeInsets { top: number; right: number; bottom: number; left: number; }

/**
 * The notch, the rounded corners and the home indicator, in CSS pixels.
 * Read from a probe element because env() is only resolvable by CSS.
 */
export function readSafeInsets(): SafeInsets {
  const el = document.getElementById('safe-probe');
  if (!el) return { top: 0, right: 0, bottom: 0, left: 0 };
  const cs = getComputedStyle(el);
  const px = (v: string): number => Math.max(0, Math.round(parseFloat(v) || 0));
  return {
    top: px(cs.paddingTop),
    right: px(cs.paddingRight),
    bottom: px(cs.paddingBottom),
    left: px(cs.paddingLeft),
  };
}

/** Did anything that needs surfaces rebuilt actually change? */
export function sameLogical(a: ViewportSize, b: ViewportSize): boolean {
  return a.vw === b.vw && a.vh === b.vh;
}
