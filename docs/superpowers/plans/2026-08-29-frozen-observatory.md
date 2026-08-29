# Frozen Observatory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Mountain 3-2 "The Frozen Observatory" (v1.23.0): a beam-routing puzzle chain stage with a reusable light-beam kit, converting world 4 to a linear chain.

**Architecture:** New `js/beams.js` holds the reusable beam kit (8-direction raycast, redirector mirrors, vents, sensors) and the `FrozenObservatory` machine (attached as `lv.puzzle`, WeatherFactory pattern). `js/levels.js` gains the `'mountain2'` stage and the world-4 gate→archway conversion. `js/game.js` gains the `'telescope'` cutscene. Zero build step, zero assets — all procedural.

**Tech Stack:** Plain browser JS (shared globals, script-tag load order), `test/harness.js` node-vm smoke test, `tools/screenshot.sh` for visuals.

**Spec:** `docs/superpowers/specs/2026-08-29-frozen-observatory-design.md`

## Global Constraints

- Zero build step / no ES modules / no npm deps; `file://` must keep working.
- No asset files — procedural canvas art + WebAudio only; faces on everything; no gore.
- Design for a 5-year-old: icons not text, reversible mistakes, latching progress, no soft-locks.
- Every landable surface on the climb is one-way; permanent solids sit outside jump reach of standables beneath (jump rise 148) or are walk-under tunnels off jump routes.
- Fire/ice targets get ground-level hitboxes (projectiles fire at wheel height) and harness checks that FIRE REAL projectiles.
- Harness must print `ALL CHECKS PASSED` 2-3× consecutively; screenshots reviewed by eye.
- Release = bump `GAME_VERSION` to 1.23.0 + CHANGELOG entry + docs badge/footer + BACKLOG status + CLAUDE.md sync + tag + push + live-verify.

## Design decisions refined from spec (locked)

- **Mirror = redirector**: catches ANY incoming beam, re-emits toward its `dir` (0..7, 45° steps, 0=right, CCW positive). Bump rotates **counter-clockwise** one step. No physical-reflection math.
- **Rotatable mirrors are ground-mounted**: disc underside at groundTop−190 (buddy-block bump convention), disc 60×60, center at groundTop−220.
- **Relay mirrors are fixed**: floating, pre-aimed, smaller gold-framed discs; drawn distinctly; not bumpable.
- **Frozen mirror crust reaches the ground**: crust solidly BLOCKS the beam and is a ground-level projectile target; one fire shot thaws permanently.
- **Vents**: ground-mounted; plume = vertical scatter zone from groundTop up to `plumeTop`; one ice shot freezes permanently (ice sculpture, beam passes).
- **Sensors latch forever** on first beam contact; latch triggers a per-sensor reward callback (pushes one-way solids).
- **Raycast**: recomputed every frame per lantern; max 12 segments; a (mirror,outDir) pair never re-visited (loop guard); nearest-hit AABB tests against mirrors/crusts/vents(plumes)/sensors/level solids; beam ends with a sizzle sparkle where it stops.

## Level geometry (exact, `'mountain2'`, G-top values are solid tops)

- `lv.w = 3600; lv.h = 2200`. Player start (90, 2046). Theme/music mountain. No enemies.
- **T1 base**: ground x0–3600 top 2140. Checkpoint (200,2140).
  Lantern (380, beam y 1920, aims RIGHT). Mirror M0 rotatable free at x820 (disc center 820,1920; starts dir=RIGHT; solve = UP, 2 CCW bumps). Sensor S1 at (820,1600) hanging under a small rock (solid rock x 770–870, y 1490–1560 — above head-reach 2140−94−148=1898? 1560 < 1898 ✓ out of jump reach).
  Reward: ice steps (oneWay 170-wide) at (1500,2040),(1700,1960),(1900,1880),(2100,1800).
- **T2 ledge**: solid x2200–3400 top 1780 h80. Checkpoint (2300,1780).
  Lantern (2300, y 1560, RIGHT). FM2 rotatable FROZEN at x2700 (starts dir=DOWN; solve = UP). Fire pickup (2550, 1690). Relay R2 fixed at (2700,1300) dir RIGHT. Rock tunnel solid x2900–3100, y1450–1660 (walk-under, blocks the direct 1560 line). Sensor S2 at (3250,1300) on a tall post.
  Reward: steps (2100,1690),(1950,1580),(1830,1490).
