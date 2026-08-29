# Letter Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a reusable Letter Blocks mini-game framework plus its first instance — a Beginning Letters room in Block Meadow — in Block Buddies, a zero-build-step canvas platformer.

**Architecture:** A new `js/letterblocks.js` module holds a 20-word content table, 20 procedural icon renderers, and a `LetterBlocksMachine` puzzle-controller class. It plugs into the existing `lv.puzzle` secret-room-machine convention (same slot used by `PipeWorks`/`BeatBash`/etc.), reuses the proven Buddy-Block head-bonk collision mechanic for its three answer blocks, and exits through a new small reusable `ExitDoor` primitive (added to `entities.js`) rather than the win-state `subWin` flow every other sublevel uses, since this room has no win condition and must always stay replayable.

**Tech Stack:** Plain ES5-ish JS, `<script>` tags, HTML5 Canvas 2D, no build step, no dependencies. Testing is a single headless Node `vm` harness (`test/harness.js`) that boots the real game and drives it with synthetic input — there is no per-file unit test framework.

**Spec:** `docs/superpowers/specs/2026-08-29-letter-blocks-design.md`

## Global Constraints

- Zero build step: plain `<script>` tags only, no ES modules, no bundler, no npm deps. `index.html` must keep working from `file://`.
- No asset files: all art is procedural canvas drawing (reuse `rr`, `drawFace`, `outlineText`, `TAU` from `js/util.js`); all audio is procedural via `AudioSys.sfx(name)` — use only sfx names that already exist in `js/audio.js`.
- Design for a 5-year-old: forgiving, no punishment for wrong answers, generous hitboxes, replayable indefinitely.
- Load order matters: `js/letterblocks.js` must load after `js/entities.js` (needs nothing from it directly, but sits alongside it conceptually) and **before** `js/levels.js` (which references `LetterBlocksMachine`/`LB_ICONS` in `buildLevel`). This exact order must be replicated in **three** places: `index.html`, `test/harness.js`'s file-load loop, and `tools/screenshot.sh`'s generated `<script>` tags.
- Reward hook uses the existing candy economy (`game.candy++`) — no new score/currency.
- Version bump is **MINOR** (v1.17.0 → v1.18.0): new player-visible content, no save-format break.
- Every new feature gets a harness check (project convention — 3 shipped bugs were caught this way).

### A note on "TDD" in this codebase

This project has no per-file unit test framework — `test/harness.js` is one sequential script that boots the entire game in a Node `vm` and plays through it with `check(name, boolean)` assertions. Referencing an undefined class/global before it's implemented crashes the whole harness with a `ReferenceError` rather than failing one assertion cleanly, so strict red/green-per-line isn't practical here. Each task below still follows write → verify → commit, adapted to this reality: implement the code for a task, add its harness checks in the same task, then run the harness once and confirm the new checks print `PASS` and the run still ends `ALL CHECKS PASSED`.

---

### Task 1: Word bank, icon renderers, and the three-file load order

**Files:**
- Create: `js/letterblocks.js`
- Modify: `index.html:22-27` (script tags)
- Modify: `test/harness.js:79` (file-load loop)
- Modify: `tools/screenshot.sh:27-28` (generated `<script>` tags)
- Modify: `test/harness.js` (new checks, inserted after the "PIPE ROOM" section, before the "TORCH CAVERN" section — see Task 4 for the exact anchor)

**Interfaces:**
- Produces: `const LB_WORDS` — array of `{ word, prompt, correct, distractors }`, 20 entries. `const LB_ICONS` — object keyed by `word`, each value a function `(ctx, cx, cy, s) => void` that paints one icon centered at `(cx, cy)` at scale `s`. `function shuffleLB(arr)` — returns a new Fisher-Yates-shuffled copy of `arr`, non-destructive.
- Consumes: globals from `js/util.js` (already loaded first): `TAU`, `rr(ctx,x,y,w,h,r)`, `drawFace(ctx,cx,cy,s,mood,t,seed,px,py)`.

- [ ] **Step 1: Create `js/letterblocks.js` with the word bank and icon table**

