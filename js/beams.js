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
  // opts.post: draw a support post from the gem down to this ground y;
  // opts.hang: draw a hanger up to this y (e.g. the underside of a rock)
  constructor(x, y, onLit, opts = {}) {
    this.x = x; this.y = y; this.onLit = onLit || null;
    this.post = opts.post || 0; this.hang = opts.hang || 0;
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
    // starts aimed down-right so the wrong beam sizzles into the snow right
    // beside it; the three teaching bumps sweep it right -> diagonal -> UP
    this.m0 = new BeamMirror(820, 1920, 7, { groundY: 2140 });
    this.s1 = new BeamSensor(820, 1600, () => this.reward([
      [1500, 2040], [1700, 1960], [1900, 1880], [2100, 1800]], 170), { hang: 1560 });
    // ---- terrace 2: thaw (fire) + route over the rock tunnel ----
    this.fm2 = new BeamMirror(2700, 1560, 6, { frozen: true, groundY: 1780 });
    this.r2 = new BeamMirror(2700, 1300, 0, { fixed: true });
    this.s2 = new BeamSensor(3250, 1300, () => this.reward([
      [2100, 1690], [1950, 1580], [1830, 1490]], 130), { post: 1780 });
    // ---- terrace 3: the full chain (thaw -> aim -> plug the vent) ----
    this.fm3 = new BeamMirror(700, 1200, 6, { frozen: true, groundY: 1420 });
    this.m3 = new BeamMirror(900, 1200, 0, { groundY: 1420 });
    this.r3a = new BeamMirror(900, 880, 0, { fixed: true });
    this.r3b = new BeamMirror(1650, 880, 6, { fixed: true });
    this.v3 = new BeamVent(1650, 1420, 1140);
    this.s3 = new BeamSensor(1650, 1260, () => this.reward([
      [1780, 1330], [1920, 1240], [1780, 1150], [1920, 1060]], 170), { post: 1420 });
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
    // the grand alignment: one beat to savor the lit eye, then the show
    if (this.telescopeLit && !this.cutFired && !game.cut && !game.endPhase && game.state === 'play') {
      this.cutFired = true;
      game.cut = { name: 'telescope', t: 0 };
      AudioSys.sfx('fanfare');
    }
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

// ---- the observatory art pack (contact-sheet reviewed) ----
function drawBeamLantern(ctx, ln, t) {
  const pulse = 1 + Math.sin(t * 4 + ln.t) * 0.08;
  ctx.save();
  // stone pedestal
  ctx.fillStyle = '#8a7fae';
  rr(ctx, ln.x - 12, ln.y + 24, 24, 66, 5); ctx.fill();
  ctx.fillStyle = '#6a5f8e';
  rr(ctx, ln.x - 22, ln.y + 82, 44, 14, 5); ctx.fill();
  // warm halo
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#ffe156';
  ctx.beginPath(); ctx.arc(ln.x, ln.y, 42 * pulse, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  // gold cage
  ctx.fillStyle = '#e8c96a';
  rr(ctx, ln.x - 24, ln.y - 26, 48, 52, 10); ctx.fill();
  ctx.strokeStyle = '#a8873a'; ctx.lineWidth = 3;
  rr(ctx, ln.x - 24, ln.y - 26, 48, 52, 10); ctx.stroke();
  ctx.fillStyle = '#c8a84a';
  rr(ctx, ln.x - 10, ln.y - 36, 20, 12, 4); ctx.fill();
  // glowing crystal core with a cozy face
  ctx.fillStyle = '#fff3b8';
  ctx.beginPath(); ctx.arc(ln.x, ln.y, 17 * pulse, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffe156';
  ctx.beginPath(); ctx.arc(ln.x, ln.y, 12 * pulse, 0, TAU); ctx.fill();
  drawFace(ctx, ln.x, ln.y, 22, 'happy', t, ln.t);
  ctx.restore();
}
function drawBeamMirror(ctx, m, t) {
  const wob = m.shiverT > 0 ? Math.sin(m.shiverT * 40) * 4 : 0;
  const [dx, dy] = DIRS8[m.dir];
  const dl = Math.hypot(dx, dy), nx = dx / dl, ny = dy / dl;
  ctx.save();
  if (!m.fixed) {
    // post + base plate
    ctx.fillStyle = '#6a5f8e';
    rr(ctx, m.x - 8, m.y + 24, 16, m.groundY - m.y - 24, 5); ctx.fill();
    ctx.fillStyle = '#584e78';
    rr(ctx, m.x - 26, m.groundY - 12, 52, 12, 4); ctx.fill();
  } else {
    // fixed relays hang from their own little rock chip
    ctx.fillStyle = '#8d8fa0';
    rr(ctx, m.x - 22, m.y - 46, 44, 22, 8); ctx.fill();
    ctx.fillStyle = '#7a7c90';
    rr(ctx, m.x - 5, m.y - 30, 10, 12, 3); ctx.fill();
  }
  ctx.translate(m.x + wob, m.y);
  const R = m.fixed ? 24 : 32;
  const spinK = m.spinT > 0 ? Math.sin(m.spinT * 18) * 0.12 : 0;
  ctx.rotate(Math.atan2(ny, nx) + spinK);
  // pointer wedge FIRST (under the dish) — the single most important read:
  // where does this dish send the light?
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath();
  ctx.moveTo(R * 0.4, -R * 0.5); ctx.lineTo(R * 1.65, 0); ctx.lineTo(R * 0.4, R * 0.5);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 3; ctx.stroke();
  // the dish
  const g = ctx.createLinearGradient(-R, -R, R, R);
  if (m.fixed) { g.addColorStop(0, '#ffe9a8'); g.addColorStop(1, '#e8b93a'); }
  else { g.addColorStop(0, '#eaf6ff'); g.addColorStop(1, '#9fd0f0'); }
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  ctx.strokeStyle = m.fixed ? '#a8873a' : '#4a7aae'; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.68, -2.6, -1.1); ctx.stroke();
  ctx.rotate(-(Math.atan2(ny, nx) + spinK));
  // the dish's face peeks toward where it points
  if (!m.frozen) drawFace(ctx, nx * R * 0.22, ny * R * 0.22, R * 1.05, 'happy', t, m.t);
  ctx.restore();
  if (m.frozen) {
    const cb = m.crustBox();
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#cdeaff';
    rr(ctx, cb.x, cb.y, cb.w, cb.h, 16); ctx.fill();
    ctx.strokeStyle = '#7fb8e8'; ctx.lineWidth = 4;
    rr(ctx, cb.x, cb.y, cb.w, cb.h, 16); ctx.stroke();
    // icicles along the top lip
    ctx.fillStyle = '#e8f6ff';
    for (let i = 0; i < 4; i++) {
      const ix = cb.x + 12 + i * (cb.w - 24) / 3;
      ctx.beginPath();
      ctx.moveTo(ix - 6, cb.y + 2); ctx.lineTo(ix + 6, cb.y + 2); ctx.lineTo(ix, cb.y + 20 + (i % 2) * 8);
      ctx.closePath(); ctx.fill();
    }
    // sparkle glints
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(cb.x + cb.w * 0.28, cb.y + cb.h * 0.3, 4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cb.x + cb.w * 0.68, cb.y + cb.h * 0.55, 3, 0, TAU); ctx.fill();
    ctx.restore();
    // the trapped dish shivers with a brave worried face
    drawFace(ctx, m.x + wob, m.y, 34, 'sad', t, m.t);
  }
  if (m.thawT > 0) { // relieved steam
    ctx.save();
    ctx.globalAlpha = m.thawT * 0.7;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(m.x - 20 + i * 20, m.y - 40 - (1 - m.thawT) * 60 - i * 8, 10 + i * 2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}
function drawBeamVent(ctx, v, t) {
  ctx.save();
  // stone chimney with a cheeky face
  const g = ctx.createLinearGradient(v.x, v.groundY - 64, v.x, v.groundY);
  g.addColorStop(0, '#9a8fbe'); g.addColorStop(1, '#7a6f9e');
  ctx.fillStyle = g;
  rr(ctx, v.x - 34, v.groundY - 58, 68, 58, 10); ctx.fill();
  ctx.strokeStyle = '#584e78'; ctx.lineWidth = 3;
  rr(ctx, v.x - 34, v.groundY - 58, 68, 58, 10); ctx.stroke();
  ctx.fillStyle = '#584e78';
  rr(ctx, v.x - 26, v.groundY - 70, 52, 16, 6); ctx.fill();
  if (v.frozen) {
    // the whole plume frozen into a proud swirly ice sculpture
    ctx.fillStyle = '#d6f4ff';
    ctx.strokeStyle = '#8fd0f0'; ctx.lineWidth = 4;
    const h = v.groundY - 76 - v.plumeTop - 20;
    ctx.beginPath();
    ctx.moveTo(v.x - 20, v.groundY - 72);
    ctx.quadraticCurveTo(v.x - 30, v.groundY - 72 - h * 0.4, v.x - 10, v.groundY - 72 - h * 0.65);
    ctx.quadraticCurveTo(v.x + 4, v.groundY - 72 - h * 0.85, v.x - 2, v.groundY - 72 - h);
    ctx.quadraticCurveTo(v.x + 22, v.groundY - 72 - h * 0.7, v.x + 14, v.groundY - 72 - h * 0.35);
    ctx.quadraticCurveTo(v.x + 26, v.groundY - 72 - h * 0.15, v.x + 20, v.groundY - 72);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(v.x - 6, v.groundY - 72 - h * 0.6, 4, 0, TAU); ctx.fill();
    drawFace(ctx, v.x, v.groundY - 30, 34, 'happy', t, v.t);
  } else {
    drawFace(ctx, v.x, v.groundY - 30, 34, 'happy', t, v.t);
    // puffing steam clouds
    ctx.globalAlpha = 0.55; ctx.fillStyle = '#eef0fa';
    const span = v.groundY - 76 - v.plumeTop;
    for (let i = 0; i < 6; i++) {
      const k = ((t * 0.35 + i / 6) % 1);
      const py = v.groundY - 76 - k * span;
      ctx.beginPath();
      ctx.arc(v.x + Math.sin(t * 2 + i * 2.1) * 12, py, 14 + k * 10, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}
function drawBeamSensor(ctx, s, t) {
  ctx.save();
  // mount: a post down to its ledge, or a hanger up to its rock
  ctx.fillStyle = '#6a5f8e';
  if (s.post) {
    rr(ctx, s.x - 8, s.y + 16, 16, s.post - s.y - 16, 5); ctx.fill();
    ctx.fillStyle = '#584e78';
    rr(ctx, s.x - 24, s.post - 12, 48, 12, 4); ctx.fill();
    ctx.fillStyle = '#6a5f8e';
  } else if (s.hang) {
    rr(ctx, s.x - 6, s.hang, 12, s.y - s.hang - 16, 4); ctx.fill();
  } else {
    rr(ctx, s.x - 6, s.y + 16, 12, 30, 4); ctx.fill();
  }
  if (s.lit) {
    // glow rays
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(t * 0.8);
    ctx.fillStyle = 'rgba(255,225,86,0.35)';
    for (let i = 0; i < 6; i++) {
      ctx.rotate(TAU / 6);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(52, -9); ctx.lineTo(52, 9); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // the crystal gem (diamond)
  const c1 = s.lit ? '#ffe97b' : '#a8a0c8', c2 = s.lit ? '#ffc82b' : '#7a739e';
  const g = ctx.createLinearGradient(s.x, s.y - 26, s.x, s.y + 26);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - 27); ctx.lineTo(s.x + 22, s.y); ctx.lineTo(s.x, s.y + 27); ctx.lineTo(s.x - 22, s.y);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = s.lit ? '#c8861b' : '#584e78'; ctx.lineWidth = 3.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(s.x - 8, s.y - 12); ctx.lineTo(s.x, s.y - 20); ctx.stroke();
  drawFace(ctx, s.x, s.y + 2, 26, s.lit ? 'happy' : 'sleepy', t, s.t);
  ctx.restore();
}
function drawObservatoryTelescope(ctx, eye, t, lit) {
  ctx.save();
  // pivot mount on the dome floor
  ctx.fillStyle = '#584e78';
  rr(ctx, 3060, 940, 90, 60, 10); ctx.fill();
  ctx.fillStyle = '#6a5f8e';
  ctx.beginPath(); ctx.arc(3105, 935, 34, 0, TAU); ctx.fill();
  // the barrel, aimed up toward the sky slit (the eye is its lower lens)
  ctx.translate(3105, 935);
  ctx.rotate(Math.atan2(eye.y - 935, eye.x - 3105));
  const len = Math.hypot(eye.x - 3105, eye.y - 935) + 60;
  const g = ctx.createLinearGradient(0, -30, 0, 30);
  g.addColorStop(0, '#9a8fbe'); g.addColorStop(0.5, '#7a6f9e'); g.addColorStop(1, '#584e78');
  ctx.fillStyle = g;
  rr(ctx, -14, -26, len, 52, 20); ctx.fill();
  ctx.strokeStyle = '#463e60'; ctx.lineWidth = 3;
  rr(ctx, -14, -26, len, 52, 20); ctx.stroke();
  ctx.fillStyle = '#463e60';
  rr(ctx, len * 0.42, -30, 16, 60, 6); ctx.fill();
  ctx.restore();
  // the eye lens (what the grand alignment must hit)
  ctx.save();
  if (!lit) { // gentle pulsing target ring while it waits
    ctx.strokeStyle = 'rgba(255,225,86,0.6)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(eye.x, eye.y, 30 + Math.sin(t * 3) * 5, 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = lit ? '#fff3b8' : '#bfd0e8';
  ctx.beginPath(); ctx.arc(eye.x, eye.y, 22, 0, TAU); ctx.fill();
  ctx.strokeStyle = lit ? '#c8861b' : '#584e78'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(eye.x, eye.y, 22, 0, TAU); ctx.stroke();
  if (lit) {
    ctx.fillStyle = '#ffe156';
    ctx.beginPath(); ctx.arc(eye.x, eye.y, 12 + Math.sin(t * 6) * 3, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function drawObservatoryDome(ctx, t, lit) {
  // the observatory building, painted behind the deck: a proper dome with a
  // sky slit over the telescope, warm windows, and its own sleepy face
  ctx.save();
  // base building
  ctx.fillStyle = 'rgba(178,170,214,0.85)';
  rr(ctx, 2260, 620, 880, 380, 26); ctx.fill();
  // dome cap
  ctx.fillStyle = 'rgba(190,182,224,0.9)';
  ctx.beginPath(); ctx.arc(2700, 640, 440, Math.PI, 0); ctx.fill();
  // the sky slit, over the telescope's aim — glows once the telescope is lit
  ctx.fillStyle = lit ? 'rgba(255,225,86,0.5)' : 'rgba(60,50,100,0.45)';
  ctx.beginPath();
  ctx.moveTo(3010, 240); ctx.lineTo(3110, 218); ctx.lineTo(3140, 620); ctx.lineTo(3040, 630);
  ctx.closePath(); ctx.fill();
  // dome ribs
  ctx.strokeStyle = 'rgba(120,110,160,0.5)'; ctx.lineWidth = 6;
  for (const rx of [-300, -150, 0, 150]) {
    ctx.beginPath(); ctx.arc(2700, 640, 440, 0, Math.PI, true);
    ctx.moveTo(2700 + rx, 640);
    ctx.quadraticCurveTo(2700 + rx * 1.05, 400, 2700 + rx * 0.55, 245);
    ctx.stroke();
  }
  // warm little windows
  ctx.fillStyle = 'rgba(255,225,86,0.4)';
  for (const wx of [2360, 2520, 2880]) rr(ctx, wx, 760, 56, 76, 12), ctx.fill();
  // the building's sleepy face wakes up when the telescope lights
  drawFace(ctx, 2700, 800, 90, lit ? 'happy' : 'sleepy', t, 3);
  ctx.restore();
}

// ---- the telescope finale cutscene (drawn over the world, cam-anchored) ----
function drawCutsceneAlien(ctx, x, y, s, t, waving) {
  ctx.save();
  ctx.translate(x, y);
  // saucer
  ctx.fillStyle = '#b8bfd4';
  ctx.beginPath(); ctx.ellipse(0, s * 0.35, s * 0.95, s * 0.32, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#7a83a0'; ctx.lineWidth = Math.max(2, s * 0.06); ctx.stroke();
  ctx.fillStyle = 'rgba(190,232,255,0.55)';
  ctx.beginPath(); ctx.arc(0, s * 0.08, s * 0.55, Math.PI, 0); ctx.fill();
  // little green pilot
  ctx.fillStyle = '#7be07b';
  ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 0.32, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#3aa53a'; ctx.lineWidth = Math.max(2, s * 0.05); ctx.stroke();
  // antennae
  ctx.strokeStyle = '#3aa53a'; ctx.lineWidth = Math.max(2, s * 0.04); ctx.lineCap = 'round';
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sd * s * 0.14, -s * 0.3);
    ctx.quadraticCurveTo(sd * s * 0.26, -s * 0.5, sd * s * 0.3, -s * 0.55); ctx.stroke();
    ctx.fillStyle = '#ffe156';
    ctx.beginPath(); ctx.arc(sd * s * 0.3, -s * 0.55, s * 0.06, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7be07b';
  }
  drawFace(ctx, 0, -s * 0.05, s * 0.62, 'happy', t, x);
  if (waving) { // the big friendly wave
    const wa = Math.sin(t * 7) * 0.7;
    ctx.strokeStyle = '#7be07b'; ctx.lineWidth = Math.max(3, s * 0.11); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.3, s * 0.1);
    ctx.lineTo(s * 0.55 + Math.cos(wa) * s * 0.16, -s * 0.25 + Math.sin(wa) * s * 0.12);
    ctx.stroke();
  }
  ctx.restore();
}
function drawTelescopeCutscene(ctx, t) {
  const vx = game.cam.x, vy = game.cam.y;
  // dusk falls over the whole summit
  const dusk = Math.min(1, t / 1.5) * (t > 6.2 ? Math.max(0, 1 - (t - 6.2) / 0.7) : 1);
  ctx.save();
  ctx.fillStyle = `rgba(24,18,58,${0.55 * dusk})`;
  ctx.fillRect(vx, vy, W, H);
  // stars twinkle in with the dusk
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 40; i++) {
    const sx = vx + ((i * 197) % W), sy = vy + ((i * 113) % (H * 0.7));
    const tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7);
    ctx.globalAlpha = dusk * tw * 0.9;
    ctx.fillRect(sx, sy, 3, 3);
  }
  ctx.globalAlpha = 1;
  // the lens iris: what the telescope sees
  const grow = clamp((t - 1.6) / 0.9, 0, 1);
  const shrink = clamp((t - 6.1) / 0.7, 0, 1);
  const r = 280 * (grow * grow * (3 - 2 * grow)) * (1 - shrink);
  if (r > 4) {
    const cx = vx + W / 2, cy = vy + H * 0.42;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    ctx.fillStyle = '#0c0a2a';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 30; i++) {
      const sx = cx - r + ((i * 149) % (r * 2)), sy = cy - r + ((i * 83) % (r * 2));
      ctx.globalAlpha = 0.4 + 0.6 * Math.sin(t * 2.5 + i) * 0.5 + 0.3;
      ctx.fillRect(sx, sy, 2.5, 2.5);
    }
    ctx.globalAlpha = 1;
    // the twinkling green planet
    ctx.fillStyle = '#57d357';
    ctx.beginPath(); ctx.arc(cx - r * 0.35, cy + r * 0.25, r * 0.34, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3aa53a';
    ctx.beginPath(); ctx.ellipse(cx - r * 0.42, cy + r * 0.18, r * 0.1, r * 0.06, 0.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx - r * 0.26, cy + r * 0.34, r * 0.12, r * 0.07, -0.4, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(190,232,255,0.7)'; ctx.lineWidth = r * 0.04;
    ctx.beginPath(); ctx.ellipse(cx - r * 0.35, cy + r * 0.25, r * 0.5, r * 0.14, -0.35, 0, TAU); ctx.stroke();
    // the friendly saucers wave back
    const waving = t >= 3.0;
    const bob = Math.sin(t * 2.2) * r * 0.04;
    drawCutsceneAlien(ctx, cx + r * 0.3, cy - r * 0.28 + bob, r * 0.3, t, waving);
    drawCutsceneAlien(ctx, cx + r * 0.62, cy + r * 0.18 - bob, r * 0.22, t, waving);
    if (waving && chance(0.15)) {
      Particles.burst(cx + r * 0.4, cy - r * 0.1, 1, { colors: ['#ff8fb0', '#fff'], type: 'heart', sp1: 60, grav: -50, l1: 1, s1: 10 });
    }
    ctx.restore();
    // lens rim
    ctx.strokeStyle = '#ffe156'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r + 7, 0, TAU); ctx.stroke();
  }
  // the gift: a golden star beamed down the light to the dome floor
  if (t >= 5.4) {
    const k = clamp((t - 5.4) / 1.4, 0, 1), e = k * k * (3 - 2 * k);
    const gx = lerp(3230, 2600, e), gy = lerp(630, 900, e) - Math.sin(e * Math.PI) * 90;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(t * 2);
    ctx.fillStyle = '#ffd24a';
    starPath(ctx, 0, 0, 30, 13); ctx.fill();
    ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    if (chance(0.5)) Particles.burst(gx, gy, 1, { colors: ['#ffe156', '#fff'], type: 'sparkle', sp1: 60, grav: 40, l1: 0.5, s1: 8 });
  }
  ctx.restore();
}
