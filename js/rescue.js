'use strict';
// ================================================================ the great dinosaur rescue
// DINO JUNGLE stage 1 ('jungle2', v1.28.0): the pod crash from the Alien
// Space Station opens a storm-damaged jungle where five baby dinosaurs are
// missing. Spec: docs/superpowers/specs/2026-09-04-great-dinosaur-rescue-
// design.md. Layers in this file:
//   BabyDino  — a follower (kinds trike/longneck/anky/ptero/fire) with a
//               tiny mood machine; the rescued ones parade behind Jack.
//   DinoRescue (lv.puzzle) — the five rescue stories, the nursery, the
//               landslide barrier team moves, the crash + finale cutscenes.
//   DinoRun   (lv.ride) — the victory run on RideMode/RideCourse (js/ride.js):
//               Jack rides the T-rex through ramps, collapsing logs and
//               bouncing plants to a mega launch onto the candy pile.
// Art: js/dinoart.js (DINO_ART) + js/junglescene.js (JG_SCENE).

const DR = {
  G: 1900, C: 2380, W: 24000, H: 2600, // wide enough for the whole T-rex run
  NESTS: [1000, 1200, 1400, 1650, 1850],   // the nursery's five empty nests
  KINDS: ['trike', 'longneck', 'anky', 'ptero', 'fire'],
  LOG_X: 4000, LEDGE_X: 5600, CHAMBER: [3900, 4000, 4100],
  VALVE_X: 7100, BUD_X: 7500, PAD_X: 8100, PTERO_X: 8000,
  FIRE_X: 9900, THORN_X: 9500, PATCH: [9540, 9800], VOLC_VALVE: 9100,
  BARRIER: 11150, RUN_START: 12300
};

// a hint bubble with an icon (reuses the flower-land bubble shape)
function drBubble(ctx, x, y, r, iconFn, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x - r * 0.6, y + r * 1.05, r * 0.22, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(40,25,50,0.4)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  iconFn(ctx, x, y); ctx.restore();
}

