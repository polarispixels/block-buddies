'use strict';
// ================================================================ flower land
// RAINBOW SPIDER FLOWER LAND — Jack's storybook level (v1.25.0), a sublevel
// off Block Meadow 0-2. Spec: docs/superpowers/specs/2026-09-01-rainbow-
// spider-flower-land-design.md. One continuous 9600x1500 world: the ground
// floor holds the flower place, the giant spider home, the flower person and
// the flight field up to the rainbow castle; a giant one-way CLOUD 800 px up
// holds the pirate ship, the robot race and the surprise party.
//
// Everything story-shaped lives on the FlowerLand machine (lv.puzzle):
// actors, both key/gold missions (reusing Mission/MissionGate/MissionItem
// verbatim), the dragon's bubble pool, the race, the party. The level only
// adopts the machine's solids. Art comes from js/flowerart.js (FL_ART,
// creatures) and js/flowerscene.js (FL_SCENE, scenery).
//
// Kid rules: no enemies, no damage anywhere (the guards only shove), every
// gate is a visible cause -> effect with an icon bubble, nothing can be lost
// (shrooms follow forever, items snap across respawns, the race rematch is a
// touch, bubbles never stop, falling off the cloud lands you by the dragon).

const FL = {
  G: 1400, CLOUD: 600, W: 10000, H: 1500,     // 400 px of slack past the party room so the camera can frame it
  FLIGHT_END: 6250,                     // the hat rests past the castle gate
  CASTLE_X: 6150, DRAGON_X: 6800, BUBBLE_X: 6900,
  CLOUD_X0: 6750,
  SHIP_X: 6930, CHEST_X: 8990, BOT_X: 7380, // the chest waits past the finish: no backtracking
  START_X: 7450, FINISH_X: 8900, GOLD_DOOR_X: 9150,
  STAR: { x: 9520, y: 470 },
  PETALS: ['#ff8fb0', '#ffb347', '#ffe156', '#8fe0a8', '#8fd0ff', '#c9a0ff']
};

// a thought bubble with an icon drawn by `iconFn(ctx, x, y)` at its center
function flBubble(ctx, x, y, r, iconFn, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x - r * 0.6, y + r * 1.05, r * 0.22, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x - r * 0.9, y + r * 1.45, r * 0.13, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(40,25,50,0.4)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  iconFn(ctx, x, y);
  ctx.restore();
}
const FL_ICON = {
  shroom: (ctx, x, y) => FL_ART.magicShroom(ctx, x, y + 2, 0, { glow: false, scale: 0.75 }),
  stop: (ctx, x, y) => { // a red "not yet" sign — the guards' wordless NO
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    rr(ctx, x - 12, y - 4, 24, 8, 3); ctx.fill();
  },
  up: (ctx, x, y) => drawKeycap(ctx, x, y + 2, 40, 'up', game.t),
  gold: (ctx, x, y) => FL_ART.goldBar(ctx, x, y, 26, game.t),
  flag: (ctx, x, y) => { // tiny checkered race flag
    ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 12, y - 18); ctx.lineTo(x - 12, y + 18); ctx.stroke();
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#2a2a3a' : '#fff';
      ctx.fillRect(x - 12 + i * 7, y - 18 + j * 7, 7, 7);
    }
  },
  again: (ctx, x, y) => { // a circular arrow: "one more time!"
    ctx.strokeStyle = '#4aa3ff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, 13, -Math.PI * 0.2, Math.PI * 1.45); ctx.stroke();
    ctx.fillStyle = '#4aa3ff';
    ctx.beginPath(); ctx.moveTo(x + 15, y - 12); ctx.lineTo(x + 3, y - 12); ctx.lineTo(x + 11, y - 1); ctx.closePath(); ctx.fill();
  },
  heart: (ctx, x, y) => {
    ctx.fillStyle = '#ff5fa2';
    ctx.beginPath();
    ctx.moveTo(x, y + 14);
    ctx.bezierCurveTo(x - 22, y - 2, x - 10, y - 18, x, y - 6);
    ctx.bezierCurveTo(x + 10, y - 18, x + 22, y - 2, x, y + 14);
    ctx.fill();
  },
  door: (ctx, x, y) => { // the party door: gold arch
    ctx.fillStyle = '#ffd24a';
    rr(ctx, x - 12, y - 16, 24, 32, 10); ctx.fill();
    ctx.fillStyle = '#8a5a2a';
    ctx.beginPath(); ctx.arc(x + 5, y + 2, 2.5, 0, TAU); ctx.fill();
  }
};

