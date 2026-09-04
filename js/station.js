'use strict';
// ================================================================ alien space station
// THE ALIEN SPACE STATION 8-2 (v1.27.0): Space Maze's stage two. Spec:
// docs/superpowers/specs/2026-09-04-alien-space-station-design.md.
// Three layers in this file:
//   POWER GRID KIT — Battery (the follow-item pattern), Socket (a floor
//     pedestal that swallows a carried battery and powers its Machine;
//     Space ejects it), Machine (door / elevator / gravity / bridge /
//     vending / hologram / hand / robot / fan / laser / magnet / baydoor).
//     Nothing station-specific in the kit: future puzzle levels reuse it.
//   ENEMIES — AlienSpider (lives in lv.spiders so every enemy loop works:
//     kinds crawl / jump / drop / vent / shooter / thrown; any shot pops it
//     into candy; web globs only SLOW the hero) and the GiantSpider boss
//     (a spider factory behind an energy shield that only battery-powered
//     arena machines can open).
//   THE MACHINE — AlienStation on lv.puzzle: lighting director (the station
//     wakes up as the hero goes deeper and powers machines), ambushes, the
//     boss fight, the escape-pod cinematic into Dino Jungle.

const ST = {
  G: 1400, U: 950, A: 530, W: 11600, H: 1500,
  ACT2: 4200, ACT3: 7600, ARENA: 9200, ARENA_END: 10600, BAY: 10600, POD: 11100
};

// ---------------------------------------------------------------- power grid kit
class Battery {
  constructor(x, y, id) {
    this.id = id; this.w = 44; this.h = 56;
    this.x = x - this.w / 2; this.y = y - this.h; this.baseY = y - this.h;
    this.state = 'idle'; // idle (on the floor) -> follow -> in (socketed)
    this.socket = null; this.t = rand(9);
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt, pl, grid) {
    this.t += dt;
    if (this.state === 'idle') {
      this.y = this.baseY + Math.sin(this.t * 2.4) * 5;
      if (!grid.carried && overlaps(this, pl)) grid.pickUp(this);
    } else if (this.state === 'follow') {
      const tx = pl.cx - pl.facing * 58, ty = pl.y - 26 + Math.sin(this.t * 3) * 6;
      if (Math.hypot(tx - this.cx, ty - this.cy) > 700) { this.x = tx - this.w / 2; this.y = ty - this.h / 2; }
      const k = Math.min(1, dt * 6);
      this.x += (tx - this.cx) * k; this.y += (ty - this.cy) * k;
      if (chance(0.15)) Particles.burst(this.cx, this.cy + 14, 1, { colors: ['#a8ff3c', '#4dfcff'], type: 'sparkle', sp1: 20, grav: -40, l1: 0.7, s1: 6, up: 0 });
    }
  }
  draw(ctx, t) { ST_SCENE.battery(ctx, this.cx, this.cy, this.h, t, { glow: true, held: this.state === 'follow' }); }
}

class Socket {
  constructor(cx, groundY, machine, opts = {}) {
    this.cx = cx; this.gy = groundY; this.machine = machine;
    this.zoneW = opts.zoneW || 120;
    this.cable = opts.cable || [{ x: cx, y: groundY - 30 }, { x: machine.cx, y: machine.gy - 40 }];
    this.battery = null; this.cooldown = 0; this.t = rand(9); this.flashT = 0;
    this.armed = true; // a pulled cell is not swallowed again until the hero steps out of the zone
    machine.socket = this;
  }
  get powered() { return !!this.battery && this.cooldown <= 0; }
  zone() { return { x: this.cx - this.zoneW / 2, y: this.gy - 120, w: this.zoneW, h: 120 }; }
  insert(b, grid) {
    this.battery = b; b.state = 'in'; b.socket = this;
    b.x = this.cx - b.w / 2; b.y = this.gy - 46 - b.h / 2;
    grid.carried = null;
    this.flashT = 0.6;
    AudioSys.sfx('powerup'); AudioSys.sfx('switch');
    game.shake = Math.max(game.shake, 0.12);
    Particles.burst(this.cx, this.gy - 40, 16, { colors: ['#a8ff3c', '#4dfcff', '#fff'], type: 'sparkle', sp1: 220, l1: 0.7, s1: 9 });
    this.machine.power(true);
  }
  eject(grid, why) {
    const b = this.battery;
    if (!b) return;
    this.battery = null; b.socket = null;
    this.machine.power(false);
    if (why === 'hot') { // the machine overheated: the cell pops out and rolls free
      this.cooldown = 5;
      b.state = 'idle'; b.baseY = this.gy; b.x = this.cx - 90 - b.w / 2; b.y = b.baseY - b.h;
      AudioSys.sfx('boom'); AudioSys.sfx('steam');
      Particles.burst(this.cx, this.gy - 40, 14, { colors: ['#ffb347', '#ff5a5a', '#fff'], type: 'flame', sp1: 220, grav: -60, l1: 0.6, s1: 10 });
    } else { // the hero pulled it: it follows again
      if (grid.carried) { grid.carried.state = 'idle'; grid.carried.baseY = this.gy; grid.carried.x = this.cx + 70; grid.carried.y = this.gy - grid.carried.h; }
      b.state = 'follow'; grid.carried = b;
      AudioSys.sfx('plop'); AudioSys.sfx('collect');
      Particles.burst(this.cx, this.gy - 40, 8, { colors: ['#a8ff3c', '#fff'], type: 'sparkle', sp1: 160, l1: 0.5, s1: 8 });
    }
  }
  update(dt, pl, grid) {
    this.t += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      if (chance(0.3)) Particles.burst(this.cx + rand(-20, 20), this.gy - 50, 1, { colors: ['#9a9ab0'], type: 'bubble', sp1: 30, grav: -60, l1: 1, s1: 9, up: 0 });
      if (this.cooldown <= 0) { this.cooldown = 0; AudioSys.sfx('switch'); }
      return;
    }
    const near = overlaps(this.zone(), pl);
    if (Math.abs(pl.cx - this.cx) > this.zoneW / 2 + 24) this.armed = true; // re-arm needs walking away, not a hop
    if (!this.battery && grid.carried && near && this.armed) this.insert(grid.carried, grid);
    else if (this.battery && near && justP.Space && !this.machine.locked) { this.eject(grid, 'pull'); this.armed = false; }
  }
  draw(ctx, t) {
    ST_SCENE.cable(ctx, this.cable, t, this.powered ? 1 : 0);
    ST_SCENE.socket(ctx, this.cx, this.gy, 90, t, { powered: this.powered, hasBattery: !!this.battery, cooldown: Math.min(1, this.cooldown / 5) });
    if (this.battery) this.battery.draw(ctx, t);
  }
  lights() {
    const L = [];
    if (this.powered) {
      L.push({ x: this.cx, y: this.gy - 40, r: 240, a: 0.9 });
      for (const p of this.cable) L.push({ x: p.x, y: p.y, r: 120, a: 0.6 });
    } else if (this.battery) L.push({ x: this.cx, y: this.gy - 40, r: 140, a: 0.7 });
    else L.push({ x: this.cx, y: this.gy - 30, r: 70, a: 0.5 });
    return L;
  }
}

