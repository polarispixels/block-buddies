'use strict';
// FL_SCENE: scenery art pack for RAINBOW SPIDER FLOWER LAND
// (see docs/superpowers/specs/2026-09-01-rainbow-spider-flower-land-design.md)
//
// Pure drawing functions, world-space, no game-state reads (arguments only).
// Every export takes ctx first and saves/restores its own transform/style.
// Companion pack js/flowerart.js (FL_ART, creatures) is owned separately —
// this file is backdrops/props/UI-ish set pieces only.
const FL_SCENE = (function () {
  // ---- shared palette --------------------------------------------------
  const PETAL = [
    { c: '#ff8fc8', d: '#e0559a' }, // 0 pink
    { c: '#ffb15c', d: '#e8811f' }, // 1 orange
    { c: '#ffe066', d: '#e0a800' }, // 2 yellow
    { c: '#7fe8b8', d: '#3cb87e' }, // 3 mint
    { c: '#8ecdfb', d: '#4a9fe0' }, // 4 sky blue
    { c: '#c9a6f5', d: '#9563d9' }  // 5 lavender
  ];
  const SHIP_DECK = 90;

  // ---- shared little helpers -------------------------------------------
  function roundWindow(ctx, cx, cy, r, trim) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
    ctx.fillStyle = '#8fd0ff'; ctx.fill();
    ctx.strokeStyle = trim; ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
    ctx.stroke();
  }
  function blockGrid(ctx, x, y, w, h, blockPx, phase) {
    const cols = Math.max(1, Math.round(w / blockPx));
    const rows = Math.max(1, Math.round(h / blockPx));
    const bw = w / cols, bh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bx = x + c * bw, by = y + r * bh;
        rr(ctx, bx + 1, by + 1, bw - 2, bh - 2, 6);
        ctx.fillStyle = RAINBOW[(r + c + phase) % RAINBOW.length]; ctx.fill();
        ctx.strokeStyle = 'rgba(51,34,50,0.55)'; ctx.lineWidth = 2.5; ctx.stroke();
      }
    }
  }
  function battlements(ctx, x, y, w, count, color) {
    const bw = w / count;
    for (let i = 0; i < count; i++) {
      if (i % 2 !== 0) continue;
      rr(ctx, x + i * bw, y - 16, bw * 0.8, 20, 4);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = 'rgba(51,34,50,0.55)'; ctx.lineWidth = 2.5; ctx.stroke();
    }
  }
  function towerRoof(ctx, cx, y, w, color, flagColor, t, seed) {
    const roofH = w * 0.85;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 - 10, y);
    ctx.lineTo(cx, y - roofH);
    ctx.lineTo(cx + w / 2 + 10, y);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = 'rgba(51,34,50,0.55)'; ctx.lineWidth = 3; ctx.stroke();
    const apx = cx, apy = y - roofH;
    ctx.strokeStyle = '#e8d24a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(apx, apy); ctx.lineTo(apx, apy - 30); ctx.stroke();
    const wave = Math.sin(t * 4 + seed) * 4;
    ctx.beginPath();
    ctx.moveTo(apx, apy - 30);
    ctx.lineTo(apx + 24, apy - 24 + wave);
    ctx.lineTo(apx, apy - 18);
    ctx.closePath();
    ctx.fillStyle = flagColor; ctx.fill();
    ctx.strokeStyle = 'rgba(51,34,50,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  function archDoor(ctx, cx, groundY, w, h) {
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, groundY);
    ctx.lineTo(cx - w / 2, groundY - h + w / 2);
    ctx.arc(cx, groundY - h + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(cx + w / 2, groundY);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, groundY - h, 0, groundY);
    g.addColorStop(0, '#3a2258'); g.addColorStop(1, '#1c1030');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#2a1a3a'; ctx.lineWidth = 5; ctx.stroke();
  }
  function stemPath(cx, groundY, h, seed) {
    const bend = (14 + (seed % 5) * 6) * (seed % 2 === 0 ? 1 : -1);
    return {
      topY: groundY - h, midY: groundY - h * 0.5,
      topX: cx + bend * 0.3, midX: cx + bend * 0.85
    };
  }
  function drawStem(ctx, cx, groundY, h, stemW, seed) {
    const p = stemPath(cx, groundY, h, seed);
    ctx.beginPath();
    ctx.moveTo(cx - stemW / 2, groundY);
    ctx.quadraticCurveTo(p.midX - stemW / 2, p.midY, p.topX - stemW / 2, p.topY + stemW * 0.3);
    ctx.lineTo(p.topX + stemW / 2, p.topY + stemW * 0.3);
    ctx.quadraticCurveTo(p.midX + stemW / 2, p.midY, cx + stemW / 2, groundY);
    ctx.closePath();
    const g = ctx.createLinearGradient(cx - stemW / 2, p.topY, cx + stemW / 2, groundY);
    g.addColorStop(0, '#8de86a'); g.addColorStop(1, '#3fa832');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(30,80,20,0.5)'; ctx.lineWidth = 3; ctx.stroke();
    return p;
  }
  function drawLeaves(ctx, midX, midY) {
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(midX, midY + side * 8);
      ctx.rotate(side * 0.45);
      ctx.beginPath();
      ctx.ellipse(side * 46, 0, 54, 24, 0, 0, TAU);
      const g = ctx.createLinearGradient(-50, 0, 50, 0);
      g.addColorStop(0, '#8de86a'); g.addColorStop(1, '#4cb840');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(30,80,20,0.5)'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore();
    }
  }
  function drawBloom(ctx, cx, cy, r, pal, t, seed, mood) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + seed * 0.3;
      const sway = Math.sin(t * 1.3 + i + seed) * 0.09;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a + sway);
      ctx.beginPath();
      ctx.ellipse(r * 0.6, 0, r * 0.58, r * 0.37, 0, 0, TAU);
      ctx.fillStyle = pal.c; ctx.fill();
      ctx.strokeStyle = pal.d; ctx.lineWidth = 4; ctx.stroke();
      ctx.restore();
    }
    const cr = r * 0.5;
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU);
    ctx.fillStyle = '#fff6d8'; ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,40,0.4)'; ctx.lineWidth = 4; ctx.stroke();
    drawFace(ctx, cx, cy + cr * 0.06, cr * 1.2, mood, t, seed + 2);
  }
  function drawBrokenFlower(ctx, cx, groundY, pal, seed, t, h, breakT) {
    // breakT 0 = the instant of the smash (petals still bunched where the
    // bloom used to be); breakT 1 = settled, scattered on the ground.
    const settle = clamp(breakT, 0, 1);
    // toppled stem stub (already down for the whole transition)
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.rotate(0.95 * (seed % 2 === 0 ? 1 : -1));
    rr(ctx, -17, -70, 34, 70, 14);
    const g = ctx.createLinearGradient(0, -70, 0, 0);
    g.addColorStop(0, '#8de86a'); g.addColorStop(1, '#3fa832');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(30,80,20,0.5)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    // scattered petals: fly out from where the bloom was, settle on the ground
    const startX = cx, startY = groundY - Math.min(h, 320) - 30;
    const n = 5;
    for (let i = 0; i < n; i++) {
      const dir = i % 2 === 0 ? -1 : 1;
      const restX = cx + (i - (n - 1) / 2) * 55 + Math.sin(seed + i) * 12;
      const pop = Math.sin(settle * Math.PI) * 70;
      const px = lerp(startX, restX, settle) + dir * 14 * settle;
      const py = lerp(startY, groundY - 6, settle) - pop;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate((i - n / 2) * 0.35 + settle * 2.2);
      ctx.globalAlpha = 0.65 + 0.35 * settle;
      ctx.beginPath(); ctx.ellipse(0, 0, 34, 20, 0, 0, TAU);
      ctx.fillStyle = pal.c; ctx.fill();
      ctx.strokeStyle = pal.d; ctx.lineWidth = 3; ctx.stroke();
      if (i === 2) drawFace(ctx, 0, 0, 22, 'dizzy', t, seed + i);
      ctx.restore();
    }
  }

  // ---- 1. giant cheerful flower -----------------------------------------
  function giantFlower(ctx, cx, groundY, o = {}) {
    const h = o.h ?? 360, c = ((o.c ?? 0) % 6 + 6) % 6, t = o.t ?? 0, seed = o.seed ?? 0,
      broken = !!o.broken, breakT = o.breakT ?? 1, mood = o.mood || 'happy', big = o.big !== false;
    const pal = PETAL[c];
    ctx.save();
    if (broken) {
      drawBrokenFlower(ctx, cx, groundY, pal, seed, t, h, breakT);
      ctx.restore();
      return;
    }
    const stemW = 34;
    const p = drawStem(ctx, cx, groundY, h, stemW, seed);
    drawLeaves(ctx, p.midX, p.midY);
    const bloomR = big ? 95 : 58;
    const bloomY = p.topY + stemW * 0.3 - bloomR * 0.55;
    drawBloom(ctx, p.topX, bloomY, bloomR, pal, t, seed, mood);
    ctx.restore();
  }

  // ---- 2. rainbow toy castle --------------------------------------------
  function rainbowCastle(ctx, x, groundY, t = 0) {
    ctx.save();
    const totalW = 820;
    const leftW = 150, leftH = 380, centerW = 220, centerH = 520, rightW = 150, rightH = 420, wallH = 260;
    const leftX = x, centerX = x + (totalW - centerW) / 2, rightX = x + totalW - rightW;
    const wallLX = leftX + leftW, wallLW = centerX - wallLX;
    const wallRX = centerX + centerW, wallRW = rightX - wallRX;

    // wall curtains first (behind towers)
    blockGrid(ctx, wallLX, groundY - wallH, wallLW, wallH, 44, 0);
    battlements(ctx, wallLX, groundY - wallH, wallLW, Math.max(2, Math.round(wallLW / 44)), RAINBOW[1]);
    blockGrid(ctx, wallRX, groundY - wallH, wallRW, wallH, 44, 2);
    battlements(ctx, wallRX, groundY - wallH, wallRW, Math.max(2, Math.round(wallRW / 44)), RAINBOW[3]);

    // towers
    blockGrid(ctx, leftX, groundY - leftH, leftW, leftH, 44, 1);
    battlements(ctx, leftX, groundY - leftH, leftW, Math.max(2, Math.round(leftW / 44)), RAINBOW[0]);
    towerRoof(ctx, leftX + leftW / 2, groundY - leftH, leftW, RAINBOW[0], RAINBOW[2], t, 1);

    blockGrid(ctx, rightX, groundY - rightH, rightW, rightH, 44, 3);
    battlements(ctx, rightX, groundY - rightH, rightW, Math.max(2, Math.round(rightW / 44)), RAINBOW[4]);
    towerRoof(ctx, rightX + rightW / 2, groundY - rightH, rightW, RAINBOW[4], RAINBOW[5], t, 2);

    blockGrid(ctx, centerX, groundY - centerH, centerW, centerH, 44, 4);
    battlements(ctx, centerX, groundY - centerH, centerW, Math.max(2, Math.round(centerW / 44)), RAINBOW[2]);
    towerRoof(ctx, centerX + centerW / 2, groundY - centerH, centerW * 0.6, RAINBOW[2], RAINBOW[0], t, 3);

    // big central arch doorway
    archDoor(ctx, centerX + centerW / 2, groundY, 120, 210);

    // round windows
    roundWindow(ctx, leftX + leftW / 2, groundY - leftH * 0.55, 22, RAINBOW[5]);
    roundWindow(ctx, rightX + rightW / 2, groundY - rightH * 0.55, 22, RAINBOW[1]);
    roundWindow(ctx, centerX + centerW * 0.26, groundY - centerH * 0.74, 24, RAINBOW[3]);
    roundWindow(ctx, centerX + centerW * 0.74, groundY - centerH * 0.74, 24, RAINBOW[3]);
    roundWindow(ctx, wallLX + wallLW / 2, groundY - wallH * 0.62, 18, RAINBOW[0]);
    roundWindow(ctx, wallRX + wallRW / 2, groundY - wallH * 0.62, 18, RAINBOW[4]);

    // friendly face on the center tower
    drawFace(ctx, centerX + centerW / 2, groundY - centerH * 0.87, 46, 'happy', t, 5);

    ctx.restore();
  }

  // ---- 3. giant cozy spider home -----------------------------------------
  function spiderHome(ctx, x, groundY, w, t = 0) {
    ctx.save();
    const domeH = 520, cx = x + w / 2;

    // main silk dome
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.ellipse(cx, groundY, w / 2, domeH, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, groundY - domeH, 0, groundY);
    g.addColorStop(0, '#fdf9ff'); g.addColorStop(1, '#e6d9f7');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(150,120,190,0.5)'; ctx.lineWidth = 4; ctx.stroke();

    // lavender underside shading bumps
    const bumpN = Math.max(3, Math.round(w / 220));
    for (let i = 0; i < bumpN; i++) {
      const bx = x + (i + 0.5) * (w / bumpN);
      ctx.beginPath();
      ctx.arc(bx, groundY, 90, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fillStyle = 'rgba(190,170,225,0.35)'; ctx.fill();
    }

    // web strands fanning from the apex, plus two concentric rings
    const apexX = cx, apexY = groundY - domeH;
    const strands = 9;
    ctx.strokeStyle = 'rgba(170,150,200,0.55)'; ctx.lineWidth = 2;
    for (let i = 0; i <= strands; i++) {
      const a = Math.PI + (i / strands) * Math.PI;
      const ex = cx + Math.cos(a) * (w / 2) * 0.97;
      const ey = groundY + Math.sin(a) * domeH * 0.97;
      ctx.beginPath();
      ctx.moveTo(apexX, apexY);
      ctx.quadraticCurveTo((apexX + ex) / 2, apexY + (ey - apexY) * 0.4, ex, ey);
      ctx.stroke();
    }
    for (const frac of [0.35, 0.65]) {
      ctx.beginPath();
      ctx.ellipse(cx, groundY, (w / 2) * frac, domeH * frac, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
    }

    // chimney with three staggered rising puffs
    const chimX = x + w * 0.78, chimTop = groundY - domeH * 0.62;
    ctx.fillStyle = '#e0d0f0';
    ctx.fillRect(chimX, chimTop, 28, 60);
    ctx.strokeStyle = 'rgba(150,120,190,0.5)'; ctx.lineWidth = 2;
    ctx.strokeRect(chimX, chimTop, 28, 60);
    for (let i = 0; i < 3; i++) {
      const cyc = ((t * 26 + i * 26) % 78);
      ctx.globalAlpha = clamp(0.75 - cyc / 78, 0.1, 0.75);
      ctx.beginPath();
      ctx.arc(chimX + 14 + Math.sin(cyc * 0.09 + i) * 8, chimTop - 4 - cyc, 15 + cyc * 0.22, 0, TAU);
      ctx.fillStyle = '#fff'; ctx.fill();
    }
    ctx.globalAlpha = 1;

    // pastel bunting near the top edge
    const buntY = groundY - domeH + 64, bn = 6;
    for (let i = 0; i < bn; i++) {
      const bx = cx - 150 + i * 60, sag = Math.sin((i / (bn - 1)) * Math.PI) * 12;
      ctx.beginPath();
      ctx.moveTo(bx - 12, buntY + sag);
      ctx.lineTo(bx + 12, buntY + sag);
      ctx.lineTo(bx, buntY + sag + 20);
      ctx.closePath();
      ctx.fillStyle = RAINBOW[i % RAINBOW.length]; ctx.fill();
    }

    // two round windows
    roundWindow(ctx, cx - 150, groundY - 150, 34, RAINBOW[4]);
    roundWindow(ctx, cx + 150, groundY - 150, 34, RAINBOW[1]);

    // round front door with a heart window
    const doorR = 74, doorTopY = groundY - doorR * 1.7;
    ctx.beginPath();
    ctx.arc(cx, doorTopY + doorR, doorR, Math.PI, 0);
    ctx.lineTo(cx + doorR, groundY);
    ctx.lineTo(cx - doorR, groundY);
    ctx.closePath();
    ctx.fillStyle = '#e8c48a'; ctx.fill();
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#ff8fa3';
    heartPath(ctx, cx, doorTopY + doorR - 4, 20);
    ctx.fill();
    ctx.strokeStyle = '#e0405a'; ctx.lineWidth = 2.5; ctx.stroke();

    ctx.restore();
  }

  // ---- 4. small flying pirate ship, parked on a cloud --------------------
  function pirateShip(ctx, x, cloudY, t = 0) {
    ctx.save();
    const bob = Math.sin(t * 1.6) * 3;
    const hullW = 360, hullH = 90;
    const hullBottom = cloudY, hullTop = hullBottom - hullH + bob;
    const deckY = cloudY - SHIP_DECK + bob;

    // two little balloon floats tied to the hull
    for (const side of [-1, 1]) {
      const bx = x + hullW / 2 + side * hullW * 0.4, by = hullTop + 6 + Math.sin(t * 1.3 + side) * 4;
      ctx.strokeStyle = 'rgba(120,90,150,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx, by + 16); ctx.lineTo(bx, by + 42); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(bx, by, 15, 19, 0, 0, TAU);
      ctx.fillStyle = side < 0 ? '#ff9fc0' : '#9fe0ff'; ctx.fill();
      ctx.strokeStyle = 'rgba(120,90,150,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    }

    // hull
    rr(ctx, x, hullTop, hullW, hullH, 20);
    const g = ctx.createLinearGradient(0, hullTop, 0, hullBottom);
    g.addColorStop(0, '#c98a4e'); g.addColorStop(1, '#8f5a2c');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#5c3a1a'; ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = 'rgba(92,58,26,0.5)'; ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(x + 8, hullTop + i * hullH / 4); ctx.lineTo(x + hullW - 8, hullTop + i * hullH / 4); ctx.stroke();
    }
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(x, deckY - 3, hullW, 8);
    // big happy face on the bow (right end)
    drawFace(ctx, x + hullW - 48, hullTop + hullH * 0.5, 28, 'happy', t, 9);

    // little cabin at the stern
    rr(ctx, x + 14, deckY - 46, 72, 46, 8);
    ctx.fillStyle = '#e8c48a'; ctx.fill();
    ctx.strokeStyle = '#5c3a1a'; ctx.lineWidth = 3; ctx.stroke();
    rr(ctx, x + 32, deckY - 34, 20, 18, 4);
    ctx.fillStyle = '#8fd0ff'; ctx.fill();
    ctx.strokeStyle = '#5c3a1a'; ctx.lineWidth = 2; ctx.stroke();

    // ship's wheel
    const wx = x + hullW * 0.56, wy = deckY - 24;
    ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(wx, wy, 20, 0, TAU); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(a) * 20, wy + Math.sin(a) * 20); ctx.stroke();
    }
    ctx.fillStyle = '#8a5a30'; ctx.beginPath(); ctx.arc(wx, wy, 5, 0, TAU); ctx.fill();

    // mast rising above the deck
    const mastX = x + hullW * 0.3, mastTop = deckY - 200;
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(mastX, deckY); ctx.lineTo(mastX, mastTop); ctx.stroke();
    ctx.lineCap = 'butt';

    // cream sail
    const sailSway = Math.sin(t * 1.4) * 10;
    ctx.beginPath();
    ctx.moveTo(mastX, mastTop + 16);
    ctx.quadraticCurveTo(mastX + 80 + sailSway, mastTop + 50, mastX + 68, mastTop + 140);
    ctx.quadraticCurveTo(mastX + 28, mastTop + 108, mastX, mastTop + 150);
    ctx.closePath();
    ctx.fillStyle = '#fff6df'; ctx.fill();
    ctx.strokeStyle = '#d9c9a0'; ctx.lineWidth = 3; ctx.stroke();

    // flag: a happy skull-with-hearts (no crossbones/weapons)
    const flagWave = Math.sin(t * 4) * 6;
    ctx.beginPath();
    ctx.moveTo(mastX, mastTop);
    ctx.lineTo(mastX + 42 + flagWave, mastTop + 11);
    ctx.lineTo(mastX, mastTop + 24);
    ctx.closePath();
    ctx.fillStyle = '#3a3050'; ctx.fill();
    ctx.strokeStyle = 'rgba(51,34,50,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save();
    ctx.translate(mastX + 15, mastTop + 12);
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.fillStyle = '#ff5a8a';
    heartPath(ctx, -3.4, -1.5, 4); ctx.fill();
    heartPath(ctx, 3.4, -1.5, 4); ctx.fill();
    ctx.strokeStyle = '#6b3345'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 4, 3, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  // ---- 5. giant walkable cloud island -------------------------------------
  // Follows the game's proven fluffy-cloud-platform look (js/levels.js
  // drawSolids 'cloud' theme) scaled up: a flat-topped body with big round
  // puffs whose tops never rise above the walkable line, plus a soft tinted
  // band along the underside for depth.
  function cloudIsland(ctx, x, y, w, t = 0) {
    ctx.save();
    const thick = 110, step = 150;

    // solid flat-topped body
    rr(ctx, x, y, w, thick, 34);
    ctx.fillStyle = '#ffffff'; ctx.fill();

    // big round top puffs — center kept >= r+2 below y so no puff rises
    // above the walkable line; they bulge down/sideways into the body
    for (let px = x + step * 0.35; px < x + w; px += step) {
      const s2 = hash2(Math.floor(px / 37), 7);
      const r = 62 + s2 * 20;
      ctx.beginPath(); ctx.arc(px, y + r + 2, r, 0, TAU);
      ctx.fillStyle = '#ffffff'; ctx.fill();
    }

    // lavender-tinted shading band along the underside for depth
    ctx.fillStyle = 'rgba(178,160,222,0.4)';
    rr(ctx, x + 8, y + thick - 26, w - 16, 20, 10); ctx.fill();
    // small lavender underside puffs peeking out along the bottom
    for (let px = x + step * 0.85; px < x + w; px += step) {
      const s2 = hash2(Math.floor(px / 43), 13);
      const r = 22 + s2 * 10;
      ctx.beginPath(); ctx.arc(px, y + thick - 6, r, 0, TAU);
      ctx.fillStyle = 'rgba(178,160,222,0.4)'; ctx.fill();
    }

    // gentle sparkle
    for (let px = x + 60; px < x + w; px += 260) {
      ctx.globalAlpha = Math.max(0, 0.55 + 0.35 * Math.sin(t * 2 + px));
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(px, y + 24); ctx.lineTo(px + 4, y + 34); ctx.lineTo(px, y + 44); ctx.lineTo(px - 4, y + 34);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // a small sleepy face every ~900px
    for (let fx = x + 300; fx < x + w; fx += 900) {
      const s2 = hash2(Math.floor(fx / 3), 3);
      drawFace(ctx, fx, y + 40, 26, 'sleepy', t, s2 * 12);
    }

    ctx.restore();
  }

  // ---- 6. tiny cloud bump obstacle ----------------------------------------
  function tinyCloud(ctx, x, y, w, h, t = 0) {
    ctx.save();
    const cx = x + w / 2, cy = y + h * 0.6;
    rr(ctx, x + 2, y + h * 0.34, w - 4, h * 0.64, 14);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.strokeStyle = 'rgba(150,140,190,0.4)'; ctx.lineWidth = 2; ctx.stroke();
    for (const [ox, oy, rf] of [[-0.32, 0.06, 0.30], [0, -0.16, 0.36], [0.32, 0.06, 0.30]]) {
      ctx.beginPath(); ctx.arc(cx + ox * w, cy + oy * h, rf * w, 0, TAU);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.strokeStyle = 'rgba(150,140,190,0.4)'; ctx.lineWidth = 2; ctx.stroke();
    }
    const mood = Math.floor(x / 71) % 3 === 0 ? 'surprised' : 'happy';
    drawFace(ctx, cx, cy - h * 0.07, w * 0.32, mood, t, Math.floor(x / 50));
    ctx.restore();
  }

  // ---- 7. finish flag + start line ----------------------------------------
  function finishFlag(ctx, x, groundY, t = 0) {
    ctx.save();
    const poleH = 150, topY = groundY - poleH;
    ctx.strokeStyle = '#b0a8c8'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x, topY); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.arc(x, topY, 8, 0, TAU); ctx.fill();

    const fw = 92, fh = 56, wave = Math.sin(t * 4) * 9;
    ctx.beginPath();
    ctx.moveTo(x, topY + 10);
    ctx.quadraticCurveTo(x + fw * 0.5, topY + 10 + wave, x + fw, topY + 10);
    ctx.lineTo(x + fw, topY + 10 + fh);
    ctx.quadraticCurveTo(x + fw * 0.5, topY + 10 + fh + wave, x, topY + 10 + fh);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    const cell = 14;
    for (let cx0 = x - cell; cx0 < x + fw + cell; cx0 += cell) {
      for (let cy0 = topY; cy0 < topY + 20 + fh; cy0 += cell) {
        const ci = Math.round((cx0 - x) / cell), ri = Math.round((cy0 - topY) / cell);
        ctx.fillStyle = (ci + ri) % 2 === 0 ? '#2a2438' : '#ffffff';
        ctx.fillRect(cx0, cy0, cell, cell);
      }
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(51,34,50,0.4)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  function startLine(ctx, x, groundY, t = 0) {
    ctx.save();
    const w = 132, h = 24, cell = 16;
    ctx.save();
    rr(ctx, x - w / 2, groundY - h, w, h, 4);
    ctx.clip();
    for (let cx0 = x - w / 2 - cell; cx0 < x + w / 2 + cell; cx0 += cell) {
      const ci = Math.round((cx0 - x) / cell);
      ctx.fillStyle = ci % 2 === 0 ? '#2a2438' : '#ffffff';
      ctx.fillRect(cx0, groundY - h, cell, h);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(51,34,50,0.4)'; ctx.lineWidth = 2;
    rr(ctx, x - w / 2, groundY - h, w, h, 4); ctx.stroke();
    for (const side of [-1, 1]) {
      const px = x + side * (w / 2 + 10);
      ctx.strokeStyle = '#b0a8c8'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px, groundY); ctx.lineTo(px, groundY - 40); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = RAINBOW[side < 0 ? 4 : 1];
      ctx.beginPath(); ctx.arc(px, groundY - 40, 7, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ---- 8. surprise-party room dressing -------------------------------------
  function partyDecor(ctx, x, groundY, w, t = 0) {
    ctx.save();
    // bunting
    const buntY = groundY - 420, bn = 8, bw = w / (bn - 1);
    for (let i = 0; i < bn - 1; i++) {
      const bx = x + (i + 0.5) * bw, sag = Math.sin(((i + 0.5) / (bn - 1)) * Math.PI) * 18;
      ctx.beginPath();
      ctx.moveTo(bx - 14, buntY + sag);
      ctx.lineTo(bx + 14, buntY + sag);
      ctx.lineTo(bx, buntY + sag + 26);
      ctx.closePath();
      ctx.fillStyle = RAINBOW[i % RAINBOW.length]; ctx.fill();
      ctx.strokeStyle = 'rgba(51,34,50,0.4)'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(120,100,150,0.6)'; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < bn; i++) {
      const bx = x + i * bw, sag = Math.sin((i / (bn - 1)) * Math.PI) * 18;
      if (i === 0) ctx.moveTo(bx, buntY); else ctx.quadraticCurveTo(x + (i - 0.5) * bw, buntY + sag, bx, buntY);
    }
    ctx.stroke();

    // floating balloons
    const bcount = 7;
    for (let i = 0; i < bcount; i++) {
      const bx = x + 20 + i * (w - 40) / (bcount - 1);
      const by = groundY - 300 - (i % 3) * 40 + Math.sin(t * 1.3 + i) * 10;
      ctx.strokeStyle = 'rgba(90,74,134,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx, by + 22); ctx.quadraticCurveTo(bx + 6, by + 60, bx, by + 96); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(bx, by, 18, 24, 0, 0, TAU);
      ctx.fillStyle = ['#ff5a8a', '#ffb62b', '#7fd8ff', '#b06cf0', '#57d357'][i % 5];
      ctx.fill();
      ctx.strokeStyle = 'rgba(51,34,50,0.35)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.ellipse(bx - 6, by - 8, 5, 8, 0.4, 0, TAU); ctx.fill();
    }

    // table + layered cake
    const tx = x + w * 0.5, ty = groundY;
    rr(ctx, tx - 90, ty - 14, 180, 14, 4); ctx.fillStyle = '#c98a4e'; ctx.fill();
    ctx.strokeStyle = '#8f5a2c'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(60,40,20,0.4)';
    ctx.fillRect(tx - 80, ty, 8, 40); ctx.fillRect(tx + 72, ty, 8, 40);
    const layers = [[70, 34, '#ff9fc0'], [54, 30, '#ffd24a'], [38, 26, '#8ecdfb']];
    let cy2 = ty - 14;
    for (const [lw, lh, col] of layers) {
      rr(ctx, tx - lw / 2, cy2 - lh, lw, lh, 8); ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = 'rgba(51,34,50,0.4)'; ctx.lineWidth = 2; ctx.stroke();
      cy2 -= lh;
    }
    for (const ox of [-16, 0, 16]) {
      ctx.fillStyle = '#fff'; ctx.fillRect(tx + ox - 2, cy2 - 16, 4, 16);
      ctx.beginPath(); ctx.arc(tx + ox, cy2 - 20, 4 + Math.sin(t * 8 + ox) * 1.5, 0, TAU);
      ctx.fillStyle = '#ffce54'; ctx.fill();
    }
    drawFace(ctx, tx, cy2 + 14, 22, 'grin', t, 4);

    // two wrapped presents
    for (const [ox, col, rib] of [[-140, '#ff8fc8', '#fff'], [130, '#8ecdfb', '#ffe156']]) {
      const pw = 56, ph = 50, px2 = tx + ox - pw / 2, py2 = ty - ph;
      rr(ctx, px2, py2, pw, ph, 8); ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = 'rgba(51,34,50,0.4)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = rib;
      ctx.fillRect(px2 + pw / 2 - 5, py2, 10, ph);
      ctx.fillRect(px2, py2 + ph / 2 - 5, pw, 10);
    }

    // streamers
    ctx.strokeStyle = 'rgba(255,143,196,0.7)'; ctx.lineWidth = 5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + 20 + i * w / 3, groundY - 380);
      ctx.quadraticCurveTo(x + 20 + i * w / 3 + 40, groundY - 260 + Math.sin(t + i) * 10, x + 20 + i * w / 3 + 10, groundY - 140);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- 9. small treasure chest --------------------------------------------
  function goldChest(ctx, cx, groundY, t = 0, o = {}) {
    const open = !!o.open, openT = clamp(o.openT ?? (open ? 1 : 0), 0, 1);
    const w = 90, h = 70, x = cx - w / 2, y = groundY - h;
    ctx.save();
    if (open) {
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3);
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(cx, y + h * 0.4, 66, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    rr(ctx, x, y + 22, w, h - 22, 8); ctx.fillStyle = '#9a6232'; ctx.fill();
    ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(x + 10, y + 22, 8, h - 22); ctx.fillRect(x + w - 18, y + 22, 8, h - 22);
    ctx.save();
    if (open) { ctx.translate(x + 4, y + 26); ctx.rotate(-openT * 2.1); ctx.translate(-(x + 4), -(y + 26)); }
    rr(ctx, x - 3, y, w + 6, 26, 10); ctx.fillStyle = '#b0743e'; ctx.fill();
    ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(x + 10, y, 8, 26); ctx.fillRect(x + w - 18, y, 8, 26);
    ctx.restore();
    ctx.fillStyle = '#ffd24a';
    rr(ctx, cx - 11, y + 16, 22, 22, 5); ctx.fill();
    ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 2; ctx.stroke();
    drawFace(ctx, cx, y + 27, 13, open ? 'grin' : 'happy', t, 8);
    if (open) {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(x + 22 + i * 22, y + 22 - (i % 2) * 8, 8, 0, TAU);
        ctx.fillStyle = ['#ffd24a', '#ffe9a0', '#ffc94a'][i % 3]; ctx.fill();
      }
    }
    ctx.restore();
  }

  // ---- 10. flower-bloom entrance door ---------------------------------------
  function flowerDoor(ctx, cx, groundY, t = 0, o = {}) {
    const glow = o.glow !== false;
    ctx.save();
    // keep the whole bloom within ~±70px of cx and ~150px tall
    ctx.translate(cx, groundY); ctx.scale(0.75, 0.75); ctx.translate(-cx, -groundY);
    const stemH = 34;
    rr(ctx, cx - 9, groundY - stemH, 18, stemH, 6);
    const gStem = ctx.createLinearGradient(0, groundY - stemH, 0, groundY);
    gStem.addColorStop(0, '#8de86a'); gStem.addColorStop(1, '#3fa832');
    ctx.fillStyle = gStem; ctx.fill();

    const bloomCY = groundY - stemH - 46;
    if (glow) {
      ctx.globalAlpha = 0.3 + 0.1 * Math.sin(t * 2.5);
      ctx.fillStyle = '#ff8fc8';
      ctx.beginPath(); ctx.arc(cx, bloomCY, 78, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.sin(t * 1.1 + i) * 0.05;
      ctx.save();
      ctx.translate(cx, bloomCY);
      ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(48, 0, 42, 26, 0, 0, TAU);
      ctx.fillStyle = '#ff8fc8'; ctx.fill();
      ctx.strokeStyle = '#e0559a'; ctx.lineWidth = 3.5; ctx.stroke();
      if (i === 1 || i === 4) drawFace(ctx, 48, 0, 15, 'happy', t, i);
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(cx, bloomCY, 34, 0, TAU);
    const gDoor = ctx.createRadialGradient(cx, bloomCY, 4, cx, bloomCY, 34);
    gDoor.addColorStop(0, '#5a3a8a'); gDoor.addColorStop(1, '#20112e');
    ctx.fillStyle = gDoor; ctx.fill();
    ctx.strokeStyle = '#3a2258'; ctx.lineWidth = 3; ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const a = t * 0.6 + i * 1.3, r = 10 + (i % 3) * 8;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, bloomCY + Math.sin(a) * r, 1.6, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
    }
    ctx.restore();
  }

  return {
    SHIP_DECK,
    giantFlower, rainbowCastle, spiderHome, pirateShip, cloudIsland,
    tinyCloud, finishFlag, startLine, partyDecor, goldChest, flowerDoor
  };
})();
