'use strict';
// ================================================================ puzzle blocks
// PUZZLE BLOCKS: the reusable educational mini-game framework (see
// BACKLOG.md item 11 / docs/superpowers/specs/2026-08-29-puzzle-blocks-framework.md).
// Three deliberately separate layers:
//   1. ENGINE  — PuzzleBlocksMachine (bottom of this file): the physical
//      interaction loop every mode shares. Prompt -> three bumpable answer
//      blocks -> feedback -> candy -> next puzzle. Handles pool shuffling
//      with no-repeat, selection lock + per-block cooldown, wobble/fly/hold
//      animation phases, the reward hook, and the block solids.
//   2. MODE    — a small config object giving the engine its semantics
//      (round generation, prompt rendering, choice rendering). Letter Blocks
//      is the first mode; Ending Letters / Count the Objects / Pattern
//      Blocks are the planned next three.
//   3. CONTENT — data tables like LB_WORDS below. Keep content out of the
//      engine so new material never touches interaction code.
// Multi-step/ordered-answer support (Build-the-Word, Sequence Blocks) is
// deliberately NOT built yet — extend the engine when a real mode needs it.

const LB_WORDS = [
  { word: 'cat',   prompt: '_AT',   correct: 'C', distractors: ['B', 'H'] },
  { word: 'dog',   prompt: '_OG',   correct: 'D', distractors: ['F', 'L'] },
  { word: 'pig',   prompt: '_IG',   correct: 'P', distractors: ['B', 'D'] },
  { word: 'fox',   prompt: '_OX',   correct: 'F', distractors: ['B', 'S'] },
  { word: 'bug',   prompt: '_UG',   correct: 'B', distractors: ['R', 'M'] },
  { word: 'fish',  prompt: '_ISH',  correct: 'F', distractors: ['D', 'W'] },
  { word: 'bird',  prompt: '_IRD',  correct: 'B', distractors: ['G', 'T'] },
  { word: 'frog',  prompt: '_ROG',  correct: 'F', distractors: ['D', 'P'] },
  { word: 'duck',  prompt: '_UCK',  correct: 'D', distractors: ['L', 'T'] },
  { word: 'bear',  prompt: '_EAR',  correct: 'B', distractors: ['P', 'W'] },
  { word: 'ball',  prompt: '_ALL',  correct: 'B', distractors: ['F', 'T'] },
  { word: 'book',  prompt: '_OOK',  correct: 'B', distractors: ['C', 'H'] },
  { word: 'bed',   prompt: '_ED',   correct: 'B', distractors: ['R', 'W'] },
  { word: 'cup',   prompt: '_UP',   correct: 'C', distractors: ['P', 'S'] },
  { word: 'hat',   prompt: '_AT',   correct: 'H', distractors: ['B', 'C'] },
  { word: 'car',   prompt: '_AR',   correct: 'C', distractors: ['F', 'J'] },
  { word: 'sun',   prompt: '_UN',   correct: 'S', distractors: ['R', 'F'] },
  { word: 'moon',  prompt: '_OON',  correct: 'M', distractors: ['N', 'S'] },
  { word: 'tree',  prompt: '_REE',  correct: 'T', distractors: ['F', 'G'] },
  { word: 'apple', prompt: '_PPLE', correct: 'A', distractors: ['O', 'U'] },
  // ---- v1.19.0 expansion: 40 more words, deepening the word families ----
  { word: 'bat',   prompt: '_AT',   correct: 'B', distractors: ['C', 'H'] },
  { word: 'log',   prompt: '_OG',   correct: 'L', distractors: ['D', 'F'] },
  { word: 'box',   prompt: '_OX',   correct: 'B', distractors: ['F', 'D'] },
  { word: 'van',   prompt: '_AN',   correct: 'V', distractors: ['F', 'C'] },
  { word: 'can',   prompt: '_AN',   correct: 'C', distractors: ['V', 'P'] },
  { word: 'fan',   prompt: '_AN',   correct: 'F', distractors: ['P', 'V'] },
  { word: 'pan',   prompt: '_AN',   correct: 'P', distractors: ['C', 'F'] },
  { word: 'bee',   prompt: '_EE',   correct: 'B', distractors: ['T', 'S'] },
  { word: 'cow',   prompt: '_OW',   correct: 'C', distractors: ['W', 'B'] },
  { word: 'owl',   prompt: '_WL',   correct: 'O', distractors: ['A', 'E'] },
  { word: 'ant',   prompt: '_NT',   correct: 'A', distractors: ['E', 'U'] },
  { word: 'crab',  prompt: '_RAB',  correct: 'C', distractors: ['G', 'D'] },
  { word: 'snail', prompt: '_NAIL', correct: 'S', distractors: ['T', 'M'] },
  { word: 'sheep', prompt: '_HEEP', correct: 'S', distractors: ['C', 'W'] },
  { word: 'goat',  prompt: '_OAT',  correct: 'G', distractors: ['B', 'C'] },
  { word: 'boat',  prompt: '_OAT',  correct: 'B', distractors: ['G', 'F'] },
  { word: 'lion',  prompt: '_ION',  correct: 'L', distractors: ['T', 'N'] },
  { word: 'mouse', prompt: '_OUSE', correct: 'M', distractors: ['H', 'N'] },
  { word: 'house', prompt: '_OUSE', correct: 'H', distractors: ['M', 'R'] },
  { word: 'whale', prompt: '_HALE', correct: 'W', distractors: ['S', 'T'] },
  { word: 'snake', prompt: '_NAKE', correct: 'S', distractors: ['C', 'F'] },
  { word: 'cake',  prompt: '_AKE',  correct: 'C', distractors: ['S', 'L'] },
  { word: 'key',   prompt: '_EY',   correct: 'K', distractors: ['C', 'T'] },
  { word: 'kite',  prompt: '_ITE',  correct: 'K', distractors: ['B', 'T'] },
  { word: 'sock',  prompt: '_OCK',  correct: 'S', distractors: ['R', 'L'] },
  { word: 'shoe',  prompt: '_HOE',  correct: 'S', distractors: ['C', 'T'] },
  { word: 'star',  prompt: '_TAR',  correct: 'S', distractors: ['C', 'F'] },
  { word: 'drum',  prompt: '_RUM',  correct: 'D', distractors: ['B', 'G'] },
  { word: 'bell',  prompt: '_ELL',  correct: 'B', distractors: ['S', 'T'] },
  { word: 'nest',  prompt: '_EST',  correct: 'N', distractors: ['R', 'B'] },
  { word: 'ring',  prompt: '_ING',  correct: 'R', distractors: ['K', 'S'] },
  { word: 'king',  prompt: '_ING',  correct: 'K', distractors: ['R', 'S'] },
  { word: 'bus',   prompt: '_US',   correct: 'B', distractors: ['G', 'D'] },
  { word: 'train', prompt: '_RAIN', correct: 'T', distractors: ['B', 'C'] },
  { word: 'truck', prompt: '_RUCK', correct: 'T', distractors: ['D', 'L'] },
  { word: 'egg',   prompt: '_GG',   correct: 'E', distractors: ['A', 'O'] },
  { word: 'leaf',  prompt: '_EAF',  correct: 'L', distractors: ['B', 'F'] },
  { word: 'flag',  prompt: '_LAG',  correct: 'F', distractors: ['B', 'C'] },
  { word: 'crown', prompt: '_ROWN', correct: 'C', distractors: ['B', 'F'] },
  { word: 'robot', prompt: '_OBOT', correct: 'R', distractors: ['B', 'T'] }
];

function shuffleLB(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function lbFill(ctx, color) { ctx.fillStyle = color; }
function lbCircle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
function lbEllipse(ctx, x, y, rx, ry, rot) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU); ctx.fill();
}
function lbEar(ctx, x0, y0, x1, y1, x2, y2) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath(); ctx.fill();
}

function lbLeg(ctx, x0, y0, kx, ky, x1, y1, color, w) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(kx, ky); ctx.lineTo(x1, y1); ctx.stroke();
}

