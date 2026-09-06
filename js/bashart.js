'use strict';
// BASH_ART: art pack for JUNKYARD BLOCK BASH (Arcade Mode #1, v1.29.0)
// (docs/superpowers/specs/2026-09-06-junkyard-block-bash-design.md §5, §8, §10, §11)
//
// Same house style as js/surfart.js / js/stationart.js: pure procedural
// drawing, every function takes ctx + explicit world/screen coordinates and
// reads nothing but its own arguments, save()/restore()s around its own
// work, defaults t=0. Nothing here reads `game` or `BB` (js/blockbash.js
// loads AFTER this file) — arena geometry the art needs to know about
// (walls x 0/1240, rail y 60-92, floor y 600-720) is hardcoded here to match
// shared.md verbatim.
//
// Look: bright junkyard-carnival colours, chunky rounded shapes, a big
// cartoon face on absolutely everything (blocks, ball, tires, the crane
// magnet, the junkbot, the cabinet door) — no gore, nothing menacing, every
// "hazard" (boom fuse, crusher jaws) reads as silly rather than scary.

// ---------------------------------------------------------------- palette
const BB_TIRE_DARK = '#26262e', BB_TIRE_MID = '#34343e', BB_TIRE_RIM = '#8a90a0', BB_TIRE_HUB = '#c7cbd6';
const BB_METAL = '#7f8aa0', BB_METAL2 = '#4f5870', BB_METAL_DARK = '#333c4a';
const BB_CANDY_PINK = '#ff7fbf', BB_CANDY_PINK2 = '#d9569a';
const BB_DRUM = '#e0463a', BB_DRUM2 = '#a8271e', BB_DRUM_BAND = '#ffd23a';
const BB_TOOLBOX = '#ffd23a', BB_TOOLBOX2 = '#d9a91a';
const BB_RUST = '#8a6a4a', BB_RUST2 = '#5a4530';

// deterministic pseudo-random in [0,1) from an integer index (no per-frame Math.random)
function bbHash(i) { const v = Math.sin(i * 12.9898 + 4.1414) * 43758.5453; return v - Math.floor(v); }
function bbHash2(i) { const v = Math.sin(i * 78.233 + 1.7128) * 12543.231; return v - Math.floor(v); }
// darken a "#rrggbb" hex string by factor f (0..1) for gradient bottoms
function bbShade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// ---------------------------------------------------------------- shared tire
// A rolling tire with tread blocks, a hubcap + spokes, and an optional face.
function bbTire(ctx, cx, cy, r, rot = 0, mood = null, t = 0, seed = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  const g = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.15, 0, 0, r);
  g.addColorStop(0, BB_TIRE_MID); g.addColorStop(1, BB_TIRE_DARK);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.fillStyle = BB_TIRE_DARK;
  const n = 10;
  for (let i = 0; i < n; i++) {
    ctx.save(); ctx.rotate((i / n) * TAU);
    ctx.fillRect(-r * 0.07, -r * 0.98, r * 0.14, r * 0.18);
    ctx.restore();
  }
  ctx.fillStyle = BB_TIRE_RIM;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.56, 0, TAU); ctx.fill();
  ctx.strokeStyle = BB_TIRE_DARK; ctx.lineWidth = Math.max(2, r * 0.06); ctx.stroke();
  ctx.strokeStyle = BB_TIRE_RIM; ctx.lineWidth = Math.max(2, r * 0.06);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); ctx.stroke();
  }
  ctx.fillStyle = BB_TIRE_HUB;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, TAU); ctx.fill();
  if (mood) drawFace(ctx, 0, 0, r * 0.6, mood, t, seed);
  ctx.restore();
}

