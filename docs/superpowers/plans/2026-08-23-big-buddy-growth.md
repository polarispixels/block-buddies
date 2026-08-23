# Big Buddy Growth System (v1.14.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Mario-inspired (but Block-Buddies-flavored) growth mechanic: bonk a Buddy Block from below → a walking gold mushroom pops out → collect it → become Big Jack (~1.4×) → first damage shrinks him back instead of costing a heart → Big Jack can also smash a candy-crate bonus block from below. Introduced in Block Meadow, reinforced in Dino Jungle.

**Architecture:** Everything integrates into existing systems: `big` state + `grow()`/`shrinkDown()` on `Player` with the shrink-instead-of-heart rule inside `Player.damage()` (so every hazard gets it for free); head-bonk detection via a new `res.headS` on `moveEntity`; a `GrowthShroom` entity living in `game.pickups`; buddy/bonus blocks as flagged solids (`buddy: true` / `bigBonus: true`) drawn in `drawSolids` and handled by a new `game.bumpBlock(s)`; level placement as plain solid pushes in `buildLevel`.

**Tech Stack:** Zero-build vanilla JS (plain script tags, shared globals), procedural canvas art, procedural WebAudio, node vm harness (`test/harness.js`), Windows-Chrome screenshots (`tools/screenshot.sh`).

**Spec:** `docs/superpowers/specs/2026-08-23-big-buddy-growth.md`

## Global Constraints

- Zero build step, no deps, no asset files; `index.html` must keep working from `file://`.
- All art procedural canvas; all audio procedural WebAudio; cartoon-cute, faces on everything, no gore.
- Design for a 5-year-old: forgiving, icons not text, no new HUD.
- Do NOT touch localStorage key names or internal level numbering.
- Big Buddy applies only to on-foot/block-wheel play; trucks/unicorns/water/space unchanged (boarding a vehicle or entering a sub/new level resets to normal).
- Version: **1.14.0** (MINOR). Bump `GAME_VERSION` in `js/util.js`, add `## [1.14.0]` to `CHANGELOG.md`, update badge + footer + harness count in `docs/index.html`, `git tag v1.14.0`.
- `node test/harness.js` must print `ALL CHECKS PASSED` (run 2–3×); screenshot new visuals with `tools/screenshot.sh` and LOOK at the PNGs.
- Harness checks must RIDE jumps for real (no teleporting past traversal) — that's how two shipped bugs escaped before.
- Commits: `git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" commit ...`; push + verify live deploy at the end.