// Second-generation icons (v1.19.0): drawn batch-by-batch with a
// contact-sheet screenshot review loop — every icon individually verified
// at in-game size (s=190) against the sky background for the one test that
// matters: a 5-year-old names it instantly. Silhouette first; at most one
// face per icon and only where a face is natural; no globalCompositeOperation
// (icons draw straight onto the live scene).
const LB_ICONS = {
  // ---- batch 1: mammals ----
  cat(ctx, cx, cy, s) {
    ctx.save();
    // ears (large triangles) behind head
    lbFill(ctx, '#f0a04b');
    lbEar(ctx, cx - s*0.44, cy - s*0.18, cx - s*0.5, cy - s*0.62, cx - s*0.06, cy - s*0.32);
    lbEar(ctx, cx + s*0.44, cy - s*0.18, cx + s*0.5, cy - s*0.62, cx + s*0.06, cy - s*0.32);
    lbFill(ctx, '#ffc98a');
    lbEar(ctx, cx - s*0.36, cy - s*0.24, cx - s*0.4, cy - s*0.5, cx - s*0.14, cy - s*0.3);
    lbEar(ctx, cx + s*0.36, cy - s*0.24, cx + s*0.4, cy - s*0.5, cx + s*0.14, cy - s*0.3);
    // head
    lbFill(ctx, '#f0a04b');
    lbCircle(ctx, cx, cy, s*0.44);
    ctx.strokeStyle = '#a5601f'; ctx.lineWidth = s*0.03; ctx.stroke();
    // stripes
    ctx.strokeStyle = '#d9832e'; ctx.lineWidth = s*0.045; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - s*0.1, cy - s*0.42); ctx.lineTo(cx - s*0.06, cy - s*0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s*0.1, cy - s*0.42); ctx.lineTo(cx + s*0.06, cy - s*0.3); ctx.stroke();
    // muzzle patch
    lbFill(ctx, '#fff2df');
    lbEllipse(ctx, cx, cy + s*0.16, s*0.24, s*0.16);
    // nose
    ctx.fillStyle = '#ff8fa3';
    ctx.beginPath(); ctx.moveTo(cx - s*0.05, cy + s*0.03); ctx.lineTo(cx + s*0.05, cy + s*0.03); ctx.lineTo(cx, cy + s*0.1); ctx.closePath(); ctx.fill();
    // short whiskers (each <=12% of s)
    ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = s*0.018; ctx.lineCap = 'round';
    for (const dy of [-0.02, 0.05, 0.12]) {
      ctx.beginPath(); ctx.moveTo(cx - s*0.22, cy + s*dy + s*0.06); ctx.lineTo(cx - s*0.32, cy + s*dy + s*0.03); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + s*0.22, cy + s*dy + s*0.06); ctx.lineTo(cx + s*0.32, cy + s*dy + s*0.03); ctx.stroke();
    }
    drawFace(ctx, cx, cy - s*0.03, s, 'happy', 0, 1);
    ctx.restore();
  },

  dog(ctx, cx, cy, s) {
    ctx.save();
    // floppy hanging ears
    lbFill(ctx, '#8a5a34');
    lbEllipse(ctx, cx - s*0.44, cy - s*0.06, s*0.15, s*0.34, -0.2);
    lbEllipse(ctx, cx + s*0.44, cy - s*0.06, s*0.15, s*0.34, 0.2);
    // head
    lbFill(ctx, '#c98a4b');
    lbCircle(ctx, cx, cy - s*0.08, s*0.4);
    ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = s*0.03; ctx.stroke();
    // muzzle (light patch, sits below the eyes; drawFace's smile lands on its top edge)
    lbFill(ctx, '#f2dcb8');
    lbEllipse(ctx, cx, cy + s*0.22, s*0.25, s*0.2);
    ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = s*0.025; ctx.stroke();
    // nose, sits above the mouth
    lbFill(ctx, '#3a2a2a');
    lbEllipse(ctx, cx, cy + s*0.14, s*0.09, s*0.065);
    // tongue, below the mouth
    lbFill(ctx, '#ff8fa3');
    lbEllipse(ctx, cx + s*0.02, cy + s*0.36, s*0.07, s*0.11);
    drawFace(ctx, cx, cy - s*0.13, s, 'happy', 0, 2);
    ctx.restore();
  },

  pig(ctx, cx, cy, s) {
    ctx.save();
    // pointy ears
    lbFill(ctx, '#f4a8bf');
    lbEar(ctx, cx - s*0.3, cy - s*0.3, cx - s*0.38, cy - s*0.6, cx - s*0.08, cy - s*0.38);
    lbEar(ctx, cx + s*0.3, cy - s*0.3, cx + s*0.38, cy - s*0.6, cx + s*0.08, cy - s*0.38);
    // head
    lbFill(ctx, '#f9bccf');
    lbCircle(ctx, cx, cy, s*0.44);
    ctx.strokeStyle = '#d97a9a'; ctx.lineWidth = s*0.03; ctx.stroke();
    // big flat snout
    lbFill(ctx, '#f490ac');
    lbEllipse(ctx, cx, cy + s*0.2, s*0.24, s*0.16);
    ctx.strokeStyle = '#d05a80'; ctx.lineWidth = s*0.025; ctx.stroke();
    // nostrils
    lbFill(ctx, '#a83a5c');
    lbEllipse(ctx, cx - s*0.08, cy + s*0.2, s*0.035, s*0.05);
    lbEllipse(ctx, cx + s*0.08, cy + s*0.2, s*0.035, s*0.05);
    drawFace(ctx, cx, cy - s*0.06, s, 'happy', 0, 3);
    ctx.restore();
  },

  fox(ctx, cx, cy, s) {
    ctx.save();
    // bushy tail behind, white tip
    lbFill(ctx, '#e8712c');
    lbEllipse(ctx, cx + s*0.44, cy + s*0.3, s*0.19, s*0.3, 0.5);
    lbFill(ctx, '#fff6ea');
    lbEllipse(ctx, cx + s*0.54, cy + s*0.46, s*0.1, s*0.14, 0.5);
    // sharply pointed ears
    lbFill(ctx, '#e8712c');
    lbEar(ctx, cx - s*0.38, cy - s*0.14, cx - s*0.5, cy - s*0.58, cx - s*0.08, cy - s*0.3);
    lbEar(ctx, cx + s*0.38, cy - s*0.14, cx + s*0.5, cy - s*0.58, cx + s*0.08, cy - s*0.3);
    lbFill(ctx, '#3a2a2a');
    lbEar(ctx, cx - s*0.32, cy - s*0.2, cx - s*0.4, cy - s*0.46, cx - s*0.15, cy - s*0.28);
    lbEar(ctx, cx + s*0.32, cy - s*0.2, cx + s*0.4, cy - s*0.46, cx + s*0.15, cy - s*0.28);
    // head
    lbFill(ctx, '#e8712c');
    lbCircle(ctx, cx, cy, s*0.4);
    ctx.strokeStyle = '#a94e18'; ctx.lineWidth = s*0.03; ctx.stroke();
    // white muzzle wedge
    lbFill(ctx, '#fff6ea');
    ctx.beginPath();
    ctx.moveTo(cx - s*0.2, cy + s*0.06);
    ctx.lineTo(cx + s*0.2, cy + s*0.06);
    ctx.lineTo(cx, cy + s*0.34);
    ctx.closePath(); ctx.fill();
    // nose
    lbFill(ctx, '#3a2a2a');
    lbEllipse(ctx, cx, cy + s*0.24, s*0.05, s*0.04);
    drawFace(ctx, cx, cy - s*0.05, s, 'happy', 0, 4);
    ctx.restore();
  },

  bear(ctx, cx, cy, s) {
    ctx.save();
    // small round ears on top
    lbFill(ctx, '#8a5a34');
    lbCircle(ctx, cx - s*0.32, cy - s*0.36, s*0.14);
    lbCircle(ctx, cx + s*0.32, cy - s*0.36, s*0.14);
    lbFill(ctx, '#c99a6b');
    lbCircle(ctx, cx - s*0.32, cy - s*0.36, s*0.07);
    lbCircle(ctx, cx + s*0.32, cy - s*0.36, s*0.07);
    // head
    lbFill(ctx, '#8a5a34');
    lbCircle(ctx, cx, cy, s*0.46);
    ctx.strokeStyle = '#5f3c1f'; ctx.lineWidth = s*0.03; ctx.stroke();
    // lighter muzzle patch
    lbFill(ctx, '#e8c9a0');
    lbEllipse(ctx, cx, cy + s*0.2, s*0.22, s*0.17);
    // nose
    lbFill(ctx, '#3a2a2a');
    lbEllipse(ctx, cx, cy + s*0.1, s*0.06, s*0.045);
    ctx.strokeStyle = '#5f3c1f'; ctx.lineWidth = s*0.025; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy + s*0.14); ctx.lineTo(cx, cy + s*0.2); ctx.stroke();
    drawFace(ctx, cx, cy - s*0.06, s, 'happy', 0, 5);
    ctx.restore();
  },

  lion(ctx, cx, cy, s) {
    ctx.save();
    // shaggy mane ring
    lbFill(ctx, '#d98a1f');
    const maneN = 16;
    for (let i = 0; i < maneN; i++) {
      const a = (i / maneN) * TAU;
      const mx = cx + Math.cos(a) * s*0.42, my = cy + Math.sin(a) * s*0.42;
      lbCircle(ctx, mx, my, s*0.17);
    }
    lbCircle(ctx, cx, cy, s*0.5);
    // face
    lbFill(ctx, '#f4c874');
    lbCircle(ctx, cx, cy, s*0.32);
    ctx.strokeStyle = '#c98a1f'; ctx.lineWidth = s*0.02; ctx.stroke();
    // muzzle patch
    lbFill(ctx, '#fff2d8');
    lbEllipse(ctx, cx, cy + s*0.14, s*0.16, s*0.11);
    // nose
    lbFill(ctx, '#8a4a2a');
    ctx.beginPath(); ctx.moveTo(cx - s*0.04, cy + s*0.06); ctx.lineTo(cx + s*0.04, cy + s*0.06); ctx.lineTo(cx, cy + s*0.11); ctx.closePath(); ctx.fill();
    drawFace(ctx, cx, cy - s*0.03, s*0.85, 'happy', 0, 6);
    ctx.restore();
  },

  cow(ctx, cx, cy, s) {
    ctx.save();
    // small horns
    lbFill(ctx, '#d4c49a');
    lbEar(ctx, cx - s*0.22, cy - s*0.36, cx - s*0.3, cy - s*0.58, cx - s*0.1, cy - s*0.4);
    lbEar(ctx, cx + s*0.22, cy - s*0.36, cx + s*0.3, cy - s*0.58, cx + s*0.1, cy - s*0.4);
    ctx.strokeStyle = '#8a7444'; ctx.lineWidth = s*0.02;
    ctx.beginPath(); ctx.moveTo(cx - s*0.22, cy - s*0.36); ctx.lineTo(cx - s*0.3, cy - s*0.58); ctx.lineTo(cx - s*0.1, cy - s*0.4); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s*0.22, cy - s*0.36); ctx.lineTo(cx + s*0.3, cy - s*0.58); ctx.lineTo(cx + s*0.1, cy - s*0.4); ctx.closePath(); ctx.stroke();
    // ears
    lbFill(ctx, '#f4c8a0');
    lbEllipse(ctx, cx - s*0.44, cy - s*0.08, s*0.13, s*0.09, -0.3);
    lbEllipse(ctx, cx + s*0.44, cy - s*0.08, s*0.13, s*0.09, 0.3);
    // head white
    lbFill(ctx, '#fdfdfa');
    lbCircle(ctx, cx, cy, s*0.44);
    ctx.strokeStyle = '#333'; ctx.lineWidth = s*0.03; ctx.stroke();
    // black patches
    lbFill(ctx, '#2c2c2c');
    lbEllipse(ctx, cx - s*0.2, cy - s*0.22, s*0.14, s*0.11, 0.3);
    lbEllipse(ctx, cx + s*0.28, cy - s*0.02, s*0.1, s*0.15, -0.2);
    // wide pink muzzle
    lbFill(ctx, '#f7a8c0');
    lbEllipse(ctx, cx, cy + s*0.22, s*0.26, s*0.17);
    ctx.strokeStyle = '#c96a8f'; ctx.lineWidth = s*0.02; ctx.stroke();
    // nostrils
    lbFill(ctx, '#a8446c');
    lbEllipse(ctx, cx - s*0.09, cy + s*0.22, s*0.03, s*0.045);
    lbEllipse(ctx, cx + s*0.09, cy + s*0.22, s*0.03, s*0.045);
    drawFace(ctx, cx, cy - s*0.06, s, 'happy', 0, 7);
    ctx.restore();
  },

  sheep(ctx, cx, cy, s) {
    ctx.save();
    // little legs
    lbFill(ctx, '#4a3a2a');
    for (const dx of [-0.24, -0.09, 0.09, 0.24]) {
      rr(ctx, cx + s*dx - s*0.035, cy + s*0.4, s*0.07, s*0.18, s*0.03); ctx.fill();
    }
    // fluffy wool body: two solid-fill layers (no per-puff strokes, so overlaps
    // merge seamlessly) — a slightly bigger gray layer behind shows through as
    // a clean outline all around the cloud silhouette, no interior seams
    const puffs = [[-0.32,0.08,0.24],[-0.1,-0.04,0.28],[0.16,-0.04,0.28],[0.38,0.1,0.24],
                   [0.02,0.24,0.3],[-0.24,0.3,0.22],[0.26,0.3,0.22],[0.08,-0.22,0.2],[-0.16,-0.2,0.19]];
    lbFill(ctx, '#c9c2b0');
    for (const [dx,dy,r] of puffs) lbCircle(ctx, cx + s*dx, cy + s*dy, s*r*1.09);
    lbFill(ctx, '#fdfdf6');
    for (const [dx,dy,r] of puffs) lbCircle(ctx, cx + s*dx, cy + s*dy, s*r);
    // darker face, centered, drawn last so it sits cleanly on the wool
    lbFill(ctx, '#5a4a42');
    lbEllipse(ctx, cx, cy + s*0.02, s*0.19, s*0.22);
    ctx.strokeStyle = '#3a2e28'; ctx.lineWidth = s*0.02; ctx.stroke();
    // little ears either side of the face
    lbFill(ctx, '#5a4a42');
    lbEllipse(ctx, cx - s*0.24, cy + s*0.04, s*0.09, s*0.06, 0.5);
    lbEllipse(ctx, cx + s*0.24, cy + s*0.04, s*0.09, s*0.06, -0.5);
    drawFace(ctx, cx, cy - s*0.02, s*0.78, 'happy', 0, 8);
    ctx.restore();
  },

  goat(ctx, cx, cy, s) {
    ctx.save();
    // curved-back horns: dark outline stroke behind, lighter fill stroke on top
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#7a6438'; ctx.lineWidth = s*0.11;
    ctx.beginPath(); ctx.moveTo(cx - s*0.16, cy - s*0.36); ctx.quadraticCurveTo(cx - s*0.4, cy - s*0.5, cx - s*0.3, cy - s*0.62); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s*0.16, cy - s*0.36); ctx.quadraticCurveTo(cx + s*0.4, cy - s*0.5, cx + s*0.3, cy - s*0.62); ctx.stroke();
    ctx.strokeStyle = '#e8d8ae'; ctx.lineWidth = s*0.075;
    ctx.beginPath(); ctx.moveTo(cx - s*0.16, cy - s*0.36); ctx.quadraticCurveTo(cx - s*0.4, cy - s*0.5, cx - s*0.3, cy - s*0.62); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s*0.16, cy - s*0.36); ctx.quadraticCurveTo(cx + s*0.4, cy - s*0.5, cx + s*0.3, cy - s*0.62); ctx.stroke();
    // ears
    lbFill(ctx, '#e8d8b8');
    lbEllipse(ctx, cx - s*0.42, cy - s*0.06, s*0.13, s*0.08, -0.3);
    lbEllipse(ctx, cx + s*0.42, cy - s*0.06, s*0.13, s*0.08, 0.3);
    // head (tan/white)
    lbFill(ctx, '#f2e8d0');
    lbCircle(ctx, cx, cy, s*0.42);
    ctx.strokeStyle = '#b8a074'; ctx.lineWidth = s*0.03; ctx.stroke();
    // muzzle
    lbFill(ctx, '#fff8e8');
    lbEllipse(ctx, cx, cy + s*0.2, s*0.2, s*0.15);
    // nose
    lbFill(ctx, '#8a6a4a');
    lbEllipse(ctx, cx - s*0.06, cy + s*0.15, s*0.03, s*0.04);
    lbEllipse(ctx, cx + s*0.06, cy + s*0.15, s*0.03, s*0.04);
    // chin beard
    lbFill(ctx, '#e8d8b8');
    ctx.beginPath();
    ctx.moveTo(cx - s*0.08, cy + s*0.32);
    ctx.lineTo(cx + s*0.08, cy + s*0.32);
    ctx.lineTo(cx, cy + s*0.52);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#b8a074'; ctx.lineWidth = s*0.015; ctx.stroke();
    drawFace(ctx, cx, cy - s*0.04, s, 'happy', 0, 9);
    ctx.restore();
  },

  mouse(ctx, cx, cy, s) {
    ctx.save();
    // long thin tail
    ctx.strokeStyle = '#c8a8b0'; ctx.lineWidth = s*0.03; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + s*0.32, cy + s*0.34);
    ctx.quadraticCurveTo(cx + s*0.7, cy + s*0.3, cx + s*0.62, cy + s*0.62);
    ctx.stroke();
    // body (small, below head)
    lbFill(ctx, '#c9c1c6');
    lbEllipse(ctx, cx, cy + s*0.34, s*0.22, s*0.18);
    // HUGE round ears
    lbFill(ctx, '#c9c1c6');
    lbCircle(ctx, cx - s*0.34, cy - s*0.3, s*0.26);
    lbCircle(ctx, cx + s*0.34, cy - s*0.3, s*0.26);
    lbFill(ctx, '#f4b8c4');
    lbCircle(ctx, cx - s*0.34, cy - s*0.3, s*0.15);
    lbCircle(ctx, cx + s*0.34, cy - s*0.3, s*0.15);
    // small head
    lbFill(ctx, '#d8d0d4');
    lbCircle(ctx, cx, cy, s*0.26);
    ctx.strokeStyle = '#9a8f96'; ctx.lineWidth = s*0.02; ctx.stroke();
    // nose
    lbFill(ctx, '#e888a0');
    lbCircle(ctx, cx, cy + s*0.17, s*0.06);
    // whiskers (short)
    ctx.strokeStyle = '#8a7f86'; ctx.lineWidth = s*0.014;
    for (const dy of [0.1, 0.16, 0.22]) {
      ctx.beginPath(); ctx.moveTo(cx - s*0.14, cy + s*dy); ctx.lineTo(cx - s*0.24, cy + s*dy - s*0.02); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + s*0.14, cy + s*dy); ctx.lineTo(cx + s*0.24, cy + s*dy - s*0.02); ctx.stroke();
    }
    drawFace(ctx, cx, cy - s*0.03, s*0.62, 'happy', 0, 10);
    ctx.restore();
  },

  // ---- batch 2: critters ----
  // ---------------------------------------------------------------- bug (ladybug)
  bug(ctx, cx, cy, s) {
    const bx = cx, by = cy + s * 0.06;
    // legs first (under the shell)
    for (const sd of [-1, 1]) {
      for (const dy of [-0.14, 0.02, 0.18]) {
        lbLeg(ctx, bx + sd * s * 0.3, by + s * dy,
          bx + sd * s * 0.44, by + s * (dy + 0.1),
          bx + sd * s * 0.5, by + s * (dy + 0.22),
          '#241f21', Math.max(2, s * 0.025));
      }
    }
    // red dome shell
    lbFill(ctx, '#e8433a'); lbEllipse(ctx, bx, by, s * 0.4, s * 0.33);
    // wing-case split down the middle
    ctx.strokeStyle = '#241f21'; ctx.lineWidth = Math.max(2, s * 0.03);
    ctx.beginPath(); ctx.moveTo(bx, by - s * 0.3); ctx.lineTo(bx, by + s * 0.3); ctx.stroke();
    // black spots
    lbFill(ctx, '#241f21');
    lbCircle(ctx, bx - s * 0.2, by - s * 0.12, s * 0.055);
    lbCircle(ctx, bx - s * 0.24, by + s * 0.12, s * 0.055);
    lbCircle(ctx, bx + s * 0.2, by - s * 0.12, s * 0.055);
    lbCircle(ctx, bx + s * 0.24, by + s * 0.12, s * 0.055);
    lbCircle(ctx, bx - s * 0.02, by + s * 0.02, s * 0.05);
    // black head
    const hx = cx, hy = cy - s * 0.32;
    lbFill(ctx, '#241f21'); lbCircle(ctx, hx, hy, s * 0.18);
    // antennae
    ctx.strokeStyle = '#241f21'; ctx.lineWidth = Math.max(2, s * 0.025);
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(hx + sd * s * 0.08, hy - s * 0.12);
      ctx.quadraticCurveTo(hx + sd * s * 0.2, hy - s * 0.3, hx + sd * s * 0.24, hy - s * 0.38); ctx.stroke();
      lbFill(ctx, '#e8433a'); lbCircle(ctx, hx + sd * s * 0.24, hy - s * 0.38, s * 0.03);
    }
    drawFace(ctx, hx, hy, s * 0.55, 'happy', 0, 11);
  },

  // ---------------------------------------------------------------- bee
  bee(ctx, cx, cy, s) {
    // wings behind the body
    ctx.save();
    ctx.globalAlpha = 0.85; lbFill(ctx, '#eaf6ff');
    lbEllipse(ctx, cx - s * 0.18, cy - s * 0.4, s * 0.26, s * 0.18, -0.5);
    lbEllipse(ctx, cx + s * 0.18, cy - s * 0.4, s * 0.26, s * 0.18, 0.5);
    ctx.restore();
    ctx.strokeStyle = '#5fa8d8'; ctx.lineWidth = Math.max(2, s * 0.025);
    ctx.beginPath(); ctx.ellipse(cx - s * 0.18, cy - s * 0.4, s * 0.26, s * 0.18, -0.5, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx + s * 0.18, cy - s * 0.4, s * 0.26, s * 0.18, 0.5, 0, TAU); ctx.stroke();
    // fat body
    lbFill(ctx, '#ffcc33'); lbEllipse(ctx, cx, cy + s * 0.04, s * 0.4, s * 0.34);
    // black stripes, clipped to the body oval
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.04, s * 0.4, s * 0.34, 0, 0, TAU); ctx.clip();
    lbFill(ctx, '#241f21');
    for (const dx of [-0.28, -0.02, 0.24]) {
      ctx.beginPath(); ctx.ellipse(cx + s * dx, cy + s * 0.04, s * 0.08, s * 0.4, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
    // stinger
    lbFill(ctx, '#241f21');
    ctx.beginPath(); ctx.moveTo(cx + s * 0.4, cy + s * 0.04); ctx.lineTo(cx + s * 0.54, cy + s * 0.1); ctx.lineTo(cx + s * 0.4, cy + s * 0.16); ctx.closePath(); ctx.fill();
    // antennae
    ctx.strokeStyle = '#241f21'; ctx.lineWidth = Math.max(2, s * 0.025);
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(cx + sd * s * 0.1, cy - s * 0.28);
      ctx.quadraticCurveTo(cx + sd * s * 0.2, cy - s * 0.46, cx + sd * s * 0.22, cy - s * 0.52); ctx.stroke();
      lbCircle(ctx, cx + sd * s * 0.22, cy - s * 0.52, s * 0.03);
    }
    drawFace(ctx, cx, cy - s * 0.02, s * 0.8, 'happy', 0, 12);
  },

  // ---------------------------------------------------------------- ant
  ant(ctx, cx, cy, s) {
    const midY = cy;
    // legs off the thorax (middle segment), three per side
    for (const sd of [-1, 1]) {
      for (const dy of [-0.14, 0.02, 0.18]) {
        lbLeg(ctx, cx + sd * s * 0.16, midY + s * dy,
          cx + sd * s * 0.4, midY + s * (dy + 0.08),
          cx + sd * s * 0.5, midY + s * (dy + 0.24),
          '#2e2016', Math.max(2, s * 0.03));
      }
    }
    lbFill(ctx, '#3b2a1c');
    ctx.strokeStyle = '#1a1109'; ctx.lineWidth = Math.max(2, s * 0.022);
    // abdomen (bottom, largest)
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.34, s * 0.26, s * 0.22, 0, 0, TAU); ctx.fill(); ctx.stroke();
    // thorax (middle) — lighter shade + its own outline so it reads as a
    // separate segment instead of blending into the abdomen
    lbFill(ctx, '#4d3826');
    ctx.beginPath(); ctx.arc(cx, midY, s * 0.18, 0, TAU); ctx.fill(); ctx.stroke();
    // head (top, small)
    const hx = cx, hy = cy - s * 0.32;
    lbFill(ctx, '#3b2a1c');
    ctx.beginPath(); ctx.arc(hx, hy, s * 0.16, 0, TAU); ctx.fill(); ctx.stroke();
    // antennae
    ctx.strokeStyle = '#3b2a1c'; ctx.lineWidth = Math.max(2, s * 0.025);
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(hx + sd * s * 0.06, hy - s * 0.12);
      ctx.quadraticCurveTo(hx + sd * s * 0.2, hy - s * 0.3, hx + sd * s * 0.22, hy - s * 0.4); ctx.stroke();
    }
    drawFace(ctx, hx, hy, s * 0.5, 'happy', 0, 13);
  },

  // ---------------------------------------------------------------- crab
  crab(ctx, cx, cy, s) {
    const by = cy + s * 0.1;
    // legs, three bent legs per side under the body
    for (const sd of [-1, 1]) {
      for (const dy of [-0.02, 0.12, 0.26]) {
        lbLeg(ctx, cx + sd * s * 0.34, by + s * 0.02,
          cx + sd * s * 0.5, by + s * dy,
          cx + sd * s * 0.6, by + s * (dy + 0.14),
          '#c9441f', Math.max(3, s * 0.035));
      }
    }
    // claw arms + big pincers held up
    for (const sd of [-1, 1]) {
      lbFill(ctx, '#ff7a45');
      ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = Math.max(2, s * 0.015);
      ctx.beginPath(); ctx.moveTo(cx + sd * s * 0.3, by - s * 0.1);
      ctx.quadraticCurveTo(cx + sd * s * 0.5, by - s * 0.5, cx + sd * s * 0.46, by - s * 0.66);
      ctx.lineTo(cx + sd * s * 0.34, by - s * 0.62);
      ctx.quadraticCurveTo(cx + sd * s * 0.34, by - s * 0.4, cx + sd * s * 0.2, by - s * 0.14);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // pincer claw (two-finger shape) at the tip
      lbFill(ctx, '#ff7a45');
      lbEllipse(ctx, cx + sd * s * 0.5, by - s * 0.68, s * 0.14, s * 0.1, sd * 0.3);
      lbFill(ctx, '#c9441f');
      ctx.beginPath();
      ctx.moveTo(cx + sd * s * 0.42, by - s * 0.72); ctx.lineTo(cx + sd * s * 0.62, by - s * 0.78);
      ctx.lineTo(cx + sd * s * 0.6, by - s * 0.7); ctx.lineTo(cx + sd * s * 0.44, by - s * 0.66); ctx.closePath(); ctx.fill();
    }
    // wide flat body
    lbFill(ctx, '#ff6b3d'); lbEllipse(ctx, cx, by, s * 0.42, s * 0.28);
    ctx.strokeStyle = '#c9441f'; ctx.lineWidth = Math.max(2, s * 0.02);
    ctx.beginPath(); ctx.ellipse(cx, by, s * 0.42, s * 0.28, 0, 0, TAU); ctx.stroke();
    // eye stalks poking up from the body, eyes hand-drawn (no drawFace — real
    // crab eyes sit on stalks, not a body face)
    for (const sd of [-1, 1]) {
      ctx.strokeStyle = '#c9441f'; ctx.lineWidth = Math.max(3, s * 0.035);
      ctx.beginPath(); ctx.moveTo(cx + sd * s * 0.14, by - s * 0.24); ctx.lineTo(cx + sd * s * 0.16, by - s * 0.44); ctx.stroke();
      lbFill(ctx, '#fff'); lbCircle(ctx, cx + sd * s * 0.16, by - s * 0.48, s * 0.09);
      lbFill(ctx, '#241f21'); lbCircle(ctx, cx + sd * s * 0.16, by - s * 0.48, s * 0.05);
    }
    // happy mouth
    ctx.strokeStyle = '#241f21'; ctx.lineWidth = Math.max(2, s * 0.02);
    ctx.beginPath(); ctx.arc(cx, by + s * 0.08, s * 0.12, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  },

  // ---------------------------------------------------------------- snail
  snail(ctx, cx, cy, s) {
    const bx = cx - s * 0.06, by = cy + s * 0.22;
    // soft body underneath, a long low arc from tail to head
    lbFill(ctx, '#dfae7a');
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.5, by + s * 0.12);
    ctx.quadraticCurveTo(cx - s * 0.5, by - s * 0.08, cx - s * 0.3, by - s * 0.1);
    ctx.quadraticCurveTo(cx + s * 0.02, by - s * 0.12, cx + s * 0.28, by - s * 0.02);
    ctx.quadraticCurveTo(cx + s * 0.4, by + s * 0.04, cx + s * 0.4, by + s * 0.16);
    ctx.quadraticCurveTo(cx + s * 0.1, by + s * 0.24, cx - s * 0.3, by + s * 0.22);
    ctx.quadraticCurveTo(cx - s * 0.44, by + s * 0.2, cx - s * 0.5, by + s * 0.12);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a8672e'; ctx.lineWidth = Math.max(2, s * 0.015); ctx.stroke();
    // shell (spiral dome) sitting above the body
    const shx = cx + s * 0.02, shy = cy - s * 0.12;
    lbFill(ctx, '#c97a3d'); lbCircle(ctx, shx, shy, s * 0.34);
    ctx.strokeStyle = '#8a4d20'; ctx.lineWidth = Math.max(2, s * 0.03);
    ctx.beginPath();
    ctx.moveTo(shx, shy);
    let ang = 0, rad = s * 0.03;
    ctx.moveTo(shx + rad, shy);
    for (let i = 1; i <= 60; i++) {
      ang = i * 0.28; rad = s * 0.03 + i * s * 0.0044;
      ctx.lineTo(shx + Math.cos(ang) * rad, shy + Math.sin(ang) * rad);
    }
    ctx.stroke();
    // head with two eye-stalk tentacles (hand-drawn eyes, no drawFace)
    const headx = cx - s * 0.42, heady = by - s * 0.02;
    lbFill(ctx, '#dfae7a'); lbEllipse(ctx, headx, heady, s * 0.1, s * 0.08);
    for (const sd of [-1, 1]) {
      const tipx = headx - s * 0.14 + sd * s * 0.14, tipy = heady - s * 0.34;
      ctx.strokeStyle = '#dfae7a'; ctx.lineWidth = Math.max(3, s * 0.032);
      ctx.beginPath(); ctx.moveTo(headx - s * 0.02 + sd * s * 0.04, heady - s * 0.02);
      ctx.quadraticCurveTo(headx - s * 0.1 + sd * s * 0.16, heady - s * 0.22, tipx, tipy);
      ctx.stroke();
      lbFill(ctx, '#fff'); lbCircle(ctx, tipx, tipy, s * 0.06);
      lbFill(ctx, '#241f21'); lbCircle(ctx, tipx, tipy, s * 0.03);
    }
    // small smile
    ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = Math.max(2, s * 0.015);
    ctx.beginPath(); ctx.arc(headx - s * 0.04, heady + s * 0.04, s * 0.05, 0.1 * Math.PI, 0.7 * Math.PI); ctx.stroke();
  },

  // ---------------------------------------------------------------- owl
  owl(ctx, cx, cy, s) {
    // folded wings behind the body
    lbFill(ctx, '#8a6038');
    lbEllipse(ctx, cx - s * 0.32, cy + s * 0.1, s * 0.14, s * 0.28, -0.15);
    lbEllipse(ctx, cx + s * 0.32, cy + s * 0.1, s * 0.14, s * 0.28, 0.15);
    // ear tufts
    lbFill(ctx, '#a9764a');
    lbEar(ctx, cx - s * 0.22, cy - s * 0.42, cx - s * 0.32, cy - s * 0.72, cx - s * 0.08, cy - s * 0.5);
    lbEar(ctx, cx + s * 0.22, cy - s * 0.42, cx + s * 0.32, cy - s * 0.72, cx + s * 0.08, cy - s * 0.5);
    // body
    lbFill(ctx, '#a9764a'); lbEllipse(ctx, cx, cy + s * 0.06, s * 0.36, s * 0.42);
    // pale face disc
    lbFill(ctx, '#e8c896'); lbCircle(ctx, cx, cy - s * 0.08, s * 0.28);
    // HUGE round eyes (hand-drawn — the whole point of an owl icon)
    for (const sd of [-1, 1]) {
      lbFill(ctx, '#fff'); lbCircle(ctx, cx + sd * s * 0.14, cy - s * 0.1, s * 0.16);
      ctx.strokeStyle = '#a9764a'; ctx.lineWidth = Math.max(2, s * 0.025);
      ctx.beginPath(); ctx.arc(cx + sd * s * 0.14, cy - s * 0.1, s * 0.16, 0, TAU); ctx.stroke();
      lbFill(ctx, '#241f21'); lbCircle(ctx, cx + sd * s * 0.14, cy - s * 0.1, s * 0.09);
      lbFill(ctx, '#fff'); lbCircle(ctx, cx + sd * s * 0.14 + s * 0.03, cy - s * 0.14, s * 0.025);
    }
    // beak
    lbFill(ctx, '#ff9f43');
    ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.02); ctx.lineTo(cx - s * 0.06, cy + s * 0.1); ctx.lineTo(cx + s * 0.06, cy + s * 0.1); ctx.closePath(); ctx.fill();
    // feet, standing
    lbFill(ctx, '#ff9f43');
    for (const sd of [-1, 1]) { rr(ctx, cx + sd * s * 0.2 - s * 0.05, cy + s * 0.42, s * 0.1, s * 0.06, s * 0.02); ctx.fill(); }
  },

  // ---------------------------------------------------------------- bird
  bird(ctx, cx, cy, s) {
    // stick legs planted below the body with a clear gap + small toed feet —
    // the main thing that separates a *standing* bird from a fish silhouette
    ctx.strokeStyle = '#ff9f43'; ctx.lineWidth = Math.max(3, s * 0.04); ctx.lineCap = 'round';
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(cx + sd * s * 0.1, cy + s * 0.3); ctx.lineTo(cx + sd * s * 0.12, cy + s * 0.56); ctx.stroke();
      const fx = cx + sd * s * 0.12, fy = cy + s * 0.56;
      ctx.beginPath(); ctx.moveTo(fx - s * 0.07, fy + s * 0.06); ctx.lineTo(fx, fy); ctx.lineTo(fx + s * 0.07, fy + s * 0.06); ctx.stroke();
    }
    // tail: a fan of THREE narrow feathers pointing up and away from the
    // beak (unlike a fish's single caudal wedge sitting on the body axis)
    lbFill(ctx, '#2f7fd8');
    for (const ang of [-0.75, -0.5, -0.25]) {
      ctx.save();
      ctx.translate(cx - s * 0.2, cy - s * 0.02);
      ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s * 0.34, -s * 0.05); ctx.lineTo(-s * 0.3, s * 0.06); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // round, plump, upright body (round, not a horizontal fish-shaped oval)
    lbFill(ctx, '#4aa3ff'); lbCircle(ctx, cx + s * 0.02, cy - s * 0.04, s * 0.32);
    // folded wing — a curved comma shape overlapping the side, not a fin
    lbFill(ctx, '#2f7fd8');
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.18);
    ctx.quadraticCurveTo(cx + s * 0.26, cy - s * 0.1, cx + s * 0.2, cy + s * 0.2);
    ctx.quadraticCurveTo(cx + s * 0.04, cy + s * 0.16, cx - s * 0.04, cy);
    ctx.closePath(); ctx.fill();
    // small triangle beak
    lbFill(ctx, '#ff9f43');
    ctx.beginPath(); ctx.moveTo(cx + s * 0.28, cy - s * 0.08); ctx.lineTo(cx + s * 0.46, cy - s * 0.02); ctx.lineTo(cx + s * 0.28, cy + s * 0.04); ctx.closePath(); ctx.fill();
    drawFace(ctx, cx + s * 0.12, cy - s * 0.12, s * 0.7, 'happy', 0, 17);
  },

  // ---------------------------------------------------------------- duck
  duck(ctx, cx, cy, s) {
    // feet
    lbFill(ctx, '#ff9f43');
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(cx + sd * s * 0.14, cy + s * 0.4); ctx.lineTo(cx + sd * s * 0.02, cy + s * 0.52);
      ctx.lineTo(cx + sd * s * 0.14, cy + s * 0.5); ctx.lineTo(cx + sd * s * 0.26, cy + s * 0.52);
      ctx.lineTo(cx + sd * s * 0.2, cy + s * 0.4); ctx.closePath(); ctx.fill();
    }
    // full round body
    lbFill(ctx, '#ffe156'); lbEllipse(ctx, cx, cy + s * 0.12, s * 0.38, s * 0.3);
    // wing
    lbFill(ctx, '#f0c93a'); lbEllipse(ctx, cx - s * 0.06, cy + s * 0.14, s * 0.16, s * 0.22, -0.2);
    // head
    lbFill(ctx, '#ffe156'); lbCircle(ctx, cx + s * 0.12, cy - s * 0.24, s * 0.24);
    // flat bill
    lbFill(ctx, '#ff9f43'); rr(ctx, cx + s * 0.22, cy - s * 0.28, s * 0.34, s * 0.14, s * 0.06); ctx.fill();
    drawFace(ctx, cx + s * 0.1, cy - s * 0.28, s * 0.62, 'happy', 0, 18);
  },

  // ---------------------------------------------------------------- bat
  bat(ctx, cx, cy, s) {
    // scalloped wings, both sides
    const wing = (sd) => {
      lbFill(ctx, '#4a3b5c');
      ctx.beginPath();
      ctx.moveTo(cx + sd * s * 0.1, cy - s * 0.14);
      ctx.lineTo(cx + sd * s * 0.5, cy - s * 0.5);
      ctx.quadraticCurveTo(cx + sd * s * 0.36, cy - s * 0.2, cx + sd * s * 0.68, cy - s * 0.08);
      ctx.quadraticCurveTo(cx + sd * s * 0.5, cy + s * 0.08, cx + sd * s * 0.6, cy + s * 0.3);
      ctx.quadraticCurveTo(cx + sd * s * 0.38, cy + s * 0.2, cx + sd * s * 0.36, cy + s * 0.4);
      ctx.quadraticCurveTo(cx + sd * s * 0.2, cy + s * 0.24, cx + sd * s * 0.1, cy + s * 0.1);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#241a30'; ctx.lineWidth = Math.max(2, s * 0.015); ctx.stroke();
    };
    wing(-1); wing(1);
    // ears
    lbFill(ctx, '#4a3b5c');
    lbEar(ctx, cx - s * 0.16, cy - s * 0.26, cx - s * 0.24, cy - s * 0.52, cx - s * 0.04, cy - s * 0.3);
    lbEar(ctx, cx + s * 0.16, cy - s * 0.26, cx + s * 0.24, cy - s * 0.52, cx + s * 0.04, cy - s * 0.3);
    // small round body
    lbFill(ctx, '#5c4a70'); lbCircle(ctx, cx, cy, s * 0.24);
    drawFace(ctx, cx, cy, s * 0.7, 'happy', 0, 19);
  },

  // ---------------------------------------------------------------- frog
  // CRITICAL: exactly one pupil per eye bump. No drawFace here — hand drawn.
  frog(ctx, cx, cy, s) {
    const by = cy + s * 0.14;
    // folded sitting legs
    lbFill(ctx, '#3fa858');
    lbEllipse(ctx, cx - s * 0.4, by + s * 0.18, s * 0.16, s * 0.12, -0.3);
    lbEllipse(ctx, cx + s * 0.4, by + s * 0.18, s * 0.16, s * 0.12, 0.3);
    // body
    lbFill(ctx, '#57c26b'); lbEllipse(ctx, cx, by, s * 0.42, s * 0.3);
    // two eye bumps on top
    lbFill(ctx, '#57c26b');
    lbCircle(ctx, cx - s * 0.22, cy - s * 0.24, s * 0.16);
    lbCircle(ctx, cx + s * 0.22, cy - s * 0.24, s * 0.16);
    // ONE eye per bump: white circle + single black pupil, centered on each bump
    for (const sd of [-1, 1]) {
      const ex = cx + sd * s * 0.22, ey = cy - s * 0.24;
      lbFill(ctx, '#fff'); lbCircle(ctx, ex, ey, s * 0.1);
      lbFill(ctx, '#241f21'); lbCircle(ctx, ex, ey, s * 0.05);
      lbFill(ctx, '#fff'); lbCircle(ctx, ex + s * 0.02, ey - s * 0.03, s * 0.02);
    }
    // wide happy mouth
    ctx.strokeStyle = '#241f21'; ctx.lineWidth = Math.max(2, s * 0.025);
    ctx.beginPath(); ctx.arc(cx, by - s * 0.02, s * 0.24, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke();
    // nostrils
    lbFill(ctx, '#2f8f45');
    lbCircle(ctx, cx - s * 0.05, by - s * 0.22, s * 0.02);
    lbCircle(ctx, cx + s * 0.05, by - s * 0.22, s * 0.02);
  },

  // ---- batch 3: nature ----
  fish(ctx, cx, cy, s) {
    ctx.save();
    // forked tail fin (two lobes so it reads as fish, not a blob)
    lbFill(ctx, '#ff8f3d');
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.36, cy - s * 0.03);
    ctx.lineTo(cx - s * 0.6, cy - s * 0.26);
    ctx.lineTo(cx - s * 0.46, cy);
    ctx.lineTo(cx - s * 0.6, cy + s * 0.26);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = s * 0.03; ctx.strokeStyle = '#c85a1a'; ctx.stroke();
    // body - elongated oval, longer than tall
    lbFill(ctx, '#ff9f43');
    lbEllipse(ctx, cx + s * 0.02, cy, s * 0.46, s * 0.24, 0);
    ctx.lineWidth = s * 0.04; ctx.strokeStyle = '#c85a1a'; ctx.stroke();
    // top fin
    lbFill(ctx, '#ffc36b');
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.08, cy - s * 0.2);
    ctx.lineTo(cx + s * 0.08, cy - s * 0.4);
    ctx.lineTo(cx + s * 0.22, cy - s * 0.17);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = s * 0.025; ctx.strokeStyle = '#c85a1a'; ctx.stroke();
    // bottom fin
    lbFill(ctx, '#ffc36b');
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.02, cy + s * 0.2);
    ctx.lineTo(cx + s * 0.1, cy + s * 0.36);
    ctx.lineTo(cx + s * 0.2, cy + s * 0.17);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = s * 0.025; ctx.strokeStyle = '#c85a1a'; ctx.stroke();
    // eye
    lbFill(ctx, '#fff');
    lbCircle(ctx, cx + s * 0.32, cy - s * 0.02, s * 0.09);
    lbFill(ctx, '#2a2a2a');
    lbCircle(ctx, cx + s * 0.35, cy - s * 0.02, s * 0.05);
    // bubbles
    ctx.strokeStyle = '#4aa3d8'; ctx.lineWidth = s * 0.02;
    ctx.beginPath(); ctx.arc(cx + s * 0.58, cy - s * 0.3, s * 0.045, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + s * 0.68, cy - s * 0.44, s * 0.032, 0, TAU); ctx.stroke();
    ctx.restore();
  },

  whale(ctx, cx, cy, s) {
    ctx.save();
    // shift whole whale down a touch so the spout has headroom within the icon box
    const dy = s * 0.1;
    // body
    lbFill(ctx, '#4aa3e0');
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.5, cy - s * 0.02 + dy);
    ctx.bezierCurveTo(cx - s * 0.5, cy - s * 0.38 + dy, cx - s * 0.1, cy - s * 0.46 + dy, cx + s * 0.28, cy - s * 0.34 + dy);
    ctx.bezierCurveTo(cx + s * 0.52, cy - s * 0.26 + dy, cx + s * 0.58, cy - s * 0.06 + dy, cx + s * 0.5, cy + s * 0.1 + dy);
    ctx.bezierCurveTo(cx + s * 0.3, cy + s * 0.3 + dy, cx - s * 0.15, cy + s * 0.32 + dy, cx - s * 0.36, cy + s * 0.22 + dy);
    ctx.bezierCurveTo(cx - s * 0.48, cy + s * 0.16 + dy, cx - s * 0.5, cy + s * 0.08 + dy, cx - s * 0.5, cy - s * 0.02 + dy);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = s * 0.04; ctx.strokeStyle = '#276a99'; ctx.stroke();
    // water spout from the blowhole (kept compact so it stays in-frame)
    const bx = cx + s * 0.02, by = cy - s * 0.44 + dy;
    ctx.strokeStyle = '#7fd3f0'; ctx.lineWidth = s * 0.045; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx, by - s * 0.22);
    ctx.moveTo(bx, by - s * 0.22);
    ctx.lineTo(bx - s * 0.11, by - s * 0.32);
    ctx.moveTo(bx, by - s * 0.22);
    ctx.lineTo(bx + s * 0.11, by - s * 0.32);
    ctx.stroke();
    lbFill(ctx, '#7fd3f0');
    lbCircle(ctx, bx - s * 0.13, by - s * 0.36, s * 0.04);
    lbCircle(ctx, bx + s * 0.13, by - s * 0.36, s * 0.04);
    lbCircle(ctx, bx, by - s * 0.26, s * 0.035);
    // belly
    lbFill(ctx, '#cdeeff');
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.42, cy + s * 0.05 + dy);
    ctx.bezierCurveTo(cx - s * 0.2, cy + s * 0.2 + dy, cx + s * 0.15, cy + s * 0.2 + dy, cx + s * 0.32, cy + s * 0.08 + dy);
    ctx.bezierCurveTo(cx + s * 0.1, cy + s * 0.28 + dy, cx - s * 0.25, cy + s * 0.26 + dy, cx - s * 0.42, cy + s * 0.05 + dy);
    ctx.closePath();
    ctx.fill();
    // small curved mouth (distinct from the belly patch)
    ctx.strokeStyle = '#276a99'; ctx.lineWidth = s * 0.025; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx + s * 0.18, cy - s * 0.06 + dy, s * 0.1, 0.1 * Math.PI, 0.6 * Math.PI);
    ctx.stroke();
    // tail flukes (up)
    lbFill(ctx, '#4aa3e0');
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.46, cy + s * 0.04 + dy);
    ctx.lineTo(cx - s * 0.68, cy - s * 0.2 + dy);
    ctx.lineTo(cx - s * 0.58, cy + s * 0.1 + dy);
    ctx.lineTo(cx - s * 0.72, cy + s * 0.18 + dy);
    ctx.lineTo(cx - s * 0.44, cy + s * 0.2 + dy);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = s * 0.035; ctx.strokeStyle = '#276a99'; ctx.stroke();
    // eye
    lbFill(ctx, '#26364a');
    lbCircle(ctx, cx - s * 0.24, cy - s * 0.14 + dy, s * 0.05);
    ctx.restore();
  },

  snake(ctx, cx, cy, s) {
    ctx.save();
    // dark outline pass (slightly thicker, drawn first so only edges peek through)
    ctx.strokeStyle = '#2f8a3d';
    ctx.lineWidth = s * 0.3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.5, cy + s * 0.42);
    ctx.bezierCurveTo(cx - s * 0.2, cy + s * 0.5, cx - s * 0.55, cy + s * 0.05, cx - s * 0.15, cy - s * 0.05);
    ctx.bezierCurveTo(cx + s * 0.15, cy - s * 0.13, cx - s * 0.1, cy - s * 0.42, cx + s * 0.22, cy - s * 0.44);
    ctx.stroke();
    // body fill pass (thinner, on top)
    ctx.strokeStyle = '#4cbb5c';
    ctx.lineWidth = s * 0.24;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.5, cy + s * 0.42);
    ctx.bezierCurveTo(cx - s * 0.2, cy + s * 0.5, cx - s * 0.55, cy + s * 0.05, cx - s * 0.15, cy - s * 0.05);
    ctx.bezierCurveTo(cx + s * 0.15, cy - s * 0.13, cx - s * 0.1, cy - s * 0.42, cx + s * 0.22, cy - s * 0.44);
    ctx.stroke();
    // diamond pattern markings along the body for scale texture
    lbFill(ctx, '#2f8a3d');
    const marks = [
      [cx - s * 0.4, cy + s * 0.36, -0.4],
      [cx - s * 0.28, cy + s * 0.14, -0.3],
      [cx - s * 0.2, cy - s * 0.1, 0.1],
      [cx - s * 0.02, cy - s * 0.28, 0.5]
    ];
    for (const [mx, my, rot] of marks) {
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.07);
      ctx.lineTo(s * 0.05, 0);
      ctx.lineTo(0, s * 0.07);
      ctx.lineTo(-s * 0.05, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // head - wider, flatter, distinct from the body tube (teardrop toward the snout)
    const hx = cx + s * 0.22, hy = cy - s * 0.44;
    lbFill(ctx, '#4cbb5c');
    ctx.beginPath();
    ctx.ellipse(hx, hy, s * 0.2, s * 0.15, 0.35, 0, TAU);
    ctx.fill();
    ctx.lineWidth = s * 0.025; ctx.strokeStyle = '#2f8a3d'; ctx.stroke();
    // eye with slit pupil
    lbFill(ctx, '#fff');
    lbCircle(ctx, hx + s * 0.05, hy - s * 0.08, s * 0.055);
    lbFill(ctx, '#222');
    ctx.save();
    ctx.translate(hx + s * 0.06, hy - s * 0.08);
    ctx.rotate(0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.014, s * 0.04, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    // forked tongue
    ctx.strokeStyle = '#e04040'; ctx.lineWidth = s * 0.025; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx + s * 0.16, hy + s * 0.06);
    ctx.lineTo(hx + s * 0.32, hy + s * 0.14);
    ctx.moveTo(hx + s * 0.32, hy + s * 0.14);
    ctx.lineTo(hx + s * 0.4, hy + s * 0.08);
    ctx.moveTo(hx + s * 0.32, hy + s * 0.14);
    ctx.lineTo(hx + s * 0.4, hy + s * 0.2);
    ctx.stroke();
    ctx.restore();
  },

  tree(ctx, cx, cy, s) {
    ctx.save();
    // trunk
    lbFill(ctx, '#8a5a2e');
    rr(ctx, cx - s * 0.08, cy + s * 0.1, s * 0.16, s * 0.42, s * 0.04);
    ctx.fill();
    ctx.lineWidth = s * 0.02; ctx.strokeStyle = '#5f3a1c'; ctx.stroke();
    // canopy - one continuous scalloped-blob path (lollipop with lobes),
    // built from a single bezier chain so the outline never has seams
    lbFill(ctx, '#4cae52');
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.62);
    ctx.bezierCurveTo(cx + s * 0.22, cy - s * 0.6, cx + s * 0.4, cy - s * 0.48, cx + s * 0.42, cy - s * 0.26);
    ctx.bezierCurveTo(cx + s * 0.44, cy - s * 0.06, cx + s * 0.52, cy + s * 0.02, cx + s * 0.4, cy + s * 0.14);
    ctx.bezierCurveTo(cx + s * 0.3, cy + s * 0.26, cx + s * 0.1, cy + s * 0.28, cx, cy + s * 0.2);
    ctx.bezierCurveTo(cx - s * 0.1, cy + s * 0.28, cx - s * 0.3, cy + s * 0.26, cx - s * 0.4, cy + s * 0.14);
    ctx.bezierCurveTo(cx - s * 0.52, cy + s * 0.02, cx - s * 0.44, cy - s * 0.06, cx - s * 0.42, cy - s * 0.26);
    ctx.bezierCurveTo(cx - s * 0.4, cy - s * 0.48, cx - s * 0.22, cy - s * 0.6, cx, cy - s * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = s * 0.03; ctx.strokeStyle = '#2f7a38'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  },

  leaf(ctx, cx, cy, s) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.55);
    // leaf blade
    lbFill(ctx, '#57c25f');
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.5);
    ctx.bezierCurveTo(s * 0.42, -s * 0.32, s * 0.42, s * 0.32, 0, s * 0.5);
    ctx.bezierCurveTo(-s * 0.42, s * 0.32, -s * 0.42, -s * 0.32, 0, -s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = s * 0.035; ctx.strokeStyle = '#2f8a3d'; ctx.stroke();
    // midrib
    ctx.strokeStyle = '#2f8a3d'; ctx.lineWidth = s * 0.03; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.46);
    ctx.lineTo(0, s * 0.46);
    ctx.stroke();
    // side veins
    ctx.lineWidth = s * 0.02;
    for (let i = 1; i <= 3; i++) {
      const y = -s * 0.28 + i * s * 0.22;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(s * 0.24, y - s * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(-s * 0.24, y - s * 0.1);
      ctx.stroke();
    }
    // stem
    ctx.strokeStyle = '#2f8a3d'; ctx.lineWidth = s * 0.045; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, s * 0.46);
    ctx.lineTo(0, s * 0.66);
    ctx.stroke();
    ctx.restore();
  },

  sun(ctx, cx, cy, s) {
    ctx.save();
    // rays
    lbFill(ctx, '#ffcf3d');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-s * 0.06, -s * 0.42);
      ctx.lineTo(s * 0.06, -s * 0.42);
      ctx.lineTo(0, -s * 0.68);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // face circle
    lbFill(ctx, '#ffd84d');
    lbCircle(ctx, cx, cy, s * 0.42);
    ctx.lineWidth = s * 0.03; ctx.strokeStyle = '#e0a020'; ctx.stroke();
    drawFace(ctx, cx, cy, s * 0.8, 'happy', 0, 26);
    ctx.restore();
  },

  moon(ctx, cx, cy, s) {
    ctx.save();
    // crescent as closed path: outer circle arc + inner offset circle arc (evenodd not needed if wound correctly)
    const R = s * 0.42;
    const offX = s * 0.22, offY = -s * 0.06;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0.5 * Math.PI, 1.5 * Math.PI, false);
    ctx.arc(cx + offX, cy + offY, R * 0.92, 1.5 * Math.PI, 0.5 * Math.PI, true);
    ctx.closePath();
    lbFill(ctx, '#fff3c4');
    ctx.fill();
    ctx.lineWidth = s * 0.03; ctx.strokeStyle = '#d8b860'; ctx.stroke();
    // gentle face on the crescent body (left side, where the moon is widest)
    drawFace(ctx, cx - s * 0.14, cy, s * 0.55, 'happy', 0, 27);
    ctx.restore();
  },

  star(ctx, cx, cy, s) {
    ctx.save();
    starPath(ctx, cx, cy, s * 0.5, s * 0.2, 5);
    lbFill(ctx, '#ffd94a');
    ctx.fill();
    ctx.lineWidth = s * 0.045; ctx.strokeStyle = '#d69a12'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  },

  egg(ctx, cx, cy, s) {
    ctx.save();
    // egg shape via bezier (wider bottom, narrower top)
    lbFill(ctx, '#fff8e8');
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.5);
    ctx.bezierCurveTo(cx + s * 0.36, cy - s * 0.5, cx + s * 0.42, cy + s * 0.1, cx + s * 0.34, cy + s * 0.32);
    ctx.bezierCurveTo(cx + s * 0.24, cy + s * 0.52, cx - s * 0.24, cy + s * 0.52, cx - s * 0.34, cy + s * 0.32);
    ctx.bezierCurveTo(cx - s * 0.42, cy + s * 0.1, cx - s * 0.36, cy - s * 0.5, cx, cy - s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = s * 0.035; ctx.strokeStyle = '#c9a54a'; ctx.stroke();
    // subtle shading swash on one side (offset, not centered, so it never reads as a mouth)
    lbFill(ctx, 'rgba(190,160,100,0.22)');
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.2, cy + s * 0.22, s * 0.13, s * 0.22, -0.3, 0, TAU);
    ctx.fill();
    // speckles
    lbFill(ctx, '#e8c878');
    lbCircle(ctx, cx - s * 0.12, cy - s * 0.14, s * 0.03);
    lbCircle(ctx, cx + s * 0.14, cy - s * 0.02, s * 0.025);
    lbCircle(ctx, cx - s * 0.02, cy + s * 0.18, s * 0.03);
    lbCircle(ctx, cx + s * 0.08, cy + s * 0.3, s * 0.02);
    ctx.restore();
  },

  apple(ctx, cx, cy, s) {
    ctx.save();
    // body
    lbFill(ctx, '#ef3f3f');
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.3);
    ctx.bezierCurveTo(cx + s * 0.18, cy - s * 0.46, cx + s * 0.46, cy - s * 0.34, cx + s * 0.46, cy - s * 0.04);
    ctx.bezierCurveTo(cx + s * 0.46, cy + s * 0.34, cx + s * 0.22, cy + s * 0.54, cx, cy + s * 0.54);
    ctx.bezierCurveTo(cx - s * 0.22, cy + s * 0.54, cx - s * 0.46, cy + s * 0.34, cx - s * 0.46, cy - s * 0.04);
    ctx.bezierCurveTo(cx - s * 0.46, cy - s * 0.34, cx - s * 0.18, cy - s * 0.46, cx, cy - s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = s * 0.035; ctx.strokeStyle = '#a01e1e'; ctx.stroke();
    // top dimple shading
    lbFill(ctx, '#ff7f7f');
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.16, cy - s * 0.1, s * 0.12, s * 0.18, -0.4, 0, TAU);
    ctx.fill();
    // stem
    ctx.strokeStyle = '#6b3f1d'; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.02, cy - s * 0.32);
    ctx.quadraticCurveTo(cx + s * 0.1, cy - s * 0.5, cx + s * 0.04, cy - s * 0.58);
    ctx.stroke();
    // leaf
    lbFill(ctx, '#4cae52');
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.2, cy - s * 0.46, s * 0.14, s * 0.08, -0.5, 0, TAU);
    ctx.fill();
    ctx.lineWidth = s * 0.02; ctx.strokeStyle = '#2f7a38'; ctx.stroke();
    // face
    drawFace(ctx, cx, cy + s * 0.02, s * 0.62, 'happy', 0, 30);
    ctx.restore();
  },

  // ---- batch 4: vehicles ----
  car(ctx, cx, cy, s) {
    ctx.save();
    const wheel = (wx, wy, wr) => {
      lbFill(ctx, '#222'); lbCircle(ctx, wx, wy, wr);
      lbFill(ctx, '#888'); lbCircle(ctx, wx, wy, wr * 0.42);
      lbFill(ctx, '#555'); lbCircle(ctx, wx, wy, wr * 0.14);
    };
    ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.022; ctx.strokeStyle = '#7a1414';
    const bw = s * 0.88, bh = s * 0.28, bx = cx - bw / 2, by = cy + s * 0.06;
    lbFill(ctx, '#e6392f');
    rr(ctx, bx, by, bw, bh, s * 0.08); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - bw * 0.36, by);
    ctx.lineTo(cx - bw * 0.24, by - s * 0.24);
    ctx.lineTo(cx + bw * 0.20, by - s * 0.24);
    ctx.lineTo(cx + bw * 0.36, by);
    ctx.closePath();
    lbFill(ctx, '#e6392f'); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#7a1414';
    lbFill(ctx, '#bfeeff');
    ctx.beginPath();
    ctx.moveTo(cx - bw * 0.32, by - s * 0.02);
    ctx.lineTo(cx - bw * 0.22, by - s * 0.20);
    ctx.lineTo(cx - s * 0.02, by - s * 0.20);
    ctx.lineTo(cx - s * 0.02, by - s * 0.02);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.02, by - s * 0.02);
    ctx.lineTo(cx + s * 0.02, by - s * 0.20);
    ctx.lineTo(cx + bw * 0.18, by - s * 0.20);
    ctx.lineTo(cx + bw * 0.32, by - s * 0.02);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    const wy = by + bh, wr = s * 0.15;
    wheel(cx - bw * 0.27, wy, wr);
    wheel(cx + bw * 0.27, wy, wr);
    ctx.restore();
  },

  van(ctx, cx, cy, s) {
    ctx.save();
    const wheel = (wx, wy, wr) => {
      lbFill(ctx, '#222'); lbCircle(ctx, wx, wy, wr);
      lbFill(ctx, '#888'); lbCircle(ctx, wx, wy, wr * 0.42);
      lbFill(ctx, '#555'); lbCircle(ctx, wx, wy, wr * 0.14);
    };
    ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.022; ctx.strokeStyle = '#0d3a5c';
    const bw = s * 0.86, bh = s * 0.56, bx = cx - bw / 2, by = cy - s * 0.22;
    lbFill(ctx, '#4a90d9');
    rr(ctx, bx, by, bw, bh, s * 0.06); ctx.fill(); ctx.stroke();
    lbFill(ctx, '#bfeeff');
    const wy0 = by + s * 0.09, wy1 = by + s * 0.30;
    rr(ctx, bx + s * 0.07, wy0, bw - s * 0.14, wy1 - wy0, s * 0.02); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#0d3a5c';
    ctx.beginPath(); ctx.moveTo(bx + bw * 0.40, wy0 - 1); ctx.lineTo(bx + bw * 0.40, wy1); ctx.stroke();
    const doorX = bx + bw * 0.66;
    ctx.beginPath(); ctx.moveTo(doorX, wy0 - 1); ctx.lineTo(doorX, by + bh - s * 0.02); ctx.stroke();
    ctx.lineWidth = s * 0.03; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(doorX + s * 0.04, by + bh * 0.62); ctx.lineTo(doorX + s * 0.11, by + bh * 0.62); ctx.stroke();
    const wy = by + bh, wr = s * 0.15;
    wheel(cx - bw * 0.29, wy, wr);
    wheel(cx + bw * 0.29, wy, wr);
    ctx.restore();
  },

  bus(ctx, cx, cy, s) {
    ctx.save();
    const wheel = (wx, wy, wr) => {
      lbFill(ctx, '#222'); lbCircle(ctx, wx, wy, wr);
      lbFill(ctx, '#888'); lbCircle(ctx, wx, wy, wr * 0.42);
      lbFill(ctx, '#555'); lbCircle(ctx, wx, wy, wr * 0.14);
    };
    ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.02; ctx.strokeStyle = '#8a6400';
    const bw = s * 1.06, bh = s * 0.42, bx = cx - bw / 2, by = cy - s * 0.15;
    lbFill(ctx, '#ffd23f');
    rr(ctx, bx, by, bw, bh, s * 0.06); ctx.fill(); ctx.stroke();
    lbFill(ctx, '#bfeeff');
    const winY = by + s * 0.075, winH = s * 0.155, winCount = 5, gap = s * 0.02;
    const totalW = bw - s * 0.12;
    const winW = (totalW - gap * (winCount - 1)) / winCount;
    for (let i = 0; i < winCount; i++) {
      const wx = bx + s * 0.06 + i * (winW + gap);
      rr(ctx, wx, winY, winW, winH, s * 0.018); ctx.fill(); ctx.stroke();
    }
    lbFill(ctx, '#333');
    rr(ctx, bx + s * 0.02, by + bh - s * 0.065, bw - s * 0.04, s * 0.05, s * 0.015); ctx.fill();
    const wy = by + bh, wr = s * 0.135;
    wheel(bx + bw * 0.18, wy, wr);
    wheel(bx + bw * 0.82, wy, wr);
    ctx.restore();
  },

  train(ctx, cx, cy, s) {
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.02; ctx.strokeStyle = '#12241a';
    const boilerH = s * 0.30, boilerY0 = cy - s * 0.06 - boilerH / 2;
    const boilerX0 = cx - s * 0.48, boilerX1 = cx + s * 0.08;
    lbFill(ctx, '#2f6b3c');
    rr(ctx, boilerX0, boilerY0, boilerX1 - boilerX0, boilerH, boilerH / 2); ctx.fill(); ctx.stroke();
    const cabW = s * 0.34, cabH = s * 0.46, cabX = boilerX1 - s * 0.03, cabY = boilerY0 + boilerH - cabH;
    lbFill(ctx, '#2f6b3c');
    rr(ctx, cabX, cabY, cabW, cabH, s * 0.05); ctx.fill(); ctx.stroke();
    lbFill(ctx, '#bfeeff');
    rr(ctx, cabX + cabW * 0.22, cabY + cabH * 0.14, cabW * 0.56, cabH * 0.32, s * 0.025); ctx.fill(); ctx.stroke();
    const chimX = boilerX0 + s * 0.16, chimW = s * 0.14, chimH = s * 0.20, chimY = boilerY0 - chimH + s * 0.03;
    lbFill(ctx, '#1a1a1a');
    rr(ctx, chimX - chimW / 2, chimY, chimW, chimH, s * 0.03); ctx.fill(); ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.85;
    lbFill(ctx, '#f4f4f4');
    [[chimX - s * 0.01, chimY - s * 0.09, s * 0.075], [chimX + s * 0.07, chimY - s * 0.19, s * 0.065], [chimX + s * 0.02, chimY - s * 0.28, s * 0.05]].forEach(p => {
      ctx.beginPath(); ctx.arc(p[0], p[1], p[2], 0, TAU); ctx.fill();
      ctx.strokeStyle = '#cfcfcf'; ctx.lineWidth = s * 0.01; ctx.stroke();
    });
    ctx.restore();
    lbFill(ctx, '#333'); ctx.strokeStyle = '#12241a'; ctx.lineWidth = s * 0.02;
    ctx.beginPath();
    ctx.moveTo(boilerX0 + s * 0.03, boilerY0 + boilerH);
    ctx.lineTo(boilerX0 - s * 0.05, boilerY0 + boilerH + s * 0.13);
    ctx.lineTo(boilerX0 + s * 0.15, boilerY0 + boilerH);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    const wy = boilerY0 + boilerH + s * 0.02, wr = s * 0.185;
    [boilerX0 + s * 0.16, cx - s * 0.02, cabX + cabW * 0.75].forEach(wx => {
      lbFill(ctx, '#1a1a1a'); lbCircle(ctx, wx, wy, wr);
      lbFill(ctx, '#c33'); lbCircle(ctx, wx, wy, wr * 0.32);
      ctx.strokeStyle = '#c33'; ctx.lineWidth = s * 0.02;
      for (let a = 0; a < 4; a++) {
        const ang = a * Math.PI / 2 + 0.4;
        ctx.beginPath();
        ctx.moveTo(wx + Math.cos(ang) * wr * 0.28, wy + Math.sin(ang) * wr * 0.28);
        ctx.lineTo(wx + Math.cos(ang) * wr * 0.9, wy + Math.sin(ang) * wr * 0.9);
        ctx.stroke();
      }
    });
    ctx.restore();
  },

  truck(ctx, cx, cy, s) {
    ctx.save();
    const wheel = (wx, wy, wr) => {
      lbFill(ctx, '#222'); lbCircle(ctx, wx, wy, wr);
      lbFill(ctx, '#888'); lbCircle(ctx, wx, wy, wr * 0.42);
      lbFill(ctx, '#555'); lbCircle(ctx, wx, wy, wr * 0.14);
    };
    ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.022; ctx.strokeStyle = '#123a5c';
    const groundY = cy + s * 0.20;
    const cabW = s * 0.34, cabH = s * 0.42, cabX = cx + s * 0.02, cabY = groundY - cabH;
    const bedX = cx - s * 0.48, bedFloorH = s * 0.12, bedWallH = s * 0.24;
    const bedTopY = groundY - bedWallH, bedFloorY = groundY - bedFloorH;
    // shallow open bed: floor + tailgate wall + top rail line (leaves the middle open)
    lbFill(ctx, '#2a5f95');
    rr(ctx, bedX, bedFloorY, cabX - bedX, bedFloorH, s * 0.02); ctx.fill(); ctx.stroke();
    lbFill(ctx, '#3a7fc0');
    rr(ctx, bedX, bedTopY, s * 0.06, groundY - bedTopY, s * 0.02); ctx.fill(); ctx.stroke();
    ctx.lineWidth = s * 0.025;
    ctx.beginPath(); ctx.moveTo(bedX, bedTopY); ctx.lineTo(cabX, bedTopY); ctx.stroke();
    // cab
    lbFill(ctx, '#3a7fc0');
    rr(ctx, cabX, cabY, cabW, cabH, s * 0.05); ctx.fill(); ctx.stroke();
    lbFill(ctx, '#bfeeff');
    rr(ctx, cabX + cabW * 0.16, cabY + cabH * 0.16, cabW * 0.7, cabH * 0.36, s * 0.025); ctx.fill(); ctx.stroke();
    const wy = groundY, wr = s * 0.15;
    wheel(bedX + (cabX - bedX) * 0.55, wy, wr);
    wheel(cabX + cabW * 0.72, wy, wr);
    ctx.restore();
  },

  boat(ctx, cx, cy, s) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2a80c0'; ctx.lineWidth = s * 0.025; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.52, cy + s * 0.24);
    ctx.quadraticCurveTo(cx - s * 0.30, cy + s * 0.16, cx - s * 0.06, cy + s * 0.24);
    ctx.quadraticCurveTo(cx + s * 0.18, cy + s * 0.32, cx + s * 0.44, cy + s * 0.22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.46, cy + s * 0.34);
    ctx.quadraticCurveTo(cx - s * 0.24, cy + s * 0.27, cx - s * 0.02, cy + s * 0.34);
    ctx.quadraticCurveTo(cx + s * 0.20, cy + s * 0.41, cx + s * 0.40, cy + s * 0.32);
    ctx.stroke();
    ctx.strokeStyle = '#6a3f1a'; ctx.lineWidth = s * 0.022;
    lbFill(ctx, '#a0662f');
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.38, cy + s * 0.06);
    ctx.lineTo(cx + s * 0.38, cy + s * 0.06);
    ctx.quadraticCurveTo(cx + s * 0.28, cy + s * 0.24, cx, cy + s * 0.26);
    ctx.quadraticCurveTo(cx - s * 0.28, cy + s * 0.24, cx - s * 0.38, cy + s * 0.06);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#4a2c10'; ctx.lineWidth = s * 0.035; ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.01, cy + s * 0.06);
    ctx.lineTo(cx - s * 0.01, cy - s * 0.56);
    ctx.stroke();
    ctx.strokeStyle = '#2a4a6a'; ctx.lineWidth = s * 0.02;
    lbFill(ctx, '#fdfdfd');
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.01, cy - s * 0.52);
    ctx.lineTo(cx - s * 0.01, cy + s * 0.04);
    ctx.lineTo(cx + s * 0.38, cy + s * 0.04);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  },

  box(ctx, cx, cy, s) {
    ctx.save();
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#6a3e18'; ctx.lineWidth = s * 0.02;
    const fw = s * 0.58, fh = s * 0.54, fx = cx - fw / 2 - s * 0.07, fy = cy - fh / 2 + s * 0.08;
    const dx = s * 0.20, dy = s * 0.16;
    lbFill(ctx, '#c07a3e');
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + dx, fy - dy);
    ctx.lineTo(fx + fw + dx, fy - dy);
    ctx.lineTo(fx + fw, fy);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    lbFill(ctx, '#96602c');
    ctx.beginPath();
    ctx.moveTo(fx + fw, fy);
    ctx.lineTo(fx + fw + dx, fy - dy);
    ctx.lineTo(fx + fw + dx, fy + fh - dy);
    ctx.lineTo(fx + fw, fy + fh);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    lbFill(ctx, '#c98c4a');
    rr(ctx, fx, fy, fw, fh, s * 0.015); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#f2e6cc'; ctx.lineWidth = s * 0.045; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(fx + fw * 0.5, fy + s * 0.02); ctx.lineTo(fx + fw * 0.5, fy + fh - s * 0.02); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx + s * 0.02, fy + fh * 0.5); ctx.lineTo(fx + fw - s * 0.02, fy + fh * 0.5); ctx.stroke();
    ctx.restore();
  },

  can(ctx, cx, cy, s) {
    ctx.save();
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#4a585e'; ctx.lineWidth = s * 0.02;
    const w = s * 0.44, h = s * 0.60, x = cx - w / 2, y = cy - h / 2;
    lbFill(ctx, '#d5dde0');
    rr(ctx, x, y + s * 0.05, w, h - s * 0.10, s * 0.02); ctx.fill(); ctx.stroke();
    lbFill(ctx, '#e63b3b');
    rr(ctx, x, y + h * 0.36, w, h * 0.30, s * 0.015); ctx.fill(); ctx.stroke();
    lbFill(ctx, '#eef4f5');
    ctx.beginPath(); ctx.ellipse(cx, y + s * 0.05, w / 2, s * 0.055, 0, 0, TAU); ctx.fill(); ctx.stroke();
    lbFill(ctx, '#b8c2c6');
    ctx.beginPath(); ctx.ellipse(cx, y + h - s * 0.05, w / 2, s * 0.055, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#333'; ctx.lineWidth = s * 0.028; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(cx + s * 0.02, y + s * 0.04, s * 0.09, s * 0.04, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - s * 0.07, y + s * 0.04); ctx.lineTo(cx - s * 0.12, y + s * 0.04); ctx.stroke();
    ctx.restore();
  },

  cup(ctx, cx, cy, s) {
    ctx.save();
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#333'; ctx.lineWidth = s * 0.025;
    const w = s * 0.48, h = s * 0.40, x = cx - w / 2 - s * 0.04, y = cy - h / 2 + s * 0.10;
    lbFill(ctx, '#ffffff');
    rr(ctx, x, y, w, h, s * 0.05); ctx.fill(); ctx.stroke();
    ctx.lineWidth = s * 0.065; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x + w + s * 0.02, y + h * 0.5, s * 0.15, -Math.PI * 0.62, Math.PI * 0.62);
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = '#7fa8cc'; ctx.lineWidth = s * 0.025; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.30, y - s * 0.03);
    ctx.bezierCurveTo(x + w * 0.18, y - s * 0.14, x + w * 0.42, y - s * 0.20, x + w * 0.28, y - s * 0.32);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.62, y - s * 0.03);
    ctx.bezierCurveTo(x + w * 0.50, y - s * 0.14, x + w * 0.74, y - s * 0.20, x + w * 0.60, y - s * 0.32);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  },

  pan(ctx, cx, cy, s) {
    ctx.save();
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#161616'; ctx.lineWidth = s * 0.025;
    const rx = s * 0.30, ry = s * 0.20, px = cx - s * 0.08, py = cy + s * 0.02;
    lbFill(ctx, '#3a3a3a');
    ctx.beginPath(); ctx.ellipse(px, py, rx, ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
    lbFill(ctx, '#5c5c5c');
    ctx.beginPath(); ctx.ellipse(px, py, rx * 0.76, ry * 0.66, 0, 0, TAU); ctx.fill();
    lbFill(ctx, '#3a3a3a');
    const hx0 = px + rx * 0.62, hy = py - s * 0.04, hw = s * 0.44, hh = s * 0.08;
    rr(ctx, hx0, hy, hw, hh, hh / 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  },

  // ---- batch 5: household ----
  book(ctx, cx, cy, s) {
    ctx.save();
    // cover sliver peeking out beneath the pages
    lbFill(ctx, '#c0392b');
    rr(ctx, cx - 0.56 * s, cy + 0.26 * s, 1.12 * s, 0.14 * s, 0.04 * s);
    ctx.fill();
    ctx.strokeStyle = '#7a231a';
    ctx.lineWidth = s * 0.02;
    ctx.stroke();

    // left page
    ctx.beginPath();
    ctx.moveTo(cx, cy - 0.3 * s);
    ctx.lineTo(cx - 0.52 * s, cy - 0.16 * s);
    ctx.lineTo(cx - 0.5 * s, cy + 0.3 * s);
    ctx.lineTo(cx, cy + 0.36 * s);
    ctx.closePath();
    lbFill(ctx, '#fdfdfd');
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = s * 0.025;
    ctx.stroke();

    // right page (mirror)
    ctx.beginPath();
    ctx.moveTo(cx, cy - 0.3 * s);
    ctx.lineTo(cx + 0.52 * s, cy - 0.16 * s);
    ctx.lineTo(cx + 0.5 * s, cy + 0.3 * s);
    ctx.lineTo(cx, cy + 0.36 * s);
    ctx.closePath();
    lbFill(ctx, '#f4f4f4');
    ctx.fill();
    ctx.stroke();

    // spine
    ctx.beginPath();
    ctx.moveTo(cx, cy - 0.3 * s);
    ctx.lineTo(cx, cy + 0.36 * s);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = s * 0.03;
    ctx.stroke();

    // text lines on each page
    ctx.strokeStyle = '#9aa0a6';
    ctx.lineWidth = s * 0.018;
    for (let i = 0; i < 4; i++) {
      const ty = cy - 0.08 * s + i * 0.115 * s;
      ctx.beginPath();
      ctx.moveTo(cx - 0.4 * s, ty - i * 0.01 * s);
      ctx.lineTo(cx - 0.08 * s, ty);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 0.08 * s, ty);
      ctx.lineTo(cx + 0.4 * s, ty - i * 0.01 * s);
      ctx.stroke();
    }
    ctx.restore();
  },

  bed(ctx, cx, cy, s) {
    ctx.save();
    // headboard (wide, tall, behind the top edge of the mattress)
    lbFill(ctx, '#8d5a3b');
    rr(ctx, cx - 0.5 * s, cy - 0.48 * s, 1.0 * s, 0.4 * s, 0.1 * s);
    ctx.fill();
    ctx.strokeStyle = '#5e3a22';
    ctx.lineWidth = s * 0.025;
    ctx.stroke();

    // legs
    lbFill(ctx, '#8d5a3b');
    rr(ctx, cx - 0.48 * s, cy + 0.32 * s, 0.09 * s, 0.14 * s, 0.02 * s);
    ctx.fill();
    ctx.stroke();
    rr(ctx, cx + 0.39 * s, cy + 0.32 * s, 0.09 * s, 0.14 * s, 0.02 * s);
    ctx.fill();
    ctx.stroke();

    // mattress (front face)
    lbFill(ctx, '#fdfdfd');
    rr(ctx, cx - 0.5 * s, cy - 0.14 * s, 1.0 * s, 0.46 * s, 0.05 * s);
    ctx.fill();
    ctx.strokeStyle = '#999';
    ctx.lineWidth = s * 0.025;
    ctx.stroke();

    // pillow
    lbFill(ctx, '#ffffff');
    rr(ctx, cx - 0.4 * s, cy - 0.1 * s, 0.36 * s, 0.24 * s, 0.09 * s);
    ctx.fill();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = s * 0.02;
    ctx.stroke();

    // blanket covering most of the mattress
    lbFill(ctx, '#4a90d9');
    rr(ctx, cx - 0.06 * s, cy + 0.0 * s, 0.5 * s, 0.32 * s, 0.04 * s);
    ctx.fill();
    ctx.strokeStyle = '#2f6bb0';
    ctx.lineWidth = s * 0.025;
    ctx.stroke();
    // blanket fold line
    ctx.beginPath();
    ctx.moveTo(cx - 0.02 * s, cy + 0.08 * s);
    ctx.lineTo(cx + 0.4 * s, cy + 0.08 * s);
    ctx.stroke();
    ctx.restore();
  },

  key(ctx, cx, cy, s) {
    ctx.save();
    ctx.strokeStyle = '#a5720a';
    ctx.lineWidth = s * 0.03;
    lbFill(ctx, '#f4c430');
    // round decorated head
    lbCircle(ctx, cx - 0.38 * s, cy, 0.24 * s);
    ctx.stroke();
    // decorative inner ring (stroke only)
    ctx.beginPath();
    ctx.arc(cx - 0.38 * s, cy, 0.11 * s, 0, TAU);
    ctx.lineWidth = s * 0.035;
    ctx.stroke();

    // shaft
    lbFill(ctx, '#f4c430');
    rr(ctx, cx - 0.17 * s, cy - 0.055 * s, 0.62 * s, 0.11 * s, 0.02 * s);
    ctx.fill();
    ctx.lineWidth = s * 0.025;
    ctx.stroke();

    // teeth
    rr(ctx, cx + 0.18 * s, cy + 0.05 * s, 0.08 * s, 0.16 * s, 0.015 * s);
    ctx.fill();
    ctx.stroke();
    rr(ctx, cx + 0.32 * s, cy + 0.05 * s, 0.08 * s, 0.24 * s, 0.015 * s);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },

  sock(ctx, cx, cy, s) {
    ctx.save();
    lbFill(ctx, '#e8622c');
    ctx.strokeStyle = '#a8431a';
    ctx.lineWidth = s * 0.03;
    ctx.lineJoin = 'round';

    // single silhouette path: cuff -> leg -> toe -> sole -> heel notch -> back up
    ctx.beginPath();
    ctx.moveTo(cx - 0.26 * s, cy - 0.46 * s); // cuff top-left
    ctx.lineTo(cx + 0.02 * s, cy - 0.46 * s); // cuff top-right
    ctx.lineTo(cx + 0.06 * s, cy - 0.06 * s); // down front of leg to ankle
    ctx.quadraticCurveTo(cx + 0.14 * s, cy - 0.1 * s, cx + 0.34 * s, cy + 0.02 * s); // over the top of the foot
    ctx.quadraticCurveTo(cx + 0.48 * s, cy + 0.1 * s, cx + 0.46 * s, cy + 0.26 * s); // rounded toe
    ctx.quadraticCurveTo(cx + 0.44 * s, cy + 0.35 * s, cx + 0.3 * s, cy + 0.35 * s); // toe underside
    ctx.lineTo(cx - 0.1 * s, cy + 0.35 * s); // flat sole
    ctx.quadraticCurveTo(cx - 0.26 * s, cy + 0.35 * s, cx - 0.26 * s, cy + 0.2 * s); // heel bulge, bottom
    ctx.quadraticCurveTo(cx - 0.26 * s, cy + 0.08 * s, cx - 0.12 * s, cy + 0.02 * s); // heel notch curving up into ankle
    ctx.quadraticCurveTo(cx - 0.22 * s, cy - 0.02 * s, cx - 0.24 * s, cy - 0.16 * s); // inner ankle back
    ctx.lineTo(cx - 0.26 * s, cy - 0.46 * s); // up the back of the leg to start
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ribbed cuff band at the top
    lbFill(ctx, '#fdfdfd');
    rr(ctx, cx - 0.25 * s, cy - 0.44 * s, 0.26 * s, 0.1 * s, 0.04 * s);
    ctx.fill();
    ctx.strokeStyle = '#999';
    ctx.lineWidth = s * 0.018;
    ctx.stroke();
    ctx.strokeStyle = '#c8c8c8';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 0.22 * s + i * 0.08 * s, cy - 0.43 * s);
      ctx.lineTo(cx - 0.22 * s + i * 0.08 * s, cy - 0.35 * s);
      ctx.stroke();
    }
    ctx.restore();
  },

  shoe(ctx, cx, cy, s) {
    ctx.save();
    ctx.strokeStyle = '#26313a';
    ctx.lineWidth = s * 0.028;
    ctx.lineJoin = 'round';

    const groundY = cy + 0.22 * s;

    // upper: low sneaker side-profile — higher heel (left) sloping down to a low toe (right)
    lbFill(ctx, '#4a90d9');
    ctx.beginPath();
    ctx.moveTo(cx - 0.46 * s, groundY); // heel bottom
    ctx.lineTo(cx - 0.46 * s, cy - 0.14 * s); // heel back, straight up
    ctx.quadraticCurveTo(cx - 0.44 * s, cy - 0.3 * s, cx - 0.22 * s, cy - 0.34 * s); // heel top curve
    ctx.quadraticCurveTo(cx - 0.06 * s, cy - 0.37 * s, cx + 0.02 * s, cy - 0.28 * s); // collar peak toward tongue
    ctx.quadraticCurveTo(cx + 0.1 * s, cy - 0.2 * s, cx + 0.26 * s, cy - 0.06 * s); // sloped vamp down toward toe
    ctx.quadraticCurveTo(cx + 0.42 * s, cy + 0.02 * s, cx + 0.48 * s, cy + 0.14 * s); // toe front
    ctx.quadraticCurveTo(cx + 0.5 * s, groundY, cx + 0.4 * s, groundY); // toe rounds down to sole
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // toe cap: light wedge hugging the front-bottom curve
    ctx.beginPath();
    ctx.moveTo(cx + 0.16 * s, cy + 0.06 * s);
    ctx.quadraticCurveTo(cx + 0.36 * s, cy + 0.02 * s, cx + 0.48 * s, cy + 0.14 * s);
    ctx.quadraticCurveTo(cx + 0.5 * s, groundY, cx + 0.4 * s, groundY);
    ctx.lineTo(cx + 0.16 * s, groundY);
    ctx.closePath();
    lbFill(ctx, '#eef2f6');
    ctx.fill();
    ctx.strokeStyle = '#9aa6b0';
    ctx.lineWidth = s * 0.02;
    ctx.stroke();

    // tongue poking up above the collar
    lbFill(ctx, '#dfe8f2');
    rr(ctx, cx - 0.09 * s, cy - 0.34 * s, 0.18 * s, 0.16 * s, 0.05 * s);
    ctx.fill();
    ctx.strokeStyle = '#9aa6b0';
    ctx.lineWidth = s * 0.02;
    ctx.stroke();

    // laces crossing over the vamp
    ctx.strokeStyle = '#fdfdfd';
    ctx.lineWidth = s * 0.035;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const lx = cx - 0.02 * s + i * 0.1 * s;
      const ly = cy - 0.24 * s + i * 0.07 * s;
      ctx.beginPath();
      ctx.moveTo(lx - 0.07 * s, ly - 0.06 * s);
      ctx.lineTo(lx + 0.07 * s, ly + 0.08 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(lx + 0.07 * s, ly - 0.06 * s);
      ctx.lineTo(lx - 0.07 * s, ly + 0.08 * s);
      ctx.stroke();
    }

    // sole
    ctx.strokeStyle = '#26313a';
    ctx.lineWidth = s * 0.028;
    lbFill(ctx, '#3a3f47');
    rr(ctx, cx - 0.48 * s, groundY, 0.98 * s, 0.11 * s, 0.045 * s);
    ctx.fill();
    ctx.stroke();
    // sole stripe
    lbFill(ctx, '#f2f2f2');
    rr(ctx, cx - 0.42 * s, groundY + 0.035 * s, 0.84 * s, 0.03 * s, 0.014 * s);
    ctx.fill();
    ctx.restore();
  },

  bell(ctx, cx, cy, s) {
    ctx.save();
    ctx.strokeStyle = '#a5720a';
    ctx.lineWidth = s * 0.03;

    // top loop
    ctx.beginPath();
    ctx.arc(cx, cy - 0.42 * s, 0.09 * s, 0, TAU);
    lbFill(ctx, '#f4c430');
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy - 0.42 * s, 0.045 * s, 0, TAU);
    ctx.fillStyle = '#a8d8f0';
    ctx.fill();
    ctx.stroke();

    // bell skirt (flared dome)
    ctx.beginPath();
    ctx.moveTo(cx - 0.06 * s, cy - 0.36 * s);
    ctx.lineTo(cx - 0.08 * s, cy - 0.3 * s);
    ctx.quadraticCurveTo(cx - 0.42 * s, cy - 0.1 * s, cx - 0.46 * s, cy + 0.22 * s);
    ctx.quadraticCurveTo(cx - 0.48 * s, cy + 0.32 * s, cx - 0.3 * s, cy + 0.32 * s);
    ctx.lineTo(cx + 0.3 * s, cy + 0.32 * s);
    ctx.quadraticCurveTo(cx + 0.48 * s, cy + 0.32 * s, cx + 0.46 * s, cy + 0.22 * s);
    ctx.quadraticCurveTo(cx + 0.42 * s, cy - 0.1 * s, cx + 0.08 * s, cy - 0.3 * s);
    ctx.lineTo(cx + 0.06 * s, cy - 0.36 * s);
    ctx.closePath();
    lbFill(ctx, '#f4c430');
    ctx.fill();
    ctx.stroke();

    // rim highlight line
    ctx.beginPath();
    ctx.moveTo(cx - 0.44 * s, cy + 0.2 * s);
    ctx.lineTo(cx + 0.44 * s, cy + 0.2 * s);
    ctx.strokeStyle = '#c98f0a';
    ctx.lineWidth = s * 0.025;
    ctx.stroke();

    // clapper hanging below the rim
    ctx.strokeStyle = '#a5720a';
    ctx.lineWidth = s * 0.02;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 0.3 * s);
    ctx.lineTo(cx, cy + 0.4 * s);
    ctx.stroke();
    lbFill(ctx, '#c98f0a');
    lbCircle(ctx, cx, cy + 0.46 * s, 0.07 * s);
    ctx.strokeStyle = '#8a5f08';
    ctx.lineWidth = s * 0.02;
    ctx.stroke();
    ctx.restore();
  },

  fan(ctx, cx, cy, s) {
    ctx.save();
    const fy = cy - 0.08 * s;
    // stand base
    lbFill(ctx, '#8a8f96');
    rr(ctx, cx - 0.24 * s, cy + 0.36 * s, 0.48 * s, 0.08 * s, 0.03 * s);
    ctx.fill();
    // stand neck
    rr(ctx, cx - 0.045 * s, cy + 0.08 * s, 0.09 * s, 0.3 * s, 0.02 * s);
    ctx.fill();

    // blades (behind the cage)
    ctx.save();
    ctx.translate(cx, fy);
    lbFill(ctx, '#e6e9ec');
    ctx.strokeStyle = '#b7bcc2';
    ctx.lineWidth = s * 0.012;
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate((i * TAU) / 3);
      ctx.beginPath();
      ctx.ellipse(0, -0.18 * s, 0.08 * s, 0.18 * s, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    lbFill(ctx, '#9aa0a6');
    lbCircle(ctx, 0, 0, 0.055 * s);
    ctx.restore();

    // cage rim
    ctx.beginPath();
    ctx.arc(cx, fy, 0.4 * s, 0, TAU);
    ctx.strokeStyle = '#4a5158';
    ctx.lineWidth = s * 0.035;
    ctx.stroke();
    // outer ring detail
    ctx.beginPath();
    ctx.arc(cx, fy, 0.34 * s, 0, TAU);
    ctx.lineWidth = s * 0.02;
    ctx.stroke();

    // radiating spokes
    ctx.lineWidth = s * 0.016;
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8;
      ctx.beginPath();
      ctx.moveTo(cx, fy);
      ctx.lineTo(cx + Math.cos(a) * 0.4 * s, fy + Math.sin(a) * 0.4 * s);
      ctx.stroke();
    }
    ctx.restore();
  },

  drum(ctx, cx, cy, s) {
    ctx.save();
    ctx.strokeStyle = '#7a2e2e';
    ctx.lineWidth = s * 0.025;

    // shell
    lbFill(ctx, '#d94f4f');
    rr(ctx, cx - 0.4 * s, cy - 0.06 * s, 0.8 * s, 0.42 * s, 0.03 * s);
    ctx.fill();

    // bottom rim shading
    ctx.beginPath();
    ctx.ellipse(cx, cy + 0.36 * s, 0.4 * s, 0.09 * s, 0, 0, Math.PI);
    ctx.fillStyle = '#a83a3a';
    ctx.fill();

    // zigzag band
    ctx.beginPath();
    const bandY = cy + 0.1 * s;
    ctx.moveTo(cx - 0.4 * s, bandY);
    for (let i = 0; i <= 8; i++) {
      const x = cx - 0.4 * s + (i * 0.8 * s) / 8;
      const y = bandY + (i % 2 === 0 ? -0.06 * s : 0.06 * s);
      ctx.lineTo(x, y);
    }
    for (let i = 8; i >= 0; i--) {
      const x = cx - 0.4 * s + (i * 0.8 * s) / 8;
      const y = bandY + 0.1 * s + (i % 2 === 0 ? -0.06 * s : 0.06 * s);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    lbFill(ctx, '#f4c430');
    ctx.fill();

    // shell outline
    ctx.strokeStyle = '#7a2e2e';
    ctx.lineWidth = s * 0.025;
    rr(ctx, cx - 0.4 * s, cy - 0.06 * s, 0.8 * s, 0.42 * s, 0.03 * s);
    ctx.stroke();

    // top head
    lbFill(ctx, '#fdfdfd');
    lbEllipse(ctx, cx, cy - 0.06 * s, 0.4 * s, 0.12 * s);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = s * 0.025;
    ctx.stroke();

    // crossed drumsticks above
    ctx.strokeStyle = '#a5723a';
    ctx.lineWidth = s * 0.045;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 0.3 * s, cy - 0.5 * s);
    ctx.lineTo(cx + 0.18 * s, cy - 0.14 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 0.3 * s, cy - 0.5 * s);
    ctx.lineTo(cx - 0.18 * s, cy - 0.14 * s);
    ctx.stroke();
    lbFill(ctx, '#e8d0a0');
    lbCircle(ctx, cx - 0.3 * s, cy - 0.5 * s, 0.045 * s);
    lbCircle(ctx, cx + 0.3 * s, cy - 0.5 * s, 0.045 * s);
    ctx.restore();
  },

  kite(ctx, cx, cy, s) {
    ctx.save();
    const top = { x: cx, y: cy - 0.48 * s };
    const left = { x: cx - 0.34 * s, y: cy - 0.04 * s };
    const bot = { x: cx, y: cy + 0.34 * s };
    const right = { x: cx + 0.34 * s, y: cy - 0.04 * s };

    ctx.strokeStyle = '#333';
    ctx.lineWidth = s * 0.025;
    ctx.lineJoin = 'round';

    // top-left quadrant
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(left.x, left.y);
    ctx.lineTo(cx, cy - 0.04 * s);
    ctx.closePath();
    lbFill(ctx, '#e8622c');
    ctx.fill();
    ctx.stroke();

    // top-right quadrant
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(cx, cy - 0.04 * s);
    ctx.closePath();
    lbFill(ctx, '#f4c430');
    ctx.fill();
    ctx.stroke();

    // bottom-left quadrant
    ctx.beginPath();
    ctx.moveTo(bot.x, bot.y);
    ctx.lineTo(left.x, left.y);
    ctx.lineTo(cx, cy - 0.04 * s);
    ctx.closePath();
    lbFill(ctx, '#4a90d9');
    ctx.fill();
    ctx.stroke();

    // bottom-right quadrant
    ctx.beginPath();
    ctx.moveTo(bot.x, bot.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(cx, cy - 0.04 * s);
    ctx.closePath();
    lbFill(ctx, '#5cb85c');
    ctx.fill();
    ctx.stroke();

    // crossbar spars
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bot.x, bot.y);
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = s * 0.015;
    ctx.stroke();

    // outer diamond outline (crisp edge)
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(bot.x, bot.y);
    ctx.lineTo(left.x, left.y);
    ctx.closePath();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = s * 0.025;
    ctx.stroke();

    // tail
    ctx.strokeStyle = '#333';
    ctx.lineWidth = s * 0.02;
    ctx.beginPath();
    ctx.moveTo(bot.x, bot.y);
    ctx.quadraticCurveTo(bot.x - 0.16 * s, bot.y + 0.14 * s, bot.x + 0.05 * s, bot.y + 0.26 * s);
    ctx.quadraticCurveTo(bot.x - 0.14 * s, bot.y + 0.36 * s, bot.x + 0.04 * s, bot.y + 0.48 * s);
    ctx.stroke();

    // little bows on the tail
    const bows = [
      { x: bot.x - 0.07 * s, y: bot.y + 0.15 * s, c: '#e8622c' },
      { x: bot.x - 0.01 * s, y: bot.y + 0.3 * s, c: '#4a90d9' },
      { x: bot.x + 0.02 * s, y: bot.y + 0.44 * s, c: '#5cb85c' },
    ];
    bows.forEach((b) => {
      ctx.save();
      ctx.translate(b.x, b.y);
      lbFill(ctx, b.c);
      lbEar(ctx, -0.06 * s, -0.05 * s, 0, 0, -0.06 * s, 0.05 * s);
      lbEar(ctx, 0.06 * s, -0.05 * s, 0, 0, 0.06 * s, 0.05 * s);
      lbCircle(ctx, 0, 0, 0.02 * s);
      ctx.restore();
    });
    ctx.restore();
  },

  ball(ctx, cx, cy, s) {
    ctx.save();
    const r = 0.42 * s;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.clip();
    lbFill(ctx, '#fdfdfd');
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const colors = ['#e8622c', '#f4c430', '#4a90d9', '#5cb85c', '#e8622c', '#f4c430'];
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, (i * TAU) / 6 - Math.PI / 2, ((i + 1) * TAU) / 6 - Math.PI / 2);
      ctx.closePath();
      lbFill(ctx, i % 2 === 0 ? colors[i] : '#fdfdfd');
      ctx.fill();
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = s * 0.025;
    ctx.stroke();

    drawFace(ctx, cx, cy + 0.03 * s, s * 0.5, 'happy', 0, 41);
    ctx.restore();
  },

  // ---- batch 6: structures ----
  hat(ctx, cx, cy, s) {
    ctx.save();
    // brim (wide oval)
    ctx.fillStyle = '#f2c766';
    ctx.strokeStyle = '#8a5a1e';
    ctx.lineWidth = s * 0.045;
    lbEllipse(ctx, cx, cy + s * 0.22, s * 0.56, s * 0.14, 0);
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.22, s * 0.56, s * 0.14, 0, 0, TAU);
    ctx.stroke();
    // dome/crown of hat (symmetric half-ellipse)
    ctx.fillStyle = '#f7d47e';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.33, cy + s * 0.16);
    ctx.ellipse(cx, cy + s * 0.16, s * 0.33, s * 0.58, 0, Math.PI, 0, false);
    ctx.lineTo(cx + s * 0.33, cy + s * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // band stripe near base of dome
    ctx.fillStyle = '#e0563f';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.335, cy + s * 0.05);
    ctx.lineTo(cx + s * 0.335, cy + s * 0.05);
    ctx.lineTo(cx + s * 0.335, cy + s * 0.16);
    ctx.lineTo(cx - s * 0.335, cy + s * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  crown(ctx, cx, cy, s) {
    ctx.save();
    const bandY = cy + s * 0.15, bandH = s * 0.26, halfW = s * 0.5;
    // points (draw first so band overlaps their base cleanly)
    const jewelColors = ['#e0563f', '#4aa8e0', '#4bbf6b', '#c060d8', '#e0563f'];
    const n = 5;
    ctx.fillStyle = '#f7d34a';
    ctx.strokeStyle = '#a8790f';
    ctx.lineWidth = s * 0.035;
    ctx.beginPath();
    ctx.moveTo(cx - halfW, bandY);
    for (let i = 0; i < n; i++) {
      const x0 = cx - halfW + (halfW * 2 / n) * i;
      const x1 = x0 + (halfW * 2 / n) / 2;
      const x2 = x0 + (halfW * 2 / n);
      const tipH = (i === 2) ? s * 0.5 : s * 0.36;
      ctx.lineTo(x1, bandY - tipH);
      ctx.lineTo(x2, bandY);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // band
    ctx.fillStyle = '#ffe27a';
    rr(ctx, cx - halfW, bandY, halfW * 2, bandH, s * 0.05);
    ctx.fill();
    ctx.strokeStyle = '#a8790f';
    ctx.lineWidth = s * 0.04;
    rr(ctx, cx - halfW, bandY, halfW * 2, bandH, s * 0.05);
    ctx.stroke();
    // band jewel accents
    ctx.fillStyle = '#c060d8';
    for (let i = 0; i < 3; i++) {
      lbCircle(ctx, cx - halfW * 0.6 + i * halfW * 0.6, bandY + bandH * 0.5, s * 0.045);
    }
    // jewels on tips
    for (let i = 0; i < n; i++) {
      const x0 = cx - halfW + (halfW * 2 / n) * i;
      const x1 = x0 + (halfW * 2 / n) / 2;
      const tipH = (i === 2) ? s * 0.5 : s * 0.36;
      ctx.fillStyle = jewelColors[i];
      ctx.strokeStyle = '#7a3010';
      ctx.lineWidth = s * 0.02;
      lbCircle(ctx, x1, bandY - tipH + s * 0.06, s * 0.075);
      ctx.beginPath();
      ctx.arc(x1, bandY - tipH + s * 0.06, s * 0.075, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  },

  king(ctx, cx, cy, s) {
    ctx.save();
    // robe/shoulders
    ctx.fillStyle = '#6a3fb8';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.5, cy + s * 0.5);
    ctx.quadraticCurveTo(cx - s * 0.42, cy + s * 0.1, cx - s * 0.24, cy + s * 0.05);
    ctx.lineTo(cx + s * 0.24, cy + s * 0.05);
    ctx.quadraticCurveTo(cx + s * 0.42, cy + s * 0.1, cx + s * 0.5, cy + s * 0.5);
    ctx.closePath();
    ctx.fill();
    // fur trim line along robe top
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cfd6df';
    ctx.lineWidth = s * 0.015;
    for (let i = -4; i <= 4; i++) {
      lbCircle(ctx, cx + i * s * 0.095, cy + s * 0.16, s * 0.06);
    }
    // gold trim/clasp
    ctx.fillStyle = '#f7d34a';
    lbCircle(ctx, cx, cy + s * 0.24, s * 0.05);
    // face
    ctx.fillStyle = '#f6c99b';
    lbCircle(ctx, cx, cy - s * 0.14, s * 0.34);
    ctx.strokeStyle = '#b98456';
    ctx.lineWidth = s * 0.02;
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.14, s * 0.34, 0, TAU);
    ctx.stroke();
    drawFace(ctx, cx, cy - s * 0.14, s * 0.34, 'happy', 0, 51);
    // small mustache for extra kingliness (kept subtle, doesn't cover face reading)
    ctx.fillStyle = '#c8955a';
    lbEllipse(ctx, cx - s * 0.08, cy - s * 0.01, s * 0.06, s * 0.025, -0.15);
    lbEllipse(ctx, cx + s * 0.08, cy - s * 0.01, s * 0.06, s * 0.025, 0.15);
    // crown on top of head
    const crownCx = cx, crownCy = cy - s * 0.42, cw = s * 0.34, chh = s * 0.16;
    ctx.fillStyle = '#f7d34a';
    ctx.strokeStyle = '#a8790f';
    ctx.lineWidth = s * 0.02;
    ctx.beginPath();
    ctx.moveTo(crownCx - cw, crownCy + chh);
    ctx.lineTo(crownCx - cw, crownCy);
    ctx.lineTo(crownCx - cw * 0.5, crownCy - chh * 0.9);
    ctx.lineTo(crownCx, crownCy - chh * 0.3);
    ctx.lineTo(crownCx + cw * 0.5, crownCy - chh * 0.9);
    ctx.lineTo(crownCx + cw, crownCy);
    ctx.lineTo(crownCx + cw, crownCy + chh);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e0563f';
    lbCircle(ctx, crownCx, crownCy - chh * 0.15, s * 0.045);
    ctx.restore();
  },

  ring(ctx, cx, cy, s) {
    ctx.save();
    ctx.translate(cx, cy + s * 0.22);
    // band (closed circle, so it clearly reads as a ring loop, not a "C")
    ctx.strokeStyle = '#f7d34a';
    ctx.lineWidth = s * 0.15;
    ctx.beginPath();
    ctx.arc(0, s * 0.14, s * 0.24, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#a8790f';
    ctx.lineWidth = s * 0.02;
    ctx.beginPath();
    ctx.arc(0, s * 0.14, s * 0.24 + s * 0.08, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, s * 0.14, s * 0.24 - s * 0.08, 0, TAU);
    ctx.stroke();
    // diamond (kite shape), tilted, its lower tip nestled onto the band
    ctx.save();
    ctx.translate(0, -s * 0.08);
    ctx.rotate(-0.22);
    ctx.fillStyle = '#bfe9f5';
    ctx.strokeStyle = '#2f8fae';
    ctx.lineWidth = s * 0.025;
    const dTop = -s * 0.56, dMidY = -s * 0.28, dW = s * 0.26, dBotY = 0;
    ctx.beginPath();
    ctx.moveTo(0, dTop);
    ctx.lineTo(dW, dMidY);
    ctx.lineTo(0, dBotY);
    ctx.lineTo(-dW, dMidY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // facet lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = s * 0.018;
    ctx.beginPath();
    ctx.moveTo(0, dTop);
    ctx.lineTo(0, dBotY);
    ctx.moveTo(-dW, dMidY);
    ctx.lineTo(dW, dMidY);
    ctx.stroke();
    // sparkle mark, anchored to the diamond's own frame
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = s * 0.03;
    ctx.lineCap = 'round';
    const spx = dW * 0.55, spy = dTop + s * 0.12;
    ctx.beginPath();
    ctx.moveTo(spx - s * 0.06, spy); ctx.lineTo(spx + s * 0.06, spy);
    ctx.moveTo(spx, spy - s * 0.06); ctx.lineTo(spx, spy + s * 0.06);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  },

  nest(ctx, cx, cy, s) {
    ctx.save();
    // bowl body
    ctx.fillStyle = '#a97c3f';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.5, cy - s * 0.02);
    ctx.quadraticCurveTo(cx - s * 0.5, cy + s * 0.4, cx, cy + s * 0.44);
    ctx.quadraticCurveTo(cx + s * 0.5, cy + s * 0.4, cx + s * 0.5, cy - s * 0.02);
    ctx.quadraticCurveTo(cx, cy + s * 0.12, cx - s * 0.5, cy - s * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a5527';
    ctx.lineWidth = s * 0.03;
    ctx.stroke();
    // rim ellipse
    ctx.fillStyle = '#c99a5b';
    lbEllipse(ctx, cx, cy - s * 0.02, s * 0.5, s * 0.14, 0);
    ctx.strokeStyle = '#7a5527';
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.02, s * 0.5, s * 0.14, 0, 0, TAU);
    ctx.stroke();
    // woven twig crosshatch texture on body
    ctx.strokeStyle = '#8a6330';
    ctx.lineWidth = s * 0.02;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * s * 0.13, cy + s * 0.05);
      ctx.quadraticCurveTo(cx + i * s * 0.13 + s * 0.06, cy + s * 0.24, cx + i * s * 0.1, cy + s * 0.4);
      ctx.stroke();
    }
    for (let j = 0; j < 3; j++) {
      const yy = cy + s * 0.1 + j * s * 0.11;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.42 + j * s * 0.04, yy);
      ctx.quadraticCurveTo(cx, yy + s * 0.05, cx + s * 0.42 - j * s * 0.04, yy);
      ctx.stroke();
    }
    // stray twig ends poking out of the rim (reads "nest", not "basket")
    ctx.strokeStyle = '#8a6330';
    ctx.lineWidth = s * 0.025;
    ctx.lineCap = 'round';
    const twigs = [[-0.46, -0.02, -0.62, -0.16], [-0.32, -0.08, -0.4, -0.24], [0.4, -0.06, 0.54, -0.2], [0.48, 0.0, 0.6, -0.12]];
    for (const [x0, y0, x1, y1] of twigs) {
      ctx.beginPath();
      ctx.moveTo(cx + x0 * s, cy + y0 * s);
      ctx.lineTo(cx + x1 * s, cy + y1 * s);
      ctx.stroke();
    }
    // eggs peeking over rim
    const eggColors = ['#eef2d8', '#e6f0e0', '#f2ecd8'];
    for (let i = 0; i < 3; i++) {
      const ex = cx + (i - 1) * s * 0.22, ey = cy - s * 0.14;
      ctx.fillStyle = eggColors[i];
      lbEllipse(ctx, ex, ey, s * 0.14, s * 0.17, 0);
      ctx.strokeStyle = '#c9b98a';
      ctx.lineWidth = s * 0.018;
      ctx.beginPath();
      ctx.ellipse(ex, ey, s * 0.14, s * 0.17, 0, 0, TAU);
      ctx.stroke();
      // small speckles
      ctx.fillStyle = '#d8c9a0';
      lbCircle(ctx, ex - s * 0.03, ey + s * 0.03, s * 0.018);
      lbCircle(ctx, ex + s * 0.04, ey - s * 0.02, s * 0.016);
    }
    ctx.restore();
  },

  house(ctx, cx, cy, s) {
    ctx.save();
    const bw = s * 0.7, bh = s * 0.55, bx = cx - bw / 2, by = cy + s * 0.02;
    // roof
    ctx.fillStyle = '#c0473a';
    ctx.strokeStyle = '#7a2a20';
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.moveTo(bx - s * 0.1, by);
    ctx.lineTo(cx, by - s * 0.42);
    ctx.lineTo(bx + bw + s * 0.1, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // chimney
    ctx.fillStyle = '#8a5a45';
    ctx.fillRect(cx + bw * 0.18, by - s * 0.34, s * 0.09, s * 0.2);
    ctx.strokeRect(cx + bw * 0.18, by - s * 0.34, s * 0.09, s * 0.2);
    // body
    ctx.fillStyle = '#f2d9a0';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx, by, bw, bh);
    // door
    ctx.fillStyle = '#7a4a2a';
    rr(ctx, cx - s * 0.09, by + bh - s * 0.28, s * 0.18, s * 0.28, s * 0.04);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f7d34a';
    lbCircle(ctx, cx + s * 0.05, by + bh - s * 0.13, s * 0.015);
    // window
    const wx = bx + bw * 0.68, wy = by + bh * 0.18, ww = s * 0.2, wh = s * 0.2;
    ctx.fillStyle = '#bfe9f5';
    ctx.fillRect(wx, wy, ww, wh);
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.beginPath();
    ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
    ctx.lineWidth = s * 0.02;
    ctx.stroke();
    ctx.restore();
  },

  log(ctx, cx, cy, s) {
    ctx.save();
    const len = s * 0.9, rad = s * 0.28;
    // body (barrel)
    ctx.fillStyle = '#8a5a34';
    rr(ctx, cx - len / 2, cy - rad, len, rad * 2, rad * 0.3);
    ctx.fill();
    ctx.strokeStyle = '#5c3a1e';
    ctx.lineWidth = s * 0.025;
    rr(ctx, cx - len / 2, cy - rad, len, rad * 2, rad * 0.3);
    ctx.stroke();
    // bark lines along body
    ctx.strokeStyle = '#6b4225';
    ctx.lineWidth = s * 0.018;
    for (let i = 0; i < 4; i++) {
      const yy = cy - rad + (rad * 2 / 4) * (i + 0.5);
      ctx.beginPath();
      ctx.moveTo(cx - len / 2 + s * 0.14, yy);
      ctx.quadraticCurveTo(cx, yy + s * 0.02, cx + len / 2 - rad * 0.6, yy);
      ctx.stroke();
    }
    // cut end (lighter, with growth rings)
    ctx.fillStyle = '#e3c496';
    lbEllipse(ctx, cx + len / 2 - rad * 0.15, cy, rad * 0.62, rad, 0);
    ctx.strokeStyle = '#5c3a1e';
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.ellipse(cx + len / 2 - rad * 0.15, cy, rad * 0.62, rad, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#c9a06a';
    ctx.lineWidth = s * 0.02;
    for (let r = 0.65; r >= 0.3; r -= 0.32) {
      ctx.beginPath();
      ctx.ellipse(cx + len / 2 - rad * 0.15, cy, rad * 0.62 * r, rad * r, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = '#a97c3f';
    lbCircle(ctx, cx + len / 2 - rad * 0.15, cy, rad * 0.1);
    ctx.restore();
  },

  flag(ctx, cx, cy, s) {
    ctx.save();
    // pole
    ctx.fillStyle = '#8a5a34';
    ctx.fillRect(cx - s * 0.32, cy - s * 0.55, s * 0.06, s * 1.1);
    ctx.strokeStyle = '#5c3a1e';
    ctx.lineWidth = s * 0.015;
    ctx.strokeRect(cx - s * 0.32, cy - s * 0.55, s * 0.06, s * 1.1);
    // ball top
    ctx.fillStyle = '#f7d34a';
    lbCircle(ctx, cx - s * 0.29, cy - s * 0.56, s * 0.05);
    // waving flag
    const px = cx - s * 0.26, py = cy - s * 0.5;
    ctx.fillStyle = '#e0563f';
    ctx.strokeStyle = '#8a2a1e';
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + s * 0.55, py + s * 0.02);
    ctx.quadraticCurveTo(px + s * 0.42, py + s * 0.15, px + s * 0.58, py + s * 0.28);
    ctx.quadraticCurveTo(px + s * 0.3, py + s * 0.26, px + s * 0.02, py + s * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // star on the flag
    ctx.fillStyle = '#ffe27a';
    ctx.strokeStyle = '#8a2a1e';
    ctx.lineWidth = s * 0.012;
    starPath(ctx, px + s * 0.27, py + s * 0.16, s * 0.09, s * 0.04, 5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },

  robot(ctx, cx, cy, s) {
    ctx.save();
    // antenna
    ctx.strokeStyle = '#5a6270';
    ctx.lineWidth = s * 0.035;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.56);
    ctx.lineTo(cx, cy - s * 0.7);
    ctx.stroke();
    ctx.fillStyle = '#e0563f';
    lbCircle(ctx, cx, cy - s * 0.73, s * 0.05);
    // head
    const hw = s * 0.5, hh = s * 0.36, hx = cx - hw / 2, hy = cy - s * 0.56;
    ctx.fillStyle = '#b9c2cf';
    ctx.strokeStyle = '#5a6270';
    ctx.lineWidth = s * 0.03;
    rr(ctx, hx, hy, hw, hh, s * 0.06);
    ctx.fill();
    ctx.stroke();
    // eyes (square)
    ctx.fillStyle = '#2c3440';
    ctx.fillRect(cx - hw * 0.28, hy + hh * 0.32, s * 0.1, s * 0.1);
    ctx.fillRect(cx + hw * 0.18, hy + hh * 0.32, s * 0.1, s * 0.1);
    // mouth (straight line with teeth ticks)
    ctx.strokeStyle = '#2c3440';
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.26, hy + hh * 0.76);
    ctx.lineTo(cx + hw * 0.26, hy + hh * 0.76);
    ctx.stroke();
    // body
    const bw = s * 0.62, bh = s * 0.4, bx = cx - bw / 2, by = cy - s * 0.18;
    ctx.fillStyle = '#8fa0b8';
    ctx.strokeStyle = '#5a6270';
    ctx.lineWidth = s * 0.03;
    rr(ctx, bx, by, bw, bh, s * 0.05);
    ctx.fill();
    ctx.stroke();
    // buttons/dials on body
    ctx.fillStyle = '#e0563f';
    lbCircle(ctx, cx - bw * 0.2, by + bh * 0.45, s * 0.055);
    ctx.fillStyle = '#4bbf6b';
    lbCircle(ctx, cx, by + bh * 0.45, s * 0.055);
    ctx.fillStyle = '#f7d34a';
    lbCircle(ctx, cx + bw * 0.2, by + bh * 0.45, s * 0.055);
    // block arms
    ctx.fillStyle = '#b9c2cf';
    ctx.strokeStyle = '#5a6270';
    ctx.lineWidth = s * 0.025;
    rr(ctx, bx - s * 0.16, by + s * 0.04, s * 0.16, s * 0.18, s * 0.03);
    ctx.fill(); ctx.stroke();
    rr(ctx, bx + bw, by + s * 0.04, s * 0.16, s * 0.18, s * 0.03);
    ctx.fill(); ctx.stroke();
    // block legs
    ctx.fillStyle = '#8fa0b8';
    rr(ctx, cx - bw * 0.3, by + bh, s * 0.16, s * 0.16, s * 0.03);
    ctx.fill(); ctx.stroke();
    rr(ctx, cx + bw * 0.3 - s * 0.16, by + bh, s * 0.16, s * 0.16, s * 0.03);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  },

  cake(ctx, cx, cy, s) {
    ctx.save();
    // local helper: smooth scalloped icing-drip strip (straight top edge,
    // round drip bumps along the bottom, via repeated half-circle arcs)
    function icingDripPath(x, y, w, topH, n) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      const seg = w / n;
      for (let i = 0; i < n; i++) {
        const cxi = x + (i + 0.5) * seg, r = seg / 2;
        ctx.arc(cxi, y, r, Math.PI, 0, false);
      }
      ctx.lineTo(x + w, y - topH);
      ctx.lineTo(x, y - topH);
      ctx.closePath();
    }
    // plate
    ctx.strokeStyle = '#8a93a0';
    ctx.lineWidth = s * 0.035;
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.5, s * 0.56, s * 0.09, 0, 0, TAU);
    ctx.stroke();
    // bottom layer
    const bw = s * 0.86, bh = s * 0.24, bx = cx - bw / 2, by = cy + s * 0.2;
    ctx.fillStyle = '#e0563f';
    ctx.strokeStyle = '#a02f26';
    ctx.lineWidth = s * 0.03;
    rr(ctx, bx, by, bw, bh, s * 0.03);
    ctx.fill(); ctx.stroke();
    // bottom icing drip (smooth rounded drip bumps)
    ctx.fillStyle = '#fff3dc';
    icingDripPath(bx, by + s * 0.1, bw, s * 0.16, 5);
    ctx.fill();
    ctx.strokeStyle = '#d8b878';
    ctx.lineWidth = s * 0.02;
    ctx.stroke();
    // top layer
    const tw = s * 0.6, th = s * 0.22, tx = cx - tw / 2, ty = by - th + s * 0.02;
    ctx.fillStyle = '#f2a0c0';
    ctx.strokeStyle = '#c05e88';
    ctx.lineWidth = s * 0.03;
    rr(ctx, tx, ty, tw, th, s * 0.03);
    ctx.fill(); ctx.stroke();
    // top icing drip (smooth rounded drip bumps)
    ctx.fillStyle = '#fff3dc';
    icingDripPath(tx, ty + s * 0.08, tw, s * 0.14, 4);
    ctx.fill();
    ctx.strokeStyle = '#d8b878';
    ctx.lineWidth = s * 0.02;
    ctx.stroke();
    // candles
    const candleColors = ['#4aa8e0', '#4bbf6b', '#f7d34a'];
    for (let i = 0; i < 3; i++) {
      const cxi = cx + (i - 1) * s * 0.16, cyi = ty - s * 0.02;
      ctx.fillStyle = candleColors[i];
      ctx.fillRect(cxi - s * 0.025, cyi - s * 0.16, s * 0.05, s * 0.16);
      // flame
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.moveTo(cxi, cyi - s * 0.28);
      ctx.quadraticCurveTo(cxi + s * 0.045, cyi - s * 0.2, cxi, cyi - s * 0.15);
      ctx.quadraticCurveTo(cxi - s * 0.045, cyi - s * 0.2, cxi, cyi - s * 0.28);
      ctx.fill();
    }
    ctx.restore();
  }
};

