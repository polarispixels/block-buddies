# Block Meadow 0-2 (v1.15.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A second meadow stage ("level 0-2") — longer than most worlds (6800px), very simple, but gated so the ONLY way through is to become Big Buddy and smash through brick walls.

**Architecture:** A string-id sublevel `'meadow2'` (meadow theme) entered through a new, unmissable `SubDoor` style `'stagegate'` (wooden archway with a golden star and a big "2" badge) placed on the walk to Block Meadow's goal gate — the meadow grows 4200→4650 wide and its gate moves 4080→4530 to make room. Two new reusable pieces: **`bigBrick` walls** that Big Jack rams straight through (mirrors the `breakable`+`superT` smash in `moveEntity`; small Jack bumping one gets a mushroom-icon thought bubble, precedent: `MissionGate.hintT`) and **`refill` buddy blocks** that re-arm after the mushroom is spent, so a mandatory wall can never soft-lock. Finale = `lv.goalStar` → the generic `subWin` party/persistence/replay.

**Tech Stack:** Same zero-build vanilla JS + node vm harness + Windows-Chrome screenshots.

**Spec (Ryan, verbatim):** "build level zero dash two. It should be an extension of the Meadow level. It should be longer than many of the previous levels. It will still be very simple but there needs to be a requirement so the only way to get through the level is to obtain big buddy status and breakthrough some bricks. There can be other challenges too but this is a main feature we want integrated."

## Global Constraints

- Zero build, no assets, procedural everything, faces on everything, forgiving for a 5-year-old.
- Never renumber internal levels 1-10 (string ids are the sanctioned mechanism — see the eleven existing mini-games).
- No solid ceilings over jump/launch paths (jump rise 148; walls must exceed jump + 52px auto step-up = 200 to be unjumpable → use ≥240).
- Version **1.15.0** (MINOR — new level). Bump `GAME_VERSION`, CHANGELOG entry, docs badge/footer/harness-count, `git tag v1.15.0`.
- Harness must RIDE jumps and walks for real; `ALL CHECKS PASSED` 2-3×; screenshots looked at.
- Commit as Ryan Gris, push, verify live deploy.

**Key numbers:** meadow (n=1) w 4200→4650, gate 4080→4530, stagegate door cx=4230. meadow2 w=6800, G=620. Wall 1: `{x:2050, y:380, w:52, h:240, bigBrick:true}`. Wall 2 (double): `{x:4950, y:332, w:104, h:288, bigBrick:true}`. Refill buddy blocks at cx 1780 and 4650 (y G−242, same underside rule as v1.14.0). Big Jack h=130 walks under everything; walls stand on the ground so there is no route over or under except through.

---

### Task 1: `bigBrick` walls + `refill` buddy blocks (mechanics)

**Files:**
- Modify: `js/entities.js` (`moveEntity` horizontal+vertical passes; Player on-foot branch wall-touch hint)
- Modify: `js/game.js` (`game.smashWall` gains a color param; `game.bumpBlock` refill re-arm; `updatePlay` hintT decay joins the bumpT decay loop)
- Modify: `js/levels.js` (`drawSolids`: `bigBrick` red-brick wall + mushroom thought bubble; dim-but-pulsing used-refill buddy block)
- Test: `test/harness.js` (new section after the escape section)

**Interfaces:**
- Produces: solids flagged `{bigBrick: true}` — Big Jack (`e.big`) rams through them in either axis exactly like Super Mode rams `breakable` (via `game.smashWall(s, cols)`, now accepting an optional particle-color array; bigBrick passes `['#c94f3d','#a83a2e','#e8d9c9']`). Small player contact sets `s.hintT = 1` (decayed in `updatePlay`), drawn as a thought bubble with a mini gold mushroom. Buddy blocks flagged `{refill: true}` re-arm on bonk when used && player not big && no live `GrowthShroom` in `game.pickups`.
- Consumes: v1.14.0's `Player.big`, `GrowthShroom`, `game.bumpBlock`, buddy-block drawing.

