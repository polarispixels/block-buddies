'use strict';
// ================================================================ beam kit
// LIGHT BEAMS: the reusable beam-routing puzzle kit (BACKLOG.md item 3 /
// docs/superpowers/specs/2026-08-29-frozen-observatory-design.md). Nothing
// observatory-specific lives in the kit itself — a future level can reuse
// lanterns/mirrors/vents/sensors with its own machine class.
//
// Semantics (chosen for 5-year-old readability over optics):
//   - A MIRROR is a redirector dish: it catches ANY beam that hits it and
//     re-emits toward the direction it points. The face on the dish looks
//     where it points. Bump its underside (the buddy-block verb) to rotate
//     one 45° step counter-clockwise — 8 facings, cycles forever, every
//     wrong aim reversible. `fixed` mirrors are pre-aimed gold relays with
//     no bump solid (they keep high routing reachable-free).
//   - A FROZEN mirror is encased in an ice crust that reaches the GROUND
//     (projectiles fly at wheel height — the crust must be shootable from
//     standing). The crust blocks the beam entirely. One FIRE shot thaws
//     it forever.
//   - A VENT puffs a steam plume (vertical scatter zone) that stops any
//     beam crossing it. One ICE shot freezes it into a sculpture forever.
//   - A SENSOR lights + latches on first beam contact (machine's job).
//   - castBeams() re-raycasts everything each frame, so cause-and-effect
//     is always live and visible.

// 8 directions, index 0 = right, counter-clockwise (screen y is down).
const DIRS8 = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]];

class BeamLantern {
  constructor(x, y, dir) { this.x = x; this.y = y; this.dir = dir; this.t = rand(9); }
}

class BeamMirror {
  // (x, y) = disc center. opts: { frozen, fixed, groundY }
  constructor(x, y, dir, opts = {}) {
    this.x = x; this.y = y; this.dir = dir;
    this.frozen = !!opts.frozen;
    this.fixed = !!opts.fixed;
    this.groundY = opts.groundY || (y + 220);
    this.w = 60; this.h = 60;
    this.t = rand(9);
    this.spinT = 0;        // bump-spin animation
    this.shiverT = 0;      // frozen-bump feedback
    this.thawT = 0;        // thaw celebration
    if (!this.fixed) {
      this.solid = { x: x - 30, y: y - 30, w: 60, h: 60, beamMirror: this, skipDraw: true };
    }
  }
  box() { return { x: this.x - 30, y: this.y - 30, w: 60, h: 60 }; }
  // the ice crust: a fat pillar from just above the disc down to the ground
  crustBox() { return { x: this.x - 42, y: this.y - 46, w: 84, h: this.groundY - (this.y - 46) }; }
  rotate() {
    this.dir = (this.dir + 1) % 8;
    this.spinT = 0.35;
  }
}

class BeamVent {
  constructor(x, groundY, plumeTop) {
    this.x = x; this.groundY = groundY; this.plumeTop = plumeTop;
    this.frozen = false; this.t = rand(9); this.freezeT = 0;
  }
  plumeBox() { return { x: this.x - 26, y: this.plumeTop, w: 52, h: this.groundY - this.plumeTop }; }
}

class BeamSensor {
  constructor(x, y, onLit) {
    this.x = x; this.y = y; this.onLit = onLit || null;
    this.lit = false; this.t = rand(9); this.litT = 0;
  }
  box() { return { x: this.x - 28, y: this.y - 28, w: 56, h: 56 }; }
}

// Nearest entry of a ray (p, unit-ish dir d with components in {-1,0,1})
// into an AABB, via the slab method. Returns t (pixels along the axis
// steps; diagonals use the same t per axis so hits stay consistent) or
// Infinity when the ray misses.
function rayBox(px, py, dx, dy, b) {
  let t0 = 0, t1 = Infinity;
  if (dx === 0) { if (px < b.x || px > b.x + b.w) return Infinity; }
  else {
    let ta = (b.x - px) / dx, tb = (b.x + b.w - px) / dx;
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
  }
  if (dy === 0) { if (py < b.y || py > b.y + b.h) return Infinity; }
  else {
    let ta = (b.y - py) / dy, tb = (b.y + b.h - py) / dy;
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
  }
  if (t0 > t1 || t1 < 0.001) return Infinity;
  return Math.max(t0, 0.001);
}

