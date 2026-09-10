# MOSSHOLLOW

*The valley remembers.*

A cozy 2D pixel-art life-sim. You arrive at a homestead nobody has worked in
years, in a valley where somebody once hung bells on standing stones and left
without saying why.

Built in TypeScript on a hand-written Canvas2D renderer. **No game engine, no
runtime dependencies, and not one external art asset** — every sprite, tile,
palette entry and letterform in the game is authored or generated in this
repository.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints. `npm run build` produces `dist/`.

## Controls

| | |
|---|---|
| `W` `A` `S` `D` / arrows | walk |
| `Shift` | run |
| `E` / `Space` | interact |
| `` ` `` | debug overlay (press again for collision boxes, again to hide) |
| `T` | step the clock on an hour *(development)* |

## What's in it right now

- **One area, built to be looked at.** The homestead: farmhouse, stone apron,
  worn path, pond with a dock, a fallow fenced field, and forest closing it in.
- **Ground that isn't tiled.** Terrain materials are treated as fields, sampled
  and perturbed with noise per pixel, so a path edge wanders the way a trodden
  path wanders and no two square metres of grass repeat.
- **A living world.** Grass, canopies and reeds bend in a shared wind, so a
  gust visibly crosses the valley. Pollen drifts by day, fireflies come out at
  night, leaves come off the trees when it blows, smoke rises from the chimney
  when it's cold.
- **A real day.** Ambient colour, sky colour, shadow direction and shadow
  length are keyframed across 24 hours and interpolated. Shadows point west at
  sunrise, tuck under things at noon and stretch east at dusk.
- **Lighting, not a dark rectangle.** A light buffer is multiplied over the
  world; lanterns and windows add stepped, dithered falloff to it. After dark
  the world is desaturated *before* the blue ambient goes on, which is what
  makes lit windows read as warm against a silver night.
- **Cloud shadows** drifting on the wind, drawn into the lighting buffer so a
  lantern still burns through one.
- **Movement worth the fuss.** Separate acceleration and braking, normalised
  diagonals, newest-key-wins turning, axis-separated collision that slides
  along walls, and a walk cycle whose playback rate follows actual speed.
- **Weather that changes the valley.** The sky runs its own slow state machine
  — clear, gathering, raining, clearing. Cloud closes over before the first
  drop falls, the wind gets up ahead of it, shadows dissolve, colour drains,
  the lanterns come on early because the afternoon has gone dark, and nothing
  small flies until it passes. Every drop lands and leaves a splash; the pond
  gets rings.
- **Sound, synthesised.** No audio files either. Wind through a filter that
  opens with the gusts, rain and individual drips, water lapping when you're
  near the pond, birds by day and crickets after dark, and footsteps that know
  whether you're on grass, earth, stone or a wooden dock.
- **A generated score.** Sparse pentatonic plucks over a four-chord pad that
  drifts, thinning out and dropping an octave after dark. Not a loop.

## How it fits together

```
src/
  core/       loop, fixed timestep, input, math, seeded noise
  art/        palette, pixel-map toolkit, authored sprites, generators
  render/     renderer, camera, lighting, terrain baker, water, clouds,
              rain, shadows
  world/      tilemap, prop registry, area assembly, collision, depth sort
  entities/   player, animator
  systems/    time of day, weather, particles, audio, music
  ui/         bitmap font, panels, HUD, debug overlay
  data/       area content (ASCII maps and prop placements)
```

`docs/ARCHITECTURE.md` goes into the systems; `docs/STATUS.md` is the running
project log — what works, what's next, what's deliberately postponed.

## Art

Sprites are authored as arrays of strings, one character per pixel, drawn from
a single shared palette in `src/art/palette.ts`. That keeps the art hand-placed
and reviewable in a diff, and makes an off-palette colour impossible.

Rounded organic masses — tree canopies, bushes, boulders — are *generated* from
one shared shading model in `src/art/organic.ts` rather than authored, so every
leafy thing in the valley is lit by the same vector and quantised to the same
ramp while no two share a silhouette.

There is an art inspection page at `/art.html?p=1` (pages 1–3) that draws every
sprite at whole-number zoom against light and dark ground. It is a development
tool and is not part of the game.

## Status

Early. The first vertical slice — one area that feels good to walk around, in
any weather, at any hour — is in. Farming, crafting, NPCs, dialogue, quests and
saving are not built yet; see the roadmap in `docs/STATUS.md`.