class Machine {
  constructor(kind, cx, groundY, opts = {}) {
    this.kind = kind; this.cx = cx; this.gy = groundY; this.o = opts;
    this.on = false; this.k = 0; this.t = rand(9); this.onT = 0; this.locked = false;
    this.solids = []; this.burstT = 0; this.spat = 0; this.slapT = 0; this.mode = 'off';
    const g = groundY;
    if (kind === 'door') this.solids.push({ x: cx - 40, y: g - 300, w: 80, h: 300, skipDraw: true, machine: this });
    if (kind === 'elevator') {
      this.y0 = g; this.y1 = opts.topY; this.dir = -1; this.pauseT = 0;
      this.car = { x: cx - 80, y: g - 20, w: 160, h: 20, skipDraw: true, machine: this, oneWay: true };
      this.solids.push(this.car);
    }
    if (kind === 'bridge') {
      this.plates = [];
      for (let i = 0; i < 4; i++) {
        const p = { x: opts.gapX + i * 100, y: opts.plateY, w: 96, h: 20, skipDraw: true, machine: this, broken: true, homeX: opts.gapX + i * 100 };
        this.plates.push(p); this.solids.push(p);
      }
    }
    if (kind === 'baydoor') this.solids.push({ x: cx - 30, y: g - 320, w: 60, h: 320, skipDraw: true, machine: this });
  }
  power(on) {
    this.on = on; this.onT = 0;
    if (this.kind === 'gravity') game.level.gravK = on ? 0.32 : 1;
    if (this.kind === 'robot') this.mode = on ? 'dance' : 'off';
    if (this.kind === 'vending' && on) this.spat = 0;
    if (this.kind === 'hologram') AudioSys.sfx(on ? 'bells' : 'hornflat');
    if ((this.kind === 'fan' || this.kind === 'laser' || this.kind === 'magnet') && on) { this.burstT = 5; AudioSys.sfx('boom'); AudioSys.sfx('launch'); }
    if (this.kind === 'elevator') AudioSys.sfx(on ? 'grind' : 'clank');
    if (this.kind === 'door') AudioSys.sfx(on ? 'grind' : 'thud');
  }
  update(dt, pl, st) {
    this.t += dt; this.onT += dt;
    const target = this.on ? 1 : 0;
    this.k += (target - this.k) * Math.min(1, dt * (this.kind === 'door' ? 2.5 : 3));
    const g = this.gy;
    if (this.kind === 'door' || this.kind === 'baydoor') {
      this.solids[0].broken = this.k > 0.55;
    } else if (this.kind === 'elevator') {
      const car = this.car;
      const before = car.y;
      const riding = pl.x + pl.w > car.x && pl.x < car.x + car.w && Math.abs(pl.y + pl.h - car.y) < 10;
      if (this.on) {
        if (this.pauseT > 0) this.pauseT -= dt;
        else if (car.y >= this.y0 - 20 && !riding) { /* at the bottom: waits for a passenger */ }
        else {
          car.y += this.dir * 150 * dt;
          if (car.y <= this.y1 - 20) { car.y = this.y1 - 20; this.dir = 1; this.pauseT = 2.2; AudioSys.sfx('clank'); }
          if (car.y >= this.y0 - 20) { car.y = this.y0 - 20; this.dir = -1; this.pauseT = 0.6; AudioSys.sfx('clank'); }
        }
      } else if (car.y < this.y0 - 20) { car.y = Math.min(this.y0 - 20, car.y + 260 * dt); } // unpowered: it sinks home
      const dy = car.y - before;
      // the car carries whoever stands on it
      if (dy !== 0 && pl.x + pl.w > car.x && pl.x < car.x + car.w && Math.abs(pl.y + pl.h - before) < 10 && pl.vy >= 0) { pl.y += dy; pl.onGround = true; }
    } else if (this.kind === 'bridge') {
      for (let i = 0; i < this.plates.length; i++) {
        const p = this.plates[i];
        const out = clamp(this.k * 1.6 - i * 0.2, 0, 1);
        p.x = p.homeX - (1 - out) * 420;
        p.broken = out < 0.95;
      }
    } else if (this.kind === 'vending') {
      if (this.on && this.spat < 6 && this.onT > 0.8 + this.spat * 1.4) {
        this.spat++; this.slapT = 0.5;
        const c = new Pickup(this.cx - 30, g - 90, 'candy');
        c.vx = rand(-260, -120); c.vy = -420; c.physics = true;
        game.pickups.push(c);
        AudioSys.sfx('candy'); AudioSys.sfx('clank');
      }
    } else if (this.kind === 'hand') {
      if (this.on && this.onT > 1.2 && Math.abs(pl.cx - (this.cx - 110)) < 90 && pl.y + pl.h > g - 160) {
        this.onT = 0; this.slapT = 0.6;
        pl.vy = -520; pl.vx = -260; pl.onGround = false; pl.squash = 1.4;
        pl.setMood('dizzy', 1);
        AudioSys.sfx('boing'); AudioSys.sfx('bong');
        Particles.burst(pl.cx, pl.y, 10, { colors: ['#ffe156', '#fff'], type: 'star', sp1: 220, l1: 0.6, s1: 9 });
      }
    } else if (this.kind === 'robot') {
      if (this.on && this.mode === 'dance' && this.onT > 4) { this.mode = 'sleep'; AudioSys.sfx('snore'); }
      if (this.mode === 'sleep' && chance(0.02)) st.zzz.push({ x: this.cx + 30, y: g - 110, t: 0 });
    } else if (this.kind === 'fan' || this.kind === 'laser' || this.kind === 'magnet') {
      if (this.burstT > 0) {
        this.burstT -= dt;
        if (this.burstT <= 0 && this.socket && this.socket.battery) { this.burstT = 0; this.socket.eject(st.grid, 'hot'); }
      }
    }
    this.slapT = Math.max(0, this.slapT - dt);
  }
  get bursting() { return this.on && this.burstT > 0; }
  draw(ctx, t, st) {
    const g = this.gy, cx = this.cx, k = this.k;
    switch (this.kind) {
      case 'door': ST_SCENE.blastDoor(ctx, cx, g, 300, t, k); break;
      case 'baydoor': ST_SCENE.bayDoor(ctx, cx, g, 320, t, k); break;
      case 'elevator': ST_SCENE.elevatorShaft(ctx, cx, this.y1 - 40, this.y0, 160, t, this.on ? 1 : 0); ST_SCENE.elevator(ctx, cx, this.car.y, 160, t, this.on ? 1 : 0); break;
      case 'gravity': ST_SCENE.gravityMachine(ctx, cx, g, 220, t, k); break;
      case 'bridge': ST_SCENE.bridgeMachine(ctx, cx, g, 140, t, k); for (const p of this.plates) if (!p.broken || this.k > 0.05) ST_SCENE.bridgePlate(ctx, p.x, p.y, p.w, t, p.broken ? 0 : 1); break;
      case 'vending': ST_SCENE.vendingMachine(ctx, cx, g, 220, t, k, this.slapT > 0 ? this.slapT / 0.5 : 0); break;
      case 'hologram': ST_SCENE.hologram(ctx, cx, g, 260, t, k); break;
      case 'hand': ST_SCENE.highFiveHand(ctx, cx, g, 200, t, k, this.slapT > 0 ? 1 - this.slapT / 0.6 : 0); break;
      case 'robot': ST_SCENE.danceRobot(ctx, cx, g, 120, t, this.mode); break;
      case 'fan': ST_SCENE.fanMachine(ctx, cx, g, 240, t, this.bursting ? 1 : k * 0.3); break;
      case 'laser': ST_SCENE.laserMachine(ctx, cx, g, 160, t, this.bursting ? 1 : 0, st.bossAim()); break;
      case 'magnet': ST_SCENE.magnetMachine(ctx, cx, g, 200, t, this.bursting ? 1 : 0, st.bossAim()); break;
    }
  }
  lights() {
    const g = this.gy, L = [];
    if (this.kind === 'door' || this.kind === 'baydoor') L.push({ x: this.cx, y: g - 150, r: 140 + this.k * 200, a: 0.5 + this.k * 0.5 });
    else if (this.kind === 'elevator') L.push({ x: this.cx, y: this.car.y, r: this.on ? 260 : 120, a: 0.8 });
    else if (this.kind === 'hologram') { if (this.k > 0.05) L.push({ x: this.cx, y: g - 200, r: 420 * this.k, a: 0.9 }); }
    else if (this.kind === 'fan' || this.kind === 'laser' || this.kind === 'magnet') L.push({ x: this.cx, y: g - 110, r: this.bursting ? 460 : 180, a: 0.9 });
    else L.push({ x: this.cx, y: g - 100, r: 120 + this.k * 260, a: 0.6 + this.k * 0.4 });
    return L;
  }
}