// ---- the carried mushroom ----
class MagicShroom {
  constructor(cx, cy) {
    this.w = 46; this.h = 44;
    this.x = cx - this.w / 2; this.y = cy - this.h / 2; this.baseY = cy;
    this.state = 'waiting'; // -> 'follow' -> 'eaten'
    this.t = rand(9);
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt, pl, fl) {
    this.t += dt;
    if (this.state === 'waiting') {
      this.y = this.baseY - this.h / 2 + Math.sin(this.t * 2.6) * 8;
      if (chance(0.15)) Particles.burst(this.cx + rand(-24, 24), this.cy + rand(-20, 20), 1, { colors: ['#e0b0ff', '#ff8fb0'], type: 'sparkle', sp1: 20, grav: -50, l1: 0.8, s1: 7, up: 0 });
      if (!fl.carried && overlaps(this, pl)) {
        this.state = 'follow'; fl.carried = this;
        AudioSys.sfx('collect'); AudioSys.sfx('powerup');
        pl.setMood('grin', 1.5);
        Particles.burst(this.cx, this.cy, 14, { colors: ['#e0b0ff', '#ff8fb0', '#fff'], type: 'star', sp1: 240, l1: 0.8, s1: 10, grav: 200 });
      }
    } else if (this.state === 'follow') {
      const tx = pl.cx - pl.facing * 60, ty = pl.y - 30 + Math.sin(this.t * 3) * 8;
      if (Math.hypot(tx - this.cx, ty - this.cy) > 650) { this.x = tx - this.w / 2; this.y = ty - this.h / 2; }
      const k = Math.min(1, dt * 5.5);
      this.x += (tx - this.cx) * k; this.y += (ty - this.cy) * k;
      if (chance(0.1)) Particles.burst(this.cx, this.cy + 10, 1, { colors: ['#e0b0ff'], type: 'sparkle', sp1: 15, grav: -40, l1: 0.7, s1: 6, up: 0 });
    }
  }
  eat(fl) { this.state = 'eaten'; if (fl.carried === this) fl.carried = null; }
  draw(ctx) {
    if (this.state === 'eaten') return;
    FL_ART.magicShroom(ctx, this.cx, this.cy, this.t, { glow: this.state === 'waiting' });
  }
}

// ---- the giant flowers (solid ones block the route until smashed) ----
class GiantFlower {
  constructor(cx, gy, o = {}) {
    this.cx = cx; this.gy = gy; this.h = o.h || 360; this.c = o.c || 0; this.seed = o.seed || cx * 0.01;
    this.t = rand(9); this.broken = false; this.breakT = 0;
    this.solids = [];
    if (o.solid) {
      this.solids.push({ x: cx - 30, y: gy - this.h, w: 60, h: this.h, skipDraw: true, flower: true });
      this.solids.push({ x: cx - 92, y: gy - this.h - 165, w: 184, h: 175, skipDraw: true, flower: true });
    }
  }
  smash() {
    if (this.broken) return;
    this.broken = true; this.breakT = 0;
    for (const s of this.solids) s.broken = true;
    AudioSys.sfx('smash'); AudioSys.sfx('poof');
    game.shake = Math.max(game.shake, 0.4);
    const by = this.gy - this.h - 80;
    Particles.burst(this.cx, by, 40, { colors: FL.PETALS, type: 'confetti', sp0: 120, sp1: 460, l0: 1, l1: 2, s0: 9, s1: 16, grav: 260, up: 220 });
    Particles.burst(this.cx, by, 16, { colors: ['#57d357', '#7be07b'], type: 'block', sp1: 300, l1: 1.2, s1: 12, grav: 500, up: 160 });
    Particles.burst(this.cx, by, 12, { colors: ['#ffe156', '#fff'], type: 'star', sp1: 320, l1: 0.9, s1: 12, grav: 150 });
  }
  update(dt) { this.t += dt; if (this.broken) this.breakT = Math.min(1, this.breakT + dt); }
  draw(ctx) {
    FL_SCENE.giantFlower(ctx, this.cx, this.gy, { h: this.h, c: this.c, t: this.t, seed: this.seed, broken: this.broken, breakT: this.breakT });
  }
}

