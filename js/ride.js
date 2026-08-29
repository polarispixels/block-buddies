'use strict';
// ================================================================ ride mode
// RIDE MODE: the reusable automatic-traversal framework (spec:
// docs/superpowers/specs/2026-08-29-desert-sand-slide-design.md).
// First instance: the DESERT SAND SLIDE (stage 6-1). Three layers:
//   RideMode   — generic rider physics over a HEIGHTFIELD (auto-forward,
//                gravity, jump with coyote, natural ramp launches, airborne
//                trick combos, crash/land hooks). Nothing desert-specific:
//                snowboards, minecarts, and lava surfing reuse this as-is.
//   RideCourse — template-based procedural generation: terrain nodes +
//                spawned things, constraint rules (reaction gaps scale with
//                speed), difficulty phases weighting the template pool.
//   SandSlide  — desert content + level orchestration (lives on lv.ride):
//                the puzzle -> board handoff, friendship cactus, truck
//                parts (collect/miss/lose, never unwinnable), victory run,
//                and the final mega-ramp launch into the rally.

// ---------------------------------------------------------------- art pack
// (Second-gen contact-sheet-reviewed desert art is merged in below by the
// art subagent; these are the call signatures the ride code uses.)
// Contact-sheet-reviewed desert art pack (drawn + verified by subagent):
function drawBoogieBoard(ctx, cx, cy, s, t) {
  const len = s, w = s * 0.42;
  ctx.save();
  ctx.translate(cx, cy);
  const shimmer = Math.sin(t * 4) * 0.03;
  // shadow
  ctx.fillStyle = 'rgba(60,40,20,0.18)';
  ctx.beginPath(); ctx.ellipse(0, w * 0.55, len * 0.48, w * 0.18, 0, 0, TAU); ctx.fill();
  // board body (rounded nose to the right)
  ctx.save();
  ctx.rotate(shimmer);
  rr(ctx, -len / 2, -w / 2, len, w, w * 0.42);
  const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
  g.addColorStop(0, '#ff5fa2'); g.addColorStop(1, '#ff8fc2');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = s * 0.045; ctx.strokeStyle = '#8e1050';
  ctx.stroke();
  // flame/stripe pattern
  ctx.save();
  rr(ctx, -len / 2, -w / 2, len, w, w * 0.42);
  ctx.clip();
  const stripeColors = ['#ffe14d', '#57d357', '#4aa3ff'];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = stripeColors[i];
    ctx.beginPath();
    const sx = -len * 0.28 + i * len * 0.22;
    ctx.moveTo(sx, -w / 2);
    ctx.quadraticCurveTo(sx + w * 0.5, 0, sx, w / 2);
    ctx.lineTo(sx + w * 0.28, w / 2);
    ctx.quadraticCurveTo(sx + w * 0.78, 0, sx + w * 0.28, -w / 2);
    ctx.closePath();
    ctx.fill();
  }
  // center racing stripe
  ctx.fillStyle = '#fff9';
  ctx.fillRect(-len * 0.42, -w * 0.08, len * 0.84, w * 0.16);
  ctx.restore();
  // nose highlight
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(len * 0.32, -w * 0.2, w * 0.22, w * 0.1, -0.3, 0, TAU); ctx.fill();
  ctx.restore();
  // leash curl (trailing off the back/left)
  ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = s * 0.03; ctx.lineCap = 'round';
  ctx.beginPath();
  const lx = -len / 2;
  ctx.moveTo(lx, 0);
  for (let i = 0; i <= 12; i++) {
    const a = i / 12 * Math.PI * 2.4;
    const rr2 = s * 0.09 * (1 - i / 16);
    ctx.lineTo(lx - s * 0.18 - Math.cos(a) * rr2, Math.sin(a) * rr2);
  }
  ctx.stroke();
  ctx.restore();
}

