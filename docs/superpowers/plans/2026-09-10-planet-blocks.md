# Planet Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship PLANET BLOCKS (v1.30.0): Puzzle Blocks mode #5, a space learning room off the Space Maze where the three answer blocks are planets and Jack bumps the biggest / smallest / most-moons / fewest-moons one.

**Architecture:** Two opt-in engine hooks on `PuzzleBlocksMachine` (`blockSize`, `drawBlock`) let a mode's answers be arbitrary bonkable objects; `PlanetBlocksMachine` (js/puzzleblocks.js) is a config on that engine with a generated per-visit ladder; `PL_ART` (new js/planetart.js) is a pure contact-sheet-reviewed art pack; the room `'planetblocks'` (js/levels.js) is the counting room's layout in space clothes with gravity on; a press-gated `'planet'` `SubDoor` on the Space Maze's start-pocket floor is the entrance.

**Tech Stack:** Plain browser JS, `<script>` tags, procedural canvas art, procedural WebAudio, `node test/harness.js` headless smoke test, `tools/screenshot.sh` for real renders.

**Spec:** `docs/superpowers/specs/2026-09-10-planet-blocks-design.md`

## Global Constraints

- Zero build step, zero deps, zero asset files: `index.html` must work from `file://`; all art is canvas drawing.
- Design for a 5-year-old: no reading required (the gold-silhouette cue), wrong bumps wobble and change nothing, no timers, no damage, no enemies in the room.
- Every level id / save key stays as-is; the new room id is the string `'planetblocks'`, level name `PLANET BLOCKS`, theme `'space'`, music `'space'`.
- Answer solids keep their **underside at `G-190`** (G = 620) so a ground jump bonks them.
- Engine hooks are **opt-in**: the four shipped modes must keep 84×84 tile solids and the tile drawing path.
- Verify before claiming done: `node test/harness.js` must print `ALL CHECKS PASSED` (run it 2-3×), `node --check js/*.js` clean, screenshots looked at.
- Release: bump `GAME_VERSION` to `'1.30.0'` in js/util.js, CHANGELOG `## [1.30.0] - 2026-09-10`, docs badge, BACKLOG status board item 22, CLAUDE.md sync, tag `v1.30.0`, push, verify live.
- Commit with `git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com"` and end messages with the session's attribution lines.

---

### Task 1: Engine hooks — `blockSize` and `drawBlock`

**Files:**
- Modify: `js/puzzleblocks.js` (engine: the mode-contract comment ~line 2514, `constructor` ~2534, `nextPuzzle` ~2560, `draw` ~2630)
- Test: `test/harness.js` (insert right before the line `// ---------------- secret: COUNTING BLOCKS (Mountain World) ----------------`)

**Interfaces:**
- Produces: `mode.blockSize(value) -> {w, h}` (optional), `mode.drawBlock(ctx, value, x, y, w, h, info)` (optional; `info = {wobble, dim, idx}`), engine method `layoutSolids()` (called at the end of `nextPuzzle()`), engine `solids[i]` keep `{x, y, w, h, puzzleBlock: true, idx, skipDraw: true}` identity (same three objects forever).

- [ ] **Step 1: Write the failing harness checks**

Insert before the COUNTING BLOCKS harness section:

```js
// ---------------- Puzzle Blocks engine: object-shaped answers (blockSize / drawBlock hooks, v1.30.0) ----------------
vm.runInContext(`
game.testHooks = new PuzzleBlocksMachine(620, {
  entries: [{ a: 1 }, { a: 2 }],
  round: () => ({ correct: 2, options: [0, 1, 2] }),
  blockSize: v => ({ w: 64 + v * 38, h: 64 + v * 38 }),
  drawPrompt() {},
  drawBlock(ctx, v, x, y, w, h, info) { game.testHooksDrawn = (game.testHooksDrawn || 0) + 1; game.testHooksInfo = info; }
});`, sandbox);
const TH = () => vm.runInContext('game.testHooks', sandbox);
check('blockSize resizes each answer solid per its slot value',
  TH().solids.every((s, i) => s.w === 64 + TH().slots[i].value * 38 && s.h === s.w));
check('resized solids keep their underside pinned at G-190 and stay centred on the slot',
  TH().solids.every((s, i) => s.y + s.h === 620 - 190 && Math.abs(s.x + s.w / 2 - TH().slots[i].x) < 0.01));
check('resized solids never overlap each other',
  TH().solids[0].x + TH().solids[0].w < TH().solids[1].x && TH().solids[1].x + TH().solids[1].w < TH().solids[2].x);
const thSolidIds = TH().solids.slice();
vm.runInContext('game.testHooks.nextPuzzle()', sandbox);
check('a new round re-lays out the SAME three solid objects (the level keeps its references)',
  TH().solids.every((s, i) => s === thSolidIds[i]) && TH().solids.every(s => s.puzzleBlock && s.skipDraw));
vm.runInContext('game.testHooks.wobble[1] = 0.3; game.testHooks.draw(ctxStub)', sandbox);
check('drawBlock replaces the tile for every slot and receives wobble/dim/idx info',
  vm.runInContext('game.testHooksDrawn', sandbox) === 3 &&
  vm.runInContext('game.testHooksInfo', sandbox).idx === 2 && typeof vm.runInContext('game.testHooksInfo', sandbox).dim === 'boolean');
check('shipped modes keep 84x84 tile solids (the hooks are opt-in)',
  vm.runInContext("[new LetterBlocksMachine(620), new EndingLetterBlocksMachine(620), new PatternBlocksMachine(620), new CountBlocksMachine(620)].every(m => m.solids.every(s => s.w === 84 && s.h === 84 && s.y + s.h === 430))", sandbox));
```

`ctxStub` is the harness's canvas stub (defined near the top of test/harness.js as `ctxStub`); if it is not in the vm sandbox scope, use `vm.runInContext('game.testHooks.draw(document.getElementById("game").getContext("2d"))', sandbox)` instead.

- [ ] **Step 2: Run the harness to see the new checks fail**

Run: `node test/harness.js 2>&1 | grep -E "FAIL|blockSize|drawBlock|opt-in|CHECK"`
Expected: the five new checks report FAIL (the engine ignores the hooks; `testHooksDrawn` is undefined).

- [ ] **Step 3: Implement the hooks in the engine**

In the mode-contract comment add, after the `holdTime?` lines:

```js
//   blockSize(value)? -> {w, h}         answer solids sized per choice (the
//                                        engine keeps the UNDERSIDE at G-190
//                                        and centres the box on the slot);
//                                        default 84x84 tiles
//   drawBlock(ctx, value, x, y, w, h, info)?
//                                        draw the whole answer object (no tile);
//                                        info = {wobble, dim, idx}. Default:
//                                        blue tile + drawChoice inside
```

In `nextPuzzle()`, after the `for (let i = 0; i < 3; i++) this.slots[i].value = options[i];` line, add `this.layoutSolids();` and add the method to the class:

```js
  // size every answer solid for its current value (blockSize hook) — the
  // underside stays at G-190 so a ground jump always bonks it
  layoutSolids() {
    for (let i = 0; i < 3; i++) {
      const sz = this.mode.blockSize ? this.mode.blockSize(this.slots[i].value) : { w: 84, h: 84 };
      const s = this.solids[i];
      s.w = sz.w; s.h = sz.h;
      s.x = this.slots[i].x - sz.w / 2;
      s.y = this.g - 190 - sz.h;
    }
  }
```

