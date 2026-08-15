'use strict';
// Procedural WebAudio: sound effects + tiny step-sequenced music per world.
const mf = m => 440 * Math.pow(2, (m - 69) / 12);

// Each song: t = bpm, m = melody (eighth notes, midi, 0 = rest), b = bass, h = hi-hat
const SONGS = {
  title: { t: 128, h: true,
    m: [72,76,79,84, 0,79,76,72, 74,77,81,0, 79,0,76,0, 72,76,79,84, 0,84,83,81, 79,0,77,74, 72,0,0,0],
    b: [48,0,55,0, 53,0,55,0, 50,0,53,0, 43,0,47,0] },
  meadow: { t: 132, h: true,
    m: [72,0,76,79, 0,79,76,0, 81,0,79,76, 74,0,0,0, 72,0,76,79, 0,79,81,0, 84,0,81,79, 76,0,74,0],
    b: [48,0,52,0, 45,0,52,0, 53,0,57,0, 55,0,52,0] },
  water: { t: 88, mw: 'sine',
    m: [76,0,0,0, 79,0,77,0, 0,0,74,0, 72,0,0,0, 74,0,0,76, 0,0,79,0, 77,0,74,0, 72,0,0,0],
    b: [36,0,0,0, 43,0,0,0, 41,0,0,0, 38,0,0,0] },
  cloud: { t: 144, mw: 'triangle', h: true,
    m: [79,0,84,0, 83,0,79,0, 81,0,77,0, 76,0,72,0, 79,0,84,0, 86,0,84,0, 83,0,81,0, 79,0,0,0],
    b: [48,0,0,52, 0,0,55,0, 41,0,0,45, 0,0,48,0] },
  mountain: { t: 120, h: true,
    m: [69,0,71,72, 0,72,71,0, 74,0,72,71, 69,0,64,0, 69,0,71,72, 0,74,76,0, 77,0,76,74, 72,0,71,0],
    b: [45,0,45,0, 41,0,41,0, 43,0,43,0, 44,0,44,0] },
  cave: { t: 96, mw: 'triangle',
    m: [63,0,0,0, 60,0,63,0, 66,0,0,65, 0,0,63,0, 60,0,0,0, 63,0,66,0, 68,0,66,0, 63,0,0,0],
    b: [36,0,0,0, 36,0,42,0, 34,0,0,0, 36,0,0,0] },
  boss: { t: 152, h: true,
    m: [57,57,0,60, 57,0,55,57, 0,57,60,62, 0,60,57,0, 57,57,0,60, 63,0,62,60, 62,0,60,57, 55,0,57,0],
    b: [33,33,40,33, 33,33,39,33, 31,31,38,31, 33,33,40,33] },
  win: { t: 138, h: true,
    m: [84,0,84,0, 84,0,81,84, 86,0,84,0, 81,0,79,0, 84,0,88,0, 86,0,84,81, 79,0,81,83, 84,0,0,0],
    b: [48,0,52,55, 53,0,57,60, 50,0,53,57, 55,0,52,48] },
  lava: { t: 138, h: true,
    m: [62,0,65,62, 0,62,69,0, 68,0,65,62, 0,65,68,0, 62,0,65,62, 0,62,70,0, 69,0,68,65, 62,0,0,0],
    b: [38,38,0,38, 41,0,38,0, 36,36,0,36, 33,0,36,0] },
  dirt: { t: 150, h: true,
    m: [67,0,67,69, 71,0,71,72, 74,0,72,71, 69,0,67,0, 67,0,67,69, 71,0,74,0, 76,0,74,72, 71,0,69,0],
    b: [43,43,50,43, 41,41,48,41, 40,40,47,40, 43,43,50,43] },
  forest: { t: 108, mw: 'sine',
    m: [79,0,83,0, 86,0,83,0, 84,0,88,0, 86,0,0,0, 79,0,83,0, 88,0,86,0, 84,0,83,0, 79,0,0,0],
    b: [43,0,0,0, 48,0,0,0, 45,0,0,0, 50,0,0,0] }
};

