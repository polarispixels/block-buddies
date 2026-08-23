# Sunken Temple 1-2 (v1.16.0) — compact plan

**Goal:** Underwater 1-2 "SUNKEN TEMPLE" (BACKLOG item 1): a large underwater temple of visible
cause-and-effect puzzles — valves toggle current streams, streams carry pearls, pearls fill clam
sockets, three completed wings wake the great stone door → treasure chamber + golden star.
Target ~10-15 min, 3 puzzle wings + finale. Executed inline (token-lean: design locked here, code
written once in the edits, no duplication).

**Entry:** `SubDoor(3880, 1130, 'water2', 'stagegate')` on Underwater World's seabed (clear of the
3650 swim spider's 3500-3800 roam and the 4015 gate). `LEVEL_META.water2 = { name: 'SUNKEN TEMPLE
1-2', theme: 'water', music: 'water' }`.

**Level ('water2'):** w 5200, h 1600 (auto vertical camera), all water, seabed top 1530, start
(90,1300). Approach (0-1300): candy, 2 swim spiders (the only enemies), checkpoint 1100. Then the
temple — no enemies, no hazards, nothing to lose (Zombie Town rule).

**Machine `SunkenTemple` (entities.js, on `lv.puzzle` — update/draw/drawBack hooks come free):**
- **Valves** (Space near one toggles; drawSpacebar hint when close; always reversible): A→zone `ca`,
  B1→`cb1`, B2→`cb2`, C→`cc`. Zones are ordinary `lv.currents` entries built `on:false` — player
  push, chevrons, and streaming bubbles all come from existing generic code.
- **Pearls** (3, light sink physics + current force + moveEntity; can never be lost — out of their
  bounds box → pop home): each targets its own clam **socket** (ghost-pearl silhouette = the
  established "what do I want" language); capture < 36px → latch forever, orb ignites.
- **Wings:** A (roofed seabed room 1350-2350): one valve → right current rolls pearl 1560→socket
  2160 — the lesson. B (top ledges 2450-3250): TWO valves — right current along a oneWay ledge, then
  pearl falls off the end into an up-shaft current that lifts it to a high socket; one valve alone
  visibly stalls it (funny, reversible). C (roofed room 3550-4640): rainbow shell switch pops a
  valve-membrane cage + left current carries pearl to socket — order-agnostic (valve first = pearl
  strains against the cage, then whooshes when the switch opens it).
- **Finale:** 3 orbs lit → glowing streams arc to the great door (solid `templeDoor`, skipDraw,
  machine-drawn slab with a sleeping stone face) → rumble, grind, door breaks, face wakes grinning,
  `lv.goalStar` set inside the sealed treasure room (candy hoard + 2 hearts visible through the
  walls the whole time = motivation) → generic subWin party/persistence/replay.

**Checks (~18, ridden for real):** door entry; machine shape; pearl rescue; valve A toggle on AND
back off; pearl A rides the current into socket A; wing B wrong-order stall then completion; wing C
valve-first pinned-pearl path then switch release; door breaks + star appears only after all 3;
star → party + `miniDone.water2`; exit restores Underwater World.

**Ship:** v1.16.0 (MINOR), CHANGELOG, docs (badge/footer/count, mini-games entry, level-1 row,
BACKLOG status → ✅ shipped), CLAUDE.md (id list + count), screenshots (wing A, wing B shaft, wing C
cage strain, open door + treasure), push, tag, live-verify.