function drawCactusRide(ctx, x, groundY, s, t, friendly) {
  const w = s * 0.44, bodyH = s * 0.92;
  const baseY = groundY, topY = baseY - bodyH;
  const green = friendly ? '#5fbf5a' : '#4a9e46';
  const dark = friendly ? '#3d8f3a' : '#2f6e2c';
  function drawSpikeRow(x0, x1, y, n, color, soft) {
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = s * 0.02;
    for (let i = 0; i < n; i++) {
      const px = x0 + (x1 - x0) * (i + 0.5) / n;
      if (soft) {
        ctx.beginPath(); ctx.arc(px, y, s * 0.028, 0, TAU); ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(px - s * 0.02, y);
        ctx.lineTo(px, y - s * 0.09);
        ctx.lineTo(px + s * 0.02, y);
        ctx.closePath(); ctx.fill();
      }
    }
  }
  function drawFlower(fx, fy, r, rot) {
    ctx.save();
    ctx.translate(fx, fy); ctx.rotate(rot);
    ctx.fillStyle = '#ff9ecf';
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate(i / 5 * TAU);
      ctx.beginPath(); ctx.ellipse(0, -r * 1.05, r * 0.55, r * 0.85, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(x, 0);
  // shadow
  ctx.fillStyle = 'rgba(60,40,20,0.18)';
  ctx.beginPath(); ctx.ellipse(0, baseY + 4, w * 1.1, w * 0.32, 0, 0, TAU); ctx.fill();

  const armSwing = friendly ? Math.sin(t * 2.2) * 0.35 : Math.sin(t * 1.1) * 0.06;

  function drawArm(side) {
    ctx.save();
    const shoulderY = topY + bodyH * 0.6;
    const wave = friendly ? armSwing * w * 0.5 : armSwing * w * 0.15;
    const elbowX = side * (w * 0.92 + wave * 0.4), elbowY = shoulderY - bodyH * 0.02;
    const tipX = side * (w * 0.78 + wave), tipY = topY + bodyH * 0.06;
    // thick rounded-stroke path: shoulder -> out -> curl up parallel to trunk
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(side * w * 0.32, shoulderY + bodyH * 0.12);
    ctx.quadraticCurveTo(side * w * 0.75, shoulderY + bodyH * 0.05, elbowX, elbowY);
    ctx.quadraticCurveTo(side * (w * 0.98 + wave), topY + bodyH * 0.32, tipX, tipY);
    ctx.strokeStyle = dark; ctx.lineWidth = w * 0.58; ctx.stroke();
    ctx.strokeStyle = green; ctx.lineWidth = w * 0.48; ctx.stroke();
    // rounded cap on the tip
    ctx.beginPath(); ctx.arc(tipX, tipY - w * 0.02, w * 0.24, 0, TAU);
    ctx.fillStyle = green; ctx.fill(); ctx.lineWidth = s * 0.03; ctx.strokeStyle = dark; ctx.stroke();
    // decoration along the arm
    if (friendly) {
      drawFlower(elbowX + side * w * 0.05, elbowY - bodyH * 0.06, s * 0.1, side * 0.4);
      drawFlower(tipX, tipY - w * 0.05, s * 0.11, side * -0.5);
    } else {
      drawSpikeRow(side * w * 0.4, elbowX, shoulderY - bodyH * 0.02, 2, dark);
      drawSpikeRow(elbowX, tipX, topY + bodyH * 0.18, 2, dark);
    }
    ctx.restore();
  }
  drawArm(-1);
  drawArm(1);

  // main trunk
  rr(ctx, -w / 2, topY, w, bodyH, w * 0.46);
  ctx.fillStyle = green; ctx.fill();
  ctx.lineWidth = s * 0.045; ctx.strokeStyle = dark; ctx.stroke();
  // trunk ridge lines
  ctx.strokeStyle = dark; ctx.lineWidth = s * 0.02; ctx.globalAlpha = 0.5;
  for (const dx of [-w * 0.28, 0, w * 0.28]) {
    ctx.beginPath(); ctx.moveTo(dx, topY + w * 0.3); ctx.lineTo(dx, baseY - w * 0.15); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  if (friendly) {
    // flowers scattered on trunk
    drawFlower(-w * 0.15, topY + bodyH * 0.18, s * 0.11, 0.4);
    drawFlower(w * 0.18, topY + bodyH * 0.35, s * 0.1, -0.6);
    drawFlower(0, topY + bodyH * 0.68, s * 0.1, 1.1);
    // soft spike nubs
    drawSpikeRow(-w / 2, w / 2, topY + bodyH * 0.5, 4, dark, true);
  } else {
    // spiky ticks down the trunk
    for (const rowY of [0.15, 0.35, 0.55, 0.75, 0.9]) {
      drawSpikeRow(-w / 2, w / 2, topY + bodyH * rowY, 4, dark);
    }
  }

  // face on trunk
  drawFace(ctx, 0, topY + bodyH * 0.34, w * 1.15, friendly ? 'grin' : 'angry', t, 0);
  ctx.restore();
}

function drawScorpionRide(ctx, x, groundY, s, t, dir) {
  const bodyW = s * 0.66, bodyH = s * 0.32;
  const cy = groundY - bodyH * 0.78;
  ctx.save();
  ctx.translate(x, 0);
  ctx.scale(dir, 1);
  const shell = '#e8823a', dark = '#95430f';
  // shadow
  ctx.fillStyle = 'rgba(60,40,20,0.2)';
  ctx.beginPath(); ctx.ellipse(0, groundY + 3, bodyW * 0.75, bodyH * 0.32, 0, 0, TAU); ctx.fill();

  // legs (3 pairs), animated scuttle, under the body
  ctx.strokeStyle = dark; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    const legX = -bodyW * 0.26 + i * bodyW * 0.26;
    const ph = Math.sin(t * 8 + i * 2.1) * bodyH * 0.25;
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.moveTo(legX, cy + bodyH * 0.25);
    ctx.lineTo(legX + s * 0.09, cy + bodyH * 0.7 + ph * 0.4);
    ctx.lineTo(legX + s * 0.17, groundY - 2);
    ctx.stroke();
  }

  // tail: chain of shrinking circles arcing up and over the back, rounded stinger ball.
  // Explicit sweep (degrees, standard math orientation, up = positive) so the tail
  // rises from the back, arcs high over the body, then hooks down toward the head.
  const nSeg = 5, segLen = s * 0.19;
  const wobble = Math.sin(t * 2.4) * 5;
  const angDeg = [152, 108, 58, 8, -45 + wobble];
  let px = -bodyW * 0.46, py = cy - bodyH * 0.1;
  const segs = [{ x: px, y: py }];
  for (let i = 0; i < nSeg; i++) {
    const rad = angDeg[i] * Math.PI / 180;
    px += Math.cos(rad) * segLen;
    py -= Math.sin(rad) * segLen; // up = positive angle -> negative canvas dy
    segs.push({ x: px, y: py });
  }
  ctx.strokeStyle = dark; ctx.lineWidth = s * 0.115; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(segs[0].x, segs[0].y);
  for (const p of segs) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.strokeStyle = shell; ctx.lineWidth = s * 0.08;
  ctx.beginPath(); ctx.moveTo(segs[0].x, segs[0].y);
  for (const p of segs) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  // segment ring marks
  ctx.strokeStyle = dark; ctx.lineWidth = s * 0.014;
  for (let i = 1; i < segs.length - 1; i++) { ctx.beginPath(); ctx.arc(segs[i].x, segs[i].y, s * 0.05, 0, TAU); ctx.stroke(); }
  // stinger ball (big, rounded, clearly visible above the body)
  const tip = segs[segs.length - 1];
  ctx.beginPath(); ctx.arc(tip.x, tip.y, s * 0.105, 0, TAU);
  ctx.fillStyle = '#ffcf4d'; ctx.fill();
  ctx.lineWidth = s * 0.032; ctx.strokeStyle = dark; ctx.stroke();
  ctx.beginPath(); ctx.arc(tip.x - s * 0.02, tip.y - s * 0.03, s * 0.03, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();

  // body (3 overlapping segments)
  for (let i = 0; i < 3; i++) {
    const bx = -bodyW * 0.3 + i * bodyW * 0.3;
    const bw = bodyW * 0.44 - i * bodyW * 0.02;
    ctx.beginPath();
    ctx.ellipse(bx, cy, bw * 0.5, bodyH * 0.5, 0, 0, TAU);
    ctx.fillStyle = shell; ctx.fill();
    ctx.lineWidth = s * 0.035; ctx.strokeStyle = dark; ctx.stroke();
  }

  // claws: big obvious forward pincers (open crab-claw silhouette), held out ahead of the head
  function drawClaw(ox, oy) {
    ctx.save();
    ctx.translate(ox, oy);
    const openAmt = (Math.sin(t * 5) + 1) / 2;
    // connecting arm back to the body
    ctx.strokeStyle = dark; ctx.lineWidth = s * 0.08; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.2, 0); ctx.lineTo(0, 0); ctx.stroke();
    ctx.strokeStyle = shell; ctx.lineWidth = s * 0.055;
    ctx.beginPath(); ctx.moveTo(-s * 0.2, 0); ctx.lineTo(0, 0); ctx.stroke();
    // hand (big rounded pad)
    ctx.beginPath(); ctx.ellipse(s * 0.08, 0, s * 0.19, s * 0.15, 0, 0, TAU);
    ctx.fillStyle = shell; ctx.fill(); ctx.lineWidth = s * 0.04; ctx.strokeStyle = dark; ctx.stroke();
    // two long open pincer fingers (rounded tips, wide gap = unmistakable "claw")
    for (const sd of [-1, 1]) {
      ctx.save();
      ctx.translate(s * 0.2, sd * s * 0.05);
      ctx.rotate(sd * (0.45 + openAmt * 0.3));
      rr(ctx, 0, -s * 0.055, s * 0.3, s * 0.11, s * 0.055);
      ctx.fillStyle = shell; ctx.fill(); ctx.lineWidth = s * 0.035; ctx.strokeStyle = dark; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  drawClaw(bodyW * 0.5, cy - bodyH * 0.62);
  drawClaw(bodyW * 0.54, cy + bodyH * 0.5);

  // face on front body segment (mischievous)
  drawFace(ctx, bodyW * 0.28, cy, bodyH * 1.9, 'grin', t, 0.3);
  ctx.restore();
}

function drawTumbleweedRide(ctx, cx, cy, r, rot) {
  ctx.save();
  ctx.translate(cx, cy);
  // shadow
  ctx.fillStyle = 'rgba(60,40,20,0.18)';
  ctx.beginPath(); ctx.ellipse(0, r * 0.9, r * 0.85, r * 0.22, 0, 0, TAU); ctx.fill();
  ctx.rotate(rot);
  ctx.strokeStyle = '#a9843f'; ctx.lineCap = 'round';
  // scraggly tangle: many arcs through random-ish (but deterministic) chords
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a1 = (i / n) * TAU + (i % 3) * 0.35;
    const a2 = a1 + Math.PI * (0.5 + (i % 4) * 0.15);
    const rad = r * (0.7 + (i % 3) * 0.12);
    ctx.lineWidth = r * (0.035 + (i % 2) * 0.015);
    ctx.beginPath();
    ctx.arc(0, 0, rad, a1, a2);
    ctx.stroke();
  }
  // inner denser knot
  ctx.strokeStyle = '#8a6a2f';
  for (let i = 0; i < 8; i++) {
    const a1 = (i / 8) * TAU + 0.6;
    ctx.lineWidth = r * 0.03;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.4, a1, a1 + 1.6);
    ctx.stroke();
  }
  ctx.restore();
  // tiny face in the middle, not rotated (reads consistently while rolling)
  drawFace(ctx, cx, cy, r * 0.95, 'surprised', rot, 0.5);
}

function drawRockRide(ctx, x, groundY, s, seed) {
  const w = s, h = s * (0.62 + seed * 0.1);
  const baseY = groundY, topY = baseY - h;
  ctx.save();
  ctx.translate(x, 0);
  ctx.fillStyle = 'rgba(60,40,20,0.18)';
  ctx.beginPath(); ctx.ellipse(0, baseY + 3, w * 0.55, w * 0.14, 0, 0, TAU); ctx.fill();

  // irregular boulder silhouette via seeded bump points (round top, gently squashed bottom)
  const n = 10;
  const seedI = Math.round(seed * 1000);
  const rawPts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const jitter = 0.85 + hash2(i, seedI) * 0.3;
    const rx = (w / 2) * jitter;
    const ry = (h / 2) * jitter * (Math.sin(a) > 0 ? 0.55 : 1); // squash lower half only
    rawPts.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry });
  }
  let maxY = -Infinity;
  for (const p of rawPts) if (p.y > maxY) maxY = p.y;
  const shiftY = baseY - maxY; // rest the lowest bump right on the ground
  const pts = rawPts.map(p => ({ x: p.x, y: p.y + shiftY }));
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n], pPrev = pts[(i - 1 + n) % n];
    const mx = (p.x + pPrev.x) / 2, my = (p.y + pPrev.y) / 2;
    ctx.quadraticCurveTo(pPrev.x, pPrev.y, mx, my);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, topY, 0, baseY);
  g.addColorStop(0, '#a89484'); g.addColorStop(1, '#8a7566');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = s * 0.035; ctx.strokeStyle = '#5f4d40'; ctx.stroke();

  // cracks
  ctx.strokeStyle = '#5f4d40'; ctx.lineWidth = s * 0.018; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-w * 0.15, topY + h * 0.3);
  ctx.lineTo(-w * 0.05, topY + h * 0.5);
  ctx.lineTo(-w * 0.18, topY + h * 0.75);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.2, topY + h * 0.2);
  ctx.lineTo(w * 0.28, topY + h * 0.42);
  ctx.stroke();

  // speckles
  ctx.fillStyle = 'rgba(95,77,64,0.5)';
  for (let i = 0; i < 6; i++) {
    const sx = (hash2(i + 1, Math.round(seed * 1000) + 7) - 0.5) * w * 0.7;
    const sy = topY + h * (0.3 + hash2(i + 3, Math.round(seed * 1000)) * 0.5);
    ctx.beginPath(); ctx.arc(sx, sy, s * 0.02, 0, TAU); ctx.fill();
  }

  // optional sleepy face
  drawFace(ctx, 0, topY + h * 0.42, w * 0.5, 'sleepy', seed * 5, seed);
  ctx.restore();
}