Note `nextPuzzle()` is called from the constructor before `this.bw/this.bh` are used anywhere else; `this.solids` is created before `nextPuzzle()` in the constructor already, so the call order is safe.

In `draw(ctx)`, replace the per-slot loop body with:

```js
    for (let i = 0; i < 3; i++) {
      const sl = this.slots[i], s = this.solids[i];
      const wob = this.wobble[i] > 0 ? Math.sin(this.wobble[i] * 40) * 6 : 0;
      const dim = this.state !== 'idle' && i !== this.flyFrom;
      const flying = i === this.flyFrom && this.state === 'fly';
      if (this.mode.drawBlock) {
        if (flying) continue; // the object is in the air — drawn by the fly branch below
        ctx.save();
        ctx.globalAlpha = dim ? 0.5 : 1;
        this.mode.drawBlock(ctx, sl.value, sl.x + wob, s.y + s.h / 2, s.w, s.h, { wobble: this.wobble[i], dim, idx: i });
        ctx.restore();
        continue;
      }
      const bx = sl.x, by = this.g - 190 - this.bh / 2;
      ctx.save();
      ctx.translate(bx + wob, by);
      ctx.globalAlpha = dim ? 0.5 : 1;
      const g = ctx.createLinearGradient(0, -this.bh / 2, 0, this.bh / 2);
      g.addColorStop(0, '#7fd8ff'); g.addColorStop(1, '#4aa3ff');
      ctx.fillStyle = g;
      rr(ctx, -this.bw / 2, -this.bh / 2, this.bw, this.bh, this.bw * 0.18); ctx.fill();
      ctx.strokeStyle = 'rgba(30,40,70,0.5)'; ctx.lineWidth = 3;
      rr(ctx, -this.bw / 2, -this.bh / 2, this.bw, this.bh, this.bw * 0.18); ctx.stroke();
      if (!flying) this.drawChoice(ctx, sl.value, 0, 4, this.bw * 0.55);
      ctx.restore();
    }
```

In the `if (this.state === 'fly')` branch, start the flight from the solid's centre so object modes lift off from where the object was: replace `const ey = lerp(this.g - 190 - this.bh / 2, t.y, p) - ...` with `const s0 = this.solids[this.flyFrom]; const ey = lerp(s0.y + s0.h / 2, t.y, p) - Math.sin(p * Math.PI) * 80;` and the start size `lerp(this.bw * 0.55, 44, p)` with `lerp(this.mode.drawBlock ? s0.h : this.bw * 0.55, 44, p)`. (For tile modes `s0.y + s0.h/2` equals the old `g-190-bh/2`, so nothing moves.)

- [ ] **Step 4: Run the harness**

Run: `node test/harness.js 2>&1 | tail -3` and `node --check js/puzzleblocks.js`
Expected: `ALL CHECKS PASSED` (check count rises by 5).

- [ ] **Step 5: Commit**

```bash
git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" add js/puzzleblocks.js test/harness.js
git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" commit -m "feat(puzzleblocks): opt-in blockSize/drawBlock engine hooks for object-shaped answers"
```

---

### Task 2: `PL_ART` art pack (new `js/planetart.js`) + contact sheet

**Files:**
- Create: `js/planetart.js`
- Modify: `index.html` (add `<script src="js/planetart.js"></script>` right after the `js/puzzleblocks.js` tag), `tools/screenshot.sh` (add `<script src="js/planetart.js"></script>` right after puzzleblocks.js in the generated HTML), `test/harness.js:77` (add `'planetart.js'` after `'puzzleblocks.js'` in the script list)
- Test: `test/harness.js` (a smoke check that every `PL_ART` function draws without throwing), `shots/planet-sheet.png` (looked at)

**Interfaces:**
- Produces (all pure drawing, no game-state reads except an optional `t` clock):
  - `PL_SKINS` — array of 6 skin objects `{name, c, c2, ring?, stripes?, craters?, swirl?, cap?}`
  - `PL_ART.planet(ctx, cx, cy, d, skin, mood, t)` — `d` = diameter (64–140), `skin` = a `PL_SKINS` entry, `mood` = `'happy' | 'surprised'`
  - `PL_ART.moon(ctx, cx, cy, d)` — `d` ≈ 22
  - `PL_ART.moonRow(ctx, cx, y, n, d)` — n moons in a gentle arc centred on cx, baseline y, spacing `d + 5`
  - `PL_ART.rocket(ctx, cx, baseY, s, t, flame)` — stands on `baseY`; `s` = height (≈170); `flame` 0..1
  - `PL_ART.pad(ctx, cx, y, w, t)` — hovering launch pad, top surface at `y`
  - `PL_ART.bubble(ctx, cx, cy, w, h, tailToX, tailToY)` — white thought bubble with three trailing dots toward `(tailToX, tailToY)`
  - `PL_ART.cue(ctx, cx, cy, kind, s)` — the pictogram, `kind ∈ 'biggest'|'smallest'|'most'|'fewest'`, `s` = width (≈150)
  - `PL_ART.gravGen(ctx, cx, groundY, t)` — wraps `ST_SCENE.gravityMachine(ctx, cx, groundY, 130, t, 1)`
  - `PL_ART.door(ctx, cx, groundY, t, {glow})` — the ringed-planet hatch, 92 wide × 118 tall footprint (the SubDoor box), sitting on `groundY`

- [ ] **Step 1: Write the failing smoke check**

Append to the engine-hooks harness section from Task 1:

```js
check('PL_ART draws every planet skin at 64/96/140, moons, rocket, pad, bubble, cues and the door without throwing',
  vm.runInContext(`(() => { try {
    const c = document.getElementById('game').getContext('2d');
    for (const sk of PL_SKINS) for (const d of [64, 96, 140]) { PL_ART.planet(c, 100, 100, d, sk, 'happy', 1); PL_ART.planet(c, 100, 100, d, sk, 'surprised', 2); }
    PL_ART.moon(c, 10, 10, 22); PL_ART.moonRow(c, 300, 200, 7, 22); PL_ART.moonRow(c, 300, 200, 1, 22);
    PL_ART.rocket(c, 300, 250, 170, 1, 0); PL_ART.rocket(c, 300, 250, 170, 1, 1);
    PL_ART.pad(c, 300, 250, 200, 1); PL_ART.bubble(c, 700, 150, 300, 170, 420, 120);
    for (const k of ['biggest', 'smallest', 'most', 'fewest']) PL_ART.cue(c, 700, 120, k, 150);
    PL_ART.gravGen(c, 110, 620, 1); PL_ART.door(c, 430, 2340, 1, { glow: true }); PL_ART.door(c, 430, 2340, 1, { glow: false });
    return PL_SKINS.length === 6 && new Set(PL_SKINS.map(s => s.c)).size === 6;
  } catch (e) { console.log('PL_ART threw', e); return false; } })()`, sandbox));
```

- [ ] **Step 2: Run it to see it fail**

Run: `node test/harness.js 2>&1 | grep -E "PL_ART|FAIL" | head`
Expected: FAIL (`PL_ART is not defined`).

- [ ] **Step 3: Create `js/planetart.js`**

