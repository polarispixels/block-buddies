'use strict';
// ================================================================ level building
const LEVEL_META = {
  1: { name: 'BLOCK MEADOW', theme: 'meadow', music: 'meadow' },
  2: { name: 'UNDERWATER WORLD', theme: 'water', music: 'water' },
  3: { name: 'CLOUD WORLD', theme: 'cloud', music: 'cloud' },
  4: { name: 'MOUNTAIN WORLD', theme: 'mountain', music: 'mountain' },
  5: { name: 'ZOMBIE CAVE', theme: 'cave', music: 'cave' },
  6: { name: 'LAVA WORLD', theme: 'lava', music: 'lava' }
};

function newLevel(n) {
  const m = LEVEL_META[n];
  return {
    n, name: m.name, theme: m.theme, music: m.music,
    w: 4200, h: 720,
    solids: [], spiders: [], pickups: [], checks: [], hints: [], bridges: [],
    decor: {}, lights: [], lava: null,
    water: false, dark: false, fallCatch: false, boss: false,
    playerStart: { x: 90, y: 400 },
    gate: null
  };
}
function addGround(lv, x, w, top) {
  lv.solids.push({ x, y: top, w, h: lv.h - top + 400, ground: true, top });
}
function addPlat(lv, x, y, w, opts = {}) {
  lv.solids.push({ x, y, w, h: opts.h || 36, oneWay: opts.oneWay, bouncy: opts.bouncy, plat: true });
}
function addBlockPile(lv, x, top, cols, rows) {
  lv.solids.push({ x, y: top - rows * 48, w: cols * 48, h: rows * 48, pile: true });
}
function addWallBreak(lv, x, top, rows = 4) {
  lv.solids.push({ x, y: top - rows * 48, w: 52, h: rows * 48, breakable: true });
}
function pick(lv, x, y, kind) { lv.pickups.push(new Pickup(x, y, kind)); }
function candyRow(lv, x0, x1, y, n) {
  for (let i = 0; i < n; i++) pick(lv, lerp(x0, x1, n === 1 ? 0 : i / (n - 1)), y, 'candy');
}
function candyArc(lv, x0, x1, yTop, yBase, n) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    pick(lv, lerp(x0, x1, t), yBase - Math.sin(t * Math.PI) * (yBase - yTop), 'candy');
  }
}
function spider(lv, x, groundTop, kind, opt = {}) { lv.spiders.push(new Spider(x, groundTop, kind, opt)); }