**Key numbers (used consistently everywhere):**
- Normal player: w=56, h=94. Big player: w=78, h=130 (scale 130/94 ≈ 1.383, within the spec's 35–45%).
- Ground top G=620 in meadow/jungle. Normal jump rise ≈ 148px (690²/(2·1600)).
- Buddy/bonus blocks: 52×52 solids with bottom at G−190 (i.e. `y: G-242`) — bonkable by normal (standing head at G−94, rise 148 ≥ 96 needed) AND big Jack (head at G−130, rise 148 ≥ 60 needed), and tall enough that Big Jack (130) walks underneath freely.

---

### Task 1: Player Big state — grow, shrink, damage soak, draw scaling, vehicle guard

**Files:**
- Modify: `js/entities.js` (Player class: constructor ~line 57, `boardUnicorn` ~75, `boardTruck` ~86, `update` ~130, `damage` ~375, `draw` ~466)
- Modify: `js/audio.js` (sfx switch, after `case 'grind'` ~line 160)
- Test: `test/harness.js` (new section, inserted just BEFORE the version-sync section near the end of the file — find it with `grep -n "version" test/harness.js`; the new section must start by calling `game.startLevel(1)` so it is state-independent)

**Interfaces:**
- Produces: `Player.big` (bool), `Player.drawK` (visual scale, lerped), `Player.grow()` (mushroom collect → Big; celebratory no-op if already big or on a vehicle/in water/space), `Player.shrinkDown()` (Big → normal with pop). `Player.damage(n)` now soaks the first hit while big (shrink, `inv=2`, NO heart lost). `AudioSys.sfx('grow')` and `AudioSys.sfx('shrinkpop')`.
- Consumes: existing `lerp`, `clamp`, `Particles.burst`, `game.shake`, `game.hudPulse`.

- [x] **Step 1: Write failing harness checks**

Insert before the version-sync section of `test/harness.js`:

```js
// ---------------- Big Buddy: grow / shrink / damage soak (v1.14.0) ----------------
vm.runInContext('game.startLevel(1)', sandbox);
frames(170); // intro auto-advances
check('bigbuddy: fresh player starts normal', G().player.big === false && G().player.h === 94);
vm.runInContext('game.player.grow()', sandbox);
check('bigbuddy: grow() sets big and enlarges hitbox', G().player.big === true && G().player.h === 130 && G().player.w === 78);
const feetBefore = G().player.y + G().player.h;
frames(30);
check('bigbuddy: big player stands stably on ground', Math.abs(G().player.y + G().player.h - 620) < 3);
vm.runInContext('game.player.inv = 0; game.player.hearts = 3; game.player.damage(1)', sandbox);
check('bigbuddy: first hit while big shrinks, costs NO heart', G().player.big === false && G().player.hearts === 3 && G().player.h === 94);
check('bigbuddy: shrink grants invulnerability', G().player.inv > 1.5);
vm.runInContext('game.player.inv = 0; game.player.damage(1)', sandbox);
check('bigbuddy: next hit uses the normal heart system', G().player.hearts === 2);
vm.runInContext('game.player.grow(); game.player.grow()', sandbox);
check('bigbuddy: double grow stays one size', G().player.h === 130);
vm.runInContext('game.player.boardTruck()', sandbox);
check('bigbuddy: boarding a vehicle resets big', G().player.big === false && G().player.w === 104);
vm.runInContext('game.startLevel(1)', sandbox);
frames(170);
check('bigbuddy: new level resets to normal size', G().player.big === false && G().player.h === 94);
```

- [x] **Step 2: Run to verify failure**

Run: `node test/harness.js 2>&1 | grep -E "FAIL|CHECKS"`
Expected: FAILs for the new bigbuddy checks (grow is not a function → the vm call throws; if it hard-crashes the harness, that also counts as the failing state).

- [x] **Step 3: Implement Player changes**

In `Player` constructor (after `this.flapCd = 0; ...` line):

```js
    this.big = false; this.drawK = 1; // Big Buddy: one free hit + 1.4x size
```

At the very top of `boardUnicorn()` (after the `if (this.vehicle === 'unicorn') return;` guard) and `boardTruck()` (after its guard) — vehicles have their own shapes:

```js
    this.big = false; this.drawK = 1;
```

In `update(dt)`, right after the `this.squash = lerp(...)` line:

```js
    this.drawK = lerp(this.drawK, this.big ? 130 / 94 : 1, 1 - Math.exp(-10 * dt));
```

New methods on `Player` (put them right after `damage(n)`):

```js
  grow() { // Big Buddy! An extra layer of squish before hearts are ever touched
    const cheer = () => {
      AudioSys.sfx('powerup');
      this.setMood('grin', 1.5);
      Particles.burst(this.cx, this.cy, 14, { colors: ['#ffd24a', '#3ec6b8', '#fff'], type: 'sparkle', sp1: 260, l1: 0.8, s1: 10 });
    };
    // vehicles / swimming / space keep their own shapes — the mushroom just cheers you on
    if (this.vehicle !== 'wheel' || game.level.water || game.level.space) { cheer(); return; }
    if (this.big) { cheer(); return; }
    this.big = true;
    this.x -= (78 - this.w) / 2;
    this.y -= 130 - this.h; // feet stay planted, head grows UP
    this.w = 78; this.h = 130;
    this.squash = 1.5; // exaggerated vertical stretch as he shoots up
    this.inv = Math.max(this.inv, 0.6); // a beat of safety while everyone giggles
    this.setMood('grin', 2);
    AudioSys.sfx('grow');
    game.shake = Math.max(game.shake, 0.15);
    game.hudPulse = 1;
    Particles.burst(this.cx, this.cy, 22, { colors: ['#ffd24a', '#3ec6b8', '#fff', '#ffe156'], type: 'star', sp1: 340, l1: 0.9, s1: 12, grav: 200 });
  }
  shrinkDown() { // pop back to normal — the hit cost the mushroom, not a heart
    if (!this.big) return;
    this.big = false;
    this.x += (this.w - 56) / 2;
    this.y += this.h - 94; // feet stay planted
    this.w = 56; this.h = 94;
    this.squash = 0.55; // squashed flat, then springs back
    AudioSys.sfx('shrinkpop');
    Particles.burst(this.cx, this.cy, 12, { colors: ['#fff', '#ffd24a', '#3ec6b8'], type: 'star', sp1: 280, l1: 0.6, s1: 10 });
  }
```

In `damage(n)`, immediately after the `if (this.inv > 0 || this.hearts <= 0) return;` guard:

```js
    if (this.big) { // Big Buddy soaks the hit: shrink with a pop, keep every heart
      this.shrinkDown();
      this.inv = 2;
      this.setMood('surprised', 1.2);
      game.shake = Math.max(game.shake, 0.3);
      this.vy = Math.min(this.vy, -320);
      return;
    }
```

In `draw(ctx)`, the on-foot/wheel branch currently reads:

```js
    const sq = clamp(this.squash, 0.6, 1.5);
    const baseY = this.y + this.h;
    ctx.translate(this.cx, baseY);
    ctx.scale(2 - sq, sq);
    ctx.translate(-this.cx, -baseY);
    const wx = this.cx, wy = this.y + this.h - 30;
    this.drawWheel(ctx, wx, wy, 30);
    this.drawBoy(ctx, wx, this.y + (this.duck ? 24 : 6), this.mood);
```

Replace with (art is authored at normal size and uniformly scaled around the feet, so wheel + hero + face all enlarge together — hitbox height 94·drawK ≈ 130 matches):

```js
    const sq = clamp(this.squash, 0.6, 1.5);
    const baseY = this.y + this.h;
    const k = this.drawK;
    ctx.translate(this.cx, baseY);
    ctx.scale((2 - sq) * k, sq * k);
    ctx.translate(-this.cx, -baseY);
    const wx = this.cx, wy = baseY - 30;
    this.drawWheel(ctx, wx, wy, 30);
    this.drawBoy(ctx, wx, baseY - 94 + (this.duck ? 24 : 6), this.mood);
```

(`baseY - 30` equals the old `this.y + this.h - 30`; `baseY - 94 + 6` equals the old `this.y + 6` at normal size, and keeps the art one normal-body tall so the scale transform lands exactly on the big hitbox.)

In `js/audio.js`, add to the sfx switch (after `case 'grind'`):

```js
      case 'grow': this.arp([330, 415, 523, 659, 830, 1047], 0.05, 0.18, 'triangle', 0.13); this.tone(200, 800, 0.4, 'sine', 0.08); break;
      case 'shrinkpop': this.tone(700, 160, 0.28, 'square', 0.12); this.noise(0.12, 0.08, 0, 1600); break;
```

- [x] **Step 4: Verify**

Run: `node --check js/entities.js && node --check js/audio.js && node test/harness.js 2>&1 | tail -3`
Expected: `ALL CHECKS PASSED`. Run harness a 2nd time to confirm determinism.

- [x] **Step 5: Commit**

```bash
cd /home/rgris/code/block-buddies && git add js/entities.js js/audio.js test/harness.js docs/superpowers && git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" commit -m "Big Buddy core: player grow/shrink state with damage soak"
```

---

### Task 2: GrowthShroom — the walking gold mushroom

**Files:**
- Modify: `js/entities.js` (new class right after the `Pickup` class, ~line 1616)
- Test: `test/harness.js` (extend the bigbuddy section)

**Interfaces:**
- Produces: `class GrowthShroom { constructor(s) }` where `s` is the buddy-block solid it pops from. Lives in `game.pickups` (implements `update(dt)`, `draw(ctx)`, `dead`, `cx`/`cy`, `bossKind: null` so the existing pickup filter and darkness-light plumbing just work). On player overlap: `this.dead = true; game.player.grow();`.
- Consumes: `moveEntity(e, lv, dt)` (gravity + wall detection via `res.wall`), `overlaps`, `Particles`, `AudioSys`, Task 1's `Player.grow()`.

- [x] **Step 1: Write failing harness checks**

Append to the bigbuddy section (player is normal-size at level 1 here after the last Task 1 check):

```js
// GrowthShroom: pops out, settles, waddles, flips at walls, can't be lost, grows Jack
vm.runInContext(`
  game.testShroom = new GrowthShroom({ x: 3540, y: 378, w: 52, h: 52 });
  game.pickups.push(game.testShroom);
  game.player.x = 100; game.player.y = 620 - 94; // out of the way
`, sandbox);
frames(90);
const sh1 = vm.runInContext('game.testShroom', sandbox);
check('shroom: settles onto the ground', Math.abs(sh1.y + sh1.h - 620) < 3);
const sx0 = sh1.x;
frames(40);
check('shroom: waddles horizontally', Math.abs(vm.runInContext('game.testShroom.x', sandbox) - sx0) > 30);
vm.runInContext('game.testShroom.x = 3300; game.testShroom.y = 620 - 44; game.testShroom.dir = 1;', sandbox);
frames(60); // block pile at x=3356 is a wall in its face
check('shroom: turns around at walls', vm.runInContext('game.testShroom.dir', sandbox) === -1);
vm.runInContext('game.testShroom.y = 1500;', sandbox); // "fell out of the world"
frames(3);
check('shroom: can never be lost (pops back to its block)', vm.runInContext('game.testShroom.y', sandbox) < 500);
vm.runInContext('game.player.x = game.testShroom.x; game.player.y = game.testShroom.y - 20;', sandbox);
frames(4);
check('shroom: collecting it grows Jack', G().player.big === true && vm.runInContext('game.testShroom.dead', sandbox) === true);
frames(30);
check('shroom: collected shroom leaves the pickup list', !G().pickups.includes(vm.runInContext('game.testShroom', sandbox)));
vm.runInContext('game.player.shrinkDown()', sandbox);
```

- [x] **Step 2: Run to verify failure**

Run: `node test/harness.js 2>&1 | grep -E "FAIL|CHECKS|Error" | head -5`
Expected: failure (GrowthShroom is not defined).

- [x] **Step 3: Implement GrowthShroom**

Add after the `Pickup` class in `js/entities.js`:

```js
// ================================================================ growth mushroom
// The Big Buddy prize: pops out of a bonked Buddy Block with a happy hop, lands,
// and waddles slowly back and forth (85 px/s vs Jack's 300 — a chase he always
// wins). Turns at walls and level edges; if it somehow tumbles out of the world
// it pops right back onto its home block. Lives in game.pickups so darkness
// lights, update/draw and filtering all come free.
class GrowthShroom {
  constructor(s) { // s = the buddy-block solid it emerges from
    this.w = 46; this.h = 44;
    this.x = s.x + s.w / 2 - this.w / 2;
    this.y = s.y - this.h;
    this.homeX = this.x; this.homeY = this.y;
    this.vx = 0; this.vy = -380; // pops out with a little hop
    this.dir = 1;
    this.t = rand(10);
    this.dead = false;
    this.bossKind = null;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt) {
    if (this.dead) return;
    this.t += dt;
    if (this.y > game.level.h + 60) { // never lost: back to its home block
      this.x = this.homeX; this.y = this.homeY;
      this.vy = -380;
      Particles.burst(this.cx, this.cy, 8, { colors: ['#ffd24a', '#3ec6b8'], type: 'sparkle', sp1: 140, l1: 0.5, s1: 8 });
    }
    this.vy += 1300 * dt;
    if (this.vy > 800) this.vy = 800;
    this.vx = this.dir * 85;
    const r = moveEntity(this, game.level, dt);
    if (r.wall) this.dir *= -1;
    if (this.x <= 0) { this.x = 0; this.dir = 1; }
    if (this.x >= game.level.w - this.w) { this.x = game.level.w - this.w; this.dir = -1; }
    if (overlaps(this, game.player)) { this.dead = true; game.player.grow(); }
  }
  draw(ctx) {
    if (this.dead) return;
    const cx = this.cx, b = this.y + this.h;
    const step = Math.sin(this.t * 11);
    ctx.save();
    ctx.translate(cx, b);
    ctx.rotate(step * 0.07); // happy waddle
    ctx.translate(-cx, -b);
    ctx.save(); // golden glow: "I'm a prize!"
    ctx.globalAlpha = 0.22 + 0.1 * Math.sin(this.t * 5);
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.arc(cx, this.cy, 38, 0, TAU); ctx.fill();
    ctx.restore();
    // tiny walking feet
    ctx.fillStyle = '#e8a23c';
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + sd * 10 + step * 4 * sd, b - 2, 7, 4, 0, 0, TAU);
      ctx.fill();
    }
    // stalk
    ctx.fillStyle = '#fff7e8';
    rr(ctx, cx - 12, this.y + 16, 24, this.h - 20, 8); ctx.fill();
    ctx.strokeStyle = '#d8b890'; ctx.lineWidth = 2;
    rr(ctx, cx - 12, this.y + 16, 24, this.h - 20, 8); ctx.stroke();
    // gold cap with turquoise spots (deliberately NOT the pink bouncer mushroom)
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.ellipse(cx, this.y + 17, 23, 17, 0, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(cx, this.y + 17, 23, 17, 0, Math.PI, TAU); ctx.stroke();
    ctx.fillStyle = '#3ec6b8';
    for (const [ox, oy, r2] of [[-12, -5, 4.5], [1, -9, 5.5], [13, -4, 4]]) {
      ctx.beginPath(); ctx.arc(cx + ox, this.y + 17 + oy, r2, 0, TAU); ctx.fill();
    }
    // googly face on the stalk
    drawFace(ctx, cx, this.y + 28, 17, 'grin', this.t, this.homeX);
    ctx.restore();
    if (chance(0.05)) Particles.burst(cx + rand(-16, 16), this.y + rand(0, 26), 1, { colors: ['#ffd24a', '#3ec6b8'], type: 'sparkle', sp1: 25, grav: -50, l1: 0.6, s1: 7, up: 0 });
  }
}
```

- [x] **Step 4: Verify**

Run: `node --check js/entities.js && node test/harness.js 2>&1 | tail -3`
Expected: `ALL CHECKS PASSED` (run twice).

- [x] **Step 5: Commit**

```bash
cd /home/rgris/code/block-buddies && git add js/entities.js test/harness.js && git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" commit -m "GrowthShroom: the waddling gold mushroom prize"
```

---

### Task 3: Head-bonk plumbing — moveEntity headS + game.bumpBlock + buddy/bonus behavior

**Files:**
- Modify: `js/entities.js` (`moveEntity` head branch ~line 43; Player on-foot branch after `const res = moveEntity(...)` ~line 334)
- Modify: `js/game.js` (new `game.bumpBlock` near `game.smashWall` ~line 247; bumpT decay in `updatePlay` just above `for (const p of game.pickups) p.update(dt);` ~line 602)
- Test: `test/harness.js` (extend bigbuddy section)

**Interfaces:**
- Consumes: `GrowthShroom` (Task 2), `Player.big` (Task 1).
- Produces: `moveEntity` result gains `headS` (the solid whose underside was hit). `game.bumpBlock(s)`: buddy blocks spawn one GrowthShroom then go dormant (`s.used = true`); `bigBonus` blocks break (via the existing `s.broken = true` convention) ONLY when `game.player.big`, spawning 3 physics-scattered candy pickups; both get a `s.bumpT` hop animation (decayed each frame in `updatePlay`). Solid flags consumed later by Task 4 (drawing) and Task 5 (placement): `{ buddy: true, used: false, bumpT: 0 }` and `{ bigBonus: true, bumpT: 0 }`.

- [x] **Step 1: Write failing harness checks**

Append to the bigbuddy section. These RIDE the real jump into the block — no teleporting past the traversal:

```js
// Head-bonk: ride a real jump into a buddy block and a bonus block
vm.runInContext(`
  game.testBuddy = { x: 3540, y: 620 - 242, w: 52, h: 52, buddy: true };
  game.testBonus = { x: 3920, y: 620 - 242, w: 52, h: 52, bigBonus: true };
  game.level.solids.push(game.testBuddy, game.testBonus);
  game.player.x = 3540 + 26 - game.player.w / 2; game.player.y = 620 - game.player.h;
  game.player.vx = 0; game.player.vy = 0;
`, sandbox);
const pickupsBefore = G().pickups.length;
tap('ArrowUp');
frames(40);
check('bonk: jumping into a buddy block uses it', vm.runInContext('game.testBuddy.used', sandbox) === true);
check('bonk: a GrowthShroom pops out', G().pickups.length === pickupsBefore + 1 && vm.runInContext('game.pickups.some(p => p instanceof GrowthShroom)', sandbox));
tap('ArrowUp');
frames(40);
check('bonk: a used buddy block stays quiet', G().pickups.filter ? vm.runInContext('game.pickups.filter(p => p instanceof GrowthShroom).length', sandbox) === 1 : false);
vm.runInContext('game.pickups = game.pickups.filter(p => !(p instanceof GrowthShroom));', sandbox);
// small Jack cannot break the candy crate...
vm.runInContext('game.player.x = 3920 + 26 - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vy = 0;', sandbox);
tap('ArrowUp');
frames(40);
check('bonk: small Jack cannot break the bonus crate', !vm.runInContext('game.testBonus.broken', sandbox));
// ...Big Jack smashes it into candy
vm.runInContext('game.player.grow(); game.player.x = 3920 + 26 - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vy = 0;', sandbox);
const candyBefore = G().pickups.length;
tap('ArrowUp');
frames(40);
check('bonk: BIG Jack smashes the bonus crate', vm.runInContext('game.testBonus.broken', sandbox) === true);
check('bonk: smashed crate rains candy', G().pickups.length >= candyBefore + 3);
vm.runInContext('game.player.shrinkDown()', sandbox);
```

- [x] **Step 2: Run to verify failure**

Run: `node test/harness.js 2>&1 | grep -E "FAIL|CHECKS" | head -8`
Expected: the new bonk checks FAIL (nothing reacts to the head hit yet).

- [x] **Step 3: Implement**

`js/entities.js` — in `moveEntity`, the head-hit branch:

```js
    } else if (e.vy < 0) {
      e.y = s.y + s.h; e.vy = 0; res.head = true; res.headS = s;
    }
```

`js/entities.js` — in `Player.update`, on-foot branch, right after the `if (res.ground && !wasGround) { ... }` landing block:

```js
      if (res.head && res.headS && (res.headS.buddy || res.headS.bigBonus)) game.bumpBlock(res.headS);
```

`js/game.js` — after `game.smashWall`:

```js
game.bumpBlock = function (s) { // head-bonk on a Buddy Block or a candy crate
  const pl = game.player;
  if (s.buddy) {
    if (s.used) { s.bumpT = 0.2; AudioSys.sfx('thud'); return; } // sleepy now
    s.used = true; s.bumpT = 0.35;
    AudioSys.sfx('boing');
    AudioSys.sfx('collect');
    pl.setMood('surprised', 0.8);
    Particles.burst(s.x + s.w / 2, s.y, 12, { colors: ['#ffd24a', '#3ec6b8', '#fff'], type: 'sparkle', sp1: 240, l1: 0.7, s1: 10, grav: 150 });
    game.pickups.push(new GrowthShroom(s));
    return;
  }
  if (s.bigBonus && !s.broken) {
    if (pl.big) { // SMASH! candy everywhere
      s.broken = true;
      AudioSys.sfx('smash');
      AudioSys.sfx('candy');
      game.shake = Math.max(game.shake, 0.35);
      pl.setMood('grin', 1.5);
      Particles.candyBurst(s.x + s.w / 2, s.y + s.h / 2, 10);
      Particles.burst(s.x + s.w / 2, s.y + s.h / 2, 14, { colors: ['#ff8fb0', '#fff', '#ffd24a'], type: 'block', sp1: 360, l1: 0.9, s1: 12, grav: 800 });
      for (let i = 0; i < 3; i++) {
        const c = new Pickup(s.x + s.w / 2, s.y - 20, 'candy');
        c.physics = true;
        c.vx = (i - 1) * 130;
        c.vy = -330;
        game.pickups.push(c);
      }
    } else { // small Jack just wobbles it — funny, not punishing
      s.bumpT = 0.25;
      AudioSys.sfx('thud');
      pl.setMood('surprised', 0.6);
      Particles.burst(s.x + s.w / 2, s.y + s.h, 4, { colors: ['#fff'], sp1: 90, l1: 0.3, grav: 200, up: 10, s1: 6 });
    }
  }
};
```

`js/game.js` — in `updatePlay`, just above `for (const p of game.pickups) p.update(dt);`:

```js
  for (const s of lv.solids) if (s.bumpT) s.bumpT = Math.max(0, s.bumpT - dt); // block bonk hop
```

- [x] **Step 4: Verify**

Run: `node --check js/entities.js && node --check js/game.js && node test/harness.js 2>&1 | tail -3`
Expected: `ALL CHECKS PASSED` (run twice).

- [x] **Step 5: Commit**

```bash
cd /home/rgris/code/block-buddies && git add js/entities.js js/game.js test/harness.js && git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" commit -m "Head-bonk plumbing: buddy blocks spawn shrooms, Big Jack smashes candy crates"
```

---

### Task 4: Drawing the Buddy Block and the candy crate

**Files:**
- Modify: `js/levels.js` (`drawSolids`, new branches right before the `if (s.bouncy)` branch ~line 1598)

**Interfaces:**
- Consumes: solid flags `buddy` / `used` / `bumpT` / `bigBonus` (Task 3), `rr`, `drawFace`, `POW`, `TAU`.
- Produces: nothing new for later tasks — pure rendering. (The node-vm harness can't see visuals; Task 7's screenshots are the verification.)

- [x] **Step 1: Implement the two draw branches**

In `drawSolids`, immediately before `if (s.bouncy) {`:

```js
    if (s.buddy) { // Buddy Block: turquoise block wearing a golden mushroom emblem
      const hop = s.bumpT ? Math.sin((s.bumpT / 0.35) * Math.PI) * 12 : 0;
      const by = s.y - hop;
      const mx = s.x + s.w / 2;
      if (!s.used) { // pulsing glow, like a pickup: "come bonk me!"
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.12 * Math.sin(t * 4);
        ctx.fillStyle = '#ffd24a';
        ctx.beginPath(); ctx.arc(mx, by + s.h / 2, 46, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = s.used ? '#9a94a8' : '#3ec6b8';
      rr(ctx, s.x, by, s.w, s.h, 10); ctx.fill();
      ctx.strokeStyle = s.used ? '#6a6478' : '#1e8a80'; ctx.lineWidth = 3;
      rr(ctx, s.x, by, s.w, s.h, 10); ctx.stroke();
      // golden mushroom emblem up top (gray once spent)
      ctx.fillStyle = s.used ? '#c9c1d6' : '#ffd24a';
      ctx.beginPath(); ctx.ellipse(mx, by + 15, 13, 9, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      rr(ctx, mx - 4, by + 15, 8, 7, 3); ctx.fill();
      drawFace(ctx, mx, by + 36, 20, s.used ? 'sleepy' : 'happy', t, s.x);
      continue;
    }
    if (s.bigBonus) { // candy crate: pink stripes — only a BIG buddy can crack it
      const hop = s.bumpT ? Math.sin((s.bumpT / 0.25) * Math.PI) * 8 : 0;
      const by = s.y - hop;
      ctx.fillStyle = '#fff';
      rr(ctx, s.x, by, s.w, s.h, 10); ctx.fill();
      ctx.save();
      ctx.beginPath(); rr(ctx, s.x, by, s.w, s.h, 10); ctx.clip();
      ctx.fillStyle = '#ff8fb0';
      for (let d = -s.h; d < s.w; d += 24) { // diagonal candy stripes
        ctx.beginPath();
        ctx.moveTo(s.x + d, by + s.h); ctx.lineTo(s.x + d + s.h, by);
        ctx.lineTo(s.x + d + s.h + 12, by); ctx.lineTo(s.x + d + 12, by + s.h);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = '#d6559a'; ctx.lineWidth = 3.5;
      rr(ctx, s.x, by, s.w, s.h, 10); ctx.stroke();
      drawFace(ctx, s.x + s.w / 2, by + s.h / 2 + 4, 22, s.bumpT ? 'surprised' : 'grin', t, s.x);
      continue;
    }
```

- [x] **Step 2: Verify**

Run: `node --check js/levels.js && node test/harness.js 2>&1 | tail -3`
Expected: syntax OK, `ALL CHECKS PASSED` (rendering runs against the canvas stub during the harness playthrough, so a crash here would surface).

- [x] **Step 3: Commit**

```bash
cd /home/rgris/code/block-buddies && git add js/levels.js && git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" commit -m "Draw the Buddy Block and the candy crate"
```

---

### Task 5: Level placement — Block Meadow + Dino Jungle, ridden for real

**Files:**
- Modify: `js/levels.js` (`buildLevel`: n===1 block ~line 82; n===10 block ~line 543)
- Test: `test/harness.js` (extend bigbuddy section)

**Interfaces:**
- Consumes: everything above.
- Produces: real placements the harness and players use. Meadow: buddy block at x=3540 (between checkpoint 3100 and spider 3700), candy crate at x=3920 (before the gate at 4080, off the main route — both float at y=G−242, walk-under clearance 190px > big Jack's 130). Jungle: buddy block at x=560 (after the ladder door at 260, safely clear of FireBreather #1 at x=1000 whose leftward flame reaches x≈758).

- [x] **Step 1: Write failing harness checks**

Append to the bigbuddy section:

```js
// Real placements: meadow teaches, jungle reinforces (ridden with real jumps)
vm.runInContext('game.startLevel(1)', sandbox);
frames(170);
const mBuddy = G().level.solids.find(s => s.buddy);
const mBonus = G().level.solids.find(s => s.bigBonus);
check('meadow: buddy block placed after the last checkpoint', !!mBuddy && mBuddy.x > 3100 && mBuddy.x < 3700);
check('meadow: candy crate before the gate, off the route', !!mBonus && mBonus.x > mBuddy.x && mBonus.x + mBonus.w < 4035);
check('meadow: both blocks bonkable but walk-under-able', mBuddy.y + mBuddy.h === 620 - 190 && mBonus.y + mBonus.h === 620 - 190);
vm.runInContext(`game.player.x = ${'${'}0${'}'}; game.player.y = 620 - game.player.h; game.player.vy = 0;`.replace('${0}', String(0)), sandbox); // placeholder guard, replaced below
// (real ride below)
vm.runInContext('game.player.x = game.level.solids.find(s=>s.buddy).x + 26 - game.player.w/2; game.player.y = 620 - game.player.h; game.player.vy = 0; game.player.vx = 0;', sandbox);
tap('ArrowUp');
frames(40);
check('meadow: real jump bonks the buddy block', mBuddy.used === true);
frames(140); // let the shroom land and waddle
vm.runInContext(`
  const sh = game.pickups.find(p => p instanceof GrowthShroom);
  if (sh) { game.player.x = sh.x; game.player.y = sh.y - 30; }
`, sandbox);
frames(5);
check('meadow: chasing down the shroom makes Big Jack', G().player.big === true);
vm.runInContext('game.player.x = game.level.solids.find(s=>s.bigBonus).x + 26 - game.player.w/2; game.player.y = 620 - game.player.h; game.player.vy = 0; game.player.vx = 0;', sandbox);
tap('ArrowUp');
frames(40);
check('meadow: Big Jack cracks the candy crate on the way to the gate', mBonus.broken === true);

// Dino Jungle: grow early, then let the first dino's flame teach the shrink lesson
vm.runInContext('game.startLevel(10)', sandbox);
frames(170);
const jBuddy = G().level.solids.find(s => s.buddy);
check('jungle: buddy block sits before the first fire dino', !!jBuddy && jBuddy.x + jBuddy.w < 758);
vm.runInContext('game.player.x = game.level.solids.find(s=>s.buddy).x + 26 - game.player.w/2; game.player.y = 620 - game.player.h; game.player.vy = 0; game.player.vx = 0;', sandbox);
tap('ArrowUp');
frames(40);
check('jungle: real jump bonks the jungle buddy block', jBuddy.used === true);
frames(120);
vm.runInContext(`
  const sh = game.pickups.find(p => p instanceof GrowthShroom);
  if (sh) { game.player.x = sh.x; game.player.y = sh.y - 30; }
`, sandbox);
frames(5);
check('jungle: Big Jack rides again', G().player.big === true);
// walk into the first dino's flame FOR REAL: force the flame stage and stand in it
vm.runInContext(`
  const d = game.spiders.find(s => s.kind === 'firedino');
  d.state = 'angry'; d.cycleT = 2.75; // flame stage of the cycle
  game.player.x = d.x - 120; game.player.y = 620 - game.player.h;
  game.player.inv = 0; game.player.hearts = 3;
`, sandbox);
frames(10);
check('jungle: dino flame shrinks Big Jack instead of taking a heart', G().player.big === false && G().player.hearts === 3);

// Big survives a sub-room visit (exitSub restores the host player instance)
vm.runInContext('game.startLevel(1)', sandbox);
frames(170);
vm.runInContext('game.player.grow(); game.enterSub("piperoom");', sandbox);
frames(170);
check('sub: sublevel player starts normal-sized', G().player.big === false && G().player.h === 94);
vm.runInContext('game.exitSub()', sandbox);
frames(5);
check('sub: Big Jack is still big back in the meadow', G().player.big === true && G().player.h === 130);
```

Note: delete the stray `placeholder guard` line when writing the real file — it is a leftover from drafting; the ride sequence below it is the real content. (Self-review already flagged it; do not include it.)

- [x] **Step 2: Run to verify failure**

Run: `node test/harness.js 2>&1 | grep -E "FAIL|CHECKS" | head -8`
Expected: the placement checks FAIL (no buddy/bigBonus solids exist in real levels yet).

- [x] **Step 3: Implement placements**

`buildLevel`, n===1, after the `lv.subDoors.push(new SubDoor(2950, G, 'piperoom', 'pipe'));` line:

```js
    // ---- Big Buddy lesson (v1.14.0): after the last checkpoint, a glowing
    // turquoise block with a golden mushroom emblem floats overhead. Bonk it,
    // chase the waddling gold shroom, grow HUGE, then meet the last spider —
    // and an optional candy crate near the gate that only BIG Jack can smash.
    // Bottom edge G-190: bonkable from the ground (jump rise 148 > 96 needed),
    // tall enough that even Big Jack (130) strolls underneath.
    lv.solids.push({ x: 3540, y: G - 242, w: 52, h: 52, buddy: true });
    lv.solids.push({ x: 3920, y: G - 242, w: 52, h: 52, bigBonus: true });
```

`buildLevel`, n===10, after the `lv.subDoors.push(new SubDoor(260, G, 'treehouse', 'ladder'));` line:

```js
    // ---- Big Buddy, lesson two (v1.14.0): a buddy block right at the jungle
    // entrance so Jack can grow BEFORE the first fire dino — its flame then
    // teaches "big soaks a hit" without a word. (Flame #1 reaches x≈758;
    // the block at 560 keeps the bonk spot safely clear of it.)
    lv.solids.push({ x: 560, y: G - 242, w: 52, h: 52, buddy: true });
```

- [x] **Step 4: Verify**

Run: `node test/harness.js 2>&1 | tail -3` — expected `ALL CHECKS PASSED`; run 3× (this section leans on physics timing, so shake out nondeterminism now).

- [x] **Step 5: Commit**

```bash
cd /home/rgris/code/block-buddies && git add js/levels.js test/harness.js && git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" commit -m "Place Big Buddy in Block Meadow and Dino Jungle"
```

---

### Task 6: Version, changelog, docs, CLAUDE.md

**Files:**
- Modify: `js/util.js:3` (`GAME_VERSION`)
- Modify: `CHANGELOG.md` (new top entry)
- Modify: `docs/index.html` (badge line 78, harness-count paragraph line 728, footer line 785, plus a Big Buddy paragraph in the systems section and mentions in the World 1 / World 10 rows)
- Modify: `CLAUDE.md` (entities.js row: add `GrowthShroom`; Key subsystems: new Big Buddy bullet; harness check count)

**Interfaces:**
- Consumes: final PASS count from `node test/harness.js | grep -c '^PASS'` (the harness itself enforces version/changelog/docs sync, so this task must come before the final verification).
- Produces: consistent 1.14.0 stamps everywhere.

- [x] **Step 1: Bump version**

`js/util.js`: `const GAME_VERSION = '1.14.0';`

- [x] **Step 2: CHANGELOG entry**

Add at the top of the entries in `CHANGELOG.md` (match the existing entry format exactly — read the current top entry first):

```markdown
## [1.14.0] - 2026-08-23
### Added
- **Big Buddy growth system**: bonk the new turquoise Buddy Block from below
  and a gold, turquoise-spotted mushroom with tiny feet pops out and waddles
  around — catch it and Jack (or Becca) grows ~40% BIGGER. The first hit while
  big shrinks you back with a pop instead of costing a heart; hearts work
  exactly as before after that.
- **Candy crates**: pink-striped bonus blocks only BIG Jack can smash from
  underneath — candy explosion inside. Small Jack just wobbles them (funny,
  not punishing).
- Buddy Blocks placed in Block Meadow (the teaching sequence before the last
  spider and gate, plus a candy crate) and early Dino Jungle (grow before the
  first fire dino — its flame teaches the shrink rule wordlessly).
- New `grow` / `shrinkpop` sounds; growth stretch + shrink squash animations.
```

- [x] **Step 3: docs/index.html**

- Badge (line 78) and footer (line 785): `v1.13.1` → `v1.14.0`.
- Update the harness `<li>` (line 728): new check count (use the real number from `node test/harness.js | grep -c '^PASS'`) and extend the playthrough description with "the Big Buddy growth system (real bonk jumps, shroom chase, damage-soak shrink, candy-crate smash, sub-room survival)".
- Add a short "Big Buddy growth" paragraph to the systems section describing: buddy block solids (`buddy`/`used`/`bumpT`), `GrowthShroom` in `game.pickups`, `Player.big` + `grow()`/`shrinkDown()`, the damage-soak rule in `Player.damage`, `game.bumpBlock`, candy crates (`bigBonus`), vehicle/level reset rules.
- Mention the new blocks in the World 1 and World 10 level descriptions.

- [x] **Step 4: CLAUDE.md**

- entities.js row: add `GrowthShroom` and note `Player.big` grow/shrink.
- Key subsystems: add a **Big Buddy** bullet (block bottom at G−242 rule, damage-soak lives in `Player.damage`, `game.bumpBlock`, vehicles/new-levels reset, crates use `bigBonus` not `breakable` so Super Mode can't smash them).
- Update the "423 checks" figure to the new real count (it appears in the Testing section).

- [x] **Step 5: Verify + commit**

Run: `node test/harness.js 2>&1 | tail -3` (the version/changelog/docs sync checks now pass against 1.14.0). Expected `ALL CHECKS PASSED`.

```bash
cd /home/rgris/code/block-buddies && git add js/util.js CHANGELOG.md docs/index.html CLAUDE.md && git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" commit -m "v1.14.0: version, changelog, docs, CLAUDE.md for Big Buddy"
```

---

### Task 7: Screenshots, final verification, ship

**Files:**
- Create: `shots/buddy-block.png`, `shots/shroom-chase.png`, `shots/big-jack.png`, `shots/crate-smash.png`, `shots/jungle-buddy.png` (via `tools/screenshot.sh`)

**Interfaces:**
- Consumes: everything; the live URL `https://polarispixels.github.io/block-buddies/`.

- [x] **Step 1: Screenshots — then LOOK at every PNG**

```bash
cd /home/rgris/code/block-buddies
tools/screenshot.sh buddy-block 'game.startLevel(1); game.introT=99; step(5); game.player.x=3380; step(40);'
tools/screenshot.sh shroom-chase 'game.startLevel(1); game.introT=99; step(5); game.player.x=3420; step(2); game.bumpBlock(game.level.solids.find(s=>s.buddy)); step(80);'
tools/screenshot.sh big-jack 'game.startLevel(1); game.introT=99; step(5); game.player.x=3600; step(2); game.player.grow(); step(35);'
tools/screenshot.sh crate-smash 'game.startLevel(1); game.introT=99; step(5); game.player.grow(); game.player.x=3894; step(2); game.player.vy=-690; step(14); step(30);'
tools/screenshot.sh jungle-buddy 'game.startLevel(10); game.introT=99; step(5); game.player.x=480; step(40);'
```

Read each PNG with the Read tool. Check: buddy block reads as special (glow + emblem + face), shroom is clearly NOT the pink bouncer, Big Jack is obviously bigger with wheel scaled, crate stripes distinct from cracked walls, nothing overlaps badly (candy arcs, hints, gate glow). Fix art/placement and re-shoot until it looks right.

- [x] **Step 2: Full verification**

```bash
node --check js/util.js && node --check js/audio.js && node --check js/entities.js && node --check js/levels.js && node --check js/game.js
node test/harness.js | tail -3   # run at least twice more
```
Expected: `ALL CHECKS PASSED` every run.

- [x] **Step 3: Ship**

```bash
cd /home/rgris/code/block-buddies
git add -A && git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" commit -m "Big Buddy: grow big, soak a hit, smash candy crates (v1.14.0)" || true
git push && git tag v1.14.0 && git push --tags
```

- [x] **Step 4: Verify the live deploy (~40–60s after push)**

```bash
sleep 60
curl -s https://polarispixels.github.io/block-buddies/js/util.js | grep "1.14.0"
curl -s https://polarispixels.github.io/block-buddies/js/entities.js | grep -c "GrowthShroom"
```
Expected: both greps hit. If not, wait 30s and retry (Pages rebuild).

---

## Self-review notes

- **Spec coverage:** bonk-from-below (T3), bounce/used animation (T3/T4), mushroom emerge/settle/walk/turn/never-lost (T2), collect→grow ~40% with sound/stretch (T1), remain big until damage (T1), shrink-not-heart + invuln + pop (T1), big-only candy crate visually distinct from cracked walls and immune to Super Mode smash (`bigBonus` flag ≠ `breakable`) (T3/T4), meadow teaching sequence + optional crate (T5), jungle second lesson before fire dino (T5), vehicles/water/space out of scope via `grow()` guard + board reset (T1), reset on new level via fresh Player in `startLevel`/`enterSub` (already existing behavior, checked in T1/T5), no new HUD, docs/version (T6), acceptance criteria 1–12 all covered, extensible for future Tiny & Giant Garden (grow/shrinkDown are public, blocks are data flags).
- **Type consistency:** solid flags `buddy`/`used`/`bumpT`/`bigBonus`/`broken`; `GrowthShroom(s)` takes the block solid; `game.bumpBlock(s)`; `Player.grow()`/`shrinkDown()`/`big`/`drawK`. Sizes 56/94 ↔ 78/130 everywhere.
- **Known drafting artifact:** Task 5 Step 1 contains one marked placeholder-guard line to omit — flagged inline.
