'use strict';
// ================================================================ physics
function moveEntity(e, lv, dt) {
  const res = { ground: false, wall: false, head: false, bounced: false, smashed: false };
  const prevB = e.y + e.h;
  // horizontal
  e.x += e.vx * dt;
  for (const s of lv.solids) {
    if (s.broken || s.oneWay) continue;
    if (overlaps(e, s)) {
      if (s.breakable && e.isPlayer && e.superT > 0) { game.smashWall(s); res.smashed = true; continue; }
      // forgiving auto step-up: small ledges (~one block) don't stop a rolling wheel
      const depth = (e.y + e.h) - s.y;
      if (e.isPlayer && !s.bouncy && e.vy >= 0 && depth > 0 && depth <= 52) {
        e.y = s.y - e.h;
        continue;
      }
      if (e.vx > 0) e.x = s.x - e.w;
      else if (e.vx < 0) e.x = s.x + s.w;
      else e.x = (e.x + e.w / 2 < s.x + s.w / 2) ? s.x - e.w : s.x + s.w;
      res.wall = true; res.wallS = s;
    }
  }
  // vertical
  e.y += e.vy * dt;
  for (const s of lv.solids) {
    if (s.broken) continue;
    if (!overlaps(e, s)) continue;
    if (s.oneWay) {
      if (e.vy > 0 && prevB <= s.y + 12) {
        e.y = s.y - e.h;
        if (s.bouncy) { e.vy = -980; res.bounced = true; }
        else { e.vy = 0; res.ground = true; res.groundS = s; }
      }
      continue;
    }
    if (s.breakable && e.isPlayer && e.superT > 0) { game.smashWall(s); res.smashed = true; continue; }
    if (e.vy > 0) {
      e.y = s.y - e.h;
      if (s.bouncy) { e.vy = -980; res.bounced = true; }
      else { e.vy = 0; res.ground = true; res.groundS = s; }
    } else if (e.vy < 0) {
      e.y = s.y + s.h; e.vy = 0; res.head = true;
    }
  }
  return res;
}
function solidAtPoint(lv, x, y) {
  for (const s of lv.solids) {
    if (s.broken) continue;
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return s;
  }
  return null;
}