const AudioSys = {
  ctx: null, mg: null, sg: null,
  song: null, songName: '', stepI: 0, nextT: 0, muted: false,

  unlock() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.mg = this.ctx.createGain(); this.mg.gain.value = 0.5;
        this.mg.connect(this.ctx.destination);
        this.sg = this.ctx.createGain(); this.sg.gain.value = 0.6;
        this.sg.connect(this.ctx.destination);
      } catch (e) { return; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  toggleMute() {
    this.muted = !this.muted;
    if (this.mg) this.mg.gain.value = this.muted ? 0 : 0.5;
    if (this.sg) this.sg.gain.value = this.muted ? 0 : 0.6;
  },

  tone(f0, f1, dur, type = 'square', vol = 0.12, when = 0, dest) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(f0, 1), t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.sg);
    o.start(t); o.stop(t + dur + 0.03);
  },
  noise(dur, vol = 0.1, when = 0, fc = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const n = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let node = src;
    if (fc) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = fc;
      src.connect(f); node = f;
    }
    node.connect(g); g.connect(this.sg);
    src.start(t);
  },
  arp(notes, gap, dur, type = 'triangle', vol = 0.12) {
    notes.forEach((f, i) => this.tone(f, 0, dur, type, vol, i * gap));
  },

  sfx(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'jump': this.tone(300, 620, 0.16, 'square', 0.1); break;
      case 'land': this.tone(180, 90, 0.1, 'square', 0.07); this.noise(0.05, 0.04, 0, 900); break;
      case 'boing': this.tone(160, 640, 0.22, 'square', 0.1); break;
      case 'bounce': this.tone(140, 720, 0.28, 'square', 0.13); break;
      case 'collect': this.arp([523, 659, 784], 0.06, 0.14, 'triangle', 0.14); break;
      case 'switch': this.arp([440, 660], 0.05, 0.1, 'square', 0.09); break;
      case 'candy': this.tone(900, 1500, 0.08, 'sine', 0.11); break;
      case 'heart': this.arp([660, 880, 1100], 0.06, 0.16, 'sine', 0.12); break;
      case 'fire': this.noise(0.22, 0.12, 0, 1800); this.tone(420, 120, 0.24, 'sawtooth', 0.09); break;
      case 'ice': this.arp([1250, 1650, 2100], 0.04, 0.12, 'sine', 0.09); break;
      case 'rainbow': this.tone(400, 1300, 0.35, 'sine', 0.12); this.arp([784, 988, 1175, 1568], 0.07, 0.15, 'triangle', 0.07); break;
      case 'powerup': this.arp([262, 330, 392, 523, 659, 784], 0.05, 0.14, 'square', 0.1); break;
      case 'freeze': this.arp([1800, 1400, 1000, 700], 0.05, 0.12, 'sine', 0.1); break;
      case 'shatter': this.noise(0.15, 0.1, 0, 4000); this.arp([2000, 1500], 0.03, 0.08, 'sine', 0.08); break;
      case 'hit': this.tone(320, 90, 0.3, 'square', 0.13); this.tone(280, 120, 0.25, 'sawtooth', 0.06, 0.03); break;
      case 'poof': this.noise(0.16, 0.09, 0, 1400); this.tone(520, 180, 0.18, 'triangle', 0.09); break;
      case 'friend': this.arp([523, 659, 784, 1047, 1319], 0.06, 0.2, 'triangle', 0.12); break;
      case 'checkpoint': this.arp([392, 523, 659], 0.07, 0.2, 'triangle', 0.12); break;
      case 'fanfare': this.arp([523, 523, 659, 784, 1047], 0.09, 0.25, 'square', 0.1); break;
      case 'chest': this.arp([392, 523, 659, 784, 1047, 1319, 1568], 0.08, 0.3, 'triangle', 0.13); break;
      case 'roar': this.tone(110, 55, 0.7, 'sawtooth', 0.18); this.noise(0.6, 0.08, 0, 500); break;
      case 'hiccup': this.tone(500, 950, 0.09, 'square', 0.12); break;
      case 'thud': this.tone(120, 50, 0.2, 'sine', 0.2); this.noise(0.12, 0.1, 0, 400); break;
      case 'smash': this.noise(0.3, 0.16, 0, 900); this.tone(150, 60, 0.25, 'square', 0.12); break;
      case 'crash': this.noise(0.35, 0.18, 0, 1200); this.tone(200, 60, 0.3, 'sawtooth', 0.12); break;
      case 'whoosh': this.noise(0.2, 0.07, 0, 2500); break;
      case 'slide': this.noise(0.25, 0.05, 0, 3000); break;
      case 'lose': this.arp([392, 330, 262, 196], 0.14, 0.3, 'triangle', 0.12); break;
      case 'rumble': this.noise(0.9, 0.14, 0, 250); break;
      case 'boom': this.noise(0.4, 0.2, 0, 700); this.tone(180, 40, 0.5, 'sawtooth', 0.15); break;
      case 'steam': this.noise(0.35, 0.12, 0, 5000); this.tone(900, 400, 0.2, 'sine', 0.05); break;
      case 'blorp': this.tone(90, 260, 0.35, 'sine', 0.18); this.tone(140, 60, 0.4, 'sawtooth', 0.1, 0.1); break;
      case 'rev': this.tone(65, 150, 0.5, 'sawtooth', 0.13); this.tone(90, 190, 0.4, 'square', 0.06, 0.08); this.noise(0.35, 0.05, 0, 500); break;
      case 'launch': this.tone(180, 950, 0.55, 'sawtooth', 0.12); this.noise(0.5, 0.1, 0, 3000); break;
      case 'cheer':
        this.noise(0.9, 0.13, 0, 3200);
        this.arp([659, 784, 880], 0.09, 0.2, 'triangle', 0.08);
        this.arp([523, 659], 0.07, 0.15, 'sine', 0.06);
        break;
      case 'flap': this.noise(0.12, 0.05, 0, 4000); this.tone(880, 1320, 0.12, 'sine', 0.06); break;
      case 'neigh': this.tone(500, 950, 0.16, 'triangle', 0.11); this.tone(950, 620, 0.22, 'triangle', 0.09, 0.16); break;
      case 'bells': this.arp([784, 988, 1175, 1568, 1976], 0.13, 0.55, 'triangle', 0.1); break;
    }
  },

  setMusic(name) {
    if (this.songName === name) return;
    this.songName = name;
    this.song = SONGS[name] || null;
    this.stepI = 0; this.nextT = 0;
  },
  update() {
    if (!this.ctx || !this.song || this.muted) return;
    const s = this.song, sd = 30 / s.t;
    if (this.nextT < this.ctx.currentTime) this.nextT = this.ctx.currentTime + 0.06;
    while (this.nextT < this.ctx.currentTime + 0.22) {
      const i = this.stepI;
      const when = this.nextT - this.ctx.currentTime;
      const m = s.m[i % s.m.length], b = s.b[i % s.b.length];
      if (m) this.tone(mf(m), 0, sd * 0.85, s.mw || 'square', 0.05, when, this.mg);
      if (b) this.tone(mf(b), 0, sd * 1.6, 'triangle', 0.075, when, this.mg);
      if (s.h && i % 2 === 0) this.noise(0.025, 0.012, when, 8000);
      this.stepI++; this.nextT += sd;
    }
  }
};