```js
// ============================================================================
// PLANET BLOCKS ART PACK (v1.30.0) — pure drawing for the Space Maze's learning
// room: planets in six skins (the ANSWER BLOCKS of Puzzle Blocks mode #5),
// moons, the rocket, its hovering launch pad, the thought bubble, the four
// no-reading cue pictograms, and the ringed-planet door. No game-state reads;
// `t` is an optional clock. Every piece was contact-sheet reviewed at in-game
// size (tools/screenshot.sh planet-sheet) — planets must read at 64, 96, 140.
// ============================================================================
const PL_SKINS = [
  { name: 'ringed',  c: '#ffb35c', c2: '#e08a3a', ring: '#ffe0a8' },
  { name: 'striped', c: '#7fd8ff', c2: '#4aa3ff', stripes: '#3f86d8' },
  { name: 'cratered', c: '#ff8fb0', c2: '#d95f86', craters: '#c24d72' },
  { name: 'swirl',   c: '#b06cf0', c2: '#8a4fd0', swirl: '#d9b3ff' },
  { name: 'capped',  c: '#57d357', c2: '#3aa53a', cap: '#e8ffe8' },
  { name: 'plain',   c: '#ffe156', c2: '#e8b93a' }
];
const PL_ART = (() => {
  function planet(ctx, cx, cy, d, skin, mood = 'happy', t = 0) {
    const r = d / 2;
    ctx.save();
    // ring BACK half (behind the ball)
    if (skin.ring) {
      ctx.strokeStyle = skin.ring; ctx.lineWidth = Math.max(5, d * 0.08);
      ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.1, r * 1.55, r * 0.42, -0.25, Math.PI, TAU); ctx.stroke();
    }
    // the ball
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    g.addColorStop(0, skin.c); g.addColorStop(1, skin.c2);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    // skin detail, clipped to the ball
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    if (skin.stripes) {
      ctx.fillStyle = skin.stripes; ctx.globalAlpha = 0.55;
      for (const k of [-0.55, -0.1, 0.4]) { ctx.beginPath(); ctx.ellipse(cx, cy + r * k, r * 1.1, r * 0.09, 0.15, 0, TAU); ctx.fill(); }
    }
    if (skin.craters) {
      ctx.fillStyle = skin.craters; ctx.globalAlpha = 0.8;
      for (const [ox, oy, k] of [[-0.45, -0.3, 0.16], [0.35, -0.5, 0.11], [0.5, 0.4, 0.14], [-0.25, 0.55, 0.1]]) {
        ctx.beginPath(); ctx.arc(cx + ox * r, cy + oy * r, r * k, 0, TAU); ctx.fill();
      }
    }
    if (skin.swirl) {
      ctx.strokeStyle = skin.swirl; ctx.lineWidth = Math.max(3, d * 0.05); ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(cx + r * 0.1, cy + r * 0.45, r * 0.5, 0.2, 2.6); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.55, r * 0.35, 3.4, 5.6); ctx.stroke();
    }
    if (skin.cap) {
      ctx.fillStyle = skin.cap; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.92, r * 0.55, r * 0.22, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
    // outline + shine
    ctx.strokeStyle = 'rgba(30,20,60,0.45)'; ctx.lineWidth = Math.max(2.5, d * 0.035);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(cx - r * 0.4, cy - r * 0.45, r * 0.22, r * 0.12, -0.6, 0, TAU); ctx.fill();
    // ring FRONT half
    if (skin.ring) {
      ctx.strokeStyle = skin.ring; ctx.lineWidth = Math.max(5, d * 0.08);
      ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.1, r * 1.55, r * 0.42, -0.25, 0, Math.PI); ctx.stroke();
    }
    // the face: big, centred, like every Block Buddies thing
    drawFace(ctx, cx, cy + r * 0.05, d * 0.62, mood, t, Math.round(cx * 0.01));
    ctx.restore();
  }
  function moon(ctx, cx, cy, d = 22) {
    const r = d / 2;
    ctx.fillStyle = '#d9d9e6';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#a9a9bb';
    ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.2, r * 0.28, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.35, cy + r * 0.3, r * 0.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,60,0.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  }
  // n moons in a gentle arch above a planet: the counting target must be
  // an obvious, uncluttered row (like qbLayout 'arc'), never a cloud
  function moonRow(ctx, cx, y, n, d = 22) {
    const cell = d + 5, w = (n - 1) * cell;
    for (let i = 0; i < n; i++) {
      const k = n === 1 ? 0.5 : i / (n - 1);
      moon(ctx, cx - w / 2 + k * w, y - Math.sin(k * Math.PI) * 14, d);
    }
  }
  function rocket(ctx, cx, baseY, s = 170, t = 0, flame = 0) {
    const w = s * 0.34;
    ctx.save();
    if (flame > 0) { // exhaust: a flickering teardrop under the nozzle
      ctx.save(); ctx.globalAlpha = 0.9;
      const fl = s * (0.25 + 0.2 * flame) * (0.85 + 0.15 * Math.sin(t * 40));
      ctx.fillStyle = '#ff9f43';
      ctx.beginPath(); ctx.moveTo(cx - w * 0.28, baseY); ctx.quadraticCurveTo(cx, baseY + fl * 1.3, cx + w * 0.28, baseY); ctx.fill();
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.moveTo(cx - w * 0.14, baseY); ctx.quadraticCurveTo(cx, baseY + fl * 0.7, cx + w * 0.14, baseY); ctx.fill();
      ctx.restore();
    }
    // fins
    ctx.fillStyle = '#d63a3a';
    ctx.beginPath(); ctx.moveTo(cx - w / 2, baseY - s * 0.3); ctx.lineTo(cx - w * 0.95, baseY); ctx.lineTo(cx - w / 2, baseY); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + w / 2, baseY - s * 0.3); ctx.lineTo(cx + w * 0.95, baseY); ctx.lineTo(cx + w / 2, baseY); ctx.closePath(); ctx.fill();
    // body
    const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d8dce8');
    ctx.fillStyle = g;
    rr(ctx, cx - w / 2, baseY - s * 0.72, w, s * 0.72, w * 0.2); ctx.fill();
    ctx.strokeStyle = '#6a6f88'; ctx.lineWidth = 3;
    rr(ctx, cx - w / 2, baseY - s * 0.72, w, s * 0.72, w * 0.2); ctx.stroke();
    // nose cone
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath(); ctx.moveTo(cx - w / 2, baseY - s * 0.7); ctx.quadraticCurveTo(cx, baseY - s * 1.12, cx + w / 2, baseY - s * 0.7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#b82a2a'; ctx.stroke();
    // nozzle
    ctx.fillStyle = '#6a6f88';
    rr(ctx, cx - w * 0.3, baseY - 6, w * 0.6, 8, 3); ctx.fill();
    // round window with the pilot's face
    ctx.fillStyle = '#7fd8ff';
    ctx.beginPath(); ctx.arc(cx, baseY - s * 0.5, w * 0.32, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3f86d8'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, baseY - s * 0.5, w * 0.32, 0, TAU); ctx.stroke();
    drawFace(ctx, cx, baseY - s * 0.5, w * 0.5, flame > 0 ? 'grin' : 'happy', t, 17);
    ctx.restore();
  }
  function pad(ctx, cx, y, w = 220, t = 0) {
    ctx.save();
    ctx.fillStyle = '#3d3766';
    rr(ctx, cx - w / 2, y, w, 26, 10); ctx.fill();
    ctx.fillStyle = '#7fd8ff';
    rr(ctx, cx - w / 2, y - 4, w, 10, 5); ctx.fill();
    // two thrusters holding it up in the dark
    ctx.fillStyle = 'rgba(176,108,240,' + (0.35 + 0.25 * Math.sin(t * 8)) + ')';
    for (const ox of [-w * 0.32, w * 0.32]) { ctx.beginPath(); ctx.ellipse(cx + ox, y + 34, 16, 10 + Math.sin(t * 9 + ox) * 3, 0, 0, TAU); ctx.fill(); }
    // blinking edge lights
    for (let i = 0; i < 5; i++) {
      const on = Math.floor(t * 3 + i) % 2 === 0;
      ctx.fillStyle = on ? '#ffe156' : '#8a7fae';
      ctx.beginPath(); ctx.arc(cx - w / 2 + 18 + i * ((w - 36) / 4), y + 13, 5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function bubble(ctx, cx, cy, w, h, tailToX, tailToY) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.strokeStyle = '#8a7fae'; ctx.lineWidth = 4;
    rr(ctx, cx - w / 2, cy - h / 2, w, h, 34); ctx.fill(); ctx.stroke();
    for (let i = 1; i <= 3; i++) { // trailing thought dots toward the rocket
      const k = i / 4, r = 14 - i * 3;
      const x = lerp(cx - w / 2, tailToX, k), y = lerp(cy + h * 0.2, tailToY, k);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  // the no-reading cue: three gray silhouettes, the WANTED one gold with a
  // star — one fixed convention for all four questions
  function cue(ctx, cx, cy, kind, s = 150) {
    const sizes = kind === 'biggest' || kind === 'smallest' ? [0.14, 0.2, 0.28] : [0.2, 0.2, 0.2];
    const dots = kind === 'most' || kind === 'fewest' ? [1, 2, 3] : [0, 0, 0];
    const want = kind === 'biggest' || kind === 'most' ? 2 : 0;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * s * 0.36, r = s * sizes[i];
      const gold = i === want;
      ctx.fillStyle = gold ? '#ffd24a' : '#b8b4c8';
      ctx.beginPath(); ctx.arc(x, cy + s * 0.06, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = gold ? '#a86a10' : '#6a6680'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, cy + s * 0.06, r, 0, TAU); ctx.stroke();
      for (let m = 0; m < dots[i]; m++) { // mini moons above the silhouette
        const mx = x + (m - (dots[i] - 1) / 2) * s * 0.09;
        ctx.fillStyle = gold ? '#ffd24a' : '#b8b4c8';
        ctx.beginPath(); ctx.arc(mx, cy - s * 0.2, s * 0.035, 0, TAU); ctx.fill();
        ctx.strokeStyle = gold ? '#a86a10' : '#6a6680'; ctx.lineWidth = 2; ctx.stroke();
      }
      if (gold) {
        ctx.fillStyle = '#ffe156';
        starPath(ctx, x, cy - s * (dots[i] ? 0.34 : 0.22) - r * (dots[i] ? 0 : 1), s * 0.07, s * 0.03); ctx.fill();
        ctx.strokeStyle = '#a86a10'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    ctx.restore();
  }
  function gravGen(ctx, cx, groundY, t = 0) { ST_SCENE.gravityMachine(ctx, cx, groundY, 130, t, 1); }
  // the door: a ringed planet hatch standing on the maze floor, purple glow
  // leaking from a round porthole in its middle
  function door(ctx, cx, groundY, t = 0, opts = {}) {
    const d = 96, cy = groundY - 62;
    ctx.save();
    if (opts.glow) {
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3);
      ctx.fillStyle = '#b06cf0';
      ctx.beginPath(); ctx.arc(cx, cy, d * 0.75, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    planet(ctx, cx, cy, d, PL_SKINS[0], 'happy', t);
    // the porthole (drawn over the face's chin so the face stays readable)
    ctx.fillStyle = '#1c1836';
    ctx.beginPath(); ctx.arc(cx, cy + d * 0.28, d * 0.13, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(176,108,240,' + (0.5 + 0.4 * Math.sin(t * 4)) + ')';
    ctx.beginPath(); ctx.arc(cx, cy + d * 0.28, d * 0.08, 0, TAU); ctx.fill();
    ctx.restore();
  }
  return { planet, moon, moonRow, rocket, pad, bubble, cue, gravGen, door };
})();
```