// Raycast every lantern's beam through mirrors/vents/sensors/solids.
// Returns [{ pts: [[x,y],...], end: 'sensor'|'crust'|'plume'|'solid'|'loop'|'bounds'|'mirror-back',
//            sensor?, endX, endY }] — one per lantern. Pure: latching is the
// caller's job (read `end === 'sensor'` + `sensor`).
function castBeams(lanterns, mirrors, vents, sensors, solids, bounds) {
  const bw = bounds ? bounds.w : game.level.w, bh = bounds ? bounds.h : game.level.h;
  const beams = [];
  for (const ln of lanterns) {
    const pts = [[ln.x, ln.y]];
    let px = ln.x, py = ln.y, dir = ln.dir;
    let end = 'bounds', endSensor = null, skipMirror = null;
    const visited = new Set();
    for (let seg = 0; seg < 12; seg++) {
      const [dx, dy] = DIRS8[dir];
      let bestT = Infinity, bestKind = 'bounds', bestObj = null;
      for (const m of mirrors) {
        if (m === skipMirror) continue;
        const t = rayBox(px, py, dx, dy, m.frozen ? m.crustBox() : m.box());
        if (t < bestT) { bestT = t; bestKind = m.frozen ? 'crust' : 'mirror'; bestObj = m; }
      }
      for (const v of vents) {
        if (v.frozen) continue;
        const t = rayBox(px, py, dx, dy, v.plumeBox());
        if (t < bestT) { bestT = t; bestKind = 'plume'; bestObj = v; }
      }
      for (const s of sensors) {
        const t = rayBox(px, py, dx, dy, s.box());
        if (t < bestT) { bestT = t; bestKind = 'sensor'; bestObj = s; }
      }
      for (const s of solids) {
        if (s.broken || s.oneWay || s.beamMirror) continue;
        const t = rayBox(px, py, dx, dy, s);
        if (t < bestT) { bestT = t; bestKind = 'solid'; bestObj = s; }
      }
      // clip to level bounds
      let boundT = Infinity;
      if (dx > 0) boundT = Math.min(boundT, (bw - px) / dx);
      if (dx < 0) boundT = Math.min(boundT, (0 - px) / dx);
      if (dy > 0) boundT = Math.min(boundT, (bh - py) / dy);
      if (dy < 0) boundT = Math.min(boundT, (0 - py) / dy);
      if (boundT < bestT) { bestT = boundT; bestKind = 'bounds'; bestObj = null; }
      if (bestT === Infinity) { bestT = Math.max(bw, bh); bestKind = 'bounds'; }
      if (bestKind === 'mirror') {
        const m = bestObj;
        pts.push([m.x, m.y]);
        const key = mirrors.indexOf(m) + ':' + m.dir;
        if (visited.has(key)) { end = 'loop'; break; }
        visited.add(key);
        px = m.x; py = m.y; dir = m.dir; skipMirror = m;
        end = 'mirror-back'; // provisional if the segment cap runs out here
        continue;
      }
      pts.push([px + dx * bestT, py + dy * bestT]);
      end = bestKind;
      if (bestKind === 'sensor') endSensor = bestObj;
      break;
    }
    const last = pts[pts.length - 1];
    beams.push({ pts, end, sensor: endSensor, endX: last[0], endY: last[1] });
  }
  return beams;
}

