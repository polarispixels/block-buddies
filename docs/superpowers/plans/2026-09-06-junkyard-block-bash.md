# Junkyard Block Bash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1.29.0 — JUNKYARD BLOCK BASH, a 3–5 minute Breakout-through-Block-Buddies arcade sublevel off Monster Truck Rally, plus the first slice of a reusable Arcade Mode kit.

**Architecture:** A new `lv.arcade` level slot (mirrors `lv.puzzle` hooks + takes over `Player.update` like `lv.ride`) hosts `BlockBash` (js/blockbash.js), which composes small reusable pieces from js/arcade.js (`Mods`, `WaveRunner`, `Sequence`, `Spawner`, `ArcadeHud`, `payout`) and pure drawing from js/bashart.js (`BASH_ART`). Jack drives the existing monster truck (vehicle `'truck'`) as the paddle; a faced rubber ball smashes 10 block kinds across 4 escalating waves and a JUNKBOT finale. Zero build step, zero assets, everything procedural.

**Tech Stack:** Plain browser JS (`<script>` tags, shared globals), canvas 2D, WebAudio via `AudioSys`, headless harness `node test/harness.js`, screenshots via `tools/screenshot.sh`.

**Spec:** `docs/superpowers/specs/2026-09-06-junkyard-block-bash-design.md` — read it first; every number below comes from it.

## Global Constraints

- Zero build step, no modules, no npm deps; `index.html` must keep working from `file://`. Load order matters (shared globals).
- No asset files: all art procedural canvas, all audio procedural (`AudioSys`).
- Cartoon-cute: big faces on everything; no gore; nothing ever damages the truck; nothing ever resets progress on a miss.
- Design for a 5-year-old: big targets, generous hitboxes, ball speed hard cap 620 px/s, random never unwinnable.
- Every task: `node --check js/*.js` clean and `node test/harness.js` prints `ALL CHECKS PASSED` before commit.
- Commit as `git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" commit …` and end every message with:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01FMv3WTPJE8yWxnA6APN8FZ
  ```
- Four load lists must stay in sync: `index.html`, `sw.js`, `test/harness.js:77`, `tools/screenshot.sh:31` — new order `… ride.js, beams.js, arcade.js, bashart.js, blockbash.js, flowerart.js …`.
- Version 1.29.0 (MINOR). Do NOT bump `GAME_VERSION` until Task 10 (the harness checks CHANGELOG/docs sync against it).
- Internal world numbering: the rally is internal n = 7 (displayed "6").

## Shared vocabulary (used by every task)

```js
// js/blockbash.js — constants every task reads (Task 1 creates them)
const BB = {
  L: 40, R: 1240, TOP: 90, FLOOR: 620, MISS_Y: 640,          // arena bounds
  COLS: 12, BW: 96, BH: 48, GX: 64, GY: 110,                 // block grid (col c → x = GX + c*BW; row r → y = GY + r*BH)
  BALL_R: 18, GIANT_R: 32,
  SPEED: [380, 430, 480, 520, 540], CAP: 620, MIN_VY: 0.35, MIN_VX: 0.08,
  PADDLE_ACC: 2600, PADDLE_MAX: 520, PADDLE_PAD: 6,
  HOP_T: 0.35, HOP_H: 60, BUMP: 1.25,
  LAUNCH_AUTO: 1.5, RESPAWN: 0.9,
  CAPSULE_VY: 220, CANDY_DRIFT: 140, FLOOR_CANDY_T: 6, MAX_BALLS: 6,
  MODS: { giant: 10, wide: 12, boom: 8, magnet: 10, slow: 6, net: 12, rainbow: 6 },
  PAR: [45, 55, 65, 75], STALL_EVERY: 2.5,
  BOSS: { HP: 12, W: 340, H: 260, XMIN: 200, XMAX: 1080, YMIN: 150, YMAX: 330, STALL: 60 }
};
```

Block object shape (Task 5 creates, Task 3 draws, Tasks 6–8 mutate):
```js
{ x, y, w: 96, h: 48, kind, hp, maxHp, alive: true, landed: true, hitT: 0, seed, row, col,
  vx: 0 /* conveyor/runner slide */, runT: 0, falling: false, vy: 0, wobble: 0 }
```
Ball object shape: `{ x, y, r, vx, vy, speed, rest: bool, bumpT: 0, squash: 1, mood: 'happy', trail: [] }`.
Capsule: `{ x, y, kind, vy, t }`. CandyDrop: `{ x, y, vx, vy, onFloor: bool, t }`.
JunkBot (Task 8): `{ x, y, w, h, hp, stage, parts: { sign: true, tireL: true, tireR: true, core: true }, coreOpen, hurtT, mood, beamT, beamBall, beamX, beamY, dir, stallT, droop, entering }` (coreOpen = true once tireR pops; beamX/beamY = where the beam holds the ball).

---

### Task 1: The `lv.arcade` slot, the shell, and the truck paddle

**Files:**
- Create: `js/arcade.js` (header comment only for now), `js/bashart.js` (header + `const BASH_ART = {}` placeholder object with `arcadeDoor` stub), `js/blockbash.js` (`BB` + `BlockBash` skeleton)
- Modify: `js/levels.js:57-75` (newLevel defaults), `js/levels.js:33-40` (LEVEL_META), `js/levels.js:483` area (world-7 door), new `buildLevel` branch near `js/levels.js:1514` (beside beatbash)
- Modify: `js/entities.js:136-141` (Player.update gate), `js/entities.js:4394-4406` (door idle particle colours), `js/entities.js:4506-4513` (door art dispatch)
- Modify: `js/game.js:759` (update hook), `js/game.js:1409-1420` (drawBack/draw hooks), `js/game.js:1492-1495` (drawFront hook), `js/game.js:1349-1351` (party headline)
- Modify: `js/util.js:342-364` (TouchUI layout), `index.html:28`, `sw.js:6`, `test/harness.js:77`, `tools/screenshot.sh:31`
- Test: `test/harness.js` — new `// ---- JUNKYARD BLOCK BASH` block placed right after the beatbash block (~line 2714)

**Interfaces:**
- Produces: `lv.arcade` slot with hooks `updatePlayer(pl, dt)`, `update(dt, pl)`, `drawBack(ctx, t)`, `draw(ctx, t)`, `drawFront(ctx, t)`; `lv.touchLayout = 'arcade'`; `BB` constants; class `BlockBash` with fields `lv, t, state ('play'), hopT, hopY0, paddleBox()`; `BASH_ART.arcadeDoor(ctx, cx, groundY, t, { glow })`.
- Consumes: `Player.boardTruck()`, `SubDoor`, `enterSub/exitSub/subWin`.

- [ ] **Step 1: Write the failing harness checks** (append after the beatbash block, before Zombie Town):

```js
// ---------------------------------------------------------------- JUNKYARD BLOCK BASH (v1.29.0)
vm.runInContext('game.startLevel(7)', sandbox); frames(120);
check('blockbash: the rally has a press-gated ARCADE cabinet door at x=280',
  vm.runInContext("game.level.subDoors.some(d => d.sub === 'blockbash' && d.press && d.style === 'arcade' && d.cx === 280)", sandbox));
vm.runInContext('game.player.boardTruck()', sandbox); // enter IN the truck so the exit check can prove the vehicle survives
put(200, 620 - 96); frames(40, { ArrowRight: 1 });
check('blockbash: driving past the cabinet never enters it', G().level.n === 7);
put(280 - 52, 620 - 96); frames(12); tap('Space'); frames(10);
check('blockbash: standing at the cabinet + Space enters JUNKYARD BLOCK BASH', G().level.n === 'blockbash' && G().state === 'intro');
frames(200); // intro card
const BBM = () => vm.runInContext('game.level.arcade', sandbox);
check('blockbash: BlockBash rides lv.arcade, the hero spawns IN THE TRUCK, camera pinned',
  vm.runInContext('game.level.arcade instanceof BlockBash', sandbox) && G().player.vehicle === 'truck' && G().cam.x === 0 && G().cam.y === 0 && G().level.touchLayout === 'arcade');
check('blockbash: the arcade touch layout has no duck button',
  vm.runInContext("TouchUI.layout().every(b => b.key !== 'ArrowDown') && TouchUI.layout().some(b => b.key === 'ArrowUp')", sandbox));
const px0 = G().player.x;
frames(30, { ArrowRight: 1 });
check('blockbash: Right drives the truck right, fast', G().player.x > px0 + 150);
frames(90, { ArrowRight: 1 });
check('blockbash: the truck is clamped inside the tire wall', G().player.x + G().player.w <= 1240 + 1);
frames(120, { ArrowLeft: 1 });
check('blockbash: the truck is clamped at the left wall', G().player.x >= 40 - 1);
frames(20); const pyRest = G().player.y;
check('blockbash: the truck sits on the floor, no gravity fall', Math.abs(pyRest - (620 - 96)) < 0.5 && G().player.vy === 0);
tap('ArrowUp'); frames(8);
check('blockbash: Jump = truck HOP (rises)', G().player.y < pyRest - 20);
frames(40);
check('blockbash: the hop lands back on the floor', Math.abs(G().player.y - pyRest) < 0.5);
// exit path (forced win for now — Task 8 wires the real victory)
vm.runInContext('game.subWin()', sandbox); frames(320); tap('Space'); frames(10);
check('blockbash: Space after the party returns to the rally in the truck, nothing leaks',
  G().level.n === 7 && G().state === 'play' && G().level.arcade === null && G().level.touchLayout === null && G().player.vehicle === 'truck');
check('blockbash: completion is remembered', G().miniDone.blockbash === true && sandbox.localStorage.getItem('ffbg_mini').includes('blockbash'));
```
(The truck is 104×96; the door is 92 wide centred on 280, so `put(280 - 52, …)` centres the truck on it.)

- [ ] **Step 2: Run the harness — expect the new checks to FAIL** (`node test/harness.js | grep -c FAIL` > 0, everything else still PASS).

- [ ] **Step 3: Create the three files.**

`js/arcade.js`:
```js
// ARCADE MODE kit — small reusable pieces for fast arcade levels (Junkyard
// Block Bash is the first; Blaster Run is planned). Nothing here knows about
// balls or blocks. See docs/superpowers/specs/2026-09-06-junkyard-block-bash-design.md §12.
```

`js/bashart.js`:
```js
// JUNKYARD BLOCK BASH art pack — pure drawing, no game-state reads.
const BASH_ART = {
  arcadeDoor(ctx, cx, g, t, o = {}) { // placeholder — Task 3 draws the real cabinet
    ctx.fillStyle = '#4a4a5a'; ctx.fillRect(cx - 46, g - 118, 92, 118);
    drawFace(ctx, cx, g - 70, 40, 'happy', t, 7);
  }
};
```