- **T3 ledge**: solid x400–1800 top 1420 h80. Checkpoint (600,1420).
  Lantern (500, y 1200, RIGHT). FM3 rotatable FROZEN at x700 (crust blocks; solve dir = RIGHT after thaw; starts DOWN). M3 rotatable free at x900 (starts RIGHT; solve = UP). Relay (900,880) fixed RIGHT; relay (1650,880) fixed DOWN. Vent V3 at x1650 on ledge (plumeTop 1140). Sensor S3 at (1650,1260) on a post. Fire pickup (620,1330), ice pickup (760,1330).
  Reward: zigzag steps (1850,1320),(2000,1230),(1850,1140),(1980,1050).
- **Dome deck**: solid x2000–3400 top 1000 h90. Checkpoint (2100,1000). Dome shell + telescope are DECOR (drawBack/draw), not solid.
  Lantern (2100, y 780, RIGHT). FM4 rotatable FROZEN at x2450 (starts DOWN; solve RIGHT). Vent V4 at x2800 (plumeTop 540). M4 rotatable free at x3080 (starts RIGHT; solve = UP-RIGHT diagonal — the finale teaches diagonals). Telescope eye target at (3230,630). Fire pickup (2250,910), ice pickup (2350,910).
- Candy rows/arcs per terrace; heart on T3; pines/peaks decor.
- Ceiling audit done in-plan: T2 underside 1860 vs T1 2140 (gap 280>242 head-reach? head reaches 1898<1860+…; verify in harness), T3 underside 1500 over T1 ok, deck underside 1080 above T2→T3 step head-reach 1248 ✓; S1 rock and R-relays out of reach; tunnel is walk-only.

---

### Task 1: Beam kit core (`js/beams.js`) + logic checks

**Files:** Create `js/beams.js`; Modify `index.html`, `sw.js`, `test/harness.js` (loader list + checks), `tools/screenshot.sh` (script tags).

**Interfaces (Produces):**
- `class BeamMirror { x, y, dir, frozen, fixed, w:60, h:60, solid }` — `solid` is the bumpable `{puzzleBlock-like}` box for rotatables; `rotate()` does `dir=(dir+1)%8`.
- `class BeamVent { x, groundY, plumeTop, frozen }`, `class BeamSensor { x, y, lit, onLit }`, `class BeamLantern { x, y, dir }`.
- `DIRS8` = 8 unit vectors, 0=right, CCW.
- `castBeams(lanterns, mirrors, vents, sensors, solids) -> [{pts:[[x,y]...], end:'sensor'|'sizzle'|...}]` — pure function, loop-guarded, nearest-AABB-hit.
- `class FrozenObservatory { constructor(lv), update(dt, pl), draw(ctx), drawBack(ctx,t), sensorsLit() }` (content wired in Task 3).

- [ ] Write harness checks FIRST (in a new "beam kit logic" section): castBeams straight-line to sensor lights it; misaligned mirror → sizzle, sensor unlit; aligned redirect chain (right→up via mirror) lights an elevated sensor; unfrozen vent plume stops the beam, frozen passes; frozen mirror crust blocks until `frozen=false`; loop guard terminates two facing mirrors; rotate() cycles CCW through 8 back to start; sensor latch survives re-misaiming the mirror.
- [ ] Run harness — expect ReferenceError (BeamMirror not defined).
- [ ] Implement `js/beams.js` (kit only, no observatory content yet; `FrozenObservatory` stub constructor OK) + add `<script src="js/beams.js">` between ride.js and levels.js in all four load lists.
- [ ] Harness green ×2; `node --check js/beams.js`. Commit.

### Task 2: World-4 conversion + `'mountain2'` level skeleton

**Files:** Modify `js/levels.js` (LEVEL_META `mountain2: { name: 'THE FROZEN OBSERVATORY 3-2', theme: 'mountain', music: 'mountain' }`; `WORLD_STAGES[4] = [4, 'mountain2']`; world-4: delete `lv.gate = new Gate(4700, 524)`, add `lv.subDoors.push(new SubDoor(4700, 524, 'mountain2', 'stagegate', { advance: true }))`; new `mountain2` build branch with the exact geometry table above, `lv.puzzle = new FrozenObservatory(lv)`); Modify `test/harness.js` (update existing world-4 gate-completion checks to the archway flow; add mountain2 traversal checks).

**Interfaces:** Consumes `FrozenObservatory` from Task 1 (stub acceptable until Task 3 for build-only checks). Produces the stage the remaining tasks fill.

- [ ] Update/add harness checks: world 4 has the stagegate door and NO `lv.gate`; walking the archway (with the golden-key mission done, as existing checks already arrange) fires stageClear → mountain2 loads as a full level (`game.level.n === 'mountain2'`, state play after the card); T1→T2 stairs traversal is RIDDEN for real after force-lighting S1 (jump each step, assert standing on T2); same for T2→T3 and T3→dome after force-lighting S2/S3; ceiling audit: from every terrace, a max jump under each overhead solid never strands (assert player returns to ground).
- [ ] Run harness — expect failures (no mountain2, gate checks break).
- [ ] Implement levels.js changes.
- [ ] Harness green ×2. Commit.

