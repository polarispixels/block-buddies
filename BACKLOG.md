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
| 3 | Mountain 3-2: The Frozen Observatory | Stage 2 | 🎯 next up |
| 4 | Space 8-2: The Alien Space Station | Stage 2 | idea |
| 5 | Dino Jungle 9-2: The Great Dinosaur Rescue | Stage 2 | idea |
| 6 | Monster Truck 6-2: Junkyard Bridge Builders | Stage 2 | idea |
| 7 | Lava 5-2: Magma Cooling Works | Stage 2 | idea |
| 8 | Unicorn Forest 7-2: The Enchanted Garden | Stage 2 | idea |
| 9 | New World: The Toy Factory | Major World | idea |
| 10 | New World: The Clockwork Castle | Major World | idea (save for a major release) |
| 11 | Letter Blocks: Beginning Letters | Educational mini-game | ✅ shipped v1.18.0 — reusable picture-prompt framework (`js/letterblocks.js`: word bank, `LetterBlocksMachine` puzzle controller, `ExitDoor` primitive) + first instance in Block Meadow: missing-first-letter, candy reward (see CHANGELOG 1.18.0). Second iteration v1.19.0 after kid playtest: all icons redrawn with contact-sheet review, word bank 20 → 60 (see CHANGELOG 1.19.0) |

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

# Recommended Development Order

1. **Underwater 1-2: The Sunken Temple**
2. **Cloud 2-2: The Weather Factory**
3. **Mountain 3-2: The Frozen Observatory**
4. Alien Space Station
5. Great Dinosaur Rescue
6. Junkyard Bridge Builders
7. Magma Cooling Works
8. Enchanted Garden
9. Toy Factory
10. Clockwork Castle

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
