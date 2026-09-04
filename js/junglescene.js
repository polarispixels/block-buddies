'use strict';
// ================================================================
// JG_SCENE — storm-damaged jungle scenery + props for
// THE GREAT DINOSAUR RESCUE
// (docs/superpowers/specs/2026-09-04-great-dinosaur-rescue-design.md)
//
// Pure procedural canvas drawing, no game-state reads. Every function
// saves/restores ctx and takes `t` (seconds, default 0) for animation.
// Coordinates are world space; `groundY` is the floor line a prop sits
// on (base at groundY, drawn upward), except the rect-shaped helpers
// (groundPlate/waterPool/waterfall/puddle/jungleBack/caveBack) which take
// an explicit top-left box like a solid.
//
// Determinism: nothing here calls Math.random()/rand()/chance() — spatial
// variation always comes from a seed/position hashed through hash2()
// (util.js), so a prop drawn every frame never flickers; only `t` moves.
// ================================================================

// ---------------------------------------------------------------- helpers
function jgH(seed, i) { return hash2(Math.floor(seed) * 97 + i * 13, Math.floor(seed) * 31 + i * 71); } // 0..1
function jgBuckets(x0, x1, spacing) {
  const i0 = Math.floor(x0 / spacing) - 1, i1 = Math.ceil(x1 / spacing) + 1;
  const out = [];
  for (let i = i0; i <= i1; i++) out.push(i);
  return out;
}
// a rounded canopy blob cluster (used by jungleBack + treetop silhouettes)
function jgCanopyBlob(ctx, x, y, s, col) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x, y, 62 * s, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x - 46 * s, y + 26 * s, 48 * s, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 48 * s, y + 30 * s, 44 * s, 0, TAU); ctx.fill();
}
// a leaning trunk with a face — shared by fallenTree/weakLog
function jgTrunkFace(ctx, cx, cy, len, th, ang, mood, seed) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(ang);
  const g = ctx.createLinearGradient(0, -th / 2, 0, th / 2);
  g.addColorStop(0, '#a97a4a'); g.addColorStop(1, '#7a5230');
  ctx.fillStyle = g;
  rr(ctx, -len / 2, -th / 2, len, th, th * 0.32); ctx.fill();
  ctx.strokeStyle = 'rgba(60,35,15,0.4)'; ctx.lineWidth = 3; rr(ctx, -len / 2, -th / 2, len, th, th * 0.32); ctx.stroke();
  ctx.strokeStyle = 'rgba(60,35,15,0.25)'; ctx.lineWidth = 2;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.ellipse(i * len * 0.28, 0, th * 0.14, th * 0.42, 0, 0, TAU); ctx.stroke();
  }
  drawFace(ctx, -len * 0.28, 0, th * 0.5, mood, 0, seed);
  ctx.restore();
}