// ================================================================ player
class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 56; this.h = 94;
    this.vx = 0; this.vy = 0;
    this.isPlayer = true;
    this.onGround = false; this.facing = 1;
    this.power = 'none'; this.superT = 0;
    this.hearts = 3; this.inv = 0; this.cool = 0;
    this.spin = 0; this.squash = 1;
    this.mood = 'happy'; this.moodT = 0;
    this.duck = false; this.t = rand(10);
    this.coyote = 0; this.jbuf = 0;
    this.bubbleT = 0;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  setMood(m, t) { this.mood = m; this.moodT = t; }
  update(dt) {
    const lv = game.level;
    this.t += dt;
    this.inv = Math.max(0, this.inv - dt);
    this.cool = Math.max(0, this.cool - dt);
    this.squash = lerp(this.squash, 1, 1 - Math.exp(-9 * dt));
    if (this.superT > 0) {
      this.superT -= dt;
      if (this.superT <= 0) { this.superT = 0; AudioSys.sfx('switch'); }
      if (chance(0.4)) Particles.burst(this.cx, this.cy + 20, 1, { colors: RAINBOW, type: 'sparkle', sp1: 90, grav: -100, l1: 0.5, s1: 8, up: 0 });
    }
    if (this.moodT > 0) { this.moodT -= dt; if (this.moodT <= 0) this.mood = 'happy'; }
    const spd = this.superT > 0 ? 440 : 300;
    const ax = (keys.ArrowLeft ? -1 : 0) + (keys.ArrowRight ? 1 : 0);

    if (lv.water) {
      const ay = (keys.ArrowUp ? -1 : 0) + (keys.ArrowDown ? 1 : 0);
      this.vx += ax * 1400 * dt;
      this.vy += ay * 1400 * dt + 26 * dt;
      const dr = Math.exp(-2.4 * dt);
      this.vx *= dr; this.vy *= dr;
      const mx = spd * 0.85;
      this.vx = clamp(this.vx, -mx, mx); this.vy = clamp(this.vy, -mx, mx);
      if (ax) this.facing = ax;
      this.duck = false;
      this.bubbleT -= dt;
      if (this.bubbleT <= 0) {
        this.bubbleT = 0.25;
        Particles.burst(this.cx - this.facing * 20, this.y + 20, 1, { color: 'rgba(255,255,255,0.7)', type: 'bubble', sp1: 40, grav: -240, l0: 0.7, l1: 1.4, up: 0, s1: 9 });
      }
      moveEntity(this, lv, dt);
      this.spin += this.vx * dt / 30;
      this.x = clamp(this.x, 0, lv.w - this.w);
      this.y = clamp(this.y, 40, lv.h - this.h - 4);
    } else {
      if (ax) { this.vx = ax * spd; this.facing = ax; } else this.vx = 0;
      this.duck = !!keys.ArrowDown && this.onGround;
      if (this.duck) this.vx *= 0.5;
      if (this.onGround) this.coyote = 0.12; else this.coyote -= dt;
      if (justP.ArrowUp) this.jbuf = 0.14; else this.jbuf = Math.max(0, this.jbuf - dt);
      if (this.jbuf > 0 && this.coyote > 0) {
        this.jbuf = 0; this.coyote = 0;
        this.vy = this.superT > 0 ? -800 : -690;
        this.onGround = false;
        this.squash = 1.3;
        AudioSys.sfx('jump');
        Particles.burst(this.cx, this.y + this.h, 6, { colors: ['#fff', '#ffe9c9'], sp1: 130, l1: 0.35, grav: 250, up: 0, s1: 7 });
      }
      this.vy += 1600 * dt;
      if (this.vy > 950) this.vy = 950;
      const wasGround = this.onGround;
      const res = moveEntity(this, lv, dt);
      this.onGround = res.ground;
      if (res.bounced) { AudioSys.sfx('bounce'); this.squash = 1.45; }
      if (res.ground && !wasGround) {
        AudioSys.sfx('land'); this.squash = 0.72;
        Particles.burst(this.cx, this.y + this.h, 5, { colors: ['#fff'], sp1: 110, l1: 0.3, grav: 300, up: 10, s1: 6 });
      }
      this.spin += this.vx * dt / 30;
      this.x = clamp(this.x, 0, lv.w - this.w);
      if (res.ground) game.lastSafe = { x: this.x, y: this.y };
      // fell off the world
      if (this.y > lv.h + 220) {
        if (lv.fallCatch) game.startCloudCatch();
        else { this.damage(1); if (this.hearts > 0) game.softRespawn(); }
      }
    }
    if (justP.Space) this.action();
  }
  action() {
    if (this.cool > 0) return;
    if (this.power === 'none') {
      this.cool = 0.3; this.squash = 1.3;
      AudioSys.sfx('boing');
      Particles.burst(this.cx, this.y + this.h - 30, 6, { colors: ['#ffe14d', '#fff'], type: 'star', sp1: 150, l1: 0.4, s1: 8 });
      return;
    }
    this.cool = 0.34;
    // fire from wheel height so shots connect with ground spiders; crouching aims even lower
    const px = this.cx + this.facing * 34;
    const py = game.level.water ? this.cy : this.y + this.h - (this.duck ? 24 : 42);
    game.projectiles.push(new Projectile(px, py, this.facing, this.power));
    AudioSys.sfx(this.power);
    this.setMood('grin', 0.35);
    this.squash = 1.12;
  }
  damage(n) {
    if (this.inv > 0 || this.hearts <= 0) return;
    this.hearts -= n;
    this.inv = 2;
    this.setMood('surprised', 1.2);
    this.spin += 8;
    game.shake = Math.max(game.shake, 0.35);
    game.heartFlash = 1;
    AudioSys.sfx('hit');
    this.vy = Math.min(this.vy, -320);
    Particles.burst(this.cx, this.cy, 8, { colors: ['#fff', '#ffd24a'], type: 'star', sp1: 240, l1: 0.5, s1: 9 });
    if (this.hearts <= 0) game.die();
  }
  drawWheel(ctx, wx, wy, r) {
    const p = POW[this.power], n = 7, t = this.t;
    if (this.superT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.25 * Math.sin(t * 18);
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath(); ctx.arc(wx, wy - 18, r + 30, 0, TAU); ctx.fill();
      ctx.restore();
    }
    for (let i = 0; i < n; i++) {
      const a = this.spin + i * TAU / n;
      const bx = wx + Math.cos(a) * (r - 10), by = wy + Math.sin(a) * (r - 10);
      ctx.save();
      ctx.translate(bx, by); ctx.rotate(a);
      let col = i % 2 ? p.c : p.c2;
      if (this.superT > 0) col = RAINBOW[(i + Math.floor(t * 12)) % RAINBOW.length];
      else if (this.power === 'rainbow') col = RAINBOW[i % RAINBOW.length];
      ctx.fillStyle = col;
      rr(ctx, -11, -11, 22, 22, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(40,25,50,0.5)'; ctx.lineWidth = 2.5;
      rr(ctx, -11, -11, 22, 22, 5); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(wx, wy, 13, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#4a3a66'; ctx.lineWidth = 3; ctx.stroke();
    drawFace(ctx, wx, wy + 1, 21, this.superT > 0 ? 'grin' : 'happy', t, 7, this.facing, 0);
  }
  drawBoy(ctx, bx, by, mood) {
    const t = this.t;
    // arms
    ctx.strokeStyle = '#ffcf9f'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    const sw = Math.sin(t * 10) * (Math.abs(this.vx) > 10 ? 4 : 1.2);
    ctx.beginPath();
    ctx.moveTo(bx - 11, by + 33); ctx.lineTo(bx - 23, by + 42 + sw);
    ctx.moveTo(bx + 11, by + 33); ctx.lineTo(bx + 23, by + 42 - sw);
    ctx.stroke();
    // body
    ctx.fillStyle = '#ff5a5a'; rr(ctx, -15 + bx, by + 26, 30, 26, 9); ctx.fill();
    ctx.fillStyle = '#4a6cff'; rr(ctx, -14 + bx, by + 46, 28, 12, 5); ctx.fill();
    // head
    ctx.fillStyle = '#ffcf9f';
    ctx.beginPath(); ctx.arc(bx, by + 8, 19, 0, TAU); ctx.fill();
    // cap
    ctx.fillStyle = '#ffa62b';
    ctx.beginPath(); ctx.arc(bx, by + 6, 19.5, Math.PI, TAU); ctx.fill();
    rr(ctx, bx + (this.facing > 0 ? 4 : -26), by - 1, 22, 7, 3); ctx.fill();
    // face
    drawFace(ctx, bx, by + 13, 30, mood, t, 3, this.facing * 0.7 + this.vx / 500, this.vy / 1100);
  }
  draw(ctx) {
    ctx.save();
    if (this.inv > 0 && Math.floor(this.t * 14) % 2 === 0) ctx.globalAlpha = 0.35;
    const sq = clamp(this.squash, 0.6, 1.5);
    const baseY = this.y + this.h;
    ctx.translate(this.cx, baseY);
    ctx.scale(2 - sq, sq);
    ctx.translate(-this.cx, -baseY);
    const wx = this.cx, wy = this.y + this.h - 30;
    this.drawWheel(ctx, wx, wy, 30);
    this.drawBoy(ctx, wx, this.y + (this.duck ? 24 : 6), this.mood);
    ctx.restore();
  }
  drawSitting(ctx, x, y) { // used on the lose screen: boy on the ground, surprised
    ctx.save();
    ctx.translate(0, Math.sin(this.t * 2) * 2);
    this.drawBoy(ctx, x, y, 'surprised');
    ctx.restore();
  }
}

// ================================================================ projectile
class Projectile {
  constructor(cx, cy, dir, kind) {
    this.w = kind === 'rainbow' ? 40 : 30; this.h = this.w;
    this.x = cx - this.w / 2; this.y = cy - this.h / 2;
    this.dir = dir;
    this.vx = dir * (kind === 'rainbow' ? 380 : 540) * (game.level.water ? 0.75 : 1);
    this.kind = kind;
    this.life = 1.5; this.t = rand(10);
    this.dead = false;
    this.hitSet = new Set();
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt) {
    this.t += dt; this.life -= dt;
    this.x += this.vx * dt;
    if (this.kind === 'rainbow') this.y += Math.sin(this.t * 9) * 40 * dt;
    if (this.life <= 0) { this.impact(false); return; }
    // trail
    if (this.kind === 'fire') {
      Particles.burst(this.cx, this.cy, 1, { colors: game.level.water ? ['#cfe9ff'] : ['#ff9f43', '#ffe156'], type: game.level.water ? 'bubble' : 'flame', sp1: 40, grav: game.level.water ? -200 : -60, l1: 0.4, s1: 9, up: 0 });
    } else if (this.kind === 'ice') {
      Particles.burst(this.cx, this.cy, 1, { colors: ['#d6f4ff', '#7fd8ff'], type: 'sparkle', sp1: 40, grav: 60, l1: 0.4, s1: 7, up: 0 });
    } else if (this.kind === 'rainbow') {
      Particles.burst(this.cx, this.cy, 2, { colors: RAINBOW, type: 'circle', sp1: 30, grav: 0, l1: 0.5, s1: 8, up: 0 });
    }
    // rainbow bridges
    if (this.kind === 'rainbow') {
      for (const b of game.level.bridges) {
        if (!b.active && this.cx > b.x - 60 && this.cx < b.x + b.w + 60 && Math.abs(this.cy - b.y) < 150) {
          game.activateBridge(b);
          this.impact(true);
          return;
        }
      }
    }
    // solids
    for (const s of game.level.solids) {
      if (s.broken || s.oneWay) continue;
      if (overlaps(this, s)) { this.impact(true); return; }
    }
    if (this.x < -60 || this.x > game.level.w + 60) this.dead = true;
  }
  impact(burst) {
    this.dead = true;
    if (burst) {
      const cols = this.kind === 'fire' ? ['#ff9f43', '#ffe156'] : this.kind === 'ice' ? ['#d6f4ff', '#7fd8ff'] : RAINBOW;
      Particles.burst(this.cx, this.cy, 10, { colors: cols, type: 'star', sp1: 200, l1: 0.5, s1: 9 });
    }
  }
  draw(ctx) {
    const t = this.t;
    ctx.save();
    ctx.translate(this.cx, this.cy);
    if (this.kind === 'fire') {
      ctx.rotate(this.dir > 0 ? 0 : Math.PI);
      ctx.fillStyle = '#ff6b35';
      ctx.beginPath(); ctx.arc(0, 0, 14 + Math.sin(t * 25) * 2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(2, 0, 8, 0, TAU); ctx.fill();
    } else if (this.kind === 'ice') {
      ctx.rotate(t * 6);
      ctx.strokeStyle = '#e8faff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(13, 0); ctx.stroke();
      }
      ctx.fillStyle = '#7fd8ff';
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
    } else {
      ctx.rotate(t * 4);
      for (let i = RAINBOW.length - 1; i >= 0; i--) {
        ctx.fillStyle = RAINBOW[i];
        ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.arc(0, 0, 6 + i * 3, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

// ================================================================ spider
class Spider {
  // kinds: walk, jump, hang, swim
  constructor(x, y, kind = 'walk', opt = {}) {
    this.kind = kind;
    this.w = 58; this.h = 44;
    this.x = x - this.w / 2; this.y = y - this.h;
    this.x0 = this.x; this.y0 = this.y;
    this.vx = 0; this.vy = 0;
    this.state = 'angry'; // angry | frozen | friend | flying
    this.dir = chance(0.5) ? 1 : -1;
    this.range = opt.range || 150;
    this.webTop = opt.webTop ?? 0;
    this.t = rand(10);
    this.frozenT = 0; this.slideVx = 0;
    this.jumpT = rand(1, 2.2);
    this.dropped = false;
    this.followI = 0; this.danceT = 0;
    this.flyT = 0;
    this.dead = false;
    this.onGround = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt) {
    const lv = game.level, pl = game.player;
    this.t += dt;
    if (this.dead) return;

    if (this.state === 'flying') {
      this.flyT -= dt;
      this.vy += 1400 * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.flyT <= 0 || this.y > lv.h + 100) this.pop();
      return;
    }

    if (this.state === 'frozen') {
      this.frozenT -= dt;
      if (lv.water) {
        this.vy = Math.max(this.vy - 600 * dt, -170); // ice floats!
        this.y += this.vy * dt;
        if (this.y < 50) { this.y = 50; this.vy = 0; }
        this.x += this.slideVx * dt;
        this.slideVx *= Math.exp(-1.2 * dt);
      } else {
        this.vy += 1600 * dt;
        this.x += this.slideVx * dt;
        this.slideVx *= Math.exp(-0.5 * dt);
        const r = moveEntity(this, lv, dt);
        if (r.wall) { this.slideVx *= -0.6; AudioSys.sfx('slide'); }
      }
      // bumped by player -> slides
      if (overlaps(this, pl)) {
        const push = (pl.vx !== 0 ? pl.vx : pl.facing * 140) * 1.3 + pl.facing * 120;
        if (Math.abs(push) > Math.abs(this.slideVx)) { this.slideVx = push; AudioSys.sfx('slide'); }
      }
      // sliding ice cube knocks out other spiders
      if (Math.abs(this.slideVx) > 140) {
        for (const o of game.spiders) {
          if (o !== this && !o.dead && o.state === 'angry' && overlaps(this, o)) o.pop();
        }
      }
      if (this.frozenT <= 0) {
        this.state = 'angry';
        Particles.burst(this.cx, this.cy, 8, { colors: ['#d6f4ff'], type: 'sparkle', sp1: 150, l1: 0.4, s1: 7 });
      }
      return;
    }

    if (this.state === 'friend') {
      this.danceT -= dt;
      const far = Math.abs(pl.cx - this.cx) > 700;
      if (far) { this.x = pl.x - pl.facing * 90; this.y = pl.y; }
      const tx = pl.cx - pl.facing * (80 + 52 * (this.followI % 4)) - this.w / 2;
      this.x += (tx - this.x) * Math.min(1, 5 * dt);
      if (lv.water) {
        const ty = pl.cy - this.h / 2 + Math.sin(this.t * 4) * 16;
        this.y += (ty - this.y) * Math.min(1, 4 * dt);
      } else {
        this.vy += 1600 * dt;
        if (this.vy > 900) this.vy = 900;
        const r = moveEntity(this, lv, dt);
        this.onGround = r.ground;
        if (this.onGround && chance(1.2 * dt)) this.vy = -330; // happy hops
        if (this.y > lv.h + 150) { this.x = pl.x; this.y = pl.y - 60; this.vy = 0; }
      }
      if (chance(0.7 * dt)) {
        Particles.burst(this.cx, this.y - 8, 1, { colors: ['#ff8fb0'], type: 'heart', sp1: 50, grav: -120, l1: 0.9, s1: 9, up: 0 });
      }
      // friends convert angry spiders they touch
      for (const o of game.spiders) {
        if (o !== this && !o.dead && o.state === 'angry' && overlaps(this, o)) o.befriend();
      }
      return;
    }

    // ---- angry behaviors ----
    if (this.kind === 'walk' || this.dropped) {
      this.vx = this.dir * 62;
      this.vy += 1600 * dt;
      const r = moveEntity(this, lv, dt);
      this.onGround = r.ground;
      if (r.wall) this.dir *= -1;
      if (this.x < this.x0 - this.range) this.dir = 1;
      if (this.x > this.x0 + this.range) this.dir = -1;
      if (this.onGround) {
        const aheadX = this.dir > 0 ? this.x + this.w + 6 : this.x - 6;
        if (!solidAtPoint(lv, aheadX, this.y + this.h + 20)) this.dir *= -1;
      }
    } else if (this.kind === 'jump') {
      this.vy += 1600 * dt;
      const r = moveEntity(this, lv, dt);
      this.onGround = r.ground;
      if (this.onGround) {
        this.vx = 0;
        this.jumpT -= dt;
        if (this.jumpT <= 0 && Math.abs(pl.cx - this.cx) < 430) {
          this.dir = pl.cx > this.cx ? 1 : -1;
          this.vy = -540; this.vx = this.dir * 180;
          this.jumpT = rand(1.5, 2.4);
        }
      }
    } else if (this.kind === 'hang') {
      this.y = this.y0 + Math.sin(this.t * 2) * 14;
      if (Math.abs(pl.cx - this.cx) < 140 && pl.y > this.y) {
        this.dropped = true;
        this.kind = 'walk';
        this.x0 = this.x;
        AudioSys.sfx('whoosh');
      }
    } else if (this.kind === 'swim') {
      this.y = clamp(this.y0 + Math.sin(this.t * 1.6) * 34, 50, lv.h - this.h - 10);
      const dx = pl.cx - this.cx, dy = pl.cy - this.cy;
      if (Math.abs(dx) < 380) {
        this.x += Math.sign(dx) * 52 * dt;
        this.y0 += clamp(dy, -60, 60) * dt * 0.6;
        this.dir = Math.sign(dx) || this.dir;
      } else {
        this.x += this.dir * 40 * dt;
        if (this.x < this.x0 - this.range) this.dir = 1;
        if (this.x > this.x0 + this.range) this.dir = -1;
      }
    }
  }
  hit(kind) {
    if (this.dead || this.state === 'friend' || this.state === 'flying') return false;
    if (kind === 'fire') {
      if (this.state === 'frozen') AudioSys.sfx('shatter');
      this.pop();
      return true;
    }
    if (kind === 'ice') {
      if (this.state !== 'frozen') {
        this.state = 'frozen'; this.frozenT = 5; this.slideVx = 0; this.vy = 0;
        AudioSys.sfx('freeze');
        Particles.burst(this.cx, this.cy, 10, { colors: ['#d6f4ff', '#fff'], type: 'sparkle', sp1: 170, l1: 0.5, s1: 8 });
      }
      return true;
    }
    if (kind === 'rainbow') {
      if (this.state !== 'frozen') this.befriend();
      return false; // rainbow passes through, can befriend several
    }
    return false;
  }
  befriend() {
    if (this.state === 'friend' || this.dead) return;
    this.state = 'friend';
    this.kind = this.kind === 'swim' ? 'swim' : 'walk';
    this.followI = game.friendCount++;
    this.danceT = 1.4;
    this.vy = -260;
    AudioSys.sfx('friend');
    Particles.burst(this.cx, this.cy, 14, { colors: ['#ff8fb0', '#ffd24a', '#fff'], type: 'heart', sp1: 220, l1: 1, s1: 11 });
  }
  knockAway(fromX) {
    if (this.state === 'friend' || this.dead) return;
    this.state = 'flying';
    this.flyT = 0.8;
    this.vx = (this.cx >= fromX ? 1 : -1) * 420;
    this.vy = -420;
    AudioSys.sfx('poof');
  }
  pop() {
    if (this.dead) return;
    this.dead = true;
    AudioSys.sfx('poof');
    Particles.burst(this.cx, this.cy, 12, { colors: ['#b06cf0', '#fff', '#ffe156'], type: 'star', sp1: 260, l1: 0.7, s1: 10 });
    // candy reward pops out
    if (chance(0.75)) {
      const c = new Pickup(this.cx, this.cy, 'candy');
      c.vx = rand(-140, 140); c.vy = -380; c.physics = true;
      game.pickups.push(c);
    }
  }
  draw(ctx) {
    if (this.dead) return;
    const t = this.t, friend = this.state === 'friend';
    const cx = this.cx, cy = this.cy;
    ctx.save();
    if (this.state === 'flying') { ctx.translate(cx, cy); ctx.rotate(t * 14); ctx.translate(-cx, -cy); }
    if (friend && this.danceT > 0) { ctx.translate(cx, cy); ctx.rotate(Math.sin(t * 16) * 0.4); ctx.translate(-cx, -cy); }
    // web line
    if (this.kind === 'hang' && !this.dropped) {
      ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(cx, this.webTop); ctx.lineTo(cx, this.y + 8); ctx.stroke();
    }
    // legs
    const legCol = friend ? '#d6559a' : '#4a2a6a';
    ctx.strokeStyle = legCol; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const ph = Math.sin(t * 9 + i * 1.6) * 5;
      for (const sd of [-1, 1]) {
        const lx = cx + sd * (14 + i * 5);
        ctx.beginPath();
        ctx.moveTo(cx + sd * 12, cy + 4);
        ctx.quadraticCurveTo(lx + sd * 8, cy - 4 + ph, lx + sd * 6, this.y + this.h + ph * 0.5);
        ctx.stroke();
      }
    }
    // body
    const g = ctx.createRadialGradient(cx - 6, cy - 8, 4, cx, cy, 32);
    if (friend) { g.addColorStop(0, '#ff9fd0'); g.addColorStop(1, '#f060a8'); }
    else { g.addColorStop(0, '#9a6ad0'); g.addColorStop(1, '#6a3aa0'); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx, cy, 27, 21, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = legCol; ctx.lineWidth = 3; ctx.stroke();
    // bow for friends
    if (friend) {
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath(); ctx.moveTo(cx - 4, this.y + 4);
      ctx.lineTo(cx - 16, this.y - 4); ctx.lineTo(cx - 14, this.y + 10); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 4, this.y + 4);
      ctx.lineTo(cx + 16, this.y - 4); ctx.lineTo(cx + 14, this.y + 10); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, this.y + 4, 4, 0, TAU); ctx.fill();
    }
    // face
    drawFace(ctx, cx, cy + 2, 34, friend ? 'happy' : 'angry', t, this.x0, this.dir, 0);
    // goofy fangs
    if (!friend) {
      ctx.fillStyle = '#fff';
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + sd * 7, cy + 12); ctx.lineTo(cx + sd * 4, cy + 18); ctx.lineTo(cx + sd * 1.5, cy + 12);
        ctx.closePath(); ctx.fill();
      }
    }
    // bubble helmet for swimmers
    if (this.kind === 'swim' && this.state !== 'frozen') {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy - 2, 30, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.arc(cx, cy - 2, 30, 0, TAU); ctx.fill();
    }
    // ice cube
    if (this.state === 'frozen') {
      ctx.fillStyle = 'rgba(160,225,255,0.55)';
      rr(ctx, this.x - 8, this.y - 12, this.w + 16, this.h + 20, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(220,245,255,0.9)'; ctx.lineWidth = 3;
      rr(ctx, this.x - 8, this.y - 12, this.w + 16, this.h + 20, 8); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(this.x, this.y - 4); ctx.lineTo(this.x + 12, this.y - 8); ctx.stroke();
    }
    ctx.restore();
  }
}

// ================================================================ pickups
class Pickup {
  // kinds: fire, ice, rainbow, power, heart, candy
  constructor(cx, cy, kind) {
    this.kind = kind;
    const s = kind === 'candy' ? 26 : kind === 'heart' ? 36 : 54;
    this.w = s; this.h = s;
    this.x = cx - s / 2; this.y = cy - s / 2;
    this.t = rand(10);
    this.dead = false;
    this.physics = false; this.vx = 0; this.vy = 0;
    this.bossKind = null; this.respawnT = 0;
    this.candyShape = randi(0, 2);
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt) {
    this.t += dt;
    if (this.dead) {
      if (this.bossKind) {
        this.respawnT -= dt;
        if (this.respawnT <= 0 && game.player.power !== this.bossKind) {
          this.dead = false;
          Particles.burst(this.cx, this.cy, 8, { colors: ['#fff'], type: 'sparkle', sp1: 120, l1: 0.4, s1: 8 });
        }
      }
      return;
    }
    if (this.physics && !game.level.water) {
      this.vy += 1300 * dt;
      const r = moveEntity(this, game.level, dt);
      if (r.ground) { this.vx *= 0.8; this.physics = Math.abs(this.vx) > 5; }
      if (this.y > game.level.h + 100) this.dead = true;
    }
    if (overlaps(this, game.player)) this.collect();
  }
  collect() {
    this.dead = true;
    const pl = game.player;
    if (this.bossKind) this.respawnT = 3;
    if (this.kind === 'candy') {
      game.candy++;
      AudioSys.sfx('candy');
      Particles.burst(this.cx, this.cy, 5, { colors: ['#ffd24a', '#fff'], type: 'sparkle', sp1: 130, l1: 0.4, s1: 8 });
      return;
    }
    if (this.kind === 'heart') {
      pl.hearts = Math.min(3, pl.hearts + 1);
      game.heartFlash = 1;
      AudioSys.sfx('heart');
      Particles.burst(this.cx, this.cy, 10, { colors: ['#ff7d92', '#fff'], type: 'heart', sp1: 180, l1: 0.7, s1: 10 });
      return;
    }
    if (this.kind === 'power') {
      pl.superT = 6;
      AudioSys.sfx('powerup');
      game.shake = Math.max(game.shake, 0.2);
      Particles.burst(this.cx, this.cy, 18, { colors: ['#ffe14d', '#fff', '#ffa726'], type: 'star', sp1: 320, l1: 0.8, s1: 12 });
    } else {
      pl.power = this.kind;
      AudioSys.sfx('collect');
      const p = POW[this.kind];
      Particles.burst(this.cx, this.cy, 14, { colors: this.kind === 'rainbow' ? RAINBOW : [p.c, p.glow, '#fff'], type: 'star', sp1: 260, l1: 0.7, s1: 11 });
    }
    game.hudPulse = 1;
    pl.setMood('grin', 0.8);
    pl.squash = 1.25;
  }
  draw(ctx) {
    if (this.dead) return;
    const bob = Math.sin(this.t * 3) * 5;
    const cx = this.cx, cy = this.cy + bob;
    if (this.kind === 'candy') {
      drawCandy(ctx, cx, cy, 22, this.candyShape, this.t);
      return;
    }
    if (this.kind === 'heart') {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(this.t * 5);
      ctx.fillStyle = '#ff9fb5';
      ctx.beginPath(); ctx.arc(cx, cy, 30, 0, TAU); ctx.fill();
      ctx.restore();
      drawHeartIcon(ctx, cx, cy, 30, true, this.t);
      return;
    }
    // block glow halo
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(this.t * 4);
    ctx.fillStyle = POW[this.kind].glow;
    ctx.beginPath(); ctx.arc(cx, cy, 44, 0, TAU); ctx.fill();
    ctx.restore();
    drawBlock(ctx, cx - this.w / 2, cy - this.h / 2, this.w, this.kind, this.t, { wobble: true, seed: this.x });
    if (this.kind === 'rainbow' && chance(0.1)) {
      Particles.burst(cx + rand(-24, 24), cy + rand(-24, 24), 1, { colors: RAINBOW, type: 'sparkle', sp1: 20, grav: -60, l1: 0.6, s1: 7, up: 0 });
    }
  }
}

// ================================================================ checkpoint & gate
class Checkpoint {
  constructor(x, groundY) {
    this.x = x; this.y = groundY - 110;
    this.w = 20; this.h = 110;
    this.groundY = groundY;
    this.reached = false;
    this.t = rand(10);
  }
  update(dt) {
    this.t += dt;
    const vReach = game.level.water ? 420 : 160;
    if (!this.reached && Math.abs(game.player.cx - this.x) < 60 && Math.abs(game.player.y + game.player.h - this.groundY) < vReach) {
      this.reached = true;
      game.checkpoint = this;
      game.player.hearts = 3;
      game.heartFlash = 1;
      AudioSys.sfx('checkpoint');
      Particles.burst(this.x, this.y + 20, 16, { colors: ['#ffe156', '#57d357', '#fff'], type: 'star', sp1: 260, l1: 0.8, s1: 10 });
    }
  }
  draw(ctx) {
    const t = this.t;
    ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(this.x, this.groundY); ctx.lineTo(this.x, this.y); ctx.stroke();
    ctx.save();
    ctx.translate(this.x, this.y);
    const wave = Math.sin(t * 4) * 0.12;
    ctx.rotate(wave);
    const col = this.reached ? '#57d357' : '#ffd24a';
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(52, 14); ctx.lineTo(0, 30);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,25,50,0.5)'; ctx.lineWidth = 2.5; ctx.stroke();
    drawFace(ctx, 18, 15, 18, this.reached ? 'happy' : 'sleepy', t, this.x);
    ctx.restore();
  }
}

class Gate {
  constructor(x, groundY) {
    this.x = x - 45; this.y = groundY - 130;
    this.w = 90; this.h = 130;
    this.t = rand(10);
  }
  get cx() { return this.x + this.w / 2; }
  update(dt) {
    this.t += dt;
    if (chance(0.12)) {
      Particles.burst(this.cx + rand(-40, 40), this.y + rand(0, this.h), 1, { colors: ['#ffe156', '#fff'], type: 'sparkle', sp1: 30, grav: -80, l1: 0.7, s1: 8, up: 0 });
    }
    if (overlaps(this, game.player)) game.levelComplete();
  }
  draw(ctx) {
    const t = this.t, cx = this.cx, cy = this.y + this.h / 2;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3);
    ctx.fillStyle = '#ffe156';
    ctx.beginPath(); ctx.ellipse(cx, cy, 60, 80, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 1.2);
    ctx.fillStyle = '#ffd24a';
    starPath(ctx, 0, 0, 46, 20);
    ctx.fill();
    ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 4; ctx.stroke();
    ctx.rotate(-t * 1.2);
    drawFace(ctx, 0, 0, 34, 'happy', t, 99);
    ctx.restore();
  }
}

// ================================================================ zombie boss
class Zombie {
  constructor(x, groundY) {
    this.w = 110; this.h = 170;
    this.x = x; this.y = groundY - this.h;
    this.groundY = groundY;
    this.vx = 0; this.vy = 0;
    this.hp = 3;
    this.state = 'enter';
    this.st = 0; this.t = rand(10);
    this.facing = -1;
    this.hits = 0;
    this.flashT = 0;
    this.throwT = 2;
    this.shoeLost = false;
    this.hopT = 0;
    this.wrongT = 0;
    this.onGround = true;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt) {
    const lv = game.level, pl = game.player;
    this.t += dt; this.st += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    this.wrongT = Math.max(0, this.wrongT - dt);
    const arenaL = game.arenaL, arenaR = game.arenaR;
    switch (this.state) {
      case 'chase': {
        const speed = game.bossStage === 2 ? 120 : 66;
        this.facing = pl.cx > this.cx ? 1 : -1;
        this.vx = this.facing * speed;
        this.vy += 1600 * dt;
        if (game.bossStage === 2) {
          this.hopT -= dt;
          if (this.hopT <= 0 && this.y + this.h >= this.groundY - 4) { this.vy = -380; this.hopT = rand(1.2, 2); }
        }
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (this.y + this.h > this.groundY) { this.y = this.groundY - this.h; this.vy = 0; }
        this.x = clamp(this.x, arenaL, arenaR - this.w);
        // throw shoes in stage 1
        if (game.bossStage === 1) {
          this.throwT -= dt;
          if (this.throwT <= 0) {
            this.throwT = rand(2.6, 3.6);
            this.shoeLost = true;
            const dx = pl.cx - this.cx;
            game.shoes.push(new Shoe(this.cx + this.facing * 40, this.y + 60, clamp(dx * 1.1, -420, 420), -430));
            AudioSys.sfx('whoosh');
          }
        }
        // contact damage
        if (overlaps(this, pl)) pl.damage(1);
        break;
      }
      case 'dizzy':
        if (this.st > 2.2) this.setState('chase');
        break;
      case 'frozen':
        if (this.st > 0.7) {
          this.setState('slide');
          this.vx = (pl.cx > this.cx ? -1 : 1) * 640;
          AudioSys.sfx('slide');
        }
        break;
      case 'slide':
        this.x += this.vx * dt;
        if (chance(0.5)) Particles.burst(this.cx, this.y + this.h, 1, { colors: ['#d6f4ff'], type: 'sparkle', sp1: 60, l1: 0.4, s1: 7, up: 20 });
        if (this.x <= arenaL || this.x + this.w >= arenaR) {
          this.x = clamp(this.x, arenaL, arenaR - this.w);
          this.setState('crash');
          game.shake = 0.6;
          AudioSys.sfx('crash');
          Particles.burst(this.cx, this.cy, 20, { colors: ['#d6f4ff', '#fff'], type: 'star', sp1: 380, l1: 0.8, s1: 12 });
          this.loseHeart();
        }
        break;
      case 'crash':
        if (this.st > 2) this.setState('chase');
        break;
      case 'rainbowing':
        Particles.burst(this.cx + rand(-50, 50), this.y + rand(0, this.h), 2, { colors: RAINBOW, type: 'sparkle', sp1: 80, grav: -120, l1: 0.7, s1: 10, up: 0 });
        if (this.st > 2.5) {
          this.setState('friend');
          this.loseHeart();
          AudioSys.sfx('friend');
          Particles.burst(this.cx, this.cy, 26, { colors: ['#ff8fb0', '#ffd24a', '#fff'], type: 'heart', sp1: 340, l1: 1.1, s1: 13 });
          game.startEnding();
        }
        break;
      case 'friend':
        break;
    }
  }
  setState(s) { this.state = s; this.st = 0; }
  loseHeart() {
    this.hp--;
    game.shake = Math.max(game.shake, 0.5);
    AudioSys.sfx('thud');
    Particles.burst(this.cx, this.y - 20, 12, { colors: ['#ff7d92', '#fff'], type: 'heart', sp1: 300, l1: 0.8, s1: 12 });
    if (this.hp === 2) { this.setState('dizzy'); game.setBossStage(2); }
    else if (this.hp === 1) { this.setState('dizzy'); game.setBossStage(3); }
  }
  hitBy(kind) {
    if (this.state === 'friend' || this.state === 'rainbowing') return;
    const need = game.bossStage === 1 ? 'fire' : game.bossStage === 2 ? 'ice' : 'rainbow';
    if (kind !== need) {
      this.wrongT = 2;
      AudioSys.sfx('boing');
      return;
    }
    if (game.bossStage === 1 && this.state === 'chase') {
      this.hits++;
      this.flashT = 0.25;
      this.x += (game.player.cx > this.cx ? -1 : 1) * 26;
      AudioSys.sfx('poof');
      Particles.burst(this.cx, this.cy, 10, { colors: ['#ff9f43', '#ffe156'], type: 'star', sp1: 260, l1: 0.6, s1: 10 });
      if (this.hits >= 3) { this.hits = 0; this.loseHeart(); }
    } else if (game.bossStage === 2 && (this.state === 'chase' || this.state === 'dizzy')) {
      this.setState('frozen');
      AudioSys.sfx('freeze');
      Particles.burst(this.cx, this.cy, 16, { colors: ['#d6f4ff', '#fff'], type: 'sparkle', sp1: 280, l1: 0.7, s1: 11 });
    } else if (game.bossStage === 3 && (this.state === 'chase' || this.state === 'dizzy')) {
      this.setState('rainbowing');
      AudioSys.sfx('rainbow');
    }
  }
  draw(ctx) {
    const t = this.t;
    const friend = this.state === 'friend';
    const frozen = this.state === 'frozen' || this.state === 'slide';
    const x = this.x, y = this.y, w = this.w, h = this.h, cx = this.cx;
    ctx.save();
    if (this.flashT > 0 && Math.floor(t * 20) % 2 === 0) ctx.globalAlpha = 0.5;
    let bob = Math.sin(t * 5) * 3;
    if (this.state === 'roar') { ctx.translate(cx, y + h); ctx.scale(1.12, 1.18 + Math.sin(t * 30) * 0.02); ctx.translate(-cx, -(y + h)); }
    if (this.state === 'hiccup') ctx.translate(0, -Math.abs(Math.sin(this.st * 18)) * 20);
    if (this.state === 'trip') { ctx.translate(cx, y + h); ctx.rotate(Math.min(1, this.st * 2.5) * 1.35); ctx.translate(-cx, -(y + h)); }
    if (this.state === 'getup') { ctx.translate(cx, y + h); ctx.rotate((1 - Math.min(1, this.st * 1.5)) * 1.35); ctx.translate(-cx, -(y + h)); }
    if (friend) bob = Math.abs(Math.sin(t * 6)) * -12;
    if (this.state === 'dance') bob = Math.abs(Math.sin(t * 7)) * -16;
    ctx.translate(0, bob);
    const bodyC = friend || this.state === 'dance' ? '#9fe06a' : '#7fbf4d';
    const darkC = '#5a9635';
    // legs / feet
    const step = Math.sin(t * 6) * 5;
    ctx.fillStyle = '#4a3a2a';
    rr(ctx, cx - 34, y + h - 18 + step * 0.4, 30, 18, 6); ctx.fill();
    if (this.shoeLost) {
      ctx.fillStyle = '#ff5a5a';
      rr(ctx, cx + 6, y + h - 16 - step * 0.4, 26, 16, 6); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx + 8, y + h - 12 - step * 0.4, 22, 3);
    } else {
      ctx.fillStyle = '#4a3a2a';
      rr(ctx, cx + 4, y + h - 18 - step * 0.4, 30, 18, 6); ctx.fill();
    }
    // body
    ctx.fillStyle = bodyC;
    rr(ctx, x + 12, y + 52, w - 24, h - 70, 20); ctx.fill();
    ctx.strokeStyle = darkC; ctx.lineWidth = 3;
    rr(ctx, x + 12, y + 52, w - 24, h - 70, 20); ctx.stroke();
    // tattered shirt
    ctx.fillStyle = '#8a5fd0';
    ctx.beginPath();
    ctx.moveTo(x + 14, y + 70); ctx.lineTo(x + w - 14, y + 70);
    ctx.lineTo(x + w - 14, y + 108);
    for (let i = 0; i < 5; i++) ctx.lineTo(x + w - 14 - (i + 0.5) * (w - 28) / 5, y + 108 + (i % 2 ? 0 : 14));
    ctx.lineTo(x + 14, y + 108);
    ctx.closePath(); ctx.fill();
    // patches
    ctx.fillStyle = darkC;
    ctx.beginPath(); ctx.arc(x + 30, y + 125, 7, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w - 32, y + 138, 5, 0, TAU); ctx.fill();
    // arms stretched forward
    const armY = y + 78, wob = Math.sin(t * 4) * 6;
    ctx.strokeStyle = bodyC; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 26, armY); ctx.lineTo(cx + this.facing * 66, armY - 8 + wob);
    ctx.moveTo(cx + 26, armY + 6); ctx.lineTo(cx + this.facing * 70, armY + 14 - wob);
    ctx.stroke();
    ctx.fillStyle = bodyC;
    ctx.beginPath(); ctx.arc(cx + this.facing * 70, armY - 8 + wob, 11, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + this.facing * 74, armY + 14 - wob, 11, 0, TAU); ctx.fill();
    // head (tilted)
    ctx.save();
    ctx.translate(cx, y + 30);
    ctx.rotate(friend ? Math.sin(t * 3) * 0.08 : 0.12 * this.facing);
    ctx.fillStyle = bodyC;
    rr(ctx, -40, -34, 80, 68, 18); ctx.fill();
    ctx.strokeStyle = darkC; ctx.lineWidth = 3;
    rr(ctx, -40, -34, 80, 68, 18); ctx.stroke();
    // hair strands
    ctx.strokeStyle = darkC; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(i * 12, -34); ctx.quadraticCurveTo(i * 16, -46, i * 20 + 4, -44); ctx.stroke();
    }
    if (this.state === 'dizzy' || this.state === 'crash') {
      drawFace(ctx, 0, 4, 52, 'dizzy', t, 5);
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + i * TAU / 3;
        ctx.fillStyle = '#ffe156';
        starPath(ctx, Math.cos(a) * 46, -40 + Math.sin(a) * 10, 8, 4);
        ctx.fill();
      }
    } else if (friend || this.state === 'dance') {
      drawFace(ctx, 0, 4, 52, 'grin', t, 5);
      ctx.fillStyle = 'rgba(255,120,150,0.5)';
      ctx.beginPath(); ctx.arc(-22, 12, 6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(22, 12, 6, 0, TAU); ctx.fill();
    } else {
      // goofy mismatched eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-14, -6, 13, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(15, -2, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a2a3a';
      ctx.beginPath(); ctx.arc(-14 + this.facing * 4, -6, 6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(15 + this.facing * 2, -2, 3.5, 0, TAU); ctx.fill();
      // droopy lid
      ctx.fillStyle = bodyC;
      ctx.beginPath(); ctx.arc(15, -2, 8.5, Math.PI, Math.PI + 2.2); ctx.lineTo(15, -2); ctx.closePath(); ctx.fill();
      // stitched crooked smile
      ctx.strokeStyle = '#3a2a3a'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(-20, 18); ctx.quadraticCurveTo(0, 26, 22, 14); ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const sx = -14 + i * 11;
        ctx.beginPath(); ctx.moveTo(sx, 14 + i); ctx.lineTo(sx + 3, 24 + i); ctx.stroke();
      }
    }
    ctx.restore();
    // frozen cube
    if (frozen) {
      ctx.fillStyle = 'rgba(160,225,255,0.55)';
      rr(ctx, x - 12, y - 14, w + 24, h + 20, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(220,245,255,0.9)'; ctx.lineWidth = 4;
      rr(ctx, x - 12, y - 14, w + 24, h + 20, 12); ctx.stroke();
    }
    ctx.restore();
    // boss hearts
    if (!friend && game.bossStage > 0 && this.state !== 'rainbowing' && this.state !== 'dance') {
      for (let i = 0; i < 3; i++) {
        drawHeartIcon(ctx, cx - 44 + i * 44, y - 46 + Math.sin(t * 3 + i) * 3, 26, i < this.hp, t + i);
      }
    }
    // "wrong power" hint bubble
    if (this.wrongT > 0 && game.bossStage > 0) {
      const need = game.bossStage === 1 ? 'fire' : game.bossStage === 2 ? 'ice' : 'rainbow';
      const hy = y - 110 + Math.sin(t * 6) * 6;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath(); ctx.arc(cx, hy, 40, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 10, hy + 36); ctx.lineTo(cx, hy + 58); ctx.lineTo(cx + 12, hy + 34);
      ctx.closePath(); ctx.fill();
      drawBlock(ctx, cx - 26, hy - 26, 52, need, t);
    }
  }
}

