# Architecture

Rules the codebase is meant to keep:

- **Data is separate from logic.** Areas, prop definitions and animation clips
  are data. Adding a tree, a fence run or a new area should not mean touching
  a system.
- **One palette.** Nothing invents a colour. `src/art/palette.ts` is the only
  place hex values live, and sprite authoring goes through single-character
  aliases so an off-palette colour cannot be written by accident.
- **One light direction.** Everything in the game is lit from above and
  slightly to the left. The organic generator, the authored sprites and the
  building builder all obey it.
- **Bake once, draw cheap.** Anything static is built at load. The per-frame
  cost is the depth-sorted pass, the water fill and the lighting composite.

---

## The frame

`core/loop.ts` runs a fixed 1/60s update with an accumulator and renders once
per animation frame. Gameplay never sees a variable timestep, so movement,
animation timing and particle behaviour are identical on any refresh rate.

`render/renderer.ts` owns three surfaces:

| surface | size | why |
|---|---|---|
| `world` | 481 x 271 | one pixel larger than the view, so the camera's sub-pixel remainder has somewhere to slide |
| `ui` | 480 x 270 | never offset, so HUD pixels stay on the grid |
| `light` | 481 x 271 | multiplied over the world |

The display canvas is always an exact whole-number multiple of 480x270. The
camera's integer part is what every world-space draw call is measured against;
its fractional part is applied to the final upscale blit. That is what gives
smooth motion at screen resolution while keeping the art pixel-crisp — snapping
the camera to whole low-res pixels instead makes everything judder.

## Ground

`render/terrain.ts` does not stamp tiles. Each material's presence in the tile
grid is sampled bilinearly per world pixel, perturbed by two octaves of value
noise, and thresholded. Edges therefore wander organically and grass never
repeats, while the underlying data stays a clean editable ASCII map.

The whole map is baked once into an offscreen canvas. Water is baked as a
*mask* instead of pixels, because it has to move; the pond bed is painted into
the ground layer and the animated surface is drawn over it semi-transparent, so
the shallows genuinely show their pebbles.

`render/water.ts` pre-renders eight seamlessly tiling frames from summed sine
waves at load. Per frame the cost is one pattern fill plus a mask.

## Depth

`world/world.ts` draws in this order:

1. baked ground, then the animated water surface
2. every shadow, all of them, before any sprite — so a shadow never lands on
   top of something standing in front of it
3. the depth-sorted pass: props, the house, the player and particles
   interleaved by their ground `y`

Particles are drawn in bands between depth slices rather than sorted
individually — same result, a fraction of the cost.

Static props are sorted once at construction, not per frame. The player and
anything else that moves is merged in as a `Drawable` each frame.

## Collision

Two layers, both asked through `World.blocked(rect)`:

- **Tiles** — water and the world's edge, from a bitmask on the tilemap
- **Props** — axis-aligned boxes in 64px spatial buckets

The player's collider is a 9x7 box at the feet, not the sprite. That is what
lets a character's head overlap a fence and still read as standing in front of
it. Movement resolves one axis at a time, which gives sliding along walls for
free.

## Lighting

`render/lighting.ts` fills a buffer with the ambient colour for the current
time, multiplies cloud shadows into it, adds each light with `lighter`, then
multiplies the whole buffer over the world.

Light falloff is **quantised and dithered**, not a smooth gradient. A smooth
radial gradient at 480x270 looks like a photographic vignette pasted onto pixel
art. Stepped, dithered falloff reads as part of the same picture.

After dark the world is desaturated *before* the ambient multiply, so warm
windows read against silver moonlight rather than yellow against green.

## Wind

`systems/weather.ts` produces one number. Grass, canopies, reeds, smoke and
airborne particles all bend from it, with a per-instance phase and a term that
travels with world position — so a gust visibly crosses the valley instead of
every plant flexing at once.

Sway is rendered by `drawSheared`, which draws a sprite one row at a time with
a per-row horizontal offset weighted toward the top. A tree canopy shears while
its trunk stays put, which reads as flexible material rather than a sliding
image.

## Art generation

`art/organic.ts` builds canopies, bushes and boulders from overlapping
spherical clumps: each clump is lit as a sphere, the results are combined,
creases are cut where clumps meet, the silhouette is perturbed by noise so it
reads as foliage rather than a balloon, and the result is quantised to a
palette ramp and contoured.

One model, one light vector, one ramp per material — so a boulder and an oak
look like they grew in the same valley, while the seed keeps any two of them
from being twins.

`art/building.ts` builds the farmhouse in code rather than as one large pixel
map, so the roof slope stays geometrically honest row by row and the house can
visibly change when the player repairs it.

## Development tools

- `` ` `` cycles the debug overlay: stats, then collision boxes, then off.
- `/art.html?p=1..3` draws every sprite at whole-number zoom on light and dark
  ground. Judging pixel art inside a moving 480x270 window is guesswork.
- In dev builds, `window.mosshollow` exposes `state()`, `step(frames)`,
  `setHour()`, `teleport()` and synthetic key input, so automated visual checks
  can drive the game deterministically instead of sleeping and hoping.
