# Project status

Updated: 2026-09-10

## Current build

Phase 1 complete — the visual foundation.

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
- HUD: almanac card with day, clock and sun/moon dial; title card
- Debug overlay, art sheet page, deterministic dev stepper

**Measured:** 3.5 ms/frame typical, 6.5 ms worst case (dense forest) against a
16.7 ms budget. Production bundle 15.4 kB gzipped, zero runtime dependencies.

## Current milestone

Phase 2 — atmosphere. Weather states and the audio architecture.

## Known issues

- Path corners at the T-junction still read a little square; the field roughen
  does not fully break a right angle.
- The fallow field does not yet read clearly as *a field* from a distance.
  Needs furrow remnants or a different reclaimed-grass treatment.
- Oak canopy variants are distinguishable but two of the three are close.
- No audio at all yet.

## Next task

Audio architecture: a synthesised, file-free sound layer (footsteps keyed to
ground material, wind, water, birds by time of day, a lantern hum at night),
plus rain as the first real weather state.

## Deferred, on purpose

**NEXT** — rain and its effect on light, ground, puddles and NPC behaviour;
seasons once the base world is polished; the well prop; area transitions.

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