```js
'use strict';
// ================================================================ letter blocks
// A reusable picture-prompt mini-game framework. This first instance teaches
// missing first letters (Block Meadow's "Letter Blocks: Beginning Letters").
// Puzzle definitions (LB_WORDS) and rendering (LB_ICONS) are deliberately
// separate from the puzzle-controller machine below them, so a future mode
// (missing-last-letter, picture-to-word matching, ...) can supply its own
// word list and icons and reuse everything else untouched.

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
  { word: 'apple', prompt: '_PPLE', correct: 'A', distractors: ['O', 'U'] }
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

// Bold, unambiguous silhouettes — a face where it reads naturally (animals,
// sun, moon, apple, ball), no face where one would look odd (book, bed, cup,
// hat, car, tree). Every icon is drawn centered at (cx, cy) at scale s.
const LB_ICONS = {
  cat(ctx, cx, cy, s) {
    lbFill(ctx, '#f0a85c'); lbCircle(ctx, cx, cy, s * 0.4);
    lbFill(ctx, '#f0a85c');
    lbEar(ctx, cx - s * 0.34, cy - s * 0.26, cx - s * 0.5, cy - s * 0.6, cx - s * 0.12, cy - s * 0.36);
    lbEar(ctx, cx + s * 0.34, cy - s * 0.26, cx + s * 0.5, cy - s * 0.6, cx + s * 0.12, cy - s * 0.36);
    drawFace(ctx, cx, cy + s * 0.04, s, 'happy', 0, 1);
    ctx.strokeStyle = '#c07a30'; ctx.lineWidth = Math.max(2, s * 0.02);
    for (const sd of [-1, 1]) for (const dy of [-0.06, 0.02, 0.1]) {
      ctx.beginPath(); ctx.moveTo(cx + sd * s * 0.1, cy + s * dy); ctx.lineTo(cx + sd * s * 0.4, cy + s * (dy - 0.02)); ctx.stroke();
    }
  },
  dog(ctx, cx, cy, s) {
    lbFill(ctx, '#c99a5b'); lbCircle(ctx, cx, cy, s * 0.4);
    lbFill(ctx, '#a97b3f');
    lbEllipse(ctx, cx - s * 0.4, cy - s * 0.05, s * 0.14, s * 0.26, -0.3);
    lbEllipse(ctx, cx + s * 0.4, cy - s * 0.05, s * 0.14, s * 0.26, 0.3);
    drawFace(ctx, cx, cy + s * 0.04, s, 'happy', 0, 2);
    lbFill(ctx, '#e88a9a'); lbEllipse(ctx, cx, cy + s * 0.26, s * 0.08, s * 0.12);
  },
  pig(ctx, cx, cy, s) {
    lbFill(ctx, '#f6b8c6'); lbCircle(ctx, cx, cy, s * 0.4);
    lbEar(ctx, cx - s * 0.3, cy - s * 0.34, cx - s * 0.42, cy - s * 0.56, cx - s * 0.12, cy - s * 0.42);
    lbEar(ctx, cx + s * 0.3, cy - s * 0.34, cx + s * 0.42, cy - s * 0.56, cx + s * 0.12, cy - s * 0.42);
    drawFace(ctx, cx, cy - s * 0.02, s, 'happy', 0, 3);
    ctx.save(); ctx.translate(cx, cy + s * 0.28);
    lbFill(ctx, '#e888a0'); rr(ctx, -s * 0.16, -s * 0.1, s * 0.32, s * 0.2, s * 0.1); ctx.fill();
    lbFill(ctx, '#c96082'); lbCircle(ctx, -s * 0.06, 0, s * 0.03); lbCircle(ctx, s * 0.06, 0, s * 0.03);
    ctx.restore();
  },
  fox(ctx, cx, cy, s) {
    lbFill(ctx, '#ef8a3d');
    ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.5); ctx.lineTo(cx - s * 0.42, cy + s * 0.34); ctx.lineTo(cx + s * 0.42, cy + s * 0.34); ctx.closePath(); ctx.fill();
    lbEar(ctx, cx - s * 0.3, cy - s * 0.36, cx - s * 0.46, cy - s * 0.66, cx - s * 0.1, cy - s * 0.46);
    lbEar(ctx, cx + s * 0.3, cy - s * 0.36, cx + s * 0.46, cy - s * 0.66, cx + s * 0.1, cy - s * 0.46);
    lbFill(ctx, '#fff2e0');
    ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.06); ctx.lineTo(cx - s * 0.22, cy + s * 0.34); ctx.lineTo(cx + s * 0.22, cy + s * 0.34); ctx.closePath(); ctx.fill();
    drawFace(ctx, cx, cy - s * 0.06, s * 0.9, 'happy', 0, 4);
    lbFill(ctx, '#3a2a3a'); lbCircle(ctx, cx, cy + s * 0.16, s * 0.035);
  },
  bug(ctx, cx, cy, s) {
    lbFill(ctx, '#57c26b'); lbEllipse(ctx, cx, cy, s * 0.38, s * 0.3);
    ctx.strokeStyle = '#2f8f45'; ctx.lineWidth = Math.max(2, s * 0.025);
    for (const sd of [-1, 1]) for (const dy of [-0.16, 0, 0.16]) {
      ctx.beginPath(); ctx.moveTo(cx + sd * s * 0.3, cy + s * dy); ctx.lineTo(cx + sd * s * 0.5, cy + s * (dy - 0.08)); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(cx - s * 0.12, cy - s * 0.28); ctx.lineTo(cx - s * 0.22, cy - s * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s * 0.12, cy - s * 0.28); ctx.lineTo(cx + s * 0.22, cy - s * 0.5); ctx.stroke();
    lbFill(ctx, '#ffe156'); lbCircle(ctx, cx - s * 0.22, cy - s * 0.51, s * 0.04); lbCircle(ctx, cx + s * 0.22, cy - s * 0.51, s * 0.04);
    drawFace(ctx, cx, cy - s * 0.02, s * 0.8, 'happy', 0, 5);
    lbFill(ctx, '#2f8f45'); lbCircle(ctx, cx - s * 0.14, cy + s * 0.12, s * 0.05); lbCircle(ctx, cx + s * 0.14, cy + s * 0.12, s * 0.05);
  },
  fish(ctx, cx, cy, s) {
    lbFill(ctx, '#4aa3ff'); lbEllipse(ctx, cx - s * 0.05, cy, s * 0.4, s * 0.28);
    ctx.beginPath(); ctx.moveTo(cx + s * 0.32, cy); ctx.lineTo(cx + s * 0.56, cy - s * 0.22); ctx.lineTo(cx + s * 0.56, cy + s * 0.22); ctx.closePath(); ctx.fill();
    lbFill(ctx, '#2f7fd8');
    ctx.beginPath(); ctx.moveTo(cx - s * 0.02, cy - s * 0.26); ctx.lineTo(cx - s * 0.2, cy - s * 0.42); ctx.lineTo(cx + s * 0.14, cy - s * 0.3); ctx.closePath(); ctx.fill();
    drawFace(ctx, cx - s * 0.16, cy, s * 0.7, 'happy', 0, 6);
  },
  bird(ctx, cx, cy, s) {
    lbFill(ctx, '#4aa3ff'); lbEllipse(ctx, cx, cy + s * 0.06, s * 0.36, s * 0.3);
    lbFill(ctx, '#2f7fd8'); lbEllipse(ctx, cx + s * 0.06, cy + s * 0.1, s * 0.2, s * 0.16, 0.5);
    lbFill(ctx, '#ff9f43');
    ctx.beginPath(); ctx.moveTo(cx - s * 0.34, cy + s * 0.02); ctx.lineTo(cx - s * 0.54, cy + s * 0.08); ctx.lineTo(cx - s * 0.34, cy + s * 0.16); ctx.closePath(); ctx.fill();
    drawFace(ctx, cx - s * 0.1, cy - s * 0.06, s * 0.8, 'happy', 0, 7);
  },
  frog(ctx, cx, cy, s) {
    lbFill(ctx, '#57c26b'); lbEllipse(ctx, cx, cy + s * 0.1, s * 0.42, s * 0.3);
    lbCircle(ctx, cx - s * 0.24, cy - s * 0.22, s * 0.16); lbCircle(ctx, cx + s * 0.24, cy - s * 0.22, s * 0.16);
    drawFace(ctx, cx - s * 0.24, cy - s * 0.22, s * 0.55, 'happy', 0, 8);
    drawFace(ctx, cx + s * 0.24, cy - s * 0.22, s * 0.55, 'happy', 0, 8);
    lbFill(ctx, '#2f8f45'); lbCircle(ctx, cx - s * 0.14, cy + s * 0.16, s * 0.04); lbCircle(ctx, cx + s * 0.16, cy + s * 0.22, s * 0.04);
  },
  duck(ctx, cx, cy, s) {
    lbFill(ctx, '#ffe156'); lbCircle(ctx, cx, cy + s * 0.04, s * 0.4);
    lbFill(ctx, '#ff9f43'); rr(ctx, cx + s * 0.08, cy + s * 0.06, s * 0.4, s * 0.16, s * 0.08); ctx.fill();
    drawFace(ctx, cx - s * 0.04, cy - s * 0.02, s * 0.85, 'happy', 0, 9);
  },
  bear(ctx, cx, cy, s) {
    lbFill(ctx, '#a9784a');
    lbCircle(ctx, cx - s * 0.34, cy - s * 0.34, s * 0.14); lbCircle(ctx, cx + s * 0.34, cy - s * 0.34, s * 0.14);
    lbCircle(ctx, cx, cy, s * 0.4);
    lbFill(ctx, '#d9b58c'); lbEllipse(ctx, cx, cy + s * 0.1, s * 0.2, s * 0.15);
    drawFace(ctx, cx, cy, s, 'happy', 0, 10);
  },
  ball(ctx, cx, cy, s) {
    lbFill(ctx, '#ff6b6b'); lbCircle(ctx, cx, cy, s * 0.42);
    lbFill(ctx, '#ffe156');
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.42, -0.5, 0.5); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.42, Math.PI - 0.5, Math.PI + 0.5); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
    drawFace(ctx, cx, cy, s * 0.85, 'happy', 0, 11);
  },
  book(ctx, cx, cy, s) {
    lbFill(ctx, '#4aa3ff'); rr(ctx, cx - s * 0.36, cy - s * 0.3, s * 0.72, s * 0.6, s * 0.06); ctx.fill();
    lbFill(ctx, '#fff'); rr(ctx, cx - s * 0.28, cy - s * 0.22, s * 0.56, s * 0.44, s * 0.03); ctx.fill();
    ctx.strokeStyle = '#cfe4ff'; ctx.lineWidth = Math.max(2, s * 0.02);
    for (const dy of [-0.08, 0.04, 0.16]) { ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy + s * dy); ctx.lineTo(cx + s * 0.2, cy + s * dy); ctx.stroke(); }
  },
  bed(ctx, cx, cy, s) {
    lbFill(ctx, '#b06cf0'); rr(ctx, cx - s * 0.44, cy - s * 0.06, s * 0.88, s * 0.3, s * 0.06); ctx.fill();
    lbFill(ctx, '#fff'); rr(ctx, cx - s * 0.4, cy - s * 0.24, s * 0.24, s * 0.2, s * 0.05); ctx.fill();
    lbFill(ctx, '#8a4fd0'); rr(ctx, cx - s * 0.44, cy + s * 0.22, s * 0.88, s * 0.1, s * 0.03); ctx.fill();
    lbFill(ctx, '#6a3aad');
    rr(ctx, cx - s * 0.44, cy + s * 0.3, s * 0.1, s * 0.14, s * 0.03); ctx.fill();
    rr(ctx, cx + s * 0.34, cy + s * 0.3, s * 0.1, s * 0.14, s * 0.03); ctx.fill();
  },
  cup(ctx, cx, cy, s) {
    lbFill(ctx, '#ff9f43'); rr(ctx, cx - s * 0.26, cy - s * 0.3, s * 0.52, s * 0.56, s * 0.05); ctx.fill();
    ctx.strokeStyle = '#ff9f43'; ctx.lineWidth = s * 0.08;
    ctx.beginPath(); ctx.arc(cx + s * 0.36, cy - s * 0.02, s * 0.16, -1.2, 1.2); ctx.stroke();
    lbFill(ctx, '#fff2e0'); rr(ctx, cx - s * 0.2, cy - s * 0.24, s * 0.4, s * 0.1, s * 0.04); ctx.fill();
  },
  hat(ctx, cx, cy, s) {
    lbFill(ctx, '#57c26b'); lbEllipse(ctx, cx, cy + s * 0.26, s * 0.46, s * 0.1);
    ctx.beginPath(); ctx.moveTo(cx - s * 0.26, cy + s * 0.2); ctx.quadraticCurveTo(cx, cy - s * 0.5, cx + s * 0.26, cy + s * 0.2); ctx.closePath(); ctx.fill();
    lbFill(ctx, '#3a9450'); rr(ctx, cx - s * 0.26, cy + s * 0.1, s * 0.52, s * 0.1, s * 0.04); ctx.fill();
  },
  car(ctx, cx, cy, s) {
    lbFill(ctx, '#ff6b6b'); rr(ctx, cx - s * 0.44, cy - s * 0.04, s * 0.88, s * 0.28, s * 0.08); ctx.fill();
    rr(ctx, cx - s * 0.26, cy - s * 0.28, s * 0.52, s * 0.26, s * 0.06); ctx.fill();
    lbFill(ctx, '#cdeeff'); rr(ctx, cx - s * 0.2, cy - s * 0.24, s * 0.18, s * 0.16, s * 0.02); ctx.fill();
    rr(ctx, cx + s * 0.04, cy - s * 0.24, s * 0.18, s * 0.16, s * 0.02); ctx.fill();
    lbFill(ctx, '#2e2430'); lbCircle(ctx, cx - s * 0.26, cy + s * 0.26, s * 0.12); lbCircle(ctx, cx + s * 0.26, cy + s * 0.26, s * 0.12);
    lbFill(ctx, '#8a7fae'); lbCircle(ctx, cx - s * 0.26, cy + s * 0.26, s * 0.05); lbCircle(ctx, cx + s * 0.26, cy + s * 0.26, s * 0.05);
  },
  sun(ctx, cx, cy, s) {
    lbFill(ctx, '#ffe156');
    for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(i * TAU / 8);
      rr(ctx, -s * 0.05, -s * 0.56, s * 0.1, s * 0.2, s * 0.04); ctx.fill();
      ctx.restore();
    }
    lbCircle(ctx, cx, cy, s * 0.36);
    drawFace(ctx, cx, cy, s, 'happy', 0, 12);
  },
  moon(ctx, cx, cy, s) {
    lbFill(ctx, '#e8ecff'); lbCircle(ctx, cx, cy, s * 0.4);
    ctx.save(); ctx.globalCompositeOperation = 'destination-out';
    lbCircle(ctx, cx + s * 0.18, cy - s * 0.1, s * 0.34);
    ctx.restore();
    drawFace(ctx, cx - s * 0.08, cy + s * 0.02, s * 0.85, 'happy', 0, 13);
  },
  tree(ctx, cx, cy, s) {
    lbFill(ctx, '#8a5a34'); rr(ctx, cx - s * 0.08, cy + s * 0.06, s * 0.16, s * 0.36, s * 0.04); ctx.fill();
    lbFill(ctx, '#57c26b');
    lbCircle(ctx, cx, cy - s * 0.22, s * 0.3);
    lbCircle(ctx, cx - s * 0.24, cy - s * 0.02, s * 0.24);
    lbCircle(ctx, cx + s * 0.24, cy - s * 0.02, s * 0.24);
  },
  apple(ctx, cx, cy, s) {
    lbFill(ctx, '#ff6b6b'); lbCircle(ctx, cx, cy + s * 0.04, s * 0.4);
    lbFill(ctx, '#8a5a34'); rr(ctx, cx - s * 0.03, cy - s * 0.44, s * 0.06, s * 0.16, s * 0.02); ctx.fill();
    lbFill(ctx, '#57c26b');
    ctx.beginPath(); ctx.moveTo(cx + s * 0.02, cy - s * 0.38); ctx.quadraticCurveTo(cx + s * 0.26, cy - s * 0.46, cx + s * 0.2, cy - s * 0.24); ctx.closePath(); ctx.fill();
    drawFace(ctx, cx, cy + s * 0.08, s * 0.8, 'happy', 0, 14);
  }
};
```