class PowerGrid {
  constructor() { this.batteries = []; this.sockets = []; this.machines = []; this.carried = null; }
  battery(x, y) { const b = new Battery(x, y, this.batteries.length); this.batteries.push(b); return b; }
  machine(kind, cx, gy, opts) { const m = new Machine(kind, cx, gy, opts); this.machines.push(m); return m; }
  socket(cx, gy, machine, opts) { const s = new Socket(cx, gy, machine, opts); this.sockets.push(s); return s; }
  preload(socket, battery) { battery.state = 'in'; battery.socket = socket; socket.battery = battery; battery.x = socket.cx - battery.w / 2; battery.y = socket.gy - 46 - battery.h / 2; socket.machine.power(true); socket.machine.k = 1; }
  pickUp(b) {
    b.state = 'follow'; this.carried = b;
    AudioSys.sfx('collect'); AudioSys.sfx('powerup');
    game.player.setMood('grin', 1.2);
    Particles.burst(b.cx, b.cy, 14, { colors: ['#a8ff3c', '#4dfcff', '#fff'], type: 'star', sp1: 240, l1: 0.8, s1: 10, grav: 200 });
  }
  poweredCount() { return this.sockets.filter(s => s.powered).length; }
  poweredNear(x, r = 1500) { return this.sockets.filter(s => s.powered && Math.abs(s.cx - x) < r).length; }
  allSolids() { const out = []; for (const m of this.machines) for (const s of m.solids) out.push(s); return out; }
  update(dt, pl, st) {
    for (const b of this.batteries) b.update(dt, pl, this);
    for (const s of this.sockets) s.update(dt, pl, this);
    for (const m of this.machines) m.update(dt, pl, st);
  }
  draw(ctx, t, st) {
    for (const m of this.machines) m.draw(ctx, t, st);
    for (const s of this.sockets) s.draw(ctx, t);
    for (const b of this.batteries) if (b.state !== 'in') b.draw(ctx, t);
  }
  lights() {
    let L = [];
    for (const s of this.sockets) L = L.concat(s.lights());
    for (const m of this.machines) L = L.concat(m.lights());
    for (const b of this.batteries) if (b.state !== 'in') L.push({ x: b.cx, y: b.cy, r: 200, a: 0.9 });
    return L;
  }
}

