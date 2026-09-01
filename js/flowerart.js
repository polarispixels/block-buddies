'use strict';
// FL_ART: creature art pack for RAINBOW SPIDER FLOWER LAND
// (see docs/superpowers/specs/2026-09-01-rainbow-spider-flower-land-design.md)
//
// Pure procedural drawing functions, same house style as drawFace/drawBlock
// (js/util.js) and the LB_ICONS animal icons (js/puzzleblocks.js): big
// friendly faces, rounded shapes, no gore, no sharp bits. Every function
// takes ctx + world-space coordinates and reads nothing but its own
// arguments; every function save()/restore()s and defaults t=0.

// ---------------------------------------------------------------- helpers
function flFill(ctx, color) { ctx.fillStyle = color; }
function flCircle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
function flEllipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill();
}
// a fat rounded two-segment limb (leg/arm), bent through a knee/elbow point
function flLimb(ctx, x0, y0, x1, y1, x2, y2, w, color) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(x1, y1, x2, y2);
  ctx.stroke();
}
// same, with a dark outline underneath so it reads as a separate limb against
// same-hue neighbors/body
function flLimbO(ctx, x0, y0, x1, y1, x2, y2, w, color, dark) {
  flLimb(ctx, x0, y0, x1, y1, x2, y2, w + 4, dark);
  flLimb(ctx, x0, y0, x1, y1, x2, y2, w, color);
}
function flGlow(ctx, x, y, r, color, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
  flCircle(ctx, x, y, r);
  ctx.restore();
}
function flCheeks(ctx, cx, cy, r, spread, puff = 1, color = '#ff7fb0') {
  ctx.save(); ctx.globalAlpha = 0.7; ctx.fillStyle = color;
  for (const sd of [-1, 1]) flEllipse(ctx, cx + sd * spread, cy, r * puff, r * 0.68 * puff);
  ctx.restore();
}
function flVGrad(ctx, x0, y0, x1, y1, colors) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
  return g;
}
// a rounded foot/hand pad
function flPad(ctx, x, y, r, color) { flFill(ctx, color); flCircle(ctx, x, y, r); }