- [ ] **Step 2: Wire the new file into all three load-order lists**

In `index.html`, change lines 22-27 from:

```html
<script src="js/util.js"></script>
<script src="js/audio.js"></script>
<script src="js/particles.js"></script>
<script src="js/entities.js"></script>
<script src="js/levels.js"></script>
<script src="js/game.js"></script>
```

to:

```html
<script src="js/util.js"></script>
<script src="js/audio.js"></script>
<script src="js/particles.js"></script>
<script src="js/entities.js"></script>
<script src="js/letterblocks.js"></script>
<script src="js/levels.js"></script>
<script src="js/game.js"></script>
```

In `test/harness.js` line 79, change:

```js
for (const f of ['util.js', 'audio.js', 'particles.js', 'entities.js', 'levels.js', 'game.js']) {
```

to:

```js
for (const f of ['util.js', 'audio.js', 'particles.js', 'entities.js', 'letterblocks.js', 'levels.js', 'game.js']) {
```

In `tools/screenshot.sh`, change the generated `<script>` block (currently two lines around line 27-28):

```html
<script src="js/util.js"></script><script src="js/audio.js"></script><script src="js/particles.js"></script>
<script src="js/entities.js"></script><script src="js/levels.js"></script><script src="js/game.js"></script>
```

to:

```html
<script src="js/util.js"></script><script src="js/audio.js"></script><script src="js/particles.js"></script>
<script src="js/entities.js"></script><script src="js/letterblocks.js"></script><script src="js/levels.js"></script><script src="js/game.js"></script>
```

- [ ] **Step 3: Add data-integrity harness checks**

Open `test/harness.js` and find the line (around line 1047):

```js
check('walking over the completed pipe never re-swallows', G().level.n === 1 && G().player.x > 2960);
```

Immediately after it (still before the `// ---------------- secret: TORCH CAVERN` comment), insert:

```js

// ---------------- Letter Blocks: content data integrity ----------------
check('the word bank has exactly 20 entries', vm.runInContext('LB_WORDS.length', sandbox) === 20);
check('every word has 3 unique answer letters (correct + 2 distractors)',
  vm.runInContext('LB_WORDS.every(w => new Set([w.correct, ...w.distractors]).size === 3)', sandbox));
check('every word has a matching icon renderer',
  vm.runInContext('LB_WORDS.every(w => typeof LB_ICONS[w.word] === "function")', sandbox));
check('every prompt keeps the first letter blanked and the rest matching the word',
  vm.runInContext("LB_WORDS.every(w => w.prompt[0] === '_' && w.prompt.slice(1).toLowerCase() === w.word.slice(1))", sandbox));
```

- [ ] **Step 4: Run the harness and confirm the new checks pass**

Run: `node test/harness.js`
Expected: the four new `PASS` lines above appear (search output for `word bank has exactly 20 entries`), and the run still ends with `ALL CHECKS PASSED` (the pre-existing full playthrough is unaffected — `js/letterblocks.js` only defines new globals so far, nothing consumes them yet).

- [ ] **Step 5: `node --check` and commit**

Run: `node --check js/letterblocks.js`
Expected: no output (valid syntax).

```bash
git add js/letterblocks.js index.html test/harness.js tools/screenshot.sh
git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" commit -m "Letter Blocks: word bank + 20 procedural icons (js/letterblocks.js)"
```

---

### Task 2: `ExitDoor` — a reusable non-solid exit trigger

**Files:**
- Modify: `js/entities.js` (new `ExitDoor` class, placed immediately before `class SubDoor` at line 4246)
- Modify: `js/levels.js:31-50` (`newLevel()` — add `exitDoors: []`)
- Modify: `js/game.js:649` (update loop), `js/game.js:1268` (draw loop)
- Modify: `test/harness.js` (new check)

**Interfaces:**
- Produces: `class ExitDoor { constructor(cx, groundY) }` with `.update(dt)` (calls `game.exitSub()` on overlap with `game.player` while `game.state === 'play'` and no cutscene/end-phase is active) and `.draw(ctx)`. Every level object now carries `lv.exitDoors` (array, empty unless populated by `buildLevel`).
- Consumes: `overlaps(a, b)` and `rand(a, b)` (`js/util.js`), `AudioSys.sfx` (`js/audio.js`), `game.player`/`game.state`/`game.cut`/`game.endPhase`/`game.exitSub` (`js/game.js`, already defined by the time any level runs).

- [ ] **Step 1: Add the `ExitDoor` class to `js/entities.js`**

Find `class SubDoor {` (line 4246) and insert immediately before it:

```js
// A non-solid overlap trigger that leaves a sublevel WITHOUT going through
// the win-state subWin/party flow every other sublevel uses. Continuous-play
// rooms with no win condition (Letter Blocks, and future ones like it) need
// a door that just always works.
class ExitDoor {
  constructor(cx, groundY) {
    this.w = 70; this.h = 100;
    this.x = cx - this.w / 2; this.y = groundY - this.h; this.groundY = groundY;
    this.t = rand(9);
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt) {
    this.t += dt;
    if (game.state === 'play' && !game.cut && !game.endPhase && overlaps(this, game.player)) {
      AudioSys.sfx('switch');
      game.exitSub();
    }
    if (chance(0.06)) {
      Particles.burst(this.cx + rand(-20, 20), this.y + rand(10, this.h - 10), 1,
        { colors: ['#ffe156', '#fff'], type: 'sparkle', sp1: 25, grav: -50, l1: 0.8, s1: 8, up: 0 });
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, '#ffe9a8'); g.addColorStop(1, '#ffd24a');
    ctx.fillStyle = g;
    rr(ctx, 0, 0, this.w, this.h, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,20,0.5)'; ctx.lineWidth = 4;
    rr(ctx, 0, 0, this.w, this.h, 14); ctx.stroke();
    ctx.fillStyle = '#7a5a20';
    ctx.beginPath(); ctx.arc(this.w * 0.28, this.h * 0.55, 6, 0, TAU); ctx.fill();
    outlineText(ctx, 'EXIT', this.w / 2, this.h * 0.22, 26, '#7a5a20', '#fff');
    ctx.restore();
  }
}
```

- [ ] **Step 2: Wire `lv.exitDoors` into `newLevel()`, the update loop, and the draw loop**

In `js/levels.js`, find (around line 41):

```js
    subDoors: [], flight: false,
```

Change to:

```js
    subDoors: [], exitDoors: [], flight: false,
```

In `js/game.js`, find (around line 649):

```js
  for (const sd of lv.subDoors) sd.update(dt);
```

Change to:

```js
  for (const sd of lv.subDoors) sd.update(dt);
  for (const ed of lv.exitDoors) ed.update(dt);
```

In `js/game.js`, find (around line 1268):

```js
  for (const sd of lv.subDoors) sd.draw(ctx);
```

Change to:

```js
  for (const sd of lv.subDoors) sd.draw(ctx);
  for (const ed of lv.exitDoors) ed.draw(ctx);
```

- [ ] **Step 3: Add a harness check that proves `ExitDoor` works, using an existing sublevel**

Open `test/harness.js`, find the checks added in Task 1 Step 3 (the `Letter Blocks: content data integrity` block), and add immediately after them:

```js

// ExitDoor: a generic exit trigger, proven here inside an existing sublevel
// (before any level actually uses it) so this check is independent of the
// full Letter Blocks room built in a later task.
vm.runInContext('game.startLevel(1)', sandbox);
frames(150);
put(2950 - 28, 620 - 94);
frames(10);
check('entered a sublevel to test ExitDoor in isolation', G().level.n === 'piperoom');
vm.runInContext('game.level.exitDoors.push(new ExitDoor(300, 620));', sandbox);
vm.runInContext('game.player.x = 300 - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vx = 0; game.player.vy = 0;', sandbox);
frames(5);
check('ExitDoor overlap calls exitSub and returns to the host level', G().level.n === 1 && G().state === 'play');
vm.runInContext('game.goTitle()', sandbox);
frames(3);
```

- [ ] **Step 4: Run the harness**

Run: `node test/harness.js`
Expected: `entered a sublevel to test ExitDoor in isolation` and `ExitDoor overlap calls exitSub and returns to the host level` both `PASS`; run still ends `ALL CHECKS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add js/entities.js js/levels.js js/game.js test/harness.js
git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" commit -m "Add ExitDoor: a reusable exit trigger for win-state-free sublevels"
```

