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
      if (s.bigBrick && e.isPlayer && e.big) { game.smashWall(s, ['#c94f3d', '#a83a2e', '#e8d9c9']); res.smashed = true; continue; }
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
    if (s.bigBrick && e.isPlayer && e.big) { game.smashWall(s, ['#c94f3d', '#a83a2e', '#e8d9c9']); res.smashed = true; continue; }
    if (e.vy > 0) {
      e.y = s.y - e.h;
      if (s.bouncy) { e.vy = s.bounceVy || -980; if (s.bounceVx) { e.vx = s.bounceVx; e.launchT = 1.3; } res.bounced = true; }
      else { e.vy = 0; res.ground = true; res.groundS = s; }
    } else if (e.vy < 0) {
      e.y = s.y + s.h; e.vy = 0; res.head = true; res.headS = s;
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
    this.big = false; this.drawK = 1; // Big Buddy: one free hit + 1.4x size
  }
  boardUnicorn() {
    if (this.vehicle === 'unicorn') return;
    this.big = false; this.drawK = 1; // vehicles have their own shapes
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
    this.big = false; this.drawK = 1; // vehicles have their own shapes
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
    this.drawK = lerp(this.drawK, this.big ? 130 / 94 : 1, 1 - Math.exp(-10 * dt));
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
      if (res.head && res.headS && (res.headS.buddy || res.headS.bigBonus)) game.bumpBlock(res.headS);
      // pushing a big-brick wall while small: a mushroom thought bubble hints the answer
      if (res.wall && res.wallS && res.wallS.bigBrick) res.wallS.hintT = 1;
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
    if (this.big) { // Big Buddy soaks the hit: shrink with a pop, keep every heart
      this.shrinkDown();
      this.inv = 2;
      this.setMood('surprised', 1.2);
      game.shake = Math.max(game.shake, 0.3);
      this.vy = Math.min(this.vy, -320);
      return;
    }
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
    const k = this.drawK; // Big Buddy: art stays normal-sized, scaled around the feet
    ctx.translate(this.cx, baseY);
    ctx.scale((2 - sq) * k, sq * k);
    ctx.translate(-this.cx, -baseY);
    const wx = this.cx, wy = baseY - 30;
    this.drawWheel(ctx, wx, wy, 30);
    this.drawBoy(ctx, wx, baseY - 94 + (this.duck ? 24 : 6), this.mood);
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

// ================================================================ sunken temple
// The machine for SUNKEN TEMPLE 1-2 (lv.puzzle on 'water2'): pure visible
// cause-and-effect. Valves (Space nearby, always reversible) toggle current
// zones (ordinary lv.currents entries — player push, chevrons and bubble
// streams all come from the existing generic code). Currents carry PEARLS;
// each pearl seeks its own clam socket (ghost-pearl silhouette = the "what do
// I want" language) with a gentle magnet inside 90px so near-misses forgive
// themselves. A pearl knocked out of its wing pops back to its home bowl —
// never lost. Three filled sockets light three orbs, glowing streams converge
// on the great door, the sleeping stone face wakes up GRINNING, the door
// crumbles, and the golden star appears in the treasure chamber.
class SunkenTemple {
  constructor(lv) {
    this.lv = lv;
    this.door = lv.solids.find(s => s.templeDoor);
    this.valves = [
      { x: 1520, y: 1300, ids: ['ca'], on: false, rot: 0, spinT: 0 },
      { x: 2420, y: 520, ids: ['cb1'], on: false, rot: 0, spinT: 0 },
      { x: 3280, y: 400, ids: ['cb2'], on: false, rot: 0, spinT: 0 },
      { x: 4420, y: 1250, ids: ['cc'], on: false, rot: 0, spinT: 0 }
    ];
    this.sockets = [ // {x, y}: bowl base center; pearl rests with center at (x, y-18)
      { x: 2160, y: 1520, filled: false },
      { x: 3190, y: 186, filled: false },
      { x: 3800, y: 1520, filled: false }
    ];
    this.pearls = [
      { x: 1544, y: 1466, socket: 0, b: { x0: 1400, x1: 2360, y0: 1300, y1: 1570 } },
      { x: 2504, y: 366, socket: 1, b: { x0: 2400, x1: 3330, y0: 60, y1: 700 } },
      { x: 4164, y: 1466, socket: 2, b: { x0: 3560, x1: 4650, y0: 1300, y1: 1570 } }
    ];
    for (const p of this.pearls) {
      p.w = 32; p.h = 32; p.vx = 0; p.vy = 0;
      p.hx = p.x; p.hy = p.y; p.done = false; p.t = rand(9);
    }
    this.orbs = [ // one glowing brazier per wing, streams aim at the door top
      { x: 1850, y: 960 }, { x: 3190, y: 96 }, { x: 4100, y: 1040 }
    ];
    this.nearValve = null; this.cool = 0;
    this.doorOpen = false; this.doorT = 0; this.t = rand(9);
  }
  litCount() { let n = 0; for (const s of this.sockets) if (s.filled) n++; return n; }
  update(dt, pl) {
    this.t += dt; this.cool = Math.max(0, this.cool - dt);
    // ---- valves: Space nearby toggles, spin + lamp show the state ----
    this.nearValve = null;
    for (const v of this.valves) {
      v.spinT = Math.max(0, v.spinT - dt);
      if (v.spinT > 0) v.rot += dt * 11;
      if (!this.nearValve && Math.hypot(pl.cx - v.x, pl.cy - v.y) < 95) this.nearValve = v;
    }
    if (this.nearValve && justP.Space && this.cool <= 0 && game.state === 'play') {
      const v = this.nearValve;
      this.cool = 0.3; v.on = !v.on; v.spinT = 0.5;
      for (const id of v.ids) {
        const z = this.lv.currents.find(c => c.id === id);
        if (z) z.on = v.on;
      }
      AudioSys.sfx('switch'); AudioSys.sfx(v.on ? 'blorp' : 'thud');
      Particles.burst(v.x, v.y, 10, { colors: ['#7fd8ff', '#fff'], type: 'bubble', sp1: 160, grav: -60, l1: 0.8, s1: 9 });
    }
    // ---- pearls: sink softly, ride active currents, home to their socket ----
    for (const p of this.pearls) {
      if (p.done) continue;
      p.t += dt;
      if (p.x < p.b.x0 || p.x > p.b.x1 || p.y < p.b.y0 || p.y > p.b.y1) { // never lost
        p.x = p.hx; p.y = p.hy; p.vx = 0; p.vy = 0;
        Particles.burst(p.x + 16, p.y + 16, 8, { colors: ['#ffe9f2', '#fff'], type: 'sparkle', sp1: 140, l1: 0.6, s1: 8 });
      }
      p.vy += 260 * dt; // a pearl barely sinks
      for (const z of this.lv.currents) {
        if (z.on === false) continue;
        const cx2 = p.x + 16, cy2 = p.y + 16;
        if (cx2 < z.x || cx2 > z.x + z.w || cy2 < z.y || cy2 > z.y + z.h) continue;
        const f = 1500 * dt;
        if (z.dir === 'right') p.vx += f;
        else if (z.dir === 'left') p.vx -= f;
        else if (z.dir === 'up') p.vy -= f;
        else p.vy += f;
      }
      const s = this.sockets[p.socket];
      const dx = s.x - (p.x + 16), dy = (s.y - 18) - (p.y + 16);
      const d = Math.hypot(dx, dy);
      if (d < 90) { p.vx += dx * 6 * dt; p.vy += dy * 6 * dt; } // forgiving magnet
      const dr = Math.exp(-1.4 * dt);
      p.vx = clamp(p.vx * dr, -250, 250); p.vy = clamp(p.vy * dr, -250, 250);
      moveEntity(p, this.lv, dt);
      if (d < 36) { // CLICK — the socket takes its pearl, forever
        p.done = true; p.x = s.x - 16; p.y = s.y - 34; p.vx = 0; p.vy = 0;
        s.filled = true;
        AudioSys.sfx('powerup'); AudioSys.sfx('bells');
        game.shake = Math.max(game.shake, 0.2);
        Particles.burst(s.x, s.y - 20, 16, { colors: ['#3ec6b8', '#ffe9f2', '#fff'], type: 'star', sp1: 280, l1: 0.9, s1: 11 });
        const o = this.orbs[p.socket];
        Particles.burst(o.x, o.y, 12, { colors: ['#3ec6b8', '#7fd8ff'], type: 'sparkle', sp1: 200, l1: 1, s1: 10 });
        if (!this.doorOpen && this.sockets.every(k => k.filled)) {
          this.doorOpen = true; this.doorT = 0;
          AudioSys.sfx('rumble');
          game.shake = Math.max(game.shake, 0.5);
        }
      }
    }
    // ---- the great door wakes ----
    if (this.doorOpen && this.door && !this.door.broken) {
      this.doorT += dt;
      if (chance(0.4)) Particles.burst(2740 + rand(-40, 40), 1170 + rand(0, 360), 1, { colors: ['#c9a96a', '#8d8fa0'], type: 'block', sp1: 60, grav: 200, l1: 0.6, s1: 8 });
      if (this.doorT > 1.1) {
        this.door.broken = true;
        AudioSys.sfx('boom'); AudioSys.sfx('fanfare');
        game.shake = Math.max(game.shake, 0.5);
        Particles.burst(2740, 1350, 26, { colors: ['#8d8fa0', '#c9a96a', '#3ec6b8'], type: 'block', sp1: 420, l1: 1.2, s1: 13, grav: 500 });
        this.lv.goalStar = { x: 3240, y: 1320 }; // deep in the chamber — the reward gets its own space
        Particles.candyBurst(3240, 1290, 14);
      }
    }
  }
  drawBack(ctx, t) {
    // sandstone interior tints behind the rooms + hub columns + carvings
    ctx.save();
    ctx.fillStyle = 'rgba(201,169,106,0.16)';
    for (const r of [[1350, 1000, 1000, 530], [2700, 580, 700, 950], [3550, 1080, 1150, 450], [2350, 900, 350, 630]]) {
      rr(ctx, r[0], r[1], r[2], r[3], 14); ctx.fill();
    }
    ctx.fillStyle = 'rgba(201,169,106,0.4)';
    for (const cx2 of [2420, 2620]) { // hub columns
      rr(ctx, cx2 - 22, 940, 44, 590, 10); ctx.fill();
      rr(ctx, cx2 - 32, 920, 64, 26, 8); ctx.fill();
    }
    // wall carvings: rings of little pearl circles
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 3;
    for (const [ex, ey] of [[1700, 1180], [2000, 1180], [3900, 1240], [4300, 1240]]) {
      ctx.beginPath(); ctx.arc(ex, ey, 26, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(ex, ey, 10, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
  draw(ctx, t) {
    const lit = this.litCount();
    // ---- glowing streams from lit orbs to the door ----
    for (let i = 0; i < 3; i++) {
      if (!this.sockets[i].filled) continue;
      const o = this.orbs[i];
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.2 * Math.sin(t * 3 + i * 2);
      ctx.strokeStyle = '#3ec6b8'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(o.x, o.y);
      ctx.quadraticCurveTo((o.x + 2740) / 2, Math.min(o.y, 860) - 120, 2740, this.door && this.door.broken ? 1150 : 900);
      ctx.stroke();
      ctx.restore();
      if (chance(0.2)) Particles.burst(lerp(o.x, 2740, rand(0, 1)), lerp(o.y, 900, rand(0, 1)), 1, { colors: ['#3ec6b8', '#fff'], type: 'sparkle', sp1: 30, grav: -30, l1: 0.7, s1: 7, up: 0 });
    }
    // ---- orbs ----
    for (let i = 0; i < 3; i++) {
      const o = this.orbs[i], on = this.sockets[i].filled;
      ctx.fillStyle = '#8d8fa0';
      rr(ctx, o.x - 14, o.y + 12, 28, 26, 6); ctx.fill();
      if (on) {
        ctx.save();
        ctx.globalAlpha = 0.4 + 0.2 * Math.sin(t * 4 + i);
        ctx.fillStyle = '#3ec6b8';
        ctx.beginPath(); ctx.arc(o.x, o.y, 34, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = on ? '#7fe8dc' : '#5a6a7a';
      ctx.beginPath(); ctx.arc(o.x, o.y, 15, 0, TAU); ctx.fill();
      ctx.strokeStyle = on ? '#1e8a80' : '#3a4a5a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(o.x, o.y, 15, 0, TAU); ctx.stroke();
      if (on) drawFace(ctx, o.x, o.y + 2, 11, 'grin', t, o.x);
    }
    // ---- the great door + its stone face ----
    if (this.door) {
      const awake = this.doorOpen;
      if (!this.door.broken) {
        ctx.fillStyle = '#8d8fa0';
        rr(ctx, 2700, 1170, 80, 360, 6); ctx.fill();
        ctx.strokeStyle = '#5a5a70'; ctx.lineWidth = 3;
        rr(ctx, 2700, 1170, 80, 360, 6); ctx.stroke();
        // three pearl slots on the slab fill in as wings complete — wordless progress
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = this.sockets[i].filled ? '#3ec6b8' : 'rgba(255,255,255,0.25)';
          ctx.beginPath(); ctx.arc(2740, 1240 + i * 70, 13, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(30,60,80,0.5)'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(2740, 1240 + i * 70, 13, 0, TAU); ctx.stroke();
        }
        if (lit > 0) { // the seam glows brighter with every wing
          ctx.save();
          ctx.globalAlpha = 0.25 * lit * (0.7 + 0.3 * Math.sin(t * 5));
          ctx.strokeStyle = '#3ec6b8'; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.moveTo(2700, 1180); ctx.lineTo(2700, 1520); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(2780, 1180); ctx.lineTo(2780, 1520); ctx.stroke();
          ctx.restore();
        }
      } else { // rubble stubs where the slab stood
        ctx.fillStyle = '#8d8fa0';
        rr(ctx, 2700, 1480, 80, 50, 8); ctx.fill();
        rr(ctx, 2708, 1150, 64, 34, 8); ctx.fill();
      }
      // the guardian face on the wall above: asleep until the temple wakes
      drawFace(ctx, 2740, 1080, 34, awake ? 'grin' : 'sleepy', t, 7);
    }
    // ---- sockets: pedestal bowls with a ghost pearl asking for the real one ----
    for (const s of this.sockets) {
      ctx.fillStyle = '#8d8fa0';
      rr(ctx, s.x - 26, s.y - 6, 52, 12, 5); ctx.fill();
      ctx.strokeStyle = '#5a5a70'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.x, s.y - 8, 24, Math.PI * 0.1, Math.PI * 0.9, true); ctx.stroke();
      if (!s.filled) {
        ctx.save();
        ctx.globalAlpha = 0.3 + 0.14 * Math.sin(t * 3 + s.x);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(s.x, s.y - 18, 15, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    // ---- pearls: shimmering, googly, faintly smug ----
    for (const p of this.pearls) {
      const px = p.x + 16, py = p.y + 16;
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(p.t * 4);
      ctx.fillStyle = '#ffe9f2';
      ctx.beginPath(); ctx.arc(px, py, 26, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fdf3f6';
      ctx.beginPath(); ctx.arc(px, py, 16, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#d8a8c0'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(px, py, 16, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(px - 5, py - 6, 4.5, 0, TAU); ctx.fill();
      drawFace(ctx, px, py + 3, 11, p.done ? 'grin' : 'happy', p.t, p.hx);
    }
    // ---- valves: bronze wheels with a state lamp ----
    for (const v of this.valves) {
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.fillStyle = '#6a5a3a';
      rr(ctx, -6, 20, 12, 26, 4); ctx.fill(); // mount stem
      ctx.rotate(v.rot);
      ctx.strokeStyle = '#c98f4e'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.stroke();
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(i * TAU / 4) * 24, Math.sin(i * TAU / 4) * 24);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = v.on ? '#57d357' : '#8a8a9a'; // the lamp says ON
      ctx.beginPath(); ctx.arc(v.x, v.y, 8, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#3a3a4a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(v.x, v.y, 8, 0, TAU); ctx.stroke();
      if (this.nearValve === v && game.state === 'play') drawSpacebar(ctx, v.x, v.y - 74, 110, t);
    }
  }
}

// ================================================================ weather factory
// The machine for THE WEATHER FACTORY 2-2 (lv.puzzle on 'cloud2'): systems
// thinking and sequencing, taught wordlessly. Levers (Space nearby, always
// reversible until a station LATCHES done) combine into weather recipes:
// water -> RAIN blooms the flower garden (its giant stalk becomes the stairs
// to the high deck); the fan -> WIND spins the windmill, which latches POWER
// (a visible cable feeds the freezer and the sun lamp — nothing cold or
// bright works without it); water + cold + power -> SNOW builds the snowman;
// water + sun + power -> a RAINBOW bridges the great gap. Four lit orbs set
// the golden star on the far island. Wrong combos are weather comedy, never
// damage; latched progress can't be lost.
class WeatherFactory {
  constructor(lv) {
    this.lv = lv;
    this.levers = [
      { id: 'w1', x: 1750, y: 1100, icon: 'water', on: false, rockT: 0 },
      { id: 'fan', x: 3080, y: 1000, icon: 'wind', on: false, rockT: 0 },
      { id: 'w3', x: 4550, y: 1100, icon: 'water', on: false, rockT: 0 },
      { id: 'c3', x: 4720, y: 1100, icon: 'cold', on: false, rockT: 0 },
      { id: 'w4', x: 5900, y: 650, icon: 'water', on: false, rockT: 0 },
      { id: 's4', x: 6050, y: 650, icon: 'sun', on: false, rockT: 0 }
    ];
    this.st = { bloom: false, bloomT: 0, power: false, powerT: 0, snow: false, snowT: 0, rainbow: false, rbT: 0 };
    this.bloomA = 0; this.snowA = 0; this.spin = 0; this.starSet = false;
    this.orbs = [ // one per station, in station order
      { x: 2430, y: 1096 }, { x: 3850, y: 996 }, { x: 5240, y: 1096 }, { x: 6290, y: 646 }
    ];
    this.near = null; this.cool = 0; this.t = rand(9);
  }
  L(id) { return this.levers.find(l => l.id === id); }
  doneCount() { const s = this.st; return (s.bloom ? 1 : 0) + (s.power ? 1 : 0) + (s.snow ? 1 : 0) + (s.rainbow ? 1 : 0); }
  latch(orb, sfx) {
    AudioSys.sfx(sfx); AudioSys.sfx('fanfare');
    game.shake = Math.max(game.shake, 0.3);
    const o = this.orbs[orb];
    Particles.burst(o.x, o.y, 16, { colors: ['#ffd24a', '#fff', '#7fd8ff'], type: 'star', sp1: 300, l1: 1, s1: 11 });
  }
  update(dt, pl) {
    this.t += dt; this.cool = Math.max(0, this.cool - dt);
    // ---- levers ----
    this.near = null;
    for (const l of this.levers) {
      l.rockT = Math.max(0, l.rockT - dt);
      if (!this.near && Math.hypot(pl.cx - l.x, pl.cy - l.y) < 95) this.near = l;
    }
    if (this.near && justP.Space && this.cool <= 0 && game.state === 'play') {
      const l = this.near;
      this.cool = 0.3; l.on = !l.on; l.rockT = 0.4;
      AudioSys.sfx('switch'); AudioSys.sfx(l.on ? 'blorp' : 'thud');
      Particles.burst(l.x, l.y - 20, 8, { colors: ['#fff', '#bfe8ff'], type: 'sparkle', sp1: 140, l1: 0.6, s1: 8 });
    }
    const st = this.st;
    // ---- station 1: RAIN -> the flower garden blooms ----
    if (this.L('w1').on) {
      if (chance(0.7)) Particles.add({ x: rand(2000, 2320), y: 880, vx: 0, vy: 520, life: rand(0.4, 0.6), size: 4, color: 'rgba(120,180,255,0.8)', type: 'circle', grav: 300, spin: 0 });
      if (!st.bloom) {
        st.bloomT += dt;
        if (st.bloomT > 1.6) {
          st.bloom = true;
          this.latch(0, 'collect');
          // the giant flower stalk grows into the stairway to the high deck
          this.lv.solids.push(
            { x: 5490, y: 1070, w: 150, h: 30, oneWay: true, stalkLeaf: true, skipDraw: true },
            { x: 5610, y: 930, w: 150, h: 30, oneWay: true, stalkLeaf: true, skipDraw: true },
            { x: 5710, y: 790, w: 150, h: 30, oneWay: true, stalkLeaf: true, skipDraw: true }
          );
          Particles.burst(5570, 1100, 22, { colors: ['#57d357', '#ff8fb0', '#ffe156'], type: 'confetti', sp1: 320, l1: 1.4, s1: 11, grav: 250, up: 250 });
        }
      }
    }
    if (st.bloom) this.bloomA = Math.min(1, this.bloomA + dt / 1.2);
    // ---- station 2: WIND -> the windmill latches POWER (flywheel: forever) ----
    const wind = this.L('fan').on;
    if (wind) {
      if (chance(0.6)) Particles.add({ x: rand(3160, 3280), y: rand(880, 1020), vx: 620, vy: rand(-20, 20), life: rand(0.4, 0.7), size: rand(4, 7), color: 'rgba(255,255,255,0.6)', type: 'sparkle', grav: 0, spin: 0 });
      if (pl.cx > 3160 && pl.cx < 3700 && pl.cy > 840 && pl.cy < 1060) pl.vx += 520 * dt; // whee
      if (!st.power) {
        st.powerT += dt;
        if (st.powerT > 1.3) { st.power = true; this.latch(1, 'switch'); }
      }
    }
    this.spin += (st.power ? 5 : wind ? 2.5 : 0) * dt;
    // ---- station 3: RAIN + COLD (+ POWER) -> SNOW builds the snowman ----
    const r3 = this.L('w3').on, c3 = this.L('c3').on;
    if (r3 && !(c3 && st.power)) { // just rain: the puddle gets splashier (funny, harmless)
      if (chance(0.7)) Particles.add({ x: rand(4880, 5120), y: 890, vx: 0, vy: 520, life: rand(0.4, 0.6), size: 4, color: 'rgba(120,180,255,0.8)', type: 'circle', grav: 300, spin: 0 });
    }
    if (c3 && !st.power && chance(0.15)) { // freezer without power: sad gray sputter
      Particles.burst(4790, 1080, 1, { color: 'rgba(160,160,170,0.7)', type: 'bubble', sp1: 40, grav: -60, l1: 0.7, s1: 8, up: 10 });
    }
    if (r3 && c3 && st.power) {
      if (chance(0.8)) Particles.add({ x: rand(4880, 5120), y: 890, vx: rand(-15, 15), vy: 110, life: rand(1.2, 2), size: rand(4, 6), color: 'rgba(255,255,255,0.9)', type: 'sparkle', grav: 20, spin: 2 });
      if (!st.snow) {
        st.snowT += dt;
        if (st.snowT > 1.8) { st.snow = true; this.latch(2, 'bells'); }
      }
    }
    if (st.snow) this.snowA = Math.min(1, this.snowA + dt / 1.6);
    // ---- station 4: RAIN + SUN (+ POWER) -> the RAINBOW bridge ----
    const r4 = this.L('w4').on, s4 = this.L('s4').on;
    if (r4 && chance(0.7)) Particles.add({ x: rand(6400, 6640), y: 510, vx: 0, vy: 520, life: rand(0.5, 0.8), size: 4, color: 'rgba(120,180,255,0.8)', type: 'circle', grav: 300, spin: 0 });
    if (r4 && s4 && st.power && !st.rainbow) {
      this.st.rbT += dt;
      if (chance(0.5)) Particles.burst(rand(6360, 6700), rand(500, 660), 1, { colors: RAINBOW, type: 'sparkle', sp1: 40, grav: -30, l1: 0.7, s1: 8, up: 0 });
      if (this.st.rbT > 1.8) {
        st.rainbow = true;
        this.latch(3, 'rainbow');
        this.lv.solids.push({ x: 6340, y: 700, w: 760, h: 26, oneWay: true, rainbowRoad: true, skipDraw: true });
        Particles.burst(6700, 640, 30, { colors: RAINBOW.concat(['#fff']), type: 'star', sp1: 420, l1: 1.4, s1: 12, grav: 150 });
      }
    }
    // ---- all four -> the golden star, out on its own island ----
    if (!this.starSet && this.doneCount() === 4) {
      this.starSet = true;
      this.lv.goalStar = { x: 7380, y: 760 };
      AudioSys.sfx('chest');
      game.shake = Math.max(game.shake, 0.3);
      Particles.candyBurst(7380, 800, 12);
    }
  }
  drawBack(ctx, t) {
    // the power cable: windmill -> pylons -> freezer + sun lamp, sparks when live
    const pts = [[3660, 820], [4420, 1090], [4790, 1050], [5460, 1140], [5830, 660], [6200, 600]];
    ctx.save();
    ctx.strokeStyle = this.st.power ? 'rgba(255,225,86,0.75)' : 'rgba(90,90,110,0.6)';
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      ctx.quadraticCurveTo((pts[i - 1][0] + pts[i][0]) / 2, Math.max(pts[i - 1][1], pts[i][1]) + 46, pts[i][0], pts[i][1]);
    }
    ctx.stroke();
    ctx.fillStyle = '#8a7fae';
    for (let i = 1; i < 4; i++) rr(ctx, pts[i][0] - 6, pts[i][1], 12, 60, 4); ctx.fill();
    if (this.st.power) { // traveling sparks
      for (let i = 0; i < 3; i++) {
        const k = ((t * 0.35 + i / 3) % 1) * (pts.length - 1);
        const a = pts[Math.floor(k)], b = pts[Math.min(pts.length - 1, Math.floor(k) + 1)], f = k % 1;
        ctx.fillStyle = '#ffe156';
        ctx.beginPath(); ctx.arc(lerp(a[0], b[0], f), lerp(a[1], b[1], f) + 30 * Math.sin(f * Math.PI), 5, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  drawCloud(ctx, x, y, raining, t, seed) {
    ctx.fillStyle = raining ? '#9aa6c0' : '#ffffff';
    for (const [ox, oy, r] of [[-38, 4, 24], [0, -8, 32], [38, 4, 24], [-14, 12, 24], [18, 12, 24]]) {
      ctx.beginPath(); ctx.arc(x + ox, y + oy + Math.sin(t * 1.6 + seed) * 4, r, 0, TAU); ctx.fill();
    }
    drawFace(ctx, x, y + 6 + Math.sin(t * 1.6 + seed) * 4, 26, raining ? 'surprised' : 'sleepy', t, seed);
  }
  drawLeverIcon(ctx, l, x, y) {
    if (l.icon === 'water') {
      ctx.fillStyle = '#4aa3ff';
      ctx.beginPath(); ctx.arc(x, y + 2, 8, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x - 7, y - 1); ctx.lineTo(x + 7, y - 1); ctx.closePath(); ctx.fill();
    } else if (l.icon === 'cold') {
      ctx.strokeStyle = '#7fd8ff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a) * 10, y - Math.sin(a) * 10);
        ctx.lineTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10);
        ctx.stroke();
      }
    } else if (l.icon === 'sun') {
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffe156'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11);
        ctx.lineTo(x + Math.cos(a) * 15, y + Math.sin(a) * 15);
        ctx.stroke();
      }
    } else { // wind
      ctx.strokeStyle = '#ff8a65'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 9, y + i * 6);
        ctx.quadraticCurveTo(x + 4, y + i * 6 - 4, x + 10, y + i * 6);
        ctx.stroke();
      }
    }
  }
  drawThought(ctx, x, y, t, kind) { // wordless want-bubble
    ctx.save();
    ctx.globalAlpha = 0.85 + 0.1 * Math.sin(t * 3);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 20, y + 32, 7, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 28, y + 44, 4, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(40,25,50,0.35)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.stroke();
    if (kind === 'snowman') {
      ctx.fillStyle = '#eef4ff';
      ctx.beginPath(); ctx.arc(x, y + 8, 9, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y - 5, 6.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8a9ab0'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y + 8, 9, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y - 5, 6.5, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#2e2430';
      rr(ctx, x - 6, y - 14, 12, 4, 2); ctx.fill();
    } else { // rainbow
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = RAINBOW[i]; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y + 10, 16 - i * 3.5, Math.PI, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }
  draw(ctx, t) {
    const st = this.st;
    // ---- station 1: the flower garden ----
    this.drawCloud(ctx, 2150, 820, this.L('w1').on, t, 1);
    for (let i = 0; i < 6; i++) { // wilted brown stems -> huge happy blooms
      const fx = 1980 + i * 64, a = this.bloomA;
      ctx.strokeStyle = a > 0.3 ? '#3f9c3a' : '#8a6a4a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      const h = 24 + a * 56;
      ctx.beginPath();
      ctx.moveTo(fx, 1150);
      if (a > 0.3) ctx.lineTo(fx, 1150 - h);
      else ctx.quadraticCurveTo(fx + 12, 1140, fx + 16, 1132); // drooping
      ctx.stroke();
      if (a > 0.3) {
        const s = 8 + a * 10;
        ctx.fillStyle = ['#ff5a8a', '#ffb62b', '#b06cf0', '#ff8fb0', '#4aa3ff', '#ffe156'][i];
        for (let p = 0; p < 6; p++) {
          const an = p * TAU / 6 + t * 0.3;
          ctx.beginPath(); ctx.arc(fx + Math.cos(an) * s, 1150 - h + Math.sin(an) * s, s * 0.62, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#fff7c9';
        ctx.beginPath(); ctx.arc(fx, 1150 - h, s * 0.6, 0, TAU); ctx.fill();
        if (i === 2) drawFace(ctx, fx, 1150 - h, s, 'grin', t, i);
      }
    }
    // ---- station 2: fan + windmill ----
    ctx.fillStyle = '#8a7fae'; // the big fan
    rr(ctx, 3160, 940, 18, 110, 6); ctx.fill();
    ctx.save();
    ctx.translate(3169, 930);
    ctx.rotate(this.L('fan').on ? t * 14 : 0);
    ctx.fillStyle = '#c9c1d6';
    for (let i = 0; i < 3; i++) {
      ctx.rotate(TAU / 3);
      ctx.beginPath(); ctx.ellipse(0, -20, 10, 22, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
    // windmill tower
    ctx.fillStyle = '#e8e4f4';
    ctx.beginPath();
    ctx.moveTo(3620, 1050); ctx.lineTo(3636, 830); ctx.lineTo(3684, 830); ctx.lineTo(3700, 1050);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8a7fae'; ctx.lineWidth = 3; ctx.stroke();
    drawFace(ctx, 3660, 960, 26, st.power ? 'grin' : 'sleepy', t, 5);
    ctx.save();
    ctx.translate(3660, 820);
    ctx.rotate(this.spin);
    ctx.fillStyle = '#ffd24a';
    for (let i = 0; i < 4; i++) {
      ctx.rotate(TAU / 4);
      rr(ctx, -8, -86, 16, 86, 7); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#8a7fae';
    ctx.beginPath(); ctx.arc(3660, 820, 10, 0, TAU); ctx.fill();
    // ---- station 3: freezer + puddle -> snowman ----
    ctx.fillStyle = '#bfe8ff'; // freezer box
    rr(ctx, 4760, 1060, 60, 90, 8); ctx.fill();
    ctx.strokeStyle = '#3a8ac2'; ctx.lineWidth = 3;
    rr(ctx, 4760, 1060, 60, 90, 8); ctx.stroke();
    this.drawLeverIcon(ctx, { icon: 'cold' }, 4790, 1095);
    ctx.fillStyle = st.power ? '#57d357' : '#5a5a6a'; // its power lamp
    ctx.beginPath(); ctx.arc(4790, 1136, 6, 0, TAU); ctx.fill();
    this.drawCloud(ctx, 5000, 830, this.L('w3').on, t, 3);
    const sa = this.snowA;
    if (sa < 1) { // the hopeful puddle with a carrot
      ctx.fillStyle = 'rgba(120,180,255,0.5)';
      ctx.beginPath(); ctx.ellipse(5000, 1146, 60 - sa * 30, 9, 0, 0, TAU); ctx.fill();
    }
    if (sa <= 0.05) {
      ctx.fillStyle = '#ffa62b';
      ctx.beginPath(); ctx.moveTo(4994, 1136); ctx.lineTo(5006, 1136); ctx.lineTo(5000, 1112); ctx.closePath(); ctx.fill();
      this.drawThought(ctx, 5060, 1030, t, 'snowman');
    } else { // the snowman assembles, bottom-up
      ctx.fillStyle = '#f4f8ff'; ctx.strokeStyle = '#a8b8d0'; ctx.lineWidth = 2.5;
      const balls = [[5000, 1122, 28], [5000, 1078, 21], [5000, 1044, 15]];
      for (let i = 0; i < 3; i++) {
        if (sa < (i + 1) / 3.2) break;
        ctx.beginPath(); ctx.arc(balls[i][0], balls[i][1], balls[i][2], 0, TAU); ctx.fill(); ctx.stroke();
      }
      if (sa >= 0.94) {
        ctx.fillStyle = '#ffa62b'; // carrot nose, at last
        ctx.beginPath(); ctx.moveTo(5008, 1044); ctx.lineTo(5024, 1048); ctx.lineTo(5008, 1052); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2e2430';
        rr(ctx, 4988, 1022, 24, 7, 3); ctx.fill();
        rr(ctx, 4993, 1006, 14, 18, 3); ctx.fill();
        drawFace(ctx, 4998, 1044, 13, 'grin', t, 9);
        const wave = Math.sin(t * 5) * 0.4; // he waves forever
        ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(5018, 1078); ctx.lineTo(5040, 1058 + wave * 14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4982, 1078); ctx.lineTo(4962, 1086); ctx.stroke();
      }
    }
    // ---- station 4: sun lamp + the gap cloud + rainbow ----
    ctx.fillStyle = '#8a7fae';
    rr(ctx, 6194, 560, 12, 140, 5); ctx.fill();
    ctx.fillStyle = this.L('s4').on && st.power ? '#ffe156' : '#5a5a6a';
    ctx.beginPath(); ctx.arc(6200, 550, 16, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a3a4a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(6200, 550, 16, 0, TAU); ctx.stroke();
    if (this.L('s4').on && st.power) { // the beam angles out over the gap
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.1 * Math.sin(t * 5);
      ctx.fillStyle = '#ffe156';
      ctx.beginPath();
      ctx.moveTo(6212, 540); ctx.lineTo(6640, 400); ctx.lineTo(6560, 560);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    this.drawCloud(ctx, 6520, 440, this.L('w4').on, t, 4);
    if (!st.rainbow) this.drawThought(ctx, 6390, 590, t, 'rainbow');
    else { // the rainbow road itself
      ctx.save();
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < RAINBOW.length; i++) {
        ctx.strokeStyle = RAINBOW[i]; ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(6340, 706 + i * 6);
        ctx.quadraticCurveTo(6720, 620 + i * 6, 7100, 706 + i * 6);
        ctx.stroke();
      }
      ctx.restore();
      if (chance(0.15)) Particles.burst(rand(6360, 7080), rand(650, 700), 1, { colors: RAINBOW, type: 'sparkle', sp1: 25, grav: -30, l1: 0.7, s1: 7, up: 0 });
    }
    // ---- the stalk stairway (once bloomed) ----
    if (st.bloom) {
      ctx.strokeStyle = '#3f9c3a'; ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(5570, 1200);
      ctx.quadraticCurveTo(5520, 1000, 5620, 880);
      ctx.quadraticCurveTo(5720, 780, 5770, 720);
      ctx.stroke();
      ctx.fillStyle = '#57b84a';
      for (const s of this.lv.solids) {
        if (!s.stalkLeaf) continue;
        ctx.beginPath(); ctx.ellipse(s.x + s.w / 2, s.y + 12, s.w / 2 + 8, 16, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#2f8a3c'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(s.x + s.w / 2, s.y + 12, s.w / 2 + 8, 16, 0, 0, TAU); ctx.stroke();
      }
      ctx.fillStyle = '#ff8fb0'; // the giant bloom at the top
      for (let p = 0; p < 7; p++) {
        const an = p * TAU / 7 + t * 0.2;
        ctx.beginPath(); ctx.arc(5770 + Math.cos(an) * 26, 700 + Math.sin(an) * 26, 17, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#fff7c9';
      ctx.beginPath(); ctx.arc(5770, 700, 17, 0, TAU); ctx.fill();
      drawFace(ctx, 5770, 700, 15, 'grin', t, 11);
    }
    // ---- orbs ----
    const lit = [st.bloom, st.power, st.snow, st.rainbow];
    for (let i = 0; i < 4; i++) {
      const o = this.orbs[i];
      ctx.fillStyle = '#8a7fae';
      rr(ctx, o.x - 12, o.y + 10, 24, 22, 6); ctx.fill();
      if (lit[i]) {
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 4 + i);
        ctx.fillStyle = '#ffd24a';
        ctx.beginPath(); ctx.arc(o.x, o.y, 30, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = lit[i] ? '#ffe156' : '#5a6a7a';
      ctx.beginPath(); ctx.arc(o.x, o.y, 13, 0, TAU); ctx.fill();
      ctx.strokeStyle = lit[i] ? '#c8861b' : '#3a4a5a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(o.x, o.y, 13, 0, TAU); ctx.stroke();
    }
    // ---- the star pedestal, alone on its island ----
    ctx.fillStyle = '#c9c1d6';
    rr(ctx, 7350, 830, 60, 70, 8); ctx.fill();
    ctx.strokeStyle = '#8a7fae'; ctx.lineWidth = 3;
    rr(ctx, 7350, 830, 60, 70, 8); ctx.stroke();
    for (let i = 0; i < 4; i++) { // four little weather slots fill in — wordless progress
      const sx = 7380 + (i % 2 ? 14 : -14), sy = 848 + (i > 1 ? 30 : 0);
      ctx.fillStyle = lit[i] ? ['#4aa3ff', '#ff8a65', '#eef4ff', '#b06cf0'][i] : 'rgba(90,90,110,0.5)';
      ctx.beginPath(); ctx.arc(sx, sy, 9, 0, TAU); ctx.fill();
    }
    // ---- levers last, on top ----
    for (const l of this.levers) {
      ctx.fillStyle = '#5a5a6a';
      rr(ctx, l.x - 20, l.y + 26, 40, 14, 5); ctx.fill();
      const ang = (l.on ? 0.55 : -0.55) + Math.sin(Math.max(0, l.rockT) * 22) * 0.12;
      ctx.save();
      ctx.translate(l.x, l.y + 28);
      ctx.rotate(ang);
      ctx.strokeStyle = '#8a8a9a'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -46); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, -52, 15, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#4a3a66'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, -52, 15, 0, TAU); ctx.stroke();
      this.drawLeverIcon(ctx, l, 0, -52);
      ctx.restore();
      if (this.near === l && game.state === 'play') drawSpacebar(ctx, l.x, l.y - 64, 110, t);
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
      // The pit garage adds one rule: RACING past at monster-truck speed never
      // hijacks the race — you have to stop (or press ★) to investigate.
      const zoomBy = this.style === 'garage' && game.player.vehicle === 'truck' &&
        Math.abs(game.player.vx) > 200 && !justP.Space;
      if ((!done && !zoomBy) || justP.Space) {
        this.armed = false;
        if (this.style === 'pipe') AudioSys.sfx('blorp'); // FWOOOP — sucked in!
        if (this.style === 'asteroid') AudioSys.sfx('whoosh'); // pulled through the crack
        if (this.style === 'ladder') AudioSys.sfx('monkey'); // welcomed up the tree
        if (this.style === 'garage') AudioSys.sfx('hornhit'); // the band waves you in
        if (this.style === 'moonwell') { AudioSys.sfx('whoosh'); AudioSys.sfx('bells'); } // up into the night
        if (this.style === 'stagegate') AudioSys.sfx('fanfare'); // onward to stage two!
        game.enterSub(this.sub);
        return;
      }
    }
    if (!over && Math.abs(game.player.cx - this.cx) > this.w) this.armed = true;
    if (chance(done ? 0.025 : 0.1)) {
      const cols = this.style === 'rainbow' ? RAINBOW
        : this.style === 'cave' ? ['#ffe156', '#d0a0ff']
        : this.style === 'crack' ? ['#ff9f43', '#ffe156']
        : this.style === 'pipe' ? ['#ffd24a', '#7be07b']
        : this.style === 'eyes' ? ['#ffe156', '#ff9f43']
        : this.style === 'asteroid' ? ['#ffd24a', '#ffe156']
        : this.style === 'ladder' ? ['#7be07b', '#ffe156']
        : this.style === 'garage' ? ['#ffe156', '#ff8fb0', '#7fd8ff']
        : this.style === 'moonwell' ? ['#e8ecff', '#bfd0ff', '#ffe156']
        : this.style === 'stagegate' ? ['#ffe156', '#7be07b', '#fff']
        : ['#fff', '#bfe8ff'];
      Particles.burst(this.cx + rand(-34, 34), this.y + rand(10, this.h - 10), 1, { colors: cols, type: 'sparkle', sp1: 25, grav: -50, l1: 0.8, s1: 8, up: 0 });
    }
    // the bubble door's clue: a strange stream of bubbles rises out of the
    // cave — the invitation stops once the secret has been found
    if (this.style === 'bubble' && !done && chance(0.4)) {
      Particles.burst(this.cx + rand(-14, 14), this.y + 30, 1, { color: 'rgba(255,255,255,0.75)', type: 'bubble', sp1: 25, grav: -170, l0: 2, l1: 3.4, up: 0, s1: 10 });
    }
    // the pipe's clue: every few seconds it BURPS a piece of candy into the air
    if (this.style === 'pipe' && !done) {
      this.burpT = (this.burpT ?? rand(1, 3)) - dt;
      if (this.burpT <= 0) {
        this.burpT = rand(2.6, 4.4);
        this.burpAnim = 0.5;
        Particles.burst(this.cx, this.y - 8, 1, { colors: ['#ffd24a'], type: 'candy', sp1: 140, grav: 500, l0: 1, l1: 1.6, up: 260, s1: 18 });
        if (Math.abs(this.cx - (game.cam.x + W / 2)) < W * 0.8) AudioSys.sfx('hiccup');
      }
      this.burpAnim = Math.max(0, (this.burpAnim || 0) - dt);
    }
    // the asteroid crack's clue: golden candy sparkles drift out through it
    if (this.style === 'asteroid' && !done && chance(0.25)) {
      Particles.burst(this.cx + rand(-20, 20), this.y + rand(10, 40), 1, { colors: ['#ffd24a', '#ffe156'], type: 'sparkle', sp1: 45, grav: -55, l0: 1.2, l1: 2.2, up: 0, s1: 10 });
    }
    // the rope ladder's clue: leaves flutter down out of the canopy and every
    // so often a faint monkey whoop drifts from somewhere high above
    if (this.style === 'ladder' && !done) {
      if (chance(0.07)) Particles.burst(this.cx + rand(-46, 46), this.y - 40, 1, { colors: ['#57d357', '#7be07b', '#ffe156'], type: 'confetti', sp1: 25, grav: 55, l0: 1.4, l1: 2.6, up: 0, s1: 10 });
      this.whoopT = (this.whoopT ?? rand(3, 6)) - dt;
      if (this.whoopT <= 0) {
        this.whoopT = rand(6, 11);
        if (Math.abs(this.cx - (game.cam.x + W / 2)) < W * 0.7) AudioSys.sfx('monkey');
      }
    }
    // the moonwell's clue: music notes drift down out of the shaft and every
    // so often a faint far-away bell rings up there — a whole other WORLD is
    // leaking through the crack in the ceiling
    if (this.style === 'moonwell' && !done) {
      if (chance(0.06)) Particles.burst(this.cx + rand(-30, 30), this.y - rand(60, 260), 1, { colors: ['#e8ecff', '#ffe156'], type: 'sparkle', sp1: 20, grav: 45, l0: 1.4, l1: 2.4, up: 0, s1: 9 });
      this.bellT = (this.bellT ?? rand(3, 6)) - dt;
      if (this.bellT <= 0) {
        this.bellT = rand(6, 10);
        if (Math.abs(this.cx - (game.cam.x + W / 2)) < W * 0.7) AudioSys.sfx('bells');
      }
    }
    // the pit garage's clue: the whole building THUMPS to a muffled beat,
    // colored light flashes through the door seams, an occasional wrench flies
    // off the roof, and a little mechanic peeks out — sees you — SLAMS the door
    if (this.style === 'garage' && !done) {
      const nearCam = Math.abs(this.cx - (game.cam.x + W / 2)) < W * 0.75;
      this.beatT = (this.beatT ?? 0) + dt;
      if (this.beatT >= 0.62) {
        this.beatT -= 0.62;
        this.beatN = (this.beatN ?? 0) + 1;
        this.thump = 1;
        if (nearCam) {
          AudioSys.sfx('muffbeat');
          if (this.beatN % 4 === 3) AudioSys.sfx('muffhonk'); // BOOM BOOM ... HONK
        }
      }
      this.thump = Math.max(0, (this.thump ?? 0) - dt * 4);
      this.wrenchT = (this.wrenchT ?? rand(3, 6)) - dt;
      if (this.wrenchT <= 0) {
        this.wrenchT = rand(4.5, 8);
        Particles.burst(this.cx + rand(-20, 20), this.y - 40, 2, { colors: ['#8a8a9a', '#c9c1d6'], type: 'block', sp1: 240, l0: 0.9, l1: 1.4, s1: 10, grav: 700, up: 320 });
        if (nearCam) AudioSys.sfx('clank');
      }
      // the peek-a-boo mechanic (only when the hero is close enough to see it)
      if (this.peekAnim > 0) {
        const prev = this.peekAnim;
        this.peekAnim -= dt;
        if (prev > 0.3 && this.peekAnim <= 0.3) { // SLAM!
          if (nearCam) AudioSys.sfx('thud');
          Particles.burst(this.cx, this.groundY - 6, 6, { colors: ['#b09a7a', '#8a8a9a'], sp1: 120, l1: 0.5, s1: 8, up: 40 });
        }
      } else {
        this.peekT = (this.peekT ?? 3) - dt;
        if (this.peekT <= 0 && Math.abs(game.player.cx - this.cx) < 430) {
          this.peekT = rand(6, 9);
          this.peekAnim = 1.3;
          if (nearCam) AudioSys.sfx('hiccup');
        }
      }
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
    } else if (this.style === 'pipe') {
      // a suspiciously oversized green pipe sticking out of the meadow, with a
      // face and a wobble — it clearly ate too much candy
      const burp = this.burpAnim > 0 ? Math.sin(this.burpAnim * 20) * 3 * this.burpAnim : 0;
      const wob = Math.sin(t * 1.8) * 0.03;
      ctx.save();
      ctx.translate(cx, g);
      ctx.rotate(wob);
      ctx.translate(-cx, -g);
      // pipe body
      const pw = this.w + 18, ph = this.h - 8;
      const grad = ctx.createLinearGradient(cx - pw / 2, 0, cx + pw / 2, 0);
      grad.addColorStop(0, '#57b84a'); grad.addColorStop(0.5, '#7be07b'); grad.addColorStop(1, '#3f9c3a');
      ctx.fillStyle = grad;
      rr(ctx, cx - pw / 2, g - ph + burp, pw, ph + 6, 10); ctx.fill();
      ctx.strokeStyle = '#2f8a3c'; ctx.lineWidth = 4;
      rr(ctx, cx - pw / 2, g - ph + burp, pw, ph + 6, 10); ctx.stroke();
      // fat rim on top
      const rw = pw + 22;
      ctx.fillStyle = grad;
      rr(ctx, cx - rw / 2, g - ph - 34 + burp, rw, 42, 12); ctx.fill();
      ctx.strokeStyle = '#2f8a3c';
      rr(ctx, cx - rw / 2, g - ph - 34 + burp, rw, 42, 12); ctx.stroke();
      // dark mouth with a candy glint deep inside
      ctx.fillStyle = '#143a18';
      ctx.beginPath(); ctx.ellipse(cx, g - ph - 30 + burp, rw / 2 - 12, 12, 0, 0, TAU); ctx.fill();
      ctx.save();
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 5);
      drawCandy(ctx, cx + Math.sin(t * 1.3) * 10, g - ph - 28 + burp, 9, 1, t);
      ctx.restore();
      // sleepy-then-surprised pipe face
      drawFace(ctx, cx, g - ph * 0.45 + burp, 42, this.burpAnim > 0 ? 'surprised' : 'happy', t, 61);
      ctx.restore();
    } else if (this.style === 'eyes') {
      // a low dark side-tunnel: two glowing eyes blink inside, and a tiny
      // torch flickers by the entrance — "something is over here"
      ctx.fillStyle = '#2a2140';
      ctx.beginPath(); ctx.ellipse(cx, g - 2, this.w / 2 + 16, this.h - 4, 0, Math.PI, TAU); ctx.fill();
      ctx.strokeStyle = '#453563'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(cx, g - 2, this.w / 2 + 16, this.h - 4, 0, Math.PI, TAU); ctx.stroke();
      ctx.fillStyle = '#0c0618';
      ctx.beginPath(); ctx.ellipse(cx, g - 2, this.w / 2 - 4, this.h - 26, 0, Math.PI, TAU); ctx.fill();
      // the two glowing eyes (they blink)
      if (((t * 0.9) % 3.1) > 0.18) {
        for (const sd of [-1, 1]) {
          ctx.save();
          ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 3 + sd);
          ctx.fillStyle = '#ffe156';
          ctx.beginPath(); ctx.ellipse(cx + sd * 16, g - this.h * 0.52, 8, 11, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#3a2a3a';
          ctx.beginPath(); ctx.arc(cx + sd * 16, g - this.h * 0.5, 3.5, 0, TAU); ctx.fill();
          ctx.restore();
        }
      }
      // tiny wall torch beside the mouth
      const tx = cx - this.w / 2 - 30;
      ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, g - 44); ctx.lineTo(tx, g - 70); ctx.stroke();
      const fl = 1 + Math.sin(t * 11) * 0.2;
      ctx.fillStyle = '#ff9f43';
      ctx.beginPath(); ctx.ellipse(tx, g - 80, 7 * fl, 11 * fl, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.ellipse(tx, g - 78, 3.5 * fl, 6 * fl, 0, 0, TAU); ctx.fill();
    } else if (this.style === 'asteroid') {
      // a cracked asteroid boulder — golden light leaks through the zigzag
      // cracks, and candy sparkles drift out
      ctx.fillStyle = '#5f5a78';
      ctx.beginPath();
      ctx.moveTo(cx - this.w / 2 - 16, g);
      ctx.quadraticCurveTo(cx - this.w / 2 - 24, g - this.h * 0.7, cx - 16, g - this.h - 10);
      ctx.quadraticCurveTo(cx + 30, g - this.h - 22, cx + this.w / 2 + 20, g - this.h * 0.55);
      ctx.quadraticCurveTo(cx + this.w / 2 + 26, g - 10, cx + this.w / 2 - 6, g);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3d3766'; ctx.lineWidth = 4; ctx.stroke();
      // craters
      ctx.fillStyle = '#4a4560';
      for (const [ox, oy, r2] of [[-26, -84, 9], [24, -34, 12], [-8, -20, 7]]) {
        ctx.beginPath(); ctx.arc(cx + ox, g + oy, r2, 0, TAU); ctx.fill();
      }
      // the glowing golden crack
      ctx.save();
      ctx.strokeStyle = 'rgba(255,210,74,' + (0.65 + 0.3 * Math.sin(t * 3)) + ')';
      ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 6, g - this.h - 2);
      ctx.lineTo(cx + 10, g - this.h * 0.72);
      ctx.lineTo(cx - 12, g - this.h * 0.5);
      ctx.lineTo(cx + 8, g - this.h * 0.26);
      ctx.lineTo(cx - 4, g - 6);
      ctx.stroke();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 + 0.3 * Math.sin(t * 3 + 1)) + ')';
      ctx.stroke();
      ctx.restore();
      // sleepy rock face, dreaming of candy
      drawFace(ctx, cx - 30, g - this.h * 0.62, 26, 'sleepy', t, 62);
    } else if (this.style === 'ladder') {
      // a rope ladder dangling down a giant mossy trunk — high above (too high
      // to be part of this level) a tiny treehouse peeks out of the leaves
      const tw = this.w + 34;
      ctx.fillStyle = '#8a5a34';
      rr(ctx, cx - tw / 2, this.y - 46, tw, this.h + 46, 14); ctx.fill();
      ctx.strokeStyle = '#5f3a1e'; ctx.lineWidth = 4;
      rr(ctx, cx - tw / 2, this.y - 46, tw, this.h + 46, 14); ctx.stroke();
      // bark seams + a knothole
      ctx.strokeStyle = 'rgba(95,58,30,0.6)'; ctx.lineWidth = 3;
      for (const ox of [-tw * 0.28, tw * 0.18]) {
        ctx.beginPath();
        ctx.moveTo(cx + ox, this.y - 40);
        ctx.quadraticCurveTo(cx + ox + 6, this.y + 30, cx + ox - 4, g - 8);
        ctx.stroke();
      }
      ctx.fillStyle = '#5f3a1e';
      ctx.beginPath(); ctx.ellipse(cx + tw * 0.24, this.y + 34, 9, 12, 0, 0, TAU); ctx.fill();
      // leafy canopy tuft spilling over the trunk top
      ctx.fillStyle = '#3f9c3a';
      for (const [ox, r2] of [[-34, 20], [0, 26], [34, 19]]) {
        ctx.beginPath(); ctx.arc(cx + ox, this.y - 48, r2, 0, TAU); ctx.fill();
      }
      // the tiny far-away treehouse up in the leaves
      ctx.fillStyle = '#b0743e';
      rr(ctx, cx - 15, this.y - 92, 30, 22, 4); ctx.fill();
      ctx.fillStyle = '#8a5a34';
      ctx.beginPath();
      ctx.moveTo(cx - 20, this.y - 92); ctx.lineTo(cx, this.y - 108); ctx.lineTo(cx + 20, this.y - 92);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe9c0';
      ctx.beginPath(); ctx.arc(cx, this.y - 81, 5, 0, TAU); ctx.fill();
      // two little monkey eyes blink in the doorway of the treehouse
      if (!done && ((t * 0.8) % 2.8) > 0.2) {
        ctx.fillStyle = '#3a2a3a';
        ctx.beginPath(); ctx.arc(cx - 2, this.y - 81, 1.4, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 3, this.y - 81, 1.4, 0, TAU); ctx.fill();
      }
      // the rope ladder itself, swaying gently
      const sway = Math.sin(t * 1.5) * 4;
      ctx.strokeStyle = '#d9b98a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + sd * 17, this.y - 40);
        ctx.quadraticCurveTo(cx + sd * 17 + sway * 0.5, this.y + 40, cx + sd * 17 + sway, g - 6);
        ctx.stroke();
      }
      ctx.lineWidth = 5;
      for (let ry = this.y - 24; ry < g - 10; ry += 24) {
        const k = (ry - this.y + 24) / this.h;
        ctx.beginPath();
        ctx.moveTo(cx - 16 + sway * k * 0.9, ry); ctx.lineTo(cx + 16 + sway * k * 0.9, ry);
        ctx.stroke();
      }
      // a happy face carved low in the bark — the tree is friendly
      drawFace(ctx, cx - tw * 0.26, g - 34, 20, 'happy', t, 67);
    } else if (this.style === 'moonwell') {
      // a crack in the cave ceiling with REAL night sky behind it: a pale
      // moonbeam pours all the way down to the floor, dust motes drift in the
      // light, and rough rock rungs climb the wall — "up there is... outside?"
      const bx = cx;
      // the beam (widens on the way down)
      ctx.save();
      ctx.globalAlpha = 0.28 + 0.08 * Math.sin(t * 1.4);
      ctx.fillStyle = '#dfe6ff';
      ctx.beginPath();
      ctx.moveTo(bx - 26, 0); ctx.lineTo(bx + 26, 0);
      ctx.lineTo(bx + 62, g); ctx.lineTo(bx - 62, g);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.35 + 0.12 * Math.sin(t * 1.4 + 1);
      ctx.beginPath();
      ctx.moveTo(bx - 10, 0); ctx.lineTo(bx + 10, 0);
      ctx.lineTo(bx + 26, g); ctx.lineTo(bx - 26, g);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      // the crack itself, with stars twinkling through it
      ctx.fillStyle = '#0d0b2a';
      ctx.beginPath();
      ctx.moveTo(bx - 34, 0); ctx.quadraticCurveTo(bx - 12, 26, bx + 8, 18);
      ctx.quadraticCurveTo(bx + 30, 10, bx + 36, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      for (const [ox, oy, r2] of [[-18, 6, 2.4], [2, 11, 3], [20, 5, 2]]) {
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 2.5 + ox);
        ctx.beginPath(); ctx.arc(bx + ox, oy, r2, 0, TAU); ctx.fill();
        ctx.restore();
      }
      // rough rock rungs up the shaft wall
      ctx.fillStyle = '#5f6070';
      for (let ry = g - 40; ry > 60; ry -= 64) {
        rr(ctx, bx - 40 + Math.sin(ry) * 8, ry, 34, 11, 5); ctx.fill();
      }
      // dust motes floating in the beam
      ctx.fillStyle = 'rgba(232,236,255,0.8)';
      for (let i = 0; i < 5; i++) {
        const mph = ((t * 0.11 + i * 0.2) % 1);
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 3 + i * 2);
        ctx.beginPath();
        ctx.arc(bx + Math.sin(t * 0.7 + i * 2.2) * (14 + mph * 30), mph * g, 2.5, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      // a soft pool of moonlight on the cave floor
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.1 * Math.sin(t * 1.4);
      ctx.fillStyle = '#dfe6ff';
      ctx.beginPath(); ctx.ellipse(bx, g, 64, 10, 0, 0, TAU); ctx.fill();
      ctx.restore();
    } else if (this.style === 'garage') {
      // a little pit-lane garage that is VERY obviously having a party inside:
      // the roller door bounces to the beat, colored light strobes through the
      // seams, and sometimes a mechanic peeks out and slams the door shut
      const done2 = this.done();
      const thump = done2 ? 0 : (this.thump ?? 0);
      const peek = done2 ? 0 : Math.max(0, this.peekAnim ?? 0);
      // door lift: peek raises the door bottom ~30px, then it slams back down
      const lift = peek > 0.3 ? Math.min(1, (1.3 - peek) / 0.35) * 30 : peek > 0 ? peek / 0.3 * 30 : 0;
      const bw = this.w + 52, bh = this.h + 44;
      const squish = 1 + thump * 0.045;
      ctx.save();
      ctx.translate(cx, g);
      ctx.scale(1 / squish, squish); // the whole building pumps to the beat
      ctx.translate(-cx, -g);
      // concrete building
      ctx.fillStyle = '#b8b2c4';
      rr(ctx, cx - bw / 2, g - bh, bw, bh, 8); ctx.fill();
      ctx.strokeStyle = '#7a7490'; ctx.lineWidth = 4;
      rr(ctx, cx - bw / 2, g - bh, bw, bh, 8); ctx.stroke();
      // flat roof slab + a stubby exhaust stack puffing to the music
      ctx.fillStyle = '#8a8496';
      rr(ctx, cx - bw / 2 - 10, g - bh - 14, bw + 20, 20, 6); ctx.fill();
      ctx.fillStyle = '#6f6a80';
      rr(ctx, cx + bw / 2 - 26, g - bh - 40, 16, 30, 4); ctx.fill();
      if (!done2 && thump > 0.7) {
        Particles.burst(cx + bw / 2 - 18, g - bh - 44, 1, { color: 'rgba(200,200,210,0.55)', sp1: 25, grav: -110, l1: 0.7, s1: 9, up: 10 });
      }
      // roof sign: a tire with a bouncing music note — "band inside"
      ctx.fillStyle = '#2e2430';
      ctx.beginPath(); ctx.arc(cx - bw / 2 + 20, g - bh - 26, 16, 0, TAU); ctx.fill();
      ctx.fillStyle = '#c9c1d6';
      ctx.beginPath(); ctx.arc(cx - bw / 2 + 20, g - bh - 26, 6, 0, TAU); ctx.fill();
      const nb = Math.sin(t * 6) * 4;
      ctx.strokeStyle = '#5a4a86'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx + 6, g - bh - 24 + nb); ctx.lineTo(cx + 6, g - bh - 44 + nb); ctx.stroke();
      ctx.fillStyle = '#5a4a86';
      ctx.beginPath(); ctx.ellipse(cx + 2, g - bh - 22 + nb, 6, 4.5, -0.4, 0, TAU); ctx.fill();
      // the corrugated roller door (this is the actual doorway)
      const dw = this.w - 4, dh = this.h - 22;
      ctx.fillStyle = '#3a3448';
      rr(ctx, cx - dw / 2 - 5, g - dh - 5, dw + 10, dh + 5, 6); ctx.fill();
      ctx.fillStyle = '#ffb62b';
      rr(ctx, cx - dw / 2, g - dh - lift, dw, dh, 5); ctx.fill();
      ctx.strokeStyle = '#c2831a'; ctx.lineWidth = 3;
      rr(ctx, cx - dw / 2, g - dh - lift, dw, dh, 5); ctx.stroke();
      // slats, with party light strobing through the seams
      const hue = ['#ff5fa2', '#7fd8ff', '#ffe156', '#7be07b'][(this.beatN ?? 0) % 4];
      for (let sy = g - dh - lift + 14; sy < g - lift - 8; sy += 16) {
        ctx.strokeStyle = '#c2831a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cx - dw / 2 + 4, sy); ctx.lineTo(cx + dw / 2 - 4, sy); ctx.stroke();
        if (!done2) {
          ctx.save();
          ctx.globalAlpha = 0.35 + thump * 0.55;
          ctx.strokeStyle = hue; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(cx - dw / 2 + 8, sy); ctx.lineTo(cx + dw / 2 - 8, sy); ctx.stroke();
          ctx.restore();
        }
      }
      // glow spilling out under the door (and the peeking mechanic in the gap)
      if (!done2) {
        ctx.save();
        ctx.globalAlpha = 0.4 + thump * 0.5;
        ctx.fillStyle = hue;
        ctx.beginPath(); ctx.ellipse(cx, g, dw / 2 + 8 + thump * 8, 7 + lift * 0.5, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      if (lift > 8) { // the tiny mechanic: goggles, big eyes, instant regret
        ctx.fillStyle = '#0e0a1c';
        rr(ctx, cx - dw / 2 + 4, g - lift, dw - 8, lift, 3); ctx.fill();
        ctx.fillStyle = '#c9c1d6';
        ctx.beginPath(); ctx.arc(cx, g - lift / 2 + 2, Math.min(12, lift * 0.45), 0, TAU); ctx.fill();
        drawFace(ctx, cx, g - lift / 2 + 3, Math.min(16, lift * 0.62), 'surprised', t, 73);
      }
      ctx.restore();
    } else if (this.style === 'stagegate') {
      // STAGE archway: wooden posts, an arched beam, a golden star on top and a
      // big "2" badge — not a secret, an invitation: the meadow keeps going!
      const postW = 16;
      // the sunny path leading "onward" through the doorway
      ctx.fillStyle = 'rgba(255,244,180,0.5)';
      rr(ctx, this.x + postW, this.y + 26, this.w - postW * 2, this.h - 26, 8); ctx.fill();
      // posts
      ctx.fillStyle = '#b0743e';
      for (const px of [this.x, this.x + this.w - postW]) {
        rr(ctx, px, this.y + 14, postW, this.h - 14, 6); ctx.fill();
      }
      ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 3;
      for (const px of [this.x, this.x + this.w - postW]) {
        rr(ctx, px, this.y + 14, postW, this.h - 14, 6); ctx.stroke();
      }
      // arched beam
      ctx.fillStyle = '#c98f4e';
      ctx.beginPath();
      ctx.moveTo(this.x - 8, this.y + 30);
      ctx.quadraticCurveTo(cx, this.y - 18, this.x + this.w + 8, this.y + 30);
      ctx.lineTo(this.x + this.w - 4, this.y + 42);
      ctx.quadraticCurveTo(cx, this.y - 2, this.x + 4, this.y + 42);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 3; ctx.stroke();
      // golden star perched on the arch
      ctx.save();
      ctx.translate(cx, this.y - 14);
      ctx.rotate(Math.sin(t * 2) * 0.12);
      ctx.fillStyle = '#ffd24a';
      starPath(ctx, 0, 0, 15, 7);
      ctx.fill();
      ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore();
      // the big friendly "2" badge in the doorway
      const bob = Math.sin(t * 2.4) * 3;
      ctx.fillStyle = '#fff7e8';
      ctx.beginPath(); ctx.arc(cx, this.y + 62 + bob, 26, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(cx, this.y + 62 + bob, 26, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#e8482b';
      ctx.font = 'bold 34px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('2', cx, this.y + 63 + bob);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      drawFace(ctx, cx, g - 16, 18, 'happy', t, this.x);
      // grass tufts at the feet
      ctx.fillStyle = '#5ecb4a';
      for (const gx of [this.x - 6, this.x + this.w - 10]) {
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(gx + 8 + (i - 1) * 7, g - 3, 4, 9 + (i % 2) * 3, (i - 1) * 0.3, 0, TAU);
          ctx.fill();
        }
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

// ================================================================ pipe works
// The Secret Pipe Room machine (Level 0's secret): a cause-and-effect toy.
// Three hoppers hang from an overhead deck, each dropping funny-face blocks of
// its color (fire / ice / rainbow) down a fat visible chute. Three eater
// machines wait on the floor. The chutes start aimed WRONG; three color-ringed
// floor buttons each swing their pipe's mouth to the next machine (CLUNK).
// A correctly-fed machine gulps happily and its bulb latches ON forever
// (progress can never be lost); wrong feeds are pure entertainment — steam
// puffs, melting puddles with eyes, confetti sneezes. All three bulbs lit ->
// KA-CHUNK finale -> candy eruption -> the golden star pops out.
// Lives on the sublevel object as lv.puzzle (exitSub leak rule).
class PipeWorks {
  constructor(groundY) {
    this.g = groundY;
    this.cols = [350, 680, 1010];
    this.kinds = ['fire', 'ice', 'rainbow'];
    this.deckY = 190;              // deck underside; far above any jump apex
    this.aims = [1, 2, 0];         // source i pours into machine aims[i] — starts scrambled
    this.visAim = [1, 2, 0];       // drawn aim (lerps toward aims for the swing)
    this.buttons = this.cols.map((c, i) => ({ x: c - 180, y: groundY - 26, w: 96, h: 30, kind: this.kinds[i], armed: true }));
    this.bulbs = [false, false, false];   // per MACHINE, latched
    this.blocks = [];              // {kind, srcI, destI, t, dur}
    this.dropT = [1.0, 2.4, 3.8];  // staggered so cause->effect is easy to watch
    this.fx = [];                  // {type:'steam'|'melt'|'confetti'|'shiver', x, y, t}
    this.destMood = [null, null, null]; // {mood, t}
    this.state = 'run';            // -> 'finale' -> 'done'
    this.finT = 0;
    this.t = rand(9);
  }
  machineTop() { return this.g - 128; }
  chutePoint(srcI, aimX, k) { // bezier from hopper mouth down to a machine mouth
    const x0 = this.cols[srcI], y0 = this.deckY + 52;
    const x1 = aimX, y1 = this.machineTop() - 6;
    const cx1 = x0, cy1 = y0 + 130, cx2 = x1, cy2 = y1 - 120;
    const u = 1 - k;
    return {
      x: u * u * u * x0 + 3 * u * u * k * cx1 + 3 * u * k * k * cx2 + k * k * k * x1,
      y: u * u * u * y0 + 3 * u * u * k * cy1 + 3 * u * k * k * cy2 + k * k * k * y1
    };
  }
  aimX(i) { // where source i's chute mouth currently points (smooth swing)
    const v = this.visAim[i];
    const lo = clamp(Math.floor(v), 0, 2), hi = clamp(Math.ceil(v), 0, 2);
    return lerp(this.cols[lo], this.cols[hi], v - lo);
  }
  update(dt, pl) {
    this.t += dt;
    // buttons: stepping on one swings that pipe to its next machine (edge-triggered)
    for (let i = 0; i < 3; i++) {
      const b = this.buttons[i];
      const over = overlaps(b, pl);
      if (over && b.armed && this.state === 'run') {
        b.armed = false;
        this.aims[i] = (this.aims[i] + 1) % 3;
        AudioSys.sfx('switch');
        AudioSys.sfx('thud'); // CLUNK
        game.shake = Math.max(game.shake, 0.12);
        Particles.burst(b.x + b.w / 2, b.y, 8, { colors: [POW[b.kind].c, '#fff'], type: 'star', sp1: 180, l1: 0.5, s1: 8 });
      }
      if (!over) b.armed = true;
      // the swing itself
      this.visAim[i] += (this.aims[i] - this.visAim[i]) * Math.min(1, 7 * dt);
    }
    // hoppers drop blocks on a friendly cadence
    if (this.state === 'run') {
      for (let i = 0; i < 3; i++) {
        this.dropT[i] -= dt;
        if (this.dropT[i] <= 0) {
          this.dropT[i] = 4.5;
          this.blocks.push({ kind: this.kinds[i], srcI: i, destI: this.aims[i], t: 0, dur: 1.6 });
          if (this.nearCam()) AudioSys.sfx('boing');
        }
      }
    }
    // blocks ride their chutes
    for (const bl of this.blocks) {
      bl.t += dt;
      if (bl.t >= bl.dur && !bl.done) { bl.done = true; this.arrive(bl); }
    }
    this.blocks = this.blocks.filter(b => !b.done);
    // transient fx + machine moods tick down
    for (const f of this.fx) f.t -= dt;
    this.fx = this.fx.filter(f => f.t > 0);
    for (let i = 0; i < 3; i++) {
      const m = this.destMood[i];
      if (m && (m.t -= dt) <= 0) this.destMood[i] = null;
    }
    // FINALE: the machine comes alive
    if (this.state === 'finale') {
      const prev = this.finT;
      this.finT += dt;
      if (this.finT < 1) game.shake = Math.max(game.shake, 0.18);
      for (const tt of [1.0, 1.35, 1.7]) { // KA-CHUNK ×3
        if (prev < tt && this.finT >= tt) {
          AudioSys.sfx('thud'); AudioSys.sfx('switch');
          game.shake = Math.max(game.shake, 0.3);
          Particles.burst(640, this.deckY + 20, 10, { colors: ['#ffe156', '#fff'], type: 'star', sp1: 260, l1: 0.6, s1: 10 });
        }
      }
      if (prev < 2.4 && this.finT >= 2.4) { // CANDY ERUPTION
        AudioSys.sfx('chest'); AudioSys.sfx('cheer'); AudioSys.sfx('launch');
        game.shake = Math.max(game.shake, 0.5);
        Particles.candyBurst(640, this.deckY - 40, 26);
        Particles.burst(640, this.deckY - 20, 30, { colors: RAINBOW, type: 'confetti', sp1: 420, l0: 1, l1: 2.2, s1: 12, grav: 300, up: 320 });
        for (let i = 0; i < 8; i++) { // real, collectible candy rains down
          const c = new Pickup(640 + rand(-40, 40), this.deckY - 20, 'candy');
          c.physics = true; c.vx = rand(-260, 260); c.vy = rand(-620, -260);
          game.pickups.push(c);
        }
        // the golden star pops out of the machine
        game.level.goalStar = { x: 640, y: 470 };
        Particles.burst(640, 470, 22, { colors: ['#ffd24a', '#ffe156', '#fff'], type: 'star', sp1: 320, l1: 1, s1: 12, grav: 120 });
        this.state = 'done';
      }
    }
  }
  nearCam() { return true; } // single-screen room — everything is always on camera
  arrive(bl) {
    const destKind = this.kinds[bl.destI];
    const x = this.cols[bl.destI], y = this.machineTop() + 40;
    if (bl.kind === destKind) { // GULP — happy machine, bulb latches on
      AudioSys.sfx('blorp'); AudioSys.sfx('collect');
      this.destMood[bl.destI] = { mood: 'grin', t: 1.6 };
      Particles.burst(x, y, 10, { colors: [POW[destKind].c, '#ffe156', '#fff'], type: 'star', sp1: 220, l1: 0.7, s1: 10 });
      if (!this.bulbs[bl.destI]) {
        this.bulbs[bl.destI] = true;
        AudioSys.sfx('powerup');
        Particles.burst(x, this.machineTop() - 36, 14, { colors: ['#ffe156', '#fff'], type: 'sparkle', sp1: 240, l1: 0.9, s1: 10 });
        if (this.bulbs.every(b => b) && this.state === 'run') {
          this.state = 'finale'; this.finT = 0;
          AudioSys.sfx('fanfare');
        }
      }
      return;
    }
    // wrong feeds are comedy, never punishment
    this.destMood[bl.destI] = { mood: bl.kind === 'rainbow' ? 'dizzy' : 'surprised', t: 1.8 };
    if (bl.kind === 'fire' && destKind === 'ice') { // steam cough
      this.fx.push({ type: 'steam', x, y: y - 30, t: 1.6 });
      AudioSys.sfx('steam');
    } else if (bl.kind === 'ice' && destKind === 'fire') { // melts into a puddle with eyes
      this.fx.push({ type: 'melt', x, y: this.g - 8, t: 2.6 });
      AudioSys.sfx('steam'); AudioSys.sfx('blorp');
    } else if (bl.kind === 'rainbow') { // harmless rainbow explosion
      this.fx.push({ type: 'confetti', x, y: y - 20, t: 1 });
      Particles.burst(x, y - 20, 22, { colors: RAINBOW, type: 'confetti', sp1: 320, l0: 0.8, l1: 1.8, s1: 11, grav: 300, up: 220 });
      AudioSys.sfx('rainbow');
    } else { // ice into the rainbow box: brrrr
      this.fx.push({ type: 'shiver', x, y, t: 1.2 });
      AudioSys.sfx('freeze');
    }
  }
  lights() { return []; }
  draw(ctx, t) {
    const g = this.g, top = this.machineTop();
    // ceiling deck the hoppers hang from
    ctx.fillStyle = '#3d3255';
    rr(ctx, 180, this.deckY - 54, 920, 60, 14); ctx.fill();
    ctx.strokeStyle = '#2a2140'; ctx.lineWidth = 4;
    rr(ctx, 180, this.deckY - 54, 920, 60, 14); ctx.stroke();
    // rivets
    ctx.fillStyle = '#8a7fae';
    for (let x = 210; x < 1080; x += 62) { ctx.beginPath(); ctx.arc(x, this.deckY - 24, 4, 0, TAU); ctx.fill(); }
    // the machine's big friendly boiler face, center deck
    drawFace(ctx, 640, this.deckY - 24, 34, this.state !== 'run' ? 'grin' : 'happy', t, 71);
    // chutes (drawn behind machines/hoppers)
    for (let i = 0; i < 3; i++) {
      const ax = this.aimX(i), p = POW[this.kinds[i]];
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = p.c2; ctx.globalAlpha = 0.9; ctx.lineWidth = 30;
      ctx.beginPath();
      for (let k = 0; k <= 1.001; k += 1 / 14) {
        const pt = this.chutePoint(i, ax, Math.min(1, k));
        if (k === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
      ctx.strokeStyle = p.c; ctx.lineWidth = 20;
      ctx.stroke();
      // a bright travel stripe so the flow direction reads at a glance
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 5;
      ctx.setLineDash([14, 22]); ctx.lineDashOffset = -t * 60;
      ctx.stroke();
      ctx.restore();
    }
    // blocks riding the chutes
    for (const bl of this.blocks) {
      const k = clamp(bl.t / bl.dur, 0, 1);
      const pt = this.chutePoint(bl.srcI, this.cols[bl.destI], k);
      drawBlock(ctx, pt.x - 19, pt.y - 19, 38, bl.kind, t, { seed: bl.srcI * 7 });
    }
    // hoppers
    for (let i = 0; i < 3; i++) {
      const x = this.cols[i], p = POW[this.kinds[i]];
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.moveTo(x - 52, this.deckY - 6); ctx.lineTo(x + 52, this.deckY - 6);
      ctx.lineTo(x + 24, this.deckY + 52); ctx.lineTo(x - 24, this.deckY + 52);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = p.c2; ctx.lineWidth = 4; ctx.stroke();
      drawBlock(ctx, x - 17, this.deckY + 2, 34, this.kinds[i], t, { seed: i });
    }
    // eater machines
    for (let i = 0; i < 3; i++) {
      const x = this.cols[i], kind = this.kinds[i], p = POW[kind];
      const shiver = this.fx.some(f => f.type === 'shiver' && f.x === x) ? Math.sin(t * 40) * 3 : 0;
      ctx.save();
      ctx.translate(shiver, 0);
      ctx.fillStyle = p.c;
      rr(ctx, x - 75, top, 150, g - top, 16); ctx.fill();
      ctx.strokeStyle = p.c2; ctx.lineWidth = 5;
      rr(ctx, x - 75, top, 150, g - top, 16); ctx.stroke();
      // kind decoration: chimney flame / ice cubes / rainbow arc
      if (kind === 'fire') {
        ctx.fillStyle = p.c2; rr(ctx, x + 38, top - 26, 22, 30, 5); ctx.fill();
        const fh = 12 + Math.sin(t * 9) * 4;
        ctx.fillStyle = '#ffce54';
        ctx.beginPath(); ctx.ellipse(x + 49, top - 30, 8, fh, 0, 0, TAU); ctx.fill();
      } else if (kind === 'ice') {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (const ox of [-40, -10, 22]) { rr(ctx, x + ox, top - 16, 20, 16, 4); ctx.fill(); }
      } else {
        ctx.lineWidth = 5;
        RAINBOW.slice(0, 4).forEach((c, ri) => {
          ctx.strokeStyle = c;
          ctx.beginPath(); ctx.arc(x, top + 2, 40 - ri * 7, Math.PI, TAU); ctx.stroke();
        });
      }
      // the mouth: opens wide when a block is incoming
      let openK = 0;
      for (const bl of this.blocks) if (bl.destI === i) openK = Math.max(openK, clamp((bl.t / bl.dur - 0.55) / 0.45, 0, 1));
      ctx.fillStyle = '#3a2a3a';
      ctx.beginPath(); ctx.ellipse(x, top + 34, 30, 8 + openK * 20, 0, 0, TAU); ctx.fill();
      const mood = this.destMood[i] ? this.destMood[i].mood : (this.bulbs[i] ? 'happy' : 'sleepy');
      drawFace(ctx, x, top + 72, 40, mood, t, 30 + i);
      // ghost silhouette of the wanted block on the machine's tummy
      ctx.save();
      ctx.globalAlpha = this.bulbs[i] ? 0.9 : 0.35 + 0.12 * Math.sin(t * 3 + i);
      drawBlock(ctx, x - 46, g - 52, 30, kind, t, { seed: i + 5 });
      ctx.restore();
      // the progress bulb on top
      ctx.fillStyle = this.bulbs[i] ? '#ffe156' : '#4a4560';
      ctx.beginPath(); ctx.arc(x - 52, top - 14, 11, 0, TAU); ctx.fill();
      ctx.strokeStyle = this.bulbs[i] ? '#c8861b' : '#2a2140'; ctx.lineWidth = 3; ctx.stroke();
      if (this.bulbs[i]) {
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 5 + i);
        ctx.fillStyle = '#ffe156';
        ctx.beginPath(); ctx.arc(x - 52, top - 14, 22, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
    // floor buttons (color says WHICH pipe they turn; arrow says "it rotates")
    for (const b of this.buttons) {
      const p = POW[b.kind];
      const down = !b.armed ? 6 : 0;
      ctx.fillStyle = '#8a8a9a';
      rr(ctx, b.x - 8, g - 12, b.w + 16, 12, 5); ctx.fill();
      ctx.fillStyle = p.c;
      rr(ctx, b.x, b.y + down, b.w, b.h - down, 9); ctx.fill();
      ctx.strokeStyle = p.c2; ctx.lineWidth = 3.5;
      rr(ctx, b.x, b.y + down, b.w, b.h - down, 9); ctx.stroke();
      // circular "turn" arrow
      const mx = b.x + b.w / 2, my = b.y + down + (b.h - down) / 2;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(mx, my, 10, -0.6, Math.PI + 0.9); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(mx + 13, my - 8); ctx.lineTo(mx + 3, my - 9); ctx.lineTo(mx + 10, my + 2);
      ctx.closePath(); ctx.fill();
    }
    // transient comedy fx
    for (const f of this.fx) {
      if (f.type === 'steam') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, f.t);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (const [ox, oy, r2] of [[0, 0, 34], [-30, 14, 22], [30, 12, 24], [8, -26, 20]]) {
          ctx.beginPath(); ctx.arc(f.x + ox, f.y + oy - (1.6 - f.t) * 40, r2, 0, TAU); ctx.fill();
        }
        drawFace(ctx, f.x, f.y - (1.6 - f.t) * 40, 30, 'dizzy', t, 44);
        ctx.restore();
      } else if (f.type === 'melt') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, f.t * 1.2);
        ctx.fillStyle = '#7fd8ff';
        ctx.beginPath(); ctx.ellipse(f.x, f.y, 40 + (2.6 - f.t) * 10, 10, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#3fa9e8'; ctx.lineWidth = 3; ctx.stroke();
        drawFace(ctx, f.x, f.y - 4, 20, 'sad', t, 45);
        ctx.restore();
      }
      // confetti + shiver render via particles / machine wobble
    }
  }
}

// ================================================================ torch cavern
// The Zombie Torch Puzzle (Level 4's secret): darkness, light, observation and
// matching — never sequence memory. A big stone door shows three dim symbol
// slots (star / heart / candy). Five torches wait in the dark (their embers
// glow faintly so they're findable): three carry matching carved symbols and
// send a glowing wisp to the door when lit; two are pure comedy (a goofy stone
// bat wakes up; a giant Zzz drifts from behind the door). Touch a torch OR hit
// it with a fireball to light it; an ice shot re-douses it with a steam puff
// (harmless — filled door slots stay filled forever). All three symbols home
// -> the door grinds open, the whole cavern lights up, and the "scary" secret
// turns out to be four baby zombies having a slumber party.
class TorchCavern {
  constructor(groundY) {
    this.g = groundY;
    this.doorX = 1640;
    this.doorSolid = { x: this.doorX, y: groundY - 250, w: 64, h: 250, skipDraw: true };
    this.syms = ['star', 'heart', 'candy'];
    this.filled = { star: false, heart: false, candy: false };
    this.torches = [
      { x: 420,  baseY: groundY, sym: 'heart', lit: false, litT: 0, armed: true },
      { x: 760,  baseY: groundY, gag: 'bat',   lit: false, litT: 0, armed: true },
      { x: 1060, baseY: 490,     sym: 'star',  lit: false, litT: 0, armed: true },
      { x: 1350, baseY: 355,     sym: 'candy', lit: false, litT: 0, armed: true },
      { x: 1520, baseY: groundY, gag: 'snore', lit: false, litT: 0, armed: true }
    ];
    this.wisps = [];        // {sym, x0, y0, t}
    this.bat = { awake: false, t: rand(9), x: 780, y: 210 };
    this.zzzT = 0;          // big Zzz gag from behind the door
    this.snoreT = rand(2, 4);
    this.state = 'explore'; // -> 'opening' -> 'done'
    this.openT = 0;
    this.reveal = false;    // true = the whole cavern is lit
    this.chest = new Chest(1830, groundY);
    this.chest.y = this.chest.targetY;
    this.chest.landed = true;
    this.babies = [
      { x: 1740, mood: 'sleepy', seed: 1, cap: true },
      { x: 1800, mood: 'sleepy', seed: 2, cap: false },
      { x: 1875, mood: 'sleepy', seed: 3, cap: true },
      { x: 1770, mood: 'sleepy', seed: 4, cap: false, back: true }
    ];
    this.t = rand(9);
  }
  torchBox(to) { return { x: to.x - 34, y: to.baseY - 116, w: 68, h: 116 }; }
  slotPos(i) { return { x: this.doorX + 32, y: this.g - 250 + 44 + i * 62 }; }
  lightTorch(to) {
    if (to.lit) return;
    to.lit = true; to.litT = 0;
    AudioSys.sfx('fire');
    Particles.burst(to.x, to.baseY - 100, 12, { colors: ['#ff9f43', '#ffe156'], type: 'flame', sp1: 160, grav: -120, l1: 0.6, s1: 11 });
    if (to.sym && !this.filled[to.sym]) {
      this.wisps.push({ sym: to.sym, x0: to.x, y0: to.baseY - 150, t: -0.4 }); // brief pause, then fly
    }
    if (to.gag === 'bat' && !this.bat.awake) {
      this.bat.awake = true;
      AudioSys.sfx('whoosh'); AudioSys.sfx('hiccup');
    }
    if (to.gag === 'snore') {
      this.zzzT = 2.4;
      AudioSys.sfx('snore'); AudioSys.sfx('hiccup');
    }
  }
  douseTorch(to) {
    if (!to.lit) return;
    to.lit = false;
    AudioSys.sfx('steam');
    Particles.burst(to.x, to.baseY - 100, 10, { colors: ['#fff', '#d6f4ff'], type: 'circle', sp1: 90, grav: -140, l1: 0.7, s1: 10 });
    // note: an already-filled door slot STAYS filled — dousing is pure comedy
  }
  update(dt, pl) {
    this.t += dt;
    this.zzzT = Math.max(0, this.zzzT - dt);
    this.chest.update(dt);
    for (const to of this.torches) {
      to.litT += dt;
      const box = this.torchBox(to);
      const over = overlaps(box, pl);
      if (over && to.armed && !to.lit) { to.armed = false; this.lightTorch(to); }
      if (!over) to.armed = true;
      // fired projectiles: fire lights, ice douses
      for (const pr of game.projectiles) {
        if (pr.dead || pr.hitSet.has(to)) continue;
        if (!overlaps(pr, box)) continue;
        pr.hitSet.add(to);
        if (pr.kind === 'fire' && !to.lit) { this.lightTorch(to); pr.impact(true); }
        else if (pr.kind === 'ice' && to.lit) { this.douseTorch(to); pr.impact(true); }
      }
      if (to.lit && chance(4 * dt)) {
        Particles.burst(to.x + rand(-8, 8), to.baseY - 108, 1, { colors: ['#ff9f43', '#ffe156'], type: 'flame', sp1: 40, grav: -140, l1: 0.5, s1: 9, up: 0 });
      }
    }
    // wisps fly their symbol home to the door
    for (const wsp of this.wisps) {
      wsp.t += dt;
      if (wsp.t >= 1.1 && !wsp.done) {
        wsp.done = true;
        this.filled[wsp.sym] = true;
        AudioSys.sfx('collect');
        const i = this.syms.indexOf(wsp.sym);
        const sp = this.slotPos(i);
        Particles.burst(sp.x, sp.y, 12, { colors: ['#ffe156', '#fff'], type: 'star', sp1: 200, l1: 0.7, s1: 9, grav: 150 });
        if (this.syms.every(s2 => this.filled[s2]) && this.state === 'explore') {
          this.state = 'opening'; this.openT = 0;
          AudioSys.sfx('rumble');
          game.shake = Math.max(game.shake, 0.35);
        }
      }
    }
    this.wisps = this.wisps.filter(w => !w.done);
    // the sleepy bat loops the ceiling once woken
    if (this.bat.awake) {
      this.bat.t += dt;
      this.bat.x = 780 + Math.sin(this.bat.t * 0.9) * 420;
      this.bat.y = 190 + Math.sin(this.bat.t * 2.3) * 70;
    }
    // muffled snores leak through the closed door — the audio clue
    if (this.state === 'explore') {
      this.snoreT -= dt;
      if (this.snoreT <= 0) {
        this.snoreT = rand(3, 5);
        if (Math.abs(pl.cx - this.doorX) < 620) AudioSys.sfx('snore');
      }
    }
    // THE REVEAL
    if (this.state === 'opening') {
      const prev = this.openT;
      this.openT += dt;
      if (this.openT < 1) game.shake = Math.max(game.shake, 0.2);
      if (prev < 1.0 && this.openT >= 1.0) { // the slab grinds up into the rock
        this.doorSolid.broken = true;
        AudioSys.sfx('grind'); AudioSys.sfx('fanfare');
      }
      if (prev < 1.5 && this.openT >= 1.5) { // LIGHTS ON — and it's... babies?!
        this.reveal = true;
        AudioSys.sfx('bells');
        for (const b of this.babies) b.mood = 'surprised';
        Particles.burst(1800, this.g - 120, 20, { colors: ['#ffe156', '#fff'], type: 'sparkle', sp1: 260, l1: 1, s1: 10 });
      }
      if (prev < 2.6 && this.openT >= 2.6) { // ...who immediately start dancing
        for (const b of this.babies) b.mood = 'grin';
        AudioSys.sfx('cheer');
        Particles.burst(1800, this.g - 140, 24, { colors: RAINBOW, type: 'confetti', sp1: 320, l0: 1, l1: 2, s1: 11, grav: 260, up: 220 });
      }
      if (prev < 3.2 && this.openT >= 3.2) { // treasure + the golden star
        this.chest.open = true;
        AudioSys.sfx('chest');
        Particles.candyBurst(this.chest.cx, this.chest.y - 20, 14);
        game.level.goalStar = { x: 1790, y: 500 };
        Particles.burst(1790, 500, 20, { colors: ['#ffd24a', '#ffe156', '#fff'], type: 'star', sp1: 300, l1: 1, s1: 12, grav: 120 });
        this.state = 'done';
      }
    }
  }
  lights() {
    if (this.reveal) return [{ x: 960, y: 360, r: 2800 }]; // the whole cavern, lit
    const L = [];
    for (const to of this.torches) {
      L.push(to.lit ? { x: to.x, y: to.baseY - 100, r: 300, a: 0.95 } : { x: to.x, y: to.baseY - 100, r: 80, a: 0.6 });
    }
    for (const wsp of this.wisps) {
      const p = this.wispPos(wsp);
      L.push({ x: p.x, y: p.y, r: 120, a: 0.9 });
    }
    L.push({ x: this.doorX + 32, y: this.g - 130, r: 190, a: 0.8 }); // the door glow
    return L;
  }
  wispPos(wsp) {
    const k = clamp(wsp.t / 1.1, 0, 1);
    const e = k * k * (3 - 2 * k);
    const i = this.syms.indexOf(wsp.sym);
    const sp = this.slotPos(i);
    return { x: lerp(wsp.x0, sp.x, e), y: lerp(wsp.y0, sp.y, e) - Math.sin(k * Math.PI) * 90 };
  }
  drawSym(ctx, x, y, s, sym, gold) {
    ctx.save();
    if (sym === 'star') {
      ctx.fillStyle = gold ? '#ffd24a' : 'rgba(255,255,255,0.28)';
      starPath(ctx, x, y, s, s * 0.45);
      ctx.fill();
      if (gold) { ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 2.5; ctx.stroke(); }
    } else if (sym === 'heart') {
      heartPath(ctx, x, y - s * 0.3, s);
      ctx.fillStyle = gold ? '#ff7d92' : 'rgba(255,255,255,0.28)';
      ctx.fill();
      if (gold) { ctx.strokeStyle = '#8e1030'; ctx.lineWidth = 2.5; ctx.stroke(); }
    } else { // candy
      if (gold) drawCandy(ctx, x, y, s * 0.9, 1, this.t);
      else {
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath(); ctx.ellipse(x, y, s * 0.55, s * 0.4, 0, 0, TAU); ctx.fill();
        for (const sd of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(x + sd * s * 0.45, y);
          ctx.lineTo(x + sd * s * 0.8, y - s * 0.32); ctx.lineTo(x + sd * s * 0.8, y + s * 0.32);
          ctx.closePath(); ctx.fill();
        }
      }
    }
    ctx.restore();
  }
  drawBaby(ctx, b, t) {
    const g = this.g;
    const dance = b.mood === 'grin';
    const bob = dance ? Math.abs(Math.sin(t * 6 + b.seed * 2)) * 14 : 0;
    const x = b.x, y = g - 44 - bob;
    ctx.save();
    if (dance) {
      ctx.translate(x, g);
      ctx.rotate(Math.sin(t * 6 + b.seed) * 0.12);
      ctx.translate(-x, -g);
    }
    // little green body in jammies
    ctx.fillStyle = b.cap ? '#b06cf0' : '#4aa3ff';
    rr(ctx, x - 15, y + 16, 30, 26, 9); ctx.fill();
    ctx.strokeStyle = 'rgba(40,25,50,0.4)'; ctx.lineWidth = 2.5;
    rr(ctx, x - 15, y + 16, 30, 26, 9); ctx.stroke();
    // arms: up and wiggling when dancing, tucked when asleep
    ctx.strokeStyle = '#8fd08f'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    const wig = dance ? Math.sin(t * 10 + b.seed * 3) * 6 : 0;
    ctx.beginPath();
    if (dance) {
      ctx.moveTo(x - 12, y + 22); ctx.lineTo(x - 22, y + 8 - wig);
      ctx.moveTo(x + 12, y + 22); ctx.lineTo(x + 22, y + 8 + wig);
    } else {
      ctx.moveTo(x - 12, y + 26); ctx.lineTo(x - 20, y + 34);
      ctx.moveTo(x + 12, y + 26); ctx.lineTo(x + 20, y + 34);
    }
    ctx.stroke();
    // round green head with a hair tuft
    ctx.fillStyle = '#8fd08f';
    ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(40,25,50,0.4)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#57b84a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y - 17); ctx.quadraticCurveTo(x + 5, y - 26, x + 10, y - 22); ctx.stroke();
    // nightcap on some
    if (b.cap) {
      ctx.fillStyle = '#ff8fb0';
      ctx.beginPath();
      ctx.moveTo(x - 14, y - 10); ctx.lineTo(x + 2, y - 30); ctx.lineTo(x + 15, y - 12);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x + 3, y - 30, 4.5, 0, TAU); ctx.fill();
    }
    drawFace(ctx, x, y + 3, 26, b.mood, t, b.seed * 9);
    ctx.restore();
    // sleepy Zzz
    if (b.mood === 'sleepy' && chance(0.012)) {
      Particles.burst(x + 12, y - 20, 1, { colors: ['#cfe9ff'], type: 'sparkle', sp1: 15, grav: -55, l0: 1.4, l1: 2.2, s1: 8, up: 0 });
    }
  }
  draw(ctx, t) {
    const g = this.g;
    // stone plaques with the carved symbols above the symbol torches
    for (const to of this.torches) {
      if (!to.sym) continue;
      const py = to.baseY - 168;
      ctx.fillStyle = '#3d3255';
      rr(ctx, to.x - 30, py - 28, 60, 56, 10); ctx.fill();
      ctx.strokeStyle = '#2a2140'; ctx.lineWidth = 3;
      rr(ctx, to.x - 30, py - 28, 60, 56, 10); ctx.stroke();
      this.drawSym(ctx, to.x, py, 16, to.sym, to.lit || this.filled[to.sym]);
    }
    // torches
    for (const to of this.torches) {
      const ty = to.baseY;
      ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(to.x, ty); ctx.lineTo(to.x, ty - 78); ctx.stroke();
      ctx.fillStyle = '#5f4a35';
      ctx.beginPath(); ctx.ellipse(to.x, ty - 82, 22, 12, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#3d2f22'; ctx.lineWidth = 3; ctx.stroke();
      if (to.lit) {
        const fl = 1 + Math.sin(t * 12 + to.x) * 0.18;
        ctx.fillStyle = '#ff9f43';
        ctx.beginPath(); ctx.ellipse(to.x, ty - 108, 15 * fl, 26 * fl, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffe156';
        ctx.beginPath(); ctx.ellipse(to.x, ty - 102, 8 * fl, 15 * fl, 0, 0, TAU); ctx.fill();
      } else {
        // the faint ember — the "something is here" beacon in the dark
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 2.4 + to.x);
        ctx.fillStyle = '#ff9f43';
        ctx.beginPath(); ctx.arc(to.x, ty - 88, 4.5, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    // the sealed stone door (or its open frame)
    const dX = this.doorX;
    ctx.fillStyle = '#3d3255';
    rr(ctx, dX - 18, g - 268, 100, 268, 16); ctx.fill();
    ctx.strokeStyle = '#2a2140'; ctx.lineWidth = 5;
    rr(ctx, dX - 18, g - 268, 100, 268, 16); ctx.stroke();
    const rise = this.state === 'explore' ? 0 : Math.min(1, this.openT) * 230;
    if (rise < 228) {
      ctx.save();
      rr(ctx, dX - 6, g - 250, 76, 250, 10); ctx.clip();
      const sy = g - 250 - rise;
      ctx.fillStyle = '#75778a';
      rr(ctx, dX - 6, sy, 76, 250, 10); ctx.fill();
      ctx.strokeStyle = '#4a4c5c'; ctx.lineWidth = 3;
      rr(ctx, dX - 6, sy, 76, 250, 10); ctx.stroke();
      // the door's goofy stone face at the bottom
      drawFace(ctx, dX + 32, sy + 214, 34, this.state === 'explore' ? 'sleepy' : 'grin', t, 66);
      // three symbol slots down the slab
      for (let i = 0; i < 3; i++) {
        const sp = { x: dX + 32, y: sy + 44 + i * 62 };
        ctx.fillStyle = this.filled[this.syms[i]] ? '#4a4560' : '#2a2140';
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 24, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#8a7fae'; ctx.lineWidth = 2.5; ctx.stroke();
        if (this.filled[this.syms[i]]) {
          ctx.save();
          ctx.globalAlpha = 0.45 + 0.25 * Math.sin(t * 4 + i);
          ctx.fillStyle = '#ffe156';
          ctx.beginPath(); ctx.arc(sp.x, sp.y, 32, 0, TAU); ctx.fill();
          ctx.restore();
        }
        this.drawSym(ctx, sp.x, sp.y, 13, this.syms[i], this.filled[this.syms[i]]);
      }
      ctx.restore();
    }
    // wisps in flight
    for (const wsp of this.wisps) {
      if (wsp.t < 0) continue;
      const p = this.wispPos(wsp);
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, TAU); ctx.fill();
      ctx.restore();
      this.drawSym(ctx, p.x, p.y, 14, wsp.sym, true);
      if (chance(0.5)) Particles.burst(p.x, p.y, 1, { colors: ['#ffe156', '#fff'], type: 'sparkle', sp1: 30, grav: 30, l1: 0.5, s1: 7, up: 0 });
    }
    // the goofy stone bat (hangs asleep near its torch, loops when woken)
    const bat = this.bat;
    ctx.save();
    if (!bat.awake) {
      ctx.translate(780, 96);
      ctx.rotate(Math.PI); // snoozing upside down under the ceiling
    } else {
      ctx.translate(bat.x, bat.y);
      ctx.rotate(Math.sin(bat.t * 4) * 0.15);
    }
    const flap = bat.awake ? Math.sin(bat.t * 14) * 0.8 : 0.15;
    ctx.fillStyle = '#8d8fa0';
    for (const sd of [-1, 1]) { // stubby stone wings
      ctx.save();
      ctx.rotate(sd * flap * 0.5);
      ctx.beginPath(); ctx.ellipse(sd * 24, 0, 18, 9, sd * 0.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#5f6070'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.stroke();
    for (const sd of [-1, 1]) { // pointy ears
      ctx.beginPath();
      ctx.moveTo(sd * 6, -13); ctx.lineTo(sd * 12, -24); ctx.lineTo(sd * 14, -12);
      ctx.closePath(); ctx.fill();
    }
    drawFace(ctx, 0, 2, 22, bat.awake ? 'grin' : 'sleepy', t, 88);
    ctx.restore();
    // the big Zzz gag drifting up from behind the door
    if (this.zzzT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.zzzT);
      outlineText(ctx, 'Z z z', 1800, g - 300 - (2.4 - this.zzzT) * 40, 40, '#cfe9ff', '#3d3766');
      ctx.restore();
    }
    // the slumber party behind the door
    ctx.fillStyle = '#b06cf0'; // pillows
    for (const px of [1725, 1855]) {
      ctx.beginPath(); ctx.ellipse(px, g - 8, 30, 11, 0, 0, TAU); ctx.fill();
    }
    this.chest.draw(ctx);
    for (const b of this.babies) this.drawBaby(ctx, b, t);
  }
}

// ================================================================ star chamber
// The Zero-G Star Chamber (Level 8's secret): a spatial transport puzzle in
// weightless space. Five colored stars float around a big chamber; the center
// holds an unfinished constellation with five color-matched sockets (the ghost
// of each star pulses in its ring). Touch a star and it TAILS you — carry it
// home and it snaps into its socket with a chime. One star teaches the loop,
// one hides in an asteroid pocket, one sits past a solar-wind current, one
// waits behind an energy gate (big yellow button pops it), and a silly alien
// holds the last one — a fired rainbow makes it so happy it hands the star
// over. All five home -> the constellation connects, resolves into Jack-Jack
// or Becca made of stars, and erupts in candy. Stars can never be lost:
// carried stars snap-teleport to you if they fall behind, and everything
// lives on the sublevel object.
class StarChamber {
  constructor(cx, cy, gateSolid) {
    this.cx = cx; this.cy = cy;
    this.gate = gateSolid;
    this.nodes = [ // hero-figure sockets: head, hands, feet
      { ox: 0, oy: -190 }, { ox: -210, oy: -40 }, { ox: 210, oy: -40 },
      { ox: -120, oy: 170 }, { ox: 120, oy: 170 }
    ];
    this.edges = [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4]];
    this.colors = ['#ff4d4d', '#ff9f43', '#57d357', '#4aa3ff', '#b06cf0'];
    this.stars = [
      { i: 0, x: 600, y: 780, state: 'free' },    // teach: grab -> bring home
      { i: 1, x: 2210, y: 355, state: 'free' },   // asteroid pocket
      { i: 2, x: 500, y: 1290, state: 'free' },   // past the solar wind
      { i: 3, x: 300, y: 320, state: 'free' },    // behind the energy gate
      { i: 4, x: 2250, y: 1210, state: 'held' }   // the silly alien's treasure
    ];
    for (const st of this.stars) { st.t = rand(9); st.setK = 0; }
    this.carried = [];
    this.button = { x: 580, y: 600, w: 76, h: 76, armed: true, on: false };
    this.alien = { x: 2250, y: 1310, happy: false, t: rand(9), giggleT: 0, armed: true };
    this.placed = 0;
    this.state = 'build'; // -> 'finale' -> 'done'
    this.finT = 0;
    this.t = rand(9);
  }
  socketPos(i) { return { x: this.cx + this.nodes[i].ox, y: this.cy + this.nodes[i].oy }; }
  starBox(st) { return { x: st.x - 48, y: st.y - 48, w: 96, h: 96 }; } // generous grab
  update(dt, pl) {
    this.t += dt;
    // the energy-gate button: one big obvious press
    const b = this.button;
    if (!b.on && overlaps(b, pl) && b.armed) {
      b.on = true;
      this.gate.broken = true;
      AudioSys.sfx('switch'); AudioSys.sfx('shatter');
      game.shake = Math.max(game.shake, 0.2);
      Particles.burst(this.gate.x + this.gate.w / 2, this.gate.y + this.gate.h / 2, 22, { colors: ['#7fd8ff', '#fff'], type: 'sparkle', sp1: 300, grav: 0, l1: 1, s1: 10, up: 0 });
      Particles.burst(b.x + b.w / 2, b.y + b.h / 2, 10, { colors: ['#ffe156', '#fff'], type: 'star', sp1: 200, l1: 0.6, s1: 9 });
    }
    // the silly alien: bumping = giggles and keeps it; a rainbow = pure joy
    const al = this.alien;
    al.t += dt;
    al.giggleT = Math.max(0, al.giggleT - dt);
    const alBox = { x: al.x - 46, y: al.y - 60, w: 92, h: 110 };
    if (!al.happy) {
      const over = overlaps(alBox, pl);
      if (over && al.armed) {
        al.armed = false; al.giggleT = 0.9;
        AudioSys.sfx('hiccup');
      }
      if (!over) al.armed = true;
      for (const pr of game.projectiles) {
        if (pr.dead || pr.kind !== 'rainbow' || pr.hitSet.has(al)) continue;
        if (!overlaps(pr, alBox)) continue;
        pr.hitSet.add(al);
        al.happy = true;
        AudioSys.sfx('friend'); AudioSys.sfx('cheer');
        Particles.burst(al.x, al.y - 20, 16, { colors: ['#ff8fb0', '#fff'], type: 'heart', sp1: 220, grav: -40, l1: 1, s1: 11 });
        const st = this.stars[4]; // the gift
        st.state = 'free'; st.x = al.x; st.y = al.y - 120;
        Particles.burst(st.x, st.y, 14, { colors: [this.colors[4], '#fff'], type: 'star', sp1: 240, grav: 0, l1: 0.8, s1: 10, up: 0 });
      }
    }
    // stars: grab, carry, deliver
    for (const st of this.stars) {
      st.t += dt;
      if (st.state === 'free') {
        st.y += Math.sin(st.t * 1.8) * 6 * dt; // gentle drift
        if (chance(1.4 * dt)) Particles.burst(st.x + rand(-24, 24), st.y + rand(-24, 24), 1, { colors: [this.colors[st.i], '#fff'], type: 'sparkle', sp1: 22, grav: 0, l1: 0.8, s1: 8, up: 0 });
        if (overlaps(this.starBox(st), pl)) {
          st.state = 'carry';
          this.carried.push(st);
          AudioSys.sfx('powerup');
          pl.setMood('grin', 1.2);
          Particles.burst(st.x, st.y, 14, { colors: [this.colors[st.i], '#ffe156', '#fff'], type: 'star', sp1: 260, grav: 0, l1: 0.8, s1: 11, up: 0 });
        }
      } else if (st.state === 'carry') {
        // tail the hero (or the star ahead of you — a little star train)
        const idx = this.carried.indexOf(st);
        const lead = idx <= 0 ? { x: pl.cx - pl.facing * 58, y: pl.cy - 14 } : { x: this.carried[idx - 1].x - pl.facing * 44, y: this.carried[idx - 1].y + 8 };
        if (Math.hypot(lead.x - st.x, lead.y - st.y) > 700) { st.x = lead.x; st.y = lead.y; } // never lost
        const k = Math.min(1, dt * 6);
        st.x += (lead.x - st.x) * k;
        st.y += (lead.y - st.y) * k + Math.sin(st.t * 3) * 10 * dt;
        if (chance(0.2)) Particles.burst(st.x, st.y + 8, 1, { colors: [this.colors[st.i]], type: 'sparkle', sp1: 16, grav: 0, l1: 0.6, s1: 7, up: 0 });
        // home! (generous snap radius, color-matched socket)
        const sp = this.socketPos(st.i);
        if (Math.hypot(sp.x - st.x, sp.y - st.y) < 120) {
          st.state = 'set'; st.setFrom = { x: st.x, y: st.y }; st.setK = 0;
          this.carried.splice(this.carried.indexOf(st), 1);
          AudioSys.sfx('collect'); AudioSys.sfx('candy');
          pl.setMood('grin', 1);
        }
      } else if (st.state === 'set') {
        if (st.setK < 1) {
          st.setK = Math.min(1, st.setK + dt * 3);
          const sp = this.socketPos(st.i), e = st.setK * st.setK * (3 - 2 * st.setK);
          st.x = lerp(st.setFrom.x, sp.x, e); st.y = lerp(st.setFrom.y, sp.y, e);
          if (st.setK >= 1) {
            this.placed++;
            game.shake = Math.max(game.shake, 0.12);
            Particles.burst(sp.x, sp.y, 16, { colors: [this.colors[st.i], '#ffe156', '#fff'], type: 'star', sp1: 260, grav: 0, l1: 0.9, s1: 11, up: 0 });
            if (this.placed === 5 && this.state === 'build') {
              this.state = 'finale'; this.finT = 0;
              AudioSys.sfx('fanfare');
            }
          }
        }
      }
    }
    // FINALE: the constellation comes alive
    if (this.state === 'finale') {
      const prev = this.finT;
      this.finT += dt;
      for (let e = 0; e < this.edges.length; e++) { // lines connect one by one
        const tt = 0.5 + e * 0.4;
        if (prev < tt && this.finT >= tt) {
          AudioSys.sfx('candy');
          const [a, bb] = this.edges[e];
          const pa = this.socketPos(a), pb = this.socketPos(bb);
          Particles.burst((pa.x + pb.x) / 2, (pa.y + pb.y) / 2, 8, { colors: ['#ffe156', '#fff'], type: 'sparkle', sp1: 120, grav: 0, l1: 0.7, s1: 8, up: 0 });
        }
      }
      if (prev < 2.9 && this.finT >= 2.9) { // ...and becomes YOU
        AudioSys.sfx('bells');
        game.shake = Math.max(game.shake, 0.25);
        Particles.burst(this.cx, this.cy - 190, 24, { colors: ['#ffe156', '#fff'], type: 'sparkle', sp1: 320, grav: 0, l1: 1.2, s1: 11, up: 0 });
      }
      if (prev < 4.0 && this.finT >= 4.0) { // candy fireworks + the golden star
        AudioSys.sfx('chest'); AudioSys.sfx('cheer');
        Particles.candyBurst(this.cx, this.cy - 60, 22);
        Particles.burst(this.cx, this.cy, 30, { colors: RAINBOW.concat(['#ffe156', '#fff']), type: 'star', sp1: 420, grav: 0, l0: 0.8, l1: 1.8, s1: 12, up: 0 });
        game.level.goalStar = { x: this.cx, y: this.cy + 240 };
        this.state = 'done';
      }
    }
  }
  drawStarShape(ctx, x, y, r, color, t, face) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 1.4) * 0.18);
    ctx.fillStyle = color;
    starPath(ctx, 0, 0, r, r * 0.46);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,25,50,0.5)'; ctx.lineWidth = 3; ctx.stroke();
    if (face) drawFace(ctx, 0, 2, r * 0.85, 'happy', t, x);
    ctx.restore();
  }
  draw(ctx, t) {
    const cx = this.cx, cy = this.cy;
    const litK = this.state === 'build' ? 0 : Math.min(1, this.finT / 2.5);
    // the constellation frame: a faint dashed ring plus the machine base
    ctx.save();
    ctx.strokeStyle = 'rgba(127,216,255,0.35)'; ctx.lineWidth = 5;
    ctx.setLineDash([16, 20]); ctx.lineDashOffset = -t * 30;
    ctx.beginPath(); ctx.arc(cx, cy, 300, 0, TAU); ctx.stroke();
    ctx.restore();
    // connected edges (finale)
    if (this.state !== 'build') {
      for (let e = 0; e < this.edges.length; e++) {
        const on = this.finT >= 0.5 + e * 0.4;
        if (!on) continue;
        const [a, b] = this.edges[e];
        const pa = this.socketPos(a), pb = this.socketPos(b);
        ctx.save();
        ctx.strokeStyle = '#ffe156'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 4 + e);
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        ctx.restore();
      }
    }
    // sockets with ghost stars
    for (let i = 0; i < 5; i++) {
      const sp = this.socketPos(i);
      const st = this.stars[i];
      ctx.save();
      ctx.strokeStyle = this.colors[i]; ctx.lineWidth = 4;
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 40, 0, TAU); ctx.stroke();
      if (st.state !== 'set') { // pulsing ghost: "a star belongs HERE"
        ctx.globalAlpha = 0.25 + 0.12 * Math.sin(t * 3 + i);
        ctx.fillStyle = this.colors[i];
        starPath(ctx, sp.x, sp.y, 24, 11);
        ctx.fill();
      }
      ctx.restore();
    }
    // the energy-gate button
    const b = this.button;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3);
    ctx.fillStyle = '#ffe156';
    ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 56, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = b.on ? '#57d357' : '#ffe156';
    ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 34, 0, TAU); ctx.fill();
    ctx.strokeStyle = b.on ? '#2f8a3c' : '#c8861b'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 34, 0, TAU); ctx.stroke();
    drawFace(ctx, b.x + b.w / 2, b.y + b.h / 2 + 2, 30, b.on ? 'grin' : 'surprised', t, 93);
    // the silly alien
    const al = this.alien;
    ctx.save();
    ctx.translate(al.x, al.y + Math.sin(al.t * 1.7) * 10);
    if (al.giggleT > 0) ctx.rotate(Math.sin(al.giggleT * 24) * 0.25 * al.giggleT);
    if (al.happy) ctx.rotate(Math.sin(al.t * 5) * 0.15);
    // saucer
    ctx.fillStyle = '#8a5fd0';
    ctx.beginPath(); ctx.ellipse(0, 26, 52, 17, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#5a3a90'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.ellipse(0, 26, 52, 17, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ffe156';
    for (const lx of [-30, 0, 30]) { ctx.beginPath(); ctx.arc(lx, 30, 5, 0, TAU); ctx.fill(); }
    // dome + green pilot
    ctx.fillStyle = 'rgba(190,232,255,0.35)';
    ctx.beginPath(); ctx.arc(0, 4, 34, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 4, 34, Math.PI, TAU); ctx.stroke();
    ctx.fillStyle = '#7be07b';
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill();
    for (const sd of [-1, 1]) { // antennae
      ctx.strokeStyle = '#7be07b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sd * 8, -16); ctx.lineTo(sd * 14, -30); ctx.stroke();
      ctx.fillStyle = '#ff8fb0';
      ctx.beginPath(); ctx.arc(sd * 14, -32, 4, 0, TAU); ctx.fill();
    }
    drawFace(ctx, 0, 2, 28, al.happy ? 'grin' : (al.giggleT > 0 ? 'surprised' : 'happy'), t, 94);
    // little arms holding the star overhead (until it's gifted)
    if (!al.happy) {
      ctx.strokeStyle = '#7be07b'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-14, -6); ctx.lineTo(-24, -52);
      ctx.moveTo(14, -6); ctx.lineTo(24, -52);
      ctx.stroke();
    }
    ctx.restore();
    if (al.happy && chance(0.06)) {
      Particles.burst(al.x + rand(-30, 30), al.y - 40, 1, { colors: ['#ff8fb0'], type: 'heart', sp1: 30, grav: -40, l1: 1.2, s1: 9, up: 0 });
    }
    // the stars themselves (held star rides above the alien's arms)
    for (const st of this.stars) {
      if (st.state === 'held') {
        this.drawStarShape(ctx, al.x, al.y - 74 + Math.sin(al.t * 1.7) * 10, 26, this.colors[st.i], st.t, true);
        continue;
      }
      const r = st.state === 'set' ? 24 : 26;
      if (st.state === 'set') {
        ctx.save();
        ctx.globalAlpha = 0.4 + 0.2 * Math.sin(t * 4 + st.i);
        ctx.fillStyle = this.colors[st.i];
        ctx.beginPath(); ctx.arc(st.x, st.y, 42, 0, TAU); ctx.fill();
        ctx.restore();
      }
      this.drawStarShape(ctx, st.x, st.y, r, this.colors[st.i], st.t, st.state !== 'set');
    }
    // the hero constellation resolving — drawn LAST so the face reads over the
    // set head star: the head node becomes Jack-Jack or Becca made of stars
    if (this.state !== 'build' && this.finT >= 2.9) {
      const hp = this.socketPos(0);
      const k = Math.min(1, (this.finT - 2.9) / 0.9);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(23,16,41,0.88)'; // the head disc — a night-sky face
      ctx.beginPath(); ctx.arc(hp.x, hp.y - 8, 62, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffe156'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(hp.x, hp.y - 8, 62, 0, TAU); ctx.stroke();
      if (game.character === 'girl') { // Becca: a ring of starry curls + her bow
        ctx.fillStyle = '#ffe156';
        for (let i = 0; i <= 6; i++) {
          const a = Math.PI + i * Math.PI / 6;
          starPath(ctx, hp.x + Math.cos(a) * 62, hp.y - 8 + Math.sin(a) * 62, 13, 6);
          ctx.fill();
        }
        ctx.fillStyle = '#ff8fb0';
        starPath(ctx, hp.x + 44, hp.y - 56, 15, 7);
        ctx.fill();
      } else { // Jack-Jack: his cap, in glowing gold
        ctx.save();
        ctx.beginPath(); ctx.arc(hp.x, hp.y - 8, 62, 0, TAU); ctx.clip();
        ctx.fillStyle = '#ffa62b';
        ctx.beginPath(); ctx.arc(hp.x, hp.y - 16, 60, Math.PI, TAU); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ffa62b';
        rr(ctx, hp.x + 36, hp.y - 28, 52, 15, 7); ctx.fill();
        ctx.fillStyle = '#ffe156';
        starPath(ctx, hp.x, hp.y - 78, 14, 6.5);
        ctx.fill();
      }
      if (game.royal) drawCrown(ctx, hp.x, hp.y - (game.character === 'girl' ? 76 : 80), 20);
      drawFace(ctx, hp.x, hp.y + 8, 52, 'grin', t, 91);
      // twinkles around the new constellation friend
      if (chance(0.2)) Particles.burst(hp.x + rand(-70, 70), hp.y + rand(-70, 50), 1, { colors: ['#ffe156', '#fff'], type: 'sparkle', sp1: 25, grav: 0, l1: 0.9, s1: 8, up: 0 });
      ctx.restore();
    }
  }
}

// ================================================================ jungle vine
// Reusable swinging vine (first used in the Jungle Treehouse Trail). Fully
// contextual: jump INTO the dangling leaf grip to grab on (never grabs while
// standing), the vine swings on a steady, readable pendulum, and pressing
// Up/Space lets go with the swing's momentum plus a friendly upward boost —
// bad timing is never a plummet. Only one vine can be held at a time; the
// holder is tracked on the LEVEL object (lv.vineHold) so nothing can leak
// through enterSub/exitSub. The swing is a deterministic sinusoid, which keeps
// it predictable for a five-year-old ("let go when you're flying that way!")
// and rideable-for-real in the harness.
class Vine {
  constructor(ax, ay, len, opt = {}) {
    this.ax = ax; this.ay = ay; this.len = len;
    this.amp = opt.amp || 0.85;  // swing amplitude (radians)
    this.om = opt.om || 1.7;     // swing speed (rad/s)
    this.t = opt.phase ?? rand(9);
    this.cd = 0;                 // regrab cooldown after a release
  }
  angle() { return this.amp * Math.sin(this.t * this.om); }
  bob() {
    const a = this.angle();
    return { a, x: this.ax + Math.sin(a) * this.len, y: this.ay + Math.cos(a) * this.len };
  }
  grabBox() {
    const b = this.bob();
    return { x: b.x - 36, y: b.y - 48, w: 72, h: 112 };
  }
  update(dt, pl, lv) {
    this.t += dt;
    this.cd = Math.max(0, this.cd - dt);
    const b = this.bob();
    if (lv.vineHold === this) {
      if (justP.ArrowUp || justP.Space) {
        // LET GO — fly with the swing's momentum
        lv.vineHold = null;
        this.cd = 0.7;
        const av = this.amp * this.om * Math.cos(this.t * this.om); // angular velocity
        pl.vx = av * this.len * Math.cos(b.a) * 1.25;
        pl.vy = -av * this.len * Math.sin(b.a) - 320;
        pl.launchT = 1.3; // same airborne momentum window as the side-launch clouds
        pl.onGround = false;
        pl.setMood('grin', 0.8);
        AudioSys.sfx('whoosh');
        Particles.burst(pl.cx, pl.cy, 8, { colors: ['#7be07b', '#fff'], type: 'sparkle', sp1: 160, l1: 0.5, s1: 8 });
      } else {
        pl.x = b.x - pl.w / 2;
        pl.y = b.y - 24;
        pl.vx = 0; pl.vy = 0;
        pl.onGround = false;
        pl.spin = b.a * 1.6; // lean into the swing
        if (chance(2 * dt)) Particles.burst(b.x, b.y - 30, 1, { colors: ['#7be07b'], type: 'sparkle', sp1: 20, grav: 60, l1: 0.5, s1: 7, up: 0 });
      }
    } else if (!lv.vineHold && !lv.vineLock && this.cd <= 0 && !pl.onGround && overlaps(this.grabBox(), pl)) {
      lv.vineHold = this;
      AudioSys.sfx('flap');
      AudioSys.sfx('switch');
      pl.setMood('grin', 0.6);
      Particles.burst(b.x, b.y - 20, 8, { colors: ['#57d357', '#fff'], type: 'sparkle', sp1: 140, l1: 0.5, s1: 8 });
    }
  }
  draw(ctx, t) {
    const b = this.bob();
    // rope: a gentle curve from the anchor out to the bob
    ctx.strokeStyle = '#3f9c3a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.ax, this.ay);
    ctx.quadraticCurveTo(
      this.ax + Math.sin(b.a) * this.len * 0.45, this.ay + Math.cos(b.a) * this.len * 0.55,
      b.x, b.y
    );
    ctx.stroke();
    // little leaves along the vine
    ctx.fillStyle = '#57b84a';
    for (const k of [0.3, 0.55, 0.8]) {
      const lx = this.ax + Math.sin(b.a) * this.len * k;
      const ly = this.ay + Math.cos(b.a) * this.len * (k + 0.04);
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(b.a + Math.sin(t * 2 + k * 9) * 0.2);
      ctx.beginPath(); ctx.ellipse(9, 0, 11, 5, 0.4, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // the big leafy grip at the end — THE thing to jump into
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.a * 0.5);
    ctx.fillStyle = '#57d357';
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(sd * 14, 2, 17, 8, sd * 0.5, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#3f9c3a';
    rr(ctx, -6, -10, 12, 22, 5); ctx.fill();
    ctx.restore();
  }
}

// ================================================================ the monkey
// The Jungle Treehouse Trail's companion. Starts stranded and SAD (slumped,
// sighing, dreaming of a banana in a thought bubble); once fed, he celebrates
// and becomes a friend who bounds along behind the hero — and who can THROW
// the hero across gaps no jump could ever cross (the TreehouseTrail machine
// orchestrates those throw sequences; during them monkey.state === 'held').
class Monkey {
  constructor(x, groundY) {
    this.w = 54; this.h = 62;
    this.x = x - 27; this.y = groundY - this.h;
    this.groundY = groundY;
    this.state = 'sad'; // sad -> munch -> follow (held = trail is posing him)
    this.pose = null;   // 'windup' | 'leap' | 'climb' while held
    this.vx = 0; this.vy = 0; this.onGround = true;
    this.t = rand(9); this.munchT = 0; this.sighT = rand(2, 3.5);
    this.facing = -1; this.bubbleT = 0;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt, pl, lv) {
    this.t += dt;
    if (this.state === 'sad') {
      this.facing = pl.cx > this.cx ? 1 : -1;
      const near = Math.abs(pl.cx - this.cx) < 470 && Math.abs(pl.cy - this.cy) < 420;
      this.bubbleT = near ? Math.min(1, this.bubbleT + dt * 3) : Math.max(0, this.bubbleT - dt * 3);
      this.sighT -= dt;
      if (this.sighT <= 0) {
        this.sighT = rand(3.5, 5.5);
        if (near) AudioSys.sfx('monkeysad');
        // a single cartoon tear
        Particles.burst(this.cx + this.facing * 10, this.y + 18, 1, { colors: ['#7fd8ff'], type: 'circle', sp1: 15, grav: 300, l1: 0.7, s1: 6, up: 0 });
      }
    } else if (this.state === 'munch') {
      this.munchT += dt; // the trail drives the celebration beats
    } else if (this.state === 'follow') {
      const far = Math.abs(pl.cx - this.cx) > 700 || Math.abs(pl.cy - this.cy) > 700;
      if (far) { this.x = pl.x - pl.facing * 90; this.y = pl.y - 30; this.vy = 0; }
      const tx = pl.cx - pl.facing * 120 - this.w / 2;
      const step = clamp((tx - this.x) * Math.min(1, 6 * dt), -330 * dt, 330 * dt);
      this.x += step;
      if (Math.abs(tx - this.x) > 8) this.facing = Math.sign(tx - this.x) || this.facing;
      else this.facing = pl.facing;
      this.vy += 1600 * dt;
      if (this.vy > 900) this.vy = 900;
      const r = moveEntity(this, lv, dt);
      this.onGround = r.ground;
      if (this.onGround && Math.abs(tx - this.x) > 40 && chance(3 * dt)) this.vy = -430; // bounding hops
      if (chance(0.5 * dt)) Particles.burst(this.cx, this.y - 6, 1, { colors: ['#ff8fb0'], type: 'heart', sp1: 40, grav: -110, l1: 0.9, s1: 8, up: 0 });
      if (this.y > lv.h + 150) { this.x = pl.x; this.y = pl.y - 40; this.vy = 0; }
    }
    // 'held': the TreehouseTrail positions him directly
  }
  draw(ctx, t) {
    const sad = this.state === 'sad';
    const munch = this.state === 'munch';
    const x = this.cx, base = this.y + this.h;
    const running = this.state === 'follow' && this.onGround && Math.abs(this.vx) + 1 > 0;
    ctx.save();
    if (this.facing < 0) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
    const slump = sad ? 10 : 0;
    const hop = munch && this.munchT > 1.9 ? Math.abs(Math.sin(t * 9)) * 14 : 0;
    ctx.translate(0, slump - hop);
    // tail: a big curly question-mark of a tail (droops when sad)
    ctx.strokeStyle = '#8a5a34'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 16, base - 22);
    if (sad) ctx.quadraticCurveTo(x - 44, base - 10, x - 52, base - 4);
    else ctx.quadraticCurveTo(x - 48, base - 46 + Math.sin(t * 4) * 5, x - 34, base - 62 + Math.sin(t * 4) * 6);
    ctx.stroke();
    if (!sad) { ctx.beginPath(); ctx.arc(x - 32, base - 66 + Math.sin(t * 4) * 6, 5, 0, TAU); ctx.stroke(); }
    // legs (tucked when sitting sad, trotting when following)
    ctx.strokeStyle = '#a06a3e'; ctx.lineWidth = 8;
    if (sad) {
      ctx.beginPath(); ctx.moveTo(x - 8, base - 14); ctx.lineTo(x + 14, base - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 2, base - 12); ctx.lineTo(x + 20, base - 2); ctx.stroke();
    } else {
      const sw = running ? Math.sin(t * 12) * 7 : 0;
      ctx.beginPath(); ctx.moveTo(x - 8, base - 16); ctx.lineTo(x - 10 + sw, base - 1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 8, base - 16); ctx.lineTo(x + 10 - sw, base - 1); ctx.stroke();
    }
    // body: brown with a banana-cream belly
    ctx.fillStyle = '#a06a3e';
    ctx.beginPath(); ctx.ellipse(x, base - 26, 19, 21, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6f4423'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ffe9c0';
    ctx.beginPath(); ctx.ellipse(x + 3, base - 22, 11, 13, 0, 0, TAU); ctx.fill();
    // arms
    ctx.strokeStyle = '#a06a3e'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    if (sad) { // hugging knees, one hand out begging now and then
      const beg = Math.sin(this.t * 1.4) > 0.4 ? 8 : 0;
      ctx.beginPath(); ctx.moveTo(x - 4, base - 34); ctx.lineTo(x + 16 + beg, base - 18 - beg); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 10, base - 32); ctx.lineTo(x + 8, base - 12); ctx.stroke();
    } else if (munch && this.munchT < 1.9) { // banana to mouth
      ctx.beginPath(); ctx.moveTo(x + 6, base - 36); ctx.lineTo(x + 16, base - 52); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 6, base - 34); ctx.lineTo(x + 10, base - 50); ctx.stroke();
    } else { // arms up and happy
      const wig = Math.sin(t * 8) * 6;
      ctx.beginPath(); ctx.moveTo(x - 10, base - 36); ctx.lineTo(x - 22, base - 52 - wig); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 10, base - 36); ctx.lineTo(x + 22, base - 52 + wig); ctx.stroke();
    }
    // head with big round ears
    const hy = base - 52 - (sad ? -4 : 0);
    ctx.fillStyle = '#a06a3e';
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.arc(x + sd * 15, hy - 8, 8, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#6f4423'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#ffd9b0';
      ctx.beginPath(); ctx.arc(x + sd * 15, hy - 8, 4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#a06a3e';
    }
    ctx.beginPath(); ctx.arc(x, hy, 16, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6f4423'; ctx.lineWidth = 3; ctx.stroke();
    // cream face patch
    ctx.fillStyle = '#ffe9c0';
    ctx.beginPath(); ctx.ellipse(x + 1, hy + 3, 11, 9.5, 0, 0, TAU); ctx.fill();
    const mood = sad ? 'sad' : munch ? (this.munchT < 1.9 ? 'grin' : 'grin') : 'happy';
    drawFace(ctx, x, hy + 1, 21, mood, t, 68, this.facing, 0);
    // a tiny tuft of hair
    ctx.strokeStyle = '#6f4423'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x, hy - 15); ctx.quadraticCurveTo(x + 4, hy - 24, x + 8, hy - 21); ctx.stroke();
    ctx.restore();
  }
}

// ================================================================ treehouse trail
// The Jungle Treehouse Trail machine (lv.puzzle for 'treehouse'). One class
// holds the whole adventure so exitSub can never leak it:
//   - the banana machine: pressure plate -> rope ladder unrolls; porch lever ->
//     pulley pays the banana down; a grumpy toucan sits ON the rope and blocks
//     it until startled (the bounce flower under it does the job — so does any
//     thrown block). Plate/lever/toucan resolve in any order; every action has
//     an immediate visible reaction and wrong attempts are jokes, not damage.
//   - the sad monkey: banana delivered -> celebration -> lifelong friend.
//   - throw pads: with the monkey following, standing on a pad makes him grab
//     the hero, wind up, and HURL them along a huge scripted arc — the only way
//     across the waterfall gorge and up to the Grand Treehouse balcony.
//   - the Monkey Disco (a found-only party room) and the Banana Bell finale,
//     which reveals lv.goalStar so subWin/persistence/replay all come free.
function qBez(p0, c, p1, k) {
  const u = 1 - k;
  return {
    x: u * u * p0.x + 2 * u * k * c.x + k * k * p1.x,
    y: u * u * p0.y + 2 * u * k * c.y + k * k * p1.y
  };
}
class TreehouseTrail {
  constructor(gf, gb) {
    this.gf = gf; this.gb = gb; // region floors: jungle floor / highland floor
    this.t = rand(9);
    // -- banana machine --
    this.plate = { x: 1780, y: gf - 24, w: 104, h: 30, on: false };
    this.rungs = [ // hidden until the plate unrolls the ladder
      { x: 1654, y: gf - 90, w: 92, h: 14, oneWay: true, skipDraw: true, broken: true },
      { x: 1654, y: gf - 180, w: 92, h: 14, oneWay: true, skipDraw: true, broken: true }
    ];
    this.houseX = 1760; this.porchY = gf - 260; // lever house porch top (2280)
    this.lever = { x: 1798, y: this.porchY - 86, w: 54, h: 86, on: false };
    this.pulley = { x: 2110, y: gf - 410, spin: 0 }; // palm-top pulley (y 2130)
    this.toucan = { x: 2062, y: gf - 392, state: 'perch', t: rand(9), flyT: 0, grumpT: 0, sulkX: 1768, sulkY: this.porchY - 120 };
    this.banana = { state: 'hang', x: 2110, y: gf - 340, t: rand(9), hangY: gf - 340, stuckY: gf - 290, floorY: gf - 68 };
    this.monkey = new Monkey(2262, gf);
    this.peel = null;
    // -- throw pads --
    this.pads = [
      { x: 2335, groundY: gf, c: { x: 2840, y: 700 }, land: { x: 3350, y: gb }, cd: 0 },
      { x: 4400, groundY: 1250, c: { x: 4180, y: 480 }, land: { x: 3950, y: 760 }, cd: 0 }
    ];
    this.seq = null;       // {pad, phase:'grab'|'windup'|'fly', t, p0, p1, from}
    this.monkeyLeap = null; // monkey's own hop across after a throw
    // -- region B set pieces --
    this.disco = { x: 3240, y: 1140, found: false, t: rand(9) };
    this.bell = { x: 3950, y: 646, state: 'idle', t: 0, swing: 0 };
    this.balcony = { x: 3790, w: 330, y: 760 };
  }
  lights() { return []; }
  padZone(pad, pl) {
    return Math.abs(pl.cx - pad.x) < 60 && Math.abs(pl.y + pl.h - pad.groundY) < 10 && pl.onGround;
  }
  toucanBox() { return { x: this.toucan.x - 46, y: this.toucan.y - 34, w: 92, h: 70 }; }
  bananaBox() { return { x: this.banana.x - 34, y: this.banana.y - 30, w: 68, h: 64 }; }
  startleToucan() {
    const tc = this.toucan;
    if (tc.state !== 'perch') return;
    tc.state = 'fly'; tc.flyT = 0;
    tc.fx = tc.x; tc.fy = tc.y;
    AudioSys.sfx('squawk');
    Particles.burst(tc.x, tc.y, 8, { colors: ['#4aa3ff', '#ffe156'], type: 'confetti', sp1: 180, l1: 0.7, s1: 8 });
    if (this.banana.state === 'stuck') {
      this.banana.state = 'drop'; // the rope is free — down it comes
      AudioSys.sfx('switch');
    }
  }
  update(dt, pl) {
    const lv = game.level;
    this.t += dt;
    this.pulley.spin = Math.max(0, this.pulley.spin - dt);
    // vines keep their leaves to themselves while the monkey is throwing you
    lv.vineLock = !!this.seq;
    // ---- pressure plate -> the rope ladder tumbles open ----
    if (!this.plate.on && overlaps(this.plate, pl)) {
      this.plate.on = true;
      for (const r of this.rungs) r.broken = false;
      AudioSys.sfx('switch');
      AudioSys.sfx('grind');
      game.shake = Math.max(game.shake, 0.15);
      Particles.burst(1700, this.gf - 140, 12, { colors: ['#d9b98a', '#8a5a34'], sp1: 180, l1: 0.6, s1: 9, up: 40 });
    }
    // ---- porch lever -> the pulley pays the banana rope out ----
    if (!this.lever.on && overlaps(this.lever, pl)) {
      this.lever.on = true;
      this.pulley.spin = 1.6;
      AudioSys.sfx('switch');
      AudioSys.sfx('grind');
      game.shake = Math.max(game.shake, 0.18);
      Particles.burst(this.lever.x + 27, this.lever.y + 30, 10, { colors: ['#ffe156', '#fff'], type: 'star', sp1: 200, l1: 0.6, s1: 9 });
      Particles.burst(this.pulley.x, this.pulley.y, 8, { colors: ['#d9b98a'], type: 'sparkle', sp1: 120, l1: 0.5, s1: 8 });
      if (this.banana.state === 'hang') this.banana.state = 'drop';
    }
    // ---- the grumpy toucan on the rope ----
    const tc = this.toucan;
    tc.t += dt;
    tc.grumpT = Math.max(0, tc.grumpT - dt);
    if (tc.state === 'perch') {
      if ((!pl.onGround && overlaps(this.toucanBox(), pl))) this.startleToucan();
      else for (const pr of game.projectiles) {
        if (!pr.dead && overlaps(pr, this.toucanBox())) { this.startleToucan(); pr.impact(true); break; }
      }
    } else if (tc.state === 'fly') {
      tc.flyT += dt;
      const k = Math.min(1, tc.flyT / 1.1);
      const p = qBez({ x: tc.fx, y: tc.fy }, { x: (tc.fx + tc.sulkX) / 2, y: tc.fy - 160 }, { x: tc.sulkX, y: tc.sulkY }, k);
      tc.x = p.x; tc.y = p.y;
      if (k >= 1) { tc.state = 'sulk'; tc.grumpT = 2; }
    }
    // ---- the banana ----
    const bn = this.banana;
    bn.t += dt;
    if (bn.state === 'drop') {
      this.pulley.spin = Math.max(this.pulley.spin, 0.4);
      bn.y += 240 * dt;
      if (tc.state === 'perch' && bn.y >= bn.stuckY) {
        bn.y = bn.stuckY;
        bn.state = 'stuck'; // the toucan's grip pins the rope — !?
        tc.grumpT = 2.5;
        AudioSys.sfx('boing');
        AudioSys.sfx('squawk');
      } else if (bn.y >= bn.floorY) {
        bn.y = bn.floorY;
        bn.state = 'waiting';
        AudioSys.sfx('boing');
        AudioSys.sfx('collect');
        Particles.burst(bn.x, bn.y, 14, { colors: ['#ffe156', '#ffd24a', '#fff'], type: 'star', sp1: 220, l1: 0.8, s1: 10, grav: 200 });
      }
    } else if (bn.state === 'stuck') {
      if (tc.state !== 'perch') bn.state = 'drop';
    } else if (bn.state === 'waiting') {
      if (overlaps(this.bananaBox(), pl)) {
        bn.state = 'follow';
        AudioSys.sfx('powerup');
        pl.setMood('grin', 1.2);
        Particles.burst(bn.x, bn.y, 16, { colors: ['#ffe156', '#fff'], type: 'star', sp1: 260, l1: 0.8, s1: 11, grav: 200 });
      }
    } else if (bn.state === 'follow') {
      const tx = pl.cx - pl.facing * 58, ty = pl.y - 26 + Math.sin(bn.t * 3) * 8;
      if (Math.hypot(tx - bn.x, ty - bn.y) > 650) { bn.x = tx; bn.y = ty; }
      const k = Math.min(1, dt * 5.5);
      bn.x += (tx - bn.x) * k; bn.y += (ty - bn.y) * k;
      if (chance(0.12)) Particles.burst(bn.x, bn.y + 8, 1, { colors: ['#ffe156'], type: 'sparkle', sp1: 15, grav: -40, l1: 0.7, s1: 7, up: 0 });
      // delivery!
      if (this.monkey.state === 'sad' && Math.hypot(bn.x - this.monkey.cx, bn.y - this.monkey.cy) < 120) {
        bn.state = 'eaten';
        this.monkey.state = 'munch';
        this.monkey.munchT = 0;
        AudioSys.sfx('monkey');
      }
    }
    // ---- the celebration (munch beats live here, poses live on the monkey) ----
    const mk = this.monkey;
    if (mk.state === 'munch') {
      const prev = mk.munchT; // updated below in mk.update
      mk.update(dt, pl, lv);
      for (const tt of [0.35, 0.8, 1.25]) {
        if (prev < tt && mk.munchT >= tt) {
          AudioSys.sfx('candy');
          Particles.burst(mk.cx + mk.facing * 14, mk.y + 6, 4, { colors: ['#ffe156', '#fff6d0'], sp1: 120, l1: 0.5, s1: 7 });
        }
      }
      if (prev < 1.9 && mk.munchT >= 1.9) { // MONKEY FRIEND ACQUIRED
        AudioSys.sfx('monkey');
        AudioSys.sfx('friend');
        AudioSys.sfx('cheer');
        game.shake = Math.max(game.shake, 0.25);
        Particles.burst(mk.cx, mk.y, 22, { colors: ['#ff8fb0', '#ffd24a', '#fff'], type: 'heart', sp1: 300, l1: 1.1, s1: 12 });
        Particles.burst(mk.cx, mk.y - 20, 18, { colors: RAINBOW, type: 'confetti', sp1: 280, l0: 1, l1: 2, s1: 11, grav: 260, up: 200 });
        this.peel = { x: mk.cx + mk.facing * 40, y: this.gf - 6 };
        pl.setMood('grin', 2);
      }
      if (mk.munchT >= 3.0) mk.state = 'follow';
    } else if (mk.state !== 'held') {
      mk.update(dt, pl, lv);
    }
    // ---- throw pads: the monkey launches the hero ----
    for (const pad of this.pads) pad.cd = Math.max(0, pad.cd - dt);
    if (!this.seq && mk.state === 'follow') {
      for (const pad of this.pads) {
        if (pad.cd > 0 || !this.padZone(pad, pl)) continue;
        this.seq = { pad, phase: 'grab', t: 0, from: { x: mk.x, y: mk.y } };
        mk.state = 'held'; mk.pose = 'leap';
        AudioSys.sfx('monkey');
        break;
      }
    }
    if (this.seq) {
      const sq = this.seq, pad = sq.pad;
      sq.t += dt;
      if (sq.phase === 'grab') { // monkey bounds onto the pad
        const k = Math.min(1, sq.t / 0.35);
        mk.x = lerp(sq.from.x, pad.x - mk.w / 2, k);
        mk.y = lerp(sq.from.y, pad.groundY - mk.h, k) - Math.sin(k * Math.PI) * 60;
        if (k >= 1) { sq.phase = 'windup'; sq.t = 0; mk.pose = 'windup'; }
      } else if (sq.phase === 'windup') { // hoists the hero overhead and spins up
        mk.x = pad.x - mk.w / 2; mk.y = pad.groundY - mk.h;
        pl.x = pad.x - pl.w / 2 + Math.sin(sq.t * 26) * 5;
        pl.y = pad.groundY - mk.h - pl.h - 8;
        pl.vx = 0; pl.vy = 0; pl.onGround = false;
        if (chance(8 * dt * 4)) Particles.burst(pad.x + rand(-30, 30), pad.groundY - 40, 1, { colors: ['#c9a96a', '#7be07b'], sp1: 70, grav: -30, l1: 0.5, s1: 8, up: 10 });
        if (sq.t >= 0.75) {
          sq.phase = 'fly'; sq.t = 0;
          sq.p0 = { x: pl.x, y: pl.y };
          sq.p1 = { x: pad.land.x - pl.w / 2, y: pad.land.y - pl.h };
          AudioSys.sfx('launch');
          AudioSys.sfx('monkey');
          game.shake = Math.max(game.shake, 0.35);
          Particles.burst(pad.x, pad.groundY - 60, 16, { colors: ['#7be07b', '#ffe156', '#fff'], type: 'star', sp1: 320, l1: 0.8, s1: 11 });
        }
      } else if (sq.phase === 'fly') { // THE THROW
        const k = Math.min(1, sq.t / 1.5);
        const p = qBez(sq.p0, pad.c, sq.p1, k);
        pl.x = p.x; pl.y = p.y;
        pl.vx = 0; pl.vy = 0; pl.onGround = false;
        pl.spin += 13 * dt;
        pl.setMood('grin', 0.5);
        if (chance(0.7)) Particles.burst(pl.cx, pl.cy, 1, { colors: ['#57d357', '#7be07b', '#ffe156'], type: 'confetti', sp1: 60, grav: 120, l1: 1, s1: 9, up: 0 });
        if (k >= 1) { // touchdown in a whole new jungle
          pl.y = sq.p1.y; pl.vy = 0; pl.squash = 0.65;
          AudioSys.sfx('thud');
          AudioSys.sfx('land');
          game.shake = Math.max(game.shake, 0.2);
          Particles.burst(pl.cx, pl.y + pl.h, 12, { colors: ['#57b84a', '#8a5a34'], sp1: 200, l1: 0.6, s1: 10, up: 30 });
          pad.cd = 1.6;
          this.monkeyLeap = {
            t: 0,
            p0: { x: mk.x, y: mk.y },
            c: { x: (mk.x + sq.p1.x) / 2, y: pad.c.y + 60 },
            p1: { x: pad.land.x + 40, y: pad.land.y - mk.h }
          };
          mk.pose = 'leap';
          this.seq = null;
        }
      }
    }
    if (this.monkeyLeap) { // the monkey swings across right behind you
      const L = this.monkeyLeap;
      L.t += dt;
      const k = Math.min(1, L.t / 0.9);
      const p = qBez(L.p0, L.c, L.p1, k);
      mk.x = p.x; mk.y = p.y;
      if (k >= 1) { this.monkeyLeap = null; mk.state = 'follow'; mk.pose = null; mk.vy = 0; }
    }
    // ---- the MONKEY DISCO (found-only party room) ----
    if (!this.disco.found && pl.onGround && pl.cx > 3160 && pl.cx < 3320 && Math.abs(pl.y + pl.h - 1140) < 10) {
      this.disco.found = true;
      AudioSys.sfx('cheer');
      AudioSys.sfx('chest');
      AudioSys.sfx('monkey');
      game.shake = Math.max(game.shake, 0.3);
      pl.setMood('grin', 3);
      Particles.burst(3240, 1060, 30, { colors: RAINBOW, type: 'confetti', sp1: 360, l0: 1, l1: 2.2, s1: 12, grav: 280, up: 260 });
      for (let i = 0; i < 3; i++) {
        const c = new Pickup(3200 + i * 40, 1040, 'candy');
        c.physics = true; c.vx = rand(-140, 140); c.vy = rand(-420, -220);
        game.pickups.push(c);
      }
      game.pickups.push(new Pickup(3240, 1000, 'heart'));
    }
    this.disco.t += dt;
    // ---- the Banana Bell finale ----
    const bl = this.bell;
    if (bl.state === 'idle' && mk.state === 'follow' &&
        pl.onGround && pl.cx > this.balcony.x && pl.cx < this.balcony.x + this.balcony.w &&
        Math.abs(pl.y + pl.h - this.balcony.y) < 10) {
      bl.state = 'ringing'; bl.t = 0;
      mk.state = 'held'; mk.pose = 'climb';
      mk.climbFrom = { x: mk.x, y: mk.y };
      AudioSys.sfx('monkey');
    }
    if (bl.state === 'ringing') {
      const prev = bl.t;
      bl.t += dt;
      const climbK = Math.min(1, bl.t / 0.9);
      mk.x = lerp(mk.climbFrom.x, bl.x - mk.w / 2 + 40, climbK);
      mk.y = lerp(mk.climbFrom.y, bl.y - 10, climbK) - Math.sin(climbK * Math.PI) * 50;
      for (const tt of [1.1, 1.9, 2.7]) { // BONG. BONG. BONG.
        if (prev < tt && bl.t >= tt) {
          bl.swing = 1;
          AudioSys.sfx('bells');
          AudioSys.sfx('thud');
          game.shake = Math.max(game.shake, 0.3);
          Particles.burst(bl.x, bl.y + 20, 14, { colors: ['#ffd24a', '#ffe156', '#fff'], type: 'star', sp1: 300, l1: 0.9, s1: 11, grav: 60 });
        }
      }
      if (prev < 2.0 && bl.t >= 2.0) { // candy rains from the canopy
        for (let i = 0; i < 6; i++) {
          const c = new Pickup(bl.x + rand(-140, 140), bl.y - 30, 'candy');
          c.physics = true; c.vx = rand(-180, 180); c.vy = rand(-380, -120);
          game.pickups.push(c);
        }
        Particles.candyBurst(bl.x, bl.y, 14);
      }
      if (prev < 3.4 && bl.t >= 3.4) { // the golden star answers the bell
        game.level.goalStar = { x: 3830, y: 668 };
        AudioSys.sfx('chest');
        Particles.burst(3830, 668, 22, { colors: ['#ffd24a', '#ffe156', '#fff'], type: 'star', sp1: 320, l1: 1, s1: 12, grav: 120 });
        bl.state = 'done';
        mk.state = 'follow'; mk.pose = null; mk.vy = 0;
      }
    }
    if (bl.state !== 'idle') bl.swing = Math.max(0, bl.swing - dt * 0.8);
  }
  // ---------------------------------------------------------------- drawing
  drawBanana(ctx, x, y, s, t, glow) {
    if (glow) {
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 3);
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(x, y, s * 1.7, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 2.2) * 0.1);
    for (const [rot, off] of [[-0.35, -s * 0.4], [0, 0], [0.35, s * 0.4]]) {
      ctx.save();
      ctx.translate(off, 0);
      ctx.rotate(rot);
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.7);
      ctx.quadraticCurveTo(s * 0.75, -s * 0.15, s * 0.22, s * 0.72);
      ctx.quadraticCurveTo(s * 0.05, s * 0.8, -s * 0.12, s * 0.68);
      ctx.quadraticCurveTo(s * 0.3, -s * 0.05, -s * 0.3, -s * 0.62);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#c8861b'; ctx.lineWidth = Math.max(2, s * 0.09); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#8a5a34'; // stem cap
    rr(ctx, -s * 0.18, -s * 0.86, s * 0.36, s * 0.24, s * 0.08); ctx.fill();
    ctx.restore();
  }
  drawToucan(ctx, t) {
    const tc = this.toucan;
    const flap = tc.state === 'fly' ? Math.sin(tc.t * 22) * 0.9 : 0;
    const grump = tc.grumpT > 0;
    ctx.save();
    ctx.translate(tc.x, tc.y + (tc.state === 'perch' ? Math.sin(t * 2.2) * 2 : 0));
    const fc = tc.state === 'sulk' ? -1 : 1; // sulking = pointedly facing away
    if (fc < 0) ctx.scale(-1, 1);
    // wings
    ctx.fillStyle = '#2a2438';
    for (const sd of [-1, 1]) {
      ctx.save();
      ctx.rotate(sd * flap * 0.5);
      ctx.beginPath(); ctx.ellipse(-8, 2 + sd * 3, 16, 8, sd * 0.4, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // body
    ctx.beginPath(); ctx.ellipse(0, 4, 15, 18, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(3, 8, 8, 11, 0, 0, TAU); ctx.fill();
    // head
    ctx.fillStyle = '#2a2438';
    ctx.beginPath(); ctx.arc(4, -14, 11, 0, TAU); ctx.fill();
    // THE beak — enormous, banana-colored (suspicious)
    ctx.fillStyle = '#ffb62b';
    ctx.beginPath();
    ctx.moveTo(9, -18);
    ctx.quadraticCurveTo(34, -18 + (grump ? 4 : 0), 36, -8);
    ctx.quadraticCurveTo(24, -4, 10, -8);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d97a1a'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#ff6b35';
    ctx.beginPath(); ctx.moveTo(12, -8); ctx.quadraticCurveTo(24, -2, 34, -8); ctx.lineTo(30, -5); ctx.quadraticCurveTo(20, 0, 12, -6); ctx.closePath(); ctx.fill();
    // eye (angry brow when grumpy)
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(2, -16, 4.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2a3a';
    ctx.beginPath(); ctx.arc(3, -16, 2.2, 0, TAU); ctx.fill();
    if (grump) {
      ctx.strokeStyle = '#3a2a3a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-3, -22); ctx.lineTo(8, -19); ctx.stroke();
    }
    // little feet gripping the rope
    if (tc.state !== 'fly') {
      ctx.strokeStyle = '#ffb62b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-4, 20); ctx.lineTo(-4, 26); ctx.moveTo(4, 20); ctx.lineTo(4, 26); ctx.stroke();
    }
    ctx.restore();
    if (tc.state === 'sulk' && tc.grumpT > 0 && chance(0.03)) {
      Particles.burst(tc.x, tc.y - 30, 1, { colors: ['#c9c9d8'], type: 'bubble', sp1: 20, grav: -60, l1: 0.9, s1: 7, up: 0 });
    }
  }
  drawMachine(ctx, t) {
    const gf = this.gf;
    // ---- the lever treehouse on stilts ----
    const hx = this.houseX, py = this.porchY;
    ctx.strokeStyle = '#8a5a34'; ctx.lineWidth = 12; ctx.lineCap = 'round';
    for (const ox of [-70, 66]) {
      ctx.beginPath(); ctx.moveTo(hx + ox, gf); ctx.lineTo(hx + ox, py + 6); ctx.stroke();
    }
    // hut (ends short of the lever so the big red handle reads clearly)
    ctx.fillStyle = '#b0743e';
    rr(ctx, hx - 96, py - 130, 132, 130, 10); ctx.fill();
    ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 4;
    rr(ctx, hx - 96, py - 130, 132, 130, 10); ctx.stroke();
    // plank seams + window with a curtain
    ctx.strokeStyle = 'rgba(106,64,32,0.5)'; ctx.lineWidth = 2.5;
    for (let sy = py - 98; sy < py - 10; sy += 30) {
      ctx.beginPath(); ctx.moveTo(hx - 90, sy); ctx.lineTo(hx + 30, sy); ctx.stroke();
    }
    ctx.fillStyle = '#5a4a86';
    rr(ctx, hx - 62, py - 108, 42, 40, 8); ctx.fill();
    ctx.fillStyle = '#ffe9c0';
    rr(ctx, hx - 58, py - 104, 34, 32, 6); ctx.fill();
    drawFace(ctx, hx - 41, py - 87, 16, 'happy', t, 71); // somebody home?
    // leaf roof
    ctx.fillStyle = '#3f9c3a';
    ctx.beginPath();
    ctx.moveTo(hx - 112, py - 128); ctx.lineTo(hx - 30, py - 182); ctx.lineTo(hx + 52, py - 128);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2f7a2c'; ctx.lineWidth = 4; ctx.stroke();
    // ---- the rope ladder (rolled or unrolled) ----
    if (!this.plate.on) {
      ctx.fillStyle = '#d9b98a';
      ctx.beginPath(); ctx.arc(1700, py + 12, 16, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#a8895a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(1700, py + 12, 16, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(1700, py + 12, 8, 0, TAU); ctx.stroke();
    } else {
      ctx.strokeStyle = '#d9b98a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (const ox of [-18, 18]) {
        ctx.beginPath(); ctx.moveTo(1700 + ox, py + 4); ctx.lineTo(1700 + ox, gf - 4); ctx.stroke();
      }
      ctx.lineWidth = 5;
      for (const r of this.rungs) {
        ctx.beginPath(); ctx.moveTo(r.x + 8, r.y + 6); ctx.lineTo(r.x + r.w - 8, r.y + 6); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(1682, py - 42); ctx.lineTo(1718, py - 42); ctx.stroke(); // top rung onto the porch
    }
    // ---- the big red lever ----
    const lv2 = this.lever;
    ctx.fillStyle = '#8a8a9a';
    rr(ctx, lv2.x + 12, py - 22, 30, 22, 5); ctx.fill();
    ctx.save();
    ctx.translate(lv2.x + 27, py - 16);
    ctx.rotate(lerp(-0.75, 0.75, lv2.on ? 1 : 0));
    ctx.strokeStyle = '#8a5a34'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -58); ctx.stroke();
    ctx.fillStyle = '#e8482b';
    ctx.beginPath(); ctx.arc(0, -62, 13, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8a2418'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    if (!lv2.on) { // beckoning glow
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 3);
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(lv2.x + 27, py - 60, 36, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // ---- the banana palm + pulley + rope ----
    const px = 2110, pu = this.pulley;
    ctx.strokeStyle = '#a8794a'; ctx.lineWidth = 20; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px - 14, gf);
    ctx.quadraticCurveTo(px - 26, gf - 220, px, pu.y + 24);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(111,68,35,0.5)'; ctx.lineWidth = 3;
    for (let sy = gf - 40; sy > pu.y + 60; sy -= 44) {
      ctx.beginPath(); ctx.moveTo(px - 26, sy); ctx.lineTo(px - 4, sy - 8); ctx.stroke();
    }
    ctx.fillStyle = '#3f9c3a'; // frond crown
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + i * Math.PI / 5;
      ctx.save();
      ctx.translate(px, pu.y + 8);
      ctx.rotate(a + Math.PI / 2 + Math.sin(t * 1.2 + i) * 0.06);
      ctx.beginPath(); ctx.ellipse(0, -46, 14, 48, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // the rope: banana -> up over the pulley -> across to the hut roof
    ctx.strokeStyle = '#d9b98a'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(px, this.banana.state === 'hang' || this.banana.state === 'drop' || this.banana.state === 'stuck' ? this.banana.y - 26 : gf - 90);
    ctx.lineTo(px, pu.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px, pu.y);
    ctx.quadraticCurveTo((px + hx) / 2, pu.y + 74, hx + 10, py - 130);
    ctx.stroke();
    // pulley wheel (spins while paying out)
    ctx.fillStyle = '#ffb62b';
    ctx.beginPath(); ctx.arc(px, pu.y, 15, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#c2831a'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(px, pu.y, 15, 0, TAU); ctx.stroke();
    ctx.save();
    ctx.translate(px, pu.y);
    ctx.rotate(pu.spin > 0 ? t * 9 : 0.4);
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(13, 0); ctx.moveTo(0, -13); ctx.lineTo(0, 13); ctx.stroke();
    ctx.restore();
    // ---- the pressure plate ----
    const p = this.plate, down = p.on ? 8 : 0;
    ctx.fillStyle = '#8a8a9a';
    rr(ctx, p.x - 8, gf - 14, p.w + 16, 14, 5); ctx.fill();
    ctx.fillStyle = p.on ? '#57d357' : '#ffe156';
    rr(ctx, p.x, p.y + down, p.w, p.h - down, 8); ctx.fill();
    ctx.strokeStyle = p.on ? '#2f8a3c' : '#c8861b'; ctx.lineWidth = 3;
    rr(ctx, p.x, p.y + down, p.w, p.h - down, 8); ctx.stroke();
    ctx.fillStyle = p.on ? '#fff' : '#c8861b';
    const mx = p.x + p.w / 2, my = p.y + down + (p.h - down) / 2;
    ctx.beginPath();
    ctx.moveTo(mx - 12, my - 5); ctx.lineTo(mx + 12, my - 5); ctx.lineTo(mx, my + 8);
    ctx.closePath(); ctx.fill();
  }
  drawPad(ctx, pad, t) {
    const g = pad.groundY;
    ctx.fillStyle = '#b0743e';
    ctx.beginPath(); ctx.ellipse(pad.x, g - 6, 52, 13, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(pad.x, g - 6, 52, 13, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(pad.x, g - 6, 30, 7, 0, 0, TAU); ctx.stroke();
    // painted monkey face in the middle
    drawFace(ctx, pad.x, g - 7, 14, 'grin', t, 73);
    // dotted flight-arc hint toward where it sends you
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 3);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.setLineDash([3, 16]); ctx.lineCap = 'round';
    ctx.lineDashOffset = -t * 40;
    const p0 = { x: pad.x, y: g - 60 };
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    for (let k = 0.08; k <= 0.42; k += 0.06) {
      const p = qBez(p0, pad.c, { x: pad.land.x, y: pad.land.y - 60 }, k);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }
  drawDisco(ctx, t) {
    const d = this.disco, base = d.y; // ledge top
    // hollow-trunk club: a fat stump with an open arch
    ctx.fillStyle = '#8a5a34';
    rr(ctx, d.x - 140, base - 186, 280, 186, 22); ctx.fill();
    ctx.strokeStyle = '#5f3a1e'; ctx.lineWidth = 4;
    rr(ctx, d.x - 140, base - 186, 280, 186, 22); ctx.stroke();
    ctx.fillStyle = '#3f9c3a'; // mossy top
    ctx.beginPath(); ctx.ellipse(d.x, base - 186, 152, 24, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = '#241a10'; // the dark dance floor inside
    ctx.beginPath();
    ctx.moveTo(d.x - 112, base);
    ctx.lineTo(d.x - 112, base - 110);
    ctx.quadraticCurveTo(d.x, base - 168, d.x + 112, base - 110);
    ctx.lineTo(d.x + 112, base);
    ctx.closePath(); ctx.fill();
    // sweeping party lights
    ctx.save();
    ctx.globalAlpha = d.found ? 0.6 : 0.35;
    for (let i = 0; i < 3; i++) {
      const a = Math.sin(t * (d.found ? 3.2 : 1.6) + i * 2.1) * 0.7;
      ctx.fillStyle = RAINBOW[(i * 2 + Math.floor(t * (d.found ? 6 : 2))) % RAINBOW.length];
      ctx.beginPath();
      ctx.moveTo(d.x, base - 150);
      ctx.lineTo(d.x + Math.sin(a) * 120 - 18, base);
      ctx.lineTo(d.x + Math.sin(a) * 120 + 18, base);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // THE GLITTER BANANA spinning on its vine
    ctx.strokeStyle = '#d9b98a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(d.x, base - 162); ctx.lineTo(d.x, base - 128); ctx.stroke();
    ctx.save();
    ctx.translate(d.x, base - 112);
    ctx.rotate(t * (d.found ? 3 : 1.2));
    this.drawBanana(ctx, 0, 0, 17, 0, false);
    ctx.restore();
    if (chance(d.found ? 0.3 : 0.08)) {
      Particles.burst(d.x + rand(-60, 60), base - rand(60, 140), 1, { colors: RAINBOW.concat(['#ffe156']), type: 'sparkle', sp1: 30, grav: -20, l1: 0.8, s1: 8, up: 0 });
    }
    // three tiny disco monkeys
    for (let i = 0; i < 3; i++) {
      const bx = d.x - 76 + i * 76;
      const bob = Math.abs(Math.sin(t * (d.found ? 8 : 5) + i * 1.4)) * (d.found ? 12 : 7);
      const by = base - 20 - bob;
      ctx.fillStyle = '#a06a3e';
      ctx.beginPath(); ctx.ellipse(bx, by, 9, 11, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(bx, by - 14, 8, 0, TAU); ctx.fill();
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(bx + sd * 8, by - 18, 3.5, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#ffe9c0';
      ctx.beginPath(); ctx.ellipse(bx, by - 13, 5.5, 4.5, 0, 0, TAU); ctx.fill();
      drawFace(ctx, bx, by - 14, 10, 'grin', t, 74 + i);
      ctx.strokeStyle = '#a06a3e'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      const wig = Math.sin(t * 10 + i * 2) * 5;
      ctx.beginPath(); ctx.moveTo(bx - 6, by - 4); ctx.lineTo(bx - 12, by - 14 - wig); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + 6, by - 4); ctx.lineTo(bx + 12, by - 14 + wig); ctx.stroke();
    }
    if (d.found && chance(0.05)) {
      Particles.burst(d.x + rand(-50, 50), base - 120, 3, { colors: RAINBOW, type: 'confetti', sp1: 140, l0: 0.8, l1: 1.6, s1: 9, grav: 220, up: 120 });
    }
  }
  drawBellHouse(ctx, t) {
    const bl = this.bell, bx = bl.x;
    const by = this.balcony.y;
    // the GRAND TREEHOUSE: a big hut behind the balcony with a bell gable
    ctx.strokeStyle = '#8a5a34'; ctx.lineWidth = 16; ctx.lineCap = 'round';
    for (const ox of [-150, 150]) {
      ctx.beginPath(); ctx.moveTo(bx + ox, by + 4); ctx.lineTo(bx + ox, by - 160); ctx.stroke();
    }
    ctx.fillStyle = '#b0743e';
    rr(ctx, bx - 190, by - 190, 380, 190, 14); ctx.fill();
    ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 5;
    rr(ctx, bx - 190, by - 190, 380, 190, 14); ctx.stroke();
    ctx.strokeStyle = 'rgba(106,64,32,0.5)'; ctx.lineWidth = 3;
    for (let sy = by - 158; sy < by - 16; sy += 34) {
      ctx.beginPath(); ctx.moveTo(bx - 182, sy); ctx.lineTo(bx + 182, sy); ctx.stroke();
    }
    // door + windows
    ctx.fillStyle = '#5a3a20';
    ctx.beginPath();
    ctx.arc(bx, by - 74, 34, Math.PI, TAU);
    ctx.rect(bx - 34, by - 74, 68, 74);
    ctx.fill();
    ctx.fillStyle = '#ffe9c0';
    for (const ox of [-110, 110]) {
      rr(ctx, bx + ox - 24, by - 132, 48, 44, 9); ctx.fill();
    }
    drawFace(ctx, bx - 110, by - 110, 18, 'happy', t, 79);
    drawFace(ctx, bx + 110, by - 110, 18, 'sleepy', t, 80);
    // gable roof
    ctx.fillStyle = '#3f9c3a';
    ctx.beginPath();
    ctx.moveTo(bx - 214, by - 186); ctx.lineTo(bx, by - 300); ctx.lineTo(bx + 214, by - 186);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2f7a2c'; ctx.lineWidth = 5; ctx.stroke();
    // the bell arch under the gable peak
    ctx.fillStyle = '#8a5a34';
    rr(ctx, bx - 56, by - 214, 112, 88, 12); ctx.fill();
    ctx.strokeStyle = '#5f3a1e'; ctx.lineWidth = 4;
    rr(ctx, bx - 56, by - 214, 112, 88, 12); ctx.stroke();
    ctx.fillStyle = '#241a10';
    ctx.beginPath();
    ctx.arc(bx, by - 156, 40, Math.PI, TAU);
    ctx.rect(bx - 40, by - 156, 80, 28);
    ctx.fill();
    // THE GREAT BANANA BELL (a golden bell with a banana clapper, obviously)
    const swing = Math.sin(t * 9) * bl.swing * 0.5;
    ctx.save();
    ctx.translate(bx, by - 176);
    ctx.rotate(swing);
    ctx.strokeStyle = '#d9b98a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 2); ctx.stroke();
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.moveTo(-22, 34);
    ctx.quadraticCurveTo(-24, -2, 0, -4);
    ctx.quadraticCurveTo(24, -2, 22, 34);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-24, 34); ctx.lineTo(24, 34); ctx.stroke();
    drawFace(ctx, 0, 16, 17, bl.state === 'done' ? 'grin' : 'happy', t, 81);
    // banana clapper peeking under the rim
    this.drawBanana(ctx, Math.sin(t * 9) * bl.swing * 8, 42, 8, 0, false);
    ctx.restore();
    // bong rings
    if (bl.swing > 0.5) {
      ctx.save();
      ctx.globalAlpha = (bl.swing - 0.5) * 1.6;
      ctx.strokeStyle = '#ffe156'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(bx, by - 156, 60 + (1 - bl.swing) * 120, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    // rope from the bell down to balcony reach (the monkey climbs it)
    ctx.strokeStyle = '#d9b98a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(bx + 40, by - 140); ctx.quadraticCurveTo(bx + 44, by - 80, bx + 40, by - 24); ctx.stroke();
  }
  draw(ctx, t) {
    // region B set pieces first (far side of the world)
    this.drawBellHouse(ctx, t);
    this.drawDisco(ctx, t);
    // region A machine
    this.drawMachine(ctx, t);
    // throw pads
    for (const pad of this.pads) this.drawPad(ctx, pad, t);
    // the toucan
    this.drawToucan(ctx, t);
    // the banana (in every state but eaten)
    const bn = this.banana;
    if (bn.state !== 'eaten') {
      const bob = bn.state === 'waiting' || bn.state === 'follow' ? Math.sin(bn.t * 3) * 5 : 0;
      const wob = bn.state === 'stuck' ? Math.sin(t * 16) * 3 : 0;
      this.drawBanana(ctx, bn.x + wob, bn.y + bob, 22, bn.t, bn.state === 'waiting');
      if (bn.state === 'stuck') outlineText(ctx, '?!', bn.x + 40, bn.y - 30, 30, '#ffe156', '#5a4a86');
    }
    // the banana peel keepsake
    if (this.peel) {
      ctx.save();
      ctx.translate(this.peel.x, this.peel.y);
      ctx.fillStyle = '#ffd24a';
      for (const a of [-0.7, 0, 0.7]) {
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath(); ctx.ellipse(0, -8, 5, 12, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 8, 4, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    // the monkey himself
    this.monkey.draw(ctx, t);
    // sad monkey's banana thought bubble
    const mk = this.monkey;
    if (mk.state === 'sad' && mk.bubbleT > 0.05) {
      ctx.save();
      ctx.globalAlpha = mk.bubbleT;
      const bx = mk.cx + 10, by = mk.y - 66 + Math.sin(t * 4) * 4;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(mk.cx + 16, mk.y - 12, 5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(mk.cx + 22, mk.y - 28, 8, 0, TAU); ctx.fill();
      rr(ctx, bx - 44, by - 34, 88, 66, 24); ctx.fill();
      ctx.strokeStyle = '#5a4a86'; ctx.lineWidth = 3;
      rr(ctx, bx - 44, by - 34, 88, 66, 24); ctx.stroke();
      this.drawBanana(ctx, bx, by, 17, t, false);
      ctx.restore();
    }
    // WHEEE! while flying
    if (this.seq && this.seq.phase === 'fly' && game.player) {
      outlineText(ctx, 'WHEEE!', game.player.cx, game.player.y - 46, 40, '#ffe156', '#2f5a2a');
    }
  }
}

// ================================================================ pit stop beat bash
// The rally's secret RHYTHM GAME — Block Buddies' first non-platformer genre.
// A pit garage has turned into an automotive band stage: tire drum, hubcap
// cymbal, exhaust horn, engine-block bass. One control: Space/★ when the big
// colored ring shrinks onto the glowing instrument. The window is huge, misses
// are jokes (plop / flat honk / confused tire — nothing is ever lost), and
// every 4 good hits another instrument JOINS THE BAND, so the room audibly
// and visibly comes alive. 6 more hits with the full band running triggers
// the finale: the roller door flies up and the MONSTER TRUCK arrives to play
// an engine-rev solo and do one completely unnecessary backflip. The golden
// star pops out at the doorway -> subWin -> ffbg_mini persistence, replay and
// the dormant trophy door all come free, exactly like every other secret.
// Deterministic throughout: a dt-driven song clock, fixed beat intervals, and
// a fixed 8-step groove sequencer — the shrinking ring IS the timing source.
const BB_WINDOW = 0.3;   // +/- seconds around the beat that count as a HIT
const BB_LEAD = 1.1;     // seconds the ring takes to shrink onto the target
const BB_LAMPS = 4;      // good hits per instrument before it joins the band
const BB_JAM = 6;        // full-band hits that trigger the finale
class BeatBash {
  constructor(groundY) {
    this.g = groundY;
    this.t = rand(9);
    this.state = 'waiting'; // -> 'countin' -> 'jam' -> 'finale' -> 'done'
    this.instruments = [
      { key: 'tire',   x: 260, sfx: 'tireboom', kind: 'fire',    joined: false, anim: 0, wob: 0 },
      { key: 'hubcap', x: 455, sfx: 'hubcap',   kind: 'ice',     joined: false, anim: 0, wob: 0 },
      { key: 'horn',   x: 635, sfx: 'hornhit',  kind: 'power',   joined: false, anim: 0, wob: 0 },
      { key: 'engine', x: 830, sfx: 'bassbump', kind: 'rainbow', joined: false, anim: 0, wob: 0 }
    ];
    this.lamps = [0, 0, 0, 0]; // per-instrument progress bulbs
    this.stage = 0;            // 0..3 = featured instrument, 4 = full-band jam
    this.hits = 0;             // cumulative successes — NEVER decreases
    this.jamHits = 0;
    this.beat = null;          // { at: songT, target: instrument index }
    this.songT = 0;            // the deterministic song clock
    this.barT = 0; this.lastStep = -1; this.stepFlash = 0;
    this.ct = 0;               // count-in clock
    this.missT = 0;            // crew-shrug timer (comedy, no penalty)
    this.whiffN = 0;
    this.finT = 0;
    this.crewJump = 0;
  }
  instrumentY(i) { // visual center of each instrument (ring target)
    return [this.g - 78, this.g - 150, this.g - 120, this.g - 88][i];
  }
  scheduleBeat() {
    const iv = this.stage === 0 ? 1.9
      : this.stage < 4 ? 1.5
      : [1.1, 0.8, 0.95, 1.5][this.jamHits % 4]; // varied but readable spacing
    this.beat = { at: this.songT + Math.max(iv, 0.8), target: this.stage < 4 ? this.stage : this.jamHits % 4 };
  }
  hitBeat() {
    const i = this.beat.target, ins = this.instruments[i];
    ins.anim = 1;
    this.hits++;
    this.crewJump = 1;
    AudioSys.sfx(ins.sfx);
    Particles.burst(ins.x, this.instrumentY(i) - 20, 10, { colors: [POW[ins.kind].c, '#ffe156', '#fff'], type: 'star', sp1: 260, l1: 0.7, s1: 10 });
    if (game.player) game.player.setMood('grin', 0.5);
    if (this.stage < 4) {
      this.lamps[i]++;
      if (this.lamps[i] >= BB_LAMPS) this.joinBand(i);
    } else {
      this.jamHits++;
      if (this.jamHits >= BB_JAM) { this.startFinale(); return; }
    }
    this.scheduleBeat();
  }
  joinBand(i) {
    const ins = this.instruments[i];
    ins.joined = true;
    this.stage++;
    AudioSys.sfx('powerup');
    AudioSys.sfx('cheer');
    game.shake = Math.max(game.shake, 0.2);
    Particles.burst(ins.x, this.instrumentY(i) - 40, 22, { colors: RAINBOW, type: 'confetti', sp1: 340, l0: 0.9, l1: 1.9, s1: 11, grav: 300, up: 240 });
    if (this.stage === 4) AudioSys.sfx('fanfare'); // THE FULL BAND IS LIVE
  }
  missBeat() { // the beat sailed by — a confused instrument, a shrug, move on
    const ins = this.instruments[this.beat.target];
    ins.wob = 1;
    this.missT = 0.9;
    AudioSys.sfx('plop');
    this.scheduleBeat();
  }
  whiff() { // pressed at the wrong moment — funny sound, nothing lost at all
    this.missT = 0.7;
    this.whiffN++;
    AudioSys.sfx(this.whiffN % 2 ? 'plop' : 'hornflat');
    if (game.player) Particles.burst(game.player.cx, game.player.y + game.player.h, 4, { colors: ['#b8b2c4'], sp1: 90, l1: 0.4, s1: 7, up: 40 });
  }
  startFinale() {
    this.state = 'finale';
    this.finT = 0;
    this.beat = null;
    AudioSys.sfx('rumble');
    game.shake = Math.max(game.shake, 0.5);
  }
  grooveOn() { // the background layers pause for the finale build-up + party
    return (this.state === 'jam' || this.state === 'done') && !game.endPhase;
  }
  update(dt, pl) {
    this.t += dt;
    this.missT = Math.max(0, this.missT - dt);
    this.crewJump = Math.max(0, this.crewJump - dt * 3);
    this.stepFlash = Math.max(0, this.stepFlash - dt * 6);
    for (const ins of this.instruments) {
      ins.anim = Math.max(0, ins.anim - dt * 3.5);
      ins.wob = Math.max(0, ins.wob - dt * 1.4);
    }
    if (this.state === 'waiting') {
      if (pl.x > 300) { // stepping up to the stage starts the show
        this.state = 'countin'; this.ct = 0;
        AudioSys.sfx('hornhit');
        this.crewJump = 1;
      }
      return;
    }
    if (this.state === 'countin') { // four ceiling lamps tick in: 1..2..3..4!
      const prev = this.ct;
      this.ct += dt;
      for (const tt of [0.4, 0.9, 1.4, 1.9]) {
        if (prev < tt && this.ct >= tt) { AudioSys.sfx('stick'); this.stepFlash = 1; }
      }
      if (this.ct >= 2.4) {
        this.state = 'jam';
        this.songT = 0; this.barT = 0; this.lastStep = -1;
        this.scheduleBeat();
      }
      return;
    }
    // ---- the groove sequencer (fixed 8-step bar, 0.25s per step) ----
    if (this.grooveOn()) {
      this.barT += dt;
      const idx = Math.floor(this.barT / 0.25);
      if (idx !== this.lastStep) {
        this.lastStep = idx;
        const s = idx % 8, ins = this.instruments;
        const full = this.state === 'done';
        if ((ins[0].joined || full) && (s === 0 || s === 4)) { AudioSys.sfx('tireboom'); ins[0].anim = Math.max(ins[0].anim, 0.5); }
        if ((ins[1].joined || full) && (s === 2 || s === 6)) { AudioSys.sfx('hubcap'); ins[1].anim = Math.max(ins[1].anim, 0.5); }
        if ((ins[2].joined || full) && s === 4 && Math.floor(idx / 8) % 2 === 1) { AudioSys.sfx('hornhit'); ins[2].anim = Math.max(ins[2].anim, 0.5); }
        if ((ins[3].joined || full) && s % 2 === 0) { AudioSys.sfx('bassbump'); ins[3].anim = Math.max(ins[3].anim, 0.4); }
        this.stepFlash = 1;
      }
    }
    if (this.state === 'jam') {
      this.songT += dt;
      // the ONE input: Space/★ — hit if the ring is on the target, else whiff
      if (justP.Space && game.state === 'play' && !game.endPhase) {
        if (this.beat && Math.abs(this.songT - this.beat.at) <= BB_WINDOW) this.hitBeat();
        else this.whiff(); // early presses never consume the pending beat
      }
      // a beat nobody hit drifts by — comedy shrug, then the next one comes
      if (this.beat && this.songT > this.beat.at + BB_WINDOW) this.missBeat();
      return;
    }
    if (this.state === 'finale') {
      const prev = this.finT;
      this.finT += dt;
      const cue = (tt) => prev < tt && this.finT >= tt;
      if (this.finT < 0.9) game.shake = Math.max(game.shake, 0.25); // the garage shakes...
      if (cue(0.9)) AudioSys.sfx('grind'); // ...the big doors fly open...
      if (cue(2.3)) { AudioSys.sfx('rev'); AudioSys.sfx('cheer'); } // ...IT'S THE TRUCK
      for (const tt of [4.1, 4.5, 4.9, 5.3]) { // the engine-rev solo
        if (cue(tt)) {
          AudioSys.sfx('rev');
          game.shake = Math.max(game.shake, 0.22);
          const tp = this.truckPose();
          if (tp) Particles.burst(tp.x + 158, tp.y - 6, 5, { colors: ['#ff9f43', '#ffe156', 'rgba(200,200,210,0.7)'], type: 'flame', sp1: 180, grav: -140, l1: 0.6, s1: 11, up: 40 });
        }
      }
      if (cue(5.9)) AudioSys.sfx('launch'); // one completely unnecessary backflip
      if (cue(6.9)) {
        AudioSys.sfx('thud');
        game.shake = Math.max(game.shake, 0.45);
        Particles.burst(665, this.g, 14, { colors: ['#b09a7a', '#8a8a9a'], sp1: 260, l1: 0.7, s1: 11, up: 90 });
      }
      if (cue(7.4)) { // candy eruption + the golden star answers the music
        AudioSys.sfx('chest'); AudioSys.sfx('cheer');
        game.shake = Math.max(game.shake, 0.5);
        Particles.candyBurst(665, this.g - 200, 22);
        Particles.burst(665, this.g - 180, 30, { colors: RAINBOW, type: 'confetti', sp1: 420, l0: 1, l1: 2.2, s1: 12, grav: 300, up: 320 });
        for (let i = 0; i < 8; i++) {
          const c = new Pickup(665 + rand(-60, 60), this.g - 190, 'candy');
          c.physics = true; c.vx = rand(-260, 260); c.vy = rand(-620, -260);
          game.pickups.push(c);
        }
        game.level.goalStar = { x: 1090, y: 480 };
        Particles.burst(1090, 480, 22, { colors: ['#ffd24a', '#ffe156', '#fff'], type: 'star', sp1: 320, l1: 1, s1: 12, grav: 120 });
        this.state = 'done';
        this.barT = 0; this.lastStep = -1; // the full band jams on forever
      }
      return;
    }
  }
  doorK() { // 0 = roller door closed, 1 = fully open
    if (this.state === 'done') return 1;
    if (this.state !== 'finale') return 0;
    return clamp((this.finT - 0.9) / 1.3, 0, 1);
  }
  truckPose() { // where the monster truck is during the finale / afterparty
    const w = 176, h = 112, park = 560;
    if (this.state === 'done') {
      return { x: park, y: this.g - h - Math.abs(Math.sin(this.barT * TAU / 2)) * 6, w, h, rot: 0 };
    }
    if (this.state !== 'finale' || this.finT < 2.3) return null;
    const f = this.finT;
    let x = park, y = this.g - h, rot = 0;
    if (f < 3.9) { // rolls in through the open door
      const k = clamp((f - 2.3) / 1.6, 0, 1);
      x = lerp(1330, park, k * k * (3 - 2 * k));
    } else if (f >= 5.9 && f < 6.9) { // THE BACKFLIP
      const k = (f - 5.9) / 1.0;
      y -= Math.sin(k * Math.PI) * 165;
      rot = k * TAU;
    } else if (f >= 4.1 && f < 5.5) { // rev solo: suspension bouncing hard
      y -= Math.abs(Math.sin((f - 4.1) * 12)) * 12;
    }
    return { x, y, w, h, rot };
  }
  lights() { return []; }
  // ---- painted BEFORE solids/goal star (game.js drawBack hook): the room ----
  drawBack(ctx, t) {
    const g = this.g;
    // back wall
    const wg = ctx.createLinearGradient(0, 0, 0, g);
    wg.addColorStop(0, '#4a4258'); wg.addColorStop(1, '#5f5870');
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, W, g);
    // wall panel seams
    ctx.strokeStyle = 'rgba(30,24,44,0.35)'; ctx.lineWidth = 3;
    for (let x = 0; x <= W; x += 160) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, g); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, 180); ctx.lineTo(W, 180); ctx.stroke();
    // hazard stripe base band on the wall (the dirt floor stays — it's a
    // rally-world garage, and drawSolids paints the ground after us anyway)
    for (let x = 0; x < W; x += 56) {
      ctx.fillStyle = (x / 56) % 2 ? '#ffb62b' : '#3a3448';
      ctx.beginPath();
      ctx.moveTo(x, g); ctx.lineTo(x + 28, g); ctx.lineTo(x + 56, g - 22); ctx.lineTo(x + 28, g - 22);
      ctx.closePath(); ctx.fill();
    }
    // shelf of dancing tools (left)
    ctx.fillStyle = '#3a3448';
    rr(ctx, 40, 300, 130, 12, 4); ctx.fill();
    const dance = this.grooveOn() && this.instruments.some(i2 => i2.joined) ? Math.sin(this.barT * TAU * 2) * 0.25 : 0;
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(70 + i * 36, 288);
      ctx.rotate(dance * (i % 2 ? 1 : -1));
      ctx.strokeStyle = '#c9c1d6'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -16); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -20, 7, 0.6, TAU - 0.6); ctx.stroke();
      ctx.restore();
    }
    // spare tire stack (far left floor)
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#2e2430';
      ctx.beginPath(); ctx.ellipse(80, g - 16 - i * 26, 46, 15, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4a3a50';
      ctx.beginPath(); ctx.ellipse(80, g - 16 - i * 26, 18, 6, 0, 0, TAU); ctx.fill();
    }
    // ---- the big roller door (right): closed, then flung open for the truck ----
    const dk = this.doorK();
    const dx = 950, dw = 300, dh = 400;
    // doorway: outside is night, spotlights and stars
    ctx.fillStyle = '#141028';
    rr(ctx, dx, g - dh, dw, dh, 10); ctx.fill();
    if (dk > 0.15) {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 8; i++) {
        const sx = dx + 30 + hash2(i, 3) * (dw - 60), sy = g - dh + 24 + hash2(i, 7) * (dh * 0.5);
        starPath(ctx, sx, sy, 4 + hash2(i, 11) * 3, 2);
        ctx.fill();
      }
      ctx.save();
      ctx.globalAlpha = 0.1 + 0.05 * Math.sin(t * 2);
      ctx.fillStyle = '#ffe9a0';
      for (const ox of [70, 200]) {
        ctx.beginPath();
        ctx.moveTo(dx + ox, g - 6);
        ctx.lineTo(dx + ox - 40, g - dh + 10); ctx.lineTo(dx + ox + 40, g - dh + 10);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    // the door itself rolls UP into the lintel (top edge stays put, height shrinks)
    const doorY = g - dh;
    const doorH = dh * (1 - dk) + 26 * dk;
    ctx.fillStyle = '#ffb62b';
    rr(ctx, dx + 4, doorY, dw - 8, doorH, 8); ctx.fill();
    ctx.strokeStyle = '#c2831a'; ctx.lineWidth = 4;
    rr(ctx, dx + 4, doorY, dw - 8, doorH, 8); ctx.stroke();
    for (let sy = doorY + 20; sy < doorY + doorH - 12; sy += 26) {
      ctx.beginPath(); ctx.moveTo(dx + 12, sy); ctx.lineTo(dx + dw - 12, sy); ctx.stroke();
    }
    // door frame
    ctx.fillStyle = '#3a3448';
    rr(ctx, dx - 14, g - dh - 22, dw + 28, 26, 6); ctx.fill();
    rr(ctx, dx - 14, g - dh - 10, 16, dh + 10, 5); ctx.fill();
    rr(ctx, dx + dw - 2, g - dh - 10, 16, dh + 10, 5); ctx.fill();
    // ---- string of party lights across the ceiling ----
    ctx.strokeStyle = 'rgba(30,24,44,0.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(20, 60); ctx.quadraticCurveTo(W / 2, 118, W - 20, 60); ctx.stroke();
    const lit = this.state !== 'waiting';
    for (let i = 0; i < 12; i++) {
      const k = i / 11;
      const lx = lerp(20, W - 20, k), ly = 60 + Math.sin(k * Math.PI) * 55;
      const on = lit && (this.state === 'countin'
        ? i % 3 === (Math.floor(this.ct / 0.5) % 4) % 3 && this.stepFlash > 0.3
        : (this.lastStep + i) % 3 === 0 || this.stepFlash > 0.6);
      ctx.fillStyle = on ? RAINBOW[i % RAINBOW.length] : '#3a3448';
      ctx.beginPath(); ctx.arc(lx, ly + 10, on ? 9 : 7, 0, TAU); ctx.fill();
      if (on) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.arc(lx, ly + 10, 18, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    // ---- lug-nut equalizer bars above the stage ----
    const joinedN = this.instruments.filter(i2 => i2.joined).length + (this.state === 'done' ? 4 : 0);
    for (let i = 0; i < 8; i++) {
      const ex = 250 + i * 78;
      const amp = joinedN === 0 ? 1 : 1 + Math.round(Math.abs(Math.sin(this.barT * TAU + i)) * (1.5 + joinedN));
      for (let j = 0; j < amp; j++) {
        ctx.fillStyle = j === amp - 1 && joinedN ? '#ffe156' : '#8a8496';
        ctx.beginPath(); ctx.arc(ex, 250 - j * 22, 9, 0, TAU); ctx.fill();
      }
    }
    // the stage riser
    ctx.fillStyle = '#3a3448';
    rr(ctx, 150, g - 26, 770, 34, 10); ctx.fill();
    ctx.fillStyle = '#57536a';
    rr(ctx, 150, g - 26, 770, 10, 8); ctx.fill();
  }
  // ---- painted after solids: the band, the crew, the truck, the beat ring ----
  draw(ctx, t) {
    const g = this.g;
    this.drawInstruments(ctx, t);
    this.drawCrew(ctx, t);
    // the monster truck (finale entrance, solo, backflip, afterparty bounce)
    const tp = this.truckPose();
    if (tp) {
      ctx.save();
      if (tp.rot) {
        ctx.translate(tp.x + tp.w / 2, tp.y + tp.h / 2);
        ctx.rotate(-tp.rot);
        ctx.translate(-(tp.x + tp.w / 2), -(tp.y + tp.h / 2));
      }
      drawTruckBody(ctx, tp.x, tp.y, tp.w, tp.h, t, { driving: this.state === 'finale', facing: -1, mood: 'grin', turbo: this.state === 'finale' && this.finT >= 4.1 && this.finT < 5.5 });
      ctx.restore();
      // headlight beam during the solo
      if (this.state === 'finale' && this.finT >= 4.1 && this.finT < 5.9) {
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 14);
        ctx.fillStyle = '#ffe9a0';
        ctx.beginPath();
        ctx.moveTo(tp.x + 6, tp.y + 60);
        ctx.lineTo(tp.x - 320, tp.y + 20); ctx.lineTo(tp.x - 320, tp.y + 120);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    // ---- THE BEAT RING: the one thing to watch ----
    if (this.state === 'jam' && this.beat) {
      const remain = this.beat.at - this.songT;
      const i = this.beat.target, ins = this.instruments[i];
      const cx = ins.x, cy = this.instrumentY(i);
      const p = POW[ins.kind];
      // target circle (always visible so the eye knows where to look)
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5;
      ctx.setLineDash([12, 10]); ctx.lineDashOffset = -t * 40;
      ctx.beginPath(); ctx.arc(cx, cy, 58, 0, TAU); ctx.stroke();
      ctx.restore();
      if (remain <= BB_LEAD) {
        const k = clamp(1 - remain / BB_LEAD, 0, 1);
        const r = lerp(210, 58, k);
        const inWin = Math.abs(remain) <= BB_WINDOW;
        ctx.save();
        ctx.lineWidth = inWin ? 14 : 10;
        ctx.strokeStyle = inWin ? '#fff' : p.c;
        ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
        ctx.lineWidth = 4; ctx.strokeStyle = inWin ? p.glow : 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      // wordless tutorial: the spacebar bounces under the target until 2 hits
      if (this.hits < 2) drawSpacebar(ctx, cx, cy + 128, 130, t);
    }
    // count-in: the drum flashes awake
    if (this.state === 'countin' && this.stepFlash > 0.3) {
      ctx.save();
      ctx.globalAlpha = this.stepFlash * 0.4;
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(this.instruments[0].x, this.instrumentY(0), 90, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  drawInstruments(ctx, t) {
    const g = this.g;
    const featured = this.state === 'jam' ? (this.beat ? this.beat.target : this.stage) : -1;
    for (let i = 0; i < 4; i++) {
      const ins = this.instruments[i];
      const live = ins.joined || this.state === 'done' || i === featured || this.state !== 'jam';
      const pop = 1 + ins.anim * 0.14;
      const wob = Math.sin(t * 22) * ins.wob * 0.09; // the "confused" wobble
      ctx.save();
      ctx.translate(ins.x, g - 14);
      ctx.rotate(wob);
      ctx.scale(pop, 2 - pop); // squash on hit
      ctx.translate(-ins.x, -(g - 14));
      ctx.globalAlpha = live ? 1 : 0.55;
      const mood = ins.wob > 0.15 ? 'dizzy' : ins.anim > 0.25 ? 'grin' : ins.joined || this.state === 'done' ? 'happy' : 'sleepy';
      if (i === 0) { // TIRE DRUM
        ctx.fillStyle = '#2e2430';
        ctx.beginPath(); ctx.arc(ins.x, g - 78, 64, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#1a1420'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(ins.x, g - 78, 64, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#4a3a50';
        for (let k = 0; k < 10; k++) {
          const a = k * TAU / 10 + 0.2;
          ctx.beginPath(); ctx.arc(ins.x + Math.cos(a) * 55, g - 78 + Math.sin(a) * 55, 6.5, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#e8482b';
        ctx.beginPath(); ctx.arc(ins.x, g - 78, 34, 0, TAU); ctx.fill();
        drawFace(ctx, ins.x, g - 76, 42, mood, t, 81);
      } else if (i === 1) { // HUBCAP CYMBAL on a stand
        ctx.strokeStyle = '#8a8a9a'; ctx.lineWidth = 8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ins.x, g - 14); ctx.lineTo(ins.x, g - 138); ctx.stroke();
        ctx.save();
        ctx.translate(ins.x, g - 150);
        ctx.rotate(Math.sin(t * 16) * ins.anim * 0.3);
        const hg = ctx.createLinearGradient(-58, 0, 58, 0);
        hg.addColorStop(0, '#9a94b0'); hg.addColorStop(0.5, '#e8e4f4'); hg.addColorStop(1, '#9a94b0');
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.ellipse(0, 0, 60, 16, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#6f6a80'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#c9c1d6';
        ctx.beginPath(); ctx.arc(0, -2, 10, 0, TAU); ctx.fill();
        drawFace(ctx, 0, 4, 22, mood, t, 82);
        ctx.restore();
      } else if (i === 2) { // EXHAUST-PIPE HORNS
        for (let k = 0; k < 3; k++) {
          const px = ins.x - 34 + k * 34, ph = 90 + k * 32;
          ctx.fillStyle = '#8a8a9a';
          rr(ctx, px - 11, g - 14 - ph, 22, ph, 6); ctx.fill();
          ctx.strokeStyle = '#6f6a80'; ctx.lineWidth = 3;
          rr(ctx, px - 11, g - 14 - ph, 22, ph, 6); ctx.stroke();
          ctx.fillStyle = '#c9c1d6';
          ctx.beginPath(); ctx.ellipse(px, g - 14 - ph, 15, 7, 0, 0, TAU); ctx.fill();
          if (ins.anim > 0.4) { // toot! smoke ring + note
            ctx.save();
            ctx.globalAlpha = ins.anim;
            ctx.strokeStyle = 'rgba(230,230,240,0.9)'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(px, g - 34 - ph - (1 - ins.anim) * 40, 10 + (1 - ins.anim) * 14, 0, TAU); ctx.stroke();
            ctx.restore();
          }
        }
        drawFace(ctx, ins.x, g - 70, 30, mood, t, 83);
      } else { // ENGINE-BLOCK BASS
        ctx.fillStyle = '#57536a';
        rr(ctx, ins.x - 62, g - 118, 124, 104, 12); ctx.fill();
        ctx.strokeStyle = '#3a3448'; ctx.lineWidth = 4;
        rr(ctx, ins.x - 62, g - 118, 124, 104, 12); ctx.stroke();
        // pistons pump with the groove once the bass has joined
        const pk = (ins.joined || this.state === 'done') && this.grooveOn() ? Math.abs(Math.sin(this.barT * TAU * 2)) : ins.anim;
        for (let k = 0; k < 3; k++) {
          const px = ins.x - 34 + k * 34;
          ctx.fillStyle = '#c9c1d6';
          rr(ctx, px - 9, g - 140 - (k % 2 ? pk : 1 - pk) * 16, 18, 34, 5); ctx.fill();
        }
        ctx.fillStyle = POW.power.c;
        ctx.beginPath(); ctx.arc(ins.x + 40, g - 98, 10 + pk * 3, 0, TAU); ctx.fill();
        drawFace(ctx, ins.x - 6, g - 64, 36, mood, t, 84);
      }
      ctx.restore();
      // progress lamps: 4 sockets over each instrument (its "join the band" meter)
      if (this.state === 'jam' || this.state === 'countin') {
        for (let k = 0; k < BB_LAMPS; k++) {
          const lx = ins.x - 33 + k * 22, ly = this.instrumentY(i) - 96;
          const on = this.lamps[i] > k;
          ctx.fillStyle = on ? '#ffe156' : 'rgba(30,24,44,0.55)';
          ctx.beginPath(); ctx.arc(lx, ly, 7.5, 0, TAU); ctx.fill();
          ctx.strokeStyle = on ? '#c8861b' : '#3a3448'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(lx, ly, 7.5, 0, TAU); ctx.stroke();
        }
      }
    }
    // the full-band jam meter: 6 gold stars over the whole stage
    if (this.state === 'jam' && this.stage >= 4) {
      for (let k = 0; k < BB_JAM; k++) {
        const on = this.jamHits > k;
        ctx.save();
        ctx.globalAlpha = on ? 1 : 0.35;
        ctx.fillStyle = on ? '#ffd24a' : '#fff';
        starPath(ctx, 415 + k * 52, 158, 17, 8, 5, -Math.PI / 2 + Math.sin(t * 3 + k) * 0.12);
        ctx.fill();
        if (on) { ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 2.5; ctx.stroke(); }
        ctx.restore();
      }
    }
  }
  drawCrew(ctx, t) {
    // three lug-nut pit-crew buddies stage right: they bounce with the groove,
    // go nuts on every hit, and one shrugs "?" on a miss — comedy, not blame
    const g = this.g;
    const wild = this.state === 'finale' || this.state === 'done';
    for (let i = 0; i < 3; i++) {
      const bx = this.doorK() > 0 ? 145 + i * 56 : 975 + i * 56; // they clear the whole stage for the truck
      const phase = t * (wild ? 9 : 4) + i * 1.4;
      const hop = (this.crewJump > 0 || wild ? Math.abs(Math.sin(phase)) * (wild ? 26 : 16) : Math.abs(Math.sin(phase)) * 4);
      const by = g - 24 - hop;
      const shrug = this.missT > 0 && i === 1;
      ctx.save();
      ctx.fillStyle = ['#e8482b', '#4a6cff', '#57d357'][i];
      ctx.beginPath(); ctx.arc(bx, by, 19, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(30,24,44,0.5)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(bx, by, 19, 0, TAU); ctx.stroke();
      // little cap
      ctx.fillStyle = '#ffb62b';
      ctx.beginPath(); ctx.arc(bx, by - 6, 15, Math.PI, TAU); ctx.fill();
      rr(ctx, bx + 6, by - 10, 14, 5, 2); ctx.fill();
      // arms: up cheering, or shrugging
      ctx.strokeStyle = '#3a2a3a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      const ay = shrug ? by - 4 : (this.crewJump > 0 || wild ? by - 22 : by + 8);
      ctx.beginPath();
      ctx.moveTo(bx - 16, by + 2); ctx.lineTo(bx - 26, ay);
      ctx.moveTo(bx + 16, by + 2); ctx.lineTo(bx + 26, ay);
      ctx.stroke();
      drawFace(ctx, bx, by + 3, 24, shrug ? 'surprised' : wild || this.crewJump > 0 ? 'grin' : 'happy', t, 90 + i);
      if (shrug) outlineText(ctx, '?', bx, by - 38, 30, '#ffe156', '#3a3448');
      ctx.restore();
    }
  }
}

// ================================================================ zombie town after dark
// Jack's own idea: Zombieland + the night sky + PEOPLE. Above Zombie Cave
// hides a small moonlit town waiting for the Midnight Zombie Festival — but
// four townspeople each have one small problem, told entirely in thought
// bubbles and body language. Four different verbs, one each:
//   granny  — stranded on her roof: bounce up the haystack, show her the way,
//             she leaps into the hay (WHEE) and trots to the square
//   kid     — balloon stuck high on the lamp post: climb the crates, knock it
//             loose, it tails the hero like a puppy — walk it back
//   scaredy — "terrified" of a tiny zombie in the alley; the zombie's bubble
//             shows CANDY: stand close and press ★ to spend one candy from
//             the counter — munch, hearts, instant best friends
//   carter  — festival cart missing its wheel; the wheel leans on the fence
//             down the street: touch it and it rolls itself home, KLUNK, and
//             the carter rides the cart into the square
// Every rescue visibly turns the town ON (windows, streetlights, bunting,
// zombie peekers). All four in the square = the clock tower arms: press ★ at
// midnight — BONG BONG BONG — and the ZOMBIE FESTIVAL erupts: zombies pour
// out to dance (one backward, one tiny with a huge hat), a skeleton plays
// trombone badly, a spider drums, fireworks fill the sky, the moon grins,
// and the golden star answers over the square. No enemies, no way to lose.
class ZombieTown {
  constructor(groundY) {
    this.g = groundY;
    this.t = rand(9);
    this.state = 'explore'; // -> 'ready' -> 'festival' -> 'done'
    this.revealDone = false;
    // physical bits the level adopts (all skipDraw — the town draws itself)
    this.solids = [
      // the problems and their answers live on OPPOSITE ends of town — the fun
      // is noticing something down the street and thinking "wait, THAT's it!"
      { x: 290, y: 462, w: 320, h: 20, oneWay: true, skipDraw: true, plat: true }, // granny's roof (290-610)
      { x: 710, y: 472, w: 270, h: 20, oneWay: true, skipDraw: true, plat: true }, // the shop roof next door (710-980)
      { x: 990, y: 576, w: 130, h: 44, oneWay: true, bouncy: true, bounceVy: -950, skipDraw: true }, // the haystack, PAST the shop (jump on = BOING, then rooftop-walk back to granny)
      { x: 2225, y: 572, w: 56, h: 48, skipDraw: true },  // crate step (by house C, way across town)
      { x: 2283, y: 524, w: 58, h: 96, skipDraw: true }   // crate stack
    ];
    // the cast (y = feet)
    this.npcs = [
      { kind: 'granny', x: 430, y: 462, facing: 1, state: 'need', target: 1640, bob: 0, lt: 0 },
      { kind: 'kid', x: 1300, y: groundY, facing: -1, state: 'need', target: 1730, bob: 0 },
      { kind: 'scaredy', x: 2600, y: groundY, facing: -1, state: 'need', target: 1890, bob: 0, rt: 0 },
      { kind: 'carter', x: 2780, y: groundY, facing: 1, state: 'need', target: 1975, bob: 0 }
    ];
    this.balloon = { x: 2372, y: 310, state: 'stuck', bobT: rand(9) }; // snagged on house C's chimney, a whole town away from the kid
    this.zombie = { x: 2480, y: groundY, state: 'waiting', facing: 1, bob: rand(9), bubbleT: 0, munchT: 0 };
    this.cart = { x: 2850, state: 'broken', bounce: 0, hopT: 0 };
    this.wheel = { x: 205, y: groundY, state: 'waiting', spin: 0 }; // wedged by the old well at the FAR end from the cart
    this.candyFly = null; // {t, x0, y0}
    this.festT = 0;
    this.fw = [];         // rising firework rockets {x, y0, targetY, t, hue}
    this.fwT = 0;
    this.shootT = rand(4, 8); this.shoot = null; // shooting stars {x, y, t}
    this.tromT = 2.2;     // the skeleton's next terrible trombone note
    this.wheeT = 0;
  }
  solvedCount() {
    return this.npcs.filter(n => n.state === 'walk' || n.state === 'square').length +
      (this.npcs[3].state === 'ride' ? 1 : 0);
  }
  lampsOn(i) { // streetlights come alive as the town does
    if (this.state === 'festival' || this.state === 'done') return true;
    return i < this.solvedCount() * 2;
  }
  solveGranny() {
    const gr = this.npcs[0];
    gr.state = 'leap'; gr.lt = 0;
    this.wheeT = 1.0;
    AudioSys.sfx('boing');
    if (game.player) game.player.setMood('grin', 1);
  }
  solveKid() {
    const kid = this.npcs[1];
    kid.state = 'walk';
    this.balloon.state = 'held';
    AudioSys.sfx('heart'); AudioSys.sfx('cheer');
    Particles.burst(kid.x, kid.y - 60, 12, { colors: ['#ff5fa2', '#ffe156', '#fff'], type: 'heart', sp1: 160, l1: 0.9, s1: 10, grav: -60 });
  }
  solveScaredy() {
    const sc = this.npcs[2];
    sc.state = 'relieved'; sc.rt = 0;
    this.zombie.state = 'munch'; this.zombie.munchT = 0;
    AudioSys.sfx('candy');
  }
  update(dt, pl) {
    this.t += dt;
    const g = this.g;
    if (!this.revealDone) { // one slow pan across the moonlit town first
      this.revealDone = true;
      game.cut = { name: 'townreveal', t: 0 };
      AudioSys.sfx('bells');
      return;
    }
    this.wheeT = Math.max(0, this.wheeT - dt);
    // ---- the four little problems ----
    const gr = this.npcs[0], kid = this.npcs[1], sc = this.npcs[2], ct = this.npcs[3];
    // granny: reached on her roof -> she trusts the haystack now
    if (gr.state === 'need' && Math.abs(pl.cx - gr.x) < 80 && pl.y + pl.h <= 482) this.solveGranny();
    if (gr.state === 'leap') { // one enormous cartoon arc, clear over the shop, into the hay
      gr.lt += dt;
      const k = Math.min(1, gr.lt / 1.1);
      gr.x = lerp(430, 1055, k);
      gr.y = lerp(462, 576, k) - Math.sin(k * Math.PI) * 150;
      gr.facing = 1;
      if (k >= 1) {
        gr.state = 'walk'; gr.y = g;
        AudioSys.sfx('poof'); AudioSys.sfx('cheer');
        Particles.burst(1055, 570, 16, { colors: ['#e8c56a', '#d9b04a'], type: 'block', sp1: 240, l1: 0.8, s1: 9, grav: 500, up: 160 });
      }
    }
    // balloon: bump it loose, it happily tails the hero; deliver it to the kid
    const b = this.balloon;
    b.bobT += dt;
    if (b.state === 'stuck' && Math.abs(pl.cx - b.x) < 42 && Math.abs(pl.y - b.y) < 52) {
      b.state = 'follow';
      AudioSys.sfx('collect');
      Particles.burst(b.x, b.y, 8, { colors: ['#ff5fa2', '#fff'], type: 'sparkle', sp1: 140, l1: 0.6, s1: 8 });
    }
    if (b.state === 'follow') {
      b.x += (pl.cx - pl.facing * 34 - b.x) * Math.min(1, 5 * dt);
      b.y += (pl.y - 34 - b.y) * Math.min(1, 5 * dt);
      if (kid.state === 'need' && Math.abs(b.x - kid.x) < 80 && Math.abs(pl.cx - kid.x) < 120) this.solveKid();
    }
    // scaredy + the tiny zombie: ★ next to the zombie spends one candy
    const z = this.zombie;
    z.bob += dt;
    z.bubbleT = Math.max(0, z.bubbleT - dt);
    if (sc.state === 'need' && z.state === 'waiting' && justP.Space && Math.abs(pl.cx - z.x) < 95 && pl.onGround) {
      if (game.candy > 0) {
        game.candy--;
        this.candyFly = { t: 0, x0: pl.cx, y0: pl.cy };
        AudioSys.sfx('candy');
      } else {
        z.bubbleT = 1.6; // the zombie holds up its candy wish EXTRA hopefully
        AudioSys.sfx('plop');
      }
    }
    if (this.candyFly) {
      this.candyFly.t += dt;
      if (this.candyFly.t >= 0.45) { this.candyFly = null; this.solveScaredy(); }
    }
    if (z.state === 'munch') {
      z.munchT += dt;
      if (z.munchT > 0.9) {
        z.state = 'friend';
        AudioSys.sfx('heart'); AudioSys.sfx('friend');
        Particles.burst(z.x, z.y - 40, 10, { colors: ['#ff5fa2', '#9fe07b', '#fff'], type: 'heart', sp1: 150, l1: 0.9, s1: 9, grav: -60 });
      }
    }
    if (sc.state === 'relieved') {
      sc.rt += dt;
      if (sc.rt > 0.9) sc.state = 'walk';
    }
    if (z.state === 'friend') { // the little buddy toddles after its new pal
      const tx = (sc.state === 'square' ? sc.x : sc.x) + 52;
      z.x += clamp(tx - z.x, -1, 1) * 150 * dt;
      z.facing = tx > z.x ? 1 : -1;
    }
    // the cart: the wheel is wedged by the well at the town's OTHER end.
    // ★ pops it loose — then it rolls itself the whole street home. KLUNK.
    const w = this.wheel, c = this.cart;
    if (w.state === 'waiting' && justP.Space && Math.abs(pl.cx - w.x) < 90 && pl.onGround) {
      w.state = 'rolling';
      AudioSys.sfx('switch'); AudioSys.sfx('boing');
      Particles.burst(w.x, g - 24, 10, { colors: ['#8a8a9a', '#6a5a4a'], type: 'block', sp1: 200, l1: 0.6, s1: 8, grav: 700, up: 120 });
      if (game.player) game.player.setMood('grin', 0.8);
    }
    if (w.state === 'rolling') {
      w.x += 420 * dt;
      w.spin += 420 * dt / 26;
      if (chance(0.3)) Particles.burst(w.x, g, 1, { colors: ['#6a5a4a'], sp1: 60, l1: 0.4, s1: 6, up: 30 });
      if (w.x >= c.x + 91) {
        w.state = 'attached'; w.x = c.x + 91;
        c.state = 'fixed'; c.bounce = 1; c.hopT = 0;
        AudioSys.sfx('thud'); AudioSys.sfx('boing'); AudioSys.sfx('cheer');
        game.shake = Math.max(game.shake, 0.15);
        Particles.burst(c.x + 40, g - 40, 12, { colors: ['#ffe156', '#fff'], type: 'star', sp1: 200, l1: 0.7, s1: 9 });
      }
    }
    c.bounce = Math.max(0, c.bounce - dt * 1.6);
    if (c.state === 'fixed') {
      c.hopT += dt;
      if (c.hopT > 0.8) { c.state = 'riding'; ct.state = 'ride'; AudioSys.sfx('rev'); }
    }
    if (c.state === 'riding') { // the carter rides it into the square. Obviously.
      c.x -= 180 * dt;
      w.spin += 180 * dt / 26;
      ct.x = c.x + 40; ct.facing = -1;
      if (chance(0.35)) Particles.burst(c.x + 90, g - 6, 1, { colors: ['#8a8a9a'], sp1: 50, l1: 0.5, s1: 8, up: 20 });
      if (c.x <= 1990) { c.x = 1990; c.state = 'parked'; ct.state = 'square'; ct.x = c.x + 40; AudioSys.sfx('checkpoint'); }
    }
    // ---- walkers head for the square; arrivals light the town up ----
    for (const n of this.npcs) {
      if (n.state === 'walk') {
        const d = Math.sign(n.target - n.x);
        n.x += d * 175 * dt; n.facing = d; n.bob += dt * 10;
        if (Math.abs(n.x - n.target) < 8) {
          n.state = 'square';
          AudioSys.sfx('collect');
          Particles.burst(n.x, n.y - 70, 8, { colors: ['#ffe156', '#fff'], type: 'star', sp1: 140, l1: 0.6, s1: 8 });
        }
      } else if (n.state === 'square') n.bob += dt * 6;
    }
    // ---- shooting stars keep the sky alive ----
    this.shootT -= dt;
    if (this.shootT <= 0) { this.shootT = rand(5, 9); this.shoot = { x: rand(200, 2800), y: rand(40, 170), t: 0 }; }
    if (this.shoot && (this.shoot.t += dt) > 0.7) this.shoot = null;
    // ---- all four gathered -> the clock tower arms for midnight ----
    if (this.state === 'explore' && this.npcs.every(n => n.state === 'square')) {
      this.state = 'ready';
      AudioSys.sfx('fanfare');
      Particles.burst(1800, 300, 16, { colors: ['#ffe156', '#e8ecff'], type: 'sparkle', sp1: 180, l1: 1, s1: 10 });
    }
    if (this.state === 'ready' && justP.Space && Math.abs(pl.cx - 1800) < 90 && !game.endPhase) {
      this.state = 'festival'; this.festT = 0;
      AudioSys.setMusic(''); // the town holds its breath...
    }
    // ---- MIDNIGHT ----
    if (this.state === 'festival' || this.state === 'done') {
      const prev = this.festT;
      this.festT += dt;
      const cue = (tt) => prev < tt && this.festT >= tt;
      for (const tt of [0.9, 1.7, 2.5]) {
        if (cue(tt)) { AudioSys.sfx('bong'); game.shake = Math.max(game.shake, 0.3); }
      }
      if (cue(2.5)) AudioSys.sfx('cheer'); // ...BONG! and the zombies pour out
      if (cue(3.2)) {
        AudioSys.setMusic('win');
        AudioSys.sfx('cheer'); AudioSys.sfx('fanfare');
        Particles.candyBurst(1800, 260, 16);
      }
      if (this.festT > 3.2) {
        // fireworks! rockets go up, sky-bursts come down
        this.fwT -= dt;
        if (this.fwT <= 0 && this.fw.length < 3) {
          this.fwT = rand(0.5, 0.95);
          this.fw.push({ x: rand(300, 2700), y0: g, targetY: rand(90, 260), t: 0, hue: randi(0, RAINBOW.length - 1) });
          AudioSys.sfx('firework');
        }
        if (chance(0.12)) Particles.candyBurst(game.cam.x + rand(150, W - 150), game.cam.y + rand(60, 200), 1);
        // the skeleton keeps playing the trombone. Badly.
        this.tromT -= dt;
        if (this.tromT <= 0) { this.tromT = rand(2.4, 3.6); AudioSys.sfx('hornflat'); }
      }
      for (const f of this.fw) {
        f.t += dt;
        if (!f.burst && f.t >= 0.5) {
          f.burst = true;
          Particles.burst(f.x, f.targetY, 22, { colors: [RAINBOW[f.hue], '#fff', '#ffe156'], type: 'star', sp1: 340, l0: 0.7, l1: 1.4, s1: 11, grav: 60, up: 0 });
        }
      }
      this.fw = this.fw.filter(f => f.t < 0.8);
      if (cue(6.8)) { // the golden star answers over the square
        game.level.goalStar = { x: 1800, y: 470 };
        Particles.burst(1800, 470, 24, { colors: ['#ffd24a', '#ffe156', '#fff'], type: 'star', sp1: 320, l1: 1, s1: 12, grav: 120 });
        AudioSys.sfx('chest');
        this.state = 'done';
      }
    }
  }
  lights() { return []; }
  // ---------------------------------------------------------------- drawing
  festive() { return this.state === 'festival' || this.state === 'done'; }
  drawBack(ctx, t) {
    const g = this.g, lw = 3000;
    // the night sky — the star (ha) of the show
    const sky = ctx.createLinearGradient(0, 0, 0, g);
    sky.addColorStop(0, '#0d0b2a'); sky.addColorStop(0.62, '#2a2150'); sky.addColorStop(1, '#453a72');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, lw, g);
    // layered twinkling stars
    for (let i = 0; i < 110; i++) {
      const sx = hash2(i, 5) * lw, sy = hash2(i, 11) * 330;
      const big = hash2(i, 17) > 0.8;
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.55 * Math.abs(Math.sin(t * (big ? 1.6 : 0.9) + i));
      ctx.fillStyle = big ? '#fff' : '#cfd4ff';
      if (big) { starPath(ctx, sx, sy, 4.5, 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(sx, sy, 1.6, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    // a shooting star now and then
    if (this.shoot) {
      const s = this.shoot, k = s.t / 0.7;
      ctx.save();
      ctx.globalAlpha = Math.sin(k * Math.PI);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x + k * 260, s.y + k * 90);
      ctx.lineTo(s.x + k * 260 - 60, s.y + k * 90 - 21);
      ctx.stroke();
      ctx.restore();
    }
    // THE MOON — huge, cratered, occasionally smug (festival only)
    const mx = 1020, my = 150, mr = 92;
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#f4f0d8';
    ctx.beginPath(); ctx.arc(mx, my, mr + 34, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#f4f0d8';
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ddd8bc';
    for (const [ox, oy, r2] of [[-30, -20, 16], [24, 12, 12], [-4, 38, 9], [38, -36, 8]]) {
      ctx.beginPath(); ctx.arc(mx + ox, my + oy, r2, 0, TAU); ctx.fill();
    }
    if (this.festive() && (t % 7) < 2.2) drawFace(ctx, mx, my + 6, mr * 0.9, 'grin', t, 99);
    // night clouds drifting across the moon
    ctx.fillStyle = 'rgba(58,47,102,0.85)';
    for (let i = 0; i < 2; i++) {
      const cxx = ((t * (10 + i * 6) + i * 900) % (lw + 420)) - 210;
      const cyy = 110 + i * 70;
      ctx.beginPath();
      ctx.arc(cxx, cyy, 34, 0, TAU); ctx.arc(cxx + 38, cyy + 8, 26, 0, TAU); ctx.arc(cxx - 36, cyy + 9, 24, 0, TAU);
      ctx.fill();
    }
    // distant rooftop silhouettes on the horizon
    ctx.fillStyle = '#1c1638';
    for (let i = 0; i < 14; i++) {
      const bx = i * 220 + hash2(i, 23) * 90, bw = 130 + hash2(i, 29) * 80, bh = 90 + hash2(i, 31) * 110;
      ctx.fillRect(bx, g - 160 - bh, bw, bh + 160);
      ctx.beginPath();
      ctx.moveTo(bx - 8, g - 160 - bh); ctx.lineTo(bx + bw / 2, g - 195 - bh); ctx.lineTo(bx + bw + 8, g - 160 - bh);
      ctx.closePath(); ctx.fill();
      if (this.solvedCount() > 0 && hash2(i, 37) < this.solvedCount() * 0.22) { // far windows wake up too
        ctx.fillStyle = 'rgba(255,225,86,0.5)';
        ctx.fillRect(bx + bw * 0.3, g - 120 - bh, 12, 14);
        ctx.fillStyle = '#1c1638';
      }
    }
    // the houses of Zombie Town
    this.drawHouse(ctx, t, 300, 290, 150, 0, this.npcs[0].state !== 'need'); // granny's (her roof is the solid)
    this.drawHouse(ctx, t, 720, 250, 130, 1, this.solvedCount() >= 2); // the shop (its roof is the walkway back)
    this.drawHouse(ctx, t, 2180, 220, 140, 2, this.solvedCount() >= 3);
    this.drawHouse(ctx, t, 2490, 180, 120, 3, this.solvedCount() >= 1);
    // festival zombie peekers appear in doorways as the town wakes up
    if (this.solvedCount() >= 2 && !this.festive()) this.drawTinyZombie(ctx, t, 762, this.g, 1, 'happy', 0.8);
    if (this.solvedCount() >= 3 && !this.festive()) this.drawTinyZombie(ctx, t, 2222, this.g, -1, 'happy', 0.8);
    // the well Jack climbed out of (with the ladder still poking out)
    ctx.fillStyle = '#5f6070';
    rr(ctx, 40, g - 54, 76, 54, 8); ctx.fill();
    ctx.fillStyle = '#1c1430';
    ctx.beginPath(); ctx.ellipse(78, g - 52, 30, 10, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#d9b98a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(66, g - 50); ctx.lineTo(66, g - 92); ctx.moveTo(90, g - 50); ctx.lineTo(90, g - 92);
    ctx.moveTo(66, g - 62); ctx.lineTo(90, g - 62); ctx.moveTo(66, g - 80); ctx.lineTo(90, g - 80);
    ctx.stroke();
    // streetlights (they come on as the town comes alive)
    [240, 1180, 1450, 2130, 2450, 2900].forEach((lx, i) => this.drawLamp(ctx, t, lx, this.lampsOn(i)));
    // wooden fences filling the street gaps
    ctx.strokeStyle = '#4a3e5c'; ctx.lineWidth = 5;
    for (const [fx0, fx1] of [[618, 702], [1970, 2130], [2680, 2990]]) {
      for (let fx = fx0; fx < fx1; fx += 26) {
        ctx.beginPath(); ctx.moveTo(fx, g); ctx.lineTo(fx, g - 44); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(fx0 - 4, g - 34); ctx.lineTo(fx1, g - 34); ctx.stroke();
    }
    // the town square: bunting + the clock tower
    this.drawBunting(ctx, t, 1520, 1760, 330);
    this.drawBunting(ctx, t, 1840, 2080, 330);
    this.drawTower(ctx, t);
  }
  drawHouse(ctx, t, x, w, h, style, lit) {
    const g = this.g;
    const wall = ['#6a5a86', '#5a6a8e', '#7a5a76', '#5f6a70'][style % 4];
    const roof = ['#3a3050', '#32405e', '#4a3450', '#3a444a'][style % 4];
    ctx.fillStyle = wall;
    rr(ctx, x, g - h, w, h, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(20,14,40,0.5)'; ctx.lineWidth = 3;
    rr(ctx, x, g - h, w, h, 6); ctx.stroke();
    // roof
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x - 14, g - h); ctx.lineTo(x + w / 2, g - h - 46); ctx.lineTo(x + w + 14, g - h);
    ctx.closePath(); ctx.fill();
    // chimney (with a lazy smoke puff once the house is awake)
    ctx.fillStyle = roof;
    rr(ctx, x + w - 52, g - h - 62, 22, 40, 4); ctx.fill();
    if (lit && chance(0.02)) Particles.burst(x + w - 41, g - h - 66, 1, { color: 'rgba(200,200,215,0.4)', sp1: 15, grav: -60, l0: 1.4, l1: 2.4, s1: 10, up: 0 });
    // door + windows: dark and sleepy, or warm and awake
    ctx.fillStyle = '#3a3050';
    rr(ctx, x + 22, g - 62, 40, 62, 6); ctx.fill();
    for (const wx of [x + w * 0.42, x + w * 0.72]) {
      ctx.fillStyle = lit ? '#ffe156' : '#241c40';
      rr(ctx, wx, g - h + 26, 34, 30, 5); ctx.fill();
      ctx.strokeStyle = lit ? '#c8861b' : '#3a3050'; ctx.lineWidth = 3;
      rr(ctx, wx, g - h + 26, 34, 30, 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wx + 17, g - h + 26); ctx.lineTo(wx + 17, g - h + 56); ctx.stroke();
      if (lit) {
        ctx.save();
        ctx.globalAlpha = 0.2 + 0.08 * Math.sin(t * 3 + wx);
        ctx.fillStyle = '#ffe156';
        rr(ctx, wx - 5, g - h + 21, 44, 40, 8); ctx.fill();
        ctx.restore();
      }
    }
    if (style === 1) { // the shop gets a striped awning
      ctx.fillStyle = '#c9566a';
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 ? '#c9566a' : '#e8e4f4';
        ctx.beginPath();
        ctx.moveTo(x + 20 + i * 32, g - 74); ctx.lineTo(x + 52 + i * 32, g - 74);
        ctx.lineTo(x + 46 + i * 32, g - 58); ctx.lineTo(x + 26 + i * 32, g - 58);
        ctx.closePath(); ctx.fill();
      }
    }
  }
  drawLamp(ctx, t, x, on, arm) {
    const g = this.g;
    ctx.strokeStyle = '#2e2440'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, g); ctx.lineTo(x, g - 200); ctx.stroke();
    let hx = x;
    if (arm) { // curved arm hanging over the street (the balloon trap)
      ctx.beginPath(); ctx.moveTo(x, g - 200); ctx.quadraticCurveTo(x - 10, g - 226, x - 34, g - 222); ctx.stroke();
      hx = x - 38;
    }
    const hy = arm ? g - 214 : g - 208;
    ctx.fillStyle = on ? '#ffe156' : '#3a3050';
    ctx.beginPath(); ctx.arc(hx, hy, 13, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2e2440'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(hx, hy, 13, 0, TAU); ctx.stroke();
    if (on) {
      ctx.save();
      ctx.globalAlpha = 0.16 + 0.05 * Math.sin(t * 4 + x);
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(hx, hy, 46, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  drawBunting(ctx, t, x0, x1, y) {
    const n = Math.floor((x1 - x0) / 34);
    const fest = this.festive();
    ctx.strokeStyle = 'rgba(233,228,244,0.5)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y + 26, x1, y); ctx.stroke();
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const fx = lerp(x0, x1, k), fy = y + Math.sin(k * Math.PI) * 24 + (fest ? Math.sin(t * 5 + i) * 4 : 0);
      ctx.fillStyle = fest || i < this.solvedCount() * 2 ? RAINBOW[i % RAINBOW.length] : 'rgba(138,127,174,0.5)';
      ctx.beginPath();
      ctx.moveTo(fx - 9, fy); ctx.lineTo(fx + 9, fy); ctx.lineTo(fx, fy + 17);
      ctx.closePath(); ctx.fill();
    }
  }
  drawTower(ctx, t) {
    const g = this.g, x = 1800;
    const fest = this.festive();
    const midnight = fest && this.festT > 0.9;
    // body
    ctx.fillStyle = '#564a7c';
    rr(ctx, x - 46, 210, 92, g - 210, 8); ctx.fill();
    ctx.strokeStyle = '#2e2440'; ctx.lineWidth = 4;
    rr(ctx, x - 46, 210, 92, g - 210, 8); ctx.stroke();
    ctx.fillStyle = '#3a3050';
    rr(ctx, x - 24, g - 74, 48, 74, 6); ctx.fill(); // tower door
    // pointy roof + the bell arch
    ctx.fillStyle = '#3a3050';
    ctx.beginPath(); ctx.moveTo(x - 58, 210); ctx.lineTo(x, 148); ctx.lineTo(x + 58, 210); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd24a';
    const swing = fest && this.festT < 3.4 ? Math.sin(this.festT * 12) * 0.5 : 0;
    ctx.save();
    ctx.translate(x, 182); ctx.rotate(swing);
    ctx.beginPath(); ctx.arc(0, 6, 12, Math.PI * 0.15, Math.PI * 0.85, true); ctx.lineTo(0, -8); ctx.closePath(); ctx.fill();
    ctx.restore();
    // the clock face: five-to-midnight... until it ISN'T
    ctx.fillStyle = '#f4f0d8';
    ctx.beginPath(); ctx.arc(x, 290, 46, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2e2440'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, 290, 46, 0, TAU); ctx.stroke();
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    const minA = midnight ? -Math.PI / 2 : -Math.PI / 2 - 0.5; // the minute hand sweeps to 12
    ctx.beginPath(); ctx.moveTo(x, 290); ctx.lineTo(x + Math.cos(-Math.PI / 2) * 22, 290 + Math.sin(-Math.PI / 2) * 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, 290); ctx.lineTo(x + Math.cos(minA) * 36, 290 + Math.sin(minA) * 36); ctx.stroke();
    if (this.state === 'ready') { // armed: the whole face glows "it's TIME"
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 4);
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(x, 290, 62, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  draw(ctx, t) {
    const g = this.g;
    // haystack + crates (their solids are invisible; these are the real looks)
    ctx.fillStyle = '#e8c56a';
    ctx.beginPath(); ctx.ellipse(1055, g - 22, 68, 40, 0, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = '#c9a13e'; ctx.lineWidth = 3;
    for (const [ox, oy] of [[-30, -18], [4, -30], [32, -14]]) {
      ctx.beginPath(); ctx.moveTo(1055 + ox, g + oy); ctx.lineTo(1055 + ox + 12, g + oy - 10); ctx.stroke();
    }
    for (const cr of [this.solids[3], this.solids[4]]) { // the crates, straight from their solids
      ctx.fillStyle = '#8a6a4a';
      rr(ctx, cr.x, cr.y, cr.w, cr.h, 5); ctx.fill();
      ctx.strokeStyle = '#5f4a30'; ctx.lineWidth = 3;
      rr(ctx, cr.x, cr.y, cr.w, cr.h, 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cr.x, cr.y); ctx.lineTo(cr.x + cr.w, cr.y + cr.h); ctx.stroke();
    }
    // the cast
    for (const n of this.npcs) this.drawNpc(ctx, t, n);
    this.drawTinyZombie(ctx, t, this.zombie.x, this.zombie.y, this.zombie.facing,
      this.zombie.state === 'munch' ? 'grin' : this.zombie.state === 'friend' ? 'happy' : 'sad',
      1, this.festive());
    // the tiny zombie's candy wish (its whole problem, told wordlessly)
    if (this.zombie.state === 'waiting') {
      const big = this.zombie.bubbleT > 0 ? 1.35 : 1;
      this.drawBubble(ctx, this.zombie.x + 8, this.zombie.y - 74, big, (bx, by) => drawCandy(ctx, bx, by + 2, 13 * big, 1, t));
    }
    this.drawBalloon(ctx, t);
    this.drawCart(ctx, t);
    // the runaway wheel, wedged by the well (★ pops it loose, then it rolls home)
    const w = this.wheel;
    if (w.state === 'waiting' || w.state === 'rolling') {
      const near = game.player && Math.abs(game.player.cx - w.x) < 120;
      ctx.save();
      ctx.translate(w.x, g - 26);
      if (w.state === 'waiting') {
        ctx.rotate(0.12 + (near ? Math.sin(t * 18) * 0.06 : 0)); // it strains against the rocks
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 3); // "psst, over here"
        ctx.fillStyle = '#ffe156';
        ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.fill();
        ctx.restore();
      }
      this.drawWheelShape(ctx, 0, 0, w.spin);
      ctx.restore();
      if (w.state === 'waiting') {
        ctx.fillStyle = '#5f6070'; // the wedge rocks
        ctx.beginPath(); ctx.ellipse(w.x - 24, g - 8, 13, 9, -0.3, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w.x + 22, g - 7, 11, 8, 0.3, 0, TAU); ctx.fill();
        if (near) drawSpacebar(ctx, w.x, g - 108, 92, t); // the game's usual wordless nudge
      }
    }
    if (this.candyFly) { // one candy, airmail
      const k = this.candyFly.t / 0.45;
      const fx = lerp(this.candyFly.x0, this.zombie.x, k);
      const fy = lerp(this.candyFly.y0, this.zombie.y - 30, k) - Math.sin(k * Math.PI) * 90;
      drawCandy(ctx, fx, fy, 14, 1, t);
    }
    if (this.wheeT > 0) outlineText(ctx, 'WHEE!', this.npcs[0].x, this.npcs[0].y - 90, 38, '#ffe156', '#2a2150');
    // ★-hint over the armed clock tower when the hero is close
    if (this.state === 'ready' && game.player && Math.abs(game.player.cx - 1800) < 260) {
      drawSpacebar(ctx, 1800, 392, 120, t);
    }
    if (this.festive()) this.drawFestival(ctx, t);
    // rising firework rockets
    for (const f of this.fw) {
      const k = Math.min(1, f.t / 0.5);
      ctx.save();
      ctx.globalAlpha = 1 - k * 0.4;
      ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      const fy = lerp(f.y0, f.targetY, k * k * (2 - k));
      ctx.beginPath(); ctx.moveTo(f.x, fy + 26); ctx.lineTo(f.x, fy); ctx.stroke();
      ctx.restore();
    }
  }
  drawNpc(ctx, t, n) {
    const dancing = n.state === 'square' && this.festive();
    const walking = n.state === 'walk' || n.state === 'ride';
    const hop = dancing ? Math.abs(Math.sin(t * 6 + n.target)) * 12 : walking ? Math.abs(Math.sin(n.bob)) * 5 : 0;
    if (n.kind === 'carter' && (n.state === 'ride' || (n.state === 'square' && this.cart.state === 'parked'))) {
      return; // he's ON the cart — drawCart draws him riding his masterpiece
    }
    const mood = n.state === 'need' ? (n.kind === 'kid' ? 'sad' : n.kind === 'scaredy' ? 'surprised' : 'surprised')
      : dancing ? 'grin' : 'happy';
    this.drawPerson(ctx, t, n.x, n.y - hop, n.kind, mood, n.facing);
    // wordless problem bubbles
    if (n.state === 'need') {
      if (n.kind === 'granny') this.drawBubble(ctx, n.x + 10, n.y - 118, 1, (bx, by) => {
        ctx.fillStyle = '#5a4a86'; // "I want DOWN"
        ctx.beginPath(); ctx.moveTo(bx, by + 12); ctx.lineTo(bx - 10, by - 2); ctx.lineTo(bx - 4, by - 2);
        ctx.lineTo(bx - 4, by - 12); ctx.lineTo(bx + 4, by - 12); ctx.lineTo(bx + 4, by - 2); ctx.lineTo(bx + 10, by - 2);
        ctx.closePath(); ctx.fill();
      });
      if (n.kind === 'kid') this.drawBubble(ctx, n.x + 10, n.y - 108, 1, (bx, by) => {
        ctx.fillStyle = '#ff5fa2';
        ctx.beginPath(); ctx.ellipse(bx, by - 3, 9, 11, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#5a4a86'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(bx, by + 8); ctx.quadraticCurveTo(bx + 4, by + 12, bx, by + 15); ctx.stroke();
      });
      if (n.kind === 'scaredy') this.drawBubble(ctx, n.x + 12, n.y - 112, 1, (bx, by) => {
        this.drawTinyZombie(ctx, t, bx - 4, by + 14, 1, 'happy', 0.42, false);
        outlineText(ctx, '!', bx + 13, by - 4, 22, '#ff5a5a', '#fff');
      });
      if (n.kind === 'carter') this.drawBubble(ctx, n.x + 10, n.y - 112, 1, (bx, by) => {
        ctx.strokeStyle = '#5a4a86'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(bx, by, 11, 0, TAU); ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2 + 0.4;
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a) * 10, by + Math.sin(a) * 10); ctx.stroke();
        }
      });
    }
    if (n.kind === 'scaredy' && n.state === 'relieved') {
      heartPath(ctx, n.x + 8, n.y - 110 - n.rt * 20, 12);
      ctx.fillStyle = '#ff5fa2'; ctx.fill();
    }
    // the kid keeps the balloon forever after
    if (n.kind === 'kid' && this.balloon.state === 'held') {
      const bx = n.x + n.facing * 14, by = n.y - 124 - Math.sin(t * 2) * 5;
      ctx.strokeStyle = 'rgba(233,228,244,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(n.x + n.facing * 8, n.y - 40); ctx.quadraticCurveTo(bx - 4, by + 30, bx, by + 16); ctx.stroke();
      ctx.fillStyle = '#ff5fa2';
      ctx.beginPath(); ctx.ellipse(bx, by, 13, 16, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(bx - 4, by - 5, 4, 0, TAU); ctx.fill();
    }
  }
  drawPerson(ctx, t, x, y, kind, mood, facing) { // y = feet
    ctx.save();
    const skin = { granny: '#ffdfc0', kid: '#e8b98a', scaredy: '#ffcf9f', carter: '#d9a066' }[kind];
    const shirt = { granny: '#b06cf0', kid: '#57d357', scaredy: '#4a6cff', carter: '#c9566a' }[kind];
    const short = kind === 'kid';
    const bh = short ? 46 : 62; // body height
    const tremble = kind === 'scaredy' && mood === 'surprised' ? Math.sin(t * 30) * 1.5 : 0;
    ctx.translate(x + tremble, y);
    // legs
    ctx.strokeStyle = '#3a3050'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-7, -18); ctx.lineTo(-8, 0); ctx.moveTo(7, -18); ctx.lineTo(8, 0); ctx.stroke();
    // body
    ctx.fillStyle = shirt;
    rr(ctx, -14, -bh, 28, bh - 14, 9); ctx.fill();
    // arms (granny-on-roof waves for help; scaredy covers his face-ish)
    ctx.strokeStyle = skin; ctx.lineWidth = 6;
    const wave = mood === 'surprised' && kind === 'granny' ? Math.sin(t * 9) * 14 : 0;
    ctx.beginPath();
    ctx.moveTo(-13, -bh + 12); ctx.lineTo(-22, -bh + 24 - wave);
    ctx.moveTo(13, -bh + 12); ctx.lineTo(22, -bh + 24 - wave);
    ctx.stroke();
    // head
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, -bh - 10, 15, 0, TAU); ctx.fill();
    // hair / hats — instant identity at a distance
    if (kind === 'granny') {
      ctx.fillStyle = '#e8e4f4';
      ctx.beginPath(); ctx.arc(0, -bh - 18, 12, Math.PI, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -bh - 28, 7, 0, TAU); ctx.fill(); // the bun
      ctx.strokeStyle = '#5a4a86'; ctx.lineWidth = 2.5; // little glasses
      ctx.beginPath(); ctx.arc(-6, -bh - 11, 4.5, 0, TAU); ctx.arc(6, -bh - 11, 4.5, 0, TAU); ctx.stroke();
    } else if (kind === 'kid') {
      ctx.fillStyle = '#ff9f43'; // propeller beanie, obviously
      ctx.beginPath(); ctx.arc(0, -bh - 14, 14, Math.PI, TAU); ctx.fill();
      ctx.strokeStyle = '#5a4a86'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -bh - 27); ctx.lineTo(0, -bh - 33); ctx.stroke();
      ctx.fillStyle = '#57d357';
      ctx.save();
      ctx.translate(0, -bh - 33); ctx.scale(Math.sin(t * 10), 1);
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 3, 0, 0, TAU); ctx.fill();
      ctx.restore();
    } else if (kind === 'scaredy') {
      ctx.fillStyle = '#3a3050'; // a very respectable bowler hat
      ctx.beginPath(); ctx.ellipse(0, -bh - 20, 16, 5, 0, 0, TAU); ctx.fill();
      rr(ctx, -10, -bh - 34, 20, 16, 5); ctx.fill();
      ctx.fillStyle = '#8a6a4a'; // and a tidy mustache
      ctx.beginPath(); ctx.ellipse(-5, -bh - 4, 5, 2.5, -0.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(5, -bh - 4, 5, 2.5, 0.2, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = '#ffb62b'; // work cap
      ctx.beginPath(); ctx.arc(0, -bh - 13, 14.5, Math.PI, TAU); ctx.fill();
      rr(ctx, facing > 0 ? 2 : -18, -bh - 17, 16, 6, 3); ctx.fill();
    }
    drawFace(ctx, 0, -bh - 8, 22, mood, t, x * 0.13, facing, 0);
    ctx.restore();
  }
  drawTinyZombie(ctx, t, x, y, facing, mood, s = 1, hugeHat = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const bob = Math.sin(t * 5 + x) * 2;
    // little green shuffler, arms out front (it's polite)
    ctx.fillStyle = '#7fbf6a';
    rr(ctx, -13, -34 + bob, 26, 30, 8); ctx.fill();
    ctx.strokeStyle = '#4a7a3c'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(facing * 8, -24 + bob); ctx.lineTo(facing * 24, -22 + bob + Math.sin(t * 4) * 3);
    ctx.moveTo(facing * 6, -18 + bob); ctx.lineTo(facing * 20, -15 + bob + Math.sin(t * 4 + 1) * 3);
    ctx.stroke();
    ctx.fillStyle = '#8fd07a';
    ctx.beginPath(); ctx.arc(0, -42 + bob, 13, 0, TAU); ctx.fill();
    // one cute stitch
    ctx.strokeStyle = '#4a7a3c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-9, -50 + bob); ctx.lineTo(-2, -47 + bob); ctx.stroke();
    if (hugeHat) { // festival outfit: a hat three sizes too big
      ctx.fillStyle = '#b06cf0';
      ctx.beginPath(); ctx.ellipse(0, -52 + bob, 26, 7, 0, 0, TAU); ctx.fill();
      rr(ctx, -14, -78 + bob, 28, 27, 6); ctx.fill();
      ctx.fillStyle = '#ffe156';
      rr(ctx, -14, -60 + bob, 28, 6, 2); ctx.fill();
    }
    drawFace(ctx, 0, -40 + bob, 18, mood, t, x * 0.31, facing, 0);
    ctx.restore();
  }
  drawBubble(ctx, x, y, s, iconFn) {
    ctx.save();
    const bw = 52 * s, bh2 = 44 * s;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.beginPath(); ctx.arc(x - 12, y + bh2 / 2 + 9, 4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 7, y + bh2 / 2 + 2, 6, 0, TAU); ctx.fill();
    rr(ctx, x - bw / 2, y - bh2 / 2, bw, bh2, 14); ctx.fill();
    ctx.strokeStyle = '#8a7fae'; ctx.lineWidth = 3;
    rr(ctx, x - bw / 2, y - bh2 / 2, bw, bh2, 14); ctx.stroke();
    iconFn(x, y);
    ctx.restore();
  }
  drawBalloon(ctx, t) {
    const b = this.balloon;
    if (b.state === 'held') return; // the kid draws it now
    const bx = b.x + (b.state === 'stuck' ? Math.sin(b.bobT * 1.8) * 4 : 0);
    const by = b.y + (b.state === 'stuck' ? Math.sin(b.bobT * 2.3) * 3 : 0);
    ctx.strokeStyle = 'rgba(233,228,244,0.8)'; ctx.lineWidth = 2;
    if (b.state === 'stuck') { // its string is snagged on house C's chimney
      ctx.beginPath(); ctx.moveTo(bx, by + 18); ctx.quadraticCurveTo(bx - 14, (by + 424) / 2, 2359, 424); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(bx, by + 18); ctx.quadraticCurveTo(bx + 5, by + 34, bx - 2, by + 46); ctx.stroke();
    }
    ctx.fillStyle = '#ff5fa2';
    ctx.beginPath(); ctx.ellipse(bx, by, 16, 19, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#c93e78'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(bx, by, 16, 19, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(bx - 5, by - 6, 5, 0, TAU); ctx.fill();
    drawFace(ctx, bx, by + 2, 16, b.state === 'follow' ? 'grin' : 'sad', t, 71);
  }
  drawCart(ctx, t) {
    const c = this.cart, g = this.g;
    const broken = c.state === 'broken';
    const bounce = Math.sin(c.bounce * 14) * 5 * c.bounce;
    ctx.save();
    ctx.translate(c.x + 55, g - 26 + bounce);
    if (broken) ctx.rotate(-0.16); // slumped on its missing corner
    // bed + rails
    ctx.fillStyle = '#8a6a4a';
    rr(ctx, -58, -26, 116, 26, 6); ctx.fill();
    ctx.strokeStyle = '#5f4a30'; ctx.lineWidth = 3;
    rr(ctx, -58, -26, 116, 26, 6); ctx.stroke();
    ctx.fillStyle = '#a8845e';
    rr(ctx, -58, -44, 10, 20, 3); ctx.fill();
    rr(ctx, 48, -44, 10, 20, 3); ctx.fill();
    // festival cargo: a big drum and a flag
    ctx.fillStyle = '#c9566a';
    rr(ctx, -34, -52, 34, 28, 6); ctx.fill();
    ctx.strokeStyle = '#ffe156'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-34, -38); ctx.lineTo(0, -38); ctx.stroke();
    ctx.strokeStyle = '#5f4a30'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(24, -44); ctx.lineTo(24, -82); ctx.stroke();
    ctx.fillStyle = this.festive() ? RAINBOW[Math.floor(t * 4) % RAINBOW.length] : '#9fe07b';
    ctx.beginPath(); ctx.moveTo(24, -82); ctx.lineTo(48, -74); ctx.lineTo(24, -66); ctx.closePath(); ctx.fill();
    // good wheel (left)
    this.drawWheelShape(ctx, -38, 12, this.wheel.spin * 0.5);
    // right corner: the poor propped stick, or the reunited wheel
    if (c.state === 'broken') {
      ctx.strokeStyle = '#5f4a30'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(38, 0); ctx.lineTo(46, 22); ctx.stroke();
    } else {
      this.drawWheelShape(ctx, 38, 12, this.wheel.spin);
    }
    // the carter rides his fixed masterpiece (and stays on it at the square)
    if (c.state === 'riding' || c.state === 'parked') {
      const ct2 = this.npcs[3];
      const dance = this.festive() ? Math.abs(Math.sin(t * 6)) * 8 : 0;
      this.drawPerson(ctx, t, 0, -26 - dance, 'carter', this.festive() ? 'grin' : 'happy', ct2.facing);
    }
    ctx.restore();
  }
  drawWheelShape(ctx, x, y, spin) {
    ctx.fillStyle = '#5f4a30';
    ctx.beginPath(); ctx.arc(x, y, 24, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a6a4a';
    ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#5f4a30'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = spin + i * Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * 16, y - Math.sin(a) * 16);
      ctx.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16);
      ctx.stroke();
    }
    ctx.fillStyle = '#e8c56a';
    ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
  }
  drawFestival(ctx, t) {
    const g = this.g;
    // the runaway wheel still leaning on the fence pre-solve is long gone;
    // now: the conga line, the trombone skeleton, the spider drummer
    if (this.festT > 2.5) {
      // zombie conga line sweeps the square; #2 dances facing the WRONG WAY
      for (let i = 0; i < 5; i++) {
        const k = ((t * 60 + i * 95) % 760) / 760;
        const zx = 1480 + k * 560;
        const backward = i === 2;
        this.drawTinyZombie(ctx, t + i, zx, g, backward ? -1 : 1, 'grin', i === 4 ? 0.7 : 1, i === 4);
      }
      // skeleton on trombone (he is trying his best)
      this.drawSkeleton(ctx, t, 1565, g);
      // spider drummer, borrowed from the cave downstairs
      this.drawSpiderDrummer(ctx, t, 2052, g);
    }
  }
  drawSkeleton(ctx, t, x, y) {
    const puff = Math.max(0, Math.sin(t * 2.2)); // cheeks when a note is due-ish
    const sway = Math.sin(t * 3) * 0.08;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sway);
    // classic skeleton costume: black body, white rib stripes (reads at night)
    ctx.fillStyle = '#241c40';
    rr(ctx, -15, -66, 30, 50, 9); ctx.fill();
    ctx.strokeStyle = '#f4f0e8'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    for (const ry of [-54, -43, -32]) { ctx.beginPath(); ctx.moveTo(-9, ry); ctx.lineTo(9, ry); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, -58); ctx.lineTo(0, -28); ctx.stroke(); // the sternum
    // bony arms up holding the horn
    ctx.beginPath(); ctx.moveTo(-13, -52); ctx.lineTo(-24, -66); ctx.moveTo(13, -52); ctx.lineTo(20, -70); ctx.stroke();
    // big white skull with proper dark sockets
    ctx.fillStyle = '#f4f0e8';
    ctx.beginPath(); ctx.arc(0, -82, 17, 0, TAU); ctx.fill();
    rr(ctx, -8, -72, 16, 9, 4); ctx.fill(); // the jaw
    ctx.fillStyle = '#241c40';
    ctx.beginPath(); ctx.arc(-6, -84, 4.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -84, 4.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#241c40'; ctx.lineWidth = 2;
    for (const jx of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(jx, -71); ctx.lineTo(jx, -66); ctx.stroke(); }
    // the trombone: angled tube + flared bell, slide flailing with enthusiasm
    const slide = 20 + Math.sin(t * 7) * 13;
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(4, -76); ctx.lineTo(24 + slide, -66); ctx.stroke();
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.moveTo(24 + slide, -66);
    ctx.lineTo(38 + slide, -78); ctx.lineTo(42 + slide, -58);
    ctx.closePath(); ctx.fill();
    if (puff > 0.85) { // a visibly sour note escapes the bell
      ctx.save();
      ctx.globalAlpha = 0.85;
      outlineText(ctx, '♪', 48 + slide, -92 + Math.sin(t * 9) * 6, 28, '#9fe07b', '#2a2150');
      ctx.restore();
    }
    ctx.restore();
  }
  drawSpiderDrummer(ctx, t, x, y) {
    ctx.save();
    ctx.translate(x, y);
    // drum
    ctx.fillStyle = '#c9566a';
    rr(ctx, -22, -30, 44, 30, 6); ctx.fill();
    ctx.fillStyle = '#f4f0d8';
    ctx.beginPath(); ctx.ellipse(0, -30, 22, 7, 0, 0, TAU); ctx.fill();
    // the spider (a friendly cave local)
    ctx.fillStyle = '#8a5fd0';
    ctx.beginPath(); ctx.arc(0, -56, 16, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6a3fa8'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    for (const sd of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(sd * 12, -54 + i * 3);
        ctx.lineTo(sd * (24 + i * 4), -44 + i * 6);
        ctx.stroke();
      }
    }
    drawFace(ctx, 0, -55, 20, 'grin', t, 78);
    // two drumsticks alternating like mad
    ctx.strokeStyle = '#e8c56a'; ctx.lineWidth = 4;
    for (const sd of [-1, 1]) {
      const a = Math.sin(t * 12 + (sd > 0 ? Math.PI : 0)) * 0.5;
      ctx.beginPath();
      ctx.moveTo(sd * 10, -52);
      ctx.lineTo(sd * 20, -66 + a * 18);
      ctx.stroke();
    }
    ctx.restore();
  }
}
