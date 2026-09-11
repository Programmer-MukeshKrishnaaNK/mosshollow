# Project status

Updated: 2026-09-11

## Current build

Phases 1 to 9 complete, plus persistence — the visual foundation, the
atmosphere over it, a farming loop you can run start to finish, a progression
system that rebuilds the place in front of you, a settlement with people living
in it, an answer to the question the valley has been asking since the first
standing stone, a save that survives being handed a file it was not expecting,
a touch layer that makes the whole of it playable with two thumbs, and a
viewport that fills whatever screen it is given without bending a pixel.

A note on the numbering, because it was wrong for a while: two substantial
milestones — save/load (`7cf8739`) and the dialogue system (`75f356f`) — were
built and shipped without phase numbers, so the count drifted out of step with
the commits. "Phase 5" was coined retroactively in the Phase 6 commit as a name
for the settlement work that had until then lived unnumbered in the LATER
bucket. It is now built.

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
- The Ledger: one screen, three tabs — a 32-slot satchel whose first row is the
  hotbar, a workbench, and the project board's list. Pointer-first and
  keyboard-complete; every control is a rectangle in game coordinates
- Pointer abstraction over pointer events, reporting in game coordinates, so
  mouse and touch arrive through one path
- Crafting: raw wood and stone refine into the planks and blocks every project
  is built from; produce turns back into seed; compost from a surplus harvest
- Six projects that visibly rebuild the valley — three farmhouse levels, the
  field fence, the dock, lamps along the track, a lamp at the ruin. Effects are
  declarative and re-applied from the save, so a project's result can be
  improved later and existing saves get the better version
- Pause menu with a two-step Start Over that says what will be lost
- Gathering: axe and pick, trees that fell into stumps and stumps that can be
  grubbed out, rocks that break and free the ground under them, guarded border
  woods that do not yield
- Dropped items: pop out with an arc and a bounce, settle where you can see
  them land, then home in and accelerate; a full inventory leaves them lying
  there rather than deleting them
- Two areas joined by gates. Areas are built on first visit and kept; the swap
  happens at full black, which is also where the terrain bake hides
- Per-area farm, prop and drop state — walking away from a farm does not wipe it
- Dialogue: queued lines with a typewriter reveal, punctuation that holds a
  beat, mid-reveal completion, page counter, and a box that takes the keyboard
  while it is open
- Twelve inspectable objects with authored narration across both areas. Two of
  them read differently depending on what you have already found — the third
  standing stone gives five lines instead of three once you have seen the other
  two, which is the payoff of the set. An unread object takes priority
  over the held tool; a read one falls through to it
- Save/load: autosaves each morning and on tab hide, restores player, clock,
  weather, inventory and every worked plot. Every field is optional on the way
  in and content ids are validated against the data, so an old, a newer or a
  corrupted file degrades rather than crashes. Prop changes are saved as
  mutations keyed by position, so the two thousand generated props never touch
  the file and a layout change does not invalidate anyone's game
- Bell Row: a four-plot hamlet south down the old spur, with three residents
  and one shuttered house. Cottages are built in code as a sibling of the
  farmhouse builder, at a smaller footprint, so the player's house stays the
  largest and best-lit building in the valley
- NPCs: Nan Hollis, Rue and Orrin Fell — hand-authored at 16x24 against the
  shared palette, three silhouettes (round / thin / square), three gaits, and
  one saturated garment between them. They join the world's existing
  depth-sorted pass as Drawables and need no renderer change at all
- Schedules: keyframed by hour against named waypoints in area data, with an
  L-shaped route out to the lane and back in. No pathfinding, and nothing to
  get stuck on
- Weather reactions, one per character and all different: Nan goes in, Orrin
  carries on because his shed has a roof, Rue goes and stands in it
- Conversation through the existing dialogue system with the speaker tab that
  had been drawn and unused since Phase 4; lines gated on projects finished and
  inspectables read, with per-person topics rather than a friendship number