`js/blockbash.js`:
```js
// JUNKYARD BLOCK BASH — Arcade Mode #1 (v1.29.0). Breakout through Block
// Buddies: Jack's monster truck is the paddle, a faced rubber ball smashes
// junk blocks, misses are comedy, the JUNKBOT is the finale.
const BB = { /* the table from the plan header, verbatim */ };

class BlockBash {
  constructor(lv) {
    this.lv = lv; this.t = 0; this.state = 'play';
    this.hopT = 0; this.hopY0 = BB.FLOOR - 96; this.spinT = 0;
    this.wideK = 1; // paddle width multiplier (Task 6's wide mod)
  }
  paddleBox() {
    const pl = game.player, extra = (this.wideK - 1) * pl.w / 2;
    return { x: pl.x - BB.PADDLE_PAD - extra, y: pl.y, w: pl.w + 2 * (BB.PADDLE_PAD + extra), h: pl.h };
  }
  // the arcade owns the hero: snappy left/right, a hop, no gravity
  updatePlayer(pl, dt) {
    pl.t += dt; pl.inv = 0; pl.onGround = true;
    if (pl.moodT > 0) { pl.moodT -= dt; if (pl.moodT <= 0) pl.mood = 'happy'; }
    const dir = this.spinT > 0 ? 0 : (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
    if (dir) { pl.vx = clamp(pl.vx + dir * BB.PADDLE_ACC * dt, -BB.PADDLE_MAX, BB.PADDLE_MAX); pl.facing = dir; }
    else pl.vx *= Math.exp(-14 * dt); // stops in ~0.15 s
    if (Math.abs(pl.vx) < 4 && !dir) pl.vx = 0;
    pl.x = clamp(pl.x + pl.vx * dt, BB.L, BB.R - pl.w);
    // HOP: a 0.35 s arc up 60 px and back, animated (no gravity)
    if (justP.ArrowUp && this.hopT <= 0 && this.spinT <= 0) { this.hopT = BB.HOP_T; AudioSys.sfx('boing'); }
    if (this.hopT > 0) { this.hopT -= dt; const k = 1 - this.hopT / BB.HOP_T; pl.y = this.hopY0 - Math.sin(k * Math.PI) * BB.HOP_H; }
    else pl.y = this.hopY0;
    pl.vy = 0; pl.squash = lerp(pl.squash, 1, 1 - Math.exp(-10 * dt));
    if (this.spinT > 0) { this.spinT -= dt; pl.rot = Math.sin(this.t * 40) * 0.25; } else pl.rot = 0;
  }
  hopRising() { return this.hopT > BB.HOP_T * 0.45; }
  update(dt, pl) { this.t += dt; }
  drawBack(ctx, t) { ctx.fillStyle = '#3a3346'; ctx.fillRect(0, 0, W, H); }
  draw(ctx, t) {}
  drawFront(ctx, t) {}
}
```

- [ ] **Step 4: Engine edits.**

`js/levels.js` `newLevel` — after `ride: null,` add:
```js
    arcade: null, touchLayout: null, // arcade-mode machine (js/arcade.js + js/blockbash.js) + its touch pad
```
`LEVEL_META` — after the `surf` line:
```js
  blockbash: { name: 'JUNKYARD BLOCK BASH', theme: 'dirt', music: 'arcade' }, // Arcade Mode #1 (js/blockbash.js)
```
World 7 (`buildLevel(7)`, next to the sandslide back-door at line ~483):
```js
  // JUNKYARD BLOCK BASH: an arcade cabinet on the flat start ground, press-gated
  lv.subDoors.push(new SubDoor(280, G, 'blockbash', 'arcade', { press: true }));
```
New branch beside beatbash:
```js
  if (n === 'blockbash') { // ---------------- JUNKYARD BLOCK BASH (Arcade Mode #1, v1.29.0)
    lv.w = 1280; lv.h = 720;
    lv.playerStart = { x: 590, y: G - 96 };
    addGround(lv, 0, 1280, G);
    lv.solids[lv.solids.length - 1].skipDraw = true; // the arcade paints its own junk floor
    lv.touchLayout = 'arcade';
    lv.arcade = new BlockBash(lv);
  }
```
`game.enterSub` already builds the level; put the truck boarding in `BlockBash.update`'s first frame instead of touching enterSub: in `update`, `if (!this.booted) { this.booted = true; if (pl.vehicle !== 'truck') { pl.boardTruck(); } pl.x = 590 - 52; this.hopY0 = BB.FLOOR - pl.h; pl.y = this.hopY0; }` — and ALSO do the same guard at the top of `updatePlayer` (Player.update runs before the machine update, and boardTruck plays sfx — that's fine on frame 1).

`js/entities.js` Player.update — insert as the FIRST lines after `const lv = game.level;`:
```js
    // ARCADE MODE (js/arcade.js): the arcade machine owns the hero completely
    if (lv.arcade) { lv.arcade.updatePlayer(this, dt); return; }
```
SubDoor idle particle colours (the `cols` ternary chain ~4394): add `this.style === 'arcade' ? ['#ffe156', '#ff4d4d', '#4aa3ff'] :`. Door art dispatch: add before `surfboard`:
```js
    } else if (this.style === 'arcade') {
      BASH_ART.arcadeDoor(ctx, cx, g, t, { glow: !done });
```
`js/game.js`: after the `lv.puzzle.update` line: `if (lv.arcade) lv.arcade.update(dt, pl); // arcade-mode machine (Block Bash)`. After `lv.ride.drawBack`: `if (lv.arcade) lv.arcade.drawBack(ctx, t);`. After `lv.puzzle.draw`: `if (lv.arcade) lv.arcade.draw(ctx, t);`. After the puzzle drawFront block: `if (lv.arcade) lv.arcade.drawFront(ctx, t); // screen-space arcade chrome (banners, chips)`. Party headline, before the jungle2 branch:
```js
    } else if (game.level.n === 'blockbash') {
      outlineText(ctx, 'JUNKYARD CHAMPION!', W / 2, 140, 74, '#ffe156', '#3a3448');
      outlineText(ctx, 'YOU BASHED THE JUNKBOT!', W / 2, 212, 34, '#ff9f43', '#3a3448');
```
`js/util.js` TouchUI.layout — after the water branch:
```js
    if (typeof game !== 'undefined' && game.level && game.level.touchLayout === 'arcade' && game.state !== 'title') return [
      { key: 'ArrowLeft',  glyph: 'left',  x: 82,      y: H - 105, r: 54 },
      { key: 'ArrowRight', glyph: 'right', x: 220,     y: H - 105, r: 54 },
      { key: 'ArrowUp',    glyph: 'up',    x: W - 105, y: H - 112, r: 64 },
      { key: 'Space',      glyph: 'star',  x: W - 272, y: H - 170, r: 54 }
    ];
```
Load lists: insert `arcade.js`, `bashart.js`, `blockbash.js` after `beams.js` in all four.

- [ ] **Step 5: Run `node --check js/*.js` and the harness — all new checks PASS, total still `ALL CHECKS PASSED`.** Run it 2×.
- [ ] **Step 6: Screenshot** `tools/screenshot.sh bash-shell "game.startLevel('blockbash'); game.introT=99; step(60);"` and `tools/screenshot.sh bash-door "game.startLevel(7); game.introT=99; step(30);"` — look at both: truck on a dark floor, cabinet door visible at the rally start.
- [ ] **Step 7: Commit** `feat(arcade): lv.arcade slot + Block Bash shell (truck paddle, cabinet door)`.

---

### Task 2: The Arcade kit (`js/arcade.js`)

**Files:**
- Modify: `js/arcade.js`
- Test: `test/harness.js` (a `// ---- ARCADE KIT` block right before the Block Bash block; pure JS run through `vm.runInContext`)

**Interfaces (Produces — exact):**
```js
class Mods {                       // timed modifiers
  constructor(onExpire)            // onExpire(name) optional
  add(name, dur)                   // refresh to max(left, dur); dur = Infinity allowed
  has(name) → bool; left(name) → seconds (0 if absent); frac(name) → left/dur 0..1
  clear(name); clearAll()
  update(dt)                       // ticks, fires onExpire
  list() → [{ name, left, dur }]   // insertion order, for HUD chips
}
class WaveRunner {                 // ordered waves
  constructor(waves, hooks)        // waves: [{ par, build() }]; hooks: { onBuild(i), onPlay(i), onClear(i), onDone(), isClear() → bool }
  fields: i, state ('build'|'play'|'clear'|'done'), stateT, stallT, buildTime = 1.2, clearTime = 2
  start(); update(dt); pastPar() → bool; skip()   // skip() jumps to 'clear' (harness use)
}
class Sequence {                   // timed step script
  constructor(steps)               // [{ dur, enter(seq), tick(k, seq) }] k = 0..1 within the step
  fields: i, t, done
  update(dt)                       // enters steps in order, calls tick, sets done after the last
}
class Spawner { constructor(every, jitter, fire); update(dt); reset() }   // fires fire() every `every ± jitter` s
class ArcadeHud {
  banner(text, color = '#ffe156', dur = 1.4)    // one big centred banner at a time (newest wins)
  pop(x, y, text, color = '#fff', size = 30)    // world-space float-up text, 0.9 s
  update(dt); drawWorld(ctx, t); drawScreen(ctx, t, chips /* [{name, frac, icon(ctx,x,y,s)}] */)
}
function arcadePayout(machine, n, x, y)   // queues n candy; machine.payQ drained at 90/s by arcadePayTick(machine, dt) with candy sfx + bursts
function arcadePayTick(machine, dt)
```

