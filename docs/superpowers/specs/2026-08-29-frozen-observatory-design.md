# The Frozen Observatory (Mountain 3-2) — Design Spec

Approved by Ryan 2026-08-29 (structure: ascending terraces; finale: friendly
aliens wave; powers: fire + ice with one job each). Backlog item #3 — the
third step of the deliberate cognitive ladder: Sunken Temple (cause and
effect) → Weather Factory (systems & sequencing) → **Frozen Observatory
(multi-step spatial reasoning)**. Ships as v1.23.0.

## Concept

A mountaintop observatory with frozen machinery and a broken telescope. Jack
chases a beam of light up the mountain: three beam-puzzle terraces, each
solved by routing a visible light beam into a sensor crystal, each opening
the climb to the next, ending inside the summit dome where the grand
alignment fixes the telescope — and the Space Maze's friendly aliens wave
back through the lens.

## Progression hookup

- New chain stage id `'mountain2'` — LEVEL_META
  `{ name: 'THE FROZEN OBSERVATORY 3-2', theme: 'mountain', music: 'mountain' }`.
- `WORLD_STAGES[4] = [4, 'mountain2']`. World 4's star `Gate` (x=4700) is
  REMOVED and replaced with a stagegate `SubDoor(4700, 524, 'mountain2',
  'stagegate', { advance: true })` — the meadow2/cloud2 conversion pattern.
- `'mountain2'` is the chain's final stage, so its `lv.goalStar` →
  `game.worldWin(4)` comes free from the generic chain plumbing (unlock
  world 5, full party, stage progress reset). No changes to worldWin.
- `ffbg_stage` resume, title medallions, and party chain all work unchanged.

## Level shape

- Tall diagonal level: `lv.w ≈ 3600`, `lv.h ≈ 2200` (vertical/diagonal
  camera is automatic for `lv.h > H`). Entry bottom-left on the summit
  trail; the dome at the top.
- Mountain theme + night-leaning decor (pines, peaks); NO enemies (like
  Temple/Factory, the challenge is thinking). No fall hazard concerns —
  terraces are wide ground ledges; any drop lands on a lower terrace.
- Checkpoint on every terrace (hearts refill). Solid-ceiling rule audited:
  every landable surface on the climb is one-way; terrace undersides sit
  above jump apex (rise 148) from any standable spot beneath.

## The beam kit (`js/beams.js` — new file, reusable)

New script in load order between `ride.js` and `levels.js`. Must be added to
the script lists in `index.html`, `sw.js` (cache list), `test/harness.js`
(file loader), and `tools/screenshot.sh` (inline HTML template).

Pieces (all config-driven, owned by a `FrozenObservatory` machine on
`lv.puzzle`, following the WeatherFactory pattern — `update(dt, pl)`,
`draw(ctx)`, `drawBack(ctx, t)`):

- **Lantern** — a crystal light source; emits a beam in a fixed direction.
- **Mirror** — a big friendly-faced disc on a post; 8 orientations (45°
  steps). Reflects the beam per its facet. **Verb: the established bonk** —
  jump-bump its underside solid (`puzzleBlock`-style head-hit routing, like
  Puzzle Blocks answer blocks) → clunk + 45° clockwise spin + face whirl.
  Cycles forever; every wrong aim is reversible by more bumps.
- **Frozen mirror** — starts encased in an ice crust with a shivering face;
  cannot rotate. One FIRE projectile thaws it (steam poof, relieved face) —
  permanent. Uses the standard machine projectile-hit pattern
  (`game.projectiles`, `pr.hitSet`, `pr.kind === 'fire'`, `pr.impact(true)`).
- **Steam vent** — puffs a plume that scatters any beam crossing it into
  harmless sparkles (the beam visibly stops there). One ICE projectile
  freezes it into a cute ice sculpture — permanent latch.
- **Sensor crystal** — lights + latches forever when a beam lands on it
  (WeatherFactory bulb rule: progress can never be lost). On latch, fires
  the terrace's reward (thaw a staircase / extend a ledge, via solids pushed
  into `lv.solids` like the Factory's stalk leaves).
- **Beam** — recomputed every frame by a simple segment raycast from each
  lantern: travels straight, reflects at correctly-faceted mirrors, stops at
  solids, active steam plumes, or misaligned mirrors (with a giggling
  sparkle-sizzle at the stopping point — wrong aims are funny, not
  punished). Always drawn as a glowing line so cause-and-effect is instant.

Beam geometry stays axis-aligned + 45° diagonals only (8 directions) — the
spatial reasoning is in the routing, not in protractor precision.

## The terraces (one new idea each)

1. **Teach** (bottom): lantern → one free mirror → sensor. Bump until
   aligned → sensor lights → a frozen staircase thaws step by step, opening
   the climb. One mirror, zero powers: pure learn-the-verb.
2. **Thaw + route**: two mirrors — one frozen (FIRE pickup placed right
   beside it) — chaining the beam around a rock overhang to the sensor.
3. **Full chain**: three mirrors (one frozen) + a steam vent squarely in the
   only beam line. Both FIRE and ICE pickups present on this terrace (either
   order works: all elements latch, powers are held permanently until
   swapped, so no sequence can soft-lock).
4. **Dome (finale)**: the grand alignment — two mirrors + one vent + one
   frozen mirror route the summit lantern's beam into the telescope's eye.
   Both pickups available in the dome as well.

## Finale

Beam enters the telescope → `game.cut = { name: 'telescope', t: 0 }`
(handled in `updateCut`, input frozen): dusk falls over the summit (gentle
darkness fade via the existing overlay), the dome opens, the telescope
swings toward a twinkling green planet, the lens iris fills with saucer
aliens (Space Maze art) waving back — then they beam a gift down the light
beam: the golden star lands in the dome (`lv.goalStar` set) + candy burst.
Star collect → `worldWin(4)` → party → world 5 unlock, exactly as today.

## Art (contact-sheet rule applies)

New procedural art: mirror disc + post (8 orientations readable at a
glance), ice crust w/ shivering face, steam vent + plume + ice sculpture,
lantern, sensor crystal (off/lit), the telescope + dome, the lens view
(planet + waving aliens — reuse space alien drawing). Every piece verified
via `tools/screenshot.sh` at in-game size before ship.

## Testing (harness — ride everything for real)

- World 4: archway replaces the gate; walking in fires `stageClear` →
  mountain2 loads as a full level. Existing world-4 gate checks updated.
- Mirror: bump-rotate through all 8 orientations and back to start
  (reversibility); bump does nothing while frozen; a real fired fireball
  thaws it; a real iceball freezes a vent; both latch across death/respawn.
- Beam raycast: sensor lights exactly when the route is truly aligned, and
  un-aims do NOT unlight it (latch).
- Traversal: really ride each terrace's reward route (no teleporting past a
  leg — the Cloud Climb lesson); solid-ceiling audit on the climb.
- Finale: aligned dome beam → telescope cutscene → goalStar → worldWin(4)
  → world 5 unlocked → party advances; title resume at furthest stage.
- Version/docs/backlog sync; harness run 2-3×; screenshots reviewed.

## Out of scope

New enemies, new music, Big Buddy blocks, beam colors/mixing (one white-gold
light), non-45° angles, movable lanterns. The beam kit is written so a later
level COULD reuse it (config in, no observatory specifics in the raycast),
but no second user ships now.