// ---------------------------------------------------------------- alien spiders
class AlienSpider {
  constructor(cx, groundY, kind = 'crawl', opt = {}) {
    this.kind = kind; this.big = !!opt.big;
    this.w = this.big ? 100 : 64; this.h = this.big ? 70 : 44;
    this.x = cx - this.w / 2; this.y = groundY - this.h;
    this.x0 = this.x; this.groundY = groundY;
    this.vx = 0; this.vy = 0; this.dir = opt.dir || -1;
    this.range = opt.range || 140;
    this.state = (kind === 'drop' || kind === 'vent') ? 'lurk' : kind === 'thrown' ? 'fly' : 'angry';
    if (kind === 'drop') { this.y = (opt.ceilY || groundY - 300) + 10; }
    if (kind === 'thrown') { this.vx = opt.vx || -400; this.vy = opt.vy || -600; }
    this.trigger = opt.trigger || 170;
    this.t = rand(9); this.jumpT = rand(0.6, 1.4); this.shootT = rand(1, 2.2); this.stunT = 0; this.wob = 0;
    this.dead = false; this.onGround = false; this.danceT = 0; this.followI = 0;
    this.shooter = kind === 'shooter' || kind === 'thrown';
    this.st = null; // the station machine (set by it) for globs/candy
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt) {
    const lv = game.level, pl = game.player;
    this.t += dt;
    if (this.dead) return;
    this.wob = Math.max(0, this.wob - dt);
    if (this.state === 'friend') { this.danceT = Math.max(0, this.danceT - dt); return; }
    if (this.state === 'lurk') {
      const dx = pl.cx - this.cx;
      if (this.kind === 'drop' && Math.abs(dx) < this.trigger && pl.y > this.y) {
        this.state = 'fly'; this.vy = 60; this.vx = 0;
        AudioSys.sfx('squawk'); game.shake = Math.max(game.shake, 0.12);
      } else if (this.kind === 'vent' && Math.abs(dx) < this.trigger) {
        this.state = 'fly'; this.vy = -380; this.vx = Math.sign(dx || 1) * 220; this.dir = Math.sign(dx || 1);
        AudioSys.sfx('squawk'); AudioSys.sfx('clank');
        if (this.st) this.st.ventPop(this);
      }
      return;
    }
    if (this.state === 'fly') {
      this.vy += 1600 * dt;
      const r = moveEntity(this, lv, dt);
      if (r.wall) this.vx *= -0.5;
      if (r.ground) {
        this.vx = 0;
        this.state = this.kind === 'thrown' ? 'stun' : 'angry'; this.stunT = 0.7;
        this.dir = pl.cx < this.cx ? -1 : 1;
        AudioSys.sfx('thud');
        Particles.burst(this.cx, this.y + this.h, 8, { colors: ['#4dfcff', '#fff'], type: 'sparkle', sp1: 160, l1: 0.5, s1: 8 });
      }
      return;
    }
    if (this.state === 'stun') {
      this.stunT -= dt; this.vy += 1600 * dt; moveEntity(this, lv, dt);
      if (this.stunT <= 0) { this.state = 'angry'; this.jumpT = 0.8; }
      return;
    }
    // angry: crawl / jump / shoot
    const dx = pl.cx - this.cx, near = Math.abs(dx) < 430 && Math.abs(pl.cy - this.cy) < 320;
    if (this.kind === 'crawl' || this.kind === 'vent' || this.kind === 'drop') {
      this.vx = this.dir * (this.big ? 60 : 90);
      if (this.x < this.x0 - this.range) this.dir = 1;
      if (this.x > this.x0 + this.range) this.dir = -1;
      if (this.kind !== 'crawl' && near) this.dir = Math.sign(dx || 1);
    } else if (this.kind === 'jump' || this.kind === 'thrown') {
      this.dir = dx < 0 ? -1 : 1;
      this.jumpT -= dt;
      if (this.onGround && this.jumpT <= 0 && near) { this.vy = -520; this.vx = this.dir * 220; this.jumpT = rand(1.2, 1.8); AudioSys.sfx('boing'); }
      if (this.onGround) this.vx *= 0.8;
    } else if (this.kind === 'shooter') {
      this.dir = dx < 0 ? -1 : 1; this.vx = 0;
    }
    if (this.shooter && near && Math.abs(dx) < 620) {
      this.shootT -= dt;
      if (this.shootT <= 0 && this.st) { this.shootT = rand(2.2, 2.8); this.st.shootWeb(this); }
    }
    this.vy += 1600 * dt;
    const r = moveEntity(this, lv, dt);
    this.onGround = r.ground;
    if (r.wall) this.dir *= -1;
  }
  hit(kind) { if (this.state === 'lurk') return false; this.pop(); return true; }
  knockAway() { this.pop(); }
  befriend() { this.pop(); }
  pop() {
    if (this.dead) return;
    this.dead = true;
    AudioSys.sfx('poof'); AudioSys.sfx('candy');
    Particles.burst(this.cx, this.cy, 16, { colors: ['#4dfcff', '#ff4df0', '#fff'], type: 'star', sp1: 300, l1: 0.8, s1: 11 });
    Particles.candyBurst(this.cx, this.cy, this.big ? 10 : 5);
    const n = this.big ? 5 : 2;
    for (let i = 0; i < n; i++) {
      const c = new Pickup(this.cx, this.cy, 'candy');
      c.vx = rand(-220, 220); c.vy = rand(-520, -300); c.physics = true;
      game.pickups.push(c);
    }
  }
  draw(ctx) {
    if (this.dead || this.state === 'lurk') return;
    const mood = this.state === 'stun' ? 'stun' : this.state === 'fly' ? 'fly' : this.state === 'friend' ? 'crawl' :
      (this.shooter && this.shootT < 0.5) ? 'shoot' : (!this.onGround ? 'jump' : 'crawl');
    ST_ART.alienSpider(ctx, this.cx, this.y + this.h, this.w, this.t, { mood, size: this.big ? 'big' : 'small', facing: this.dir, wob: this.wob > 0 ? Math.sin(this.wob * 40) * 4 : 0 });
  }
}

