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

Add `?fresh` to the URL to start a new valley without loading the existing
save.

## Controls

| | |
|---|---|
| `W` `A` `S` `D` / arrows | walk |
| `Shift` | run |
| `E` / `Space` | look at things, use what you're holding |
| `Esc` | close the dialogue box |
| `1` – `8` | choose a hotbar slot |
| `I` | open the satchel |
| `Tab` | switch tabs while it's open |
| `Esc` | pause menu, or close what's in front of you |
| mouse / touch | everything in the interface |
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
- **A farm you work.** Turn ground with the hoe, plant, water, and come back
  the next day. Two crops with five hand-drawn growth stages each, so progress
  is something you see rather than a number. Crops only advance on days they
  were watered, wither if they are left too long, and rain waters the whole
  field for you. Emberwheat regrows twice from the crown before it gives up.
- **A swing worth swinging.** The hoe winds up, *holds* — that pause is the
  anticipation the whole thing rests on — snaps through, throws soil, shakes
  the camera a pixel, and follows through into a recovery you can walk out of.
- **A valley that talks back.** The signpost, the crates, the dock, the lanterns
  and two standing stones nobody will explain all have something to say when
  you look at them. The second stone's text changes if you found the first —
  noticing the pattern is the discovery, not the stone. A quiet chevron marks
  anything worth reading, and appears only when the interact key would actually
  read it.
- **A valley you can take apart.** An axe and a pick. Trees take four blows and
  leave a stump you can grub out afterwards; rocks break and the ground they
  stood on becomes walkable. What comes loose bounces out onto the grass, waits
  a beat so you see it land, then homes in as you approach. The deep woods
  around the edge don't yield — the tiles under them stay solid either way, and
  a gap you still couldn't walk through would be worse than no gap.
- **Somewhere to go.** East through the gate is the meadow: a stream that
  wanders the whole height of the map, crossed at one place on stones somebody
  laid, an outcrop of boulders, a grove gone wild — and a cut stone floor, ten
  metres by eight, with grass coming through it and no walls anywhere. The
  third standing stone is in the middle of it, and it is the only one of the
  three that still has its bell. Walking into a gate takes it; there is nothing
  to press.
- **A satchel, a workbench and a board.** One screen with three tabs, in the
  same aged paper and thin wood as everything else: thirty-two slots with the
  hotbar as its first row, recipes that turn raw wood and stone into the planks
  and blocks every project is built from, and the list of work waiting to be
  done. Pointer-first and keyboard-complete — every control is a rectangle in
  game coordinates, so a finger will reach it as easily as a mouse.
- **Progression you can walk up to.** Six projects, and not one of them
  improves a number. The farmhouse goes from a mossy roof and bare windows, to
  new shingles and shutters, to a porch, flower boxes and a weathervane. The
  collapsed field fence closes. The dock reaches the old posts and you can
  stand out over the water. Three lamps light the track end to end, which
  changes the walk home entirely.
- **A real way to start again.** A pause menu, and a second screen that says
  plainly what is about to be lost before it does it.
- **It remembers.** The valley saves itself every morning and whenever you
  close the tab, and picks up where you left off. The loader treats every field
  in the file as optional and validates content ids against the game's data, so
  a save from an older build, a newer build, or a corrupted one degrades
  instead of crashing.

## How it fits together

```
src/
  core/       loop, fixed timestep, keyboard, pointer, math, seeded noise
  art/        palette, pixel-map toolkit, authored sprites, generators
  render/     renderer, camera, lighting, terrain baker, water, clouds,
              rain, shadows
  world/      tilemap, prop registry, area assembly, collision, depth sort
  entities/   player, animator, dropped items
  systems/    time of day, weather, particles, audio, music, farm, inventory,
              crafting, projects, dialogue, area transitions, save/load
  ui/         bitmap font, panels, HUD, ledger, pause menu, debug overlay
  data/       two areas — ASCII maps, prop placements, crops, items, recipes,
              projects, and everything the world says when you look at it
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

There is an art inspection page at `/art.html?p=1` (pages 1–5) that draws every
sprite at whole-number zoom against light and dark ground. Page 5 is a
filmstrip: it drives a real `Player` through a real tool swing and draws it
every few frames, because animation cannot be judged from static poses — what
matters is the spacing between them. It is a development tool and is not part
of the game.

## Status

Genuinely playable end to end. Three connected areas; a farming loop from bare
ground to a full satchel; an axe and a pick that change the world permanently;
crafting and six building projects that rebuild the homestead in front of you;
a hamlet with three people living in it who keep their own hours, react to what
you have built, and behave differently in the rain; and a thread of
environmental storytelling that pays off if you follow it — and then does not
finish. Quests are not built yet; see the roadmap in `docs/STATUS.md`.