- [ ] **Step 1: Write the failing harness checks:**
```js
// ---------------------------------------------------------------- ARCADE KIT (js/arcade.js)
check('arcade kit: Mods add/has/left/expire callback', vm.runInContext(`(() => {
  const gone = []; const m = new Mods(n => gone.push(n));
  m.add('wide', 2); m.add('slow', 1); m.add('wide', 1);           // refresh never shortens
  const ok1 = m.has('wide') && Math.abs(m.left('wide') - 2) < 1e-9 && m.list().length === 2;
  m.update(1.5);
  return ok1 && !m.has('slow') && m.has('wide') && gone.join() === 'slow' && Math.abs(m.frac('wide') - 0.25) < 1e-9;
})()`, sandbox));
check('arcade kit: WaveRunner build → play → clear → next → done, stall clock only in play', vm.runInContext(`(() => {
  const log = []; let clear = false;
  const w = new WaveRunner([{ par: 1, build() { log.push('b0'); } }, { par: 1, build() { log.push('b1'); } }],
    { onBuild: i => log.push('B' + i), onPlay: i => log.push('P' + i), onClear: i => log.push('C' + i), onDone: () => log.push('D'), isClear: () => clear });
  w.start(); w.update(1.3); const s1 = w.state; w.update(1.5); const past = w.pastPar(); clear = true; w.update(0.02); const s2 = w.state; clear = false;
  w.update(2.1); const s3 = w.state; w.update(1.3); clear = true; w.update(0.02); w.update(2.1);
  return s1 === 'play' && past && s2 === 'clear' && s3 === 'build' && w.state === 'done' && log.join() === 'b0,B0,P0,C0,b1,B1,P1,C1,D';
})()`, sandbox));
check('arcade kit: Sequence runs steps in order with k 0..1 and finishes', vm.runInContext(`(() => {
  const ks = []; const s = new Sequence([{ dur: 1, enter() { ks.push('e0'); }, tick(k) { ks.push(k.toFixed(1)); } }, { dur: 0.5, enter() { ks.push('e1'); } }]);
  s.update(0.5); s.update(0.5); s.update(0.3); s.update(0.3);
  return s.done && ks[0] === 'e0' && ks.includes('0.5') && ks.includes('e1');
})()`, sandbox));
check('arcade kit: Spawner fires on its interval', vm.runInContext(`(() => { let n = 0; const s = new Spawner(1, 0, () => n++); for (let i = 0; i < 35; i++) s.update(0.1); return n === 3; })()`, sandbox));
check('arcade kit: ArcadeHud banner + pops tick out', vm.runInContext(`(() => { const h = new ArcadeHud(); h.banner('WAVE 2!'); h.pop(10, 10, '+5'); const a = !!h.bannerText; h.update(2); return a && !h.bannerText && h.pops.length === 0; })()`, sandbox));
check('arcade kit: arcadePayout drains at ~90 candy/s into game.candy', vm.runInContext(`(() => { const c0 = game.candy; const m = { payQ: 0, payX: 0, payY: 0 }; arcadePayout(m, 100, 100, 100); for (let i = 0; i < 60; i++) arcadePayTick(m, 1/60); const mid = game.candy - c0; for (let i = 0; i < 60; i++) arcadePayTick(m, 1/60); return mid >= 80 && mid <= 100 && game.candy - c0 === 100 && m.payQ === 0; })()`, sandbox));
```
- [ ] **Step 2: Run harness — these FAIL.**
- [ ] **Step 3: Implement `js/arcade.js`:**
```js
class Mods {
  constructor(onExpire) { this.m = new Map(); this.onExpire = onExpire || null; }
  add(name, dur) { const cur = this.m.get(name); if (cur) { cur.left = Math.max(cur.left, dur); cur.dur = Math.max(cur.dur, dur); } else this.m.set(name, { left: dur, dur }); }
  has(name) { return this.m.has(name); }
  left(name) { const c = this.m.get(name); return c ? c.left : 0; }
  frac(name) { const c = this.m.get(name); return c ? (c.dur === Infinity ? 1 : c.left / c.dur) : 0; }
  clear(name) { this.m.delete(name); }
  clearAll() { this.m.clear(); }
  update(dt) { for (const [n, c] of this.m) { c.left -= dt; if (c.left <= 0) { this.m.delete(n); if (this.onExpire) this.onExpire(n); } } }
  list() { return [...this.m].map(([name, c]) => ({ name, left: c.left, dur: c.dur })); }
}
class WaveRunner {
  constructor(waves, hooks = {}) { this.waves = waves; this.h = hooks; this.i = -1; this.state = 'done'; this.stateT = 0; this.stallT = 0; this.buildTime = 1.2; this.clearTime = 2; }
  start() { this.i = -1; this.next(); }
  next() {
    this.i++;
    if (this.i >= this.waves.length) { this.state = 'done'; if (this.h.onDone) this.h.onDone(); return; }
    this.state = 'build'; this.stateT = 0; this.stallT = 0;
    this.waves[this.i].build(); if (this.h.onBuild) this.h.onBuild(this.i);
  }
  pastPar() { return this.state === 'play' && this.stallT > this.waves[this.i].par; }
  skip() { if (this.state === 'play') { this.state = 'clear'; this.stateT = 0; if (this.h.onClear) this.h.onClear(this.i); } }
  update(dt) {
    if (this.state === 'done') return;
    this.stateT += dt;
    if (this.state === 'build' && this.stateT >= this.buildTime) { this.state = 'play'; this.stateT = 0; if (this.h.onPlay) this.h.onPlay(this.i); }
    else if (this.state === 'play') { this.stallT += dt; if (this.h.isClear && this.h.isClear()) this.skip(); }
    else if (this.state === 'clear' && this.stateT >= this.clearTime) this.next();
  }
}
class Sequence {
  constructor(steps) { this.steps = steps; this.i = -1; this.t = 0; this.done = false; }
  update(dt) {
    if (this.done) return;
    if (this.i < 0) { this.i = 0; if (this.steps[0].enter) this.steps[0].enter(this); }
    this.t += dt;
    let s = this.steps[this.i];
    while (this.t >= s.dur) {
      if (s.tick) s.tick(1, this);
      this.t -= s.dur; this.i++;
      if (this.i >= this.steps.length) { this.done = true; return; }
      s = this.steps[this.i]; if (s.enter) s.enter(this);
    }
    if (s.tick) s.tick(this.t / s.dur, this);
  }
}
class Spawner {
  constructor(every, jitter, fire) { this.every = every; this.jitter = jitter; this.fire = fire; this.reset(); }
  reset() { this.t = this.every + rand(-this.jitter, this.jitter); }
  update(dt) { this.t -= dt; if (this.t <= 0) { this.fire(); this.reset(); } }
}
class ArcadeHud {
  constructor() { this.bannerText = null; this.bannerColor = '#ffe156'; this.bannerT = 0; this.bannerDur = 1; this.pops = []; }
  banner(text, color = '#ffe156', dur = 1.4) { this.bannerText = text; this.bannerColor = color; this.bannerT = dur; this.bannerDur = dur; }
  pop(x, y, text, color = '#fff', size = 30) { this.pops.push({ x, y, text, color, size, t: 0.9 }); }
  update(dt) { if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.bannerText = null; } for (const p of this.pops) { p.t -= dt; p.y -= 60 * dt; } this.pops = this.pops.filter(p => p.t > 0); }
  drawWorld(ctx, t) { for (const p of this.pops) { ctx.save(); ctx.globalAlpha = Math.min(1, p.t * 2); outlineText(ctx, p.text, p.x, p.y, p.size, p.color, '#3a2a4a'); ctx.restore(); } }
  drawScreen(ctx, t, chips = []) {
    if (this.bannerText) { const k = this.bannerT / this.bannerDur, pop = 1 + 0.25 * Math.max(0, 1 - (1 - k) * 6); ctx.save(); ctx.globalAlpha = Math.min(1, k * 3); ctx.translate(W / 2, 250); ctx.scale(pop, pop); outlineText(ctx, this.bannerText, 0, 0, 72, this.bannerColor, '#3a2a4a'); ctx.restore(); }
    let x = 60; for (const c of chips) { ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = '#2a2438'; ctx.beginPath(); ctx.arc(x, H - 250, 30, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ffe156'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, H - 250, 30, -Math.PI / 2, -Math.PI / 2 + TAU * c.frac); ctx.stroke(); c.icon(ctx, x, H - 250, 34); ctx.restore(); x += 74; }
  }
}
function arcadePayout(m, n, x, y) { m.payQ = (m.payQ || 0) + n; m.payX = x; m.payY = y; }
function arcadePayTick(m, dt) {
  if (!m.payQ) return;
  const k = Math.min(m.payQ, Math.ceil(dt * 90)); m.payQ -= k; game.candy += k;
  if (Math.random() < 0.5) AudioSys.sfx('candy');
  if (Math.random() < 0.6) Particles.candyBurst(m.payX + rand(-40, 40), m.payY, 1);
}
```
(Verify `TAU` exists in util.js — it does, used by SubDoor draw.)
- [ ] **Step 4: Harness passes (2×).** **Step 5: Commit** `feat(arcade): Mods, WaveRunner, Sequence, Spawner, ArcadeHud, payout`.

---

### Task 3: The Block Bash art pack (`js/bashart.js`) — contact-sheet reviewed

**Files:** Modify `js/bashart.js`; screenshots in `shots/`.

**Interfaces (Produces — exact signatures; every consumer task calls these):**
```js
BASH_ART.backdrop(ctx, t)              // full 1280×720 dusk junkyard (sky, junk hills, crusher + forklift with faces, chains) — world space
BASH_ART.floor(ctx, t)                 // junk floor band y 600..720, tread marks, bits
BASH_ART.walls(ctx, t)                 // stacked-tire bumpers filling x 0..40 and 1240..1280 from y 90 to 620, faces
BASH_ART.rail(ctx, t)                  // crane rail y 60..92 across the screen (+ the crusher mouth in the middle top)
BASH_ART.crane(ctx, x, y, t, o = {})   // magnet head; x = centre, y = bottom of the magnet; chain up to the rail; o.holding (draws a grip glow), o.mood
BASH_ART.block(ctx, b, t)              // any block kind + damage state from b (see shape); b.hitT flash; runner legs; faller hook+chain; boom fuse; power glow; rainbow stripes; surprise '?'
BASH_ART.ball(ctx, x, y, r, t, o = {}) // rubber ball with face; o.mood ('happy'|'dizzy'|'grin'|'surprised'), o.rainbow, o.boom (lit fuse), o.squash (1 = round), o.spin
BASH_ART.capsule(ctx, x, y, kind, t)   // 44-px round tire capsule with the icon; kinds multi/giant/wide/boom/magnet/slow/net
BASH_ART.modIcon(ctx, x, y, s, kind)   // the icon alone (chips + toasts); same 7 kinds + 'rainbow'
BASH_ART.tire(ctx, x, y, r, rot, t)    // giant rolling tire with a face
BASH_ART.net(ctx, y, t, k)             // junk net across the floor at y; k = 0..1 remaining (fades below 0.25)
BASH_ART.plow(ctx, x, y, w, h, facing, t) // scrap plow bolted on the truck front
BASH_ART.junk(ctx, x, y, kind, rot, s) // debris piece; kinds 0 hubcap, 1 boot, 2 rubber duck, 3 spring, 4 gear, 5 bolt
BASH_ART.splat(ctx, x, y, t, k)        // the miss splat on the floor (dust ring + dizzy stars), k = 0..1 remaining
BASH_ART.junkbot(ctx, jb, t)           // the boss from its object: parts present/absent, stage, hurtT flash, coreOpen (stage 4), beam (beamT>0 → beam from the hook hand to beamX/beamY), mood; bullseye pulse on the next part (jb.nextPart: 'sign'|'tireL'|'tireR'|'core')
BASH_ART.arcadeDoor(ctx, cx, g, t, o = {}) // arcade cabinet on a tire base, screen with a bouncing ball, flashing BASH marquee, face; o.glow
```