function drawSlidePart(ctx, cx, cy, s, kind, t) {
  const bob = Math.sin(t * 3) * s * 0.06;
  const spin = Math.sin(t * 2.4) * 0.12;
  ctx.save();
  ctx.translate(cx, cy + bob);
  // golden glow halo
  const glowR = s * 0.75;
  const glow = ctx.createRadialGradient(0, 0, s * 0.15, 0, 0, glowR);
  glow.addColorStop(0, 'rgba(255,224,120,0.55)');
  glow.addColorStop(1, 'rgba(255,224,120,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, glowR, 0, TAU); ctx.fill();

  ctx.rotate(spin);

  if (kind === 'tire') {
    const r = s * 0.42;
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    // deep tread notches
    ctx.strokeStyle = '#111'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82);
      ctx.lineTo(Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02);
      ctx.stroke();
    }
    // hub
    ctx.fillStyle = '#d8d8d8';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, TAU); ctx.fill();
    ctx.lineWidth = s * 0.03; ctx.strokeStyle = '#888'; ctx.stroke();
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, TAU); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU;
      ctx.fillStyle = '#999';
      ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.24, Math.sin(a) * r * 0.24, r * 0.06, 0, TAU); ctx.fill();
    }
  } else if (kind === 'engine') {
    const w = s * 0.62, h = s * 0.56;
    rr(ctx, -w / 2, -h / 2, w, h, w * 0.14);
    ctx.fillStyle = '#8f96a3'; ctx.fill();
    ctx.lineWidth = s * 0.035; ctx.strokeStyle = '#4a5060'; ctx.stroke();
    // pistons on top
    for (const dx of [-w * 0.28, 0, w * 0.28]) {
      const ph = h * 0.28 + Math.abs(Math.sin(t * 6 + dx)) * h * 0.08;
      ctx.fillStyle = '#c9ccd4';
      ctx.fillRect(dx - w * 0.08, -h / 2 - ph, w * 0.16, ph);
      ctx.strokeRect(dx - w * 0.08, -h / 2 - ph, w * 0.16, ph);
    }
    // bolts
    ctx.fillStyle = '#ffe14d';
    for (const [bx, by] of [[-w * 0.32, -h * 0.28], [w * 0.32, -h * 0.28], [-w * 0.32, h * 0.28], [w * 0.32, h * 0.28]]) {
      ctx.beginPath(); ctx.arc(bx, by, s * 0.045, 0, TAU); ctx.fill();
    }
    drawFace(ctx, 0, h * 0.05, w * 0.7, 'grin', t, 0.2);
  } else if (kind === 'wheel') {
    const r = s * 0.42;
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = s * 0.13;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#7a1f16'; ctx.lineWidth = s * 0.03;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    // 3 spokes to hub
    ctx.strokeStyle = '#7a1f16'; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * TAU + Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78);
      ctx.stroke();
    }
    ctx.fillStyle = '#3a2a2a';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = s * 0.02;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, TAU); ctx.stroke();
  } else if (kind === 'body') {
    const w = s * 0.7, h = s * 0.44;
    rr(ctx, -w / 2, -h * 0.15, w, h, h * 0.32);
    ctx.fillStyle = '#3fa9e8'; ctx.fill();
    ctx.lineWidth = s * 0.035; ctx.strokeStyle = '#1f6a9e'; ctx.stroke();
    // cab hump
    rr(ctx, -w * 0.22, -h * 0.55, w * 0.5, h * 0.5, h * 0.2);
    ctx.fillStyle = '#3fa9e8'; ctx.fill(); ctx.stroke();
    // windshield
    rr(ctx, -w * 0.14, -h * 0.46, w * 0.32, h * 0.3, h * 0.08);
    ctx.fillStyle = '#d9f4ff'; ctx.fill();
    ctx.lineWidth = s * 0.025; ctx.strokeStyle = '#1f6a9e'; ctx.stroke();
    // headlight
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath(); ctx.arc(w * 0.32, h * 0.05, s * 0.05, 0, TAU); ctx.fill();
    drawFace(ctx, -w * 0.05, h * 0.05, w * 0.42, 'happy', t, 0.4);
  } else if (kind === 'exhaust') {
    // comically OVERSIZED chrome pipe: narrow at the base, flares into a big bell at the tip
    ctx.save();
    ctx.rotate(-0.32);
    const len = s * 0.95, baseRad = s * 0.13, tipRad = s * 0.34;
    // main tapered body (trapezoid with rounded corners via a path, chrome gradient across it)
    ctx.beginPath();
    ctx.moveTo(-len / 2, -baseRad);
    ctx.lineTo(len * 0.15, -tipRad);
    ctx.lineTo(len / 2, -tipRad);
    ctx.lineTo(len / 2, tipRad);
    ctx.lineTo(len * 0.15, tipRad);
    ctx.lineTo(-len / 2, baseRad);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -tipRad, 0, tipRad);
    g.addColorStop(0, '#5a6870'); g.addColorStop(0.35, '#f0f8fb'); g.addColorStop(0.55, '#c4d2d8'); g.addColorStop(1, '#465258');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = s * 0.035; ctx.strokeStyle = '#2b343a'; ctx.stroke();
    // a couple of chrome ribs along the body to read as "pipe", not "can"
    ctx.strokeStyle = 'rgba(43,52,58,0.55)'; ctx.lineWidth = s * 0.02;
    for (const fx of [-len * 0.1, len * 0.42]) {
      const fr = baseRad + (tipRad - baseRad) * clamp((fx + len / 2) / (len * 0.65), 0, 1);
      ctx.beginPath(); ctx.moveTo(fx, -fr); ctx.lineTo(fx, fr); ctx.stroke();
    }
    // big dark open bell rim at the tip
    ctx.beginPath(); ctx.ellipse(len / 2 - tipRad * 0.1, 0, tipRad * 0.34, tipRad * 0.92, 0, 0, TAU);
    ctx.fillStyle = '#1c1c1c'; ctx.fill();
    ctx.lineWidth = s * 0.03; ctx.strokeStyle = '#000'; ctx.stroke();
    // flame puffs from the tip (staggered, always at least one visible)
    for (let i = 0; i < 3; i++) {
      const pt = (t * 1.6 + i / 3) % 1;
      ctx.save();
      ctx.globalAlpha = 0.95 - pt * 0.7;
      ctx.translate(len / 2 + tipRad * 0.35 + pt * s * 0.22, Math.sin(i * 2) * tipRad * 0.3);
      const fr = s * 0.13 * (1 - pt * 0.3);
      ctx.fillStyle = i % 2 === 0 ? '#ff9f43' : '#ffe156';
      ctx.beginPath();
      ctx.moveTo(0, fr);
      ctx.quadraticCurveTo(fr * 1.1, 0, 0, -fr);
      ctx.quadraticCurveTo(-fr * 0.55, 0, 0, fr);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    // little surprised face on the barrel (rotated back to upright so it reads clearly)
    drawFace(ctx, -s * 0.12, -s * 0.02, s * 0.36, 'surprised', t, 0.1);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- RideMode
class RideMode {
  // opts: { speed, gravity, jumpVy, maxUpVy }
  constructor(opts = {}) {
    this.speed = opts.speed || 430;      // current auto-forward speed
    this.speedMul = 1;                   // crash slowdown multiplier (recovers)
    this.gravity = opts.gravity || 1500;
    this.jumpVy = opts.jumpVy || -780;
    this.maxUpVy = opts.maxUpVy || -900; // ramp-launch cap
    this.grounded = true;
    this.vy = 0;
    this.coyote = 0;
    this.spin = 0; this.spinTarget = 0;  // airborne trick rotation (radians)
    this.trickN = 0;                     // presses this airtime
    this.groundVy = 0;                   // vertical speed while terrain-following
  }
  // advance the player along groundY(x); returns events {landed, launched}
  step(pl, dt, groundY) {
    const ev = { landed: false, launched: false, jumped: false };
    if (this.speedMul < 1) this.speedMul = Math.min(1, this.speedMul + dt * 0.9);
    const px0 = pl.x;
    pl.x += this.speed * this.speedMul * dt;
    const footX = pl.x + pl.w / 2;
    const gy = groundY(footX);
    if (this.grounded) {
      this.coyote = 0.12;
      const prevFootY = pl.y + pl.h;
      const wantY = gy - pl.h;
      // terrain-follow, but a lip that falls away faster than we can follow
      // becomes a natural launch carrying the ramp's upward momentum
      if (gy - prevFootY > 46) {
        this.grounded = false;
        this.vy = Math.max(this.maxUpVy, Math.min(0, this.groundVy));
        ev.launched = true;
      } else {
        this.groundVy = (wantY - pl.y) / Math.max(dt, 0.001);
        pl.y = wantY;
        if (justP.ArrowUp || this.jbuf > 0) {
          this.jbuf = 0;
          this.grounded = false;
          this.vy = this.jumpVy + Math.min(0, this.groundVy * 0.35);
          ev.jumped = true;
          pl.squash = 1.25;
          AudioSys.sfx('jump');
        }
      }
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
      if (justP.ArrowUp) {
        if (this.coyote > 0) { // forgiving late jump
          this.coyote = 0;
          this.vy = this.jumpVy;
          AudioSys.sfx('jump');
        } else { // TRICK TIME: every press piles on another flip
          this.trickN++;
          this.spinTarget += TAU * (this.trickN >= 4 ? 1.5 : 1);
          AudioSys.sfx(this.trickN >= 4 ? 'neigh' : 'flap');
          Particles.burst(pl.cx, pl.cy, 6, { colors: RAINBOW, type: 'sparkle', sp1: 160, l1: 0.5, s1: 8 });
        }
      }
      this.vy += this.gravity * dt;
      pl.y += this.vy * dt;
      const landY = groundY(pl.x + pl.w / 2) - pl.h;
      if (this.vy >= 0 && pl.y >= landY) {
        pl.y = landY;
        this.grounded = true;
        ev.landed = true;
        pl.squash = 0.78;
        ev.tricks = this.trickN;
        this.spin = 0; this.spinTarget = 0; this.trickN = 0;
        AudioSys.sfx('land');
        Particles.burst(pl.cx, pl.y + pl.h, 6, { colors: ['#e8c078', '#fff'], sp1: 130, l1: 0.35, grav: 300, up: 10, s1: 7 });
      }
    }
    // animate the spin toward its target (snappy, cartoonish)
    this.spin += (this.spinTarget - this.spin) * Math.min(1, dt * 7);
    pl.vx = (pl.x - px0) / Math.max(dt, 0.001); // keep vx sane for particles/projectiles
    pl.vy = this.grounded ? 0 : this.vy;
    return ev;
  }
  crashSlow(k = 0.35) { this.speedMul = Math.min(this.speedMul, k); }
  hop(vy = -420) { this.grounded = false; this.vy = vy; }
}

// ---------------------------------------------------------------- RideCourse
// Terrain = a list of {x, y} nodes (piecewise linear ground). Templates
// append nodes + things; a speed-scaled breather flat is inserted after
// every template so obstacles always leave reaction room.
class RideCourse {
  constructor(startX, baseY) {
    this.nodes = [{ x: startX, y: baseY }];
    this.baseY = baseY;
    this.things = [];       // obstacles + collectibles, sorted by x
    this.patches = [];      // quicksand {x0, x1}
    this.gi = 0;            // groundY scan cache (player x is monotonic)
  }
  get endX() { return this.nodes[this.nodes.length - 1].x; }
  node(dx, dy) { this.nodes.push({ x: this.endX + dx, y: this.baseY + dy }); }
  flat(len) { this.node(len, this.lastDy()); }
  lastDy() { return this.nodes[this.nodes.length - 1].y - this.baseY; }
  groundY(x) {
    const n = this.nodes;
    while (this.gi < n.length - 2 && x > n[this.gi + 1].x) this.gi++;
    let i = Math.min(this.gi, n.length - 2);
    while (i > 0 && x < n[i].x) i--; // (draw sampling can look back a little)
    const a = n[i], b = n[i + 1] || a;
    if (b.x === a.x) return a.y;
    const t = clamp((x - a.x) / (b.x - a.x), 0, 1);
    return lerp(a.y, b.y, t);
  }
  inPatch(x) { return this.patches.some(p => x > p.x0 && x < p.x1); }
  add(kind, x, y, w, h, extra) {
    this.things.push(Object.assign({ kind, x, y, w, h, dead: false, t: rand(9) }, extra || {}));
  }
  cleanup(behindX) {
    this.things = this.things.filter(th => !th.dead && th.x + th.w > behindX);
    this.patches = this.patches.filter(p => p.x1 > behindX);
    // drop nodes far behind (keep index cache valid)
    while (this.nodes.length > 3 && this.nodes[1].x < behindX - 200) { this.nodes.shift(); this.gi = Math.max(0, this.gi - 1); }
  }
}

// ---------------------------------------------------------------- SandSlide
const SLIDE_PARTS = ['tire', 'engine', 'wheel', 'body', 'exhaust'];
class SandSlide {
  constructor(groundY, startX) {
    this.g = groundY;
    this.startX = startX;             // where the ride terrain begins
    this.state = 'intro';             // 'intro' -> 'riding' -> 'victory' -> 'launched'
    this.boardRevealed = false;       // pattern puzzle onWin flips this
    this.boardX = startX - 210;
    this.ride = new RideMode({ speed: 400 });
    this.course = new RideCourse(startX, groundY);
    this.partsGot = [];
    this.pending = shuffleLB(SLIDE_PARTS.slice()); // spawn queue: missing kinds cycle forever
    this.sincePart = 0;               // templates since last part opportunity
    this.toastT = 0; this.toastText = ''; this.toastKind = null;
    this.friendCactus = null;         // the scripted friendship moment
    this.megaLipX = 0;                // set when the victory mega-ramp exists
    this.tutPhase = null;             // 'jump' | 'trick' freeze-frame prompts
    // a replay via the rally's back door skips the freeze-frames — that
    // player has already ridden the whole slide once
    const replay = !!game.slideReplay; game.slideReplay = false;
    this.tutDone = { jump: replay, trick: replay };
    this.finaleT = 0;                 // the grand farewell flight clock
    this.t = 0;
    this.buildLearnStrip();
  }
  // ---- scripted opening: gentle, readable, and the friendship moment ----
  buildLearnStrip() {
    const c = this.course;
    c.flat(300);
    // first gentle ramp: teaches "ramps launch you", candy on the arc
    c.node(220, -50); c.node(30, -50); c.node(10, 40); c.node(240, 0);
    this.candyArc(c.endX - 330, this.g - 160, 4);
    c.flat(260);
    // the rainbow friendship block, right on the path (auto-collect)
    c.add('rainbow', c.endX - 120, this.g - 120, 44, 44);
    c.flat(200);
    // ...and the grumpy cactus it is meant for
    this.friendCactus = { kind: 'friendcactus', x: c.endX + 140, y: this.g - 150, w: 60, h: 150, friendly: false, dead: false, t: 0 };
    c.things.push(this.friendCactus);
    c.flat(520);
    // one lone rock to practice a real jump
    c.add('rock', c.endX - 160, this.g - 52, 66, 52);
    c.flat(420);
  }
  candyArc(x0, yTop, n) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      this.course.add('candy', x0 + t * 260, this.g - 60 - Math.sin(t * Math.PI) * (this.g - 60 - yTop), 30, 30);
    }
  }
  // ---- difficulty phase -> template weights ----
  phase() {
    if (this.state === 'victory' || this.state === 'launched') return 'victory';
    const p = this.partsGot.length;
    return p <= 1 ? 'play' : p <= 3 ? 'combine' : 'final';
  }
  speedFor(ph) { return { play: 430, combine: 500, final: 550, victory: 620 }[ph] || 400; }
  // ---- procedural generation (constraint-checked templates) ----
  ensure(aheadX) {
    let guard = 0;
    while (this.course.endX < aheadX && guard++ < 40) this.emitTemplate();
  }
  emitTemplate() {
    const c = this.course, ph = this.phase(), g = this.g;
    // parts are the objective: while any are missing, guarantee an
    // opportunity at least every 4 templates (never blockable, spec §8)
    this.sincePart++;
    let pool;
    if (this.pending.length && this.sincePart >= (ph === 'final' ? 2 : 4)) pool = ['part'];
    else if (ph === 'victory') pool = ['bigRamp', 'bigRamp', 'rampCandy', 'rampCandy', 'flatCandy'];
    else if (ph === 'play') pool = ['cactus', 'rock', 'scorpion', 'quicksand', 'rampCandy', 'flatCandy', 'part'];
    else if (ph === 'combine') pool = ['cactus', 'cluster', 'scorpion', 'quicksand', 'tumbleweed', 'rampCandy', 'part', 'rock'];
    else pool = ['cluster', 'scorpion', 'quicksand', 'tumbleweed', 'rampCandy', 'part', 'bigRamp'];
    const pick = pool[randi(0, pool.length - 1)];
    if (pick === 'part') this.sincePart = 0;
    this.template(pick);
    // the constraint that keeps every obstacle readable: a breather flat
    // scaled to current speed before whatever comes next
    c.flat(Math.max(240, this.ride.speed * 0.55));
  }
  template(kind) {
    const c = this.course, g = this.g;
    if (kind === 'cactus') {
      const s = randi(0, 2) === 0 ? 150 : 100;
      c.flat(140); c.add('cactus', c.endX, g - s, 52, s, { size: s }); c.flat(160);
    } else if (kind === 'cluster') {
      c.flat(140);
      const n = randi(2, 3);
      for (let i = 0; i < n; i++) c.add('cactus', c.endX + i * 88, g - 96, 48, 96, { size: 96 });
      c.flat(120 + 88 * 3);
    } else if (kind === 'rock') {
      c.flat(120); c.add('rock', c.endX, g - 56, 70, 56); c.flat(140);
    } else if (kind === 'scorpion') {
      c.flat(180); c.add('scorpion', c.endX, g - 46, 66, 46, { vx: -70, dir: -1 }); c.flat(200);
    } else if (kind === 'tumbleweed') {
      c.flat(160); c.add('tumbleweed', c.endX + 500, g - 74, 74, 74, { vx: -220, rot: 0 }); c.flat(220);
    } else if (kind === 'quicksand') {
      const w = randi(150, 230);
      c.flat(60); c.node(24, 26);
      const p0 = c.endX;
      c.node(w, 26); c.patches.push({ x0: p0 - 12, x1: p0 + w + 12 });
      c.node(24, 0); c.flat(80);
    } else if (kind === 'part') {
      // a part floats at JUMP height over flat sand: ride under it and you
      // miss it — earning a part always takes a deliberate jump (Ryan's note)
      const partKind = this.pending.shift();
      this.pending.push(partKind);                // cycles until actually caught
      c.flat(150);
      c.add('candy', c.endX - 120, g - 130, 30, 30); // breadcrumbs point the way up
      c.add('candy', c.endX - 62, g - 176, 30, 30);
      c.add('part', c.endX - 26, g - 216, 52, 52, { part: partKind });
      c.flat(210);
    } else if (kind === 'rampCandy' || kind === 'bigRamp') {
      const big = kind === 'bigRamp';
      const rise = big ? 120 : 70, run = big ? 300 : 220, gap = big ? 340 : 220;
      c.node(run, -rise); c.node(16, -rise);      // up the ramp to the lip
      const lipX = c.endX, lipY = g - rise;
      c.node(gap, 30);                            // the gap (lands a bit lower)
      c.node(160, 0);                             // recover to base
      const apexY = lipY - (big ? 150 : 100);
      this.candyArc(lipX + 20, apexY, big ? 6 : 4);
    } else if (kind === 'flatCandy') {
      c.flat(80);
      for (let i = 0; i < 4; i++) c.add('candy', c.endX + i * 70 - 260, g - 70, 30, 30);
      c.flat(80);
    }
  }
  // ---- the victory run: spectacle, no harm, then the mega ramp ----
  startVictory() {
    this.state = 'victory';
    AudioSys.sfx('fanfare'); AudioSys.sfx('cheer');
    game.shake = Math.max(game.shake, 0.25);
    this.toast('ALL PARTS!', null);
    const c = this.course, g = this.g;
    for (let i = 0; i < 3; i++) { this.template('bigRamp'); c.flat(300); }
    // THE mega ramp: a monster launch worthy of a monster truck
    c.node(560, -220); c.node(20, -220);
    this.megaLipX = c.endX;
    this.candyArc(c.endX - 400, g - 420, 7);
    c.node(60, 420); c.node(2600, 420); // the world drops away — pure flight
  }
  toast(text, partKind) { this.toastT = 2.2; this.toastText = text; this.toastKind = partKind; }
  losePart(why) {
    if (!this.partsGot.length || this.state !== 'riding') return false;
    const lost = this.partsGot.pop();
    this.pending.unshift(lost); // straight back into the spawn queue
    this.toast('OOPS!', lost);
    AudioSys.sfx('hornflat');
    Particles.burst(game.player.cx, game.player.y, 12, { colors: ['#c9c1d6', '#8a7fae'], type: 'block', sp1: 300, l1: 0.9, s1: 10, grav: 700, up: 260 });
    return true;
  }
  // ---- the per-frame heart of the slide ----
  updatePlayer(pl, dt) {
    this.t += dt;
    pl.t += dt;
    // ---- tutorial freeze-frames: the game pauses and teaches the button ----
    if (this.tutPhase) {
      if (justP.ArrowUp) {
        if (this.tutPhase === 'jump') {
          this.ride.grounded = false;
          this.ride.vy = this.ride.jumpVy;
          AudioSys.sfx('jump');
        } else {
          this.ride.trickN++;
          this.ride.spinTarget += TAU;
          AudioSys.sfx('flap');
          Particles.burst(pl.cx, pl.cy, 8, { colors: RAINBOW, type: 'sparkle', sp1: 180, l1: 0.6, s1: 9 });
        }
        this.tutPhase = null;
      }
      return; // the world holds its breath until the taught button is pressed
    }
    if (this.state === 'riding' && !this.tutDone.jump && pl.x > this.startX + 90) {
      this.tutDone.jump = true;
      this.tutPhase = 'jump';
      AudioSys.sfx('switch');
      return;
    }
    // the TRICK lesson waits for the apex of the taught jump, so the pause
    // clearly reads as "you are high in the air — now press again!"
    if (this.tutDone.jump && !this.tutDone.trick && !this.ride.grounded &&
        this.ride.vy > -140 && this.ride.vy < 80) {
      this.tutDone.trick = true;
      this.tutPhase = 'trick';
      AudioSys.sfx('switch');
      return;
    }
    if (pl.inv > 0) pl.inv -= dt;
    if (pl.moodT > 0) pl.moodT -= dt; else pl.mood = 'happy';
    // the ride path bypasses the normal player update, so the squash easing
    // must live here too — without it a pre-ride landing squish freezes on
    pl.squash = lerp(pl.squash, 1, 1 - Math.exp(-9 * dt));
    this.ride.speed = this.speedFor(this.phase());
    if (this.state !== 'launched') this.ensure(pl.x + W * 2);
    const ev = this.ride.step(pl, dt, x => this.course.groundY(x));
    if (ev.landed && ev.tricks >= 3) { AudioSys.sfx('cheer'); Particles.burst(pl.cx, pl.y, 16, { colors: RAINBOW, type: 'confetti', sp1: 300, l0: 0.8, l1: 1.6, s1: 10, grav: 300, up: 220 }); }
    // quicksand: grounded inside a patch = the comedy sink
    if (this.state === 'riding' && this.ride.grounded && this.course.inPatch(pl.x + pl.w / 2) && pl.inv <= 0) {
      pl.inv = 1.6;
      pl.setMood('dizzy', 1.2);
      AudioSys.sfx('blorp');
      this.losePart('quicksand');
      Particles.burst(pl.cx, pl.y + pl.h, 14, { colors: ['#d8b060', '#c09848'], type: 'block', sp1: 220, l1: 0.8, s1: 11, grav: 500, up: 180 });
      this.ride.crashSlow(0.3);
      this.ride.hop(-520); // the board pops him out — momentum survives
    }
    this.things(pl, dt);
    // the mega launch: leaving the victory lip begins the GRAND FINALE — a
    // long soaring farewell flight with auto-stacking flips (mash for more!)
    if (this.state === 'victory' && this.megaLipX && pl.x > this.megaLipX && !this.ride.grounded) {
      this.state = 'launched';
      this.finaleT = 0;
      this.ride.vy = -390;        // a long shallow soaring arc that stays on screen
      this.ride.gravity = 270;    // floaty grand-finale hang time
      this.ride.spinTarget += TAU * 2;
      AudioSys.sfx('launch');
      AudioSys.sfx('cheer');
      game.shake = Math.max(game.shake, 0.2);
    }
    if (this.state === 'launched') {
      const prevT = this.finaleT;
      this.finaleT += dt;
      // a fresh outrageous flip every beat, plus a rainbow sparkle trail
      for (const beat of [0.5, 1.0, 1.5, 2.0, 2.5]) {
        if (prevT < beat && this.finaleT >= beat) {
          this.ride.trickN++;
          this.ride.spinTarget += TAU;
          AudioSys.sfx(beat >= 1.5 ? 'neigh' : 'flap');
        }
      }
      Particles.burst(pl.cx - 30, pl.cy, 2, { colors: RAINBOW, type: 'star', sp1: 90, l0: 0.5, l1: 1.1, s1: 9, grav: 60, up: 0 });
      if (this.finaleT > 3) {
        // the flight of a lifetime is complete: cut to the rally, parts in hand
        game.partsDelivered = true;
        game.stageClear(7);
      }
    }
    if (this.ride.grounded && chance(0.5)) {
      Particles.burst(pl.x, pl.y + pl.h, 1, { colors: ['#e8c078'], sp1: 90, l1: 0.4, grav: 200, up: 40, s1: 6 });
    }
  }
  things(pl, dt) {
    const camX = game.cam.x;
    for (const th of this.course.things) {
      th.t += dt;
      if (th.kind === 'scorpion' && th.x < camX + W + 100) th.x += th.vx * dt * (Math.sin(th.t * 6) > -0.6 ? 1 : 0.2);
      if (th.kind === 'tumbleweed' && th.x < camX + W + 300) { th.x += th.vx * dt; th.rot -= dt * 6; }
      if (th.dead || th.friendly) continue;
      if (!overlaps(th, pl)) continue;
      if (th.kind === 'candy') { th.dead = true; game.candy++; AudioSys.sfx('candy'); Particles.burst(th.x + 15, th.y + 15, 5, { colors: ['#ffd24a', '#fff'], type: 'sparkle', sp1: 130, l1: 0.4, s1: 8 }); }
      else if (th.kind === 'rainbow') {
        th.dead = true; pl.power = 'rainbow';
        AudioSys.sfx('rainbow');
        this.toast('', null); this.toastT = 0;
        Particles.burst(th.x + 22, th.y + 22, 14, { colors: RAINBOW, type: 'star', sp1: 240, l1: 0.8, s1: 10 });
      }
      else if (th.kind === 'part') {
        th.dead = true;
        // stale course spawns after a re-collect (or 5/5) just sparkle away
        if (this.partsGot.length >= SLIDE_PARTS.length || this.partsGot.includes(th.part)) continue;
        this.partsGot.push(th.part);
        // each kind is held once; drop every held kind from the spawn cycle
        this.pending = this.pending.filter(k => !this.partsGot.includes(k));
        this.toast(this.partsGot.length + '/5', th.part);
        AudioSys.sfx('powerup');
        pl.setMood('grin', 1.2);
        Particles.burst(th.x + 26, th.y + 26, 16, { colors: ['#ffe156', '#fff'], type: 'star', sp1: 280, l1: 0.8, s1: 11 });
        if (this.partsGot.length >= SLIDE_PARTS.length && this.state === 'riding') this.startVictory();
      }
      else if (pl.inv <= 0 && this.state === 'riding') { // obstacles (victory run is harm-free)
        pl.inv = 1.4;
        pl.setMood('surprised', 1);
        if (th.kind === 'scorpion' || (th.kind === 'cactus' && th.size >= 140)) this.losePart(th.kind);
        AudioSys.sfx('thud');
        this.ride.crashSlow(th.kind === 'tumbleweed' ? 0.55 : 0.4);
        this.ride.hop(-380);
        th.wob = 0.5;
        game.shake = Math.max(game.shake, 0.15);
      }
    }
    // projectiles vs things: shooting stays live on the board
    for (const pr of game.projectiles) {
      if (pr.dead) continue;
      for (const th of this.course.things) {
        if (th.dead || th.friendly || !overlaps(pr, th)) continue;
        if (th.kind === 'scorpion') {
          pr.dead = true;
          if (pr.kind === 'rainbow') { th.friendly = true; AudioSys.sfx('friend'); Particles.burst(th.x + 33, th.y, 10, { colors: RAINBOW, type: 'heart', sp1: 160, l1: 0.8, s1: 9 }); }
          else { th.dead = true; AudioSys.sfx('poof'); Particles.candyBurst(th.x + 33, th.y, 4); }
        } else if ((th.kind === 'cactus' || th.kind === 'friendcactus') && pr.kind === 'rainbow') {
          pr.dead = true;
          th.friendly = true;
          AudioSys.sfx('friend'); AudioSys.sfx('bells');
          pl.setMood('grin', 1.5);
          Particles.burst(th.x + th.w / 2, th.y + 30, 18, { colors: RAINBOW.concat(['#ff8fb0']), type: 'heart', sp1: 220, l1: 1, s1: 10 });
        } else if (th.kind === 'tumbleweed' && pr.kind === 'fire') {
          pr.dead = true; th.dead = true;
          AudioSys.sfx('poof');
          Particles.burst(th.x + 37, th.y + 37, 10, { colors: ['#c9a86a', '#ff9f43'], type: 'block', sp1: 240, l1: 0.7, s1: 9, grav: 500 });
        }
      }
    }
    for (const th of this.course.things) if (th.wob > 0) th.wob = Math.max(0, th.wob - dt);
    this.course.cleanup(camX - 400);
    if (this.toastT > 0) this.toastT -= dt;
  }
  // ---- board pickup handling (called from updatePlay while state==='intro') ----
  updateIntro(dt, pl) {
    this.t += dt;
    if (this.toastT > 0) this.toastT -= dt;
    if (this.boardRevealed && this.state === 'intro' &&
        Math.abs(pl.cx - this.boardX) < 60 && pl.y + pl.h > this.g - 140) {
      this.state = 'riding';
      const wall = game.level.solids.find(s => s.slideWall);
      if (wall) wall.broken = true;
      pl.x = Math.max(pl.x, this.startX - 100);
      AudioSys.sfx('powerup'); AudioSys.sfx('launch');
      this.toast('RIDE!', null);
      Particles.burst(this.boardX, this.g - 60, 20, { colors: RAINBOW.concat(['#ffe156']), type: 'confetti', sp1: 320, l0: 0.8, l1: 1.6, s1: 11, grav: 300, up: 240 });
    }
  }
  reveal() { // the pattern puzzle's onWin
    this.boardRevealed = true;
    AudioSys.sfx('chest');
    Particles.burst(this.boardX, this.g - 80, 22, { colors: ['#ffe156', '#7fd8ff', '#fff'], type: 'star', sp1: 300, l1: 1, s1: 12, grav: 150 });
  }
  // ---- drawing ----
  drawBack(ctx, t) {
    // the sand surface: sample the heightfield across the camera
    const camX = game.cam.x;
    if (camX + W < this.startX - 100) return;
    const x0 = Math.max(this.startX, camX - 60), x1 = camX + W + 60;
    ctx.beginPath();
    ctx.moveTo(x0, H + 200);
    for (let x = x0; x <= x1; x += 24) ctx.lineTo(x, this.course.groundY(x));
    ctx.lineTo(x1, H + 200);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, this.g - 240, 0, H);
    g.addColorStop(0, '#f0cc8a'); g.addColorStop(0.5, '#e0b465'); g.addColorStop(1, '#c99a4e');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#b8863a'; ctx.lineWidth = 5;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 24) { const y = this.course.groundY(x); if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    // quicksand patches: darker, slowly swirling
    for (const p of this.course.patches) {
      if (p.x1 < camX || p.x0 > camX + W) continue;
      const y = this.course.groundY((p.x0 + p.x1) / 2);
      ctx.fillStyle = '#a8823e';
      ctx.beginPath(); ctx.ellipse((p.x0 + p.x1) / 2, y + 6, (p.x1 - p.x0) / 2, 16, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(120,90,40,0.6)'; ctx.lineWidth = 3;
      for (let i = 0; i < 2; i++) {
        const sw = (p.x1 - p.x0) * (0.28 + i * 0.2);
        ctx.beginPath(); ctx.ellipse((p.x0 + p.x1) / 2, y + 6, sw, 7 + i * 3, 0, 0, TAU); ctx.stroke();
      }
    }
  }
  draw(ctx, t) {
    // the boogie board waiting on its pedestal (intro), things, and the HUD
    if (this.state === 'intro') {
      ctx.fillStyle = '#c99a4e';
      rr(ctx, this.boardX - 50, this.g - 34, 100, 34, 8); ctx.fill();
      if (this.boardRevealed) {
        drawBoogieBoard(ctx, this.boardX, this.g - 60 + Math.sin(this.t * 3) * 6, 92, this.t);
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.t * 4);
        ctx.fillStyle = '#ffe156';
        ctx.beginPath(); ctx.ellipse(this.boardX, this.g - 60, 70, 40, 0, 0, TAU); ctx.fill();
        ctx.restore();
      } else {
        outlineText(ctx, '?', this.boardX, this.g - 64 + Math.sin(this.t * 3) * 5, 42, '#8a7fae', '#fff');
      }
    }
    for (const th of this.course.things) {
      if (th.dead) continue;
      if (th.x + th.w < game.cam.x - 100 || th.x > game.cam.x + W + 100) continue;
      const wob = th.wob > 0 ? Math.sin(th.wob * 40) * 4 : 0;
      if (th.kind === 'cactus' || th.kind === 'friendcactus') drawCactusRide(ctx, th.x + th.w / 2 + wob, th.y + th.h, th.h, th.t, !!th.friendly);
      else if (th.kind === 'scorpion') drawScorpionRide(ctx, th.x + th.w / 2, th.y + th.h, th.w, th.t, th.friendly ? 1 : th.dir);
      else if (th.kind === 'tumbleweed') drawTumbleweedRide(ctx, th.x + th.w / 2, th.y + th.h / 2, th.w / 2, th.rot || 0);
      else if (th.kind === 'rock') drawRockRide(ctx, th.x + th.w / 2, th.y + th.h, th.w, th.t % 1);
      else if (th.kind === 'candy') { ctx.save(); ctx.translate(th.x + 15, th.y + 15 + Math.sin(th.t * 3) * 4); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill(); ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-4, -4, 4, 0, TAU); ctx.fill(); ctx.restore(); }
      else if (th.kind === 'rainbow') drawBlock(ctx, th.x, th.y + Math.sin(th.t * 3) * 5, 44, 'rainbow', th.t, { wobble: true });
      else if (th.kind === 'part') drawSlidePart(ctx, th.x + 26, th.y + 26 + Math.sin(th.t * 2.6) * 6, 52, th.part, th.t);
      if (th.kind === 'friendcactus' && !th.friendly) {
        // a little heart thought-bubble: this one wants a friend
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(th.x + th.w / 2 + 52, th.y - 34, 30, 24, 0, 0, TAU); ctx.fill();
        heartPath(ctx, th.x + th.w / 2 + 52, th.y - 44, 16);
        ctx.fillStyle = '#ff5a8a'; ctx.fill();
        ctx.restore();
      }
    }
    // part HUD: five sockets under the candy counter
    if (this.state !== 'intro') {
      const hx = game.cam.x + W / 2 - 130, hy = game.cam.y + 96;
      for (let i = 0; i < SLIDE_PARTS.length; i++) {
        const got = i < this.partsGot.length;
        ctx.save();
        ctx.globalAlpha = got ? 1 : 0.35;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath(); ctx.arc(hx + i * 62, hy, 26, 0, TAU); ctx.fill();
        if (got) drawSlidePart(ctx, hx + i * 62, hy, 40, this.partsGot[i], this.t);
        else drawSlidePart(ctx, hx + i * 62, hy, 40, SLIDE_PARTS[i], 0);
        ctx.restore();
      }
    }
    if (this.toastT > 0) {
      const pl = game.player;
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.toastT * 2);
      const ty = pl.y - 54 - (2.2 - this.toastT) * 18;
      if (this.toastKind) drawSlidePart(ctx, pl.cx - 44, ty, 40, this.toastKind, this.t);
      outlineText(ctx, this.toastText, pl.cx + (this.toastKind ? 24 : 0), ty, 34, '#ffe156', '#5a4a86');
      ctx.restore();
    }
    // tutorial freeze-frame: a bright bubble showing the taught button
    if (this.tutPhase) {
      const pl = game.player;
      const bx = pl.cx, by = pl.y - 96 + Math.sin(this.t * 3) * 5;
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#1a1030';
      ctx.fillRect(game.cam.x, game.cam.y, W, H); // the held breath
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      rr(ctx, bx - 118, by - 52, 236, 104, 18); ctx.fill();
      ctx.strokeStyle = '#8a7fae'; ctx.lineWidth = 4;
      rr(ctx, bx - 118, by - 52, 236, 104, 18); ctx.stroke();
      drawKeycap(ctx, bx - 58, by, 58, 'up', this.t);
      outlineText(ctx, this.tutPhase === 'jump' ? 'JUMP!' : 'TRICK!', bx + 38, by, 36, this.tutPhase === 'jump' ? '#57d357' : '#ff5fa2', '#3a2a4a');
    }
  }
}
