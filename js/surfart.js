'use strict';
// SURF_ART: art pack for OCEAN SURF (see docs/superpowers/specs/2026-09-02-ocean-surf-design.md)
// Pure procedural canvas drawing, no game-state reads (arguments only). Every
// function does its own ctx.save()/restore(). World-space: callers pass
// world x/y (the WATERLINE is y=620 in-game; functions take it as `waterY`).
// House style match: js/ride.js (drawBoogieBoard etc.) and js/entities.js
// (Chest.draw, drawTruckBody) — big funny faces (drawFace from js/util.js),
// chunky rounded shapes, gradient fills, thick dark outlines.
const SURF_ART = (function () {

  // ---------------------------------------------------------------- board
  function surfboard(ctx, cx, cy, s, t = 0) {
    ctx.save();
    ctx.translate(cx, cy);
    const len = s, hw = s * 0.15, thick = s * 0.10;
    ctx.rotate(Math.sin(t * 4) * 0.02);
    const noseX = len * 0.5, tailX = -len * 0.5;
    // shadow
    ctx.fillStyle = 'rgba(10,50,70,0.18)';
    ctx.beginPath(); ctx.ellipse(0, thick * 2.4, len * 0.44, hw * 0.55, 0, 0, TAU); ctx.fill();
    // small fin, underside near the tail
    ctx.fillStyle = '#1f6b76';
    ctx.beginPath();
    ctx.moveTo(tailX + len * 0.16, thick * 0.5);
    ctx.lineTo(tailX + len * 0.24, thick * 2.5);
    ctx.lineTo(tailX + len * 0.32, thick * 0.6);
    ctx.closePath(); ctx.fill();
    // deck: flat-ish top, gently bulging bottom, tapering to a point at the nose
    function deckPath() {
      ctx.beginPath();
      ctx.moveTo(tailX, -hw * 0.1);
      ctx.quadraticCurveTo(tailX - len * 0.02, hw * 0.5, tailX + len * 0.08, hw * 0.55);
      ctx.quadraticCurveTo(0, hw * 0.75, noseX - len * 0.06, hw * 0.28);
      ctx.quadraticCurveTo(noseX, hw * 0.05, noseX, 0);
      ctx.quadraticCurveTo(noseX - len * 0.02, -hw * 0.12, noseX - len * 0.1, -hw * 0.32);
      ctx.quadraticCurveTo(0, -hw * 0.55, tailX + len * 0.06, -hw * 0.28);
      ctx.quadraticCurveTo(tailX - len * 0.02, -hw * 0.35, tailX, -hw * 0.1);
      ctx.closePath();
    }
    deckPath();
    const g = ctx.createLinearGradient(0, -hw, 0, hw);
    g.addColorStop(0, '#2fc4c9'); g.addColorStop(1, '#1e8fa3');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#0f5a66'; ctx.lineWidth = Math.max(2, s * 0.02); ctx.stroke();
    // wavy orange stripe down the middle
    ctx.save();
    deckPath();
    ctx.clip();
    ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = hw * 0.45; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const u = i / 10, x = lerp(tailX, noseX, u);
      const y = Math.sin(u * Math.PI * 2.2) * hw * 0.28;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.ellipse(noseX * 0.3, -hw * 0.35, len * 0.14, hw * 0.12, -0.2, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------- sea
  function sea(ctx, x0, x1, yAt, t = 0, bottomY = 940) {
    ctx.save();
    const step = 24;
    const n = Math.max(1, Math.ceil((x1 - x0) / step));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const x = Math.min(x1, x0 + i * step);
      pts.push([x, yAt(x)]);
    }
    // body fill
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineTo(x1, bottomY);
    ctx.lineTo(x0, bottomY);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, pts[0][1], 0, bottomY);
    g.addColorStop(0, '#5fe0d8');
    g.addColorStop(0.22, '#2fb8d8');
    g.addColorStop(1, '#0d3f78');
    ctx.fillStyle = g; ctx.fill();
    // foam line along the surface
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      const bump = Math.sin(x * 0.05 + t * 3) * 2.5;
      if (i === 0) ctx.moveTo(x, y + bump); else ctx.lineTo(x, y + bump);
    }
    ctx.stroke();
    // small ripple bumps along the foam
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let x = x0; x < x1; x += 96) {
      const y = yAt(x);
      const r = Math.max(1.5, 4 + Math.sin(x * 0.08 + t * 4) * 1.5);
      ctx.beginPath(); ctx.arc(x, y - 1, r, Math.PI, TAU); ctx.fill();
    }
    // wavy highlight strokes below the surface
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 6;
    for (let d = 0; d < 3; d++) {
      const depth = 50 + d * 70;
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 60) {
        const y = yAt(x) + depth + Math.sin(x * 0.02 + t * 1.2 + d) * 10;
        if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- wave
  function wave(ctx, cx, waterY, w, h, t = 0, o = {}) {
    const big = o.big !== false;
    const mood = o.mood || 'surprised';
    ctx.save();
    ctx.translate(cx, waterY);
    if (big) {
      ctx.translate(0, Math.sin(t * 2) * h * 0.02);
      // body: a rounded mound rising to a crest, with a lip curling over to
      // the left and hooking back under itself (the classic breaking-wave
      // silhouette) — traced right-base -> up the face -> over the crest ->
      // down+under the curl -> hook back -> down the inner face -> left-base.
      ctx.beginPath();
      ctx.moveTo(w * 0.5, 0);
      ctx.quadraticCurveTo(w * 0.46, -h * 0.5, w * 0.2, -h * 0.82);
      ctx.quadraticCurveTo(w * 0.02, -h * 1.0, -w * 0.16, -h * 0.96);
      ctx.quadraticCurveTo(-w * 0.4, -h * 0.9, -w * 0.42, -h * 0.68);
      ctx.quadraticCurveTo(-w * 0.44, -h * 0.5, -w * 0.26, -h * 0.52);
      ctx.quadraticCurveTo(-w * 0.14, -h * 0.53, -w * 0.18, -h * 0.62);
      ctx.quadraticCurveTo(-w * 0.02, -h * 0.44, -w * 0.14, -h * 0.28);
      ctx.quadraticCurveTo(-w * 0.3, -h * 0.12, -w * 0.46, 0);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -h, 0, 0);
      g.addColorStop(0, '#5fd0e8'); g.addColorStop(1, '#1f7fc4');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#0f5a96'; ctx.lineWidth = Math.max(2, w * 0.05); ctx.stroke();
      // foam blobs riding the crest and clustered at the curl tip
      ctx.fillStyle = '#fff';
      for (const [fx, fy, fr] of [[-w * 0.16, -h * 0.96, w * 0.1], [-w * 0.34, -h * 0.88, w * 0.09],
        [-w * 0.4, -h * 0.7, w * 0.1], [-w * 0.28, -h * 0.54, w * 0.08], [0, -h * 0.98, w * 0.08]]) {
        ctx.beginPath(); ctx.arc(fx, fy, fr, 0, TAU); ctx.fill();
      }
      drawFace(ctx, w * 0.06, -h * 0.55, h * 0.32, mood, t, 4);
    } else {
      const bob = Math.sin(t * 3) * 3;
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, 0);
      ctx.quadraticCurveTo(-w * 0.5, -h + bob, 0, -h + bob);
      ctx.quadraticCurveTo(w * 0.5, -h + bob, w * 0.5, 0);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -h, 0, 0);
      g.addColorStop(0, '#7fe0ea'); g.addColorStop(1, '#2f9fd8');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#1f7fae'; ctx.lineWidth = 3; ctx.stroke();
      if (o.mood) drawFace(ctx, 0, -h * 0.55 + bob, h * 0.5, mood, t, 2);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- shark
  function shark(ctx, cx, waterY, s, t = 0, o = {}) {
    const dir = o.dir === undefined ? -1 : o.dir;
    const friendly = !!o.friendly;
    ctx.save();
    ctx.translate(cx, waterY);
    ctx.scale(dir, 1);
    ctx.translate(0, Math.sin(t * 3) * 2);
    const bodyH = s * 0.46, bodyCY = -s * 0.08;
    const noseX = s * 0.52, tailX = -s * 0.52;
    // waterline shadow ripple
    ctx.fillStyle = 'rgba(20,80,110,0.18)';
    ctx.beginPath(); ctx.ellipse(0, s * 0.05, s * 0.5, s * 0.08, 0, 0, TAU); ctx.fill();
    const grey = friendly ? '#9fb6c9' : '#8a97a3', dark = friendly ? '#6a8296' : '#5b6670';
    // tail fin
    ctx.fillStyle = grey;
    ctx.beginPath();
    ctx.moveTo(tailX, bodyCY);
    ctx.quadraticCurveTo(tailX - s * 0.14, bodyCY - s * 0.22, tailX - s * 0.02, bodyCY - s * 0.02);
    ctx.quadraticCurveTo(tailX - s * 0.14, bodyCY + s * 0.22, tailX, bodyCY);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.stroke();
    // body: torpedo tapering to the nose
    ctx.beginPath();
    ctx.moveTo(tailX, bodyCY - bodyH * 0.35);
    ctx.quadraticCurveTo(0, bodyCY - bodyH * 0.65, noseX, bodyCY - bodyH * 0.06);
    ctx.quadraticCurveTo(noseX + s * 0.02, bodyCY, noseX, bodyCY + bodyH * 0.14);
    ctx.quadraticCurveTo(0, bodyCY + bodyH * 0.55, tailX, bodyCY + bodyH * 0.3);
    ctx.closePath();
    ctx.fillStyle = grey; ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(2, s * 0.03); ctx.stroke();
    // lighter belly, dips to/below the waterline
    ctx.fillStyle = '#e4eef4';
    ctx.beginPath(); ctx.ellipse(-s * 0.02, bodyCY + bodyH * 0.3, s * 0.3, bodyH * 0.22, 0, 0, Math.PI);
    ctx.fill();
    // dorsal fin, tall, above the waterline
    ctx.fillStyle = grey;
    ctx.beginPath();
    ctx.moveTo(s * 0.04, bodyCY - bodyH * 0.5);
    ctx.quadraticCurveTo(s * 0.16, bodyCY - bodyH * 1.6, s * 0.26, bodyCY - bodyH * 0.55);
    ctx.quadraticCurveTo(s * 0.15, bodyCY - bodyH * 0.62, s * 0.04, bodyCY - bodyH * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.stroke();
    // two tiny harmless mouth nubs (never a tooth row)
    ctx.fillStyle = '#fff';
    for (const nx of [-0.06, 0.02]) {
      ctx.beginPath();
      ctx.moveTo(noseX + nx * s, bodyCY + bodyH * 0.14);
      ctx.lineTo(noseX + nx * s - s * 0.025, bodyCY + bodyH * 0.22);
      ctx.lineTo(noseX + nx * s + s * 0.025, bodyCY + bodyH * 0.22);
      ctx.closePath(); ctx.fill();
    }
    if (friendly) {
      ctx.fillStyle = 'rgba(255,140,170,0.55)';
      ctx.beginPath(); ctx.arc(noseX - s * 0.32, bodyCY + bodyH * 0.06, s * 0.06, 0, TAU); ctx.fill();
    }
    drawFace(ctx, noseX - s * 0.2, bodyCY - bodyH * 0.08, s * 0.34, 'happy', t, 5, dir, 0);
    if (friendly) {
      // sunglasses, drawn over the eyes
      ctx.fillStyle = '#2a2a3a';
      ctx.beginPath(); ctx.ellipse(noseX - s * 0.27, bodyCY - s * 0.1, s * 0.05, s * 0.04, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(noseX - s * 0.14, bodyCY - s * 0.1, s * 0.05, s * 0.04, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(noseX - s * 0.22, bodyCY - s * 0.1); ctx.lineTo(noseX - s * 0.19, bodyCY - s * 0.1); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- ski ramp
  function skiRamp(ctx, x0, y0, x1, y1, t = 0) {
    ctx.save();
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    let nx = -uy, ny = ux;
    if (ny < 0) { nx = -nx; ny = -ny; } // keep the thickness on the "down" side
    const thick = 22;
    const bx0 = x0 + nx * thick, by0 = y0 + ny * thick;
    const bx1 = x1 + nx * thick, by1 = y1 + ny * thick;
    // side supports/floats down to the water level at the low end
    ctx.strokeStyle = '#3f7fae'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    for (let i = 1; i < 4; i++) {
      const u = i / 4;
      const sx = lerp(bx0, bx1, u), sy = lerp(by0, by1, u);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, y0 + 6); ctx.stroke();
      ctx.fillStyle = '#ffb35c';
      ctx.beginPath(); ctx.ellipse(sx, y0 + 6, 13, 6, 0, 0, TAU); ctx.fill();
    }
    // deck
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(bx1, by1); ctx.lineTo(bx0, by0);
    ctx.closePath();
    ctx.fillStyle = '#e8402b'; ctx.fill();
    ctx.strokeStyle = '#a41f10'; ctx.lineWidth = 3; ctx.stroke();
    // white edge stripes
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x0 + nx * 4, y0 + ny * 4); ctx.lineTo(x1 + nx * 4, y1 + ny * 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx0 - nx * 4, by0 - ny * 4); ctx.lineTo(bx1 - nx * 4, by1 - ny * 4); ctx.stroke();
    // deck rungs
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
    for (let i = 1; i < 6; i++) {
      const u = i / 6;
      ctx.beginPath();
      ctx.moveTo(lerp(x0, x1, u), lerp(y0, y1, u));
      ctx.lineTo(lerp(bx0, bx1, u), lerp(by0, by1, u));
      ctx.stroke();
    }
    // tiny flag at the lip
    const flagWave = Math.sin(t * 6) * 5;
    ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1, y1 - 40); ctx.stroke();
    ctx.fillStyle = '#ff5a4a';
    ctx.beginPath();
    ctx.moveTo(x1, y1 - 40); ctx.lineTo(x1 + 24 + flagWave * 0.3, y1 - 34); ctx.lineTo(x1, y1 - 28);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------- chest float
  function chestFloat(ctx, cx, waterY, s, t = 0, o = {}) {
    const open = !!o.open, openT = o.openT || 0;
    ctx.save();
    ctx.translate(cx, waterY + Math.sin(t * 2.2) * 4);
    // raft: three logs
    ctx.fillStyle = '#a9743f';
    for (const dx of [-s * 0.32, 0, s * 0.32]) {
      ctx.beginPath(); ctx.ellipse(dx, s * 0.28, s * 0.2, s * 0.1, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.ellipse(0, s * 0.4, s * 0.55, s * 0.12, 0, 0, TAU); ctx.fill();
    const w = s, h = s * 0.72;
    // chest body
    ctx.fillStyle = '#9a6232';
    rr(ctx, -w / 2, -h * 0.55, w, h * 0.55, 8); ctx.fill();
    ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 3;
    rr(ctx, -w / 2, -h * 0.55, w, h * 0.55, 8); ctx.stroke();
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(-w * 0.07, -h * 0.55, w * 0.14, h * 0.55);
    // lid: lifts straight up when opened (small object — a hinge-swing reads
    // muddled at this scale, a clean vertical pop reads instantly)
    ctx.save();
    if (open) ctx.translate(0, -Math.min(1, openT * 2.5) * h * 0.32);
    ctx.fillStyle = '#b0743e';
    rr(ctx, -w / 2 - 2, -h * 0.85, w + 4, h * 0.32, 8); ctx.fill();
    ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 3;
    rr(ctx, -w / 2 - 2, -h * 0.85, w + 4, h * 0.32, 8); ctx.stroke();
    ctx.restore();
    if (open) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 4);
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(0, -h * 0.55, s * 0.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
    drawFace(ctx, 0, -h * 0.32, s * 0.24, open ? 'grin' : 'happy', t, 8);
    ctx.restore();
  }

  // ---------------------------------------------------------------- pirate boat
  function pirateBoat(ctx, cx, waterY, s, t = 0, o = {}) {
    const facing = o.facing === undefined ? -1 : o.facing;
    const mood = o.mood || 'angry';
    const fire = o.fire || 0;
    const tilt = o.tilt || 0;
    ctx.save();
    ctx.translate(cx, waterY);
    ctx.rotate(tilt);
    ctx.scale(facing, 1);
    const Wd = 260 * s, Hd = 90 * s;
    const bowX = Wd * 0.5, sternX = -Wd * 0.5;
    const wheelR = 30 * s, wheelCY = -wheelR;

    function wheelPair(cxp) {
      for (const dx of [-16 * s, 16 * s]) {
        const wx = cxp + dx;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        for (let i = 0; i < 3; i++) {
          const bx = wx + (i - 1) * wheelR * 0.5;
          ctx.beginPath(); ctx.ellipse(bx, 2, wheelR * 0.22, wheelR * 0.08, 0, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#221a26';
        ctx.beginPath(); ctx.arc(wx, wheelCY, wheelR, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#0f0a14'; ctx.lineWidth = Math.max(2, 3 * s); ctx.stroke();
        ctx.fillStyle = '#4a3a50';
        for (let i = 0; i < 8; i++) {
          const a = i * TAU / 8;
          ctx.beginPath(); ctx.arc(wx + Math.cos(a) * wheelR * 0.72, wheelCY + Math.sin(a) * wheelR * 0.72, wheelR * 0.16, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#c9c1d6';
        ctx.beginPath(); ctx.arc(wx, wheelCY, wheelR * 0.34, 0, TAU); ctx.fill();
        ctx.fillStyle = '#8a7fae';
        starPath(ctx, wx, wheelCY, wheelR * 0.24, wheelR * 0.1, 5, t * 1.5);
        ctx.fill();
      }
    }
    wheelPair(sternX * 0.55);
    wheelPair(bowX * 0.55);

    // hull: a flat stern (transom), a flat deck line, and a tall curled
    // pirate-ship prow at the bow that rises up and hooks over before
    // sweeping back down to the waterline (unmistakably "boat", not "box")
    const hullBotY = -wheelR * 2.1, hullTopY = hullBotY - Hd, prowTopY = hullBotY - Hd * 1.65;
    ctx.fillStyle = '#8a5a34';
    ctx.beginPath();
    ctx.moveTo(sternX, hullBotY);
    ctx.lineTo(sternX, hullTopY);
    ctx.lineTo(bowX * 0.5, hullTopY);
    ctx.quadraticCurveTo(bowX * 0.78, hullTopY - Hd * 0.15, bowX * 0.85, prowTopY + Hd * 0.3);
    ctx.quadraticCurveTo(bowX * 0.98, prowTopY, bowX * 0.68, prowTopY + Hd * 0.12);
    ctx.quadraticCurveTo(bowX * 0.5, prowTopY + Hd * 0.4, bowX * 0.82, hullBotY - Hd * 0.08);
    ctx.quadraticCurveTo(bowX * 0.92, hullBotY, bowX * 0.58, hullBotY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4a2f1a'; ctx.lineWidth = Math.max(2, 4 * s); ctx.stroke();
    // plank lines along the flat mid-hull
    ctx.strokeStyle = 'rgba(74,47,26,0.5)'; ctx.lineWidth = Math.max(1, 1.5 * s);
    for (let i = 1; i < 4; i++) {
      const y = hullBotY - Hd * 0.15 * i;
      ctx.beginPath(); ctx.moveTo(sternX + 10 * s, y); ctx.lineTo(bowX * 0.5, y); ctx.stroke();
    }
    // gunwale trim along the flat deck edge
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = Math.max(2, 5 * s);
    ctx.beginPath(); ctx.moveTo(sternX * 0.85, hullTopY); ctx.lineTo(bowX * 0.5, hullTopY); ctx.stroke();

    // mast + striped sail
    const mastX = sternX * 0.2, mastTopY = hullTopY - Hd * 1.9;
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = Math.max(3, 6 * s);
    ctx.beginPath(); ctx.moveTo(mastX, hullTopY + Hd * 0.1); ctx.lineTo(mastX, mastTopY); ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(mastX, mastTopY + Hd * 0.2);
    ctx.lineTo(mastX + Wd * 0.32, hullTopY - Hd * 0.3);
    ctx.lineTo(mastX, hullTopY + Hd * 0.05);
    ctx.closePath();
    ctx.clip();
    const sailW = Wd * 0.32, sailTop = mastTopY + Hd * 0.2, sailBot = hullTopY + Hd * 0.05;
    const stripeCols = ['#fff', '#ff5a5a'];
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = stripeCols[i % 2];
      ctx.fillRect(mastX + i * sailW / 6, sailTop - 20, sailW / 6, (sailBot - sailTop) + 80);
    }
    ctx.restore();
    ctx.strokeStyle = '#c9401f'; ctx.lineWidth = Math.max(1.5, 2.5 * s);
    ctx.beginPath();
    ctx.moveTo(mastX, mastTopY + Hd * 0.2); ctx.lineTo(mastX + Wd * 0.32, hullTopY - Hd * 0.3); ctx.lineTo(mastX, hullTopY + Hd * 0.05);
    ctx.stroke();

    // happy skull-and-hearts flag
    ctx.save();
    ctx.translate(mastX, mastTopY);
    ctx.rotate(Math.sin(t * 5) * 0.12);
    ctx.fillStyle = '#3a3a44';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(38, -3); ctx.lineTo(0, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(13, 1, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff5a8a';
    for (const dx of [-4, 4]) { heartPath(ctx, 13 + dx, -1, 3.6); ctx.fill(); }
    ctx.restore();

    // cannon poking out low on the bow, through the curl of the prow
    // (local +x = bow, matches the `facing` mirror convention)
    const cannonY = hullBotY - Hd * 0.22;
    ctx.save();
    ctx.translate(bowX * 0.4, cannonY);
    ctx.fillStyle = '#3a3a44';
    rr(ctx, 0, -11 * s, 58 * s, 22 * s, 9 * s); ctx.fill();
    ctx.strokeStyle = '#1a1a22'; ctx.lineWidth = Math.max(2, 2 * s); ctx.stroke();
    ctx.fillStyle = '#1a1a22';
    ctx.beginPath(); ctx.ellipse(58 * s, 0, 6 * s, 11 * s, 0, 0, TAU); ctx.fill();
    if (fire > 0) {
      ctx.globalAlpha = fire;
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(58 * s, 0, 26 * s * fire + 6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff8a3d';
      ctx.beginPath(); ctx.arc(58 * s, 0, 14 * s * fire + 3, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // googly face on the flat mid-hull
    drawFace(ctx, (sternX + bowX) * 0.12, hullBotY - Hd * 0.45, Hd * 0.5, mood, t, 15, facing, 0);
    ctx.restore();
  }

  // ---------------------------------------------------------------- cannonball / splash / target
  function cannonball(ctx, cx, cy, r, t = 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(20,20,20,0.25)';
    ctx.beginPath(); ctx.ellipse(0, r * 1.3, r * 0.9, r * 0.3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a2430';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#0f0a14'; ctx.lineWidth = Math.max(2, r * 0.12); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.28, 0, TAU); ctx.fill();
    drawFace(ctx, 0, r * 0.05, r * 1.5, 'surprised', t, 3);
    ctx.restore();
  }

  function splash(ctx, cx, waterY, s, k) {
    ctx.save();
    ctx.translate(cx, waterY);
    const kk = clamp(k, 0, 1);
    const rise = Math.sin(kk * Math.PI);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 5 * (1 - kk * 0.5);
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5 * (0.6 + kk * 0.5), s * 0.14 * (0.6 + kk * 0.5), 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#eaf9ff';
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.5 + (i - 3) * 0.35;
      const dist = rise * s * (0.35 + (i % 3) * 0.08);
      const dx = Math.cos(a) * dist, dy = Math.sin(a) * dist - rise * s * 0.15;
      ctx.beginPath(); ctx.arc(dx, dy, s * 0.05 * (1 - kk * 0.3), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function target(ctx, cx, waterY, r, t = 0) {
    ctx.save();
    ctx.translate(cx, waterY + Math.sin(t * 3) * 2);
    const ry = r * 0.32;
    for (const [rad, col] of [[r, '#fff'], [r * 0.68, '#ff3b3b'], [r * 0.36, '#fff']]) {
      ctx.strokeStyle = col; ctx.lineWidth = r * 0.16;
      ctx.beginPath(); ctx.ellipse(0, 0, rad, ry * (rad / r), 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- kraken
  function kraken(ctx, cx, waterY, s, t = 0, o = {}) {
    const mood = o.mood || 'happy';
    const rise = o.rise === undefined ? 1 : o.rise;
    const arm = o.arm || 0;
    const hold = o.hold || null;
    ctx.save();
    ctx.translate(cx, waterY);
    const dropY = (1 - rise) * s * 0.9;
    ctx.translate(0, dropY);

    // spray at the waterline
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(i * s * 0.09, 4, s * 0.05, s * 0.02, 0, 0, TAU); ctx.fill(); }

    const headW = s * 0.8, headH = s * 0.62, headCY = -s * 0.5;
    const purple = '#b05ce0', dark = '#7a2fae';

    function tentacle(bx, by, cxp, cyp, tx, ty, thick) {
      ctx.strokeStyle = dark; ctx.lineWidth = thick + s * 0.03; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(cxp, cyp, tx, ty); ctx.stroke();
      ctx.strokeStyle = purple; ctx.lineWidth = thick;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(cxp, cyp, tx, ty); ctx.stroke();
      ctx.fillStyle = '#ffb3d9';
      for (let i = 1; i < 5; i++) {
        const u = i / 5;
        const px = (1 - u) * (1 - u) * bx + 2 * (1 - u) * u * cxp + u * u * tx;
        const py = (1 - u) * (1 - u) * by + 2 * (1 - u) * u * cyp + u * u * ty;
        ctx.beginPath(); ctx.arc(px, py, thick * 0.22, 0, TAU); ctx.fill();
      }
    }

    // idle waving tentacles, both sides of the head
    const idle = [
      { bx: headW * 0.32, spread: 0.55 },
      { bx: headW * 0.5, spread: 0.85 },
      { bx: -headW * 0.55, spread: 0.85 },
      { bx: -headW * 0.68, spread: 1.05 }
    ];
    for (let i = 0; i < idle.length; i++) {
      const it = idle[i];
      const bx = it.bx, by = 0;
      const wave2 = Math.sin(t * 1.6 + i * 1.3) * s * 0.06;
      const cxp = bx * 1.3 + wave2, cyp = -s * 0.32;
      const tx = bx * 1.1 + wave2 * 1.4, ty = -s * it.spread * 0.4;
      tentacle(bx, by, cxp, cyp, tx, ty, s * 0.09);
    }

    // the throwing arm (left side), rest -> telegraph, or pinned exactly at `hold`
    const restX = -s * 0.45, restY = -s * 0.2;
    const teleX = -s * 0.55, teleY = -s * 0.95;
    let tipX, tipY;
    if (hold) { tipX = hold.x - cx; tipY = hold.y - waterY - dropY; }
    else { tipX = lerp(restX, teleX, arm); tipY = lerp(restY, teleY, arm); }
    const armBaseX = -headW * 0.38, armBaseY = 0;
    const armCX = lerp(armBaseX - s * 0.1, tipX - s * 0.15, 0.5);
    const armCY = lerp(-s * 0.1, tipY - s * 0.1, 0.5);
    tentacle(armBaseX, armBaseY, armCX, armCY, tipX, tipY, s * 0.13);

    // head
    ctx.fillStyle = purple;
    ctx.beginPath(); ctx.ellipse(0, headCY, headW * 0.5, headH * 0.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = s * 0.02; ctx.stroke();
    ctx.fillStyle = 'rgba(255,140,190,0.5)';
    ctx.beginPath(); ctx.arc(-headW * 0.28, headCY + headH * 0.14, s * 0.045, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(headW * 0.28, headCY + headH * 0.14, s * 0.045, 0, TAU); ctx.fill();
    drawFace(ctx, 0, headCY, headH * 0.85, mood, t, 7);

    ctx.restore();
    return { tip: { x: cx + tipX, y: waterY + dropY + tipY } };
  }

  // ---------------------------------------------------------------- rock
  function rock(ctx, cx, cy, r, t = 0) {
    ctx.save();
    ctx.translate(cx, cy);
    const seed = Math.round(hash2(Math.round(cx) % 997, Math.round(cy) % 997) * 997);
    ctx.fillStyle = 'rgba(20,40,60,0.18)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.85, r * 0.9, r * 0.22, 0, 0, TAU); ctx.fill();
    const n = 9;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const j = 0.82 + hash2(i, seed) * 0.3;
      const px = Math.cos(a) * r * j, py = Math.sin(a) * r * j * 0.85;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#9aa3ab'); g.addColorStop(1, '#6b747c');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#4a5258'; ctx.lineWidth = Math.max(2, r * 0.08); ctx.stroke();
    // nervous sweat drop
    ctx.fillStyle = '#7fd8ff';
    ctx.beginPath();
    ctx.moveTo(r * 0.5, -r * 0.5); ctx.quadraticCurveTo(r * 0.62, -r * 0.28, r * 0.5, -r * 0.14);
    ctx.quadraticCurveTo(r * 0.38, -r * 0.28, r * 0.5, -r * 0.5);
    ctx.closePath(); ctx.fill();
    drawFace(ctx, 0, r * 0.05, r * 1.15, 'surprised', t, 6);
    ctx.restore();
  }

  // ---------------------------------------------------------------- island
  function island(ctx, x, waterY, w, t = 0) {
    ctx.save();
    const sandTop = waterY - 90;
    const midL = x + w * 0.2, midR = x + w * 0.8;
    // starfish
    const sfx = lerp(midL, midR, 0.22), sfy = sandTop - 6;
    ctx.save();
    ctx.translate(sfx, sfy); ctx.rotate(Math.sin(t * 0.6) * 0.05);
    ctx.fillStyle = '#ff8a5c';
    starPath(ctx, 0, 0, 26, 11, 5); ctx.fill();
    ctx.strokeStyle = '#c8531f'; ctx.lineWidth = 3; ctx.stroke();
    drawFace(ctx, 0, 2, 20, 'happy', t, 12);
    ctx.restore();

    // beach umbrella
    const ux = lerp(midL, midR, 0.55), uy = sandTop;
    ctx.save();
    ctx.translate(ux, uy);
    ctx.rotate(0.06);
    ctx.strokeStyle = '#e8d9b0'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -140); ctx.stroke();
    const canR = 70;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-canR, -140);
    ctx.quadraticCurveTo(0, -178, canR, -140);
    ctx.quadraticCurveTo(canR * 0.5, -150, 0, -145);
    ctx.quadraticCurveTo(-canR * 0.5, -150, -canR, -140);
    ctx.closePath();
    ctx.clip();
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = RAINBOW[i % RAINBOW.length];
      ctx.fillRect(-canR + i * canR / 3, -190, canR / 3, 90);
    }
    ctx.restore();
    ctx.strokeStyle = '#a4763a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-canR, -140); ctx.quadraticCurveTo(0, -178, canR, -140); ctx.stroke();
    ctx.restore();

    // palm tree
    const px = lerp(midL, midR, 0.82), py = sandTop;
    ctx.save();
    ctx.translate(px, py);
    const lean = Math.sin(t * 0.4) * 0.03 + 0.12;
    ctx.strokeStyle = '#8a5a34'; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-20, -100, -10 - lean * 60, -190);
    ctx.stroke();
    const topX = -10 - lean * 60, topY = -190;
    ctx.strokeStyle = '#3f9e4a'; ctx.lineWidth = 14; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI * 0.5 + (i - 2.5) * 0.42 + Math.sin(t * 1.4 + i) * 0.05;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(topX + Math.cos(a) * 40, topY + Math.sin(a) * 40 - 10, topX + Math.cos(a) * 70, topY + Math.sin(a) * 70 + 20);
      ctx.stroke();
    }
    ctx.fillStyle = '#6a4020';
    for (const [dx, dy] of [[-8, 10], [10, 14], [0, 22]]) {
      ctx.beginPath(); ctx.arc(topX + dx, topY + dy, 9, 0, TAU); ctx.fill();
    }
    drawFace(ctx, topX, topY + 6, 26, 'grin', t, 13);
    ctx.restore();
    ctx.restore();
  }

  // ---------------------------------------------------------------- giant chest
  function giantChest(ctx, cx, groundY, s, t = 0, o = {}) {
    const open = !!o.open, openT = o.openT || 0;
    const w = 150, h = 110;
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.scale(s, s);
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 3);
    ctx.fillStyle = '#ffe156';
    ctx.beginPath(); ctx.arc(0, -h / 2, 110, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    if (open) {
      const g = ctx.createLinearGradient(0, -h - 240, 0, -h + 40);
      g.addColorStop(0, 'rgba(255,240,150,0)'); g.addColorStop(1, 'rgba(255,230,120,0.75)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-30, -h + 30); ctx.lineTo(-90, -h - 240); ctx.lineTo(90, -h - 240); ctx.lineTo(30, -h + 30);
      ctx.closePath(); ctx.fill();
    }
    // base
    ctx.fillStyle = '#9a6232';
    rr(ctx, -w / 2, -h + 34, w, h - 34, 12); ctx.fill();
    ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 4;
    rr(ctx, -w / 2, -h + 34, w, h - 34, 12); ctx.stroke();
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(-w / 2 + 18, -h + 34, 14, h - 34);
    ctx.fillRect(w / 2 - 32, -h + 34, 14, h - 34);
    // lid
    ctx.save();
    if (open) {
      ctx.translate(-w / 2 + 6, -h + 40);
      ctx.rotate(-Math.min(1, openT * 3) * 2.2);
      ctx.translate(w / 2 - 6, h - 40);
    }
    ctx.fillStyle = '#b0743e';
    rr(ctx, -w / 2 - 4, -h, w + 8, 44, 16); ctx.fill();
    ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 4;
    rr(ctx, -w / 2 - 4, -h, w + 8, 44, 16); ctx.stroke();
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(-w / 2 + 18, -h, 14, 44);
    ctx.fillRect(w / 2 - 32, -h, 14, 44);
    // huge happy face right on the lid
    drawFace(ctx, 0, -h + 22, w * 0.24, open ? 'grin' : 'happy', t, 11);
    ctx.restore();
    // small gold lock badge on the front
    ctx.fillStyle = '#ffd24a';
    rr(ctx, -16, -h + 26, 32, 34, 8); ctx.fill();
    ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 3;
    rr(ctx, -16, -h + 26, 32, 34, 8); ctx.stroke();
    if (open) {
      for (let i = 0; i < 5; i++) drawCandy(ctx, -50 + i * 25, -h + 30 - (i % 2) * 12, 17, i, t + i);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- surf door
  function surfDoor(ctx, cx, groundY, t = 0, o = {}) {
    const glow = o.glow !== false;
    ctx.save();
    if (glow) {
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 3);
      ctx.fillStyle = '#7fe8ff';
      ctx.beginPath(); ctx.arc(cx, groundY - 75, 95, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.translate(cx, groundY - 75);
    ctx.rotate(-Math.PI / 2);
    surfboard(ctx, 0, 0, 150, t);
    ctx.restore();
    // face near the top (the nose, which points up)
    drawFace(ctx, cx, groundY - 122, 30, 'happy', t, 14);
    // small wave decal near the middle
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 16, groundY - 70);
    ctx.quadraticCurveTo(cx - 6, groundY - 80, cx + 2, groundY - 70);
    ctx.quadraticCurveTo(cx + 10, groundY - 62, cx + 18, groundY - 70);
    ctx.stroke();
    if (glow) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 4; i++) {
        const a = t * 1.5 + i * 1.7;
        const r = 55 + Math.sin(t * 3 + i) * 6;
        const sx = cx + Math.cos(a) * r * 0.5, sy = groundY - 75 + Math.sin(a) * r * 0.8;
        starPath(ctx, sx, sy, 5, 2, 4, t * 2 + i);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- gull / sun
  function gull(ctx, x, y, s, t = 0) {
    ctx.save();
    ctx.translate(x, y);
    const flap = Math.sin(t * 8) * s * 0.35;
    ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = Math.max(1.5, s * 0.14); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s, -flap); ctx.quadraticCurveTo(-s * 0.4, flap * 0.6, 0, 0);
    ctx.quadraticCurveTo(s * 0.4, flap * 0.6, s, -flap);
    ctx.stroke();
    ctx.fillStyle = '#3a3a44';
    ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 0.12, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function sun(ctx, x, y, r, t = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#ffe14d';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + t * 0.15;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(r * 0.98, -r * 0.12); ctx.lineTo(r * 1.45, 0); ctx.lineTo(r * 0.98, r * 0.12);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffb347'; ctx.lineWidth = Math.max(2, r * 0.06); ctx.stroke();
    drawFace(ctx, 0, r * 0.05, r * 1.3, 'happy', t, 9);
    ctx.restore();
  }

  return {
    surfboard, sea, wave, shark, skiRamp, chestFloat, pirateBoat,
    cannonball, splash, target, kraken, rock, island, giantChest,
    surfDoor, gull, sun
  };
})();