const JG_SCENE = {

  // -------------------------------------------------------------- backdrops
  jungleBack(ctx, x0, y0, x1, y1, t = 0, o = {}) {
    const seed = o.seed || 0, dmg = o.damage === undefined ? 1 : o.damage, calm = o.mood === 'calm';
    const w = x1 - x0, h = y1 - y0;
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    // sky
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    if (calm) { g.addColorStop(0, '#7ecfe8'); g.addColorStop(0.5, '#a8e8b0'); g.addColorStop(1, '#cdeec0'); }
    else { g.addColorStop(0, '#6fa8ac'); g.addColorStop(0.5, '#8fc49a'); g.addColorStop(1, '#b7d9ae'); }
    ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
    // distant smoking volcano, one per ~1600px of seed-space, sleepy face
    for (const i of jgBuckets(x0 + seed * 1600, x1 + seed * 1600, 1600)) {
      const vx = i * 1600 - seed * 1600 + 800;
      if (vx < x0 - 350 || vx > x1 + 350) continue;
      const vy = y0 + h * 0.62;
      ctx.fillStyle = calm ? '#78b984' : '#5f9268';
      ctx.beginPath();
      ctx.moveTo(vx - 200, y0 + h); ctx.lineTo(vx - 40, vy - h * 0.42); ctx.lineTo(vx + 40, vy - h * 0.42); ctx.lineTo(vx + 200, y0 + h);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,140,40,' + (0.55 + 0.25 * Math.sin(t * 1.4 + i)) + ')';
      ctx.beginPath(); ctx.ellipse(vx, vy - h * 0.42, 26, 9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,120,0.8)';
      ctx.beginPath(); ctx.ellipse(vx, vy - h * 0.42, 12, 4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let k = 0; k < 3; k++) {
        const py = vy - h * 0.42 - 18 - k * 30 - (t * 14) % 30;
        ctx.beginPath(); ctx.arc(vx + Math.sin(t + k * 2 + i) * 10, py, 11 + k * 3, 0, TAU); ctx.fill();
      }
      drawFace(ctx, vx, vy - h * 0.42 - 46, 34, 'sleepy', t, 87 + i);
    }
    // two parallax canopy silhouette layers — clamped so the lowest blob
    // edge stays well clear of y1 (the ground deck plates paint over this
    // AFTER jungleBack, and caves sit below that — a canopy blob peeking
    // out under the deck, in the gap before the cave backdrop starts, is a
    // real seam bug; 150px covers a deck plate's own ~100px thickness plus
    // margin, not just the thin 60px cave-adjacency buffer)
    for (const [spacing, col, sc, ly] of [[260, calm ? '#8fd8a0' : '#6c9c78', 1.25, 0.72], [190, calm ? '#6cc47e' : '#4e8a5c', 1, 0.85]]) {
      const maxY = y1 - 150 - 74 * sc;
      for (const i of jgBuckets(x0, x1, spacing)) {
        const bx = i * spacing + jgH(seed, i) * 40 - 20;
        jgCanopyBlob(ctx, bx, Math.min(y0 + h * ly, maxY), sc, col);
      }
    }
    // storm damage: a leaning half-fallen trunk snagged in the canopy + a
    // snapped branch stub, once every ~900px, scaled by damage
    if (dmg > 0.01) {
      for (const i of jgBuckets(x0, x1, 900)) {
        const bx = i * 900 + jgH(seed + 5, i) * 300;
        if (bx < x0 - 200 || bx > x1 + 200) continue;
        ctx.save();
        ctx.globalAlpha = 0.55 * dmg;
        ctx.translate(bx, y0 + h * 0.66);
        ctx.rotate(0.5 + jgH(seed + 9, i) * 0.3);
        ctx.fillStyle = '#5a3d24';
        rr(ctx, -70, -12, 140, 24, 10); ctx.fill();
        ctx.restore();
        // drooping vine, snapped free of the canopy — a visible loose loop
        // with a little leaf tuft at the end, not just a straight stick
        ctx.save();
        ctx.globalAlpha = 0.6 * dmg;
        ctx.strokeStyle = '#3f7a3a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        const vx = bx - 150, vTop = y0 + h * 0.32, vl = 110 + jgH(seed + 11, i) * 70, wob = Math.sin(t * 1.1 + i) * 22;
        ctx.beginPath();
        ctx.moveTo(vx, vTop);
        ctx.quadraticCurveTo(vx + 30 + wob, vTop + vl * 0.55, vx - 10 + wob * 1.3, vTop + vl);
        ctx.stroke();
        ctx.fillStyle = '#3f9c3a';
        const lx = vx - 10 + wob * 1.3, ly = vTop + vl;
        for (const a of [-0.6, 0.5]) {
          ctx.beginPath(); ctx.ellipse(lx + Math.cos(a) * 10, ly + Math.sin(a) * 10, 9, 5, a, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
      // puddle glints low in the band
      ctx.save();
      ctx.globalAlpha = 0.4 * dmg;
      for (const i of jgBuckets(x0, x1, 260)) {
        const px = i * 260 + jgH(seed + 21, i) * 120;
        if (px < x0 - 40 || px > x1 + 40) continue;
        const py = y0 + h * (0.9 + jgH(seed + 22, i) * 0.08);
        ctx.fillStyle = 'rgba(120,170,190,0.6)';
        ctx.beginPath(); ctx.ellipse(px, py, 22, 6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.ellipse(px - 6, py - 1, 5, 1.6, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    // mist band — thicker/greyer in storm mood
    ctx.save();
    ctx.globalAlpha = calm ? 0.12 : 0.22;
    ctx.fillStyle = '#ffffff';
    for (const i of jgBuckets(x0, x1, 340)) {
      const mx = i * 340 + jgH(seed + 3, i) * 100 + (t * 10) % 340;
      ctx.beginPath(); ctx.ellipse(mx, y0 + h * 0.7, 170, 30, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
    // calm mood extras: little flowers + butterflies dotted along the canopy line
    if (calm) {
      for (const i of jgBuckets(x0, x1, 300)) {
        const fx = i * 300 + jgH(seed + 41, i) * 140;
        if (fx < x0 - 20 || fx > x1 + 20) continue;
        const fy = y0 + h * 0.8 + jgH(seed + 42, i) * 30;
        ctx.fillStyle = ['#ff5a8a', '#ffb62b', '#b06cf0'][i % 3];
        for (let k = 0; k < 5; k++) {
          const a = k * TAU / 5;
          ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 7, fy + Math.sin(a) * 7, 4.5, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#ffe156'; ctx.beginPath(); ctx.arc(fx, fy, 4, 0, TAU); ctx.fill();
        const bfl = Math.sin(t * 9 + i) * 4;
        const bx = fx + 26, by = fy - 30 + Math.sin(t * 1.7 + i) * 6;
        ctx.fillStyle = '#fff8d0';
        ctx.beginPath(); ctx.ellipse(bx - 4, by, 6, 4 + bfl * 0.3, -0.4, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(bx + 4, by, 6, 4 - bfl * 0.3, 0.4, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  },

  caveBack(ctx, x0, y0, x1, y1, t = 0, o = {}) {
    const seed = o.seed || 0;
    const w = x1 - x0, h = y1 - y0;
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#3a3050'); g.addColorStop(1, '#241c38');
    ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
    // rough rock texture blobs
    for (const i of jgBuckets(x0, x1, 130)) {
      const rx = i * 130 + jgH(seed, i) * 70, ry = y0 + jgH(seed + 1, i) * h;
      const rs = 26 + jgH(seed + 2, i) * 34;
      ctx.save();
      ctx.globalAlpha = 0.1 + jgH(seed + 15, i) * 0.1;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      const nn = 6;
      for (let k = 0; k <= nn; k++) {
        const a = k * TAU / nn;
        const r = rs * (0.75 + jgH(seed + 20 + i, k) * 0.5);
        const px = rx + Math.cos(a) * r, py = ry + Math.sin(a) * r * 0.8;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // stalactites hanging from the top, craggy rounded tips
    for (const i of jgBuckets(x0, x1, 110)) {
      const sx = i * 110 + jgH(seed + 5, i) * 60;
      const sl = 40 + jgH(seed + 6, i) * 100;
      ctx.fillStyle = '#463a5e';
      ctx.beginPath();
      ctx.moveTo(sx - 18, y0); ctx.lineTo(sx + 18, y0); ctx.lineTo(sx + 4, y0 + sl * 0.7); ctx.lineTo(sx, y0 + sl);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.moveTo(sx - 14, y0); ctx.lineTo(sx - 2, y0); ctx.lineTo(sx, y0 + sl * 0.6); ctx.closePath(); ctx.fill();
    }
    // gnarly roots poking through near the top
    ctx.strokeStyle = '#5a4a34'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (const i of jgBuckets(x0, x1, 260)) {
      const rx = i * 260 + jgH(seed + 8, i) * 130;
      ctx.beginPath();
      ctx.moveTo(rx, y0 - 4);
      ctx.quadraticCurveTo(rx + 14, y0 + 26, rx - 8, y0 + 56);
      ctx.stroke();
    }
    // faint crystal glints in the rock
    for (const i of jgBuckets(x0, x1, 230)) {
      const cx2 = i * 230 + jgH(seed + 12, i) * 120, cy2 = y0 + h * (0.3 + jgH(seed + 13, i) * 0.5);
      if (cx2 < x0 || cx2 > x1) continue;
      const cols = ['#ff8fa0', '#7fd8ff', '#fff2a0'];
      const glow = 0.25 + 0.2 * Math.sin(t * 1.6 + i);
      ctx.save();
      ctx.globalAlpha = glow;
      ctx.fillStyle = cols[i % 3];
      starPath(ctx, cx2, cy2, 7, 3, 4);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },

  // -------------------------------------------------------------- ground
  groundPlate(ctx, x, y, w, h, t = 0, o = {}) {
    const kind = o.kind || 'grass';
    ctx.save();
    if (kind === 'grass') {
      ctx.fillStyle = '#8a5a34'; ctx.fillRect(x, y, w, h);
      const gh = Math.min(22, h * 0.3);
      const g = ctx.createLinearGradient(0, y, 0, y + gh);
      g.addColorStop(0, '#5cc25c'); g.addColorStop(1, '#3f9c3a');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, gh);
      ctx.strokeStyle = '#2f8028'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let bx = x + 10; bx < x + w - 6; bx += 24) {
        const sw = Math.sin(t * 1.5 + bx * 0.03) * 3;
        ctx.beginPath(); ctx.moveTo(bx, y + gh); ctx.quadraticCurveTo(bx + sw, y + gh * 0.4, bx + sw * 1.4, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      for (let bx = x + 20; bx < x + w - 10; bx += 46) ctx.fillRect(bx, y + gh + 4, 5, h - gh - 8);
    } else if (kind === 'mud') {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#7a5230'); g.addColorStop(1, '#523720');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let bx = x + 14; bx < x + w - 10; bx += 38) {
        const by = y + 6 + (jgH(bx, 3) * (h - 16));
        ctx.beginPath(); ctx.ellipse(bx, by, 12, 5, 0, 0, TAU); ctx.fill();
      }
      // shallow puddles across the top
      for (let bx = x + 30; bx < x + w - 30; bx += 90) {
        this.puddle(ctx, bx, y + 4, 46, t);
      }
    } else if (kind === 'cave') {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#5a5270'); g.addColorStop(1, '#3a3450');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      for (let bx = x + 6; bx < x + w; bx += 44) {
        ctx.beginPath();
        ctx.moveTo(bx, y); ctx.lineTo(bx + 22, y + 10); ctx.lineTo(bx + 6, y + h * 0.5); ctx.lineTo(bx - 10, y + h * 0.4);
        ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    } else if (kind === 'branch') {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#a97a4a'); g.addColorStop(1, '#7a5230');
      ctx.fillStyle = g; rr(ctx, x, y, w, h, Math.min(16, h / 2)); ctx.fill();
      ctx.strokeStyle = 'rgba(60,35,15,0.35)'; ctx.lineWidth = 3;
      for (let bx = x + 12; bx < x + w - 8; bx += 30) {
        ctx.beginPath(); ctx.ellipse(bx, y + h / 2, 9, h * 0.36, 0, 0, TAU); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x + 4, y + 2, w - 8, Math.max(2, h * 0.12));
    } else if (kind === 'leaf') {
      // a giant drooping leaf platform, veined, rounded, tip sags at +x end
      const droop = h * 0.35;
      ctx.fillStyle = '#4fae5a';
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.15);
      ctx.quadraticCurveTo(x + w * 0.4, y - h * 0.25, x + w * 0.82, y + droop * 0.3);
      ctx.quadraticCurveTo(x + w, y + droop, x + w * 0.9, y + h + droop * 0.5);
      ctx.quadraticCurveTo(x + w * 0.4, y + h * 1.1, x, y + h * 0.6);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2f8a3c'; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 6, y + h * 0.3); ctx.quadraticCurveTo(x + w * 0.45, y + h * 0.15, x + w * 0.85, y + h * 0.55); ctx.stroke();
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(x + w * (0.3 + k * 0.12), y + h * 0.25);
        ctx.lineTo(x + w * (0.36 + k * 0.12), y + h * 0.6);
        ctx.stroke();
      }
    } else { // rock — boulder-y: warm grey with bold seams, distinct from cave's cool purple wall
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#ada695'); g.addColorStop(1, '#7d7566');
      ctx.fillStyle = g;
      rr(ctx, x, y, w, h, Math.min(14, h * 0.2)); ctx.fill();
      ctx.strokeStyle = 'rgba(45,38,28,0.45)'; ctx.lineWidth = 3; rr(ctx, x, y, w, h, Math.min(14, h * 0.2)); ctx.stroke();
      // boulder facets (bold, so it doesn't read as grid-like cave rock)
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      for (let bx = x + 14; bx < x + w - 14; bx += 46) {
        ctx.beginPath(); ctx.ellipse(bx, y + h * 0.24, 16, 9, -0.2, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(45,38,28,0.4)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let bx = x + 22; bx < x + w - 10; bx += 48) {
        ctx.beginPath(); ctx.moveTo(bx, y + h * 0.3); ctx.lineTo(bx + 12, y + h * 0.92); ctx.stroke();
      }
    }
    ctx.restore();
  },

  // -------------------------------------------------------------- water
  waterPool(ctx, x, y, w, h, t = 0) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(120,175,190,0.85)'); g.addColorStop(1, 'rgba(80,130,150,0.9)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    for (let i = 0; i < Math.max(2, w / 60); i++) {
      const rx = x + (i * 60 + (t * 26) % 60) % w;
      ctx.beginPath(); ctx.ellipse(rx, y + h * 0.4 + (i % 3) * h * 0.18, 20, 5, 0, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, y, w, Math.min(6, h * 0.2));
    ctx.restore();
  },
  waterfall(ctx, x, y0, y1, w, t = 0) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x - w / 2, y0, w, y1 - y0); ctx.clip();
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, 'rgba(210,240,250,0.9)'); g.addColorStop(1, 'rgba(150,205,225,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(x - w / 2, y0, w, y1 - y0);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
    for (let i = -2; i <= 2; i++) {
      const wx = x + i * (w / 5) + Math.sin(t * 3 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(wx, y0);
      ctx.lineTo(wx + Math.sin(t * 4 + i * 2) * 6, y1);
      ctx.stroke();
    }
    // mist puff at the base
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(x + Math.sin(t * 1.4 + i) * 20, y1 - 6, 30 + i * 10, 14, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },
  stream(ctx, pts, t = 0, on = 1) {
    if (!pts || pts.length < 2) return;
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.35 * on;
    ctx.strokeStyle = '#6fb8d0'; ctx.lineWidth = 16 * (0.4 + 0.6 * on); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    if (on > 0.05) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 4;
      ctx.setLineDash([10, 14]); ctx.lineDashOffset = -t * 90 * on;
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  },
  puddle(ctx, cx, y, w, t = 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(110,165,185,0.65)';
    ctx.beginPath(); ctx.ellipse(cx, y, w / 2, w * 0.16, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    const r = (w / 2) * (0.3 + 0.35 * ((Math.sin(t * 1.6) + 1) / 2));
    ctx.beginPath(); ctx.ellipse(cx, y, r, r * 0.32, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  },

  // -------------------------------------------------------------- storm debris
  fallenTree(ctx, x, groundY, w, t = 0, o = {}) {
    const seed = o.seed || x;
    ctx.save();
    ctx.translate(x + w / 2, groundY);
    const th = Math.min(70, w * 0.22);
    jgTrunkFace(ctx, 0, -th * 0.5, w, th, -0.05, 'sad', seed);
    // roots fanned at the left end
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-w / 2, -th * 0.4);
      ctx.quadraticCurveTo(-w / 2 - 18, -th * 0.4 + i * 10, -w / 2 - 32, -th * 0.2 + i * 16);
      ctx.stroke();
    }
    // a couple of snapped branch stubs on top
    for (const [bx, bl] of [[-w * 0.15, 24], [w * 0.2, 18]]) {
      ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx, -th); ctx.lineTo(bx + 6, -th - bl); ctx.stroke();
    }
    ctx.restore();
  },
  brokenBranch(ctx, cx, y, s, t = 0) {
    ctx.save();
    ctx.translate(cx, y);
    ctx.rotate(0.3 + Math.sin(t * 1.2) * 0.03);
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = s * 0.22; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.5, 0); ctx.lineTo(s * 0.5, s * 0.12); ctx.stroke();
    ctx.strokeStyle = '#4e341c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(s * 0.42, s * 0.05); ctx.lineTo(s * 0.55, -s * 0.06); ctx.lineTo(s * 0.5, s * 0.2); ctx.closePath(); ctx.stroke();
    ctx.restore();
  },
  weakLog(ctx, cx, groundY, w, t = 0, o = {}) {
    const broken = !!o.broken, k = o.k || 0;
    const th = 78;
    ctx.save();
    if (!broken) {
      ctx.translate(cx, groundY - th * 0.5);
      jgTrunkFace(ctx, 0, 0, w, th, Math.sin(t * 2) * 0.02, 'sad', cx);
      // support stumps
      ctx.fillStyle = '#5a3d24';
      for (const sx of [-w * 0.36, w * 0.36]) { rr(ctx, sx - 10, th * 0.5 - 2, 20, 16, 4); ctx.fill(); }
    } else {
      // split into two halves flung apart by k
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(cx + side * (w * 0.32 + k * 60), groundY - th * 0.5 + k * -20 * Math.abs(side));
        ctx.rotate(side * (0.3 + k * 0.5));
        jgTrunkFace(ctx, 0, 0, w * 0.5, th * 0.9, 0, side < 0 ? 'dizzy' : 'surprised', cx + side);
        ctx.restore();
      }
      if (k < 0.99) {
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#ffce54';
        for (let i = 0; i < 5; i++) {
          const a = i * TAU / 5, r = 20 + k * 40;
          ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, groundY - th * 0.6 + Math.sin(a) * r, 4, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
    }
    ctx.restore();
  },
  bush(ctx, cx, groundY, s, t = 0, o = {}) {
    const shake = o.shake || 0;
    ctx.save();
    const sh = shake > 0.01 ? Math.sin(t * 26) * shake * 6 : 0;
    ctx.translate(cx + sh, groundY);
    ctx.fillStyle = '#4fae5a';
    ctx.beginPath(); ctx.arc(0, -s * 0.5, s * 0.55, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-s * 0.4, -s * 0.32, s * 0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.4, -s * 0.32, s * 0.4, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2f8a3c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, -s * 0.5, s * 0.55, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    if (shake > 0.01) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + i * 2.1;
        ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.7, -s * 0.9 + Math.sin(a) * s * 0.2, 4, 0, TAU); ctx.fill();
      }
    }
    drawFace(ctx, 0, -s * 0.48, s * 0.4, shake > 0.01 ? 'surprised' : 'happy', t, cx);
    ctx.restore();
  },
  mudSplash(ctx, x, y, s, t = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(90,60,30,0.55)';
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 + 0.4;
      ctx.beginPath(); ctx.ellipse(Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.18, s * 0.22, s * 0.1, a, 0, TAU); ctx.fill();
    }
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.32, s * 0.16, 0, 0, TAU); ctx.fill();
    ctx.restore();
  },
  rock(ctx, cx, groundY, s, t = 0, o = {}) {
    const seed = (o && o.seed) || cx;
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.fillStyle = '#8a8598';
    ctx.beginPath();
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const a = -Math.PI + i * Math.PI / n;
      const r = s * (0.5 + jgH(seed, i) * 0.12);
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,35,55,0.4)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.ellipse(-s * 0.16, -s * 0.34, s * 0.22, s * 0.1, -0.3, 0, TAU); ctx.fill();
    ctx.restore();
  },
  bigLeaf(ctx, cx, groundY, s, t = 0, o = {}) {
    const facing = (o && o.facing) || 1;
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.scale(facing, 1);
    const sway = Math.sin(t * 1.3 + cx) * 0.03;
    ctx.rotate(sway);
    ctx.strokeStyle = '#3f9c3a'; ctx.lineWidth = s * 0.06; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 0.1, -s * 0.5); ctx.stroke();
    ctx.fillStyle = '#4fae5a';
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 0.5);
    ctx.quadraticCurveTo(s * 0.9, -s * 0.7, s * 0.95, -s * 0.2);
    ctx.quadraticCurveTo(s * 0.5, s * 0.05, s * 0.1, -s * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2f8a3c'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(s * 0.14, -s * 0.46); ctx.lineTo(s * 0.82, -s * 0.32); ctx.stroke();
    ctx.restore();
  },

  // -------------------------------------------------------------- thorns / fire
  thornWall(ctx, cx, groundY, w, h, t = 0, o = {}) {
    const burn = o.burn || 0;
    ctx.save();
    ctx.translate(cx, groundY);
    const charH = h * burn;
    // vine curtain body (skipped where fully charred to ash)
    if (burn < 0.999) {
      const g = ctx.createLinearGradient(0, -h, 0, 0);
      g.addColorStop(0, '#4fae5a'); g.addColorStop(1, '#2f7a34');
      ctx.fillStyle = g;
      rr(ctx, -w / 2, -h, w, h - charH, w * 0.18); ctx.fill();
      ctx.strokeStyle = '#245a28'; ctx.lineWidth = 3; rr(ctx, -w / 2, -h, w, h - charH, w * 0.18); ctx.stroke();
      // thorns — sharp spikes poking OUT of the left/right edges, staggered,
      // so the silhouette itself reads spiky (not a grid of arrow icons)
      ctx.fillStyle = '#e8e0c0';
      ctx.strokeStyle = '#c9bf98'; ctx.lineWidth = 1.5;
      let row = 0;
      for (let ty = -h + 18; ty < -charH - 14; ty += 34) {
        for (const side of [-1, 1]) {
          if ((row + (side > 0 ? 1 : 0)) % 2 === 0) continue; // stagger left/right
          const ex = side * w / 2, tip = ex + side * 16;
          ctx.beginPath();
          ctx.moveTo(ex, ty - 7); ctx.lineTo(tip, ty + 3); ctx.lineTo(ex, ty + 10);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        row++;
      }
      // a few short spikes on the top edge too
      for (const sx of [-w * 0.28, w * 0.05, w * 0.3]) {
        ctx.beginPath();
        ctx.moveTo(sx - 7, -h); ctx.lineTo(sx, -h - 14); ctx.lineTo(sx + 7, -h);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // grumpy face near the top
      if (burn < 0.6) drawFace(ctx, 0, -h + h * 0.22, w * 0.32, 'angry', t, cx);
    }
    // charred base, growing with burn
    if (burn > 0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, burn * 1.6);
      ctx.fillStyle = '#2a2018';
      rr(ctx, -w / 2, -charH, w, charH, w * 0.14); ctx.fill();
      ctx.restore();
      // ash wisps once mostly gone
      if (burn > 0.7) {
        ctx.save();
        ctx.globalAlpha = (burn - 0.7) / 0.3 * 0.6;
        ctx.fillStyle = 'rgba(140,130,120,0.7)';
        for (let i = 0; i < 4; i++) {
          const a = t * 0.8 + i * 1.6;
          ctx.beginPath(); ctx.arc(Math.sin(a) * w * 0.3, -20 - i * 24 - (t * 12) % 24, 8, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
    }
    ctx.restore();
  },
  firePatch(ctx, x, groundY, w, t = 0, o = {}) {
    const on = o.on === undefined ? 1 : o.on, steam = o.steam || 0;
    ctx.save();
    ctx.translate(x, groundY);
    // scorched/wet ground strip
    ctx.fillStyle = steam > 0.5 ? 'rgba(70,60,55,0.5)' : 'rgba(40,30,20,0.55)';
    rr(ctx, -w / 2, -6, w, 10, 4); ctx.fill();
    if (steam > 0.05) {
      ctx.save();
      ctx.globalAlpha = steam * 0.6;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 5; i++) {
        const px = -w / 2 + (i + 0.5) * (w / 5);
        const py = -10 - ((t * 60 + i * 37) % 60);
        ctx.beginPath(); ctx.arc(px, py, 8 + (i % 2) * 4, 0, TAU); ctx.fill();
      }
      ctx.restore();
    } else if (on > 0.05) {
      const nfl = Math.max(3, Math.round(w / 44));
      for (let i = 0; i < nfl; i++) {
        const fx = -w / 2 + (i + 0.5) * (w / nfl);
        const fh = Math.min(46, w * 0.26) * on * (0.75 + 0.25 * Math.sin(t * 9 + i * 2));
        const fw = Math.min(20, w / nfl * 0.7);
        ctx.fillStyle = '#ff6b35';
        ctx.beginPath();
        ctx.moveTo(fx - fw * 0.5, 0); ctx.quadraticCurveTo(fx - fw * 0.3, -fh * 0.6, fx, -fh);
        ctx.quadraticCurveTo(fx + fw * 0.3, -fh * 0.6, fx + fw * 0.5, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffce54';
        ctx.beginPath();
        ctx.moveTo(fx - fw * 0.28, -2); ctx.quadraticCurveTo(fx - fw * 0.14, -fh * 0.55, fx, -fh * 0.85);
        ctx.quadraticCurveTo(fx + fw * 0.14, -fh * 0.55, fx + fw * 0.28, -2);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  },

  // -------------------------------------------------------------- machines
  valve(ctx, cx, groundY, s, t = 0, on = 0) {
    ctx.save();
    ctx.translate(cx, groundY);
    // pipe
    ctx.fillStyle = '#7a5230';
    rr(ctx, -s * 0.1, -s * 0.9, s * 0.28, s * 0.9, s * 0.06); ctx.fill();
    ctx.fillStyle = '#9a7248';
    rr(ctx, s * 0.02, -s * 0.62, s * 0.55, s * 0.16, s * 0.05); ctx.fill();
    ctx.strokeStyle = '#5a3d24'; ctx.lineWidth = 3;
    rr(ctx, -s * 0.1, -s * 0.9, s * 0.28, s * 0.9, s * 0.06); ctx.stroke();
    // wheel
    ctx.save();
    ctx.translate(-s * 0.02, -s * 0.9);
    ctx.rotate(on ? t * 3 : Math.sin(t * 0.6) * 0.05);
    ctx.strokeStyle = '#c8861b'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 4;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.05, Math.sin(a) * s * 0.05); ctx.lineTo(Math.cos(a) * s * 0.24, Math.sin(a) * s * 0.24); ctx.stroke();
    }
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(0, 0, s * 0.09, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, s * 0.24, 0, TAU); ctx.stroke();
    ctx.restore();
    // spurt of water from the pipe end (local +x) when on
    if (on) {
      ctx.save();
      ctx.translate(s * 0.57, -s * 0.54);
      ctx.strokeStyle = 'rgba(150,210,230,0.85)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * 0.5, -s * 0.1 + Math.sin(t * 8) * 6, s * 0.9, s * 0.3);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 4; i++) {
        const p = (t * 2 + i * 0.25) % 1;
        ctx.beginPath(); ctx.arc(p * s * 0.9, -s * 0.1 * (1 - p) + p * p * s * 0.4, 4, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    drawFace(ctx, s * 0.15, -s * 0.55, s * 0.11, on ? 'grin' : 'sleepy', t, cx);
    ctx.restore();
  },
  bud(ctx, cx, groundY, s, t = 0, k = 0) {
    ctx.save();
    ctx.translate(cx, groundY);
    // stem
    ctx.strokeStyle = '#3f9c3a'; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round';
    const topY = -s * lerp(0.35, 0.9, k);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, topY); ctx.stroke();
    ctx.save();
    ctx.translate(0, topY);
    if (k < 0.999) {
      // closed bud: a plump teardrop
      ctx.fillStyle = '#7bd66a';
      ctx.beginPath();
      ctx.moveTo(0, s * 0.32 * (1 - k * 0.4));
      ctx.quadraticCurveTo(-s * 0.34, s * 0.05, 0, -s * 0.32);
      ctx.quadraticCurveTo(s * 0.34, s * 0.05, 0, s * 0.32 * (1 - k * 0.4));
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3f9c3a'; ctx.lineWidth = 3; ctx.stroke();
      // seam lines hint the petals about to open
      ctx.strokeStyle = 'rgba(60,140,50,0.5)'; ctx.lineWidth = 2;
      for (const sd of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(0, -s * 0.3); ctx.quadraticCurveTo(sd * s * 0.14, 0, 0, s * 0.28); ctx.stroke();
      }
    } else {
      // fully bloomed: flat-topped flower platform — top surface at
      // local y = -s*0.9 relative to groundY total, i.e. groundY - s*0.9
      const pr = s * 0.62;
      ctx.fillStyle = ['#ff5a8a', '#ffb62b', '#b06cf0', '#ff8fb0', '#ffd24a'][Math.floor(cx) % 5];
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8;
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * pr * 0.7, Math.sin(a) * pr * 0.28, pr * 0.5, pr * 0.22, a, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(120,50,80,0.3)'; ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8;
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * pr * 0.7, Math.sin(a) * pr * 0.28, pr * 0.5, pr * 0.22, a, 0, TAU); ctx.stroke();
      }
      // flat solid-feeling top disc
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.ellipse(0, 0, pr * 0.85, pr * 0.32, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 3; ctx.stroke();
      drawFace(ctx, 0, -pr * 0.06, pr * 0.4, 'happy', t, cx);
    }
    ctx.restore();
    // sparkle burst at the moment of blooming
    if (k > 0.85 && k < 1) {
      ctx.save();
      ctx.globalAlpha = (k - 0.85) / 0.15;
      ctx.fillStyle = '#fff2a0';
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6;
        starPath(ctx, Math.cos(a) * s * 0.5, topY + Math.sin(a) * s * 0.5, 8, 3, 4);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  },
  launchPad(ctx, cx, groundY, s, t = 0) {
    ctx.save();
    ctx.translate(cx, groundY);
    const press = 1 - Math.abs(Math.sin(t * 2)) * 0.06;
    // spring coil base
    ctx.strokeStyle = '#c8861b'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const yy = -i * s * 0.1 * press;
      ctx.beginPath(); ctx.ellipse(0, yy, s * 0.22, s * 0.08, 0, 0, TAU); ctx.stroke();
    }
    // giant leaf pad
    ctx.save();
    ctx.translate(0, -s * 0.32 * press);
    ctx.scale(1, press);
    ctx.fillStyle = '#4fae5a';
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2f8a3c'; ctx.lineWidth = 3; ctx.stroke();
    drawFace(ctx, 0, -s * 0.02, s * 0.16, 'grin', t, cx);
    ctx.restore();
    // upward arrows
    ctx.fillStyle = 'rgba(255,209,74,0.85)';
    for (let i = 0; i < 3; i++) {
      const ay = -s * 0.5 - i * s * 0.22 - ((t * s * 0.5) % (s * 0.22));
      ctx.save();
      ctx.globalAlpha = 1 - (i / 3);
      ctx.beginPath();
      ctx.moveTo(0, ay - s * 0.09); ctx.lineTo(s * 0.14, ay + s * 0.07); ctx.lineTo(-s * 0.14, ay + s * 0.07);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },

  // -------------------------------------------------------------- crystals
  crystal(ctx, cx, groundY, s, t = 0, o = {}) {
    const color = o.color || 'blue', glow = o.glow || 0, face = o.face !== false;
    const cols = { red: ['#ff6b6b', '#c23c3c'], blue: ['#7fd8ff', '#2f8fd0'], yellow: ['#fff2a0', '#d8b830'] };
    const [c1, c2] = cols[color] || cols.blue;
    ctx.save();
    ctx.translate(cx, groundY);
    if (glow > 0.02) {
      ctx.save();
      ctx.globalAlpha = 0.35 * glow;
      ctx.fillStyle = c1;
      ctx.beginPath(); ctx.arc(0, -s * 0.5, s * 0.75 * (0.9 + 0.1 * Math.sin(t * 4)), 0, TAU); ctx.fill();
      ctx.restore();
    }
    // cluster of 3 shards
    for (const [ox, sh, sw] of [[-s * 0.22, s * 0.8, s * 0.22], [0, s * 1.0, s * 0.3], [s * 0.24, s * 0.65, s * 0.2]]) {
      ctx.save();
      ctx.translate(ox, 0);
      const g = ctx.createLinearGradient(0, -sh, 0, 0);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -sh); ctx.lineTo(sw / 2, -sh * 0.25); ctx.lineTo(sw * 0.4, 0); ctx.lineTo(-sw * 0.4, 0); ctx.lineTo(-sw / 2, -sh * 0.25);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = glow > 0.4 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.moveTo(0, -sh); ctx.lineTo(sw * 0.14, -sh * 0.3); ctx.lineTo(-sw * 0.06, -sh * 0.3); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (face) drawFace(ctx, 0, -s * 0.42, s * 0.24, glow > 0.4 ? 'grin' : 'sleepy', t, cx);
    ctx.restore();
  },
  crystalChamber(ctx, cx, groundY, w, t = 0, glow = 0) {
    ctx.save();
    ctx.translate(cx, groundY);
    // wall clusters flanking the chamber
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const x2 = side * (w / 2 - 40 - i * 60), y2 = -30 - i * 40;
        this.crystal(ctx, x2, y2, 44, t + i, { color: ['red', 'blue', 'yellow'][(i + (side > 0 ? 1 : 0)) % 3], glow: glow * 0.7, face: false });
      }
    }
    // ambient sparkle
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.3 * glow;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 8; i++) {
      const a = t * 0.6 + i * 1.3;
      const px = Math.sin(a) * w * 0.36, py = -60 - ((t * 20 + i * 47) % 120);
      ctx.beginPath(); ctx.arc(px, py, 2.5, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  },

  // -------------------------------------------------------------- nursery
  nursery(ctx, cx, groundY, w, t = 0, o = {}) {
    const life = o.life || 0;
    ctx.save();
    ctx.translate(cx, groundY);
    // clip out anything below the ground line — the deck plates paint over
    // this, and caves sit underneath, so nothing here may bleed past +6
    ctx.beginPath(); ctx.rect(-w / 2 - 20, -400, w + 40, 406); ctx.clip();
    // a soft strip lying ON the ground surface (never a big ellipse, never
    // dipping below the deck) with little grass tufts along it
    const stripTop = -10, stripBot = 6;
    ctx.fillStyle = 'rgba(140,210,130,0.4)';
    rr(ctx, -w / 2, stripTop, w, stripBot - stripTop, 6); ctx.fill();
    ctx.strokeStyle = '#3f9c3a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let bx = -w / 2 + 10; bx < w / 2 - 6; bx += 22) {
      const sway = Math.sin(t * 1.4 + bx * 0.05 + cx) * 2;
      ctx.beginPath();
      ctx.moveTo(bx, stripTop + 2);
      ctx.quadraticCurveTo(bx + sway, stripTop - 8, bx + sway * 1.6, stripTop - 14);
      ctx.stroke();
    }
    // flowers opening with life, spaced along the strip (not a ring)
    const n = 8;
    for (let i = 0; i < n; i++) {
      const fx = -w / 2 + (i + 0.5) * (w / n);
      const open = clamp(life * n - i, 0, 1);
      if (open <= 0.01) continue;
      ctx.save();
      ctx.translate(fx, stripTop - open * 4);
      ctx.fillStyle = ['#ff5a8a', '#ffb62b', '#b06cf0'][i % 3];
      for (let k = 0; k < 5; k++) {
        const pa = k * TAU / 5;
        ctx.beginPath(); ctx.arc(Math.cos(pa) * 8 * open, Math.sin(pa) * 8 * open, 5 * open, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#ffe156'; ctx.beginPath(); ctx.arc(0, 0, 4 * open, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // butterflies once fairly alive
    if (life > 0.4) {
      ctx.save();
      ctx.globalAlpha = clamp((life - 0.4) / 0.6, 0, 1);
      ctx.fillStyle = '#fff8d0';
      for (let i = 0; i < 3; i++) {
        const a = t * 0.9 + i * 2.1;
        const bx = Math.cos(a) * w * 0.3, by = -70 - i * 14 + Math.sin(t * 2 + i) * 8;
        const fl = Math.sin(t * 9 + i) * 4;
        ctx.beginPath(); ctx.ellipse(bx - 4, by, 6, 4 + fl * 0.3, -0.4, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(bx + 4, by, 6, 4 - fl * 0.3, 0.4, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    // little sign post with a paw/egg icon
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-w * 0.02, -6); ctx.lineTo(-w * 0.02, -70); ctx.stroke();
    ctx.fillStyle = '#fff6e0';
    rr(ctx, -w * 0.02 - 30, -104, 60, 40, 8); ctx.fill();
    ctx.strokeStyle = '#c9b88a'; ctx.lineWidth = 3; rr(ctx, -w * 0.02 - 30, -104, 60, 40, 8); ctx.stroke();
    // paw print icon
    ctx.fillStyle = '#a8d8a0';
    ctx.beginPath(); ctx.ellipse(-w * 0.02, -78, 10, 8, 0, 0, TAU); ctx.fill();
    for (const [ox, oy] of [[-9, -12], [-2, -16], [7, -12]]) {
      ctx.beginPath(); ctx.arc(-w * 0.02 + ox, -84 + oy * 0.3, 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  },

  // -------------------------------------------------------------- barrier
  barrier(ctx, cx, groundY, t = 0, o = {}) {
    const log = o.log === undefined ? 1 : o.log, rocks = o.rocks === undefined ? 1 : o.rocks;
    const lever = o.lever || 0, rope = o.rope || 0, vines = o.vines === undefined ? 1 : o.vines;
    ctx.save();
    ctx.translate(cx, groundY);
    // layout, left to right across ~800 wide: log (x -320), rocks (x -100),
    // lever up high (x 40, y -320), rope/pulley gap (x 150), thorny curtain (x 320)
    // giant fallen log: intact blocks the ground; charged aside once cleared
    ctx.save();
    ctx.translate(-320 + (1 - log) * -140, 0);
    ctx.rotate((1 - log) * -0.35);
    jgTrunkFace(ctx, 0, -44, 220, 68, 0, log > 0.5 ? 'angry' : 'dizzy', cx);
    ctx.restore();
    // boulder pile: intact mound -> smashed pebbles
    ctx.save();
    ctx.translate(-100, 0);
    if (rocks > 0.15) {
      for (const [ox, s2] of [[-30, 46], [10, 60], [42, 40]]) {
        this.rock(ctx, ox * rocks, -2, s2 * (0.6 + 0.4 * rocks), t, { seed: ox + cx });
      }
    } else {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#8a8598';
      for (let i = 0; i < 10; i++) {
        const a = jgH(cx, i) * TAU, r = 20 + jgH(cx + 1, i) * 60;
        ctx.beginPath(); ctx.arc(Math.cos(a) * r, -6 - Math.abs(Math.sin(a)) * 10, 6 + jgH(cx + 2, i) * 6, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
    // high branch lever
    ctx.save();
    ctx.translate(40, -320);
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 60); ctx.stroke(); // post
    ctx.save();
    ctx.rotate(-0.6 + lever * 1.1);
    ctx.strokeStyle = '#a97a4a'; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(50, 0); ctx.stroke();
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(-50, 0, 10, 0, TAU); ctx.fill();
    ctx.restore();
    drawFace(ctx, 0, 20, 16, lever > 0.5 ? 'grin' : 'sleepy', t, cx + 9);
    ctx.restore();
    // hanging rope to a pulley — hoists to reveal a gap
    ctx.save();
    ctx.translate(150, -340);
    ctx.fillStyle = '#c8a468'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8a5230'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#c8a468'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    const ropeLen = lerp(300, 30, rope);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, ropeLen); ctx.stroke();
    if (rope < 0.9) {
      ctx.fillStyle = '#a97a4a';
      rr(ctx, -18, ropeLen - 4, 36, 26, 6); ctx.fill(); // basket at the end
    }
    ctx.restore();
    // thorny curtain — burns away with vines (0 = burnt away)
    this.thornWall(ctx, 320, 0, 120, 260, t, { burn: 1 - vines });
    ctx.restore();
  },

  // -------------------------------------------------------------- flourish
  rainbow(ctx, cx, groundY, r, t = 0, k = 1) {
    ctx.save();
    ctx.globalAlpha = clamp(k, 0, 1);
    ctx.translate(cx, groundY);
    ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
    RAINBOW.forEach((c, i) => {
      ctx.strokeStyle = c;
      ctx.beginPath(); ctx.arc(0, 0, r - i * r * 0.06, Math.PI, TAU); ctx.stroke();
    });
    ctx.restore();
  },
  bloomBurst(ctx, x, groundY, w, t = 0, k = 1) {
    ctx.save();
    ctx.translate(x, groundY);
    const n = Math.max(1, Math.round(w / 90));
    for (let i = 0; i < n; i++) {
      const fx = -w / 2 + (i + 0.5) * (w / n);
      const open = clamp(k * n - i, 0, 1);
      if (open <= 0.02) continue;
      ctx.save();
      ctx.translate(fx, -open * 8);
      ctx.strokeStyle = '#3f9c3a'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -24 * open); ctx.stroke();
      ctx.fillStyle = [ '#ff5a8a', '#ffb62b', '#b06cf0', '#ff8fb0'][i % 4];
      for (let p = 0; p < 6; p++) {
        const a = p * TAU / 6 + t * 0.4;
        ctx.beginPath(); ctx.arc(Math.cos(a) * 12 * open, -24 * open + Math.sin(a) * 12 * open, 8 * open, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(0, -24 * open, 7 * open, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },

  // -------------------------------------------------------------- run course
  runRamp(ctx, x0, y0, x1, y1, t = 0) {
    ctx.save();
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const len = Math.hypot(x1 - x0, y1 - y0);
    ctx.translate(x0, y0); ctx.rotate(ang);
    const g = ctx.createLinearGradient(0, -18, 0, 18);
    g.addColorStop(0, '#a97a4a'); g.addColorStop(1, '#7a5230');
    ctx.fillStyle = g;
    rr(ctx, 0, -18, len, 36, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(60,35,15,0.4)'; ctx.lineWidth = 3; rr(ctx, 0, -18, len, 36, 12); ctx.stroke();
    // support props under a fallen-trunk deck
    ctx.strokeStyle = '#5a3d24'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    for (let bx = len * 0.2; bx < len; bx += len * 0.28) {
      ctx.beginPath(); ctx.moveTo(bx, 12); ctx.lineTo(bx - 10, 60); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(6, -16, len - 12, 5);
    ctx.restore();
  },
  collapseLog(ctx, cx, groundY, w, t = 0, k = 0) {
    ctx.save();
    ctx.translate(cx, groundY);
    const sag = k * 40, tilt = k * 0.5;
    ctx.rotate(tilt * Math.sin(t * 6) * 0.3 + tilt);
    ctx.translate(0, sag);
    const th = 46;
    const g = ctx.createLinearGradient(0, -th, 0, 0);
    g.addColorStop(0, '#a97a4a'); g.addColorStop(1, '#7a5230');
    ctx.fillStyle = g; rr(ctx, -w / 2, -th, w, th, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(60,35,15,0.4)'; ctx.lineWidth = 3; rr(ctx, -w / 2, -th, w, th, 10); ctx.stroke();
    // fraying rope binding, snaps visually as k rises
    ctx.strokeStyle = k < 0.7 ? '#c8a468' : 'rgba(200,164,104,0.3)'; ctx.lineWidth = 3;
    for (let bx = -w / 2 + 14; bx < w / 2; bx += 28) {
      ctx.beginPath(); ctx.moveTo(bx, -th); ctx.lineTo(bx + 6, 4); ctx.stroke();
    }
    if (k > 0.01) drawFace(ctx, 0, -th * 0.5, th * 0.5, 'surprised', t, cx);
    ctx.restore();
  },
  bouncePlant(ctx, cx, groundY, s, t = 0, squish = 0) {
    ctx.save();
    ctx.translate(cx, groundY);
    const sc = 1 - squish * 0.4;
    ctx.strokeStyle = '#3f9c3a'; ctx.lineWidth = s * 0.14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.5 * sc); ctx.stroke();
    ctx.save();
    ctx.translate(0, -s * 0.5 * sc);
    ctx.scale(1 + squish * 0.3, sc);
    ctx.fillStyle = '#ff5a8a';
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6;
      ctx.beginPath(); ctx.ellipse(Math.cos(a) * s * 0.32, Math.sin(a) * s * 0.32, s * 0.24, s * 0.14, a, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#ffe156'; ctx.beginPath(); ctx.arc(0, 0, s * 0.2, 0, TAU); ctx.fill();
    drawFace(ctx, 0, 0, s * 0.16, squish > 0.3 ? 'surprised' : 'happy', t, cx);
    ctx.restore();
    ctx.restore();
  },
  candyPlatform(ctx, cx, groundY, w, t = 0) {
    ctx.save();
    ctx.translate(cx, groundY);
    // big leaf/rock stage
    const g = ctx.createLinearGradient(0, -30, 0, 10);
    g.addColorStop(0, '#9a97a8'); g.addColorStop(1, '#6a6478');
    ctx.fillStyle = g; rr(ctx, -w / 2, -20, w, 30, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(40,35,55,0.4)'; ctx.lineWidth = 3; rr(ctx, -w / 2, -20, w, 30, 12); ctx.stroke();
    ctx.fillStyle = '#4fae5a'; ctx.beginPath(); ctx.ellipse(0, -20, w * 0.46, 14, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2f8a3c'; ctx.lineWidth = 3; ctx.stroke();
    // garlands strung between two posts
    for (const side of [-1, 1]) {
      ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(side * w * 0.4, -20); ctx.lineTo(side * w * 0.4, -90); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,209,74,0.8)'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-w * 0.4, -90);
    ctx.quadraticCurveTo(0, -60 + Math.sin(t * 1.5) * 4, w * 0.4, -90);
    ctx.stroke();
    for (let i = -3; i <= 3; i++) {
      const gx = i * (w * 0.4 / 3.5);
      const gy = -90 + (1 - (gx / (w * 0.4)) ** 2) * 30 + Math.sin(t * 1.5) * 4;
      drawCandy(ctx, gx, gy, 14, i + 3, t);
    }
    ctx.restore();
  }
};