// ================================================================ observatory
// THE FROZEN OBSERVATORY machine (lv.puzzle for 'mountain2') — content and
// orchestration on top of the kit. Four beam stations up the summit; every
// sensor latch is permanent (WeatherFactory bulb rule) and pushes its
// reward steps into lv.solids. Generic lv.puzzle hooks in game.js drive
// update/draw/drawBack; mirror bumps arrive via game.bumpBlock -> onMirrorBump.
class FrozenObservatory {
  constructor(lv) {
    this.lv = lv;
    this.t = rand(9);
    this.telescopeLit = false;
    this.litFlashT = 0;
    this.cutFired = false;
    // ---- terrace 1 (teach): one free mirror up to a hanging sensor ----
    this.m0 = new BeamMirror(820, 1920, 0, { groundY: 2140 });
    this.s1 = new BeamSensor(820, 1600, () => this.reward([
      [1500, 2040], [1700, 1960], [1900, 1880], [2100, 1800]], 170));
    // ---- terrace 2: thaw (fire) + route over the rock tunnel ----
    this.fm2 = new BeamMirror(2700, 1560, 6, { frozen: true, groundY: 1780 });
    this.r2 = new BeamMirror(2700, 1300, 0, { fixed: true });
    this.s2 = new BeamSensor(3250, 1300, () => this.reward([
      [2100, 1690], [1950, 1580], [1830, 1490]], 130));
    // ---- terrace 3: the full chain (thaw -> aim -> plug the vent) ----
    this.fm3 = new BeamMirror(700, 1200, 6, { frozen: true, groundY: 1420 });
    this.m3 = new BeamMirror(900, 1200, 0, { groundY: 1420 });
    this.r3a = new BeamMirror(900, 880, 0, { fixed: true });
    this.r3b = new BeamMirror(1650, 880, 6, { fixed: true });
    this.v3 = new BeamVent(1650, 1420, 1140);
    this.s3 = new BeamSensor(1650, 1260, () => this.reward([
      [1780, 1330], [1920, 1240], [1780, 1150], [1920, 1060]], 170));
    // ---- the dome: grand alignment into the telescope eye ----
    this.fm4 = new BeamMirror(2450, 780, 6, { frozen: true, groundY: 1000 });
    this.v4 = new BeamVent(2800, 1000, 540);
    this.m4 = new BeamMirror(3080, 780, 0, { groundY: 1000 });
    this.eye = new BeamSensor(3230, 630, () => { this.telescopeLit = true; });
    this.lanterns = [
      new BeamLantern(380, 1920, 0), new BeamLantern(2300, 1560, 0),
      new BeamLantern(500, 1200, 0), new BeamLantern(2100, 780, 0)
    ];
    this.mirrors = [this.m0, this.fm2, this.r2, this.fm3, this.m3, this.r3a, this.r3b, this.fm4, this.m4];
    this.vents = [this.v3, this.v4];
    this.sensors = [this.s1, this.s2, this.s3, this.eye];
    this.beams = [];
    // rotatable mirrors get bumpable solids (the buddy-block verb)
    for (const m of this.mirrors) if (m.solid) lv.solids.push(m.solid);
  }
  reward(steps, w) {
    for (const [x, y] of steps) {
      this.lv.solids.push({ x, y, w, h: 26, oneWay: true, plat: true, iceStep: true });
      Particles.burst(x + w / 2, y, 10, { colors: ['#d6f4ff', '#7fd8ff', '#fff'], type: 'sparkle', sp1: 200, l1: 0.9, s1: 9, grav: 120 });
    }
  }
  onMirrorBump(m) {
    if (m.coolT > 0) return;
    m.coolT = 0.3;
    if (m.frozen) {
      m.shiverT = 0.5;
      AudioSys.sfx('plop');
      Particles.burst(m.x, m.y, 6, { colors: ['#d6f4ff', '#fff'], type: 'sparkle', sp1: 120, l1: 0.5, s1: 7 });
      return;
    }
    m.rotate();
    AudioSys.sfx('switch');
    Particles.burst(m.x, m.y - 20, 8, { colors: ['#ffe156', '#fff'], type: 'sparkle', sp1: 150, l1: 0.5, s1: 8 });
  }
  update(dt, pl) {
    this.t += dt;
    this.litFlashT = Math.max(0, this.litFlashT - dt);
    for (const m of this.mirrors) {
      m.coolT = Math.max(0, (m.coolT || 0) - dt);
      m.spinT = Math.max(0, m.spinT - dt);
      m.shiverT = Math.max(0, m.shiverT - dt);
      m.thawT = Math.max(0, m.thawT - dt);
    }
    for (const v of this.vents) v.freezeT = Math.max(0, v.freezeT - dt);
    // ---- projectiles: fire thaws crusts, ice freezes vents ----
    for (const pr of game.projectiles) {
      if (pr.dead) continue;
      for (const m of this.mirrors) {
        if (!m.frozen || pr.hitSet.has(m)) continue;
        if (!overlaps(pr, m.crustBox())) continue;
        pr.hitSet.add(m);
        if (pr.kind === 'fire') {
          m.frozen = false; m.thawT = 1;
          AudioSys.sfx('splash'); AudioSys.sfx('collect');
          Particles.burst(m.x, (m.y + m.groundY) / 2, 18, { colors: ['#fff', '#d6f4ff', '#bfe8ff'], type: 'bubble', sp1: 160, grav: -160, l1: 0.9, s1: 10 });
          pr.impact(true);
        } else pr.impact(true); // ice/rainbow just splash on the crust, harmlessly
      }
      for (const v of this.vents) {
        if (v.frozen || pr.hitSet.has(v)) continue;
        const body = { x: v.x - 40, y: v.groundY - 70, w: 80, h: 70 };
        if (!overlaps(pr, body)) continue;
        pr.hitSet.add(v);
        if (pr.kind === 'ice') {
          v.frozen = true; v.freezeT = 1;
          AudioSys.sfx('freeze'); AudioSys.sfx('collect');
          Particles.burst(v.x, v.groundY - 60, 16, { colors: ['#d6f4ff', '#7fd8ff', '#fff'], type: 'sparkle', sp1: 200, grav: 60, l1: 0.9, s1: 10 });
          pr.impact(true);
        } else pr.impact(true); // fire into steam: a bigger, sillier puff
      }
    }
    // ---- the light itself: re-raycast every frame, latch sensors ----
    this.beams = castBeams(this.lanterns, this.mirrors, this.vents, this.sensors, this.lv.solids);
    for (const b of this.beams) {
      if (b.end === 'sensor' && !b.sensor.lit) {
        b.sensor.lit = true; b.sensor.litT = 1.2;
        this.litFlashT = 0.6;
        AudioSys.sfx('collect'); AudioSys.sfx('fanfare');
        game.shake = Math.max(game.shake, 0.25);
        Particles.burst(b.sensor.x, b.sensor.y, 18, { colors: ['#ffe156', '#ffd24a', '#fff'], type: 'star', sp1: 300, l1: 1, s1: 11, grav: 80 });
        if (b.sensor.onLit) b.sensor.onLit();
      }
      if (b.sensor && b.sensor.lit) b.sensor.litT = Math.min(1.2, (b.sensor.litT || 0) + dt);
      // the sizzle: wrong aims are funny, never punished
      if ((b.end === 'solid' || b.end === 'plume' || b.end === 'crust') && chance(8 * dt)) {
        Particles.burst(b.endX, b.endY, 2, { colors: ['#ffe156', '#fff', '#ffb347'], type: 'sparkle', sp1: 90, grav: -40, l1: 0.4, s1: 7 });
      }
    }
  }
  draw(ctx) {
    // beams first (under the hardware), then instruments — placeholder pass;
    // the real art lands with the contact-sheet task
    for (const b of this.beams) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,225,110,0.85)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.pts[0][0], b.pts[0][1]);
      for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i][0], b.pts[i][1]);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
    for (const ln of this.lanterns) drawBeamLantern(ctx, ln, this.t);
    for (const v of this.vents) drawBeamVent(ctx, v, this.t);
    for (const m of this.mirrors) drawBeamMirror(ctx, m, this.t);
    for (const s of this.sensors) if (s !== this.eye) drawBeamSensor(ctx, s, this.t);
    drawObservatoryTelescope(ctx, this.eye, this.t, this.telescopeLit);
  }
  drawBack(ctx, t) {
    drawObservatoryDome(ctx, t, this.telescopeLit);
  }
}

