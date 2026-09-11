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

/**
 * The reference view. Everything is authored against this and it is the size
 * the game is played at on a 1080p screen.
 */
export const LOGICAL_W = 480;
export const LOGICAL_H = 270;
/** Kept for callers that want the reference width by name. */
export const REFERENCE_W = LOGICAL_W;
/**
 * How far the view may open up.
 *
 * Two limits decide these. They are held under the smallest map in the game —
 * Bell Row is 640x448 — so the camera always has somewhere to clamp and a large
 * monitor can never see past the edge of the world. And they are held where the
 * frame budget is comfortable: every logical pixel is one more to light, rain
 * on and composite, and at 608x384 the frame cost measured 14.4 ms against a
 * 16.7 ms budget, which is not enough headroom for a machine slower than this
 * one. At 560x340 the view is still around half as large again as the 480x270
 * reference and the frame is back under eleven.
 */
const MAX_W = 560;
const MAX_H = 340;
/** Buffer ceiling as a pixel budget rather than a flat multiplier. */
const MAX_BUFFER_PX = 9_000_000;

export interface ViewportSize {
  vw: number;
  vh: number;
  scale: number;
  store: number;
  cssW: number;
  cssH: number;
  bufW: number;
  bufH: number;
  portrait: boolean;
}

const even = (n: number): number => Math.max(2, Math.round(n / 2) * 2);
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/**
 * Spare screen is spent on *more view*, never on more magnification.
 *
 * This is the correction to the first attempt, which pinned the view near
 * 480x270 and let the scale absorb whatever the display had spare. That filled
 * the window, but it filled it by making everything bigger: on a 1366x768
 * laptop the character grew by a factor of 1.42 and the amount of valley on
 * screen did not change at all. On a 1024x768 display it actually went *down*.
 * Filling a screen by magnifying is the opposite of what a wider screen is for.
 *
 * So the scale is chosen first, as the largest whole number that still fits the
 * reference view, and then the logical size grows into whatever is left over.
 * A character therefore occupies the same fraction of the screen it always did,
 * and the extra pixels turn into more room to look at.
 *
 * Below 2x there is no whole number left worth having — a phone cannot show the
 * reference view twice over — so there the scale is allowed to be fractional
 * and the view opens as far as the clamps permit.
 */
export function computeViewport(availW: number, availH: number, dpr = 1): ViewportSize {
  const w = Math.max(1, availW);
  const h = Math.max(1, availH);

  let vw: number;
  let vh: number;

  const whole = Math.floor(Math.min(w / LOGICAL_W, h / LOGICAL_H));
  if (whole >= 2) {
    // Desktop. Keep the crisp whole-number scale the art was drawn for and
    // let the view open up into the remainder.
    vw = clamp(even(w / whole), LOGICAL_W, MAX_W);
    vh = clamp(even(h / whole), LOGICAL_H, MAX_H);
  } else {
    // Small screens. Open the view as far as it is allowed, then take whatever
    // scale that implies rather than leaving the screen half empty.
    const needed = Math.max(w / MAX_W, h / MAX_H);
    vw = clamp(even(w / needed), LOGICAL_W, MAX_W);
    vh = clamp(even(h / needed), LOGICAL_H, MAX_H);
  }

  const scale = Math.min(w / vw, h / vh);

  // Cover the device pixels the element actually occupies: covering and letting
  // the browser scale down is sharp, falling short and letting it scale up is
  // the blur this exists to remove.
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
    portrait: w / h < 0.86,
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