---

### Task 3: `LetterBlocksMachine` puzzle controller

**Files:**
- Modify: `js/letterblocks.js` (append the class, after `LB_ICONS`)
- Modify: `test/harness.js` (new logic-only checks — no physics/level needed yet)

**Interfaces:**
- Consumes: `LB_WORDS`, `shuffleLB` (Task 1, this file), `game.candy`, `AudioSys.sfx`, `Particles.burst`/`candyBurst` (already-loaded globals), `rr`/`outlineText`/`lerp`/`TAU` (`js/util.js`).
- Produces: `class LetterBlocksMachine { constructor(groundY) }` with:
  - `.solids` — array of 3 plain objects `{ x, y, w, h, letterBlock: true, idx, skipDraw: true }`, meant to be pushed into `lv.solids` by the level builder (Task 4).
  - `.slots` — array of 3 `{ x, letter, idx }` (fixed physical `x` positions; `letter` changes every round).
  - `.state` — `'idle' | 'fly' | 'hold'`.
  - `.current` — the active `LB_WORDS` entry.
  - `.onAnswer(solid)` — called by `game.bumpBlock` (Task 4) when a player bonks one of `.solids`.
  - `.update(dt)`, `.draw(ctx)` — called by the generic `lv.puzzle` hooks already wired in `game.js` (`if (lv.puzzle) lv.puzzle.update(dt, pl)` / `.draw(ctx, t)` — extra arguments are simply ignored by these methods).
  - `.onCorrect` — constructor-installed reward callback (defaults to awarding 1 candy), overridable per instance for a future mode.

- [ ] **Step 1: Append `LetterBlocksMachine` to `js/letterblocks.js`**

```js

class LetterBlocksMachine {
  constructor(groundY) {
    this.g = groundY;
    this.bw = 84; this.bh = 84;
    this.slots = [380, 640, 900].map((x, idx) => ({ x, letter: '', idx }));
    this.solids = this.slots.map(sl => ({
      x: sl.x - this.bw / 2, y: this.g - 190 - this.bh, w: this.bw, h: this.bh,
      letterBlock: true, idx: sl.idx, skipDraw: true
    }));
    this.pool = shuffleLB(LB_WORDS.map((_, i) => i));
    this.poolPos = 0;
    this.lastWord = -1;
    this.current = null;
    this.state = 'idle'; // 'idle' -> 'fly' -> 'hold' -> nextPuzzle() -> 'idle'
    this.flyT = 0; this.holdT = 0; this.flyFrom = -1;
    this.wobble = [0, 0, 0];
    this.cool = [0, 0, 0];
    this.onCorrect = () => {
      game.candy++;
      AudioSys.sfx('candy');
      Particles.candyBurst(640, this.g - 300, 8);
    };
    this.nextPuzzle();
  }
  nextPuzzle() {
    if (this.poolPos >= this.pool.length) {
      this.pool = shuffleLB(LB_WORDS.map((_, i) => i));
      this.poolPos = 0;
      // a fresh shuffle could deal the same word that just ended the last
      // pass right back out first — swap it away so no two consecutive
      // puzzles are ever the same word, even across a reshuffle boundary
      if (this.pool.length > 1 && this.pool[0] === this.lastWord) {
        const tmp = this.pool[0]; this.pool[0] = this.pool[1]; this.pool[1] = tmp;
      }
    }
    const idx = this.pool[this.poolPos++];
    this.lastWord = idx;
    this.current = LB_WORDS[idx];
    const options = shuffleLB([this.current.correct].concat(this.current.distractors));
    for (let i = 0; i < 3; i++) this.slots[i].letter = options[i];
    this.state = 'idle';
    this.flyT = 0; this.holdT = 0; this.flyFrom = -1;
    this.wobble = [0, 0, 0];
  }
  onAnswer(solid) {
    const i = solid.idx;
    if (this.cool[i] > 0 || this.state !== 'idle') return;
    this.cool[i] = 0.3;
    if (this.slots[i].letter === this.current.correct) {
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
  // Kept separate from the selection/reward loop and from the answer-block
  // rendering below so a future mode (missing-last-letter, picture-to-word
  // matching) can override just this piece later without touching anything
  // else in the machine.
  drawPrompt(ctx) {
    const word = this.current;
    LB_ICONS[word.word](ctx, 640, 200, 200);
    const filled = this.state === 'hold';
    outlineText(ctx, filled ? word.word.toUpperCase() : word.prompt, 640, 340, 64, filled ? '#7be07b' : '#fff');
  }
  draw(ctx) {
    const word = this.current;
    this.drawPrompt(ctx);
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
        outlineText(ctx, sl.letter, 0, 4, this.bw * 0.55, '#fff', '#2a3a6a');
      }
      ctx.restore();
    }
    if (this.state === 'fly') {
      const sl = this.slots[this.flyFrom];
      const charW = 40, blankX = 640 - (word.prompt.length * charW) / 2 + charW / 2;
      const p = this.flyT / 0.6;
      const ex = lerp(sl.x, blankX, p);
      const ey = lerp(this.g - 190 - this.bh / 2, 340, p) - Math.sin(p * Math.PI) * 80;
      outlineText(ctx, sl.letter, ex, ey, lerp(this.bw * 0.55, 44, p), '#fff', '#2a3a6a');
    }
  }
}
```

- [ ] **Step 2: Add logic-only harness checks (no physics, no level needed)**

In `test/harness.js`, immediately after the ExitDoor checks added in Task 2 Step 3 (still inside the same test file, before the `// ---------------- secret: TORCH CAVERN` section), insert:

```js

// ---------------- Letter Blocks: puzzle-controller logic ----------------
vm.runInContext('game.testLB = new LetterBlocksMachine(620);', sandbox);
const LBT = () => vm.runInContext('game.testLB', sandbox);
check('fresh machine starts idle with a word and 3 unique answer letters',
  LBT().state === 'idle' && !!LBT().current && new Set(LBT().slots.map(s => s.letter)).size === 3 &&
  LBT().slots.some(s => s.letter === LBT().current.correct));

// double-trigger: a second rapid hit on the SAME wrong block is absorbed by its cooldown
const wrongIdx = LBT().slots.findIndex(s => s.letter !== LBT().current.correct);
vm.runInContext(`game.testLB.onAnswer(game.testLB.solids[${wrongIdx}]); game.testLB.onAnswer(game.testLB.solids[${wrongIdx}]);`, sandbox);
check('a wrong hit wobbles the block and changes nothing else',
  LBT().wobble[wrongIdx] > 0 && LBT().state === 'idle');

// correct hit locks the round; a second bump mid-animation (any block) is ignored
const correctIdx = LBT().slots.findIndex(s => s.letter === LBT().current.correct);
const otherIdx = LBT().slots.findIndex((s, i) => i !== correctIdx);
const wordBefore = LBT().current.word;
vm.runInContext(`game.testLB.onAnswer(game.testLB.solids[${correctIdx}]);`, sandbox);
check('a correct hit locks the round into the fly animation', LBT().state === 'fly');
vm.runInContext(`game.testLB.onAnswer(game.testLB.solids[${otherIdx}]);`, sandbox);
check('a second bump during the fly animation is ignored (word and state unchanged)',
  LBT().current.word === wordBefore && LBT().state === 'fly');

// let the fly (0.6s) then hold (0.9s) timers run out
const candyBefore = vm.runInContext('game.candy', sandbox);
vm.runInContext('for (let i = 0; i < 100; i++) game.testLB.update(1 / 60);', sandbox);
check('the reward hook awards exactly one candy through the normal economy',
  vm.runInContext('game.candy', sandbox) === candyBefore + 1);
check('a new randomized puzzle follows automatically, with 3 fresh unique letters',
  LBT().state === 'idle' && LBT().current.word !== wordBefore && new Set(LBT().slots.map(s => s.letter)).size === 3);

// pool exhaustion: 45 rounds (2+ reshuffles of a 20-word pool) never repeat
// back-to-back, and the first pass touches all 20 words
vm.runInContext(`
  game.testLB2 = new LetterBlocksMachine(620);
  game.testLBSeen = [];
  for (let i = 0; i < 45; i++) {
    game.testLBSeen.push(game.testLB2.current.word);
    const okIdx = game.testLB2.slots.findIndex(s => s.letter === game.testLB2.current.correct);
    game.testLB2.onAnswer(game.testLB2.solids[okIdx]);
    for (let f = 0; f < 100; f++) game.testLB2.update(1 / 60);
  }
