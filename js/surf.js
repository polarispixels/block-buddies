'use strict';
// ================================================================ ocean surf
// OCEAN SURF (v1.26.0): a surfboard ride off Underwater World, built on RIDE
// MODE (js/ride.js: RideMode physics + RideCourse procgen) exactly the way
// the Desert Sand Slide is. Spec: docs/superpowers/specs/2026-09-02-ocean-
// surf-design.md. Everything lives on the OceanSurf machine (lv.ride):
//   - the course (flat water, red water-ski ramps as terrain, tiny rideable
//     ripples) and its things (candy, big waves, sharks, floating chests,
//     the rainbow block, floating rocks)
//   - the WIPEOUT: waves/sharks/cannonballs/rams never hurt — the hero pops
//     off, swims after the drifting board, remounts, keeps going
//   - the MONSTER-TRUCK PIRATE BOAT encounters (enter -> shoot -> ram ->
//     leave), cannonballs with a landing target ring
//   - the KRAKEN boss you surf alongside: rocks with target rings, a
//     re-spawning rainbow block (the slide's friendship-block pattern), five
//     rainbow hits make it a friend
//   - the oversized victory: the Kraken flings the boat, scoops the hero,
//     LAUNCHES them sky-high (mash Up for flips), the island landing, the
//     giant chest, +100 candy, subWin.
// Art: js/surfart.js (SURF_ART). Phases escalate by distance ridden.

const SURF = {
  G: 620, START: 520,
  PHASES: [['learn', 2600], ['sharks', 5400], ['waves', 8200], ['pirate', 11200], ['rush', 14000]],
  BOSS_AT: 14000,                       // distance ridden when the Kraken rises
  BOAT_AT: [6800, 9400, 12000],         // encounter triggers (distance ridden)
  SPEED: { learn: 400, sharks: 440, waves: 470, pirate: 500, rush: 540, boss: 480, victory: 480 },
  BIG_CANDY: 100                        // the giant chest's payout
};