- Barks: a world-anchored slip of paper, once a day per person, no input and no
  freeze
- The thread: six beats carried entirely by what people say and what the world
  lets you do next. No quest log, no markers, no arrows — if the player cannot
  follow it without a journal then the writing is wrong and a journal would
  only hide that. It ends with an answer to the human question and one
  instruction nobody has had to obey
- One authoritative viewport (`core/viewport.ts`) driving the render surfaces,
  the camera, every panel and every pointer transform. Logical height is fixed
  at 270; logical width flexes with the display's shape, so a wide screen gets
  a wider room instead of the same room with bars either side. Every landscape
  resolution tested fills 100% of the window
- Backing buffers sized against devicePixelRatio, so pixel art is no longer
  upscaled and softened by the browser on a high-density screen
- Touch: a floating analog thumbstick that appears under the thumb, an action
  cluster, a touch-sized hotbar you can tap to select from, tap-outside to
  close a panel, and hints that name the device in your hand rather than a key
  it does not have. Multi-touch, so the stick and a button work at once
- A sound setting in the pause menu, five steps, adjusted in place — the last
  item on the deferred list from Phase 1
- Debug overlay, art sheet (6 pages incl. an animation filmstrip and the NPC
  silhouette gate), deterministic dev stepper with pause/resume

**Measured after Phase 9:** 6.1 ms/frame in the homestead, 6.3 in Bell Row
with all three residents, 6.5 in rain, 7.7 with the satchel open, 8.5 at a
844x390 phone viewport where the logical view is 22% wider. Against a 16.7 ms
budget. 14 MB heap. The rise over Phase 8 is the cost of the crispness fix: a
1280x720 display now draws into a 2880x1620 buffer instead of 1920x1080, and
a phone draws a 584-wide world instead of a 480-wide one.

**Measured after the Phase 8 polish pass:** 4.9 ms/frame in the homestead, 5.6 in Bell
Row with all three residents walking, 4.4 in the meadow, 6.0 worst case in rain,
5.6 with the satchel open. At a 844x390 phone viewport: 3.6 homestead, 5.5 Bell
Row, 5.7 in rain. All against a 16.7 ms budget. 27 MB heap with all three areas
held. Audio measured at the master bus: 0.047 RMS on a clear day, 0.116 in
rain, peak 0.58 on the bell against a 0.39 ambient bed, nothing above unity.

**Previously measured:** 5.2-6.2 ms/frame in the homestead — day, night, raining, and with
any interface screen open — against a 16.7 ms budget; 2.4 ms in the meadow;
6.2-6.3 ms in Bell Row across day, dusk, rain and night with all three
residents walking their day. 14.5 MB heap with all three areas built and held.
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

None outstanding. The roadmap is finished: Phases 1 to 9 are built, tested and
pushed. What is left is listed under Next task, and none of it is a phase.

## Known issues

- **Bell Row has no interiors and will not get them.** Doors do not open;
  "indoors" means the person stops being drawn once they reach their step.
  It is the right scope for a vertical slice and it is visible as a limit.
- **The interface has not been used with a finger.** It is built for it — one
  pointer path, hit-testing in game coordinates, presses that cancel if you
  slide off — but it has only been driven by a mouse and a keyboard so far.
- No on-screen movement controls, so the game is not yet playable on a phone
  even though the interface would be.

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

Phase 8 — polish, and the Android build. The pointer layer is in and every
control is already a rectangle in game coordinates, so what remains for Android
is on-screen movement controls and a touch-sized pass over the hotbar. For
polish: puddles and ground that stays wet, an animation on planting, a volume
control, and the audio mix finally being heard by somebody.

The story thread is closed but not exhausted — one bell of nine has been found,
and the slate under it is an instruction nobody has had to follow yet. That is
deliberately left standing.

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
- **The area swap happens at full black, not during the fade.** Building an
  area bakes its terrain, which costs a couple of hundred milliseconds. During
  the fade that visibly stalls the fade; on a black screen it is invisible.