Style rules: POW/RAINBOW palettes for blocks (`plain` cycles RAINBOW by `b.seed % 6`); `tough` = grey-blue riveted metal (#7f8aa0 / #4f5870) with a grumpy face, dents drawn as dark arcs, `hp` 2 → one dent, 1 → two dents + `dizzy`; `candy` = pink (#ff7fbf) crate with a candy sticker; `power` = POW.power with a ⭐ and a pulsing glow; `rainbow` = 6 vertical RAINBOW stripes + starry eyes; `boom` = red drum (#e0463a) with yellow band + a fuse sparkle; `split` = two faces side by side; `runner` = plain colour with 4 little legs (animate when `b.runT > 0`); `faller` = a chain from the block top up to the rail with a hook; `surprise` = yellow toolbox with a bouncing "?". Every face uses `drawFace(ctx, cx, cy, size, mood, t, seed)`. Nothing reads `game`.

- [ ] **Step 1: Write the pack** (~400 lines). Each function draws inside `ctx.save()/restore()`.
- [ ] **Step 2: Contact sheets.** Using the screenshot-overlay trick (wrap `render` to draw on top after the game frame — see memory "Screenshot overlay trick"), produce:
  - `tools/screenshot.sh bash-sheet-blocks "game.startLevel('blockbash'); game.introT=99; step(5); const _r=render; render=()=>{_r(); const ctx=document.getElementById('game').getContext('2d'); ctx.fillStyle='#222'; ctx.fillRect(0,0,1280,720); const kinds=['plain','tough','candy','power','rainbow','boom','split','runner','faller','surprise']; kinds.forEach((k,i)=>{ for(let hp=1;hp<=(k==='tough'?3:1);hp++){ BASH_ART.block(ctx,{x:64+i*112,y:120+hp*70,w:96,h:48,kind:k,hp,maxHp:k==='tough'?3:(k==='runner'?2:1),alive:true,landed:true,hitT:0,seed:i,row:0,col:i,vx:0,runT:0,falling:false,vy:0,wobble:0},1.2);} }); };"` — all ten kinds + tough damage states, at in-game size.
  - `bash-sheet-ball-caps`: balls r 18 and 32 in each mood/rainbow/boom, the 7 capsules, 8 mod icons, tire, junk 0..5, plow, splat.
  - `bash-sheet-bot`: the junkbot at each stage (all parts → sign gone → tires gone → core open), with beam on.
  - `bash-sheet-scene`: backdrop + floor + walls + rail + crane + net + the door.
- [ ] **Step 3: LOOK at every PNG** and fix anything unreadable at size (this is what caught the four-eyed frog). Every kind must be distinguishable from every other at a glance; faces must have two eyes and one mouth.
- [ ] **Step 4: `node --check js/bashart.js`, harness still green. Commit** `art: Block Bash pack (blocks, ball, capsules, junkbot, junkyard scene)`.

---

### Task 4: Audio — the `bash*` sfx cluster and the `arcade` song

**Files:** Modify `js/audio.js` (sfx switch ~114-196, `SONGS` ~6+).
**Interfaces (Produces):** sfx names `bashhit` (accepts `AudioSys.sfx('bashhit')`; pitch from `AudioSys.bashCombo` (0..8) set by the machine), `bashbreak`, `bashmiss`, `bashbump`, `bashpow`, `bashclank`, `bashroar`, `bashsplit`; `SONGS.arcade`.

- [ ] **Step 1:** Add to the sfx switch, modelled on the Beat Bash cluster (one-liners using `this.tone/noise/arp`):
```js
      case 'bashhit': { const k = Math.min(8, this.bashCombo || 0); this.tone(520 + k * 60, 780 + k * 60, 0.07, 'square', 0.16); break; } // ball on block, rises with combo
      case 'bashbreak': this.noise(0.09, 0.22, 0, 2200); this.tone(300, 120, 0.12, 'triangle', 0.18); break;                         // block crumbles
      case 'bashmiss': this.tone(240, 60, 0.35, 'sawtooth', 0.2); this.noise(0.25, 0.25, 0.05, 900); break;                          // splat
      case 'bashbump': this.tone(180, 620, 0.16, 'square', 0.22); break;                                                              // hop BUMP!
      case 'bashpow': this.arp([72, 76, 79, 84], 0.05, 0.12, 'square', 0.18); break;                                                  // capsule caught
      case 'bashclank': this.tone(900, 300, 0.12, 'square', 0.16); this.noise(0.1, 0.18, 0, 4000); break;                              // crane / bot part
      case 'bashroar': this.tone(90, 60, 0.6, 'sawtooth', 0.3); this.noise(0.5, 0.2, 0.05, 500); break;                               // junkbot
      case 'bashsplit': this.arp([76, 83, 88], 0.04, 0.1, 'triangle', 0.2); break;                                                    // extra ball
```
and `this.bashCombo = 0;` in the AudioSys init. Add `SONGS.arcade` = a 160-bpm square-wave chiptune (16-32 eighth notes in a bright major loop, bass on roots, `h: true`, `mw: 'square'`), following the existing entry format exactly.
- [ ] **Step 2:** Harness check: `check('audio: every bash sfx name is handled', vm.runInContext("['bashhit','bashbreak','bashmiss','bashbump','bashpow','bashclank','bashroar','bashsplit'].every(n => { try { AudioSys.sfx(n); return true; } catch (e) { return false; } }) && !!SONGS.arcade", sandbox));` — the stub AudioContext swallows calls; a typo in a helper name throws.
- [ ] **Step 3:** Harness green; commit `audio: Block Bash sfx cluster + arcade chiptune`.

---

### Task 5: Ball, paddle bounce, blocks (10 kinds), candy drops, combo, the funny miss

**Files:** Modify `js/blockbash.js`; test in `test/harness.js` (extend the Block Bash block).
**Interfaces:**
- Consumes: `BB`, `BASH_ART.*`, `Mods`, `ArcadeHud`, `arcadePayout/arcadePayTick`, sfx names from Task 4.
- Produces (fields/methods on `BlockBash` other tasks rely on): `balls[]`, `blocks[]`, `candies[]`, `debris[]`, `mods` (Mods), `hud` (ArcadeHud), `combo`, `phaseSpeed` (number), `launchT`, `respawnT`, `splat`, `spawnBall(x, y, rest)`, `launch(ball)`, `addBlock(col, row, kind) → block`, `breakBlock(b, cause)`, `hitBlock(b, ball)`, `explodeAt(x, y, radius)`, `loseBall(ball)`, `ballSpeed(ball)`, `stepBall(ball, dt)`, `aliveBlocks()`, `onBlockBroken(b)` (hook Task 6/7 override: default no-op), `dropCandy(x, y, n)`.

- [ ] **Step 1: Failing harness checks** (append inside the Block Bash block, after the hop checks and BEFORE the forced-win exit; re-enter the level fresh at the start of this section with `vm.runInContext("game.startLevel('blockbash')", sandbox); frames(200);` so the door checks stay independent):
```js
vm.runInContext("game.startLevel('blockbash')", sandbox); frames(200);
const bbS = () => vm.runInContext(`(() => { const a = game.level.arcade; return { balls: a.balls.map(b => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, r: b.r, rest: b.rest, speed: b.speed })), blocks: a.aliveBlocks().length, combo: a.combo, respawnT: a.respawnT, candies: a.candies.length, splat: !!a.splat, mods: a.mods.list().map(m => m.name) }; })()`, sandbox);
check('blockbash: a ball rests on the truck roof at the start', bbS().balls.length === 1 && bbS().balls[0].rest);
frames(100);
check('blockbash: the ball auto-launches within 1.6 s (never stalls)', !bbS().balls[0].rest && bbS().balls[0].vy < 0);
// paddle bounce: drop a ball straight onto the roof centre
vm.runInContext("(() => { const a = game.level.arcade, pl = game.player; a.balls.length = 0; const b = a.spawnBall(pl.cx, pl.y - 60, false); b.vx = 0; b.vy = 400; b.speed = 400; })()", sandbox);
frames(12);
check('blockbash: a falling ball bounces UP off the truck roof', bbS().balls[0].vy < 0 && bbS().balls[0].y < 620 - 96 - 10);
vm.runInContext("(() => { const a = game.level.arcade, pl = game.player; a.balls.length = 0; const b = a.spawnBall(pl.x + pl.w - 4, pl.y - 60, false); b.vx = 0; b.vy = 400; b.speed = 400; })()", sandbox);
frames(12);
check('blockbash: hitting the right edge of the roof sends the ball rightward', bbS().balls[0].vx > 120 && bbS().balls[0].vy < 0);
// hop BUMP: ball falling onto a rising truck gets faster
vm.runInContext("(() => { const a = game.level.arcade, pl = game.player; a.balls.length = 0; const b = a.spawnBall(pl.cx, pl.y - 40, false); b.vx = 0; b.vy = 400; b.speed = 400; })()", sandbox);
tap('ArrowUp'); frames(6);
check('blockbash: a hop BUMP speeds the ball up (≤ cap)', bbS().balls[0].speed > 400 && bbS().balls[0].speed <= 620);
// block kinds — a helper that clears the board, adds one block and fires the ball at it
const bbShoot = (kind, col = 5, row = 2, extra = '') => vm.runInContext(`(() => { const a = game.level.arcade; a.blocks.length = 0; a.balls.length = 0; a.candies.length = 0; a.mods.clearAll(); const b = a.addBlock(${col}, ${row}, '${kind}'); ${extra}; const ball = a.spawnBall(b.x + b.w / 2, b.y + b.h + 80, false); ball.vx = 0; ball.vy = -400; ball.speed = 400; return b; })()`, sandbox);
bbShoot('plain'); const c0 = G().candy; frames(20);
check('blockbash: a plain block breaks in one hit and pays 1 candy', bbS().blocks === 0 && G().candy === c0 + 1);
bbShoot('tough'); frames(20);
check('blockbash: a tough block takes the first hit (hp 3 → 2) and bounces the ball back down', bbS().blocks === 1 && vm.runInContext('game.level.arcade.blocks[0].hp', sandbox) === 2 && bbS().balls[0].vy > 0);
vm.runInContext("(() => { const a = game.level.arcade; for (let i = 0; i < 2; i++) { const b = a.blocks[0]; const ball = a.balls[0]; ball.x = b.x + 48; ball.y = b.y + b.h + 30; ball.vx = 0; ball.vy = -400; } })()", sandbox); frames(15);
vm.runInContext("(() => { const a = game.level.arcade; const b = a.blocks[0]; if (b && b.alive) { const ball = a.balls[0]; ball.x = b.x + 48; ball.y = b.y + b.h + 30; ball.vx = 0; ball.vy = -400; } })()", sandbox); frames(15);
check('blockbash: three hits break the tough block', bbS().blocks === 0);
bbShoot('candy'); frames(20);
check('blockbash: a candy crate bursts into 5 candy pickups', bbS().blocks === 0 && bbS().candies === 5);
frames(200);
check('blockbash: candy drifts to the truck and is collected (or lies on the floor harmlessly, then fades)', bbS().candies <= 5 && G().player.hearts === 3);
frames(400);
check('blockbash: floor candy never lingers past 6 s', bbS().candies === 0);
bbShoot('split'); frames(20);
check('blockbash: a split block releases an extra ball', bbS().balls.length === 2);
bbShoot('boom', 5, 2, "a.addBlock(4, 2, 'plain'); a.addBlock(6, 2, 'plain'); a.addBlock(5, 1, 'plain'); a.addBlock(9, 2, 'plain')"); frames(20);
check('blockbash: a boom barrel blasts its neighbours but not a far block', bbS().blocks === 1);
bbShoot('boom', 5, 2, "a.addBlock(6, 2, 'boom'); a.addBlock(7, 2, 'plain'); a.addBlock(8, 2, 'plain')"); frames(30);
check('blockbash: barrels chain-react', bbS().blocks <= 1);
bbShoot('runner'); const rx0 = vm.runInContext('game.level.arcade.blocks[0].x', sandbox); frames(60);
check('blockbash: a runner scoots 2 columns along its row after the first hit and survives', bbS().blocks === 1 && Math.abs(vm.runInContext('game.level.arcade.blocks[0].x', sandbox) - rx0) >= 180);
bbShoot('faller'); frames(10);
check('blockbash: a hit faller drops', vm.runInContext('game.level.arcade.blocks[0].falling', sandbox) === true);
vm.runInContext("game.player.x = game.level.arcade.blocks[0].x + 48 - game.player.w / 2", sandbox); const c1 = G().candy; frames(120);
check('blockbash: the truck catching a faller pays 5 candy', G().candy >= c1 + 5 && bbS().blocks === 0);
bbShoot('rainbow', 5, 3, "a.addBlock(5, 2, 'plain'); a.addBlock(5, 1, 'plain'); a.addBlock(5, 0, 'plain')"); frames(40);
check('blockbash: a rainbow block turns the ball RAINBOW and it pierces the whole column', bbS().mods.includes('rainbow') && bbS().blocks === 0);
// combo
bbShoot('plain', 5, 4, "for (let r = 0; r < 4; r++) a.addBlock(5, r, 'plain')"); frames(60);
check('blockbash: consecutive hits without touching the truck build a combo', bbS().combo >= 3);
// the funny miss
vm.runInContext("(() => { const a = game.level.arcade; a.blocks.length = 0; a.addBlock(2, 0, 'plain'); a.balls.length = 0; const b = a.spawnBall(300, 500, false); b.vx = 0; b.vy = 500; b.speed = 500; game.player.x = 1000; })()", sandbox);
frames(30);
check('blockbash: a missed ball SPLATS into the junk floor (no hearts lost, blocks intact)', bbS().splat && bbS().balls.length === 0 && bbS().blocks === 1 && G().player.hearts === 3);
frames(60);
check('blockbash: the ball is back on the roof within ~1 s of the splat', bbS().balls.length === 1 && bbS().balls[0].rest);
// anti-tunnel: 200 max-speed random shots at a block edge and the truck corner
check('blockbash: no ball ever tunnels through a block or the truck at max speed', vm.runInContext(`(() => {
  const a = game.level.arcade; let bad = 0;
  for (let i = 0; i < 200; i++) {
    a.blocks.length = 0; a.balls.length = 0; const b = a.addBlock(5, 2, 'tough'); b.hp = 99;
    const ang = rand(0, Math.PI * 2); const ball = a.spawnBall(b.x + 48 + Math.cos(ang) * 140, b.y + 24 + Math.sin(ang) * 140, false);
    ball.speed = 620; ball.vx = -Math.cos(ang) * 620; ball.vy = -Math.sin(ang) * 620;
    for (let f = 0; f < 20; f++) a.stepBall(ball, 1 / 60);
    const cx = clamp(ball.x, b.x, b.x + b.w), cy = clamp(ball.y, b.y, b.y + b.h);
    if (Math.hypot(ball.x - cx, ball.y - cy) < ball.r - 1) bad++;
  }
  a.blocks.length = 0;
  const pl = game.player;
  for (let i = 0; i < 200; i++) {
    a.balls.length = 0; const ball = a.spawnBall(pl.x + (i % 2 ? pl.w + 10 : -10) + rand(-6, 6), pl.y - 90, false);
    ball.speed = 620; ball.vx = (i % 2 ? -1 : 1) * rand(60, 300); ball.vy = Math.sqrt(620 * 620 - ball.vx * ball.vx);
    for (let f = 0; f < 20; f++) a.stepBall(ball, 1 / 60);
    if (ball.y + ball.r > pl.y + 20 && ball.x > pl.x && ball.x < pl.x + pl.w && ball.y < pl.y + pl.h) bad++;
  }
  return bad === 0;
})()`, sandbox));
```
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement.** Core pieces (write these in full; the rest follows the spec §4–§7):