`, sandbox);
const seen = vm.runInContext('game.testLBSeen', sandbox);
check('no two consecutive puzzles repeat the same word across 45 rounds / 2+ reshuffles',
  seen.every((w, i) => i === 0 || w !== seen[i - 1]));
check('every one of the 20 words appears within the first pass through the pool',
  new Set(seen.slice(0, 20)).size === 20);
```

- [ ] **Step 3: Run the harness**

Run: `node test/harness.js`
Expected: all nine new `PASS` lines above, and the run still ends `ALL CHECKS PASSED`.

- [ ] **Step 4: Commit**

```bash
git add js/letterblocks.js test/harness.js
git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" commit -m "Add LetterBlocksMachine: the Letter Blocks puzzle controller"
```

---

### Task 4: The Block Meadow room — physical integration

**Files:**
- Modify: `js/game.js:257` (`game.bumpBlock` — new `letterBlock` branch)
- Modify: `js/entities.js:347` (head-bump dispatch condition)
- Modify: `js/levels.js` (`LEVEL_META`, `buildLevel` case `'letterblocks'`, meadow `SubDoor` placement)
- Modify: `test/harness.js` (end-to-end physical checks, real jumps)

**Interfaces:**
- Consumes: `LetterBlocksMachine`, `ExitDoor` (Tasks 2-3), `Checkpoint`, `SubDoor`, `addGround` (existing `js/entities.js`/`js/levels.js`).
- Produces: `LEVEL_META.letterblocks`, `buildLevel('letterblocks')`, a `SubDoor` in Block Meadow (`n === 1`) at `x = 560` with `sub: 'letterblocks'`, `style: 'rainbow'`.

- [ ] **Step 1: Teach `game.bumpBlock` about letter blocks**

In `js/game.js`, find (line 257):

```js
game.bumpBlock = function (s) { // head-bonk on a Buddy Block or a candy crate
  const pl = game.player;
  if (s.buddy) {
```

Change to:

```js
game.bumpBlock = function (s) { // head-bonk on a Buddy Block, a candy crate, or a Letter Blocks answer
  const pl = game.player;
  if (s.letterBlock) { game.level.puzzle.onAnswer(s); return; }
  if (s.buddy) {
```

- [ ] **Step 2: Extend the head-bump dispatch condition**

In `js/entities.js`, find (line 347):

```js
      if (res.head && res.headS && (res.headS.buddy || res.headS.bigBonus)) game.bumpBlock(res.headS);
```

Change to:

```js
      if (res.head && res.headS && (res.headS.buddy || res.headS.bigBonus || res.headS.letterBlock)) game.bumpBlock(res.headS);
```

- [ ] **Step 3: Register the sublevel in `LEVEL_META`**

In `js/levels.js`, find (around line 28):

```js
  cloud2: { name: 'THE WEATHER FACTORY 2-2', theme: 'cloud', music: 'cloud' } // stage two: weather recipes
};
```

Change to:

```js
  cloud2: { name: 'THE WEATHER FACTORY 2-2', theme: 'cloud', music: 'cloud' }, // stage two: weather recipes
  letterblocks: { name: 'LETTER BLOCKS', theme: 'meadow', music: 'meadow' }
};
```

- [ ] **Step 4: Add the SubDoor in Block Meadow**

In `js/levels.js`, inside the `if (n === 1) {` block, find:

```js
    // the SECRET PIPE ROOM: a suspiciously oversized pipe that keeps burping
    // candy — walk into it and FWOOOP, you're inside the machine room
    lv.subDoors.push(new SubDoor(2950, G, 'piperoom', 'pipe'));
```

Insert immediately before it:

```js
    // the LETTER BLOCKS learning garden: a rainbow-sparkle door near the
    // start, clear of the first block pile (x=780) — always available, no
    // completion state, replay indefinitely
    lv.subDoors.push(new SubDoor(560, G, 'letterblocks', 'rainbow'));
```

- [ ] **Step 5: Add the `buildLevel` case for `'letterblocks'`**

In `js/levels.js`, find the `if (n === 'piperoom') {` block and insert a new block immediately before it:

```js
  if (n === 'letterblocks') { // ---------------- LETTER BLOCKS: BEGINNING LETTERS
    // A single non-scrolling learning-garden screen: a picture + missing-
    // first-letter word up top, three head-bonkable answer blocks on the
    // floor (same underside-height convention as Buddy Blocks), and an
    // always-open EXIT door. No win state — pure continuous replay.
    lv.w = 1280; lv.h = 720;
    lv.playerStart = { x: 90, y: G - 94 };
    addGround(lv, 0, 1280, G);
    lv.puzzle = new LetterBlocksMachine(G);
    for (const s of lv.puzzle.solids) lv.solids.push(s);
    lv.exitDoors.push(new ExitDoor(1150, G));
    lv.checks.push(new Checkpoint(120, G));
  }

```

- [ ] **Step 6: Add end-to-end harness checks driven by real jumps**

In `test/harness.js`, immediately after the pool-exhaustion checks added in Task 3 Step 2 (still before `// ---------------- secret: TORCH CAVERN`), insert:

```js

// ---------------- secret: LETTER BLOCKS (Beginning Letters) ----------------
vm.runInContext('game.startLevel(1)', sandbox);
frames(150);
check('the meadow hides a rainbow-sparkle learning door',
  vm.runInContext("game.level.subDoors.some(d => d.sub === 'letterblocks')", sandbox));
put(560 - 35, 620 - 94);
frames(10);
check('the rainbow door leads into LETTER BLOCKS', G().level.n === 'letterblocks');
frames(20);
const LB = () => vm.runInContext('game.level.puzzle', sandbox);
check('the room loads with a word, 3 unique answer letters, and an idle state',
  !!LB().current && LB().state === 'idle' && new Set(LB().slots.map(s => s.letter)).size === 3);
const candy0 = G().candy;

// a real jump into the WRONG block: no punishment, puzzle stays active
const wrongSlot = LB().slots.find(s => s.letter !== LB().current.correct);
vm.runInContext(`game.player.x = ${wrongSlot.x} - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vx = 0; game.player.vy = 0;`, sandbox);
tap('ArrowUp');
frames(40);
check('a real jump into the wrong block wobbles it and changes nothing',
  G().candy === candy0 && LB().state === 'idle');

// a real jump into the CORRECT block: locks, flies the letter in, awards candy
const correctSlot = LB().slots.find(s => s.letter === LB().current.correct);
const wordBefore = LB().current.word;
vm.runInContext(`game.player.x = ${correctSlot.x} - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vx = 0; game.player.vy = 0;`, sandbox);
tap('ArrowUp');
frames(40);
check('a real jump into the correct block locks the round', LB().state !== 'idle');
frames(110); // fly (0.6s) + hold (0.9s), with margin
check('candy is awarded exactly once through the normal candy economy', G().candy === candy0 + 1);
check('a new randomized puzzle follows automatically', LB().current.word !== wordBefore && LB().state === 'idle');

// leaving mid success-animation: trigger another correct hit, then exit
// through the door WITHOUT waiting for the fly/hold animation to resolve
const correctSlot2 = LB().slots.find(s => s.letter === LB().current.correct);
vm.runInContext(`game.player.x = ${correctSlot2.x} - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vx = 0; game.player.vy = 0;`, sandbox);
tap('ArrowUp');
frames(40);
check('a second round is mid-animation before the exit attempt', LB().state !== 'idle');
vm.runInContext('game.player.x = 1150 - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vx = 0; game.player.vy = 0;', sandbox);
frames(5);
check('the exit door works even mid-animation and returns to Block Meadow', G().level.n === 1 && G().state === 'play');
check('no puzzle state leaks into the meadow', G().level.puzzle === null);

// re-entering gives a fresh, independent room
put(560 - 35, 620 - 94);
frames(10);
check('re-entering LETTER BLOCKS rebuilds a fresh machine', G().level.n === 'letterblocks' && LB().state === 'idle');
vm.runInContext('game.player.x = 1150 - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vx = 0; game.player.vy = 0;', sandbox);
frames(5);
check('the room is replayable without limit (no completion flag set)', G().level.n === 1 && !G().miniDone.letterblocks);
vm.runInContext('game.goTitle()', sandbox);
frames(3);
```

- [ ] **Step 7: Run the harness (2-3 times, per project convention)**

Run: `node test/harness.js` three times.
Expected: every check above prints `PASS` each run, and every run ends `ALL CHECKS PASSED`. If any run is flaky, that indicates a real nondeterminism bug (per `CLAUDE.md`) — investigate before proceeding; do not re-run hoping it passes.

- [ ] **Step 8: Commit**

```bash
git add js/game.js js/entities.js js/levels.js test/harness.js
git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" commit -m "Letter Blocks: Beginning Letters room in Block Meadow"
```

---

### Task 5: Versioning, documentation, screenshots, and final verification

**Files:**
- Modify: `js/util.js:3` (`GAME_VERSION`)
- Modify: `CHANGELOG.md`
- Modify: `docs/index.html` (badge, footer, new Letter Blocks section, mini-games list, harness-description paragraph)
- Modify: `CLAUDE.md` (architecture table, mini-games bullet list, Block Meadow world-table gimmick note)
- Modify: `BACKLOG.md` (Status board)

- [ ] **Step 1: Bump `GAME_VERSION`**

In `js/util.js` line 3, change:

```js
const GAME_VERSION = '1.17.0'; // SEMVER — bump with every release (see docs/index.html + CHANGELOG.md)
```

to:

```js
const GAME_VERSION = '1.18.0'; // SEMVER — bump with every release (see docs/index.html + CHANGELOG.md)
```

- [ ] **Step 2: Add the `CHANGELOG.md` entry**

In `CHANGELOG.md`, find:

```md
## [1.17.0] - 2026-08-23
```

Insert immediately before it (new top entry):

```md
## [1.18.0] - 2026-08-29

### Added — LETTER BLOCKS: a reusable educational mini-game framework

The first non-platforming mini-game: a picture-prompt puzzle framework
(`js/letterblocks.js`) built to grow into future modes (missing-last-letter,
picture-to-word matching, word families, counting, colors...), plus its
first instance, **Beginning Letters**, in Block Meadow.

- **The room**: a small learning-garden screen off a new rainbow-sparkle
  door (x=560, before the first block pile) — a picture, a word with its
  first letter missing (e.g. "_AT"), and three big physical answer blocks.
  Jump up and bonk the correct one from underneath, exactly like a Buddy
  Block; the letter flies into the blank, the word completes, and candy is
  awarded through the normal economy. Wrong answers just wobble and bounce —
  no punishment, no reset, unlimited retries.
- **20-word pool**: cat, dog, pig, fox, bug, fish, bird, frog, duck, bear,
  ball, book, bed, cup, hat, car, sun, moon, tree, apple — each with its own
  procedural icon and plausible-letter distractors (some intentionally
  overlapping word families, e.g. cat/hat share `_AT`). Shuffled and cycled
  without back-to-back repeats; reshuffles once exhausted.
- **Always replayable**: no required round count, no completion state, no
  score beyond the shared candy counter. A new `ExitDoor` primitive lets the
  room be left at any time, mid-animation or not — the first sublevel exit
  that isn't gated behind a win condition.

## [1.17.0] - 2026-08-23
```

- [ ] **Step 3: Update `docs/index.html` badge and footer**

Find (around line 78):

```html
  <span class="badge">v1.17.0</span>
```

Change to:

```html
  <span class="badge">v1.18.0</span>
```

Find (around line 885):

```
  Block Buddies v1.17.0 · built for Jack ·
```

Change to:

```
  Block Buddies v1.18.0 · built for Jack ·
```

- [ ] **Step 4: Add a Letter Blocks section to `docs/index.html`**

Find the `<h3>Secret Pipe Room ...</h3>` section (around line 590) and insert a new section immediately after its closing `</p>`:

```html
<h3>Letter Blocks: Beginning Letters <small>(rainbow door in Block Meadow, x≈560 — v1.18.0)</small></h3>
<p><strong>A reusable educational mini-game framework, not a one-off.</strong> <code>js/letterblocks.js</code>
keeps content (<code>LB_WORDS</code>, a 20-entry word bank with procedural icons in <code>LB_ICONS</code>) and
the puzzle engine (<code>LetterBlocksMachine</code>, on <code>lv.puzzle</code> like every other secret-room
machine) deliberately separate, so a future mode — missing-last-letter, picture-to-word matching, word
families — can supply its own content and reuse everything else. The room itself is a single non-scrolling
1280×720 screen: a large picture, the word with its first letter missing (e.g. "_AT"), and three big
answer blocks on the floor. Jump up into the correct one's underside exactly like a <strong>Buddy
Block</strong> — same collision mechanic, same G-190 underside-height convention, just bigger for a
readable letter — and it flies into the blank, the word completes, and candy is awarded through the
normal economy. Wrong answers just wobble with a soft "plop" — no penalty, ever. A short per-block
cooldown absorbs a bouncing head clipping the same block twice; a round-level lock keeps a second bump
from interrupting the correct answer's animation. Puzzles are drawn from a shuffled pool that cycles
through all 20 words before reshuffling, and never repeats the same word twice in a row, even across a
reshuffle. There's no win state — a new <strong>ExitDoor</strong> primitive (a plain overlap trigger that
calls <code>game.exitSub()</code> directly, the first sublevel exit that skips the <code>subWin</code>/party
flow entirely) lets the room be left at any time, and re-entering always rebuilds a fresh puzzle.</p>
```