const FL_ART = {

  // ---------------------------------------------------------------- 1
  // GIANT friendly spider. Footprint ~150w x 100h at scale 1, feet on
  // groundY, body centered on cx. Everything drawn relative to (0,0) =
  // (cx, groundY) so feet stay planted through scale/grow.
  rainbowSpider(ctx, cx, groundY, o = {}) {
    const t = o.t || 0, scale = o.scale || 1, kind = o.kind || 'rainbow';
    const mood = o.mood || (kind === 'grump' ? 'grumpy' : 'hungry');
    const facing = o.facing || 1, munch = o.munch || 0, rear = o.rear || 0, stomp = o.stomp || 0;
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.scale(scale * facing, scale);

    const purple = kind === 'grump';
    const legColor = purple ? '#8a76c9' : '#7a5fd8';
    const legColorDark = purple ? '#6d59a8' : '#5f47b0';

    // ---- curled-up sleeping grump: its own simple shape ----
    if (purple && mood === 'sleep') {
      const bob = Math.sin(t * 1.6) * 2;
      ctx.save(); ctx.translate(0, bob);
      // tucked leg bumps peeking from under the body
      flFill(ctx, legColor);
      for (const sd of [-1, 1]) { flCircle(ctx, sd * 34, -8, 13); flCircle(ctx, sd * 14, -4, 11); }
      // curled body, slumped low and round
      flFill(ctx, flVGrad(ctx, 0, -70, 0, -6, ['#c3b3ee', '#9a86d6']));
      flEllipse(ctx, 0, -38, 58, 40);
      ctx.strokeStyle = '#5f4a90'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, -38, 58, 40, 0, 0, TAU); ctx.stroke();
      // little face poking up, eyes squeezed shut
      drawFace(ctx, 0, -62, 30, 'sleepy', t, 2);
      // tiny nightcap
      flFill(ctx, '#4a3a8a');
      ctx.beginPath();
      ctx.moveTo(-18, -84); ctx.lineTo(16, -84); ctx.lineTo(22, -108); ctx.closePath(); ctx.fill();
      flFill(ctx, '#ffd24a'); flCircle(ctx, 23, -109, 5);
      flFill(ctx, '#4a3a8a'); rr(ctx, -20, -86, 38, 7, 3); ctx.fill();
      ctx.restore();
      ctx.restore();
      return;
    }

    // ---- shared geometry (front-facing, centered spider) ----
    const abX = 0, abY = -58, abRX = 48, abRY = 40; // abdomen
    const hX = 0, hY = -104, hR = 28;               // head
    const darkOutline = purple ? '#5f4a90' : '#4a3487';

    // rumble wiggle when hungry
    const rumble = mood === 'hungry' ? Math.sin(t * 9) * 2 : 0;
    // body rocks back with `rear` (bear-style rearing up)
    const rockA = -rear * 0.22;

    // ---- 3 symmetric BACK leg pairs (6 legs), spread wide, behind the body ----
    const backColors = ['#4aa3ff', '#ff9f43', '#57d357'];
    ctx.save();
    ctx.translate(rumble, 0); ctx.rotate(rockA);
    for (let i = 0; i < 3; i++) {
      const flex = Math.sin(t * 5 + i * 0.9) * 3;
      for (const sd of [-1, 1]) {
        const ax = sd * (8 + i * 14), ay = abY + 18 + i * 7;
        const kx = sd * (48 + i * 20), ky = -30 - i * 2 + flex;
        const fx = sd * (30 + i * 20), fy = 0;
        const col = kind === 'rainbow' ? backColors[i] : legColor;
        flLimbO(ctx, ax, ay, kx, ky, fx, fy, 13, col, darkOutline);
        flPad(ctx, fx, fy, 7, darkOutline);
      }
    }
    ctx.restore();

    // ---- neck join, bridges head to abdomen ----
    ctx.save(); ctx.translate(rumble, 0); ctx.rotate(rockA);
    flFill(ctx, purple ? '#a894e0' : '#9f7ff0');
    flEllipse(ctx, (abX + hX) / 2, (abY + hY) / 2 + 4, 26, 22);
    ctx.restore();

    // ---- abdomen ----
    ctx.save();
    ctx.translate(rumble, 0);
    ctx.rotate(rockA);
    if (kind === 'rainbow') flFill(ctx, flVGrad(ctx, 0, abY - abRY, 0, abY + abRY, RAINBOW));
    else flFill(ctx, flVGrad(ctx, 0, abY - abRY, 0, abY + abRY, ['#c3b3ee', '#9077cf']));
    flEllipse(ctx, abX, abY, abRX, abRY);
    ctx.strokeStyle = darkOutline; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(abX, abY, abRX, abRY, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    flEllipse(ctx, abX - 14, abY - 18, 16, 9);
    ctx.restore();

    // ---- head ----
    ctx.save();
    ctx.translate(rumble * 0.6, 0);
    ctx.rotate(rockA * 0.6);
    flFill(ctx, purple ? '#a894e0' : '#9f7ff0');
    flCircle(ctx, hX, hY, hR);
    ctx.strokeStyle = darkOutline; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(hX, hY, hR, 0, TAU); ctx.stroke();
    if (!purple) flCheeks(ctx, hX, hY + 8, 9, 20);
    // cheek puff while eating
    if (mood === 'eat') flCheeks(ctx, hX, hY + 4, 10, 24, 0.6 + munch * 0.8);

    let faceMood = 'happy';
    if (purple) faceMood = mood === 'yawn' ? 'sleepy' : 'angry';
    else if (mood === 'hungry') faceMood = 'surprised';
    else if (mood === 'eat') faceMood = 'grin';
    else if (mood === 'happy' || mood === 'dance') faceMood = 'happy';
    drawFace(ctx, hX, hY, 44, faceMood, t, 3);

    if (purple && mood === 'yawn') { // big open yawn overrides the sleepy mouth
      ctx.fillStyle = '#6b3345';
      flEllipse(ctx, hX, hY + 14, 11, 15);
    }
    ctx.restore();

    // ---- FRONT legs/arms, drawn last so they read clearly over the body ----
    if (purple) {
      // arms folded across the tummy like crossed arms
      for (const sd of [-1, 1]) {
        flLimbO(ctx, sd * 22, abY - 6, sd * 4, abY + 10, -sd * 10, abY + 18, 13, legColor, darkOutline);
        flPad(ctx, -sd * 10, abY + 18, 7, darkOutline);
      }
    } else {
      // two little "hand" legs that rest up near the chest (hungry/eat/happy
      // gestures); rear throws them up overhead, stomp slams them to the
      // ground for the flower smash
      const restY = -40, raisedY = -100, groundedY = 0;
      const baseY = restY + (raisedY - restY) * rear;
      const fy = baseY + (groundedY - baseY) * stomp;
      for (const sd of [-1, 1]) {
        const ax = hX + sd * 16, ay = hY + 22;
        const kx = hX + sd * 40, ky = fy - 26;
        const fx = hX + sd * 30, fyy = fy;
        flLimbO(ctx, ax, ay, kx, ky, fx, fyy, 13, '#ff9f43', darkOutline);
        flPad(ctx, fx, fyy, 7, darkOutline);
        if (stomp > 0.55 && fyy > -6) { // dust puff on the slam
          flGlow(ctx, fx, 2, 16 + stomp * 10, '#e8d8ff', 0.35 * stomp);
        }
      }
    }

    ctx.restore();
  },

  // ---------------------------------------------------------------- 2
  // 46x44 magic mushroom centered at (cx, cy).
  magicShroom(ctx, cx, cy, t = 0, o = {}) {
    const glow = o.glow !== false, scale = o.scale || 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    if (glow) {
      const pulse = 0.18 + 0.08 * Math.sin(t * 4);
      flGlow(ctx, 0, -6, 30, '#e0b8ff', pulse);
    }
    // stalk
    flFill(ctx, '#fff7ea');
    rr(ctx, -10, -4, 20, 24, 8); ctx.fill();
    ctx.strokeStyle = '#d8b890'; ctx.lineWidth = 2;
    rr(ctx, -10, -4, 20, 24, 8); ctx.stroke();
    // tiny googly grin face on the stalk
    drawFace(ctx, 0, 8, 15, 'grin', t, 4);
    // cap
    flFill(ctx, flVGrad(ctx, 0, -30, 0, -6, ['#c090ff', '#a86cf0']));
    ctx.beginPath(); ctx.ellipse(0, -10, 23, 16, 0, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = '#7a3fd0'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, -10, 23, 16, 0, Math.PI, TAU); ctx.stroke();
    // pink spots
    flFill(ctx, '#ff9ce0');
    flCircle(ctx, -11, -19, 4); flCircle(ctx, 6, -22, 3.4); flCircle(ctx, 13, -14, 3.6); flCircle(ctx, -2, -16, 2.6);
    // cap highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    flEllipse(ctx, -8, -20, 7, 4);
    ctx.restore();
  },

  // ---------------------------------------------------------------- 3
  // tiny daisy person, ~50w x 80h, feet on groundY.
  flowerPerson(ctx, cx, groundY, t = 0, o = {}) {
    const mood = o.mood || 'happy', hop = o.hop || 0, holdHat = !!o.holdHat, facing = o.facing || 1;
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.scale(facing, 1);
    const lift = -hop * 24;
    const squash = 1 - hop * 0.12;
    ctx.translate(0, lift);
    ctx.scale(1, squash);

    // boots
    flFill(ctx, '#a85a3c');
    for (const sd of [-1, 1]) flEllipse(ctx, sd * 8, -5, 8, 6);
    // stem body
    flFill(ctx, '#57c25a');
    rr(ctx, -9, -44, 18, 42, 9); ctx.fill();
    // leaf skirt at the hip
    flFill(ctx, '#6fd66f');
    for (const sd of [-1, 1]) {
      ctx.save(); ctx.translate(sd * 6, -20); ctx.rotate(sd * 0.5);
      flEllipse(ctx, 0, 0, 16, 7);
      ctx.restore();
    }
    // leaf arms — relaxed pair, or (holdHat) one relaxed + one raised
    const swing = Math.sin(t * 3) * 0.12;
    if (holdHat) {
      // left arm relaxed at the side, drawn behind the head
      flLimb(ctx, -8, -40, -18, -30, -14, -16, 9, '#57c25a');
      flPad(ctx, -14, -16, 6, '#6fd66f');
    } else {
      for (const sd of [-1, 1]) {
        flLimb(ctx, sd * 8, -40, sd * 20, -30 + swing * 20 * sd, sd * 16, -18 + swing * 14 * sd, 9, '#57c25a');
        flPad(ctx, sd * 16, -18 + swing * 14 * sd, 6, '#6fd66f');
      }
    }

    // head: petal ring + yellow center
    const headY = -58;
    flFill(ctx, '#fff9f2');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.save(); ctx.translate(0, headY); ctx.rotate(a);
      flEllipse(ctx, 0, -22, 9, 15);
      ctx.restore();
    }
    flFill(ctx, '#ffd24a');
    flCircle(ctx, 0, headY, 20);
    ctx.strokeStyle = '#e8a23c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, headY, 20, 0, TAU); ctx.stroke();
    drawFace(ctx, 0, headY, 26, mood, t, 5);

    // raised right arm holding the hat, drawn LAST so it clears the head
    // silhouette entirely (hand + hat sit up and outside the petal ring)
    if (holdHat) {
      flLimb(ctx, 8, -40, 26, -62, 40, -86, 9, '#57c25a');
      flPad(ctx, 40, -86, 6, '#6fd66f');
      FL_ART.flowerHat(ctx, 40, -96, 15, { t, active: true, spin: t * 1.4 });
    }
    ctx.restore();
  },

  // ---------------------------------------------------------------- 4
  // magic flower-petal hat. y = brim line; crown sits above it.
  flowerHat(ctx, cx, y, s = 26, o = {}) {
    const t = o.t || 0, active = !!o.active, spin = o.spin || 0;
    ctx.save();
    // crown origin: a touch above the brim line
    ctx.translate(cx, y - s * 0.22);
    if (active) flGlow(ctx, 0, 0, s * 1.05, '#ffe89a', 0.32 + 0.1 * Math.sin(t * 5));
    const petalColors = ['#ffb8d8', '#ffffff', '#ffd8ec', '#ffffff', '#ffb8d8', '#ffe0f0'];
    const n = 6;
    // droops to a tight downward bunch when inactive; splays into a wide
    // upward fan (+ spin) when active
    const angStart = active ? -Math.PI * 0.98 : -Math.PI * 0.66;
    const angEnd = active ? -Math.PI * 0.02 : -Math.PI * 0.34;
    const dist = active ? s * 0.62 : s * 0.44;
    const plen = active ? s * 0.92 : s * 0.7;
    const pwid = s * 0.36;
    for (let i = 0; i < n; i++) {
      const a = lerp(angStart, angEnd, i / (n - 1)) + spin;
      ctx.save();
      ctx.rotate(a);
      flFill(ctx, petalColors[i % petalColors.length]);
      flEllipse(ctx, dist, 0, plen / 2, pwid / 2);
      ctx.strokeStyle = 'rgba(200,140,180,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(dist, 0, plen / 2, pwid / 2, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    // gold glowing center dome
    flFill(ctx, flVGrad(ctx, 0, -s * 0.3, 0, s * 0.3, ['#fff3c0', '#ffce4a']));
    flCircle(ctx, 0, 0, s * 0.32);
    ctx.strokeStyle = '#e8a23c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.32, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    flCircle(ctx, -s * 0.1, -s * 0.11, s * 0.1);
    // little leaf tab at the base
    flFill(ctx, '#6fd66f');
    ctx.save(); ctx.translate(s * 0.3, s * 0.3); ctx.rotate(0.6);
    flEllipse(ctx, 0, 0, s * 0.2, s * 0.1);
    ctx.restore();
    ctx.restore();
  },

  // ---------------------------------------------------------------- 5
  // silly round teal dragon, ~220w x 190h, feet on groundY.
  // mouth tip is at world (cx + facing*80, groundY - 140).
  bubbleDragon(ctx, cx, groundY, t = 0, o = {}) {
    const puff = o.puff || 0, facing = o.facing || 1, mood = o.mood || 'happy';
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.scale(facing, 1);

    const flap = Math.sin(t * 5) * 0.35;

    // curly tail, behind the body
    flFill(ctx, '#3fb8a8');
    ctx.save(); ctx.translate(-70, -20);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-30, -6, -34, -26);
    ctx.quadraticCurveTo(-36, -44, -18, -46);
    ctx.quadraticCurveTo(-6, -47, -10, -34);
    ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.strokeStyle = '#3fb8a8'; ctx.stroke();
    ctx.restore();

    // stubby legs
    flFill(ctx, '#3fb8a8');
    for (const sd of [-1, 1]) flEllipse(ctx, sd * 40, -14, 16, 14);
    flFill(ctx, '#bff2e6');
    for (const sd of [-1, 1]) flEllipse(ctx, sd * 40, -8, 9, 6);

    // big belly / body
    flFill(ctx, flVGrad(ctx, 0, -170, 0, -10, ['#5fe0cf', '#3fb8a8']));
    flEllipse(ctx, 0, -80, 92, 74);
    ctx.strokeStyle = '#2c8a7e'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(0, -80, 92, 74, 0, 0, TAU); ctx.stroke();
    flFill(ctx, '#c9f5ea');
    flEllipse(ctx, -4, -60, 54, 44);

    // three soft spikes on the back
    flFill(ctx, '#3fb8a8');
    for (let i = 0; i < 3; i++) flCircle(ctx, -46 + i * 26, -146 - i * 4, 15 - i * 1.5);

    // tiny useless wings, flapping — stick out the sides near the upper back
    for (const sd of [-1, 1]) {
      ctx.save();
      ctx.translate(sd * 66, -112);
      ctx.rotate(sd * (0.4 + flap));
      flFill(ctx, '#5fe0cf');
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.quadraticCurveTo(sd * 22, -8, sd * 18, -30); ctx.quadraticCurveTo(sd * 6, -16, 0, 0);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2c8a7e'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }

    // raised snout toward (80,-140), mouth opens with puff
    const tipX = 80, tipY = -140;
    const baseX = 30, baseY = -108;
    flFill(ctx, '#5fe0cf');
    ctx.beginPath();
    ctx.moveTo(baseX - 20, baseY + 14);
    ctx.quadraticCurveTo((baseX + tipX) / 2 - 6, (baseY + tipY) / 2, tipX - 14, tipY);
    ctx.lineTo(tipX + 14, tipY);
    ctx.quadraticCurveTo((baseX + tipX) / 2 + 18, (baseY + tipY) / 2, baseX + 26, baseY + 18);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2c8a7e'; ctx.lineWidth = 3; ctx.stroke();
    // mouth opening ("o" that grows with puff)
    flFill(ctx, '#ff8fa3');
    flCircle(ctx, tipX, tipY, 8 + puff * 10);
    if (puff > 0.05) { flFill(ctx, 'rgba(255,255,255,0.55)'); flCircle(ctx, tipX - 3, tipY - 3, (8 + puff * 10) * 0.4); }

    // head bump behind the snout base
    flFill(ctx, '#5fe0cf');
    flCircle(ctx, 14, -128, 36);
    ctx.strokeStyle = '#2c8a7e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(14, -128, 36, 0, TAU); ctx.stroke();
    // cheek puff while blowing
    if (puff > 0.05) flCheeks(ctx, 6, -118, 10, 22, 0.6 + puff);

    // googly, slightly crossed eyes (pupils turned IN toward the nose)
    for (const sd of [-1, 1]) {
      const ex = 14 + sd * 14, ey = -136;
      flFill(ctx, '#fff'); flCircle(ctx, ex, ey, 10);
      flFill(ctx, '#3a2a3a'); flCircle(ctx, ex - sd * 4, ey + 2, 5.2);
      flFill(ctx, '#fff'); flCircle(ctx, ex - sd * 4 + 1.5, ey - 2, 1.8);
    }

    // tongue, hanging out of the bubble-mouth at the snout tip
    ctx.save(); ctx.translate(tipX - 6, tipY + 12); ctx.rotate(0.7);
    flFill(ctx, '#ff6f8f');
    flEllipse(ctx, 0, 0, 6, 13);
    ctx.restore();

    ctx.restore();
  },

  // ---------------------------------------------------------------- 6
  // small playful robot, ~56w x 72h, feet on groundY.
  raceBot(ctx, cx, groundY, t = 0, o = {}) {
    const run = o.run || 0, facing = o.facing || 1, mood = o.mood || 'idle';
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.scale(facing, 1);
    ctx.rotate(run * 0.12);

    const pump = Math.sin(t * 12) * run;

    // wheel-feet
    flFill(ctx, '#5a6a86');
    for (const sd of [-1, 1]) flCircle(ctx, sd * 10 + pump * 3 * sd, -8, 9);
    flFill(ctx, '#c9d4e6');
    for (const sd of [-1, 1]) flCircle(ctx, sd * 10 + pump * 3 * sd, -8, 3.5);

    // body
    flFill(ctx, flVGrad(ctx, 0, -46, 0, -14, ['#dfe8f7', '#aebfdc']));
    rr(ctx, -17, -46, 34, 34, 10); ctx.fill();
    ctx.strokeStyle = '#6d7fa0'; ctx.lineWidth = 3;
    rr(ctx, -17, -46, 34, 34, 10); ctx.stroke();
    // chest light
    flFill(ctx, mood === 'happy' ? '#7fe08a' : '#ffe14d');
    flCircle(ctx, 0, -30, 5);

    // rubber-band spring arms
    const armUp = mood === 'happy';
    for (const sd of [-1, 1]) {
      if (mood === 'wait' && sd === 1) {
        // hand on hip
        flLimb(ctx, sd * 16, -40, sd * 22, -32, sd * 14, -26, 6, '#aebfdc');
      } else {
        const ex = sd * (16 + (armUp ? 4 : 0));
        const ey1 = armUp ? -54 : -34;
        const ey2 = armUp ? -66 : -24;
        ctx.strokeStyle = '#8a9ab8'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sd * 16, -40);
        for (let i = 1; i <= 3; i++) {
          const zx = sd * 16 + (ex - sd * 16) * (i / 3) + (i % 2 ? sd * 5 : -sd * 5);
          const zy = -40 + (ey1 - -40) * (i / 3);
          ctx.lineTo(zx, zy);
        }
        ctx.stroke();
        flPad(ctx, ex, ey1, 6, '#5a6a86');
      }
    }
    if (mood === 'wait') {
      // looking back over the shoulder
      flFill(ctx, '#dfe8f7');
      flCircle(ctx, -6, -68, 15);
    } else {
      flFill(ctx, '#dfe8f7');
      flCircle(ctx, 0, -66, 15);
    }
    ctx.strokeStyle = '#6d7fa0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(mood === 'wait' ? -6 : 0, -66, 15, 0, TAU); ctx.stroke();

    // blinking antenna light
    flFill(ctx, '#8a9ab8'); rr(ctx, -1.5, -84, 3, 10, 1.5); ctx.fill();
    const blink = 0.6 + 0.4 * Math.sin(t * 8);
    flFill(ctx, `rgba(255,214,74,${blink.toFixed(2)})`);
    flCircle(ctx, 0, -86, 5);

    const faceMood = mood === 'oops' ? 'dizzy' : (mood === 'wait' ? 'happy' : (mood === 'happy' ? 'grin' : 'happy'));
    drawFace(ctx, mood === 'wait' ? -6 : 0, -66, 20, faceMood, t, 6, mood === 'wait' ? -0.6 : 0);

    if (mood === 'oops') {
      flFill(ctx, 'rgba(180,180,190,0.55)');
      flCircle(ctx, 16, -90, 8); flCircle(ctx, 24, -100, 6); flCircle(ctx, 10, -100, 5);
    }
    ctx.restore();
  },

  // ---------------------------------------------------------------- 7
  // friendly pirate captain, ~64w x 116h, feet on groundY.
  captain(ctx, cx, groundY, t = 0, o = {}) {
    const mood = o.mood || 'happy', facing = o.facing || 1;
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.scale(facing, 1);

    // peg leg + boot
    flFill(ctx, '#c9a06a'); rr(ctx, -14, -22, 9, 22, 3); ctx.fill();
    flFill(ctx, '#3a2a2a'); flEllipse(ctx, 10, -4, 12, 7);
    flFill(ctx, '#c9a06a'); rr(ctx, 5, -30, 10, 26, 3); ctx.fill();

    // striped shirt torso
    flFill(ctx, '#fff2e6'); rr(ctx, -18, -70, 36, 42, 10); ctx.fill();
    flFill(ctx, '#d64a3a');
    for (let i = 0; i < 4; i++) { rr(ctx, -18, -68 + i * 10, 36, 5, 2); ctx.fill(); }
    // blue open coat
    flFill(ctx, '#2f5fb0');
    ctx.beginPath();
    ctx.moveTo(-20, -72); ctx.quadraticCurveTo(-28, -40, -22, -24); ctx.lineTo(-12, -26); ctx.quadraticCurveTo(-16, -50, -10, -72); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(20, -72); ctx.quadraticCurveTo(28, -40, 22, -24); ctx.lineTo(12, -26); ctx.quadraticCurveTo(16, -50, 10, -72); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1f3f7a'; ctx.lineWidth = 2;
    // gold buttons
    flFill(ctx, '#ffd24a');
    for (let i = 0; i < 3; i++) flCircle(ctx, 0, -62 + i * 9, 2.4);

    // arm on hip
    flLimb(ctx, -18, -60, -28, -46, -18, -36, 10, '#2f5fb0');
    flPad(ctx, -18, -36, 7, '#f0c8a0');
    flLimb(ctx, 18, -60, 26, -44, 20, -30, 10, '#2f5fb0');
    flPad(ctx, 20, -30, 7, '#f0c8a0');

    // green parrot on the shoulder
    ctx.save(); ctx.translate(-22, -80);
    flFill(ctx, '#3fbf5a'); flEllipse(ctx, 0, 0, 10, 8);
    flFill(ctx, '#2f9a48'); flEllipse(ctx, -6, 4, 6, 4);
    flFill(ctx, '#ffa93c'); ctx.beginPath(); ctx.moveTo(8, -1); ctx.lineTo(15, 1); ctx.lineTo(8, 3); ctx.closePath(); ctx.fill();
    drawFace(ctx, 2, -3, 9, 'happy', t, 7);
    ctx.restore();

    // head + big curly mustache
    const headY = -86;
    flFill(ctx, '#f0c8a0'); flCircle(ctx, 0, headY, 22);
    flFill(ctx, '#8a5a2a');
    for (const sd of [-1, 1]) {
      ctx.save(); ctx.translate(sd * 8, headY + 8); ctx.rotate(sd * 0.15);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(sd * 14, -2, sd * 18, 4);
      ctx.quadraticCurveTo(sd * 20, 8, sd * 12, 6);
      ctx.quadraticCurveTo(sd * 6, 5, 0, 2);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    drawFace(ctx, 0, headY - 2, 30, mood, t, 8);

    // tricorn hat with a skull-with-hearts patch
    flFill(ctx, '#241a2e');
    ctx.beginPath();
    ctx.moveTo(-28, headY - 12);
    ctx.quadraticCurveTo(0, headY - 44, 28, headY - 12);
    ctx.quadraticCurveTo(10, headY - 20, 0, headY - 14);
    ctx.quadraticCurveTo(-10, headY - 20, -28, headY - 12);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#140e1a'; ctx.lineWidth = 2; ctx.stroke();
    // happy skull-with-hearts patch
    flFill(ctx, '#fff6ea'); flCircle(ctx, 0, headY - 24, 7);
    flFill(ctx, '#ff6f8f'); flCircle(ctx, -2.6, headY - 26, 2); flCircle(ctx, 2.6, headY - 26, 2);
    ctx.strokeStyle = '#3a2a3a'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, headY - 22, 3, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();

    ctx.restore();
  },

  // ---------------------------------------------------------------- 8
  // chunky shiny gold bar, centered at (cx, cy), width ~s*1.6.
  goldBar(ctx, cx, cy, s = 40, t = 0) {
    ctx.save();
    ctx.translate(cx, cy);
    const w = s * 1.6, wTop = s * 1.3, h = s * 0.5, depth = s * 0.2;
    // top face (3D illusion)
    flFill(ctx, '#fff0b0');
    ctx.beginPath();
    ctx.moveTo(-wTop / 2, -h / 2 - depth);
    ctx.lineTo(wTop / 2, -h / 2 - depth);
    ctx.lineTo(w / 2, -h / 2);
    ctx.lineTo(-w / 2, -h / 2);
    ctx.closePath(); ctx.fill();
    // front face (trapezoid)
    flFill(ctx, flVGrad(ctx, 0, -h / 2, 0, h / 2, ['#ffe14d', '#e8a020']));
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(wTop / 2 + (w - wTop) * 0.12, h / 2); ctx.lineTo(-wTop / 2 - (w - wTop) * 0.12, h / 2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a86a1a'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-wTop / 2, -h / 2 - depth); ctx.lineTo(wTop / 2, -h / 2 - depth); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(-w / 2, -h / 2); ctx.closePath();
    ctx.stroke();
    // highlight streak
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, -h / 2 + 3); ctx.lineTo(-w * 0.16, -h / 2 + 3); ctx.lineTo(-w * 0.24, h / 2 - 3); ctx.lineTo(-w * 0.36, h / 2 - 3);
    ctx.closePath(); ctx.fill();
    // sparkle
    const sp = 0.6 + 0.4 * Math.sin(t * 6);
    ctx.save(); ctx.globalAlpha = sp; ctx.fillStyle = '#fff';
    starPath(ctx, w * 0.3, -h / 2 - depth * 0.6, 6, 2.5, 4);
    ctx.fill(); ctx.restore();
    // tiny happy face
    drawFace(ctx, 0, 1, s * 0.4, 'happy', t, 9);
    ctx.restore();
  },

  // ---------------------------------------------------------------- 9
  // glossy soap bubble, no face.
  bubble(ctx, cx, cy, r, t = 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffffff';
    flCircle(ctx, 0, 0, r);
    ctx.globalAlpha = 1;
    // rainbow-tinted rim
    const g = ctx.createLinearGradient(-r, -r, r, r);
    RAINBOW.forEach((c, i) => g.addColorStop(i / (RAINBOW.length - 1), c));
    ctx.strokeStyle = g; ctx.globalAlpha = 0.5; ctx.lineWidth = Math.max(1.5, r * 0.09);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.94, 0, TAU); ctx.stroke();
    // highlight crescent
    ctx.globalAlpha = 0.7; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.34, r * 0.32, 0, TAU); ctx.fill();
    ctx.restore();
  },
};
