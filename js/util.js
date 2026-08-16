'use strict';
// ---------------------------------------------------------------- basics
const GAME_VERSION = '1.6.2'; // SEMVER — bump with every release (see docs/index.html + CHANGELOG.md)
const W = 1280, H = 720, TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const chance = p => Math.random() < p;
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

// power palettes
const POW = {
  none:    { c: '#f8b53c', c2: '#d98f1f', glow: '#ffdf8a' },
  fire:    { c: '#ff6b35', c2: '#d63f12', glow: '#ffb35c' },
  ice:     { c: '#7fd8ff', c2: '#3fa9e8', glow: '#d6f4ff' },
  rainbow: { c: '#ff5fa2', c2: '#8f5fff', glow: '#ffffff' },
  power:   { c: '#ffe14d', c2: '#ffa726', glow: '#fff7c2' }
};
const RAINBOW = ['#ff4d4d', '#ff9f43', '#ffe156', '#57d357', '#4aa3ff', '#b06cf0'];
const FONT = '"Comic Sans MS","Comic Sans",Chalkboard,"Segoe Print","Segoe UI",sans-serif';

// ---------------------------------------------------------------- drawing helpers
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
function outlineText(ctx, s, x, y, px, fill = '#fff', stroke = '#3a2a4a') {
  ctx.font = 'bold ' + px + 'px ' + FONT;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, px / 6.5);
  ctx.strokeStyle = stroke;
  ctx.strokeText(s, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}