class GiantSpider {
  constructor(cx, groundY) {
    this.cx = cx; this.gy = groundY; this.s = 420;
    this.x = cx - 170; this.y = groundY - 300; this.w = 340; this.h = 300;
    this.state = 'wait'; // wait -> drop -> fight -> pop -> gone
    this.t = 0; this.st = 0; this.hp = 6; this.shield = true; this.shieldK = 1; this.hitT = 0; this.shieldHit = 0;
    this.spawnT = 2.5; this.spawnK = 0; this.spawning = false; this.throwPt = { x: cx - 150, y: groundY - 320 };
    this.dropY = groundY - 900; this.facing = -1;
  }
  box() { return { x: this.cx - 170, y: this.gy - 300, w: 340, h: 300 }; }
  update(dt, station) {
    const pl = game.player;
    this.t += dt; this.st += dt;
    this.hitT = Math.max(0, this.hitT - dt); this.shieldHit = Math.max(0, this.shieldHit - dt * 2);
    this.shieldK += ((this.shield ? 1 : 0) - this.shieldK) * Math.min(1, dt * 5);
    if (this.state === 'drop') {
      const k = Math.min(1, this.st / 1.4), e = k * k;
      this.y = lerp(this.dropY, this.gy - 300, e);
      if (k >= 1 && this.state === 'drop') { this.state = 'fight'; this.st = 0; game.shake = Math.max(game.shake, 0.6); AudioSys.sfx('thud'); AudioSys.sfx('roar'); }
      return;
    }
    if (this.state !== 'fight') return;
    this.shield = !station.grid.machines.some(m => m.bursting);
    // the spider factory: lift one from the back and hurl it
    this.spawnT -= dt;
    const alive = game.spiders.filter(s => !s.dead && s.kind === 'thrown').length;
    if (!this.spawning && this.spawnT <= 0 && alive < 3) { this.spawning = true; this.spawnK = 0; AudioSys.sfx('inhale'); }
    if (this.spawning) {
      this.spawnK += dt * 1.3;
      if (this.spawnK >= 1) {
        this.spawning = false; this.spawnT = 3.5;
        const dx = pl.cx - this.throwPt.x;
        const sp = new AlienSpider(this.throwPt.x, this.throwPt.y, 'thrown', { vx: clamp(dx * 1.1, -620, -260), vy: -520 });
        sp.y = this.throwPt.y; sp.st = station;
        game.spiders.push(sp);
        AudioSys.sfx('whoosh'); AudioSys.sfx('squawk');
      }
    }
  }
  hitBy(pr, station) { // a projectile reached the boss
    if (this.state !== 'fight') return;
    if (this.shield) {
      this.shieldHit = 1; AudioSys.sfx('plop');
      Particles.burst(pr.cx, pr.cy, 8, { colors: ['#4dfcff', '#fff'], type: 'sparkle', sp1: 180, l1: 0.5, s1: 8 });
      return;
    }
    this.hp--; this.hitT = 0.8;
    AudioSys.sfx('bong'); AudioSys.sfx('hit');
    game.shake = Math.max(game.shake, 0.2);
    Particles.candyBurst(pr.cx, pr.cy, 6);
    Particles.burst(pr.cx, pr.cy, 12, { colors: ['#ff4df0', '#ffe156', '#fff'], type: 'star', sp1: 280, l1: 0.8, s1: 11 });
    if (this.hp <= 0) { this.state = 'pop'; this.st = 0; this.shield = false; AudioSys.sfx('inhale'); AudioSys.sfx('rumble'); }
  }
  explode(station) {
    this.state = 'gone';
    AudioSys.sfx('boom'); AudioSys.sfx('fanfare'); AudioSys.sfx('cheer');
    game.shake = Math.max(game.shake, 0.8);
    for (let i = 0; i < 5; i++) Particles.candyBurst(this.cx + rand(-150, 150), this.gy - rand(80, 300), 12);
    Particles.burst(this.cx, this.gy - 160, 60, { colors: RAINBOW.concat(['#ffe156', '#fff']), type: 'confetti', sp1: 520, l0: 1, l1: 2.4, s1: 13, grav: 260, up: 320 });
    for (let i = 0; i < 60; i++) { // the candy STORM: real, collectible, everywhere
      const c = new Pickup(this.cx + rand(-120, 120), this.gy - rand(120, 280), 'candy');
      c.vx = rand(-620, 620); c.vy = rand(-900, -300); c.physics = true;
      game.pickups.push(c);
    }
    for (const sp of game.spiders) if (sp instanceof AlienSpider && !sp.dead) sp.pop();
    station.onBossDown();
  }
  draw(ctx, t) {
    if (this.state === 'wait' || this.state === 'gone') return;
    const mood = this.state === 'pop' ? 'pop' : this.hitT > 0 ? 'hurt' : this.spawning ? 'spawn' : 'angry';
    const s = this.state === 'pop' ? this.s * (1 + this.st * 0.35) : this.s;
    const r = ST_ART.bossSpider(ctx, this.cx, this.y + this.h, s, t, { mood, shield: this.shieldK, shieldHit: this.shieldHit, spawnK: this.spawnK, facing: this.facing });
    if (r && r.throwPt) this.throwPt = r.throwPt;
    if (this.state === 'fight') for (let i = 0; i < 6; i++) drawHeartIcon(ctx, this.cx - 110 + i * 44, this.y - 40 + Math.sin(t * 3 + i) * 3, 26, i < this.hp, 0);
  }
}

