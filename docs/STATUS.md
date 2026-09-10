# Project status

Updated: 2026-09-10

## Current build

Phases 1 to 3 complete, persistence, and the first half of Phase 4 — the visual foundation, the
atmosphere over it, a farming loop you can run start to finish, and a save that
survives being handed a file it was not expecting.

**Working and verified in-browser:**

- Renderer: 480x270 internal, whole-number upscale, sub-pixel camera scroll
- Camera: damped follow with directional lead, clamped to the map, shake ready
- Player: acceleration/braking, normalised diagonals, newest-key-wins turning,
  three-frame walk cycle per facing with speed-linked playback, idle breathing
- Collision: tile bitmask plus bucketed prop boxes, axis-separated with sliding
- Ground: field-based terrain baker (no visible tiling, organic material edges)
- Water: masked animated surface over a painted bed, with a foam waterline
- Props: ~2000 placed per area from data plus generated forest and decoration
- Wind: one shared value driving grass, canopies, reeds, smoke and particles
- Time of day: 24h keyframed ambient, sky, shadow direction and shadow length
- Lighting: multiplied buffer, dithered falloff, night desaturation, bloom
- Cloud shadows drawn into the lighting buffer
- Particles: pooled, `z`-aware, named presets, depth-banded drawing
- Weather: sky state machine (clear / gathering / rain / clearing) driving
  rain, cloud cover, wind envelope, shadow strength, colour drain, lamp
  switch-on and the disappearance of pollen, fireflies and birdsong
- Rain: screen-space streaks that each land, world-space splashes, pond rings
- Audio: fully synthesised — wind, rain, drips, shore, birds, crickets, and
  footsteps keyed to grass / earth / soil / stone / wood
- Music: generated pentatonic score, sparse by day, sparser and lower at night
- Farming: till, plant, water, grow, wither, harvest, regrow, and ground that
  reverts if you turn it and then never use it
- Crops: two, five authored growth stages each, wind-responsive, depth-sorted
  with everything else so you can stand behind mature wheat
- Soil: generated dry and wet variants with per-side edges, so a block of beds
  reads as one worked patch instead of a grid of squares
- Tool swing: anticipation, held apex, impact hold, follow-through; tool sprite
  anchored per facing and per phase, mirrored so it swings one-handed
- Inventory and hotbar with six slots, stacking, and item flavour lines
- HUD: almanac card with day, clock and sun/moon dial; title card
- Gathering: axe and pick, trees that fell into stumps and stumps that can be
  grubbed out, rocks that break and free the ground under them, guarded border
  woods that do not yield
- Dropped items: pop out with an arc and a bounce, settle where you can see
  them land, then home in and accelerate; a full inventory leaves them lying
  there rather than deleting them
- Dialogue: queued lines with a typewriter reveal, punctuation that holds a
  beat, mid-reveal completion, page counter, and a box that takes the keyboard
  while it is open
- Eight inspectable objects with authored narration, one of which reads
  differently once you have found its pair. An unread object takes priority
  over the held tool; a read one falls through to it
- Save/load: autosaves each morning and on tab hide, restores player, clock,
  weather, inventory and every worked plot. Every field is optional on the way
  in and content ids are validated against the data, so an old, a newer or a
  corrupted file degrades rather than crashes. Prop changes are saved as
  mutations keyed by position, so the two thousand generated props never touch
  the file and a layout change does not invalidate anyone's game
- Debug overlay, art sheet (5 pages incl. an animation filmstrip), deterministic
  dev stepper with pause/resume

**Measured:** 3.5 ms/frame typical, 6.5 ms worst case (dense forest), and
5.3 ms with 117 plots of mature crops on screen — against a 16.7 ms budget.
Audio peaks at 0.30 with no clipping. Swept all four sky states against eight
times of day with no runtime errors. Farm loop verified end to end: till,
plant (seed consumed), water, seven watered days through all five growth
stages, harvest into inventory; plus withering after the thirst limit, clearing
a withered plant, emberwheat regrowing exactly twice, and rain both soaking the
field and counting as an overnight watering. Save round-trips exactly, and ten
hostile files — corrupt JSON, empty, an array, a future version, every field
missing, nulls throughout, wrong types, unknown crops and items, out-of-bounds
plots, absurd numbers — all load without a single throw. Production bundle
25.9 kB gzipped, zero runtime dependencies.

## Current milestone

Phase 4 — exploration. Resource gathering, and somewhere to go.

## Known issues

