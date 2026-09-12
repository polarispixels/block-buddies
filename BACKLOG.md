# Block Buddies — Puzzle & Long-Level Backlog

This file is the **single source of truth** for what gets built next. It is a
design document, not a ticket queue: each item carries enough intent for a full
release spec. Maintenance rules:

- Update the **Status board** below in the same commit as each release.
- When an item ships, mark it `✅ shipped vX.Y.0` and add one line on what
  actually got built (link the CHANGELOG entry for detail).
- New ideas get appended as numbered items; re-ordering the recommended
  sequence is a deliberate, discussed change.
- Playtest notes may arrive as GitHub issues (filed from Ryan's phone); fold
  them into the relevant item here during planning, then close the issue.
- `docs/index.html` links here and no longer duplicates backlog content.

## Status board

| # | Item | Type | Status |
|---|------|------|--------|
| 1 | Underwater 1-2: The Sunken Temple | Stage 2 | ✅ shipped v1.16.0 — valve→current→pearl→socket chains across three any-order wings (one-valve lesson, two-valve up-shaft, shell-switch cage), waking stone door, treasure chamber; pearls unlosable, everything reversible (see CHANGELOG 1.16.0) |
| 2 | Cloud 2-2: The Weather Factory | Stage 2 | ✅ shipped v1.17.0 — six levers, four island stations spread across a 7600px sky (rain→bloom→stalk stairway, wind→windmill→POWER cable feeding freezer + sun lamp, rain+cold+power→snowman, rain+sun+power→rainbow bridge), star alone on a far island (see CHANGELOG 1.17.0) |
| 3 | Mountain 3-2: The Frozen Observatory | Stage 2 | ✅ shipped v1.23.0 — reusable light-beam kit (`js/beams.js`: raycast, bump-rotate redirector dishes, fire-thaw ice crusts, ice-freeze steam vents, latching sensor gems) + a 3600×2200 three-terrace beam-routing climb (chain stage `4: [4, 'mountain2']`) ending in the dome's grand alignment; telescope cutscene: the Space Maze aliens wave back and gift the world star (see CHANGELOG 1.23.0) |
| 4 | Space 8-2: The Alien Space Station | Stage 2 | ✅ shipped v1.27.0 — chain `9: [9, 'space2']`; the Black Hallway (darkness director, ambush alien spiders, web traps), the reusable PowerGrid kit (`Battery`/`Socket`/`Machine`: door, elevator, gravity, bridge, vending, hologram, hand, robot, fan, laser, magnet), the shielded Giant Spider spider-factory boss beaten by battery machines, the candy storm, the escape-pod cinematic crash-landing into Dino Jungle (see CHANGELOG 1.27.0) |
| 5 | Dino Jungle 9-2: The Great Dinosaur Rescue | Stage 2 | ✅ shipped v1.28.0 — as stage ONE of world 10 (`10: ['jungle2', 10]`, so the pod crash opens it): the crash cinematic, a storm-damaged semi-open jungle, five distinct rescues (evidence trail, fruit matching, echo rings + crystal pattern, canopy bloom climb, fire-breather cause-and-effect), the following parade, the five-baby landslide teamwork, the reunion, and the T-rex victory run onto the candy pile (see CHANGELOG 1.28.0) |
| 6 | Monster Truck 6-2: Junkyard Bridge Builders | Stage 2 | 🎯 next up |
| 7 | Lava 5-2: Magma Cooling Works | Stage 2 | idea |
| 8 | Unicorn Forest 7-2: The Enchanted Garden | Stage 2 | idea |
| 9 | New World: The Toy Factory | Major World | idea |
| 10 | New World: The Clockwork Castle | Major World | idea (save for a major release) |
| 11 | Letter Blocks: Beginning Letters | Puzzle Blocks mode | ✅ shipped v1.18.0 — reusable picture-prompt framework (word bank, puzzle controller, `ExitDoor` primitive) + first instance in Block Meadow: missing-first-letter, candy reward (see CHANGELOG 1.18.0). Second iteration v1.19.0 after kid playtest: all icons redrawn with contact-sheet review, word bank 20 → 60 (see CHANGELOG 1.19.0) |
| 12 | Puzzle Blocks framework formalization | Framework | ✅ shipped v1.19.1 — engine/mode split in `js/puzzleblocks.js` (`PuzzleBlocksMachine` generic engine; Letter Blocks becomes its first mode), framework backlog documented below (see item 11 of the doc sections + `docs/superpowers/specs/2026-08-29-puzzle-blocks-framework.md`) |
| 13 | Ending Letter Blocks ("CA_") | Puzzle Blocks mode | ✅ shipped v1.22.0 — `EndingLetterBlocksMachine` (mode #3, a content table + ~20-line config on the untouched engine, proving prompt-structure reuse); 38-word `EL_WORDS` bank with crisp single-letter endings, 100% reused kid-verified icons (zero new art); cloud-themed room off Cloud World's start platform via a press-gated rainbow door (see CHANGELOG 1.22.0) |
| 14 | Number Blocks: Count the Objects | Puzzle Blocks mode | ✅ shipped v1.24.0 — `CountBlocksMachine` (mode #4, the first QUANTITY BLOCKS mode) on the untouched engine (+ an opt-in `holdTime`); shared numeric helpers (`QB_OBJECTS`, `qbLayout` row/rows/arc/scatter, `qbDrawGroup`/`qbDrawNumeral`/`qbDrawSlot`) ready for numeral→quantity, more/fewer, missing number, +/−; invisible per-visit ladder 1-3 → 5-10 objects with closing choices; count-up with number badges; bonus party every fifth solve; mountain-themed 'countblocks' room off Mountain World's start flat; 27 reused icons + new dino and bunny (see CHANGELOG 1.24.0) |
| 15 | Pattern Blocks (RED/BLUE/RED/BLUE/?) | Puzzle Blocks mode | ✅ shipped v1.21.0 — `PatternBlocksMachine` (complete-the-color-pattern, no reading) debuts inside the Desert Sand Slide, 3 rounds free the boogie board; a standalone replayable room can reuse it any time |
| 17 | Desert Sand Slide + Ride Mode framework | Stage + framework | ✅ shipped v1.21.0 — world 6 opens with 'sandslide' (chain `7: ['sandslide', 7]`): pattern puzzle → boogie board → procedural heightfield ride (js/ride.js: RideMode/RideCourse/SandSlide) → 5 truck parts → victory run → mega-ramp into the rally's delivered ceremony (see CHANGELOG 1.21.0) |
| 19 | Ocean Surf (surfboard ride + Kraken) | Sublevel | ✅ shipped v1.26.0 — Ride Mode's second instance: five escalating surf phases (waves, sharks, red ramps, chests, the monster-truck pirate boat with aimed cannonballs and rams), the surf-along Kraken befriended with the re-spawning rainbow block, and the oversized victory (boat flung, hero launched sky-high with the camera following, island, giant chest, +100 candy); off Underwater World via a surfboard door (see CHANGELOG 1.26.0) |
| 18 | Rainbow Spider Flower Land (Jack's level) | Sublevel | ✅ shipped v1.25.0 — Jack's own storybook designed with a planning agent: mushrooms → giant rainbow spiders grow and smash flowers → key → secret door → sleepy guards → flower person → magic flying hat → rainbow castle + bubble dragon → giant cloud → pirate captain + robot race → gold → surprise party; off Block Meadow 0-2 via a flower door (see CHANGELOG 1.25.0) |
| 16 | Linear world chains | Flow/framework | ✅ shipped v1.20.0 — worlds are ordered stage lists (`WORLD_STAGES`); stage archways end stages with a light STAGE CLEAR beat, final-stage stars complete the world (full party + unlock), `ffbg_stage` title resume; spec in `docs/superpowers/specs/2026-08-29-linear-world-chains-design.md` (see CHANGELOG 1.20.0) |
| 20 | Junkyard Block Bash | Arcade Mode #1 | ✅ shipped v1.29.0 — Breakout through Block Buddies: the truck as paddle, Bouncy Buddy ball, 10 block kinds, 7 power-up capsules, 4 surprise events, 4 escalating never-stall waves, the 12-hp JUNKBOT finale (4 parts, 3 attack stages) and its 100-candy victory shower, off a press-gated arcade cabinet (x=280) at the Monster Truck Rally's start; debuts the reusable `js/arcade.js` kit (`Mods`/`WaveRunner`/`Sequence`/`Spawner`/`ArcadeHud`/payout) and the `lv.arcade` engine slot (see CHANGELOG 1.29.0) |
| 21 | Blaster Run (fast shooting: move, jump, shoot targets at heights) | Arcade Mode #2 | 🎯 next arcade release |
| 22 | Planet Blocks: biggest / smallest / most / fewest moons | Puzzle Blocks mode | ✅ shipped v1.30.0 — `PlanetBlocksMachine` (mode #5, the first COMPARISON mode), the planets themselves are the answer blocks via new opt-in `blockSize`/`drawBlock` engine hooks; press-gated planet hatch on the Space Maze's start-pocket floor (see CHANGELOG 1.30.0) |
| 23 | World Map layer | Flow/framework | ✅ shipped v1.31.0 — a reusable, data-driven star-chart screen (`js/worldmap.js`, `game.state === 'map'`) between the title and a world's destinations, Space World first: `WORLD_MAPS[w]`/`MAP_THEMES[theme]` data + art, `MapProgress` on the additive `ffbg_map` key (unlocked/discovered/completed/last-played, inferred once from legacy saves), the `WorldMap` controller (rocket cursor, launch, reveal-with-confetti), touch hold-to-return button; other biomes need only their own `WORLD_MAPS`/`MAP_THEMES` entry to get a map (see CHANGELOG 1.31.0) |

Shipped precursors for context: Secrets Pack II (v1.10.0), Jungle Treehouse
Trail (v1.11.0), Pit Stop Beat Bash (v1.12.0), Zombie Town After Dark
(v1.13.0, Jack's own concept), Big Buddy growth system (v1.14.0), Block
Meadow 0-2 — the first Stage 2 (v1.15.0).

---

## Direction

For the next phase of Block Buddies, emphasize:

* Longer levels
* More puzzles
* More cognitive problem solving
* Cause-and-effect reasoning
* Multi-step problem solving
* Exploration and discovery
* Reusable mechanics that can appear in later levels

Keep the existing Block Buddies design philosophy:

* No reading required where possible
* Teach through visual feedback and experimentation
* Wrong answers should be reversible and preferably funny
* Avoid punishing failure
* Preserve simple controls
* Favor playful characters and environmental storytelling
* Let Jack discover how systems work instead of explaining them

## Level Size Model

Use three general content sizes going forward.

| Type               | Typical Playtime | Purpose                                       |
| ------------------ | ---------------: | --------------------------------------------- |
| Secret / Mini-game |          2–5 min | Surprise, novelty, experimental mechanics     |
| Stage 2            |         8–15 min | Larger adventure using an existing world      |
| Major World        |        15–25 min | New biome with several interconnected systems |

For the next several releases, prioritize **Stage 2 expansions**.

Do not judge level size only by horizontal pixel length. Backtracking, hubs,
multiple rooms, interconnected puzzles, and changing environments can create a
much larger-feeling adventure.

---

# Priority Backlog

## 1. Underwater 1-2: The Sunken Temple

**Priority: Highest**

Create a large underwater temple built around visible cause-and-effect puzzles.

Possible mechanics:

* Water valves
* Redirectable currents
* Pipes
* Pearls that can be moved by water
* Pressure plates
* Gates
* Multiple temple wings connected to a central chamber

Example puzzle chain:

```text
Turn valve
→ current reverses
→ pearl moves
→ pearl lands on switch
→ gate opens
```

Later puzzles should combine multiple mechanisms.

Possible finale:

Jack completes several temple wings, causing glowing water streams to activate
a giant stone creature or temple doorway that opens into a treasure chamber.

**Target:** Approximately 10–15 minutes with 3–5 meaningful puzzle regions.

---

## 2. Cloud 2-2: The Weather Factory

Create a strange factory above the clouds where weather is manufactured.

Possible systems: rain, wind, snow, sunlight, clouds, rainbows, giant fans,
weather machinery.

Teach simple relationships visually:

```text
Water + Cloud → Rain
Rain + Sun → Rainbow
Rain + Cold → Snow
```

Jack eventually needs to create different weather conditions for different
parts of the level. Examples:

* Rain for flowers
* Wind for a windmill
* Snow for a snowman
* Rainbow to activate the final route

Focus on **systems thinking and sequencing**.

---

## 3. Mountain 3-2: The Frozen Observatory

Create a mountaintop observatory with frozen machinery and a broken telescope.

Primary new mechanic: **rotatable mirrors and visible light beams**.

Possible puzzles:

* Rotate mirrors to redirect light
* Hit crystals or sensors
* Use Fire to melt frozen machinery
* Use Ice to freeze or stop moving mechanisms
* Route one beam through several mirrors
* Eventually align several systems to activate the telescope

This should introduce more advanced spatial reasoning while remaining visual
and experimental.

---

# Additional Backlog Ideas

## 4. Space 8-2: The Alien Space Station

Jack finds an abandoned alien station with no power.

Primary mechanic: **movable energy cells**. Energy cells can power doors,
elevators, gravity, conveyors, energy barriers, and other machinery.

Do not provide enough energy to power everything simultaneously. Jack must
decide where each battery is currently needed and occasionally remove a
battery from one system to power another.

Focus on: resource allocation, planning, route logic, cause and effect.

Possible ending: restore the entire station and wake friendly sleeping aliens.

---

## 5. New World: The Toy Factory

A giant whimsical factory that manufactures toys and blocks.

Possible mechanics: conveyor belts, sorting switches, paint machines, stamping
machines, springs, boxes, wind-up robots.

Begin with simple sorting:

```text
Red object → red chute
Blue object → blue chute
```

Progress toward transformations:

```text
Blue block → paint machine → red block → red destination
```

Later puzzles can combine color, shape, sequence, transformation, and routing.

Wrong solutions should generate ridiculous defective toys instead of punishing
the player.

---

## 6. Lava 5-2: Magma Cooling Works

King Magma's volcanic machinery has broken.

Use existing Fire and Ice abilities for environmental puzzles rather than
combat. Possible interactions:

* Ice turns lava into temporary stone
* Fire melts frozen gears
* Ice stops steam vents
* Fire melts ice plugs
* Released water cools lava
* Water + lava creates permanent stone

Focus increasingly on **order of operations**. Example:

```text
Freeze lava
→ reach valve
→ release water
→ melt ice barrier
→ water reaches lava
→ permanent bridge forms
```

---

## 7. Monster Truck 6-2: Junkyard Bridge Builders

The road ends inside a giant junkyard. Jack must build sections of the route
before driving across them.

Possible movable pieces: short ramps, long ramps, bridge sections, tires,
crates, platforms.

Use constrained construction rather than a full sandbox system. The gameplay
loop should alternate:

```text
Explore → understand obstacle → choose pieces → build solution → drive across
```

Occasionally provide an extra piece that does not belong in the solution.

---

## 8. Unicorn Forest 7-2: The Enchanted Garden

A magical garden has stopped blooming. Build the level around interconnected
character and environmental dependencies. Examples:

```text
Flower needs water
→ bee needs flower
→ another plant needs bee
→ plant opens path
```

Possible participants: bees, butterflies, flowers, vines, friendly creatures,
water channels.

The environment should visibly become healthier and more colorful as Jack
solves problems.

Focus on: classification, dependencies, multi-step reasoning, helping
characters.

---

## 9. Dino Jungle 9-2: The Great Dinosaur Rescue

A storm has scattered several baby dinosaurs around a large prehistoric area.
Each dinosaur should require a different reasoning problem rather than simply
being collected. Examples:

* Follow footprints that disappear at a river
* Find the specific fruit shown in a dinosaur's thought bubble
* Create noise to wake a dinosaur blocking a route
* Find a way around or neutralize a fire-breathing dinosaur
* Interpret environmental clues

Structure this as a long **detective/adventure level**.

Focus on: observation, memory, deduction, character interaction, exploration.

---

## 10. New World: The Clockwork Castle

Save this for a major future release.

Create a large castle where the entire environment functions as one
interconnected machine. Possible mechanics: gears, levers, counterweights,
rotating staircases, moving towers, bells, clock hands, bridges, mechanical
doors.

Individual systems should be introduced separately before being combined.
Example progression:

```text
Move counterweight
→ raise bridge
→ reach gear room
→ rotate tower
→ align doorway
→ reach clock mechanism
```

The final puzzle should make the player understand that multiple earlier
systems are parts of one giant machine.

**Target:** 15–25 minutes.

---

## 11. Puzzle Blocks Learning Framework

(Full spec verbatim from Ryan: `docs/superpowers/specs/2026-08-29-puzzle-blocks-framework.md` —
this section is the working summary.)

**Puzzle Blocks** is the general system; **Letter Blocks** (shipped v1.18–v1.19)
is its first mode. The validated core loop stays fixed while the cognitive task
changes:

```text
Prompt → physical answer blocks → move/jump/bump → feedback → candy → next puzzle
```

The goal is to hide learning, reasoning, memory, and problem-solving inside
normal Block Buddies gameplay — never to make it feel like educational
software. The child should always feel like they're playing Block Buddies.

**Design principles** (all modes): gameplay first (answers live physically in
the world — no radio buttons, worksheets, menus, or score screens); familiar
mechanic with changing mental challenge; low punishment (wobble + funny sound,
never candy loss/damage/timers/game-over); strong reward loop (flying answers,
completed words/equations, candy through the normal economy); indefinite
replay with shuffled pools and voluntary exit; visual clarity (large art, one
obvious interpretation per picture).

**Architecture** (since v1.19.1): `js/puzzleblocks.js` separates
- *engine* — `PuzzleBlocksMachine`: pool shuffle/no-repeat, selection,
  lock/cooldown, retries, fly/hold transitions, reward hook, physical block
  solids;
- *type/mode* — a config object defining interaction semantics (round
  generation, prompt rendering, choice rendering);
- *content* — data tables like `LB_WORDS`.
Extend the engine only when a real mode needs it (the multi-step/ordered-answer
architecture for Build-the-Word and Sequence Blocks is explicitly deferred).
Planet Blocks (v1.30.0) added the engine's first such extension: opt-in
`mode.blockSize(value)`/`mode.drawBlock(ctx,value,x,y,w,h,info)` hooks so a
mode's answer solids can be object-shaped (sized/drawn per round) instead of
a generic tile — the four earlier modes are untouched by it.

**Mode backlog** (families; see spec for full detail):
- **A. Letters/phonics**: A1 beginning ✅ · A2 ending ✅ (v1.22.0) · A3 middle (vowels) ·
  A4 beginning sound (image-only) · A5 whole-word match · A6 rhyming ·
  A7 word families · A8 build-the-entire-word (multi-step, future)
- **B. Vocabulary/classification**: categories (animal/food/vehicle...) ·
  finer categories · opposites · descriptive ("WHAT COLOR?")
- **C. Numbers** (proves it's not just literacy): count objects ✅ (v1.24.0) ·
  numeral ↔ quantity · simple +/− · biggest/smallest ✅ (C5, v1.30.0, shipped
  as biggest/smallest/most/fewest moons) · missing-number sequences
- **D. Shapes/spatial**: identify · match-by-shape-blocks · above/below/beside
- **E. Patterns** (high priority — reasoning, no reading): alternating · shape ·
  growing · AAB-style
- **F. Logic**: odd one out · what belongs together · cause & effect ·
  what happens next
- **G. Sequences** (multi-step, future): life cycle · daily routine · story order
- **H. Memory** (short + forgiving): remember picture / number / sequence

**Biome fits**: Meadow = beginning letters, colors, counting (current room fits) ·
Underwater = counting fish, more/fewer, sea categories · Cloud = ending letters,
weather words, patterns · Mountains = shapes, spatial, ordering · Dino Jungle =
animal names/sounds/categories · Weather Factory = the standout: cause-and-effect
puzzles reinforcing what the level already shows physically ("WHAT MAKES ICE
MELT?") · Zombie Town = playful rhymes, night/day, memory.

**Progression philosophy** (invisible to the player, no curriculum): recognition
→ association → pattern recognition → reasoning → multi-step thinking.

**Next three builds** (chosen to prove framework breadth):
1. **Ending Letter Blocks** — cheapest extension, tests prompt-structure reuse.
   ✅ shipped v1.22.0.
2. **Number Blocks: Count the Objects** — first non-literacy mode; numeric
   answers, multi-object prompts. ✅ shipped v1.24.0 as COUNTING BLOCKS, the
   first Quantity Blocks mode (shared numeric helpers for the C family).
3. **Pattern Blocks** — reasoning with zero reading required; visual choices.
   ✅ shipped v1.21.0 (debuted inside the Desert Sand Slide).

**Never build** (protect "the child wants to play"): lessons, dashboards,
grades, parent reporting, timers, skill trees, XP, adaptive-learning engines,
required exercises, separate educational currencies.

---

## 12. Arcade Mode

**Arcade Mode** is a new track, parallel to the Stage 2 chain and the Puzzle
Blocks framework: short (3-5 min), fast, replayable arcade-cabinet levels
reached through a press-gated `SubDoor` on an existing world, built on a
shared reusable kit (`js/arcade.js`) rather than one-off level code. Junkyard
Block Bash (item 20, ✅ shipped v1.29.0) is instance #1.

**The kit** (`js/arcade.js`, no knowledge of any one cabinet's rules):
`Mods` (timed modifiers with expiry callbacks — stack freely), `WaveRunner`
(an ordered build → play → clear wave state machine with a par-time stall
hook so a session can never grind to a halt), `Sequence` (timed-step
intros/victories), `Spawner` (interval+jitter event scheduling), `ArcadeHud`
(banners, world/screen pops, timer-ring modifier chips), and
`arcadePayout`/`arcadePayTick` (a frame-rate-independent rolling candy
payout). The engine side is one new slot, `lv.arcade`, mirroring `lv.puzzle`:
`Player.update` hands off to it entirely (the cabinet owns the hero, no
gravity/ramp/turbo code runs) and a matching `lv.touchLayout` swaps the
touch controls to whatever the cabinet needs.

**What Block Bash proved**: the two house rules generalize cleanly —
*misses are comedy and nothing ever resets* (a lost ball/life just respawns;
progress, active modifiers, and boss hp all persist), and *a session can
never stall* (a never-stall par-time assist plus a one-shot boss droop kept
every simulated playthrough — even a deliberately clumsy 40%-wrong-input
policy — finishing well inside its ceiling, with zero flakes across repeated
harness runs). Both are cheap, generic guarantees any future cabinet should
keep.

**Item 21 sketch — Blaster Run** (fast shooting: move, jump, shoot targets at
heights) reuses `WaveRunner` for escalating target waves, `Spawner` for
target pop-up timing, `Mods` for timed power-ups (rapid-fire, spread shot,
giant targets), and `ArcadeHud` for the banner/combo/chip presentation —
the same skeleton Block Bash used, with a side-scrolling-gallery ruleset
instead of a Breakout one: the hero moves along a rail, jumps to reach
high targets, and shoots (Space/★) at silly junkyard targets popping up at
varied heights (low crates, mid-height tires, high hubcaps needing a jump-
shot), with a moving/rotating target introduced mid-run the way Block Bash
introduced runners and conveyors mid-wave. A boss cabinet-topper (a bigger
target array, or a boss that pops multiple weak points) closes it out the
way JUNKBOT closes Block Bash.

**Candidate #3s** (pick after Blaster Run ships, to keep proving kit
breadth rather than overfitting to one genre):
- **Whack-a-Mole Junkyard** — a `Spawner`-driven grid of pop-up targets
  (moles → junk critters) with escalating pop/retreat timing; tests the kit
  against a fundamentally different input shape (tap-where-it-is rather
  than move/aim).
- **Claw Machine Candy Grab** — reuses the crane-magnet feel from Block
  Bash's snatch event as the whole game: steer a claw, drop, grab, deposit,
  against a `WaveRunner`-style escalating prize board.
- **Junkyard Kart Sprint** — a short lap-based `RideMode`/Arcade Mode
  crossover (steering + a boost `Mod`) if a faster, more literally
  "arcade" racing beat is wanted alongside Blaster Run's shooting-gallery
  beat.

## 13. World Map Layer

**World Maps** (item 23, ✅ shipped v1.31.0) is a new reusable screen —
a data-driven star chart between the title and a world's destinations —
built the same three-layer way as Puzzle Blocks and Arcade Mode: DATA
(`WORLD_MAPS[w] = {theme, nodes, paths}`), PROGRESS (`MapProgress`, one
additive save key `ffbg_map`, legacy saves inferred once), SCREEN
(`MAP_THEMES[theme]` art + the `WorldMap` controller on `game.state ===
'map'`). Space World is the first instance: 8-1 Space Maze and 8-2 Alien
Space Station as required stage nodes, the Zero-G Star Chamber and Planet
Blocks as optional nodes that stay hidden until Jack finds their doors
inside the maze (which keep working exactly as before).

**Other biomes can now define a map too** — a new `WORLD_MAPS[w]` entry
(nodes, paths, unlock `requires`) plus a matching `MAP_THEMES[theme]` (art
for `drawBG`/`drawNode`, an optional `drawCursor`, `music`) is the whole
hookup; the `WorldMap` controller and all the flow wiring (`game.startWorld`
opening the map, `game.mapReturn`/`returnToMap`, the party/Escape/exitSub
hooks, the touch hold-to-return button) is already generic. A natural next
candidate is any world that grows a third stage or a cluster of optional
secret rooms worth surfacing on one screen.

---

# Recommended Development Order

1. **Underwater 1-2: The Sunken Temple** — ✅ shipped
2. **Cloud 2-2: The Weather Factory** — ✅ shipped
3. **Mountain 3-2: The Frozen Observatory** — ✅ shipped
4. Alien Space Station — ✅ shipped
5. Great Dinosaur Rescue — ✅ shipped
6. Junkyard Bridge Builders — 🎯 next up
7. Magma Cooling Works
8. Enchanted Garden
9. Toy Factory
10. Clockwork Castle

Running alongside this Stage 2 order as a separate track: **Arcade Mode**
(item 12) — Junkyard Block Bash shipped v1.29.0 as #1, Blaster Run is next.
The two tracks share no content and can be worked in either order relative
to each other.

The first three should intentionally increase cognitive complexity:

```text
Sunken Temple — cause and effect
        ↓
Weather Factory — systems and sequencing
        ↓
Frozen Observatory — multi-step spatial reasoning
```

## General Implementation Guidance

These are concepts, not rigid specifications. The coding agent should:

* Review the current architecture and docs before implementation
* Reuse existing mechanics where appropriate
* Introduce reusable systems rather than highly specialized one-off code
* Make reasonable decisions about exact layout, art, timing, difficulty, and
  implementation
* Preserve current controls and game feel
* Avoid unnecessary UI or explanatory text
* Update documentation, version information, and backlog status after each
  completed release

The primary objective is to evolve Block Buddies from a sequence of
platforming challenges into a game where exploration and movement increasingly
lead to **thinking, experimentation, discovery, and satisfying problem
solving**.