### Task 3: Observatory content + interaction (machine wiring)

**Files:** Modify `js/beams.js` (`FrozenObservatory` full: the four puzzle configs from the geometry table, mirror-bump routing via its rotatable solids pushed into `lv.solids` + `game.bumpBlock`-style head-hit hook — reuse the `puzzleBlock` head-hit path: mark rotatable solids `{ beamMirror: mirror }` and handle in the same place puzzleBlock solids are handled in entities.js/game.js; projectile loop (fire thaws crusts, ice freezes vents, `pr.hitSet` + `pr.impact(true)`); sensor rewards push the one-way step solids listed above; `update` recomputes `castBeams` each frame). Modify `js/entities.js` or `js/game.js` ONLY at the existing head-hit dispatch point (one `else if (s.beamMirror)` branch).

**Interfaces:** Consumes Task 1 kit + Task 2 level. Produces: lit-sensor rewards in `lv.solids`; `FrozenObservatory.telescopeLit` true when the dome beam reaches the eye target.

- [ ] Harness checks first: real jump-bump under M0 rotates it (dir changes CCW), two real bumps light S1 and spawn exactly 4 one-way steps; bumping a FROZEN mirror does nothing but a shiver (dir unchanged); a REAL fired fireball from standing ground level hits FM3's crust and thaws it; a REAL iceball freezes V3; the full T3 chain lit only after thaw+aims+freeze (assert unlit before the last action, lit after); latched sensors stay lit after rotating M3 away and after `game.respawn()`-style checkpoint return; dome chain sets `telescopeLit` with M4 at UP-RIGHT and not at UP.
- [ ] Run harness — expect failures.
- [ ] Implement.
- [ ] Harness green ×2. Commit.

### Task 4: Telescope cutscene + finale + progression

**Files:** Modify `js/game.js` (`updateCut` case `'telescope'` ~6.5s: dusk dim ramp → dome iris view with green planet + waving saucer aliens (reuse alien draw style) → gift star beams down; on end, `lv.goalStar = { x: 2600, y: 900 }` + candyBurst; trigger: FrozenObservatory sets `game.cut = { name:'telescope', t:0 }` once when `telescopeLit`); the cutscene draw goes wherever bossintro/eruption draw (same dispatch).

**Interfaces:** Consumes `telescopeLit`. Produces the stage finale; `worldWin(4)` comes free from the generic final-chain-stage goalStar path.

- [ ] Harness checks first: telescopeLit → cut starts, input frozen; cut end reveals goalStar; walking into the star fires worldWin(4) (endPhase 'party', unlocked ≥ 5, stageProg[4] reset); title resume: with `stageProg[4]=1`, startWorld(4) loads mountain2 directly.
- [ ] Run harness — expect failures. Implement. Green ×2. Commit.

### Task 5: Art pack + contact-sheet review

**Files:** Modify `js/beams.js` (draw functions: lantern crystal, rotatable mirror dish w/ face looking along `dir`, fixed gold relay, ice crust w/ shivering face, vent + plume + ice sculpture, sensor crystal off/lit, dome shell + telescope in drawBack, beam glow line + sizzle).

- [ ] Screenshot each terrace (`game.startLevel('mountain2'); game.introT=99; step + camera positioning`) and the dome pre/post alignment; a mid-cutscene frame; review every PNG by eye at in-game size (readability: can a 5yo see where the dish points? does the frozen crust read as "shoot fire here"?). Iterate until clean.
- [ ] Commit.

### Task 6: Release

**Files:** Modify `js/util.js` (1.23.0), `CHANGELOG.md`, `docs/index.html` (badge, footer, world-4 row, new Frozen Observatory section, harness blurb + check count), `BACKLOG.md` (item 3 ✅ shipped v1.23.0), `CLAUDE.md` (worlds table row 4, architecture table row for beams.js, chain list, check count).

- [ ] Harness ×3 green (includes doc-sync checks). Commit `v1.23.0: ...`, tag `v1.23.0`, push + tags, background-wait for Pages, `curl` live-verify beams.js + GAME_VERSION.

## Self-review

Spec coverage: progression hookup (T2), level shape+terraces (T2/T3), beam kit (T1), finale (T4), art (T5), testing (T1-T4), release (T6) ✓. Placeholders: none — geometry and start/solve orientations are exact. Type consistency: `FrozenObservatory`, `castBeams`, `telescopeLit`, `beamMirror` solid tag used consistently ✓.