- [ ] **Step 4: Register the script in all three loaders**

- `index.html`: after `<script src="js/puzzleblocks.js"></script>` add `<script src="js/planetart.js"></script>`.
- `tools/screenshot.sh`: in the heredoc's script line, after `<script src="js/puzzleblocks.js"></script>` add `<script src="js/planetart.js"></script>`.
- `test/harness.js` line 77 list: `'puzzleblocks.js', 'planetart.js', 'ride.js', ...`.

- [ ] **Step 5: Run the harness and syntax check**

Run: `node --check js/planetart.js && node test/harness.js 2>&1 | tail -2`
Expected: `ALL CHECKS PASSED`.

- [ ] **Step 6: Render the contact sheet and LOOK at it**

Run:

```bash
tools/screenshot.sh planet-sheet 'game.state="title"; const _r=render; render=function(){ const c=document.getElementById("game").getContext("2d"); c.fillStyle="#201646"; c.fillRect(0,0,1280,720);
  PL_SKINS.forEach((sk,i)=>{ PL_ART.planet(c,90+i*200,90,64,sk,"happy",1); PL_ART.planet(c,90+i*200,210,96,sk,i%2?"surprised":"happy",1); PL_ART.planet(c,90+i*200,380,140,sk,"happy",1); });
  PL_ART.moonRow(c,150,500,1,22); PL_ART.moonRow(c,400,500,4,22); PL_ART.moonRow(c,700,500,7,22);
  PL_ART.rocket(c,1000,540,170,1,0); PL_ART.rocket(c,1130,540,170,1,1); PL_ART.pad(c,1000,545,200,1);
  ["biggest","smallest","most","fewest"].forEach((k,i)=>PL_ART.cue(c,140+i*190,600,k,150));
  PL_ART.door(c,1000,700,1,{glow:true}); PL_ART.gravGen(c,1180,700,1); };'
```

Open `shots/planet-sheet.png` (Read tool). Review against: every skin readable at 64px (face has two eyes and a mouth, ring visible, no smeared detail), the three sizes obviously different, moons countable at 7, both rockets clearly rockets with a face in the window, all four cues show one gold silhouette with a star and the moon dots readable. Fix any failures in `js/planetart.js` and re-render until it passes. Record the verdict in the commit message.

- [ ] **Step 7: Commit**

```bash
git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" add js/planetart.js index.html tools/screenshot.sh test/harness.js
git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" commit -m "feat(planetart): PL_ART pack — six planet skins, moons, rocket, pad, bubble, cues, door (contact-sheet reviewed)"
```

---

### Task 3: `PlanetBlocksMachine` — the mode and its ladder

**Files:**
- Modify: `js/puzzleblocks.js` (append after `CountBlocksMachine`, before the file ends)
- Test: `test/harness.js` (append to the engine-hooks section from Task 1, driving a standalone machine — the room comes in Task 4)

**Interfaces:**
- Consumes: Task 1 hooks, `PL_ART`, `PL_SKINS`, `shuffleLB`, `randi`, `rand`, `outlineText`, `rr`, `starPath`, `drawFace`, `Particles.burst/candyBurst`, `AudioSys.sfx`, `game.candy`, `game.t`.
- Produces: `class PlanetBlocksMachine extends PuzzleBlocksMachine` with `constructor(groundY)`, `mode.cur = {kind, planets: [{size, moons, skin}] ×3}`, `mode.roundNo`, `mode.kinds` (history array), `machine.rocketT` (0..1 blast progress), `machine.bonusT`, `drawBack(ctx, t)`; `PL_TIERS`, `plTier(roundNo)`, `plPickSizes(tier)`, `plPickMoons(tier)`, `PL_LAYOUT` constants `{ROCKET_X: 300, PAD_Y: 250, BUBBLE: {x: 700, y: 150, w: 320, h: 180}}`.

