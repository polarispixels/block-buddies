'use strict';
// DINO_ART: creature + cinematic art for THE GREAT DINOSAUR RESCUE
// (docs/superpowers/specs/2026-09-04-great-dinosaur-rescue-design.md)
//
// Pure procedural canvas drawing, no game-state reads (arguments only). Every
// function does its own ctx.save()/restore(). World-space: callers pass
// world x/y; groundY = the feet line. `facing` (+1/-1) mirrors the creature
// left/right about cx via a local (0,0)=feet-at-groundY coordinate frame
// where local +x is "forward" and local -y is "up".
//
// House style match: js/levels.js drawDecor's jungle branch (d.longnecks,
// d.trike, d.trex — the grown-up cousins of these babies) and js/entities.js
// FireBreather (the fire dino) — big funny faces via drawFace, chunky solid
// fills with a darker outline stroke, tiny comic-proportioned limbs. The
// crash cinematic reuses the SAME pod as js/stationart.js's crashedPod /
// escapeScene (ST_ART, stHalo, stStarField, hash2 are globals from the
// already-loaded stationart.js/util.js and are reused directly here).
const DINO_ART = (function () {

  // ---------------------------------------------------------------- palettes
  // Kept close to the existing adult decor in levels.js (trike orange/gold,
  // longneck teal, T-Rex green) so the babies read as their kids; anky/ptero
  // are new but pick companion tones from the same jungle family.
  const PAL = {
    trike:    { c: '#f2b04a', c2: '#c2831a', frill: '#ffd24a', horn: '#fff6e0', belly: '#ffe3ad' },
    longneck: { c: '#57c2b0', c2: '#2f8a80', belly: '#dafff2' },
    anky:     { c: '#b0803e', c2: '#7a5220', plate: '#e0aa5e', belly: '#f2ddb0' },
    ptero:    { c: '#ff8fb0', c2: '#d1527a', wing: '#ffc3d7', belly: '#ffe3ec' },
    fire:     { c: '#ff8a4a', c2: '#c2451a', belly: '#ffe9c0', flame: ['#ff6b35', '#ff9f43', '#ffe156'] },
    rex:      { c: '#7bbf5a', c2: '#4a8a34' }
  };

  // ---------------------------------------------------------------- helpers
  function mir(ctx, cx, groundY, facing, fn) {
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.scale(facing < 0 ? -1 : 1, 1);
    fn();
    ctx.restore();
  }
  function legPair(ctx, xs, topY, footY, lw, color, phase, amp) {
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(40,26,16,0.35)';
    ctx.lineWidth = Math.max(1.5, lw * 0.12);
    for (let i = 0; i < xs.length; i++) {
      const lx = xs[i];
      const lift = amp ? Math.max(0, Math.sin(phase + i * Math.PI)) * amp : 0;
      rr(ctx, lx - lw / 2, topY, lw, Math.max(2, (footY - lift) - topY), lw * 0.42);
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(lx, footY - lift, lw * 0.42, lw * 0.2, 0, 0, TAU); ctx.fill(); ctx.stroke();
    }
  }
  function faceMoodFor(mood) {
    if (mood === 'happy') return 'grin';
    if (mood === 'scared') return 'surprised';
    if (mood === 'sleep') return 'sleepy';
    if (mood === 'stuck') return 'sad';
    if (mood === 'roar' || mood === 'charge' || mood === 'smash') return 'angry';
    if (mood === 'breathe') return 'surprised';
    return 'happy';
  }
  function mouthOverlay(ctx, mx, my, s, mood, k, t) {
    if (mood === 'munch') {
      const chew = Math.abs(Math.sin((k || t) * 10));
      ctx.fillStyle = '#6b3345';
      ctx.beginPath(); ctx.ellipse(mx, my + s * 0.02, s * 0.09, s * 0.04 + chew * s * 0.05, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8fd85a';
      ctx.beginPath(); ctx.arc(mx + s * 0.05, my, s * 0.045, 0, TAU); ctx.fill();
    } else if (mood === 'spit') {
      ctx.strokeStyle = '#ff5a6a'; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + s * 0.24, my + s * 0.1); ctx.stroke();
      ctx.fillStyle = '#c2451a';
      ctx.beginPath(); ctx.arc(mx + s * 0.36, my + s * 0.16, s * 0.06, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8a2e10'; ctx.lineWidth = s * 0.012; ctx.stroke();
    } else if (mood === 'sneeze') {
      if (k < 0.5) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(mx - s * 0.02, my - s * 0.1, s * 0.03, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = '#8fd85a';
        for (const a of [-0.35, 0, 0.35]) {
          ctx.beginPath();
          ctx.ellipse(mx + Math.cos(a) * s * 0.32, my + Math.sin(a) * s * 0.2, s * 0.07, s * 0.035, a, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  // ================================================================ BABIES
  function babyTrike(ctx, s, t, mood, k, pal) {
    const shiver = mood === 'scared' ? Math.sin(t * 40) * s * 0.02 : 0;
    const bob = mood === 'walk' ? Math.sin(t * 8) * s * 0.02 : Math.sin(t * 2.4) * s * 0.015;
    const hop = mood === 'happy' ? Math.abs(Math.sin(t * 6)) * s * 0.16 : 0;
    const puff = mood === 'inflate' ? 1 + k * 0.55 : 1;
    const charging = mood === 'charge';
    ctx.save();
    ctx.translate(shiver, -hop);
    const legTop = -s * 0.20, legFoot = 0, legW = s * 0.15;
    const fast = mood === 'walk' || mood === 'charge';
    const legPhase = fast ? t * (charging ? 16 : 8) : 0, legAmp = fast ? s * (charging ? 0.09 : 0.05) : 0;
    if (mood !== 'stuck') legPair(ctx, [-s * 0.16, s * 0.10], legTop, legFoot, legW, pal.c2, legPhase, legAmp);
    if (mood !== 'stuck') {
      ctx.strokeStyle = pal.c; ctx.lineWidth = s * 0.11; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-s * 0.28, legTop - s * 0.04);
      ctx.quadraticCurveTo(-s * 0.44, legTop - s * 0.02 + bob, -s * 0.5, legTop - s * 0.12);
      ctx.stroke();
    }
    const bx = 0, by = legTop - s * 0.16 * puff + bob;
    if (mood !== 'stuck') {
      ctx.fillStyle = pal.c;
      ctx.beginPath(); ctx.ellipse(bx, by, s * 0.32 * puff, s * 0.24 * puff, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.03; ctx.stroke();
      ctx.fillStyle = pal.belly;
      ctx.beginPath(); ctx.ellipse(bx, by + s * 0.08, s * 0.2 * puff, s * 0.12 * puff, 0, 0, TAU); ctx.fill();
    } else {
      legPair(ctx, [s * 0.06], legTop, legFoot, legW, pal.c2, 0, 0);
    }
    const leanX = charging ? s * 0.08 : 0, leanY = charging ? s * 0.05 : 0;
    const hx = s * 0.30 + leanX, hy = by - s * 0.24 * puff + leanY;
    const hr = s * 0.28;
    ctx.fillStyle = pal.frill;
    ctx.beginPath(); ctx.arc(hx - s * 0.02, hy - s * 0.02, hr * 1.15, -1.9, 1.15); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.025; ctx.stroke();
    ctx.fillStyle = pal.c;
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.c2; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hx + hr * 0.7, hy + hr * 0.2, hr * 0.5, hr * 0.36, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.horn;
    for (const ox of [-0.12, 0.12]) {
      ctx.beginPath();
      ctx.moveTo(hx + ox * hr * 2 - hr * 0.08, hy - hr * 0.7);
      ctx.lineTo(hx + ox * hr * 2, hy - hr * 1.1);
      ctx.lineTo(hx + ox * hr * 2 + hr * 0.08, hy - hr * 0.7);
      ctx.closePath(); ctx.fill();
    }
    drawFace(ctx, hx, hy, hr * 0.72, faceMoodFor(mood), t, 11, 1, 0);
    mouthOverlay(ctx, hx + hr * 0.9, hy + hr * 0.25, s, mood, k, t);
    ctx.restore();
  }

  function babyLongneck(ctx, s, t, mood, k, pal) {
    const shiver = mood === 'scared' ? Math.sin(t * 40) * s * 0.02 : 0;
    const bob = mood === 'walk' ? Math.sin(t * 8) * s * 0.02 : Math.sin(t * 2.2) * s * 0.015;
    const hop = mood === 'happy' ? Math.abs(Math.sin(t * 6)) * s * 0.16 : 0;
    const puff = mood === 'inflate' ? 1 + k * 0.5 : 1;
    const reach = mood === 'reach' ? clamp(k, 0, 1) : 0;
    ctx.save();
    ctx.translate(shiver, -hop);
    const legTop = -s * 0.20, legFoot = 0, legW = s * 0.14;
    const fast = mood === 'walk' || mood === 'charge';
    const legPhase = fast ? t * 8 : 0, legAmp = fast ? s * 0.05 : 0;
    if (mood !== 'stuck') legPair(ctx, [-s * 0.14, s * 0.12], legTop, legFoot, legW, pal.c2, legPhase, legAmp);
    if (mood !== 'stuck') {
      ctx.strokeStyle = pal.c; ctx.lineWidth = s * 0.1; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-s * 0.26, legTop - s * 0.02);
      ctx.quadraticCurveTo(-s * 0.42, legTop + bob, -s * 0.48, legTop - s * 0.1);
      ctx.stroke();
    }
    const bx = 0, by = legTop - s * 0.16 * puff + bob;
    if (mood !== 'stuck') {
      ctx.fillStyle = pal.c;
      ctx.beginPath(); ctx.ellipse(bx, by, s * 0.3 * puff, s * 0.22 * puff, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.03; ctx.stroke();
      ctx.fillStyle = pal.belly;
      ctx.beginPath(); ctx.ellipse(bx, by + s * 0.06, s * 0.18 * puff, s * 0.1 * puff, 0, 0, TAU); ctx.fill();
    } else {
      legPair(ctx, [s * 0.06], legTop, legFoot, legW, pal.c2, 0, 0);
    }
    const neckLen = lerp(s * 0.42, s * 1.35, reach);
    const hx = s * 0.16 + reach * s * 0.06, hy = by - s * 0.16 - neckLen;
    ctx.strokeStyle = pal.c; ctx.lineWidth = s * 0.17; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.14, by - s * 0.14);
    ctx.quadraticCurveTo(s * 0.1, by - s * 0.14 - neckLen * 0.6, hx, hy);
    ctx.stroke();
    const hr = s * 0.22;
    ctx.fillStyle = pal.c;
    ctx.beginPath(); ctx.ellipse(hx + hr * 0.3, hy, hr, hr * 0.8, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.02; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hx + hr * 1.15, hy + hr * 0.15, hr * 0.45, hr * 0.3, 0, 0, TAU); ctx.fill(); ctx.stroke();
    drawFace(ctx, hx + hr * 0.25, hy, hr * 0.65, faceMoodFor(mood), t, 22, 1, 0);
    mouthOverlay(ctx, hx + hr * 1.3, hy + hr * 0.2, s, mood, k, t);
    ctx.restore();
  }

  function babyAnky(ctx, s, t, mood, k, pal) {
    const shiver = mood === 'scared' ? Math.sin(t * 40) * s * 0.02 : 0;
    const bob = mood === 'walk' ? Math.sin(t * 8) * s * 0.02 : Math.sin(t * 2) * s * 0.015;
    const hop = mood === 'happy' ? Math.abs(Math.sin(t * 6)) * s * 0.16 : 0;
    const puff = mood === 'inflate' ? 1 + k * 0.5 : 1;
    const smash = mood === 'smash' ? clamp(k, 0, 1) : 0;
    ctx.save();
    ctx.translate(shiver, -hop);
    const legTop = -s * 0.18, legFoot = 0, legW = s * 0.1;
    const fast = mood === 'walk' || mood === 'charge';
    const legPhase = fast ? t * 8 : 0, legAmp = fast ? s * 0.04 : 0;
    if (mood !== 'stuck') legPair(ctx, [-s * 0.24, -s * 0.02, s * 0.2, s * 0.4], legTop, legFoot, legW, pal.c2, legPhase, legAmp);
    const bx = s * 0.06, by = legTop - s * 0.2 * puff + bob;
    if (mood !== 'stuck') {
      ctx.fillStyle = pal.c;
      ctx.beginPath(); ctx.ellipse(bx, by, s * 0.42 * puff, s * 0.24 * puff, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.03; ctx.stroke();
      ctx.fillStyle = pal.plate;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.ellipse(bx + i * s * 0.14, by - s * 0.16 * puff, s * 0.08, s * 0.06, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.015; ctx.stroke();
      }
      const swing = smash ? Math.sin(smash * Math.PI) * 0.9 : Math.sin(t * 2) * 0.08;
      ctx.save();
      ctx.translate(bx - s * 0.4, by + s * 0.02);
      ctx.rotate(-0.5 + swing);
      ctx.strokeStyle = pal.c; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s * 0.34, s * 0.02); ctx.stroke();
      ctx.fillStyle = pal.plate;
      ctx.beginPath(); ctx.arc(-s * 0.36, s * 0.02, s * 0.11, 0, TAU); ctx.fill();
      ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.02; ctx.stroke();
      ctx.restore();
    } else {
      legPair(ctx, [s * 0.1], legTop, legFoot, legW, pal.c2, 0, 0);
    }
    const hx = s * 0.4, hy = by - s * 0.06;
    const hr = s * 0.24;
    ctx.fillStyle = pal.c;
    ctx.beginPath(); ctx.ellipse(hx, hy, hr, hr * 0.82, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.025; ctx.stroke();
    drawFace(ctx, hx, hy, hr * 0.68, faceMoodFor(mood), t, 33, 1, 0);
    mouthOverlay(ctx, hx + hr * 0.85, hy + hr * 0.25, s, mood, k, t);
    ctx.restore();
  }

  function babyPtero(ctx, s, t, mood, k, pal) {
    const shiver = mood === 'scared' ? Math.sin(t * 40) * s * 0.02 : 0;
    const isFly = mood === 'fly';
    const flap = isFly ? Math.sin(t * 14) : 0;
    const lift = isFly ? s * 0.3 + Math.sin(t * 6) * s * 0.05 : 0;
    const hop = mood === 'happy' ? Math.abs(Math.sin(t * 6)) * s * 0.16 : 0;
    const puff = mood === 'inflate' ? 1 + k * 0.5 : 1;
    ctx.save();
    ctx.translate(shiver, -hop - lift);
    const legTop = -s * 0.14, legFoot = 0, legW = s * 0.09;
    if (mood !== 'stuck' && !isFly) legPair(ctx, [-s * 0.08, s * 0.1], legTop, legFoot, legW, pal.c2, 0, 0);
    const bx = 0, by = legTop - s * 0.14 * puff;
    if (mood !== 'stuck') {
      ctx.fillStyle = pal.c;
      ctx.beginPath(); ctx.ellipse(bx, by, s * 0.24 * puff, s * 0.2 * puff, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.025; ctx.stroke();
      for (const sd of [-1, 1]) {
        // gull-wing silhouette: tip always rises clearly above the body
        // when flying (flap just raises/lowers it), folds down beside the
        // body at rest — never a flat bar straight through the body
        const flap = isFly ? Math.sin(t * 10 + (sd > 0 ? 0 : Math.PI)) : 0;
        const len = isFly ? s * 0.95 : s * 0.3;
        const baseY = by - s * 0.1;
        const tipY = isFly ? baseY - s * 0.35 - flap * s * 0.22 : baseY + s * 0.22;
        const midY = isFly ? baseY - s * 0.12 - flap * s * 0.1 : baseY + s * 0.1;
        ctx.fillStyle = pal.wing;
        ctx.beginPath();
        ctx.moveTo(bx + sd * s * 0.04, baseY);
        ctx.quadraticCurveTo(bx + sd * len * 0.55, midY, bx + sd * len, tipY);
        ctx.quadraticCurveTo(bx + sd * len * 0.35, baseY + s * 0.14, bx + sd * s * 0.06, baseY + s * 0.1);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.02; ctx.stroke();
      }
    } else {
      legPair(ctx, [s * 0.06], legTop, legFoot, legW, pal.c2, 0, 0);
    }
    const hx = s * 0.24, hy = by - s * 0.2;
    const hr = s * 0.2;
    ctx.fillStyle = pal.c;
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.02; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx + hr * 0.7, hy); ctx.lineTo(hx + hr * 1.6, hy + hr * 0.1); ctx.lineTo(hx + hr * 0.7, hy + hr * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.c2;
    ctx.beginPath(); ctx.moveTo(hx - hr * 0.3, hy - hr * 0.8); ctx.quadraticCurveTo(hx + hr * 0.1, hy - hr * 1.6, hx + hr * 0.5, hy - hr * 0.9); ctx.closePath(); ctx.fill();
    drawFace(ctx, hx, hy, hr * 0.65, faceMoodFor(mood), t, 44, 1, 0);
    mouthOverlay(ctx, hx + hr * 1.1, hy + hr * 0.2, s, mood, k, t);
    ctx.restore();
  }

  function babyFire(ctx, s, t, mood, k, pal) {
    const shiver = mood === 'scared' ? Math.sin(t * 40) * s * 0.02 : 0;
    const bob = mood === 'walk' ? Math.sin(t * 8) * s * 0.02 : Math.sin(t * 2.6) * s * 0.015;
    const hop = mood === 'happy' ? Math.abs(Math.sin(t * 6)) * s * 0.16 : 0;
    const puff = mood === 'inflate' ? 1 + k * 0.5 : (mood === 'breathe' ? 1 + k * 0.18 : 1);
    const charging = mood === 'charge';
    ctx.save();
    ctx.translate(shiver, -hop);
    const legTop = -s * 0.18, legFoot = 0, legW = s * 0.15;
    const fast = mood === 'walk' || mood === 'charge';
    const legPhase = fast ? t * (charging ? 16 : 8) : 0, legAmp = fast ? s * (charging ? 0.09 : 0.05) : 0;
    if (mood !== 'stuck') legPair(ctx, [-s * 0.14, s * 0.1], legTop, legFoot, legW, pal.c2, legPhase, legAmp);
    if (mood !== 'stuck') {
      ctx.strokeStyle = pal.c; ctx.lineWidth = s * 0.1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-s * 0.26, legTop - s * 0.02); ctx.quadraticCurveTo(-s * 0.44, legTop + bob, -s * 0.5, legTop - s * 0.1); ctx.stroke();
    }
    const bx = 0, by = legTop - s * 0.18 * puff + bob;
    if (mood !== 'stuck') {
      ctx.fillStyle = pal.c;
      ctx.beginPath(); ctx.ellipse(bx, by, s * 0.3 * puff, s * 0.24 * puff, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.03; ctx.stroke();
      ctx.fillStyle = pal.belly;
      ctx.beginPath(); ctx.ellipse(bx + s * 0.04, by + s * 0.06, s * 0.18 * puff, s * 0.1 * puff, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.c2;
      for (let i = 0; i < 3; i++) {
        const sx = bx - s * (0.02 + i * 0.12);
        ctx.beginPath(); ctx.moveTo(sx - s * 0.05, by - s * 0.2 * puff); ctx.lineTo(sx, by - s * 0.3 * puff); ctx.lineTo(sx + s * 0.05, by - s * 0.2 * puff); ctx.closePath(); ctx.fill();
      }
    } else {
      legPair(ctx, [s * 0.06], legTop, legFoot, legW, pal.c2, 0, 0);
    }
    const hx = s * 0.28, hy = by - s * 0.2 * puff;
    const hr = s * 0.24;
    const inhale = mood === 'breathe' ? Math.min(1, k * 1.4) : 0;
    ctx.fillStyle = pal.c;
    ctx.beginPath(); ctx.arc(hx, hy, hr * (1 + inhale * 0.15), 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.025; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hx + hr * 0.75, hy + hr * 0.2, hr * 0.42, hr * 0.3, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.flame[1];
    const tuftH = hr * (0.5 + 0.15 * Math.sin(t * 9));
    ctx.beginPath();
    ctx.moveTo(hx - hr * 0.15, hy - hr * 0.85);
    ctx.quadraticCurveTo(hx, hy - hr * 0.85 - tuftH, hx + hr * 0.15, hy - hr * 0.68);
    ctx.quadraticCurveTo(hx + hr * 0.05, hy - hr * 0.7, hx - hr * 0.15, hy - hr * 0.85);
    ctx.closePath(); ctx.fill();
    if (inhale > 0) {
      ctx.fillStyle = pal.belly;
      ctx.beginPath(); ctx.arc(hx + hr * 0.35, hy + hr * 0.3, hr * (0.22 + inhale * 0.35), 0, TAU); ctx.fill();
      ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.012; ctx.stroke();
    }
    drawFace(ctx, hx, hy, hr * 0.68, faceMoodFor(mood), t, 55, 1, 0);
    mouthOverlay(ctx, hx + hr * 0.9, hy + hr * 0.25, s, mood, k, t);
    if (mood === 'breathe' && k > 0.15) {
      const len = s * 1.6 * Math.min(1, (k - 0.15) / 0.85);
      for (let fx = 0; fx < len; fx += s * 0.18) {
        const wob = Math.sin(t * 20 + fx * 0.3) * s * 0.04;
        ctx.fillStyle = pal.flame[Math.floor((fx / (s * 0.18) + t * 8) % 3)];
        ctx.beginPath(); ctx.arc(hx + hr * 1.1 + fx, hy + hr * 0.15 + wob, s * 0.1 + Math.sin(fx * 0.1 + t * 10) * s * 0.02, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  function baby(ctx, kind, cx, groundY, s, t = 0, o = {}) {
    const mood = o.mood || 'idle', facing = o.facing || 1, k = o.k || 0;
    const pal = PAL[kind];
    if (!pal) return;
    mir(ctx, cx, groundY, facing, () => {
      if (kind === 'trike') babyTrike(ctx, s, t, mood, k, pal);
      else if (kind === 'longneck') babyLongneck(ctx, s, t, mood, k, pal);
      else if (kind === 'anky') babyAnky(ctx, s, t, mood, k, pal);
      else if (kind === 'ptero') babyPtero(ctx, s, t, mood, k, pal);
      else if (kind === 'fire') babyFire(ctx, s, t, mood, k, pal);
    });
  }

  // ================================================================ ADULTS
  // Each adultX returns a LOCAL {x,y} saddle point (relative to the mirrored
  // origin at the creature's feet/groundY); adult() converts it to world
  // space. Every adult returns a saddle so the game can seat Jack on any of
  // them, even though only the longneck is actually ridden today.
  function adultTrike(ctx, s, t, mood, k, pal) {
    const bob = mood === 'walk' ? Math.sin(t * 5) * s * 0.015 : Math.sin(t * 1.4) * s * 0.008;
    const hop = mood === 'happy' ? Math.abs(Math.sin(t * 5)) * s * 0.06 : 0;
    ctx.save(); ctx.translate(0, -hop);
    const legTop = -s * 0.46, legFoot = 0, legW = s * 0.13;
    const legPhase = mood === 'walk' ? t * 5 : 0, legAmp = mood === 'walk' ? s * 0.03 : 0;
    legPair(ctx, [-s * 0.28, -s * 0.06, s * 0.14, s * 0.34], legTop, legFoot, legW, pal.c2, legPhase, legAmp);
    ctx.strokeStyle = pal.c; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.4, legTop - s * 0.02); ctx.quadraticCurveTo(-s * 0.56, legTop + bob, -s * 0.62, legTop - s * 0.1); ctx.stroke();
    const bx = 0, by = legTop - s * 0.2 + bob;
    ctx.fillStyle = pal.c;
    ctx.beginPath(); ctx.ellipse(bx, by, s * 0.42, s * 0.26, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.025; ctx.stroke();
    ctx.fillStyle = pal.belly;
    ctx.beginPath(); ctx.ellipse(bx, by + s * 0.08, s * 0.26, s * 0.12, 0, 0, TAU); ctx.fill();
    const hx = s * 0.4, hy = by - s * 0.18;
    const hr = s * 0.2;
    ctx.fillStyle = pal.frill;
    ctx.beginPath(); ctx.arc(hx - s * 0.02, hy - s * 0.02, hr * 1.2, -1.9, 1.15); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.02; ctx.stroke();
    ctx.fillStyle = pal.c;
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill(); ctx.strokeStyle = pal.c2; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hx + hr * 0.75, hy + hr * 0.2, hr * 0.5, hr * 0.36, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.horn;
    const bigHorn = mood === 'roar';
    for (const ox of [-0.14, 0.14]) {
      ctx.beginPath();
      ctx.moveTo(hx + ox * hr * 2 - hr * 0.09, hy - hr * 0.75);
      ctx.lineTo(hx + ox * hr * 2, hy - hr * (bigHorn ? 1.7 : 1.4));
      ctx.lineTo(hx + ox * hr * 2 + hr * 0.09, hy - hr * 0.75);
      ctx.closePath(); ctx.fill();
    }
    drawFace(ctx, hx, hy, hr * 0.7, faceMoodFor(mood), t, 111, 1, 0);
    ctx.restore();
    return { x: s * 0.02, y: by - s * 0.28 };
  }

  function adultLongneck(ctx, s, t, mood, k, pal) {
    const bob = mood === 'walk' ? Math.sin(t * 4) * s * 0.02 : Math.sin(t * 1.2) * s * 0.01;
    const hop = mood === 'happy' ? Math.abs(Math.sin(t * 5)) * s * 0.05 : 0;
    ctx.save(); ctx.translate(0, -hop);
    const legTop = -s * 0.5, legFoot = 0, legW = s * 0.12;
    const legPhase = mood === 'walk' ? t * 4 : 0, legAmp = mood === 'walk' ? s * 0.03 : 0;
    legPair(ctx, [-s * 0.26, -s * 0.06, s * 0.14, s * 0.32], legTop, legFoot, legW, pal.c2, legPhase, legAmp);
    ctx.strokeStyle = pal.c; ctx.lineWidth = s * 0.08; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.36, legTop); ctx.quadraticCurveTo(-s * 0.6, legTop + bob - s * 0.06, -s * 0.7, legTop - s * 0.24); ctx.stroke();
    const bx = 0, by = legTop - s * 0.22 + bob;
    ctx.fillStyle = pal.c;
    ctx.beginPath(); ctx.ellipse(bx, by, s * 0.4, s * 0.24, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.025; ctx.stroke();
    ctx.fillStyle = pal.c2;
    for (const p of [[-0.24, -0.08], [0.05, 0.06], [0.24, -0.1]]) {
      ctx.beginPath(); ctx.arc(bx + p[0] * s, by + p[1] * s, s * 0.05, 0, TAU); ctx.fill();
    }
    // neck rises to a fixed head height (~groundY - s*1.4, per spec) regardless
    // of body sway so the reach stays predictable for the ride mount
    const hx = s * 0.25, hy = -s * 1.4;
    ctx.strokeStyle = pal.c; ctx.lineWidth = s * 0.15; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.18, by - s * 0.16);
    ctx.quadraticCurveTo(s * 0.05, (by - s * 0.16 + hy) / 2 - s * 0.06, hx, hy);
    ctx.stroke();
    const hr = s * 0.13;
    ctx.fillStyle = pal.c;
    ctx.beginPath(); ctx.ellipse(hx + hr * 0.3, hy, hr, hr * 0.8, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.015; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hx + hr * 1.2, hy + hr * 0.15, hr * 0.5, hr * 0.32, 0, 0, TAU); ctx.fill(); ctx.stroke();
    drawFace(ctx, hx + hr * 0.25, hy, hr * 0.65, faceMoodFor(mood), t, 122, 1, 0);
    ctx.restore();
    return { x: 0, y: by - s * 0.16 };
  }

  function adultAnky(ctx, s, t, mood, k, pal) {
    const bob = mood === 'walk' ? Math.sin(t * 4) * s * 0.015 : Math.sin(t * 1.1) * s * 0.008;
    const hop = mood === 'happy' ? Math.abs(Math.sin(t * 5)) * s * 0.05 : 0;
    ctx.save(); ctx.translate(0, -hop);
    const legTop = -s * 0.4, legFoot = 0, legW = s * 0.11;
    const legPhase = mood === 'walk' ? t * 4 : 0, legAmp = mood === 'walk' ? s * 0.025 : 0;
    legPair(ctx, [-s * 0.3, -s * 0.02, s * 0.24, s * 0.48], legTop, legFoot, legW, pal.c2, legPhase, legAmp);
    const bx = s * 0.08, by = legTop - s * 0.24 + bob;
    ctx.fillStyle = pal.c;
    ctx.beginPath(); ctx.ellipse(bx, by, s * 0.5, s * 0.26, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.03; ctx.stroke();
    ctx.fillStyle = pal.plate;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath(); ctx.ellipse(bx + i * s * 0.12, by - s * 0.16, s * 0.075, s * 0.05, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.01; ctx.stroke();
    }
    const swing = mood === 'roar' ? Math.sin(t * 4) * 0.3 : Math.sin(t * 1.5) * 0.06;
    ctx.save();
    ctx.translate(bx - s * 0.48, by + s * 0.02);
    ctx.rotate(-0.4 + swing);
    ctx.strokeStyle = pal.c; ctx.lineWidth = s * 0.1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s * 0.4, s * 0.02); ctx.stroke();
    ctx.fillStyle = pal.plate;
    ctx.beginPath(); ctx.arc(-s * 0.42, s * 0.02, s * 0.13, 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.02; ctx.stroke();
    ctx.restore();
    const hx = s * 0.46, hy = by - s * 0.06;
    const hr = s * 0.17;
    ctx.fillStyle = pal.c;
    ctx.beginPath(); ctx.ellipse(hx, hy, hr, hr * 0.82, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.02; ctx.stroke();
    drawFace(ctx, hx, hy, hr * 0.68, faceMoodFor(mood), t, 133, 1, 0);
    ctx.restore();
    return { x: bx * 0.3, y: by - s * 0.2 };
  }

  function adultPtero(ctx, s, t, mood, k, pal) {
    const isFly = mood === 'fly';
    const lift = isFly ? s * 0.15 + Math.sin(t * 4) * s * 0.05 : 0;
    const hop = mood === 'happy' ? Math.abs(Math.sin(t * 5)) * s * 0.06 : 0;
    ctx.save(); ctx.translate(0, -hop - lift);
    const legTop = -s * 0.22, legFoot = 0, legW = s * 0.1;
    if (!isFly) legPair(ctx, [-s * 0.1, s * 0.12], legTop, legFoot, legW, pal.c2, 0, 0);
    const bx = 0, by = legTop - s * 0.2;
    ctx.fillStyle = pal.c;
    ctx.beginPath(); ctx.ellipse(bx, by, s * 0.24, s * 0.2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.02; ctx.stroke();
    for (const sd of [-1, 1]) {
      // same gull-wing convention as the baby: tip rises well above the
      // body when flying, folds down beside it at rest
      const flap = isFly ? Math.sin(t * 8 + (sd > 0 ? 0 : Math.PI)) : 0;
      const len = isFly ? s * 1.5 : s * 0.5;
      const baseY = by - s * 0.1;
      const tipY = isFly ? baseY - s * 0.5 - flap * s * 0.28 : baseY + s * 0.25;
      const midY = isFly ? baseY - s * 0.18 - flap * s * 0.12 : baseY - s * 0.05;
      ctx.fillStyle = pal.wing;
      ctx.beginPath();
      ctx.moveTo(bx + sd * s * 0.05, baseY);
      ctx.quadraticCurveTo(bx + sd * len * 0.6, midY, bx + sd * len, tipY);
      ctx.quadraticCurveTo(bx + sd * len * 0.5, baseY + s * 0.2, bx + sd * s * 0.08, baseY + s * 0.1);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.02; ctx.stroke();
    }
    const hx = s * 0.22, hy = by - s * 0.22;
    const hr = s * 0.16;
    ctx.fillStyle = pal.c;
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill(); ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.02; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx + hr * 0.7, hy); ctx.lineTo(hx + hr * 1.7, hy + hr * 0.1); ctx.lineTo(hx + hr * 0.7, hy + hr * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.c2;
    ctx.beginPath(); ctx.moveTo(hx - hr * 0.3, hy - hr * 0.85); ctx.quadraticCurveTo(hx + hr * 0.1, hy - hr * 1.7, hx + hr * 0.55, hy - hr * 0.95); ctx.closePath(); ctx.fill();
    drawFace(ctx, hx, hy, hr * 0.62, faceMoodFor(mood), t, 144, 1, 0);
    ctx.restore();
    return { x: 0, y: by - s * 0.05 };
  }

  function adultFire(ctx, s, t, mood, k, pal) {
    const bob = mood === 'walk' ? Math.sin(t * 5) * s * 0.015 : Math.sin(t * 1.6) * s * 0.008;
    const hop = mood === 'happy' ? Math.abs(Math.sin(t * 5)) * s * 0.06 : 0;
    ctx.save(); ctx.translate(0, -hop);
    const legTop = -s * 0.42, legFoot = 0, legW = s * 0.13;
    const legPhase = mood === 'walk' ? t * 5 : 0, legAmp = mood === 'walk' ? s * 0.03 : 0;
    legPair(ctx, [-s * 0.24, s * 0.02, s * 0.28], legTop, legFoot, legW, pal.c2, legPhase, legAmp);
    ctx.strokeStyle = pal.c; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.34, legTop); ctx.quadraticCurveTo(-s * 0.58, legTop + bob, -s * 0.66, legTop - s * 0.16); ctx.stroke();
    const bx = 0, by = legTop - s * 0.22 + bob;
    ctx.fillStyle = pal.c;
    ctx.beginPath(); ctx.ellipse(bx, by, s * 0.36, s * 0.26, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.025; ctx.stroke();
    ctx.fillStyle = pal.belly;
    ctx.beginPath(); ctx.ellipse(bx + s * 0.04, by + s * 0.06, s * 0.22, s * 0.12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.c2;
    for (let i = 0; i < 4; i++) {
      const sx = bx - s * (0.02 + i * 0.12);
      ctx.beginPath(); ctx.moveTo(sx - s * 0.06, by - s * 0.2); ctx.lineTo(sx, by - s * 0.34); ctx.lineTo(sx + s * 0.06, by - s * 0.2); ctx.closePath(); ctx.fill();
    }
    const hx = s * 0.36, hy = by - s * 0.22;
    const hr = s * 0.2;
    const roar = mood === 'roar';
    ctx.fillStyle = pal.c;
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill(); ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.02; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hx + hr * 0.75, hy + hr * 0.2, hr * 0.42, hr * 0.3, 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (roar) {
      ctx.fillStyle = '#6b3345';
      ctx.beginPath(); ctx.ellipse(hx + hr * 0.9, hy + hr * 0.28, hr * 0.3, hr * 0.22, 0.3, 0, TAU); ctx.fill();
    }
    drawFace(ctx, hx, hy, hr * 0.65, faceMoodFor(mood), t, 155, 1, 0);
    ctx.restore();
    return { x: s * 0.02, y: by - s * 0.26 };
  }

  function adultRex(ctx, s, t, mood, k, pal) {
    const stomp = mood === 'walk' ? Math.abs(Math.sin(t * 3)) * s * 0.03 : 0;
    const roar = mood === 'roar';
    const by = -stomp;
    ctx.save();
    ctx.fillStyle = pal.c;
    ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.02;
    for (const lx of [-s * 0.12, s * 0.03]) { rr(ctx, lx - s * 0.09, by - s * 0.22, s * 0.18, s * 0.22, s * 0.03); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(0, by - s * 0.36, s * 0.2, s * 0.17, -0.15, 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.02; ctx.stroke();
    ctx.strokeStyle = pal.c; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.17, by - s * 0.32);
    ctx.quadraticCurveTo(-s * 0.38, by - s * 0.28 + stomp, -s * 0.5, by - s * 0.38);
    ctx.stroke();
    ctx.lineWidth = s * 0.03;
    for (const ay of [-0.37, -0.32]) {
      ctx.beginPath(); ctx.moveTo(s * 0.15, by + ay * s); ctx.lineTo(s * 0.21, by + ay * s + s * 0.03 + Math.sin(t * 5) * s * 0.01); ctx.stroke();
    }
    const hy = by - s * 0.58 + (roar ? -s * 0.03 : 0);
    ctx.fillStyle = pal.c;
    ctx.beginPath(); ctx.ellipse(s * 0.1, hy, s * 0.14, s * 0.11, roar ? -0.25 : 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.c2; ctx.lineWidth = s * 0.02; ctx.stroke();
    if (roar) {
      ctx.fillStyle = '#c2451a';
      ctx.beginPath(); ctx.ellipse(s * 0.2, hy + s * 0.05, s * 0.06, s * 0.045, 0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      for (const ox of [-0.03, 0, 0.03]) {
        ctx.beginPath(); ctx.moveTo(s * (0.17 + ox), hy + s * 0.02); ctx.lineTo(s * (0.19 + ox), hy + s * 0.06); ctx.lineTo(s * (0.15 + ox), hy + s * 0.06); ctx.closePath(); ctx.fill();
      }
    }
    drawFace(ctx, s * 0.1, hy, s * 0.09, faceMoodFor(mood), t, 166, 1, 0);
    ctx.restore();
    return { x: -s * 0.05, y: by - s * 0.62 };
  }

  function adult(ctx, kind, cx, groundY, s, t = 0, o = {}) {
    const mood = o.mood || 'idle', facing = o.facing || 1, k = o.k || 0;
    const pal = PAL[kind];
    if (!pal) return { saddle: { x: cx, y: groundY - s * 0.62 } };
    let local = { x: -s * 0.05, y: -s * 0.62 };
    mir(ctx, cx, groundY, facing, () => {
      if (kind === 'trike') local = adultTrike(ctx, s, t, mood, k, pal);
      else if (kind === 'longneck') local = adultLongneck(ctx, s, t, mood, k, pal);
      else if (kind === 'anky') local = adultAnky(ctx, s, t, mood, k, pal);
      else if (kind === 'ptero') local = adultPtero(ctx, s, t, mood, k, pal);
      else if (kind === 'fire') local = adultFire(ctx, s, t, mood, k, pal);
      else if (kind === 'rex') local = adultRex(ctx, s, t, mood, k, pal);
    });
    return { saddle: { x: cx + facing * local.x, y: groundY + local.y } };
  }

  // ---------------------------------------------------------------- silhouettes
  function silShape(ctx, kind, cx, groundY, s, t, color) {
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.fillStyle = color;
    const bob = Math.sin(t * 2 + cx * 0.01) * s * 0.02;
    if (kind === 'trike') {
      for (const lx of [-s * 0.16, s * 0.1]) { ctx.beginPath(); ctx.rect(lx - s * 0.07, -s * 0.2, s * 0.14, s * 0.2); ctx.fill(); }
      ctx.beginPath(); ctx.ellipse(0, -s * 0.34 + bob, s * 0.32, s * 0.24, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.32, -s * 0.5 + bob, s * 0.3, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s * 0.02, -s * 0.75 + bob); ctx.lineTo(s * 0.18, -s * 0.42 + bob);
      ctx.lineTo(s * 0.4, -s * 0.42 + bob); ctx.lineTo(s * 0.62, -s * 0.75 + bob);
      ctx.closePath(); ctx.fill();
    } else if (kind === 'longneck') {
      for (const lx of [-s * 0.14, s * 0.12]) { ctx.beginPath(); ctx.rect(lx - s * 0.07, -s * 0.2, s * 0.14, s * 0.2); ctx.fill(); }
      ctx.beginPath(); ctx.ellipse(0, -s * 0.32 + bob, s * 0.3, s * 0.22, 0, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s * 0.14, -s * 0.42 + bob); ctx.quadraticCurveTo(s * 0.1, -s, s * 0.3, -s * 1.3 + bob);
      ctx.lineTo(s * 0.45, -s * 1.22 + bob); ctx.quadraticCurveTo(s * 0.25, -s * 0.8, s * 0.28, -s * 0.42 + bob);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.34, -s * 1.32 + bob, s * 0.16, 0, TAU); ctx.fill();
    } else if (kind === 'anky') {
      for (const lx of [-s * 0.24, -s * 0.02, s * 0.2, s * 0.4]) { ctx.beginPath(); ctx.rect(lx - s * 0.07, -s * 0.18, s * 0.14, s * 0.18); ctx.fill(); }
      ctx.beginPath(); ctx.ellipse(s * 0.06, -s * 0.36 + bob, s * 0.42, s * 0.22, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.42, -s * 0.4 + bob, s * 0.22, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(-s * 0.4, -s * 0.32 + bob, s * 0.12, 0, TAU); ctx.fill();
    } else if (kind === 'ptero') {
      ctx.beginPath(); ctx.ellipse(0, -s * 0.34 + bob, s * 0.2, s * 0.16, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -s * 0.4 + bob); ctx.lineTo(-s * 0.6, -s * 0.62 + bob); ctx.lineTo(-s * 0.1, -s * 0.44 + bob); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -s * 0.4 + bob); ctx.lineTo(s * 0.6, -s * 0.62 + bob); ctx.lineTo(s * 0.1, -s * 0.44 + bob); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.22, -s * 0.44 + bob, s * 0.15, 0, TAU); ctx.fill();
    } else if (kind === 'fire') {
      for (const lx of [-s * 0.14, s * 0.1]) { ctx.beginPath(); ctx.rect(lx - s * 0.07, -s * 0.18, s * 0.14, s * 0.18); ctx.fill(); }
      ctx.beginPath(); ctx.ellipse(0, -s * 0.32 + bob, s * 0.28, s * 0.22, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.28, -s * 0.44 + bob, s * 0.22, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(s * 0.2, -s * 0.62 + bob); ctx.lineTo(s * 0.28, -s * 0.78 + bob); ctx.lineTo(s * 0.36, -s * 0.62 + bob); ctx.closePath(); ctx.fill();
    } else if (kind === 'rex') {
      ctx.beginPath(); ctx.rect(-s * 0.15, -s * 0.6, s * 0.14, s * 0.6); ctx.fill();
      ctx.beginPath(); ctx.rect(s * 0.05, -s * 0.6, s * 0.14, s * 0.6); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -s * 0.75, s * 0.3, s * 0.24, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * 0.32, -s * 0.95, s * 0.24, s * 0.18, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function silhouette(ctx, kind, cx, groundY, s, t = 0) {
    silShape(ctx, kind, cx, groundY, s, t, 'rgba(20,50,28,0.88)');
  }
  function herd(ctx, x, groundY, w, t = 0, o = {}) {
    const k = o.k || 0;
    const kinds = ['trike', 'longneck', 'anky', 'fire'];
    const n = Math.max(3, Math.floor(w / 140));
    for (let i = 0; i < n; i++) {
      const h = hash2(i, 777);
      const prog = (i / n + k * 0.4 + h * 0.05) % 1;
      const px = x + prog * w;
      const sz = 46 + h * 30;
      silShape(ctx, kinds[i % kinds.length], px, groundY - h * 10, sz, t * 10 + i * 2, 'rgba(20,60,30,0.55)');
    }
  }

  // ---------------------------------------------------------------- fruit
  function fruit(ctx, kind, cx, cy, s, t = 0) {
    ctx.save();
    ctx.translate(cx, cy + Math.sin(t * 3 + cx * 0.01) * s * 0.05);
    if (kind === 'apple') {
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -s * 0.42); ctx.lineTo(s * 0.08, -s * 0.58); ctx.stroke();
      ctx.fillStyle = '#4a9c3a';
      ctx.beginPath(); ctx.ellipse(s * 0.15, -s * 0.5, s * 0.13, s * 0.08, 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#c22'; ctx.lineWidth = s * 0.03; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.ellipse(-s * 0.14, -s * 0.12, s * 0.1, s * 0.15, -0.3, 0, TAU); ctx.fill();
      drawFace(ctx, 0, s * 0.04, s * 0.3, 'happy', t, cx * 0.01);
    } else if (kind === 'banana') {
      ctx.strokeStyle = '#c2831a'; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
      ctx.fillStyle = '#ffe156';
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, s * 0.2);
      ctx.quadraticCurveTo(-s * 0.1, -s * 0.5, s * 0.42, -s * 0.36);
      ctx.quadraticCurveTo(s * 0.05, -s * 0.28, -s * 0.24, s * 0.32);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      drawFace(ctx, -s * 0.02, -s * 0.02, s * 0.24, 'happy', t, cx * 0.01);
    } else { // berry
      ctx.strokeStyle = '#3f9c3a'; ctx.lineWidth = s * 0.05;
      ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.lineTo(0, -s * 0.2); ctx.stroke();
      const cols = ['#8f5fff', '#6f3fd6'];
      const spots = [[-0.16, -0.05], [0.16, -0.05], [0, 0.18], [-0.1, 0.35], [0.1, 0.35]];
      for (let i = 0; i < spots.length; i++) {
        const ox = spots[i][0], oy = spots[i][1];
        ctx.fillStyle = cols[i % 2];
        ctx.beginPath(); ctx.arc(ox * s, oy * s, s * 0.16, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#4a2a8a'; ctx.lineWidth = s * 0.02; ctx.stroke();
      }
      drawFace(ctx, 0, s * 0.05, s * 0.14, 'happy', t, cx * 0.01);
    }
    ctx.restore();
  }
  function peel(ctx, kind, x, y, s, t = 0) {
    ctx.save();
    ctx.translate(x, y);
    if (kind === 'apple') {
      ctx.fillStyle = '#e8d8a8';
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.28, s * 0.16, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -s * 0.12); ctx.lineTo(0, -s * 0.28); ctx.stroke();
    } else if (kind === 'banana') {
      ctx.strokeStyle = '#c2831a'; ctx.lineWidth = s * 0.08; ctx.lineCap = 'round';
      ctx.fillStyle = '#e8d060';
      for (const a of [-0.5, 0.1, 0.6]) {
        ctx.save(); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(-s * 0.05, 0); ctx.quadraticCurveTo(s * 0.1, -s * 0.1, s * 0.36, s * 0.02); ctx.quadraticCurveTo(s * 0.1, s * 0.08, -s * 0.05, 0); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    } else {
      ctx.strokeStyle = '#3f9c3a'; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round';
      for (const a of [-0.4, 0, 0.4]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(a) * s * 0.3, -Math.cos(a) * s * 0.2); ctx.stroke(); }
      ctx.fillStyle = '#6f3fd6';
      for (const a of [-0.4, 0, 0.4]) { ctx.beginPath(); ctx.arc(Math.sin(a) * s * 0.3, -Math.cos(a) * s * 0.2, s * 0.05, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }
  function fruitTree(ctx, kind, cx, groundY, s, t = 0) {
    ctx.save();
    ctx.translate(cx, groundY);
    const sway = Math.sin(t * 1.1 + cx * 0.01) * s * 0.015;
    ctx.strokeStyle = '#7a5a34'; ctx.lineWidth = s * 0.14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sway * 2, -s * 0.5, sway, -s * 0.85); ctx.stroke();
    ctx.fillStyle = '#3fae5a';
    ctx.beginPath(); ctx.arc(sway, -s * 0.95, s * 0.42, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a7a3a'; ctx.lineWidth = s * 0.02; ctx.stroke();
    drawFace(ctx, sway, -s * 0.6, s * 0.12, 'happy', t, cx * 0.01);
    const fruitS = s * 0.13;
    const spots = [[-0.22, -1.05], [0.2, -0.92], [0, -1.2], [-0.05, -0.78], [0.28, -1.1]];
    for (const p of spots) fruit(ctx, kind, sway + p[0] * s, p[1] * s, fruitS, t);
    ctx.restore();
  }

  // ---------------------------------------------------------------- prints & nest
  function footprint(ctx, kind, x, y, s, t = 0, o = {}) {
    ctx.save();
    ctx.globalAlpha = o.alpha != null ? o.alpha : 0.55;
    ctx.translate(x, y);
    ctx.fillStyle = kind === 'fire' ? 'rgba(130,64,32,1)' : 'rgba(70,50,30,1)';
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.32, 0, 0, TAU); ctx.fill();
    const toes = kind === 'ptero' ? 2 : 3;
    for (let i = 0; i < toes; i++) {
      const a = lerp(-0.5, 0.5, toes === 1 ? 0.5 : i / (toes - 1));
      ctx.beginPath(); ctx.ellipse(Math.sin(a) * s * 0.4, -s * 0.34 + Math.abs(a) * s * 0.1, s * 0.13, s * 0.22, a * 0.3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function nest(ctx, cx, groundY, s, t = 0, o = {}) {
    ctx.save();
    ctx.translate(cx, groundY);
    const sColor = '#8a5a2e', dColor = '#5a3a1a';
    const n = o.damaged ? 9 : 14;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const h = hash2(i, Math.floor(cx));
      const a = -0.15 * Math.PI - h * 1.3 * Math.PI;
      const scattered = !!(o.damaged && h > 0.6);
      const r0 = s * 0.5, len = s * (0.16 + h * 0.08);
      const bx = Math.cos(a) * r0 * (scattered ? 1.5 : 1);
      const by = -Math.abs(Math.sin(a)) * r0 * 0.3 * (scattered ? 0.3 : 1) + (scattered ? s * 0.3 * h : 0);
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a + (scattered ? h * 2 : 0));
      ctx.strokeStyle = h > 0.5 ? sColor : dColor; ctx.lineWidth = s * (0.03 + h * 0.02);
      ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(90,58,26,0.35)';
    ctx.beginPath(); ctx.ellipse(0, -s * 0.02, s * 0.42, s * 0.14, 0, 0, TAU); ctx.fill();
    if (o.damaged) {
      ctx.fillStyle = '#fff6e0';
      for (const p of [[-0.2, -0.05], [0.15, 0.02], [0.3, -0.08]]) {
        ctx.beginPath(); ctx.moveTo(p[0] * s, p[1] * s); ctx.lineTo(p[0] * s + s * 0.08, p[1] * s - s * 0.03); ctx.lineTo(p[0] * s + s * 0.02, p[1] * s + s * 0.05); ctx.closePath(); ctx.fill();
      }
    }
    if (o.eggs) {
      for (let i = 0; i < o.eggs; i++) {
        const ex = -s * 0.2 + i * s * 0.2;
        ctx.fillStyle = '#fff6e0';
        ctx.beginPath(); ctx.ellipse(ex, -s * 0.16, s * 0.11, s * 0.15, 0.1, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#c9b88a'; ctx.lineWidth = s * 0.015; ctx.stroke();
      }
    }
    if (o.ghost) {
      ctx.save();
      const tw = 0.32 + 0.08 * Math.sin(t * 2);
      ctx.globalAlpha = tw;
      ctx.setLineDash([s * 0.05, s * 0.05]);
      ctx.strokeStyle = '#8fb8ff'; ctx.lineWidth = s * 0.03;
      ctx.beginPath(); ctx.ellipse(0, -s * 0.1, s * 0.3, s * 0.24, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      silShape(ctx, o.ghost, 0, 0, s * 0.9, t, `rgba(143,184,255,${0.3 + 0.08 * Math.sin(t * 2)})`);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- bat & sound
  function bat(ctx, cx, cy, s, t = 0, o = {}) {
    ctx.save();
    ctx.translate(cx, cy);
    const hiccup = o.hiccup || 0;
    ctx.rotate(Math.sin(t * 1.5) * 0.06 + hiccup * Math.sin(t * 30) * 0.15);
    ctx.strokeStyle = '#3a2a3a'; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.06, -s * 0.5); ctx.lineTo(-s * 0.06, -s * 0.36); ctx.moveTo(s * 0.06, -s * 0.5); ctx.lineTo(s * 0.06, -s * 0.36); ctx.stroke();
    ctx.fillStyle = '#5a4a72';
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.3);
      ctx.quadraticCurveTo(sd * s * 0.32, -s * 0.1, sd * s * 0.14, s * 0.12);
      ctx.quadraticCurveTo(sd * s * 0.06, -s * 0.05, 0, -s * 0.1);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3a2a52'; ctx.lineWidth = s * 0.02; ctx.stroke();
    }
    ctx.fillStyle = '#7a6a96';
    ctx.beginPath(); ctx.ellipse(0, -s * 0.24, s * 0.15, s * 0.2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a2a52'; ctx.lineWidth = s * 0.02; ctx.stroke();
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * s * 0.06, -s * 0.4); ctx.lineTo(sd * s * 0.14, -s * 0.54); ctx.lineTo(sd * s * 0.02, -s * 0.42); ctx.closePath(); ctx.fill(); }
    drawFace(ctx, 0, -s * 0.24, s * 0.13, hiccup > 0.3 ? 'surprised' : 'sleepy', t, 66);
    if (hiccup > 0.3) {
      ctx.fillStyle = 'rgba(200,220,255,0.7)';
      ctx.beginPath(); ctx.arc(s * 0.16, -s * 0.4 - hiccup * s * 0.1, s * 0.05 + hiccup * s * 0.05, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function soundRing(ctx, cx, cy, r, alpha) {
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.strokeStyle = '#dff0ff'; ctx.lineWidth = 3;
    ctx.beginPath();
    const n = 18;
    for (let i = 0; i <= n; i++) {
      const a = i / n * TAU;
      const rr2 = r * (1 + Math.sin(a * 5 + r * 0.1) * 0.03);
      const px = cx + Math.cos(a) * rr2, py = cy + Math.sin(a) * rr2 * 0.6;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }
  function note(ctx, x, y, s, t = 0) {
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 3) * s * 0.3);
    ctx.fillStyle = '#ff8fb0';
    ctx.beginPath(); ctx.ellipse(-s * 0.15, s * 0.35, s * 0.22, s * 0.16, -0.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ff8fb0'; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s * 0.05, s * 0.3); ctx.lineTo(s * 0.05, -s * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.05, -s * 0.5); ctx.quadraticCurveTo(s * 0.3, -s * 0.45, s * 0.22, -s * 0.2); ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------- candy pile
  function candyPile(ctx, cx, groundY, s, t = 0) {
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, 0);
    ctx.quadraticCurveTo(-s * 0.32, -s * 0.42, -s * 0.1, -s * 0.5);
    ctx.quadraticCurveTo(s * 0.05, -s * 0.56, s * 0.2, -s * 0.44);
    ctx.quadraticCurveTo(s * 0.4, -s * 0.3, s * 0.5, 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 4; ctx.stroke();
    const spots = 14;
    for (let i = 0; i < spots; i++) {
      const h = hash2(i, 909);
      const px = -s * 0.42 + h * s * 0.84;
      const py = -6 - Math.sin((px / s + 0.5) * Math.PI) * s * 0.4 - (i % 3) * 10;
      drawCandy(ctx, px, py, 15 + h * 8, i % 3, t + i);
    }
    for (let i = 0; i < 6; i++) {
      const h = hash2(i, 404);
      const tw = 0.4 + 0.6 * Math.max(0, Math.sin(t * 3 + i * 1.7));
      ctx.save();
      ctx.globalAlpha = tw;
      ctx.fillStyle = '#fff';
      starPath(ctx, -s * 0.4 + h * s * 0.8, -s * 0.15 - h * s * 0.3, 6, 3, 4);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- crash cinematic
  // Reproduces the SAME pod silhouette as ST_ART's stationart.js pod body
  // (same curve control points/proportions) so this is unmistakably a
  // continuation of the station's escape pod, not a new prop.
  function dPod(ctx, s, o) {
    const w = s * 0.78;
    ctx.save();
    ctx.rotate(o.tilt || 0);
    ctx.strokeStyle = '#8a8f9c'; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round';
    for (const dx of [-w * 0.42, 0, w * 0.42]) {
      ctx.beginPath(); ctx.moveTo(dx * 0.5, -s * 0.18); ctx.lineTo(dx, 0); ctx.stroke();
      ctx.fillStyle = '#5a5f6c';
      ctx.beginPath(); ctx.ellipse(dx, 2, s * 0.06, s * 0.025, 0, 0, TAU); ctx.fill();
    }
    const bodyTop = -s, bodyBot = -s * 0.16;
    const g = ctx.createLinearGradient(0, bodyTop, 0, bodyBot);
    if (o.scorched) { g.addColorStop(0, '#5a5248'); g.addColorStop(1, '#7a6a52'); }
    else { g.addColorStop(0, '#fff7ea'); g.addColorStop(1, '#ffd9a0'); }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, bodyBot);
    ctx.quadraticCurveTo(-w * 0.62, -s * 0.55, -w * 0.22, bodyTop);
    ctx.quadraticCurveTo(0, bodyTop - s * 0.06, w * 0.22, bodyTop);
    ctx.quadraticCurveTo(w * 0.62, -s * 0.55, w * 0.5, bodyBot);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = o.scorched ? '#2e2a24' : '#e8862f'; ctx.lineWidth = s * 0.022; ctx.stroke();
    if (!o.scorched) {
      ctx.fillStyle = '#ff9f43';
      ctx.beginPath(); ctx.ellipse(0, -s * 0.34, w * 0.5, s * 0.05, 0, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(30,24,18,0.55)';
      ctx.beginPath(); ctx.ellipse(-w * 0.1, -s * 0.6, w * 0.22, s * 0.16, 0.3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w * 0.18, -s * 0.28, w * 0.14, s * 0.1, -0.2, 0, TAU); ctx.fill();
    }
    if (o.dented) {
      ctx.strokeStyle = 'rgba(40,34,28,0.6)'; ctx.lineWidth = s * 0.02;
      ctx.beginPath(); ctx.ellipse(-w * 0.28, -s * 0.42, s * 0.09, s * 0.05, 0.4, 0, TAU); ctx.stroke();
    }
    const py = -s * 0.7, pr = s * 0.18;
    ctx.fillStyle = '#12131c';
    ctx.beginPath(); ctx.arc(0, py, pr, 0, TAU); ctx.fill();
    ctx.fillStyle = o.scorched ? 'rgba(255,140,80,0.25)' : 'rgba(160,225,255,0.5)';
    ctx.beginPath(); ctx.arc(-pr * 0.25, py - pr * 0.25, pr * 0.55, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#c98a3a'; ctx.lineWidth = s * 0.035; ctx.stroke();
    drawFace(ctx, 0, py + pr * 1.3, pr * 0.5, 'happy', o.t || 0, 4);
    if (o.open) {
      const rampY = bodyBot;
      ctx.fillStyle = o.scorched ? '#8a8078' : '#d8c8a8';
      ctx.beginPath();
      ctx.moveTo(-w * 0.3, rampY); ctx.lineTo(w * 0.3, rampY);
      ctx.lineTo(w * 0.44, rampY + s * 0.5); ctx.lineTo(-w * 0.44, rampY + s * 0.5);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = o.scorched ? '#2a241e' : '#8a7a5c'; ctx.lineWidth = s * 0.022; ctx.stroke();
      ctx.fillStyle = o.scorched ? 'rgba(255,150,90,0.35)' : 'rgba(255,238,180,0.55)';
      ctx.beginPath(); ctx.ellipse(0, rampY + s * 0.02, w * 0.24, s * 0.06, 0, 0, TAU); ctx.fill();
    } else {
      ctx.strokeStyle = '#c98a3a'; ctx.lineWidth = s * 0.02;
      ctx.beginPath(); ctx.moveTo(-w * 0.34, bodyBot - s * 0.02); ctx.lineTo(w * 0.34, bodyBot - s * 0.02); ctx.stroke();
    }
    if (o.lights > 0.001) {
      const blink = 0.5 + 0.5 * Math.sin((o.t || 0) * 7);
      for (const sd of [-1, 1]) stGlowDot(ctx, sd * w * 0.46, -s * 0.5, s * 0.03, '#ff3b3b', o.lights * (0.4 + 0.6 * blink));
    }
    ctx.restore();
  }

  function crashFireball(ctx, k, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a1030'); g.addColorStop(0.55, '#3a2a5a'); g.addColorStop(1, '#274d2e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1f6a30';
    ctx.beginPath(); ctx.moveTo(0, H); ctx.quadraticCurveTo(W * 0.5, H * 0.62, W, H * 0.82); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    stStarField(ctx, 0, 0, W, H * 0.4, 50, t, 0.5 * (1 - k), 20);
    const podCx = W / 2, podCy = H * 0.46;
    // a warm glow behind the hull first (reads as "engulfed" even before
    // the streak shapes resolve)
    stHalo(ctx, podCx, podCy - 10, 260, '#ffb35c', 0.4);
    stHalo(ctx, podCx, podCy, 190, '#ff6b35', 0.32);
    // flame streaks around the TOP and SIDES only (biased away from the
    // legs/hatch at the bottom, and pulled outside the pod's own silhouette
    // — the pod itself is drawn at s=190*1.6, roughly 237 wide / 304 tall —
    // so they read as licking flame against the dark sky, not a closed ring
    // that would look like a nest under the pod)
    for (let i = 0; i < 12; i++) {
      const h = hash2(i, 12);
      const a = -Math.PI / 2 + lerp(-2.35, 2.35, i / 11) + h * 0.15; // top-biased arc, gap at the bottom
      const rx = 150 + h * 25, ry = 175 + h * 25;
      const fx = podCx + Math.cos(a) * rx, fy = podCy + Math.sin(a) * ry;
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.4 * Math.max(0, Math.sin(t * 11 + i * 1.7));
      ctx.fillStyle = i % 2 ? '#ff9f43' : '#ff6b35';
      ctx.beginPath(); ctx.ellipse(fx, fy, 20 + h * 12, 48 + h * 24, a + Math.PI / 2, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(podCx, podCy);
    ctx.scale(1.6, 1.6);
    dPod(ctx, 190, { open: false, lights: 1, t, tilt: Math.sin(t * 10) * 0.05, scorched: false, dented: false });
    ctx.restore();
    const blink = Math.max(0, Math.sin(t * 9));
    ctx.save(); ctx.globalAlpha = blink * 0.35; ctx.fillStyle = '#ff3b3b'; ctx.fillRect(0, 0, W, H); ctx.restore();
    return { jack: null };
  }

  function crashTreetops(ctx, k, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#8fd0e0'); g.addColorStop(1, '#bfe6c8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // three depth layers of canopy (back = small/dark/high, front =
    // big/light/low) so it reads as a forest with real depth, not one flat
    // row of identical ovals; each tree gets a visible trunk plus three
    // overlapping leaf-cluster blobs instead of a single ellipse
    const layers = [
      { n: 6, baseY: H * 0.40, scale: 0.5,  col: '#1f5c2c', trunk: '#3a2a1c', seed: 30 },
      { n: 6, baseY: H * 0.52, scale: 0.78, col: '#2f7a3c', trunk: '#5a3f24', seed: 60 },
      { n: 5, baseY: H * 0.68, scale: 1.2,  col: '#3fae4a', trunk: '#7a5a34', seed: 90 }
    ];
    for (const L of layers) {
      for (let i = 0; i < L.n; i++) {
        const h = hash2(i, L.seed);
        const tx = (i + 0.5) / L.n * (W + 160) - 80 + (h - 0.5) * 60;
        const ty = L.baseY + (h - 0.5) * 30;
        const sz = (70 + h * 40) * L.scale;
        ctx.fillStyle = L.trunk;
        ctx.fillRect(tx - sz * 0.07, ty, sz * 0.14, sz * 0.75);
        ctx.fillStyle = L.col;
        const blobs = [[-0.38, 0.05, 0.6], [0.38, 0.08, 0.58], [0, -0.32, 0.68]];
        for (const b of blobs) {
          ctx.beginPath(); ctx.arc(tx + b[0] * sz, ty - sz * 0.1 + b[1] * sz, sz * b[2], 0, TAU); ctx.fill();
        }
      }
    }

    // the pod, angled down-right, punching through with a motion trail
    const podX = lerp(120, W - 160, k), podY = lerp(60, H - 140, k);
    ctx.save();
    ctx.translate(podX, podY);
    ctx.rotate(0.7);
    const fg = ctx.createLinearGradient(0, 0, -170, -50);
    fg.addColorStop(0, 'rgba(255,220,150,0.9)'); fg.addColorStop(0.5, 'rgba(255,150,60,0.55)'); fg.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(-8, -34); ctx.quadraticCurveTo(-130, -14, -190, 30); ctx.quadraticCurveTo(-90, 22, -8, 12); ctx.closePath(); ctx.fill();
    dPod(ctx, 150, { open: false, lights: 1, t, tilt: 0 });
    ctx.restore();

    // snapped branches (bigger debris, a couple of forked V-shapes) plus a
    // scatter of flying leaves/twigs streaming off the impact point
    for (let i = 0; i < 3; i++) {
      const h = hash2(i, 33);
      const bx = podX - 30 + h * 220, by = podY - 40 + (h - 0.5) * 200;
      ctx.save();
      ctx.translate(bx, by); ctx.rotate(h * TAU + t * 4);
      ctx.strokeStyle = '#5a3f24'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-16, 6); ctx.lineTo(0, -8); ctx.lineTo(16, 4); ctx.stroke();
      ctx.restore();
    }
    for (let i = 0; i < 16; i++) {
      const h = hash2(i, 88);
      const lx = podX - 70 + h * 280 - k * 40, ly = podY - 70 + (h - 0.5) * 240;
      ctx.save();
      ctx.translate(lx, ly); ctx.rotate(t * 10 + i);
      if (i % 3) { ctx.fillStyle = i % 2 ? '#3fae4a' : '#57c25c'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 7, 0, 0, TAU); ctx.fill(); }
      else { ctx.fillStyle = '#7a5a34'; ctx.fillRect(-16, -3, 32, 6); }
      ctx.restore();
    }

    // the longneck: rears back on its long neck as the pod screams past,
    // wide surprised eyes
    const react = clamp(k * 2.2, 0, 1);
    ctx.save();
    ctx.translate(190, H - 120);
    ctx.fillStyle = PAL.longneck.c;
    ctx.beginPath(); ctx.ellipse(0, 22, 36, 24, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = PAL.longneck.c2; ctx.lineWidth = 3; ctx.stroke();
    const neckLen = 95 + react * 55;
    const nhx = -react * 34, nhy = -neckLen;
    ctx.strokeStyle = PAL.longneck.c; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(8, 4);
    ctx.quadraticCurveTo(-6 - react * 24, -neckLen * 0.55, nhx, nhy);
    ctx.stroke();
    const nhr = 21;
    ctx.fillStyle = PAL.longneck.c;
    ctx.beginPath(); ctx.ellipse(nhx + nhr * 0.3, nhy, nhr, nhr * 0.82, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = PAL.longneck.c2; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(nhx + nhr * 1.15, nhy + nhr * 0.15, nhr * 0.45, nhr * 0.3, 0, 0, TAU); ctx.fill(); ctx.stroke();
    drawFace(ctx, nhx + nhr * 0.25, nhy, nhr * 0.7, 'surprised', t, 3);
    ctx.restore();

    // the ptero: spread wings, flapping hard, fleeing up and away
    ctx.save();
    const fx0 = W - 210 + k * 50, fy0 = H * 0.3 - k * 40;
    ctx.translate(fx0, fy0);
    const flap = Math.sin(t * 12);
    ctx.fillStyle = PAL.ptero.c;
    ctx.beginPath(); ctx.ellipse(0, 0, 23, 18, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = PAL.ptero.c2; ctx.lineWidth = 3; ctx.stroke();
    for (const sd of [-1, 1]) {
      const wflap = Math.sin(t * 12 + (sd > 0 ? 0 : Math.PI));
      const len = 78, baseY = -8, tipY = baseY - 34 - wflap * 24, midY = baseY - 12 - wflap * 14;
      ctx.fillStyle = PAL.ptero.wing;
      ctx.beginPath();
      ctx.moveTo(sd * 4, baseY);
      ctx.quadraticCurveTo(sd * len * 0.6, midY, sd * len, tipY);
      ctx.quadraticCurveTo(sd * len * 0.4, baseY + 16, sd * 6, baseY + 9);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = PAL.ptero.c2; ctx.lineWidth = 2; ctx.stroke();
    }
    const phx = 17, phy = -15;
    ctx.fillStyle = PAL.ptero.c;
    ctx.beginPath(); ctx.arc(phx, phy, 13, 0, TAU); ctx.fill();
    ctx.strokeStyle = PAL.ptero.c2; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(phx + 9, phy); ctx.lineTo(phx + 23, phy + 3); ctx.lineTo(phx + 9, phy + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    drawFace(ctx, phx, phy, 8, 'surprised', t, 9);
    ctx.restore();

    return { jack: null };
  }

  function crashTumble(ctx, k, t) {
    const groundY = H * 0.72;
    const g = ctx.createLinearGradient(0, 0, 0, groundY);
    g.addColorStop(0, '#8fd0e0'); g.addColorStop(1, '#bfe6c8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, groundY);
    ctx.fillStyle = '#3a8f4a'; ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = '#245c2e';
    for (let i = 0; i < 7; i++) { const h = hash2(i, 66); const tx = i * (W / 6) + h * 50; ctx.beginPath(); ctx.ellipse(tx, groundY - 70 - h * 40, 70 + h * 20, 60 + h * 20, 0, 0, TAU); ctx.fill(); }
    let podX, podY, rot, dented = false, scorched = false;
    if (k < 0.35) {
      const bp = k / 0.35;
      podX = lerp(120, W * 0.42, bp);
      podY = groundY - Math.sin(bp * Math.PI) * 220;
      rot = lerp(0, Math.PI * 0.6, bp);
      dented = bp > 0.3;
    } else if (k < 0.7) {
      const sp = (k - 0.35) / 0.35;
      podX = lerp(W * 0.42, W * 0.62, sp);
      podY = groundY - 4;
      rot = lerp(Math.PI * 0.6, Math.PI * 0.95, sp);
      dented = true;
    } else {
      const rp = (k - 0.7) / 0.3;
      podX = lerp(W * 0.62, W * 0.58, rp);
      podY = groundY - 6;
      rot = lerp(Math.PI * 0.95, Math.PI, rp);
      dented = true; scorched = rp > 0.5;
    }
    ctx.save();
    ctx.translate(podX, podY);
    dPod(ctx, 180, { open: false, lights: k < 0.7 ? 1 : 0, t, tilt: rot, scorched, dented });
    ctx.restore();
    if (k > 0.3 && k < 0.75) {
      const sk = 1 - Math.abs(k - 0.5) / 0.25;
      ctx.fillStyle = '#6a4a2e'; ctx.globalAlpha = clamp(sk, 0, 1) * 0.8;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI - Math.PI * 0.9;
        ctx.beginPath(); ctx.arc(podX + Math.cos(a) * 100 * sk, groundY - Math.abs(Math.sin(a)) * 50 * sk, 7, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    return { jack: null };
  }

  function crashRest(ctx, k, t) {
    const groundY = H * 0.72;
    const g = ctx.createLinearGradient(0, 0, 0, groundY);
    g.addColorStop(0, '#9fd9e0'); g.addColorStop(1, '#cdeccb');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, groundY);
    ctx.fillStyle = '#4a9a52'; ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = '#245c2e';
    for (let i = 0; i < 7; i++) { const h = hash2(i, 66); const tx = i * (W / 6) + h * 50; ctx.beginPath(); ctx.ellipse(tx, groundY - 70 - h * 40, 70 + h * 20, 60 + h * 20, 0, 0, TAU); ctx.fill(); }
    const cx = W * 0.42;
    ctx.save();
    ctx.translate(cx, groundY);
    dPod(ctx, 190, { open: true, lights: 0, t, tilt: Math.PI, scorched: true, dented: true });
    ctx.restore();
    for (let i = 0; i < 4; i++) {
      const ph = (t * 0.3 + i * 0.28) % 1;
      stHalo(ctx, cx - 10 + i * 12, groundY - 150 - ph * 160, 20 + ph * 40, 'rgba(120,120,130,0.5)', (1 - ph) * 0.5);
    }
    ctx.fillStyle = '#2f7a3c';
    for (let i = 0; i < 6; i++) { const h = hash2(i + 500, 1); const lx = h * W, ly = groundY - 60 + Math.sin(t * 2 + i) * 20; ctx.beginPath(); ctx.ellipse(lx, ly, 8, 4, t + i, 0, TAU); ctx.fill(); }
    const bp = clamp(k, 0, 1);
    const bx = W - 160, by = groundY - 10;
    ctx.fillStyle = '#3a8f4a';
    ctx.beginPath(); ctx.ellipse(bx, by, 66, 40, 0, 0, TAU); ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.4 * bp;
    baby(ctx, 'trike', bx + 30, by + 4, 60, t, { mood: 'scared', facing: -1 });
    ctx.restore();
    const jackX = cx - 30, jackY = groundY - 2;
    return { jack: { x: jackX, y: jackY, s: 1 } };
  }

  function crashScene(ctx, phase, k = 0, t = 0) {
    k = clamp(k, 0, 1);
    if (phase === 'fireball') return crashFireball(ctx, k, t);
    if (phase === 'treetops') return crashTreetops(ctx, k, t);
    if (phase === 'tumble') return crashTumble(ctx, k, t);
    if (phase === 'rest') return crashRest(ctx, k, t);
    return { jack: null };
  }

  return {
    baby, adult, herd, silhouette, fruit, peel, fruitTree,
    footprint, nest, bat, soundRing, note, crashScene, candyPile
  };
})();