- **The fade in is slower than the fade out.** Leaving somewhere should feel
  brisker than arriving.
- **Gates are walked into, not pressed.** A gate you have to confirm is a door,
  and these are gaps in a hedge.
- **Exits are cut out of the border after it is built.** The order of those two
  loops is the entire difference between a gate and a wall.
- **The save is taken on arrival, not on departure.** Saved on the way out, a
  reload puts you back in the doorway you just used.
- **Prop changes are saved as mutations, not as a prop list.** Two thousand
  props are reproduced exactly by the seed; only the handful the player touched
  need storing, keyed by position rather than index because the array changes
  shape when a tree becomes a stump.
- **A transformed prop's damage is cleared, not inherited.** The stump is a
  different thing with its own durability — carrying the felled tree's last hit
  point over left it one blow from gone on every reload.
- **The border woods are scenery.** Their tiles stay solid regardless, so
  felling one would leave a visible gap you still could not walk through.
- **One place decides whether the player can move.** It used to be half a dozen
  scattered `frozen = true/false` writes and they fought each other: the title
  card's release ran every frame and undid the dialogue's hold, so control came
  back while the box was still closing. It is now derived from what is on
  screen, and derived state cannot disagree with itself.
- **Project effects are declarative and claimed once per world.** "Add three
  lanterns" is not idempotent, so a world records which projects it has already
  carried out — otherwise re-applying a save would put two lanterns in every
  post hole.
- **The upgrade has to be readable from across the yard.** Each farmhouse level
  changes the roof's overall value and the building's silhouette rather than
  adding detail, because detail is invisible at 480x270.
- **Start Over is two screens and names what it destroys.** "Are you sure?"
  tells nobody anything, and the safe option is the one already selected.
- **Three residents, not four.** Four houses with four people in them is a
  functioning village, and a functioning village contradicts everything the
  valley has said so far. The empty house is the fourth character and it costs
  a prop, a bench and a swept step.
- **Nan sweeps two steps every morning.** Hers, and the one belonging to the
  house nobody lives in. Nothing in the game ever mentions it.
- **Silhouette, motion and colour, in that order.** Round/thin/square, then
  slow/erratic/still, then cream-and-grey / one orange cap / a dark apron. The
  first pass had Nan as an undifferentiated cream blob and Orrin looking like a
  man carrying a white tray; both were caught on the art sheet's silhouette row
  and redrawn before a single line of movement code was written.
- **Cottages are props, not houses.** The World supports exactly one `house`
  and it belongs to the player. Registering the cottages as props gave them
  depth sorting, shadows, colliders and window light for nothing, and asked the
  renderer for nothing it did not already do.
- **The cottages are deliberately smaller than the farmhouse.** A cottage that
  matches it steals the one thing Phase 6 spent its whole length earning.
- **NPC position is derived, never saved.** Where somebody is standing is a
  function of the hour, so arriving in an area evaluates it rather than
  replaying it. The save has nothing to desync from and an area you are not
  standing in costs nothing at all.
- **Relationship state is not a number.** `met`, the day you last spoke, and a
  set of topics. A bar that fills is the exact generic-RPG texture Bell Row was
  built to avoid.
- **An L, not a search.** Out to the lane, along it, in at the far end. Bell
  Row is one corridor with things either side, so a pathfinder would only be a
  more expensive way to get the same route with more ways to fail.
- **Orrin's shed has a visible roof.** It is the entire reason he can keep
  working through a downpour, and it has to be *visible* or the behaviour reads
  as a bug rather than as sense.
- **A person outranks every other use of the interact key**, including an
  unread inspectable and a held tool. Standing in front of Orrin with an axe
  and pressing E must never swing it.