- **The audio mix has never been heard.** It is verified by measurement only
  (the graph runs, levels respond to state, nothing clips). Balance between
  music, ambience and footsteps needs a human ear before it can be called done.
- Rain does not leave puddles, and the ground dries instantly when it stops.
  The wetness is a lighting change, not a state the terrain remembers.
- Planting resolves instantly with no animation. It feels right for a light
  action, but it is the one interaction in the loop with no motion behind it.
- The fallow field terrain and tilled soil are close enough in tone that a big
  untilled patch can read as worked ground from a distance.
- Path corners at the T-junction still read a little square; the field roughen
  does not fully break a right angle.
- The fallow field does not yet read clearly as *a field* from a distance.
  Needs furrow remnants or a different reclaimed-grass treatment. Phase 3 will
  be rewriting this ground anyway.
- Oak canopy variants are distinguishable but two of the three are close.

**Also verified:** every inspectable object opens with the right page count in
four sky states across five times of day, cancel closes the box and returns
control, movement is locked while it is open, and pressing the interact key
mid-reveal completes the line rather than skipping it. No runtime errors.

## Next task

Phase 4b — a second area. The meadow east of the gate: area registry, a
transition that fades and swaps worlds, per-area farm and prop state in the
save, and something over there worth the walk.

After that, `?fresh` needs a real counterpart in the UI — right now starting
over means knowing about a URL parameter, and the first autosave then
overwrites the old file.

## Deferred, on purpose

**NEXT** — puddles and ground that stays wet after rain; seasons once the base
world is polished; the well prop; area transitions; a volume control.

**LATER** — farming loop; inventory and hotbar; crafting; NPCs, schedules and
dialogue; quests; save/load; house upgrades; the meadow, forest and settlement
areas.

**CUT** — fishing minigame (a lot of systems for one interaction); combat (does
not belong in this game); procedural cave levels (scope).

## Design decisions worth remembering

- **No external assets, ever.** Everything is authored as pixel maps or
  generated from the shared shading model. It keeps the look coherent and the
  repository self-contained.
- **Terrain as fields, not tiles.** Costs a one-off bake at load and removes
  the two things that make tile-based ground look cheap: visible repetition and
  right-angled material boundaries.
- **Quantised, dithered lighting.** Smooth gradients are the fastest way to
  make pixel art look like pixel art with a filter on it.
- **The head is wider than the shoulders.** The first pass at the player had
  them equal and it read as a barrel with a face.
- **Rain composites after the lighting multiply.** Drawn before it, a downpour
  is darkened by the valley's own ambient and disappears into an overcast
  scene — which is what happened on the first attempt. Rain is between the
  camera and the world, not part of it.
- **Pentatonic, and mostly silence.** A generated score cannot play a wrong
  note in a pentatonic scale, so the only risk left is playing too many of
  them. Most beats are deliberately empty.
- **The impact hold is 100ms, not 60.** At 60ms — under four frames — the eye
  skips the moment the blow lands and the swing reads as a sprite swap. This
  was measured by driving a real swing through the filmstrip page, not guessed.
- **Crop stages build on each other's silhouette.** Five unrelated sprites read
  as the plant being replaced; five that share a stem and add growth above read
  as the plant growing.
- **Growth advances on watered days, not elapsed time.** It is the only thing
  that makes the watering can a decision instead of a chore.
- **The save loader trusts nothing.** Every field is read through a helper that
  takes a default, and every content id is checked against the data. Losing one
  plant to a removed crop is a bug report; losing the farm is a ruined
  afternoon.
- **An unread object outranks the held tool; a read one does not.** Standing at
  a standing stone with a hoe, pressing E means "read this". Pressing it again
  means "till". Without that rule the pond marker was unreadable while holding
  a hoe, because the grass in front of it was tillable.
- **The look hint appears exactly when the key would read.** A hint that lies
  about what a button does is worse than no hint.
- **Prop changes are saved as mutations, not as a prop list.** Two thousand
  props are reproduced exactly by the seed; only the handful the player touched
  need storing, keyed by position rather than index because the array changes
  shape when a tree becomes a stump.
- **A transformed prop's damage is cleared, not inherited.** The stump is a
  different thing with its own durability — carrying the felled tree's last hit
  point over left it one blow from gone on every reload.
- **The border woods are scenery.** Their tiles stay solid regardless, so
  felling one would leave a visible gap you still could not walk through.
- **A version newer than this build is refused outright.** Reading it would
  silently discard whatever it knows that this build does not, and then write
  the loss back on the next autosave.
