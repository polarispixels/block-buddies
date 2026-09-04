# The Great Dinosaur Rescue — design (Ryan's spec "Dino Jungle 9-2", 2026-09-04)

Backlog #5. The HOW.

## Progression call

The spec wants the level to BEGIN with the pod crash straight out of the
station, so the rescue becomes **stage 1 of world 10** and the existing
Dino Jungle (dino key mission, Spinosaurus, golden star = the world win)
becomes stage 2: `10: ['jungle2', 10]`. The station's `worldWin(9)` → Space
→ `startWorld(10)` → the crash. The rescue ends in its own oversized
celebration (party overlay "JUNGLE HERO!" + the victory run + the candy
pile), and Space then `stageClear(10)` into the classic jungle, whose
crashed-pod decor still fits. Title resume works as for every chain.

## Files

- `js/dinoart.js` (`DINO_ART`): five baby dinos with moods, three adults,
  background herd/silhouettes, fruit + peels, footprints, nests, the bat,
  sound rings, the crash cinematic frames.
- `js/junglescene.js` (`JG_SCENE`): storm-damaged jungle backdrops and
  props, leaf/branch platforms, cave + crystals, bloom flower, water
  stream + valve, thorny vine wall (+burnt), fire patch, boulder/log
  barriers, nursery dressing, dino-run props, rainbow, candy pile.
- `js/rescue.js`: `BabyDino` (follower with kinds trike / longneck / anky /
  ptero / fire), `Follower` chain, the five `Rescue` stories, the
  `DinoRescue` machine on `lv.puzzle`, and `DinoRun` (a RideMode course on
  `lv.ride`) for the victory run; the crash and finale cutscenes.
- levels.js: LEVEL_META `'jungle2'`, WORLD_STAGES, the builder; game.js:
  cut delegation (`crash`, `finale`), party text + the party-Space
  `stageClear` hand-off for `'jungle2'`; entities.js: nothing new expected
  (vines, bouncers, one-way leaves, `puzzleBlock` bonks reused).

## Geometry (lv.w 17000, lv.h 2600, jungle theme, music `jungle`)

Hub floor **G = 1900**. Cave floor **C = 2380**. Canopy climbs to y≈500.

0. **Crash site** x 0–900: the wrecked pod (continuity), a damaged empty
   nest (five eggshell rings = five missing babies), storm debris.
1. **Nursery hub** x 900–2100: a clearing with five empty nest spots
   (ghost silhouettes, the mission-kit "what do I want" language); a pit
   at x≈1500 drops to the Echo Caves; the branches start right.
2. **Muddy River Trail** x 2100–4300 (ground G): footprints from the nest,
   a washed-out ford (shallow water, prints stop), then INDIRECT clues
   (shaken bushes with sparkle, muddy splashes, a broken plant, a
   triceratops call every 4 s from ahead); the baby trike stuck under a
   fallen log (a solid `weak: true` any fire shot breaks). RESCUE 1.
3. **Fruit Grove** x 4300–5800: three fruit trees (red apple, yellow banana,
   purple berry) each drop a following fruit on touch; the longneck on a
   ledge at 5500 with PURPLE peels scattered under it (observation). Wrong
   fruit: spit (apple, red tongue), sneeze storm (banana). Right: munch,
   hearts. RESCUE 2.
4. **Echo Caves** under the hub, x 900–4200 at C: three forks. At each, the
   true tunnel shows expanding sound rings drifting FROM the baby's
   direction every 1.6 s plus a faint call (`inhale` sfx low); wrong
   branches are short dead ends with candy and a hiccuping bat. The crystal
   chamber at the end: the anky asleep; three crystals (red/blue/yellow,
   `puzzleBlock` solids at bonk height) play a 3-note glow pattern; bonk
   them in the same order (the engine's `bumpBlock` → `lv.puzzle.onAnswer`
   is reused); a wrong bonk just replays the pattern (funny buzz). Two
   rounds (3 then 4) wake the anky. RESCUE 3.
5. **Broken Canopy** x 5800–8400, climbing: leaf one-ways, mushroom
   bouncers, two `Vine`s, a snapped branch bridge; a bamboo **water valve**
   (touch) redirects the stream onto a giant **bud** that blooms into a
   platform (solid appears) — the only way up the last gap; the ptero at
   the top on a broken branch, too scared to fly: a launch pad next to it
   (a super bouncer) — bounce, and it follows into a big loop around the
   screen, then joins. RESCUE 4.
6. **Volcanic Clearing** x 8400–10800: the fire baby penned by thorny vines;
   it turns to face Jack and BREATHES FIRE whenever Jack jumps or shoots
   within 400 px, burning the vine wall in front of it — and igniting a
   grass patch between (a `FireBreather`-style flame box hazard that
   lingers). A bamboo valve on a ledge pours water over the patch (steam,
   safe). Walk in: RESCUE 5. "The problem is the tool."
7. **The barrier** x 10800–11600 at G: a landslide — a giant log, boulders,
   a high branch lever, a hanging rope, a thorny curtain. Five marked spots
   (each a nest-style ghost of the baby that belongs there). Standing on a
   spot with that baby in the parade triggers its move: trike CHARGES the
   log, anky SMASHES the rocks, longneck pulls the high lever, ptero flies
   the rope up to the pulley, fire burns the curtain. Any order.
8. **Reunion + run** x 11600+: adults stomp in (`rumble`), babies run to
   them, roars, candy eruption, rainbow after the storm, blooms; Jack
   climbs onto the longneck adult → `DinoRun` (RideMode on `lv.ride`): a
   3000 px course of giant ramps, collapsing logs (obstacle things),
   bouncing plants (terrain bumps), candy trails, pteros overhead; the
   mega ramp → `launched` (mash for flips) → lands on the candy-pile
   platform at the end → +30 candy → party "JUNGLE HERO!" / "YOU BUILT A
   DINO TEAM!" → Space → `stageClear(10)`.

## Followers

`BabyDino` follows the previous member of the parade (chain), idles with a
little animation, teleports to Jack when > 800 px away (never lost),
reacts to candy pickups (hop) and to Jack's jumps (hop). The parade count
is the progress. The nursery gains a "home" copy of each rescued baby's
nest filled in (visual progress) while the baby itself parades.

## Kid rules

Every clue is visual (rings, sparkles, peels, ghost silhouettes, icon
bubbles). No reading. Wrong answers are jokes. Nothing missable: fruit
re-grows, the log stays broken, the pattern replays, valves stay turned,
the flame patch relights only if the vine curtain is intact. Checkpoints
at each region entrance and the chamber. Enemies: a few jungle vine
spiders far from puzzles only.

## Harness

The crash cinematic phases and skip; five rescues each ridden for real
(fire shot breaks the log; wrong fruit reactions then right fruit; the
cave rings point to the true tunnel, wrong bonk replays, right sequence
wakes; the valve blooms the platform, the launch pad rescues the ptero;
the fire breath burns the curtain and lights the patch, the valve
extinguishes); parade grows to five with home nests filled; the barrier's
five moves; reunion; the run (ramps, tricks, launch, landing, candy);
party → stageClear(10) → the classic jungle; stage resume from the title.