// ---- the giant spiders: rainbow (grow + smash) and grump (guards) ----
class RainbowSpider {
  constructor(cx, gy, kind, o = {}) {
    this.cx = cx; this.gy = gy; this.kind = kind;
    this.scale = 1; this.facing = o.facing || 1;
    this.state = kind === 'grump' ? 'grumpy' : 'hungry';
    this.t = rand(9); this.st = 0; this.munch = 0; this.rear = 0; this.stomp = 0;
    this.flower = o.flower || null; // what a rainbow spider smashes once grown
    this.onSmash = o.onSmash || null;
    this.grumbleT = 0; this.zT = 0;
  }
  box() { return { x: this.cx - 75 * this.scale, y: this.gy - 100 * this.scale, w: 150 * this.scale, h: 100 * this.scale }; }
  feed() { // a following mushroom reached us
    this.state = 'eat'; this.st = 0;
    AudioSys.sfx('candy');
    Particles.burst(this.cx, this.gy - 60 * this.scale, 10, { colors: ['#e0b0ff', '#ff8fb0', '#fff'], type: 'sparkle', sp1: 160, l1: 0.6, s1: 9 });
  }
  update(dt) {
    this.t += dt; this.st += dt;
    this.grumbleT = Math.max(0, this.grumbleT - dt);
    const s = this.state;
    if (s === 'eat') {
      this.munch = (Math.sin(this.st * 14) + 1) / 2;
      if (this.st > 0.9) {
        this.munch = 0; this.st = 0;
        if (this.kind === 'grump') { this.state = 'yawn'; AudioSys.sfx('hiccup'); }
        else { this.state = 'grow'; AudioSys.sfx('grow'); AudioSys.sfx('powerup'); }
      }
    } else if (s === 'grow') {
      const k = Math.min(1, this.st / 1.4), e = k * k * (3 - 2 * k);
      this.scale = lerp(1, 2.2, e) + Math.sin(k * Math.PI * 3) * 0.08 * (1 - k);
      if (chance(0.7)) Particles.burst(this.cx + rand(-90, 90) * this.scale, this.gy - rand(0, 100) * this.scale, 2, { colors: RAINBOW.concat(['#fff']), type: 'sparkle', sp1: 120, grav: -40, l1: 0.8, s1: 10, up: 0 });
      if (k >= 1) { this.scale = 2.2; this.state = this.flower ? 'walk' : 'happy'; this.st = 0; game.shake = Math.max(game.shake, 0.2); AudioSys.sfx('thud'); }
    } else if (s === 'walk') {
      const target = this.flower.cx - 175;
      const d = target - this.cx;
      this.facing = d > 0 ? 1 : -1;
      if (Math.abs(d) > 8) {
        this.cx += Math.sign(d) * Math.min(Math.abs(d), 190 * dt);
        if (Math.floor(this.st * 3) !== Math.floor((this.st - dt) * 3)) { AudioSys.sfx('thud'); game.shake = Math.max(game.shake, 0.08); }
      } else { this.state = 'smash'; this.st = 0; }
    } else if (s === 'smash') {
      if (this.st < 0.7) { this.rear = this.st / 0.7; this.stomp = 0; }
      else if (this.st < 0.95) {
        this.rear = 1 - (this.st - 0.7) / 0.25; this.stomp = (this.st - 0.7) / 0.25;
        if (!this.flower.broken && this.st > 0.9) { this.flower.smash(); if (this.onSmash) this.onSmash(); }
      } else { this.rear = 0; this.stomp = 0; this.state = 'happy'; this.st = 0; }
    } else if (s === 'yawn') {
      if (this.st > 1.1) { this.state = 'sleep'; this.st = 0; AudioSys.sfx('snore'); }
    } else if (s === 'sleep') {
      this.zT -= dt;
      if (this.zT <= 0) { this.zT = 1.1; game.level.puzzle.zzz.push({ x: this.cx + 30 * this.facing, y: this.gy - 70, t: 0 }); if (chance(0.5)) AudioSys.sfx('snore'); }
    }
  }
  mood() {
    const s = this.state;
    if (this.kind === 'grump') return s === 'sleep' ? 'sleep' : s === 'yawn' ? 'yawn' : s === 'eat' ? 'eat' : 'grumpy';
    return s === 'hungry' ? 'hungry' : s === 'eat' ? 'eat' : (s === 'happy' && game.endPhase === 'party') ? 'dance' : 'happy';
  }
  draw(ctx, dance = false) {
    FL_ART.rainbowSpider(ctx, this.cx, this.gy, { t: this.t, scale: this.scale, kind: this.kind, mood: dance ? 'dance' : this.mood(), facing: this.facing, munch: this.munch, rear: this.rear, stomp: this.stomp });
    if (this.state === 'hungry' || (this.kind === 'grump' && this.grumbleT > 0)) {
      const bx = this.cx + 60 * this.scale, by = this.gy - 130 * this.scale + Math.sin(this.t * 3) * 4;
      flBubble(ctx, bx, by, 30, this.state === 'hungry' ? FL_ICON.shroom : FL_ICON.stop, this.state === 'hungry' ? 0.9 : Math.min(1, this.grumbleT * 2));
    }
  }
}

// ---- the little flower person (gives the hat) ----
class FlowerPerson {
  constructor(cx, gy) { this.cx = cx; this.gy = gy; this.state = 'wait'; this.t = rand(9); this.st = 0; this.hop = 0; this.facing = -1; }
  update(dt, pl, fl) {
    this.t += dt; this.st += dt;
    this.facing = pl.cx < this.cx ? -1 : 1;
    if (this.state === 'wait' && Math.abs(pl.cx - this.cx) < 90 && Math.abs(pl.y + pl.h - this.gy) < 60) {
      this.state = 'greet'; this.st = 0;
      AudioSys.sfx('cheer'); AudioSys.sfx('heart');
      Particles.burst(this.cx, this.gy - 70, 10, { colors: ['#ff5fa2', '#ffe156', '#fff'], type: 'heart', sp1: 150, l1: 0.9, s1: 10, grav: -60 });
    } else if (this.state === 'greet') {
      this.hop = Math.abs(Math.sin(this.st * 9)) * (this.st < 0.8 ? 1 : 0);
      if (this.st > 0.9) { this.state = 'gift'; this.st = 0; fl.startHatGift(this); }
    } else if (this.state === 'gift') {
      this.hop = 0;
    } else this.hop = game.endPhase === 'party' ? Math.abs(Math.sin(this.t * 6)) * 0.6 : 0;
  }
  draw(ctx, x = this.cx, gy = this.gy) {
    FL_ART.flowerPerson(ctx, x, gy, this.t, { mood: this.state === 'wait' ? 'happy' : 'grin', hop: this.hop, holdHat: this.state === 'wait' || this.state === 'greet', facing: this.facing });
  }
}