```js
  // ---- balls
  spawnBall(x, y, rest) {
    const b = { x, y, r: this.mods.has('giant') ? BB.GIANT_R : BB.BALL_R, vx: 0, vy: 0, speed: this.phaseSpeed, rest, bumpT: 0, squash: 1, mood: 'happy', trail: [] };
    this.balls.push(b); return b;
  }
  ballSpeed(b) { // target speed this frame: phase × slow × bump, hard-capped
    return Math.min(BB.CAP, this.phaseSpeed * (this.mods.has('slow') ? 0.55 : 1) * (b.bumpT > 0 ? BB.BUMP : 1));
  }
  steer(b) { // re-normalise to target speed; enforce min vertical + min horizontal components
    const sp = this.ballSpeed(b); b.speed = sp;
    let ang = Math.atan2(b.vy, b.vx);
    const minV = Math.asin(BB.MIN_VY), minH = Math.asin(BB.MIN_VX);
    const c = Math.cos(ang), s = Math.sin(ang);
    if (Math.abs(s) < BB.MIN_VY) ang = c > 0 ? (s >= 0 ? minV : -minV) : (s >= 0 ? Math.PI - minV : -Math.PI + minV);
    if (Math.abs(Math.cos(ang)) < BB.MIN_VX) ang = ang > 0 ? Math.PI / 2 - minH * Math.sign(c || 1) : -Math.PI / 2 + minH * Math.sign(c || 1);
    b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
  }
  launch(b) {
    const left = this.aliveBlocks().filter(k => k.x + k.w / 2 < W / 2).length, right = this.aliveBlocks().length - left;
    const a = -Math.PI / 2 + (right > left ? 1 : right < left ? -1 : (Math.random() < 0.5 ? -1 : 1)) * rand(0.15, 0.35);
    b.rest = false; b.vx = Math.cos(a) * this.phaseSpeed; b.vy = Math.sin(a) * this.phaseSpeed; this.steer(b);
    AudioSys.sfx('whoosh');
  }
  // circle-vs-AABB: returns null or { nx, ny, depth } (axis-aligned normal chosen by penetration)
  hitBox(b, s) {
    const cx = clamp(b.x, s.x, s.x + s.w), cy = clamp(b.y, s.y, s.y + s.h);
    const dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy;
    if (d2 >= b.r * b.r) return null;
    if (d2 > 1e-6) { const d = Math.sqrt(d2); return Math.abs(dx) >= Math.abs(dy) ? { nx: Math.sign(dx), ny: 0, depth: b.r - d } : { nx: 0, ny: Math.sign(dy), depth: b.r - d }; }
    const px = Math.min(b.x - s.x, s.x + s.w - b.x), py = Math.min(b.y - s.y, s.y + s.h - b.y); // centre inside
    return px < py ? { nx: b.x < s.x + s.w / 2 ? -1 : 1, ny: 0, depth: px + b.r } : { nx: 0, ny: b.y < s.y + s.h / 2 ? -1 : 1, depth: py + b.r };
  }
  reflect(b, h) { b.x += h.nx * h.depth; b.y += h.ny * h.depth; if (h.nx) b.vx = Math.abs(b.vx) * h.nx; if (h.ny) b.vy = Math.abs(b.vy) * h.ny; b.squash = 0.7; }
  stepBall(b, dt) {
    if (b.rest) return;
    const sp = Math.hypot(b.vx, b.vy) || 1, n = Math.max(1, Math.ceil(sp * dt / 8)), h = dt / n;
    for (let i = 0; i < n; i++) {
      b.x += b.vx * h; b.y += b.vy * h;
      if (b.x - b.r < BB.L) { b.x = BB.L + b.r; b.vx = Math.abs(b.vx); AudioSys.sfx('bounce'); }
      if (b.x + b.r > BB.R) { b.x = BB.R - b.r; b.vx = -Math.abs(b.vx); AudioSys.sfx('bounce'); }
      if (b.y - b.r < BB.TOP) { b.y = BB.TOP + b.r; b.vy = Math.abs(b.vy); AudioSys.sfx('bounce'); }
      // paddle: only from above, only while descending
      const p = this.paddleBox();
      if (b.vy > 0 && b.x + b.r > p.x && b.x - b.r < p.x + p.w && b.y + b.r >= p.y && b.y - b.r < p.y + 34) { this.paddleHit(b, p); continue; }
      if (this.net && b.vy > 0 && b.y + b.r >= BB.FLOOR - 14) { b.y = BB.FLOOR - 14 - b.r; b.vy = -Math.abs(b.vy); this.netHit(b); }
      // blocks: first overlap wins this substep
      for (const k of this.blocks) {
        if (!k.alive || !k.landed || k.falling) continue;
        const hit = this.hitBox(b, k); if (!hit) continue;
        if (this.mods.has('rainbow')) { this.hitBlock(k, b, true); } else { this.reflect(b, hit); this.hitBlock(k, b, false); }
        break;
      }
      if (this.junkbot && this.junkbot.hit) this.junkbot.hit(b); // Task 8
    }
    this.steer(b);
  }
  paddleHit(b, p) {
    const pl = game.player;
    const off = clamp((b.x - (p.x + p.w / 2)) / (p.w / 2), -1, 1);
    const a = -Math.PI / 2 + off * (65 * Math.PI / 180);
    b.y = p.y - b.r; b.bumpT = 0;
    if (this.hopRising()) { b.bumpT = 1.5; this.hud.pop(b.x, b.y - 30, 'BUMP!', '#ffe156', 36); AudioSys.sfx('bashbump'); pl.setMood('grin', 0.8); }
    else AudioSys.sfx('bounce');
    const sp = this.ballSpeed(b);
    b.vx = Math.cos(a) * sp + clamp(pl.vx, -520, 520) * 0.23; b.vy = Math.sin(a) * sp;
    if (b.vy > -sp * BB.MIN_VY) b.vy = -sp * BB.MIN_VY;
    this.steer(b); this.combo = 0; AudioSys.bashCombo = 0; b.squash = 0.65; pl.squash = 0.8;
  }
```
Blocks:
```js
  addBlock(col, row, kind) {
    const hp = kind === 'tough' ? 3 : kind === 'runner' ? 2 : 1;
    const b = { x: BB.GX + col * BB.BW, y: BB.GY + row * BB.BH, w: BB.BW, h: BB.BH, kind, hp, maxHp: hp, alive: true, landed: true, hitT: 0, seed: randi(0, 99), row, col, vx: 0, runT: 0, falling: false, vy: 0, wobble: 0 };
    this.blocks.push(b); return b;
  }
  aliveBlocks() { return this.blocks.filter(b => b.alive); }
  hitBlock(b, ball, pierce) {
    b.hitT = 0.25; this.combo++; AudioSys.bashCombo = this.combo; AudioSys.sfx('bashhit');
    if (this.combo >= 3) this.hud.pop(b.x + b.w / 2, b.y - 10, '×' + this.combo + '!', '#ffe156', 26);
    if (this.combo === 5) { game.candy += 5; Particles.candyBurst(b.x + b.w / 2, b.y, 4); }
    if (b.kind === 'runner' && b.hp === 2 && !pierce) { b.hp = 1; b.runT = 0.9; b.vx = (b.x + b.w / 2 < W / 2 ? 1 : -1) * 2 * BB.BW / 0.9; return; }
    if (b.kind === 'faller' && !pierce) { b.falling = true; b.vy = 0; return; }
    b.hp -= pierce ? 99 : (this.mods.has('boom') ? 99 : 1);
    if (b.hp <= 0) this.breakBlock(b, 'ball'); else AudioSys.sfx('clank');
    if (this.mods.has('boom') && b.kind !== 'boom') this.explodeAt(b.x + b.w / 2, b.y + b.h / 2, BB.BW * 1.5);
  }
  breakBlock(b, cause) {
    if (!b.alive) return; b.alive = false;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    AudioSys.sfx('bashbreak');
    Particles.burst(cx, cy, 10, { colors: ['#fff', '#ffe156', RAINBOW[b.seed % 6]], type: 'block', sp1: 300, l1: 0.8, s1: 10, grav: 700 });
    const pay = b.kind === 'tough' ? 3 : 1;
    if (b.kind === 'candy') this.dropCandy(cx, cy, 5); else { game.candy += pay; this.hud.pop(cx, cy, '+' + pay, '#ffd24a', 24); }
    if (b.kind === 'boom') this.explodeAt(cx, cy, BB.BW * 1.5);
    if (b.kind === 'split' && this.balls.length < BB.MAX_BALLS) { const nb = this.spawnBall(cx, cy + 30, false); nb.vx = rand(-200, 200); nb.vy = 300; this.steer(nb); AudioSys.sfx('bashsplit'); }
    if (b.kind === 'rainbow') { this.mods.add('rainbow', BB.MODS.rainbow); this.hud.banner('RAINBOW!', '#ff5fa2'); AudioSys.sfx('rainbow'); }
    if (b.kind === 'power') this.dropCapsule(cx, cy);     // Task 6 (define as a no-op stub now)
    if (b.kind === 'surprise') this.surprise(cx, cy);     // Task 6 (stub now)
    this.onBlockBroken(b);
  }
  explodeAt(x, y, radius) {
    game.shake = Math.max(game.shake, 0.3); AudioSys.sfx('boom');
    Particles.burst(x, y, 18, { colors: ['#ff9f43', '#ffe156', '#fff'], type: 'flame', sp1: 380, l1: 0.7, s1: 14, grav: -100 });
    for (const k of this.blocks) if (k.alive && k !== this.exploding && Math.hypot(k.x + k.w / 2 - x, k.y + k.h / 2 - y) <= radius) this.breakBlock(k, 'boom');
  }
```
(Guard recursion: `breakBlock` sets `alive = false` BEFORE `explodeAt`, so chains terminate.)
Miss: in `update`, after stepping balls, for each ball with `y - r > BB.MISS_Y`: `loseBall(b)` — remove; if it was the last ball: `this.splat = { x: clamp(b.x, 80, 1200), y: BB.FLOOR, t: 1 }`, `this.respawnT = BB.RESPAWN`, debris burst (3 `BASH_ART.junk` pieces pushed to `debris[]` with random kinds/velocities, gravity 900, 1.2 s life), `AudioSys.sfx('bashmiss'); AudioSys.sfx('muffhonk');`, `game.player.setMood('surprised', 0.6)`, `mods.clear('rainbow')`, combo reset. When `respawnT` hits 0: `spawnBall(pl.cx, pl.y - r, true)`, `launchT = BB.LAUNCH_AUTO`. Resting balls follow the truck (`b.x = pl.cx; b.y = pl.y - b.r`), launch on `justP.Space` or when `launchT` expires. Candy drops: `dropCandy(x, y, n)` pushes n `{x, y, vx: rand(-160,160), vy: rand(-380,-120), onFloor: false, t: 0}`; update: gravity 900, drift toward the truck at `BB.CANDY_DRIFT` (magnet mod: 900 straight at it), land at `y ≥ BB.FLOOR - 10` → `onFloor`, `t` counts up, removed at `BB.FLOOR_CANDY_T`; collected when overlapping the paddle box → `game.candy++`, `candy` sfx, pop. Draw order in `draw`: splat, candies, blocks, debris, balls (trail then ball), (capsules Task 6), crane etc. `drawFront`: `hud.drawScreen(ctx, t, chips)` where chips map `mods.list()` to `{ frac: mods.frac(name), icon: (ctx,x,y,s) => BASH_ART.modIcon(ctx,x,y,s,name) }`; `hud.drawWorld` inside `draw`. `phaseSpeed = BB.SPEED[0]` for now; `booted` also seeds an initial resting ball. `update` also runs `mods.update(dt)`, `hud.update(dt)`, `arcadePayTick(this, dt)`, block timers (`hitT`, runner slide with wall/block stop, faller fall at gravity 900 → truck catch pays 5 via `dropCandy`-free direct `game.candy += 5` + pop, floor → `breakBlock(b,'floor')` with no candy).
- [ ] **Step 4: Harness green 2×.** **Step 5: Screenshots** `bash-play` (a few blocks + ball mid-flight), `bash-miss` (force a miss then step 10). **Step 6: Commit** `feat(blockbash): ball physics, truck paddle, 10 block kinds, candy, combos, the funny miss`.