- [ ] **Step 1: failing harness checks** — new section `// ---------------- Meadow 0-2 (v1.15.0)` inserted before `// ---------------- versioning`, starting from title. Build a synthetic arena inside level 1: push `game.testWall = {x:1100, y:380, w:52, h:240, bigBrick:true}` and `game.testRefill = {x:800, y:378, w:52, h:52, buddy:true, refill:true}` into `lv.solids`. Checks: (a) small Jack holding right into the wall stops (`player.x+player.w <= 1102`); (b) a real jump at the wall still leaves him left of it; (c) real jump-bonk of the refill block spawns a shroom; (d) collecting it (teleport onto it) → big; (e) holding right rams the wall: `testWall.broken === true` and player crosses past 1160; (f) `damage(1)` shrinks (no heart), then a second real jump-bonk of the SAME block re-arms it and spawns a fresh shroom; (g) while big, bonking the used refill block does NOT re-arm (stays quiet).
- [ ] **Step 2: run, expect FAILs** (`node test/harness.js | grep FAIL`).
- [ ] **Step 3: implement.** `moveEntity` horizontal pass, right after the `breakable`/`superT` line: `if (s.bigBrick && e.isPlayer && e.big) { game.smashWall(s, ['#c94f3d', '#a83a2e', '#e8d9c9']); res.smashed = true; continue; }` — and the same line in the vertical pass after its `breakable` line. `game.smashWall = function (s, cols)` uses `cols || ['#d9b98a', '#a8895a']` for the burst (plus keep sfx/shake; add `AudioSys.sfx('boom')` when cols given for extra drama). Player on-foot branch after `moveEntity`: `if (res.wall && res.wallS && res.wallS.bigBrick) res.wallS.hintT = 1;`. `updatePlay` decay loop becomes: `for (const s of lv.solids) { if (s.bumpT) s.bumpT = Math.max(0, s.bumpT - dt); if (s.hintT) s.hintT = Math.max(0, s.hintT - dt); }`. `game.bumpBlock` buddy branch, before the used-guard: `if (s.used && s.refill && !pl.big && !game.pickups.some(p => p instanceof GrowthShroom && !p.dead)) s.used = false;`. `drawSolids`: new `if (s.bigBrick)` branch BEFORE the `s.breakable` branch — chunky red bricks (48×24 courses, offset alternate rows, mortar lines `#8a2e24`, a couple of sturdy 'grin' faces via `hash2`), plus when `s.hintT > 0` a white thought bubble above the wall containing a mini gold mushroom (cap `#ffd24a` + turquoise spots, alpha follows hintT) — the wordless "you need the mushroom" hint. Used-refill buddy blocks draw dim teal `#2f8f86` with a slow pulsing outline instead of gray, face 'sleepy'.
- [ ] **Step 4: verify** — syntax checks + harness 2×.
- [ ] **Step 5: commit** "Big-brick walls Big Jack rams through + refilling buddy blocks".

### Task 2: The 'stagegate' door in Block Meadow

**Files:**
- Modify: `js/levels.js` (n===1: w 4650, gate 4530, door push)
- Modify: `js/entities.js` (`SubDoor`: entry sfx + sparkle colors + draw branch for `'stagegate'`)
- Modify: `js/levels.js` (`LEVEL_META`: `meadow2: { name: 'BLOCK MEADOW 0-2', theme: 'meadow', music: 'meadow' }`)
- Test: `test/harness.js`

**Interfaces:**
- Produces: `new SubDoor(4230, G, 'meadow2', 'stagegate')` in level 1's `subDoors`; walking into it enters `'meadow2'`; the generic dormant-trophy/replay behavior comes free.
- Consumes: SubDoor plumbing, `game.enterSub`.

- [ ] **Step 1: failing checks** — startLevel(1): `lv.w === 4650`, `lv.gate.cx === 4530`, a subDoor with `sub === 'meadow2'` at cx 4230; teleport the player onto it (armed after starting far away) → `state === 'intro' && level.n === 'meadow2'` (this fails until Task 3 adds the level, so write the door checks now and the entry check expects `buildLevel('meadow2')` to exist — implement Tasks 2+3 before the joint verify if needed; keep the checks in one section).
- [ ] **Step 2: implement.** Level 1: `lv.w = 4650;` (ground call uses `lv.w` already), `lv.gate = new Gate(4530, G);`, push the door with a comment ("stage 0-2: the meadow keeps going!"). SubDoor: entry sfx `'fanfare'`; sparkle colors `['#ffe156', '#7be07b', '#fff']`; draw branch `'stagegate'`: two wooden posts (`#b0743e`, rounded, `#6a4020` outline), an arched beam across the top, a golden star (`starPath`) perched on the arch, a big cream circle badge centered in the doorway with a bold "2" (`ctx.font` — the title medallions already use digits, so a numeral is in-vocabulary) and a small happy face under it, plus grass tufts at the feet. Doorway interior: soft green-to-sky vertical path fading out (an "onward!" look), drawn with a light gradient-free two-tone fill.
- [ ] **Step 3: verify syntax; full verify happens with Task 3.**
- [ ] **Step 4: commit** with Task 3.

### Task 3: Build the meadow2 level

**Files:**
- Modify: `js/levels.js` (`buildLevel`: new `if (n === 'meadow2')` block after the n===10 block, before the mini-game blocks)
- Test: `test/harness.js`

**Interfaces:**
- Consumes: everything above. Produces: the playable stage.