// ---- the gold bar the race pays out (a MissionItem in gold clothes) ----
class GoldItem extends MissionItem {
  constructor() { super('gold'); }
  draw(ctx) {
    if (this.state === 'hidden' || this.state === 'used') return;
    if (this.state === 'waiting') {
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(this.t * 3);
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(this.cx, this.cy, 56, 0, TAU); ctx.fill();
      ctx.restore();
    }
    FL_ART.goldBar(ctx, this.cx, this.cy, this.state === 'waiting' ? 48 : 36, this.t);
  }
}

// ---- the racing robot ----
class RaceBot {
  constructor(cx, gy) {
    this.w = 56; this.h = 72;
    this.x = cx - this.w / 2; this.y = gy - this.h; this.gy = gy;
    this.vx = 0; this.vy = 0; this.onGround = true; this.facing = -1;
    this.state = 'guard'; // guard -> countdown -> race -> lost | won -> again -> countdown ...
    this.t = rand(9); this.st = 0; this.run = 0;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  toLine() { this.x = FL.START_X + 40; this.y = this.gy - this.h; this.vx = 0; this.vy = 0; this.facing = 1; }
  update(dt, pl, fl) {
    this.t += dt; this.st += dt;
    const lv = game.level;
    if (this.state === 'guard') {
      this.facing = pl.cx < this.cx ? -1 : 1;
      if (fl.onCloud(pl) && pl.cx > this.cx - 110 && pl.cx < this.cx + 160) fl.startRace();
    } else if (this.state === 'race') {
      const lead = this.x - pl.x;
      const speed = lead > 320 ? 90 : lead < -220 ? 300 : 235;
      this.vx = speed; this.facing = 1;
      this.run = Math.min(1, speed / 235);
      // hop the tiny clouds (scripted: a jump when one is within reach)
      if (this.onGround) for (const ob of fl.bumps) {
        const gap = ob.x - (this.x + this.w);
        if (gap > -10 && gap < 100) { this.vy = -640; this.onGround = false; break; }
      }
      this.vy += 1600 * dt;
      const res = moveEntity(this, lv, dt);
      this.onGround = res.ground;
      if (res.wall && this.onGround) { this.vy = -640; this.onGround = false; } // never stuck on a bump
      if (this.x > FL.FINISH_X) { this.state = 'won'; this.st = 0; this.vx = 0; AudioSys.sfx('bong'); }
      if (chance(0.3) && this.onGround) Particles.burst(this.x, this.y + this.h, 1, { colors: ['#fff'], sp1: 60, l1: 0.4, s1: 6, up: 20 });
    } else if (this.state === 'won') {
      this.run = 0;
      if (this.st > 1.4) { this.state = 'again'; this.st = 0; this.facing = -1; }
    } else if (this.state === 'again') { // walks back to the line, then waits with a "one more time" bubble
      if (this.x > FL.START_X + 40) { this.x -= 260 * dt; this.facing = -1; this.run = 0.7; }
      else { this.toLine(); this.run = 0; this.facing = -1; if (overlaps(this, pl)) fl.startRace(); }
    } else if (this.state === 'lost') {
      this.run = 0;
    } else this.run = 0;
  }
  draw(ctx, x = this.cx, gy = this.y + this.h, mood) {
    const m = mood || (this.state === 'lost' ? 'happy' : this.state === 'again' ? 'wait' : this.state === 'won' ? 'happy' : 'idle');
    FL_ART.raceBot(ctx, x, gy, this.t, { run: this.run, facing: this.facing, mood: m });
    if (this.state === 'guard') flBubble(ctx, this.cx + 40, this.y - 40 + Math.sin(this.t * 3) * 4, 28, FL_ICON.flag, 0.9);
    if (this.state === 'again' && this.x <= FL.START_X + 41) flBubble(ctx, this.cx + 40, this.y - 40 + Math.sin(this.t * 3) * 4, 28, FL_ICON.again, 0.9);
  }
}

// ================================================================ the machine
class FlowerLand {
  constructor(lv) {
    const G = FL.G, C = FL.CLOUD;
    this.t = 0; this.zzz = []; this.carried = null;
    this.solids = [];
    // ---- zone 1: flower place ----
    this.flowerA = new GiantFlower(1815, G, { h: 360, c: 0, solid: true, seed: 1 });
    this.shrooms = [new MagicShroom(680, G - 150 - 40), new MagicShroom(2960, G - 130 - 40), new MagicShroom(3500, G - 150 - 40)];
    this.keyItem = new MissionItem('key');
    this.keyPuzzle = { done: false, update() {}, draw() {} };
    this.keyMission = new Mission('flkey', new MissionGate(2700, G, { theme: 'wood' }), this.keyPuzzle, this.keyItem);
    this.spiderA = new RainbowSpider(1480, G, 'rainbow', { flower: this.flowerA, onSmash: () => {
      this.keyPuzzle.done = true;
      this.keyItem.revealAt(this.flowerA.cx, G - 110);
    } });
    // ---- zone 2: the spider home ----
    this.guards = [new RainbowSpider(3180, G, 'grump', { facing: -1 }), new RainbowSpider(3330, G, 'grump', { facing: -1 })];
    this.guardWall = { x: 3120, y: G - 220, w: 260, h: 220, skipDraw: true, guard: true };
    this.guardCd = 0;
    this.flowerB = new GiantFlower(3860, G, { h: 300, c: 4, solid: true, seed: 2 });
    this.spiderB = new RainbowSpider(3620, G, 'rainbow', { flower: this.flowerB, onSmash: () => {
      Particles.candyBurst(this.flowerB.cx, G - 300, 18);
      for (let i = 0; i < 6; i++) game.pickups.push(new Pickup(this.flowerB.cx - 150 + i * 60, G - 90 - (i % 2) * 40, 'candy'));
    } });
    // ---- zone 3: the flower person ----
    this.person = new FlowerPerson(4250, G);
    this.hatAnim = null; this.hintT = 0; this.wasFly = false; this.foldT = 0;
    // ---- zone 4: the flight field (tall solid flowers with bloom tops) ----
    this.field = [];
    const fieldSpec = [[4750, 300, 1], [5030, 520, 2], [5310, 380, 3], [5600, 640, 4], [5880, 440, 5], [6080, 560, 0]];
    for (const [x, h, c] of fieldSpec) this.field.push(new GiantFlower(x, G, { h, c, solid: true, seed: x * 0.013 }));
    // ---- zone 5: castle, dragon, bubbles, the cloud ----
    this.dragon = { cx: FL.DRAGON_X, gy: G, t: rand(9), puff: 0, cd: 0.8 };
    this.bubbles = [];
    for (let i = 0; i < 8; i++) {
      const b = { x: 0, y: 0, w: 150, h: 34, oneWay: true, bouncy: true, bounceVy: -1000, skipDraw: true, broken: true, bubble: true, sway: 0, age: 0 };
      this.bubbles.push(b); this.solids.push(b);
    }
    this.cloud = { x: FL.CLOUD_X0, y: C, w: FL.W - FL.CLOUD_X0, h: 110, oneWay: true, skipDraw: true, cloud: true };
    this.solids.push(this.cloud);
    this.deck = { x: FL.SHIP_X + 30, y: C - FL_SCENE.SHIP_DECK, w: 300, h: 16, oneWay: true, skipDraw: true };
    this.solids.push(this.deck);
    this.captain = { cx: FL.SHIP_X + 120, gy: C - FL_SCENE.SHIP_DECK, t: rand(9) };
    // ---- zone 6: robot race, gold, party ----
    this.chest = { cx: FL.CHEST_X, gy: C, open: false, openT: 0 };
    this.bot = new RaceBot(FL.BOT_X, C);
    this.bumps = [];
    for (const x of [7600, 7850, 8100, 8380, 8650]) {
      const b = { x, y: C - 72, w: 64, h: 72, skipDraw: true, bump: true };
      this.bumps.push(b); this.solids.push(b);
    }
    this.raceWon = false; this.countT = -1;
    this.goldItem = new GoldItem();
    this.goldPuzzle = { done: false, update() {}, draw() {} };
    this.goldMission = new Mission('flgold', new MissionGate(FL.GOLD_DOOR_X, C, { theme: 'wood' }), this.goldPuzzle, this.goldItem);
    this.party = false; this.partyT = 0;
    // level adopts every solid the actors own
    for (const f of [this.flowerA, this.flowerB].concat(this.field)) for (const s of f.solids) this.solids.push(s);
    this.solids.push(this.guardWall);
    this.solids.push(this.keyMission.gate.solid, this.goldMission.gate.solid);
    // backdrop flowers (never solid)
    this.backFlowers = [];
    for (const [x, h, c] of [[260, 220, 2], [1000, 260, 3], [1250, 180, 5], [2200, 240, 1], [2450, 200, 2], [4500, 230, 3], [4620, 170, 0], [6500, 240, 5], [6650, 190, 1]]) this.backFlowers.push({ x, h, c, seed: x * 0.017 });
  }
  onCloud(pl) { return pl.y + pl.h <= FL.CLOUD + 10 && pl.cx > FL.CLOUD_X0; }
  lights() { return []; }