function buildLevel(n) {
  const lv = newLevel(n);
  const G = 620; // standard ground top

  if (n === 1) { // ---------------- BLOCK MEADOW
    lv.w = 4200;
    addGround(lv, 0, lv.w, G);
    addBlockPile(lv, 780, G, 2, 1);
    addPlat(lv, 1500, 480, 220);
    addBlockPile(lv, 1960, G, 2, 2);
    addPlat(lv, 2450, 490, 210);
    addBlockPile(lv, 3260, G, 2, 1);
    addBlockPile(lv, 3356, G, 2, 2);
    lv.hints.push({ x: 260, y: G - 190, icon: 'arrows' });
    lv.hints.push({ x: 720, y: G - 230, icon: 'up' });
    lv.hints.push({ x: 1130, y: G - 230, icon: 'space' });
    pick(lv, 980, G - 90, 'fire');
    pick(lv, 2540, 430, 'fire');
    pick(lv, 2860, G - 60, 'heart');
    candyRow(lv, 300, 700, G - 50, 4);
    candyArc(lv, 1430, 1790, 400, G - 60, 5);
    candyRow(lv, 2050, 2350, G - 220, 3);
    candyArc(lv, 3180, 3560, 380, G - 70, 5);
    candyRow(lv, 3700, 3950, G - 50, 3);
    spider(lv, 1350, G, 'walk', { range: 160 });
    spider(lv, 2250, G, 'walk', { range: 170 });
    spider(lv, 3700, G, 'walk', { range: 150 });
    lv.checks.push(new Checkpoint(1800, G));
    lv.checks.push(new Checkpoint(3100, G));
    lv.gate = new Gate(4080, G);
    lv.decor.flowers = []; lv.decor.trees = []; lv.decor.clouds = [];
    for (let x = 60; x < lv.w; x += rand(90, 200)) lv.decor.flowers.push({ x, c: randi(0, 4), s: rand(0.8, 1.3) });
    for (let x = 200; x < lv.w; x += rand(400, 800)) lv.decor.trees.push({ x, s: rand(0.85, 1.25) });
    for (let i = 0; i < 10; i++) lv.decor.clouds.push({ x: rand(0, lv.w), y: rand(50, 240), s: rand(0.7, 1.5) });
  }

  else if (n === 2) { // ---------------- UNDERWATER WORLD
    lv.w = 4200; lv.h = 1200; lv.water = true;
    lv.playerStart = { x: 90, y: 500 };
    addGround(lv, 0, lv.w, 1130);
    // coral columns & ruins
    lv.solids.push({ x: 900, y: 830, w: 140, h: 300, pile: true });
    lv.solids.push({ x: 1900, y: 0, w: 140, h: 520, pile: true });
    lv.solids.push({ x: 2800, y: 760, w: 140, h: 370, pile: true });
    addPlat(lv, 1400, 700, 260);
    addPlat(lv, 2200, 450, 260);
    addPlat(lv, 2550, 900, 300);
    addPlat(lv, 3400, 620, 260);
    lv.hints.push({ x: 330, y: 330, icon: 'updown' });
    pick(lv, 700, 900, 'ice');
    pick(lv, 2500, 990, 'ice');
    pick(lv, 2400, 560, 'heart');
    candyArc(lv, 400, 850, 500, 900, 5);
    candyRow(lv, 1200, 1700, 620, 4);
    candyArc(lv, 2100, 2500, 320, 700, 4);
    candyRow(lv, 3000, 3400, 950, 4);
    candyRow(lv, 3500, 3900, 500, 4);
    spider(lv, 1300, 740, 'swim', { range: 160 });
    spider(lv, 2100, 900, 'swim', { range: 180 });
    spider(lv, 2650, 440, 'swim', { range: 150 });
    spider(lv, 3300, 850, 'swim', { range: 170 });
    spider(lv, 3650, 1060, 'swim', { range: 150 });
    lv.checks.push(new Checkpoint(1600, 1130));
    lv.checks.push(new Checkpoint(3000, 1130));
    lv.gate = new Gate(4060, 1060);
    lv.decor.weeds = []; lv.decor.corals = []; lv.decor.fish = [];
    for (let x = 40; x < lv.w; x += rand(120, 260)) lv.decor.weeds.push({ x, h: rand(60, 150), seed: rand(9) });
    for (let x = 150; x < lv.w; x += rand(300, 600)) lv.decor.corals.push({ x, s: rand(0.7, 1.4), c: randi(0, 2) });
    for (let i = 0; i < 14; i++) lv.decor.fish.push({ x: rand(0, lv.w), y: rand(150, 1000), s: rand(0.7, 1.3), sp: rand(30, 80) * (chance(0.5) ? 1 : -1), c: randi(0, 3) });
  }

  else if (n === 3) { // ---------------- CLOUD WORLD
    lv.w = 4600; lv.fallCatch = true;
    lv.playerStart = { x: 90, y: 380 };
    addPlat(lv, 0, 600, 520, { h: 90 });
    addPlat(lv, 620, 540, 170, { oneWay: true });
    addPlat(lv, 900, 460, 170, { oneWay: true });
    addPlat(lv, 1180, 520, 190, { oneWay: true });
    addPlat(lv, 1450, 560, 420, { h: 80 });
    lv.bridges.push({ x: 1930, y: 560, w: 280, active: false, t: 0 });
    addPlat(lv, 2270, 560, 360, { h: 80 });
    addPlat(lv, 2700, 600, 100, { bouncy: true, h: 40 });
    addPlat(lv, 2880, 360, 220, { oneWay: true });
    addPlat(lv, 3180, 450, 170, { oneWay: true });
    addPlat(lv, 3440, 520, 180, { oneWay: true });
    addPlat(lv, 3680, 570, 400, { h: 80 });
    lv.bridges.push({ x: 4140, y: 570, w: 240, active: false, t: 0 });
    addPlat(lv, 4440, 570, 160, { h: 80 });
    lv.hints.push({ x: 250, y: 430, icon: 'space' });
    pick(lv, 380, 540, 'rainbow');
    pick(lv, 2350, 500, 'rainbow');
    pick(lv, 3760, 490, 'heart');
    candyArc(lv, 620, 1360, 380, 500, 5);
    candyRow(lv, 1500, 1820, 500, 4);
    candyArc(lv, 2880, 3100, 260, 330, 4);
    candyRow(lv, 3700, 4020, 510, 4);
    spider(lv, 1650, 560, 'jump');
    spider(lv, 2450, 560, 'walk', { range: 120 });
    spider(lv, 3780, 570, 'jump');
    spider(lv, 3950, 570, 'walk', { range: 100 });
    lv.checks.push(new Checkpoint(2350, 560));
    lv.checks.push(new Checkpoint(3750, 570));
    lv.gate = new Gate(4520, 570);
    lv.decor.clouds = []; lv.decor.birds = [];
    for (let i = 0; i < 16; i++) lv.decor.clouds.push({ x: rand(0, lv.w), y: rand(60, 600), s: rand(0.6, 1.6) });
    for (let i = 0; i < 5; i++) lv.decor.birds.push({ x: rand(0, lv.w), y: rand(80, 300), sp: rand(40, 90) });
  }

  else if (n === 4) { // ---------------- MOUNTAIN WORLD
    lv.w = 4800;
    addGround(lv, 0, 1050, G);
    addGround(lv, 1050, 900, 572);
    addGround(lv, 1950, 900, 524);
    addGround(lv, 2850, 1000, 572);
    addGround(lv, 3850, 950, 524);
    addPlat(lv, 1250, 460, 190);
    addPlat(lv, 2150, 410, 200);
    // cave overhang with hanging spiders
    lv.solids.push({ x: 3000, y: 260, w: 720, h: 90, pile: true });
    addWallBreak(lv, 2640, 572, 4);
    addWallBreak(lv, 4180, 524, 4);
    pick(lv, 500, G - 90, 'ice');
    pick(lv, 2450, 524 - 80, 'power');
    pick(lv, 4020, 524 - 80, 'power');
    pick(lv, 3350, 572 - 70, 'heart');
    pick(lv, 1330, 400, 'ice');
    candyRow(lv, 250, 700, G - 60, 4);
    candyArc(lv, 1150, 1550, 350, 520, 5);
    candyRow(lv, 2050, 2450, 470, 4);
    candyRow(lv, 3050, 3600, 520, 5);
    candyRow(lv, 4350, 4600, 470, 3);
    spider(lv, 820, G, 'walk', { range: 170 });
    spider(lv, 1500, 572, 'jump');
    spider(lv, 2250, 524, 'walk', { range: 160 });
    spider(lv, 3200, 480, 'hang', { webTop: 350 });
    spider(lv, 3500, 480, 'hang', { webTop: 350 });
    spider(lv, 3650, 572, 'jump');
    spider(lv, 4450, 524, 'walk', { range: 140 });
    lv.checks.push(new Checkpoint(1750, 572));
    lv.checks.push(new Checkpoint(3850, 524));
    lv.gate = new Gate(4700, 524);
    lv.hints.push({ x: 2530, y: 350, icon: 'power' });
    lv.decor.pines = []; lv.decor.peaks = true;
    for (let x = 120; x < lv.w; x += rand(300, 650)) lv.decor.pines.push({ x, s: rand(0.8, 1.4) });
  }

  else if (n === 5) { // ---------------- ZOMBIE CAVE
    lv.w = 5000; lv.dark = true; lv.boss = true;
    addGround(lv, 0, lv.w, G);
    addBlockPile(lv, 900, G, 2, 2);
    addBlockPile(lv, 1750, G, 2, 1);
    addBlockPile(lv, 2400, G, 2, 2);
    pick(lv, 480, G - 90, 'fire');
    pick(lv, 2050, G - 80, 'fire');
    pick(lv, 2650, G - 70, 'heart');
    candyRow(lv, 300, 3900, G - 55, 22); // candy clues lead the way
    spider(lv, 1200, 420, 'hang', { webTop: 0 });
    spider(lv, 1600, G, 'walk', { range: 160 });
    spider(lv, 2200, 420, 'hang', { webTop: 0 });
    spider(lv, 2900, 420, 'hang', { webTop: 0 });
    spider(lv, 2600, G, 'walk', { range: 150 });
    spider(lv, 3300, G, 'jump');
    lv.checks.push(new Checkpoint(1900, G));
    lv.checks.push(new Checkpoint(3700, G));
    lv.decor.crystals = []; lv.decor.skulls = []; lv.decor.stals = [];
    for (let x = 200; x < lv.w; x += rand(280, 520)) {
      const c = { x, y: G - rand(20, 40), s: rand(0.8, 1.5), c: randi(0, 2) };
      lv.decor.crystals.push(c);
    }
    for (let x = 700; x < 4200; x += rand(900, 1500)) lv.decor.skulls.push({ x, s: rand(0.8, 1.2) });
    for (let x = 60; x < lv.w; x += rand(140, 300)) lv.decor.stals.push({ x, h: rand(40, 130), w: rand(24, 50) });
  }

  if (n === 6) { // ---------------- LAVA WORLD (bonus)
    lv.w = 5000; lv.boss = true; lv.bossType = 'magma';
    lv.lava = [
      { x: 900, w: 180 }, { x: 1900, w: 180 }, { x: 2980, w: 180 }, { x: 4820, w: 180 }
    ];
    addGround(lv, 0, 900, G);
    addGround(lv, 1080, 820, G);
    addGround(lv, 2080, 900, G);
    addGround(lv, 3160, 840, G);
    addGround(lv, 4000, 820, G); // boss arena floor; lava at its right edge
    addPlat(lv, 1950, 470, 140);
    addPlat(lv, 2660, 600, 100, { bouncy: true, h: 40 });
    addBlockPile(lv, 3500, G, 2, 1);
    pick(lv, 500, G - 90, 'fire');
    pick(lv, 2450, G - 80, 'fire');
    pick(lv, 3320, G - 80, 'ice');
    pick(lv, 2710, 380, 'heart');
    pick(lv, 3760, G - 60, 'heart');
    candyRow(lv, 250, 800, G - 55, 4);
    candyArc(lv, 860, 1130, 430, G - 70, 5);
    candyRow(lv, 1500, 1800, G - 55, 3);
    candyArc(lv, 1860, 2130, 400, G - 70, 5);
    candyArc(lv, 2940, 3210, 400, G - 70, 5);
    candyRow(lv, 3550, 3900, G - 60, 4);
    // clusters close together = chain-reaction fireworks
    spider(lv, 700, G, 'walk', { range: 130 });
    spider(lv, 1400, G, 'walk', { range: 90 });
    spider(lv, 1540, G, 'walk', { range: 90 });
    spider(lv, 1750, G, 'jump');
    spider(lv, 2300, G, 'walk', { range: 80 });
    spider(lv, 2430, G, 'walk', { range: 80 });
    spider(lv, 2550, G, 'jump');
    spider(lv, 3400, G, 'walk', { range: 120 });
    spider(lv, 3650, G, 'jump');
    lv.checks.push(new Checkpoint(1700, G));
    lv.checks.push(new Checkpoint(3750, G));
    lv.hints.push({ x: 1200, y: G - 230, icon: 'space' });
    lv.decor.volcanoes = true;
    lv.decor.rocks = [];
    for (let x = 150; x < lv.w; x += rand(350, 700)) lv.decor.rocks.push({ x, s: rand(0.7, 1.4) });
  }

  return lv;
}
function inLava(lv, cx) {
  if (!lv.lava) return false;
  for (const L of lv.lava) if (cx > L.x && cx < L.x + L.w) return true;
  return false;
}