// ---------------------------------------------------------------- the station
class AlienStation {
  constructor(lv) {
    const G = ST.G, U = ST.U, A = ST.A;
    this.t = 0; this.zzz = []; this.globs = []; this.creakT = 3;
    this.act = 1; this.musicAct = 0;
    this.grid = new PowerGrid();
    const gr = this.grid;
    // ---- act 2: door lesson, elevator, the funny upper deck, door 2 ----
    gr.battery(4500, G);
    const d1 = gr.machine('door', 4900, G);
    gr.socket(4900, G, d1, { zoneW: 220, cable: [{ x: 4900, y: G - 30 }, { x: 4900, y: G - 120 }] });
    const el = gr.machine('elevator', 5500, G, { topY: U });
    gr.socket(5330, G, el, { cable: [{ x: 5330, y: G - 30 }, { x: 5420, y: G - 30 }, { x: 5420, y: G - 120 }] });
    const vend = gr.machine('vending', 5950, U);
    gr.socket(5820, U, vend, { cable: [{ x: 5820, y: U - 30 }, { x: 5880, y: U - 30 }, { x: 5880, y: U - 100 }] });
    const holo = gr.machine('hologram', 6400, U);
    const s4 = gr.socket(6260, U, holo, { cable: [{ x: 6260, y: U - 30 }, { x: 6400, y: U - 30 }] });
    gr.preload(s4, gr.battery(6260, U));
    const robot = gr.machine('robot', 6900, U);
    gr.socket(6780, U, robot, { cable: [{ x: 6780, y: U - 30 }, { x: 6900, y: U - 30 }] });
    const d2 = gr.machine('door', 7400, U);
    gr.socket(7400, U, d2, { zoneW: 220, cable: [{ x: 7400, y: U - 30 }, { x: 7400, y: U - 120 }] });
    // ---- act 3: gravity room, the high-five hand, the bridge ----
    const grav = gr.machine('gravity', 7900, U);
    gr.socket(7760, U, grav, { cable: [{ x: 7760, y: U - 30 }, { x: 7900, y: U - 30 }] });
    const hand = gr.machine('hand', 8300, U);
    const s7 = gr.socket(8420, U, hand, { cable: [{ x: 8420, y: U - 30 }, { x: 8300, y: U - 30 }] });
    gr.preload(s7, gr.battery(8420, U));
    const bridge = gr.machine('bridge', 8700, A, { gapX: 8800, plateY: A });
    gr.socket(8600, A, bridge, { cable: [{ x: 8600, y: A - 30 }, { x: 8700, y: A - 30 }] });
    // ---- the arena: three shield-breakers, one spare cell ----
    gr.battery(9600, A);
    this.fan = gr.machine('fan', 9350, A); gr.socket(9450, A, this.fan, { cable: [{ x: 9450, y: A - 30 }, { x: 9350, y: A - 30 }] });
    this.laser = gr.machine('laser', 9700, A); gr.socket(9800, A, this.laser, { cable: [{ x: 9800, y: A - 30 }, { x: 9700, y: A - 30 }] });
    this.magnet = gr.machine('magnet', 10050, A); gr.socket(10150, A, this.magnet, { cable: [{ x: 10150, y: A - 30 }, { x: 10050, y: A - 30 }] });
    this.bayDoor = gr.machine('baydoor', ST.BAY, A);
    this.solids = gr.allSolids();
    // ---- the boss + the pod ----
    this.boss = new GiantSpider(10420, A); // stands clear of the three machines, in front of the bay door
    this.arenaWall = null; this.bossDown = false; this.podT = 0; this.escape = null;
    this.pod = { x: ST.POD, gy: A };
    // ---- lighting fixtures ----
    this.emerg = [];  for (let x = 380; x < 4200; x += 520) this.emerg.push({ x, y: G - 250, ph: rand(9) });
    this.ceil = [];   for (let x = 700; x < 7600; x += 900) this.ceil.push({ x, y: x < 4200 ? G - 296 : G - 300, on: 0, nextT: rand(1, 3), ph: rand(9) });
    this.glyphs = []; for (let x = 200; x < 11400; x += rand(240, 420)) this.glyphs.push({ x, y: (x < 4200 ? G - rand(80, 240) : x < 7600 ? G - rand(100, 260) : U - rand(80, 240)), i: randi(0, 5) });
    this.sparks = [{ x: 1200, y: G - 200 }, { x: 2900, y: G - 190 }, { x: 5100, y: G - 220 }];
    this.decor = this.buildDecor();
    this.ambushes = [];
  }
  buildDecor() {
    const G = ST.G, U = ST.U, A = ST.A;
    return {
      vents: [{ x: 900, y: G - 140 }, { x: 2050, y: G - 130 }, { x: 3550, y: G - 150 }, { x: 4700, y: G - 140 }],
      doors: [{ x: 650, gy: G }, { x: 2350, gy: G - 150 }, { x: 3900, gy: G }],
      robots: [{ x: 4400, gy: G, s: 90 }, { x: 6100, gy: U, s: 80 }, { x: 8100, gy: U, s: 70 }],
      pods: [{ x: 5050, gy: G, s: 150 }, { x: 6600, gy: U, s: 140 }],
      panels: [{ x: 4750, gy: G, s: 110 }, { x: 5700, gy: U, s: 100 }, { x: 7200, gy: U, s: 110 }, { x: 9550, gy: A, s: 100 }],
      crates: [{ x: 300, gy: G, s: 70 }, { x: 1750, gy: G - 96, s: 60 }, { x: 4950, gy: G, s: 60 }, { x: 10800, gy: A, s: 70 }],
      webs: [{ x: 4210, y: G - 300 }, { x: 4600, y: G - 300 }, { x: 5200, y: G - 300 }, { x: 5600, y: U - 220 }, { x: 6000, y: U - 220 }, { x: 6800, y: U - 220 }, { x: 7300, y: U - 220 }],
      goo: [{ x: 4300, gy: G, w: 110 }, { x: 5300, gy: G, w: 140 }, { x: 6500, gy: U, w: 120 }, { x: 7000, gy: U, w: 90 }],
      pipes: [
        { pts: [{ x: 4200, y: G - 260 }, { x: 5400, y: G - 260 }, { x: 5400, y: G - 200 }], glowAt: 1 },
        { pts: [{ x: 5300, y: U - 200 }, { x: 7600, y: U - 200 }], glowAt: 2 },
        { pts: [{ x: 7600, y: U - 280 }, { x: 8600, y: U - 280 }, { x: 8600, y: A - 100 }, { x: 10600, y: A - 100 }], glowAt: 3 }
      ],
      warnings: [{ x: 4850, y: G - 240 }, { x: 7350, y: U - 240 }, { x: 9250, y: A - 220 }]
    };
  }
  spawnEnemies(lv) { // called by the level builder: every ambush lives in lv.spiders
    const G = ST.G, U = ST.U;
    const add = (cx, gy, kind, opt) => { const s = new AlienSpider(cx, gy, kind, opt); s.st = this; lv.spiders.push(s); return s; };
    add(1000, G, 'drop', { ceilY: G - 300 });
    add(1650, G - 96, 'crawl', { range: 120 });
    add(2050, G - 150, 'vent', { trigger: 190 });
    add(2600, G - 150, 'drop', { ceilY: G - 450 });
    add(3200, G, 'jump');
    add(3550, G, 'vent', { trigger: 190 });
    add(3900, G, 'shooter');
    add(4600, G, 'crawl', { range: 160, big: true });
    add(5150, G, 'shooter');
    add(6050, U, 'jump');
    add(6700, U, 'drop', { ceilY: U - 260 });
    add(7100, U, 'shooter', { big: true });
    add(8150, U, 'jump');
  }
  // ---- helpers the enemies call ----
  shootWeb(sp) {
    const pl = game.player;
    const dx = pl.cx - sp.cx, dy = (pl.cy - 10) - sp.cy, d = Math.max(1, Math.hypot(dx, dy));
    this.globs.push({ x: sp.cx, y: sp.cy - 10, vx: dx / d * 340, vy: dy / d * 340 - 80, t: 0, r: 14 });
    AudioSys.sfx('stick');
    Particles.burst(sp.cx, sp.cy - 10, 5, { colors: ['#fff', '#ff4df0'], type: 'sparkle', sp1: 120, l1: 0.4, s1: 7 });
  }
  ventPop(sp) { for (const v of this.decor.vents) if (Math.abs(v.x - sp.cx) < 80) v.open = 1; }
  bossAim() { const b = this.boss; return { x: b.cx, y: b.y + b.h * 0.5 }; }
  onBossDown() {
    this.bossDown = true;
    this.bayDoor.power(true);
    AudioSys.setMusic('space');
  }
  // ---- lighting director ----
  actFor(x) { return x < ST.ACT2 ? 1 : x < ST.ACT3 ? 2 : 3; }
  update(dt, pl) {
    const lv = game.level;
    this.t += dt;
    const x = pl.cx;
    // the station wakes up: darkness by depth, minus every powered machine
    let base;
    if (x < ST.ACT2) base = lerp(0.97, 0.86, x / ST.ACT2);
    else if (x < ST.ACT3) base = lerp(0.86, 0.6, (x - ST.ACT2) / (ST.ACT3 - ST.ACT2));
    else base = lerp(0.6, 0.3, clamp((x - ST.ACT3) / 2000, 0, 1));
    lv.darkAlpha = clamp(base - 0.07 * this.grid.poweredNear(x), 0.12, 0.97); // machinery coming alive brightens ITS room
    lv.playerLight = x < ST.ACT2 ? lerp(150, 240, x / ST.ACT2) : x < ST.ACT3 ? lerp(240, 330, (x - ST.ACT2) / 3400) : lerp(330, 520, clamp((x - ST.ACT3) / 2000, 0, 1));
    // music follows the acts
    const act = this.bossDown ? 4 : (this.boss.state === 'fight' || this.boss.state === 'drop' || this.boss.state === 'pop') ? 5 : this.actFor(x);
    if (act !== this.musicAct) { this.musicAct = act; AudioSys.setMusic(act === 1 ? '' : act === 2 ? 'cave' : act === 5 ? 'boss' : 'space'); }
    // creaks in the dark
    if (act === 1) { this.creakT -= dt; if (this.creakT <= 0) { this.creakT = rand(4, 8); AudioSys.sfx(chance(0.5) ? 'grind' : chance(0.5) ? 'clank' : 'steam'); } }
    // ceiling flicker
    for (const c of this.ceil) {
      c.nextT -= dt;
      if (c.nextT <= 0) { c.on = c.on > 0 ? 0 : 1; c.nextT = c.on ? rand(0.15, 0.5) : rand(1.5, 3.5); if (c.on && Math.abs(c.x - x) < 700) AudioSys.sfx('switch'); }
    }
    if (chance(0.06)) for (const s of this.sparks) if (Math.abs(s.x - x) < 800) Particles.burst(s.x, s.y, 4, { colors: ['#ffe156', '#4dfcff', '#fff'], type: 'sparkle', sp1: 200, grav: 500, l1: 0.5, s1: 7 });
    // the grid + web trap physics
    this.grid.update(dt, pl, this);
    for (const g of this.globs) {
      g.t += dt; g.x += g.vx * dt; g.y += g.vy * dt; g.vy += 300 * dt;
      if (!g.dead && overlaps({ x: g.x - g.r, y: g.y - g.r, w: g.r * 2, h: g.r * 2 }, pl)) {
        g.dead = true;
        if (pl.webT <= 0) { pl.webT = 1.4; pl.setMood('surprised', 1); AudioSys.sfx('stick'); AudioSys.sfx('plop'); }
      }
      if (g.t > 2.6 || solidAtPoint(lv, g.x, g.y)) g.dead = true;
    }
    this.globs = this.globs.filter(g => !g.dead);
    for (const z of this.zzz) { z.t += dt; z.y -= 30 * dt; }
    this.zzz = this.zzz.filter(z => z.t < 2.2);
    for (const v of this.decor.vents) if (v.open) v.open = Math.min(1, v.open + dt);
    // ---- the arena ----
    if (!this.arenaWall && x > ST.ARENA + 120 && this.boss.state === 'wait') {
      this.arenaWall = { x: ST.ARENA + 10, y: ST.A - 400, w: 50, h: 400, skipDraw: true, wall: true };
      lv.solids.push(this.arenaWall);
      this.boss.state = 'drop'; this.boss.st = 0;
      game.cut = { name: 'stationboss', t: 0 };
      AudioSys.sfx('rumble'); game.shake = Math.max(game.shake, 0.4);
    }
    this.boss.update(dt, this);
    if (this.boss.state === 'fight' || this.boss.state === 'pop') {
      const box = this.boss.box();
      for (const pr of game.projectiles) { if (pr.dead || !overlaps(pr, box)) continue; pr.impact(true); this.boss.hitBy(pr, this); }
    }
    if (this.boss.state === 'pop' && this.boss.st > 1.2) this.boss.explode(this);
    // ---- the escape pod ----
    if (this.bossDown && !this.escape && Math.abs(pl.cx - this.pod.x) < 70 && pl.y + pl.h > ST.A - 40) {
      this.escape = { phase: 0, t: 0 };
      game.cut = { name: 'escape', t: 0 };
      AudioSys.setMusic('');
      AudioSys.sfx('switch'); AudioSys.sfx('clank');
    }
  }
  cutTick(dt, c) {
    const pl = game.player, cam = game.cam;
    this.t += dt;
    if (c.name === 'stationboss') {
      this.boss.update(dt, this);
      const tx = clamp(this.boss.cx - W * 0.55, 0, ST.W - W), ty = clamp(this.boss.y + 100 - H * 0.5, 0, ST.H - H);
      cam.x = lerp(cam.x, tx, 1 - Math.exp(-4 * dt)); cam.y = lerp(cam.y, ty, 1 - Math.exp(-4 * dt));
      if (this.boss.state === 'fight' && this.boss.st > 0.8) game.cut = null;
    } else if (c.name === 'escape') {
      const e = this.escape;
      e.t += dt;
      const timeline = [['hatch', 2.2], ['launch', 2.6], ['space', 4.2], ['reentry', 2.4], ['crash', 2.6], ['teaser', 3.6]];
      let acc = 0, idx = timeline.length - 1, k = 1;
      for (let i = 0; i < timeline.length; i++) { if (e.t < acc + timeline[i][1]) { idx = i; k = (e.t - acc) / timeline[i][1]; break; } acc += timeline[i][1]; }
      if (idx !== e.phase) {
        e.phase = idx;
        const ph = timeline[idx][0];
        if (ph === 'launch') { AudioSys.sfx('launch'); AudioSys.sfx('rumble'); game.shake = 0.7; }
        if (ph === 'space') AudioSys.sfx('whoosh');
        if (ph === 'reentry') { AudioSys.sfx('rumble'); AudioSys.sfx('steam'); }
        if (ph === 'crash') { AudioSys.sfx('thud'); AudioSys.sfx('crash'); game.shake = 0.8; }
        if (ph === 'teaser') { AudioSys.sfx('roar'); AudioSys.sfx('squawk'); }
      }
      e.k = k; e.name = timeline[idx][0];
      if (e.name === 'reentry') game.shake = Math.max(game.shake, 0.25);
      if (e.name === 'teaser' && k > 0.45 && k < 0.85 && chance(0.08)) { game.shake = Math.max(game.shake, 0.15); if (chance(0.3)) AudioSys.sfx('thud'); }
      const total = timeline.reduce((a, b) => a + b[1], 0);
      if (e.t >= total || (e.t > 3 && justP.Space)) {
        e.t = total; e.name = 'teaser'; e.k = 1; e.done = true;
        game.cut = null;
        game.worldWin(9);
      }
    }
  }
  lights() {
    const L = this.grid.lights();
    for (const e of this.emerg) L.push({ x: e.x, y: e.y, r: 90 + Math.sin(this.t * 2 + e.ph) * 12, a: 0.55 });
    for (const c of this.ceil) if (c.on) L.push({ x: c.x, y: c.y, r: 170, a: 0.9 });
    for (const g of this.glyphs) L.push({ x: g.x, y: g.y, r: 34, a: 0.8 });
    for (const g of this.decor.goo) L.push({ x: g.x, y: g.gy - 10, r: 80, a: 0.6 });
    for (const p of this.decor.pipes) if (this.act >= p.glowAt || this.grid.poweredCount() >= p.glowAt) for (const q of p.pts) L.push({ x: q.x, y: q.y, r: 110, a: 0.5 });
    for (const gl of this.globs) L.push({ x: gl.x, y: gl.y, r: 60, a: 0.8 });
    if (this.boss.state !== 'wait' && this.boss.state !== 'gone') L.push({ x: this.boss.cx, y: this.boss.y + 150, r: 460, a: 0.95 });
    for (const sp of game.spiders) if (sp instanceof AlienSpider && !sp.dead && sp.state !== 'lurk') L.push({ x: sp.cx, y: sp.cy, r: 110, a: 0.7 });
    if (this.bossDown) L.push({ x: ST.POD, y: ST.A - 90, r: 420, a: 0.95 });
    L.push({ x: ST.ACT2, y: ST.G - 150, r: 260, a: 0.7 }); // the lit doorway at the hallway's end
    return L;
  }
  // ---- drawing ----
  drawBack(ctx, t) {
    const G = ST.G, U = ST.U, A = ST.A, cam = game.cam;
    const x0 = cam.x - 40, x1 = cam.x + W + 40;
    const style = x => x < ST.ACT2 ? 'dark' : x < ST.ACT3 ? 'webbed' : 'bright';
    // walls behind each deck
    // one wall fills the whole screen — an enclosed station, never a window on space
    ST_SCENE.wallPanels(ctx, x0, cam.y - 40, x1, cam.y + H + 40, t, { style: style(cam.x + 640), seed: 1 });
    // floors and ceilings from the level's station solids
    for (const s of game.level.solids) {
      if (!s.station || s.x + s.w < x0 || s.x > x1) continue;
      if (s.ceil) ST_SCENE.ceiling(ctx, s.x, s.y, s.w, s.h, t, { style: style(s.x) });
      else ST_SCENE.floorPanel(ctx, s.x, s.y, s.w, s.h, t, { style: style(s.x) });
    }
    const d = this.decor;
    for (const p of d.pipes) ST_SCENE.pipe(ctx, p.pts, t, { glow: (this.grid.poweredCount() >= p.glowAt || this.actFor(cam.x + 640) > p.glowAt) ? 1 : 0 });
    for (const w of d.webs) if (w.x > x0 && w.x < x1) ST_SCENE.web(ctx, w.x, w.y, 90, t);
    for (const g of this.glyphs) if (g.x > x0 && g.x < x1) ST_SCENE.glyph(ctx, g.x, g.y, 14, t, g.i, style(g.x) === 'bright' ? 1 : 0.4);
    for (const e of this.emerg) if (e.x > x0 && e.x < x1) ST_SCENE.emergencyLight(ctx, e.x, e.y, t + e.ph, 1);
    for (const c of this.ceil) if (c.x > x0 && c.x < x1) ST_SCENE.ceilingLight(ctx, c.x, c.y, 160, t, c.on);
    for (const v of d.vents) if (v.x > x0 && v.x < x1) ST_SCENE.vent(ctx, v.x, v.y, 70, t, { open: v.open || 0 });
    for (const dr of d.doors) if (dr.x > x0 && dr.x < x1) ST_SCENE.brokenDoor(ctx, dr.x, dr.gy, t);
    for (const w of d.warnings) if (w.x > x0 && w.x < x1) ST_SCENE.warningSymbol(ctx, w.x, w.y, 40, t);
    ST_SCENE.doorway(ctx, ST.ACT2, G, 1, t);
    for (const s of this.sparks) if (s.x > x0 && s.x < x1) ST_SCENE.sparkBox(ctx, s.x, s.y, 40, t);
    for (const r of d.robots) if (r.x > x0 && r.x < x1) ST_SCENE.brokenRobot(ctx, r.x, r.gy, r.s, t);
    for (const p of d.pods) if (p.x > x0 && p.x < x1) ST_SCENE.abandonedPod(ctx, p.x, p.gy, p.s, t);
    for (const p of d.panels) if (p.x > x0 && p.x < x1) ST_SCENE.controlPanel(ctx, p.x, p.gy, p.s, t, style(p.x) === 'bright' ? 1 : 0);
    for (const c of d.crates) if (c.x > x0 && c.x < x1) ST_SCENE.crate(ctx, c.x, c.gy, c.s, t);
    for (const g of d.goo) if (g.x > x0 && g.x < x1) ST_ART.gooBlob(ctx, g.x, g.gy, g.w, t);
  }
  draw(ctx, t) {
    this.grid.draw(ctx, t, this);
    for (const z of this.zzz) outlineText(ctx, 'z', z.x, z.y, 22 + z.t * 10, `rgba(160,220,255,${1 - z.t / 2.2})`, `rgba(20,20,60,${1 - z.t / 2.2})`);
    for (const g of this.globs) ST_ART.webGlob(ctx, g.x, g.y, g.r, t);
    this.boss.draw(ctx, t);
    if (this.bossDown || true) ST_ART.escapePod(ctx, this.pod.x, this.pod.gy, 180, t, { open: !this.escape, lights: this.bossDown ? 1 : 0 });
  }
  drawFront(ctx, t) { // above the darkness: glowing eyes, the web on the hero
    const pl = game.player;
    for (const sp of game.spiders) if (sp instanceof AlienSpider && !sp.dead && sp.state === 'lurk') ST_ART.spiderEyes(ctx, sp.cx, sp.cy - 6, 40, t + sp.t);
    if (pl.webT > 0) ST_ART.webWrap(ctx, pl.cx, pl.cy, 72, 104, t, Math.min(1, pl.webT));
  }
  drawCinematic(ctx, t) { // fullscreen: the escape (during the cut and behind the party)
    const e = this.escape;
    if (!e || !e.name) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (game.shake > 0) ctx.translate(rand(-1, 1) * game.shake * 12, rand(-1, 1) * game.shake * 8);
    const r = ST_ART.escapeScene(ctx, e.name, e.done ? 1 : e.k, t);
    if (r && r.jack) { const pl = game.player; ctx.save(); ctx.translate(r.jack.x, r.jack.y); ctx.scale(r.jack.s || 1, r.jack.s || 1); pl.drawBoy(ctx, 0, -54, 'grin'); ctx.restore(); }
    ctx.restore();
  }
}