class OceanSurf {
  constructor(groundY, startX) {
    this.g = groundY; this.startX = startX;
    this.state = 'intro'; // intro -> riding <-> swim -> held -> launched -> done
    this.boardX = startX - 100;
    this.ride = new RideMode({ speed: 400, jumpVy: -780 });
    this.course = new RideCourse(startX, groundY);
    this.ramps = [];          // {x0, y0, x1, y1} for drawing the red ramps
    this.swim = null;         // {t} while the hero is off the board
    this.wipeouts = 0; this.launches = 0;
    this.boat = null; this.boatsDone = 0;
    this.balls = [];          // cannonballs {x, y, vx, vy, state, t, tx}
    this.boss = null;         // the Kraken (see startBoss)
    this.rainbowAt = 0;       // next x the friendship block may spawn at
    this.island = null;       // {x0, x1, top} once the victory course is laid
    this.chest = null;        // the giant chest on the island
    this.finaleT = 0; this.launchTricks = 0;
    this.toastT = 0; this.toastText = ''; this.candyTick = 0;
    this.tutPhase = null;
    const replay = !!(game.miniDone && game.miniDone.surf);
    this.tutDone = { jump: replay, trick: replay };
    this.t = 0;
    this.buildLearnStrip();
  }
  victory() { return !!this.boss && this.boss.state !== 'rise' && this.boss.state !== 'throw'; } // once befriended nothing can wipe you out
  phaseName() {
    if (this.boss) return this.boss.state === 'throw' || this.boss.state === 'rise' ? 'boss' : 'victory';
    const d = game.player.x - this.startX;
    for (const [name, upto] of SURF.PHASES) if (d < upto) return name;
    return 'rush';
  }
  // ---- the opening: flat water, candy, a ripple, the first red ramp ----
  buildLearnStrip() {
    const c = this.course, g = this.g;
    c.flat(320);
    this.row(c.endX - 200, 4);
    c.flat(200);
    this.ripples(3);
    c.flat(260);
    this.rampTemplate(false);
    c.flat(300);
  }
  row(x0, n) { for (let i = 0; i < n; i++) this.course.add('candy', x0 + i * 64, this.g - 70, 30, 30); }
  arc(x0, yTop, n, span = 260) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      this.course.add('candy', x0 + t * span, this.g - 60 - Math.sin(t * Math.PI) * (this.g - 60 - yTop), 30, 30);
    }
  }
  ripples(n) { const c = this.course; for (let i = 0; i < n; i++) { c.node(30, -22); c.node(30, 0); c.flat(40); } }
  rampTemplate(big) {
    const c = this.course, g = this.g;
    const rise = big ? 120 : 70, run = big ? 300 : 220, gap = big ? 340 : 240;
    const x0 = c.endX, y0 = g;
    c.node(run, -rise); c.node(14, -rise);
    this.ramps.push({ x0, y0, x1: c.endX, y1: g - rise, big });
    const lipX = c.endX;
    c.node(8, 0);                                     // the lip falls straight back to the water: a real launch
    c.flat(gap);
    this.arc(lipX + 20, g - rise - (big ? 190 : 130), big ? 6 : 4, big ? 340 : 240);
    c.flat(120);
  }
  // ---- procgen ----
  ensure(aheadX) { let guard = 0; while (this.course.endX < aheadX && guard++ < 40) this.emitTemplate(); }
  emitTemplate() {
    const c = this.course, ph = this.phaseName();
    let pool;
    if (this.state === 'launched' || this.state === 'held' || this.state === 'coast' || this.state === 'done' || ph === 'victory') pool = ['flat'];
    else if (ph === 'learn') pool = ['flatCandy', 'arc', 'ripples', 'ramp', 'flatCandy'];
    else if (ph === 'sharks') pool = ['shark', 'arc', 'ramp', 'shark', 'flatCandy', 'ripples', 'chest'];
    else if (ph === 'waves') pool = ['wave', 'rampWave', 'wave', 'arc', 'bigRamp', 'shark', 'waveCandy'];
    else if (ph === 'pirate') pool = ['wave', 'shark', 'ramp', 'chest', 'arc', 'chest', 'bigRamp'];
    else if (ph === 'rush') pool = ['wave', 'shark', 'rampWave', 'chest', 'bigRamp', 'waveCandy', 'arc', 'shark'];
    else pool = ['flatCandy', 'ramp', 'arc', 'ripples']; // boss: keep the lane open for rocks
    this.template(pool[randi(0, pool.length - 1)]);
    c.flat(Math.max(240, this.ride.speed * 0.55)); // the breather flat (reaction room scales with speed)
  }
  template(kind) {
    const c = this.course, g = this.g;
    if (kind === 'flat') c.flat(400);
    else if (kind === 'flatCandy') { c.flat(60); this.row(c.endX, 4); c.flat(300); }
    else if (kind === 'arc') { c.flat(40); this.arc(c.endX, g - 220, 5); c.flat(300); }
    else if (kind === 'ripples') this.ripples(randi(2, 4));
    else if (kind === 'ramp') this.rampTemplate(false);
    else if (kind === 'bigRamp') this.rampTemplate(true);
    else if (kind === 'wave') { c.flat(160); c.add('wave', c.endX, g - 120, 90, 120, { big: true }); this.arc(c.endX - 130, g - 250, 3, 260); c.flat(200); }
    else if (kind === 'waveCandy') { c.flat(160); c.add('wave', c.endX, g - 120, 90, 120, { big: true }); c.add('candy', c.endX + 30, g - 190, 30, 30); c.add('candy', c.endX + 30, g - 240, 30, 30); c.flat(200); }
    else if (kind === 'rampWave') { // launch the ramp to sail clean over the wave
      const rise = 90, run = 240;
      const x0 = c.endX;
      c.node(run, -rise); c.node(14, -rise);
      this.ramps.push({ x0, y0: g, x1: c.endX, y1: g - rise, big: false });
      const lipX = c.endX;
      c.node(8, 0); c.flat(312);
      c.add('wave', lipX + 150, g - 120, 90, 120, { big: true });
      this.arc(lipX + 20, g - 300, 5, 300);
      c.flat(160);
    }
    else if (kind === 'shark') { c.flat(200); c.add('shark', c.endX + 260, g - 50, 110, 50, { vx: -130, dir: -1 }); c.flat(260); }
    else if (kind === 'chest') { c.flat(120); c.add('chest', c.endX, g - 60, 70, 60, { open: false, openT: 0 }); c.flat(180); }
  }
  // ---- wipeout: off the board, swim, remount ----
  wipeout(why) {
    const pl = game.player;
    if (this.state !== 'riding' || pl.inv > 0) return false;
    this.state = 'swim'; this.swim = { t: 0, why };
    this.wipeouts++;
    this.boardX = pl.x + 150;
    pl.inv = 2.4;
    pl.setMood('dizzy', 1.4);
    this.ride.crashSlow(0.5);
    this.ride.spin = 0; this.ride.spinTarget = 0; this.ride.trickN = 0;
    this.ride.grounded = true; this.ride.vy = 0;
    AudioSys.sfx('blorp'); AudioSys.sfx('thud');
    game.shake = Math.max(game.shake, 0.18);
    Particles.burst(pl.cx, this.g, 18, { colors: ['#bfe8ff', '#fff', '#7fd8ff'], type: 'bubble', sp1: 260, grav: 400, l1: 0.8, s1: 11, up: 200 });
    return true;
  }
  remount() {
    const pl = game.player;
    this.state = 'riding'; this.swim = null;
    pl.y = this.g - pl.h; pl.inv = Math.max(pl.inv, 0.8);
    pl.setMood('grin', 1);
    AudioSys.sfx('boing'); AudioSys.sfx('powerup');
    Particles.burst(pl.cx, this.g, 12, { colors: ['#bfe8ff', '#fff'], type: 'bubble', sp1: 200, grav: 300, l1: 0.6, s1: 9, up: 150 });
  }
  toast(text) { this.toastT = 2; this.toastText = text; }
  // ---- the pirate boat ----
  spawnBoat(park) {
    const pl = game.player;
    this.boat = { x: game.cam.x + W + 320, y: this.g, state: park ? 'park' : 'enter', t: 0, shots: 0, facing: -1, fire: 0, tilt: 0, honkT: 0, spin: 0 };
    AudioSys.sfx('rev'); AudioSys.sfx('hornhit');
  }
  boatBox() { const b = this.boat; return { x: b.x - 120, y: this.g - 110, w: 240, h: 110 }; }
  fireBall() {
    const b = this.boat, pl = game.player, g = this.g;
    const T = 1.2, grav = 900;
    const x0 = b.x - 110, y0 = g - 130;
    const tx = pl.x + 140 + this.ride.speed * T; // where the hero will be (full speed: recovering riders stay ahead of it)
    const vx = (tx - x0) / T, vy = ((g - y0) - 0.5 * grav * T * T) / T;
    this.balls.push({ x: x0, y: y0, vx, vy, grav, state: 'fly', t: 0, tx, r: 22 });
    b.fire = 1; b.shots++; b.tilt = -0.12;
    AudioSys.sfx('boom'); AudioSys.sfx('whoosh');
    game.shake = Math.max(game.shake, 0.12);
    Particles.burst(x0, y0, 10, { colors: ['#ffe156', '#ff9f43', '#fff'], type: 'flame', sp1: 200, l1: 0.4, s1: 10 });
  }
  updateBoat(dt) {
    const b = this.boat, pl = game.player, g = this.g;
    if (!b) return;
    b.t += dt; b.fire = Math.max(0, b.fire - dt * 3); b.honkT = Math.max(0, b.honkT - dt);
    b.tilt += (Math.sin(b.t * 5) * 0.04 - b.tilt) * Math.min(1, dt * 6);
    const lane = pl.x + 560;
    if (b.state === 'enter') {
      b.x += (lane - b.x) * Math.min(1, dt * 2.2);
      if (b.x - lane < 40 && b.t > 1.2) { b.state = 'shoot'; b.t = 0; }
    } else if (b.state === 'shoot') {
      b.x += (lane - b.x) * Math.min(1, dt * 4);
      if (b.t > 1.4 * (b.shots + 1) - 0.6 && b.shots < 3) this.fireBall();
      if (b.shots >= 3 && b.t > 5.2) { b.state = 'rev'; b.t = 0; b.honkT = 0.9; AudioSys.sfx('rev'); AudioSys.sfx('hornhit'); }
    } else if (b.state === 'rev') { // the telegraph: it rears back and honks
      b.x += (lane + 60 - b.x) * Math.min(1, dt * 3);
      b.tilt = -0.18;
      if (b.t > 0.9) { b.state = 'ram'; b.t = 0; AudioSys.sfx('launch'); }
    } else if (b.state === 'ram') { // charges left through the hero's lane — jump it!
      b.x -= 60 * dt;
      b.tilt = 0.1 + Math.sin(b.t * 30) * 0.03;
      if (chance(0.6)) Particles.burst(b.x + 100, g, 2, { colors: ['#bfe8ff', '#fff'], type: 'bubble', sp1: 200, grav: 300, l1: 0.5, s1: 9, up: 160 });
      if (this.state === 'riding' && pl.inv <= 0 && overlaps(this.boatBox(), pl)) this.wipeout('ram');
      if (b.x < pl.x - 320) { b.state = 'leave'; b.t = 0; }
    } else if (b.state === 'leave') {
      b.x -= 340 * dt;
      if (b.x < game.cam.x - 500) { this.boat = null; this.boatsDone++; return; }
    } else if (b.state === 'park') { // waiting for the Kraken (boss phase)
      b.x += (pl.x + 700 - b.x) * Math.min(1, dt * 3);
    } else if (b.state === 'held') { // in the Kraken's tentacle
      // position is driven by the victory script
    } else if (b.state === 'flung') {
      b.x += b.fvx * dt; b.y += b.fvy * dt; b.fvy += 500 * dt; b.spin += dt * 9;
      if (b.y > g + 400 || b.t > 4) { this.boat = null; }
    }
    // cannonballs
    for (const c of this.balls) {
      c.t += dt;
      if (c.state === 'fly') {
        c.x += c.vx * dt; c.y += c.vy * dt; c.vy += c.grav * dt;
        if (c.y >= g - 10) {
          c.state = 'float'; c.y = g - 10; c.t = 0;
          AudioSys.sfx('blorp');
          Particles.burst(c.x, g, 14, { colors: ['#bfe8ff', '#fff'], type: 'bubble', sp1: 260, grav: 400, l1: 0.7, s1: 10, up: 220 });
        }
      } else if (c.state === 'float') {
        c.y = g - 10 + Math.sin(c.t * 6) * 3;
        if (c.t > 0.7) c.state = 'sunk';
      }
      if (c.state !== 'sunk' && this.state === 'riding' && pl.inv <= 0 &&
          overlaps({ x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 }, pl)) this.wipeout('cannonball');
    }
    this.balls = this.balls.filter(c => c.state !== 'sunk' && c.x > game.cam.x - 200);
  }
  // ---- the Kraken ----
  startBoss() {
    this.boss = { state: 'rise', t: 0, x: game.cam.x + W - 150, rise: 0, arm: 0, hp: 5, hitT: 0, wrongT: 0, throwT: 0, rocks: [], hold: null, tip: null };
    AudioSys.sfx('rumble'); AudioSys.sfx('roar');
    AudioSys.setMusic('boss');
    game.shake = Math.max(game.shake, 0.5);
    if (this.boat) { this.boat.state = 'park'; this.boat.t = 0; }
    this.toast('!!!');
  }
  krakenBox() { const k = this.boss; return { x: k.x - 150, y: this.g - 330 + (1 - k.rise) * 300, w: 300, h: 280 }; }
  throwRock() {
    const k = this.boss, pl = game.player, g = this.g;
    const T = 1.0, grav = 1100;
    const tip = k.tip || { x: k.x - 200, y: g - 320 };
    const tx = pl.x + 260 + this.ride.speed * T;
    const vx = (tx - tip.x) / T, vy = ((g - tip.y) - 0.5 * grav * T * T) / T;
    k.rocks.push({ x: tip.x, y: tip.y, vx, vy, grav, t: 0, tx, r: 30 });
    AudioSys.sfx('whoosh'); AudioSys.sfx('roar');
  }
  updateBoss(dt) {
    const k = this.boss, pl = game.player, g = this.g;
    if (!k) return;
    k.t += dt;
    k.hitT = Math.max(0, k.hitT - dt); k.wrongT = Math.max(0, k.wrongT - dt);
    if (k.state !== 'launch') k.x += (game.cam.x + W - 150 - k.x) * Math.min(1, dt * 5); // rides along at screen-right until the launch
    if (k.state === 'rise') {
      k.rise = Math.min(1, k.t / 1.6);
      if (chance(0.5)) Particles.burst(k.x + rand(-160, 160), g, 2, { colors: ['#bfe8ff', '#fff'], type: 'bubble', sp1: 240, grav: 400, l1: 0.7, s1: 10, up: 200 });
      if (k.t > 1.8) { k.state = 'throw'; k.t = 0; k.throwT = 0.6; }
    } else if (k.state === 'throw') {
      k.throwT -= dt;
      if (k.throwT <= 0.7 && k.throwT > 0) k.arm = Math.min(1, (0.7 - k.throwT) / 0.7); // the telegraph
      if (k.throwT <= 0) { this.throwRock(); k.arm = 0; k.throwT = 1.9; }
    } else if (k.state === 'friend') {
      k.arm = 0;
      if (k.t > 1.4) { k.state = 'boatgrab'; k.t = 0; if (!this.boat) this.spawnBoat(true); this.boat.state = 'park'; }
    } else if (k.state === 'boatgrab') {
      const b = this.boat;
      if (b) {
        if (k.t < 0.9) { b.state = 'park'; }
        else if (k.t < 2.2) { // seized: up, up, spin...
          if (b.state !== 'held') { b.state = 'held'; AudioSys.sfx('grind'); AudioSys.sfx('hornflat'); }
          const p = (k.t - 0.9) / 1.3, e = p * p;
          b.x = lerp(b.x, k.x - 60, Math.min(1, dt * 4)); b.y = g - e * 420; b.spin = p * 4; b.tilt = 0;
          k.hold = { x: b.x, y: b.y - 60 };
        } else if (b.state !== 'flung') { // ...and AWAY over the horizon
          b.state = 'flung'; b.t = 0; b.fvx = 900; b.fvy = -900; k.hold = null;
          AudioSys.sfx('whoosh'); AudioSys.sfx('cheer');
          game.shake = Math.max(game.shake, 0.3);
          Particles.burst(b.x, b.y - 60, 24, { colors: RAINBOW, type: 'star', sp1: 360, l1: 1, s1: 12, grav: 200 });
        }
      }
      if (k.t > 2.8) { k.state = 'pickup'; k.t = 0; this.state = 'held'; this.heldFrom = { x: pl.x, y: pl.y }; }
    } else if (k.state === 'pickup') {
      const p = Math.min(1, k.t / 1.3), e = p * p * (3 - 2 * p);
      const tx = k.x - 240, ty = 160;
      pl.x = lerp(this.heldFrom.x, tx, e); pl.y = lerp(this.heldFrom.y, ty, e);
      k.hold = { x: pl.cx, y: pl.y + pl.h + 6 };
      if (k.t > 1.5) { // THE LAUNCH
        k.state = 'launch'; k.t = 0; k.hold = null;
        this.state = 'launched'; this.finaleT = 0; this.launchTricks = 0;
        this.ride.grounded = false; this.ride.vy = -560; this.ride.gravity = 240; this.ride.speed = 480; this.ride.speedMul = 1;
        this.ride.spinTarget += TAU * 2; this.ride.trickN = 2;
        this.layIsland();
        AudioSys.sfx('launch'); AudioSys.sfx('cheer'); AudioSys.sfx('neigh');
        game.shake = Math.max(game.shake, 0.3);
        Particles.burst(pl.cx, pl.cy, 30, { colors: RAINBOW.concat(['#fff']), type: 'star', sp1: 420, l1: 1.2, s1: 12, grav: 100 });
      }
    } else if (k.state === 'launch') {
      k.x -= 120 * dt; // waves goodbye as the world scrolls on
    }
    // rocks: in flight they hurt; a splash leaves a floating obstacle in the lane
    for (const r of k.rocks) {
      r.t += dt; r.x += r.vx * dt; r.y += r.vy * dt; r.vy += r.grav * dt;
      if (this.state === 'riding' && pl.inv <= 0 && overlaps({ x: r.x - r.r, y: r.y - r.r, w: r.r * 2, h: r.r * 2 }, pl)) this.wipeout('rock');
      if (r.y >= g - 20) {
        r.dead = true;
        AudioSys.sfx('blorp'); game.shake = Math.max(game.shake, 0.1);
        Particles.burst(r.x, g, 16, { colors: ['#bfe8ff', '#fff'], type: 'bubble', sp1: 280, grav: 400, l1: 0.8, s1: 11, up: 240 });
        if (k.state === 'throw') this.course.add('rock', r.x - 34, g - 54, 68, 54);
      }
    }
    k.rocks = k.rocks.filter(r => !r.dead);
    // rainbow hits befriend it; anything else asks for the rainbow block
    if (k.state === 'rise' || k.state === 'throw') {
      const box = this.krakenBox();
      for (const pr of game.projectiles) {
        if (pr.dead || !overlaps(pr, box)) continue;
        pr.dead = true;
        if (pr.kind === 'rainbow') {
          k.hp--; k.hitT = 0.8;
          AudioSys.sfx('bong'); AudioSys.sfx('heart');
          Particles.burst(pr.x, pr.y, 14, { colors: RAINBOW.concat(['#ff8fb0']), type: 'heart', sp1: 220, l1: 0.9, s1: 10 });
          if (k.hp <= 0 && k.state !== 'friend') this.befriend();
        } else {
          k.wrongT = 2;
          AudioSys.sfx('plop');
          Particles.burst(pr.x, pr.y, 6, { colors: ['#fff'], type: 'sparkle', sp1: 120, l1: 0.4, s1: 8 });
        }
      }
    }
  }
  befriend() {
    const k = this.boss;
    k.state = 'friend'; k.t = 0; k.hp = 0; k.arm = 0; k.rocks = [];
    for (const th of this.course.things) if (th.kind === 'rock') th.dead = true;
    AudioSys.sfx('friend'); AudioSys.sfx('fanfare'); AudioSys.sfx('cheer');
    AudioSys.setMusic('win');
    game.shake = Math.max(game.shake, 0.25);
    this.toast('FRIENDS!');
    Particles.burst(k.x, this.g - 260, 40, { colors: RAINBOW.concat(['#ff8fb0', '#fff']), type: 'heart', sp1: 380, l1: 1.4, s1: 12, grav: 100 });
  }
  layIsland() { // the victory course: the flight (~2200 px) lands right on the island mound
    const c = this.course, g = this.g, pl = game.player;
    // where will the flight come down? solve the launch parabola for the
    // island's beach height, then put the beach's middle right there
    const vy0 = this.ride.vy, grav = this.ride.gravity, ly = pl.y, target = g - 90 - pl.h;
    const tFlight = (-vy0 + Math.sqrt(vy0 * vy0 + 2 * grav * Math.max(0, target - ly))) / grav;
    const x0 = pl.x + this.ride.speed * tFlight - 620;
    // cut the procgen course short of the island and clear its lane
    c.nodes = c.nodes.filter(n => n.x < x0 - 10);
    c.nodes.push({ x: x0 - 10, y: g });
    c.gi = Math.min(c.gi, c.nodes.length - 2);
    c.things = c.things.filter(th => th.x < pl.x + 300);
    this.ramps = this.ramps.filter(r => r.x1 < pl.x + 300);
    c.node(320, -90);
    c.node(1000, -90);
    c.node(320, 0);
    this.island = { x0, x1: c.endX, top: g - 90, mid: x0 + 320 + 500 };
    this.chest = { x: this.island.mid + 300, open: false, openT: 0, paid: false };
    c.flat(2400);
  }
  // ---- per-frame heart (called from Player.update while riding) ----
  updatePlayer(pl, dt) {
    this.t += dt; pl.t += dt;
    const g = this.g;
    if (this.toastT > 0) this.toastT -= dt;
    // ---- the two freeze-frame lessons, straight from the slide ----
    if (this.tutPhase) {
      if (justP.ArrowUp) {
        if (this.tutPhase === 'jump') { this.ride.grounded = false; this.ride.vy = this.ride.jumpVy; AudioSys.sfx('jump'); }
        else { this.ride.trickN++; this.ride.spinTarget += TAU; AudioSys.sfx('flap'); Particles.burst(pl.cx, pl.cy, 8, { colors: RAINBOW, type: 'sparkle', sp1: 180, l1: 0.6, s1: 9 }); }
        this.tutPhase = null;
      }
      return;
    }
    if (this.state === 'riding' && !this.tutDone.jump && pl.x > this.startX + 90) { this.tutDone.jump = true; this.tutPhase = 'jump'; AudioSys.sfx('switch'); return; }
    if (this.tutDone.jump && !this.tutDone.trick && !this.ride.grounded && this.ride.vy > -140 && this.ride.vy < 80 && this.state === 'riding') { this.tutDone.trick = true; this.tutPhase = 'trick'; AudioSys.sfx('switch'); return; }
    if (pl.inv > 0) pl.inv -= dt;
    if (pl.moodT > 0) pl.moodT -= dt; else pl.mood = 'happy';
    pl.squash = lerp(pl.squash, 1, 1 - Math.exp(-9 * dt));
    if (this.state !== 'launched' && this.state !== 'held') this.ride.speed = SURF.SPEED[this.phaseName()] || 450;
    this.ensure(pl.x + W * 2);
    // ---- the boss trigger + the friendship block re-spawner ----
    if (!this.boss && pl.x - this.startX > SURF.BOSS_AT) this.startBoss();
    if (this.boss && (this.boss.state === 'rise' || this.boss.state === 'throw') && pl.power !== 'rainbow' && pl.x > this.rainbowAt &&
        !this.course.things.some(th => th.kind === 'rainbow' && !th.dead && th.x > pl.x)) {
      this.course.add('rainbow', pl.x + 720, g - 120, 44, 44);
      this.rainbowAt = pl.x + 900;
    }
    // ---- boat encounters ----
    const d = pl.x - this.startX;
    if (!this.boat && !this.boss && this.boatsDone < SURF.BOAT_AT.length && d > SURF.BOAT_AT[this.boatsDone]) {
      this.spawnBoat(false);
      this.rampTemplate(false); // a ramp near every encounter: sail over the trouble
      this.course.flat(300);
    }
    if (this.state === 'held') { // in the tentacle: the script moves the hero
      this.updateBoat(dt); this.updateBoss(dt);
      return;
    }
    if (this.state === 'swim') { // ---- the funny part: paddle after the board ----
      const sw = this.swim;
      sw.t += dt;
      const sp = this.ride.speed * this.ride.speedMul;
      this.boardX += sp * 0.62 * dt;
      pl.x += sp * 0.92 * dt;
      pl.vx = sp * 0.92; pl.vy = 0;
      pl.y = g - pl.h + 34 + Math.sin(sw.t * 7) * 5;
      if (this.ride.speedMul < 1) this.ride.speedMul = Math.min(1, this.ride.speedMul + dt * 0.9);
      if (chance(0.5)) Particles.burst(pl.x + rand(0, pl.w), g + 4, 1, { colors: ['#fff', '#bfe8ff'], type: 'bubble', sp1: 120, grav: 200, l1: 0.5, s1: 8, up: 80 });
      if (pl.x + pl.w / 2 >= this.boardX - 16 || sw.t > 2.6) this.remount();
      this.things(pl, dt);
      this.updateBoat(dt); this.updateBoss(dt);
      return;
    }
    const ev = this.ride.step(pl, dt, x => this.course.groundY(x));
    if (ev.launched && this.state === 'riding') { // a red ramp: launch HIGH (the terrain's own lip speed is tiny)
      this.launches++;
      const r = this.ramps.find(rp => Math.abs(rp.x1 - pl.x - pl.w / 2) < 60);
      this.ride.vy = Math.min(this.ride.vy, r && r.big ? -860 : -660);
      AudioSys.sfx('launch');
      Particles.burst(pl.cx, pl.y + pl.h, 10, { colors: ['#fff', '#bfe8ff'], type: 'bubble', sp1: 220, grav: 300, l1: 0.6, s1: 9, up: 160 });
    }
    if (ev.landed) {
      if (this.state === 'launched') { // splashdown (or the island itself): coast to the beach
        this.state = 'coast'; this.ride.gravity = 1500; this.ride.speed = 480;
        AudioSys.sfx('land'); AudioSys.sfx('cheer');
        this.toast(this.launchTricks + ' TRICKS!');
        game.candy += Math.min(20, this.launchTricks);
        Particles.burst(pl.cx, pl.y + pl.h, 20, { colors: ['#bfe8ff', '#fff'], type: 'bubble', sp1: 260, l1: 0.8, s1: 10, grav: 400, up: 200 });
      } else if (ev.tricks >= 3) {
        game.candy += ev.tricks >= 5 ? 3 : 1;
        AudioSys.sfx('cheer'); AudioSys.sfx('candy');
        this.toast(ev.tricks + 'x TRICKS!');
        Particles.burst(pl.cx, pl.y, 16, { colors: RAINBOW, type: 'confetti', sp1: 300, l0: 0.8, l1: 1.6, s1: 10, grav: 300, up: 220 });
      }
    }
    if (this.state === 'coast' && this.island && pl.x > this.island.x0 + 340) { // ---- the island! ----
      this.state = 'done'; this.ride.speed = 0;
      game.level.solids.push({ x: this.island.x0 + 300, y: this.island.top, w: 1040, h: 300, sand: true, skipDraw: true });
      pl.x = clamp(pl.x, this.island.x0 + 360, this.island.x0 + 900);
      pl.y = this.island.top - pl.h; pl.vx = 0; pl.vy = 0;
      AudioSys.sfx('land'); AudioSys.sfx('fanfare');
      game.shake = Math.max(game.shake, 0.25);
      Particles.burst(pl.cx, pl.y + pl.h, 20, { colors: ['#f0cc8a', '#fff'], type: 'block', sp1: 260, l1: 0.8, s1: 10, grav: 600, up: 160 });
    }
    if (this.state === 'launched') { // the flight of a lifetime: auto flips + mash for more
      const prevT = this.finaleT;
      this.finaleT += dt;
      for (const beat of [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5]) {
        if (prevT < beat && this.finaleT >= beat) { this.ride.trickN++; this.ride.spinTarget += TAU; AudioSys.sfx(beat >= 2 ? 'neigh' : 'flap'); }
      }
      this.launchTricks = this.ride.trickN;
      Particles.burst(pl.cx - 30, pl.cy, 2, { colors: RAINBOW, type: 'star', sp1: 90, l0: 0.5, l1: 1.1, s1: 9, grav: 60, up: 0 });
    }
    this.things(pl, dt);
    this.updateBoat(dt);
    this.updateBoss(dt);
    if (this.ride.grounded && this.state === 'riding' && chance(0.6)) {
      Particles.burst(pl.x - 6, g + 2, 1, { colors: ['#fff', '#bfe8ff'], sp1: 110, l1: 0.35, grav: 260, up: 60, s1: 6 });
    }
  }
  things(pl, dt) {
    const camX = game.cam.x, g = this.g;
    for (const th of this.course.things) {
      th.t += dt;
      if (th.kind === 'shark' && th.x < camX + W + 200 && !th.friendly) th.x += th.vx * dt;
      if (th.kind === 'chest' && th.open) th.openT = Math.min(1, th.openT + dt * 2);
      if (th.dead) continue;
      if (!overlaps(th, pl)) continue;
      if (th.kind === 'candy') { th.dead = true; game.candy++; AudioSys.sfx('candy'); Particles.burst(th.x + 15, th.y + 15, 5, { colors: ['#ffd24a', '#fff'], type: 'sparkle', sp1: 130, l1: 0.4, s1: 8 }); }
      else if (th.kind === 'rainbow') {
        th.dead = true; pl.power = 'rainbow';
        AudioSys.sfx('rainbow'); this.toast('RAINBOW!');
        Particles.burst(th.x + 22, th.y + 22, 14, { colors: RAINBOW, type: 'star', sp1: 240, l1: 0.8, s1: 10 });
      }
      else if (th.kind === 'chest' && !th.open) {
        th.open = true; th.openT = 0;
        game.candy += 6;
        AudioSys.sfx('chest'); AudioSys.sfx('candy');
        pl.setMood('grin', 1);
        Particles.candyBurst(th.x + 35, th.y, 8);
        Particles.burst(th.x + 35, th.y + 10, 12, { colors: ['#ffe156', '#fff'], type: 'star', sp1: 260, l1: 0.8, s1: 11, grav: 200 });
      }
      else if (th.friendly) continue;
      else if (this.state === 'riding' && pl.inv <= 0 && !this.victory() && (th.kind === 'wave' || th.kind === 'shark' || th.kind === 'rock')) {
        if (this.wipeout(th.kind)) th.wob = 0.5;
      }
    }
    // shots vs sharks: rainbow makes a friend (it flips over and waves)
    for (const pr of game.projectiles) {
      if (pr.dead) continue;
      for (const th of this.course.things) {
        if (th.dead || th.friendly || th.kind !== 'shark' || !overlaps(pr, th)) continue;
        pr.dead = true;
        if (pr.kind === 'rainbow') {
          th.friendly = true; game.candy += 2;
          AudioSys.sfx('friend'); AudioSys.sfx('candy');
          Particles.burst(th.x + 55, th.y, 12, { colors: RAINBOW.concat(['#ff8fb0']), type: 'heart', sp1: 180, l1: 0.9, s1: 10 });
        } else { th.wob = 0.5; AudioSys.sfx('plop'); }
      }
    }
    for (const th of this.course.things) if (th.wob > 0) th.wob = Math.max(0, th.wob - dt);
    this.course.cleanup(camX - 400);
    this.ramps = this.ramps.filter(r => r.x1 > camX - 400);
  }
  // ---- board pickup on the beach (state 'intro') ----
  updateIntro(dt, pl) {
    this.t += dt;
    if (this.toastT > 0) this.toastT -= dt;
    if (Math.abs(pl.cx - this.boardX) < 60 && pl.y + pl.h > this.g - 140) {
      this.state = 'riding';
      const wall = game.level.solids.find(s => s.surfWall);
      if (wall) wall.broken = true;
      pl.x = Math.max(pl.x, this.startX - 100); pl.y = this.g - pl.h;
      AudioSys.sfx('powerup'); AudioSys.sfx('launch');
      this.toast('SURF!');
      Particles.burst(this.boardX, this.g - 40, 20, { colors: ['#7fd8ff', '#fff', '#ffe156'], type: 'confetti', sp1: 320, l0: 0.8, l1: 1.6, s1: 11, grav: 300, up: 240 });
    }
  }
  // ---- the island chest: Space opens it, +100 candy, then the party ----
  updateIsland(dt, pl) {
    this.t += dt;
    if (this.toastT > 0) this.toastT -= dt;
    this.updateBoss(dt); this.updateBoat(dt);
    const ch = this.chest;
    if (!ch) return;
    if (ch.open) {
      ch.openT = Math.min(1, ch.openT + dt * 1.2);
      if (!ch.paid && ch.openT >= 0.5) {
        ch.paid = true; this.candyTick = 0;
        AudioSys.sfx('fanfare'); AudioSys.sfx('cheer');
        game.shake = Math.max(game.shake, 0.4);
        Particles.candyBurst(ch.x, this.island.top - 120, 40);
        Particles.burst(ch.x, this.island.top - 100, 40, { colors: RAINBOW.concat(['#ffe156']), type: 'star', sp1: 460, l0: 1, l1: 2, s1: 13, grav: 300, up: 200 });
      }
      if (ch.paid && this.candyTick < SURF.BIG_CANDY) { // the counter rolls up
        const step = Math.min(SURF.BIG_CANDY - this.candyTick, Math.ceil(dt * 90));
        this.candyTick += step; game.candy += step;
        if (chance(0.5)) AudioSys.sfx('candy');
        if (this.candyTick >= SURF.BIG_CANDY) game.subWin();
      }
    } else if (justP.Space && Math.abs(pl.cx - ch.x) < 200) {
      ch.open = true;
      AudioSys.sfx('chest');
    }
  }
  // ---- drawing ----
  drawBack(ctx, t) {
    const camX = game.cam.x, g = this.g;
    const x0 = camX - 60, x1 = camX + W + 60;
    SURF_ART.sun(ctx, camX + 1080, 110, 52, t);
    for (let i = 0; i < 3; i++) SURF_ART.gull(ctx, camX + 200 + i * 380 + Math.sin(t * 0.7 + i) * 40, 150 + i * 40 + Math.sin(t * 1.3 + i) * 12, 18, t + i);
    // the sea follows the ripples but never climbs a ramp (ramps are decks ABOVE the water)
    SURF_ART.sea(ctx, x0, x1, x => { const y = this.course.groundY(x); return y < g - 30 ? g : y; }, t, H + 260);
    if (camX < SURF.START + 200) { // the beach: sand sloping into the surf
      ctx.beginPath();
      ctx.moveTo(-100, g); ctx.lineTo(SURF.START - 40, g); ctx.quadraticCurveTo(SURF.START + 60, g + 4, SURF.START + 160, g + 40);
      ctx.lineTo(SURF.START + 160, H + 260); ctx.lineTo(-100, H + 260); ctx.closePath();
      const sg = ctx.createLinearGradient(0, g, 0, g + 200);
      sg.addColorStop(0, '#f6dea0'); sg.addColorStop(1, '#d9b46a');
      ctx.fillStyle = sg; ctx.fill();
      ctx.strokeStyle = '#e8c890'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-100, g); ctx.lineTo(SURF.START - 40, g); ctx.stroke();
    }
    if (this.island && this.island.x1 > camX - 100 && this.island.x0 < camX + W + 100) {
      const is = this.island;
      ctx.beginPath();
      ctx.moveTo(is.x0, g + 30);
      for (let x = is.x0; x <= is.x1; x += 20) ctx.lineTo(x, this.course.groundY(x));
      ctx.lineTo(is.x1, g + 30);
      ctx.closePath();
      const gr = ctx.createLinearGradient(0, g - 90, 0, g + 30);
      gr.addColorStop(0, '#f6dea0'); gr.addColorStop(1, '#d9b46a');
      ctx.fillStyle = gr; ctx.fill();
      SURF_ART.island(ctx, is.x0, g, is.x1 - is.x0, t);
    }
  }
  draw(ctx, t) {
    const camX = game.cam.x, g = this.g, pl = game.player;
    if (this.state === 'intro') {
      SURF_ART.surfboard(ctx, this.boardX, g - 18 + Math.sin(this.t * 3) * 4, 110, this.t);
      ctx.save(); ctx.globalAlpha = 0.45 + 0.25 * Math.sin(this.t * 4); ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.ellipse(this.boardX, g - 16, 76, 30, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    for (const r of this.ramps) if (r.x1 > camX - 100 && r.x0 < camX + W + 100) SURF_ART.skiRamp(ctx, r.x0, r.y0, r.x1, r.y1, t);
    for (const th of this.course.things) {
      if (th.dead || th.x + th.w < camX - 100 || th.x > camX + W + 100) continue;
      const wob = th.wob > 0 ? Math.sin(th.wob * 40) * 4 : 0;
      if (th.kind === 'candy') { ctx.save(); ctx.translate(th.x + 15, th.y + 15 + Math.sin(th.t * 3) * 4); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill(); ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-4, -4, 4, 0, TAU); ctx.fill(); ctx.restore(); }
      else if (th.kind === 'wave') SURF_ART.wave(ctx, th.x + th.w / 2 + wob, g, 150, th.h, th.t, { big: true, mood: th.wob > 0 ? 'dizzy' : 'surprised' });
      else if (th.kind === 'shark') SURF_ART.shark(ctx, th.x + th.w / 2 + wob, g, th.w, th.t, { friendly: !!th.friendly, dir: th.friendly ? 1 : th.dir });
      else if (th.kind === 'chest') SURF_ART.chestFloat(ctx, th.x + th.w / 2, g, th.w, th.t, { open: !!th.open, openT: th.openT || 0 });
      else if (th.kind === 'rainbow') drawBlock(ctx, th.x, th.y + Math.sin(th.t * 3) * 5, 44, 'rainbow', th.t, { wobble: true });
      else if (th.kind === 'rock') SURF_ART.rock(ctx, th.x + th.w / 2 + wob, g - 22 + Math.sin(th.t * 4) * 3, 30, th.t);
    }
    // the ride's tiny ripples are terrain; big waves are things (above)
    // cannonballs, target rings, rocks
    for (const c of this.balls) {
      if (c.state === 'fly') SURF_ART.target(ctx, c.tx, g, 34, t);
      SURF_ART.cannonball(ctx, c.x, c.y, c.r, c.t);
    }
    if (this.boss) for (const r of this.boss.rocks) { SURF_ART.target(ctx, r.tx, g, 40, t); SURF_ART.rock(ctx, r.x, r.y, r.r, r.t); }
    // the pirate boat
    if (this.boat) {
      const b = this.boat;
      ctx.save();
      if (b.state === 'held' || b.state === 'flung') { ctx.translate(b.x, b.y - 60); ctx.rotate(b.spin); ctx.translate(-b.x, -(b.y - 60)); }
      SURF_ART.pirateBoat(ctx, b.x, b.y, 1, b.t, { facing: b.state === 'leave' ? -1 : -1, mood: b.state === 'held' || b.state === 'flung' ? 'dizzy' : b.honkT > 0 ? 'angry' : 'angry', fire: b.fire, tilt: b.tilt });
      ctx.restore();
      if (b.honkT > 0) outlineText(ctx, 'HONK!', b.x, g - 240 + Math.sin(t * 20) * 4, 40, '#ffe156', '#5a2a1a');
    }
    // the Kraken
    if (this.boss) {
      const k = this.boss;
      const mood = k.state === 'friend' || k.state === 'boatgrab' || k.state === 'pickup' || k.state === 'launch' ? 'happy' : k.hitT > 0 ? 'dizzy' : 'angry';
      const res = SURF_ART.kraken(ctx, k.x, g, 360, t, { mood, rise: k.rise, arm: k.arm, hold: k.hold });
      k.tip = res && res.tip ? res.tip : null;
      if (k.state === 'rise' || k.state === 'throw') {
        for (let i = 0; i < 5; i++) drawHeartIcon(ctx, k.x - 88 + i * 44, g - 360 + Math.sin(t * 3 + i) * 3, 26, i < k.hp, 0);
        if (k.wrongT > 0) { // "use the RAINBOW block" — the bosses' hint bubble
          const hy = g - 430 + Math.sin(t * 6) * 6;
          ctx.fillStyle = 'rgba(255,255,255,0.92)';
          ctx.beginPath(); ctx.arc(k.x, hy, 40, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.moveTo(k.x - 10, hy + 36); ctx.lineTo(k.x, hy + 58); ctx.lineTo(k.x + 12, hy + 34); ctx.closePath(); ctx.fill();
          drawBlock(ctx, k.x - 26, hy - 26, 52, 'rainbow', t);
        }
      }
      if (k.state === 'friend' && chance(0.2)) Particles.burst(k.x + rand(-150, 150), g - rand(100, 380), 1, { colors: ['#ff5fa2', '#ff8fb0'], type: 'heart', sp1: 60, grav: -40, l1: 1, s1: 9, up: 0 });
    }
    // the giant chest on the island
    if (this.chest && this.island) {
      const ch = this.chest;
      SURF_ART.giantChest(ctx, ch.x, this.island.top, 2.4, t, { open: ch.open, openT: ch.openT });
      if (!ch.open && this.state === 'done' && Math.abs(pl.cx - ch.x) < 260) drawSpacebar(ctx, ch.x, this.island.top - 300 + Math.sin(t * 3) * 5, 130, t);
      if (ch.paid) outlineText(ctx, '+' + this.candyTick, ch.x, this.island.top - 330 - Math.min(60, this.candyTick), 64 + Math.min(20, this.candyTick / 4), '#ffe156', '#5a2a1a');
    }
    // toasts + the freeze-frame lessons (the slide's exact language)
    if (this.toastT > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, this.toastT * 2);
      outlineText(ctx, this.toastText, pl.cx, pl.y - 54 - (2 - this.toastT) * 18, 34, '#ffe156', '#5a4a86');
      ctx.restore();
    }
    if (this.tutPhase) {
      const bx = pl.cx, by = pl.y - 96 + Math.sin(this.t * 3) * 5;
      ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#1a1030'; ctx.fillRect(game.cam.x, game.cam.y, W, H); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      rr(ctx, bx - 118, by - 52, 236, 104, 18); ctx.fill();
      ctx.strokeStyle = '#8a7fae'; ctx.lineWidth = 4;
      rr(ctx, bx - 118, by - 52, 236, 104, 18); ctx.stroke();
      drawKeycap(ctx, bx - 58, by, 58, 'up', this.t);
      outlineText(ctx, this.tutPhase === 'jump' ? 'JUMP!' : 'TRICK!', bx + 38, by, 36, this.tutPhase === 'jump' ? '#57d357' : '#ff5fa2', '#3a2a4a');
    }
  }
  // the rider: board underfoot while riding/launched, the swim while off it
  drawRider(ctx, t) {
    const pl = game.player, rm = this.ride, g = this.g;
    if (this.state === 'done' || this.state === 'intro') { pl.draw(ctx); return; }
    if (this.state === 'swim') {
      SURF_ART.surfboard(ctx, this.boardX, g - 14 + Math.sin(t * 5) * 4, 110, t);
      pl.draw(ctx);
      // the water band over the paddling hero's legs
      ctx.save();
      ctx.fillStyle = 'rgba(80,200,230,0.6)';
      ctx.beginPath(); ctx.ellipse(pl.cx, g + 30, pl.w * 0.9, 34, 0, 0, TAU); ctx.fill();
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(pl.cx, pl.cy);
    ctx.rotate(rm.spin);
    if (rm.trickN >= 3) ctx.translate(0, -6 - Math.sin(game.t * 12) * 4);
    ctx.translate(-pl.cx, -pl.cy);
    SURF_ART.surfboard(ctx, pl.cx, pl.y + pl.h + 4, 110, t);
    pl.draw(ctx);
    ctx.restore();
    if (rm.trickN >= 4 && chance(0.5)) Particles.burst(pl.cx, pl.cy, 2, { colors: RAINBOW, type: 'star', sp1: 120, l1: 0.5, s1: 8 });
  }
}