- **The worn earth in front of each door was cut stone first, and it was
  wrong.** Stone in this game is the ruin floor and the farmhouse footing, so a
  patch of it on grass reads as rubble rather than as a doorstep, and at
  480x270 it is only ever a grey smudge floating off the path.
- **Nothing grows in the water.** The forest generator guarded against Path and
  never against Water, so anywhere a stream ran out through the tree line it
  planted trunks mid-current — forty-eight of them in the meadow, unnoticed
  since Phase 4b.
- **The story's payoff arrives through a door the player already uses.**
  Levering the stone is a Phase 6 project, not a new verb invented for one
  moment — the player already knows how the board works, and a bespoke
  interaction used exactly once would announce itself as the ending.
- **A story-gated project is absent from the board, not greyed out.** Showing
  it locked would advertise that there is something left to find.
- **One thing stays unexplained.** Who asked is answered. Why the stone is warm
  is not, and will not be. A mystery that is fully accounted for stops being
  one, and the valley has been built on exactly three facts and no explanation
  since the first standing stone.
- **The stick floats and is analog.** A stick painted at a fixed spot is a
  stick you miss, and you miss it while something is walking towards you. The
  player's movement clamps to the unit circle rather than normalising the
  diagonal case, so pushing halfway walks at half speed for free.
- **Integer scaling only above 2x.** Under that there is no whole number worth
  taking, and rounding 1.44 down to 1 on a phone left the game sitting in the
  middle of the screen at half its width — a worse crime against the art than a
  fractional composite that a phone's pixel density makes invisible.
- **Input is gathered at the top of the frame.** The touch layer originally ran
  next to the HUD fade, which is after the checks that consume a press, so the
  bag button did nothing at all.
- **A held touch button is one press.** Clearing the held set every frame made
  a held button look like a fresh press sixty times a second, and the bag
  button opened and closed the satchel on alternate frames.
- **The stick zone is cut around the hotbar.** Without it the bar's left-hand
  slots sat inside the zone and tapping one started a thumb drag instead of
  choosing a tool.
- **Ambience runs in every branch.** The audio update lived inside the live
  branch, so an open conversation returned before reaching it and the ducking
  written to go underneath dialogue never ran while there was dialogue to duck
  under.
- **A duck you cannot hear is not a duck, and one you cannot hear past is a
  fault.** Measured at 13% and then at 85% before settling near 60%: the
  weather should step back, not disappear.
- **`touch-action: none`, or the phone eats the drag.** Without it the browser
  claims a finger drag as a pan gesture and fires `pointercancel` part-way
  through, and the thumbstick loses tracking the moment it starts working. This
  was the reason movement was unreliable on a real device, and it was invisible
  to every automated test because synthetic pointer events never go near the
  browser's gesture recogniser.
- **A cancel is not a release.** `pointercancel` means the system took the
  gesture — a scroll, a back-swipe, an incoming call. The contact is gone
  either way, but reporting it as a completed click fires the button underneath
  something the player never finished pressing.
- **The viewport is polled every frame, not waited for.** Mobile browsers do
  not reliably fire `resize` when the address bar collapses, and an orientation
  change often reports stale dimensions for a frame afterwards. Two float
  comparisons per frame cannot be missed.
- **The backing buffer is sized in device pixels.** A 960x540 buffer shown
  across 1280 device pixels is upscaled by the browser with smoothing, which is
  how a pixel-art game ends up soft on every modern phone while every
  screenshot on a desktop looks perfect.
- **Portrait asks rather than compromises.** The valley reads sideways. The
  honest options were to show half the map or to ask for the phone to be
  turned, so it asks, in the same paper and ink as everything else.
- **The pause menu ducks the valley, it does not mute it.** A hard cut to
  silence reads as a fault.
- **A version newer than this build is refused outright.** Reading it would
  silently discard whatever it knows that this build does not, and then write
  the loss back on the next autosave.