  // ---- story triggers ----
  startHatGift(person) {
    const pl = game.player;
    this.hatAnim = { t: 0, x0: person.cx + person.facing * 26, y0: person.gy - 96, pl };
    game.cut = { name: 'hatgift', t: 0 };
    AudioSys.sfx('bells');
  }
  startGrow(spider) { // the cutscene camera holds on the growing spider
    this.cutSpider = spider;
    game.cut = { name: 'spidergrow', t: 0 };
  }
  startRace() {
    const pl = game.player;
    pl.x = FL.START_X - pl.w - 10; pl.y = FL.CLOUD - pl.h; pl.vx = 0; pl.vy = 0; pl.facing = 1;
    this.bot.toLine(); this.bot.state = 'countdown'; this.bot.st = 0;
    this.countT = 0;
    game.cut = { name: 'racestart', t: 0 };
    AudioSys.sfx('rev');
  }
  winRace() {
    if (this.raceWon) return;
    this.raceWon = true;
    this.bot.state = 'lost'; this.bot.st = 0; this.bot.vx = 0;
    AudioSys.sfx('fanfare'); AudioSys.sfx('cheer');
    game.shake = Math.max(game.shake, 0.25);
    Particles.burst(game.player.cx, game.player.y, 30, { colors: RAINBOW, type: 'confetti', sp1: 380, l0: 1, l1: 2, s1: 12, grav: 300, up: 220 });
    this.chest.open = true;
    this.goldPuzzle.done = true;
    this.goldItem.revealAt(this.chest.cx, FL.CLOUD - 80); // grab height for a walking hero
  }