// ================================================================ shoe (boss projectile)
class Shoe {
  constructor(x, y, vx, vy) {
    this.w = 34; this.h = 24;
    this.x = x - 17; this.y = y - 12;
    this.vx = vx; this.vy = vy;
    this.t = 0; this.dead = false;
    this.bounces = 0; this.restT = 0;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt) {
    this.t += dt;
    if (this.restT > 0) {
      this.restT -= dt;
      if (this.restT <= 0) {
        this.dead = true;
        Particles.burst(this.cx, this.cy, 6, { colors: ['#8a5a3a'], sp1: 120, l1: 0.4, s1: 6 });
      }
      return;
    }
    this.vy += 1300 * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    const gy = game.zombie ? game.zombie.groundY : 620;
    if (this.y + this.h > gy) {
      this.y = gy - this.h;
      this.bounces++;
      if (this.bounces >= 2) { this.vx = 0; this.vy = 0; this.restT = 0.8; }
      else { this.vy *= -0.5; this.vx *= 0.7; AudioSys.sfx('land'); }
    }
    if (overlaps(this, game.player)) {
      game.player.damage(1);
      this.dead = true;
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.cx, this.cy);
    if (this.restT <= 0) ctx.rotate(this.t * 9);
    ctx.fillStyle = '#8a5a3a';
    rr(ctx, -16, -6, 32, 14, 5); ctx.fill();
    rr(ctx, -16, -12, 16, 12, 5); ctx.fill();
    ctx.fillStyle = '#5a3a22';
    rr(ctx, -16, 4, 32, 5, 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(-4, -4); ctx.moveTo(-4, -8); ctx.lineTo(-10, -4); ctx.stroke();
    ctx.restore();
  }
}

// ================================================================ treasure chest
class Chest {
  constructor(cx, groundY) {
    this.w = 150; this.h = 110;
    this.x = cx - this.w / 2;
    this.y = -200;
    this.targetY = groundY - this.h;
    this.landed = false;
    this.open = false;
    this.t = 0;
    this.openT = 0;
  }
  get cx() { return this.x + this.w / 2; }
  update(dt) {
    this.t += dt;
    if (!this.landed) {
      this.y += 900 * dt;
      if (this.y >= this.targetY) {
        this.y = this.targetY;
        this.landed = true;
        game.shake = 0.5;
        AudioSys.sfx('thud');
        Particles.burst(this.cx, this.y + this.h, 16, { colors: ['#c9a96a', '#fff'], sp1: 260, l1: 0.6, s1: 9 });
      }
      return;
    }
    if (this.open) {
      this.openT += dt;
      if (this.openT < 2.6 && chance(0.85)) Particles.candyBurst(this.cx, this.y + 30, 2);
    }
  }
  tryOpen() {
    if (!this.landed || this.open) return false;
    if (Math.abs(game.player.cx - this.cx) < 150) {
      this.open = true;
      AudioSys.sfx('chest');
      game.shake = 0.4;
      Particles.candyBurst(this.cx, this.y + 20, 26);
      return true;
    }
    return false;
  }
  draw(ctx) {
    const t = this.t;
    ctx.save();
    // glow
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 3);
    ctx.fillStyle = '#ffe156';
    ctx.beginPath(); ctx.arc(this.cx, this.y + this.h / 2, 110, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    if (this.open) {
      // light beam
      const g = ctx.createLinearGradient(0, this.y - 240, 0, this.y + 40);
      g.addColorStop(0, 'rgba(255,240,150,0)');
      g.addColorStop(1, 'rgba(255,230,120,0.75)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(this.cx - 30, this.y + 30); ctx.lineTo(this.cx - 90, this.y - 240);
      ctx.lineTo(this.cx + 90, this.y - 240); ctx.lineTo(this.cx + 30, this.y + 30);
      ctx.closePath(); ctx.fill();
    }
    // base
    ctx.fillStyle = '#9a6232';
    rr(ctx, this.x, this.y + 34, this.w, this.h - 34, 12); ctx.fill();
    ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 4;
    rr(ctx, this.x, this.y + 34, this.w, this.h - 34, 12); ctx.stroke();
    // gold bands
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(this.x + 18, this.y + 34, 14, this.h - 34);
    ctx.fillRect(this.x + this.w - 32, this.y + 34, 14, this.h - 34);
    // lid
    ctx.save();
    if (this.open) {
      ctx.translate(this.x + 6, this.y + 40);
      ctx.rotate(-Math.min(1, this.openT * 3) * 2.2);
      ctx.translate(-(this.x + 6), -(this.y + 40));
    }
    ctx.fillStyle = '#b0743e';
    rr(ctx, this.x - 4, this.y, this.w + 8, 44, 16); ctx.fill();
    ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 4;
    rr(ctx, this.x - 4, this.y, this.w + 8, 44, 16); ctx.stroke();
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(this.x + 18, this.y, 14, 44);
    ctx.fillRect(this.x + this.w - 32, this.y, 14, 44);
    ctx.restore();
    // lock with face
    ctx.fillStyle = '#ffd24a';
    rr(ctx, this.cx - 16, this.y + 26, 32, 34, 8); ctx.fill();
    ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 3;
    rr(ctx, this.cx - 16, this.y + 26, 32, 34, 8); ctx.stroke();
    drawFace(ctx, this.cx, this.y + 43, 20, this.open ? 'grin' : 'happy', t, 42);
    // candy pile inside when open
    if (this.open) {
      for (let i = 0; i < 5; i++) {
        drawCandy(ctx, this.x + 26 + i * 25, this.y + 32 - (i % 2) * 10, 17, i, t + i);
      }
    }
    ctx.restore();
  }
}