- [ ] **Step 1: Write the failing harness checks**

Append to the engine-hooks section:

```js
// ---- mode 5: PLANET BLOCKS (standalone machine; the room is checked in the Space Maze section) ----
vm.runInContext('game.testPB = new PlanetBlocksMachine(620);', sandbox);
const PB = () => vm.runInContext('game.testPB', sandbox);
const pbAnswerIsRight = () => {
  const m = PB(), c = m.mode.cur, p = c.planets, a = p[m.answer];
  const key = c.kind === 'biggest' || c.kind === 'smallest' ? 'size' : 'moons';
  const vals = p.map(q => q[key]);
  const want = c.kind === 'biggest' || c.kind === 'most' ? Math.max(...vals) : Math.min(...vals);
  return a[key] === want && vals.filter(v => v === want).length === 1;
};
check('planet round 1 is BIGGEST with three distinct sizes, three distinct skins and one honest answer',
  PB().mode.cur.kind === 'biggest' && new Set(PB().mode.cur.planets.map(p => p.size)).size === 3 &&
  new Set(PB().mode.cur.planets.map(p => p.skin.name)).size === 3 && pbAnswerIsRight());
check('planet solids are the planets: each solid is as wide as its planet, underside at G-190, and the answer solid is the widest',
  PB().solids.every((s, i) => s.w === PB().mode.cur.planets[PB().slots[i].value].size && s.y + s.h === 430) &&
  PB().solids[PB().slots.findIndex(sl => sl.value === PB().answer)].w === Math.max(...PB().solids.map(s => s.w)));
const pbKinds = [], pbSeen = { biggest: 0, smallest: 0, most: 0, fewest: 0 };
let pbOk = true, pbGapOk = true, pbMoonOk = true;
for (let r = 0; r < 14; r++) {
  const m = PB(), c = m.mode.cur;
  pbKinds.push(c.kind); pbSeen[c.kind]++;
  if (!pbAnswerIsRight()) pbOk = false;
  const sizes = c.planets.map(p => p.size).sort((a, b) => a - b);
  if (c.kind === 'biggest' || c.kind === 'smallest') { if (sizes[1] - sizes[0] < 12 || sizes[2] - sizes[1] < 12 || c.planets.some(p => p.moons !== 0)) pbGapOk = false; }
  else { if (!c.planets.every(p => p.size === 96) || new Set(c.planets.map(p => p.moons)).size !== 3 || c.planets.some(p => p.moons < 1 || p.moons > 7)) pbMoonOk = false; }
  const right = m.slots.find(sl => sl.value === m.answer);
  vm.runInContext(`game.testPB.onAnswer(game.testPB.solids[${right.idx}])`, sandbox);
  for (let i = 0; i < 130; i++) vm.runInContext('game.testPB.update(1/60)', sandbox);
}
check('the planet ladder: rounds 1-2 biggest, smallest by round 4, most moons for rounds 5-6, all four kinds by round 14',
  pbKinds[0] === 'biggest' && pbKinds[1] === 'biggest' && pbKinds.slice(2, 4).includes('smallest') &&
  pbKinds[4] === 'most' && pbKinds[5] === 'most' && Object.values(pbSeen).every(n => n > 0));
check('every planet round has exactly one honest answer', pbOk);
check('size rounds: gaps >= 12px and no moons; moon rounds: equal 96px planets with three distinct counts 1-7', pbGapOk && pbMoonOk);
check('from round 7 on the question never repeats three times in a row',
  pbKinds.slice(6).every((k, i, a) => i < 2 || !(a[i - 1] === k && a[i - 2] === k)));
check('each planet solve pays 1 candy; every fifth solve throws the bonus party (+2)', (() => {
  vm.runInContext('game.testPB2 = new PlanetBlocksMachine(620); game.candy = 0;', sandbox);
  const pays = [];
  for (let r = 0; r < 5; r++) {
    const c0 = G().candy;
    const m = vm.runInContext('game.testPB2', sandbox), right = m.slots.find(sl => sl.value === m.answer);
    vm.runInContext(`game.testPB2.onAnswer(game.testPB2.solids[${right.idx}])`, sandbox);
    for (let i = 0; i < 130; i++) vm.runInContext('game.testPB2.update(1/60)', sandbox);
    pays.push(G().candy - c0);
  }
  return pays.slice(0, 4).every(p => p === 1) && pays[4] === 3;
})());
check('a wrong planet bump wobbles it and leaves the round idle', (() => {
  const m = PB(), wrong = m.slots.find(sl => sl.value !== m.answer);
  vm.runInContext(`game.testPB.onAnswer(game.testPB.solids[${wrong.idx}])`, sandbox);
  return PB().state === 'idle' && PB().wobble[wrong.idx] > 0;
})());
```

- [ ] **Step 2: Run to see the checks fail**

Run: `node test/harness.js 2>&1 | grep -E "planet|FAIL" | head`
Expected: FAIL (`PlanetBlocksMachine is not defined`).

- [ ] **Step 3: Implement the mode**

Append to `js/puzzleblocks.js`:

```js
// ================================================================ planet blocks
// PLANET BLOCKS (v1.30.0): Puzzle Blocks mode #5 and the first COMPARISON
// mode (the spec's reasoning rung). The three answer blocks ARE planets —
// the engine's opt-in `blockSize`/`drawBlock` hooks size the solids to the
// planets — and the rocket's thought bubble asks BIGGEST / SMALLEST /
// MOST MOONS / FEWEST MOONS with a no-reading cue (three silhouettes, the
// wanted one gold). Rounds are generated on an invisible per-visit ladder.
const PL_LAYOUT = { ROCKET_X: 300, PAD_Y: 250, BUBBLE: { x: 700, y: 150, w: 320, h: 180 } };
const PL_WORD = { biggest: 'BIGGEST', smallest: 'SMALLEST', most: 'MOST MOONS', fewest: 'FEWEST MOONS' };
// tier = rounds solved so far this visit. `sizes` = the pool three distinct
// diameters are drawn from (min pairwise gap `gap`); `moonGap` = min gap
// between the three moon counts (1-7). Sizes are never within 12px.
const PL_TIERS = [
  { rounds: 2, kinds: ['biggest'],  sizes: [64, 96, 140], gap: 12 },
  { rounds: 1, kinds: ['biggest'],  sizes: [72, 96, 120, 140], gap: 20 },
  { rounds: 1, kinds: ['smallest'], sizes: [64, 96, 140], gap: 12 },
  { rounds: 2, kinds: ['most'],     moonGap: 2 },
  { rounds: 1e9, kinds: ['biggest', 'smallest', 'most', 'fewest'], sizes: [64, 80, 96, 112, 128, 140], gap: 18, moonGap: 1 }
];
function plTier(roundNo) {
  let acc = 0;
  for (const t of PL_TIERS) { acc += t.rounds; if (roundNo < acc) return t; }
  return PL_TIERS[PL_TIERS.length - 1];
}
// all 3-combinations of `pool` whose sorted pairwise gaps are >= gap
function plTriples(pool, gap) {
  const out = [];
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) for (let k = j + 1; k < pool.length; k++) {
    const t = [pool[i], pool[j], pool[k]].sort((a, b) => a - b);
    if (t[1] - t[0] >= gap && t[2] - t[1] >= gap) out.push(t);
  }
  return out;
}
function plPickSizes(tier, avoidKey) {
  const opts = plTriples(tier.sizes, Math.max(12, tier.gap || 12)).filter(t => t.join() !== avoidKey);
  return shuffleLB(opts.length ? opts : plTriples(tier.sizes, 12))[0];
}
function plPickMoons(tier, avoidKey) {
  const opts = plTriples([1, 2, 3, 4, 5, 6, 7], tier.moonGap || 1).filter(t => t.join() !== avoidKey);
  return shuffleLB(opts)[0];
}
class PlanetBlocksMachine extends PuzzleBlocksMachine {
  constructor(groundY) {
    const mode = {
      // entries are just a shuffle source — every round is generated
      entries: [0, 1, 2, 3, 4, 5].map(i => ({ i })),
      roundNo: 0,
      kinds: [],        // history, so the mixed tier never asks the same thing 3x running
      lastTrio: '',     // never the same size/moon trio twice in a row
      cur: null,        // {kind, planets: [{size, moons, skin}]}
      holdTime: 1.1,
      round() {
        const tier = plTier(this.roundNo++);
        let kind;
        do kind = tier.kinds[randi(0, tier.kinds.length - 1)];
        while (tier.kinds.length > 1 && this.kinds.length >= 2 && this.kinds[this.kinds.length - 1] === kind && this.kinds[this.kinds.length - 2] === kind);
        this.kinds.push(kind);
        const sizeRound = kind === 'biggest' || kind === 'smallest';
        const trio = sizeRound ? plPickSizes(tier, this.lastTrio) : plPickMoons(tier, this.lastTrio);
        this.lastTrio = trio.join();
        const vals = shuffleLB(trio.slice());
        const skins = shuffleLB(PL_SKINS.slice()).slice(0, 3);
        const planets = vals.map((v, i) => ({ size: sizeRound ? v : 96, moons: sizeRound ? 0 : v, skin: skins[i] }));
        const key = sizeRound ? 'size' : 'moons';
        const want = kind === 'biggest' || kind === 'most' ? Math.max(...vals) : Math.min(...vals);
        this.cur = { kind, planets };
        return { correct: planets.findIndex(p => p[key] === want), options: [0, 1, 2] };
      },
      blockSize(v) { const s = this.cur.planets[v].size; return { w: s, h: s }; },
      drawBlock(ctx, v, x, y, w, h, info) {
        const p = this.cur.planets[v];
        if (p.moons) PL_ART.moonRow(ctx, x, y - h / 2 - 22, p.moons, 22);
        PL_ART.planet(ctx, x, y, w, p.skin, info.wobble > 0 ? 'surprised' : 'happy', game.t);
      },
      drawChoice(ctx, v, x, y, size) { // only used for the flight into the bubble
        const p = this.cur.planets[v];
        PL_ART.planet(ctx, x, y, size, p.skin, 'grin', game.t);
      },
      flyTarget: () => ({ x: PL_LAYOUT.BUBBLE.x, y: PL_LAYOUT.BUBBLE.y + 6 }),
      drawPrompt(ctx, e, phase) {
        const m = this.machine, t = game.t, B = PL_LAYOUT.BUBBLE;
        // the rocket on its hovering pad (rises and flames during hold)
        const lift = m ? m.rocketT : 0;
        PL_ART.pad(ctx, PL_LAYOUT.ROCKET_X, PL_LAYOUT.PAD_Y, 220, t);
        PL_ART.rocket(ctx, PL_LAYOUT.ROCKET_X, PL_LAYOUT.PAD_Y - lift * lift * 700, 170, t, lift > 0 ? 1 : 0);
        // the thought bubble: cue + word, or the delivered planet with a green ring
        PL_ART.bubble(ctx, B.x, B.y, B.w, B.h, PL_LAYOUT.ROCKET_X + 40, PL_LAYOUT.PAD_Y - 150);
        if (phase === 'hold' || phase === 'won') {
          const p = this.cur.planets[m.answer];
          PL_ART.planet(ctx, B.x, B.y + 6, 64, p.skin, 'grin', t);
          ctx.strokeStyle = '#7be07b'; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.arc(B.x, B.y + 6, 44, 0, TAU); ctx.stroke();
        } else {
          PL_ART.cue(ctx, B.x, B.y - 22, this.cur.kind, 150);
          outlineText(ctx, PL_WORD[this.cur.kind], B.x, B.y + 62, 34, '#5a4a8a', '#fff');
        }
        if (m && m.bonusT > 0) { // the every-fifth-solve star banner (shared with counting)
          const k = Math.min(1, (1.6 - m.bonusT) * 3);
          for (let i = 0; i < 5; i++) {
            const sx = 640 + (i - 2) * 90, sy = 300 - Math.sin(t * 6 + i) * 6 - (1 - k) * 60;
            ctx.fillStyle = '#ffd24a';
            starPath(ctx, sx, sy, 22 * k, 9 * k); ctx.fill();
            ctx.strokeStyle = '#a86a10'; ctx.lineWidth = 3; ctx.stroke();
          }
        }
      },
      onCorrect() { // `this` = the machine
        game.candy++;
        AudioSys.sfx('candy');
        Particles.candyBurst(PL_LAYOUT.BUBBLE.x, PL_LAYOUT.BUBBLE.y, 8);
        if ((this.roundsWon + 1) % 5 === 0) {
          game.candy += 2;
          this.bonusT = 1.6;
          AudioSys.sfx('fanfare');
          Particles.candyBurst(640, 300, 14);
          Particles.burst(640, 300, 40, { type: 'confetti', colors: RAINBOW, sp0: 120, sp1: 420, l0: 0.8, l1: 1.6, up: 200 });
        }
      }
    };
    super(groundY, mode);
    mode.machine = this;
    this.rocketT = 0;   // blast-off progress 0..1 during hold
    this.bonusT = 0;
  }
  update(dt) {
    super.update(dt);
    if (this.bonusT > 0) this.bonusT = Math.max(0, this.bonusT - dt);
    if (this.state === 'hold') {
      if (this.rocketT === 0) AudioSys.sfx('whoosh');
      this.rocketT = Math.min(1, this.rocketT + dt / 0.9);
      if (chance(0.6)) Particles.burst(PL_LAYOUT.ROCKET_X + rand(-12, 12), PL_LAYOUT.PAD_Y - this.rocketT * this.rocketT * 700, 2,
        { type: 'flame', colors: ['#ff9f43', '#ffe156'], sp1: 120, l1: 0.5, s1: 12, grav: 120, up: -80 });
    } else if (this.state === 'idle') this.rocketT = 0;
  }
  // the room interior behind solids + hero: the gravity generator that
  // explains why this space room has a floor to jump from
  drawBack(ctx, t) { PL_ART.gravGen(ctx, 110, this.g, t); }
}
```

Note `chance`, `rand`, `randi`, `lerp`, `TAU`, `RAINBOW` are util.js globals already used elsewhere in this file.

- [ ] **Step 4: Run the harness**

Run: `node --check js/puzzleblocks.js && node test/harness.js 2>&1 | tail -2`
Expected: `ALL CHECKS PASSED`. Run it three times; the ladder checks are randomized and must never flake. If a check flakes, the generator is wrong (fix the generator, never loosen the check).

- [ ] **Step 5: Commit**