  // ---- ticks ----
  cutTick(dt, c) { // called from updateCut for this level's own cutscenes
    const pl = game.player, cam = game.cam;
    this.t += dt;
    this.updateShared(dt);
    if (c.name === 'spidergrow') {
      const sp = this.cutSpider;
      sp.update(dt);
      const fl = sp.flower;
      const tx = clamp((sp.cx + fl.cx) / 2 - W / 2, 0, FL.W - W), ty = clamp(sp.gy - H * 0.72, 0, FL.H - H);
      cam.x = lerp(cam.x, tx, 1 - Math.exp(-4 * dt)); cam.y = lerp(cam.y, ty, 1 - Math.exp(-4 * dt));
      if (sp.state === 'happy' && sp.st > 0.9) game.cut = null;
    } else if (c.name === 'hatgift') {
      const a = this.hatAnim;
      if (a) a.t += dt;
      if (a && a.t >= 1.3 && !pl.hat) {
        pl.hat = true; this.hatAnim = null; this.hintT = 4.5;
        AudioSys.sfx('powerup'); AudioSys.sfx('rainbow');
        pl.setMood('grin', 2);
        Particles.burst(pl.cx, pl.y - 10, 24, { colors: RAINBOW.concat(['#fff']), type: 'sparkle', sp1: 260, l1: 1, s1: 11, grav: 150 });
        this.person.state = 'done';
      }
      if (c.t > 1.7) game.cut = null;
    } else if (c.name === 'racestart') {
      this.countT = c.t;
      if (c.t > 3.3) { game.cut = null; this.bot.state = 'race'; this.bot.st = 0; this.countT = -1; AudioSys.sfx('launch'); }
    }
  }
  updateShared(dt) { // what keeps moving during cutscenes too
    for (const f of [this.flowerA, this.flowerB].concat(this.field)) f.update(dt);
    for (const z of this.zzz) { z.t += dt; z.y -= 30 * dt; z.x += Math.sin(z.t * 4) * 20 * dt; }
    this.zzz = this.zzz.filter(z => z.t < 2.2);
    this.dragon.t += dt; this.dragon.puff = Math.max(0, this.dragon.puff - dt * 2.5);
    this.captain.t += dt;
    if (this.chest.open) this.chest.openT = Math.min(1, this.chest.openT + dt * 1.5);
  }
  update(dt, pl) {
    const G = FL.G, lv = game.level;
    this.t += dt;
    this.updateShared(dt);
    // ---- hat flight zone: on over the flower field, resting past the castle ----
    const fly = !!pl.hat && pl.cx < FL.FLIGHT_END;
    if (fly !== this.wasFly && pl.hat) {
      if (!fly) { AudioSys.sfx('plop'); this.foldT = 1; pl.setMood('surprised', 0.8); }
      else { AudioSys.sfx('rainbow'); Particles.burst(pl.cx, pl.y - 10, 12, { colors: RAINBOW, type: 'sparkle', sp1: 200, l1: 0.8, s1: 9 }); }
    }
    this.wasFly = fly; pl.hatFly = fly;
    this.hintT = Math.max(0, this.hintT - dt);
    this.foldT = Math.max(0, this.foldT - dt);
    // ---- mushrooms + who eats them ----
    for (const m of this.shrooms) m.update(dt, pl, this);
    if (this.carried) {
      const m = this.carried;
      // the shroom trails BEHIND the hero, so delivery counts when either the
      // shroom or the hero reaches a spider's (slightly widened) body
      const reach = sp => { const b = sp.box(); const wb = { x: b.x - 30, y: b.y - 20, w: b.w + 60, h: b.h + 20 }; return overlaps(m, b) || overlaps(pl, wb); };
      for (const sp of [this.spiderA, this.spiderB]) {
        if (sp.state === 'hungry' && reach(sp)) { m.eat(this); sp.feed(); this.startGrow(sp); break; }
      }
      if (this.carried && this.guards[0].state === 'grumpy' && (reach(this.guards[0]) || reach(this.guards[1]))) {
        m.eat(this);
        for (const g of this.guards) g.feed();
      }
    }
    this.spiderA.update(dt); this.spiderB.update(dt);
    for (const g of this.guards) g.update(dt);
    // the guards' wall stands while they're awake; a push is a harmless shove
    this.guardCd = Math.max(0, this.guardCd - dt);
    if (this.guards[0].state === 'sleep' && !this.guardWall.broken) {
      this.guardWall.broken = true;
      AudioSys.sfx('switch');
      Particles.burst(this.guardWall.x + 130, G - 100, 14, { colors: ['#c9a0ff', '#fff'], type: 'sparkle', sp1: 200, l1: 0.8, s1: 10 });
    }
    if (!this.guardWall.broken && this.guardCd <= 0) {
      const w = this.guardWall;
      const pushR = keys.ArrowRight && pl.cx < w.x && pl.x + pl.w > w.x - 6 && pl.y + pl.h > w.y;
      if (pushR) {
        this.guardCd = 1.3;
        pl.vx = 0; pl.x = w.x - pl.w - 26; pl.vy = -260; pl.onGround = false;
        pl.setMood('surprised', 1);
        for (const g of this.guards) g.grumbleT = 1.6;
        AudioSys.sfx('thud'); AudioSys.sfx('hornflat');
        game.shake = Math.max(game.shake, 0.12);
      }
    }
    // ---- missions (key door, gold door) ----
    this.keyMission.update(dt, pl);
    this.goldMission.update(dt, pl);
    // ---- the flower person ----
    this.person.update(dt, pl, this);
    // ---- the dragon's bubble column (only while the hero is near) ----
    const dr = this.dragon;
    if (Math.abs(pl.cx - dr.cx) < 900 && !this.onCloud(pl)) {
      dr.cd -= dt;
      if (dr.cd <= 0) {
        dr.cd = 1.3;
        const b = this.bubbles.find(bb => bb.broken);
        if (b) {
          b.broken = false; b.age = 0; b.sway = rand(TAU);
          b.x = FL.BUBBLE_X - b.w / 2; b.y = G - 24; // born under the hero's feet: just standing there gets you lifted
          dr.puff = 1;
          AudioSys.sfx('blorp');
        }
      }
    }
    for (const b of this.bubbles) {
      if (b.broken) continue;
      b.age += dt;
      b.y -= 125 * dt;
      b.x = FL.BUBBLE_X - b.w / 2 + Math.sin(b.age * 1.6 + b.sway) * 26;
      // a bubble rising under a hero who is just STANDING in the column lifts
      // them — the ground solid wins the collision pass, so do it here. Landing
      // on one from above is the ordinary one-way bouncer path.
      const feetNow = pl.y + pl.h;
      if (pl.onGround && pl.x + pl.w > b.x && pl.x < b.x + b.w && feetNow - b.y > -6 && feetNow - b.y < 40) {
        pl.vy = -1000; pl.onGround = false; pl.squash = 1.45; pl.y = b.y - pl.h - 1;
      }
      // a bounce pops it (the hero just left it with the bounce speed)
      const feet = pl.y + pl.h;
      const onIt = pl.x + pl.w > b.x && pl.x < b.x + b.w && feet >= b.y - 30 && feet <= b.y + 8;
      if ((pl.vy <= -990 && onIt) || b.y < FL.CLOUD - 60 || b.age > 9) {
        b.broken = true;
        if (onIt) { AudioSys.sfx('bounce'); pl.setMood('grin', 0.8); } else AudioSys.sfx('blorp');
        Particles.burst(b.x + b.w / 2, b.y + 10, 12, { colors: ['#bfe8ff', '#fff', '#ffd0f0'], type: 'bubble', sp1: 140, grav: -60, l1: 0.6, s1: 9 });
      }
    }
    // ---- the race ----
    this.bot.update(dt, pl, this);
    if (this.bot.state === 'race') {
      if (pl.x > FL.FINISH_X) this.winRace();
      else if (!this.onCloud(pl) && pl.y > FL.CLOUD + 120) { this.bot.state = 'again'; this.bot.st = 0; } // fell off: walk back, try again
    }
    // ---- the party ----
    if (!this.party && this.goldMission.gate.state === 'open') {
      this.party = true; this.partyT = 0;
      AudioSys.sfx('cheer'); AudioSys.sfx('bells');
      Particles.burst(9520, FL.CLOUD - 200, 40, { colors: RAINBOW, type: 'confetti', sp1: 380, l0: 1, l1: 2.2, s1: 12, grav: 220, up: 200 });
    }
    if (this.party) {
      this.partyT += dt;
      if (chance(0.15)) Particles.burst(9250 + rand(0, 560), FL.CLOUD - rand(120, 380), 1, { colors: RAINBOW, type: 'confetti', sp1: 60, l1: 1.6, s1: 9, grav: 120, up: 0 });
    }
  }