// ---------------------------------------------------------------- baby dino
class BabyDino {
  constructor(kind, cx, groundY, o = {}) {
    this.kind = kind; this.w = 80; this.h = 64;
    this.x = cx - this.w / 2; this.y = groundY - this.h;
    this.vx = 0; this.vy = 0; this.facing = o.facing || -1;
    this.mood = o.mood || 'idle'; this.k = 0; this.moodT = 0;
    this.state = o.state || 'waiting'; // waiting (in its story) -> rescued (parades)
    this.t = rand(9); this.hopT = 0; this.onGround = false; this.special = null;
    this.fixed = !!o.fixed; // scripted placement (ledges, branches): no physics until rescued
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  setMood(m, time = 1, k = 0) { this.mood = m; this.moodT = time; this.k = k; }
  update(dt, target, lv) {
    this.t += dt;
    if (this.moodT > 0) { this.moodT -= dt; if (this.moodT <= 0 && this.state === 'rescued') this.mood = 'idle'; }
    if (this.state !== 'rescued' || !target) return;
    if (this.special) return; // the finale owns it
    // the parade: trail the target with a gap, hop when it hops, never get lost
    const gap = 74;
    const tx = target.cx - Math.sign(target.facing || 1) * gap;
    const dx = tx - this.cx;
    if (Math.abs(dx) > 900) { this.x = tx - this.w / 2; this.y = target.y + target.h - this.h; }
    if (Math.abs(dx) > 30) { this.vx = clamp(dx * 3, -260, 260); this.facing = dx < 0 ? -1 : 1; if (this.mood === 'idle') this.mood = 'walk'; }
    else { this.vx *= 0.7; if (this.mood === 'walk') this.mood = 'idle'; }
    if (this.onGround && target.vy < -300 && this.hopT <= 0) { this.vy = -420; this.hopT = 0.8; this.setMood('happy', 0.6); }
    this.hopT = Math.max(0, this.hopT - dt);
    this.vy += 1600 * dt;
    const r = moveEntity(this, lv, dt);
    this.onGround = r.ground;
    if (r.wall && this.onGround) this.vy = -380; // little hop over steps
    if (this.y > lv.h + 100) { this.x = target.x; this.y = target.y; this.vy = 0; }
    this.k = this.mood === 'walk' ? (this.t * 8) % 1 : this.mood === 'happy' ? Math.abs(Math.sin(this.t * 10)) : this.k;
  }
  draw(ctx, t) {
    DINO_ART.baby(ctx, this.kind, this.cx, this.y + this.h, 90, this.t, { mood: this.mood, facing: this.facing, k: this.k });
  }
}

// ---------------------------------------------------------------- the machine
class DinoRescue {
  constructor(lv) {
    const G = DR.G, C = DR.C;
    this.t = 0; this.parade = []; this.solids = []; this.zzz = []; this.rings = []; this.notes = [];
    this.crash = null; this.crashDone = false;
    this.toastT = 0; this.toastKind = null;
    this.music = ''; this.calm = 0; this.rescuedAll = false;
    // ---- rescue 1: the trike under the weak log ----
    this.log = { x: DR.LOG_X, broken: false, k: 0, solid: { x: DR.LOG_X - 70, y: G - 110, w: 140, h: 110, skipDraw: true, weak: true } };
    this.solids.push(this.log.solid);
    this.trike = new BabyDino('trike', DR.LOG_X + 120, G, { mood: 'stuck', facing: -1 }); // pinned just past the log: its worried head peeks out
    this.bushes = [{ x: 3300, shake: 0 }, { x: 3550, shake: 0 }, { x: 3850, shake: 0 }];
    this.callT = 2;
    // ---- rescue 2: the longneck and the fruit ----
    this.trees = [{ kind: 'apple', x: 4500 }, { kind: 'banana', x: 4800 }, { kind: 'berry', x: 5100 }];
    this.fruit = null; // the carried fruit {kind, x, y, t}
    this.longneck = new BabyDino('longneck', DR.LEDGE_X, G - 160, { mood: 'idle', facing: -1, fixed: true });
    this.grove = { tries: 0 };
    // ---- rescue 3: the echo caves + the crystal chamber ----
    this.forks = [
      { x: 1800, trueLane: 'upper', src: { x: 2350, y: C - 240 } },
      { x: 2700, trueLane: 'lower', src: { x: 3200, y: C - 60 } },
      { x: 3450, trueLane: 'upper', src: { x: 3800, y: C - 240 } }
    ];
    this.bats = [{ x: 2450, y: C - 110, hic: 0 }, { x: 3250, y: C - 330, hic: 0 }, { x: 3800, y: C - 100, hic: 0 }];
    this.ringT = 0;
    this.crystals = DR.CHAMBER.map((x, i) => ({ x, color: ['red', 'blue', 'yellow'][i], glow: 0, solid: { x: x - 42, y: C - 190 - 84, w: 84, h: 84, puzzleBlock: true, idx: i, skipDraw: true } }));
    for (const c of this.crystals) this.solids.push(c.solid);
    this.echo = { round: 0, seq: [], showing: false, showI: 0, showT: 0, input: [], solved: false, idle: 1.2, lock: 0 };
    this.anky = new BabyDino('anky', 4180, C, { mood: 'sleep', facing: -1 });
    // ---- rescue 4: the canopy, the bloom, the scared ptero ----
    this.valve = { x: DR.VALVE_X, y: G - 900, on: false };
    this.bud = { x: DR.BUD_X, y: G - 950, k: 0, solid: { x: DR.BUD_X - 60, y: G - 950 - 198, w: 120, h: 20, oneWay: true, skipDraw: true, broken: true } };
    this.solids.push(this.bud.solid);
    this.ptero = new BabyDino('ptero', DR.PTERO_X, G - 1250, { mood: 'scared', facing: -1, fixed: true });
    this.pteroLoop = null;
    // ---- rescue 5: the fire baby, the thorns, the patch, the valve ----
    this.thorn = { x: DR.THORN_X, burn: 0, solid: { x: DR.THORN_X - 30, y: G - 260, w: 60, h: 260, skipDraw: true, thorn: true } };
    this.solids.push(this.thorn.solid);
    this.patch = { x0: DR.PATCH[0], x1: DR.PATCH[1], on: false, steam: 0 };
    this.volcValve = { x: DR.VOLC_VALVE, y: G - 260, on: false };
    this.fire = new BabyDino('fire', DR.FIRE_X, G, { mood: 'scared', facing: -1 });
    this.breath = null; this.hintFire = 0;
    this.pen = { solid: { x: DR.FIRE_X + 260, y: G - 260, w: 60, h: 260, skipDraw: true, thorn: true } };
    this.solids.push(this.pen.solid);
    // ---- the barrier + the reunion + the run ----
    const B = DR.BARRIER;
    this.barrier = {
      log: { x: B, solid: { x: B - 20, y: G - 200, w: 200, h: 200, skipDraw: true }, done: 0 },
      lever: { x: B + 120, done: 0 },
      rocks: { x: B + 300, solid: { x: B + 240, y: G - 220, w: 160, h: 220, skipDraw: true }, done: 0 },
      rope: { x: B + 470, solid: { x: B + 440, y: G - 320, w: 100, h: 120, skipDraw: true }, done: 0 },
      vines: { x: B + 610, solid: { x: B + 580, y: G - 260, w: 60, h: 260, skipDraw: true }, done: 0 }
    };
    for (const k of ['log', 'rocks', 'rope', 'vines']) this.solids.push(this.barrier[k].solid);
    this.spots = [
      { kind: 'trike', x: B - 120, part: 'log' }, { kind: 'anky', x: B + 180, part: 'rocks' },
      { kind: 'longneck', x: B + 340, part: 'lever' }, // the lever hangs over the pile's far side (reachable once the rocks are smashed)
      { kind: 'ptero', x: B + 420, part: 'rope' }, { kind: 'fire', x: B + 530, part: 'vines' }
    ];
    this.move = null; // {baby, part, t}
    this.finale = null; this.adults = []; this.rainbowK = 0; this.bloomK = 0;
    this.rex = { x: DR.RUN_START - 150, mounted: false };
    this.nests = DR.NESTS.map((x, i) => ({ x, kind: DR.KINDS[i], filled: false }));
    this.enemiesTick = 0;
  }
  spawnDecor(lv) {} // (everything is painted by the machine)
  // ---- shared ----
  rescue(baby) {
    if (baby.state === 'rescued') return;
    baby.state = 'rescued'; baby.fixed = false; baby.setMood('happy', 1.6);
    this.parade.push(baby);
    const nest = this.nests.find(n => n.kind === baby.kind); if (nest) nest.filled = true;
    this.toastT = 2.4; this.toastKind = baby.kind;
    AudioSys.sfx('fanfare'); AudioSys.sfx('cheer'); AudioSys.sfx(baby.kind === 'fire' ? 'roar' : 'squawk');
    game.shake = Math.max(game.shake, 0.2);
    Particles.candyBurst(baby.cx, baby.y - 20, 14);
    Particles.burst(baby.cx, baby.cy, 24, { colors: RAINBOW.concat(['#fff']), type: 'heart', sp1: 320, l1: 1.2, s1: 11, grav: 60 });
    for (let i = 0; i < 4; i++) { const c = new Pickup(baby.cx, baby.cy, 'candy'); c.vx = rand(-260, 260); c.vy = rand(-560, -300); c.physics = true; game.pickups.push(c); }
    game.candy += 5;
    this.calm = this.parade.length / 5;
    if (this.parade.length === 5) { this.rescuedAll = true; AudioSys.sfx('bells'); }
  }
  paradeHas(kind) { return this.parade.some(b => b.kind === kind); }
  babies() { return [this.trike, this.longneck, this.anky, this.ptero, this.fire]; }
  // ---- per-frame ----
  update(dt, pl) {
    const lv = game.level, G = DR.G, C = DR.C;
    this.t += dt;
    if (!this.crashDone) { this.crashDone = true; this.crash = { t: 0, name: 'fireball', k: 0 }; game.cut = { name: 'crash', t: 0 }; AudioSys.setMusic(''); AudioSys.sfx('rumble'); return; }
    if (this.toastT > 0) this.toastT -= dt;
    // music follows the mood: silence + drips at first, jungle after the first rescue, treetop up high
    const want = this.finale ? 'win' : pl.y < G - 700 ? 'treetop' : this.parade.length ? 'jungle' : '';
    if (want !== this.music) { this.music = want; AudioSys.setMusic(want); }
    if (!this.parade.length && chance(0.01)) AudioSys.sfx(chance(0.5) ? 'steam' : 'rumble');
    // the parade (it stays with the families once the T-rex run begins)
    const running = lv.ride && lv.ride.state !== 'intro';
    let target = pl;
    if (!running) for (const b of this.parade) { b.update(dt, target, lv); target = b; }
    for (const b of this.babies()) if (b.state !== 'rescued') { b.t += dt; if (b.moodT > 0) { b.moodT -= dt; if (b.moodT <= 0) b.mood = b.kind === 'trike' ? 'stuck' : b.kind === 'anky' ? 'sleep' : b.kind === 'longneck' ? 'idle' : 'scared'; } }
    for (const z of this.zzz) { z.t += dt; z.y -= 30 * dt; }
    this.zzz = this.zzz.filter(z => z.t < 2.2);
    for (const n of this.notes) { n.t += dt; n.y -= 40 * dt; }
    this.notes = this.notes.filter(n => n.t < 1.6);
    if (this.anky.state !== 'rescued' && chance(0.03)) this.zzz.push({ x: this.anky.cx + 20, y: this.anky.y - 10, t: 0 });
    // ---- rescue 1: the trail ----
    if (this.trike.state !== 'rescued') {
      for (const b of this.bushes) { b.shake = Math.max(0, b.shake - dt); if (Math.abs(pl.cx - b.x) < 120 && b.shake <= 0 && chance(0.02)) { b.shake = 0.8; AudioSys.sfx('flap'); Particles.burst(b.x, G - 60, 6, { colors: ['#57d357', '#ffe156'], type: 'sparkle', sp1: 120, l1: 0.5, s1: 8 }); } }
      if (pl.cx > 2100 && pl.cx < 4300) { this.callT -= dt; if (this.callT <= 0) { this.callT = 4; AudioSys.sfx('hiccup'); this.notes.push({ x: this.trike.cx - 30, y: this.trike.y - 30, t: 0 }); } }
      // the engine kills a fireball on the log's solid before this runs, so spent shots count too
      const logHit = { x: this.log.solid.x - 40, y: this.log.solid.y - 20, w: this.log.solid.w + 80, h: this.log.solid.h + 20 };
      for (const pr of game.projectiles) if (!this.log.broken && pr.kind === 'fire' && overlaps(pr, logHit)) {
        pr.impact(true); this.log.broken = true; this.log.solid.broken = true;
        AudioSys.sfx('smash'); AudioSys.sfx('poof'); game.shake = Math.max(game.shake, 0.3);
        Particles.burst(this.log.x, G - 60, 20, { colors: ['#8a5a34', '#c98a4b', '#57d357'], type: 'block', sp1: 320, l1: 1, s1: 11, grav: 600, up: 200 });
        this.trike.setMood('happy', 1.5);
      }
      if (this.log.broken) { this.log.k = Math.min(1, this.log.k + dt); if (this.log.k > 0.6 && Math.abs(pl.cx - this.trike.cx) < 140) this.rescue(this.trike); }
    }
    // ---- rescue 2: fruit ----
    if (this.longneck.state !== 'rescued') {
      for (const tr of this.trees) {
        if (Math.abs(pl.cx - tr.x) < 60 && pl.y + pl.h > G - 120 && (!this.fruit || this.fruit.kind !== tr.kind) && (!this.fruit || this.fruit.t > 0.6)) {
          this.fruit = { kind: tr.kind, x: pl.cx, y: pl.y - 30, t: 0 };
          AudioSys.sfx('collect'); Particles.burst(tr.x, G - 200, 8, { colors: ['#57d357', '#ffe156'], type: 'sparkle', sp1: 140, l1: 0.5, s1: 8 });
        }
      }
      if (this.fruit) {
        const f = this.fruit; f.t += dt;
        const tx = pl.cx - pl.facing * 44, ty = pl.y - 24 + Math.sin(f.t * 3) * 6;
        f.x += (tx - f.x) * Math.min(1, dt * 7); f.y += (ty - f.y) * Math.min(1, dt * 7);
        const ln = this.longneck;
        if (Math.abs(pl.cx - ln.cx) < 110 && Math.abs(pl.y + pl.h - (ln.y + ln.h)) < 60 && f.t > 0.5 && ln.moodT <= 0) {
          this.grove.tries++;
          if (f.kind === 'berry') { ln.setMood('munch', 1.6, 0); AudioSys.sfx('candy'); AudioSys.sfx('heart'); this.fruit = null; this.grove.won = true; }
          else if (f.kind === 'apple') { ln.setMood('spit', 1.6); AudioSys.sfx('plop'); AudioSys.sfx('hornflat'); Particles.burst(ln.cx - 40, ln.cy, 8, { colors: ['#ff5a5a', '#fff'], type: 'block', sp1: 220, l1: 0.7, s1: 8, grav: 600 }); this.fruit = null; }
          else { ln.setMood('sneeze', 1.6); AudioSys.sfx('steam'); AudioSys.sfx('squawk'); Particles.burst(ln.cx - 30, ln.cy, 16, { colors: ['#57d357', '#7be07b', '#ffe156'], type: 'confetti', sp1: 320, l1: 1.2, s1: 10, grav: 300, up: 100 }); this.fruit = null; }
        }
      }
      if (this.grove.won && this.longneck.moodT <= 0.2) this.rescue(this.longneck);
      if (this.longneck.mood === 'munch') this.longneck.k = (this.longneck.t * 6) % 1;
      if (this.longneck.mood === 'sneeze' || this.longneck.mood === 'spit') this.longneck.k = 1 - this.longneck.moodT / 1.6;
    }
    // ---- rescue 3: echoes + crystals ----
    if (this.anky.state !== 'rescued') {
      if (pl.y > C - 400) {
        this.ringT -= dt;
        if (this.ringT <= 0) {
          this.ringT = 1.6;
          const f = this.forks.find(fk => pl.cx > fk.x - 400 && pl.cx < fk.x + 700);
          if (f) { for (let i = 0; i < 3; i++) this.rings.push({ x: f.src.x, y: f.src.y, r: 10 + i * 26, t: -i * 0.18, dir: Math.sign(pl.cx - f.src.x) || -1 }); AudioSys.sfx('inhale'); }
        }
        for (const b of this.bats) { b.hic = Math.max(0, b.hic - dt); if (Math.abs(pl.cx - b.x) < 220 && chance(0.012)) { b.hic = 0.5; AudioSys.sfx('hiccup'); } }
      }
      for (const r of this.rings) { r.t += dt; if (r.t > 0) { r.r += 90 * dt; r.x += r.dir * 60 * dt; } }
      this.rings = this.rings.filter(r => r.t < 1.6);
      this.updateEcho(dt, pl);
      for (const c of this.crystals) c.glow = Math.max(0, c.glow - dt * 1.6);
      if (this.echo.solved && this.anky.moodT <= 0.3) this.rescue(this.anky);
    }
    // ---- rescue 4: the canopy ----
    if (this.ptero.state !== 'rescued') {
      const v = this.valve;
      if (!v.on && Math.abs(pl.cx - v.x) < 60 && Math.abs(pl.y + pl.h - v.y) < 70) { v.on = true; AudioSys.sfx('switch'); AudioSys.sfx('blorp'); Particles.burst(v.x + 40, v.y - 30, 12, { colors: ['#7fd8ff', '#fff'], type: 'bubble', sp1: 200, grav: 300, l1: 0.7, s1: 9, up: 150 }); }
      if (v.on && this.bud.k < 1) { this.bud.k = Math.min(1, this.bud.k + dt * 0.5); if (this.bud.k >= 1) { this.bud.solid.broken = false; AudioSys.sfx('grow'); AudioSys.sfx('bells'); Particles.burst(this.bud.x, this.bud.y - 200, 24, { colors: ['#ff8fb0', '#ffe156', '#fff'], type: 'confetti', sp1: 300, l1: 1.4, s1: 11, grav: 200, up: 160 }); } }
      if (v.on && this.bud.k < 1 && chance(0.4)) Particles.burst(this.bud.x + rand(-30, 30), this.bud.y - 40, 1, { colors: ['#7fd8ff'], type: 'bubble', sp1: 40, grav: 200, l1: 0.5, s1: 7 });
      // the launch pad next to the scared ptero: a bounce on it is the safe launch
      const pad = lv.solids.find(s => s.pad);
      if (pad && pl.vy <= -1200 && pl.x + pl.w > pad.x && pl.x < pad.x + pad.w && !this.pteroLoop) {
        this.pteroLoop = { t: 0 }; this.ptero.setMood('fly', 99); AudioSys.sfx('squawk'); AudioSys.sfx('flap'); AudioSys.sfx('cheer');
      }
      if (this.pteroLoop) {
        const L = this.pteroLoop; L.t += dt;
        const cam = game.cam, k = L.t / 2.6;
        const cx0 = cam.x + W / 2, cy0 = cam.y + H / 2;
        this.ptero.x = cx0 + Math.cos(k * TAU * 1.5 - Math.PI / 2) * 420 - this.ptero.w / 2;
        this.ptero.y = cy0 + Math.sin(k * TAU * 1.5 - Math.PI / 2) * 240 - this.ptero.h / 2;
        this.ptero.facing = Math.cos(k * TAU * 1.5) < 0 ? -1 : 1;
        if (chance(0.6)) Particles.burst(this.ptero.cx, this.ptero.cy, 1, { colors: RAINBOW, type: 'sparkle', sp1: 60, grav: 60, l1: 0.7, s1: 8 });
        if (L.t > 2.6) { this.pteroLoop = null; this.ptero.x = pl.cx - 70; this.ptero.y = pl.y; this.rescue(this.ptero); this.ptero.setMood('happy', 1.5); }
      }
    }
    // ---- rescue 5: the fire baby ----
    if (this.fire.state !== 'rescued') {
      const fb = this.fire, near = Math.abs(pl.cx - fb.cx) < 520 && pl.cx < fb.cx;
      fb.facing = pl.cx < fb.cx ? -1 : 1;
      if (near) this.hintFire = Math.min(1, this.hintFire + dt);
      const startled = near && !this.breath && fb.moodT <= 0 && ((pl.vy < -600 && !pl.onGround) || game.projectiles.some(pr => !pr.dead && pr.t < 0.05));
      if (startled) { this.breath = { t: 0 }; fb.setMood('breathe', 1.3); AudioSys.sfx('inhale'); }
      if (this.breath) {
        const b = this.breath; b.t += dt; fb.k = clamp(b.t / 0.5, 0, 1);
        if (b.t > 0.35) {
          if (b.t < 0.4) { AudioSys.sfx('fire'); AudioSys.sfx('roar'); game.shake = Math.max(game.shake, 0.15); }
          const flame = { x: fb.cx - 480, y: G - 90, w: 480, h: 90 }; // a BIG breath: it reaches the thorn wall
          if (chance(0.8)) Particles.burst(fb.cx - rand(40, 460), G - rand(20, 80), 2, { colors: ['#ff9f43', '#ffe156', '#ff5a5a'], type: 'flame', sp1: 160, grav: -120, l1: 0.5, s1: 12 });
          if (this.thorn.burn < 1 && overlaps(flame, this.thorn.solid)) { this.thorn.burn = Math.min(1, this.thorn.burn + dt * 1.2); if (this.thorn.burn >= 1) { this.thorn.solid.broken = true; AudioSys.sfx('poof'); Particles.burst(this.thorn.x, G - 130, 20, { colors: ['#3a2a1a', '#ff9f43', '#8a8a8a'], type: 'block', sp1: 260, l1: 1, s1: 10, grav: 300, up: 120 }); } }
          if (!this.patch.on && this.patch.steam <= 0) { this.patch.on = true; AudioSys.sfx('steam'); }
          if (overlaps(flame, pl) && pl.inv <= 0) { pl.damage(1); pl.vx = -260; }
        }
        if (b.t > 1.3) { this.breath = null; fb.k = 0; }
      }
      if (this.patch.on) {
        if (chance(0.7)) Particles.burst(rand(this.patch.x0, this.patch.x1), G - 10, 2, { colors: ['#ff9f43', '#ffe156'], type: 'flame', sp1: 120, grav: -160, l1: 0.5, s1: 11 });
        const hz = { x: this.patch.x0, y: G - 44, w: this.patch.x1 - this.patch.x0, h: 44 };
        if (overlaps(hz, pl) && pl.inv <= 0) { pl.damage(1); pl.vy = -420; pl.vx = -220; AudioSys.sfx('steam'); }
      }
      const vv = this.volcValve;
      if (!vv.on && Math.abs(pl.cx - vv.x) < 60 && Math.abs(pl.y + pl.h - vv.y) < 70) { vv.on = true; AudioSys.sfx('switch'); AudioSys.sfx('blorp'); }
      if (vv.on && this.patch.on) { this.patch.on = false; this.patch.steam = 1; AudioSys.sfx('steam'); Particles.burst((this.patch.x0 + this.patch.x1) / 2, G - 30, 30, { colors: ['#fff', '#bfe8ff'], type: 'bubble', sp1: 200, grav: -120, l1: 1.2, s1: 12, up: 100 }); }
      if (vv.on && this.patch.steam > 0 && chance(0.2)) Particles.burst(rand(this.patch.x0, this.patch.x1), G - 20, 1, { colors: ['#fff'], type: 'bubble', sp1: 30, grav: -80, l1: 1, s1: 9, up: 0 });
      if (this.thorn.burn >= 1 && !this.patch.on && !this.breath && Math.abs(pl.cx - fb.cx) < 120) this.rescue(this.fire);
    }
    // ---- the barrier: five moments, each baby's own move ----
    if (this.rescuedAll && !this.finale) {
      if (this.move) {
        const m = this.move; m.t += dt;
        const part = this.barrier[m.part];
        part.done = Math.min(1, m.t / 1.2);
        m.baby.k = clamp(m.t / 1.0, 0, 1);
        if (part.solid && m.t > 0.7 && !part.solid.broken) { part.solid.broken = true; AudioSys.sfx(m.part === 'rocks' ? 'smash' : m.part === 'vines' ? 'poof' : 'thud'); game.shake = Math.max(game.shake, 0.3); Particles.burst(part.x, G - 120, 22, { colors: ['#8a5a34', '#8a8a8a', '#57d357', '#ff9f43'], type: 'block', sp1: 320, l1: 1, s1: 11, grav: 500, up: 200 }); }
        if (m.t > 1.4) { m.baby.special = null; m.baby.setMood('happy', 1); this.move = null; AudioSys.sfx('cheer'); }
      } else {
        for (const sp of this.spots) {
          const part = this.barrier[sp.part];
          if (part.done > 0 || Math.abs(pl.cx - sp.x) > 50 || pl.y + pl.h < G - 40) continue;
          const baby = this.parade.find(b => b.kind === sp.kind);
          if (!baby) continue;
          baby.special = true; baby.x = sp.x - baby.w / 2 + (sp.kind === 'trike' ? 0 : 0); baby.y = G - baby.h; baby.facing = 1;
          baby.setMood(sp.kind === 'trike' ? 'charge' : sp.kind === 'anky' ? 'smash' : sp.kind === 'longneck' ? 'reach' : sp.kind === 'ptero' ? 'fly' : 'breathe', 1.6, 0);
          this.move = { baby, part: sp.part, t: 0 };
          AudioSys.sfx(sp.kind === 'fire' ? 'fire' : sp.kind === 'ptero' ? 'flap' : 'squawk');
        }
        if (Object.values(this.barrier).every(p => p.done >= 1) && pl.cx > DR.BARRIER + 700) this.startFinale();
      }
    }
    // ---- the reunion + the mount ----
    if (this.finale && this.finale.done && !this.rex.mounted && Math.abs(pl.cx - this.rex.x) < 90 && lv.ride) {
      this.rex.mounted = true;
      lv.ride.begin(pl);
      AudioSys.sfx('roar'); AudioSys.sfx('launch');
    }
    this.rainbowK = Math.min(1, this.rainbowK + (this.finale ? dt * 0.4 : 0));
  }
  // ---- the echo chamber: a repeat-the-pattern on bonkable crystals ----
  updateEcho(dt, pl) {
    const e = this.echo, C = DR.C;
    if (e.solved) return;
    const inChamber = pl.cx > 3820 && pl.cx < 4300 && pl.y > C - 400;
    e.lock = Math.max(0, e.lock - dt);
    if (!inChamber) return;
    if (!e.seq.length) { e.round = 1; this.newSeq(3); }
    if (e.showing) {
      e.showT -= dt;
      if (e.showT <= 0) {
        if (e.showI < e.seq.length) { const c = this.crystals[e.seq[e.showI]]; c.glow = 1; AudioSys.sfx('bells'); e.showI++; e.showT = 0.55; }
        else { e.showing = false; e.input = []; }
      }
    } else if (e.idle > 0) { e.idle -= dt; if (e.idle <= 0) this.showSeq(); }
  }
  newSeq(n) { const e = this.echo; e.seq = []; for (let i = 0; i < n; i++) e.seq.push(randi(0, 2)); e.input = []; e.idle = 0.6; e.showing = false; }
  showSeq() { const e = this.echo; e.showing = true; e.showI = 0; e.showT = 0.2; e.input = []; }
  onAnswer(solid) { // the engine's head-bonk on a puzzleBlock crystal
    const e = this.echo, i = solid.idx, c = this.crystals[i];
    if (e.solved || e.showing || e.lock > 0 || !e.seq.length) return;
    c.glow = 1;
    if (e.seq[e.input.length] === i) {
      e.input.push(i); AudioSys.sfx('bells');
      Particles.burst(c.x, DR.C - 220, 8, { colors: ['#fff', '#ffe156'], type: 'sparkle', sp1: 160, l1: 0.5, s1: 8 });
      if (e.input.length === e.seq.length) {
        e.lock = 0.8;
        if (e.round === 1) { e.round = 2; AudioSys.sfx('powerup'); this.newSeq(4); e.idle = 1.0; }
        else { e.solved = true; this.anky.setMood('happy', 2); AudioSys.sfx('fanfare'); AudioSys.sfx('squawk'); for (const cc of this.crystals) cc.glow = 1; }
      }
    } else { // a wrong bonk: a buzz, then the pattern replays
      AudioSys.sfx('plop'); AudioSys.sfx('hornflat'); e.lock = 0.6; e.input = []; e.idle = 0.8;
    }
  }
  // ---- the finale cutscene: adults stomp in, families reunite ----
  startFinale() {
    this.finale = { t: 0, done: false };
    const G = DR.G;
    this.adults = DR.KINDS.map((k, i) => ({ kind: k, x: DR.BARRIER + 1900 + i * 210, tx: DR.BARRIER + 900 + i * 190, gy: G, t: rand(9), mood: 'walk' }));
    game.cut = { name: 'finale', t: 0 };
    AudioSys.setMusic('win'); AudioSys.sfx('rumble');
  }
  cutTick(dt, c) {
    const pl = game.player, cam = game.cam, G = DR.G;
    this.t += dt;
    if (c.name === 'crash') {
      const cr = this.crash; cr.t += dt;
      const timeline = [['fireball', 2.2], ['treetops', 2.4], ['tumble', 2.6], ['rest', 2.4]];
      let acc = 0, idx = timeline.length - 1, k = 1;
      for (let i = 0; i < timeline.length; i++) { if (cr.t < acc + timeline[i][1]) { idx = i; k = (cr.t - acc) / timeline[i][1]; break; } acc += timeline[i][1]; }
      const name = timeline[idx][0];
      if (name !== cr.name) { cr.name = name; if (name === 'treetops') { AudioSys.sfx('whoosh'); AudioSys.sfx('squawk'); } if (name === 'tumble') { AudioSys.sfx('crash'); AudioSys.sfx('thud'); game.shake = 0.8; } if (name === 'rest') { AudioSys.sfx('steam'); AudioSys.sfx('clank'); } }
      cr.k = k;
      if (name === 'fireball') game.shake = Math.max(game.shake, 0.3);
      if (name === 'tumble' && k < 0.7) game.shake = Math.max(game.shake, 0.4);
      const total = timeline.reduce((a, b) => a + b[1], 0);
      if (cr.t >= total || (cr.t > 2 && justP.Space)) { cr.done = true; cr.name = 'rest'; cr.k = 1; this.crash = null; game.cut = null; pl.x = 420; pl.y = G - pl.h; }
    } else if (c.name === 'finale') {
      const f = this.finale; f.t += dt;
      // adults stride in from the right; babies run to their parents
      for (const a of this.adults) { a.t += dt; if (a.x > a.tx) { a.x -= 220 * dt; a.mood = 'walk'; } else { a.mood = f.t < 4 ? 'roar' : 'happy'; } }
      for (const b of this.parade) {
        const a = this.adults.find(ad => ad.kind === b.kind);
        if (a && f.t > 1.5) { b.special = true; const tx = a.x - 130; b.x += (tx - b.cx) * Math.min(1, dt * 2.5); b.y = G - b.h; b.facing = 1; b.mood = 'happy'; b.k = Math.abs(Math.sin(b.t * 9)); b.t += dt; }
      }
      if (f.t > 2.8 && f.t < 2.9) { AudioSys.sfx('roar'); AudioSys.sfx('roar'); game.shake = 0.5; }
      if (f.t > 3.2 && chance(0.3)) Particles.candyBurst(DR.BARRIER + 900 + rand(0, 900), G - rand(200, 500), 2);
      if (f.t > 3.2 && chance(0.2)) { const c2 = new Pickup(DR.BARRIER + 900 + rand(0, 900), G - 400, 'candy'); c2.vx = rand(-200, 200); c2.vy = rand(-300, 0); c2.physics = true; game.pickups.push(c2); }
      this.bloomK = clamp((f.t - 3) / 2, 0, 1);
      const tx = clamp(DR.BARRIER + 1000 - W / 2, 0, DR.W - W), ty = clamp(G - H * 0.62, 0, DR.H - H);
      cam.x = lerp(cam.x, tx, 1 - Math.exp(-3 * dt)); cam.y = lerp(cam.y, ty, 1 - Math.exp(-3 * dt));
      this.rainbowK = clamp((f.t - 2.5) / 2.5, 0, 1);
      if (f.t > 7 || (f.t > 3 && justP.Space)) { f.done = true; this.rainbowK = 1; game.cut = null; for (const b of this.parade) { b.special = null; b.mood = 'idle'; } for (const a of this.adults) { a.x = a.tx; a.mood = 'happy'; } AudioSys.sfx('cheer'); }
    }
  }
  lights() { return []; }
  // ---- drawing ----
  drawBack(ctx, t) {
    const G = DR.G, C = DR.C, cam = game.cam, x0 = cam.x - 40, x1 = cam.x + W + 40;
    const damage = 1 - this.calm * 0.8;
    JG_SCENE.jungleBack(ctx, x0, Math.max(cam.y - 40, 0), x1, Math.min(cam.y + H + 40, C - 300), t, { seed: 1, damage, mood: this.calm > 0.6 ? 'calm' : 'storm' });
    if (cam.y + H > C - 320) JG_SCENE.caveBack(ctx, x0, C - 320, x1, DR.H, t, { seed: 2 });
    // the nursery dressing sits BEHIND the deck plates
    if (x1 > 900 && x0 < 2100) JG_SCENE.nursery(ctx, 1500, G, 900, t, { life: this.calm });
    for (const s of game.level.solids) {
      if (!s.plate || s.x + s.w < x0 || s.x > x1) continue;
      JG_SCENE.groundPlate(ctx, s.x, s.y, s.w, s.h, t, { kind: s.plate });
    }
    // the crash site + the nests
    if (x0 < 900) { ST_ART.crashedPod(ctx, 300, G, t); DINO_ART.nest(ctx, 700, G, 130, t, { damaged: true }); }
    if (x1 > 900 && x0 < 2100) {
      for (const n of this.nests) DINO_ART.nest(ctx, n.x, G, 110, t, { ghost: n.filled ? null : n.kind, eggs: n.filled ? 2 : 0 });
    }
    // rescue 1 dressing: prints to the ford, the ford, splashes, bushes, the broken plant
    if (x1 > 2000 && x0 < 4300) {
      for (let i = 0; i < 12; i++) DINO_ART.footprint(ctx, 'trike', 2050 + i * 75, G - 4 + (i % 2) * 10, 26, t, { alpha: 0.7 });
      JG_SCENE.waterPool(ctx, 2900, G - 24, 320, 30, t);
      JG_SCENE.mudSplash(ctx, 3420, G - 6, 34, t); JG_SCENE.mudSplash(ctx, 3700, G - 8, 30, t);
      for (const b of this.bushes) JG_SCENE.bush(ctx, b.x, G, 90, t, { shake: b.shake });
      JG_SCENE.brokenBranch(ctx, 3850, G - 50, 70, t);
      JG_SCENE.fallenTree(ctx, 2300, G, 260, t);
    }
    // rescue 2: trees + peels
    if (x1 > 4300 && x0 < 5800) {
      for (const tr of this.trees) DINO_ART.fruitTree(ctx, tr.kind, tr.x, G, 260, t);
      for (let i = 0; i < 4; i++) DINO_ART.peel(ctx, 'berry', 5420 + i * 70, G - 6, 30, t);
    }
    // rescue 3: crystals + chamber + bats
    if (cam.y + H > C - 400) {
      if (x1 > 3700 && x0 < 4400) JG_SCENE.crystalChamber(ctx, 4050, C, 500, t, this.echo.solved ? 1 : 0.4);
      for (const c of this.crystals) JG_SCENE.crystal(ctx, c.x, c.solid.y + c.solid.h, 90, t, { color: c.color, glow: c.glow }); // floating at bonk height, like Puzzle Blocks
      for (const b of this.bats) if (b.x > x0 && b.x < x1) DINO_ART.bat(ctx, b.x, b.y, 40, t, { hiccup: b.hic > 0 ? b.hic / 0.5 : 0 });
    }
    // rescue 4: valve, stream, bud, pad
    if (x1 > 5800 && x0 < 8500) {
      JG_SCENE.valve(ctx, this.valve.x, this.valve.y, 90, t, this.valve.on ? 1 : 0);
      JG_SCENE.stream(ctx, [{ x: this.valve.x + 50, y: this.valve.y - 30 }, { x: this.valve.x + 200, y: this.valve.y + 20 }, { x: this.bud.x, y: this.bud.y - 60 }], t, this.valve.on ? 1 : 0);
      JG_SCENE.bud(ctx, this.bud.x, this.bud.y, 220, t, this.bud.k);
      JG_SCENE.launchPad(ctx, DR.PAD_X, G - 1250, 100, t);
    }
    // rescue 5: thorns, patch, valve, pen
    if (x1 > 8400 && x0 < 10800) {
      JG_SCENE.valve(ctx, this.volcValve.x, this.volcValve.y, 90, t, this.volcValve.on ? 1 : 0);
      JG_SCENE.stream(ctx, [{ x: this.volcValve.x + 50, y: this.volcValve.y - 30 }, { x: this.patch.x0 + 60, y: G - 40 }], t, this.volcValve.on ? 1 : 0);
      JG_SCENE.firePatch(ctx, this.patch.x0, G, this.patch.x1 - this.patch.x0, t, { on: this.patch.on ? 1 : 0, steam: this.patch.steam });
      JG_SCENE.thornWall(ctx, this.thorn.x, G, 120, 260, t, { burn: this.thorn.burn });
      JG_SCENE.thornWall(ctx, this.pen.solid.x + 30, G, 120, 260, t, { burn: 0 }); // the pen's back wall
    }
    // the barrier + reunion dressing + the run's finish
    if (x1 > DR.BARRIER - 300 && x0 < DR.BARRIER + 1200) {
      const b = this.barrier;
      JG_SCENE.barrier(ctx, DR.BARRIER + 300, G, t, { log: 1 - b.log.done, rocks: 1 - b.rocks.done, lever: b.lever.done, rope: b.rope.done, vines: 1 - b.vines.done });
      if (this.finale) { JG_SCENE.rainbow(ctx, DR.BARRIER + 1100, G, 700, t, this.rainbowK); JG_SCENE.bloomBurst(ctx, DR.BARRIER + 700, G, 1200, t, this.bloomK); }
    }
  }
  draw(ctx, t) {
    const G = DR.G, C = DR.C, cam = game.cam, pl = game.player;
    // babies in their stories
    if (this.trike.state !== 'rescued') { this.trike.draw(ctx, t); JG_SCENE.weakLog(ctx, this.log.x, G, 140, t, { broken: this.log.broken, k: this.log.k }); }
    if (this.longneck.state !== 'rescued') this.longneck.draw(ctx, t);
    if (this.anky.state !== 'rescued') this.anky.draw(ctx, t);
    if (this.ptero.state !== 'rescued') this.ptero.draw(ctx, t);
    if (this.fire.state !== 'rescued') {
      this.fire.draw(ctx, t);
      if (this.hintFire > 0 && !this.breath) drBubble(ctx, this.fire.cx + 60, this.fire.y - 60 + Math.sin(t * 3) * 4, 28, (c, x, y) => drawKeycap(c, x, y + 2, 40, 'up', t), Math.min(1, this.hintFire));
    }
    // the parade (hidden during the run)
    if (!(game.level.ride && game.level.ride.state !== 'intro')) for (const b of this.parade) b.draw(ctx, t);
    // fruit in hand, notes, rings, zzz
    if (this.fruit) DINO_ART.fruit(ctx, this.fruit.kind, this.fruit.x, this.fruit.y, 34, t);
    for (const n of this.notes) DINO_ART.note(ctx, n.x, n.y, 26, t);
    for (const r of this.rings) if (r.t > 0) DINO_ART.soundRing(ctx, r.x, r.y, r.r, Math.max(0, 1 - r.t / 1.4));
    for (const z of this.zzz) outlineText(ctx, 'z', z.x, z.y, 22 + z.t * 10, `rgba(190,220,255,${1 - z.t / 2.2})`, `rgba(20,40,60,${1 - z.t / 2.2})`);
    // the barrier's ghost spots
    if (this.rescuedAll && !this.finale) for (const sp of this.spots) if (this.barrier[sp.part].done <= 0) DINO_ART.nest(ctx, sp.x, G, 80, t, { ghost: sp.kind });
    // adults (reunion + the waiting rex)
    for (const a of this.adults) DINO_ART.adult(ctx, a.kind, a.x, a.gy, 260, a.t + t, { mood: a.mood, facing: -1, k: (t * 5) % 1 });
    if (this.finale && this.finale.done && !this.rex.mounted) {
      DINO_ART.adult(ctx, 'rex', this.rex.x, G, 260, t, { mood: 'idle', facing: 1 });
      drawSpacebar(ctx, this.rex.x, G - 330 + Math.sin(t * 3) * 5, 100, t);
    }
    if (this.toastT > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, this.toastT * 2);
      const ty = pl.y - 60 - (2.4 - this.toastT) * 16;
      DINO_ART.baby(ctx, this.toastKind, pl.cx - 36, ty + 20, 40, t, { mood: 'happy', facing: 1, k: Math.abs(Math.sin(t * 8)) });
      outlineText(ctx, this.parade.length + '/5', pl.cx + 30, ty, 34, '#ffe156', '#2f5a2a');
      ctx.restore();
    }
  }
  drawCinematic(ctx, t) {
    const cr = this.crash;
    if (!cr || !cr.name) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (game.shake > 0) ctx.translate(rand(-1, 1) * game.shake * 12, rand(-1, 1) * game.shake * 8);
    const r = DINO_ART.crashScene(ctx, cr.name, cr.k, t);
    if (r && r.jack) { const pl = game.player; ctx.save(); ctx.translate(r.jack.x, r.jack.y); ctx.scale(r.jack.s || 1, r.jack.s || 1); pl.drawBoy(ctx, 0, -54, 'dizzy'); ctx.restore(); }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- the victory run
class DinoRun {
  constructor(groundY, startX) {
    this.g = groundY; this.startX = startX;
    this.state = 'intro'; // intro (waiting for the mount) -> riding -> launched -> done
    this.ride = new RideMode({ speed: 470, jumpVy: -800 });
    this.course = new RideCourse(startX, groundY);
    this.ramps = []; this.logs = []; this.plants = []; this.finaleT = 0; this.tricks = 0; this.megaLip = 0; this.landX = 0;
    this.build();
  }
  build() {
    const c = this.course, g = this.g;
    const ramp = (rise, run, gap) => { const x0 = c.endX; c.node(run, -rise); c.node(14, -rise); this.ramps.push({ x0, y0: g, x1: c.endX, y1: g - rise, big: rise > 100 }); const lip = c.endX; c.node(8, 0); c.flat(gap); this.arc(lip + 20, g - rise - 150, 6, 320); };
    const plant = () => { c.flat(120); this.plants.push({ x: c.endX + 40, squish: 0 }); c.node(40, -30); c.node(40, 0); c.flat(120); };
    const logs = (n) => { c.flat(160); for (let i = 0; i < n; i++) { c.add('log', c.endX + i * 150, g - 60, 90, 60, { k: 0 }); } c.flat(160 + n * 150); };
    c.flat(500); this.row(c.endX - 300, 5);
    ramp(80, 240, 260); plant(); logs(2); ramp(110, 300, 320); plant(); logs(3); this.row(c.endX - 200, 5);
    ramp(90, 250, 280); plant(); plant(); logs(2); ramp(130, 320, 360);
    c.flat(400);
    // THE mega ramp: the T-rex flings Jack sky-high
    c.node(560, -240); c.node(20, -240);
    this.megaLip = c.endX;
    this.arc(c.endX - 420, g - 460, 7, 420);
    c.node(8, 0); c.flat(1500); // the lip falls straight away: a real launch (see ride.js: >46 px in one frame)
    // the candy platform
    this.landX = c.endX; c.node(80, -110); c.node(700, -110); c.node(80, 0); c.flat(600);
  }
  row(x0, n) { for (let i = 0; i < n; i++) this.course.add('candy', x0 + i * 64, this.g - 70, 30, 30); }
  arc(x0, yTop, n, span) { for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : i / (n - 1); this.course.add('candy', x0 + t * span, this.g - 60 - Math.sin(t * Math.PI) * (this.g - 60 - yTop), 30, 30); } }
  begin(pl) { this.state = 'riding'; pl.x = this.startX + 20; pl.y = this.g - pl.h; AudioSys.sfx('rev'); }
  updateIntro() {}
  updatePlayer(pl, dt) {
    pl.t += dt;
    if (pl.moodT > 0) pl.moodT -= dt; else pl.mood = 'grin';
    pl.squash = lerp(pl.squash, 1, 1 - Math.exp(-9 * dt));
    if (this.state === 'launched') this.ride.speed = 470;
    const ev = this.ride.step(pl, dt, x => this.course.groundY(x));
    if (ev.launched && this.state === 'riding') {
      const r = this.ramps.find(rp => Math.abs(rp.x1 - pl.x - pl.w / 2) < 60);
      if (r) { this.ride.vy = Math.min(this.ride.vy, r.big ? -880 : -680); AudioSys.sfx('launch'); }
      else if (pl.x > this.megaLip - 40) { // the mega launch
        this.state = 'launched'; this.finaleT = 0; this.ride.vy = -980; this.ride.gravity = 520; this.ride.spinTarget += TAU * 2; this.ride.trickN = 2;
        AudioSys.sfx('launch'); AudioSys.sfx('roar'); AudioSys.sfx('cheer'); game.shake = Math.max(game.shake, 0.3);
      }
    }
    if (ev.landed && ev.tricks >= 3 && this.state === 'riding') { game.candy += ev.tricks >= 5 ? 3 : 1; AudioSys.sfx('cheer'); AudioSys.sfx('candy'); Particles.burst(pl.cx, pl.y, 16, { colors: RAINBOW, type: 'confetti', sp1: 300, l0: 0.8, l1: 1.6, s1: 10, grav: 300, up: 220 }); }
    if (this.state === 'launched') {
      const prev = this.finaleT; this.finaleT += dt;
      for (const beat of [0.4, 0.8, 1.2, 1.6, 2.0, 2.4]) if (prev < beat && this.finaleT >= beat) { this.ride.trickN++; this.ride.spinTarget += TAU; AudioSys.sfx(beat >= 1.6 ? 'neigh' : 'flap'); }
      this.tricks = this.ride.trickN;
      Particles.burst(pl.cx - 30, pl.cy, 2, { colors: RAINBOW, type: 'star', sp1: 90, l0: 0.5, l1: 1.1, s1: 9, grav: 60, up: 0 });
      if (ev.landed) { // the candy pile!
        this.state = 'done'; this.ride.speed = 0;
        game.level.solids.push({ x: this.landX + 80, y: this.g - 110, w: 700, h: 200, skipDraw: true, plate: 'leaf' });
        pl.x = clamp(pl.x, this.landX + 120, this.landX + 700); pl.y = this.g - 110 - pl.h; pl.vx = 0; pl.vy = 0;
        game.candy += 30;
        AudioSys.sfx('fanfare'); AudioSys.sfx('chest'); AudioSys.sfx('cheer');
        game.shake = Math.max(game.shake, 0.4);
        Particles.candyBurst(pl.cx, pl.y - 40, 30);
        Particles.burst(pl.cx, pl.y, 40, { colors: RAINBOW.concat(['#ffe156']), type: 'confetti', sp1: 420, l0: 1, l1: 2, s1: 12, grav: 260, up: 240 });
        game.endPhase = 'party'; game.partyT = 0; AudioSys.setMusic('win');
      }
    }
    // things: candy, logs (a bump, never harm), plants (a springy hop)
    for (const th of this.course.things) {
      th.t += dt;
      if (th.dead || !overlaps(th, pl)) continue;
      if (th.kind === 'candy') { th.dead = true; game.candy++; AudioSys.sfx('candy'); Particles.burst(th.x + 15, th.y + 15, 5, { colors: ['#ffd24a', '#fff'], type: 'sparkle', sp1: 130, l1: 0.4, s1: 8 }); }
      else if (th.kind === 'log' && this.state === 'riding' && pl.inv <= 0) { pl.inv = 1; th.k = 1; this.ride.crashSlow(0.55); this.ride.hop(-380); pl.setMood('surprised', 0.8); AudioSys.sfx('thud'); AudioSys.sfx('crash'); Particles.burst(th.x + 45, th.y + 30, 12, { colors: ['#8a5a34', '#c98a4b'], type: 'block', sp1: 260, l1: 0.8, s1: 10, grav: 500 }); }
    }
    for (const p of this.plants) { p.squish = Math.max(0, p.squish - dt * 2); if (this.ride.grounded && Math.abs(pl.cx - p.x) < 40 && p.squish <= 0) { p.squish = 1; this.ride.hop(-560); AudioSys.sfx('boing'); } }
    if (pl.inv > 0) pl.inv -= dt;
    this.course.cleanup(game.cam.x - 400);
    this.ramps = this.ramps.filter(r => r.x1 > game.cam.x - 400);
  }
  drawBack(ctx, t) {
    const camX = game.cam.x, g = this.g;
    if (camX + W < this.startX - 200) return;
    const x0 = Math.max(this.startX, camX - 60), x1 = camX + W + 60;
    ctx.beginPath(); ctx.moveTo(x0, g + 400);
    for (let x = x0; x <= x1; x += 24) ctx.lineTo(x, this.course.groundY(x));
    ctx.lineTo(x1, g + 400); ctx.closePath();
    const gr = ctx.createLinearGradient(0, g - 30, 0, g + 400); gr.addColorStop(0, '#5ecb4a'); gr.addColorStop(0.12, '#3fae5a'); gr.addColorStop(0.16, '#8a5a34'); gr.addColorStop(1, '#4a2e1a'); // grass lip over dirt, like the deck plates
    ctx.fillStyle = gr; ctx.fill();
    ctx.strokeStyle = '#3fae5a'; ctx.lineWidth = 8;
    ctx.beginPath(); for (let x = x0; x <= x1; x += 24) { const y = this.course.groundY(x); if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
    for (const r of this.ramps) if (r.x1 > camX - 100 && r.x0 < camX + W + 100) JG_SCENE.runRamp(ctx, r.x0, r.y0, r.x1, r.y1, t);
    if (this.landX > camX - 200 && this.landX < camX + W + 900) JG_SCENE.candyPlatform(ctx, this.landX + 430, g - 110, 700, t);
    if (this.state === 'done') DINO_ART.candyPile(ctx, this.landX + 560, g - 110, 300, t);
  }
  draw(ctx, t) {
    const camX = game.cam.x, g = this.g;
    for (const p of this.plants) if (p.x > camX - 100 && p.x < camX + W + 100) JG_SCENE.bouncePlant(ctx, p.x, this.course.groundY(p.x), 110, t, p.squish);
    for (const th of this.course.things) {
      if (th.dead || th.x + th.w < camX - 100 || th.x > camX + W + 100) continue;
      if (th.kind === 'candy') { ctx.save(); ctx.translate(th.x + 15, th.y + 15 + Math.sin(th.t * 3) * 4); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill(); ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); }
      else if (th.kind === 'log') JG_SCENE.collapseLog(ctx, th.x + 45, this.course.groundY(th.x + 45), 90, t, th.k || 0);
    }
    // pteros overhead (the run only)
    if (this.state === 'riding' || this.state === 'launched') for (let i = 0; i < 3; i++) DINO_ART.baby(ctx, 'ptero', camX + 200 + i * 400 + Math.sin(t * 0.8 + i) * 60, game.cam.y + 120 + i * 50 + Math.sin(t * 1.5 + i) * 20 + 60, 70, t + i, { mood: 'fly', facing: 1 });
  }
  drawRider(ctx, t) { // Jack rides the T-rex; the whole pair spins with the trick combo
    const pl = game.player, rm = this.ride;
    if (this.state === 'intro' || this.state === 'done') { pl.draw(ctx); return; }
    ctx.save();
    ctx.translate(pl.cx, pl.cy); ctx.rotate(rm.spin); ctx.translate(-pl.cx, -pl.cy);
    const s = 200;
    if (this.saddleOff === undefined) { // measure the rex's saddle once (an off-screen draw) so Jack sits exactly on its back
      ctx.save(); ctx.globalAlpha = 0; const r = DINO_ART.adult(ctx, 'rex', -5000, 0, s, 0, { mood: 'walk', facing: 1 }); ctx.restore();
      this.saddleOff = r && r.saddle ? -r.saddle.y : s * 0.62;
    }
    // the rex runs ON the terrain (Jack's ride box); Jack is drawn lifted onto its saddle
    DINO_ART.adult(ctx, 'rex', pl.cx + 20, pl.y + pl.h, s, t, { mood: rm.grounded ? 'walk' : 'happy', facing: 1, k: (t * 6) % 1 });
    ctx.translate(0, -this.saddleOff + 10);
    pl.draw(ctx);
    ctx.restore();
    if (rm.trickN >= 4 && chance(0.5)) Particles.burst(pl.cx, pl.cy, 2, { colors: RAINBOW, type: 'star', sp1: 120, l1: 0.5, s1: 8 });
  }
}