// ================================================================ backgrounds
function drawBG(ctx, lv, cam, t) {
  const th = lv.theme;
  let g;
  if (th === 'meadow' || th === 'cloud') {
    g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#6ec6ff'); g.addColorStop(1, th === 'cloud' ? '#bfe8ff' : '#c9f0ff');
  } else if (th === 'water') {
    g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2fa7d9'); g.addColorStop(1, '#0a4a8a');
  } else if (th === 'mountain') {
    g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#8fb8e8'); g.addColorStop(1, '#dcedff');
  } else if (th === 'lava') {
    g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#3a0d14'); g.addColorStop(0.6, '#6a1c10'); g.addColorStop(1, '#9a3612');
  } else {
    g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#171029'); g.addColorStop(1, '#2c1e4a');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (th === 'meadow') {
    // smiling sun
    const sx = 1080 - cam.x * 0.05, sy = 110;
    ctx.fillStyle = '#ffe156';
    ctx.beginPath(); ctx.arc(sx, sy, 55, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffe156'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const a = i * TAU / 10 + t * 0.2;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * 66, sy + Math.sin(a) * 66);
      ctx.lineTo(sx + Math.cos(a) * 84, sy + Math.sin(a) * 84);
      ctx.stroke();
    }
    drawFace(ctx, sx, sy, 55, 'happy', t, 11);
    // far hills
    ctx.fillStyle = '#a5dd72';
    for (let i = -1; i < 5; i++) {
      const hx = i * 500 - (cam.x * 0.25) % 500;
      ctx.beginPath(); ctx.arc(hx, 640, 260, Math.PI, TAU); ctx.fill();
    }
    drawBGClouds(ctx, lv, cam, t, 0.35);
  } else if (th === 'water') {
    // light rays
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#dff6ff';
    for (let i = 0; i < 5; i++) {
      const rx = ((i * 340 - cam.x * 0.3) % (W + 400) + W + 400) % (W + 400) - 200;
      ctx.beginPath();
      ctx.moveTo(rx, -20); ctx.lineTo(rx + 130, -20);
      ctx.lineTo(rx - 100 + Math.sin(t + i) * 30, H + 20); ctx.lineTo(rx - 240 + Math.sin(t + i) * 30, H + 20);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // fish
    for (const f of lv.decor.fish || []) {
      f.x += f.sp * 0.016;
      if (f.x > lv.w + 60) f.x = -60; if (f.x < -60) f.x = lv.w + 60;
      const fx = f.x - cam.x * 0.6, fy = f.y - cam.y * 0.6;
      if (fx < -80 || fx > W + 80) continue;
      ctx.save();
      ctx.translate(fx, fy + Math.sin(t * 2 + f.x) * 8);
      if (f.sp < 0) ctx.scale(-1, 1);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = ['#ff9f43', '#ffe156', '#7fd8ff', '#ff8fb0'][f.c];
      ctx.beginPath(); ctx.ellipse(0, 0, 20 * f.s, 11 * f.s, 0, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-18 * f.s, 0); ctx.lineTo(-30 * f.s, -9 * f.s); ctx.lineTo(-30 * f.s, 9 * f.s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a2a3a';
      ctx.beginPath(); ctx.arc(9 * f.s, -2, 2.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // ambient rising bubbles
    if (chance(0.3)) Particles.burst(cam.x + rand(0, W), cam.y + H + 10, 1, { color: 'rgba(255,255,255,0.5)', type: 'bubble', sp1: 20, grav: -160, l0: 2, l1: 3.5, up: 0, s1: 10 });
  } else if (th === 'cloud') {
    drawBGClouds(ctx, lv, cam, t, 0.4);
    // background rainbow arcs
    ctx.save();
    ctx.globalAlpha = 0.35; ctx.lineWidth = 12;
    const rx = 700 - cam.x * 0.2;
    RAINBOW.forEach((c, i) => {
      ctx.strokeStyle = c;
      ctx.beginPath(); ctx.arc(rx, 720, 420 - i * 13, Math.PI, TAU); ctx.stroke();
    });
    ctx.restore();
    // birds
    for (const b of lv.decor.birds || []) {
      b.x += b.sp * 0.016;
      if (b.x > lv.w + 40) b.x = -40;
      const bx = b.x - cam.x * 0.5, by = b.y + Math.sin(t * 2 + b.x * 0.01) * 10;
      if (bx < -60 || bx > W + 60) continue;
      ctx.strokeStyle = '#5a4a86'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      const fl = Math.sin(t * 8 + b.x) * 6;
      ctx.beginPath();
      ctx.moveTo(bx - 12, by - fl); ctx.quadraticCurveTo(bx, by + 4, bx + 12, by - fl);
      ctx.stroke();
    }
  } else if (th === 'mountain') {
    // far peaks
    ctx.fillStyle = '#b8cce8';
    for (let i = -1; i < 6; i++) {
      const px = i * 440 - (cam.x * 0.2) % 440;
      ctx.beginPath();
      ctx.moveTo(px - 260, 620); ctx.lineTo(px, 160); ctx.lineTo(px + 260, 620);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(px - 70, 282); ctx.lineTo(px, 160); ctx.lineTo(px + 70, 282);
      ctx.lineTo(px + 35, 262); ctx.lineTo(px, 292); ctx.lineTo(px - 35, 262);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b8cce8';
    }
    // snowfall
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 40; i++) {
      const seed = i * 127.3;
      const sx = ((seed * 53 + t * (20 + (i % 3) * 14)) % (W + 40)) - 20;
      const sy = ((seed * 91 + t * (46 + (i % 5) * 18)) % (H + 40)) - 20;
      ctx.beginPath(); ctx.arc(sx, sy, 2.5 + (i % 3), 0, TAU); ctx.fill();
    }
  } else if (th === 'lava') {
    // parallax volcano silhouettes with glowing mouths
    for (let i = -1; i < 6; i++) {
      const px = i * 520 - (cam.x * 0.25) % 520;
      ctx.fillStyle = '#4a1410';
      ctx.beginPath();
      ctx.moveTo(px - 240, 640); ctx.lineTo(px - 40, 250); ctx.lineTo(px + 40, 250); ctx.lineTo(px + 240, 640);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,120,40,' + (0.5 + 0.2 * Math.sin(t * 2 + i)) + ')';
      ctx.beginPath(); ctx.ellipse(px, 252, 42, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,150,50,0.35)';
      ctx.beginPath();
      ctx.moveTo(px - 14, 255); ctx.quadraticCurveTo(px - 30, 380, px - 20, 500);
      ctx.lineTo(px + 4, 500); ctx.quadraticCurveTo(px + 4, 370, px + 14, 255);
      ctx.closePath(); ctx.fill();
    }
    // rising embers
    if (chance(0.35)) Particles.burst(cam.x + rand(0, W), cam.y + rand(300, 740), 1, { colors: ['#ff9f43', '#ffe156', '#ff6b35'], type: 'circle', sp1: 20, grav: -110, l0: 1.5, l1: 3, up: 0, s0: 3, s1: 7 });
    // THE candy volcano looms behind the boss arena (world-locked, drawn behind terrain)
    const vwx = 4470 - cam.x;
    if (vwx > -450 && vwx < W + 450) {
      ctx.fillStyle = '#38100e';
      ctx.beginPath();
      ctx.moveTo(vwx - 400, 620); ctx.lineTo(vwx - 70, 240); ctx.lineTo(vwx + 70, 240); ctx.lineTo(vwx + 400, 620);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#571d14'; ctx.lineWidth = 5; ctx.stroke();
      ctx.fillStyle = 'rgba(255,130,45,' + (0.6 + 0.25 * Math.sin(t * 3)) + ')';
      ctx.beginPath(); ctx.ellipse(vwx, 244, 68, 18, 0, 0, TAU); ctx.fill();
      if (chance(0.2)) Particles.burst(4470 + rand(-40, 40), 240, 1, { colors: ['#ff9f43', '#ffe156'], type: 'circle', sp1: 40, grav: -140, l1: 1.2, s1: 7, up: 40 });
      // a sleepy face on the volcano, because everything here has a face
      drawFace(ctx, vwx, 420, 70, 'sleepy', t, 31);
    }
  } else if (th === 'cave') {
    // stalactites silhouettes
    ctx.fillStyle = '#241640';
    for (const s of lv.decor.stals || []) {
      const sx = s.x - cam.x * 0.7;
      if (sx < -80 || sx > W + 80) continue;
      ctx.beginPath();
      ctx.moveTo(sx - s.w / 2, 0); ctx.lineTo(sx + s.w / 2, 0); ctx.lineTo(sx, s.h);
      ctx.closePath(); ctx.fill();
    }
    // floating sparkle motes
    if (chance(0.15)) Particles.burst(cam.x + rand(0, W), cam.y + rand(100, 600), 1, { colors: ['#8fd0ff', '#d0a0ff'], type: 'sparkle', sp1: 15, grav: -25, l0: 1.5, l1: 3, up: 0, s1: 6 });
  }
}
function drawBGClouds(ctx, lv, cam, t, par) {
  for (const c of lv.decor.clouds || []) {
    const cx = c.x - cam.x * par, cy = c.y + Math.sin(t * 0.5 + c.x) * 4;
    if (cx < -180 || cx > W + 180) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, 34 * c.s, 0, TAU);
    ctx.arc(cx + 30 * c.s, cy + 6 * c.s, 26 * c.s, 0, TAU);
    ctx.arc(cx - 30 * c.s, cy + 8 * c.s, 24 * c.s, 0, TAU);
    ctx.fill();
  }
}

// ================================================================ terrain
function drawSolids(ctx, lv, cam, t) {
  const th = lv.theme;
  for (const s of lv.solids) {
    if (s.broken || s.skipDraw) continue;
    if (s.x + s.w < cam.x - 40 || s.x > cam.x + W + 40) continue;
    if (s.y > cam.y + H + 40) continue;
    const vis = { x: Math.max(s.x, cam.x - 60), w: Math.min(s.x + s.w, cam.x + W + 60) - Math.max(s.x, cam.x - 60) };
    if (s.bouncy) { // spring block
      const sq = 1 + Math.sin(t * 6) * 0.05;
      ctx.fillStyle = '#ff8fb0';
      rr(ctx, s.x, s.y - (sq - 1) * 20, s.w, s.h + (sq - 1) * 20, 10); ctx.fill();
      ctx.strokeStyle = '#d6559a'; ctx.lineWidth = 3;
      rr(ctx, s.x, s.y - (sq - 1) * 20, s.w, s.h + (sq - 1) * 20, 10); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(s.x + s.w / 2 - 12, s.y + 14); ctx.lineTo(s.x + s.w / 2, s.y + 2); ctx.lineTo(s.x + s.w / 2 + 12, s.y + 14);
      ctx.closePath(); ctx.fill();
      continue;
    }
    if (s.breakable) { // cracked worried blocks
      for (let by = s.y; by < s.y + s.h - 1; by += 48) {
        for (let bx = s.x; bx < s.x + s.w - 1; bx += 52) {
          ctx.fillStyle = '#d9b98a';
          rr(ctx, bx + 2, by + 2, 48, 44, 7); ctx.fill();
          ctx.strokeStyle = '#a8895a'; ctx.lineWidth = 2.5;
          rr(ctx, bx + 2, by + 2, 48, 44, 7); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(bx + 12, by + 6); ctx.lineTo(bx + 20, by + 16); ctx.lineTo(bx + 14, by + 26);
          ctx.stroke();
          if (hash2(bx, by) < 0.5) drawFace(ctx, bx + 26, by + 26, 24, 'surprised', t, bx);
        }
      }
      continue;
    }
    if (th === 'cloud' && (s.oneWay || s.plat || s.h >= 60)) { // fluffy cloud platform
      ctx.fillStyle = '#ffffff';
      rr(ctx, s.x, s.y, s.w, Math.min(s.h, 46), 20); ctx.fill();
      for (let px = s.x + 20; px < s.x + s.w - 10; px += 44) {
        ctx.beginPath(); ctx.arc(px, s.y + 4, 20 + (hash2(px, s.y) * 8), 0, TAU); ctx.fill();
      }
      ctx.fillStyle = 'rgba(160,190,230,0.45)';
      rr(ctx, s.x + 6, s.y + Math.min(s.h, 46) - 12, s.w - 12, 10, 6); ctx.fill();
      if (s.w > 200 && hash2(s.x, s.y) < 0.6) drawFace(ctx, s.x + s.w / 2, s.y + 22, 26, 'sleepy', t, s.x);
      continue;
    }
    // generic chunky terrain
    let fill, topFill, line;
    if (th === 'meadow') { fill = '#b07845'; topFill = '#5ecb4a'; line = 'rgba(90,50,20,0.25)'; }
    else if (th === 'water') { fill = '#c9a96a'; topFill = '#7ec850'; line = 'rgba(90,70,30,0.3)'; }
    else if (th === 'mountain') { fill = '#8d8fa0'; topFill = '#ffffff'; line = 'rgba(60,60,80,0.3)'; }
    else if (th === 'cave') { fill = '#453563'; topFill = '#6a4fa0'; line = 'rgba(20,10,40,0.4)'; }
    else if (th === 'lava') { fill = '#43222e'; topFill = '#ff7a2b'; line = 'rgba(20,8,12,0.45)'; }
    else { fill = '#b07845'; topFill = '#5ecb4a'; line = 'rgba(90,50,20,0.25)'; }
    if (s.plat && th !== 'cave') { fill = '#c98f4e'; }
    ctx.fillStyle = fill;
    const sh = Math.min(s.h, cam.y + H + 60 - s.y);
    rr(ctx, s.x, s.y, s.w, sh, 8); ctx.fill();
    // block grid
    ctx.strokeStyle = line; ctx.lineWidth = 2;
    for (let gx = s.x + 48; gx < s.x + s.w; gx += 48) {
      if (gx < cam.x - 10 || gx > cam.x + W + 10) continue;
      ctx.beginPath(); ctx.moveTo(gx, s.y + 4); ctx.lineTo(gx, s.y + Math.min(sh, 150) - 4); ctx.stroke();
    }
    for (let gy = s.y + 48; gy < s.y + Math.min(sh, 150); gy += 48) {
      ctx.beginPath(); ctx.moveTo(vis.x + 4, gy); ctx.lineTo(vis.x + vis.w - 4, gy); ctx.stroke();
    }
    // grass / snow / glow top
    ctx.fillStyle = topFill;
    rr(ctx, s.x, s.y - 4, s.w, 18, 8); ctx.fill();
    if (th === 'meadow' || th === 'water') {
      ctx.fillStyle = topFill;
      for (let gx = vis.x + 10; gx < vis.x + vis.w - 6; gx += 26) {
        ctx.beginPath(); ctx.arc(gx, s.y - 4, 7 + hash2(gx, s.y) * 4, 0, TAU); ctx.fill();
      }
    }
    if (th === 'cave') {
      ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(t * 2 + s.x) * 0.15;
      ctx.fillStyle = '#9a7fd8';
      rr(ctx, s.x, s.y - 3, s.w, 6, 3); ctx.fill();
      ctx.restore();
    }
    if (th === 'lava') {
      ctx.save(); ctx.globalAlpha = 0.45 + Math.sin(t * 3 + s.x) * 0.15;
      ctx.fillStyle = '#ffce54';
      rr(ctx, s.x, s.y - 3, s.w, 6, 3); ctx.fill();
      ctx.restore();
    }
    // occasional funny face block in the terrain
    if (s.pile || (s.ground && s.w < 600)) {
      if (hash2(s.x, s.y) < 0.8) drawFace(ctx, s.x + s.w / 2, s.y + 26, 26, 'happy', t, s.x);
    } else if (s.ground) {
      for (let gx = Math.floor(vis.x / 480) * 480; gx < vis.x + vis.w; gx += 480) {
        if (gx > s.x + 20 && gx < s.x + s.w - 60 && hash2(gx, s.y) < 0.6) {
          drawFace(ctx, gx + 24, s.y + 26, 24, hash2(gx, 7) < 0.5 ? 'happy' : 'sleepy', t, gx);
        }
      }
    }
  }
  // rainbow bridges
  for (const b of lv.bridges) {
    if (b.active) {
      b.t += 0.016;
      ctx.save();
      const bh = 30;
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = RAINBOW[i];
        ctx.globalAlpha = 0.9;
        rr(ctx, b.x, b.y + i * bh / 6, b.w, bh / 6 + 1, 2); ctx.fill();
      }
      ctx.globalAlpha = 0.5 + Math.sin(b.t * 4) * 0.2;
      ctx.fillStyle = '#fff';
      rr(ctx, b.x, b.y - 3, b.w, 5, 2); ctx.fill();
      ctx.restore();
      if (chance(0.1)) Particles.burst(b.x + rand(0, b.w), b.y, 1, { colors: RAINBOW, type: 'sparkle', sp1: 20, grav: -50, l1: 0.6, s1: 7, up: 0 });
    } else {
      // dashed outline marker + bouncing rainbow icon
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 3; ctx.setLineDash([12, 10]);
      ctx.lineDashOffset = -t * 30;
      rr(ctx, b.x, b.y, b.w, 26, 8); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      const ix = b.x + b.w / 2, iy = b.y - 46 + Math.sin(t * 3) * 8;
      drawBlock(ctx, ix - 20, iy - 20, 40, 'rainbow', t);
    }
  }
  // lava pools
  if (lv.lava) {
    for (const L of lv.lava) {
      if (L.x + L.w < cam.x - 60 || L.x > cam.x + W + 60) continue;
      const top = 648;
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(t * 3 + L.x) * 0.1;
      ctx.fillStyle = '#ff9f43';
      rr(ctx, L.x - 14, top - 16, L.w + 28, 30, 12); ctx.fill();
      ctx.restore();
      const g2 = ctx.createLinearGradient(0, top, 0, top + 120);
      g2.addColorStop(0, '#ffe14d'); g2.addColorStop(0.4, '#ff8a2b'); g2.addColorStop(1, '#c2451a');
      ctx.fillStyle = g2;
      ctx.fillRect(L.x, top, L.w, lv.h - top + 60);
      // wavy bright surface
      ctx.fillStyle = '#ffe156';
      for (let bx = L.x + 10; bx < L.x + L.w - 6; bx += 26) {
        ctx.beginPath();
        ctx.arc(bx, top + Math.sin(t * 4 + bx) * 3, 9, Math.PI, TAU);
        ctx.fill();
      }
      // bubbles
      if (chance(0.12)) {
        Particles.burst(L.x + rand(10, L.w - 10), top, 1, { colors: ['#ffe156', '#ff9f43'], type: 'circle', sp1: 30, grav: -220, l1: 0.7, s1: 8, up: 0 });
      }
    }
  }
  // theme decorations
  drawDecor(ctx, lv, cam, t);
}

