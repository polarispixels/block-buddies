// ARCADE MODE kit — small reusable pieces for fast arcade levels (Junkyard
// Block Bash is the first; Blaster Run is planned). Nothing here knows about
// balls or blocks. See docs/superpowers/specs/2026-09-06-junkyard-block-bash-design.md §12.

class Mods {
  constructor(onExpire) { this.m = new Map(); this.onExpire = onExpire || null; }
  add(name, dur) { const cur = this.m.get(name); if (cur) { cur.left = Math.max(cur.left, dur); cur.dur = Math.max(cur.dur, dur); } else this.m.set(name, { left: dur, dur }); }
  has(name) { return this.m.has(name); }
  left(name) { const c = this.m.get(name); return c ? c.left : 0; }
  frac(name) { const c = this.m.get(name); return c ? (c.dur === Infinity ? 1 : c.left / c.dur) : 0; }
  clear(name) { this.m.delete(name); }
  clearAll() { this.m.clear(); }
  update(dt) { for (const [n, c] of this.m) { c.left -= dt; if (c.left <= 0) { this.m.delete(n); if (this.onExpire) this.onExpire(n); } } }
  list() { return [...this.m].map(([name, c]) => ({ name, left: c.left, dur: c.dur })); }
}
class WaveRunner {
  constructor(waves, hooks = {}) { this.waves = waves; this.h = hooks; this.i = -1; this.state = 'done'; this.stateT = 0; this.stallT = 0; this.buildTime = 1.2; this.clearTime = 2; }
  start() { this.i = -1; this.next(); }
  next() {
    this.i++;
    if (this.i >= this.waves.length) { this.state = 'done'; if (this.h.onDone) this.h.onDone(); return; }
    this.state = 'build'; this.stateT = 0; this.stallT = 0;
    this.waves[this.i].build(); if (this.h.onBuild) this.h.onBuild(this.i);
  }
  pastPar() { return this.state === 'play' && this.stallT > this.waves[this.i].par; }
  skip() { if (this.state === 'play') { this.state = 'clear'; this.stateT = 0; if (this.h.onClear) this.h.onClear(this.i); } }
  update(dt) {
    if (this.state === 'done') return;
    this.stateT += dt;
    if (this.state === 'build' && this.stateT >= this.buildTime && (!this.h.isBuilt || this.h.isBuilt())) { this.state = 'play'; this.stateT = 0; if (this.h.onPlay) this.h.onPlay(this.i); }
    else if (this.state === 'play') { this.stallT += dt; if (this.h.isClear && this.h.isClear()) this.skip(); }
    else if (this.state === 'clear' && this.stateT >= this.clearTime) this.next();
  }
}
class Sequence {
  constructor(steps) { this.steps = steps; this.i = -1; this.t = 0; this.done = false; }
  update(dt) {
    if (this.done) return;
    if (this.i < 0) { this.i = 0; if (this.steps[0].enter) this.steps[0].enter(this); }
    this.t += dt;
    let s = this.steps[this.i];
    while (this.t >= s.dur) {
      if (s.tick) s.tick(1, this);
      this.t -= s.dur; this.i++;
      if (this.i >= this.steps.length) { this.done = true; return; }
      s = this.steps[this.i]; if (s.enter) s.enter(this);
    }
    if (s.tick) s.tick(this.t / s.dur, this);
  }
}
class Spawner {
  constructor(every, jitter, fire) { this.every = every; this.jitter = jitter; this.fire = fire; this.reset(); }
  reset() { this.t = this.every + rand(-this.jitter, this.jitter); }
  update(dt) { this.t -= dt; if (this.t <= 0) { this.fire(); this.reset(); } }
}
class ArcadeHud {
  constructor() { this.bannerText = null; this.bannerColor = '#ffe156'; this.bannerT = 0; this.bannerDur = 1; this.pops = []; }
  banner(text, color = '#ffe156', dur = 1.4) { this.bannerText = text; this.bannerColor = color; this.bannerT = dur; this.bannerDur = dur; }
  pop(x, y, text, color = '#fff', size = 30) { this.pops.push({ x, y, text, color, size, t: 0.9 }); }
  update(dt) { if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.bannerText = null; } for (const p of this.pops) { p.t -= dt; p.y -= 60 * dt; } this.pops = this.pops.filter(p => p.t > 0); }
  drawWorld(ctx, t) { for (const p of this.pops) { ctx.save(); ctx.globalAlpha = Math.min(1, p.t * 2); outlineText(ctx, p.text, p.x, p.y, p.size, p.color, '#3a2a4a'); ctx.restore(); } }
  drawScreen(ctx, t, chips = []) {
    if (this.bannerText) { const k = this.bannerT / this.bannerDur, pop = 1 + 0.25 * Math.max(0, 1 - (1 - k) * 6); ctx.save(); ctx.globalAlpha = Math.min(1, k * 3); ctx.translate(W / 2, 250); ctx.scale(pop, pop); outlineText(ctx, this.bannerText, 0, 0, 72, this.bannerColor, '#3a2a4a'); ctx.restore(); }
    let x = 60; for (const c of chips) { ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = '#2a2438'; ctx.beginPath(); ctx.arc(x, H - 250, 30, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ffe156'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, H - 250, 30, -Math.PI / 2, -Math.PI / 2 + TAU * c.frac); ctx.stroke(); c.icon(ctx, x, H - 250, 34); ctx.restore(); x += 74; }
  }
}
function arcadePayout(m, n, x, y) { m.payQ = (m.payQ || 0) + n; m.payX = x; m.payY = y; }
function arcadePayTick(m, dt) {
  if (!m.payQ) return;
  // a fractional accumulator (instead of ceil(dt*90)) so the payout drains at
  // a true ~90/s regardless of frame rate — ceil was rounding every single
  // frame up to at least 1, overpaying badly at high fps
  m.payAcc = (m.payAcc || 0) + dt * 90;
  const k = Math.min(m.payQ, Math.floor(m.payAcc)); m.payAcc -= k;
  m.payQ -= k; game.candy += k;
  if (Math.random() < 0.5) AudioSys.sfx('candy');
  if (Math.random() < 0.6) Particles.candyBurst(m.payX + rand(-40, 40), m.payY, 1);
}