- [ ] **Step 5: Note Letter Blocks in the Block Meadow gimmick paragraph**

Find (around line 352):

```html
<dt>Secret</dt><dd>A suspiciously oversized green pipe (x≈2950) with a face keeps <em>burping candy</em> — walk into it and FWOOOP: the <strong>Secret Pipe Room</strong> (see Mini-games). And since v1.15.0, not secret at all: the <strong>stage archway to BLOCK MEADOW 0-2</strong> (x≈4230, star + "2" badge) stands right before the gate — the world grew to 4650px wide (gate now at x=4530) to fit it.</dd>
```

Change to:

```html
<dt>Secret</dt><dd>A suspiciously oversized green pipe (x≈2950) with a face keeps <em>burping candy</em> — walk into it and FWOOOP: the <strong>Secret Pipe Room</strong> (see Mini-games). Since v1.18.0, a rainbow-sparkle door (x≈560, near the start) leads into <strong>Letter Blocks: Beginning Letters</strong> (see Mini-games). And since v1.15.0, not secret at all: the <strong>stage archway to BLOCK MEADOW 0-2</strong> (x≈4230, star + "2" badge) stands right before the gate — the world grew to 4650px wide (gate now at x=4530) to fit it.</dd>
```

- [ ] **Step 6: Update the harness-description paragraph's check count**

Run: `node test/harness.js | grep -c '^PASS'` to get the real total check count after all of Tasks 1-4's new checks are in place.

Find (around line 828) the sentence ending `...plus a BFS solvability proof of the space maze. 520 checks; it must print <code>ALL CHECKS PASSED</code>.` Update `520` to the real count from the command above, and insert one clause about Letter Blocks into the list of tested systems (it already lists systems like "...the whole Weather Factory: lever reversibility..."). Insert, in the same style, right before that clause's closing "plus" list item:

```
and the Letter Blocks learning room: content-data integrity, the puzzle controller's pool/shuffle/no-repeat/double-trigger logic, and the physical room ridden with real jumps — wrong answers, a correct answer through to its candy reward and next puzzle, leaving mid-animation, and replay,
```

- [ ] **Step 7: Update `CLAUDE.md`**

In the Architecture table, find the row for `js/levels.js` and insert a new row immediately before it:

```md
| `js/letterblocks.js` | `LB_WORDS` (20-word content bank), `LB_ICONS` (procedural icon renderers), `LetterBlocksMachine` (the reusable Letter Blocks puzzle-controller machine, attached as `lv.puzzle` like other secret-room machines) |
```

In the entities.js row, find `... SubDoor (mini-game entrances), ...` and insert `ExitDoor` right after it: change `SubDoor (mini-game entrances), Vine` to `SubDoor (mini-game entrances), ExitDoor (non-solid exit trigger for win-state-free sublevels, `lv.exitDoors`), Vine`.

In the Block Meadow row of "The ten worlds" table, append to the gimmick cell: `; Letter Blocks learning room (SubDoor x=560, rainbow style) — a reusable picture-prompt mini-game framework, first instance Beginning Letters`.

In the "Mini-games/sublevels" bullet, find the sublevel-id list `'meadow2', 'water2', 'cloud2')` and change to `'meadow2', 'water2', 'cloud2', 'letterblocks')`. Immediately after the existing description of Zombie Town/Treehouse Trail in that same bullet, append one sentence in the same style:

```
Letter Blocks ('letterblocks', off Block Meadow) is the first EDUCATIONAL
mini-game and the first reusable *framework*: content (`LB_WORDS`/`LB_ICONS`)
and the puzzle engine (`LetterBlocksMachine`) are deliberately separate so
future picture-prompt modes can reuse the engine with new content. It's also
the first sublevel with no win state — a new `ExitDoor` primitive
(`lv.exitDoors`) lets the room be left at any time via `game.exitSub()`
directly, skipping `subWin`/party entirely, and re-entry always rebuilds a
fresh puzzle.
```

- [ ] **Step 8: Update `BACKLOG.md`**

In the Status board table, find:

```md
| 10 | New World: The Clockwork Castle | Major World | idea (save for a major release) |
```

Insert immediately after it (new row 11):

```md
| 11 | Letter Blocks: Beginning Letters | Educational mini-game | ✅ shipped v1.18.0 — reusable picture-prompt framework (`js/letterblocks.js`: word bank, `LetterBlocksMachine` puzzle controller, `ExitDoor` primitive) + first instance in Block Meadow: missing-first-letter, 20-word pool, candy reward (see CHANGELOG 1.18.0) |
```

- [ ] **Step 9: Full verification run**

Run: `node test/harness.js` three times.
Expected: `ALL CHECKS PASSED` every time, with a consistent total check count matching what was written into `docs/index.html` in Step 6.

Run: `node --check js/util.js js/audio.js js/particles.js js/entities.js js/letterblocks.js js/levels.js js/game.js`
Expected: no output.

- [ ] **Step 10: Screenshot verification**

Run:

```bash
tools/screenshot.sh letterblocks "game.startLevel(1); game.introT=99; step(5); game.enterSub('letterblocks'); game.introT=99; step(20);"
```

Look at `shots/letterblocks.png`: confirm the picture, missing-letter word, three answer blocks with readable letters, and the EXIT door all render legibly and don't overlap. If anything looks visually broken (icon shapes, block spacing, text position), fix it in `js/letterblocks.js` and re-run this step — this is real-render verification the harness's canvas stub cannot catch.

Also capture the fly-in moment:

```bash
tools/screenshot.sh letterblocks-correct "game.startLevel(1); game.introT=99; step(5); game.enterSub('letterblocks'); game.introT=99; step(10);
  const lb = game.level.puzzle; const okIdx = lb.slots.findIndex(s => s.letter === lb.current.correct);
  game.player.x = lb.slots[okIdx].x - game.player.w / 2; game.player.y = 620 - game.player.h;
  keys.ArrowUp = true; step(1); keys.ArrowUp = false; step(35);"
```

Look at `shots/letterblocks-correct.png`: confirm the flying letter is visible mid-animation and readable.

- [ ] **Step 11: Tag and final commit**

```bash
git add js/util.js CHANGELOG.md docs/index.html CLAUDE.md BACKLOG.md
git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com" commit -m "$(cat <<'EOF'
v1.18.0: version, changelog, docs, backlog status for Letter Blocks

EOF
)"
git tag v1.18.0
```

Push (only after Ryan confirms, per the project's working agreement to verify the live deploy):

```bash
git push && git push --tags
```

Then verify the live deploy:

```bash
sleep 60
curl -s https://polarispixels.github.io/block-buddies/js/letterblocks.js | grep -c "LetterBlocksMachine"
```

Expected: a non-zero count, confirming the new file deployed to GitHub Pages.