function drawDecor(ctx, lv, cam, t) {
  const th = lv.theme, d = lv.decor;
  const visible = x => x > cam.x - 150 && x < cam.x + W + 150;
  if (th === 'meadow') {
    for (const tr of d.trees || []) {
      if (!visible(tr.x)) continue;
      const s = tr.s, gy = 620;
      ctx.fillStyle = '#8a6a4a';
      rr(ctx, tr.x - 10 * s, gy - 110 * s, 20 * s, 110 * s, 6); ctx.fill();
      ctx.fillStyle = '#4eb84a';
      ctx.beginPath();
      ctx.arc(tr.x, gy - 130 * s, 46 * s, 0, TAU);
      ctx.arc(tr.x - 34 * s, gy - 106 * s, 34 * s, 0, TAU);
      ctx.arc(tr.x + 34 * s, gy - 106 * s, 34 * s, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath(); ctx.arc(tr.x + 14 * s, gy - 128 * s, 5 * s, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(tr.x - 20 * s, gy - 104 * s, 5 * s, 0, TAU); ctx.fill();
    }
    for (const f of d.flowers || []) {
      if (!visible(f.x)) continue;
      const gy = 620, s = f.s;
      const cols = ['#ff5a8a', '#ffb62b', '#b06cf0', '#ff6b35', '#4aa3ff'];
      ctx.strokeStyle = '#3f9c3a'; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(f.x, gy); ctx.quadraticCurveTo(f.x + Math.sin(t * 2 + f.x) * 4, gy - 12 * s, f.x + Math.sin(t * 2 + f.x) * 6, gy - 24 * s); ctx.stroke();
      const fx = f.x + Math.sin(t * 2 + f.x) * 6, fy = gy - 24 * s;
      ctx.fillStyle = cols[f.c];
      for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5 + t * 0.5;
        ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 7 * s, fy + Math.sin(a) * 7 * s, 5 * s, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(fx, fy, 4.5 * s, 0, TAU); ctx.fill();
    }
  } else if (th === 'water') {
    for (const wd of d.weeds || []) {
      if (!visible(wd.x)) continue;
      ctx.strokeStyle = '#2e9c5a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(wd.x, 1130);
      ctx.quadraticCurveTo(wd.x + Math.sin(t * 1.5 + wd.seed) * 18, 1130 - wd.h * 0.5, wd.x + Math.sin(t * 1.5 + wd.seed) * 30, 1130 - wd.h);
      ctx.stroke();
    }
    for (const co of d.corals || []) {
      if (!visible(co.x)) continue;
      const s = co.s;
      ctx.fillStyle = ['#ff8fb0', '#ff9f43', '#e86ad0'][co.c];
      for (let i = -1; i <= 1; i++) {
        rr(ctx, co.x + i * 12 * s - 5 * s, 1130 - (44 - Math.abs(i) * 14) * s, 10 * s, (44 - Math.abs(i) * 14) * s, 5 * s);
        ctx.fill();
      }
    }
  } else if (th === 'mountain') {
    for (const p of d.pines || []) {
      if (!visible(p.x)) continue;
      const gt = groundTopAt(lv, p.x) || 620;
      const s = p.s;
      ctx.fillStyle = '#8a6a4a';
      ctx.fillRect(p.x - 6 * s, gt - 20 * s, 12 * s, 20 * s);
      ctx.fillStyle = '#2e7d4f';
      for (let i = 0; i < 3; i++) {
        const wY = gt - 20 * s - i * 30 * s, wW = (60 - i * 14) * s;
        ctx.beginPath();
        ctx.moveTo(p.x - wW / 2, wY); ctx.lineTo(p.x, wY - 42 * s); ctx.lineTo(p.x + wW / 2, wY);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(p.x - 14 * s, gt - 100 * s); ctx.lineTo(p.x, gt - 62 * s - 42 * s); ctx.lineTo(p.x + 14 * s, gt - 100 * s);
      ctx.closePath(); ctx.fill();
    }
  } else if (th === 'lava') {
    for (const r of d.rocks || []) {
      if (!visible(r.x)) continue;
      const gt = groundTopAt(lv, r.x);
      if (gt === null) continue;
      const s = r.s;
      ctx.fillStyle = '#2e1620';
      ctx.beginPath();
      ctx.moveTo(r.x - 26 * s, gt); ctx.lineTo(r.x - 10 * s, gt - 38 * s); ctx.lineTo(r.x + 2 * s, gt - 16 * s);
      ctx.lineTo(r.x + 12 * s, gt - 44 * s); ctx.lineTo(r.x + 28 * s, gt);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,122,43,0.4)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(r.x - 10 * s, gt - 38 * s); ctx.lineTo(r.x - 4 * s, gt - 10 * s); ctx.stroke();
    }
  } else if (th === 'cave') {
    for (const c of d.crystals || []) {
      if (!visible(c.x)) continue;
      const cols = ['#7fd8ff', '#d0a0ff', '#ff8fd0'];
      const col = cols[c.c], s = c.s;
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(t * 2 + c.x) * 0.1;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(c.x, c.y - 20 * s, 55 * s, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      for (let i = -1; i <= 1; i++) {
        const hgt = (46 - Math.abs(i) * 16) * s;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(c.x + i * 16 * s - 9 * s, c.y + 20);
        ctx.lineTo(c.x + i * 16 * s, c.y + 20 - hgt);
        ctx.lineTo(c.x + i * 16 * s + 9 * s, c.y + 20);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(c.x + i * 16 * s - 3 * s, c.y + 14);
        ctx.lineTo(c.x + i * 16 * s, c.y + 22 - hgt);
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const sk of d.skulls || []) {
      if (!visible(sk.x)) continue;
      const s = sk.s, gy = 620;
      ctx.fillStyle = '#cfc8e0';
      ctx.beginPath(); ctx.arc(sk.x, gy - 38 * s, 34 * s, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
      rr(ctx, sk.x - 26 * s, gy - 42 * s, 52 * s, 42 * s, 12 * s); ctx.fill();
      ctx.fillStyle = '#3a2a55';
      ctx.beginPath(); ctx.arc(sk.x - 13 * s, gy - 40 * s, 8 * s, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(sk.x + 13 * s, gy - 40 * s, 8 * s, 0, TAU); ctx.fill();
      // goofy buck teeth
      ctx.fillStyle = '#fff';
      ctx.fillRect(sk.x - 8 * s, gy - 14 * s, 7 * s, 12 * s);
      ctx.fillRect(sk.x + 1 * s, gy - 14 * s, 7 * s, 12 * s);
      ctx.strokeStyle = '#3a2a55'; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.arc(sk.x, gy - 22 * s, 14 * s, 0.2, Math.PI - 0.2); ctx.stroke();
    }
  }
}
function groundTopAt(lv, x) {
  let best = null;
  for (const s of lv.solids) {
    if (s.ground && x >= s.x && x <= s.x + s.w) {
      if (best === null || s.y < best) best = s.y;
    }
  }
  return best;
}