// ---- the engine ----
// mode contract (only `entries`, `round`, and `drawPrompt` are required):
//   entries: [...]                       content pool, shuffled by the engine
//   round(entry) -> {correct, options}   options = 3 values incl. correct
//   drawPrompt(ctx, entry, phase)        phase: 'idle' | 'fly' | 'hold'
//   drawChoice(ctx, value, x, y, size)?  default: big outlined text
//   flyTarget(entry)? -> {x, y}          where the winning answer flies
//   onCorrect()?                         reward override (default: 1 candy)
// Values are compared with === so modes should use primitives (letters,
// numbers, color names) as choice values.
class PuzzleBlocksMachine {
  constructor(groundY, mode) {
    this.mode = mode;
    this.g = groundY;
    this.bw = 84; this.bh = 84;
    this.slots = [380, 640, 900].map((x, idx) => ({ x, value: '', idx }));
    this.solids = this.slots.map(sl => ({
      x: sl.x - this.bw / 2, y: this.g - 190 - this.bh, w: this.bw, h: this.bh,
      puzzleBlock: true, idx: sl.idx, skipDraw: true
    }));
    this.pool = shuffleLB(mode.entries.map((_, i) => i));
    this.poolPos = 0;
    this.lastIdx = -1;
    this.current = null;   // the active content entry
    this.answer = null;    // this round's correct value
    this.state = 'idle';   // 'idle' -> 'fly' -> 'hold' -> nextPuzzle() -> 'idle'
    this.flyT = 0; this.holdT = 0; this.flyFrom = -1;
    this.wobble = [0, 0, 0];
    this.cool = [0, 0, 0];
    this.onCorrect = mode.onCorrect || (() => {
      game.candy++;
      AudioSys.sfx('candy');
      Particles.candyBurst(640, this.g - 300, 8);
    });
    this.nextPuzzle();
  }
  nextPuzzle() {
    if (this.poolPos >= this.pool.length) {
      this.pool = shuffleLB(this.mode.entries.map((_, i) => i));
      this.poolPos = 0;
      // a fresh shuffle could deal the same entry that just ended the last
      // pass right back out first — swap it away so no two consecutive
      // puzzles are ever the same, even across a reshuffle boundary
      if (this.pool.length > 1 && this.pool[0] === this.lastIdx) {
        const tmp = this.pool[0]; this.pool[0] = this.pool[1]; this.pool[1] = tmp;
      }
    }
    const idx = this.pool[this.poolPos++];
    this.lastIdx = idx;
    this.current = this.mode.entries[idx];
    const round = this.mode.round(this.current);
    this.answer = round.correct;
    const options = shuffleLB(round.options);
    for (let i = 0; i < 3; i++) this.slots[i].value = options[i];
    this.state = 'idle';
    this.flyT = 0; this.holdT = 0; this.flyFrom = -1;
    this.wobble = [0, 0, 0];
  }
  onAnswer(solid) {
    const i = solid.idx;
    if (this.cool[i] > 0 || this.state !== 'idle') return;
    this.cool[i] = 0.3;
    if (this.slots[i].value === this.answer) {
      this.state = 'fly';
      this.flyT = 0;
      this.flyFrom = i;
      AudioSys.sfx('boing');
      AudioSys.sfx('collect');
      Particles.burst(this.slots[i].x, this.g - 190 - this.bh / 2, 10,
        { colors: ['#ffd24a', '#fff'], type: 'sparkle', sp1: 220, l1: 0.6, s1: 9 });
    } else {
      this.wobble[i] = 0.4;
      AudioSys.sfx('plop');
    }
  }
  update(dt) {
    for (let i = 0; i < 3; i++) {
      if (this.cool[i] > 0) this.cool[i] = Math.max(0, this.cool[i] - dt);
      if (this.wobble[i] > 0) this.wobble[i] = Math.max(0, this.wobble[i] - dt);
    }
    if (this.state === 'fly') {
      this.flyT += dt;
      if (this.flyT >= 0.6) {
        this.flyT = 0.6;
        this.state = 'hold';
        this.holdT = 0;
        AudioSys.sfx('powerup');
        this.onCorrect();
      }
    } else if (this.state === 'hold') {
      this.holdT += dt;
      if (this.holdT > 0.9) this.nextPuzzle();
    }
  }
  drawChoice(ctx, value, x, y, size) {
    if (this.mode.drawChoice) { this.mode.drawChoice(ctx, value, x, y, size); return; }
    outlineText(ctx, String(value), x, y, size, '#fff', '#2a3a6a');
  }
  draw(ctx) {
    this.mode.drawPrompt(ctx, this.current, this.state);
    for (let i = 0; i < 3; i++) {
      const sl = this.slots[i];
      const bx = sl.x, by = this.g - 190 - this.bh / 2;
      const wob = this.wobble[i] > 0 ? Math.sin(this.wobble[i] * 40) * 6 : 0;
      ctx.save();
      ctx.translate(bx + wob, by);
      ctx.globalAlpha = (this.state !== 'idle' && i !== this.flyFrom) ? 0.5 : 1;
      const g = ctx.createLinearGradient(0, -this.bh / 2, 0, this.bh / 2);
      g.addColorStop(0, '#7fd8ff'); g.addColorStop(1, '#4aa3ff');
      ctx.fillStyle = g;
      rr(ctx, -this.bw / 2, -this.bh / 2, this.bw, this.bh, this.bw * 0.18); ctx.fill();
      ctx.strokeStyle = 'rgba(30,40,70,0.5)'; ctx.lineWidth = 3;
      rr(ctx, -this.bw / 2, -this.bh / 2, this.bw, this.bh, this.bw * 0.18); ctx.stroke();
      if (!(i === this.flyFrom && this.state === 'fly')) {
        this.drawChoice(ctx, sl.value, 0, 4, this.bw * 0.55);
      }
      ctx.restore();
    }
    if (this.state === 'fly') {
      const sl = this.slots[this.flyFrom];
      const t = this.mode.flyTarget ? this.mode.flyTarget(this.current) : { x: 640, y: 285 };
      const p = this.flyT / 0.6;
      const ex = lerp(sl.x, t.x, p);
      const ey = lerp(this.g - 190 - this.bh / 2, t.y, p) - Math.sin(p * Math.PI) * 80;
      this.drawChoice(ctx, sl.value, ex, ey, lerp(this.bw * 0.55, 44, p));
    }
  }
}

// ---- mode 1: Letter Blocks (Beginning Letters) ----
// The Block Meadow original. Content = LB_WORDS/LB_ICONS above; everything
// physical comes from the engine.
class LetterBlocksMachine extends PuzzleBlocksMachine {
  constructor(groundY) {
    super(groundY, {
      entries: LB_WORDS,
      round: w => ({ correct: w.correct, options: [w.correct].concat(w.distractors) }),
      drawPrompt(ctx, w, phase) {
        LB_ICONS[w.word](ctx, 640, 150, 190);
        const filled = phase === 'hold';
        outlineText(ctx, filled ? w.word.toUpperCase() : w.prompt, 640, 285, 64, filled ? '#7be07b' : '#fff');
      },
      // the flying letter lands exactly on the prompt's blank
      flyTarget: w => ({ x: 640 - (w.prompt.length * 40) / 2 + 20, y: 285 })
    });
  }
}