function starPath(ctx, x, y, r, r2, n = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 === 0 ? r : r2;
    const a = rot + i * Math.PI / n;
    const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.32);
  ctx.bezierCurveTo(x + s * 0.5, y - s * 0.28, x + s * 1.05, y + s * 0.25, x, y + s * 0.95);
  ctx.bezierCurveTo(x - s * 1.05, y + s * 0.25, x - s * 0.5, y - s * 0.28, x, y + s * 0.32);
  ctx.closePath();
}
function drawHeartIcon(ctx, x, y, s, full, t = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (full) ctx.scale(1 + Math.sin(t * 3) * 0.04, 1 + Math.sin(t * 3) * 0.04);
  heartPath(ctx, 0, -s * 0.3, s);
  if (full) {
    const g = ctx.createLinearGradient(0, -s * 0.5, 0, s * 0.6);
    g.addColorStop(0, '#ff7d92'); g.addColorStop(1, '#ee2d55');
    ctx.fillStyle = g;
  } else ctx.fillStyle = 'rgba(60,45,80,0.35)';
  ctx.fill();
  ctx.lineWidth = s * 0.1; ctx.strokeStyle = full ? '#8e1030' : 'rgba(60,45,80,0.6)';
  ctx.stroke();
  if (full) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(-s * 0.32, -s * 0.28, s * 0.16, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- funny face
// moods: happy, grin, surprised, angry, sad, sleepy, dizzy
function drawFace(ctx, cx, cy, s, mood = 'happy', t = 0, seed = 0, px = 0, py = 0) {
  const er = s * 0.17, ex = s * 0.21, ey = -s * 0.09;
  const blink = ((t + seed * 3.7) % 3.4) < 0.13 && mood !== 'surprised' && mood !== 'dizzy';
  ctx.lineCap = 'round';
  for (const sd of [-1, 1]) {
    const x = cx + sd * ex, y = cy + ey;
    if (mood === 'dizzy') {
      ctx.strokeStyle = '#3a2a3a'; ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      ctx.moveTo(x - er * 0.7, y - er * 0.7); ctx.lineTo(x + er * 0.7, y + er * 0.7);
      ctx.moveTo(x + er * 0.7, y - er * 0.7); ctx.lineTo(x - er * 0.7, y + er * 0.7);
      ctx.stroke();
    } else if (blink || mood === 'sleepy') {
      ctx.strokeStyle = '#3a2a3a'; ctx.lineWidth = s * 0.06;
      ctx.beginPath(); ctx.moveTo(x - er, y); ctx.quadraticCurveTo(x, y + er * 0.7, x + er, y); ctx.stroke();
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, y, er * (mood === 'surprised' ? 1.18 : 1), 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a2a3a';
      ctx.beginPath();
      ctx.arc(x + clamp(px, -1, 1) * er * 0.35, y + clamp(py, -1, 1) * er * 0.35, er * 0.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x + er * 0.16, y - er * 0.2, er * 0.16, 0, TAU); ctx.fill();
    }
    if (mood === 'angry') {
      ctx.strokeStyle = '#3a2a3a'; ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.moveTo(x - sd * er * 1.1, y - er * 1.45);
      ctx.lineTo(x + sd * er * 0.9, y - er * 0.7);
      ctx.stroke();
    }
  }
  // mouth
  const my = cy + s * 0.18;
  ctx.strokeStyle = '#3a2a3a'; ctx.lineWidth = s * 0.06;
  if (mood === 'happy' || mood === 'sleepy') {
    ctx.beginPath(); ctx.arc(cx, my - s * 0.06, s * 0.19, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  } else if (mood === 'grin') {
    ctx.fillStyle = '#6b3345';
    ctx.beginPath(); ctx.arc(cx, my - s * 0.02, s * 0.2, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff8fa3';
    ctx.beginPath(); ctx.arc(cx, my + s * 0.1, s * 0.1, Math.PI, TAU); ctx.closePath(); ctx.fill();
  } else if (mood === 'surprised' || mood === 'dizzy') {
    ctx.fillStyle = '#6b3345';
    ctx.beginPath(); ctx.ellipse(cx, my + s * 0.02, s * 0.09, s * 0.13, 0, 0, TAU); ctx.fill();
  } else if (mood === 'angry' || mood === 'sad') {
    ctx.beginPath(); ctx.arc(cx, my + s * 0.18, s * 0.17, 1.18 * Math.PI, 1.82 * Math.PI); ctx.stroke();
  }
}

// ---------------------------------------------------------------- funny face block
function drawBlock(ctx, x, y, s, kind, t = 0, opts = {}) {
  const p = POW[kind] || POW.none;
  const h = s / 2;
  ctx.save();
  ctx.translate(x + h, y + h);
  if (opts.wobble) ctx.rotate(Math.sin(t * 3 + (opts.seed || 0)) * 0.07);
  if (kind === 'rainbow') {
    const g = ctx.createLinearGradient(-h, -h, h, h);
    RAINBOW.forEach((c, i) => g.addColorStop(i / (RAINBOW.length - 1), c));
    ctx.fillStyle = g;
  } else {
    const g = ctx.createLinearGradient(0, -h, 0, h);
    g.addColorStop(0, p.c); g.addColorStop(1, p.c2);
    ctx.fillStyle = g;
  }
  rr(ctx, -h, -h, s, s, s * 0.18); ctx.fill();
  ctx.strokeStyle = 'rgba(51,34,50,0.55)'; ctx.lineWidth = Math.max(2, s * 0.05);
  rr(ctx, -h, -h, s, s, s * 0.18); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  rr(ctx, -h * 0.7, -h * 0.72, s * 0.3, s * 0.18, s * 0.07); ctx.fill();
  // decorations per kind
  if (kind === 'fire') {
    ctx.fillStyle = '#ffce54';
    ctx.beginPath();
    const fh = h * (0.55 + 0.12 * Math.sin(t * 9 + (opts.seed || 0)));
    ctx.moveTo(-h * 0.28, -h); ctx.quadraticCurveTo(0, -h - fh, h * 0.05, -h - fh * 0.4);
    ctx.quadraticCurveTo(h * 0.3, -h - fh * 0.8, h * 0.3, -h); ctx.closePath(); ctx.fill();
  } else if (kind === 'ice') {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * h * 0.5 - h * 0.14, -h + 1); ctx.lineTo(i * h * 0.5, -h * 0.5); ctx.lineTo(i * h * 0.5 + h * 0.14, -h + 1);
      ctx.closePath(); ctx.fill();
    }
  } else if (kind === 'power') {
    ctx.fillStyle = '#fff';
    ctx.save(); ctx.translate(h * 0.55, -h * 0.5); ctx.scale(s / 60, s / 60);
    ctx.beginPath(); ctx.moveTo(2, -14); ctx.lineTo(-7, 2); ctx.lineTo(-1, 2); ctx.lineTo(-3, 14); ctx.lineTo(7, -2); ctx.lineTo(1, -2); ctx.closePath();
    ctx.fill(); ctx.restore();
  }
  const mood = opts.mood || ({ fire: 'grin', ice: 'sleepy', rainbow: 'happy', power: 'grin', none: 'happy' })[kind] || 'happy';
  drawFace(ctx, 0, s * 0.04, s * 0.62, mood, t, opts.seed || 1, opts.px || 0, opts.py || 0);
  ctx.restore();
}

// ---------------------------------------------------------------- keycap icons
function drawKeycap(ctx, x, y, s, glyph, t = 0, bounce = true) {
  ctx.save();
  ctx.translate(x, y + (bounce ? Math.sin(t * 4) * 3 : 0));
  ctx.fillStyle = '#fff';
  rr(ctx, -s / 2, -s / 2, s, s, s * 0.2); ctx.fill();
  ctx.strokeStyle = '#8a7fae'; ctx.lineWidth = Math.max(2.5, s * 0.07);
  rr(ctx, -s / 2, -s / 2, s, s, s * 0.2); ctx.stroke();
  ctx.fillStyle = '#5a4a86';
  const dirs = { left: Math.PI, right: 0, up: -Math.PI / 2, down: Math.PI / 2 };
  if (glyph in dirs) {
    ctx.rotate(dirs[glyph]);
    ctx.beginPath();
    ctx.moveTo(s * 0.26, 0); ctx.lineTo(-s * 0.12, -s * 0.24); ctx.lineTo(-s * 0.12, s * 0.24);
    ctx.closePath(); ctx.fill();
  } else if (glyph === 'star') {
    starPath(ctx, 0, 0, s * 0.28, s * 0.13); ctx.fill();
  }
  ctx.restore();
}
function drawSpacebar(ctx, x, y, w, t = 0, bounce = true) {
  const h = w * 0.3;
  ctx.save();
  ctx.translate(x, y + (bounce ? Math.sin(t * 4) * 3 : 0));
  ctx.fillStyle = '#fff';
  rr(ctx, -w / 2, -h / 2, w, h, h * 0.3); ctx.fill();
  ctx.strokeStyle = '#8a7fae'; ctx.lineWidth = 4;
  rr(ctx, -w / 2, -h / 2, w, h, h * 0.3); ctx.stroke();
  ctx.fillStyle = '#5a4a86';
  starPath(ctx, 0, 0, h * 0.3, h * 0.14); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- golden candy
function drawCandy(ctx, x, y, s, kind = 0, t = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 2 + kind) * 0.12);
  const gold = '#ffd24a', dark = '#c8861b';
  ctx.lineWidth = Math.max(2, s * 0.1); ctx.strokeStyle = dark;
  if (kind % 3 === 0) { // lollipop
    ctx.strokeStyle = dark; ctx.lineWidth = s * 0.14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * 0.75); ctx.stroke();
    ctx.fillStyle = gold;
    ctx.beginPath(); ctx.arc(0, -s * 0.2, s * 0.45, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.09;
    ctx.beginPath(); ctx.arc(0, -s * 0.2, s * 0.24, 0, Math.PI * 1.5); ctx.stroke();
  } else if (kind % 3 === 1) { // wrapped candy
    ctx.fillStyle = gold;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.3, 0, 0, TAU); ctx.fill();
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sd * s * 0.36, 0);
      ctx.lineTo(sd * s * 0.62, -s * 0.26); ctx.lineTo(sd * s * 0.62, s * 0.26);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(-s * 0.12, -s * 0.1, s * 0.12, s * 0.07, -0.5, 0, TAU); ctx.fill();
  } else { // gummy bear
    ctx.fillStyle = gold;
    ctx.beginPath(); ctx.ellipse(0, s * 0.1, s * 0.32, s * 0.36, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -s * 0.3, s * 0.26, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-s * 0.2, -s * 0.5, s * 0.11, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.5, s * 0.11, 0, TAU); ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(-s * 0.09, -s * 0.32, s * 0.04, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.09, -s * 0.32, s * 0.04, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- royal crown
function drawKey(ctx, cx, cy, s, t = 0, glint = true, style = 'gold') { // s ≈ total length; bow left, teeth right
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(t * 2.2) * 0.09);
  const lw = Math.max(2.5, s * 0.07);
  const dino = style === 'dino';
  ctx.strokeStyle = '#c8861b'; ctx.fillStyle = '#ffd24a'; ctx.lineWidth = lw; ctx.lineJoin = 'round';
  // shaft
  rr(ctx, -s * 0.14, -s * 0.085, s * 0.62, s * 0.17, s * 0.08); ctx.fill(); ctx.stroke();
  // teeth
  rr(ctx, s * 0.30, 0, s * 0.115, s * 0.24, s * 0.045); ctx.fill(); ctx.stroke();
  rr(ctx, s * 0.44, 0, s * 0.115, s * 0.30, s * 0.045); ctx.fill(); ctx.stroke();
  if (dino) {
    // the Dino Key: a green dino-head bow with an amber gem and a leaf sprig
    ctx.fillStyle = '#57c25c'; ctx.strokeStyle = '#2f8a3c';
    ctx.beginPath(); ctx.arc(-s * 0.30, 0, s * 0.26, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-s * 0.52, s * 0.06, s * 0.14, s * 0.10, 0, 0, TAU); ctx.fill(); ctx.stroke(); // snout
    for (const bx of [-0.34, -0.24]) { // brow bumps
      ctx.beginPath(); ctx.arc(s * bx, -s * 0.24, s * 0.07, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#3a2a3a'; // eye
    ctx.beginPath(); ctx.arc(-s * 0.40, -s * 0.08, s * 0.045, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffb35c'; ctx.strokeStyle = '#c8861b'; // amber gem
    ctx.beginPath(); ctx.arc(-s * 0.24, s * 0.05, s * 0.10, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7be07b'; // leaf sprig
    ctx.beginPath(); ctx.ellipse(-s * 0.30, -s * 0.34, s * 0.11, s * 0.05, -0.5, 0, TAU); ctx.fill();
  } else {
    // bow ring
    ctx.beginPath(); ctx.arc(-s * 0.30, 0, s * 0.26, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b06a10';
    ctx.beginPath(); ctx.arc(-s * 0.30, 0, s * 0.115, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8a5208'; ctx.lineWidth = lw * 0.7; ctx.stroke();
  }
  // sparkle glint
  if (glint) {
    const gp = (t * 0.9) % 1;
    ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + 0.5 * Math.sin(t * 5)) + ')';
    starPath(ctx, -s * 0.30 + gp * s * 0.7, -s * 0.16, s * 0.085, s * 0.035, 4);
    ctx.fill();
  }
  ctx.restore();
}
function drawCrown(ctx, cx, y, s) { // y = base of the crown band
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath();
  ctx.moveTo(cx - s, y); ctx.lineTo(cx - s, y - s * 0.55); ctx.lineTo(cx - s * 0.5, y - s * 0.28);
  ctx.lineTo(cx, y - s * 0.8); ctx.lineTo(cx + s * 0.5, y - s * 0.28);
  ctx.lineTo(cx + s, y - s * 0.55); ctx.lineTo(cx + s, y);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#c8861b'; ctx.lineWidth = Math.max(2, s * 0.13);
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = '#ff5a8a';
  ctx.beginPath(); ctx.arc(cx, y - s * 0.14, s * 0.17, 0, TAU); ctx.fill();
}

// ---------------------------------------------------------------- input
// justK mirrors justP but only for a real keyboard — TouchUI.press never sets
// it, so touch mashing can't fire the secret title combos (reset/unlock-all).
const keys = {}, justP = {}, justK = {};
const GAMEKEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];
window.addEventListener('keydown', e => {
  if (GAMEKEYS.includes(e.code)) e.preventDefault();
  if (!keys[e.code]) { justP[e.code] = true; justK[e.code] = true; }
  keys[e.code] = true;
  if (typeof AudioSys !== 'undefined') AudioSys.unlock();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
function endFrameInput() {
  for (const k in justP) delete justP[k];
  for (const k in justK) delete justK[k];
}

// ---------------------------------------------------------------- touch controls
// Appears automatically on the first touch. Two-thumb landscape layout:
// left thumb steers (left/right + duck), right thumb has a big JUMP button in
// the corner plus the star action button. Underwater the right cluster becomes
// swim up / swim down, since there is no jumping. Tapping anywhere else also
// counts as the action button, so menus ("press space") work by tapping.
const TouchUI = {
  enabled: false,
  map: {}, // touch identifier -> key code
  fsBtn: { x: W / 2, y: 44, r: 34 },
  layout() {
    const water = typeof game !== 'undefined' && game.level && game.level.water && game.state !== 'title';
    if (water) return [
      { key: 'ArrowLeft',  glyph: 'left',  x: 82,      y: H - 105, r: 54 },
      { key: 'ArrowRight', glyph: 'right', x: 220,     y: H - 105, r: 54 },
      { key: 'ArrowUp',    glyph: 'up',    x: W - 105, y: H - 238, r: 54 },
      { key: 'ArrowDown',  glyph: 'down',  x: W - 105, y: H - 98,  r: 54 },
      { key: 'Space',      glyph: 'star',  x: W - 268, y: H - 140, r: 54 }
    ];
    return [
      { key: 'ArrowLeft',  glyph: 'left',  x: 82,      y: H - 105, r: 54 },
      { key: 'ArrowRight', glyph: 'right', x: 220,     y: H - 105, r: 54 },
      { key: 'ArrowDown',  glyph: 'down',  x: 151,     y: H - 224, r: 42 },
      { key: 'ArrowUp',    glyph: 'up',    x: W - 105, y: H - 112, r: 64 },
      { key: 'Space',      glyph: 'star',  x: W - 272, y: H - 170, r: 54 }
    ];
  },
  pos(t) {
    const c = document.getElementById('game');
    const r = c.getBoundingClientRect();
    if (!r.width || !r.height) return { x: 0, y: 0 };
    return { x: (t.clientX - r.left) * W / r.width, y: (t.clientY - r.top) * H / r.height };
  },
  hit(p) {
    let best = null, bd = 1e9;
    for (const b of this.layout()) {
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < b.r * 1.45 && d < bd) { bd = d; best = b; }
    }
    return best;
  },
  isFs() {
    try { return !!(document.fullscreenElement || document.webkitFullscreenElement); } catch (e) { return false; }
  },
  fsAvailable() {
    try {
      const el = document.documentElement;
      return !!(el.requestFullscreen || el.webkitRequestFullscreen) && !this.isFs();
    } catch (e) { return false; }
  },
  goFs() {
    try {
      const el = document.documentElement;
      const fn = el.requestFullscreen || el.webkitRequestFullscreen;
      const p = fn.call(el);
      if (p && p.catch) p.catch(() => {});
      if (screen.orientation && screen.orientation.lock) {
        const lp = screen.orientation.lock('landscape');
        if (lp && lp.catch) lp.catch(() => {});
      }
    } catch (e) {}
  },
  press(k) { if (!keys[k]) justP[k] = true; keys[k] = true; },
  assign(id, k) {
    const old = this.map[id];
    if (old === k) return;
    if (old) keys[old] = false;
    if (k) { this.map[id] = k; this.press(k); } else delete this.map[id];
  },
  start(e) {
    this.enabled = true;
    if (typeof AudioSys !== 'undefined') AudioSys.unlock();
    for (const t of e.changedTouches) {
      const p = this.pos(t);
      if (this.fsAvailable() && Math.hypot(p.x - this.fsBtn.x, p.y - this.fsBtn.y) < this.fsBtn.r * 1.4) {
        this.goFs();
        continue;
      }
      // title screen: portraits and level medallions are directly tappable
      if (typeof game !== 'undefined' && game.state === 'title' && game.titleTap && game.titleTap(p)) continue;
      const b = this.hit(p);
      this.assign(t.identifier, b ? b.key : 'Space');
    }
  },
  move(e) {
    for (const t of e.changedTouches) {
      if (!(t.identifier in this.map)) continue;
      const cur = this.map[t.identifier];
      // only movement touches retarget while sliding; action taps stay taps
      if (cur === 'Space') continue;
      const b = this.hit(this.pos(t));
      if (b && b.key !== 'Space') this.assign(t.identifier, b.key);
    }
  },
  end(e) {
    for (const t of e.changedTouches) this.assign(t.identifier, null);
  }
};
window.addEventListener('touchstart', e => { e.preventDefault(); TouchUI.start(e); }, { passive: false });
window.addEventListener('touchmove', e => { e.preventDefault(); TouchUI.move(e); }, { passive: false });
window.addEventListener('touchend', e => { e.preventDefault(); TouchUI.end(e); }, { passive: false });
window.addEventListener('touchcancel', e => { TouchUI.end(e); }, { passive: false });
// mobile: ensure a proper viewport (the artifact host page may not set one)
try {
  if (!document.querySelector('meta[name="viewport"]')) {
    const m = document.createElement('meta');
    m.name = 'viewport';
    m.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
    document.head.appendChild(m);
  }
} catch (e) {}
for (const ev of ['fullscreenchange', 'webkitfullscreenchange', 'orientationchange']) {
  window.addEventListener(ev, () => {
    if (typeof fitCanvas === 'function') setTimeout(fitCanvas, 60);
  });
}
