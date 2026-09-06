// JUNKYARD BLOCK BASH — Arcade Mode #1 (v1.29.0). Breakout through Block
// Buddies: Jack's monster truck is the paddle, a faced rubber ball smashes
// junk blocks, misses are comedy, the JUNKBOT is the finale.
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
// phase-weighted capsule mix (phase 0/1/2+): multi/wide/net favoured early, boom/giant later
const BB_CAP_WEIGHTS = [
  { multi: 3, wide: 3, net: 3, slow: 2, giant: 1, magnet: 2, boom: 0 },
  { multi: 3, wide: 2, net: 2, slow: 2, giant: 2, magnet: 2, boom: 1 },
  { multi: 3, wide: 2, net: 2, slow: 1, giant: 3, magnet: 2, boom: 3 },
];
const BB_MOD_NAMES = { multi: 'MULTI BALL!', giant: 'GIANT!', wide: 'WIDE!', boom: 'BOOM BALL!', magnet: 'MAGNET!', slow: 'SLOW-MO!', net: 'JUNK NET!' };

class BlockBash {
  constructor(lv) {
    this.lv = lv; this.t = 0; this.state = 'play';
    this.hopT = 0; this.hopY0 = BB.FLOOR - 96; this.spinT = 0;
    this.wideK = 1; // paddle width multiplier (Task 6's wide mod)
    this.booted = false;
    this.balls = []; this.blocks = []; this.candies = []; this.debris = [];
    this.combo = 0;
    this.phaseSpeed = BB.SPEED[0];
    this.launchT = BB.LAUNCH_AUTO; this.respawnT = 0;
    this.splat = null;
    this.mods = new Mods((name) => this.onModExpire(name));
    this.hud = new ArcadeHud();
    this.phase = 0; // Task 7 drives this per wave; capsule weighting reads it
    this.toast = null; // { kind, t } — big mod icon over the truck on capsule catch
    // Task 7/8 stub — later task fills this in
    this.junkbot = null;
    this.net = null;
    this.capsules = []; this.tires = []; this.conveyorRows = new Map();
    this.towerCandy = 0; this._towerGroups = []; this._surpriseBag = [];
    this.crane = {
      x: (BB.L + BB.R) / 2, y: 140, mode: 'idle', stage: null, target: null,
      holding: null, t: 0, holdT: 0, wanderT: 0, wanderX: (BB.L + BB.R) / 2, mood: 'happy'
    };
  }
  boot(pl) {
    this.booted = true;
    if (pl.vehicle !== 'truck') pl.boardTruck();
    pl.x = 590 - 52; this.hopY0 = BB.FLOOR - pl.h; pl.y = this.hopY0;
    this.spawnBall(pl.cx, pl.y - BB.BALL_R, true);
    this.launchT = BB.LAUNCH_AUTO;
  }
  paddleBox() {
    const pl = game.player, extra = (this.wideK - 1) * pl.w / 2;
    return { x: pl.x - BB.PADDLE_PAD - extra, y: pl.y, w: pl.w + 2 * (BB.PADDLE_PAD + extra), h: pl.h };
  }
  // the arcade owns the hero: snappy left/right, a hop, no gravity
  updatePlayer(pl, dt) {
    if (!this.booted) this.boot(pl);
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

  onModExpire(name) {
    if (name === 'rainbow') for (const b of this.balls) b.mood = 'happy';
    if (name === 'giant') for (const b of this.balls) b.r = BB.BALL_R;
    if (name === 'wide') this.wideK = 1;
    if (name === 'net') this.net = null;
  }

  // ---- balls
  spawnBall(x, y, rest) {
    const b = { x, y, r: this.mods.has('giant') ? BB.GIANT_R : BB.BALL_R, vx: 0, vy: 0, speed: this.phaseSpeed, rest, bumpT: 0, graceT: 0, squash: 1, mood: 'happy', trail: [] };
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
  // does this block live on after taking one more hit right now? (runner's first
  // hit just scoots it, a faller just starts falling — both still "there")
  blockSurvives(k) {
    if (k.kind === 'runner' && k.hp === 2) return true;
    if (k.kind === 'faller') return true;
    const dmg = this.mods.has('boom') ? 99 : 1;
    return k.hp - dmg > 0;
  }
  stepBall(b, dt) {
    if (b.rest || b.held) return;
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
        // pierce (no bounce) in rainbow mode, OR whenever this exact hit is the
        // one that destroys the block — a block that's gone doesn't get to
        // shove the ball around, which is what lets a rainbow block pierce the
        // hit that triggers it AND lets one flight zip through a stack of
        // one-hit blocks (kids' Breakout: only a block that SURVIVES bounces you)
        const pierce = this.mods.has('rainbow') || !this.blockSurvives(k);
        if (pierce) { this.hitBlock(k, b, true); } else { this.reflect(b, hit); this.hitBlock(k, b, false); }
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

  // ---- blocks
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
    if (b.kind === 'faller' && cause === 'floor') {
      // harmless thud, no candy — the faller was never caught
    } else if (b.kind === 'faller' && cause === 'truck') {
      game.candy += 5; this.hud.pop(cx, cy, '+5', '#ffd24a', 26);
      AudioSys.sfx('candy');
      Particles.burst(cx, cy, 8, { colors: ['#fff', '#ffe156'], type: 'block', sp1: 260, l1: 0.6, s1: 9, grav: 600 });
    } else if (b.tower) {
      this.dropCandy(cx, cy, 1); this.towerCandy++;
    } else {
      const pay = b.kind === 'tough' ? 3 : 1;
      if (b.kind === 'candy') this.dropCandy(cx, cy, 5); else { game.candy += pay; this.hud.pop(cx, cy, '+' + pay, '#ffd24a', 24); }
    }
    if (b.kind === 'boom') this.explodeAt(cx, cy, BB.BW * 1.5);
    if (b.kind === 'split' && this.balls.length < BB.MAX_BALLS) { const nb = this.spawnBall(cx, cy + 30, false); nb.vx = rand(-200, 200); nb.vy = 300; this.steer(nb); AudioSys.sfx('bashsplit'); }
    if (b.kind === 'rainbow') { this.mods.add('rainbow', BB.MODS.rainbow); this.hud.banner('RAINBOW!', '#ff5fa2'); AudioSys.sfx('rainbow'); for (const ball of this.balls) ball.mood = 'rainbow'; }
    if (b.kind === 'power') this.dropCapsule(cx, cy);     // Task 6 (stub for now)
    if (b.kind === 'surprise') this.surprise(cx, cy);     // Task 6 (stub for now)
    this.onBlockBroken(b);
  }
  explodeAt(x, y, radius) {
    game.shake = Math.max(game.shake, 0.3); AudioSys.sfx('boom');
    Particles.burst(x, y, 18, { colors: ['#ff9f43', '#ffe156', '#fff'], type: 'flame', sp1: 380, l1: 0.7, s1: 14, grav: -100 });
    for (const k of this.blocks) if (k.alive && Math.hypot(k.x + k.w / 2 - x, k.y + k.h / 2 - y) <= radius) this.breakBlock(k, 'boom');
  }

  // ---- power-up capsules
  netHit(b) {
    AudioSys.sfx('clank');
    Particles.burst(b.x, b.y, 6, { colors: ['#fff', '#9a9a9a'], type: 'circle', sp1: 200, l1: 0.4, s1: 6, grav: 300 });
  }
  dropCapsule(x, y, kind) {
    if (!kind) {
      const weights = BB_CAP_WEIGHTS[Math.min(this.phase, BB_CAP_WEIGHTS.length - 1)];
      const entries = Object.entries(weights).filter(([, w]) => w > 0);
      let r = rand(0, entries.reduce((s, [, w]) => s + w, 0));
      for (const [k, w] of entries) { r -= w; if (r <= 0) { kind = k; break; } }
      if (!kind) kind = entries[entries.length - 1][0];
    }
    this.capsules.push({ x, y, kind, vy: BB.CAPSULE_VY, t: 0 });
  }
  updateCapsules(dt) {
    const p = this.paddleBox();
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const c = this.capsules[i];
      c.t += dt; c.y += c.vy * dt;
      if (c.y + 22 > p.y && c.y - 22 < p.y + p.h && c.x + 22 > p.x && c.x - 22 < p.x + p.w) {
        this.capsules.splice(i, 1); this.applyMod(c.kind); continue;
      }
      if (c.y > BB.FLOOR + 30) this.capsules.splice(i, 1);
    }
  }
  applyMod(kind) {
    AudioSys.sfx('bashpow');
    this.hud.banner(BB_MOD_NAMES[kind] || kind.toUpperCase(), '#ffe156');
    this.toast = { kind, t: 1 };
    if (kind === 'multi') {
      for (const b of this.balls.slice()) if (b.rest) this.launch(b);
      for (const b of this.balls.slice()) {
        for (let i = 0; i < 2 && this.balls.length < BB.MAX_BALLS; i++) {
          const ang = Math.atan2(b.vy, b.vx) + (i === 0 ? -1 : 1) * (35 * Math.PI / 180);
          const nb = this.spawnBall(b.x, b.y, false);
          nb.vx = Math.cos(ang) * b.speed; nb.vy = Math.sin(ang) * b.speed;
          this.steer(nb);
        }
      }
    } else if (kind === 'giant') {
      this.mods.add('giant', BB.MODS.giant);
      for (const b of this.balls) b.r = BB.GIANT_R;
    } else if (kind === 'wide') {
      this.mods.add('wide', BB.MODS.wide);
      this.wideK = 1.6;
    } else if (kind === 'net') {
      this.mods.add('net', BB.MODS.net);
      this.net = { t: BB.MODS.net };
    } else {
      this.mods.add(kind, BB.MODS[kind]);
    }
  }

  // ---- environmental surprise events
  surprise(x, y) {
    if (!this._surpriseBag.length) {
      const bag = ['tire', 'snatch', 'conveyor', 'tower'];
      for (let i = bag.length - 1; i > 0; i--) { const j = randi(0, i); const tmp = bag[i]; bag[i] = bag[j]; bag[j] = tmp; }
      this._surpriseBag = bag;
    }
    const kind = this._surpriseBag.pop();
    this.hud.banner('SURPRISE!', '#ffe156');
    AudioSys.sfx('whoosh');
    if (kind === 'tire') this.eventTire();
    else if (kind === 'snatch') this.eventSnatch();
    else if (kind === 'conveyor') { const row = this._randomRowWithBlocks(); if (row != null) this.eventConveyor(row); else this.eventTire(); }
    else this.eventTower();
  }
  _randomRowWithBlocks() {
    const rows = [...new Set(this.aliveBlocks().map(b => b.row))];
    return rows.length ? rows[randi(0, rows.length - 1)] : null;
  }

  // GIANT TIRE: rolls floor-to-floor; hitting the truck spins it out 0.5s (no damage)
  eventTire() {
    const side = Math.random() < 0.5;
    this.tires.push({ x: side ? BB.L : BB.R, y: BB.FLOOR, r: 62, vx: side ? 380 : -380, rot: 0 });
  }
  updateTires(dt) {
    const p = this.paddleBox();
    for (let i = this.tires.length - 1; i >= 0; i--) {
      const tr = this.tires[i];
      tr.x += tr.vx * dt; tr.rot += (tr.vx / tr.r) * dt;
      if (this.spinT <= 0) {
        const cyc = BB.FLOOR - tr.r;
        const cx = clamp(tr.x, p.x, p.x + p.w), cy = clamp(cyc, p.y, p.y + p.h);
        const dx = tr.x - cx, dy = cyc - cy;
        if (dx * dx + dy * dy < tr.r * tr.r) {
          this.spinT = 0.5; AudioSys.sfx('tireboom'); game.shake = Math.max(game.shake, 0.25);
          Particles.burst(game.player.cx, game.player.cy - 20, 10, { colors: ['#ffe156', '#fff'], type: 'sparkle', sp1: 260, l1: 0.7, s1: 10, grav: -60 });
        }
      }
      if (tr.x < BB.L - tr.r - 30 || tr.x > BB.R + tr.r + 30) this.tires.splice(i, 1);
    }
  }

  // MAGNET SNATCH / anti-stall CLEAR: the crane rail piece, doubles for both jobs
  updateCrane(dt) {
    const c = this.crane;
    if (c.mode === 'idle') {
      c.wanderT -= dt;
      if (c.wanderT <= 0) { c.wanderX = rand(BB.L + 100, BB.R - 100); c.wanderT = rand(2, 4); }
      c.x = lerp(c.x, c.wanderX, 1 - Math.exp(-1.2 * dt));
      c.y = lerp(c.y, 140, 1 - Math.exp(-2 * dt));
      c.holding = null;
    } else if (c.mode === 'snatch') this.updateSnatch(dt);
    else if (c.mode === 'clear') this.updateClear(dt);
  }
  eventSnatch() {
    let best = null, bd = Infinity;
    for (const b of this.balls) {
      if (b.rest || b.held) continue;
      const d = Math.hypot(b.x - this.crane.x, b.y - this.crane.y);
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) return;
    const c = this.crane;
    c.mode = 'snatch'; c.stage = 'chase'; c.target = best; c.t = 0; c.holdT = 0;
  }
  updateSnatch(dt) {
    const c = this.crane, b = c.target;
    if (!b || this.balls.indexOf(b) < 0) { c.mode = 'idle'; c.holding = null; c.target = null; return; }
    if (c.stage === 'chase') {
      const tx = b.x, ty = b.y - 6;
      c.x += clamp(tx - c.x, -700 * dt, 700 * dt);
      c.y += clamp(ty - c.y, -500 * dt, 500 * dt);
      if (Math.abs(c.x - tx) < 6 && Math.abs(c.y - ty) < 6) {
        c.stage = 'hold'; c.holdT = 0; b.held = true; c.holding = b; b.vx = 0; b.vy = 0;
        AudioSys.sfx('bashclank');
      }
    } else if (c.stage === 'hold') {
      b.x = c.x; b.y = c.y + 6;
      c.holdT += dt;
      if (c.holdT >= 0.8) {
        const ang = rand(-150, -30) * Math.PI / 180, sp = this.ballSpeed(b);
        b.held = false; c.holding = null;
        b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
        this.steer(b);
        b.graceT = 1.2; // the crane's release can never be "lost" — it briefly bounces off the floor if missed
        AudioSys.sfx('whoosh');
        c.stage = 'retract'; c.t = 0; c.target = null;
      }
    } else if (c.stage === 'retract') {
      c.t += dt; c.y = lerp(c.y, 140, 1 - Math.exp(-3 * dt));
      if (c.t > 0.6) c.mode = 'idle';
    }
  }
  craneClearOne() {
    const candidates = this.aliveBlocks().filter(b => b.landed && !b.falling);
    if (!candidates.length) return;
    const b = candidates[randi(0, candidates.length - 1)];
    const c = this.crane;
    c.mode = 'clear'; c.stage = 'chase'; c.target = b; c.t = 0;
  }
  updateClear(dt) {
    const c = this.crane, b = c.target;
    if (!b || !b.alive) { c.mode = 'idle'; c.target = null; c.holding = null; return; }
    const tx = b.x + b.w / 2, ty = b.y + b.h / 2 - 10;
    if (c.stage === 'chase') {
      c.x += clamp(tx - c.x, -700 * dt, 700 * dt);
      c.y += clamp(ty - c.y, -500 * dt, 500 * dt);
      if (Math.abs(c.x - tx) < 6 && Math.abs(c.y - ty) < 6) { c.stage = 'grab'; c.t = 0; c.holding = b; }
    } else if (c.stage === 'grab') {
      c.t += dt;
      if (c.t >= 0.3) {
        AudioSys.sfx('bashclank');
        this.breakBlock(b, 'crane');
        c.holding = null; c.stage = 'retract'; c.t = 0; c.target = null;
      }
    } else if (c.stage === 'retract') {
      c.t += dt; c.y = lerp(c.y, 140, 1 - Math.exp(-3 * dt));
      if (c.t > 0.6) c.mode = 'idle';
    }
  }

  // CONVEYOR: one row slides forever, wraps at the walls
  eventConveyor(row, dir) {
    if (dir === undefined) dir = Math.random() < 0.5 ? -1 : 1;
    this.conveyorRows.set(row, dir);
    for (const b of this.blocks) if (b.row === row) b.vx = dir * 60;
  }
  updateConveyors(dt) {
    const span = BB.R - BB.L;
    for (const [row, dir] of this.conveyorRows) {
      for (const b of this.blocks) {
        if (b.row !== row || !b.alive || !b.landed || b.falling) continue;
        if (b.kind === 'runner' && b.runT > 0) continue;
        b.x += dir * 60 * dt;
        if (b.x < BB.L) b.x += span; else if (b.x + b.w > BB.R) b.x -= span;
        b.vx = dir * 60;
      }
    }
  }

  // JUNK TOWER: 3 plain blocks rain in at a wall column, then topple into free candy
  eventTower() {
    const col = Math.random() < 0.5 ? 0 : 11;
    const rows = [4, 3, 2];
    const blocksArr = rows.map((row, i) => {
      const b = this.addBlock(col, row, 'plain');
      b.tower = true; b.landed = false; b.bounced = false; b.y = -60 - i * 30; b.vy = 0;
      return b;
    });
    this._towerGroups.push({ blocks: blocksArr, state: 'falling', t: 0, idx: 0 });
  }
  updateTowers(dt) {
    for (let i = this._towerGroups.length - 1; i >= 0; i--) {
      const g = this._towerGroups[i];
      if (g.state === 'falling') {
        if (g.blocks.every(b => b.landed || !b.alive)) { g.state = 'wait'; g.t = 0; }
      } else if (g.state === 'wait') {
        g.t += dt;
        if (g.t >= 1.2) { g.state = 'topple'; g.idx = 0; g.t = 0; }
      } else if (g.state === 'topple') {
        g.t += dt;
        while (g.idx < g.blocks.length && g.t >= g.idx * 0.25) {
          const b = g.blocks[g.idx];
          if (b.alive) this.breakBlock(b, 'tower');
          g.idx++;
        }
        if (g.idx >= g.blocks.length) this._towerGroups.splice(i, 1);
      }
    }
  }

  onBlockBroken(b) {}

  // ---- candy
  dropCandy(x, y, n) {
    for (let i = 0; i < n; i++) this.candies.push({ x, y, vx: rand(-160, 160), vy: rand(-380, -120), onFloor: false, t: 0, kind: randi(0, 2) });
  }
  updateCandy(dt, pl) {
    const p = this.paddleBox(), magnet = this.mods.has('magnet');
    for (let i = this.candies.length - 1; i >= 0; i--) {
      const c = this.candies[i];
      if (!c.onFloor) {
        if (magnet) {
          const dx = pl.cx - c.x, dy = pl.cy - c.y, d = Math.hypot(dx, dy) || 1;
          c.vx = dx / d * 1400; c.vy = dy / d * 1400;
        } else {
          c.vy += 900 * dt;
          const dx = pl.cx - c.x;
          c.vx += clamp(dx, -BB.CANDY_DRIFT, BB.CANDY_DRIFT) * dt * 2;
        }
        c.x += c.vx * dt; c.y += c.vy * dt;
        if (c.y >= BB.FLOOR - 10) { c.y = BB.FLOOR - 10; c.vx = 0; c.vy = 0; c.onFloor = true; }
      } else {
        c.t += dt;
        if (c.t >= BB.FLOOR_CANDY_T) { this.candies.splice(i, 1); continue; }
      }
      if (c.x > p.x - 12 && c.x < p.x + p.w + 12 && c.y > p.y - 14 && c.y < p.y + p.h + 14) {
        this.candies.splice(i, 1);
        game.candy++; AudioSys.sfx('candy'); this.hud.pop(c.x, c.y - 10, '+1', '#ffd24a', 20);
      }
    }
  }

  // ---- moving/falling blocks
  updateBlocks(dt, pl) {
    const p = this.paddleBox();
    for (const b of this.blocks) {
      if (!b.alive) continue;
      if (!b.landed) {
        // rain-in: fall to the grid row, bounce once, settle (junk tower and — later — wave build-in both use this)
        b.vy += 1400 * dt; b.y += b.vy * dt;
        const gy = BB.GY + b.row * BB.BH;
        if (b.y >= gy) {
          if (!b.bounced) { b.y = gy; b.vy = -180; b.bounced = true; if (Math.random() < 0.5) AudioSys.sfx('bashclank'); }
          else { b.y = gy; b.vy = 0; b.landed = true; }
        }
        continue;
      }
      if (b.hitT > 0) b.hitT = Math.max(0, b.hitT - dt);
      if (b.kind === 'runner' && b.runT > 0) {
        b.runT -= dt;
        const dir = b.vx >= 0 ? 1 : -1;
        let nx = clamp(b.x + b.vx * dt, BB.L, BB.R - b.w);
        for (const k2 of this.blocks) {
          if (k2 === b || !k2.alive || k2.row !== b.row) continue;
          if (dir > 0 && nx + b.w > k2.x && b.x + b.w <= k2.x) { nx = k2.x - b.w; b.runT = 0; }
          if (dir < 0 && nx < k2.x + k2.w && b.x >= k2.x + k2.w) { nx = k2.x + k2.w; b.runT = 0; }
        }
        if (nx <= BB.L || nx >= BB.R - b.w) b.runT = 0;
        b.x = nx; b.col = Math.round((b.x - BB.GX) / BB.BW);
        if (b.runT <= 0) b.vx = 0;
      }
      if (b.falling) {
        b.vy += 900 * dt; b.y += b.vy * dt;
        if (b.y + b.h >= p.y && b.y < p.y + p.h && b.x + b.w > p.x && b.x < p.x + p.w) {
          this.breakBlock(b, 'truck'); // route through breakBlock so onBlockBroken always fires on removal
        } else if (b.y > BB.FLOOR) {
          this.breakBlock(b, 'floor');
        }
      }
    }
    this.updateTowers(dt);
  }

  // ---- miss + debris + splat
  loseBall(b) {
    const i = this.balls.indexOf(b);
    if (i < 0) return;
    this.balls.splice(i, 1);
    if (this.balls.length === 0) {
      this.splat = { x: clamp(b.x, 80, 1200), y: BB.FLOOR, k: 1 };
      this.respawnT = BB.RESPAWN;
      for (let i2 = 0; i2 < 3; i2++) {
        this.debris.push({ x: this.splat.x + rand(-24, 24), y: BB.FLOOR - 6, kind: randi(0, 5), rot: rand(TAU), rotV: rand(-6, 6), vx: rand(-220, 220), vy: rand(-420, -180), t: 0, life: 1.2 });
      }
      AudioSys.sfx('bashmiss'); AudioSys.sfx('muffhonk');
      game.player.setMood('surprised', 0.6);
      this.mods.clear('rainbow');
      this.combo = 0; AudioSys.bashCombo = 0;
    } else {
      // not the last ball: a small plop, nothing more (other balls keep playing)
      AudioSys.sfx('plop');
      Particles.burst(b.x, b.y, 4, { colors: ['#9a9a9a', '#7d7d7d'], type: 'circle', sp1: 180, l1: 0.5, s1: 6, grav: 400 });
    }
  }

  // ---- main update
  update(dt, pl) {
    if (!this.booted) this.boot(pl);
    this.t += dt;
    this.mods.update(dt);
    this.hud.update(dt);
    arcadePayTick(this, dt);

    this.launchT -= dt;
    for (const b of this.balls) {
      if (b.rest) {
        b.x = pl.cx; b.y = pl.y - b.r;
        if (justP.Space || this.launchT <= 0) this.launch(b);
      } else {
        b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 6) b.trail.shift();
        this.stepBall(b, dt);
        if (b.bumpT > 0) b.bumpT = Math.max(0, b.bumpT - dt);
        if (b.graceT > 0) b.graceT = Math.max(0, b.graceT - dt);
        b.squash = lerp(b.squash, 1, 1 - Math.exp(-10 * dt));
      }
    }
    // miss detection (after stepping) — a ball just released by the crane snatch is graced:
    // it bounces off the floor instead of being lost, so the event can never cost a ball
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      if (b.rest || b.held || b.y - b.r <= BB.MISS_Y) continue;
      if (b.graceT > 0) { b.y = BB.FLOOR - 20 - b.r; b.vy = -Math.abs(b.vy || 300); this.steer(b); }
      else this.loseBall(b);
    }
    // respawn
    if (this.respawnT > 0) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) { this.spawnBall(pl.cx, pl.y - (this.mods.has('giant') ? BB.GIANT_R : BB.BALL_R), true); this.launchT = BB.LAUNCH_AUTO; }
    }
    // splat fade
    if (this.splat) { this.splat.k -= dt / 1.2; if (this.splat.k <= 0) this.splat = null; }
    // debris
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.t += dt; d.vy += 900 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.rotV * dt;
      if (d.t >= d.life) this.debris.splice(i, 1);
    }

    this.updateBlocks(dt, pl);
    this.updateCandy(dt, pl);
    this.updateCapsules(dt);
    this.updateTires(dt);
    this.updateConveyors(dt);
    this.updateCrane(dt);
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
  }

  drawBack(ctx, t) {
    BASH_ART.backdrop(ctx, t);
    BASH_ART.rail(ctx, t);
    BASH_ART.walls(ctx, t);
    BASH_ART.floor(ctx, t);
  }
  draw(ctx, t) {
    if (this.splat) BASH_ART.splat(ctx, this.splat.x, this.splat.y, t, this.splat.k);
    for (const c of this.candies) drawCandy(ctx, c.x, c.y, 15, c.kind || 0, t); // BASH_ART has no dedicated candyDrop; reuse the shared util.js candy piece like every other level's pickups
    for (const b of this.blocks) if (b.alive) BASH_ART.block(ctx, b, t);
    for (const d of this.debris) BASH_ART.junk(ctx, d.x, d.y, d.kind, d.rot, 1);
    for (const c of this.capsules) BASH_ART.capsule(ctx, c.x, c.y, c.kind, t);
    for (const tr of this.tires) BASH_ART.tire(ctx, tr.x, BB.FLOOR - tr.r, tr.r, tr.rot, t);
    if (this.net) BASH_ART.net(ctx, BB.FLOOR - 14, t, this.mods.frac('net'));
    BASH_ART.crane(ctx, this.crane.x, this.crane.y, t, { holding: !!this.crane.holding, mood: this.crane.mood });
    for (const b of this.balls) {
      for (const p of b.trail) { ctx.save(); ctx.globalAlpha = 0.18; BASH_ART.ball(ctx, p.x, p.y, b.r * 0.7, t, { mood: b.mood }); ctx.restore(); }
      BASH_ART.ball(ctx, b.x, b.y, b.r, t, { mood: b.mood, rainbow: this.mods.has('rainbow'), squash: b.squash });
    }
    this.hud.drawWorld(ctx, t);
  }
  drawFront(ctx, t) {
    const chips = this.mods.list().map(m => ({ frac: this.mods.frac(m.name), icon: (ctx, x, y, s) => BASH_ART.modIcon(ctx, x, y, s, m.name) }));
    this.hud.drawScreen(ctx, t, chips);
    if (this.mods.has('wide')) {
      const pl = game.player, facing = pl.facing || 1, pw = 70, ph = pl.h * 0.85;
      BASH_ART.plow(ctx, pl.cx + facing * (pl.w / 2 + pw * 0.32), pl.cy, pw, ph, facing, t);
    }
    if (this.toast) {
      ctx.save(); ctx.globalAlpha = Math.min(1, this.toast.t * 2);
      BASH_ART.modIcon(ctx, game.player.cx, game.player.y - 66, 40, this.toast.kind);
      ctx.restore();
    }
  }
}
