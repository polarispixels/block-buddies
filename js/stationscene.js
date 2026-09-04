'use strict';
// ST_SCENE: station scenery, the battery/socket kit and every machine
// (THE ALIEN SPACE STATION — docs/superpowers/specs/2026-09-04-alien-space-station-design.md)
//
// Pure drawing functions, world-space (y grows down), no game-state reads —
// every export takes ctx + explicit args and saves/restores its own
// transform/style. Seen mostly through the darkness overlay, so "on"/lit
// parts must be strongly self-lit neon on dark charcoal/violet metal.
// Companion packs: js/stationart.js (ST_ART, creatures/cinematics — owned
// separately) and js/station.js (the PowerGrid kit classes + machine logic).
const ST_SCENE = (function () {
  const METAL_DARK = '#1c1836', METAL_MID = '#2a2450', METAL_LIGHT = '#3d3766';
  const NEON = { cyan: '#4dfcff', magenta: '#ff4df0', lime: '#a8ff3c', orange: '#ffb347' };

  // ---- shared little helpers -------------------------------------------
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function strokePolyline(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  function polyLen(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return L;
  }
  function pointAt(pts, f) {
    const total = polyLen(pts);
    let d = f * total;
    for (let i = 1; i < pts.length; i++) {
      const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (d <= seg || i === pts.length - 1) {
        const k = seg > 0 ? d / seg : 0;
        return { x: lerp(pts[i - 1].x, pts[i].x, k), y: lerp(pts[i - 1].y, pts[i].y, k) };
      }
      d -= seg;
    }
    return pts[pts.length - 1];
  }
  function drawHexPort(ctx, x, y, r, bright) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU, px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = bright ? rgba(NEON.magenta, 0.35) : 'rgba(10,8,20,0.6)';
    ctx.fill();
    ctx.strokeStyle = bright ? rgba(NEON.magenta, 0.8) : 'rgba(90,85,120,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  function gooDrip(ctx, x, y, len, t) {
    ctx.save();
    ctx.strokeStyle = 'rgba(120,200,80,0.55)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    const wob = Math.sin(t * 1.3 + x) * 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + wob, y + len * 0.6, x, y + len); ctx.stroke();
    ctx.fillStyle = 'rgba(120,200,80,0.6)';
    ctx.beginPath(); ctx.arc(x, y + len, 4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function ceilingVentGrille(ctx, x, y, w, bright) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = METAL_DARK;
    rr(ctx, -w / 2, 0, w, 14, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; rr(ctx, -w / 2, 0, w, 14, 3); ctx.stroke();
    ctx.strokeStyle = bright ? rgba(NEON.lime, 0.5) : 'rgba(90,85,120,0.4)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 5; i++) {
      const lx = -w / 2 + i * w / 5;
      ctx.beginPath(); ctx.moveTo(lx, 2); ctx.lineTo(lx, 12); ctx.stroke();
    }
    ctx.restore();
  }

  // ==================================================================== 1-3: walls/floors
  function wallPanels(ctx, x0, y0, x1, y1, t = 0, o = {}) {
    const style = o.style || 'dark', seed = o.seed || 0;
    const w = x1 - x0, h = y1 - y0;
    ctx.save();
    const g = ctx.createLinearGradient(x0, y0, x0, y1);
    g.addColorStop(0, METAL_MID); g.addColorStop(1, METAL_DARK);
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, w, h);
    const cell = 240;
    const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = x0 + c * cell, py = y0 + r * cell;
        const pw = Math.min(cell, x1 - px), ph = Math.min(cell, y1 - py);
        if (pw <= 4 || ph <= 4) continue;
        const inset = 9;
        const h2 = hash2(c + seed * 97, r + seed * 131);
        ctx.fillStyle = h2 < 0.5 ? METAL_DARK : METAL_MID;
        rr(ctx, px + inset, py + inset, pw - inset * 2, ph - inset * 2, 14); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 3;
        rr(ctx, px + inset, py + inset, pw - inset * 2, ph - inset * 2, 14); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        for (const [rx, ry] of [[inset + 10, inset + 10], [pw - inset - 10, inset + 10],
          [inset + 10, ph - inset - 10], [pw - inset - 10, ph - inset - 10]]) {
          ctx.beginPath(); ctx.arc(px + rx, py + ry, 3.5, 0, TAU); ctx.fill();
        }
        if (h2 > 0.8) drawHexPort(ctx, px + pw * 0.5, py + ph * 0.5, 20, style === 'bright');
        const h3 = hash2(c * 7 + seed + 3, r * 13 + seed + 5);
        if (h3 > 0.72) glyph(ctx, px + pw * 0.26, py + ph * 0.78, 22, t, Math.floor(h3 * 37) % 6, style === 'bright' ? 1 : 0);
        if (style === 'bright') {
          const on = 0.5 + 0.5 * Math.sin(t * 2 + h2 * TAU);
          ctx.strokeStyle = rgba(NEON.cyan, 0.3 + 0.4 * on); ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(px + inset + 8, py + inset + 6); ctx.lineTo(px + pw - inset - 8, py + inset + 6); ctx.stroke();
          const cc = [NEON.cyan, NEON.magenta, NEON.lime, NEON.orange][(c + r) % 4];
          ctx.strokeStyle = rgba(cc, 0.35); ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(px + inset + 6, py + ph - inset - 10); ctx.lineTo(px + pw - inset - 6, py + ph - inset - 10); ctx.stroke();
        }
        if (style === 'webbed' && h2 > 0.86) gooDrip(ctx, px + pw * 0.7, py + inset + 4, 30 + h3 * 26, t);
      }
    }
    if (style === 'webbed') {
      web(ctx, x0 + 24, y0 + 6, 100, t);
      if (w > 300) web(ctx, x1 - 24, y0 + 6, 80, t);
    }
    ctx.restore();
  }
  function floorPanel(ctx, x, y, w, h, t = 0, o = {}) {
    const style = o.style || 'dark', top = o.top !== false;
    ctx.save();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, METAL_MID); g.addColorStop(1, METAL_DARK);
    ctx.fillStyle = g;
    rr(ctx, x, y, w, h, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 3;
    rr(ctx, x, y, w, h, 10); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2;
    const n = Math.max(2, Math.round(w / 44));
    for (let i = 1; i < n; i++) {
      const lx = x + i * w / n;
      ctx.beginPath(); ctx.moveTo(lx, y + 5); ctx.lineTo(lx, y + h - 5); ctx.stroke();
    }
    if (top) {
      const bright = style === 'bright';
      if (bright) {
        ctx.save(); ctx.globalAlpha = 0.5 + 0.15 * Math.sin(t * 3);
        ctx.strokeStyle = NEON.cyan; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(x + 8, y + 4); ctx.lineTo(x + w - 8, y + 4); ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle = bright ? rgba(NEON.cyan, 0.95) : 'rgba(90,85,120,0.55)';
      ctx.lineWidth = bright ? 4 : 3;
      ctx.beginPath(); ctx.moveTo(x + 8, y + 4); ctx.lineTo(x + w - 8, y + 4); ctx.stroke();
    }
    ctx.restore();
  }
  function ceiling(ctx, x, y, w, h, t = 0, o = {}) {
    const style = o.style || 'dark';
    floorPanel(ctx, x, y, w, h, t, { style, top: false });
    ctx.save();
    ctx.strokeStyle = 'rgba(10,8,20,0.85)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    const cn = Math.max(1, Math.round(w / 220));
    for (let i = 0; i < cn; i++) {
      const cx = x + (i + 0.5) * w / cn;
      const dl = 16 + hash2(i, Math.floor(x) + (o.seed || 0)) * 22;
      ctx.beginPath(); ctx.moveTo(cx, y + h); ctx.quadraticCurveTo(cx + 6, y + h + dl * 0.6, cx - 4, y + h + dl); ctx.stroke();
      ctx.fillStyle = '#111022'; ctx.beginPath(); ctx.arc(cx - 4, y + h + dl, 4, 0, TAU); ctx.fill();
    }
    const vn = Math.max(1, Math.round(w / 300));
    for (let i = 0; i < vn; i++) ceilingVentGrille(ctx, x + (i + 0.5) * w / vn, y + h - 2, 56, style === 'bright');
    ctx.restore();
  }

  // ==================================================================== 4: lights/decor
  function emergencyLight(ctx, x, y, t = 0, on = 1) {
    ctx.save();
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.globalAlpha = 0.28 * on * pulse;
    ctx.fillStyle = '#ff2d4d';
    ctx.beginPath(); ctx.arc(x, y, 46, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = METAL_LIGHT;
    rr(ctx, x - 15, y - 8, 30, 16, 4); ctx.fill();
    ctx.fillStyle = `rgba(255,45,77,${0.55 + 0.45 * pulse * on})`;
    ctx.beginPath(); ctx.arc(x, y - 7, 11, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#6a1020'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 7, 11, Math.PI, 0); ctx.stroke();
    ctx.restore();
  }
  function ceilingLight(ctx, x, y, w, t = 0, on = 1) {
    ctx.save();
    ctx.fillStyle = METAL_LIGHT;
    rr(ctx, x - w / 2 - 6, y - 6, w + 12, 12, 4); ctx.fill();
    const a = clamp(on, 0, 1);
    if (a > 0.03) {
      ctx.save(); ctx.globalAlpha = 0.16 * a; ctx.fillStyle = NEON.cyan;
      ctx.beginPath(); ctx.ellipse(x, y + 46, w * 0.65, 66, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = a > 0.03 ? rgba(NEON.cyan, 0.45 + 0.55 * a) : 'rgba(90,85,120,0.4)';
    rr(ctx, x - w / 2, y - 2, w, 6, 3); ctx.fill();
    ctx.restore();
  }
  function glyph(ctx, x, y, s, t = 0, i = 0, glow = 0) {
    ctx.save();
    ctx.translate(x, y);
    const kind = ((i % 6) + 6) % 6;
    const col = glow > 0 ? NEON.cyan : 'rgba(150,140,200,0.55)';
    if (glow > 0) {
      ctx.save(); ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 3 + x);
      ctx.fillStyle = NEON.cyan; ctx.beginPath(); ctx.arc(0, 0, s * 0.85, 0, TAU); ctx.fill(); ctx.restore();
    }
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(1.5, s * 0.12); ctx.lineCap = 'round';
    if (kind === 0) {
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = k / 3 * TAU - Math.PI / 2, px = Math.cos(a) * s * 0.5, py = Math.sin(a) * s * 0.5;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
    } else if (kind === 1) {
      for (const dx of [-0.4, 0, 0.4]) { ctx.beginPath(); ctx.arc(dx * s, 0, s * 0.12, 0, TAU); ctx.fill(); }
    } else if (kind === 2) {
      ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.3); ctx.lineTo(-s * 0.15, s * 0.3);
      ctx.lineTo(s * 0.15, -s * 0.3); ctx.lineTo(s * 0.5, s * 0.3); ctx.stroke();
    } else if (kind === 3) {
      ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, Math.PI * 1.5); ctx.stroke();
    } else if (kind === 4) {
      ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.lineTo(s * 0.35, 0); ctx.lineTo(0, s * 0.5); ctx.lineTo(-s * 0.35, 0);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, s * 0.08, 0, TAU); ctx.fill();
    } else {
      for (const dx of [-0.3, 0.3]) { ctx.beginPath(); ctx.moveTo(dx * s, -s * 0.4); ctx.lineTo(dx * s, s * 0.4); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-s * 0.3, 0); ctx.lineTo(s * 0.3, 0); ctx.stroke();
    }
    ctx.restore();
  }

  // ==================================================================== 5-10: hardware/decor
  function vent(ctx, cx, y, s = 70, t = 0, o = {}) {
    const open = o.open || 0;
    ctx.save();
    ctx.translate(cx, y);
    ctx.fillStyle = METAL_MID;
    rr(ctx, -s / 2, -s / 2, s, s, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rr(ctx, -s / 2, -s / 2, s, s, 8); ctx.stroke();
    if (open > 0.08) {
      ctx.save(); ctx.globalAlpha = open;
      ctx.fillStyle = '#050410';
      rr(ctx, -s / 2 + 6, -s / 2 + 6, s - 12, s - 12, 6); ctx.fill();
      ctx.restore();
    }
    // the grille flap: a real hinged panel (not just lines) so "open" reads
    // as a door swinging down, not the slats vanishing
    ctx.save();
    ctx.translate(0, -s / 2);
    ctx.rotate(open * 1.15);
    ctx.fillStyle = METAL_LIGHT;
    rr(ctx, -s / 2 + 3, 0, s - 6, s - 6, 4); ctx.fill();
    ctx.strokeStyle = '#0e0c1c'; ctx.lineWidth = 3;
    rr(ctx, -s / 2 + 3, 0, s - 6, s - 6, 4); ctx.stroke();
    for (let i = 1; i < 4; i++) {
      const ly = i * (s - 6) / 4;
      ctx.beginPath(); ctx.moveTo(-s / 2 + 8, ly); ctx.lineTo(s / 2 - 8, ly); ctx.stroke();
    }
    // hinge pin
    ctx.fillStyle = '#0e0c1c';
    ctx.beginPath(); ctx.arc(-s / 2 + 6, 3, 3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(s / 2 - 6, 3, 3, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.restore();
  }
  function brokenDoor(ctx, cx, groundY, t = 0) {
    const w = 120, h = 220;
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.fillStyle = METAL_LIGHT;
    rr(ctx, -w / 2 - 10, -h - 10, w + 20, h + 10, 6); ctx.fill();
    ctx.fillStyle = '#050410';
    rr(ctx, -w / 2, -h, w, h, 4); ctx.fill();
    ctx.save();
    ctx.translate(-w * 0.15, -h * 0.5);
    ctx.rotate(-0.12);
    ctx.fillStyle = METAL_MID;
    rr(ctx, -w * 0.32, -h * 0.42, w * 0.6, h * 0.85, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rr(ctx, -w * 0.32, -h * 0.42, w * 0.6, h * 0.85, 6); ctx.stroke();
    ctx.strokeStyle = rgba(NEON.orange, 0.65); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-w * 0.28, -h * 0.3); ctx.lineTo(w * 0.16, h * 0.2); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  function doorway(ctx, cx, groundY, lit = 0, t = 0) {
    const w = 120, h = 220;
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.fillStyle = METAL_LIGHT;
    rr(ctx, -w / 2 - 10, -h - 10, w + 20, h + 10, 6); ctx.fill();
    if (lit > 0.04) {
      const g = ctx.createLinearGradient(0, -h, 0, 0);
      g.addColorStop(0, rgba(NEON.cyan, 0.15 + 0.55 * lit));
      g.addColorStop(1, rgba(NEON.cyan, 0.05 + 0.2 * lit));
      ctx.fillStyle = g;
    } else ctx.fillStyle = '#050410';
    rr(ctx, -w / 2, -h, w, h, 4); ctx.fill();
    if (lit > 0.04) {
      ctx.save();
      rr(ctx, -w / 2, -h, w, h, 4); ctx.clip();
      ctx.globalAlpha = 0.35 * lit * (0.7 + 0.3 * Math.sin(t * 3));
      ctx.fillStyle = NEON.cyan;
      ctx.beginPath(); ctx.ellipse(0, -h * 0.42, w * 0.7, h * 0.55, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // a soft outward bloom right at the opening, kept tight to the frame
    if (lit > 0.04) {
      ctx.save(); ctx.globalAlpha = 0.16 * lit;
      ctx.fillStyle = NEON.cyan;
      ctx.beginPath(); ctx.ellipse(0, -h * 0.55, w * 0.9, h * 0.4, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  function pipe(ctx, pts, t = 0, o = {}) {
    if (!pts || pts.length < 2) return;
    const glow = o.glow || 0, color = o.color || NEON.lime;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (glow > 0) {
      // a soft outer bloom, then the pipe reads as a translucent glass tube
      // (colored fill, not bare metal) with the fluid pulses riding inside it
      ctx.strokeStyle = rgba(color, 0.16 * glow); ctx.lineWidth = 30; strokePolyline(ctx, pts);
      ctx.strokeStyle = 'rgba(10,8,20,0.7)'; ctx.lineWidth = 20; strokePolyline(ctx, pts);
      ctx.strokeStyle = rgba(color, 0.5 * glow); ctx.lineWidth = 15; strokePolyline(ctx, pts);
      ctx.strokeStyle = rgba(color, 0.22 * glow); ctx.lineWidth = 8; strokePolyline(ctx, pts);
      for (let i = 0; i < 3; i++) {
        const f = ((t * 0.35) + i / 3) % 1;
        const p = pointAt(pts, f);
        ctx.save(); ctx.globalAlpha = glow * (0.6 + 0.4 * Math.sin(t * 5 + i));
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = color; ctx.globalAlpha *= 0.6;
        ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, TAU); ctx.fill();
        ctx.restore();
      }
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 24; strokePolyline(ctx, pts);
      ctx.strokeStyle = METAL_MID; ctx.lineWidth = 18; strokePolyline(ctx, pts);
      ctx.strokeStyle = METAL_LIGHT; ctx.lineWidth = 14; strokePolyline(ctx, pts);
    }
    ctx.restore();
  }
  function web(ctx, x, y, s = 90, t = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(220,225,240,0.5)'; ctx.lineWidth = 1.5;
    const rays = 5;
    for (let i = 0; i <= rays; i++) {
      const a = (i / rays) * (Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s); ctx.stroke();
    }
    for (let r = s * 0.28; r < s; r += s * 0.24) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI / 2); ctx.stroke(); }
    ctx.restore();
  }
  function webStrand(ctx, x0, y0, x1, y1, t = 0) {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + Math.hypot(x1 - x0, y1 - y0) * 0.18 + Math.sin(t * 1.3) * 3;
    ctx.save();
    ctx.strokeStyle = 'rgba(220,225,240,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
    ctx.restore();
  }
  function brokenRobot(ctx, cx, groundY, s, t = 0) {
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.rotate(0.24);
    ctx.fillStyle = METAL_LIGHT;
    rr(ctx, -s * 0.3, -s * 0.9, s * 0.6, s * 0.6, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rr(ctx, -s * 0.3, -s * 0.9, s * 0.6, s * 0.6, 10); ctx.stroke();
    // the dent: a visibly darker crumple with a bright rim catch-light so it
    // doesn't get lost against the body color
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(s * 0.05, -s * 0.6, s * 0.13, s * 0.09, 0.4, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(200,195,220,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(s * 0.05, -s * 0.6, s * 0.13, s * 0.09, 0.4, 0, Math.PI); ctx.stroke();
    ctx.fillStyle = METAL_MID;
    rr(ctx, -s * 0.2, -s * 1.25, s * 0.4, s * 0.35, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; rr(ctx, -s * 0.2, -s * 1.25, s * 0.4, s * 0.35, 8); ctx.stroke();
    const flick = hash2(Math.floor(t * 6), 0) > 0.35;
    ctx.fillStyle = flick ? NEON.cyan : 'rgba(70,68,90,0.5)';
    ctx.beginPath(); ctx.arc(-s * 0.02, -s * 1.07, s * 0.06, 0, TAU); ctx.fill();
    ctx.strokeStyle = METAL_MID; ctx.lineWidth = s * 0.14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.15, -s * 0.3); ctx.lineTo(-s * 0.28, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.15, -s * 0.3); ctx.lineTo(s * 0.3, 0); ctx.stroke();
    // the loose arm: hangs from the shoulder, swinging free with a little
    // hand blob at the tip so it clearly reads as a dangling limb, not debris
    const swing = Math.sin(t * 1.5) * 0.22;
    ctx.save(); ctx.translate(s * 0.28, -s * 0.82); ctx.rotate(Math.PI * 0.55 + swing);
    ctx.strokeStyle = METAL_MID; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 0.4, 0); ctx.stroke();
    ctx.fillStyle = METAL_MID;
    ctx.beginPath(); ctx.arc(s * 0.4, 0, s * 0.07, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  function abandonedPod(ctx, cx, groundY, s, t = 0) {
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.fillStyle = METAL_LIGHT;
    ctx.beginPath(); ctx.ellipse(0, -s * 0.5, s * 0.32, s * 0.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, -s * 0.5, s * 0.24, s * 0.4, 0, 0, TAU); ctx.clip();
    const glowA = 0.35 + 0.15 * Math.sin(t * 1.2);
    ctx.fillStyle = rgba(NEON.cyan, glowA * 0.5);
    ctx.fillRect(-s, -s * 1.2, s * 2, s * 1.4);
    ctx.restore();
    ctx.strokeStyle = rgba(NEON.cyan, 0.4); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -s * 0.5, s * 0.24, s * 0.4, 0, 0, TAU); ctx.stroke();
    // the crack: a bold jagged bolt across the glass, bright so it reads
    // clearly as "cracked" against both the shell and the glow
    ctx.strokeStyle = 'rgba(10,8,20,0.85)'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, -s * 0.92); ctx.lineTo(s * 0.06, -s * 0.68); ctx.lineTo(-s * 0.08, -s * 0.52);
    ctx.lineTo(s * 0.1, -s * 0.24); ctx.stroke();
    ctx.strokeStyle = 'rgba(230,245,255,0.9)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, -s * 0.92); ctx.lineTo(s * 0.06, -s * 0.68); ctx.lineTo(-s * 0.08, -s * 0.52);
    ctx.lineTo(s * 0.1, -s * 0.24); ctx.stroke();
    ctx.restore();
  }
  function controlPanel(ctx, cx, groundY, s, t = 0, on = 0) {
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.fillStyle = METAL_MID;
    rr(ctx, -s * 0.5, -s * 0.7, s, s * 0.7, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rr(ctx, -s * 0.5, -s * 0.7, s, s * 0.7, 8); ctx.stroke();
    ctx.fillStyle = on > 0.05 ? '#08131a' : '#0a0a12';
    rr(ctx, -s * 0.4, -s * 0.62, s * 0.8, s * 0.4, 4); ctx.fill();
    if (on > 0.05) {
      ctx.save();
      rr(ctx, -s * 0.4, -s * 0.62, s * 0.8, s * 0.4, 4); ctx.clip();
      ctx.strokeStyle = rgba(NEON.lime, 0.8); ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const gx = -s * 0.4 + i * s * 0.1, gy = -s * 0.42 + Math.sin(t * 3 + i) * s * 0.08;
        if (i === 0) ctx.moveTo(gx, gy); else ctx.lineTo(gx, gy);
      }
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      for (let i = 0; i < 10; i++) {
        const nx = -s * 0.38 + hash2(i, 1) * s * 0.76, ny = -s * 0.6 + hash2(i, 2) * s * 0.36;
        ctx.fillRect(nx, ny, 2, 2);
      }
    }
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = on > 0.05 && i === 1 ? NEON.magenta : 'rgba(150,140,190,0.5)';
      ctx.beginPath(); ctx.arc(-s * 0.3 + i * s * 0.3, -s * 0.14, s * 0.05, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function warningSymbol(ctx, x, y, s, t = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = NEON.orange;
    ctx.beginPath(); ctx.moveTo(0, -s * 0.55); ctx.lineTo(s * 0.5, s * 0.4); ctx.lineTo(-s * 0.5, s * 0.4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6a3a10'; ctx.lineWidth = Math.max(2, s * 0.08); ctx.stroke();
    ctx.strokeStyle = '#3a2410'; ctx.lineWidth = Math.max(2, s * 0.09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.12, -s * 0.15); ctx.quadraticCurveTo(s * 0.12, -s * 0.02, -s * 0.08, s * 0.12);
    ctx.quadraticCurveTo(-s * 0.2, s * 0.2, 0, s * 0.28); ctx.stroke();
    ctx.restore();
  }
  function crate(ctx, cx, groundY, s, t = 0) {
    ctx.save();
    ctx.translate(cx, groundY - s / 2);
    ctx.fillStyle = METAL_MID;
    rr(ctx, -s / 2, -s / 2, s, s, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rr(ctx, -s / 2, -s / 2, s, s, 10); ctx.stroke();
    ctx.strokeStyle = rgba(NEON.lime, 0.5); ctx.lineWidth = 3;
    ctx.strokeRect(-s * 0.42, -s * 0.42, s * 0.84, s * 0.84);
    // corner straps — the "cargo crate" read, not just a bordered square
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = Math.max(2, s * 0.05); ctx.lineCap = 'round';
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath();
      ctx.moveTo(sx * s * 0.5, sy * s * 0.5 - sy * s * 0.02);
      ctx.lineTo(sx * s * 0.5 - sx * s * 0.16, sy * s * 0.5 - sy * s * 0.02);
      ctx.moveTo(sx * s * 0.5 - sx * s * 0.02, sy * s * 0.5);
      ctx.lineTo(sx * s * 0.5 - sx * s * 0.02, sy * s * 0.5 - sy * s * 0.16);
      ctx.stroke();
    }
    drawFace(ctx, 0, s * 0.05, s * 0.5, 'happy', t, 4);
    ctx.restore();
  }
  function sparkBox(ctx, cx, y, s, t = 0) {
    ctx.save();
    ctx.translate(cx, y);
    ctx.fillStyle = METAL_MID;
    rr(ctx, -s / 2, -s / 2, s, s * 0.7, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; rr(ctx, -s / 2, -s / 2, s, s * 0.7, 6); ctx.stroke();
    // dark cavity where the cover tore away, so the wires read against black
    ctx.fillStyle = '#050410';
    rr(ctx, -s * 0.34, -s * 0.28, s * 0.5, s * 0.5, 4); ctx.fill();
    // exposed zigzag wires, bright against the cavity
    ctx.strokeStyle = NEON.orange; ctx.lineWidth = Math.max(2, s * 0.05); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.28, -s * 0.2); ctx.lineTo(-s * 0.14, -s * 0.05); ctx.lineTo(-s * 0.22, s * 0.1); ctx.lineTo(-s * 0.08, s * 0.2); ctx.stroke();
    ctx.strokeStyle = NEON.cyan;
    ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.22); ctx.lineTo(-s * 0.02, -s * 0.08); ctx.lineTo(-s * 0.12, s * 0.04); ctx.lineTo(0, s * 0.18); ctx.stroke();
    // the torn cover flap, bigger and outlined so it reads as a hinged panel
    ctx.save(); ctx.translate(s * 0.3, -s * 0.05); ctx.rotate(-0.55 + Math.sin(t * 2) * 0.05);
    ctx.fillStyle = METAL_LIGHT; rr(ctx, 0, -s * 0.22, s * 0.34, s * 0.4, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; rr(ctx, 0, -s * 0.22, s * 0.34, s * 0.4, 4); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  // ==================================================================== 11-13: power kit
  function battery(ctx, cx, cy, s, t = 0, o = {}) {
    const glow = o.glow === undefined ? 1 : o.glow, held = !!o.held;
    const w = s * 0.78;
    ctx.save();
    ctx.translate(cx, cy);
    if (held) {
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + i * 2;
        ctx.save(); ctx.globalAlpha = 0.4 - 0.1 * i;
        ctx.fillStyle = NEON.lime;
        ctx.beginPath(); ctx.arc(-Math.cos(a) * 10 - i * 7, Math.sin(a) * 6, 3, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    if (glow > 0) {
      const pk = 0.7 + 0.3 * Math.sin(t * 4);
      ctx.save(); ctx.globalAlpha = glow * pk;
      const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.85);
      hg.addColorStop(0, rgba(NEON.lime, 0.4)); hg.addColorStop(1, rgba(NEON.lime, 0));
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.85, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = METAL_LIGHT;
    rr(ctx, -w / 2, -s / 2, w, s * 0.16, 4); ctx.fill();
    rr(ctx, -w / 2, s / 2 - s * 0.16, w, s * 0.16, 4); ctx.fill();
    const bg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    bg.addColorStop(0, 'rgba(77,252,255,0.35)'); bg.addColorStop(0.5, 'rgba(77,252,255,0.55)'); bg.addColorStop(1, 'rgba(77,252,255,0.35)');
    ctx.fillStyle = bg;
    rr(ctx, -w / 2, -s * 0.42, w, s * 0.84, w * 0.4); ctx.fill();
    ctx.strokeStyle = 'rgba(20,60,70,0.7)'; ctx.lineWidth = 2.5;
    rr(ctx, -w / 2, -s * 0.42, w, s * 0.84, w * 0.4); ctx.stroke();
    const pulse = 0.75 + 0.25 * Math.sin(t * 5);
    ctx.globalAlpha = 0.9; ctx.fillStyle = NEON.lime;
    ctx.beginPath(); ctx.arc(0, 0, w * 0.28 * pulse, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    drawFace(ctx, 0, s * 0.02, w * 0.62, 'happy', t, 2);
    ctx.restore();
  }
  function socket(ctx, cx, groundY, s, t = 0, o = {}) {
    const powered = !!o.powered, cooldown = o.cooldown || 0;
    const w = s, h = s * 0.67;
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.fillStyle = cooldown > 0 ? 'rgba(120,60,30,0.9)' : METAL_LIGHT;
    rr(ctx, -w / 2, -h, w, h, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rr(ctx, -w / 2, -h, w, h, 10); ctx.stroke();
    const cw = w * 0.42, ch = h * 0.86, cy0 = -h + h * 0.06;
    ctx.fillStyle = '#05040a';
    rr(ctx, -cw / 2, cy0, cw, ch, cw * 0.4); ctx.fill();
    if (powered) {
      ctx.save(); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 4);
      ctx.strokeStyle = NEON.lime; ctx.lineWidth = 4;
      rr(ctx, -cw / 2 - 4, cy0 - 4, cw + 8, ch + 8, cw * 0.4 + 4); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = powered ? NEON.lime : 'rgba(150,140,190,0.6)';
    rr(ctx, -cw * 0.28, cy0 + ch * 0.08, cw * 0.14, ch * 0.5, 3); ctx.fill();
    rr(ctx, cw * 0.14, cy0 + ch * 0.08, cw * 0.14, ch * 0.5, 3); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.36, -h * 0.14, s * 0.06, 0, TAU);
    ctx.fillStyle = powered ? NEON.lime : '#ff2d4d'; ctx.fill();
    if (cooldown > 0) {
      ctx.save(); ctx.globalAlpha = 0.4 * cooldown;
      ctx.fillStyle = NEON.orange;
      ctx.beginPath(); ctx.arc(0, -h * 0.5, w * 0.55, 0, TAU); ctx.fill();
      ctx.restore();
      for (let i = 0; i < 3; i++) {
        const f = ((t * 0.6) + i / 3) % 1;
        ctx.save(); ctx.globalAlpha = cooldown * (1 - f) * 0.6;
        ctx.fillStyle = 'rgba(200,200,200,0.7)';
        ctx.beginPath(); ctx.arc(-w * 0.15 + i * w * 0.15, -h - f * 40, 6 + f * 8, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }
  function cable(ctx, pts, t = 0, powered = 0) {
    if (!pts || pts.length < 2) return;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = powered > 0.05 ? rgba(NEON.lime, 0.5 + 0.3 * powered) : 'rgba(40,36,60,0.9)';
    ctx.lineWidth = 6; strokePolyline(ctx, pts);
    ctx.strokeStyle = powered > 0.05 ? NEON.lime : '#1c1836';
    ctx.lineWidth = 3; strokePolyline(ctx, pts);
    if (powered > 0.05) {
      for (let i = 0; i < 2; i++) {
        const f = ((t * 0.7) + i / 2) % 1;
        const p = pointAt(pts, f);
        ctx.fillStyle = rgba('#ffffff', 0.9 * powered);
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ==================================================================== 14-23: machines
  function blastDoor(ctx, cx, groundY, h, t = 0, open = 0) {
    const w = 120;
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.fillStyle = METAL_LIGHT;
    rr(ctx, -w / 2 - 14, -h - 14, w + 28, h + 14, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rr(ctx, -w / 2 - 14, -h - 14, w + 28, h + 14, 10); ctx.stroke();
    ctx.fillStyle = '#05040a';
    rr(ctx, -w / 2, -h, w, h, 4); ctx.fill();
    ctx.save();
    rr(ctx, -w / 2, -h, w, h, 4); ctx.clip();
    ctx.fillStyle = NEON.orange; ctx.globalAlpha = 0.5;
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.translate(-w / 2 + i * 30 - h * 0.3, 0); ctx.rotate(-0.6);
      ctx.fillRect(-6, -h * 1.5, 14, h * 3);
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    const slide = open * (w / 2 + 10);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * (w / 4 + slide * 0.9), 0);
      const lg = ctx.createLinearGradient(-w / 4, 0, w / 4, 0);
      lg.addColorStop(0, METAL_MID); lg.addColorStop(1, METAL_LIGHT);
      ctx.fillStyle = lg;
      rr(ctx, -w / 4, -h, w / 2, h, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; rr(ctx, -w / 4, -h, w / 2, h, 4); ctx.stroke();
      ctx.strokeStyle = rgba(NEON.cyan, 0.5); ctx.lineWidth = 2;
      const sx = side > 0 ? -w / 4 + 6 : w / 4 - 6;
      ctx.beginPath(); ctx.moveTo(sx, -h + 10); ctx.lineTo(sx, -10); ctx.stroke();
      ctx.restore();
    }
    drawFace(ctx, 0, -h - 14, 40, open > 0.5 ? 'grin' : 'sleepy', t, 5);
    ctx.restore();
  }
  function elevator(ctx, cx, y, w, t = 0, on = 0) {
    const h = 22;
    ctx.save();
    ctx.translate(cx, y);
    if (on > 0.05) {
      ctx.save(); ctx.globalAlpha = 0.4 * on * (0.7 + 0.3 * Math.sin(t * 6));
      ctx.fillStyle = NEON.cyan;
      ctx.beginPath(); ctx.ellipse(0, h + 6, w * 0.42, 10, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = METAL_LIGHT;
    rr(ctx, -w / 2, 0, w, h, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rr(ctx, -w / 2, 0, w, h, 6); ctx.stroke();
    ctx.strokeStyle = METAL_LIGHT; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-w / 2 + 6, 0); ctx.lineTo(-w / 2 + 6, -34); ctx.lineTo(w / 2 - 6, -34); ctx.lineTo(w / 2 - 6, 0); ctx.stroke();
    for (let i = 1; i < 4; i++) {
      const rx = -w / 2 + 6 + i * (w - 12) / 4;
      ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, -34); ctx.stroke();
    }
    drawFace(ctx, 0, h / 2, 15, on > 0.5 ? 'grin' : 'sleepy', t, 6);
    ctx.restore();
  }
  function elevatorShaft(ctx, cx, y0, y1, w, t = 0, on = 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(cx - w / 2, y0); ctx.lineTo(cx - w / 2, y1); ctx.moveTo(cx + w / 2, y0); ctx.lineTo(cx + w / 2, y1); ctx.stroke();
    ctx.strokeStyle = METAL_LIGHT; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(cx - w / 2, y0); ctx.lineTo(cx - w / 2, y1); ctx.moveTo(cx + w / 2, y0); ctx.lineTo(cx + w / 2, y1); ctx.stroke();
    if (on > 0.05) {
      const span = y1 - y0, n = Math.max(1, Math.round(span / 90));
      for (let i = 0; i < n; i++) {
        const f = ((t * 0.5) + i / n) % 1, ay = y0 + f * span;
        ctx.save(); ctx.globalAlpha = on * 0.8;
        ctx.fillStyle = NEON.cyan;
        ctx.beginPath(); ctx.moveTo(cx, ay - 8); ctx.lineTo(cx - 7, ay + 6); ctx.lineTo(cx + 7, ay + 6); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }
  function gravityMachine(ctx, cx, groundY, s, t = 0, on = 0) {
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.fillStyle = METAL_MID;
    rr(ctx, -s * 0.22, -s * 0.14, s * 0.44, s * 0.14, 6); ctx.fill();
    ctx.fillStyle = METAL_LIGHT;
    rr(ctx, -s * 0.08, -s * 0.85, s * 0.16, s * 0.75, 8); ctx.fill();
    const cy = -s * 0.9;
    if (on > 0.05) {
      ctx.save(); ctx.globalAlpha = 0.28 * on;
      ctx.fillStyle = '#b06cf0';
      ctx.beginPath(); ctx.arc(0, cy, s * 0.4, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.save(); ctx.translate(0, cy); ctx.rotate(t * on * 2.4);
    ctx.strokeStyle = '#b06cf0'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.26, s * 0.1, 0, 0, TAU); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.translate(0, cy); ctx.rotate(-t * on * 1.7 + 1);
    ctx.strokeStyle = 'rgba(176,108,240,0.6)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.19, s * 0.26, 0, 0, TAU); ctx.stroke();
    ctx.restore();
    const bob = Math.sin(t * 2) * 6 * (0.3 + 0.7 * on);
    ctx.fillStyle = '#e0c8ff';
    ctx.beginPath(); ctx.arc(0, cy + bob, s * 0.09, 0, TAU); ctx.fill();
    drawFace(ctx, 0, cy + bob, s * 0.16, on > 0.5 ? 'dizzy' : 'sleepy', t, 7);
    if (on > 0.3) {
      for (let i = 0; i < 4; i++) {
        const f = ((t * 0.2) + i / 4) % 1, rx = Math.sin(i * 2 + t * 0.4) * s * 0.3, ry = cy + s * 0.5 - f * s * 0.9;
        ctx.save(); ctx.globalAlpha = on * (1 - f) * 0.8;
        ctx.fillStyle = '#8a7fae';
        ctx.beginPath(); ctx.arc(rx, ry, 5 + (i % 2) * 3, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }
  function bridgeMachine(ctx, cx, groundY, s, t = 0, on = 0) {
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.fillStyle = METAL_MID;
    rr(ctx, -s * 0.4, -s * 0.6, s * 0.8, s * 0.6, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rr(ctx, -s * 0.4, -s * 0.6, s * 0.8, s * 0.6, 8); ctx.stroke();
    ctx.fillStyle = METAL_LIGHT;
    ctx.beginPath(); ctx.arc(s * 0.18, -s * 0.25, s * 0.06, 0, TAU); ctx.fill();
    const ang = on > 0.5 ? -0.9 : -0.2;
    ctx.save(); ctx.translate(s * 0.18, -s * 0.25); ctx.rotate(ang);
    ctx.strokeStyle = on > 0.5 ? NEON.orange : 'rgba(150,140,190,0.6)'; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.32); ctx.stroke();
    ctx.fillStyle = on > 0.5 ? NEON.orange : 'rgba(150,140,190,0.7)';
    ctx.beginPath(); ctx.arc(0, -s * 0.32, s * 0.07, 0, TAU); ctx.fill();
    ctx.restore();
    drawFace(ctx, -s * 0.1, -s * 0.32, s * 0.28, on > 0.5 ? 'grin' : 'sleepy', t, 8);
    ctx.restore();
  }
  function bridgePlate(ctx, x, y, w, t = 0, on = 0) {
    const h = 18;
    ctx.save();
    ctx.fillStyle = on > 0.05 ? METAL_MID : METAL_LIGHT;
    rr(ctx, x, y, w, h, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; rr(ctx, x, y, w, h, 4); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1.5;
    for (let i = 1; i < 4; i++) {
      const lx = x + i * w / 4;
      ctx.beginPath(); ctx.moveTo(lx, y + 3); ctx.lineTo(lx, y + h - 3); ctx.stroke();
    }
    if (on > 0.05) {
      const p = 0.6 + 0.4 * Math.sin(t * 4);
      ctx.save(); ctx.globalAlpha = 0.3 * p; ctx.strokeStyle = NEON.orange; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(x + 4, y + 3); ctx.lineTo(x + w - 4, y + 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 4, y + h - 3); ctx.lineTo(x + w - 4, y + h - 3); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = rgba(NEON.orange, 0.85 + 0.15 * p); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + 4, y + 3); ctx.lineTo(x + w - 4, y + 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 4, y + h - 3); ctx.lineTo(x + w - 4, y + h - 3); ctx.stroke();
    }
    ctx.restore();
  }
  function vendingMachine(ctx, cx, groundY, s, t = 0, on = 0, k = 0) {
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.rotate(k * 0.06);
    const w = s * 0.5, h = s;
    ctx.fillStyle = METAL_MID;
    rr(ctx, -w / 2, -h, w, h, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rr(ctx, -w / 2, -h, w, h, 10); ctx.stroke();
    ctx.fillStyle = 'rgba(20,40,50,0.7)';
    rr(ctx, -w * 0.38, -h * 0.85, w * 0.76, h * 0.45, 6); ctx.fill();
    ctx.strokeStyle = rgba(NEON.cyan, 0.5); ctx.lineWidth = 2; rr(ctx, -w * 0.38, -h * 0.85, w * 0.76, h * 0.45, 6); ctx.stroke();
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      ctx.fillStyle = RAINBOW[(r * 3 + c) % RAINBOW.length];
      ctx.beginPath(); ctx.arc(-w * 0.26 + c * w * 0.26, -h * 0.75 + r * h * 0.13, w * 0.06, 0, TAU); ctx.fill();
    }
    drawFace(ctx, 0, -h * 0.28, w * 0.4, on > 0.5 ? 'grin' : 'sleepy', t, 9);
    ctx.fillStyle = k > 0.1 ? rgba(NEON.lime, 0.8 + 0.2 * Math.sin(t * 20)) : '#050410';
    rr(ctx, -w * 0.2, -h * 0.1, w * 0.4, h * 0.06, 3); ctx.fill();
    ctx.restore();
  }
  function hologram(ctx, cx, groundY, s, t = 0, on = 0) {
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.fillStyle = METAL_LIGHT;
    ctx.beginPath(); ctx.ellipse(0, -8, s * 0.22, s * 0.07, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = METAL_MID;
    rr(ctx, -s * 0.16, -s * 0.14, s * 0.32, s * 0.14, 6); ctx.fill();
    if (on > 0.03) {
      const cy = -s * 0.6, wob = Math.sin(t * 2) * 6;
      ctx.save();
      ctx.globalAlpha = 0.75 * on;
      ctx.translate(wob, cy);
      ctx.fillStyle = 'rgba(120,255,150,0.12)';
      ctx.beginPath(); ctx.moveTo(-6, s * 0.5); ctx.lineTo(6, s * 0.5); ctx.lineTo(s * 0.3, 0); ctx.lineTo(-s * 0.3, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(120,255,150,0.35)';
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.26, s * 0.34, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(200,255,210,0.6)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save();
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.26, s * 0.34, 0, 0, TAU); ctx.clip();
      ctx.fillStyle = 'rgba(10,20,10,0.75)';
      ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.02, s * 0.075, s * 0.12, -0.15, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * 0.1, -s * 0.02, s * 0.075, s * 0.12, 0.15, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(200,255,210,0.25)'; ctx.lineWidth = 1;
      for (let ly = -s * 0.34; ly < s * 0.34; ly += 6) {
        ctx.beginPath(); ctx.moveTo(-s * 0.3, ly + (t * 40) % 6); ctx.lineTo(s * 0.3, ly + (t * 40) % 6); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(120,255,150,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, s * 0.16, s * 0.03, 0, Math.PI); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  function highFiveHand(ctx, cx, groundY, s, t = 0, on = 0, k = 0) {
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.fillStyle = METAL_MID;
    rr(ctx, -s * 0.18, -s * 0.2, s * 0.36, s * 0.2, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rr(ctx, -s * 0.18, -s * 0.2, s * 0.36, s * 0.2, 8); ctx.stroke();
    const jointCol = on > 0.3 ? NEON.orange : 'rgba(150,140,190,0.6)';
    // arm segments are drawn extending toward local -y, so a rotation angle
    // theta points the segment toward world (sin theta, -cos theta): 0 = up,
    // and the slap sweeps down to ~-2.1 = forward-and-down toward -x
    ctx.save();
    ctx.translate(0, -s * 0.2);
    ctx.rotate(lerp(0, -2.1, k));
    ctx.fillStyle = METAL_LIGHT;
    rr(ctx, -s * 0.06, -s * 0.45, s * 0.12, s * 0.45, s * 0.06); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; rr(ctx, -s * 0.06, -s * 0.45, s * 0.12, s * 0.45, s * 0.06); ctx.stroke();
    ctx.fillStyle = jointCol;
    ctx.beginPath(); ctx.arc(0, -s * 0.45, s * 0.07, 0, TAU); ctx.fill();
    ctx.translate(0, -s * 0.45);
    ctx.rotate(lerp(0.25, -0.5, k));
    ctx.fillStyle = METAL_LIGHT;
    rr(ctx, -s * 0.05, -s * 0.4, s * 0.1, s * 0.4, s * 0.05); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; rr(ctx, -s * 0.05, -s * 0.4, s * 0.1, s * 0.4, s * 0.05); ctx.stroke();
    ctx.translate(0, -s * 0.4);
    // palm, drawn a touch flattened so the fingers read as separate digits
    ctx.fillStyle = METAL_LIGHT;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.15, s * 0.13, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    for (const fa of [-0.62, -0.22, 0.18, 0.56]) {
      ctx.save(); ctx.rotate(fa);
      ctx.fillStyle = METAL_LIGHT;
      rr(ctx, -s * 0.028, -s * 0.3, s * 0.056, s * 0.24, s * 0.028); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5;
      rr(ctx, -s * 0.028, -s * 0.3, s * 0.056, s * 0.24, s * 0.028); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = jointCol; ctx.beginPath(); ctx.arc(0, 0, s * 0.055, 0, TAU); ctx.fill();
    ctx.restore();
    drawFace(ctx, 0, -s * 0.06, s * 0.15, on > 0.3 ? 'grin' : 'sleepy', t, 10);
    ctx.restore();
  }
  function danceRobot(ctx, cx, groundY, s, t = 0, mode = 'off') {
    ctx.save();
    ctx.translate(cx, groundY);
    const bodyY = -s * 0.5, bob = mode === 'dance' ? Math.sin(t * 6) * s * 0.04 : 0;
    ctx.translate(0, bob);
    ctx.fillStyle = METAL_LIGHT;
    ctx.beginPath(); ctx.arc(0, bodyY, s * 0.32, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = mode === 'dance' ? rgba(NEON.magenta, 0.6 + 0.3 * Math.sin(t * 8)) : 'rgba(60,55,90,0.5)';
    ctx.beginPath(); ctx.arc(0, bodyY + s * 0.06, s * 0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = METAL_MID;
    rr(ctx, -s * 0.14, -s * 0.12, s * 0.1, s * 0.12, 4); ctx.fill();
    rr(ctx, s * 0.04, -s * 0.12, s * 0.1, s * 0.12, 4); ctx.fill();
    const armA = mode === 'dance' ? Math.sin(t * 7) * 0.6 : 0;
    for (const sd of [-1, 1]) {
      ctx.save();
      ctx.translate(sd * s * 0.3, bodyY - s * 0.05);
      if (mode === 'dance') ctx.rotate(sd * (-1.2 + armA));
      else if (mode === 'sleep') ctx.rotate(sd * 0.9);
      else ctx.rotate(sd * 0.2);
      ctx.strokeStyle = METAL_MID; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.24); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = METAL_MID;
    ctx.beginPath(); ctx.arc(0, bodyY - s * 0.36, s * 0.18, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = METAL_MID; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, bodyY - s * 0.54); ctx.lineTo(0, bodyY - s * 0.66); ctx.stroke();
    ctx.fillStyle = mode === 'dance' ? NEON.magenta : '#555';
    ctx.beginPath(); ctx.arc(0, bodyY - s * 0.66, 4, 0, TAU); ctx.fill();
    const mood = mode === 'dance' ? 'grin' : mode === 'sleep' ? 'sleepy' : 'happy';
    drawFace(ctx, 0, bodyY - s * 0.34, s * 0.24, mood, t, 11);
    ctx.restore();
  }
  function fanMachine(ctx, cx, groundY, s, t = 0, on = 0) {
    ctx.save();
    ctx.translate(cx, groundY - s * 0.5);
    ctx.fillStyle = METAL_MID;
    rr(ctx, -s * 0.08, s * 0.42, s * 0.16, s * 0.1, 4); ctx.fill();
    ctx.strokeStyle = METAL_LIGHT; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.45, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.45, 0, TAU); ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, TAU); ctx.clip();
    ctx.strokeStyle = 'rgba(150,140,190,0.4)'; ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * s * 0.42, Math.sin(a) * s * 0.42); ctx.stroke();
    }
    ctx.restore();
    ctx.save(); ctx.rotate(t * on * 14);
    ctx.fillStyle = '#8a7fae';
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.rotate(i / 4 * TAU);
      ctx.beginPath(); ctx.ellipse(s * 0.2, 0, s * 0.22, s * 0.08, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = METAL_MID; ctx.beginPath(); ctx.arc(0, 0, s * 0.08, 0, TAU); ctx.fill();
    ctx.restore();
    drawFace(ctx, 0, s * 0.48, s * 0.18, on > 0.5 ? 'surprised' : 'sleepy', t, 12);
    if (on > 0.05) {
      for (let i = 0; i < 5; i++) {
        const f = ((t * 1.5) + i / 5) % 1, wy = -s * 0.3 + i * s * 0.15;
        ctx.save(); ctx.globalAlpha = on * (1 - f) * 0.6;
        ctx.strokeStyle = NEON.cyan; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s * 0.5 + f * s * 0.6, wy); ctx.lineTo(s * 0.5 + f * s * 0.6 + 30, wy); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }
  function laserMachine(ctx, cx, groundY, s, t = 0, on = 0, aim) {
    aim = aim || { x: cx + 240, y: groundY - s };
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.fillStyle = METAL_MID;
    rr(ctx, -s * 0.3, -s * 0.22, s * 0.6, s * 0.22, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rr(ctx, -s * 0.3, -s * 0.22, s * 0.6, s * 0.22, 8); ctx.stroke();
    const turretY = -s * 0.32;
    ctx.fillStyle = METAL_LIGHT;
    ctx.beginPath(); ctx.arc(0, turretY, s * 0.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    const worldTurretX = cx, worldTurretY = groundY + turretY;
    const ang = Math.atan2(aim.y - worldTurretY, aim.x - worldTurretX);
    ctx.save();
    ctx.translate(0, turretY);
    ctx.rotate(ang);
    ctx.fillStyle = METAL_LIGHT;
    rr(ctx, 0, -s * 0.06, s * 0.4, s * 0.12, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; rr(ctx, 0, -s * 0.06, s * 0.4, s * 0.12, 4); ctx.stroke();
    ctx.restore();
    drawFace(ctx, 0, turretY, s * 0.16, on > 0.5 ? 'angry' : 'sleepy', t, 13);
    ctx.restore();
    if (on > 0.05) {
      const bx0 = worldTurretX + Math.cos(ang) * s * 0.4, by0 = worldTurretY + Math.sin(ang) * s * 0.4;
      ctx.save();
      ctx.strokeStyle = rgba(NEON.magenta, 0.25 * on); ctx.lineWidth = 22; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(aim.x, aim.y); ctx.stroke();
      ctx.strokeStyle = rgba(NEON.magenta, 0.8 * on); ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(aim.x, aim.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(aim.x, aim.y); ctx.stroke();
      ctx.restore();
    }
  }
  function magnetMachine(ctx, cx, groundY, s, t = 0, on = 0, aim) {
    aim = aim || { x: cx + 220, y: groundY - s * 0.6 };
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.fillStyle = METAL_MID;
    rr(ctx, -s * 0.25, -s * 0.18, s * 0.5, s * 0.18, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rr(ctx, -s * 0.25, -s * 0.18, s * 0.5, s * 0.18, 6); ctx.stroke();
    const uY = -s * 0.55;
    ctx.strokeStyle = METAL_LIGHT; ctx.lineWidth = s * 0.14; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, -s * 0.18); ctx.lineTo(-s * 0.22, uY);
    ctx.arc(0, uY, s * 0.22, Math.PI, 0, true);
    ctx.lineTo(s * 0.22, -s * 0.18);
    ctx.stroke();
    ctx.fillStyle = NEON.magenta; rr(ctx, -s * 0.3, -s * 0.24, s * 0.16, s * 0.1, 3); ctx.fill();
    ctx.fillStyle = NEON.cyan; rr(ctx, s * 0.14, -s * 0.24, s * 0.16, s * 0.1, 3); ctx.fill();
    drawFace(ctx, 0, -s * 0.42, s * 0.22, on > 0.5 ? 'dizzy' : 'sleepy', t, 14);
    ctx.restore();
    if (on > 0.05) {
      const worldX = cx, worldY = groundY + uY;
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const f = ((t * 1.2) + i / 3) % 1;
        const px = lerp(worldX, aim.x, f), py = lerp(worldY, aim.y, f);
        ctx.save(); ctx.globalAlpha = on * (1 - f) * 0.7;
        ctx.strokeStyle = '#b06cf0'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(px, py, 8 + f * 4, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
  }
  function bayDoor(ctx, cx, groundY, h, t = 0, open = 0) {
    const w = 160;
    ctx.save();
    ctx.translate(cx, groundY - h / 2);
    ctx.fillStyle = METAL_LIGHT;
    rr(ctx, -w / 2 - 12, -h / 2 - 12, w + 24, h + 24, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rr(ctx, -w / 2 - 12, -h / 2 - 12, w + 24, h + 24, 14); ctx.stroke();
    ctx.save();
    rr(ctx, -w / 2, -h / 2, w, h, 10); ctx.clip();
    ctx.fillStyle = '#05040a';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    // the iris: a bladed disk with a hole at the center that grows with
    // `open`, so it reads as dilating rather than a static pinwheel
    const maxR = Math.max(w, h) * 0.72;
    ctx.fillStyle = METAL_MID;
    ctx.beginPath(); ctx.arc(0, 0, maxR, 0, TAU); ctx.fill();
    const n = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * maxR, Math.sin(a) * maxR); ctx.stroke();
    }
    const holeR = open * maxR * 0.92;
    if (holeR > 1) {
      ctx.fillStyle = '#05040a';
      ctx.beginPath(); ctx.arc(0, 0, holeR, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(NEON.cyan, 0.55 + 0.3 * Math.sin(t * 3)); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, holeR, 0, TAU); ctx.stroke();
    }
    if (open > 0.5) {
      ctx.globalAlpha = (open - 0.5) * 2 * 0.35;
      ctx.fillStyle = NEON.cyan;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.restore();
  }

  return {
    wallPanels, floorPanel, ceiling,
    emergencyLight, ceilingLight, glyph,
    vent, brokenDoor, doorway, pipe, web, webStrand,
    brokenRobot, abandonedPod, controlPanel, warningSymbol, crate, sparkBox,
    battery, socket, cable,
    blastDoor, elevator, elevatorShaft, gravityMachine, bridgeMachine, bridgePlate,
    vendingMachine, hologram, highFiveHand, danceRobot, fanMachine, laserMachine, magnetMachine, bayDoor
  };
})();