// ---- placeholder art pass (replaced by the reviewed art task) ----
function drawBeamLantern(ctx, ln, t) {
  ctx.save();
  ctx.fillStyle = '#8a7fae';
  rr(ctx, ln.x - 14, ln.y + 20, 28, 60, 6); ctx.fill();
  ctx.fillStyle = '#ffe156';
  ctx.beginPath(); ctx.arc(ln.x, ln.y, 20 + Math.sin(t * 4 + ln.t) * 2, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawBeamMirror(ctx, m, t) {
  ctx.save();
  const wob = m.shiverT > 0 ? Math.sin(m.shiverT * 40) * 4 : 0;
  ctx.translate(m.x + wob, m.y);
  if (!m.fixed) {
    ctx.fillStyle = '#6a5f8e';
    rr(ctx, -8, 26, 16, m.groundY - m.y - 26, 5); ctx.fill();
  }
  const ang = -m.dir * (TAU / 8) + (m.spinT > 0 ? m.spinT * 2 : 0);
  ctx.rotate(ang);
  ctx.fillStyle = m.fixed ? '#e8c96a' : '#bfe8ff';
  ctx.beginPath(); ctx.arc(0, 0, m.fixed ? 22 : 30, 0, TAU); ctx.fill();
  ctx.strokeStyle = m.fixed ? '#a8873a' : '#5a7fae'; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(10, -8); ctx.lineTo(30, 0); ctx.lineTo(10, 8); ctx.closePath(); ctx.fill();
  ctx.restore();
  if (m.frozen) {
    const cb = m.crustBox();
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#bfe4ff';
    rr(ctx, cb.x, cb.y, cb.w, cb.h, 14); ctx.fill();
    ctx.strokeStyle = '#7fb8e8'; ctx.lineWidth = 3;
    rr(ctx, cb.x, cb.y, cb.w, cb.h, 14); ctx.stroke();
    ctx.restore();
    drawFace(ctx, m.x, m.y + 50, 40, 'worried', t, m.t);
  }
}
function drawBeamVent(ctx, v, t) {
  ctx.save();
  ctx.fillStyle = '#7a6f9e';
  rr(ctx, v.x - 36, v.groundY - 60, 72, 60, 10); ctx.fill();
  if (v.frozen) {
    ctx.fillStyle = '#d6f4ff';
    rr(ctx, v.x - 24, v.plumeTop + 40, 48, v.groundY - v.plumeTop - 100, 16); ctx.fill();
  } else {
    ctx.globalAlpha = 0.5; ctx.fillStyle = '#e8e8f4';
    for (let i = 0; i < 5; i++) {
      const py = v.groundY - 70 - ((t * 60 + i * 55) % (v.groundY - v.plumeTop - 40));
      ctx.beginPath(); ctx.arc(v.x + Math.sin(t * 2 + i) * 10, py, 16 + i * 2, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}
function drawBeamSensor(ctx, s, t) {
  ctx.save();
  ctx.fillStyle = s.lit ? '#ffe156' : '#8a8fae';
  ctx.beginPath(); ctx.arc(s.x, s.y, 24, 0, TAU); ctx.fill();
  ctx.strokeStyle = s.lit ? '#c8861b' : '#5a5f7e'; ctx.lineWidth = 4; ctx.stroke();
  ctx.restore();
}
function drawObservatoryTelescope(ctx, eye, t, lit) {
  ctx.save();
  ctx.fillStyle = '#6a5f8e';
  rr(ctx, eye.x - 30, eye.y - 20, 160, 44, 14); ctx.fill();
  ctx.fillStyle = lit ? '#ffe156' : '#4a4f6e';
  ctx.beginPath(); ctx.arc(eye.x, eye.y, 20, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawObservatoryDome(ctx, t, lit) {
  ctx.save();
  ctx.fillStyle = 'rgba(160,150,200,0.35)';
  ctx.beginPath(); ctx.arc(2700, 1000, 560, Math.PI, 0); ctx.fill();
  ctx.restore();
}