```bash
git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" add js/puzzleblocks.js test/harness.js
git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" commit -m "feat(puzzleblocks): PlanetBlocksMachine — mode #5, biggest/smallest/most/fewest with a generated ladder"
```

---

### Task 4: The room, the door, and the real-input harness run

**Files:**
- Modify: `js/levels.js` (`LEVEL_META` ~line 31 after `countblocks`; the Space Maze block ~line 632 after the zerog door; a new `if (n === 'planetblocks')` block right after the `countblocks` block ~line 1400; `drawBG` space branch ~line 1870 — wrap the two background planets in `if (!lv.plainSky)`), `js/entities.js` (`SubDoor.update` sfx list ~line 4390 and sparkle colours ~4410; `SubDoor.draw` style chain ~line 4511)
- Test: `test/harness.js` (new section right after the COUNTING BLOCKS section's `vm.runInContext('game.goTitle()', sandbox); frames(3);`)

**Interfaces:**
- Consumes: `PlanetBlocksMachine(G)`, `PL_ART.door`, `ExitDoor(cx, groundY)`, `Checkpoint(x, groundY)`, `addGround(lv, x, w, top)`, `SubDoor(cx, groundY, sub, style, opts)`.
- Produces: level id `'planetblocks'`, `lv.plainSky` flag (space theme: skip the decorative background planets), `SubDoor` style `'planet'`.

- [ ] **Step 1: Write the failing harness section**

```js
// ---------------- secret: PLANET BLOCKS (Space Maze, v1.30.0) ----------------
vm.runInContext('game.startLevel(9)', sandbox);
frames(150);
check('the Space Maze start pocket has a press-gated planet hatch on its floor',
  vm.runInContext("game.level.subDoors.some(d => d.sub === 'planetblocks' && d.style === 'planet' && d.press && d.groundY === 18 * 130)", sandbox));
put(430 - 28, 2250);
frames(20);
check('swimming over the planet hatch never auto-enters', G().level.n === 9);
tap('Space');
frames(10);
check('standing on the hatch + Space enters PLANET BLOCKS', G().level.n === 'planetblocks');
frames(150); // intro card
const PBR = () => vm.runInContext('game.level.puzzle', sandbox);
check('the planet room has gravity (the hero lands on the floor), one exit door, no enemies, plain sky',
  G().level.space === false && G().level.water === false && G().player.y + G().player.h === 620 &&
  G().level.exitDoors.length === 1 && G().level.spiders.length === 0 && G().level.plainSky === true &&
  vm.runInContext('game.level.puzzle instanceof PlanetBlocksMachine', sandbox));
check('the room adopted the machine\'s three planet solids',
  PBR().solids.every(s => G().level.solids.includes(s)));
const pbCandy0 = G().candy;
const pbWrong = PBR().slots.find(s => s.value !== PBR().answer);
put(pbWrong.x - 28, 620 - 94);
tap('ArrowUp');
frames(40);
check('a real jump into a wrong planet wobbles it, pays nothing, stays idle',
  G().candy === pbCandy0 && PBR().state === 'idle');
// bonk the correct planet for real — whatever its size this round
const pbRight = PBR().slots.find(s => s.value === PBR().answer);
put(pbRight.x - 28, 620 - 94);
tap('ArrowUp');
frames(40);
check('a real jump into the correct planet locks the round', PBR().state !== 'idle');
frames(130);
check('planet candy is paid exactly once and a new round follows', G().candy === pbCandy0 + 1 && PBR().state === 'idle' && PBR().mode.roundNo === 2);
// hitbox generosity: force a round with the NARROWEST (64) and WIDEST (140)
// planets and bonk each from the floor for real
vm.runInContext(`game.level.puzzle.mode.cur.planets = [{size: 64, moons: 0, skin: PL_SKINS[0]}, {size: 140, moons: 0, skin: PL_SKINS[1]}, {size: 96, moons: 0, skin: PL_SKINS[2]}];
game.level.puzzle.mode.cur.kind = 'smallest'; game.level.puzzle.answer = 0;
game.level.puzzle.slots[0].value = 0; game.level.puzzle.slots[1].value = 1; game.level.puzzle.slots[2].value = 2; game.level.puzzle.layoutSolids();`, sandbox);
put(PBR().slots[0].x - 28, 620 - 94);
tap('ArrowUp');
frames(40);
check('a ground jump bonks even the smallest (64px) planet', PBR().state !== 'idle');
frames(130);
vm.runInContext(`game.level.puzzle.mode.cur.planets = [{size: 64, moons: 0, skin: PL_SKINS[0]}, {size: 140, moons: 0, skin: PL_SKINS[1]}, {size: 96, moons: 0, skin: PL_SKINS[2]}];
game.level.puzzle.mode.cur.kind = 'biggest'; game.level.puzzle.answer = 1;
game.level.puzzle.slots[0].value = 0; game.level.puzzle.slots[1].value = 1; game.level.puzzle.slots[2].value = 2; game.level.puzzle.layoutSolids();`, sandbox);
put(PBR().slots[1].x - 28, 620 - 94);
tap('ArrowUp');
frames(40);
check('a ground jump bonks the biggest (140px) planet', PBR().state !== 'idle');
frames(130);
put(1150 - 35, 620 - 94);
frames(5);
check('the exit door returns to the Space Maze with no puzzle leak and no completion flag',
  G().level.n === 9 && G().state === 'play' && G().level.puzzle === null && !G().miniDone.planetblocks && G().level.space === true);
put(700, 2250);
frames(10);
put(430 - 28, 2250);
frames(10);
tap('Space');
frames(160);
check('re-entering PLANET BLOCKS starts the ladder over (round 1, biggest)',
  G().level.n === 'planetblocks' && PBR().mode.roundNo === 1 && PBR().mode.cur.kind === 'biggest' && PBR().roundsWon === 0);
vm.runInContext('game.goTitle()', sandbox);
frames(3);
```

- [ ] **Step 2: Run to see it fail**

Run: `node test/harness.js 2>&1 | grep -E "planet|PLANET|FAIL" | head`
Expected: the first check FAILs (no door), and the rest fail after it.

- [ ] **Step 3: Add the level meta, the door, and the room**

`LEVEL_META` (after the `countblocks` line):

```js
  planetblocks: { name: 'PLANET BLOCKS', theme: 'space', music: 'space' }, // Puzzle Blocks mode #5: biggest / smallest / most / fewest moons
```

Space Maze block, right after the zerog `pick(...)` line:

```js
    // PLANET BLOCKS: a ringed-planet hatch on the same pocket floor, well to
    // the right of the asteroid crack — press-gated so a swim-by never
    // hijacks the maze (the learning-door rule)
    lv.subDoors.push(new SubDoor(430, 18 * CELL, 'planetblocks', 'planet', { press: true }));
```

New room block right after the `countblocks` block:

```js
  if (n === 'planetblocks') { // ---------------- PLANET BLOCKS (biggest / smallest / most / fewest moons)
    // The Space Maze's learning room and the first COMPARISON mode: the
    // counting room's single screen in space clothes. Gravity is ON (a
    // humming gravity generator explains it) so the on-foot bonk branch
    // fires — the three planets hovering over the launch pad ARE the answer
    // blocks. Candy per solve, continuous replay, always-open EXIT door.
    lv.w = 1280; lv.h = 720;
    lv.space = false; lv.water = false;
    lv.plainSky = true; // no decorative background planets — only the answers are planets
    lv.playerStart = { x: 90, y: G - 94 };
    addGround(lv, 0, 1280, G);
    lv.puzzle = new PlanetBlocksMachine(G);
    for (const s of lv.puzzle.solids) lv.solids.push(s);
    lv.exitDoors.push(new ExitDoor(1150, G));
    lv.checks.push(new Checkpoint(120, G));
  }
```

`drawBG` space branch: wrap the "ringed planet (with a face, obviously)" block and the "little red planet" block (from `const px2 = ...` through the last red-planet `ctx.fill();`) in `if (!lv.plainSky) { ... }`.

- [ ] **Step 4: Add the `'planet'` door style**

In `SubDoor.update`, in the enter-sfx list add: `if (this.style === 'planet') AudioSys.sfx('whoosh'); // through the hatch`. In the sparkle colour chain add `: this.style === 'planet' ? ['#b06cf0', '#ffe156', '#7fd8ff']` before the final default. In `SubDoor.draw`, add a branch before `} else if (this.style === 'rainbow') {`:

```js
    } else if (this.style === 'planet') {
      // a ringed planet hatch on the maze floor (Planet Blocks)
      PL_ART.door(ctx, cx, g, t, { glow: !done });
```

- [ ] **Step 5: Run the harness three times**

Run: `for i in 1 2 3; do node test/harness.js 2>&1 | tail -1; done`
Expected: `ALL CHECKS PASSED` ×3. If the wrong-planet jump check fails because the hero's 56-wide box beside a 64-wide planet also clips a neighbour, the slot spacing (260) makes that impossible — so a failure there means the `layoutSolids` centring is wrong; fix Task 1, not the check.

- [ ] **Step 6: Screenshots — LOOK at them**

```bash
tools/screenshot.sh planet-room "game.startLevel('planetblocks'); game.introT=99; step(30);"
tools/screenshot.sh planet-moons "game.startLevel('planetblocks'); game.introT=99; step(5); const m=game.level.puzzle; m.mode.roundNo=5; m.nextPuzzle(); step(30);"
tools/screenshot.sh planet-hold "game.startLevel('planetblocks'); game.introT=99; step(5); const m=game.level.puzzle; m.onAnswer(m.solids[m.slots.findIndex(s=>s.value===m.answer)]); step(60);"
tools/screenshot.sh planet-door "game.startLevel(9); game.introT=99; step(5); game.player.x=430-28; game.player.y=2250; step(20);"
```

Review: planets sit on the pad line with feet room below (underside at y=430), no planet overlaps the exit door or the bubble, the bubble's cue and word are legible, the rocket flames and rises in `planet-hold`, the moons are countable in `planet-moons`, the door in the maze shows the spacebar hint and reads as a planet hatch. Adjust `PL_LAYOUT` / art and re-shoot until right.

- [ ] **Step 7: Commit**

```bash
git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" add js/levels.js js/entities.js test/harness.js
git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" commit -m "feat(planetblocks): the PLANET BLOCKS room off the Space Maze + the planet hatch door"
```

---

### Task 5: Release — version, changelog, docs, backlog, CLAUDE.md, tag, deploy

**Files:**
- Modify: `js/util.js:3` (`GAME_VERSION = '1.30.0'`), `CHANGELOG.md` (new top entry), `docs/index.html` (badge line 78, footer version if present — `grep -n "1.29.0" docs/index.html`; the `js/puzzleblocks.js` architecture row; a new `js/planetart.js` row after it; the Space Maze world section's mini-game `<dd>`; a new `<h3>Planet Blocks ...</h3>` section after the Counting Blocks section; the Puzzle Blocks framework paragraph in the Letter Blocks section that lists modes), `BACKLOG.md` (status board: new row `| 22 | Planet Blocks: biggest / smallest / most / fewest moons | Puzzle Blocks mode | ✅ shipped v1.30.0 — ... |`; item 11's family list: mark C5 ✅ and add the engine hooks note), `CLAUDE.md` (puzzleblocks row: mode #5 + hooks; new `js/planetart.js` row; world 9 gimmick column; the sublevel id list adds `'planetblocks'`; harness check count line)
- Test: `node test/harness.js` (its version/changelog/docs sync checks), `curl` of the live site

- [ ] **Step 1: Write the CHANGELOG entry**

```markdown
## [1.30.0] - 2026-09-10

### Added
- **PLANET BLOCKS — Puzzle Blocks mode #5, the first COMPARISON mode** (Jack
  asked for "planets in space"). A press-gated ringed-planet hatch
  (`SubDoor` style `'planet'`, x=430 on the Space Maze's start-pocket floor,
  beside the Zero-G crack) opens a single-screen space room with GRAVITY
  (`'planetblocks'`, a humming gravity generator explains it). A rocket on a
  hovering pad shows what it wants in a thought bubble — BIGGEST / SMALLEST
  / MOST MOONS / FEWEST MOONS — with a no-reading cue (three silhouettes,
  the wanted one gold with a star). The three planets hovering over the pad
  ARE the answer blocks: bump the right one and it flies into the bubble,
  the rocket blasts off, +1 candy; every fifth solve throws the bonus party
  (+2). Wrong bumps wobble a surprised planet and change nothing. Invisible
  per-visit ladder (`PL_TIERS`): biggest with far-apart sizes → closer sizes
  → smallest → most moons far apart → all four questions mixed with moon
  counts as close as 4/5/6 and no question three times running. Six planet
  skins (`js/planetart.js`, `PL_ART`, contact-sheet reviewed at 64/96/140).
- **Engine: object-shaped answers.** `PuzzleBlocksMachine` gained two
  opt-in hooks — `mode.blockSize(value)` (solids re-sized per round with the
  underside pinned at G-190) and `mode.drawBlock(...)` (draw the whole
  answer instead of a tile) — plus `layoutSolids()`. The four shipped modes
  are untouched (harness-asserted 84×84).
```

- [ ] **Step 2: Bump the version and sync docs, backlog, CLAUDE.md**

Run `grep -rn "1\.29\.0" js/util.js docs/index.html CLAUDE.md` and update every version stamp that names the current release (not historical CHANGELOG-style mentions in docs prose). Update the docs badge to `v1.30.0`. Add the docs section modelled on the Counting Blocks one (door location, mode number, the hooks, the ladder table, the cue convention, the room). Update BACKLOG.md's status board and CLAUDE.md's tables as listed in **Files**; update the harness check count in CLAUDE.md to the number the harness prints (`node test/harness.js | grep -c "^ok\|PASS"` or the harness's own summary line).

- [ ] **Step 3: Full verification**

Run: `node --check js/*.js && for i in 1 2 3; do node test/harness.js 2>&1 | tail -1; done`
Expected: no syntax errors; `ALL CHECKS PASSED` ×3 (including the version/changelog/docs sync checks).

- [ ] **Step 4: Commit, tag, push, verify live**

```bash
git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" add -A
git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" commit -m "v1.30.0: PLANET BLOCKS — Puzzle Blocks mode #5, the planets are the blocks"
git tag v1.30.0 && git push && git push --tags
sleep 75; curl -s https://polarispixels.github.io/block-buddies/js/util.js | grep "1.30.0"; curl -s https://polarispixels.github.io/block-buddies/js/planetart.js | grep -c PL_ART
```

Expected: the version line and a non-zero count. If not live after ~2 minutes, check `gh api repos/polarispixels/block-buddies/pages/builds/latest`; a hung build needs `gh api -X POST repos/polarispixels/block-buddies/pages/builds`.