---

### Task 6: Capsules & mods, the crane, environmental events, tires, net, plow

**Files:** Modify `js/blockbash.js`; harness.
**Interfaces:**
- Consumes: Task 5 fields; `BASH_ART.capsule/modIcon/tire/net/plow/crane`; `Spawner`.
- Produces: `capsules[]`, `tires[]`, `net` (null | `{ t }`), `crane` (`{ x, y, target, holding, mode: 'idle'|'snatch'|'clear', t }`), `dropCapsule(x, y, kind?)`, `applyMod(kind)`, `surprise(x, y)` (fires one of `eventTire()`, `eventSnatch()`, `eventConveyor()`, `eventTower()`), `conveyorRows` (Set of row indexes with a `dir`), `craneClearOne()`.

- [ ] **Step 1: Failing checks** (append):
```js
const bbCatch = (kind) => { vm.runInContext(`(() => { const a = game.level.arcade, pl = game.player; a.capsules.length = 0; a.mods.clearAll(); a.balls.length = 0; a.spawnBall(pl.cx, pl.y - 20, true); a.capsules.push({ x: pl.cx, y: pl.y - 40, kind: '${kind}', vy: 220, t: 0 }); })()`, sandbox); frames(10); };
bbCatch('wide'); check('blockbash: catching WIDE bolts a plow on and widens the paddle', bbS().mods.includes('wide') && vm.runInContext('game.level.arcade.paddleBox().w', sandbox) > 104 * 1.5);
bbCatch('giant'); check('blockbash: GIANT grows every ball to r 32', bbS().mods.includes('giant') && bbS().balls.every(b => b.r === 32));
bbCatch('slow'); vm.runInContext('game.level.arcade.launch(game.level.arcade.balls[0])', sandbox); frames(2);
check('blockbash: SLOW-MO halves the ball speed', bbS().mods.includes('slow') && bbS().balls[0].speed < 380 * 0.6);
bbCatch('multi'); check('blockbash: MULTI splits into 3 balls', bbS().balls.length === 3);
bbCatch('net'); vm.runInContext("(() => { const a = game.level.arcade; a.balls.length = 0; const b = a.spawnBall(300, 560, false); b.vx = 0; b.vy = 400; b.speed = 400; game.player.x = 1000; })()", sandbox); frames(15);
check('blockbash: the JUNK NET bounces a missed ball back up', bbS().balls.length === 1 && bbS().balls[0].vy < 0 && !bbS().splat);
bbCatch('magnet'); vm.runInContext("game.level.arcade.dropCandy(200, 300, 3)", sandbox); frames(40);
check('blockbash: the MAGNET pulls candy straight to the truck', bbS().candies === 0);
bbCatch('boom'); bbShoot('plain', 5, 2, "a.addBlock(4, 2, 'plain'); a.addBlock(6, 2, 'plain'); a.mods.add('boom', 8)"); frames(20);
check('blockbash: a BOOM BALL blasts neighbours on every hit', bbS().blocks === 0);
// power block → capsule → chip
bbShoot('power'); frames(20);
check('blockbash: a power block drops a capsule', vm.runInContext('game.level.arcade.capsules.length', sandbox) === 1);
// events
vm.runInContext("game.level.arcade.eventTire()", sandbox); vm.runInContext("(() => { const a = game.level.arcade; a.tires[0].x = game.player.cx; })()", sandbox); frames(5);
check('blockbash: a giant tire spins the truck out briefly (no damage)', vm.runInContext('game.level.arcade.spinT', sandbox) > 0 && G().player.hearts === 3);
frames(60); check('blockbash: the spin-out ends and control returns', vm.runInContext('game.level.arcade.spinT', sandbox) <= 0);
vm.runInContext("(() => { const a = game.level.arcade; a.balls.length = 0; const b = a.spawnBall(600, 300, false); b.vx = 100; b.vy = -300; a.steer(b); a.eventSnatch(); })()", sandbox); frames(150);
check('blockbash: the crane SNATCH grabs the ball and flings it — never lost', bbS().balls.length === 1 && !bbS().splat);
vm.runInContext("(() => { const a = game.level.arcade; a.blocks.length = 0; for (let c = 0; c < 4; c++) a.addBlock(c, 1, 'plain'); a.eventConveyor(1); })()", sandbox); const cvx = vm.runInContext('game.level.arcade.blocks[0].x', sandbox); frames(30);
check('blockbash: a CONVEYOR slides a whole row', vm.runInContext('game.level.arcade.blocks[0].x', sandbox) !== cvx && vm.runInContext('game.level.arcade.blocks.every(b => b.vx === game.level.arcade.blocks[0].vx)', sandbox));
vm.runInContext("game.level.arcade.candies.length = 0; game.level.arcade.eventTower()", sandbox); frames(180);
check('blockbash: a JUNK TOWER topples into free candy', vm.runInContext('game.level.arcade.candies.length + game.level.arcade.towerCandy', sandbox) >= 3);
vm.runInContext("(() => { const a = game.level.arcade; a.blocks.length = 0; a.addBlock(3, 0, 'plain'); a.addBlock(8, 0, 'tough'); a.craneClearOne(); })()", sandbox); frames(200);
check('blockbash: the crane CLEAR yanks one leftover block (and pays for it)', bbS().blocks === 1);
```
- [ ] **Step 2: FAIL. Step 3: Implement** per spec §6, §8:
  - `dropCapsule(x, y, kind)`: kind from a phase-weighted table `CAP_WEIGHTS[phase]` (phase 0: `{multi:3, wide:3, net:3, slow:2, giant:1, magnet:2, boom:0}`, phase 1: `{multi:3, wide:2, net:2, slow:2, giant:2, magnet:2, boom:1}`, phase 2+: `{multi:3, wide:2, net:2, slow:1, giant:3, magnet:2, boom:3}`); capsule falls at `BB.CAPSULE_VY`; caught when overlapping the paddle box → `applyMod(kind)`; lost at `y > BB.FLOOR + 30`.
  - `applyMod`: `multi` → for each ball (≤ MAX_BALLS) spawn 2 more at ±35° (banner "MULTI BALL!"); `giant` → `mods.add('giant', 10)`, set every ball `r = GIANT_R`, on expire `r = BALL_R`; `wide` → `mods.add('wide', 12)`, `wideK = 1.6` (expire → 1); `boom`, `magnet`, `slow` → mods; `net` → `mods.add('net', 12)`, `this.net = { t: 12 }` (getter uses `mods.has('net')`). Toast: `hud.banner(NAME)` + `BASH_ART.modIcon` pop above the truck (`this.toast = { kind, t: 1 }`) + `bashpow`. Mods `onExpire` handles giant/wide resets.
  - Crane object always exists: idle drifts slowly along the rail (x eased toward a wander target); `eventSnatch()`: mode 'snatch', target = nearest ball; drives at 700 px/s over it, descends, `holding` the ball for 0.8 s (ball `held = true` → `stepBall` skips it, ball follows the magnet), then flings at a random downward-ish angle (`vy > 0` ensured NOT: fling upward-sideways so it's never an instant miss: angle in [-150°, -30°]) with `steer`; `craneClearOne()`: mode 'clear', target = random alive landed block; drive over, descend, `breakBlock(b, 'crane')` with `bashclank`; back to idle.
  - `eventTire()`: push `{ x: side ? BB.L : BB.R, y: BB.FLOOR, r: 62, vx: side ? 380 : -380, rot: 0 }`; update rolls; overlapping the truck box (and `spinT <= 0`) → `spinT = 0.5`, `tireboom`, stars burst; removed past the far wall.
  - `eventConveyor(row)`: `conveyorRows.set(row, dir)`; each frame blocks in that row get `x += dir * 60 * dt`, wrap at the walls (x < BB.L → x += span; x + w > BB.R → x -= span; span = BB.R - BB.L). Runner sliding uses `b.vx` with stop at walls/other blocks; conveyor uses the row map so both coexist.
  - `eventTower()`: spawn 3 plain blocks stacked at a wall column (col 0 or 11, rows 4,3,2) marked `tower: true`, `landed: false`, dropping in from the rail; 1.2 s after landing they topple: `breakBlock` each in sequence 0.25 s apart with `dropCandy(…, 1)` each (the harness reads `towerCandy` = count of candy dropped by towers this level — increment it there).
  - `surprise(x, y)`: pick one of the four uniformly (cycle a shuffled bag so all four show in a run), banner "SURPRISE!".
  - Draw: capsules, tires, net (`BASH_ART.net(ctx, BB.FLOOR - 14, t, mods.frac('net'))`), plow when wide (`BASH_ART.plow` at the truck front, drawn in `draw` AFTER the player? The player draws after `lv.arcade.draw`, so draw the plow in `drawFront` in world space — the camera is pinned so screen = world), crane on top of blocks.
- [ ] **Step 4: Harness green 2×. Step 5: Screenshots** `bash-capsule` (a capsule falling + wide plow on + chips), `bash-tire`. **Step 6: Commit** `feat(blockbash): capsules + mods, crane, surprise events, giant tire, junk net, plow`.

---

### Task 7: Waves, escalation, build-in, anti-stall, intro hints

**Files:** Modify `js/blockbash.js`; harness.
**Interfaces:**
- Consumes: `WaveRunner`, everything above.
- Produces: `WAVES` (array of 4 wave defs `{ par, build() }`), `waves` (WaveRunner), `phase` (0..3), `phaseSpeed` follows `BB.SPEED[phase]`, `onWavesDone()` (Task 8 replaces with the boss entrance; default sets `state = 'done'`), `startWaves()`.

- [ ] **Step 1: Failing checks:**
```js
vm.runInContext("game.startLevel('blockbash')", sandbox); frames(200);
check('blockbash: wave 1 = 2 rows of plain blocks + a candy crate, ball 380', vm.runInContext("(() => { const a = game.level.arcade; const k = a.aliveBlocks(); return a.waves.i === 0 && k.length === 24 && k.filter(b => b.kind === 'candy').length === 1 && k.every(b => b.kind === 'plain' || b.kind === 'candy') && a.phaseSpeed === 380; })()", sandbox));
check('blockbash: blocks rain in and are unhittable until landed', vm.runInContext("game.level.arcade.blocks.some(b => !b.landed)", sandbox) || vm.runInContext("game.level.arcade.waves.state", sandbox) !== 'build');
frames(80);
check('blockbash: after the build-in every block has landed on its grid spot', vm.runInContext("game.level.arcade.blocks.every(b => b.landed && Math.abs(b.y - (BB.GY + b.row * BB.BH)) < 0.5)", sandbox));
// clear wave 1 by force → flourish → wave 2 arrives with power-ups
vm.runInContext("(() => { const a = game.level.arcade; for (const b of a.blocks) a.breakBlock(b, 'test'); })()", sandbox); frames(10);
check('blockbash: clearing the board starts the WAVE CLEAR flourish', vm.runInContext("game.level.arcade.waves.state", sandbox) === 'clear' && vm.runInContext("game.level.arcade.hud.bannerText", sandbox) !== null);
frames(200);
check('blockbash: wave 2 brings power/candy/split/tough blocks and speed 430', vm.runInContext("(() => { const a = game.level.arcade, ks = a.aliveBlocks().map(b => b.kind); return a.waves.i === 1 && ks.includes('power') && ks.includes('split') && ks.includes('tough') && a.phaseSpeed === 430; })()", sandbox));
// anti-stall: past par the crane starts clearing
vm.runInContext("(() => { const a = game.level.arcade; a.waves.stallT = 999; a.balls.forEach(b => { b.rest = true; }); })()", sandbox);
const nb0 = bbS().blocks; frames(60 * 6);
check('blockbash: past par the crane yanks leftover blocks — a wave can never stall', bbS().blocks < nb0);
vm.runInContext("(() => { const a = game.level.arcade; for (const b of a.blocks) a.breakBlock(b, 'test'); })()", sandbox); frames(210);
check('blockbash: wave 3 = moving junk (conveyor rows, fallers, runners, barrels, surprises), speed 480', vm.runInContext("(() => { const a = game.level.arcade, ks = a.aliveBlocks().map(b => b.kind); return a.waves.i === 2 && a.conveyorRows.size >= 2 && ks.includes('faller') && ks.includes('runner') && ks.includes('boom') && ks.includes('surprise') && a.phaseSpeed === 480; })()", sandbox));
vm.runInContext("(() => { const a = game.level.arcade; for (const b of a.blocks) a.breakBlock(b, 'test'); })()", sandbox); frames(210);
check('blockbash: wave 4 = CHAOS with rainbow blocks, 4 barrels, 2 balls, speed 520', vm.runInContext("(() => { const a = game.level.arcade, ks = a.aliveBlocks().map(b => b.kind); return a.waves.i === 3 && ks.filter(k => k === 'rainbow').length === 2 && ks.filter(k => k === 'boom').length >= 4 && a.balls.length >= 2 && a.phaseSpeed === 520; })()", sandbox));
check('blockbash: the ball speed cap holds under bump + chaos', vm.runInContext("(() => { const a = game.level.arcade; const b = a.balls[0]; b.rest = false; b.bumpT = 1; a.steer(b); return b.speed <= 620; })()", sandbox));
```
- [ ] **Step 2: FAIL. Step 3: Implement** `WAVES` exactly per spec §9 (wave 1: rows 0-1 all plain except col 5 row 1 candy = 24 blocks; wave 2: rows 0-2 with power at (2,0),(6,0),(10,0), candy (4,1),(8,1), split (6,1), tough (0,2),(11,2); wave 3: rows 0-3, `eventConveyor(1)` dir +1 and `eventConveyor(3)` dir −1 at build, fallers (3,0),(6,0),(9,0), runners (2,2),(9,2), boom (5,3),(6,3), surprise (1,1),(10,1), power (4,1),(7,1),(11,2); wave 4: rows 0-4 dense, rainbow (3,1),(8,1), boom (2,3),(5,3),(6,3),(9,3), split (4,2),(7,2), surprise (0,2),(11,2), power (1,0),(5,0),(6,0),(10,0), runners (2,4),(9,4), fallers (4,0),(7,0), all rows conveyors alternating dir, two towers at build, second ball spawned on `onPlay`). Build-in: `addBlock` during a wave build sets `landed = false`, `y = -60 - row * 30`, `vy = 0`; blocks fall at gravity 1400 to their grid y, bounce once (`vy = -180` when first reaching it) and settle (`landed = true`, `bashclank` occasionally). `WaveRunner` hooks: `onBuild(i)` → `phase = i; phaseSpeed = BB.SPEED[i]; hud.banner('WAVE ' + (i+1) + '!')`, collect every ball to the roof (`rest = true`), `isClear: () => aliveBlocks().filter(b => !b.tower).length === 0`, `onClear` → banner "WAVE CLEAR!", `cheer`, confetti burst, `onDone` → `this.onWavesDone()`. Stall: in `update`, `if (waves.pastPar() && crane.mode === 'idle') { stallAcc += dt; if (stallAcc >= BB.STALL_EVERY) { stallAcc = 0; craneClearOne(); } }`; ≤3 blocks left → `wobble` pulse. Intro: for the first 2 s after `booted`, draw a bobbing `drawSpacebar` above the truck and an `arrows` hint via `lv.hints` (push `{ x: 590, y: 380, icon: 'arrows' }` in buildLevel — remove it after the first launch by splicing `lv.hints`).
- [ ] **Step 4: Harness green 2×. Step 5: Screenshots** `bash-wave1`…`bash-wave4` (force `waves.i` via clearing) + `bash-buildin`. **Step 6: Commit** `feat(blockbash): four escalating waves, rain-in build, crane anti-stall`.

---

### Task 8: JUNKBOT finale, victory sequence, party & persistence

**Files:** Modify `js/blockbash.js`; harness.
**Interfaces:**
- Consumes: `BASH_ART.junkbot`, `Sequence`, `Spawner`, `arcadePayout`, `game.subWin`.
- Produces: `JunkBot` class (`update(dt, m)`, `hit(ball) → bool`, `box()`, fields per the shape), `state` transitions `'play' → 'boss' → 'victory' → 'done'`, `victory` (Sequence).

- [ ] **Step 1: Failing checks:**
```js
vm.runInContext("(() => { const a = game.level.arcade; a.waves.i = 3; a.blocks.length = 0; a.waves.state = 'play'; })()", sandbox); frames(10); frames(320); // 2 s clear flourish + the 1.4 s chain descent
check('blockbash: clearing wave 4 lowers the JUNKBOT on its chain', vm.runInContext("game.level.arcade.state === 'boss' && !!game.level.arcade.junkbot", sandbox) && G().level.music === 'arcade');
const JB = () => vm.runInContext('(() => { const j = game.level.arcade.junkbot; return { hp: j.hp, stage: j.stage, parts: { ...j.parts }, x: j.x, y: j.y, w: j.w, h: j.h }; })()', sandbox);
const bbHitBot = () => { vm.runInContext("(() => { const a = game.level.arcade, j = a.junkbot; a.balls.length = 0; const b = a.spawnBall(j.x + j.w / 2, j.y + j.h + 60, false); b.vx = 0; b.vy = -540; b.speed = 540; })()", sandbox); frames(12); };
const cB = G().candy; bbHitBot(); bbHitBot(); bbHitBot();
check('blockbash: three hits pop the SIGN shield off (+10 candy)', JB().hp === 9 && JB().parts.sign === false && G().candy >= cB + 10);
check('blockbash: junkbot attacks never hurt the truck', G().player.hearts === 3);
for (let i = 0; i < 3; i++) bbHitBot();
check('blockbash: six hits — left tire gone, stage 3 rolls tires', JB().parts.tireL === false && JB().stage >= 2);
vm.runInContext("game.level.arcade.junkbot.beam(game.level.arcade.balls[0] || game.level.arcade.spawnBall(600, 400, false))", sandbox); frames(120);
check('blockbash: the magnet beam grabs and flings the ball but never loses it', bbS().balls.length >= 1 && !bbS().splat);
for (let i = 0; i < 3; i++) bbHitBot();
check('blockbash: nine hits — the core opens', JB().parts.tireR === false && vm.runInContext('game.level.arcade.junkbot.coreOpen', sandbox) === true);
vm.runInContext("(() => { const j = game.level.arcade.junkbot; j.stallT = 61; })()", sandbox); const jy = JB().y; frames(5);
check('blockbash: 60 s without a hit and the junkbot droops closer', JB().y > jy || vm.runInContext('game.level.arcade.junkbot.droop', sandbox) > 0);
const cV = G().candy; for (let i = 0; i < 3; i++) bbHitBot();
check('blockbash: twelve hits start the VICTORY sequence', vm.runInContext("game.level.arcade.state", sandbox) === 'victory');
frames(60 * 9);
check('blockbash: the junk explosion + candy shower pay ≥ 100 and subWin fires', G().candy >= cV + 100 && G().endPhase === 'party' && G().miniDone.blockbash === true);
frames(320); tap('Space'); frames(10);
check('blockbash: back to the rally in the truck, nothing leaks', G().level.n === 7 && G().state === 'play' && G().level.arcade === null && G().player.vehicle === 'truck');
check('blockbash: the finished cabinet is a dormant trophy; walking over never re-enters', (() => { put(280 - 52, 620 - 96); frames(20); return G().level.n === 7; })());
tap('Space'); frames(10);
check('blockbash: standing on the trophy + Space replays the whole arcade', G().level.n === 'blockbash' && G().state === 'intro');
```
(Replace the Task 1 forced-win exit checks with these — delete the `game.subWin()` forcing.)
- [ ] **Step 2: FAIL. Step 3: Implement** per spec §10:
```js
class JunkBot {
  constructor() { this.w = BB.BOSS.W; this.h = BB.BOSS.H; this.x = W / 2 - this.w / 2; this.y = -this.h; this.hp = BB.BOSS.HP; this.stage = 1; this.parts = { sign: true, tireL: true, tireR: true, core: true }; this.coreOpen = false; this.hurtT = 0; this.mood = 'angry'; this.dir = 1; this.t = 0; this.stallT = 0; this.droop = 0; this.entering = true; this.beamT = 0; this.beamBall = null; this.beamX = 0; this.beamY = 0; this.hitCd = 0;
    this.drops = new Spawner(4, 0.8, () => this.dropJunk()); this.tires = new Spawner(9, 1, () => game.level.arcade.eventTire()); this.beams = new Spawner(8, 1, () => { const bs = game.level.arcade.balls.filter(b => !b.rest && !b.held); if (bs.length) this.beam(bs[0]); }); }
  get nextPart() { return this.parts.sign ? 'sign' : this.parts.tireL ? 'tireL' : this.parts.tireR ? 'tireR' : 'core'; }
  box() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update(dt, m) {
    this.t += dt; this.hurtT = Math.max(0, this.hurtT - dt); this.hitCd = Math.max(0, this.hitCd - dt);
    if (this.entering) { this.y = Math.min(BB.BOSS.YMIN, this.y + 300 * dt); if (this.y >= BB.BOSS.YMIN) { this.entering = false; AudioSys.sfx('bashroar'); game.shake = 0.3; } return; }
    const speed = 120 + this.stage * 45; this.x += this.dir * speed * dt;
    if (this.x < BB.BOSS.XMIN) { this.x = BB.BOSS.XMIN; this.dir = 1; } if (this.x > BB.BOSS.XMAX - this.w) { this.x = BB.BOSS.XMAX - this.w; this.dir = -1; } // body always inside x 200..1080
    this.y = BB.BOSS.YMIN + this.droop + Math.sin(this.t * 1.3) * (BB.BOSS.YMAX - BB.BOSS.YMIN) * 0.5;
    this.stallT += dt; if (this.stallT > BB.BOSS.STALL && this.droop < 120) { this.droop += 60; this.stallT = 0; }
    this.drops.update(dt); if (this.stage >= 2) this.tires.update(dt); if (this.stage >= 3) this.beams.update(dt);
    if (this.beamT > 0) { this.beamT -= dt; const b = this.beamBall; if (b) { b.x = lerp(b.x, this.beamX, 1 - Math.exp(-8 * dt)); b.y = lerp(b.y, this.beamY, 1 - Math.exp(-8 * dt)); if (this.beamT <= 0) { b.held = false; const a = rand(-150, -30) * Math.PI / 180; b.vx = Math.cos(a) * b.speed; b.vy = Math.sin(a) * b.speed; m.steer(b); this.beamBall = null; } } }
  }
  beam(ball) { this.beamT = 0.8; this.beamBall = ball; ball.held = true; this.beamX = this.x + this.w * 0.8; this.beamY = this.y + this.h + 40; AudioSys.sfx('bashclank'); }
  dropJunk() { const m = game.level.arcade; const cols = [...Array(BB.COLS).keys()].filter(c => !m.blocks.some(b => b.alive && b.col === c && b.row === 4)); if (!cols.length) return; const c = cols[randi(0, cols.length - 1)]; const b = m.addBlock(c, 4, Math.random() < 0.3 ? 'tough' : 'plain'); b.landed = false; b.y = this.y + this.h; if (Math.random() < 0.3) m.dropCapsule(b.x + 48, b.y); }
  hit(ball) {  // called from stepBall each substep; returns true when it bounced
    if (this.entering || ball.held || this.hitCd > 0) return false;
    const m = game.level.arcade, h = m.hitBox(ball, this.box()); if (!h) return false;
    m.reflect(ball, h); this.hitCd = 0.12; this.hurtT = 0.3; this.stallT = 0; this.hp--; AudioSys.sfx('bashhit'); Particles.burst(ball.x, ball.y, 8, { colors: ['#fff', '#ffe156'], type: 'sparkle', sp1: 260, l1: 0.5 });
    const popped = 12 - this.hp; if (popped % 3 === 0) { const part = this.nextPart; this.parts[part] = false; this.stage++; if (part === 'tireR') this.coreOpen = true; game.candy += 10; m.hud.pop(this.x + this.w / 2, this.y, '+10', '#ffd24a', 34); m.hud.banner(part === 'core' ? 'KA-BOOM!' : 'PART OFF!', '#ff9f43'); AudioSys.sfx('bashclank'); AudioSys.sfx('bashroar'); game.shake = Math.max(game.shake, 0.35); m.debris.push(...m.makeDebris(this.x + this.w / 2, this.y + this.h / 2, 5)); }
    if (this.hp <= 0) m.startVictory();
    return true;
  }
}
```
Wire: `onWavesDone()` → `state = 'boss'; junkbot = new JunkBot(); phaseSpeed = BB.SPEED[4]; hud.banner('JUNKBOT!', '#ff4d4d'); AudioSys.setMusic('boss')` — WAIT: `lv.music` is what `exitSub` restores, not the current song; `setMusic('boss')` is fine. The harness check above asserts `G().level.music === 'arcade'` (unchanged field). `stepBall` calls `this.junkbot.hit(b)` (already in Task 5). `startVictory()`: `state = 'victory'`, balls cleared, `mods.clearAll()`, `AudioSys.setMusic('win')`, `victory = new Sequence([...])` per spec §10 timings (wobble 1.2 s → parts rocket 1.5 s (spawn 8 debris + junk pieces on a timer) → explosion (`game.shake = 0.6`, `boom` + `tireboom`, 40 flame + 30 block particles, `flash = 1` drawn in `drawFront` as a white overlay fading over 0.5 s) → shower 2.5 s (`arcadePayout(this, 100, pl.cx, pl.y)`; also 24 `dropCandy` pickups with magnet forced on for spectacle) → fireworks 1.5 s (`firework` sfx + star bursts every 0.3 s) → final step `enter: () => game.subWin()`); `update` runs `victory.update(dt)` and stops all other play. `draw` draws the junkbot after blocks and before balls. Never damage: `JunkBot` touches nothing on the player.
- [ ] **Step 4: Harness green 3×** (the boss checks depend on the deterministic `bbHitBot` — the hit cooldown 0.12 s < 12 frames so each helper call registers exactly one hit; if a check flakes, the `Spawner` jitter is the suspect — seed the boss spawners' `reset()` from a `rand` you control, do NOT loosen the check).
- [ ] **Step 5: Screenshots** `bash-boss1..4`, `bash-boom`, `bash-victory`, `bash-party`. **Step 6: Commit** `feat(blockbash): the JUNKBOT finale, the junk explosion, candy shower, party`.

---

### Task 9: Playability proof — simulated runs, balance, no flakes

**Files:** Modify `test/harness.js`; tune numbers in `js/blockbash.js` only if a run fails.

- [ ] **Step 1: Add the two full-run policies** (after the boss block):
```js
// FULL SIMULATED RUNS — the playability gate. A tracking policy a five-year-old could
// follow must finish inside 6 sim-minutes; a clumsy one inside 10.
function bbRun(maxFrames, clumsy) {
  vm.runInContext("game.startLevel('blockbash')", sandbox); frames(200);
  let f = 0;
  while (f < maxFrames) {
    const st = vm.runInContext(`(() => { const a = game.level.arcade, pl = game.player; if (!a) return null; const live = a.balls.filter(b => !b.rest && !b.held); let tgt = null;
      if (live.length) { live.sort((p, q) => (q.y - p.y)); tgt = live[0]; } const caps = a.capsules.length ? a.capsules[0] : null;
      return { state: a.state, endPhase: game.endPhase, px: pl.cx, tx: tgt ? tgt.x + (tgt.vx * Math.max(0, (pl.y - tgt.y)) / Math.max(120, tgt.vy)) : (caps ? caps.x : (a.blocks.length ? 640 : pl.cx)), rest: a.balls.some(b => b.rest), bally: tgt ? tgt.y : 0 }; })()`, sandbox);
    if (!st || st.endPhase === 'party') break;
    const wrong = clumsy && Math.random() < 0.4;
    const hold = {};
    if (!wrong) { if (st.tx > st.px + 12) hold.ArrowRight = 1; else if (st.tx < st.px - 12) hold.ArrowLeft = 1; }
    else if (Math.random() < 0.5) hold[Math.random() < 0.5 ? 'ArrowLeft' : 'ArrowRight'] = 1;
    if (st.rest && f % 30 === 0) tap('Space');
    if (!clumsy && st.bally > 380 && Math.random() < 0.02) tap('ArrowUp');
    frames(1, hold); f++;
  }
  return { frames: f, party: G().endPhase === 'party', state: vm.runInContext('game.level.arcade && game.level.arcade.state', sandbox), wave: vm.runInContext('game.level.arcade && game.level.arcade.waves.i', sandbox) };
}
const run1 = bbRun(60 * 360, false);
check('blockbash: a simple tracking policy finishes the whole arcade inside 6 sim-minutes (' + Math.round(run1.frames / 60) + ' s, state ' + run1.state + ', wave ' + run1.wave + ')', run1.party);
const run2 = bbRun(60 * 600, true);
check('blockbash: a CLUMSY policy (40% wrong) still finishes inside 10 sim-minutes (' + Math.round(run2.frames / 60) + ' s)', run2.party);
check('blockbash: a normal run lands in the 3–5 minute target zone (' + Math.round(run1.frames / 60) + ' s)', run1.frames >= 60 * 120 && run1.frames <= 60 * 330);
```
- [ ] **Step 2: Run the harness 3×.** If a run fails or lands outside 2–5.5 min, tune ONLY: par times, boss drop/tire cadence, `BB.STALL_EVERY`, wave block counts (never the speed cap, never the miss rules). Record the run times in the commit message.
- [ ] **Step 3: Reachability sweep** (add checks): every wave's blocks lie within x 64..1216 and y 110..350 (`aliveBlocks().every(b => b.x >= 64 && b.x + b.w <= 1216 && b.y >= 110 && b.y + b.h <= 350)`), the truck can reach both walls (`paddleBox` at x=40 and x=1240−w), the junkbot's box is always fully inside x 40..1240 and its bottom ≤ 420 (so a straight-up ball from the roof always reaches it), and capsules/candy from any column can be caught (they fall inside the walls).
- [ ] **Step 4: Screenshots of a real run:** `bash-run-90s` (`step(60*90)` with the tracking policy inlined as the `step` fn: `step(5400, i => { const a = game.level.arcade, pl = game.player; const b = a.balls.find(x => !x.rest); keys.ArrowLeft = b && b.x < pl.cx - 12; keys.ArrowRight = b && b.x > pl.cx + 12; if (a.balls.some(x => x.rest) && i % 30 === 0) justP.Space = true; })`) — look at it: is the screen readable, are targets big, do faces read?
- [ ] **Step 5: Commit** `test(blockbash): full simulated runs (tracking + clumsy) and reachability sweep`.

---

### Task 10: Release 1.29.0 — docs, backlog, changelog, tag, deploy, live verify

**Files:** `js/util.js:3`, `CHANGELOG.md`, `docs/index.html` (75-81 badge, 148-167 architecture table, 512-527 SubDoor style list, ~186 systems, ~845 minigames entry after Beat Bash, 1129 footer), `CLAUDE.md` (architecture table, world-7 row, mini-game id list), `BACKLOG.md` (Status board + a `## 12. Arcade Mode` section), `README.md` if it lists levels.

- [ ] **Step 1: `GAME_VERSION = '1.29.0'`.**
- [ ] **Step 2: CHANGELOG** `## [1.29.0] - 2026-09-06` → `### Added` **JUNKYARD BLOCK BASH — Arcade Mode #1** (one dense paragraph: cabinet door at the rally start x=280, the truck paddle + hop BUMP, Bouncy Buddy, 10 block kinds, 7 capsules, 4 waves + rain-in + crane anti-stall, surprise events, JUNKBOT with 4 parts and 3 attack stages, the junk explosion + 100-candy shower; the `lv.arcade` slot + js/arcade.js kit (`Mods`, `WaveRunner`, `Sequence`, `Spawner`, `ArcadeHud`, payout) + `lv.touchLayout`; sfx cluster + arcade song; the harness's full simulated runs with their measured times); `### Changed` docs/backlog cleanup.
- [ ] **Step 3: docs/index.html**: badge + footer → 1.29.0; architecture rows for `js/arcade.js`, `js/bashart.js`, `js/blockbash.js`; `'arcade'` in the SubDoor style list; a short "Arcade Mode (`lv.arcade`)" paragraph in Core systems (the slot, the hooks, the kit, the touch layout, "misses are comedy" rule); the `<h3>Junkyard Block Bash <small>(arcade cabinet at the Monster Truck Rally's start, x≈280 — v1.29.0)</small></h3>` entry after Pit Stop Beat Bash, one dense `<p>` starting with a `<strong>` pitch, covering every number a collaborator needs (grid, speeds, cap, waves, boss hp/stages, victory, harness runs).
- [ ] **Step 4: CLAUDE.md**: architecture table rows for the three files (mirror the docs), world-7 row mention (`Junkyard Block Bash arcade cabinet x=280`), the mini-game id list gets `'blockbash'`, the "Key subsystems" list gets an **Arcade Mode** bullet (slot + kit + rules).
- [ ] **Step 5: BACKLOG.md** Status board: add `| 20 | Junkyard Block Bash | Arcade Mode #1 | ✅ shipped v1.29.0 — … one line … |` and `| 21 | Blaster Run (fast shooting: move, jump, shoot targets at heights) | Arcade Mode #2 | 🎯 next arcade release |`; keep item 6 `🎯 next up (Stage 2)`; confirm items 4 and 5 read ✅ (they do — leave). Add a `## 12. Arcade Mode` section under Additional Backlog Ideas: what the kit is, what Block Bash proved, the Blaster Run sketch (reuse `WaveRunner`/`Spawner`/`Mods`/`ArcadeHud`, targets at heights, jump + shoot), and candidate #3s. Update the "Current phase" line in CLAUDE.md's Backlog paragraph to mention the arcade track alongside Stage 2.
- [ ] **Step 6:** `node test/harness.js` 3× → `ALL CHECKS PASSED` every time; `node --check js/*.js`.
- [ ] **Step 7: Commit** `v1.29.0: JUNKYARD BLOCK BASH — Arcade Mode #1, the truck is the paddle` then `git tag v1.29.0 && git push && git push --tags`.
- [ ] **Step 8: Verify live** (~60 s): `curl -s https://polarispixels.github.io/block-buddies/js/util.js | grep 1.29.0` and `curl -s https://polarispixels.github.io/block-buddies/js/blockbash.js | grep -c JunkBot`; if not live after 2 min use the Pages stuck-build fix from memory (`gh api repos/polarispixels/block-buddies/pages/builds/latest`, `gh api -X POST …/pages/builds`). Also `sw.js` must list the new files (else phones get a broken cache).
