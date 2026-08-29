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