Layout (w 6800, h 720, G 620, `addGround(lv, 0, lv.w, G)`, playerStart {90, 400}, meadow decor loops copied from n===1 sized to lv.w):
- Warm-up: hints arrows@300; candyRow 350-750 G-50 ×4; walk spider@950 range 160; block pile@1150 (2,1); plat@1380 y480 w200; candyArc 1300-1660.
- Checkpoint 1550. **Refill buddy block cx 1780** (`{x:1754, y:G-242, w:52, h:52, buddy:true, refill:true}`).
- **WALL 1** `{x:2050, y:380, w:52, h:240, bigBrick:true}`. Celebration candyArc 2150-2450 behind it.
- Middle fun: walk spider@2500 range 170; plat@2650 y500 w200; bouncy spring `addPlat(lv, 3050, 580, 100, {bouncy:true, h:40})` → wide oneWay plat@3180 y300 w320 with candyRow on it; candy crate `{x:3600, y:G-242, w:52, h:52, bigBonus:true}` (optional treat); jump spider@3950 range default; heart pick@4150 G-60.
- Checkpoint 4400. **Refill buddy block cx 4650** (`{x:4624, y:G-242, w:52, h:52, buddy:true, refill:true}`).
- **WALL 2 (double)** `{x:4950, y:332, w:104, h:288, bigBrick:true}` guarding the candy vault: candyRow 5150-5500 G-50 ×5, candyArc 5250-5450, pile@5350 (2,2) with candyRow on top, heart@5550.
- Victory run: walk spider@5850 range 150; candyArc 6000-6350; `lv.goalStar = { x: 6600, y: 470 };` decor: flowers/trees/clouds loops to 6800.
- No pits, no ceilings anywhere near jump paths (the one oneWay plat at y300 is pass-through).

- [ ] **Step 1: failing checks** (same section): enter via the door for real; then in meadow2: `lv.w === 6800`; wall1 exists; RIDE the whole gauntlet: hold right → stopped at wall1; real bonk of buddy 1 → shroom → collect → big → hold right → wall1 broken, past 2150; `damage(1)` mid-stage → small, hearts still 3 (big soak); walk to buddy 2 (teleport near 4560, real jump-bonk) → grow → ram wall 2 → broken; teleport to 6500 ground, walk right → `endPhase === 'party'` and `game.miniDone.meadow2`; `exitSub` → back in level 1 at the stashed spot.
- [ ] **Step 2: implement the level block.**
- [ ] **Step 3: verify harness 3× (physics-heavy).**
- [ ] **Step 4: commit** "Block Meadow 0-2: the big-brick stage (door, stagegate style, level)".

### Task 4: Version/docs/CLAUDE.md

- [ ] `GAME_VERSION = '1.15.0'`; CHANGELOG `## [1.15.0]` (stage 0-2, bigBrick ram, refill blocks, stagegate door, meadow extended); docs badge+footer 1.15.0; harness-count updated to the real `grep -c '^PASS'` figure; minigames section gets a "Block Meadow 0-2" entry (it IS delivered via the sublevel system but present it as a stage, not a secret) + meadow level row updated (door + new width/gate) + systems note under Big Buddy for `bigBrick`/`refill`; CLAUDE.md: sublevel id list + door style list + Big Buddy bullet extension + world-1 gimmick cell + check count.
- [ ] Verify harness (version sync) → commit.

### Task 5: Screenshots + ship

- [ ] Shots: `stagegate-door` (meadow end zone), `brick-wall-hint` (small Jack pushing wall 1, thought bubble visible), `brick-smash` (big ram moment), `candy-vault` (behind wall 2), `meadow2-goal` (star). LOOK at each; fix art until right.
- [ ] Full verify (syntax ×5 files, harness ×2).
- [ ] Commit remainder, push, `git tag v1.15.0`, push tags; background-verify live `util.js` has 1.15.0 and `levels.js` has `meadow2`.

## Self-review

- Spec: "extension of meadow" (same theme, entered from the meadow's own path, name BLOCK MEADOW 0-2) ✓; "longer than many previous levels" (6800 > every world except none — longest existing is 5800) ✓; "very simple" (flat ground, walk spiders, one bouncer, no pits, generous checkpoints) ✓; "only way through is Big Buddy + break bricks" (two ground-standing walls 240/288 tall — unjumpable, unsteppable, smashed only by `e.big`; refill blocks guarantee re-growth so it's mandatory but never a soft-lock) ✓; "other challenges" (spiders, bouncer route, optional candy crate, candy vault) ✓.
- Soft-lock audit: shrink after using block → bonk re-arms (checked); shroom walks away → can't be lost (teleports home, v1.14.0); die mid-stage → walls stay broken (state on level object), checkpoints refill hearts; quit via Escape → replay via dormant door + Space.
- Type consistency: `bigBrick`/`hintT`/`refill` flags; `smashWall(s, cols)` optional param keeps all existing call sites valid.
