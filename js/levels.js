'use strict';
// ================================================================ level building
const LEVEL_META = {
  1: { name: 'BLOCK MEADOW', theme: 'meadow', music: 'meadow' },
  2: { name: 'UNDERWATER WORLD', theme: 'water', music: 'water' },
  3: { name: 'CLOUD WORLD', theme: 'cloud', music: 'cloud' },
  4: { name: 'MOUNTAIN WORLD', theme: 'mountain', music: 'mountain' },
  5: { name: 'ZOMBIE CAVE', theme: 'cave', music: 'cave' },
  6: { name: 'LAVA WORLD', theme: 'lava', music: 'lava' },
  7: { name: 'MONSTER TRUCK RALLY', theme: 'dirt', music: 'dirt' },
  8: { name: 'UNICORN FOREST', theme: 'forest', music: 'forest' },
  9: { name: 'SPACE MAZE', theme: 'space', music: 'space' },
  10: { name: 'DINO JUNGLE', theme: 'jungle', music: 'jungle' }
};

function newLevel(n) {
  const m = LEVEL_META[n];
  return {
    n, name: m.name, theme: m.theme, music: m.music,
    w: 4200, h: 720,
    solids: [], spiders: [], pickups: [], checks: [], hints: [], bridges: [],
    decor: {}, lights: [], lava: null,
    ramps: null, turbos: null, finishX: null,
    centipedes: [], castleX: null,
    space: false, mazeGrid: null, goalStar: null, mission: null,
    water: false, dark: false, fallCatch: false, boss: false,
    playerStart: { x: 90, y: 400 },
    gate: null
  };
}
function addGround(lv, x, w, top) {
  lv.solids.push({ x, y: top, w, h: lv.h - top + 400, ground: true, top });
}
function addPlat(lv, x, y, w, opts = {}) {
  lv.solids.push({ x, y, w, h: opts.h || 36, oneWay: opts.oneWay, bouncy: opts.bouncy, bounceVy: opts.bounceVy, plat: true });
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
    pick(lv, 3500, 572 - 70, 'heart');
    pick(lv, 1330, 400, 'ice');
    candyRow(lv, 250, 700, G - 60, 4);
    candyArc(lv, 1150, 1550, 350, 520, 5);
    candyRow(lv, 2050, 2450, 470, 4);
    candyRow(lv, 3050, 3600, 520, 5);
    candyRow(lv, 4350, 4600, 470, 3);
    spider(lv, 820, G, 'walk', { range: 170 });
    spider(lv, 1500, 572, 'jump');
    spider(lv, 2250, 524, 'walk', { range: 160 });
    // both hang spiders dangle under the high ledge — the puzzle cave stays
    // completely enemy-free so nothing interrupts solving it
    spider(lv, 2170, 508, 'hang', { webTop: 446 });
    spider(lv, 2330, 508, 'hang', { webTop: 446 });
    // short patrols only past the cave: walkers can't wander in (jump spiders
    // chase from 430px away, so none live near the chamber or the door)
    spider(lv, 3860, 572, 'walk', { range: 80 });
    spider(lv, 4100, 524, 'walk', { range: 60 });
    lv.checks.push(new Checkpoint(1750, 572));
    lv.checks.push(new Checkpoint(3850, 524));
    lv.gate = new Gate(4700, 524);
    lv.hints.push({ x: 2530, y: 350, icon: 'power' });
    // ---- Golden Key adventure mission (collection): the cave under the
    // overhang holds the crystal Shrine — a chest with three empty sockets.
    // The three Mountain Crystals are scattered nearby, each a different
    // little challenge; bring them all back and the chest opens into the key.
    // Crystal 1 (ice): on a small block pile at the cave mouth — easy hops.
    addBlockPile(lv, 3060, 572, 2, 1);
    // Crystal 2 (fire): on a high ledge — the spring block launches you up.
    addPlat(lv, 2830, 330, 170, { oneWay: true });
    addPlat(lv, 2880, 532, 90, { bouncy: true, h: 40, bounceVy: -1150 });
    // Crystal 3 (power): sealed in a pocket at the cave's back — cracked wall
    // on the left (power-smash it, as learned earlier), solid rock on the
    // right so the pocket can't be entered from the far side.
    addWallBreak(lv, 3620, 572, 4);
    lv.solids.push({ x: 3720, y: 350, w: 56, h: 222, pile: true });
    const mGate = new MissionGate(4480, 524);
    lv.solids.push(mGate.solid);
    lv.mission = new Mission('goldenkey',
      mGate,
      new CollectionPuzzle([
        new MissionToken(3108, 468, 'ice', 'crystal'),
        new MissionToken(2915, 268, 'fire', 'crystal'),
        new MissionToken(3696, 520, 'power', 'crystal')
      ], new Shrine(3300, 572, { theme: 'stone' })),
      new MissionItem('key'));
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

  if (n === 7) { // ---------------- MONSTER TRUCK RALLY (bonus)
    lv.w = 7200;
    lv.lava = [{ x: 1500, w: 220 }, { x: 3000, w: 260 }, { x: 5100, w: 200 }];
    addGround(lv, 0, 1500, G);
    addGround(lv, 1720, 1280, G);
    addGround(lv, 3260, 1840, G);
    addGround(lv, 5300, 1900, G);
    lv.ramps = [
      { x: 1290, y: G, w: 210, h: 85 },
      { x: 2400, y: G, w: 180, h: 70 },
      { x: 2780, y: G, w: 210, h: 92 },
      { x: 4000, y: G, w: 180, h: 70 },
      { x: 4870, y: G, w: 220, h: 95 },
      { x: 5750, y: G, w: 300, h: 210, big: true } // THE ramp
    ];
    lv.turbos = [{ x: 5430, w: 130 }];
    lv.finishX = 6420;
    lv.pickups.push(new ParkedTruck(300, G));
    pick(lv, 650, G - 90, 'fire');
    pick(lv, 2550, G - 80, 'ice');
    pick(lv, 3450, G - 70, 'heart');
    pick(lv, 4250, G - 80, 'rainbow');
    pick(lv, 5250, G - 70, 'heart');
    candyRow(lv, 500, 1150, G - 60, 5);
    candyArc(lv, 1500, 1950, 300, 540, 6);
    candyRow(lv, 2050, 2350, G - 60, 3);
    candyArc(lv, 2990, 3450, 290, 540, 6);
    candyRow(lv, 3600, 3950, G - 60, 4);
    candyArc(lv, 4180, 4560, 340, 540, 5);
    candyArc(lv, 5090, 5450, 300, 540, 5);
    candyArc(lv, 6050, 6700, 130, 480, 8);
    spider(lv, 1050, G, 'walk', { range: 180 });
    spider(lv, 2050, G, 'walk', { range: 150 });
    spider(lv, 2250, G, 'tornado', { range: 220 });
    spider(lv, 3700, G, 'tornado', { range: 250 });
    spider(lv, 3900, G, 'jump');
    spider(lv, 4450, G, 'walk', { range: 150 });
    spider(lv, 4650, G, 'tornado', { range: 200 });
    spider(lv, 5000, G, 'tornado', { range: 140 });
    lv.checks.push(new Checkpoint(1850, G));
    lv.checks.push(new Checkpoint(3450, G));
    lv.checks.push(new Checkpoint(5350, G));
    lv.hints.push({ x: 480, y: G - 220, icon: 'arrows' });
    lv.decor.mesas = true;
    lv.decor.flags = [];
    for (let x = 700; x < 6200; x += rand(500, 900)) lv.decor.flags.push({ x, c: randi(0, 3) });
  }

  if (n === 8) { // ---------------- UNICORN FOREST (bonus)
    const G8 = 1000;
    lv.w = 5600; lv.h = 1100;
    lv.playerStart = { x: 90, y: 850 };
    lv.castleX = 5060;
    addGround(lv, 0, lv.w, G8);
    // leafy treetop platforms
    addPlat(lv, 600, 780, 160, { oneWay: true });
    addPlat(lv, 900, 640, 160, { oneWay: true });
    addPlat(lv, 1300, 760, 190, { oneWay: true });
    addPlat(lv, 1700, 560, 170, { oneWay: true });
    addPlat(lv, 2100, 700, 190, { oneWay: true });
    addPlat(lv, 2600, 500, 180, { oneWay: true });
    addPlat(lv, 3000, 760, 190, { oneWay: true });
    addPlat(lv, 3350, 600, 170, { oneWay: true });
    addPlat(lv, 3900, 680, 190, { oneWay: true });
    addPlat(lv, 4250, 500, 170, { oneWay: true });
    addPlat(lv, 4650, 700, 190, { oneWay: true });
    // pink mushroom boosters
    for (const bx of [700, 1600, 2500, 3400, 4300]) addPlat(lv, bx, G8 - 40, 90, { bouncy: true, h: 40 });
    lv.pickups.push(new ParkedUnicorn(300, G8));
    pick(lv, 520, G8 - 90, 'rainbow');
    pick(lv, 2450, G8 - 80, 'rainbow');
    pick(lv, 3800, G8 - 80, 'rainbow');
    pick(lv, 2680, 440, 'heart');
    pick(lv, 4700, 640, 'heart');
    candyRow(lv, 450, 1050, G8 - 60, 5);
    candyArc(lv, 700, 1350, 320, 700, 7);
    candyRow(lv, 1720, 1840, 500, 3);
    candyArc(lv, 2300, 2950, 260, 640, 8);
    candyRow(lv, 3050, 3150, 700, 3);
    candyArc(lv, 3500, 4150, 300, 620, 8);
    candyRow(lv, 4280, 4390, 440, 3);
    candyRow(lv, 4800, 5000, G8 - 60, 3);
    lv.centipedes.push(new Centipede(1250, G8, 5, 260));
    lv.centipedes.push(new Centipede(2750, G8, 6, 300));
    lv.centipedes.push(new Centipede(3950, G8, 5, 240));
    spider(lv, 2050, G8, 'walk', { range: 170 });
    spider(lv, 3200, G8, 'jump');
    lv.checks.push(new Checkpoint(1900, G8));
    lv.checks.push(new Checkpoint(3650, G8));
    lv.hints.push({ x: 1000, y: G8 - 230, icon: 'space' });
    lv.hints.push({ x: 745, y: G8 - 320, icon: 'up' });
    lv.decor.trees = []; lv.decor.shrooms = []; lv.decor.butterflies = [];
    for (let x = 150; x < 5000; x += rand(260, 480)) lv.decor.trees.push({ x, s: rand(0.9, 1.6), c: randi(0, 2) });
    for (let x = 100; x < 5000; x += rand(180, 380)) lv.decor.shrooms.push({ x, s: rand(0.6, 1.1), c: randi(0, 2) });
    for (let i = 0; i < 10; i++) lv.decor.butterflies.push({ x: rand(200, 5000), y: rand(300, 900), c: randi(0, 3), sp: rand(20, 50) * (chance(0.5) ? 1 : -1) });
  }

  if (n === 9) { // ---------------- SPACE MAZE (bonus)
    const CELL = 130;
    const grid = buildSpaceMaze();
    lv.mazeGrid = grid;
    lv.w = 44 * CELL; lv.h = 19 * CELL;
    lv.water = true; lv.space = true; // weightless = swim controls
    lv.playerStart = { x: 250, y: 10.4 * CELL };
    // maze walls -> solids (merge horizontal runs)
    for (let r = 0; r < 19; r++) {
      let c = 0;
      while (c < 44) {
        if (grid[r][c] === '#') {
          let c2 = c;
          while (c2 + 1 < 44 && grid[r][c2 + 1] === '#') c2++;
          lv.solids.push({ x: c * CELL, y: r * CELL, w: (c2 - c + 1) * CELL, h: CELL, pile: true });
          c = c2 + 1;
        } else c++;
      }
    }
    const P = (c, r) => [c * CELL + CELL / 2, r * CELL + CELL / 2];
    // candy breadcrumbs along the main route to the star
    const trail = [
      [3, 10], [6, 11], [6, 13], [6, 15], [7, 17], [9, 16], [10, 15], [11, 14],
      [12, 13], [13, 12], [14, 11], [14, 9], [15, 8], [17, 7], [18, 6], [19, 5],
      [20, 6], [21, 7], [24, 8], [26, 9], [27, 10], [29, 11], [30, 9], [31, 8],
      [33, 7], [33, 6], [34, 5], [36, 4], [37, 3], [38, 1], [40, 2], [41, 3],
      [41, 5], [40, 6], [41, 8]
    ];
    for (const [c, r] of trail) { const [x, y] = P(c, r); pick(lv, x, y, 'candy'); }
    // rewards hiding in dead ends
    for (const [c, r, kind] of [
      [7, 1, 'heart'], [21, 1, 'heart'], [26, 17, 'heart'], [39, 16, 'heart'],
      [12, 1, 'fire'], [17, 13, 'fire'], [3, 6, 'fire'],
      [30, 1, 'rainbow'], [25, 13, 'rainbow'], [9, 4, 'rainbow']
    ]) { const [x, y] = P(c, r); pick(lv, x, y, kind); }
    for (const [c, r] of [[10, 1], [22, 16], [38, 17], [3, 14], [31, 5]]) {
      const [x, y] = P(c, r); pick(lv, x - 30, y, 'candy'); pick(lv, x + 30, y, 'candy');
    }
    // saucer patrols: some sideways, some up-and-down
    for (const [c, r, axis, range] of [
      [3, 8, 'x', 200], [16, 7, 'x', 300], [18, 10, 'x', 320], [24, 7, 'x', 280],
      [28, 10, 'x', 300], [18, 14, 'x', 300], [34, 4, 'x', 300], [40, 4, 'x', 160],
      [16, 3, 'y', 220], [28, 12, 'y', 220], [6, 13, 'y', 350], [40, 8, 'y', 260]
    ]) {
      const [x, y] = P(c, r);
      spider(lv, x, y + 29, 'alien', { axis, range });
    }
    // checkpoints at maze crossroads
    lv.checks.push(new Checkpoint(P(11, 6)[0], 7 * CELL));
    lv.checks.push(new Checkpoint(P(23, 9)[0], 10 * CELL));
    lv.checks.push(new Checkpoint(P(37, 12)[0], 13 * CELL));
    // THE GOLDEN STAR
    lv.goalStar = { x: P(41, 9)[0], y: P(41, 9)[1] };
    lv.hints.push({ x: 420, y: 9 * CELL, icon: 'updown' });
  }

  if (n === 10) { // ---------------- DINO JUNGLE (bonus)
    lv.w = 5800;
    addGround(lv, 0, lv.w, G);
    // canopy platforming (giant leaf platforms)
    addPlat(lv, 1150, 500, 150, { oneWay: true });
    addPlat(lv, 1400, 420, 150, { oneWay: true });
    addPlat(lv, 1650, 500, 150, { oneWay: true });
    addPlat(lv, 1850, 470, 160, { oneWay: true }); // hop route over fire dino #2
    // shrine terrace + approach steps
    addPlat(lv, 3230, 560, 130, { oneWay: true });
    addPlat(lv, 3340, 495, 130, { oneWay: true });
    addPlat(lv, 3400, 430, 780, { oneWay: true });
    // fire-breathing dinos: tutorial, platforms, staggered pair, shrine guard
    lv.spiders.push(new FireBreather(1000, G, -1));
    lv.spiders.push(new FireBreather(1950, G, -1, { offset: 1.2 }));
    lv.spiders.push(new FireBreather(2400, G, -1));
    lv.spiders.push(new FireBreather(2760, G, -1, { offset: 1.9 }));
    lv.spiders.push(new FireBreather(3470, 430, -1, { offset: 0.6 })); // guards the shrine
    // vine spiders (jungle cousins of the hang spider)
    spider(lv, 1350, 460, 'hang', { webTop: 0 });
    spider(lv, 3050, 460, 'hang', { webTop: 0 });
    pick(lv, 700, G - 90, 'rainbow');
    pick(lv, 2560, G - 80, 'ice');
    pick(lv, 2950, G - 80, 'rainbow');
    pick(lv, 1475, 360, 'heart');
    pick(lv, 4600, G - 80, 'heart');
    candyRow(lv, 280, 640, G - 55, 4);
    candyArc(lv, 850, 1090, 410, G - 70, 5); // arcs trace the jump over each flame
    candyRow(lv, 1180, 1680, 440, 5);
    candyArc(lv, 1800, 2040, 400, G - 70, 5);
    candyArc(lv, 2250, 2490, 400, G - 70, 5);
    candyArc(lv, 2610, 2850, 400, G - 70, 5);
    candyArc(lv, 3320, 3560, 300, 430 - 60, 5);
    candyRow(lv, 4400, 5000, G - 60, 5);
    candyArc(lv, 5050, 5500, 380, G - 70, 6);
    lv.checks.push(new Checkpoint(1600, G));
    lv.checks.push(new Checkpoint(2900, G));
    lv.checks.push(new Checkpoint(4200, G));
    lv.hints.push({ x: 260, y: G - 190, icon: 'arrows' });
    lv.hints.push({ x: 850, y: G - 220, icon: 'up' }); // "jump!" — over the fire
    // ---- Dino Key adventure mission (collection): the Dinosaur Nest Shrine
    // sits on the terrace with three empty nest bowls; the three lost eggs
    // are scattered along the jungle. Egg 2 needs the giant bouncy mushroom;
    // egg 3 bobs right in the shrine guard's flame path — time it!
    addPlat(lv, 1950, 350, 180, { oneWay: true }); // canopy leaf
    addPlat(lv, 2000, 580, 120, { bouncy: true, h: 40, bounceVy: -1150 }); // GIANT bouncy mushroom
    const jGate = new MissionGate(4300, G, { theme: 'jungle' });
    lv.solids.push(jGate.solid);
    lv.mission = new Mission('dinokey',
      jGate,
      new CollectionPuzzle([
        new MissionToken(1725, 452, 'rainbow', 'egg'),
        new MissionToken(2040, 296, 'power', 'egg'),
        new MissionToken(3380, 386, 'fire', 'egg')
      ], new Shrine(3800, 430, { theme: 'nest' })),
      new MissionItem('dinokey'));
    // the secret valley's golden star — guarded by the SPINOSAURUS boss
    lv.boss = true; lv.bossType = 'spino'; lv.bossX = 4470;
    lv.goalStar = { x: 5600, y: 500 };
    lv.decor.ferns = []; lv.decor.jflowers = []; lv.decor.shroomsJ = []; lv.decor.prints = [];
    for (let x = 100; x < 5700; x += rand(220, 420)) lv.decor.ferns.push({ x, s: rand(0.8, 1.5), c: randi(0, 2) });
    for (let x = 200; x < 5700; x += rand(260, 500)) lv.decor.jflowers.push({ x, s: rand(0.8, 1.3), c: randi(0, 3) });
    for (let x = 350; x < 5600; x += rand(500, 900)) lv.decor.shroomsJ.push({ x, s: rand(0.8, 1.4), c: randi(0, 2) });
    for (let x = 400; x < 5600; x += rand(400, 800)) lv.decor.prints.push({ x });
    lv.decor.longnecks = [{ x: 620, s: 1, c: 0 }, { x: 4750, s: 1.15, c: 1 }];
    lv.decor.trike = { x: 3150, x0: 3150, dir: 1, t: rand(9) };
    lv.decor.trex = { x: 5540, t: 0, lastPhase: 0 }; // watches the finale from beside the star
    lv.decor.bigflowers = [{ x: 4550, c: 0 }, { x: 4980, c: 1 }, { x: 5620, c: 2 }];
    lv.decor.eggsDecor = [{ x: 3290, s: 0.8 }, { x: 3335, s: 0.6 }];
    lv.decor.butterflies = [];
    for (let i = 0; i < 8; i++) lv.decor.butterflies.push({ x: rand(200, 5600), y: rand(250, 560), c: randi(0, 3), sp: rand(20, 50) * (chance(0.5) ? 1 : -1) });
  }

  return lv;
}
function buildSpaceMaze() {
  const COLS = 44, ROWS = 19;
  const g = [];
  for (let r = 0; r < ROWS; r++) g.push(new Array(COLS).fill('.'));
  for (let c = 0; c < COLS; c++) { g[0][c] = '#'; g[ROWS - 1][c] = '#'; }
  for (let r = 0; r < ROWS; r++) { g[r][0] = '#'; g[r][COLS - 1] = '#'; }
  for (let r = 1; r <= 17; r++) if (r !== 10 && r !== 11) g[r][5] = '#';
  const bands = [
    [1, 2, [10, 18, 26, 34]],
    [4, 5, [8, 14, 22, 30, 38]],
    [7, 8, [12, 20, 28, 36]],
    [10, 11, [10, 16, 24, 32, 38]],
    [13, 14, [8, 14, 22, 30, 36]],
    [16, 17, [12, 20, 28, 34]]
  ];
  for (const [r1, r2, walls] of bands) for (const wc of walls) { g[r1][wc] = '#'; g[r2][wc] = '#'; }
  const wallRows = [
    [3, [6, 7, 16, 17, 24, 25, 28, 29, 36, 37, 40, 41]],
    [6, [6, 7, 10, 11, 18, 19, 20, 21, 26, 27, 32, 33, 40, 41]],
    [9, [8, 9, 14, 15, 22, 23, 26, 27, 30, 31, 34, 35]],
    [12, [6, 7, 12, 13, 20, 21, 28, 29, 34, 35, 36, 37]],
    [15, [6, 7, 10, 11, 16, 17, 24, 25, 32, 33, 38, 39]]
  ];
  for (const [wr, gaps] of wallRows) for (let c = 6; c <= 42; c++) g[wr][c] = gaps.includes(c) ? '.' : '#';
  for (let r = 7; r <= 11; r++) for (let c = 39; c <= 42; c++) g[r][c] = '.';
  return g;
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
  } else if (th === 'dirt') {
    g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7ec8e8'); g.addColorStop(0.7, '#ffe2b0'); g.addColorStop(1, '#ffd18a');
  } else if (th === 'forest') {
    g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#9fdcb0'); g.addColorStop(0.6, '#c8ecc0'); g.addColorStop(1, '#e8f7d0');
  } else if (th === 'space') {
    g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0a1e'); g.addColorStop(1, '#201646');
  } else if (th === 'jungle') {
    g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7ecfe8'); g.addColorStop(0.45, '#a8e8b0'); g.addColorStop(1, '#d8f2c0');
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
  } else if (th === 'dirt') {
    // desert sun
    const sx = 1100 - cam.x * 0.04, sy = 100;
    ctx.fillStyle = '#ffe156';
    ctx.beginPath(); ctx.arc(sx, sy, 48, 0, TAU); ctx.fill();
    drawFace(ctx, sx, sy, 48, 'happy', t, 11);
    // flat-top mesas
    for (let i = -1; i < 5; i++) {
      const mx = i * 560 - (cam.x * 0.22) % 560;
      ctx.fillStyle = '#d9a05e';
      ctx.beginPath();
      ctx.moveTo(mx - 250, 640); ctx.lineTo(mx - 160, 330); ctx.lineTo(mx + 40, 330); ctx.lineTo(mx + 130, 640);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c98f4e';
      ctx.fillRect(mx - 160, 330, 200, 24);
    }
    // drifting dust
    if (chance(0.2)) Particles.burst(cam.x + rand(0, W), cam.y + rand(480, 640), 1, { colors: ['#e8caa0', '#d9b98a'], sp1: 40, grav: -15, l0: 1.5, l1: 3, up: 0, s0: 6, s1: 14 });
  } else if (th === 'forest') {
    // deep-forest tree silhouettes, two parallax layers
    for (const [par, col, sc] of [[0.15, '#7bc48f', 1.35], [0.3, '#5cae74', 1]]) {
      for (let i = -1; i < 7; i++) {
        const tx2 = i * 340 - (cam.x * par) % 340;
        const ty2 = 700 - cam.y * par * 0.5;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(tx2, ty2 - 240 * sc, 90 * sc, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(tx2 - 60 * sc, ty2 - 160 * sc, 75 * sc, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(tx2 + 60 * sc, ty2 - 170 * sc, 70 * sc, 0, TAU); ctx.fill();
        ctx.fillRect(tx2 - 14 * sc, ty2 - 180 * sc, 28 * sc, 200 * sc);
      }
    }
    // soft light rays
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = '#fff8d0';
    for (let i = 0; i < 4; i++) {
      const rx = ((i * 400 - cam.x * 0.35) % (W + 500) + W + 500) % (W + 500) - 250;
      ctx.beginPath();
      ctx.moveTo(rx, -20); ctx.lineTo(rx + 110, -20);
      ctx.lineTo(rx - 90 + Math.sin(t + i) * 20, H + 20); ctx.lineTo(rx - 210 + Math.sin(t + i) * 20, H + 20);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // floating magic motes
    if (chance(0.25)) Particles.burst(cam.x + rand(0, W), cam.y + rand(100, 700), 1, { colors: RAINBOW.concat(['#fff']), type: 'sparkle', sp1: 15, grav: -20, l0: 1.5, l1: 3, up: 0, s0: 4, s1: 8 });
  } else if (th === 'space') {
    // twinkling starfield, two parallax layers
    for (const [par, n2, s2] of [[0.08, 60, 1.6], [0.2, 40, 2.6]]) {
      for (let i = 0; i < n2; i++) {
        const sx = (((i * 379 + 83) - cam.x * par) % (W + 20) + W + 20) % (W + 20) - 10;
        const sy = (((i * 631 + 47) - cam.y * par) % (H + 20) + H + 20) % (H + 20) - 10;
        const tw = 0.55 + 0.45 * Math.sin(t * 2 + i * 1.7);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + 0.5 * tw) + ')';
        ctx.beginPath(); ctx.arc(sx, sy, s2 * (0.6 + tw * 0.5), 0, TAU); ctx.fill();
      }
    }
    // nebula wisps
    ctx.save();
    ctx.globalAlpha = 0.12;
    for (const [nx, ny, nr, nc] of [[300, 180, 190, '#b06cf0'], [950, 480, 230, '#4aa3ff'], [620, 620, 160, '#ff5fa2']]) {
      ctx.fillStyle = nc;
      ctx.beginPath();
      ctx.ellipse(nx - cam.x * 0.05, ny - cam.y * 0.05, nr, nr * 0.55, 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // ringed planet (with a face, obviously)
    const px2 = 1020 - cam.x * 0.04, py2 = 150 - cam.y * 0.03;
    ctx.fillStyle = '#ffb35c';
    ctx.beginPath(); ctx.arc(px2, py2, 52, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd9a0'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.ellipse(px2, py2 + 6, 84, 22, -0.25, 0, TAU); ctx.stroke();
    drawFace(ctx, px2, py2 - 4, 46, 'sleepy', t, 61);
    // little red planet
    const rx2 = 220 - cam.x * 0.06, ry2 = 520 - cam.y * 0.04;
    ctx.fillStyle = '#e86a5a';
    ctx.beginPath(); ctx.arc(rx2, ry2, 26, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c04a3f';
    ctx.beginPath(); ctx.arc(rx2 - 8, ry2 - 5, 6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(rx2 + 9, ry2 + 8, 4, 0, TAU); ctx.fill();
    // shooting star sometimes
    if (chance(0.008)) {
      Particles.burst(cam.x + rand(0, W), cam.y + rand(0, 300), 1, { colors: ['#fff'], type: 'sparkle', sp0: 500, sp1: 700, a0: 2.6, a1: 2.9, grav: 0, l0: 0.5, l1: 0.8, s1: 10, up: 0 });
    }
  } else if (th === 'jungle') {
    // distant smoking volcano with a sleepy face
    const vx = 900 - cam.x * 0.06;
    if (vx > -400 && vx < W + 400) {
      ctx.fillStyle = '#6aa876';
      ctx.beginPath();
      ctx.moveTo(vx - 330, 640); ctx.lineTo(vx - 60, 200); ctx.lineTo(vx + 60, 200); ctx.lineTo(vx + 330, 640);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,140,60,' + (0.35 + 0.15 * Math.sin(t * 1.5)) + ')';
      ctx.beginPath(); ctx.ellipse(vx, 203, 44, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 3; i++) {
        const py = 180 - i * 42 - (t * 18) % 42;
        ctx.beginPath(); ctx.arc(vx + Math.sin(t + i * 2) * 14, py, 16 + i * 5, 0, TAU); ctx.fill();
      }
      drawFace(ctx, vx, 278, 54, 'sleepy', t, 87); // above the canopy line
    }
    // two parallax canopy layers of giant round trees + fronds
    for (const [par, col, sc] of [[0.15, '#8fd8a0', 1.3], [0.3, '#6cc47e', 1]]) {
      for (let i = -1; i < 8; i++) {
        const tx2 = i * 310 - (cam.x * par) % 310;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(tx2, 690 - 250 * sc, 100 * sc, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(tx2 - 70 * sc, 690 - 170 * sc, 80 * sc, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(tx2 + 70 * sc, 690 - 180 * sc, 74 * sc, 0, TAU); ctx.fill();
      }
    }
    // hanging vines swaying from the canopy top
    ctx.strokeStyle = 'rgba(63,156,58,0.55)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const vx2 = ((i * 420 + 130 - cam.x * 0.45) % (W + 300) + W + 300) % (W + 300) - 150;
      const vl = 120 + (i % 3) * 60, wob = Math.sin(t * 1.4 + i * 1.7) * 14;
      ctx.beginPath();
      ctx.moveTo(vx2, -10);
      ctx.quadraticCurveTo(vx2 + wob * 0.5, vl * 0.6, vx2 + wob, vl);
      ctx.stroke();
    }
    // drifting mist
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      const mx = ((i * 460 + t * 12 - cam.x * 0.5) % (W + 500) + W + 500) % (W + 500) - 250;
      ctx.beginPath(); ctx.ellipse(mx, 520 + (i % 2) * 70, 190, 34, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
    // the secret valley: waterfall + rainbow behind the far end of the world
    const wx = 4620 - cam.x;
    if (wx > -300 && wx < W + 300) {
      ctx.fillStyle = '#5a8a68';
      ctx.beginPath();
      ctx.moveTo(wx - 240, 640); ctx.lineTo(wx - 150, 130); ctx.lineTo(wx + 150, 140); ctx.lineTo(wx + 220, 640);
      ctx.closePath(); ctx.fill();
      const wg = ctx.createLinearGradient(0, 130, 0, 620);
      wg.addColorStop(0, '#bfe8ff'); wg.addColorStop(1, '#7fd8ff');
      ctx.fillStyle = wg;
      ctx.fillRect(wx - 46, 140, 92, 480);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 5; i++) {
        const fy = (140 + i * 110 + t * 220) % 480 + 140;
        ctx.beginPath(); ctx.ellipse(wx + Math.sin(i * 3) * 24, fy, 13, 22, 0, 0, TAU); ctx.fill();
      }
      ctx.beginPath(); ctx.ellipse(wx, 622, 110, 16, 0, 0, TAU); ctx.fill();
      if (chance(0.2)) Particles.burst(4620 + rand(-60, 60), 610, 1, { colors: ['#fff', '#bfe8ff'], type: 'bubble', sp1: 40, grav: -80, l1: 0.8, s1: 8, up: 20 });
    }
    const rx3 = 5150 - cam.x * 0.9;
    if (rx3 > -500 && rx3 < W + 500) {
      ctx.save();
      ctx.globalAlpha = 0.4; ctx.lineWidth = 11;
      RAINBOW.forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.beginPath(); ctx.arc(rx3, 700, 380 - i * 12, Math.PI, TAU); ctx.stroke();
      });
      ctx.restore();
    }
    // floating spores / fireflies
    if (chance(0.25)) Particles.burst(cam.x + rand(0, W), cam.y + rand(150, 650), 1, { colors: ['#ffe156', '#d0ffa0', '#fff'], type: 'sparkle', sp1: 15, grav: -25, l0: 1.5, l1: 3, up: 0, s0: 4, s1: 7 });
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
    if (s.bouncy) {
      const sq = 1 + Math.sin(t * 6) * 0.05;
      if (th === 'forest' || th === 'jungle') { // pink booster mushroom
        const mcx = s.x + s.w / 2;
        ctx.fillStyle = '#fff';
        rr(ctx, mcx - 13, s.y + 12, 26, s.h - 8, 8); ctx.fill();
        ctx.fillStyle = '#ff8fb0';
        ctx.beginPath();
        ctx.ellipse(mcx, s.y + 12, (s.w / 2 + 6) * sq, 22 * sq, 0, Math.PI, TAU);
        ctx.fill();
        ctx.strokeStyle = '#d6559a'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#fff';
        for (const [ox, oy, r2] of [[-24, -8, 6], [2, -13, 7], [26, -7, 5]]) {
          ctx.beginPath(); ctx.arc(mcx + ox, s.y + 12 + oy * sq, r2, 0, TAU); ctx.fill();
        }
        drawFace(ctx, mcx, s.y + 26, 20, 'happy', t, s.x);
      } else { // spring block
        ctx.fillStyle = '#ff8fb0';
        rr(ctx, s.x, s.y - (sq - 1) * 20, s.w, s.h + (sq - 1) * 20, 10); ctx.fill();
        ctx.strokeStyle = '#d6559a'; ctx.lineWidth = 3;
        rr(ctx, s.x, s.y - (sq - 1) * 20, s.w, s.h + (sq - 1) * 20, 10); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(s.x + s.w / 2 - 12, s.y + 14); ctx.lineTo(s.x + s.w / 2, s.y + 2); ctx.lineTo(s.x + s.w / 2 + 12, s.y + 14);
        ctx.closePath(); ctx.fill();
      }
      continue;
    }
    if ((th === 'forest' || th === 'jungle') && s.oneWay) { // leafy branch platform
      ctx.fillStyle = '#57b84a';
      rr(ctx, s.x, s.y, s.w, 22, 11); ctx.fill();
      ctx.fillStyle = '#6fcf5f';
      for (let px2 = s.x + 12; px2 < s.x + s.w - 6; px2 += 30) {
        ctx.beginPath();
        ctx.ellipse(px2, s.y + 3, 15, 8, 0, Math.PI, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#3f9c3a';
      rr(ctx, s.x + 4, s.y + 14, s.w - 8, 7, 4); ctx.fill();
      if (hash2(s.x, s.y) < 0.45) {
        ctx.fillStyle = ['#ff5a8a', '#ffb62b', '#b06cf0'][Math.floor(hash2(s.x, 3) * 3)];
        for (let i2 = 0; i2 < 5; i2++) {
          const a2 = i2 * TAU / 5 + t * 0.5;
          ctx.beginPath(); ctx.arc(s.x + s.w - 18 + Math.cos(a2) * 6, s.y - 4 + Math.sin(a2) * 6, 4, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#ffe156';
        ctx.beginPath(); ctx.arc(s.x + s.w - 18, s.y - 4, 3.5, 0, TAU); ctx.fill();
      }
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
    else if (th === 'dirt') { fill = '#a8672f'; topFill = '#c9924a'; line = 'rgba(90,50,20,0.3)'; }
    else if (th === 'forest') { fill = '#7a5230'; topFill = '#57b84a'; line = 'rgba(60,35,15,0.3)'; }
    else if (th === 'space') { fill = '#3d3766'; topFill = '#7fd8ff'; line = 'rgba(15,12,35,0.5)'; }
    else if (th === 'jungle') { fill = '#8a5a34'; topFill = '#3fae5a'; line = 'rgba(60,35,15,0.3)'; }
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
    if (th === 'meadow' || th === 'water' || th === 'forest') {
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
  // dirt ramps
  if (lv.ramps) {
    for (const r of lv.ramps) {
      if (r.x + r.w < cam.x - 60 || r.x > cam.x + W + 60) continue;
      ctx.fillStyle = r.big ? '#8a4f22' : '#96592a';
      ctx.beginPath();
      ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + r.w, r.y - r.h); ctx.lineTo(r.x + r.w, r.y);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#6a3a18'; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + r.w, r.y - r.h); ctx.lineTo(r.x + r.w, r.y);
      ctx.closePath(); ctx.stroke();
      // plank stripes up the slope
      ctx.strokeStyle = 'rgba(255,220,150,0.5)'; ctx.lineWidth = 4;
      const nSt = r.big ? 6 : 4;
      for (let i = 1; i <= nSt; i++) {
        const k = i / (nSt + 1);
        ctx.beginPath();
        ctx.moveTo(r.x + r.w * k, r.y - r.h * k + 4);
        ctx.lineTo(r.x + r.w * k, r.y);
        ctx.stroke();
      }
      // launch chevron
      ctx.fillStyle = '#ffe156';
      ctx.save();
      ctx.translate(r.x + r.w * 0.62, r.y - r.h * 0.62 + 14 + (r.big ? Math.sin(t * 5) * 4 : 0));
      ctx.rotate(-Math.atan2(r.h, r.w));
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(-8, -11); ctx.lineTo(-8, 11);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  // turbo pads
  if (lv.turbos) {
    for (const tp of lv.turbos) {
      if (tp.x + tp.w < cam.x - 60 || tp.x > cam.x + W + 60) continue;
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 6);
      ctx.fillStyle = '#ffe156';
      rr(ctx, tp.x - 8, 606, tp.w + 16, 18, 8); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ff9f43';
      rr(ctx, tp.x, 610, tp.w, 12, 6); ctx.fill();
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 3; i++) {
        const chx = tp.x + 20 + i * 34 + (t * 90) % 34;
        if (chx > tp.x + tp.w - 14) continue;
        ctx.beginPath();
        ctx.moveTo(chx, 612); ctx.lineTo(chx + 12, 616); ctx.lineTo(chx, 620);
        ctx.closePath(); ctx.fill();
      }
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
  // THE GOLDEN STAR (maze goal)
  if (lv.goalStar) {
    const gs = lv.goalStar;
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 3);
    ctx.fillStyle = '#ffe156';
    ctx.beginPath(); ctx.arc(gs.x, gs.y, 105, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(gs.x, gs.y);
    ctx.rotate(Math.sin(t * 1.2) * 0.15);
    ctx.fillStyle = '#ffd24a';
    starPath(ctx, 0, 0, 62, 28);
    ctx.fill();
    ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 5; ctx.stroke();
    drawFace(ctx, 0, 4, 44, 'grin', t, 93);
    ctx.restore();
    if (chance(0.2)) Particles.burst(gs.x + rand(-70, 70), gs.y + rand(-70, 70), 1, { colors: ['#ffe156', '#fff'], type: 'sparkle', sp1: 30, grav: 0, l1: 0.9, s1: 9, up: 0 });
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
  } else if (th === 'forest') {
    const G8 = 1000;
    // grand trees
    for (const tr of d.trees || []) {
      if (!visible(tr.x)) continue;
      const s = tr.s;
      ctx.fillStyle = '#8a6a4a';
      rr(ctx, tr.x - 13 * s, G8 - 190 * s, 26 * s, 190 * s, 8); ctx.fill();
      const cols = [['#4eb84a', '#3f9c3a'], ['#5fc95a', '#4aa843'], ['#44a84f', '#358c40']][tr.c];
      ctx.fillStyle = cols[1];
      ctx.beginPath();
      ctx.arc(tr.x - 40 * s, G8 - 200 * s, 42 * s, 0, TAU);
      ctx.arc(tr.x + 40 * s, G8 - 205 * s, 40 * s, 0, TAU);
      ctx.fill();
      ctx.fillStyle = cols[0];
      ctx.beginPath();
      ctx.arc(tr.x, G8 - 250 * s, 52 * s, 0, TAU);
      ctx.arc(tr.x - 26 * s, G8 - 215 * s, 38 * s, 0, TAU);
      ctx.arc(tr.x + 30 * s, G8 - 220 * s, 36 * s, 0, TAU);
      ctx.fill();
      if (hash2(tr.x, 5) < 0.3) drawFace(ctx, tr.x, G8 - 120 * s, 26 * s, 'sleepy', t, tr.x);
    }
    // little decorative mushrooms
    for (const m of d.shrooms || []) {
      if (!visible(m.x)) continue;
      const s = m.s;
      const mcol = ['#ff5a5a', '#b06cf0', '#ffb62b'][m.c];
      ctx.fillStyle = '#fff';
      rr(ctx, m.x - 5 * s, G8 - 18 * s, 10 * s, 18 * s, 4); ctx.fill();
      ctx.fillStyle = mcol;
      ctx.beginPath(); ctx.ellipse(m.x, G8 - 18 * s, 14 * s, 10 * s, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(m.x - 5 * s, G8 - 22 * s, 2.5 * s, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(m.x + 5 * s, G8 - 24 * s, 2 * s, 0, TAU); ctx.fill();
    }
    // butterflies
    for (const b of d.butterflies || []) {
      b.x += b.sp * 0.016;
      if (b.x > 5300) b.x = 100; if (b.x < 80) b.x = 5280;
      if (!visible(b.x)) continue;
      const by2 = b.y + Math.sin(t * 3 + b.x * 0.02) * 20;
      const flap2 = Math.abs(Math.sin(t * 12 + b.x));
      ctx.fillStyle = ['#ff8fb0', '#4aa3ff', '#ffe156', '#b06cf0'][b.c];
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(b.x + sd * 6 * flap2, by2, 7 * flap2 + 1, 9, sd * 0.5, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#3a2a3a';
      rr(ctx, b.x - 1.5, by2 - 7, 3, 14, 2); ctx.fill();
    }
    // THE CASTLE
    if (visible(5350)) {
      const cx0 = 5150;
      // red carpet
      ctx.fillStyle = '#e83a4d';
      ctx.beginPath();
      ctx.moveTo(cx0 - 180, G8); ctx.lineTo(cx0 + 160, G8); ctx.lineTo(cx0 + 130, G8 - 8); ctx.lineTo(cx0 - 150, G8 - 8);
      ctx.closePath(); ctx.fill();
      // main wall
      ctx.fillStyle = '#f7eef7';
      rr(ctx, cx0, G8 - 380, 430, 380, 6); ctx.fill();
      ctx.strokeStyle = '#c9a9d6'; ctx.lineWidth = 4;
      rr(ctx, cx0, G8 - 380, 430, 380, 6); ctx.stroke();
      // battlements
      ctx.fillStyle = '#f7eef7';
      for (let bx3 = cx0; bx3 < cx0 + 430; bx3 += 54) rr(ctx, bx3, G8 - 404, 30, 28, 4), ctx.fill();
      // towers
      for (const [tx3, tw, th2] of [[cx0 - 40, 84, 500], [cx0 + 170, 100, 590], [cx0 + 390, 84, 500]]) {
        ctx.fillStyle = '#fdf6ff';
        rr(ctx, tx3, G8 - th2, tw, th2, 8); ctx.fill();
        ctx.strokeStyle = '#c9a9d6'; ctx.lineWidth = 4;
        rr(ctx, tx3, G8 - th2, tw, th2, 8); ctx.stroke();
        // cone roof
        ctx.fillStyle = '#b06cf0';
        ctx.beginPath();
        ctx.moveTo(tx3 - 12, G8 - th2); ctx.lineTo(tx3 + tw / 2, G8 - th2 - 90); ctx.lineTo(tx3 + tw + 12, G8 - th2);
        ctx.closePath(); ctx.fill();
        // flag
        ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(tx3 + tw / 2, G8 - th2 - 90); ctx.lineTo(tx3 + tw / 2, G8 - th2 - 130); ctx.stroke();
        ctx.fillStyle = '#ff8fb0';
        ctx.beginPath();
        ctx.moveTo(tx3 + tw / 2, G8 - th2 - 130);
        ctx.lineTo(tx3 + tw / 2 + 30, G8 - th2 - 122 + Math.sin(t * 4 + tx3) * 3);
        ctx.lineTo(tx3 + tw / 2, G8 - th2 - 112);
        ctx.closePath(); ctx.fill();
        // window
        ctx.fillStyle = '#8a5fd0';
        ctx.beginPath();
        ctx.arc(tx3 + tw / 2, G8 - th2 + 60, 13, Math.PI, TAU);
        ctx.rect(tx3 + tw / 2 - 13, G8 - th2 + 60, 26, 22);
        ctx.fill();
      }
      // gate
      ctx.fillStyle = '#8a5fd0';
      ctx.beginPath();
      ctx.arc(cx0 + 130, G8 - 90, 58, Math.PI, TAU);
      ctx.rect(cx0 + 72, G8 - 90, 116, 90);
      ctx.fill();
      ctx.fillStyle = '#6a4390';
      for (let gy2 = G8 - 120; gy2 < G8; gy2 += 24) {
        ctx.fillRect(cx0 + 76, gy2, 108, 4);
      }
      // hearts over the gate
      heartPath(ctx, cx0 + 130, G8 - 175, 16);
      ctx.fillStyle = '#ff5a8a'; ctx.fill();
      // KING & QUEEN out front to greet you
      drawRoyal(ctx, 5310, G8, t, 'king');
      drawRoyal(ctx, 5390, G8, t, 'queen');
      if (chance(0.1)) Particles.burst(cx0 + rand(0, 430), G8 - rand(200, 560), 1, { colors: ['#fff', '#ffe156', '#ff8fb0'], type: 'sparkle', sp1: 20, grav: -30, l1: 1, s1: 7, up: 0 });
    }
  } else if (th === 'dirt') {
    const G2 = 620;
    // pennant flags along the track
    for (const f of d.flags || []) {
      if (!visible(f.x)) continue;
      ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(f.x, G2); ctx.lineTo(f.x, G2 - 120); ctx.stroke();
      ctx.fillStyle = ['#ff5a8a', '#4aa3ff', '#ffe156', '#57d357'][f.c];
      const wv = Math.sin(t * 4 + f.x) * 5;
      ctx.beginPath();
      ctx.moveTo(f.x, G2 - 120); ctx.lineTo(f.x + 42, G2 - 110 + wv); ctx.lineTo(f.x, G2 - 98);
      ctx.closePath(); ctx.fill();
    }
    // checkered FINISH banner
    if (visible(6420)) {
      for (const px2 of [6330, 6560]) {
        ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 10; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px2, G2); ctx.lineTo(px2, 330); ctx.stroke();
      }
      for (let cxr = 0; cxr < 10; cxr++) {
        for (let ro = 0; ro < 3; ro++) {
          ctx.fillStyle = (cxr + ro) % 2 ? '#fff' : '#3a2a3a';
          ctx.fillRect(6330 + cxr * 23, 330 + ro * 20 + Math.sin(t * 3 + cxr) * 3, 23, 20);
        }
      }
    }
    // grandstand with a cheering crowd of old friends
    if (visible(6800)) {
      for (let row = 0; row < 3; row++) {
        const ry = 560 - row * 52, rx = 6560 + row * 24;
        ctx.fillStyle = row % 2 ? '#b0743e' : '#9a6232';
        rr(ctx, rx, ry, 620 - row * 48, G2 - ry, 8); ctx.fill();
        // the crowd
        for (let i = 0; i < 9 - row; i++) {
          const px3 = rx + 40 + i * 64, py3 = ry - 16 + Math.abs(Math.sin(t * 5 + i * 1.3 + row)) * -10;
          const kind = hash2(i, row);
          if (kind < 0.16) { // friendly spider fan
            ctx.fillStyle = '#f060a8';
            ctx.beginPath(); ctx.ellipse(px3, py3, 17, 13, 0, 0, TAU); ctx.fill();
            drawFace(ctx, px3, py3, 20, 'happy', t, i * 7 + row);
          } else if (kind < 0.26) { // zombie fan
            ctx.fillStyle = '#8bc34a';
            rr(ctx, px3 - 15, py3 - 14, 30, 28, 8); ctx.fill();
            drawFace(ctx, px3, py3, 22, 'grin', t, i * 5 + row);
          } else if (kind < 0.36) { // King Magma fan (the cool one)
            ctx.fillStyle = '#ff8fd0';
            ctx.beginPath(); ctx.arc(px3, py3, 16, 0, TAU); ctx.fill();
            ctx.fillStyle = '#2a1a2a';
            rr(ctx, px3 - 12, py3 - 7, 10, 6, 2); ctx.fill();
            rr(ctx, px3 + 2, py3 - 7, 10, 6, 2); ctx.fill();
          } else { // block fans
            const bk = ['fire', 'ice', 'rainbow', 'power', 'none'][Math.floor(kind * 13) % 5];
            drawBlock(ctx, px3 - 14, py3 - 14, 28, bk, t, { seed: i * 3 + row });
          }
          // waving arms
          ctx.strokeStyle = 'rgba(60,40,60,0.55)'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
          const wave = Math.sin(t * 6 + i + row * 2) * 8;
          ctx.beginPath();
          ctx.moveTo(px3 - 16, py3 + 2); ctx.lineTo(px3 - 24, py3 - 12 + wave);
          ctx.moveTo(px3 + 16, py3 + 2); ctx.lineTo(px3 + 24, py3 - 12 - wave);
          ctx.stroke();
        }
      }
      // THE CANDY TROPHY
      const tx2 = 6880, ty2 = G2;
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3);
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(tx2, ty2 - 120, 95, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#cfc8e0';
      rr(ctx, tx2 - 42, ty2 - 64, 84, 64, 8); ctx.fill();
      ctx.strokeStyle = '#8a7fae'; ctx.lineWidth = 4;
      rr(ctx, tx2 - 42, ty2 - 64, 84, 64, 8); ctx.stroke();
      // golden cup
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.moveTo(tx2 - 34, ty2 - 150);
      ctx.bezierCurveTo(tx2 - 34, ty2 - 100, tx2 - 12, ty2 - 92, tx2, ty2 - 92);
      ctx.bezierCurveTo(tx2 + 12, ty2 - 92, tx2 + 34, ty2 - 100, tx2 + 34, ty2 - 150);
      ctx.closePath(); ctx.fill();
      rr(ctx, tx2 - 8, ty2 - 94, 16, 18, 3); ctx.fill();
      rr(ctx, tx2 - 26, ty2 - 78, 52, 14, 5); ctx.fill();
      ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 4;
      for (const sd of [-1, 1]) { // handles
        ctx.beginPath();
        ctx.arc(tx2 + sd * 40, ty2 - 132, 13, sd > 0 ? -1.4 : 1.75, sd > 0 ? 1.4 : 4.9);
        ctx.stroke();
      }
      drawFace(ctx, tx2, ty2 - 122, 34, 'grin', t, 77);
      // giant golden candy on top
      drawCandy(ctx, tx2, ty2 - 172, 30, 1, t);
      if (chance(0.15)) Particles.burst(tx2 + rand(-50, 50), ty2 - rand(80, 180), 1, { colors: ['#ffe156', '#fff'], type: 'sparkle', sp1: 25, grav: -40, l1: 0.8, s1: 9, up: 0 });
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
  } else if (th === 'jungle') {
    const g = 620;
    // dino footprints stamped in the grass
    ctx.fillStyle = 'rgba(60,110,60,0.4)';
    for (const p of d.prints || []) {
      if (!visible(p.x)) continue;
      for (const [ox, oy] of [[0, 0], [34, 8]]) {
        ctx.beginPath(); ctx.ellipse(p.x + ox, g + 10 + oy * 0.4, 14, 8, 0, 0, TAU); ctx.fill();
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(p.x + ox - 10 + i * 10, g + 3 + oy * 0.4, 3.5, 0, TAU); ctx.fill(); }
      }
    }
    // giant ferns
    for (const f of d.ferns || []) {
      if (!visible(f.x)) continue;
      ctx.strokeStyle = ['#3f9c3a', '#57b84a'][f.c]; ctx.lineWidth = 5 * f.s; ctx.lineCap = 'round';
      for (let i = -2; i <= 2; i++) {
        const sway = Math.sin(t * 1.3 + f.x + i) * 5;
        ctx.beginPath();
        ctx.moveTo(f.x, g + 4);
        ctx.quadraticCurveTo(f.x + i * 22 * f.s + sway, g - 55 * f.s, f.x + i * 44 * f.s + sway, g - 75 * f.s + Math.abs(i) * 18 * f.s);
        ctx.stroke();
      }
    }
    // goofy tropical flowers (some with faces)
    for (const fl of d.jflowers || []) {
      if (!visible(fl.x)) continue;
      const s = fl.s, sway = Math.sin(t * 1.6 + fl.x) * 3;
      ctx.strokeStyle = '#3f9c3a'; ctx.lineWidth = 4 * s;
      ctx.beginPath(); ctx.moveTo(fl.x, g + 4); ctx.quadraticCurveTo(fl.x + sway, g - 30 * s, fl.x + sway, g - 52 * s); ctx.stroke();
      ctx.fillStyle = ['#ff5a8a', '#ffb62b', '#b06cf0', '#ff8fb0'][fl.c];
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + t * 0.3;
        ctx.beginPath(); ctx.arc(fl.x + sway + Math.cos(a) * 13 * s, g - 52 * s + Math.sin(a) * 13 * s, 8 * s, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(fl.x + sway, g - 52 * s, 8 * s, 0, TAU); ctx.fill();
      if (fl.c === 0) drawFace(ctx, fl.x + sway, g - 52 * s, 11 * s, 'happy', t, fl.x);
    }
    // giant prehistoric mushrooms
    for (const m of d.shroomsJ || []) {
      if (!visible(m.x)) continue;
      const s = m.s;
      ctx.fillStyle = '#f2e2c0';
      rr(ctx, m.x - 10 * s, g - 60 * s, 20 * s, 60 * s, 8); ctx.fill();
      ctx.fillStyle = ['#e86a5a', '#b06cf0'][m.c];
      ctx.beginPath(); ctx.ellipse(m.x, g - 58 * s, 42 * s, 24 * s, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      for (const [ox, oy] of [[-20, -8], [4, -14], [24, -6]]) {
        ctx.beginPath(); ctx.arc(m.x + ox * s, g - 58 * s + oy * s, 5 * s, 0, TAU); ctx.fill();
      }
    }
    // decorative giant eggs near the shrine
    for (const e of d.eggsDecor || []) {
      if (!visible(e.x)) continue;
      ctx.fillStyle = '#fff6e0';
      ctx.beginPath(); ctx.ellipse(e.x, g - 30 * e.s, 22 * e.s, 30 * e.s, 0.15, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#c9b88a'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#a8d8a0';
      for (const [ox, oy] of [[-6, -10], [8, 2], [-2, 14]]) {
        ctx.beginPath(); ctx.arc(e.x + ox * e.s, g - 30 * e.s + oy * e.s, 5 * e.s, 0, TAU); ctx.fill();
      }
    }
    // friendly long-neck dinos — they lean their heads toward the hero
    for (const ln of d.longnecks || []) {
      if (!visible(ln.x)) continue;
      const s = ln.s, bod = ['#57c2b0', '#8fca5c'][ln.c], dark = ['#2f8a80', '#5a9c3a'][ln.c];
      const px2 = game.player ? game.player.cx : 0;
      const near = Math.abs(px2 - ln.x) < 420;
      const lean = clamp((px2 - ln.x) / 420, -1, 1) * (near ? 1 : 0.2);
      const bob = Math.sin(t * 1.2 + ln.x) * 4;
      // legs + body
      ctx.fillStyle = bod;
      for (const lx of [-46, -14, 18, 44]) rr(ctx, ln.x + lx * s, g - 46 * s, 16 * s, 46 * s, 7), ctx.fill();
      ctx.beginPath(); ctx.ellipse(ln.x, g - 62 * s, 66 * s, 34 * s, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke();
      // spots
      ctx.fillStyle = dark;
      for (const [ox, oy] of [[-30, -8], [4, 6], [30, -10]]) {
        ctx.beginPath(); ctx.arc(ln.x + ox * s, g - 62 * s + oy * s, 6 * s, 0, TAU); ctx.fill();
      }
      // tail
      ctx.strokeStyle = bod; ctx.lineWidth = 14 * s; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ln.x - 58 * s, g - 62 * s);
      ctx.quadraticCurveTo(ln.x - 100 * s, g - 50 * s + bob, ln.x - 118 * s, g - 80 * s);
      ctx.stroke();
      // neck bends toward the player
      const hx2 = ln.x + 52 * s + lean * 46 * s, hy2 = g - 190 * s + Math.abs(lean) * 26 * s + bob;
      ctx.lineWidth = 18 * s;
      ctx.beginPath();
      ctx.moveTo(ln.x + 44 * s, g - 72 * s);
      ctx.quadraticCurveTo(ln.x + 58 * s, g - 150 * s, hx2, hy2);
      ctx.stroke();
      ctx.fillStyle = bod;
      ctx.beginPath(); ctx.ellipse(hx2 + lean * 8 * s, hy2 - 6 * s, 22 * s, 17 * s, lean * 0.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke();
      drawFace(ctx, hx2 + lean * 10 * s, hy2 - 6 * s, 17 * s, near ? 'grin' : 'happy', t, ln.x, lean, 0);
      if (near && chance(0.03)) Particles.burst(hx2, hy2 - 26 * s, 1, { colors: ['#ff8fb0'], type: 'heart', sp1: 30, grav: -60, l1: 1, s1: 9, up: 10 });
    }
    // baby triceratops: wanders, sniffs flowers, hops when you come close
    if (d.trike) {
      const tk = d.trike;
      tk.t += 0.016;
      const near = game.player && Math.abs(game.player.cx - tk.x) < 170;
      if (!near) { tk.x += tk.dir * 22 * 0.016; if (tk.x > tk.x0 + 70) tk.dir = -1; if (tk.x < tk.x0 - 70) tk.dir = 1; }
      if (visible(tk.x)) {
        const hop = near ? Math.abs(Math.sin(tk.t * 7)) * 10 : 0;
        const sniff = !near && Math.sin(tk.t * 0.7) > 0.6 ? 6 : 0;
        const by2 = g - hop;
        ctx.fillStyle = '#f2b04a';
        ctx.beginPath(); ctx.ellipse(tk.x, by2 - 24, 30, 20, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#c2831a'; ctx.lineWidth = 3; ctx.stroke();
        for (const lx of [-16, 10]) { rr(ctx, tk.x + lx, by2 - 12, 12, 12, 5); ctx.fill(); }
        // frill + head
        const hx3 = tk.x + tk.dir * 26, hy3 = by2 - 34 + sniff;
        ctx.fillStyle = '#ffd24a';
        ctx.beginPath(); ctx.arc(hx3 - tk.dir * 6, hy3, 17, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#c2831a'; ctx.stroke();
        ctx.fillStyle = '#f2b04a';
        ctx.beginPath(); ctx.arc(hx3, hy3 + 2, 13, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(hx3 + tk.dir * 10, hy3 + 6, 8, 6, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; // little horn nubs
        for (const ox of [-4, 5]) {
          ctx.beginPath();
          ctx.moveTo(hx3 + ox - 3, hy3 - 12); ctx.lineTo(hx3 + ox, hy3 - 20); ctx.lineTo(hx3 + ox + 3, hy3 - 12);
          ctx.closePath(); ctx.fill();
        }
        drawFace(ctx, hx3 - tk.dir * 2, hy3 + 2, 13, near ? 'grin' : 'happy', tk.t, 44, tk.dir, sniff ? 0.6 : 0);
        if (near && chance(0.04)) Particles.burst(tk.x, by2 - 46, 1, { colors: ['#ff8fb0', '#ffe156'], type: 'heart', sp1: 40, grav: -70, l1: 0.8, s1: 8, up: 10 });
      }
    }
    // goofy T-Rex in the valley: stomps, roars... then sneezes
    if (d.trex && visible(d.trex.x)) {
      const tr = d.trex;
      tr.t += 0.016;
      const ph = tr.t % 7; // 0-5 stomp, 5-6 roar, 6-6.5 sneeze
      const stomp = ph < 5 ? Math.abs(Math.sin(tr.t * 3)) * 8 : 0;
      const roar = ph >= 5 && ph < 6;
      const sneeze = ph >= 6 && ph < 6.5;
      if (roar && tr.lastPhase < 5) AudioSys.sfx('roar');
      if (sneeze && tr.lastPhase < 6) {
        AudioSys.sfx('hiccup');
        Particles.burst(tr.x + 60, g - 150, 10, { colors: ['#bfe8ff', '#fff'], type: 'bubble', sp1: 220, l1: 0.8, s1: 10, grav: 100, up: 0 });
      }
      tr.lastPhase = ph;
      const squash = sneeze ? 0.85 : 1;
      const by3 = g - stomp;
      ctx.save();
      // legs
      ctx.fillStyle = '#7bbf5a';
      for (const lx of [-30, 8]) rr(ctx, tr.x + lx, by3 - 56, 24, 56, 9), ctx.fill();
      // body
      ctx.beginPath(); ctx.ellipse(tr.x, by3 - 92 * squash, 52, 44 * squash, -0.15, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#4a8a34'; ctx.lineWidth = 4; ctx.stroke();
      // tail
      ctx.strokeStyle = '#7bbf5a'; ctx.lineWidth = 18; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tr.x - 44, by3 - 84);
      ctx.quadraticCurveTo(tr.x - 100, by3 - 70 + stomp, tr.x - 128, by3 - 100);
      ctx.stroke();
      // comically tiny arms
      ctx.lineWidth = 8;
      for (const ay of [-96, -84]) {
        ctx.beginPath();
        ctx.moveTo(tr.x + 40, by3 + ay);
        ctx.lineTo(tr.x + 56, by3 + ay + 8 + Math.sin(tr.t * 5) * 3);
        ctx.stroke();
      }
      // head
      const hy4 = by3 - 150 * squash + (roar ? -8 : 0);
      ctx.fillStyle = '#7bbf5a';
      ctx.beginPath(); ctx.ellipse(tr.x + 26, hy4, 36, 28, roar ? -0.25 : 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#4a8a34'; ctx.lineWidth = 4; ctx.stroke();
      // open mouth when roaring
      if (roar || sneeze) {
        ctx.fillStyle = '#c2451a';
        ctx.beginPath(); ctx.ellipse(tr.x + 52, hy4 + 12, 16, sneeze ? 6 : 12, 0.3, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        for (const ox of [-8, 0, 8]) {
          ctx.beginPath();
          ctx.moveTo(tr.x + 46 + ox, hy4 + 4); ctx.lineTo(tr.x + 49 + ox, hy4 + 11); ctx.lineTo(tr.x + 52 + ox, hy4 + 4);
          ctx.closePath(); ctx.fill();
        }
      }
      drawFace(ctx, tr.x + 18, hy4 - 4, 24, sneeze ? 'surprised' : roar ? 'surprised' : 'happy', tr.t, 66, 1, 0);
      ctx.restore();
    }
    // giant valley flowers
    for (const bf of d.bigflowers || []) {
      if (!visible(bf.x)) continue;
      const sway = Math.sin(t * 1.1 + bf.x) * 5;
      ctx.strokeStyle = '#3f9c3a'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(bf.x, g + 4); ctx.quadraticCurveTo(bf.x + sway, g - 90, bf.x + sway, g - 150); ctx.stroke();
      ctx.fillStyle = ['#ff5a8a', '#ffb62b', '#b06cf0'][bf.c];
      for (let i = 0; i < 7; i++) {
        const a = i * TAU / 7 + t * 0.25;
        ctx.beginPath(); ctx.arc(bf.x + sway + Math.cos(a) * 34, g - 150 + Math.sin(a) * 34, 20, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(bf.x + sway, g - 150, 22, 0, TAU); ctx.fill();
      drawFace(ctx, bf.x + sway, g - 150, 24, 'happy', t, bf.x);
    }
    // butterflies (same friends as the forest)
    for (const b of d.butterflies || []) {
      b.x += b.sp * 0.016;
      if (b.x > 5700) b.x = 200; if (b.x < 200) b.x = 5700;
      if (!visible(b.x)) continue;
      const fl2 = Math.sin(t * 10 + b.x) * 6;
      ctx.fillStyle = ['#ff5a8a', '#ffb62b', '#7fd8ff', '#b06cf0'][b.c];
      const by4 = b.y + Math.sin(t * 2 + b.x * 0.02) * 12;
      ctx.beginPath(); ctx.ellipse(b.x - 5, by4, 7, 5 + fl2 * 0.4, -0.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(b.x + 5, by4, 7, 5 - fl2 * 0.4, 0.4, 0, TAU); ctx.fill();
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
function drawRoyal(ctx, x, groundY, t, who) {
  const king = who === 'king';
  const bob = (typeof game !== 'undefined' && game.endPhase === 'party') ? Math.abs(Math.sin(t * 6 + (king ? 0 : 1))) * -10 : 0;
  ctx.save();
  ctx.translate(0, bob);
  // robe / gown
  ctx.fillStyle = king ? '#d6304a' : '#8a5fd0';
  ctx.beginPath();
  ctx.moveTo(x - 24, groundY);
  ctx.quadraticCurveTo(x - 20, groundY - 62, x, groundY - 66);
  ctx.quadraticCurveTo(x + 20, groundY - 62, x + 24, groundY);
  ctx.closePath(); ctx.fill();
  if (king) { // ermine trim
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(x - 24, groundY); ctx.lineTo(x + 24, groundY); ctx.lineTo(x + 22, groundY - 8); ctx.lineTo(x - 22, groundY - 8);
    ctx.closePath(); ctx.fill();
  }
  // waving arm
  ctx.strokeStyle = king ? '#d6304a' : '#8a5fd0'; ctx.lineWidth = 9; ctx.lineCap = 'round';
  const wave = Math.sin(t * 5 + (king ? 0 : 2)) * 10;
  ctx.beginPath();
  ctx.moveTo(x + 14, groundY - 52);
  ctx.lineTo(x + 30, groundY - 72 - wave);
  ctx.stroke();
  ctx.fillStyle = '#ffcf9f';
  ctx.beginPath(); ctx.arc(x + 32, groundY - 74 - wave, 5.5, 0, TAU); ctx.fill();
  // head
  ctx.fillStyle = '#ffcf9f';
  ctx.beginPath(); ctx.arc(x, groundY - 80, 15, 0, TAU); ctx.fill();
  if (king) {
    ctx.fillStyle = '#c9c1d6'; // beard
    ctx.beginPath();
    ctx.arc(x, groundY - 74, 12, 0.2, Math.PI - 0.2);
    ctx.quadraticCurveTo(x, groundY - 52, x - 11, groundY - 71);
    ctx.fill();
  } else {
    ctx.fillStyle = '#7a4a2a'; // hair
    ctx.beginPath(); ctx.arc(x, groundY - 84, 15, Math.PI, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 14, groundY - 74, 6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 14, groundY - 74, 6, 0, TAU); ctx.fill();
  }
  drawFace(ctx, x, groundY - 78, 21, 'happy', t, king ? 51 : 52);
  drawCrown(ctx, x, groundY - 92, 11);
  ctx.restore();
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