  // ---- drawing ----
  drawBack(ctx, t) {
    const G = FL.G, C = FL.CLOUD;
    for (const f of this.backFlowers) FL_SCENE.giantFlower(ctx, f.x, G, { h: f.h, c: f.c, t, seed: f.seed, big: false });
    FL_SCENE.spiderHome(ctx, 2780, G, 1100, t);
    FL_SCENE.rainbowCastle(ctx, FL.CASTLE_X, G, t);
    FL_SCENE.cloudIsland(ctx, this.cloud.x, C, this.cloud.w, t);
    FL_SCENE.pirateShip(ctx, FL.SHIP_X, C, t);
    FL_SCENE.partyDecor(ctx, 9250, C, 560, t);
  }
  draw(ctx, t) {
    const G = FL.G, C = FL.CLOUD, pl = game.player;
    // flowers (solid ones), the field
    this.flowerA.draw(ctx); this.flowerB.draw(ctx);
    for (const f of this.field) f.draw(ctx);
    // doors + items
    this.keyMission.draw(ctx, t); this.goldMission.draw(ctx, t);
    // spiders
    this.spiderA.draw(ctx); this.spiderB.draw(ctx);
    for (const g of this.guards) g.draw(ctx);
    for (const z of this.zzz) {
      const a = 1 - z.t / 2.2;
      outlineText(ctx, 'z', z.x, z.y, 22 + z.t * 10, `rgba(201,160,255,${a})`, `rgba(60,40,90,${a})`);
    }
    // mushrooms
    for (const m of this.shrooms) m.draw(ctx);
    // the flower person + the flying hat
    this.person.draw(ctx);
    if (this.hatAnim) {
      const a = this.hatAnim, k = Math.min(1, a.t / 1.3), e = k * k * (3 - 2 * k);
      const hx = lerp(a.x0, a.pl.cx, e), hy = lerp(a.y0, a.pl.y - 12, e) - Math.sin(k * Math.PI) * 90;
      FL_ART.flowerHat(ctx, hx, hy, 26, { t, active: true, spin: k * 8 });
      if (chance(0.5)) Particles.burst(hx, hy, 1, { colors: RAINBOW, type: 'sparkle', sp1: 40, grav: 60, l1: 0.6, s1: 7, up: 0 });
    }
    if (this.hintT > 0 && pl) { // wordless "hold UP" over the hero after the gift
      flBubble(ctx, pl.cx + 50, pl.y - 60 + Math.sin(t * 3) * 5, 30, FL_ICON.up, Math.min(1, this.hintT));
    }
    // the dragon + bubbles
    FL_ART.bubbleDragon(ctx, this.dragon.cx, G, this.dragon.t, { puff: this.dragon.puff, facing: 1 });
    for (const b of this.bubbles) if (!b.broken) FL_ART.bubble(ctx, b.x + b.w / 2, b.y + b.h / 2 + 30, 70, t);
    // the captain on deck (thought: gold -> door, until the gold is in hand)
    FL_ART.captain(ctx, this.captain.cx, this.captain.gy, this.captain.t, { mood: this.party ? 'grin' : 'happy', facing: pl && pl.cx > this.captain.cx ? 1 : -1 });
    if (!this.raceWon && pl && Math.abs(pl.cx - this.captain.cx) < 420 && this.onCloud(pl)) {
      flBubble(ctx, this.captain.cx + 44, this.captain.gy - 150 + Math.sin(t * 3) * 4, 30, FL_ICON.gold, 0.9);
    } else if (this.raceWon && !this.party && pl && Math.abs(pl.cx - this.captain.cx) < 420) {
      flBubble(ctx, this.captain.cx + 44, this.captain.gy - 150 + Math.sin(t * 3) * 4, 30, FL_ICON.door, 0.9);
    }
    // race track: start line, bumps, finish flag, chest, robot
    FL_SCENE.startLine(ctx, FL.START_X, C, t);
    for (const b of this.bumps) FL_SCENE.tinyCloud(ctx, b.x, b.y, b.w, b.h, t);
    FL_SCENE.finishFlag(ctx, FL.FINISH_X, C, t);
    FL_SCENE.goldChest(ctx, this.chest.cx, C, t, { open: this.chest.open, openT: this.chest.openT });
    this.bot.draw(ctx);
    if (this.countT >= 0) { // 3 - 2 - 1 - GO! over the start line
      const n = this.countT < 1 ? '3' : this.countT < 2 ? '2' : this.countT < 3 ? '1' : 'GO!';
      const k = (this.countT % 1), sz = n === 'GO!' ? 90 : 84 - k * 18;
      outlineText(ctx, n, FL.START_X + 80, C - 220 - k * 20, sz, n === 'GO!' ? '#7be07b' : '#ffe156', '#3a2a4a');
    }
    // the party: the whole cast in the room, dancing
    if (this.party) {
      const bob = (i) => Math.abs(Math.sin(this.partyT * 5 + i)) * 10;
      // left of the star: the little ones; right of it: the big ones — the star stays clear
      FL_ART.rainbowSpider(ctx, 9270, C - bob(6), { t: t + 2, scale: 0.55, kind: 'grump', mood: 'sleep', facing: 1 });
      this.person.draw(ctx, 9340, C - bob(0));
      this.bot.draw(ctx, 9400, C - bob(1), 'happy');
      FL_ART.captain(ctx, 9460, C - bob(5), t, { mood: 'grin', facing: 1 });
      FL_ART.rainbowSpider(ctx, 9640, C - bob(3), { t, scale: 1.05, kind: 'rainbow', mood: 'dance', facing: -1 });
      ctx.save(); ctx.translate(9760, C - bob(2)); ctx.scale(0.62, 0.62); FL_ART.bubbleDragon(ctx, 0, 0, t, { puff: 0.5, facing: -1 }); ctx.restore();
      FL_ART.rainbowSpider(ctx, 9720, C - bob(4), { t: t + 1, scale: 0.6, kind: 'rainbow', mood: 'dance', facing: 1 });
    }
  }
}