const BASH_ART = {

  // ---------------------------------------------------------------- 1
  // Full 1280x720 dusk junkyard: sky, junk hills, crusher + forklift with
  // faces in the back, hanging chains. World-space background layer.
  backdrop(ctx, t = 0) {
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, 620);
    g.addColorStop(0, '#2e2350'); g.addColorStop(0.45, '#6a3f6b'); g.addColorStop(0.78, '#c9633f'); g.addColorStop(1, '#ffcf7a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 620);
    ctx.fillStyle = 'rgba(255,223,140,0.85)';
    ctx.beginPath(); ctx.arc(1040, 470, 68, 0, TAU); ctx.fill();
    bbJunkHills(ctx, 560, '#4a2f55', 0.9, 12);
    bbJunkHills(ctx, 610, '#2c1f3c', 1, 16);
    ctx.strokeStyle = 'rgba(20,16,28,0.55)'; ctx.lineWidth = 5;
    for (const cx of [150, 420, 860, 1120]) {
      const sway = Math.sin(t * 1.1 + cx) * 6;
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.quadraticCurveTo(cx + sway, 60, cx + sway * 1.4, 150); ctx.stroke();
    }
    bbCrusher(ctx, 190, 560, t);
    bbForklift(ctx, 1080, 585, t);
    ctx.restore();
  },

  // ---------------------------------------------------------------- 2
  // Junk floor band, y 600..720: tread marks + scattered debris bits.
  floor(ctx, t = 0) {
    ctx.save();
    ctx.fillStyle = '#4a4038';
    ctx.fillRect(0, 600, W, 120);
    ctx.fillStyle = '#5c4f45';
    ctx.fillRect(0, 600, W, 14);
    ctx.strokeStyle = 'rgba(30,24,20,0.4)'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const x0 = i * 220 - 30;
      ctx.beginPath(); ctx.moveTo(x0, 628); ctx.quadraticCurveTo(x0 + 80, 660, x0 + 160, 704); ctx.stroke();
    }
    for (let i = 0; i < 10; i++) {
      const x = 30 + bbHash(i + 50) * (W - 60), y = 632 + bbHash2(i + 50) * 66;
      BASH_ART.junk(ctx, x, y, i % 6, bbHash(i + 90) * TAU, 0.5 + bbHash2(i + 90) * 0.3);
    }
    ctx.restore();
  },

  // ---------------------------------------------------------------- 3
  // Stacked-tire bumper walls filling x 0..40 and 1240..1280, y 90..620.
  walls(ctx, t = 0) {
    ctx.save();
    for (const side of [0, 1]) {
      const wx = side === 0 ? 0 : 1240;
      ctx.fillStyle = '#302e38';
      ctx.fillRect(wx, 90, 40, 530);
      const cx = wx + 20, r = 19;
      let y = 90 + r + 2, i = 0;
      while (y < 620 - r) {
        bbTire(ctx, cx, y, r, 0, (i % 3 === 0) ? 'happy' : null, t, i + side * 50);
        y += r * 1.9;
        i++;
      }
    }
    ctx.restore();
  },

  // ---------------------------------------------------------------- 4
  // Crane rail y 60..92 across the screen, plus the crusher mouth centered
  // on top (the anti-stall crusher that yanks blocks into the ceiling).
  rail(ctx, t = 0) {
    ctx.save();
    const g = ctx.createLinearGradient(0, 60, 0, 92);
    g.addColorStop(0, '#8a90a0'); g.addColorStop(0.5, '#5a6070'); g.addColorStop(1, '#3a4050');
    ctx.fillStyle = g; ctx.fillRect(0, 60, W, 32);
    ctx.strokeStyle = '#242832'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 61.5); ctx.lineTo(W, 61.5); ctx.moveTo(0, 90.5); ctx.lineTo(W, 90.5); ctx.stroke();
    ctx.fillStyle = '#242832';
    for (let x = 20; x < W; x += 60) { ctx.beginPath(); ctx.arc(x, 76, 3, 0, TAU); ctx.fill(); }
    const cx = W / 2;
    ctx.fillStyle = '#3a2038';
    rr(ctx, cx - 90, 38, 180, 58, 8); ctx.fill();
    ctx.strokeStyle = '#1c1024'; ctx.lineWidth = 4; rr(ctx, cx - 90, 38, 180, 58, 8); ctx.stroke();
    ctx.fillStyle = '#c7cbd6';
    for (let i = 0; i < 6; i++) {
      const tx = cx - 75 + i * 30;
      // tip stays above y=106 (block row 0 starts at y=110) so nothing the
      // rail draws overlaps the top row of blocks
      ctx.beginPath(); ctx.moveTo(tx, 96); ctx.lineTo(tx + 14, 96); ctx.lineTo(tx + 7, 105); ctx.closePath(); ctx.fill();
    }
    drawFace(ctx, cx, 66, 28, 'angry', t, 9);
    ctx.restore();
  },

  // ---------------------------------------------------------------- 5
  // The magnet head: a classic red/white horseshoe on a steel yoke, wider
  // than tall — never confusable with Bouncy Buddy the ball. x = centre,
  // y = bottom of the magnet (the leg tips). Chain runs up to the rail
  // underside (y=92). o.holding draws a warm grip glow; o.mood.
  crane(ctx, x, y, t = 0, o = {}) {
    const holding = !!o.holding, mood = o.mood || 'happy';
    const legGap = 30, legLen = 13, armW = 14; // wider (2*legGap) than tall
    const topAttachY = y - legLen - legGap;
    ctx.save();
    ctx.strokeStyle = '#4a4f5c'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath();
    let py = 92, sign = 1;
    ctx.moveTo(x, py);
    while (py < topAttachY - 1) {
      const ny = Math.min(py + 16, topAttachY);
      ctx.lineTo(x + sign * 5, (py + ny) / 2);
      ctx.lineTo(x, ny);
      sign *= -1; py = ny;
    }
    ctx.stroke();
    ctx.fillStyle = '#5a6070';
    ctx.beginPath(); ctx.arc(x, 90, 10, 0, TAU); ctx.fill();
    ctx.save();
    ctx.translate(x, y - legLen);
    if (holding) {
      const gg = ctx.createRadialGradient(0, -legGap * 0.4, 4, 0, -legGap * 0.4, legGap * 2.1);
      gg.addColorStop(0, 'rgba(255,235,150,0.9)'); gg.addColorStop(1, 'rgba(255,235,150,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, -legGap * 0.4, legGap * 2.1, 0, TAU); ctx.fill();
    }
    // the U-shaped body path: up the left leg, over the yoke, down the right
    const uPath = () => {
      ctx.beginPath();
      ctx.moveTo(-legGap, legLen);
      ctx.lineTo(-legGap, 0);
      ctx.arc(0, 0, legGap, Math.PI, TAU, false);
      ctx.lineTo(legGap, legLen);
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // steel casing outline (drawn wider, underneath)
    ctx.strokeStyle = BB_TIRE_DARK; ctx.lineWidth = armW + 6;
    uPath(); ctx.stroke();
    // red-painted horseshoe body
    ctx.strokeStyle = BB_DRUM; ctx.lineWidth = armW;
    uPath(); ctx.stroke();
    // white tip bands at the bottom of each leg (the classic magnet look)
    ctx.strokeStyle = '#fff'; ctx.lineWidth = armW * 0.86;
    for (const lx of [-legGap, legGap]) {
      ctx.beginPath(); ctx.moveTo(lx, legLen * 0.3); ctx.lineTo(lx, legLen); ctx.stroke();
    }
    // rivets around the yoke
    ctx.fillStyle = BB_TIRE_DARK;
    for (const a of [Math.PI * 1.15, Math.PI * 1.5, Math.PI * 1.85]) {
      ctx.beginPath(); ctx.arc(Math.cos(a) * legGap * 0.9, Math.sin(a) * legGap * 0.9, 2.6, 0, TAU); ctx.fill();
    }
    // face on the steel yoke (the rounded back), not the legs
    drawFace(ctx, 0, -legGap * 0.62, legGap * 0.62, mood, t, 6);
    ctx.restore();
    ctx.restore();
  },

  // ---------------------------------------------------------------- 6
  // Any block kind + damage state, per its shape (see shared.md). 96x48.
  block(ctx, b, t = 0) {
    if (!b || b.alive === false) return;
    const w = b.w || 96, h = b.h || 48, kind = b.kind || 'plain';
    const seed = b.seed || 0, hp = b.hp != null ? b.hp : 1, maxHp = b.maxHp || hp || 1;
    const hitT = b.hitT || 0, runT = b.runT || 0, wobble = b.wobble || 0, falling = !!b.falling;
    const hw = w / 2, hh = h / 2, rad = Math.min(10, hw * 0.22);

    ctx.save();
    ctx.translate(b.x + hw, b.y + hh);
    if (wobble) ctx.rotate(Math.sin(t * 3 + seed) * 0.06);
    if (falling) ctx.rotate(Math.sin(t * 6 + seed) * 0.22);

    // faller: chain + hook up to the rail, only while still hanging
    if (kind === 'faller' && !falling) {
      const chainTopLocal = 92 - (b.y + hh);
      ctx.strokeStyle = '#4a4f5c'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -hh); ctx.lineTo(0, chainTopLocal); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -hh - 6, 7, 0.2 * Math.PI, 1.7 * Math.PI); ctx.stroke();
    }

    let baseTop, baseBot, mood = 'happy';
    if (kind === 'tough') { baseTop = BB_METAL; baseBot = BB_METAL2; mood = hp <= 1 ? 'dizzy' : 'angry'; }
    else if (kind === 'candy') { baseTop = BB_CANDY_PINK; baseBot = BB_CANDY_PINK2; mood = 'happy'; }
    else if (kind === 'power') { baseTop = POW.power.c; baseBot = POW.power.c2; mood = 'grin'; }
    else if (kind === 'boom') { baseTop = BB_DRUM; baseBot = BB_DRUM2; mood = 'surprised'; }
    else if (kind === 'surprise') { baseTop = BB_TOOLBOX; baseBot = BB_TOOLBOX2; mood = 'surprised'; }
    else if (kind === 'split') { baseTop = RAINBOW[(seed + 3) % 6]; baseBot = bbShade(baseTop, 0.72); }
    else if (kind === 'rainbow') { mood = 'happy'; }
    else { baseTop = RAINBOW[seed % 6]; baseBot = bbShade(baseTop, 0.72); mood = (kind === 'runner' && runT > 0) ? 'surprised' : 'happy'; }

    if (kind === 'rainbow') {
      ctx.save();
      rr(ctx, -hw, -hh, w, h, rad); ctx.clip();
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = RAINBOW[i];
        ctx.fillRect(-hw + i * (w / 6) - 1, -hh, w / 6 + 2, h);
      }
      ctx.restore();
    } else {
      const g = ctx.createLinearGradient(0, -hh, 0, hh);
      g.addColorStop(0, baseTop); g.addColorStop(1, baseBot);
      ctx.fillStyle = g;
      rr(ctx, -hw, -hh, w, h, rad); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(30,24,20,0.55)'; ctx.lineWidth = Math.max(2, w * 0.025);
    rr(ctx, -hw, -hh, w, h, rad); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    rr(ctx, -hw * 0.68, -hh * 0.78, w * 0.32, h * 0.22, 5); ctx.fill();

    // kind decorations — sized/pushed to the corners so the BIG face (below)
    // stays the dominant, unmissable element at in-game size (96x48).
    if (kind === 'tough') {
      ctx.fillStyle = BB_METAL_DARK;
      for (const p of [[-hw + 10, -hh + 9], [hw - 10, -hh + 9], [-hw + 10, hh - 9], [hw - 10, hh - 9]]) {
        ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, TAU); ctx.fill();
      }
      // dent scuffs live in the top corners (clear of the big face) — dizzy
      // mood on the face itself is what really sells hp<=1, this backs it up
      const dents = Math.max(0, maxHp - hp);
      const dentPos = [[-hw * 0.62, -hh * 0.5], [hw * 0.62, -hh * 0.5]];
      ctx.fillStyle = 'rgba(20,16,14,0.4)'; ctx.strokeStyle = 'rgba(20,16,14,0.65)'; ctx.lineWidth = 2.5;
      for (let i = 0; i < dents; i++) {
        const p = dentPos[i % 2];
        ctx.beginPath(); ctx.ellipse(p[0], p[1], hh * 0.34, hh * 0.22, 0.35, 0, TAU); ctx.fill(); ctx.stroke();
      }
    } else if (kind === 'candy') {
      drawCandy(ctx, hw * 0.64, hh * 0.6, hh * 0.5, seed % 3, t);
    } else if (kind === 'power') {
      const glow = 0.5 + 0.5 * Math.sin(t * 5);
      const gg = ctx.createRadialGradient(0, 0, 2, 0, 0, hw * 0.95);
      gg.addColorStop(0, POW.power.glow); gg.addColorStop(1, 'rgba(255,247,194,0)');
      ctx.save(); ctx.globalAlpha = 0.28 * glow + 0.3; ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(0, 0, hw * 0.95, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#fff';
      starPath(ctx, hw * 0.74, -hh * 0.7, hh * 0.26, hh * 0.11, 5); ctx.fill();
    } else if (kind === 'boom') {
      ctx.fillStyle = BB_DRUM_BAND;
      ctx.fillRect(-hw, -hh * 0.9, w, hh * 0.32);
      ctx.strokeStyle = BB_RUST2; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -hh); ctx.quadraticCurveTo(hw * 0.16, -hh - 14, hw * 0.05, -hh - 22); ctx.stroke();
      const spark = 0.6 + 0.4 * Math.sin(t * 20 + seed);
      ctx.fillStyle = `rgba(255,214,90,${spark})`;
      starPath(ctx, hw * 0.05, -hh - 26, 7, 3, 5); ctx.fill();
    } else if (kind === 'split') {
      ctx.strokeStyle = 'rgba(30,24,20,0.4)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -hh + 4); ctx.lineTo(0, hh - 4); ctx.stroke();
    } else if (kind === 'surprise') {
      ctx.strokeStyle = BB_METAL_DARK; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, -hh, hh * 0.4, Math.PI, TAU); ctx.stroke();
      ctx.fillStyle = BB_METAL2;
      rr(ctx, -hh * 0.11, -hh * 0.92, hh * 0.22, hh * 0.24, 3); ctx.fill();
      const bob = Math.sin(t * 4 + seed) * 3;
      outlineText(ctx, '?', hw * 0.7, -hh * 0.55 + bob, hh * 0.85, '#fff', '#8a5a12');
    } else if (kind === 'runner') {
      const legY = hh;
      ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const lx = -hw * 0.7 + i * (hw * 1.4 / 3);
        const swing = runT > 0 ? Math.sin(t * 16 + i * 1.6) * 10 : Math.sin(t * 3 + i) * 2;
        ctx.beginPath(); ctx.moveTo(lx, legY); ctx.lineTo(lx + swing, legY + 13); ctx.stroke();
      }
    }

    // face(s) — BIG, the dominant element on every block (matches the ball's
    // r18 face reading perfectly: same ~30px scale on this 96x48 block).
    const faceS = Math.min(w, h) * 0.625; // ≈30 for the standard block
    if (kind === 'split') {
      drawFace(ctx, -hw * 0.46, 2, faceS * 0.8, 'happy', t, seed);
      drawFace(ctx, hw * 0.46, 2, faceS * 0.8, 'grin', t, seed + 1);
    } else if (kind === 'rainbow') {
      drawFace(ctx, 0, 2, faceS, 'happy', t, seed);
      ctx.fillStyle = '#fff';
      for (const sd of [-1, 1]) starPath(ctx, sd * faceS * 0.34, -faceS * 0.28, faceS * 0.12, faceS * 0.05, 5, 0);
      ctx.fill();
    } else {
      drawFace(ctx, 0, 2, faceS, mood, t, seed);
    }

    if (hitT > 0) {
      ctx.globalAlpha = clamp(hitT / 0.2, 0, 1) * 0.65;
      ctx.fillStyle = '#fff';
      rr(ctx, -hw, -hh, w, h, rad); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  },

  // ---------------------------------------------------------------- 7
  // Rubber ball with a face. o.mood, o.rainbow, o.boom (lit fuse), o.squash
  // (1 = round), o.spin.
  ball(ctx, x, y, r, t = 0, o = {}) {
    const mood = o.mood || 'happy', rainbow = !!o.rainbow, boom = !!o.boom;
    const spin = o.spin || 0;
    const sy = clamp(o.squash != null ? o.squash : 1, 0.55, 1.6), sx = 2 - sy;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);

    if (boom) {
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#4a4a52'); g.addColorStop(1, '#1c1c22');
      ctx.fillStyle = g;
    } else if (rainbow) {
      const g = ctx.createLinearGradient(-r, -r, r, r);
      RAINBOW.forEach((c, i) => g.addColorStop(i / (RAINBOW.length - 1), c));
      ctx.fillStyle = g;
    } else {
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#ff9a7a'); g.addColorStop(1, BB_DRUM2);
      ctx.fillStyle = g;
    }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = boom ? '#0c0c10' : 'rgba(120,30,20,0.5)'; ctx.lineWidth = Math.max(2, r * 0.1); ctx.stroke();

    if (spin) {
      ctx.save(); ctx.rotate(spin);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1.5, r * 0.08);
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(0, 0, r * 0.6, i * 0.5, i * 0.5 + 1.1); ctx.stroke(); }
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(-r * 0.32, -r * 0.34, r * 0.28, r * 0.16, -0.5, 0, TAU); ctx.fill();

    if (boom) {
      ctx.strokeStyle = BB_RUST2; ctx.lineWidth = Math.max(2, r * 0.16); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.3, -r * 1.3, r * 0.12, -r * 1.5); ctx.stroke();
      const spark = 0.6 + 0.4 * Math.sin(t * 22);
      ctx.fillStyle = `rgba(255,214,90,${spark})`;
      starPath(ctx, r * 0.12, -r * 1.56, r * 0.32, r * 0.13, 5); ctx.fill();
    }

    drawFace(ctx, 0, r * 0.06, r * 1.05, mood, t, Math.round(x * 0.013 + y * 0.011));
    ctx.restore();
  },

  // ---------------------------------------------------------------- 8
  // A 44-px round tire capsule with the mod icon in its hub.
  capsule(ctx, x, y, kind, t = 0) {
    ctx.save();
    const bob = Math.sin(t * 3 + x * 0.01) * 3;
    ctx.translate(x, y + bob);
    bbTire(ctx, 0, 0, 22, t * 0.4, null, t, 0);
    // bright inner disc so the icon reads instead of vanishing into the
    // dark tire tread (dark-on-dark was the readability bug)
    ctx.fillStyle = '#ffe156';
    ctx.beginPath(); ctx.arc(0, 0, 22 * 0.7, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    BASH_ART.modIcon(ctx, 0, 0, 26, kind);
    ctx.restore();
  },

  // ---------------------------------------------------------------- 9
  // The icon alone (chips + toasts). 7 mod kinds + 'rainbow'.
  modIcon(ctx, x, y, s, kind) {
    ctx.save();
    ctx.translate(x, y);
    if (kind === 'multi') {
      for (const p of [[-s * 0.32, s * 0.18], [s * 0.32, s * 0.18], [0, -s * 0.28]]) {
        ctx.fillStyle = '#ff6b4d';
        ctx.beginPath(); ctx.arc(p[0], p[1], s * 0.3, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#a83c26'; ctx.lineWidth = Math.max(1.5, s * 0.06); ctx.stroke();
      }
    } else if (kind === 'giant') {
      // a small ball with four bright outward-pointing arrows (N/S/E/W) =
      // "grow bigger" — a plain ball alone was indistinguishable from the
      // Bouncy Buddy ball itself at capsule/HUD size
      const br = s * 0.34;
      const g = ctx.createRadialGradient(-br * 0.3, -br * 0.3, br * 0.1, 0, 0, br);
      g.addColorStop(0, '#ff9a7a'); g.addColorStop(1, BB_DRUM2);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, br, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#7a1810'; ctx.lineWidth = Math.max(1.5, s * 0.06); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.ellipse(-br * 0.32, -br * 0.34, br * 0.28, br * 0.16, -0.5, 0, TAU); ctx.fill();
      const aGap = br + s * 0.13, aLen = s * 0.24, aBase = s * 0.19;
      ctx.fillStyle = '#4ee0a0'; ctx.strokeStyle = '#1a6a48'; ctx.lineWidth = Math.max(1, s * 0.035);
      ctx.lineJoin = 'round';
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const px = -dy, py = dx; // perpendicular, for the arrow's base width
        ctx.beginPath();
        ctx.moveTo(dx * (aGap + aLen), dy * (aGap + aLen));
        ctx.lineTo(dx * aGap + px * aBase * 0.5, dy * aGap + py * aBase * 0.5);
        ctx.lineTo(dx * aGap - px * aBase * 0.5, dy * aGap - py * aBase * 0.5);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    } else if (kind === 'wide') {
      ctx.fillStyle = BB_RUST;
      rr(ctx, -s * 0.56, -s * 0.16, s * 1.12, s * 0.32, s * 0.09); ctx.fill();
      ctx.strokeStyle = BB_RUST2; ctx.lineWidth = Math.max(1.5, s * 0.06); rr(ctx, -s * 0.56, -s * 0.16, s * 1.12, s * 0.32, s * 0.09); ctx.stroke();
      ctx.fillStyle = '#fff';
      for (const sd of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(sd * s * 0.64, 0); ctx.lineTo(sd * s * 0.4, -s * 0.16); ctx.lineTo(sd * s * 0.4, s * 0.16); ctx.closePath(); ctx.fill();
      }
    } else if (kind === 'boom') {
      ctx.fillStyle = '#2a2a30';
      ctx.beginPath(); ctx.arc(0, s * 0.12, s * 0.44, 0, TAU); ctx.fill();
      ctx.strokeStyle = BB_RUST2; ctx.lineWidth = Math.max(2, s * 0.08); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s * 0.2, -s * 0.3); ctx.quadraticCurveTo(s * 0.42, -s * 0.5, s * 0.3, -s * 0.62); ctx.stroke();
      ctx.fillStyle = BB_TOOLBOX;
      starPath(ctx, s * 0.3, -s * 0.68, s * 0.17, s * 0.07, 5); ctx.fill();
    } else if (kind === 'magnet') {
      // same silhouette as the crane's magnet head (an upside-down U, red
      // body + white tip bands) so the capsule instantly reads as "that
      // thing at the top" — dark outline first so it pops on any bg
      const legGap = s * 0.34, legLen = s * 0.34, armW = s * 0.26, oy = -s * 0.06;
      const uPath = () => {
        ctx.beginPath();
        ctx.moveTo(-legGap, legLen + oy);
        ctx.lineTo(-legGap, oy);
        ctx.arc(0, oy, legGap, Math.PI, TAU, false);
        ctx.lineTo(legGap, legLen + oy);
      };
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#7a1810'; ctx.lineWidth = armW + s * 0.09;
      uPath(); ctx.stroke();
      ctx.strokeStyle = BB_DRUM; ctx.lineWidth = armW;
      uPath(); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = armW * 0.82;
      for (const lx of [-legGap, legGap]) {
        ctx.beginPath(); ctx.moveTo(lx, legLen * 0.3 + oy); ctx.lineTo(lx, legLen + oy); ctx.stroke();
      }
    } else if (kind === 'slow') {
      ctx.fillStyle = '#8fd85a';
      ctx.beginPath(); ctx.ellipse(-s * 0.05, s * 0.24, s * 0.44, s * 0.2, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#4a9a30'; ctx.lineWidth = Math.max(1.5, s * 0.04); ctx.stroke();
      ctx.fillStyle = '#d98f4a';
      ctx.beginPath(); ctx.arc(-s * 0.08, -s * 0.06, s * 0.34, 0, TAU * 0.86); ctx.fill();
      ctx.strokeStyle = '#a86630'; ctx.lineWidth = Math.max(1.5, s * 0.04); ctx.stroke();
      drawFace(ctx, s * 0.3, s * 0.14, s * 0.3, 'sleepy', 0, 1);
    } else if (kind === 'net') {
      ctx.strokeStyle = BB_RUST2; ctx.lineWidth = Math.max(1.5, s * 0.045);
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.5, i * s * 0.2); ctx.lineTo(s * 0.5, i * s * 0.2); ctx.stroke(); }
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * s * 0.2, -s * 0.5); ctx.lineTo(i * s * 0.2, s * 0.5); ctx.stroke(); }
    } else if (kind === 'rainbow') {
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = RAINBOW[i]; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, s * 0.32, s * 0.52 - i * s * 0.09, Math.PI, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  },

  // ---------------------------------------------------------------- 10
  // A giant rolling tire with a face.
  tire(ctx, x, y, r, rot = 0, t = 0) {
    bbTire(ctx, x, y, r, rot, 'happy', t, 2);
  },

  // ---------------------------------------------------------------- 11
  // A junk net across the floor at y. k = 0..1 remaining (fades below 0.25).
  net(ctx, y, t = 0, k = 1) {
    if (k <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = clamp(k, 0, 1);
    const x0 = 40, x1 = 1240, bh = 26, sag = Math.sin(t * 2) * 3, step = 32;
    const yc = y + sag, yt = yc - bh / 2, yb = yc + bh / 2;
    ctx.strokeStyle = BB_RUST2; ctx.lineWidth = 2.2;
    for (let x = x0 - bh; x <= x1 + bh; x += step) {
      ctx.beginPath(); ctx.moveTo(x, yt); ctx.lineTo(x + bh, yb); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, yb); ctx.lineTo(x + bh, yt); ctx.stroke();
    }
    ctx.strokeStyle = BB_RUST; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x0, yt); ctx.lineTo(x1, yt); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, yb); ctx.lineTo(x1, yb); ctx.stroke();
    ctx.fillStyle = BB_TIRE_RIM;
    ctx.beginPath(); ctx.arc(x0, yc, 7, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x1, yc, 7, 0, TAU); ctx.fill();
    if (k < 0.25) {
      ctx.strokeStyle = BB_RUST2; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const fx = x0 + bbHash(i + 300) * (x1 - x0);
        ctx.beginPath(); ctx.moveTo(fx, yb); ctx.lineTo(fx + bbHash2(i + 300) * 10 - 5, yb + 14 + bbHash(i + 400) * 10); ctx.stroke();
      }
    }
    ctx.restore();
  },

  // ---------------------------------------------------------------- 12
  // Scrap plow bolted onto the truck front. facing = 1 (right) / -1 (left).
  plow(ctx, x, y, w, h, facing = 1, t = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, BB_METAL); g.addColorStop(1, BB_METAL2);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -h * 0.5); ctx.lineTo(w * 0.5, -h * 0.2);
    ctx.lineTo(w * 0.5, h * 0.2); ctx.lineTo(-w * 0.5, h * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = BB_METAL_DARK; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = BB_METAL_DARK;
    for (const p of [[-w * 0.3, -h * 0.15], [-w * 0.3, h * 0.15], [w * 0.1, 0]]) { ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, TAU); ctx.fill(); }
    drawFace(ctx, -w * 0.14, 0, Math.min(w, h) * 0.28, 'grin', t, 4);
    ctx.restore();
  },

  // ---------------------------------------------------------------- 13
  // Debris piece: 0 hubcap, 1 boot, 2 rubber duck, 3 spring, 4 gear, 5 bolt.
  junk(ctx, x, y, kind, rot = 0, s = 1) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    if (kind === 0) {
      ctx.fillStyle = BB_TIRE_RIM; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();
      ctx.strokeStyle = BB_TIRE_DARK; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = BB_TIRE_HUB; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
    } else if (kind === 1) {
      ctx.fillStyle = '#6a4a30';
      ctx.beginPath(); ctx.moveTo(-10, 6); ctx.lineTo(-10, -8); ctx.lineTo(0, -8); ctx.lineTo(4, -2); ctx.lineTo(14, -2); ctx.lineTo(14, 6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 2; ctx.stroke();
    } else if (kind === 2) {
      ctx.fillStyle = BB_TOOLBOX;
      ctx.beginPath(); ctx.ellipse(0, 2, 10, 8, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(8, -4, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e08a1a'; ctx.beginPath(); ctx.moveTo(13, -4); ctx.lineTo(19, -2); ctx.lineTo(13, 0); ctx.closePath(); ctx.fill();
      drawFace(ctx, 8, -4, 5, 'happy', 0, 1);
    } else if (kind === 3) {
      ctx.strokeStyle = BB_TIRE_RIM; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-8, -12);
      for (let i = 0; i < 5; i++) ctx.lineTo(i % 2 === 0 ? 8 : -8, -12 + i * 6);
      ctx.lineTo(8, 12); ctx.stroke();
    } else if (kind === 4) {
      ctx.fillStyle = BB_METAL;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.lineTo(Math.cos(a) * 6, Math.sin(a) * 6); ctx.lineTo(Math.cos(a + 0.22) * 11, Math.sin(a + 0.22) * 11); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = BB_METAL2; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = BB_TIRE_RIM;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = BB_METAL2; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  },

  // ---------------------------------------------------------------- 14
  // The miss splat: dust ring + dizzy stars. k = 0..1 remaining.
  splat(ctx, x, y, t = 0, k = 1) {
    if (k <= 0.001) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = clamp(k, 0, 1);
    ctx.fillStyle = 'rgba(90,74,58,0.5)';
    ctx.beginPath(); ctx.ellipse(0, 0, 34, 12, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(60,48,36,0.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, 34, 12, 0, 0, TAU); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + i * (TAU / 3);
      ctx.fillStyle = BB_TOOLBOX;
      starPath(ctx, Math.cos(a) * 26, -10 + Math.sin(a) * 8, 6, 2.5, 5); ctx.fill();
    }
    ctx.restore();
  },

  // ---------------------------------------------------------------- 15
  // THE JUNKBOT boss. Parts present/absent, hurtT flash, coreOpen, mood,
  // a magnet beam to (beamX,beamY) while beamT>0, a pulsing bullseye on
  // jb.nextPart ('sign'|'tireL'|'tireR'|'core').
  junkbot(ctx, jb, t = 0) {
    if (!jb) return;
    const x = jb.x || 0, y = jb.y || 0, w = jb.w || 340, h = jb.h || 260;
    const parts = jb.parts || {};
    const dir = jb.dir || 1, droop = jb.droop || 0, hurtT = jb.hurtT || 0;
    const mood = jb.mood || 'angry';
    const cx = x + w / 2, cy = y + h / 2 + droop;
    const bob = Math.sin(t * 1.6) * 6;

    const hookLocalX = w * 0.42, hookLocalY = -h * 0.02;
    const hookWorldX = cx + dir * hookLocalX, hookWorldY = cy + bob + hookLocalY;

    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.scale(dir, 1);

    const hasSign = parts.sign !== false, hasTireL = parts.tireL !== false, hasTireR = parts.tireR !== false, hasCore = parts.core !== false;
    const shoY = -h * 0.18;
    const signX = -w * 0.44, signY = -h * 0.02;
    const chestW = w * 0.52, chestH = h * 0.5, chestY = h * 0.02;

    // arms (hook side always present, sign side only while the shield holds)
    bbJunkbotArm(ctx, w, h, 1, true);
    bbJunkbotArm(ctx, w, h, -1, hasSign);
    bbHookHand(ctx, hookLocalX, hookLocalY, w * 0.11, t);
    if (hasSign) bbTrafficSign(ctx, signX, signY, w * 0.15, t);
    else bbStub(ctx, signX, signY, w * 0.09);

    // tire shoulders
    if (hasTireL) bbTire(ctx, -w * 0.30, shoY, w * 0.15, t * 0.3, null, t, 11); else bbStub(ctx, -w * 0.30, shoY, w * 0.11);
    if (hasTireR) bbTire(ctx, w * 0.30, shoY, w * 0.15, -t * 0.3, null, t, 12); else bbStub(ctx, w * 0.30, shoY, w * 0.11);

    // engine-block chest
    const cg = ctx.createLinearGradient(0, chestY - chestH / 2, 0, chestY + chestH / 2);
    cg.addColorStop(0, BB_METAL); cg.addColorStop(1, BB_METAL2);
    ctx.fillStyle = cg;
    rr(ctx, -chestW / 2, chestY - chestH / 2, chestW, chestH, 14); ctx.fill();
    ctx.strokeStyle = BB_METAL_DARK; ctx.lineWidth = 5; rr(ctx, -chestW / 2, chestY - chestH / 2, chestW, chestH, 14); ctx.stroke();
    ctx.fillStyle = BB_METAL_DARK;
    for (const p of [[-chestW * 0.42, -chestH * 0.38], [chestW * 0.42, -chestH * 0.38], [-chestW * 0.42, chestH * 0.38], [chestW * 0.42, chestH * 0.38]]) {
      ctx.beginPath(); ctx.arc(p[0], chestY + p[1], 5, 0, TAU); ctx.fill();
    }

    // candy core — self-sufficient on jb.stage too, in case a caller sets
    // the boss's stage without also flagging coreOpen explicitly
    const coreOpen = !!jb.coreOpen || (jb.stage || 1) >= 4;
    const coreR = chestH * (coreOpen ? 0.42 : 0.3);
    if (hasCore) {
      if (coreOpen) {
        ctx.fillStyle = BB_METAL_DARK;
        ctx.save(); ctx.rotate(-0.5); ctx.fillRect(-chestW * 0.05, chestY - chestH * 0.55, chestW * 0.24, chestH * 0.16); ctx.restore();
        ctx.save(); ctx.rotate(0.5); ctx.fillRect(-chestW * 0.19, chestY - chestH * 0.55, chestW * 0.24, chestH * 0.16); ctx.restore();
      }
      const glowA = 0.5 + 0.5 * Math.sin(t * 6);
      const gg = ctx.createRadialGradient(0, chestY, 2, 0, chestY, coreR * (coreOpen ? 2.2 : 1.6));
      gg.addColorStop(0, POW.power.glow); gg.addColorStop(1, 'rgba(255,215,90,0)');
      ctx.save();
      ctx.globalAlpha = coreOpen ? 0.95 : 0.35 * glowA + 0.25;
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(0, chestY, coreR * (coreOpen ? 2.2 : 1.6), 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = POW.power.c;
      ctx.beginPath(); ctx.arc(0, chestY, coreR, 0, TAU); ctx.fill();
      ctx.strokeStyle = POW.power.c2; ctx.lineWidth = 4; ctx.stroke();
      drawCandy(ctx, 0, chestY, coreR * 0.9, 1, t);
      if (coreOpen) {
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 4; i++) {
          const a = t * 8 + i * 1.6;
          ctx.beginPath(); ctx.arc(Math.cos(a) * coreR * 1.6, chestY + Math.sin(a) * coreR * 1.6, 2.5, 0, TAU); ctx.fill();
        }
      }
    } else {
      ctx.fillStyle = '#1c1e28';
      ctx.beginPath(); ctx.arc(0, chestY, coreR, 0, TAU); ctx.fill();
      ctx.strokeStyle = BB_METAL_DARK; ctx.lineWidth = 4; ctx.stroke();
    }

    // head plate with headlight eyes + grille mouth
    const headY = -h * 0.36, headW = w * 0.34, headH = h * 0.2;
    ctx.fillStyle = BB_METAL2;
    rr(ctx, -headW / 2, headY - headH / 2, headW, headH, 10); ctx.fill();
    ctx.strokeStyle = BB_METAL_DARK; ctx.lineWidth = 4; rr(ctx, -headW / 2, headY - headH / 2, headW, headH, 10); ctx.stroke();
    bbHeadlights(ctx, headY, headW, mood, t, hurtT);

    if (hurtT > 0) {
      ctx.globalAlpha = clamp(hurtT / 0.2, 0, 1) * 0.6;
      ctx.fillStyle = '#fff';
      rr(ctx, -w * 0.5, -h * 0.5, w, h, 16); ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (jb.nextPart) {
      const pts = { sign: [signX, signY], tireL: [-w * 0.30, shoY], tireR: [w * 0.30, shoY], core: [0, chestY] };
      const p = pts[jb.nextPart];
      if (p) bbBullseye(ctx, p[0], p[1], w * 0.1, t);
    }

    ctx.restore();

    if (jb.beamT > 0 && jb.beamX != null && jb.beamY != null) {
      bbMagnetBeam(ctx, hookWorldX, hookWorldY, jb.beamX, jb.beamY, t);
    }
  },

  // ---------------------------------------------------------------- 16
  // Arcade cabinet on a tire base: screen w/ a bouncing ball, flashing BASH
  // marquee, a face. cx = centre, g = ground y. o.glow highlights the cabinet.
  arcadeDoor(ctx, cx, g, t = 0, o = {}) {
    ctx.save();
    ctx.translate(cx, g);
    if (o.glow) {
      ctx.save(); ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 4);
      const gg = ctx.createRadialGradient(0, -90, 10, 0, -90, 110);
      gg.addColorStop(0, '#ffe08a'); gg.addColorStop(1, 'rgba(255,224,138,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, -90, 110, 0, TAU); ctx.fill();
      ctx.restore();
    }
    bbTire(ctx, -22, -14, 20, 0, null, t, 21);
    bbTire(ctx, 22, -14, 20, 0, null, t, 22);
    const bw = 92, bh = 150, bTop = -34 - bh;
    const cg = ctx.createLinearGradient(0, bTop, 0, bTop + bh);
    cg.addColorStop(0, '#4a4a5a'); cg.addColorStop(1, '#2e2e3a');
    ctx.fillStyle = cg; rr(ctx, -bw / 2, bTop, bw, bh, 10); ctx.fill();
    ctx.strokeStyle = '#1c1c26'; ctx.lineWidth = 5; rr(ctx, -bw / 2, bTop, bw, bh, 10); ctx.stroke();

    const mH = 34, mY = bTop - mH + 6;
    const flash = Math.sin(t * 6) > 0;
    ctx.fillStyle = flash ? BB_TOOLBOX : BB_DRUM;
    rr(ctx, -bw / 2 - 6, mY, bw + 12, mH, 8); ctx.fill();
    ctx.strokeStyle = '#1c1c26'; ctx.lineWidth = 4; rr(ctx, -bw / 2 - 6, mY, bw + 12, mH, 8); ctx.stroke();
    outlineText(ctx, 'BASH', 0, mY + mH / 2 + 1, 20, '#fff', '#1c1c26');

    const scrX = -bw * 0.36, scrY = bTop + 14, scrW = bw * 0.72, scrH = 58;
    ctx.fillStyle = '#0a2a1a'; rr(ctx, scrX, scrY, scrW, scrH, 6); ctx.fill();
    ctx.save(); rr(ctx, scrX, scrY, scrW, scrH, 6); ctx.clip();
    const bx = scrX + scrW * 0.5 + Math.sin(t * 2.4) * scrW * 0.3;
    const by = scrY + scrH * 0.5 + Math.abs(Math.sin(t * 3.1)) * scrH * 0.32 - scrH * 0.16;
    ctx.fillStyle = '#7fffb0'; ctx.beginPath(); ctx.arc(bx, by, 6, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(127,255,176,0.3)'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(scrX + 2, scrY + scrH - 4); ctx.lineTo(scrX + scrW - 2, scrY + scrH - 4); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#12121a'; ctx.lineWidth = 4; rr(ctx, scrX, scrY, scrW, scrH, 6); ctx.stroke();

    const cpY = bTop + bh - 40;
    ctx.fillStyle = '#3a3a48'; rr(ctx, -bw / 2 + 6, cpY, bw - 12, 34, 6); ctx.fill();
    ctx.fillStyle = BB_DRUM; ctx.beginPath(); ctx.arc(-16, cpY + 17, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4a90d9'; ctx.beginPath(); ctx.arc(16, cpY + 17, 8, 0, TAU); ctx.fill();
    drawFace(ctx, 0, scrY + scrH + 18, 20, 'grin', t, 15);
    ctx.restore();
  }
};

// ---------------------------------------------------------------- backdrop helpers
function bbJunkHills(ctx, baseY, color, alpha, n) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, 620); ctx.lineTo(0, baseY);
  for (let i = 0; i <= n; i++) {
    const px = (i / n) * W;
    const ph = 40 + bbHash(i + baseY) * 90;
    ctx.lineTo(px, baseY - ph);
  }
  ctx.lineTo(W, baseY); ctx.lineTo(W, 620); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function bbCrusher(ctx, x, y, t) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#4a4a58';
  rr(ctx, -70, -160, 140, 170, 10); ctx.fill();
  ctx.strokeStyle = '#2a2a34'; ctx.lineWidth = 5; rr(ctx, -70, -160, 140, 170, 10); ctx.stroke();
  const open = 0.5 + 0.5 * Math.sin(t * 0.8);
  ctx.fillStyle = '#6a6a78';
  ctx.beginPath(); ctx.moveTo(-70, -160); ctx.lineTo(-20, -210 - open * 10); ctx.lineTo(-10, -160); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(70, -160); ctx.lineTo(20, -210 - open * 10); ctx.lineTo(10, -160); ctx.closePath(); ctx.fill();
  drawFace(ctx, 0, -60, 40, 'angry', t, 3);
  ctx.restore();
}
function bbForklift(ctx, x, y, t) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = BB_TOOLBOX2;
  rr(ctx, -60, -90, 110, 70, 8); ctx.fill();
  ctx.strokeStyle = '#8a6a10'; ctx.lineWidth = 4; rr(ctx, -60, -90, 110, 70, 8); ctx.stroke();
  ctx.strokeStyle = '#555'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(-60, -90); ctx.lineTo(-60, -170); ctx.moveTo(-40, -90); ctx.lineTo(-40, -170); ctx.stroke();
  ctx.fillStyle = '#333';
  ctx.fillRect(-90, -40, 40, 8); ctx.fillRect(-90, -24, 40, 8);
  bbTire(ctx, -30, -8, 18, 0, null, t, 1);
  bbTire(ctx, 20, -8, 18, 0, null, t, 2);
  drawFace(ctx, -5, -60, 26, 'happy', t, 5);
  ctx.restore();
}

// ---------------------------------------------------------------- junkbot helpers
function bbJunkbotArm(ctx, w, h, side, present) {
  const shoX = side * w * 0.30, shoY = -h * 0.02, handX = side * w * 0.42, handY = -h * 0.02;
  ctx.strokeStyle = present ? BB_METAL2 : BB_METAL_DARK;
  ctx.lineWidth = w * 0.09; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(shoX, shoY); ctx.lineTo(handX, handY); ctx.stroke();
  ctx.strokeStyle = BB_METAL_DARK; ctx.lineWidth = w * 0.03;
  ctx.beginPath(); ctx.moveTo(shoX, shoY); ctx.lineTo(handX, handY); ctx.stroke();
}
function bbHookHand(ctx, x, y, r, t) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = BB_METAL_DARK;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = BB_TIRE_HUB; ctx.lineWidth = r * 0.42; ctx.lineCap = 'round';
  const a0 = 0.05 * Math.PI, a1 = 1.45 * Math.PI, hookR = r * 0.62, hookCy = r * 0.3;
  ctx.beginPath(); ctx.arc(0, hookCy, hookR, a0, a1); ctx.stroke();
  // pointed tip so the curl reads as a crane hook, not just a bracket
  const ex = Math.cos(a1) * hookR, ey = hookCy + Math.sin(a1) * hookR;
  ctx.save();
  ctx.translate(ex, ey); ctx.rotate(a1 + Math.PI / 2);
  ctx.fillStyle = BB_TIRE_HUB;
  ctx.beginPath(); ctx.moveTo(-r * 0.22, 0); ctx.lineTo(r * 0.22, 0); ctx.lineTo(0, -r * 0.34); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
}
function bbTrafficSign(ctx, x, y, r, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2) * 0.05);
  ctx.fillStyle = BB_DRUM;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8, px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.14; ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.fillRect(-r * 0.08, -r * 0.35, r * 0.16, r * 0.4);
  ctx.beginPath(); ctx.arc(0, r * 0.32, r * 0.09, 0, TAU); ctx.fill();
  ctx.restore();
}
function bbStub(ctx, x, y, r) {
  // an empty socket where a part used to be: a dark hollow ring (reads
  // clearly as "missing", unlike the solid metal everywhere else) plus a
  // few bright warning sparks so it never gets lost against the dark arm.
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#14151d';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = BB_METAL2; ctx.lineWidth = Math.max(2, r * 0.24); ctx.stroke();
  ctx.strokeStyle = BB_TOOLBOX; ctx.lineWidth = Math.max(1.5, r * 0.16); ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35);
    ctx.lineTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2);
    ctx.stroke();
  }
  ctx.restore();
}
function bbHeadlights(ctx, headY, headW, mood, t, hurtT) {
  const angry = mood === 'angry', dizzy = mood === 'dizzy' || hurtT > 0;
  for (const sd of [-1, 1]) {
    ctx.save(); ctx.translate(sd * headW * 0.24, headY);
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, headW * 0.16);
    glow.addColorStop(0, dizzy ? '#ffe08a' : '#fff3c0'); glow.addColorStop(1, 'rgba(255,235,150,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, headW * 0.16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 0, headW * 0.09, 0, TAU); ctx.fill();
    ctx.fillStyle = dizzy ? '#3a2a3a' : (angry ? '#a8271e' : '#4a90d9');
    ctx.beginPath(); ctx.arc(0, 0, headW * 0.05, 0, TAU); ctx.fill();
    if (angry) {
      ctx.strokeStyle = '#3a2a3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-sd * headW * 0.08, -headW * 0.14); ctx.lineTo(sd * headW * 0.06, -headW * 0.08); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.strokeStyle = '#1c1e28'; ctx.lineWidth = headW * 0.09; ctx.lineCap = 'round';
  ctx.beginPath();
  if (dizzy) ctx.arc(0, headY + headW * 0.24, headW * 0.16, 0, Math.PI);
  else ctx.arc(0, headY + headW * 0.2, headW * 0.18, angry ? 1.15 * Math.PI : 0.15 * Math.PI, angry ? 1.85 * Math.PI : 0.85 * Math.PI);
  ctx.stroke();
}
function bbBullseye(ctx, x, y, r, t) {
  ctx.save(); ctx.translate(x, y);
  const pulse = 1 + 0.15 * Math.sin(t * 6);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.22;
  ctx.beginPath(); ctx.arc(0, 0, r * pulse, 0, TAU); ctx.stroke();
  ctx.strokeStyle = BB_DRUM; ctx.lineWidth = r * 0.14;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.66 * pulse, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, TAU); ctx.fill();
  ctx.restore();
}
function bbMagnetBeam(ctx, x0, y0, x1, y1, t) {
  ctx.save();
  const pulse = 0.75 + 0.25 * Math.sin(t * 14);
  ctx.strokeStyle = `rgba(255,214,90,${0.55 * pulse})`; ctx.lineWidth = 20; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = `rgba(255,224,120,${0.85 * pulse})`; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = `rgba(255,250,225,${pulse})`; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.fillStyle = '#fff';
  const a = t * 10;
  ctx.beginPath(); ctx.arc(x1 + Math.cos(a) * 8, y1 + Math.sin(a) * 8, 4, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x1 - Math.cos(a) * 7, y1 - Math.sin(a) * 7, 3, 0, TAU); ctx.fill();
  ctx.restore();
}
