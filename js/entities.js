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
        if (s.bouncy) { e.vy = s.bounceVy || -980; if (s.bounceVx) { e.vx = s.bounceVx; e.launchT = 1.3; } res.bounced = true; }
        else { e.vy = 0; res.ground = true; res.groundS = s; }
      }
      continue;
    }
    if (s.breakable && e.isPlayer && e.superT > 0) { game.smashWall(s); res.smashed = true; continue; }
    if (e.vy > 0) {
      e.y = s.y - e.h;
      if (s.bouncy) { e.vy = s.bounceVy || -980; if (s.bounceVx) { e.vx = s.bounceVx; e.launchT = 1.3; } res.bounced = true; }
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
    this.vehicle = 'wheel'; // 'wheel' | 'truck' | 'unicorn'
    this.turboT = 0; this.airT = 0; this.rot = 0;
    this.rampCd = 0; this.dustT = 0;
    this.flapCd = 0; this.flapT = 0; this.launchT = 0;
  }
  boardUnicorn() {
    if (this.vehicle === 'unicorn') return;
    this.vehicle = 'unicorn';
    const grow = 112 - this.w;
    this.x -= grow / 2; this.w = 112;
    this.y -= 98 - this.h; this.h = 98;
    AudioSys.sfx('neigh');
    AudioSys.sfx('collect');
    this.setMood('grin', 1.5);
    Particles.burst(this.cx, this.cy, 26, { colors: RAINBOW.concat(['#fff']), type: 'sparkle', sp1: 340, l1: 1, s1: 11, grav: 250 });
  }
  boardTruck() {
    if (this.vehicle === 'truck') return;
    this.vehicle = 'truck';
    const grow = 104 - this.w;
    this.x -= grow / 2; this.w = 104;
    this.y -= 96 - this.h; this.h = 96;
    AudioSys.sfx('powerup');
    AudioSys.sfx('rev');
    game.shake = Math.max(game.shake, 0.2);
    this.setMood('grin', 1.5);
    Particles.burst(this.cx, this.cy, 22, { colors: ['#f8b53c', '#d98f1f', '#ffe156', '#fff'], type: 'block', sp1: 360, l1: 1, s1: 12, grav: 800 });
  }
  checkHazards(lv) {
    // rising lava (Volcano Escape): same rule as pools — one heart, then a big
    // mercy bounce upward and 2s of invulnerability to climb clear
    if (lv.risingLava && this.y + this.h > lv.risingLava.y) {
      if (this.inv <= 0) this.damage(1);
      this.vy = -940;
      this.setMood('surprised', 1);
      AudioSys.sfx('steam');
      Particles.burst(this.cx, this.y + this.h, 12, { colors: ['#ff9f43', '#ffe156', '#fff'], type: 'flame', sp1: 220, grav: -80, l1: 0.6, s1: 11 });
    }
    // lava is HOT: bounce out with a yelp (invulnerability prevents a drain)
    if (lv.lava && this.y + this.h > 648) {
      for (const L of lv.lava) {
        if (this.cx > L.x && this.cx < L.x + L.w) {
          if (this.inv <= 0) this.damage(1);
          this.vy = -800;
          this.setMood('surprised', 1);
          AudioSys.sfx('steam');
          Particles.burst(this.cx, this.y + this.h, 12, { colors: ['#ff9f43', '#ffe156', '#fff'], type: 'flame', sp1: 220, grav: -80, l1: 0.6, s1: 11 });
          break;
        }
      }
    }
    // fell off the world
    if (this.y > lv.h + 220) {
      if (lv.fallCatch) game.startCloudCatch();
      else { this.damage(1); if (this.hearts > 0) game.softRespawn(); }
    }
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
      this.vy += ay * 1400 * dt + (lv.space ? 0 : 26 * dt); // weightless in space
      // bubble currents (Bubble Maze): strong directional assistance, never a
      // rail — the push (1300) stays below swim thrust (1400), so a determined
      // swimmer can fight it and steering across it is fully free
      if (lv.currents) {
        for (const cu of lv.currents) {
          if (cu.on === false || !overlaps(this, cu)) continue;
          const f = cu.strength || 1300;
          if (cu.dir === 'up') this.vy -= f * dt;
          else if (cu.dir === 'down') this.vy += f * dt;
          else if (cu.dir === 'left') this.vx -= f * dt;
          else this.vx += f * dt;
        }
      }
      const dr = Math.exp(-(lv.space ? 1.7 : 2.4) * dt); // drifts further out there
      this.vx *= dr; this.vy *= dr;
      const mx = spd * (lv.space ? 0.95 : 0.85);
      this.vx = clamp(this.vx, -mx, mx); this.vy = clamp(this.vy, -mx, mx);
      if (ax) this.facing = ax;
      this.duck = false;
      this.bubbleT -= dt;
      if (this.bubbleT <= 0) {
        this.bubbleT = lv.space ? 0.14 : 0.25;
        if (lv.space) {
          Particles.burst(this.cx - this.facing * 22, this.cy + 4, 1, { colors: ['#7fd8ff', '#fff'], type: 'sparkle', sp1: 55, grav: 0, l0: 0.4, l1: 0.9, up: 0, s1: 8 });
        } else {
          Particles.burst(this.cx - this.facing * 20, this.y + 20, 1, { color: 'rgba(255,255,255,0.7)', type: 'bubble', sp1: 40, grav: -240, l0: 0.7, l1: 1.4, up: 0, s1: 9 });
        }
      }
      moveEntity(this, lv, dt);
      this.spin += this.vx * dt / 30;
      this.x = clamp(this.x, 0, lv.w - this.w);
      this.y = clamp(this.y, 40, lv.h - this.h - 4);
    } else if (this.vehicle === 'truck') {
      // ---- MONSTER TRUCK ----
      this.turboT = Math.max(0, this.turboT - dt);
      this.rampCd = Math.max(0, this.rampCd - dt);
      if (this.turboT > 0) {
        this.facing = 1;
        this.vx += (920 - this.vx) * Math.min(1, 6 * dt);
        this.inv = Math.max(this.inv, 0.12); // turbo mode is invincible
        Particles.burst(this.x, this.y + this.h - 26, 2, { colors: ['#ff9f43', '#ffe156'], type: 'flame', sp1: 130, grav: -40, l1: 0.4, s1: 11, up: 0 });
      } else {
        this.vx += (ax * 470 - this.vx) * Math.min(1, 7 * dt);
        if (ax) this.facing = ax;
      }
      this.duck = false;
      if (this.onGround) this.coyote = 0.12; else this.coyote -= dt;
      if (justP.ArrowUp) this.jbuf = 0.14; else this.jbuf = Math.max(0, this.jbuf - dt);
      if (this.jbuf > 0 && this.coyote > 0) {
        this.jbuf = 0; this.coyote = 0;
        this.vy = -760; this.onGround = false; this.squash = 1.25;
        AudioSys.sfx('jump');
      }
      this.vy += 1600 * dt;
      if (this.vy > 950) this.vy = 950;
      const wasG = this.onGround;
      const res = moveEntity(this, lv, dt);
      this.onGround = res.ground;
      if (res.ground && !wasG) {
        AudioSys.sfx('land');
        this.squash = 0.72;
        Particles.burst(this.cx, this.y + this.h, 8, { colors: ['#c9a96a', '#b08a55'], sp1: 160, grav: 100, l1: 0.5, s1: 12, up: 20 });
      }
      // automatic backflips on big air!
      if (!this.onGround) {
        this.airT += dt;
        if (this.airT > 0.45) this.rot -= (this.turboT > 0 ? 9.5 : 7) * dt;
      } else { this.airT = 0; this.rot = 0; }
      // kick up dust while driving
      this.dustT -= dt;
      if (this.onGround && Math.abs(this.vx) > 200 && this.dustT <= 0) {
        this.dustT = 0.08;
        Particles.burst(this.cx - this.facing * 48, this.y + this.h - 8, 1, { colors: ['#c9a96a', '#b08a55'], sp1: 70, grav: -30, l1: 0.7, s1: 13, up: 20 });
      }
      // ramps launch you when you hit them with speed
      if (lv.ramps && this.onGround && this.facing > 0 && Math.abs(this.vx) > 220 && this.rampCd <= 0) {
        for (const r of lv.ramps) {
          if (this.cx > r.x + r.w * 0.45 && this.cx < r.x + r.w + 40) {
            this.vy = -(420 + Math.abs(this.vx) * (r.big ? 0.85 : 0.6));
            this.onGround = false;
            this.rampCd = 0.6;
            AudioSys.sfx(r.big ? 'launch' : 'whoosh');
            if (r.big) game.shake = Math.max(game.shake, 0.3);
            break;
          }
        }
      }
      // TURBO pads
      if (lv.turbos) {
        for (const tp of lv.turbos) {
          if (this.onGround && this.cx > tp.x && this.cx < tp.x + tp.w && this.turboT <= 0.1) {
            this.turboT = 2.6;
            AudioSys.sfx('launch');
            AudioSys.sfx('rev');
            game.shake = Math.max(game.shake, 0.25);
            Particles.burst(this.cx, this.y + this.h, 14, { colors: ['#ffe156', '#ff9f43'], type: 'star', sp1: 320, l1: 0.7, s1: 11 });
          }
        }
      }
      // the finish line!
      if (lv.finishX && !game.raceDone && this.x > lv.finishX && this.onGround) game.finishRace();
      this.spin += this.vx * dt / 42;
      this.x = clamp(this.x, 0, lv.w - this.w);
      if (res.ground) game.lastSafe = { x: this.x, y: this.y };
      this.checkHazards(lv);
    } else if (this.vehicle === 'unicorn' && lv.flight) {
      // ---- SKY FLIGHT: hold Up to rise, release to drift gently down ----
      this.flapCd = Math.max(0, this.flapCd - dt);
      this.flapT = Math.max(0, this.flapT - dt);
      if (ax) { this.vx = clamp(this.vx + ax * 1500 * dt, -280, 280); this.facing = ax; }
      else this.vx *= Math.exp(-3.5 * dt);
      this.duck = false;
      if (keys.ArrowUp) {
        this.vy -= 2300 * dt;
        this.flapT = 0.22;
        if (this.flapCd <= 0) { this.flapCd = 0.28; AudioSys.sfx('flap'); }
        if (chance(0.5)) Particles.burst(this.cx - this.facing * 36, this.cy + 16, 1, { colors: RAINBOW, type: 'sparkle', sp1: 80, grav: 140, l1: 0.7, s1: 9 });
      }
      this.vy += 1050 * dt; // soft gravity
      this.vy = clamp(this.vy, -300, 330);
      const res = moveEntity(this, lv, dt);
      this.onGround = res.ground;
      if (chance(0.4)) Particles.burst(this.cx - this.facing * 42, this.cy + rand(-12, 20), 1, { colors: RAINBOW.concat(['#fff']), type: 'sparkle', sp1: 50, grav: 150, l0: 0.4, l1: 0.9, s0: 5, s1: 9, up: 0 });
      this.x = clamp(this.x, 0, lv.w - this.w);
      this.y = Math.max(this.y, 40);
      if (res.ground) game.lastSafe = { x: this.x, y: this.y };
      this.checkHazards(lv);
    } else if (this.vehicle === 'unicorn') {
      // ---- UNICORN (with Pegasus wings!) ----
      this.flapCd = Math.max(0, this.flapCd - dt);
      this.flapT = Math.max(0, this.flapT - dt);
      if (ax) { this.vx = ax * 340; this.facing = ax; } else this.vx *= Math.exp(-9 * dt);
      this.duck = false;
      if (this.onGround) this.coyote = 0.12; else this.coyote -= dt;
      if (justP.ArrowUp) {
        if (this.onGround || this.coyote > 0) {
          this.coyote = 0;
          this.vy = -650; this.onGround = false; this.squash = 1.25;
          AudioSys.sfx('jump');
        } else if (this.flapCd <= 0) {
          // FLAP! press Up again and again to fly
          this.flapCd = 0.18; this.flapT = 0.28;
          this.vy = Math.max(-560, Math.min(this.vy, 0) - 430);
          AudioSys.sfx('flap');
          Particles.burst(this.cx - this.facing * 30, this.cy + 14, 10, { colors: RAINBOW, type: 'sparkle', sp1: 190, grav: 120, l1: 0.8, s1: 10 });
        }
      }
      this.vy += 1500 * dt;
      if (this.vy > 640) this.vy = 640; // floaty
      const wasG = this.onGround;
      const res = moveEntity(this, lv, dt);
      this.onGround = res.ground;
      if (res.bounced) { AudioSys.sfx('bounce'); this.squash = 1.45; }
      if (res.ground && !wasG) {
        AudioSys.sfx('land'); this.squash = 0.78;
      }
      // glitter trail whenever the unicorn is flying
      if (!this.onGround && chance(0.8)) {
        Particles.burst(this.cx - this.facing * 42, this.cy + rand(-12, 20), 2, { colors: RAINBOW.concat(['#fff']), type: 'sparkle', sp1: 60, grav: 170, l0: 0.5, l1: 1, s0: 5, s1: 10, up: 0 });
      }
      this.x = clamp(this.x, 0, lv.w - this.w);
      this.y = Math.max(this.y, 40);
      if (res.ground) game.lastSafe = { x: this.x, y: this.y };
      this.checkHazards(lv);
    } else {
      this.launchT = Math.max(0, this.launchT - dt);
      if (ax) { this.vx = ax * spd; this.facing = ax; this.launchT = 0; }
      else if (this.launchT > 0 && !this.onGround) { /* side-cloud launch: carry the momentum */ }
      else this.vx = 0;
      if (this.onGround) this.launchT = 0;
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
      this.checkHazards(lv);
    }
    if (justP.Space) this.action();
  }
  action() {
    if (this.cool > 0) return;
    if (this.vehicle === 'unicorn') {
      // the horn always fires rainbows — unicorns are friendly
      // (fired at chest height so it can reach little bugs on the ground)
      this.cool = 0.4;
      game.projectiles.push(new Projectile(this.cx + this.facing * 52, this.y + 48, this.facing, 'rainbow'));
      AudioSys.sfx('rainbow');
      this.setMood('grin', 0.4);
      Particles.burst(this.cx + this.facing * 52, this.y + 22, 6, { colors: RAINBOW, type: 'sparkle', sp1: 140, l1: 0.5, s1: 8 });
      return;
    }
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
  drawBoy(ctx, bx, by, mood) { // draws whichever hero is selected (boy or girl)
    const t = this.t;
    const girl = game.character === 'girl';
    // arms
    ctx.strokeStyle = '#ffcf9f'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    const sw = Math.sin(t * 10) * (Math.abs(this.vx) > 10 ? 4 : 1.2);
    ctx.beginPath();
    ctx.moveTo(bx - 11, by + 33); ctx.lineTo(bx - 23, by + 42 + sw);
    ctx.moveTo(bx + 11, by + 33); ctx.lineTo(bx + 23, by + 42 - sw);
    ctx.stroke();
    // body
    ctx.fillStyle = girl ? '#ff5fa2' : '#ff5a5a'; rr(ctx, -15 + bx, by + 26, 30, 26, 9); ctx.fill();
    ctx.fillStyle = girl ? '#8f5fff' : '#4a6cff'; rr(ctx, -14 + bx, by + 46, 28, 12, 5); ctx.fill();
    // head
    ctx.fillStyle = '#ffcf9f';
    ctx.beginPath(); ctx.arc(bx, by + 8, 19, 0, TAU); ctx.fill();
    if (girl) {
      // curly blonde hair: a crown of springy puffs
      ctx.fillStyle = '#ffd84f';
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI + i * Math.PI / 6;
        ctx.beginPath();
        ctx.arc(bx + Math.cos(a) * 17, by + 8 + Math.sin(a) * 17, 8, 0, TAU);
        ctx.fill();
      }
      ctx.beginPath(); ctx.arc(bx - 21, by + 16, 6.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(bx + 21, by + 16, 6.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(bx - 22, by + 24, 5.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(bx + 22, by + 24, 5.5, 0, TAU); ctx.fill();
      // little pink bow
      ctx.fillStyle = '#ff5fa2';
      const bwx = bx + this.facing * 11, bwy = by - 11;
      ctx.beginPath();
      ctx.moveTo(bwx, bwy); ctx.lineTo(bwx - 8, bwy - 6); ctx.lineTo(bwx - 7, bwy + 5);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bwx, bwy); ctx.lineTo(bwx + 8, bwy - 6); ctx.lineTo(bwx + 7, bwy + 5);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(bwx, bwy, 3, 0, TAU); ctx.fill();
    } else {
      // cap
      ctx.fillStyle = '#ffa62b';
      ctx.beginPath(); ctx.arc(bx, by + 6, 19.5, Math.PI, TAU); ctx.fill();
      rr(ctx, bx + (this.facing > 0 ? 4 : -26), by - 1, 22, 7, 3); ctx.fill();
    }
    // royalty wears the crown everywhere, forever
    if (game.royal) drawCrown(ctx, bx, by - (girl ? 14 : 10), 13);
    // face
    drawFace(ctx, bx, by + 13, 30, mood, t, 3, this.facing * 0.7 + this.vx / 500, this.vy / 1100);
  }
  draw(ctx) {
    ctx.save();
    if (this.inv > 0 && this.turboT <= 0 && Math.floor(this.t * 14) % 2 === 0) ctx.globalAlpha = 0.35;
    if (this.vehicle === 'truck') {
      if (this.rot) {
        ctx.translate(this.cx, this.cy);
        ctx.rotate(this.rot);
        ctx.translate(-this.cx, -this.cy);
      }
      const sq = clamp(this.squash, 0.6, 1.5);
      const baseY = this.y + this.h;
      ctx.translate(this.cx, baseY);
      ctx.scale(2 - sq, sq);
      ctx.translate(-this.cx, -baseY);
      drawTruckBody(ctx, this.x, this.y, this.w, this.h, this.t, {
        driving: Math.abs(this.vx) > 40,
        character: game.character,
        facing: this.facing,
        turbo: this.turboT > 0,
        spin: this.spin,
        mood: this.mood
      });
      ctx.restore();
      return;
    }
    if (this.vehicle === 'unicorn') {
      const sq = clamp(this.squash, 0.6, 1.5);
      const baseY = this.y + this.h;
      ctx.translate(this.cx, baseY);
      ctx.scale(2 - sq, sq);
      ctx.translate(-this.cx, -baseY);
      drawUnicornBody(ctx, this.x, this.y, this.w, this.h, this.t, {
        running: Math.abs(this.vx) > 60 && this.onGround,
        airborne: !this.onGround,
        flapT: this.flapT,
        facing: this.facing
      });
      this.drawBoy(ctx, this.cx - this.facing * 16, this.y - 16, this.mood);
      ctx.restore();
      return;
    }
    const sq = clamp(this.squash, 0.6, 1.5);
    const baseY = this.y + this.h;
    ctx.translate(this.cx, baseY);
    ctx.scale(2 - sq, sq);
    ctx.translate(-this.cx, -baseY);
    const wx = this.cx, wy = this.y + this.h - 30;
    this.drawWheel(ctx, wx, wy, 30);
    this.drawBoy(ctx, wx, this.y + (this.duck ? 24 : 6), this.mood);
    // space helmet bubble
    if (game.level && game.level.space) {
      ctx.save();
      ctx.fillStyle = 'rgba(190,232,255,0.22)';
      ctx.beginPath(); ctx.arc(wx, this.y + 16, 28, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(wx, this.y + 16, 28, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(wx - 9, this.y + 7, 9, -2.6, -1.2); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  drawSitting(ctx, x, y) { // used on the lose screen: boy on the ground, surprised
    ctx.save();
    ctx.translate(0, Math.sin(this.t * 2) * 2);
    this.drawBoy(ctx, x, y, 'surprised');
    ctx.restore();
  }
}

// ================================================================ monster truck
function drawTruckBody(ctx, x, y, w, h, t, o = {}) {
  const bounce = o.driving ? Math.sin(t * 16) * 2 : Math.sin(t * 2) * 1;
  const wy = y + h - 26; // wheel centers
  // wheels: huge knobbly tires
  for (const wx of [x + 26, x + w - 26]) {
    ctx.fillStyle = '#2e2430';
    ctx.beginPath(); ctx.arc(wx, wy, 26, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#1a1420'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(wx, wy, 26, 0, TAU); ctx.stroke();
    // treads
    ctx.fillStyle = '#4a3a50';
    for (let i = 0; i < 8; i++) {
      const a = (o.spin || 0) + i * TAU / 8;
      ctx.beginPath();
      ctx.arc(wx + Math.cos(a) * 22, wy + Math.sin(a) * 22, 4.5, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#c9c1d6';
    ctx.beginPath(); ctx.arc(wx, wy, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a7fae';
    starPath(ctx, wx, wy, 7, 3, 5, (o.spin || 0));
    ctx.fill();
  }
  ctx.save();
  ctx.translate(0, bounce);
  // body
  const bodC = o.turbo ? '#ff8a2b' : '#e8482b';
  ctx.fillStyle = bodC;
  rr(ctx, x + 2, y + 26, w - 4, h - 56, 12); ctx.fill();
  ctx.strokeStyle = '#8a2418'; ctx.lineWidth = 3.5;
  rr(ctx, x + 2, y + 26, w - 4, h - 56, 12); ctx.stroke();
  // flame decals
  ctx.fillStyle = '#ffe156';
  for (const sd of [0, 1]) {
    const fx = x + 12 + sd * (w - 44);
    ctx.beginPath();
    ctx.moveTo(fx, y + h - 34);
    ctx.quadraticCurveTo(fx + 8, y + h - 52, fx + 5, y + 34);
    ctx.quadraticCurveTo(fx + 13, y + h - 54, fx + 20, y + h - 34);
    ctx.closePath(); ctx.fill();
  }
  // funny face on the door (of course)
  drawFace(ctx, x + w / 2, y + h - 46, 26, o.mood === 'surprised' ? 'surprised' : 'grin', t, 17, o.facing || 1, 0);
  // cab + driver
  ctx.fillStyle = bodC;
  rr(ctx, x + w * 0.28, y - 4, w * 0.5, 36, 9); ctx.fill();
  ctx.strokeStyle = '#8a2418'; ctx.lineWidth = 3;
  rr(ctx, x + w * 0.28, y - 4, w * 0.5, 36, 9); ctx.stroke();
  const winX = x + w * 0.33, winW = w * 0.4;
  ctx.fillStyle = '#bfe8ff';
  rr(ctx, winX, y + 1, winW, 26, 6); ctx.fill();
  if (o.character) {
    ctx.save();
    ctx.beginPath();
    rr(ctx, winX, y + 1, winW, 26, 6);
    ctx.clip();
    ctx.translate(winX + winW / 2, y + 22);
    ctx.scale(0.62, 0.62);
    drawHead(ctx, 0, 0, o.character, t, false);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(winX + 4, y + 22); ctx.lineTo(winX + 12, y + 5); ctx.stroke();
  }
  // exhaust pipe
  ctx.fillStyle = '#8a8a9a';
  rr(ctx, x + w - 16, y - 12, 9, 30, 3); ctx.fill();
  if (o.driving && chance(0.35)) {
    Particles.burst(x + w - 11, y - 14, 1, { color: 'rgba(200,200,210,0.6)', sp1: 30, grav: -120, l1: 0.6, s1: 10, up: 10 });
  }
  // bumper
  ctx.fillStyle = '#c9c1d6';
  const bx2 = (o.facing || 1) > 0 ? x + w - 8 : x;
  rr(ctx, bx2 - 2, y + 34, 10, h - 68, 4); ctx.fill();
  ctx.restore();
}

class ParkedTruck {
  constructor(x, groundY) {
    this.w = 104; this.h = 96;
    this.x = x; this.y = groundY - this.h;
    this.t = rand(9);
    this.dead = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt) {
    this.t += dt;
    if (!this.dead && overlaps(this, game.player)) {
      this.dead = true;
      game.player.boardTruck();
    }
  }
  draw(ctx) {
    if (this.dead) return;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(this.t * 4);
    ctx.fillStyle = '#ffe156';
    ctx.beginPath(); ctx.arc(this.cx, this.cy, 78, 0, TAU); ctx.fill();
    ctx.restore();
    drawTruckBody(ctx, this.x, this.y, this.w, this.h, this.t, { driving: false, facing: 1 });
    // bouncing arrow: hop in!
    const ay = this.y - 56 + Math.sin(this.t * 5) * 9;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.cx, ay); ctx.lineTo(this.cx, ay + 34);
    ctx.moveTo(this.cx - 12, ay + 20); ctx.lineTo(this.cx, ay + 36); ctx.lineTo(this.cx + 12, ay + 20);
    ctx.stroke();
  }
}

// ================================================================ unicorn
function drawUnicornBody(ctx, x, y, w, h, t, o = {}) {
  ctx.save();
  const cx = x + w / 2;
  if ((o.facing || 1) < 0) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
  const bodyY = y + 34;
  // wing behind the body
  const airborne = o.airborne;
  const wingA = airborne ? -(o.flapT > 0 ? (o.flapT / 0.28) * 1 : 0.2 + Math.sin(t * 7) * 0.22) : 0;
  const drawWing = (wx2, wy2, s, alpha) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(wx2, wy2);
    ctx.rotate(wingA);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(-14 - i * 13 * s, -8 - i * 8 * s, 22 * s, 10 * s, -0.5 - i * 0.16, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = '#d9c9ef'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(-14, -8, 22 * s, 10 * s, -0.5, 0, TAU);
    ctx.stroke();
    ctx.restore();
  };
  if (airborne) drawWing(x + w * 0.42, bodyY + 4, 1.15, 0.85);
  // tail: flowing rainbow strands
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = RAINBOW[i % RAINBOW.length]; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 12, bodyY + 12 + i * 3);
    ctx.quadraticCurveTo(
      x - 12 - i * 3, bodyY + 16 + i * 5 + Math.sin(t * 4 + i) * 6,
      x - 20 - i * 4, bodyY + 34 + i * 4 + Math.sin(t * 4 + i) * 8
    );
    ctx.stroke();
  }
  // legs: galloping stubs
  ctx.strokeStyle = '#f2ecff'; ctx.lineWidth = 11; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const lx = x + 24 + i * 20;
    const swing = o.running ? Math.sin(t * 13 + i * 1.7) * 9 : (airborne ? 6 - i * 3 : 0);
    ctx.beginPath();
    ctx.moveTo(lx, bodyY + 26);
    ctx.lineTo(lx + swing, y + h - 6);
    ctx.stroke();
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.arc(lx + swing, y + h - 5, 6, 0, TAU); ctx.fill();
  }
  // body
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(x + w * 0.42, bodyY + 16, w * 0.34, 26, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#d9c9ef'; ctx.lineWidth = 3; ctx.stroke();
  // neck + head
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.6, bodyY + 26);
  ctx.quadraticCurveTo(x + w * 0.74, bodyY - 8, x + w * 0.8, y + 16);
  ctx.lineTo(x + w * 0.94, y + 26);
  ctx.quadraticCurveTo(x + w * 0.86, bodyY + 18, x + w * 0.72, bodyY + 30);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + w * 0.85, y + 18, 20, 15, -0.25, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#d9c9ef'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(x + w * 0.85, y + 18, 20, 15, -0.25, 0, TAU); ctx.stroke();
  // muzzle
  ctx.fillStyle = '#ffd9e8';
  ctx.beginPath(); ctx.ellipse(x + w * 0.97, y + 22, 8, 6.5, -0.2, 0, TAU); ctx.fill();
  // ear
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.78, y + 8); ctx.lineTo(x + w * 0.74, y - 6); ctx.lineTo(x + w * 0.84, y + 4);
  ctx.closePath(); ctx.fill();
  // golden horn with stripes
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.86, y + 6); ctx.lineTo(x + w * 0.98, y - 24); ctx.lineTo(x + w * 0.94, y + 8);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + w * 0.9, y - 2); ctx.lineTo(x + w * 0.95, y + 1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w * 0.93, y - 11); ctx.lineTo(x + w * 0.965, y - 8); ctx.stroke();
  // mane: rainbow strands down the neck
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = RAINBOW[i]; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.8 - i * 4.5, y + 8 + i * 5);
    ctx.quadraticCurveTo(
      x + w * 0.68 - i * 4, y + 18 + i * 6 + Math.sin(t * 5 + i) * 3,
      x + w * 0.62 - i * 3, y + 30 + i * 5
    );
    ctx.stroke();
  }
  // eye with a lash
  ctx.fillStyle = '#3a2a3a';
  ctx.beginPath(); ctx.arc(x + w * 0.85, y + 15, 4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x + w * 0.86, y + 13.5, 1.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#3a2a3a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + w * 0.81, y + 10); ctx.lineTo(x + w * 0.77, y + 7); ctx.stroke();
  // smile
  ctx.beginPath(); ctx.arc(x + w * 0.94, y + 26, 4, 0.3, Math.PI * 0.9); ctx.stroke();
  // wing in front
  if (airborne) drawWing(x + w * 0.5, bodyY + 6, 0.9, 1);
  ctx.restore();
}

class ParkedUnicorn {
  constructor(x, groundY) {
    this.w = 112; this.h = 98;
    this.x = x; this.y = groundY - this.h;
    this.t = rand(9);
    this.dead = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt) {
    this.t += dt;
    if (!this.dead && overlaps(this, game.player)) {
      this.dead = true;
      game.player.boardUnicorn();
    }
    if (!this.dead && chance(0.08)) {
      Particles.burst(this.cx + rand(-40, 40), this.cy + rand(-30, 30), 1, { colors: RAINBOW, type: 'sparkle', sp1: 25, grav: -40, l1: 0.8, s1: 8, up: 0 });
    }
  }
  draw(ctx) {
    if (this.dead) return;
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(this.t * 4);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(this.cx, this.cy, 80, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(0, Math.sin(this.t * 2.5) * 3);
    drawUnicornBody(ctx, this.x, this.y, this.w, this.h, this.t, { facing: 1 });
    ctx.restore();
    const ay = this.y - 58 + Math.sin(this.t * 5) * 9;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.cx, ay); ctx.lineTo(this.cx, ay + 34);
    ctx.moveTo(this.cx - 12, ay + 20); ctx.lineTo(this.cx, ay + 36); ctx.lineTo(this.cx + 12, ay + 20);
    ctx.stroke();
  }
}

// ================================================================ centipede
// A multi-block bug: a chain of funny blocks that wiggles along the ground.
// Rainbow turns the whole chain into a rainbow parade that follows the player.
class Centipede {
  constructor(x, groundY, n = 6, range = 260) {
    this.n = n;
    this.groundY = groundY;
    this.state = 'angry';
    this.dir = -1; this.range = range; this.x0 = x;
    this.t = rand(9);
    this.frozenT = 0;
    this.dead = false;
    this.segs = [];
    for (let i = 0; i < n; i++) this.segs.push({ x: x + i * 30, y: groundY - 20 });
  }
  update(dt) {
    this.t += dt;
    if (this.dead) return;
    if (this.frozenT > 0) { this.frozenT -= dt; return; }
    const pl = game.player;
    const head = this.segs[0];
    if (this.state === 'angry') {
      head.x += this.dir * 85 * dt;
      if (head.x < this.x0 - this.range) this.dir = 1;
      if (head.x > this.x0 + this.range) this.dir = -1;
    } else {
      // the rainbow parade follows its new best friend
      const tx = pl.cx - pl.facing * 130;
      head.x += clamp(tx - head.x, -230 * dt, 230 * dt);
      if (Math.abs(tx - head.x) > 4) this.dir = Math.sign(tx - head.x);
      if (chance(1.2 * dt)) Particles.burst(head.x, head.y - 26, 1, { colors: ['#ff8fb0'], type: 'heart', sp1: 40, grav: -100, l1: 0.8, s1: 8, up: 0 });
    }
    head.y = this.groundY - 22 + Math.sin(this.t * 5) * 8;
    for (let i = 1; i < this.n; i++) {
      const p = this.segs[i - 1], s = this.segs[i];
      const dx = p.x - s.x;
      if (Math.abs(dx) > 30) s.x += (Math.abs(dx) - 30) * Math.sign(dx);
      s.y = this.groundY - 20 + Math.sin(this.t * 5 - i * 0.85) * 9;
    }
  }
  touches(r) {
    if (this.dead || this.state !== 'angry' || this.frozenT > 0) return false;
    return this.overlapsRect(r);
  }
  overlapsRect(r) {
    if (this.dead) return false;
    for (let i = 0; i < this.n; i++) {
      const s = this.segs[i];
      // the head is big and tall — an easy target
      const hw = i === 0 ? 26 : 18;
      const top = i === 0 ? 34 : 18, bot = i === 0 ? 20 : 18;
      if (r.x < s.x + hw && r.x + r.w > s.x - hw && r.y < s.y + bot && r.y + r.h > s.y - top) return true;
    }
    return false;
  }
  hitBy(kind) {
    if (this.dead) return;
    if (kind === 'rainbow') {
      if (this.state !== 'friend') {
        this.state = 'friend';
        AudioSys.sfx('friend');
        for (const s of this.segs) {
          Particles.burst(s.x, s.y, 5, { colors: ['#ff8fb0', '#ffd24a', '#fff'], type: 'heart', sp1: 180, l1: 0.9, s1: 9 });
        }
      }
    } else if (kind === 'ice') {
      this.frozenT = 4;
      AudioSys.sfx('freeze');
    } else if (kind === 'fire' && this.state === 'angry') {
      this.dead = true;
      AudioSys.sfx('poof');
      for (const s of this.segs) {
        Particles.burst(s.x, s.y, 8, { colors: ['#8fd05a', '#57b84a', '#ffe156'], type: 'star', sp1: 240, l1: 0.7, s1: 10 });
        if (chance(0.5)) {
          const c = new Pickup(s.x, s.y, 'candy');
          c.vx = rand(-150, 150); c.vy = -350; c.physics = true;
          game.pickups.push(c);
        }
      }
    }
  }
  draw(ctx) {
    if (this.dead) return;
    const t = this.t, friend = this.state === 'friend';
    for (let i = this.n - 1; i >= 0; i--) {
      const s = this.segs[i];
      // little legs
      ctx.strokeStyle = friend ? '#d6559a' : '#3a6a2a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s.x + sd * 8, s.y + 10);
        ctx.lineTo(s.x + sd * 13, s.y + 21 + Math.sin(t * 10 + i + sd) * 3);
        ctx.stroke();
      }
      const col = friend ? RAINBOW[i % RAINBOW.length] : (i % 2 ? '#6fbf4f' : '#57a83f');
      ctx.fillStyle = col;
      if (i === 0) { // big noggin
        rr(ctx, s.x - 24, s.y - 30, 48, 50, 13); ctx.fill();
        ctx.strokeStyle = 'rgba(30,60,25,0.5)'; ctx.lineWidth = 2.5;
        rr(ctx, s.x - 24, s.y - 30, 48, 50, 13); ctx.stroke();
      } else {
        rr(ctx, s.x - 17, s.y - 16, 34, 34, 10); ctx.fill();
        ctx.strokeStyle = 'rgba(30,60,25,0.5)'; ctx.lineWidth = 2.5;
        rr(ctx, s.x - 17, s.y - 16, 34, 34, 10); ctx.stroke();
      }
      if (i === 0) {
        // antennae with bobble tips
        ctx.strokeStyle = friend ? '#d6559a' : '#3a6a2a'; ctx.lineWidth = 3.5;
        for (const sd of [-1, 1]) {
          const tipY = s.y - 44 + Math.sin(t * 6 + sd) * 3;
          ctx.beginPath();
          ctx.moveTo(s.x + sd * 8, s.y - 28);
          ctx.quadraticCurveTo(s.x + sd * 16, s.y - 46, s.x + sd * 21, tipY);
          ctx.stroke();
          ctx.fillStyle = friend ? '#ff8fb0' : '#8fd05a';
          ctx.beginPath(); ctx.arc(s.x + sd * 21, tipY, 5, 0, TAU); ctx.fill();
        }
        drawFace(ctx, s.x, s.y - 4, 38, friend ? 'happy' : 'angry', t, this.x0, this.dir, 0);
      } else {
        drawFace(ctx, s.x, s.y + 1, friend ? 20 : 17, friend ? 'happy' : 'sleepy', t, i * 3 + this.x0);
      }
      if (this.frozenT > 0) {
        ctx.fillStyle = 'rgba(160,225,255,0.5)';
        rr(ctx, s.x - 20, s.y - 20, 40, 44, 8); ctx.fill();
      }
    }
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
    this.w = kind === 'tornado' ? 62 : 58;
    this.h = kind === 'tornado' ? 84 : kind === 'alien' ? 58 : 44;
    this.axis = opt.axis || 'x';
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
    this.burnT = 0;
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

    if (this.state === 'burning') {
      // panic! zigzag in place on fire until the big cartoon boom
      this.burnT -= dt;
      this.zigT = (this.zigT || 0) - dt;
      if (Math.abs(this.cx - this.homeX) > 70) this.dir = this.homeX > this.cx ? 1 : -1;
      else if (this.zigT <= 0) { this.zigT = rand(0.15, 0.35); if (chance(0.65)) this.dir *= -1; }
      this.vx = this.dir * 240;
      this.vy += 1600 * dt;
      const r = moveEntity(this, lv, dt);
      if (r.wall) this.dir *= -1;
      if (chance(0.6)) {
        Particles.burst(this.cx + rand(-14, 14), this.y - 4, 1, { colors: ['#ff9f43', '#ffe156', '#ff6b35'], type: 'flame', sp1: 60, grav: -160, l1: 0.4, s1: 10, up: 0 });
      }
      if (this.y + this.h > lv.h + 60 || this.burnT <= 0) this.explode();
      return;
    }

    // spiders that stumble into lava ignite instantly
    if (this.state === 'angry' && lv.lava && this.y + this.h > 648) {
      for (const L of lv.lava) {
        if (this.cx > L.x && this.cx < L.x + L.w) { this.ignite(0); this.burnT = 0.5; break; }
      }
      if (this.state === 'burning') return;
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
    } else if (this.kind === 'tornado') {
      // dirt devil: fast wander, drifts after the player
      const dx = pl.cx - this.cx;
      if (Math.abs(dx) < 360) this.dir = Math.sign(dx) || this.dir;
      this.vx = this.dir * 135;
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
      if (chance(7 * dt)) {
        Particles.burst(this.cx + rand(-20, 20), this.y + this.h - rand(0, 30), 1, { colors: ['#c9a96a', '#b08a55'], sp1: 60, grav: -60, l1: 0.5, s1: 9, up: 10 });
      }
    } else if (this.kind === 'alien') {
      // saucer patrol: some drift sideways, some up-and-down; all curious about you
      const dx = pl.cx - this.cx, dy = pl.cy - this.cy;
      const near = Math.abs(dx) < 320 && Math.abs(dy) < 320;
      if (this.axis === 'y') {
        this.vy = this.dir * 95;
        this.vx = near ? clamp(dx, -48, 48) : Math.sin(this.t * 2) * 14;
      } else {
        this.vx = this.dir * 95;
        this.vy = (near ? clamp(dy, -48, 48) : 0) + Math.sin(this.t * 3) * 14;
      }
      const r = moveEntity(this, lv, dt);
      if (this.axis === 'y') {
        if (r.ground || r.head) this.dir *= -1;
        if (this.y < this.y0 - this.range) this.dir = 1;
        if (this.y > this.y0 + this.range) this.dir = -1;
      } else {
        if (r.wall) this.dir *= -1;
        if (this.x < this.x0 - this.range) this.dir = 1;
        if (this.x > this.x0 + this.range) this.dir = -1;
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
      if (this.state === 'burning') return false; // already lit
      if (this.state === 'frozen') { AudioSys.sfx('shatter'); this.pop(); return true; }
      if (game.level.theme === 'lava') { this.ignite(0); return true; }
      this.pop();
      return true;
    }
    if (kind === 'ice') {
      if (this.state === 'burning') {
        // phew! ice puts the fire out
        this.state = 'angry'; this.burnT = 0;
        AudioSys.sfx('steam');
        Particles.burst(this.cx, this.y, 10, { colors: ['#fff', '#d6f4ff'], type: 'circle', sp1: 90, grav: -160, l1: 0.7, s1: 10 });
        return true;
      }
      if (this.state !== 'frozen') {
        this.state = 'frozen'; this.frozenT = 5; this.slideVx = 0; this.vy = 0;
        AudioSys.sfx('freeze');
        Particles.burst(this.cx, this.cy, 10, { colors: ['#d6f4ff', '#fff'], type: 'sparkle', sp1: 170, l1: 0.5, s1: 8 });
      }
      return true;
    }
    if (kind === 'rainbow') {
      if (this.state !== 'frozen') this.befriend(); // also rescues burning spiders
      return false; // rainbow passes through, can befriend several
    }
    return false;
  }
  ignite(delay) {
    if (this.dead || (this.state !== 'angry' && this.state !== 'burning')) return;
    if (this.state === 'burning') return;
    this.state = 'burning';
    this.burnT = 1.3 + (delay || 0);
    this.dir = this.dir || 1;
    this.homeX = this.cx;
    AudioSys.sfx('fire');
  }
  explode() {
    if (this.dead) return;
    this.dead = true;
    AudioSys.sfx('boom');
    game.shake = Math.max(game.shake, 0.25);
    Particles.burst(this.cx, this.cy, 18, { colors: ['#ffe156', '#ff9f43', '#ff6b35', '#fff'], type: 'star', sp1: 420, l0: 0.5, l1: 1, s0: 8, s1: 15 });
    Particles.burst(this.cx, this.cy, 10, { colors: ['#ff6b35', '#ffce54'], type: 'flame', sp1: 260, l1: 0.6, s1: 12 });
    for (let i = 0; i < 2; i++) {
      const c = new Pickup(this.cx, this.cy, 'candy');
      c.vx = rand(-180, 180); c.vy = rand(-460, -260); c.physics = true;
      game.pickups.push(c);
    }
    // chain reaction: nearby spiders catch fire too
    for (const o of game.spiders) {
      if (o !== this && !o.dead && o.state === 'angry' &&
          Math.abs(o.cx - this.cx) < 190 && Math.abs(o.cy - this.cy) < 150) {
        o.ignite(rand(0.05, 0.3));
      }
    }
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
    if (this.state === 'burning') { this.explode(); return; }
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
    const popCols = this.kind === 'tornado' ? ['#c9a96a', '#8a5a2a', '#ffe156'] : ['#b06cf0', '#fff', '#ffe156'];
    Particles.burst(this.cx, this.cy, 12, { colors: popCols, type: 'star', sp1: 260, l1: 0.7, s1: 10 });
    // candy reward pops out
    if (chance(0.75)) {
      const c = new Pickup(this.cx, this.cy, 'candy');
      c.vx = rand(-140, 140); c.vy = -380; c.physics = true;
      game.pickups.push(c);
    }
  }
  drawTornado(ctx) {
    const t = this.t, friend = this.state === 'friend';
    const cx = this.cx;
    ctx.save();
    if (this.state === 'flying') { ctx.translate(cx, this.cy); ctx.rotate(t * 14); ctx.translate(-cx, -this.cy); }
    // swirling dust cone: wide up top, narrow at the ground
    const layers = 6;
    for (let i = 0; i < layers; i++) {
      const k = i / (layers - 1); // 0 bottom, 1 top
      const ly = this.y + this.h - 8 - k * (this.h - 16);
      const lw = 10 + k * 26;
      const off = Math.sin(t * 11 + i * 1.9) * (3 + k * 8);
      ctx.fillStyle = friend
        ? (i % 2 ? '#ff9fd0' : '#ffc0e0')
        : (i % 2 ? '#c9a96a' : '#b08a55');
      ctx.beginPath();
      ctx.ellipse(cx + off, ly, lw, 9 + k * 3, 0, 0, TAU);
      ctx.fill();
    }
    // flying debris flecks
    ctx.fillStyle = friend ? '#ff5fa2' : '#8a5a2a';
    for (let i = 0; i < 3; i++) {
      const a = t * 7 + i * TAU / 3;
      ctx.fillRect(cx + Math.cos(a) * 30 - 3, this.y + 22 + Math.sin(a) * 14, 6, 4);
    }
    // googly face near the top
    drawFace(ctx, cx + Math.sin(t * 11 + 4) * 6, this.y + 22, 32, friend ? 'happy' : 'angry', t, this.x0, this.dir, 0);
    if (friend && chance(0.02)) {
      Particles.burst(cx, this.y, 1, { colors: ['#ff8fb0'], type: 'heart', sp1: 40, grav: -100, l1: 0.8, s1: 8, up: 0 });
    }
    // ice cube overlay
    if (this.state === 'frozen') {
      ctx.fillStyle = 'rgba(160,225,255,0.55)';
      rr(ctx, this.x - 8, this.y - 8, this.w + 16, this.h + 12, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(220,245,255,0.9)'; ctx.lineWidth = 3;
      rr(ctx, this.x - 8, this.y - 8, this.w + 16, this.h + 12, 8); ctx.stroke();
    }
    ctx.restore();
  }
  drawAlien(ctx) {
    const t = this.t, friend = this.state === 'friend';
    const cx = this.cx;
    ctx.save();
    if (this.state === 'flying') { ctx.translate(cx, this.cy); ctx.rotate(t * 14); ctx.translate(-cx, -this.cy); }
    ctx.translate(0, Math.sin(t * 3 + this.x0) * 3);
    const sy = this.y + this.h - 16; // saucer center line
    // glass dome
    ctx.fillStyle = 'rgba(190,232,255,0.3)';
    ctx.beginPath(); ctx.arc(cx, sy - 16, 24, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, sy - 16, 24, Math.PI, TAU); ctx.stroke();
    // alien head
    ctx.fillStyle = friend ? '#a8f090' : '#7fe06a';
    ctx.beginPath(); ctx.ellipse(cx, sy - 20, 15, 17, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3f8c35'; ctx.lineWidth = 2; ctx.stroke();
    // antenna with glowing bobble
    ctx.strokeStyle = '#3f8c35'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, sy - 36); ctx.lineTo(cx + Math.sin(t * 5) * 4, sy - 46); ctx.stroke();
    ctx.fillStyle = friend ? '#ff8fb0' : '#ffe156';
    ctx.beginPath(); ctx.arc(cx + Math.sin(t * 5) * 4, sy - 48, 4.5, 0, TAU); ctx.fill();
    if (friend) {
      drawFace(ctx, cx, sy - 20, 24, 'happy', t, this.x0, this.dir, 0);
      ctx.fillStyle = 'rgba(255,120,150,0.5)';
      ctx.beginPath(); ctx.arc(cx - 10, sy - 14, 3.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 10, sy - 14, 3.5, 0, TAU); ctx.fill();
    } else {
      // classic big almond eyes (goofy, not scary)
      ctx.fillStyle = '#2a2438';
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + sd * 7, sy - 22, 5, 8.5, sd * 0.45, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - 6, sy - 25, 1.8, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 8, sy - 25, 1.8, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2a2438'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, sy - 11, 4, 0.2, Math.PI - 0.2); ctx.stroke();
    }
    // saucer
    ctx.fillStyle = '#b9b3cf';
    ctx.beginPath(); ctx.ellipse(cx, sy, 30, 11, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#7a72a0'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#8a82b5';
    ctx.beginPath(); ctx.ellipse(cx, sy + 5, 18, 6, 0, 0, TAU); ctx.fill();
    // running lights
    for (let i = -1; i <= 1; i++) {
      ctx.fillStyle = friend ? RAINBOW[(i + 1 + Math.floor(t * 4)) % RAINBOW.length]
        : (Math.floor(t * 4 + i) % 2 ? '#ffe156' : '#ff6b35');
      ctx.beginPath(); ctx.arc(cx + i * 16, sy + 3, 3, 0, TAU); ctx.fill();
    }
    if (this.state === 'frozen') {
      ctx.fillStyle = 'rgba(160,225,255,0.55)';
      rr(ctx, this.x - 8, this.y - 10, this.w + 16, this.h + 18, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(220,245,255,0.9)'; ctx.lineWidth = 3;
      rr(ctx, this.x - 8, this.y - 10, this.w + 16, this.h + 18, 8); ctx.stroke();
    }
    ctx.restore();
  }
  draw(ctx) {
    if (this.dead) return;
    if (this.kind === 'tornado') { this.drawTornado(ctx); return; }
    if (this.kind === 'alien') { this.drawAlien(ctx); return; }
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
    // fire on top when burning
    if (this.state === 'burning') {
      const fh = 26 + Math.sin(t * 22) * 6;
      ctx.fillStyle = '#ff6b35';
      ctx.beginPath();
      ctx.moveTo(cx - 14, this.y + 2);
      ctx.quadraticCurveTo(cx - 6, this.y - fh, cx, this.y - fh * 0.55);
      ctx.quadraticCurveTo(cx + 7, this.y - fh * 0.9, cx + 14, this.y + 2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe156';
      ctx.beginPath();
      ctx.moveTo(cx - 7, this.y + 2);
      ctx.quadraticCurveTo(cx, this.y - fh * 0.5, cx + 7, this.y + 2);
      ctx.closePath(); ctx.fill();
    }
    // face
    drawFace(ctx, cx, cy + 2, 34, friend ? 'happy' : this.state === 'burning' ? 'surprised' : 'angry', t, this.x0, this.dir, 0);
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
  // kinds: fire, ice, rainbow, power, heart, candy, star (sky-flight collectible)
  constructor(cx, cy, kind) {
    this.kind = kind;
    const s = kind === 'candy' ? 26 : kind === 'heart' ? 36 : kind === 'star' ? 44 : 54;
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
        const needAgain = this.bossKind === 'power' ? game.player.superT <= 0 : game.player.power !== this.bossKind;
        if (this.respawnT <= 0 && needAgain) {
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
    if (this.kind === 'star') {
      game.flightStars++;
      AudioSys.sfx('collect');
      Particles.burst(this.cx, this.cy, 12, { colors: RAINBOW.concat(['#ffe156']), type: 'star', sp1: 240, l1: 0.8, s1: 11, grav: 120 });
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
    if (this.kind === 'star') {
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(this.t * 4);
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(cx, cy, 36, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(this.t * 1.6) * 0.3);
      ctx.fillStyle = '#ffd24a';
      starPath(ctx, 0, 0, 22, 10);
      ctx.fill();
      ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
      if (chance(0.15)) Particles.burst(cx + rand(-20, 20), cy + rand(-20, 20), 1, { colors: RAINBOW, type: 'sparkle', sp1: 20, grav: -40, l1: 0.6, s1: 7, up: 0 });
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
    const need = game.bossPlan[game.bossStage];
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
      const need = game.bossPlan[game.bossStage];
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

// ================================================================ lava blob (King Magma's projectile)
class LavaBlob {
  constructor(x, y, vx, vy) {
    this.w = 30; this.h = 30;
    this.x = x - 15; this.y = y - 15;
    this.vx = vx; this.vy = vy;
    this.t = 0; this.dead = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt) {
    this.t += dt;
    this.vy += 1300 * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (chance(0.5)) Particles.burst(this.cx, this.cy, 1, { colors: ['#ff9f43', '#ffe156'], type: 'flame', sp1: 40, grav: -60, l1: 0.35, s1: 8, up: 0 });
    const gy = game.zombie ? game.zombie.groundY : 620;
    if (this.y + this.h > gy) {
      this.dead = true;
      AudioSys.sfx('steam');
      Particles.burst(this.cx, gy, 8, { colors: ['#ff6b35', '#ffe156'], type: 'flame', sp1: 160, grav: -100, l1: 0.5, s1: 10 });
    }
    if (overlaps(this, game.player)) {
      game.player.damage(1);
      this.dead = true;
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(this.t * 7);
    ctx.fillStyle = '#ff6b1a';
    ctx.beginPath(); ctx.ellipse(0, 0, 15, 12 + Math.sin(this.t * 20) * 2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffe156';
    ctx.beginPath(); ctx.arc(-2, -2, 7, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

// ================================================================ KING MAGMA (bonus boss)
// A giant goofy lava blob with a crown. Fire does nothing to him (he IS fire):
// stage 1 = ice x3, stage 2 = Power-block ram, stage 3 = rainbow friendship.
class Magma {
  constructor(x, groundY) {
    this.w = 150; this.h = 140;
    this.x = x; this.y = groundY - this.h;
    this.groundY = groundY;
    this.vx = 0; this.vy = 0;
    this.hp = 3;
    this.state = 'hidden';
    this.st = 0; this.t = rand(10);
    this.facing = -1;
    this.hits = 0;
    this.flashT = 0; this.wrongT = 0;
    this.spitT = 3;
    this.crownDrop = false;
    this.shoeLost = false; // unused, keeps the Zombie interface shape
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  setState(s) { this.state = s; this.st = 0; }
  update(dt) {
    const pl = game.player;
    this.t += dt; this.st += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    this.wrongT = Math.max(0, this.wrongT - dt);
    const arenaL = game.arenaL, arenaR = game.arenaR;
    switch (this.state) {
      case 'chase': {
        const fast = game.bossStage === 2;
        this.facing = pl.cx > this.cx ? 1 : -1;
        const onFloor = this.y + this.h >= this.groundY - 2;
        if (onFloor) {
          this.vx = 0;
          if (this.st > (fast ? 0.55 : 0.95)) { // blobby hop toward the player
            this.st = 0;
            this.vy = fast ? -520 : -420;
            this.vx = this.facing * (fast ? 260 : 160);
            AudioSys.sfx('blorp');
          }
        }
        this.vy += 1500 * dt;
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (this.y + this.h > this.groundY) {
          this.y = this.groundY - this.h; this.vy = 0;
          if (fast) game.shake = Math.max(game.shake, 0.12);
        }
        this.x = clamp(this.x, arenaL, arenaR - this.w);
        this.spitT -= dt;
        if (this.spitT <= 0) {
          this.spitT = fast ? rand(2, 2.8) : rand(2.8, 3.6);
          const dx = pl.cx - this.cx;
          game.shoes.push(new LavaBlob(this.cx, this.y + 40, clamp(dx * 1.1, -430, 430), -460));
          AudioSys.sfx('whoosh');
        }
        if (overlaps(this, pl)) {
          if (pl.superT > 0) {
            if (game.bossStage === 2) {
              this.setState('knocked');
              this.vx = (pl.cx > this.cx ? -1 : 1) * 520;
              this.vy = -420;
              AudioSys.sfx('boom');
              game.shake = Math.max(game.shake, 0.4);
              Particles.burst(this.cx, this.cy, 16, { colors: ['#ffe156', '#ff9f43', '#fff'], type: 'star', sp1: 380, l1: 0.8, s1: 12 });
            }
            // super mode shields the player either way
          } else pl.damage(1);
        }
        break;
      }
      case 'knocked':
        this.vy += 1500 * dt;
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (this.x <= arenaL || this.x + this.w >= arenaR || (this.y + this.h >= this.groundY && this.st > 0.35)) {
          this.x = clamp(this.x, arenaL, arenaR - this.w);
          this.y = Math.min(this.y, this.groundY - this.h);
          AudioSys.sfx('crash');
          game.shake = Math.max(game.shake, 0.5);
          Particles.burst(this.cx, this.y + this.h, 18, { colors: ['#ff6b35', '#ffe156', '#7a2a1a'], type: 'flame', sp1: 340, grav: -60, l1: 0.8, s1: 13 });
          this.loseHeart();
        }
        break;
      case 'dizzy':
        this.y = Math.min(this.y + 300 * dt, this.groundY - this.h);
        if (this.st > 2.2) this.setState('chase');
        break;
      case 'rainbowing':
        Particles.burst(this.cx + rand(-60, 60), this.y + rand(0, this.h), 2, { colors: RAINBOW, type: 'sparkle', sp1: 80, grav: -120, l1: 0.7, s1: 10, up: 0 });
        if (this.st > 2.5) {
          this.setState('friend');
          this.loseHeart();
          AudioSys.sfx('friend');
          Particles.burst(this.cx, this.cy, 26, { colors: ['#ff8fb0', '#ffd24a', '#fff'], type: 'heart', sp1: 340, l1: 1.1, s1: 13 });
          game.startEnding();
        }
        break;
      case 'friend': case 'dance':
        this.y = Math.min(this.y, this.groundY - this.h);
        break;
    }
  }
  loseHeart() {
    this.hp--;
    game.shake = Math.max(game.shake, 0.5);
    AudioSys.sfx('thud');
    Particles.burst(this.cx, this.y - 20, 12, { colors: ['#ff7d92', '#fff'], type: 'heart', sp1: 300, l1: 0.8, s1: 12 });
    if (this.hp === 2) { this.setState('dizzy'); game.setBossStage(2); }
    else if (this.hp === 1) { this.setState('dizzy'); game.setBossStage(3); }
  }
  hitBy(kind) {
    if (this.state === 'friend' || this.state === 'rainbowing' || this.state === 'knocked') return;
    const need = game.bossPlan[game.bossStage];
    if (kind !== need || need === 'power') { // power comes from ramming, not a projectile
      this.wrongT = 2;
      if (kind === 'fire') { // fireballs just feed him — funny slurp
        AudioSys.sfx('blorp');
        Particles.burst(this.cx, this.cy, 6, { colors: ['#ffe156'], type: 'flame', sp1: 120, l1: 0.4, s1: 9 });
      } else AudioSys.sfx('boing');
      return;
    }
    if (game.bossStage === 1 && (this.state === 'chase' || this.state === 'dizzy')) {
      this.hits++;
      this.flashT = 0.4;
      AudioSys.sfx('freeze');
      Particles.burst(this.cx, this.cy, 12, { colors: ['#d6f4ff', '#fff'], type: 'sparkle', sp1: 260, l1: 0.6, s1: 10 });
      if (this.hits >= 3) { this.hits = 0; this.loseHeart(); }
    } else if (game.bossStage === 3 && (this.state === 'chase' || this.state === 'dizzy')) {
      this.setState('rainbowing');
      AudioSys.sfx('rainbow');
    }
  }
  draw(ctx) {
    const t = this.t;
    const friend = this.state === 'friend' || this.state === 'dance';
    const x = this.x, y = this.y, w = this.w, h = this.h, cx = this.cx;
    ctx.save();
    let squish = 1 + Math.sin(t * 4) * 0.05;
    if (this.state === 'dance') squish = 1 + Math.abs(Math.sin(t * 7)) * 0.18;
    const airborne = this.y + this.h < this.groundY - 4;
    if (airborne) squish = 1.12;
    ctx.translate(cx, y + h);
    ctx.scale(2 - squish, squish);
    ctx.translate(-cx, -(y + h));
    // body: molten blob
    const g = ctx.createRadialGradient(cx, y + h * 0.55, 10, cx, y + h * 0.6, w * 0.62);
    if (friend) { g.addColorStop(0, '#ffd6ea'); g.addColorStop(0.55, '#ff8fd0'); g.addColorStop(1, '#c85fa0'); }
    else { g.addColorStop(0, '#ffe156'); g.addColorStop(0.5, '#ff8a2b'); g.addColorStop(1, '#c2451a'); }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 6, y + h);
    ctx.bezierCurveTo(x - 10, y + h * 0.35, x + w * 0.18, y - 8 + Math.sin(t * 3) * 4, cx, y - 4);
    ctx.bezierCurveTo(x + w * 0.82, y - 8 - Math.sin(t * 3) * 4, x + w + 10, y + h * 0.35, x + w + 6, y + h);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = friend ? '#a04a80' : '#8a2a10'; ctx.lineWidth = 4; ctx.stroke();
    // crust patches
    if (!friend) {
      ctx.fillStyle = 'rgba(122,42,26,0.7)';
      ctx.beginPath(); ctx.ellipse(x + 30, y + 46, 15, 9, 0.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + w - 32, y + 66, 12, 8, -0.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 44, y + 100, 10, 7, 0.2, 0, TAU); ctx.fill();
    }
    // drips
    const dripCol = friend ? '#ff8fd0' : '#ff8a2b';
    ctx.fillStyle = dripCol;
    for (let i = 0; i < 3; i++) {
      const dx2 = x + 24 + i * 48;
      const dh = 10 + ((Math.sin(t * 2 + i * 2) + 1) / 2) * 14;
      ctx.beginPath(); ctx.ellipse(dx2, y + h - 4, 7, dh, 0, 0, TAU); ctx.fill();
    }
    // ice-hit flash
    if (this.flashT > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashT * 1.6;
      ctx.fillStyle = '#bfe8ff';
      ctx.beginPath();
      ctx.moveTo(x - 6, y + h);
      ctx.bezierCurveTo(x - 10, y + h * 0.35, x + w * 0.18, y - 8, cx, y - 4);
      ctx.bezierCurveTo(x + w * 0.82, y - 8, x + w + 10, y + h * 0.35, x + w + 6, y + h);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // face
    const fy = y + h * 0.42;
    if (this.state === 'dizzy') {
      drawFace(ctx, cx, fy, 62, 'dizzy', t, 9);
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + i * TAU / 3;
        ctx.fillStyle = '#ffe156';
        starPath(ctx, cx + Math.cos(a) * 56, y - 8 + Math.sin(a) * 12, 9, 4.5);
        ctx.fill();
      }
    } else if (friend) {
      drawFace(ctx, cx, fy, 62, 'grin', t, 9);
      // cool-guy sunglasses
      ctx.fillStyle = '#2a1a2a';
      rr(ctx, cx - 34, fy - 18, 28, 16, 6); ctx.fill();
      rr(ctx, cx + 6, fy - 18, 28, 16, 6); ctx.fill();
      ctx.strokeStyle = '#2a1a2a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(cx - 6, fy - 12); ctx.lineTo(cx + 6, fy - 12); ctx.stroke();
    } else {
      // goofy mismatched eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - 20, fy - 8, 16, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 20, fy - 4, 10, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a1a10';
      ctx.beginPath(); ctx.arc(cx - 20 + this.facing * 5, fy - 8, 7, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 20 + this.facing * 3, fy - 4, 4.5, 0, TAU); ctx.fill();
      // big wobbly grin
      ctx.strokeStyle = '#3a1a10'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 30, fy + 18);
      ctx.quadraticCurveTo(cx, fy + 34 + Math.sin(t * 6) * 3, cx + 30, fy + 16);
      ctx.stroke();
      // stubby teeth
      ctx.fillStyle = '#fff';
      rr(ctx, cx - 12, fy + 20, 9, 10, 3); ctx.fill();
      rr(ctx, cx + 3, fy + 20, 9, 10, 3); ctx.fill();
    }
    // crown (slips over his eyes during the intro gag)
    ctx.save();
    const crY = this.crownDrop ? fy - 4 : y - 22;
    const crTilt = this.crownDrop ? 0.3 : Math.sin(t * 2) * 0.08 + 0.12;
    ctx.translate(cx + 14, crY);
    ctx.rotate(crTilt);
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.moveTo(-26, 12); ctx.lineTo(-26, -6); ctx.lineTo(-14, 4); ctx.lineTo(0, -12);
    ctx.lineTo(14, 4); ctx.lineTo(26, -6); ctx.lineTo(26, 12);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ff5a8a';
    ctx.beginPath(); ctx.arc(0, 4, 4.5, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.restore();
    // boss hearts
    if (!friend && game.bossStage > 0 && this.state !== 'rainbowing' && this.state !== 'dance') {
      for (let i = 0; i < 3; i++) {
        drawHeartIcon(ctx, cx - 44 + i * 44, y - 56 + Math.sin(t * 3 + i) * 3, 26, i < this.hp, t + i);
      }
    }
    // "wrong power" hint bubble
    if (this.wrongT > 0 && game.bossStage > 0) {
      const need = game.bossPlan[game.bossStage];
      const hy = y - 120 + Math.sin(t * 6) * 6;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath(); ctx.arc(cx, hy, 40, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 10, hy + 36); ctx.lineTo(cx, hy + 58); ctx.lineTo(cx + 12, hy + 34);
      ctx.closePath(); ctx.fill();
      drawBlock(ctx, cx - 26, hy - 26, 52, need, t);
    }
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

// ================================================================ adventure missions
// Small reusable mission kit (first use: Mountain World's Golden Key door).
//   Mission        — lifecycle: 'puzzle' -> 'reward' -> 'carrying' -> 'done'
//   MissionGate    — blocks the path until the mission item is brought to it
//   MissionItem    — the earned thing; floats along behind the player once taken
//   MissionToken   — a collectible puzzle piece (crystal/egg/truck part skins)
//   Shrine         — chest + ghost-silhouette sockets (CollectionPuzzle's home)
//   CollectionPuzzle — gather every token (any order), return, ceremony
//   TruckBuild     — Rally variant: the "shrine" is the broken monster truck
// The gate only cares that its mission reaches 'carrying' — future missions
// can earn their item any other way (different puzzles, rhythm pads, favors).
// Mission state lives on the level object, so it survives death/respawn and
// resets with the level, like every other in-level object.
class MissionItem {
  constructor(kind) {
    this.kind = kind;
    this.state = 'hidden'; // hidden -> waiting -> follow -> flying (into lock) -> used
    this.x = 0; this.y = 0; this.w = 76; this.h = 60;
    this.baseY = 0; this.t = rand(9);
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  revealAt(cx, cy) {
    if (this.state !== 'hidden') return;
    this.state = 'waiting';
    this.x = cx - this.w / 2; this.baseY = cy; this.y = cy - this.h / 2;
    Particles.burst(cx, cy, 14, { colors: ['#ffe156', '#fff'], type: 'star', sp1: 240, l1: 0.8, s1: 10, grav: 150 });
  }
  update(dt, pl) {
    this.t += dt;
    if (this.state === 'waiting') {
      this.y = this.baseY - this.h / 2 + Math.sin(this.t * 2.6) * 10;
      if (chance(0.2)) Particles.burst(this.cx + rand(-30, 30), this.cy + rand(-22, 22), 1, { colors: ['#ffe156', '#fff'], type: 'sparkle', sp1: 25, grav: -60, l1: 0.8, s1: 8, up: 0 });
      if (overlaps(this, pl)) {
        this.state = 'follow';
        AudioSys.sfx('powerup');
        pl.setMood('grin', 2);
        Particles.burst(this.cx, this.cy, 20, { colors: ['#ffe156', '#ffd24a', '#fff'], type: 'star', sp1: 300, l1: 0.9, s1: 12, grav: 220 });
      }
    } else if (this.state === 'follow') {
      // bob along just behind the hero — a walking "I have the key!" badge
      const tx = pl.cx - pl.facing * 62, ty = pl.y - 34 + Math.sin(this.t * 3) * 8;
      if (Math.hypot(tx - this.cx, ty - this.cy) > 650) { this.x = tx - this.w / 2; this.y = ty - this.h / 2; } // snap across respawn teleports
      const k = Math.min(1, dt * 5.5);
      this.x += (tx - this.cx) * k;
      this.y += (ty - this.cy) * k;
      if (chance(0.12)) Particles.burst(this.cx, this.cy + 10, 1, { colors: ['#ffe156'], type: 'sparkle', sp1: 15, grav: -40, l1: 0.7, s1: 7, up: 0 });
    }
  }
  draw(ctx) {
    if (this.state === 'hidden' || this.state === 'used') return;
    if (this.state === 'waiting') {
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(this.t * 3);
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(this.cx, this.cy, 62, 0, TAU); ctx.fill();
      ctx.restore();
    }
    drawKey(ctx, this.cx, this.cy, this.state === 'waiting' ? 78 : 58, this.t, true, this.kind === 'dinokey' ? 'dino' : 'gold');
  }
}

class MissionToken {
  // A collectible puzzle piece (Mountain crystal / Jungle dino egg) scattered
  // through the level. kind picks its color/icon (a POW key); skin picks the
  // artwork ('crystal' | 'egg'). Collect all of a CollectionPuzzle's tokens in
  // ANY order, then return to the Shrine.
  constructor(cx, cy, kind, skin) {
    this.kind = kind; this.skin = skin;
    this.w = 46; this.h = 52;
    this.x = cx - this.w / 2; this.baseY = cy; this.y = cy - this.h / 2;
    this.taken = false; this.t = rand(9);
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  static drawIcon(ctx, x, y, s, kind, skin, t = 0, ghost = false) {
    ctx.save();
    ctx.globalAlpha *= ghost ? 0.35 : 1;
    if (skin === 'egg') {
      ctx.fillStyle = '#fff6e0';
      ctx.beginPath(); ctx.ellipse(x, y, s * 0.42, s * 0.55, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#c9b88a'; ctx.lineWidth = Math.max(2, s * 0.07); ctx.stroke();
      ctx.fillStyle = POW[kind].c;
      for (const [ox, oy, r] of [[-0.16, -0.2, 0.13], [0.17, 0.05, 0.14], [-0.08, 0.28, 0.11]]) {
        ctx.beginPath(); ctx.arc(x + ox * s, y + oy * s, r * s, 0, TAU); ctx.fill();
      }
    } else if (skin === 'wheels') { // monster-truck tire pair (one component)
      for (const ox of [-0.16, 0.16]) {
        ctx.fillStyle = '#2e2430';
        ctx.beginPath(); ctx.arc(x + ox * s, y, s * 0.4, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#1a1420'; ctx.lineWidth = Math.max(2, s * 0.05);
        ctx.beginPath(); ctx.arc(x + ox * s, y, s * 0.4, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#4a3a50';
        for (let i = 0; i < 6; i++) {
          const a = t * 1.5 + i * TAU / 6 + ox;
          ctx.beginPath(); ctx.arc(x + ox * s + Math.cos(a) * s * 0.32, y + Math.sin(a) * s * 0.32, s * 0.07, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#c9c1d6';
        ctx.beginPath(); ctx.arc(x + ox * s, y, s * 0.14, 0, TAU); ctx.fill();
        ctx.fillStyle = '#8a7fae';
        starPath(ctx, x + ox * s, y, s * 0.11, s * 0.05, 5, t * 1.5);
        ctx.fill();
      }
    } else if (skin === 'engine') { // chunky engine block with pistons
      ctx.fillStyle = '#9a94b0';
      rr(ctx, x - s * 0.42, y - s * 0.22, s * 0.84, s * 0.52, s * 0.1); ctx.fill();
      ctx.strokeStyle = '#5f5a78'; ctx.lineWidth = Math.max(2, s * 0.06);
      rr(ctx, x - s * 0.42, y - s * 0.22, s * 0.84, s * 0.52, s * 0.1); ctx.stroke();
      ctx.fillStyle = '#c9c1d6';
      for (let i = -1; i <= 1; i++) { // piston stacks
        rr(ctx, x + i * s * 0.24 - s * 0.08, y - s * 0.46, s * 0.16, s * 0.26, s * 0.05); ctx.fill();
      }
      ctx.strokeStyle = '#5f5a78';
      for (let i = -1; i <= 1; i++) { rr(ctx, x + i * s * 0.24 - s * 0.08, y - s * 0.46, s * 0.16, s * 0.26, s * 0.05); ctx.stroke(); }
      ctx.fillStyle = POW[kind].c; // colored fan bolt
      starPath(ctx, x, y + s * 0.05, s * 0.16, s * 0.07, 5, t * 3);
      ctx.fill();
    } else if (skin === 'core') { // glowing power core canister
      ctx.fillStyle = POW[kind].c;
      rr(ctx, x - s * 0.26, y - s * 0.42, s * 0.52, s * 0.84, s * 0.16); ctx.fill();
      ctx.strokeStyle = POW[kind].c2; ctx.lineWidth = Math.max(2, s * 0.06);
      rr(ctx, x - s * 0.26, y - s * 0.42, s * 0.52, s * 0.84, s * 0.16); ctx.stroke();
      ctx.fillStyle = POW[kind].c2; // cap
      rr(ctx, x - s * 0.14, y - s * 0.52, s * 0.28, s * 0.14, s * 0.05); ctx.fill();
      ctx.fillStyle = '#fff'; // lightning bolt
      ctx.beginPath();
      ctx.moveTo(x + s * 0.05, y - s * 0.3); ctx.lineTo(x - s * 0.14, y + s * 0.06); ctx.lineTo(x - s * 0.01, y + s * 0.06);
      ctx.lineTo(x - s * 0.06, y + s * 0.32); ctx.lineTo(x + s * 0.15, y - s * 0.04); ctx.lineTo(x + s * 0.02, y - s * 0.04);
      ctx.closePath(); ctx.fill();
    } else { // crystal: a chunky gem
      ctx.fillStyle = POW[kind].c;
      ctx.strokeStyle = 'rgba(40,25,50,0.5)'; ctx.lineWidth = Math.max(2, s * 0.07); ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.55); ctx.lineTo(x + s * 0.42, y - s * 0.1);
      ctx.lineTo(x, y + s * 0.55); ctx.lineTo(x - s * 0.42, y - s * 0.1);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.moveTo(x - s * 0.05, y - s * 0.42); ctx.lineTo(x + s * 0.2, y - s * 0.14); ctx.lineTo(x - s * 0.16, y - s * 0.05);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  update(dt, pl, puzzle) {
    if (this.taken) return;
    this.t += dt;
    this.y = this.baseY - this.h / 2 + Math.sin(this.t * 2.6) * 8;
    if (chance(0.12)) Particles.burst(this.cx + rand(-20, 20), this.cy + rand(-20, 20), 1, { colors: [POW[this.kind].c, '#fff'], type: 'sparkle', sp1: 20, grav: -50, l1: 0.8, s1: 8, up: 0 });
    if (overlaps(this, pl)) {
      this.taken = true;
      Particles.burst(this.cx, this.cy, 16, { colors: [POW[this.kind].c, '#ffe156', '#fff'], type: 'star', sp1: 260, l1: 0.8, s1: 11, grav: 200 });
      pl.setMood('grin', 1.2);
      puzzle.onCollect(this);
    }
  }
  draw(ctx) {
    if (this.taken) return;
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.12 * Math.sin(this.t * 3);
    ctx.fillStyle = POW[this.kind].c;
    ctx.beginPath(); ctx.arc(this.cx, this.cy, 42, 0, TAU); ctx.fill();
    ctx.restore();
    MissionToken.drawIcon(ctx, this.cx, this.cy, 44, this.kind, this.skin, this.t);
  }
}

class Shrine {
  // The mission landmark: a treasure chest that has been here all along, plus
  // three sockets showing GHOST silhouettes of the missing tokens. Sockets fill
  // one at a time during the activation ceremony. Themes: 'stone' (Mountain
  // crystal pedestal) | 'nest' (Jungle dino nest with vines on the chest).
  constructor(cx, groundY, opts = {}) {
    this.cx = cx; this.groundY = groundY;
    this.theme = opts.theme || 'stone';
    this.t = rand(9);
    this.chest = new Chest(cx, groundY);
    this.chest.y = this.chest.targetY;
    this.chest.landed = true;
    this.lit = 0;   // sockets filled during activation
    this.gagT = 0;  // nest: baby-eye peek timer
  }
  socketPos(i) {
    return { x: this.cx + (i - 1) * 58, y: this.chest.y - 64 };
  }
  update(dt) {
    this.t += dt;
    this.gagT = Math.max(0, this.gagT - dt);
    this.chest.update(dt);
  }
  draw(ctx, tokens) {
    const t = this.t, g = this.groundY;
    // base
    if (this.theme === 'nest') {
      ctx.fillStyle = '#8a9a7a';
      rr(ctx, this.cx - 110, g - 16, 220, 20, 8); ctx.fill();
      ctx.strokeStyle = '#5a6a50'; ctx.lineWidth = 3;
      rr(ctx, this.cx - 110, g - 16, 220, 20, 8); ctx.stroke();
    } else {
      ctx.fillStyle = '#8d8fa0';
      rr(ctx, this.cx - 105, g - 14, 210, 18, 7); ctx.fill();
      ctx.strokeStyle = '#5f6070'; ctx.lineWidth = 3;
      rr(ctx, this.cx - 105, g - 14, 210, 18, 7); ctx.stroke();
    }
    this.chest.draw(ctx);
    // vines over a still-locked jungle chest
    if (this.theme === 'nest' && !this.chest.open) {
      ctx.strokeStyle = '#3f9c3a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (const vx of [-46, 0, 44]) {
        const wob = Math.sin(t * 1.5 + vx) * 3;
        ctx.beginPath();
        ctx.moveTo(this.chest.cx + vx - 18, this.chest.y - 4);
        ctx.quadraticCurveTo(this.chest.cx + vx + wob, this.chest.y + 50, this.chest.cx + vx + 14, this.chest.y + this.chest.h + 2);
        ctx.stroke();
      }
    }
    // socket panel above the chest: ghost silhouettes of what's missing
    for (let i = 0; i < tokens.length; i++) {
      const sp = this.socketPos(i), tk = tokens[i];
      const placed = i < this.lit;
      if (this.theme === 'nest') { // stone nest bowls
        ctx.fillStyle = placed ? '#c8d4b4' : '#a8b494';
        ctx.beginPath(); ctx.ellipse(sp.x, sp.y + 16, 26, 12, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#6a7a5a'; ctx.lineWidth = 3; ctx.stroke();
      } else { // stone sockets
        ctx.fillStyle = placed ? '#d8dae8' : '#75778a';
        rr(ctx, sp.x - 24, sp.y - 24, 48, 48, 10); ctx.fill();
        ctx.strokeStyle = '#4a4c5c'; ctx.lineWidth = 3;
        rr(ctx, sp.x - 24, sp.y - 24, 48, 48, 10); ctx.stroke();
      }
      if (placed) {
        ctx.save();
        ctx.globalAlpha = 0.4 + 0.2 * Math.sin(t * 4 + i);
        ctx.fillStyle = POW[tk.kind].c;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 34, 0, TAU); ctx.fill();
        ctx.restore();
        MissionToken.drawIcon(ctx, sp.x, sp.y, 36, tk.kind, tk.skin, t);
        ctx.fillStyle = '#ffe156';
        starPath(ctx, sp.x + 20, sp.y - 20, 8, 3.5);
        ctx.fill();
      } else {
        // ghost of the missing piece; pulses brighter once it's been collected
        ctx.save();
        if (tk.taken) ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 5 + i);
        MissionToken.drawIcon(ctx, sp.x, sp.y, 36, tk.kind, tk.skin, t, !tk.taken);
        ctx.restore();
      }
      // the gag: one nest egg cracks and a little eye peeks out
      if (this.theme === 'nest' && placed && i === 1 && this.gagT > 0) {
        ctx.strokeStyle = '#a08a5a'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sp.x - 8, sp.y - 8); ctx.lineTo(sp.x - 2, sp.y - 2); ctx.lineTo(sp.x - 8, sp.y + 4);
        ctx.stroke();
        if (this.gagT > 0.35) {
          ctx.fillStyle = '#3a2a3a';
          ctx.beginPath(); ctx.arc(sp.x - 4, sp.y - 1, 2.6, 0, TAU); ctx.fill();
        }
      }
    }
  }
}

class CollectionPuzzle {
  // The distributed adventure objective: find every MissionToken anywhere in
  // the level (any order), then come back to the Shrine. Tokens stay collected
  // through deaths/checkpoints (mission state lives on the level object).
  // Timeline on return: tokens fly into sockets one by one -> shrine shakes ->
  // chest opens -> the mission item is revealed. No wrong inputs exist.
  constructor(tokens, shrine) {
    this.tokens = tokens; this.shrine = shrine;
    this.done = false;
    this.state = 'collect'; // -> 'activating' -> 'done'
    this.actT = 0; this.toastT = 0;
    this.flyFrom = null;
  }
  count() { return this.tokens.filter(tk => tk.taken).length; }
  onCollect(token) {
    this.toastT = 2.6;
    const left = this.tokens.length - this.count();
    AudioSys.sfx(left === 0 ? 'powerup' : 'collect');
    if (left === 0) AudioSys.sfx('heart'); // "you got ALL of them!"
  }
  update(dt, pl, active, mission) {
    this.shrine.update(dt);
    this.toastT = Math.max(0, this.toastT - dt);
    for (const tk of this.tokens) tk.update(dt, pl, this);
    if (this.state === 'collect' && this.count() === this.tokens.length &&
        Math.abs(pl.cx - this.shrine.cx) < 250 && Math.abs(pl.cy - this.shrine.groundY) < 300) {
      this.state = 'activating'; this.actT = 0;
      this.flyFrom = { x: pl.cx, y: pl.y - 20 };
      AudioSys.sfx('fanfare');
    }
    if (this.state === 'activating') {
      const prev = this.actT;
      this.actT += dt;
      for (let i = 0; i < this.tokens.length; i++) {
        const tt = 0.55 + i * 0.55;
        if (prev < tt && this.actT >= tt) {
          this.shrine.lit = i + 1;
          AudioSys.sfx(this.shrine.theme === 'nest' ? 'hiccup' : 'collect');
          const sp = this.shrine.socketPos(i);
          Particles.burst(sp.x, sp.y, 10, { colors: [POW[this.tokens[i].kind].c, '#fff'], type: 'star', sp1: 200, l1: 0.7, s1: 9, grav: 180 });
          if (this.shrine.theme === 'nest' && i === 1) this.shrine.gagT = 1.4;
        }
      }
      if (prev < 2.2 && this.actT >= 2.2) {
        game.shake = Math.max(game.shake, 0.3);
        AudioSys.sfx(this.shrine.theme === 'nest' ? 'grind' : 'rumble');
      }
      if (prev < 2.8 && this.actT >= 2.8) {
        this.shrine.chest.open = true;
        AudioSys.sfx('chest');
        mission.item.revealAt(this.shrine.cx, this.shrine.chest.y - 70);
        this.done = true;
        this.state = 'done';
      }
    }
  }
  draw(ctx, t) {
    this.shrine.draw(ctx, this.tokens);
    for (const tk of this.tokens) tk.draw(ctx);
    // tokens flying home during the ceremony
    if (this.state === 'activating' && this.flyFrom) {
      for (let i = 0; i < this.tokens.length; i++) {
        const tt = 0.55 + i * 0.55;
        if (this.actT >= tt || this.actT < tt - 0.55) continue;
        const k = clamp((this.actT - (tt - 0.55)) / 0.55, 0, 1);
        const e = k * k * (3 - 2 * k);
        const sp = this.shrine.socketPos(i);
        const fx = lerp(this.flyFrom.x, sp.x, e);
        const fy = lerp(this.flyFrom.y, sp.y, e) - Math.sin(k * Math.PI) * 70;
        MissionToken.drawIcon(ctx, fx, fy, 40, this.tokens[i].kind, this.tokens[i].skin, t);
      }
    }
    // wordless progress toast above the hero after each pickup
    if (this.toastT > 0 && game.player) {
      const pl = game.player;
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.toastT * 2);
      const bx = pl.cx, by = pl.y - 58 + Math.sin(t * 5) * 3;
      ctx.fillStyle = '#fff';
      rr(ctx, bx - 66, by - 26, 132, 52, 18); ctx.fill();
      ctx.strokeStyle = '#5a4a86'; ctx.lineWidth = 3;
      rr(ctx, bx - 66, by - 26, 132, 52, 18); ctx.stroke();
      for (let i = 0; i < this.tokens.length; i++) {
        const tk = this.tokens[i];
        ctx.save();
        ctx.globalAlpha *= tk.taken ? 1 : 0.3;
        MissionToken.drawIcon(ctx, bx + (i - 1) * 40, by, 30, tk.kind, tk.skin, t);
        ctx.restore();
        if (tk.taken) { ctx.fillStyle = '#ffe156'; starPath(ctx, bx + (i - 1) * 40 + 13, by - 13, 6, 2.6); ctx.fill(); }
      }
      ctx.restore();
    }
  }
}

class MissionGate {
  constructor(cx, groundY, opts = {}) {
    this.theme = opts.theme || 'wood'; // 'wood' (Mountain door) | 'jungle' (ancient stone gate)
    const jungle = this.theme === 'jungle';
    this.w = jungle ? 150 : 116; this.h = jungle ? 280 : 210;
    this.x = cx - this.w / 2; this.y = groundY - this.h; this.groundY = groundY;
    this.keyStyle = jungle ? 'dino' : 'gold';
    this.bumpSfx = jungle ? 'grind' : 'thud';
    this.leafColors = jungle ? ['#57d357', '#7be07b', '#ffe156', '#ff8fb0'] : RAINBOW;
    this.t = rand(9);
    this.state = 'locked'; // locked -> unlocking -> open
    this.bumpT = 0; this.bumpCd = 0; this.hintT = 0; this.unlockT = 0; this.openT = 0;
    this.keyFly = null;
    this.solid = { x: this.x + 12, y: this.y, w: this.w - 24, h: this.h, skipDraw: true };
  }
  get cx() { return this.x + this.w / 2; }
  khY() { return this.y + (this.theme === 'jungle' ? 172 : 132); }
  update(dt, pl, mission) {
    this.t += dt;
    this.bumpT = Math.max(0, this.bumpT - dt);
    this.bumpCd = Math.max(0, this.bumpCd - dt);
    this.hintT = Math.max(0, this.hintT - dt);
    if (this.state === 'locked') {
      const near = Math.abs(pl.cx - this.cx) < 170 && pl.y + pl.h > this.y + 30 && pl.y < this.groundY + 40;
      if (mission.state === 'carrying' && near) {
        // the door notices the key!
        this.state = 'unlocking'; this.unlockT = 0;
        mission.item.state = 'flying';
        this.keyFly = { x: mission.item.cx, y: mission.item.cy };
        AudioSys.sfx('switch');
        Particles.burst(this.cx, this.khY(), 10, { colors: ['#ffe156', '#fff'], type: 'sparkle', sp1: 80, grav: -60, l1: 0.8, s1: 9, up: 0 });
      } else if (near && this.bumpCd <= 0) {
        const s = this.solid;
        const pushR = keys.ArrowRight && pl.cx < this.cx && pl.x + pl.w > s.x - 8;
        const pushL = keys.ArrowLeft && pl.cx > this.cx && pl.x < s.x + s.w + 8;
        if (pushR || pushL) {
          this.bumpT = 0.55; this.bumpCd = 1.4; this.hintT = 2.4;
          AudioSys.sfx(this.bumpSfx);
          game.shake = Math.max(game.shake, 0.15);
          Particles.burst(pushR ? s.x : s.x + s.w, pl.cy, 6, { colors: ['#d9b98a', '#fff'], sp1: 130, l1: 0.5, s1: 7 });
        }
      }
    } else if (this.state === 'unlocking') {
      this.unlockT += dt;
      const it = mission.item;
      if (it.state === 'flying') {
        const p = Math.min(1, this.unlockT / 0.9);
        const e = p * p * (3 - 2 * p);
        it.x = lerp(this.keyFly.x, this.cx, e) - it.w / 2;
        it.y = lerp(this.keyFly.y, this.khY(), e) - it.h / 2 - Math.sin(p * Math.PI) * 60;
        if (p >= 1) {
          it.state = 'used';
          AudioSys.sfx('chest');
          game.shake = Math.max(game.shake, 0.25);
          Particles.burst(this.cx, this.khY(), 16, { colors: ['#ffe156', '#fff'], type: 'star', sp1: 260, l1: 0.8, s1: 11, grav: 200 });
        }
      }
      if (this.unlockT > 1.5) {
        this.state = 'open'; this.openT = 0;
        this.solid.broken = true; // same removal trick the smashable walls use
        AudioSys.sfx('fanfare');
        if (this.theme === 'jungle') AudioSys.sfx('grind');
        Particles.burst(this.cx, this.y + 60, 26, { colors: this.leafColors, type: 'confetti', sp1: 300, l1: 1.6, s1: 11, grav: 260, up: 200 });
      }
    } else this.openT += dt;
  }
  drawKeyhole(ctx, plateCol, edgeCol, r = 26) {
    const cx = this.cx, ky = this.khY();
    ctx.fillStyle = plateCol;
    ctx.beginPath(); ctx.arc(cx, ky, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = edgeCol; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#4a3520';
    ctx.beginPath(); ctx.arc(cx, ky - 5, r * 0.31, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.19, ky - 2); ctx.lineTo(cx + r * 0.19, ky - 2);
    ctx.lineTo(cx + r * 0.31, ky + r * 0.62); ctx.lineTo(cx - r * 0.31, ky + r * 0.62);
    ctx.closePath(); ctx.fill();
    if (this.state === 'locked' && chance(0.02)) {
      Particles.burst(cx + rand(-12, 12), ky + rand(-12, 12), 1, { colors: ['#fff', '#ffe156'], type: 'sparkle', sp1: 15, grav: -30, l1: 0.7, s1: 7, up: 0 });
    }
  }
  gateMood() {
    if (this.state === 'open') return 'grin';
    if (this.state === 'unlocking') return this.unlockT < 0.9 ? 'surprised' : 'grin';
    if (this.bumpT > 0) return 'surprised';
    if (this.hintT > 0) return 'worried';
    return 'sleepy';
  }
  draw(ctx) {
    const t = this.t, cx = this.cx;
    const bx = this.bumpT > 0 ? Math.sin(this.bumpT * 34) * 7 * this.bumpT : 0;
    ctx.save();
    ctx.translate(bx, 0);
    if (this.theme === 'jungle') this.drawJungle(ctx, t, cx);
    else this.drawWood(ctx, t, cx);
    // "I need a key" thought bubble
    if (this.hintT > 0 && this.state === 'locked') {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.hintT * 2);
      const by = this.y - 66 + Math.sin(t * 5) * 5;
      ctx.fillStyle = '#fff';
      rr(ctx, cx - 56, by - 34, 112, 68, 22); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 12, by + 32); ctx.lineTo(cx + 12, by + 32); ctx.lineTo(cx, by + 52);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#5a4a86'; ctx.lineWidth = 3;
      rr(ctx, cx - 56, by - 34, 112, 68, 22); ctx.stroke();
      drawKey(ctx, cx, by, 62, t, false, this.keyStyle);
      ctx.restore();
    }
    ctx.restore();
  }
  drawWood(ctx, t, cx) {
    // Mountain-style wooden door in a stone frame
    ctx.fillStyle = '#8d8fa0';
    rr(ctx, this.x - 16, this.y - 16, this.w + 32, this.h + 16, 26); ctx.fill();
    ctx.strokeStyle = '#5f6070'; ctx.lineWidth = 5;
    rr(ctx, this.x - 16, this.y - 16, this.w + 32, this.h + 16, 26); ctx.stroke();
    ctx.fillStyle = '#2a2140';
    rr(ctx, this.x, this.y, this.w, this.h, 18); ctx.fill();
    const swg = this.state === 'open' ? Math.max(0.1, 1 - this.openT * 1.6) : 1;
    if (swg > 0.11) {
      ctx.save();
      ctx.translate(this.x, 0); ctx.scale(swg, 1); ctx.translate(-this.x, 0);
      ctx.fillStyle = '#b0743e';
      rr(ctx, this.x, this.y, this.w, this.h, 18); ctx.fill();
      ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 4;
      rr(ctx, this.x, this.y, this.w, this.h, 18); ctx.stroke();
      for (const px of [this.x + this.w / 3, this.x + this.w * 2 / 3]) {
        ctx.beginPath(); ctx.moveTo(px, this.y + 8); ctx.lineTo(px, this.y + this.h - 8); ctx.stroke();
      }
      ctx.fillStyle = '#ffd24a';
      for (const hy of [this.y + 30, this.y + this.h - 42]) { rr(ctx, this.x + 4, hy, 20, 12, 5); ctx.fill(); }
      drawFace(ctx, cx, this.y + 60, 46, this.gateMood(), t, 77);
      this.drawKeyhole(ctx, '#ffd24a', '#c8861b', 26);
      ctx.restore();
    }
  }
  drawJungle(ctx, t, cx) {
    // Ancient stone gate: mossy blocks, dino carvings, statues, rising slab
    // frame
    ctx.fillStyle = '#8a9a7a';
    rr(ctx, this.x - 22, this.y - 26, this.w + 44, this.h + 26, 22); ctx.fill();
    ctx.strokeStyle = '#5a6a50'; ctx.lineWidth = 5;
    rr(ctx, this.x - 22, this.y - 26, this.w + 44, this.h + 26, 22); ctx.stroke();
    // moss cushions on the lintel
    ctx.fillStyle = '#57b84a';
    for (const [mx, mr] of [[-40, 16], [10, 20], [55, 14]]) {
      ctx.beginPath(); ctx.ellipse(cx + mx, this.y - 24, mr, 9, 0, Math.PI, TAU); ctx.fill();
    }
    // lintel face — the gate's expressive stone face
    drawFace(ctx, cx, this.y + 8, 42, this.gateMood(), t, 78);
    // flanking dino statues on plinths
    for (const side of [-1, 1]) {
      const sx = cx + side * (this.w / 2 + 44);
      ctx.fillStyle = '#7a8a6a';
      rr(ctx, sx - 24, this.groundY - 34, 48, 34, 6); ctx.fill();
      ctx.strokeStyle = '#5a6a50'; ctx.lineWidth = 3;
      rr(ctx, sx - 24, this.groundY - 34, 48, 34, 6); ctx.stroke();
      ctx.fillStyle = '#8a9a7a';
      ctx.beginPath(); ctx.ellipse(sx, this.groundY - 52, 20, 14, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#8a9a7a'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx + side * 8, this.groundY - 58);
      ctx.quadraticCurveTo(sx + side * 22, this.groundY - 88, sx + side * 12, this.groundY - 100);
      ctx.stroke();
      ctx.fillStyle = '#8a9a7a';
      ctx.beginPath(); ctx.arc(sx + side * 12, this.groundY - 102, 8, 0, TAU); ctx.fill();
    }
    // dark opening
    ctx.fillStyle = '#1e2a18';
    rr(ctx, this.x, this.y, this.w, this.h, 14); ctx.fill();
    // stone slab rises into the lintel once open
    const rise = this.state === 'open' ? Math.min(1, this.openT * 1.1) * (this.h - 24) : 0;
    if (rise < this.h - 26) {
      ctx.save();
      rr(ctx, this.x, this.y, this.w, this.h, 14); ctx.clip();
      const sy = this.y - rise;
      ctx.fillStyle = '#a8b494';
      rr(ctx, this.x, sy, this.w, this.h, 14); ctx.fill();
      ctx.strokeStyle = '#6a7a5a'; ctx.lineWidth = 3;
      rr(ctx, this.x, sy, this.w, this.h, 14); ctx.stroke();
      // stone block seams
      for (let r = 1; r < 4; r++) {
        ctx.beginPath(); ctx.moveTo(this.x + 6, sy + r * this.h / 4); ctx.lineTo(this.x + this.w - 6, sy + r * this.h / 4); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(cx, sy + 8); ctx.lineTo(cx, sy + this.h / 4);
      ctx.moveTo(cx, sy + this.h / 2); ctx.lineTo(cx, sy + this.h * 0.75); ctx.stroke();
      // little dino carvings
      ctx.strokeStyle = '#7a8a6a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (const [ox, oy, sd] of [[-38, 60, 1], [38, 60, -1], [-38, 236, -1], [38, 236, 1]]) {
        ctx.beginPath();
        ctx.moveTo(cx + ox - sd * 12, sy + oy);
        ctx.quadraticCurveTo(cx + ox + sd * 4, sy + oy - 18, cx + ox + sd * 14, sy + oy - 22);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + ox + sd * 15, sy + oy - 24, 5, 0, TAU); ctx.stroke();
      }
      // keyhole rides the slab
      ctx.translate(0, -rise);
      this.drawKeyhole(ctx, '#ffd24a', '#c8861b', 32);
      ctx.translate(0, rise);
      ctx.restore();
    }
    // hanging vines over the frame
    ctx.strokeStyle = '#3f9c3a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (const vx of [-this.w / 2 + 8, -14, this.w / 2 - 20]) {
      const wob = Math.sin(t * 1.6 + vx) * 4;
      ctx.beginPath();
      ctx.moveTo(cx + vx, this.y - 22);
      ctx.quadraticCurveTo(cx + vx + wob, this.y + 30, cx + vx + wob * 2, this.y + 66 + (vx % 3) * 8);
      ctx.stroke();
      ctx.fillStyle = '#57b84a';
      ctx.beginPath(); ctx.ellipse(cx + vx + wob * 2, this.y + 70 + (vx % 3) * 8, 8, 4, 0.5, 0, TAU); ctx.fill();
    }
  }
}

class Mission {
  constructor(id, gate, puzzle, item) {
    this.id = id;
    this.state = 'puzzle'; // -> 'reward' (item revealed) -> 'carrying' -> 'done'
    this.gate = gate; this.puzzle = puzzle; this.item = item;
  }
  update(dt, pl) {
    this.puzzle.update(dt, pl, this.state === 'puzzle', this);
    if (this.state === 'puzzle' && this.puzzle.done) this.state = 'reward';
    this.item.update(dt, pl);
    if (this.state === 'reward' && this.item.state === 'follow') this.state = 'carrying';
    this.gate.update(dt, pl, this);
    if (this.state !== 'done' && this.gate.state === 'open') this.state = 'done';
  }
  draw(ctx, t) {
    this.gate.draw(ctx);
    this.puzzle.draw(ctx, t);
    this.item.draw(ctx);
  }
}

// ================================================================ fire-breather
// Squat fire-breathing dino (first used in Dino Jungle). Lives in lv.spiders so
// all existing enemy plumbing applies unchanged (update/draw loops, projectile
// hits, body-touch damage, party dancing). Cycle: idle -> inhale (cheeks puff =
// THE telegraph) -> low horizontal flame. Jumping over the flame is the answer:
// the flame box hugs the ground. Ice pauses him, rainbow befriends him, fire
// just makes him burp. Timing is configurable per placement (offset staggers).
class FireBreather {
  constructor(cx, groundY, dir = -1, opt = {}) {
    this.kind = 'firedino';
    this.w = 76; this.h = 64;
    this.x = cx - this.w / 2; this.y = groundY - this.h;
    this.groundY = groundY;
    this.dir = dir;
    this.state = 'angry'; // angry | frozen | friend
    this.dead = false; this.danceT = 0; this.frozenT = 0; this.burpT = 0;
    this.t = rand(9);
    this.cycle = opt.cycle || 3.8; // idle 0-1.6, inhale 1.6-2.7, fire 2.7-cycle
    this.cycleT = opt.offset || 0;
    this.range = opt.range || 210; // flame length
    this.stage = 'idle';
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  flameBox() {
    const mx = this.dir > 0 ? this.x + this.w - 6 : this.x + 6;
    return { x: this.dir > 0 ? mx : mx - this.range, y: this.groundY - 48, w: this.range, h: 44 };
  }
  nearCam() { return Math.abs(this.cx - (game.cam.x + W / 2)) < W * 0.8; }
  hit(kind) {
    if (kind === 'ice') {
      this.state = 'frozen'; this.frozenT = 4; this.stage = 'idle';
      AudioSys.sfx('freeze');
      Particles.burst(this.cx, this.cy, 10, { colors: ['#d6f4ff', '#7fd8ff'], type: 'sparkle', sp1: 160, l1: 0.7, s1: 9, grav: 100 });
    } else if (kind === 'rainbow') {
      this.befriend();
    } else if (kind === 'fire') {
      // fire just makes him burp a smoke ring — funny, harmless
      this.burpT = 0.8;
      AudioSys.sfx('hiccup');
      Particles.burst(this.cx + this.dir * 30, this.y + 16, 6, { colors: ['#c9c9d8', '#fff'], type: 'bubble', sp1: 90, grav: -120, l1: 0.8, s1: 10, up: 20 });
    }
  }
  befriend() {
    if (this.state === 'friend') return;
    this.state = 'friend'; this.danceT = 1; this.stage = 'idle';
    AudioSys.sfx('friend');
    Particles.burst(this.cx, this.y, 12, { colors: ['#ff8fb0', '#fff'], type: 'heart', sp1: 200, l1: 1, s1: 11, grav: 150 });
  }
  knockAway(fromX) {
    this.x += Math.sign(this.cx - fromX) * 26;
    AudioSys.sfx('poof');
    Particles.burst(this.cx, this.cy, 8, { colors: ['#ffe156', '#fff'], type: 'star', sp1: 220, l1: 0.6, s1: 9, grav: 300 });
  }
  update(dt) {
    this.t += dt;
    this.danceT = Math.max(0, this.danceT - dt);
    this.burpT = Math.max(0, this.burpT - dt);
    if (this.state === 'frozen') {
      this.frozenT -= dt;
      if (this.frozenT <= 0) {
        this.state = 'angry'; this.cycleT = 0;
        AudioSys.sfx('shatter');
        Particles.burst(this.cx, this.cy, 10, { colors: ['#d6f4ff', '#fff'], type: 'block', sp1: 220, l1: 0.6, s1: 9, grav: 500 });
      }
      return;
    }
    if (this.state === 'friend') return;
    const prev = this.stage;
    this.cycleT = (this.cycleT + dt) % this.cycle;
    this.stage = this.cycleT < 1.6 ? 'idle' : this.cycleT < 2.7 ? 'inhale' : 'fire';
    if (this.stage === 'inhale' && prev === 'idle' && this.nearCam()) AudioSys.sfx('inhale');
    if (this.stage === 'fire' && prev !== 'fire' && this.nearCam()) AudioSys.sfx('fire');
    if (this.stage === 'fire') {
      const fb = this.flameBox();
      if (chance(0.8)) Particles.burst(fb.x + rand(0, fb.w), fb.y + rand(6, fb.h - 6), 1, { colors: ['#ff9f43', '#ffe156', '#ff6b35'], type: 'flame', sp1: 60, grav: -80, l1: 0.4, s1: 12, up: 10 });
      const pl = game.player;
      if (game.state === 'play' && pl.superT <= 0 && overlaps(fb, pl)) {
        pl.damage(1);
        pl.vx = this.dir * 320; // gentle shove along the flame, out of danger
      }
    }
  }
  draw(ctx) {
    const t = this.t, facing = this.dir;
    const inhale = this.stage === 'inhale' ? Math.min(1, (this.cycleT - 1.6) / 0.9) : 0;
    const puff = 1 + inhale * 0.35 + (this.stage === 'fire' ? 0.12 : 0);
    const bob = Math.sin(t * 3) * 2;
    const hop = (this.danceT > 0 || this.state === 'friend') ? Math.abs(Math.sin(t * 6)) * 8 : 0;
    const bx = this.cx, by = this.y + this.h - hop;
    ctx.save();
    // fire stream (behind the body so the mouth reads on top)
    if (this.state === 'angry' && this.stage === 'fire') {
      const fb = this.flameBox();
      const prog = Math.min(1, (this.cycleT - 2.7) / 0.25);
      const len = fb.w * prog;
      const x0 = facing > 0 ? fb.x : fb.x + fb.w - len;
      for (let fx = 0; fx < len; fx += 22) {
        const wob = Math.sin(t * 22 + fx * 0.2) * 5;
        ctx.fillStyle = ['#ff6b35', '#ff9f43', '#ffe156'][Math.floor((fx / 22 + t * 10) % 3)];
        ctx.beginPath();
        ctx.arc(x0 + fx + 11, fb.y + fb.h / 2 + wob, 14 + Math.sin(fx * 0.11 + t * 14) * 5, 0, TAU);
        ctx.fill();
      }
    }
    // tail
    ctx.strokeStyle = '#e8703a'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx - facing * 24, by - 18);
    ctx.quadraticCurveTo(bx - facing * 52, by - 30 + bob, bx - facing * 60, by - 8);
    ctx.stroke();
    // body
    ctx.fillStyle = '#ff8a4a';
    ctx.beginPath(); ctx.ellipse(bx, by - 26 + bob, 34 * puff, 26 * puff, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#c2451a'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ffe9c0';
    ctx.beginPath(); ctx.ellipse(bx + facing * 6, by - 18 + bob, 20 * puff, 14 * puff, 0, 0, TAU); ctx.fill();
    // legs
    ctx.fillStyle = '#e8703a';
    for (const lx of [-18, 18]) { rr(ctx, bx + lx - 7, by - 10, 14, 12, 5); ctx.fill(); }
    // back spikes
    ctx.fillStyle = '#ffd24a';
    for (let i = 0; i < 3; i++) {
      const sx = bx - facing * (4 + i * 14);
      ctx.beginPath();
      ctx.moveTo(sx - 6, by - 44 + bob); ctx.lineTo(sx, by - 57 + bob); ctx.lineTo(sx + 6, by - 44 + bob);
      ctx.closePath(); ctx.fill();
    }
    // head + snout
    const hx = bx + facing * 26, hy = by - 42 + bob;
    ctx.fillStyle = '#ff8a4a';
    ctx.beginPath(); ctx.arc(hx, hy, 20 * (1 + inhale * 0.2), 0, TAU); ctx.fill();
    ctx.strokeStyle = '#c2451a'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hx + facing * 16, hy + 6, 12, 8, 0, 0, TAU); ctx.fill(); ctx.stroke();
    // puffed cheeks — THE "fire is coming" telegraph
    if (inhale > 0) {
      ctx.fillStyle = '#ffb35c';
      ctx.beginPath(); ctx.arc(hx + facing * 7, hy + 9, 6 + inhale * 13, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#c2451a'; ctx.stroke();
      if (chance(0.3)) Particles.burst(hx, hy - 26, 1, { colors: ['#ffe156'], type: 'sparkle', sp1: 20, grav: -40, l1: 0.4, s1: 7, up: 0 });
    }
    // burp smoke ring
    if (this.burpT > 0 && chance(0.4)) {
      Particles.burst(hx + facing * 22, hy, 1, { colors: ['#c9c9d8'], type: 'bubble', sp1: 50, grav: -100, l1: 0.6, s1: 9, up: 10 });
    }
    const mood = this.state === 'friend' ? 'grin' : (this.stage === 'fire' || inhale > 0.4) ? 'surprised' : 'happy';
    drawFace(ctx, hx - facing * 2, hy - 3, 20, mood, t, 55, facing, 0);
    // frozen ice cube overlay
    if (this.state === 'frozen') {
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = '#bfe8ff';
      rr(ctx, this.x - 6, this.y - 12, this.w + 12, this.h + 12, 10); ctx.fill();
      ctx.strokeStyle = '#7fd8ff'; ctx.lineWidth = 3;
      rr(ctx, this.x - 6, this.y - 12, this.w + 12, this.h + 12, 10); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

// ================================================================ spinosaurus boss
// Giant fire-breathing Spinosaurus guarding the Secret Dino Valley (level 10).
// Lives in the shared game.zombie boss slot — same interface as Zombie/Magma
// (update/draw/hitBy/setState/hp/groundY/hits). Plan: ice x3 douses his flame
// (stage 1) -> fire x3 gives him the hiccups (stage 2, his own medicine!) ->
// rainbow befriends him (stage 3). Once a friend, the valley walls crumble and
// he breathes CONFETTI instead of fire.
class Spino {
  constructor(x, groundY) {
    this.w = 200; this.h = 190;
    this.x = x; this.y = groundY - this.h;
    this.groundY = groundY;
    this.vx = 0; this.vy = 0;
    this.hp = 3;
    this.state = 'intro';
    this.st = 0; this.t = rand(10);
    this.facing = -1;
    this.hits = 0;
    this.flashT = 0; this.wrongT = 0; this.hiccupT = 0;
    this.breathT = rand(1); // stage-1 fire cycle: walk<2.2, inhale<3.2, fire<4.4
    this.confettiT = 3;
    this.crownDrop = false; this.shoeLost = false; // Zombie interface shape
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  setState(s) { this.state = s; this.st = 0; }
  breath() {
    if (game.bossStage !== 1 || this.state !== 'chase') return 'walk';
    return this.breathT < 2.2 ? 'walk' : this.breathT < 3.2 ? 'inhale' : 'fire';
  }
  flameBox() {
    const mx = this.facing > 0 ? this.x + this.w - 14 : this.x + 14;
    const range = 320;
    return { x: this.facing > 0 ? mx : mx - range, y: this.groundY - 68, w: range, h: 62 };
  }
  update(dt) {
    const pl = game.player;
    this.t += dt; this.st += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    this.wrongT = Math.max(0, this.wrongT - dt);
    this.hiccupT = Math.max(0, this.hiccupT - dt);
    const arenaL = game.arenaL, arenaR = game.arenaR;
    switch (this.state) {
      case 'chase': {
        const tantrum = game.bossStage >= 2; // flames doused -> stompy tantrum
        const br = this.breath();
        if (br === 'walk') {
          this.facing = pl.cx > this.cx ? 1 : -1;
          this.x += this.facing * (tantrum ? 130 : 85) * dt;
          if (Math.floor(this.t * 2.4) !== Math.floor((this.t - dt) * 2.4)) { // stomp cadence
            game.shake = Math.max(game.shake, tantrum ? 0.16 : 0.1);
            if (Math.abs(this.cx - (game.cam.x + W / 2)) < W) AudioSys.sfx('thud');
            Particles.burst(this.cx - this.facing * 40, this.groundY, 3, { colors: ['#7a5230', '#57b84a'], sp1: 90, l1: 0.4, s1: 7, up: 40 });
          }
        }
        const prevB = this.breathT;
        if (game.bossStage === 1) {
          this.breathT = (this.breathT + dt) % 4.4;
          if (prevB < 2.2 && this.breathT >= 2.2 && Math.abs(this.cx - (game.cam.x + W / 2)) < W) AudioSys.sfx('inhale');
          if (prevB < 3.2 && this.breathT >= 3.2 && Math.abs(this.cx - (game.cam.x + W / 2)) < W) AudioSys.sfx('fire');
          if (br === 'fire') {
            const fb = this.flameBox();
            if (chance(0.85)) Particles.burst(fb.x + rand(0, fb.w), fb.y + rand(8, fb.h - 8), 1, { colors: ['#ff9f43', '#ffe156', '#ff6b35'], type: 'flame', sp1: 70, grav: -90, l1: 0.4, s1: 14, up: 10 });
            if (game.state === 'play' && pl.superT <= 0 && overlaps(fb, pl)) {
              pl.damage(1);
              pl.vx = this.facing * 340;
            }
          }
        }
        this.x = clamp(this.x, arenaL, arenaR - this.w);
        if (overlaps(this, pl)) {
          if (pl.superT > 0) { /* super mode shields */ }
          else pl.damage(1);
        }
        break;
      }
      case 'dizzy':
        if (this.st > 2.2) this.setState('chase');
        break;
      case 'rainbowing':
        Particles.burst(this.cx + rand(-90, 90), this.y + rand(0, this.h), 2, { colors: RAINBOW, type: 'sparkle', sp1: 80, grav: -120, l1: 0.7, s1: 10, up: 0 });
        if (this.st > 2.5) {
          this.setState('friend');
          this.loseHeart();
          AudioSys.sfx('friend');
          Particles.burst(this.cx, this.cy, 30, { colors: ['#ff8fb0', '#ffd24a', '#fff'], type: 'heart', sp1: 360, l1: 1.1, s1: 13 });
          // the valley opens: both arena walls crumble
          for (const s of (game.spinoWalls || [])) {
            if (s.broken) continue;
            s.broken = true;
            Particles.burst(s.x + s.w / 2, s.y + s.h / 2, 14, { colors: ['#8a9a7a', '#57b84a'], type: 'block', sp1: 320, l1: 1, s1: 12, grav: 900 });
          }
          AudioSys.sfx('smash');
          AudioSys.setMusic('jungle');
        }
        break;
      case 'friend': case 'dance':
        // a friendly spino breathes confetti now and then
        this.confettiT -= dt;
        if (this.confettiT <= 0) {
          this.confettiT = this.state === 'dance' ? 1.6 : 3.5;
          const mx = this.facing > 0 ? this.x + this.w : this.x;
          Particles.burst(mx + this.facing * 60, this.groundY - 110, 14, { colors: RAINBOW, type: 'confetti', sp1: 260, l1: 1.6, s1: 11, grav: 200, up: 120 });
          if (Math.abs(this.cx - (game.cam.x + W / 2)) < W) AudioSys.sfx('whoosh');
        }
        break;
    }
  }
  loseHeart() {
    this.hp--;
    game.shake = Math.max(game.shake, 0.5);
    AudioSys.sfx('thud');
    Particles.burst(this.cx, this.y - 20, 12, { colors: ['#ff7d92', '#fff'], type: 'heart', sp1: 300, l1: 0.8, s1: 12 });
    if (this.hp === 2) { this.setState('dizzy'); game.setBossStage(2); }
    else if (this.hp === 1) { this.setState('dizzy'); game.setBossStage(3); }
  }
  hitBy(kind) {
    if (this.state === 'friend' || this.state === 'rainbowing' || this.state === 'dance') return;
    const need = game.bossPlan[game.bossStage];
    if (kind !== need) {
      this.wrongT = 2;
      if (kind === 'fire' && game.bossStage === 1) { // fire just feeds a fire-breather — yum
        AudioSys.sfx('hiccup');
        Particles.burst(this.cx + this.facing * 70, this.y + 40, 6, { colors: ['#ffe156'], type: 'flame', sp1: 130, l1: 0.4, s1: 9 });
      } else AudioSys.sfx('boing');
      return;
    }
    if (this.state !== 'chase' && this.state !== 'dizzy') return;
    if (game.bossStage === 1) { // ice douses the flames
      this.hits++;
      this.flashT = 0.4;
      this.breathT = 0; // sizzle — the wind-up fizzles out
      AudioSys.sfx('freeze');
      Particles.burst(this.cx + this.facing * 80, this.y + 50, 12, { colors: ['#d6f4ff', '#fff'], type: 'bubble', sp1: 200, grav: -120, l1: 0.7, s1: 10 });
      if (this.hits >= 3) { this.hits = 0; this.loseHeart(); }
    } else if (game.bossStage === 2) { // his own medicine: hiccups!
      this.hits++;
      this.hiccupT = 0.8;
      AudioSys.sfx('hiccup');
      Particles.burst(this.cx + this.facing * 80, this.y + 30, 8, { colors: ['#c9c9d8', '#fff'], type: 'bubble', sp1: 140, grav: -140, l1: 0.8, s1: 11 });
      if (this.hits >= 3) { this.hits = 0; this.loseHeart(); }
    } else if (game.bossStage === 3) {
      this.setState('rainbowing');
      AudioSys.sfx('rainbow');
    }
  }
  draw(ctx) {
    const t = this.t;
    const friend = this.state === 'friend' || this.state === 'dance';
    const x = this.x, y = this.y, w = this.w, h = this.h, cx = this.cx, g = this.groundY;
    const facing = this.facing;
    const br = this.breath();
    const inhale = br === 'inhale' ? Math.min(1, (this.breathT - 2.2) / 1.0) : 0;
    const stomp = this.state === 'chase' && br === 'walk' ? Math.abs(Math.sin(this.t * 7.5)) * 8 : 0;
    const hic = this.hiccupT > 0 ? Math.sin(this.hiccupT * 30) * 5 : 0;
    const dance = this.state === 'dance' ? Math.abs(Math.sin(t * 7)) * 14 : 0;
    const by = g - stomp - dance + hic;
    ctx.save();
    // flame stream first (under the body)
    if (br === 'fire') {
      const fb = this.flameBox();
      const prog = Math.min(1, (this.breathT - 3.2) / 0.25);
      const len = fb.w * prog;
      const x0 = facing > 0 ? fb.x : fb.x + fb.w - len;
      for (let fx = 0; fx < len; fx += 26) {
        ctx.fillStyle = ['#ff6b35', '#ff9f43', '#ffe156'][Math.floor((fx / 26 + t * 10) % 3)];
        ctx.beginPath();
        ctx.arc(x0 + fx + 13, fb.y + fb.h / 2 + Math.sin(t * 20 + fx * 0.15) * 7, 18 + Math.sin(fx * 0.09 + t * 12) * 6, 0, TAU);
        ctx.fill();
      }
      // spout pouring from the snout down into the ground-hugging stream
      const mx0 = cx + facing * 150, my0 = by - 138; // snout tip
      const mx1 = facing > 0 ? fb.x + 20 : fb.x + fb.w - 20, my1 = fb.y + fb.h / 2;
      for (let i = 0; i < 4; i++) {
        const k = i / 3;
        ctx.fillStyle = ['#ffe156', '#ff9f43', '#ff6b35', '#ff9f43'][i];
        ctx.beginPath();
        ctx.arc(lerp(mx0, mx1, k) + Math.sin(t * 18 + i) * 4, lerp(my0, my1, k * k), 10 + k * 8, 0, TAU);
        ctx.fill();
      }
    }
    // tail
    ctx.strokeStyle = friend ? '#6cc4a0' : '#4aa890'; ctx.lineWidth = 26; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - facing * 70, by - 70);
    ctx.quadraticCurveTo(cx - facing * 150, by - 50, cx - facing * 190, by - 100);
    ctx.stroke();
    // legs
    ctx.fillStyle = friend ? '#6cc4a0' : '#4aa890';
    for (const lx of [-52, 12]) rr(ctx, cx + lx, by - 62, 34, 62, 12), ctx.fill();
    // THE SAIL — his signature, glows when he's about to breathe fire
    const sailN = 6;
    for (let i = 0; i < sailN; i++) {
      const sx = cx - facing * (i - 2.2) * 30;
      const sh = 46 + Math.sin(i * 1.1) * 22 + (i === 2 ? 18 : 0);
      const glow = inhale > 0 ? inhale : (br === 'fire' ? 1 : 0);
      ctx.fillStyle = friend ? '#ff8fb0' : glow > 0.4 ? '#ff6b35' : '#ff9f43';
      ctx.beginPath();
      ctx.moveTo(sx - 16, by - 118);
      ctx.quadraticCurveTo(sx, by - 118 - sh - glow * 12, sx + 16, by - 118);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = friend ? '#d6559a' : '#c2451a'; ctx.lineWidth = 3; ctx.stroke();
    }
    // body
    const puff = 1 + inhale * 0.18;
    ctx.fillStyle = friend ? '#6cc4a0' : '#4aa890';
    ctx.beginPath(); ctx.ellipse(cx, by - 88, 92 * puff, 62 * puff, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = friend ? '#3a8a6a' : '#2a7a64'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#e8f4d0'; // belly
    ctx.beginPath(); ctx.ellipse(cx + facing * 18, by - 70, 52 * puff, 34 * puff, 0, 0, TAU); ctx.fill();
    // spots
    ctx.fillStyle = friend ? '#3a8a6a' : '#2a7a64';
    for (const [ox, oy] of [[-50, -100], [-14, -128], [40, -104]]) {
      ctx.beginPath(); ctx.arc(cx + ox, by + oy, 8, 0, TAU); ctx.fill();
    }
    // comically small arms
    ctx.strokeStyle = friend ? '#6cc4a0' : '#4aa890'; ctx.lineWidth = 12;
    for (const ay of [-96, -80]) {
      ctx.beginPath();
      ctx.moveTo(cx + facing * 74, by + ay);
      ctx.lineTo(cx + facing * 96, by + ay + 10 + Math.sin(t * 5) * 4);
      ctx.stroke();
    }
    // head with long croc snout
    const hx = cx + facing * 76, hy = by - 150 + hic;
    ctx.fillStyle = friend ? '#6cc4a0' : '#4aa890';
    ctx.beginPath(); ctx.ellipse(hx, hy, 40, 32, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = friend ? '#3a8a6a' : '#2a7a64'; ctx.lineWidth = 4; ctx.stroke();
    const snx = hx + facing * 52;
    ctx.beginPath(); ctx.ellipse(snx, hy + 12, 34, 16, 0, 0, TAU); ctx.fill(); ctx.stroke();
    // teeth (goofy, stubby)
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) {
      const tx2 = snx - facing * 20 + facing * i * 16;
      ctx.beginPath();
      ctx.moveTo(tx2 - 4, hy + 24); ctx.lineTo(tx2, hy + 31); ctx.lineTo(tx2 + 4, hy + 24);
      ctx.closePath(); ctx.fill();
    }
    // puffed cheeks while inhaling — the boss-sized telegraph
    if (inhale > 0) {
      ctx.fillStyle = '#7fd8b8';
      ctx.beginPath(); ctx.arc(hx + facing * 24, hy + 16, 8 + inhale * 18, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2a7a64'; ctx.stroke();
      if (chance(0.35)) Particles.burst(hx, hy - 40, 1, { colors: ['#ffe156'], type: 'sparkle', sp1: 25, grav: -40, l1: 0.4, s1: 8, up: 0 });
    }
    // face
    let mood = 'happy';
    if (this.state === 'dizzy') mood = 'dizzy';
    else if (friend) mood = 'grin';
    else if (br === 'fire' || inhale > 0.4) mood = 'surprised';
    drawFace(ctx, hx - facing * 6, hy - 4, 30, mood, t, 71, facing, 0);
    if (this.state === 'dizzy') {
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + i * TAU / 3;
        ctx.fillStyle = '#ffe156';
        starPath(ctx, hx + Math.cos(a) * 52, hy - 40 + Math.sin(a) * 10, 9, 4.5);
        ctx.fill();
      }
    }
    // befriended: a big flower tucked behind his ear
    if (friend) {
      const fx2 = hx - facing * 34, fy2 = hy - 26;
      ctx.fillStyle = '#ff8fb0';
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + t * 0.4;
        ctx.beginPath(); ctx.arc(fx2 + Math.cos(a) * 11, fy2 + Math.sin(a) * 11, 7, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(fx2, fy2, 7, 0, TAU); ctx.fill();
    }
    // ice-hit flash
    if (this.flashT > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashT * 1.4;
      ctx.fillStyle = '#bfe8ff';
      ctx.beginPath(); ctx.ellipse(cx, by - 88, 98, 68, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    // boss hearts
    if (!friend && game.bossStage > 0 && this.state !== 'rainbowing') {
      for (let i = 0; i < 3; i++) {
        drawHeartIcon(ctx, cx - 44 + i * 44, y - 64 + Math.sin(t * 3 + i) * 3, 26, i < this.hp, t + i);
      }
    }
    // "wrong power" hint bubble
    if (this.wrongT > 0 && game.bossStage > 0) {
      const need = game.bossPlan[game.bossStage];
      const hy2 = y - 128 + Math.sin(t * 6) * 6;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath(); ctx.arc(cx, hy2, 40, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 10, hy2 + 36); ctx.lineTo(cx, hy2 + 58); ctx.lineTo(cx + 12, hy2 + 34);
      ctx.closePath(); ctx.fill();
      drawBlock(ctx, cx - 26, hy2 - 26, 52, need, t);
    }
  }
}

// ================================================================ sublevel doors
// The shared entrance into mini-games/sublevels. Stand a SubDoor in any level
// (lv.subDoors) and walking into it calls game.enterSub(this.sub); on return
// the player reappears beside it. `armed` prevents instant re-entry after
// exiting — walk away and back to replay. Styles: 'cloud' (swirl archway),
// 'cave' (dark sparkling opening), 'rainbow' (shimmering ring). A gold star
// appears above once that mini-game has been completed (game.miniDone).
class SubDoor {
  constructor(cx, groundY, sub, style) {
    this.w = 92; this.h = 118;
    this.x = cx - this.w / 2; this.y = groundY - this.h; this.groundY = groundY;
    this.sub = sub; this.style = style;
    this.t = rand(9); this.armed = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  done() { return !!(game.miniDone && game.miniDone[this.sub]); }
  update(dt) {
    this.t += dt;
    const done = this.done();
    const over = overlaps(this, game.player);
    if (over && this.armed && game.state === 'play' && !game.cut && !game.endPhase) {
      // a COMPLETED door goes dormant: walking over it never swallows you
      // again (that was a real playtest complaint on the cave-roof route).
      // Replay is deliberate: stand on the trophy marker and press Space/★.
      if (!done || justP.Space) {
        this.armed = false;
        game.enterSub(this.sub);
        return;
      }
    }
    if (!over && Math.abs(game.player.cx - this.cx) > this.w) this.armed = true;
    if (chance(done ? 0.025 : 0.1)) {
      const cols = this.style === 'rainbow' ? RAINBOW
        : this.style === 'cave' ? ['#ffe156', '#d0a0ff']
        : this.style === 'crack' ? ['#ff9f43', '#ffe156']
        : ['#fff', '#bfe8ff'];
      Particles.burst(this.cx + rand(-34, 34), this.y + rand(10, this.h - 10), 1, { colors: cols, type: 'sparkle', sp1: 25, grav: -50, l1: 0.8, s1: 8, up: 0 });
    }
    // the bubble door's clue: a strange stream of bubbles rises out of the
    // cave — the invitation stops once the secret has been found
    if (this.style === 'bubble' && !done && chance(0.4)) {
      Particles.burst(this.cx + rand(-14, 14), this.y + 30, 1, { color: 'rgba(255,255,255,0.75)', type: 'bubble', sp1: 25, grav: -170, l0: 2, l1: 3.4, up: 0, s1: 10 });
    }
  }
  draw(ctx) {
    const t = this.t, cx = this.cx, g = this.groundY;
    const done = this.done();
    ctx.save();
    if (done) { // dormant trophy marker: smaller, quieter, clearly "finished"
      ctx.globalAlpha *= 0.8;
      ctx.translate(cx, g);
      ctx.scale(0.72, 0.72);
      ctx.translate(-cx, -g);
    }
    ctx.save();
    if (this.style === 'rainbow') {
      // a shimmering rainbow ring standing on the ground
      for (let i = 0; i < RAINBOW.length; i++) {
        ctx.strokeStyle = RAINBOW[i];
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 3 + i);
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.ellipse(cx, this.y + this.h / 2, 34 - i * 3, this.h / 2 - i * 3.5, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 2.5);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(cx, this.y + this.h / 2, 22, this.h / 2 - 22, 0, 0, TAU); ctx.fill();
    } else if (this.style === 'cave') {
      // dark secret opening with a mossy stone rim
      ctx.fillStyle = '#5f6070';
      ctx.beginPath(); ctx.ellipse(cx, g - 4, this.w / 2 + 10, this.h - 6, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#1c1430';
      ctx.beginPath(); ctx.ellipse(cx, g - 2, this.w / 2 - 6, this.h - 22, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#57b84a';
      for (const [ox, mr] of [[-30, 10], [8, 13], [34, 9]]) {
        ctx.beginPath(); ctx.ellipse(cx + ox, this.y + 6, mr, 6, 0, Math.PI, TAU); ctx.fill();
      }
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 4);
      ctx.fillStyle = '#ffe156';
      starPath(ctx, cx, this.y + this.h * 0.5, 9, 4);
      ctx.fill();
    } else if (this.style === 'crack') {
      // cracked volcanic wall: glowing fissures around a dark opening
      ctx.fillStyle = '#2e1620';
      rr(ctx, this.x - 18, this.y - 14, this.w + 36, this.h + 14, 18); ctx.fill();
      ctx.strokeStyle = '#571d14'; ctx.lineWidth = 4;
      rr(ctx, this.x - 18, this.y - 14, this.w + 36, this.h + 14, 18); ctx.stroke();
      ctx.fillStyle = '#160a12';
      ctx.beginPath(); ctx.ellipse(cx, g - 2, this.w / 2 - 10, this.h - 26, 0, Math.PI, TAU); ctx.fill();
      // glowing zigzag cracks radiating from the opening
      ctx.strokeStyle = 'rgba(255,138,43,' + (0.55 + 0.3 * Math.sin(t * 3)) + ')';
      ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (const [x0, y0, seg] of [[-40, -30, [[-16, -22], [-8, -40]]], [42, -44, [[14, -18], [26, -34]]], [-34, -78, [[-14, -10], [-26, -22]]], [38, -86, [[12, -12], [22, -6]]]]) {
        ctx.beginPath();
        ctx.moveTo(cx + x0 * 0.6, g + y0);
        let px2 = cx + x0 * 0.6, py2 = g + y0;
        for (const [dx, dy] of seg) { px2 += dx * 0.7; py2 += dy * 0.6; ctx.lineTo(px2, py2); }
        ctx.stroke();
      }
      // ember glow deep inside
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 4);
      ctx.fillStyle = '#ff8a2b';
      ctx.beginPath(); ctx.ellipse(cx, g - 16, 20, 10, 0, 0, TAU); ctx.fill();
      ctx.restore();
    } else if (this.style === 'bubble') {
      // sea-cave mouth wrapped in seaweed, breathing a steady bubble stream
      ctx.fillStyle = '#6a5a3a';
      ctx.beginPath(); ctx.ellipse(cx, g - 2, this.w / 2 + 12, this.h - 2, 0, Math.PI, TAU); ctx.fill();
      ctx.strokeStyle = '#4a3e28'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(cx, g - 2, this.w / 2 + 12, this.h - 2, 0, Math.PI, TAU); ctx.stroke();
      ctx.fillStyle = '#0a2a4a';
      ctx.beginPath(); ctx.ellipse(cx, g - 2, this.w / 2 - 8, this.h - 24, 0, Math.PI, TAU); ctx.fill();
      // waving seaweed fronds framing the mouth
      ctx.strokeStyle = '#2e9c5a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (const ox of [-this.w / 2 - 6, -this.w / 4, this.w / 4, this.w / 2 + 6]) {
        const wob = Math.sin(t * 1.6 + ox) * 12;
        ctx.beginPath();
        ctx.moveTo(cx + ox, g);
        ctx.quadraticCurveTo(cx + ox + wob * 0.5, g - 50, cx + ox + wob, g - 90 - Math.abs(ox) * 0.3);
        ctx.stroke();
      }
      // resident bubbles drifting in the mouth
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const bph = (t * 0.5 + i * 0.33) % 1;
        ctx.beginPath(); ctx.arc(cx + Math.sin(i * 4 + t) * 12, g - 14 - bph * (this.h - 40), 6 + i * 2, 0, TAU); ctx.stroke();
      }
    } else { // cloud swirl archway
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + i * Math.PI / 6;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * (this.w / 2 + 4), g - 26 + Math.sin(a) * (this.h - 30), 16, 0, TAU);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(cx, this.y + this.h * 0.52);
      ctx.rotate(t * 1.4);
      ctx.strokeStyle = '#8fd0ff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, 12 + i * 9, i * 2, i * 2 + 3.6);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.restore(); // undo the dormant shrink
    // completed badge over the (smaller) door
    if (done) {
      const by = g - this.h * 0.72 - 18 + Math.sin(t * 3) * 3;
      ctx.fillStyle = '#ffd24a';
      starPath(ctx, cx, by, 13, 6);
      ctx.fill();
      ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 2.5; ctx.stroke();
      // standing on the trophy shows the wordless "press Space to replay" hint
      if (game.state === 'play' && game.player && overlaps(this, game.player)) {
        drawSpacebar(ctx, cx, by - 52, 110, t);
      }
    }
  }
}

// ================================================================ truck build
// Rally pre-race adventure: the monster truck is parked but BROKEN — no
// wheels, empty engine bay, no power core. Three MissionTokens (skins
// 'wheels'/'engine'/'core') are scattered along the opening stretch; a sign
// beside the truck shows ghost silhouettes of what's missing. Bring all three
// back and they attach one at a time (BOOM. wheels. clunk. engine. bzzt.
// lights!) — then VROOOOOM: a ParkedTruck spawns and the rally begins as
// always. Reuses the CollectionPuzzle beats: any order, wordless toast
// progress, tokens survive death (state lives on the level object).
// The engine hangs from a crane; the big yellow floor switch lowers it.
class TruckBuild {
  constructor(cx, groundY, tokens, opts = {}) {
    this.cx = cx; this.groundY = groundY;
    this.w = 104; this.h = 96;
    this.x = cx - this.w / 2; this.y = groundY - this.h;
    this.tokens = tokens; // [wheels, engine, core]
    this.crane = opts.crane || null; // {x, topY, lowY, k}
    this.plate = opts.plate || null; // {x, on} — the big floor switch
    if (this.plate) { this.plate.w = 104; this.plate.h = 30; this.plate.y = groundY - 24; }
    if (this.crane) this.crane.k = 0;
    this.state = 'collect'; // -> 'building' -> 'done'
    this.actT = 0; this.attached = 0;
    this.toastT = 0; this.coughT = 1.2; this.wobbleT = 0;
    this.flyFrom = null;
    this.t = rand(9);
  }
  count() { return this.tokens.filter(tk => tk.taken).length; }
  onCollect(token) {
    this.toastT = 2.6;
    const left = this.tokens.length - this.count();
    AudioSys.sfx(left === 0 ? 'powerup' : 'collect');
    if (left === 0) AudioSys.sfx('heart'); // every part found!
  }
  nearCam() { return Math.abs(this.cx - (game.cam.x + W / 2)) < W; }
  update(dt, pl) {
    this.t += dt;
    this.toastT = Math.max(0, this.toastT - dt);
    this.wobbleT = Math.max(0, this.wobbleT - dt);
    for (const tk of this.tokens) tk.update(dt, pl, this);
    // the big yellow switch lowers the crane (cause and effect, no words)
    if (this.plate && !this.plate.on && overlaps(this.plate, pl)) {
      this.plate.on = true;
      AudioSys.sfx('switch');
      AudioSys.sfx('grind');
      game.shake = Math.max(game.shake, 0.15);
      Particles.burst(this.plate.x + this.plate.w / 2, this.plate.y, 10, { colors: ['#ffe156', '#fff'], type: 'star', sp1: 200, l1: 0.6, s1: 9 });
    }
    if (this.crane && this.plate && this.plate.on && this.crane.k < 1) {
      const prevK = this.crane.k;
      this.crane.k = Math.min(1, this.crane.k + dt / 1.7);
      const e = this.crane.k * this.crane.k * (3 - 2 * this.crane.k);
      const engineTok = this.tokens[1];
      if (!engineTok.taken) engineTok.baseY = lerp(this.crane.topY, this.crane.lowY, e);
      if (prevK < 1 && this.crane.k >= 1) AudioSys.sfx('thud');
      if (chance(0.3)) Particles.burst(this.crane.x + rand(-8, 8), engineTok.cy - 40, 1, { colors: ['#c9c1d6'], type: 'sparkle', sp1: 20, grav: 60, l1: 0.4, s1: 6, up: 0 });
    }
    // the poor truck coughs and wobbles: "I'm not ready"
    if (this.state === 'collect') {
      this.coughT -= dt;
      if (this.coughT <= 0 && Math.abs(pl.cx - this.cx) < 560) {
        this.coughT = rand(2.6, 4.2);
        this.wobbleT = 0.6;
        if (this.nearCam()) AudioSys.sfx('hiccup');
        Particles.burst(this.x + this.w - 8, this.y + 26, 4, { color: 'rgba(120,110,130,0.7)', sp1: 50, grav: -110, l1: 0.9, s1: 12, up: 10 });
      }
      if (this.count() === this.tokens.length && Math.abs(pl.cx - this.cx) < 240) {
        this.state = 'building'; this.actT = 0;
        this.flyFrom = { x: pl.cx, y: pl.y - 20 };
        AudioSys.sfx('fanfare');
      }
    }
    if (this.state === 'building') {
      const prev = this.actT;
      this.actT += dt;
      const times = [0.7, 1.45, 2.2];
      for (let i = 0; i < 3; i++) {
        if (prev < times[i] && this.actT >= times[i]) {
          this.attached = i + 1;
          game.shake = Math.max(game.shake, 0.3);
          if (i === 0) { // BOOM — the truck drops onto giant tires
            AudioSys.sfx('thud');
            Particles.burst(this.cx, this.groundY, 12, { colors: ['#c9a96a', '#b08a55'], sp1: 220, grav: 100, l1: 0.6, s1: 12, up: 30 });
          } else if (i === 1) { // engine clunks into the bay
            AudioSys.sfx('land'); AudioSys.sfx('grind');
            Particles.burst(this.cx, this.y + 30, 8, { colors: ['#c9c1d6', '#fff'], type: 'star', sp1: 200, l1: 0.5, s1: 9 });
          } else { // power core snaps in — lights ON
            AudioSys.sfx('powerup');
            Particles.burst(this.cx, this.y + 40, 14, { colors: ['#ffe14d', '#fff', '#ffa726'], type: 'star', sp1: 280, l1: 0.7, s1: 11 });
          }
        }
      }
      if (prev < 3.0 && this.actT >= 3.0) { // VROOOOOM!
        AudioSys.sfx('rev');
        AudioSys.sfx('launch');
        AudioSys.sfx('cheer');
        game.shake = Math.max(game.shake, 0.5);
        Particles.burst(this.cx, this.y + 30, 20, { colors: RAINBOW, type: 'confetti', sp1: 360, l0: 1, l1: 2, s1: 11, grav: 300, up: 220 });
        Particles.candyBurst(this.cx, this.y - 20, 8);
        game.pickups.push(new ParkedTruck(this.x, this.groundY));
        this.state = 'done';
      }
    }
  }
  draw(ctx, t) {
    if (this.state === 'done') return;
    const g = this.groundY, cx = this.cx;
    // crane: mast + arm + cable holding the engine
    if (this.crane) {
      const cr = this.crane;
      ctx.fillStyle = '#ffb62b';
      rr(ctx, cr.x - 10, g - 330, 20, 330, 6); ctx.fill();
      ctx.strokeStyle = '#c2831a'; ctx.lineWidth = 3;
      rr(ctx, cr.x - 10, g - 330, 20, 330, 6); ctx.stroke();
      // lattice stripes
      ctx.strokeStyle = 'rgba(194,131,26,0.6)'; ctx.lineWidth = 2.5;
      for (let yy = g - 316; yy < g - 20; yy += 34) {
        ctx.beginPath(); ctx.moveTo(cr.x - 9, yy); ctx.lineTo(cr.x + 9, yy + 16); ctx.stroke();
      }
      ctx.fillStyle = '#ffb62b';
      rr(ctx, cr.x - 64, g - 342, 128, 18, 6); ctx.fill();
      ctx.strokeStyle = '#c2831a';
      rr(ctx, cr.x - 64, g - 342, 128, 18, 6); ctx.stroke();
      const engineTok = this.tokens[1];
      const hookY = engineTok.taken ? g - 300 : engineTok.cy - 30;
      ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cr.x, g - 334); ctx.lineTo(cr.x, hookY); ctx.stroke();
      ctx.strokeStyle = '#8a8a9a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cr.x, hookY + 8, 7, -0.4, Math.PI + 0.6); ctx.stroke();
      drawFace(ctx, cr.x, g - 333, 15, this.plate && this.plate.on ? 'happy' : 'sleepy', t, 83);
    }
    // the big yellow floor switch
    if (this.plate) {
      const p = this.plate, down = p.on ? 8 : 0;
      ctx.fillStyle = '#8a8a9a';
      rr(ctx, p.x - 8, g - 14, p.w + 16, 14, 5); ctx.fill();
      ctx.fillStyle = p.on ? '#57d357' : '#ffe156';
      rr(ctx, p.x, p.y + down, p.w, p.h - down, 8); ctx.fill();
      ctx.strokeStyle = p.on ? '#2f8a3c' : '#c8861b'; ctx.lineWidth = 3;
      rr(ctx, p.x, p.y + down, p.w, p.h - down, 8); ctx.stroke();
      // down-arrow icon: "step here"
      ctx.fillStyle = p.on ? '#fff' : '#c8861b';
      const mx = p.x + p.w / 2, my = p.y + down + (p.h - down) / 2;
      ctx.beginPath();
      ctx.moveTo(mx - 12, my - 5); ctx.lineTo(mx + 12, my - 5); ctx.lineTo(mx, my + 8);
      ctx.closePath(); ctx.fill();
    }
    // parts sign: ghost silhouettes of everything still missing
    const sx = cx - 150, sy = this.y - 46;
    ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, g); ctx.lineTo(sx, sy + 24); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    rr(ctx, sx - 84, sy - 32, 168, 62, 14); ctx.fill();
    ctx.strokeStyle = '#8a7fae'; ctx.lineWidth = 3.5;
    rr(ctx, sx - 84, sy - 32, 168, 62, 14); ctx.stroke();
    for (let i = 0; i < this.tokens.length; i++) {
      const tk = this.tokens[i], px = sx + (i - 1) * 52, py = sy - 1;
      const have = this.state === 'building' ? i < this.attached : tk.taken;
      ctx.save();
      if (!have) ctx.globalAlpha *= 1; // ghost handled by drawIcon
      MissionToken.drawIcon(ctx, px, py, 34, tk.kind, tk.skin, t, !have);
      ctx.restore();
      if (have) { ctx.fillStyle = '#ffe156'; starPath(ctx, px + 15, py - 15, 7, 3); ctx.fill(); }
    }
    // the truck itself
    const wob = this.wobbleT > 0 ? Math.sin(this.wobbleT * 30) * 3 * this.wobbleT : 0;
    ctx.save();
    ctx.translate(wob, 0);
    if (this.attached >= 1) {
      // up on its giant tires; face brightens as parts arrive
      drawTruckBody(ctx, this.x, this.y, this.w, this.h, t, { driving: false, facing: 1, mood: this.attached >= 3 ? 'grin' : 'surprised' });
      if (this.attached >= 3) { // headlights ON
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 6);
        ctx.fillStyle = '#fff8c0';
        ctx.beginPath();
        ctx.moveTo(this.x + this.w - 2, this.y + 40);
        ctx.lineTo(this.x + this.w + 120, this.y + 22);
        ctx.lineTo(this.x + this.w + 120, this.y + 74);
        ctx.lineTo(this.x + this.w - 2, this.y + 58);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    } else {
      this.drawBrokenTruck(ctx, t);
    }
    ctx.restore();
    // parts flying home during assembly
    if (this.state === 'building' && this.flyFrom) {
      const times = [0.7, 1.45, 2.2];
      const targets = [
        { x: cx, y: g - 26 },          // wheels
        { x: cx, y: this.y + 26 },     // engine
        { x: cx - 14, y: this.y + 52 } // power core
      ];
      for (let i = 0; i < 3; i++) {
        if (this.actT >= times[i] || this.actT < times[i] - 0.7) continue;
        const k = clamp((this.actT - (times[i] - 0.7)) / 0.7, 0, 1);
        const e = k * k * (3 - 2 * k);
        const fx = lerp(this.flyFrom.x, targets[i].x, e);
        const fy = lerp(this.flyFrom.y, targets[i].y, e) - Math.sin(k * Math.PI) * 80;
        MissionToken.drawIcon(ctx, fx, fy, 42, this.tokens[i].kind, this.tokens[i].skin, t);
      }
    }
    // wordless progress toast above the hero (same pattern as CollectionPuzzle)
    if (this.toastT > 0 && game.player) {
      const pl = game.player;
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.toastT * 2);
      const bx = pl.cx, by = pl.y - 58 + Math.sin(t * 5) * 3;
      ctx.fillStyle = '#fff';
      rr(ctx, bx - 66, by - 26, 132, 52, 18); ctx.fill();
      ctx.strokeStyle = '#5a4a86'; ctx.lineWidth = 3;
      rr(ctx, bx - 66, by - 26, 132, 52, 18); ctx.stroke();
      for (let i = 0; i < this.tokens.length; i++) {
        const tk = this.tokens[i];
        ctx.save();
        ctx.globalAlpha *= tk.taken ? 1 : 0.3;
        MissionToken.drawIcon(ctx, bx + (i - 1) * 40, by, 28, tk.kind, tk.skin, t);
        ctx.restore();
        if (tk.taken) { ctx.fillStyle = '#ffe156'; starPath(ctx, bx + (i - 1) * 40 + 13, by - 13, 6, 2.6); ctx.fill(); }
      }
      ctx.restore();
    }
    for (const tk of this.tokens) tk.draw(ctx);
  }
  drawBrokenTruck(ctx, t) {
    // the sad, wheel-less truck: body slumped on the dirt, hood open, bay empty
    const x = this.x, w = this.w, g = this.groundY;
    const y = g - 66; // slumped 30px lower than a healthy truck
    // axle stubs where wheels should be
    ctx.fillStyle = '#5f5a78';
    for (const wx of [x + 26, x + w - 26]) {
      ctx.beginPath(); ctx.arc(wx, g - 12, 9, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#3a3550'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(wx, g - 12, 9, 0, TAU); ctx.stroke();
    }
    // body (dusty red)
    ctx.fillStyle = '#d6503a';
    rr(ctx, x + 2, y + 12, w - 4, 44, 12); ctx.fill();
    ctx.strokeStyle = '#8a2418'; ctx.lineWidth = 3.5;
    rr(ctx, x + 2, y + 12, w - 4, 44, 12); ctx.stroke();
    // sad face on the door
    drawFace(ctx, x + w / 2, y + 36, 26, 'sad', t, 17, 1, 0);
    // cab
    ctx.fillStyle = '#d6503a';
    rr(ctx, x + w * 0.28, y - 18, w * 0.5, 34, 9); ctx.fill();
    ctx.strokeStyle = '#8a2418'; ctx.lineWidth = 3;
    rr(ctx, x + w * 0.28, y - 18, w * 0.5, 34, 9); ctx.stroke();
    ctx.fillStyle = '#9fc4d8';
    rr(ctx, x + w * 0.33, y - 13, w * 0.4, 24, 6); ctx.fill();
    // open hood: dark empty engine bay + propped lid
    ctx.fillStyle = '#3a2030';
    rr(ctx, x + w - 30, y + 2, 26, 22, 5); ctx.fill();
    ctx.strokeStyle = '#8a2418'; ctx.lineWidth = 3;
    ctx.save();
    ctx.translate(x + w - 30, y + 4);
    ctx.rotate(-0.9 + Math.sin(t * 2) * 0.05);
    ctx.fillStyle = '#d6503a';
    rr(ctx, 0, -6, 30, 8, 3); ctx.fill(); ctx.stroke();
    ctx.restore();
    // drooping exhaust pipe
    ctx.fillStyle = '#8a8a9a';
    ctx.save();
    ctx.translate(x + 10, y + 6);
    ctx.rotate(0.35);
    rr(ctx, -4, -18, 9, 26, 3); ctx.fill();
    ctx.restore();
  }
}
