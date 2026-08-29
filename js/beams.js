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
// orchestration on top of the kit. Filled in by the terrace configs; the
// generic lv.puzzle hooks in game.js drive update/draw/drawBack.
class FrozenObservatory {
  constructor(lv) {
    this.lv = lv;
    this.lanterns = []; this.mirrors = []; this.vents = []; this.sensors = [];
    this.beams = [];
    this.telescopeLit = false;
    this.done = false;
    this.t = rand(9);
  }
  update(dt, pl) { this.t += dt; }
  draw(ctx) {}
  drawBack(ctx, t) {}
}
