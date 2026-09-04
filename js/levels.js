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
  10: { name: 'DINO JUNGLE', theme: 'jungle', music: 'jungle' },
  // sublevels / mini-games (string ids — not in the title picker)
  cloudclimb: { name: 'CLOUD CLIMB', theme: 'cloud', music: 'cloud' },
  ascent: { name: 'SECRET ASCENT', theme: 'mountain', music: 'mountain' },
  skyflight: { name: 'SKY FLIGHT', theme: 'cloud', music: 'forest' },
  volcanoescape: { name: 'VOLCANO ESCAPE', theme: 'lava', music: 'cave' },
  bubblemaze: { name: 'BUBBLE MAZE', theme: 'water', music: 'water' },
  piperoom: { name: 'SECRET PIPE ROOM', theme: 'cave', music: 'dirt' },
  torchcave: { name: 'TORCH CAVERN', theme: 'cave', music: 'cave' },
  zerog: { name: 'ZERO-G STAR CHAMBER', theme: 'space', music: 'space' },
  treehouse: { name: 'JUNGLE TREEHOUSE TRAIL', theme: 'jungle', music: 'treetop' },
  beatbash: { name: 'PIT STOP BEAT BASH', theme: 'dirt', music: '' }, // the BAND is the music
  zombietown: { name: 'ZOMBIE TOWN AFTER DARK', theme: 'cave', music: 'midnight' },
  meadow2: { name: 'BLOCK MEADOW 0-2', theme: 'meadow', music: 'meadow' }, // stage two: the meadow keeps going
  water2: { name: 'SUNKEN TEMPLE 1-2', theme: 'water', music: 'water' }, // stage two: cause-and-effect temple
  cloud2: { name: 'THE WEATHER FACTORY 2-2', theme: 'cloud', music: 'cloud' }, // stage two: weather recipes
  letterblocks: { name: 'LETTER BLOCKS', theme: 'meadow', music: 'meadow' },
  endingblocks: { name: 'ENDING BLOCKS', theme: 'cloud', music: 'cloud' },
  countblocks: { name: 'COUNTING BLOCKS', theme: 'mountain', music: 'mountain' }, // Quantity Blocks: Count the Objects
  flowerland: { name: 'RAINBOW SPIDER FLOWER LAND', theme: 'meadow', music: 'forest' }, // Jack's storybook level (js/flowerland.js)
  surf: { name: 'OCEAN SURF', theme: 'ocean', music: 'dirt' }, // the surfboard ride (js/surf.js); 'ocean' = sky + clouds only
  space2: { name: 'THE ALIEN SPACE STATION 8-2', theme: 'space', music: '' }, // stage two of the Space Maze (js/station.js)
  jungle2: { name: 'THE GREAT DINOSAUR RESCUE', theme: 'jungle', music: '' }, // Dino Jungle's stage ONE: the crash + five rescues (js/rescue.js)
  sandslide: { name: 'DESERT SAND SLIDE', theme: 'dirt', music: 'dirt' }, // stage 6-1: earn the truck
  mountain2: { name: 'THE FROZEN OBSERVATORY 3-2', theme: 'mountain', music: 'mountain' } // stage two: beam routing
};

// ---- linear world chains (v1.20.0) ----
// Each world is an ordered stage list; the end of one stage advances to the
// next, and the final stage's finale completes the WORLD. Worlds absent from
// this table are single-stage chains (future stage-2s slot in by editing it).
// Secret rooms are NOT chain members — they stay optional enterSub sublevels.
const WORLD_STAGES = { 1: [1, 'meadow2'], 2: [2, 'water2'], 3: [3, 'cloud2'], 4: [4, 'mountain2'], 7: ['sandslide', 7], 9: [9, 'space2'], 10: ['jungle2', 10] };
function stageChain(w) { return WORLD_STAGES[w] || [w]; }
function stageInfo(id) { // -> {world, stage} for chain members, null otherwise
  for (const w in WORLD_STAGES) {
    const i = WORLD_STAGES[w].indexOf(id);
    if (i >= 0) return { world: +w, stage: i };
  }
  return typeof id === 'number' ? { world: id, stage: 0 } : null;
}

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
    subDoors: [], exitDoors: [], flight: false,
    truckBuild: null, vents: null, risingLava: null,
    currents: null, shellSwitches: null, goldRush: null,
    vines: null, vineHold: null, vineLock: false,
    puzzle: null, // secret-room machine (PipeWorks / TorchCavern / StarChamber)
    ride: null,   // ride-mode orchestrator (SandSlide — js/ride.js)
    water: false, dark: false, fallCatch: false, boss: false,
    playerStart: { x: 90, y: 400 },
    gate: null
  };
}
function addGround(lv, x, w, top) {
  lv.solids.push({ x, y: top, w, h: lv.h - top + 400, ground: true, top });
}
function addPlat(lv, x, y, w, opts = {}) {
  // Floating platforms are ONE-WAY by default: walk beneath them freely, jump
  // up through them, land on top. Thick slabs (h >= 60, e.g. Cloud World's
  // islands) stay solid, as does anything passing opts.solid — a solid
  // platform that looks like a walk-through one is just a nuisance.
  const h = opts.h || 36;
  const oneWay = opts.solid ? false : (opts.oneWay || h < 60);
  lv.solids.push({ x, y, w, h, oneWay, bouncy: opts.bouncy, bounceVy: opts.bounceVy, bounceVx: opts.bounceVx, plank: opts.plank, plat: true });
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
    lv.w = 4650; // grew in v1.15.0 to make room for the stage 0-2 archway
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
    // the LETTER BLOCKS learning garden: a rainbow-sparkle door tucked
    // between the second spider and the pipe room. press: true — it sits on
    // the main walking route, so entering is a deliberate stand + Space/★
    // (Ryan's playtest note), never a walk-over swallow. Always available,
    // no completion state, replay indefinitely.
    lv.subDoors.push(new SubDoor(2700, G, 'letterblocks', 'rainbow', { press: true }));
    // the SECRET PIPE ROOM: a suspiciously oversized pipe that keeps burping
    // candy — walk into it and FWOOOP, you're inside the machine room
    lv.subDoors.push(new SubDoor(2950, G, 'piperoom', 'pipe'));
    // ---- Big Buddy lesson (v1.14.0): after the last checkpoint, a glowing
    // turquoise block with a golden mushroom emblem floats overhead. Bonk it,
    // chase the waddling gold shroom, grow HUGE, then meet the last spider —
    // and an optional candy crate near the gate that only BIG Jack can smash.
    // Bottom edge G-190: bonkable from the ground (jump rise 148 > 96 needed),
    // tall enough that even Big Jack (130) strolls underneath.
    lv.solids.push({ x: 3540, y: G - 242, w: 52, h: 52, buddy: true });
    lv.solids.push({ x: 3920, y: G - 242, w: 52, h: 52, bigBonus: true });
    lv.checks.push(new Checkpoint(1800, G));
    lv.checks.push(new Checkpoint(3100, G));
    // STAGE 0-2: a wooden archway with a golden star and a big "2" badge stands
    // right on the walk to the gate — the meadow keeps going in there!
    // STAGE 0-2 (since v1.20.0 the world's ENDING — linear chains): the
    // archway advances straight into BLOCK MEADOW 0-2; no star gate anymore
    lv.subDoors.push(new SubDoor(4230, G, 'meadow2', 'stagegate', { advance: true }));
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
    // OCEAN SURF: a surfboard planted in the sand near the start — press-gated
    // (Space/★ while touching) so swimming past never swallows anyone
    lv.subDoors.push(new SubDoor(450, 1130, 'surf', 'surfboard', { press: true }));
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
    // the SECRET BUBBLE MAZE: a seaweed-framed cave on the seafloor breathing
    // a strange stream of bubbles — "where do those bubbles come from?"
    lv.subDoors.push(new SubDoor(3130, 1130, 'bubblemaze', 'bubble'));
    // STAGE 1-2 (the world's ENDING since v1.20.0): the seabed archway
    // advances straight into the SUNKEN TEMPLE; no star gate anymore
    lv.subDoors.push(new SubDoor(3880, 1130, 'water2', 'stagegate', { advance: true }));
    lv.decor.weeds = []; lv.decor.corals = []; lv.decor.fish = [];
    for (let x = 40; x < lv.w; x += rand(120, 260)) lv.decor.weeds.push({ x, h: rand(60, 150), seed: rand(9) });
    for (let x = 150; x < lv.w; x += rand(300, 600)) lv.decor.corals.push({ x, s: rand(0.7, 1.4), c: randi(0, 2) });
    for (let i = 0; i < 14; i++) lv.decor.fish.push({ x: rand(0, lv.w), y: rand(150, 1000), s: rand(0.7, 1.3), sp: rand(30, 80) * (chance(0.5) ? 1 : -1), c: randi(0, 3) });
  }

  else if (n === 3) { // ---------------- CLOUD WORLD
    lv.w = 5000; lv.fallCatch = true; // grew in v1.17.0 for the stage 2-2 archway
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
    // ENDING BLOCKS learning room: press-gated rainbow door on the calm,
    // enemy-free start platform (rainbow = the learning-door style everywhere)
    lv.subDoors.push(new SubDoor(460, 520, 'endingblocks', 'rainbow', { press: true }));
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
    lv.subDoors.push(new SubDoor(2480, 560, 'cloudclimb', 'cloud')); // CLOUD CLIMB entrance
    lv.checks.push(new Checkpoint(2350, 560));
    lv.checks.push(new Checkpoint(3750, 570));
    // STAGE 2-2 (the world's ENDING since v1.20.0): the archway island
    // advances straight into the WEATHER FACTORY; no star gate anymore
    addPlat(lv, 4600, 570, 400, { h: 80 });
    lv.subDoors.push(new SubDoor(4700, 570, 'cloud2', 'stagegate', { advance: true }));
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
    // COUNTING BLOCKS learning room (Quantity Blocks: Count the Objects):
    // press-gated rainbow door on the calm start flat, well short of the
    // first spider's patrol (820 +/- 170) — rainbow = the learning-door style
    lv.subDoors.push(new SubDoor(300, G, 'countblocks', 'rainbow', { press: true }));
    // power blocks RESPAWN (reusing the boss-pickup respawner): the crystal
    // wall must never soft-lock the mission if super mode gets spent elsewhere
    for (const px of [2000, 4020]) { // placed clear of spider patrols
      const pw = new Pickup(px, 524 - 80, 'power');
      pw.bossKind = 'power'; // respawns ~3s after super mode runs out
      lv.pickups.push(pw);
    }
    pick(lv, 3500, 572 - 70, 'heart');
    pick(lv, 1330, 400, 'ice');
    candyRow(lv, 250, 700, G - 60, 4);
    candyArc(lv, 1150, 1550, 350, 520, 5);
    candyRow(lv, 2050, 2450, 470, 4);
    candyRow(lv, 3050, 3600, 520, 5);
    candyRow(lv, 3080, 3620, 228, 5); // breadcrumbs along the cave-roof route
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
    // STAGE 3-2 (the world's ENDING since v1.23.0): the archway advances
    // straight into THE FROZEN OBSERVATORY; no star gate anymore
    lv.subDoors.push(new SubDoor(4700, 524, 'mountain2', 'stagegate', { advance: true }));
    lv.hints.push({ x: 2725, y: 330, icon: 'power' }); // right beside the cracked wall
    // ---- Golden Key adventure mission (collection): the cave under the
    // overhang holds the crystal Shrine — a chest with three empty sockets.
    // The three Mountain Crystals are scattered nearby, each a different
    // little challenge; bring them all back and the chest opens into the key.
    // Crystal 1 (ice): on a small block pile at the cave mouth — easy hops.
    addBlockPile(lv, 3060, 572, 2, 1);
    // Crystal 2 (fire): high in the sky over the tier-3 straightaway. The
    // spring pad sits on a raised one-way platform ABOVE head height, so
    // walking the ground path never touches it — hopping onto the spring is a
    // deliberate choice, and the bounce carries you up through the crystal.
    addPlat(lv, 2470, 420, 140, { oneWay: true });
    addPlat(lv, 2490, 396, 110, { bouncy: true, h: 24, bounceVy: -1150 });
    // halfway stepping-stone (one-way): lets the spring bounce chain rightward
    // onto the cave roof — an aerial route over the shrine that rejoins the
    // path at the far end of the cave
    addPlat(lv, 2755, 300, 130, { oneWay: true });
    // Crystal 3 (power): sealed in a pocket at the cave's back — cracked wall
    // on the left (power-smash it, as learned earlier), solid rock on the
    // right so the pocket can't be entered from the far side.
    addWallBreak(lv, 3620, 572, 4);
    lv.solids.push({ x: 3720, y: 350, w: 56, h: 222, pile: true });
    // the roof route's real secret: a sparkling cave mouth up on the overhang
    lv.subDoors.push(new SubDoor(3580, 260, 'ascent', 'cave'));
    const mGate = new MissionGate(4480, 524);
    lv.solids.push(mGate.solid);
    lv.mission = new Mission('goldenkey',
      mGate,
      new CollectionPuzzle([
        new MissionToken(3108, 468, 'ice', 'crystal'),
        new MissionToken(2545, 110, 'fire', 'crystal'),
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
    // the SECRET TORCH CAVERN: a low side tunnel where two glowing eyes blink
    // in the dark next to a tiny flickering torch — "something is over here"
    lv.subDoors.push(new SubDoor(660, G, 'torchcave', 'eyes'));
    // ZOMBIE TOWN AFTER DARK: a shaft of real MOONLIGHT pours through a crack
    // in the cave ceiling — stars twinkle up there, music notes drift down,
    // and rough rock rungs climb the wall. Step into the beam and up you go.
    lv.subDoors.push(new SubDoor(1080, G, 'zombietown', 'moonwell'));
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
    // the SECRET VOLCANO ESCAPE: a glowing cracked wall right before the
    // first lava pool — visual evidence, no wall-hugging needed
    lv.subDoors.push(new SubDoor(830, G, 'volcanoescape', 'crack'));
    // clusters close together = chain-reaction fireworks
    spider(lv, 600, G, 'walk', { range: 80 }); // patrols short of the secret door
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

  if (n === 'sandslide') { // ---------------- DESERT SAND SLIDE (stage 6-1)
    // Desert arrival on foot -> Pattern Blocks (3 rounds free the boogie
    // board) -> the procedural downhill ride (js/ride.js) -> victory run ->
    // mega-ramp launch into the rally with the truck parts in hand.
    lv.w = 60000; lv.h = 720; // virtual width; the ride ends long before this
    lv.playerStart = { x: 90, y: G - 94 };
    addGround(lv, 0, 1600, G); // the on-foot intro strip (normal physics)
    lv.solids.push({ x: 1560, y: 0, w: 60, h: 720, slideWall: true, skipDraw: true }); // soft dune wall until the board is claimed
    lv.hints.push({ x: 260, y: G - 190, icon: 'arrows' });
    lv.hints.push({ x: 620, y: G - 300, icon: 'up' }); // jump — bump the pattern blocks!
    lv.ride = new SandSlide(G, 1600);
    lv.puzzle = new PatternBlocksMachine(G, {
      cx: 800, roundsToWin: 3,
      onWin: () => lv.ride.reveal()
    });
    for (const s of lv.puzzle.solids) lv.solids.push(s);
    pick(lv, 1450, G - 84, 'fire'); // shooting practice for the ride ahead
    lv.checks.push(new Checkpoint(140, G));
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
    // ---- BUILD YOUR TRUCK: the rally now opens with a broken monster truck.
    // Three parts wait along the opening stretch (enemy-free): giant wheels on
    // a little block pile (easy hops), the engine hanging from a crane that a
    // big yellow floor switch lowers (cause and effect), and the power core
    // sealed behind a cracked wall on a high ledge (the learned power-smash).
    // Bring all three back -> assembly ceremony -> the real truck appears.
    addBlockPile(lv, 640, G, 2, 1); // wheels perch
    // power core ledge: hop up via the side pile, smash the wall, grab the
    // core; a tall block column seals the pocket's far side (no sneaking in)
    addBlockPile(lv, 800, G, 1, 2);
    addPlat(lv, 850, 450, 240); // high enough that no ground jump reaches it
    lv.solids.push({ x: 890, y: 450 - 96, w: 52, h: 96, breakable: true });
    lv.solids.push({ x: 1042, y: 306, w: 48, h: 144, pile: true });
    // the smashing power (respawns like the mountain ones — no soft-lock)
    const pw7 = new Pickup(560, G - 84, 'power');
    pw7.bossKind = 'power';
    lv.pickups.push(pw7);
    lv.truckBuild = new TruckBuild(430, G, [
      new MissionToken(688, G - 82, 'ice', 'wheels'),
      new MissionToken(1250, 350, 'fire', 'engine'),
      new MissionToken(990, 408, 'power', 'core')
    ], {
      crane: { x: 1250, topY: 350, lowY: G - 64 },
      plate: { x: 1108 }
    });
    // arriving off the Sand Slide's mega ramp: parts already in hand, the
    // ceremony fires on approach; a direct start keeps the classic hunt
    if (game.partsDelivered) { game.partsDelivered = false; lv.truckBuild.deliver(); }
    // Jack's replay wish: walk back to the start line, press Space at the
    // dune archway, and ride the whole Sand Slide again (tutorial skipped)
    lv.subDoors.push(new SubDoor(140, G, 'sandslide', 'stagegate', { goTo: 'sandslide' }));
    // easter egg: don't tell anyone what's parked behind the starting line
    lv.decor.dinoTruck = { x: 42 };
    pick(lv, 1440, G - 90, 'fire');
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
    // PIT STOP BEAT BASH: a pit garage between the two mid-course ramps thumps
    // to a muffled beat, strobes light through the door seams, and a mechanic
    // peeks out and slams the door. Racing past at truck speed never enters —
    // stop (or press ★) to investigate, and FWOOMP: you're in the band room.
    lv.subDoors.push(new SubDoor(2680, G, 'beatbash', 'garage'));
    spider(lv, 2050, G, 'walk', { range: 150 }); // the build zone stays enemy-free
    spider(lv, 2250, G, 'tornado', { range: 220 });
    spider(lv, 3700, G, 'tornado', { range: 250 });
    spider(lv, 3900, G, 'jump');
    spider(lv, 4450, G, 'walk', { range: 150 });
    spider(lv, 4650, G, 'tornado', { range: 200 });
    spider(lv, 5000, G, 'tornado', { range: 140 });
    lv.checks.push(new Checkpoint(1850, G));
    lv.checks.push(new Checkpoint(3450, G));
    lv.checks.push(new Checkpoint(5350, G));
    lv.hints.push({ x: 130, y: G - 220, icon: 'arrows' });
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
    lv.subDoors.push(new SubDoor(4480, G8, 'skyflight', 'rainbow')); // SKY FLIGHT ring
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
    // the SECRET ZERO-G STAR CHAMBER: a cracked asteroid on the floor of the
    // open pocket below the start — golden sparkles leak out of the crack and
    // a little candy trail drifts down toward it
    // (offset left of the spawn column so the door arms itself immediately)
    lv.subDoors.push(new SubDoor(180, 18 * CELL, 'zerog', 'asteroid'));
    pick(lv, 265, 1760, 'candy'); pick(lv, 230, 1990, 'candy'); pick(lv, 200, 2200, 'candy');
  }

  if (n === 10) { // ---------------- DINO JUNGLE (bonus)
    lv.w = 5800;
    lv.decor.crashedPod = { x: 200 }; // continuity: the escape pod from the Alien Space Station (8-2)
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
    candyRow(lv, 380, 640, G - 55, 3);
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
    // the JUNGLE TREEHOUSE TRAIL: a rope ladder dangles down a giant trunk
    // right at the jungle's edge — leaves flutter down out of the canopy, a
    // tiny treehouse peeks through the leaves far above, and every so often a
    // faint monkey whoop drifts down ("someone lives up there!")
    lv.subDoors.push(new SubDoor(260, G, 'treehouse', 'ladder'));
    // ---- Big Buddy, lesson two (v1.14.0): a buddy block right at the jungle
    // entrance so Jack can grow BEFORE the first fire dino — its flame then
    // teaches "big soaks a hit" without a word. (Flame #1 reaches x≈758;
    // the block at 560 keeps the bonk spot safely clear of it.)
    lv.solids.push({ x: 560, y: G - 242, w: 52, h: 52, buddy: true });
    lv.hints.push({ x: 430, y: G - 190, icon: 'arrows' });
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

  if (n === 'meadow2') { // ---------------- BLOCK MEADOW 0-2 (stage two, v1.15.0)
    // The meadow keeps going — longer than any world (6800px), still gentle,
    // but the route is BARRED twice by big-brick walls only BIG Jack can ram
    // through. Refill buddy blocks guard each wall so a shrink is never a
    // soft-lock: bonk again, chase again, grow again, SMASH again.
    lv.w = 6800;
    addGround(lv, 0, lv.w, G);
    // ---- warm-up: pure meadow comfort ----
    lv.hints.push({ x: 300, y: G - 190, icon: 'arrows' });
    candyRow(lv, 350, 750, G - 50, 4);
    spider(lv, 950, G, 'walk', { range: 160 });
    addBlockPile(lv, 1150, G, 2, 1);
    addPlat(lv, 1380, 480, 200);
    candyArc(lv, 1300, 1660, 390, G - 60, 5);
    lv.checks.push(new Checkpoint(1550, G));
    // ---- wall 1: the lesson (buddy block refills — never a dead end) ----
    lv.solids.push({ x: 1754, y: G - 242, w: 52, h: 52, buddy: true, refill: true });
    lv.solids.push({ x: 2050, y: G - 240, w: 52, h: 240, bigBrick: true });
    candyArc(lv, 2150, 2450, 400, G - 60, 5); // celebration on the far side
    // ---- friendly middle ----
    spider(lv, 2500, G, 'walk', { range: 170 });
    addPlat(lv, 2650, 500, 200);
    candyRow(lv, 2680, 2820, 450, 3);
    // RAINBOW SPIDER FLOWER LAND (Jack's level): a giant flower door on the
    // calm middle flat, press-gated because it sits on the walking route
    lv.subDoors.push(new SubDoor(2900, G, 'flowerland', 'flower', { press: true }));
    addPlat(lv, 3050, 580, 100, { bouncy: true, h: 40 }); // spring up to the sky path
    addPlat(lv, 3180, 300, 320, { oneWay: true });
    candyRow(lv, 3220, 3460, 250, 4);
    lv.solids.push({ x: 3600, y: G - 242, w: 52, h: 52, bigBonus: true }); // optional candy crate
    spider(lv, 3950, G, 'jump');
    pick(lv, 4150, G - 60, 'heart');
    lv.checks.push(new Checkpoint(4400, G));
    // ---- wall 2: DOUBLE bricks guarding the candy vault ----
    lv.solids.push({ x: 4624, y: G - 242, w: 52, h: 52, buddy: true, refill: true });
    lv.solids.push({ x: 4950, y: G - 288, w: 104, h: 288, bigBrick: true });
    candyRow(lv, 5150, 5500, G - 50, 5);
    candyArc(lv, 5250, 5450, 380, G - 70, 5);
    addBlockPile(lv, 5350, G, 2, 2);
    candyRow(lv, 5360, 5430, G - 120, 2);
    pick(lv, 5550, G - 60, 'heart');
    // ---- victory run to the golden star ----
    spider(lv, 5850, G, 'walk', { range: 150 });
    candyArc(lv, 6000, 6350, 380, G - 60, 6);
    lv.goalStar = { x: 6600, y: 470 };
    lv.decor.flowers = []; lv.decor.trees = []; lv.decor.clouds = [];
    for (let x = 60; x < lv.w; x += rand(90, 200)) lv.decor.flowers.push({ x, c: randi(0, 4), s: rand(0.8, 1.3) });
    for (let x = 200; x < lv.w; x += rand(400, 800)) lv.decor.trees.push({ x, s: rand(0.85, 1.25) });
    for (let i = 0; i < 16; i++) lv.decor.clouds.push({ x: rand(0, lv.w), y: rand(50, 240), s: rand(0.7, 1.5) });
  }

  if (n === 'water2') { // ---------------- SUNKEN TEMPLE 1-2 (stage two, v1.16.0)
    // A big drowned temple of pure cause-and-effect: valves toggle current
    // streams (generic lv.currents, built off), streams carry pearls, pearls
    // fill clam sockets, three lit wings wake the great door. All puzzle state
    // lives on the SunkenTemple machine (lv.puzzle). No enemies or hazards
    // inside the temple — thinking is the whole game here.
    lv.w = 5200; lv.h = 1600; lv.water = true;
    lv.playerStart = { x: 90, y: 1300 };
    addGround(lv, 0, lv.w, 1530);
    lv.hints.push({ x: 300, y: 1100, icon: 'updown' });
    // ---- open-sea approach (the only two spiders live out here) ----
    candyArc(lv, 300, 700, 1100, 1350, 5);
    spider(lv, 800, 1200, 'swim', { range: 160 });
    spider(lv, 1150, 900, 'swim', { range: 150 });
    lv.checks.push(new Checkpoint(1100, 1530));
    // ---- wing A: the valve lesson (roofed room, open on the right) ----
    lv.solids.push({ x: 1350, y: 1000, w: 1000, h: 60, pile: true });
    lv.solids.push({ x: 1350, y: 1060, w: 60, h: 470, pile: true });
    candyRow(lv, 1700, 2100, 1450, 4);
    // ---- hub + the sealed treasure chamber (visible through the walls!) ----
    lv.checks.push(new Checkpoint(2550, 1530));
    lv.solids.push({ x: 2700, y: 640, w: 80, h: 530, pile: true }); // door wall
    lv.solids.push({ x: 2700, y: 1170, w: 80, h: 360, templeDoor: true, skipDraw: true });
    lv.solids.push({ x: 2700, y: 580, w: 700, h: 60, pile: true }); // treasure roof
    lv.solids.push({ x: 3320, y: 640, w: 80, h: 890, pile: true }); // treasure far wall
    candyRow(lv, 2820, 3220, 1470, 5);
    candyArc(lv, 2900, 3200, 1250, 1430, 4);
    pick(lv, 2900, 1350, 'heart');
    pick(lv, 3150, 1350, 'heart');
    // ---- wing B: two currents, one pearl, high above the roofs ----
    addPlat(lv, 2450, 430, 660);            // the pearl ledge (one-way)
    addPlat(lv, 3130, 190, 120);            // the high socket perch (one-way)
    candyRow(lv, 2600, 3000, 370, 4);
    // ---- wing C: shell switch pops the cage, current carries the pearl ----
    lv.solids.push({ x: 3550, y: 1080, w: 1150, h: 60, pile: true });
    lv.solids.push({ x: 4640, y: 1140, w: 60, h: 390, pile: true });
    lv.solids.push({ x: 4000, y: 1330, w: 44, h: 200, valve: true, kind: 'rainbow' }); // the cage membrane
    lv.shellSwitches = [{ x: 3640, y: 1478, w: 52, h: 52, kind: 'rainbow' }];
    candyRow(lv, 4100, 4500, 1450, 4);
    lv.checks.push(new Checkpoint(3480, 1530));
    // ---- current zones: built OFF; the temple's valves flip them ----
    lv.currents = [
      { id: 'ca', x: 1500, y: 1360, w: 700, h: 170, dir: 'right', on: false },
      { id: 'cb1', x: 2480, y: 320, w: 600, h: 150, dir: 'right', on: false },
      { id: 'cb2', x: 3100, y: 140, w: 210, h: 920, dir: 'up', on: false },
      { id: 'cc', x: 3700, y: 1360, w: 760, h: 170, dir: 'left', on: false }
    ];
    lv.puzzle = new SunkenTemple(lv);
    // goalStar appears only when the great door wakes (machine sets it)
    lv.decor.weeds = []; lv.decor.corals = []; lv.decor.fish = [];
    for (let x = 40; x < lv.w; x += rand(120, 260)) lv.decor.weeds.push({ x, h: rand(60, 150), seed: rand(9) });
    for (let x = 150; x < lv.w; x += rand(320, 640)) lv.decor.corals.push({ x, s: rand(0.7, 1.4), c: randi(0, 2) });
    for (let i = 0; i < 16; i++) lv.decor.fish.push({ x: rand(0, lv.w), y: rand(150, 1400), s: rand(0.7, 1.3), sp: rand(30, 80) * (chance(0.5) ? 1 : -1), c: randi(0, 3) });
  }

  if (n === 'cloud2') { // ---------------- THE WEATHER FACTORY 2-2 (stage two, v1.17.0)
    // A weather-making factory in the open sky: four stations on their own
    // islands, WIDE stretches of air between them (big levels breathe), all
    // run by the WeatherFactory machine (lv.puzzle). Recipes, not reflexes:
    // water -> rain; fan -> wind -> POWER; water+cold(+power) -> snow;
    // water+sun(+power) -> the rainbow bridge. No enemies, no hazards —
    // falling just means the cloud-catch. The star waits alone, far out on
    // its own island past the rainbow.
    lv.w = 7600; lv.h = 1440; lv.fallCatch = true;
    lv.playerStart = { x: 90, y: 1060 };
    lv.hints.push({ x: 250, y: 1050, icon: 'arrows' });
    addPlat(lv, 0, 1200, 700, { h: 90 });                 // entry island
    addPlat(lv, 800, 1140, 170, { oneWay: true });
    addPlat(lv, 1080, 1060, 170, { oneWay: true });
    addPlat(lv, 1360, 1140, 170, { oneWay: true });
    candyArc(lv, 820, 1500, 950, 1090, 5);
    addPlat(lv, 1600, 1150, 900, { h: 90 });              // station 1: flower garden
    lv.checks.push(new Checkpoint(1700, 1150));
    candyRow(lv, 2100, 2400, 1090, 3);
    addPlat(lv, 2620, 1080, 170, { oneWay: true });
    addPlat(lv, 2820, 1000, 170, { oneWay: true });
    candyArc(lv, 2600, 2960, 880, 1020, 4);
    addPlat(lv, 3000, 1050, 900, { h: 90 });              // station 2: windmill power
    lv.checks.push(new Checkpoint(3300, 1050));
    addPlat(lv, 4020, 1000, 170, { oneWay: true });
    addPlat(lv, 4220, 1080, 170, { oneWay: true });
    pick(lv, 4110, 900, 'heart');
    addPlat(lv, 4400, 1150, 900, { h: 90 });              // station 3: snow yard
    lv.checks.push(new Checkpoint(4480, 1150));
    candyRow(lv, 4850, 5150, 1090, 3);
    addPlat(lv, 5450, 1200, 300, { h: 90 });              // the stalk island (stairs grow here)
    addPlat(lv, 5820, 700, 520, { h: 80 });               // station 4: the high rainbow deck
    candyArc(lv, 5860, 6280, 560, 640, 4);
    pick(lv, 6600, 600, 'heart');                          // floating over the great gap
    addPlat(lv, 7000, 900, 600, { h: 90 });               // the star's own island, far away
    lv.checks.push(new Checkpoint(7100, 900));
    candyRow(lv, 7060, 7280, 840, 3);
    lv.puzzle = new WeatherFactory(lv);
    // goalStar appears only when all four stations are done (machine sets it)
    lv.decor.clouds = []; lv.decor.birds = [];
    for (let i = 0; i < 26; i++) lv.decor.clouds.push({ x: rand(0, lv.w), y: rand(60, 1300), s: rand(0.6, 1.6) });
    for (let i = 0; i < 7; i++) lv.decor.birds.push({ x: rand(0, lv.w), y: rand(100, 500), sp: rand(40, 90) });
  }

  if (n === 'mountain2') { // ---------------- THE FROZEN OBSERVATORY 3-2 (stage two, v1.23.0)
    // A beam-routing climb: three puzzle terraces ascend the summit, each
    // solved by routing a visible light beam into a sensor crystal, each
    // reward opening the way up — ending inside the dome where the grand
    // alignment fixes the telescope. All beam machinery lives on lv.puzzle
    // (FrozenObservatory, js/beams.js). No enemies — thinking, not dodging.
    // Falls always land on the full-width base, so no fall hazard exists.
    lv.w = 3600; lv.h = 2200;
    lv.playerStart = { x: 90, y: 2140 - 94 };
    lv.hints.push({ x: 220, y: 1980, icon: 'space' });
    addGround(lv, 0, 3600, 2140);                          // T1: the summit trail (teach)
    lv.checks.push(new Checkpoint(200, 2140));
    lv.solids.push({ x: 770, y: 1490, w: 100, h: 70, pile: true }); // S1's hanging rock (out of jump reach)
    candyRow(lv, 1000, 1360, 2080, 4);
    addPlat(lv, 2200, 1780, 1200, { h: 80 });              // T2: thaw + route
    lv.checks.push(new Checkpoint(2300, 1780));
    lv.solids.push({ x: 2900, y: 1450, w: 200, h: 210, pile: true }); // rock tunnel (walk-under, blocks the direct line)
    candyRow(lv, 3150, 3350, 1720, 3);
    addPlat(lv, 400, 1420, 1400, { h: 80 });               // T3: the full chain
    lv.checks.push(new Checkpoint(600, 1420));
    pick(lv, 800, 1330, 'heart');
    candyRow(lv, 950, 1250, 1360, 4);
    addPlat(lv, 2000, 1000, 1400, { h: 90 });              // the dome deck
    lv.checks.push(new Checkpoint(2100, 1000));
    // every fire/ice pickup RESPAWNS after use (the boss-pickup respawner):
    // grabbing the wrong element or double-grabbing can never soft-lock a
    // frozen mirror or a steam vent — the puzzle powers always come back
    for (const [px, py, kind] of [
      [2550, 1690, 'fire'],                     // T2, beside the frozen mirror
      [620, 1330, 'fire'], [1150, 1330, 'ice'], // T3, spread apart on purpose
      [2250, 910, 'fire'], [2650, 910, 'ice']   // dome, one per instrument
    ]) {
      const p = new Pickup(px, py, kind);
      p.bossKind = kind;
      lv.pickups.push(p);
    }
    candyArc(lv, 2500, 2900, 850, 930, 4);
    lv.puzzle = new FrozenObservatory(lv);
    // goalStar appears only after the telescope cutscene (machine sets it)
    lv.decor.pines = []; lv.decor.peaks = true;
    for (let x = 120; x < 2000; x += rand(300, 650)) lv.decor.pines.push({ x, s: rand(0.8, 1.4) });
  }

  if (n === 'cloudclimb') { // ---------------- CLOUD CLIMB (vertical mini-game)
    lv.w = 1280; lv.h = 3400;
    lv.playerStart = { x: 90, y: 3240 };
    addPlat(lv, 0, 3340, 1280, { h: 80, solid: true }); // soft cloud floor
    // teach: a ladder of one-way clouds + first bouncy cloud
    addPlat(lv, 140, 3200, 190);
    addPlat(lv, 430, 3080, 190);
    addPlat(lv, 720, 2960, 190);
    addPlat(lv, 430, 2840, 220);
    addPlat(lv, 160, 2720, 500); // wide rest ledge (one-way like every cloud here)
    lv.checks.push(new Checkpoint(340, 2720));
    candyRow(lv, 180, 760, 3160, 4);
    candyArc(lv, 430, 720, 2760, 2920, 4);
    // middle: two bounce flavors, two routes up
    addPlat(lv, 850, 2720, 200); // small cloud holding the SUPER cloud
    addPlat(lv, 880, 2680, 120, { bouncy: true, h: 40, bounceVy: -1500 }); // SUPER (golden glow route)
    addPlat(lv, 180, 2680, 110, { bouncy: true, h: 40 }); // normal bounce route
    addPlat(lv, 90, 2450, 240);   // normal bounce lands here...
    addPlat(lv, 360, 2330, 190);  // ...then ladder up
    addPlat(lv, 630, 2210, 190);
    addPlat(lv, 760, 2050, 260);  // both routes meet here (super lands directly)
    candyArc(lv, 880, 1000, 2100, 2620, 5);
    addPlat(lv, 340, 1950, 520); // rest ledge B
    lv.checks.push(new Checkpoint(520, 1950));
    // route choice: SIDE cloud (arrow) is the way on; SUPER here loops back
    addPlat(lv, 880, 1910, 110, { bouncy: true, h: 40, bounceVy: -1150, bounceVx: -360 }); // side-launcher
    addPlat(lv, 180, 1910, 110, { bouncy: true, h: 40, bounceVy: -1500 }); // tempting super...
    addPlat(lv, 60, 1250, 210);  // ...lands on a candy dead-end (drop back down)
    candyRow(lv, 90, 230, 1200, 3);
    addPlat(lv, 250, 1450, 280); // side-launch target: the route onward
    candyArc(lv, 550, 850, 1450, 1800, 5);
    addPlat(lv, 610, 1330, 190);
    addPlat(lv, 890, 1210, 210);
    addPlat(lv, 460, 1080, 460); // rest ledge C
    lv.checks.push(new Checkpoint(650, 1080));
    // easter egg: a far-off snoozing cloud with candy, off the right edge
    addPlat(lv, 1020, 940, 170);
    addPlat(lv, 1090, 800, 180);
    lv.decor.snoozeCloud = { x: 1180, y: 760 };
    candyRow(lv, 1110, 1240, 750, 3);
    // final: SUPER cloud straight to the summit
    addPlat(lv, 300, 1040, 120, { bouncy: true, h: 40, bounceVy: -1500 });
    addPlat(lv, 150, 380, 820); // the sky summit (one-way: bounce up through!)
    lv.decor.skyCastle = { x: 420, y: 380 };
    lv.goalStar = { x: 850, y: 290 };
    candyRow(lv, 260, 800, 330, 5);
    lv.decor.clouds = []; lv.decor.birds = [];
    for (let i = 0; i < 22; i++) lv.decor.clouds.push({ x: rand(0, lv.w), y: rand(100, lv.h - 200), s: rand(0.6, 1.5) });
    for (let i = 0; i < 4; i++) lv.decor.birds.push({ x: rand(0, lv.w), y: rand(300, 2800), sp: rand(40, 90) });
  }

  if (n === 'ascent') { // ---------------- MOUNTAIN SECRET ASCENT (diagonal)
    lv.w = 3000; lv.h = 2400;
    lv.playerStart = { x: 100, y: 2200 };
    addGround(lv, 0, 3000, 2340);
    // rocky terraces marching up and to the right
    addPlat(lv, 260, 2220, 260, { h: 60, solid: true });
    addPlat(lv, 610, 2100, 260, { h: 60, solid: true });
    addPlat(lv, 960, 1980, 260, { h: 60, solid: true });
    addPlat(lv, 1310, 1860, 260, { h: 60, solid: true });
    addPlat(lv, 1560, 1740, 460, { h: 60, solid: true }); // wide rest terrace
    lv.checks.push(new Checkpoint(1720, 1740));
    candyArc(lv, 300, 1400, 1800, 2200, 6);
    // spring up the cliff face
    addPlat(lv, 1900, 1700, 90, { bouncy: true, h: 40, bounceVy: -1150 });
    addPlat(lv, 1720, 1320, 320); // spring lands here (one-way: bounce up through it)
    // ROUTE CHOICE: left ladder dead-ends at a cosy secret nook (mini dino!),
    // the candy trail marks the true route up-right
    addPlat(lv, 1450, 1200, 180);
    addPlat(lv, 1180, 1080, 180);
    addPlat(lv, 900, 960, 240, { h: 60, solid: true }); // dead-end nook
    lv.decor.dinoPeek = { x: 1000, y: 960 };
    candyRow(lv, 930, 1090, 910, 3);
    addPlat(lv, 2130, 1200, 180); // the true route (candy-marked)
    addPlat(lv, 2400, 1080, 180);
    candyArc(lv, 2100, 2500, 1000, 1240, 5);
    addPlat(lv, 2520, 960, 380, { h: 60, solid: true }); // upper terrace
    lv.checks.push(new Checkpoint(2680, 960));
    // learned mechanic: a cracked wall seals the final stretch
    pick(lv, 2590, 890, 'power');
    addWallBreak(lv, 2860, 960, 3);
    addPlat(lv, 2760, 820, 170); // behind the wall, a ladder climbs up-left
    addPlat(lv, 2500, 700, 180);
    addPlat(lv, 2240, 580, 180);
    addPlat(lv, 1980, 460, 180);
    candyArc(lv, 2000, 2760, 380, 740, 6);
    addPlat(lv, 1150, 340, 900); // the secret summit — the ARRIVAL ledge
    candyRow(lv, 1420, 1880, 290, 5); // breadcrumbs lead LEFT toward the bouncer
    // the summit's own secret: a spring at the left end launches you over a
    // small gap onto the TREASURE TERRACE above — where the hoard actually is
    addPlat(lv, 1170, 300, 100, { bouncy: true, h: 40, bounceVy: -1150 });
    addPlat(lv, 250, 260, 800); // the treasure terrace (one-way: sail up onto it)
    lv.decor.secretChamber = { x: 620, y: 260, rich: true }; // a RIDICULOUS hoard
    lv.goldRush = { x: 1000, y: 400, done: false }; // fanfare on first landing
    // wading through the gold showers real candy into the counter
    candyArc(lv, 350, 600, 140, 220, 7);
    candyRow(lv, 380, 980, 210, 9);
    candyRow(lv, 430, 900, 160, 7);
    pick(lv, 800, 180, 'heart');
    // the star waits at the FAR end of the gold — the party happens in it
    lv.goalStar = { x: 330, y: 160 };
    lv.decor.pines = []; lv.decor.peaks = true;
    for (let x = 120; x < 2900; x += rand(350, 700)) lv.decor.pines.push({ x, s: rand(0.8, 1.3) });
  }

  if (n === 'skyflight') { // ---------------- UNICORN SKY FLIGHT (hold Up to rise)
    lv.w = 1280; lv.h = 4000;
    lv.flight = true;
    lv.playerStart = { x: 580, y: 3800 };
    addPlat(lv, 0, 3920, 1280, { h: 80, solid: true }); // launch cloud
    // teach: open rise with a candy trail and the first star
    candyRow(lv, 560, 720, 3600, 3);
    pick(lv, 640, 3400, 'star');
    // steering: offset cloud bars to weave around
    addPlat(lv, 0, 3050, 520, { h: 60, solid: true });
    addPlat(lv, 720, 2760, 560, { h: 60, solid: true });
    pick(lv, 260, 2900, 'star');
    candyArc(lv, 600, 1100, 2500, 3000, 4);
    // route choice: divider column — LEFT corridor 2 stars (twistier),
    // RIGHT corridor 1 star (open and easy)
    addPlat(lv, 540, 2400, 200, { h: 60, solid: true });
    addPlat(lv, 560, 2100, 180, { h: 60, solid: true });
    addPlat(lv, 540, 1800, 200, { h: 60, solid: true });
    addPlat(lv, 60, 2250, 220, { h: 60, solid: true });   // extra weave on the left
    addPlat(lv, 150, 1950, 220, { h: 60, solid: true });
    pick(lv, 300, 2120, 'star');
    pick(lv, 90, 1850, 'star');
    pick(lv, 1000, 2050, 'star');
    // altitude planning: two bars with openings on opposite sides
    addPlat(lv, 0, 1500, 880, { h: 60, solid: true });    // gap on the RIGHT
    addPlat(lv, 400, 1200, 880, { h: 60, solid: true });  // gap on the LEFT
    candyArc(lv, 950, 1150, 1380, 1560, 3);
    candyArc(lv, 150, 350, 1080, 1260, 3);
    // easter egg: a spider drifting on a balloon, far off the path
    lv.decor.balloonSpider = { x: 100, y: 700 };
    pick(lv, 90, 800, 'star'); // the sixth, secret star
    // final rise to the moon
    pick(lv, 640, 900, 'star');
    candyRow(lv, 540, 740, 620, 3);
    lv.decor.moonBig = { x: 640, y: 280 };
    lv.goalStar = { x: 640, y: 330 };
    lv.decor.clouds = []; lv.decor.birds = []; lv.decor.balloons = [];
    for (let i = 0; i < 20; i++) lv.decor.clouds.push({ x: rand(0, lv.w), y: rand(150, lv.h - 300), s: rand(0.6, 1.4) });
    for (let i = 0; i < 4; i++) lv.decor.birds.push({ x: rand(0, lv.w), y: rand(800, 3400), sp: rand(40, 80) });
    for (let i = 0; i < 6; i++) lv.decor.balloons.push({ x: rand(60, 1220), y: rand(600, 3600), c: randi(0, 3), sp: rand(8, 20) });
  }

  if (n === 'volcanoescape') { // ---------------- SECRET VOLCANO ESCAPE (vertical + rising lava)
    lv.w = 1600; lv.h = 3000;
    lv.playerStart = { x: 100, y: 2800 };
    addGround(lv, 0, 1600, 2940);
    lv.vents = [];
    const vent = (x, y, opt = {}) => {
      const v = { x, y, w: 96, h: 40, oneWay: true, vent: true, ventT: opt.offset || 0, bounceVy: opt.pow || -1400 };
      lv.solids.push(v); lv.vents.push(v);
    };
    // teach: rocky steps up-right to the first rest terrace
    addPlat(lv, 140, 2810, 230);
    addPlat(lv, 470, 2690, 230);
    addPlat(lv, 800, 2570, 230);
    addPlat(lv, 1130, 2450, 400, { h: 60, oneWay: true }); // terrace A (jump up through!)
    lv.checks.push(new Checkpoint(1310, 2450));
    candyArc(lv, 200, 1000, 2540, 2870, 6);
    // the first steam vent: stand on it, wait for the rumble, ride the blast
    vent(1180, 2410, { offset: 1.5 });
    addPlat(lv, 1020, 1830, 360); // wide one-way catch ledge straight above
    pick(lv, 1228, 2240, 'candy'); pick(lv, 1228, 2040, 'candy'); // flight markers
    // climb on up-left
    addPlat(lv, 700, 1710, 220);
    addPlat(lv, 380, 1590, 220);
    addPlat(lv, 80, 1470, 420, { h: 60, oneWay: true }); // terrace B
    lv.checks.push(new Checkpoint(240, 1470));
    candyRow(lv, 760, 860, 1660, 2);
    // ROUTE CHOICE: the vent express (straight up the open throat, right onto
    // terrace C) or the long rock ladder (right, more candy + a heart).
    // Wrong is impossible — they rejoin.
    vent(360, 1430, { offset: 0.6, pow: -1540 });
    addPlat(lv, 60, 850, 300); // bail-out shelf (hop back up through terrace C)
    pick(lv, 408, 1150, 'candy'); pick(lv, 408, 900, 'candy');
    addPlat(lv, 560, 1350, 200);
    addPlat(lv, 860, 1230, 200);
    addPlat(lv, 1160, 1110, 220);
    addPlat(lv, 1340, 980, 240, { h: 60, oneWay: true }); // eastern candy ledge
    candyRow(lv, 1390, 1540, 930, 3);
    pick(lv, 1450, 870, 'heart');
    addPlat(lv, 1080, 900, 200);
    addPlat(lv, 760, 860, 220);
    addPlat(lv, 430, 830, 220);
    candyArc(lv, 620, 1260, 1030, 1300, 5);
    // terrace C, right under the crater throat (one-way like every terrace —
    // the vent express and the ladder route both pop up THROUGH it)
    addPlat(lv, 140, 720, 460, { h: 60, oneWay: true });
    lv.checks.push(new Checkpoint(540, 720));
    // the crater rim: two rock slabs floating high enough that no jump from
    // any platform beneath can reach their undersides — nothing to bonk on.
    // The SUPER vent blasts the hero up the open throat and out of the volcano.
    lv.solids.push({ x: 0, y: 460, w: 260, h: 100, pile: true });
    lv.solids.push({ x: 580, y: 460, w: 1020, h: 100, pile: true });
    vent(400, 680, { pow: -1500, offset: 0.2 });
    lv.goalStar = { x: 1000, y: 370 };
    lv.decor.lavaTreasure = { x: 640, y: 460 }; // the summit candy hoard
    candyRow(lv, 60, 210, 410, 2); // a little gold on the left rim too
    candyRow(lv, 900, 1100, 410, 3);
    // slowly rising lava: pure excitement, zero panic — it pauses whenever it
    // gets close beneath the hero and drops back at every checkpoint
    lv.risingLava = { y: 3090, y0: 3090, speed: 30, minY: 960, lastCp: null };
    lv.decor.rocks = [];
    for (let x = 150; x < 1500; x += rand(300, 550)) lv.decor.rocks.push({ x, s: rand(0.7, 1.3) });
  }

  if (n === 'bubblemaze') { // ---------------- SECRET BUBBLE MAZE (spatial reasoning)
    lv.w = 2600; lv.h = 2000; lv.water = true;
    lv.playerStart = { x: 150, y: 1650 };
    addGround(lv, 0, 2600, 1900);
    // cave shell + chamber walls. Rooms: START (bottom-left), CLAM (bottom-
    // right), STARFISH (top-left), CORAL (top-right), TREASURE (top-middle,
    // entered only through the triple-valve shaft under its floor).
    lv.solids.push({ x: 0, y: 0, w: 2600, h: 140, pile: true }); // roof
    // mid shelf, with the two travel shafts S1 (up) and S2 (down)
    lv.solids.push({ x: 0, y: 1150, w: 350, h: 130, pile: true });
    lv.solids.push({ x: 550, y: 1150, w: 1500, h: 130, pile: true });
    lv.solids.push({ x: 2250, y: 1150, w: 350, h: 130, pile: true });
    // bottom divider between START and CLAM, with a side passage
    lv.solids.push({ x: 1200, y: 1280, w: 130, h: 270, pile: true });
    lv.solids.push({ x: 1200, y: 1750, w: 130, h: 150, pile: true });
    // the treasure box: side walls + floor with the valve shaft gap
    lv.solids.push({ x: 900, y: 140, w: 130, h: 560, pile: true });
    lv.solids.push({ x: 1570, y: 140, w: 130, h: 560, pile: true });
    lv.solids.push({ x: 1030, y: 700, w: 200, h: 130, pile: true });
    lv.solids.push({ x: 1370, y: 700, w: 200, h: 130, pile: true });
    // three bubble valves seal the shaft — each pops from its shell switch
    for (const [vy, kind] of [[702, 'ice'], [748, 'fire'], [794, 'rainbow']]) {
      lv.solids.push({ x: 1230, y: vy, w: 140, h: 26, valve: true, kind });
    }
    // bubble currents: strong directional assistance, steering stays free
    lv.currents = [
      { x: 350, y: 1020, w: 200, h: 480, dir: 'up' },    // S1: START -> STARFISH
      { x: 2050, y: 1020, w: 200, h: 480, dir: 'down' }, // S2: CORAL -> CLAM
      // mid-corridor conveyor, split around the treasure shaft so a calm
      // pocket sits right beneath it (the shaft current takes over there)
      { x: 950, y: 880, w: 240, h: 140, dir: 'right' },
      { x: 1410, y: 880, w: 240, h: 140, dir: 'right' },
      { x: 1230, y: 420, w: 140, h: 580, dir: 'up' }     // the treasure shaft
    ];
    // three shell switches, color-matched to the valves, one per chamber
    lv.shellSwitches = [
      { x: 150, y: 1150 - 54, w: 88, h: 54, kind: 'ice', on: false },     // starfish room
      { x: 2320, y: 1900 - 54, w: 88, h: 54, kind: 'fire', on: false },   // clam room
      { x: 2320, y: 1150 - 54, w: 88, h: 54, kind: 'rainbow', on: false } // coral room
    ];
    // strong landmarks so nobody gets lost
    lv.decor.bigStarfish = { x: 430, y: 1150 };
    lv.decor.bigClam = { x: 1800, y: 1900 };
    lv.decor.coralGarden = { x: 1860, y: 1150 };
    lv.decor.pearlShrine = { x: 1460, y: 700 }; // beside the shaft, not over it
    lv.goalStar = { x: 1300, y: 420 };
    // candy trails sketch the loop; a heart hides in the clam room
    candyRow(lv, 220, 420, 1780, 3);
    pick(lv, 450, 1420, 'candy'); pick(lv, 450, 1240, 'candy'); pick(lv, 450, 1040, 'candy');
    candyRow(lv, 620, 840, 1080, 3);
    candyRow(lv, 1050, 1550, 960, 4);
    pick(lv, 2150, 1300, 'candy'); pick(lv, 2150, 1480, 'candy');
    candyRow(lv, 1500, 1900, 1820, 4);
    pick(lv, 2470, 1750, 'heart');
    candyRow(lv, 2280, 2500, 1080, 3);
    lv.checks.push(new Checkpoint(450, 1900));
    lv.decor.weeds = []; lv.decor.fish = [];
    for (let x = 60; x < 2560; x += rand(160, 320)) lv.decor.weeds.push({ x, h: rand(50, 120), seed: rand(9) });
    for (let i = 0; i < 8; i++) lv.decor.fish.push({ x: rand(100, 2500), y: rand(300, 1700), s: rand(0.6, 1.1), sp: rand(25, 60) * (chance(0.5) ? 1 : -1), c: randi(0, 3) });
  }

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

  if (n === 'endingblocks') { // ---------------- ENDING BLOCKS (Ending Letters)
    // The Cloud World sibling of the meadow's LETTER BLOCKS room — same
    // single-screen learning-garden layout, same continuous replay with an
    // always-open EXIT door, but the blank moves to the END of the word.
    lv.w = 1280; lv.h = 720;
    lv.playerStart = { x: 90, y: G - 94 };
    addGround(lv, 0, 1280, G);
    lv.puzzle = new EndingLetterBlocksMachine(G);
    for (const s of lv.puzzle.solids) lv.solids.push(s);
    lv.exitDoors.push(new ExitDoor(1150, G));
    lv.checks.push(new Checkpoint(120, G));
    lv.decor.clouds = [];
    for (let i = 0; i < 8; i++) lv.decor.clouds.push({ x: rand(0, lv.w), y: rand(60, 400), s: rand(0.6, 1.4) });
  }

  if (n === 'jungle2') { // ---------------- THE GREAT DINOSAUR RESCUE (Dino Jungle stage 1, v1.28.0)
    // The pod crash opens a storm-damaged jungle: crash site, the nursery hub
    // with a pit to the echo caves, the muddy river trail, the fruit grove,
    // the broken canopy climb, the volcanic clearing, the landslide barrier,
    // the reunion, and the T-rex victory run (js/rescue.js: DinoRescue on
    // lv.puzzle + DinoRun on lv.ride). Solids carry `plate` kinds the machine
    // paints; nothing draws through the classic jungle decor (fixed to 620).
    const GJ = DR.G, C = DR.C;
    lv.w = DR.W; lv.h = DR.H;
    lv.playerStart = { x: 420, y: GJ - 94 };
    const plate = (x, y, w, h, kind, extra) => { const s = Object.assign({ x, y, w, h, skipDraw: true, plate: kind }, extra || {}); lv.solids.push(s); return s; };
    // ---- the ground, with the cave pit (1440-1560) and the cave exit hole (4250-4400) ----
    plate(0, GJ, 1440, 100, 'mud'); plate(1560, GJ, 2690, 100, 'grass'); plate(4400, GJ, 8000, 100, 'grass'); // runs on under the reunion to the T-rex
    plate(2900, GJ - 24, 320, 30, 'mud', { oneWay: true }); // the washed-out ford's mud bank
    // ---- the echo caves: corridor at C with a ceiling, upper lanes, dead ends ----
    plate(900, C, 3500, 220, 'cave');
    plate(900, GJ + 100, 540, 60, 'cave'); plate(1560, GJ + 100, 2690, 60, 'cave'); // cave roof right under the deck, open at the pit and past 4250
    plate(1800, C - 200, 500, 30, 'cave', { oneWay: true });    // fork 1 upper lane (true): leads on
    plate(2300, C - 260, 60, 60, 'cave');                        // upper lane step down (one-way ledge to the floor)
    plate(2440, C - 120, 140, 20, 'cave', { oneWay: true });
    plate(2500, C - 200, 60, 200, 'cave');                        // fork 1 lower lane dead end wall (bat + candy behind... in front)
    plate(2700, C - 200, 420, 30, 'cave', { oneWay: true });    // fork 2 upper lane (dead end)
    plate(3100, GJ + 160, 60, 140, 'cave');                       // its back wall (hangs from the roof)
    plate(3450, C - 200, 420, 30, 'cave', { oneWay: true });    // fork 3 upper lane (true)
    plate(3500, C - 200, 60, 200, 'cave');                        // fork 3 lower lane dead end wall
    plate(3880, C - 260, 60, 60, 'cave');                        // step down into the chamber
    plate(4180, C - 120, 120, 20, 'cave', { oneWay: true }); plate(4280, C - 240, 120, 20, 'cave', { oneWay: true }); // the exit climb
    plate(4180, C - 360, 120, 20, 'cave', { oneWay: true }); plate(4280, GJ, 120, 20, 'cave', { oneWay: true });
    candyRow(lv, 2380, 2480, C - 60, 2); candyRow(lv, 2760, 3040, C - 250, 3); candyRow(lv, 3560, 3760, C - 60, 3);
    // ---- the river trail + the grove ----
    plate(5450, GJ - 160, 300, 30, 'leaf', { oneWay: true }); // the longneck's ledge
    plate(5380, GJ - 80, 70, 30, 'leaf', { oneWay: true });
    candyRow(lv, 2400, 2800, GJ - 60, 4); candyArc(lv, 3300, 3700, GJ - 250, GJ - 70, 4); candyRow(lv, 4550, 5000, GJ - 60, 4);
    // ---- the broken canopy: leaves, mushrooms, vines, the bud, the ptero's branch ----
    plate(5900, GJ - 150, 160, 24, 'leaf', { oneWay: true }); plate(6150, GJ - 320, 160, 24, 'leaf', { oneWay: true });
    plate(6300, GJ - 40, 90, 40, 'grass', { bouncy: true, bounceVy: -1150 }); // mushroom up to the leaf at -480
    plate(6420, GJ - 480, 170, 24, 'leaf', { oneWay: true }); plate(6650, GJ - 620, 150, 24, 'branch', { oneWay: true });
    plate(7000, GJ - 700, 200, 30, 'branch', { oneWay: true }); plate(7250, GJ - 850, 160, 24, 'leaf', { oneWay: true });
    plate(7050, GJ - 900, 140, 24, 'leaf', { oneWay: true });   // the valve's leaf
    plate(7400, GJ - 950, 260, 30, 'branch', { oneWay: true }); // the bud's branch
    plate(7850, GJ - 1250, 420, 30, 'branch', { oneWay: true }); // the ptero's broken branch
    plate(DR.PAD_X - 50, GJ - 1250 - 30, 100, 30, 'leaf', { bouncy: true, bounceVy: -1300, pad: true }); // the launch pad (super)
    plate(8350, GJ - 700, 150, 24, 'leaf', { oneWay: true }); plate(8300, GJ - 350, 150, 24, 'leaf', { oneWay: true }); // the way down
    lv.vines = [new Vine(6700, GJ - 1000, 300, { phase: 0 })];
    candyArc(lv, 5950, 6450, GJ - 700, GJ - 200, 5); candyRow(lv, 7030, 7150, GJ - 760, 2); candyArc(lv, 7880, 8250, GJ - 1420, GJ - 1290, 4);
    // ---- the volcanic clearing ----
    plate(8900, GJ - 130, 140, 30, 'rock', { oneWay: true }); plate(9040, GJ - 260, 200, 30, 'rock', { oneWay: true }); // up to the valve
    candyRow(lv, 8500, 8800, GJ - 60, 3); candyRow(lv, 10300, 10700, GJ - 60, 4);
    // ---- the run's approach ----
    candyRow(lv, DR.BARRIER + 800, DR.BARRIER + 1000, GJ - 60, 3);
    for (const [x, y] of [[2200, GJ - 80], [6000, GJ - 80], [8600, GJ - 80]]) { const p = new Pickup(x, y, 'fire'); p.bossKind = 'fire'; lv.pickups.push(p); }
    pick(lv, 7100, GJ - 990, 'heart'); pick(lv, 3000, C - 70, 'heart');
    for (const [x, y] of [[420, GJ], [1300, GJ], [2200, GJ], [4450, GJ], [5900, GJ], [7420, GJ - 950], [8500, GJ], [10900, GJ], [3900, C], [1650, C]]) lv.checks.push(new Checkpoint(x, y));
    lv.puzzle = new DinoRescue(lv);
    for (const s of lv.puzzle.solids) lv.solids.push(s);
    lv.ride = new DinoRun(GJ, DR.RUN_START);
    // a few vine spiders far from every puzzle (the jungle's own enemy)
    spider(lv, 3050, GJ, 'hang', { webTop: GJ - 300 });
    spider(lv, 6250, GJ, 'walk', { range: 100 });
    spider(lv, 10450, GJ, 'walk', { range: 120 });
  }

  if (n === 'space2') { // ---------------- THE ALIEN SPACE STATION 8-2 (v1.27.0)
    // Pitch-dark hallway (act 1) -> webbed interior with the battery kit
    // (act 2) -> bright machine rooms (act 3) -> the giant spider arena ->
    // the escape pod into Dino Jungle. Everything lives on AlienStation
    // (js/station.js); the level adopts its solids and draws none itself
    // (station: true solids are painted by the machine as deck plates).
    const GS = ST.G, U = ST.U, A = ST.A;
    lv.w = ST.W; lv.h = ST.H; lv.dark = true; lv.darkAlpha = 0.97; lv.playerLight = 150;
    lv.playerStart = { x: 110, y: GS - 94 };
    const floor = (x, w, top) => { const s = { x, y: top, w, h: 60, station: true, skipDraw: true }; lv.solids.push(s); return s; };
    const ceil = (x, w, bottom) => { const s = { x, y: bottom - 40, w, h: 40, station: true, ceil: true, skipDraw: true }; lv.solids.push(s); return s; };
    // ---- act 1: the black hallway (floor steps, a bend, alcoves, ceiling gaps) ----
    floor(0, 1500, GS); floor(1500, 100, GS - 48); floor(1600, 100, GS - 96); floor(1700, 900, GS - 150);
    floor(2600, 1600, GS); floor(4200, 3500, GS);
    ceil(0, 900, GS - 300); ceil(1100, 1300, GS - 300); ceil(2400, 100, GS - 450); ceil(2700, 500, GS - 300); ceil(3400, 800, GS - 300);
    // alcove ledges under the ceiling gaps (candy nooks) + the dead end
    addPlat(lv, 930, GS - 130, 140, { oneWay: true }); Object.assign(lv.solids[lv.solids.length - 1], { station: true, skipDraw: true }); candyRow(lv, 950, 1050, GS - 190, 2);
    addPlat(lv, 3230, GS - 120, 150, { oneWay: true }); Object.assign(lv.solids[lv.solids.length - 1], { station: true, skipDraw: true }); candyRow(lv, 3240, 3360, GS - 180, 3);
    lv.solids.push({ x: 3380, y: GS - 300, w: 20, h: 180, station: true, skipDraw: true }); // the dead end's back wall
    candyRow(lv, 400, 700, GS - 60, 3); candyRow(lv, 1800, 2200, GS - 210, 4); candyRow(lv, 2800, 3100, GS - 60, 3);
    lv.hints.push({ x: 260, y: GS - 190, icon: 'arrows' });
    // fire power, everywhere, forever (bossKind = the respawning pickup rule)
    for (const [px, py] of [[160, GS - 80], [1400, GS - 80], [2800, GS - 80], [3800, GS - 80], [5200, GS - 80], [6600, U - 80], [8000, U - 80], [9300, A - 80], [9950, A - 80]]) {
      const p = new Pickup(px, py, 'fire'); p.bossKind = 'fire'; lv.pickups.push(p);
    }
    lv.checks.push(new Checkpoint(140, GS)); lv.checks.push(new Checkpoint(2650, GS)); lv.checks.push(new Checkpoint(4300, GS));
    // ---- act 2: lower deck to the elevator, the upper deck ----
    lv.solids.push({ x: 7680, y: GS - 320, w: 40, h: 320, station: true, skipDraw: true }); // lower deck ends
    floor(5300, 100, U); floor(5580, 3120, U); // upper deck (the elevator shaft gap at 5400-5580)
    lv.solids.push({ x: 5280, y: U - 520, w: 20, h: 300, station: true, skipDraw: true }); // upper deck back wall
    candyRow(lv, 4400, 4700, GS - 60, 3); candyArc(lv, 5050, 5300, GS - 260, GS - 70, 4);
    candyRow(lv, 5650, 5900, U - 60, 3); candyRow(lv, 6500, 6750, U - 60, 3); candyRow(lv, 7000, 7300, U - 60, 3);
    pick(lv, 6650, U - 70, 'heart');
    lv.checks.push(new Checkpoint(5150, GS)); lv.checks.push(new Checkpoint(5700, U)); lv.checks.push(new Checkpoint(7550, U));
    // ---- act 3: the gravity room, the ledge, the bridge gap, the arena, the bay ----
    floor(8500, 650, A).oneWay = true; // the exit ledge (420 above the deck: only a low-gravity float reaches it; one-way so the float rises THROUGH it)
    lv.solids.push({ x: 8700, y: A + 60, w: 20, h: U - A - 60, station: true, skipDraw: true }); // under-ledge wall: a float drifts up it and over
    candyArc(lv, 7950, 8350, U - 380, U - 80, 5); candyRow(lv, 8550, 8750, A - 60, 3);
    floor(9150, 1450, A); floor(ST.BAY + 30, 800, A); // arena + bay
    lv.solids.push({ x: 11400, y: A - 600, w: 40, h: 600, station: true, skipDraw: true }); // the end of the station
    candyRow(lv, 9300, 9500, A - 60, 3); candyRow(lv, 10700, 11000, A - 60, 4);
    lv.checks.push(new Checkpoint(8560, A)); lv.checks.push(new Checkpoint(9270, A)); lv.checks.push(new Checkpoint(10700, A));
    lv.puzzle = new AlienStation(lv);
    for (const s of lv.puzzle.solids) lv.solids.push(s);
    lv.puzzle.spawnEnemies(lv);
    lv.decor.stars = []; for (let i = 0; i < 60; i++) lv.decor.stars.push({ x: rand(0, lv.w), y: rand(0, lv.h), s: rand(1, 3) });
  }

  if (n === 'surf') { // ---------------- OCEAN SURF (the surfboard ride, v1.26.0)
    // A short beach on foot, the board waiting at the waterline, then the
    // procedural surf (js/surf.js on lv.ride): sharks, waves, red ramps,
    // chests, the monster-truck pirate boat, the Kraken, the island.
    lv.w = 60000; lv.h = 720; lv.skyCam = true; // virtual width; the camera may follow the launch into the sky
    lv.playerStart = { x: 90, y: G - 94 };
    addGround(lv, 0, SURF.START, G); // the beach (normal physics)
    lv.solids[lv.solids.length - 1].skipDraw = true; // the ride paints the sand itself
    lv.solids.push({ x: SURF.START - 20, y: 0, w: 20, h: 720, surfWall: true, skipDraw: true }); // until the board is claimed
    lv.hints.push({ x: 240, y: G - 190, icon: 'arrows' });
    lv.ride = new OceanSurf(G, SURF.START);
    lv.checks.push(new Checkpoint(140, G));
    lv.decor.clouds = [];
    for (let i = 0; i < 40; i++) lv.decor.clouds.push({ x: rand(0, 16000), y: rand(40, 260), s: rand(0.7, 1.6) });
  }

  if (n === 'flowerland') { // ---------------- RAINBOW SPIDER FLOWER LAND (Jack's level, v1.25.0)
    // One continuous storybook: ground floor G=1400 for the flower place,
    // spider home, flower person and flight field up to the castle; the giant
    // one-way CLOUD at y=600 for the ship, the robot race and the party.
    // Every story piece lives on the FlowerLand machine (js/flowerland.js);
    // the level adopts its solids. No enemies anywhere.
    const GF = FL.G, C = FL.CLOUD;
    lv.w = FL.W; lv.h = FL.H;
    lv.playerStart = { x: 110, y: GF - 94 };
    addGround(lv, 0, lv.w, GF);
    lv.hints.push({ x: 300, y: GF - 190, icon: 'arrows' });
    // ---- zone 1: flower place — the first mushroom sits on a low perch ----
    addPlat(lv, 600, GF - 150, 170);
    candyRow(lv, 260, 520, GF - 55, 3);
    candyArc(lv, 900, 1300, GF - 260, GF - 70, 5);
    lv.checks.push(new Checkpoint(300, GF));
    candyRow(lv, 2000, 2400, GF - 55, 4);
    lv.checks.push(new Checkpoint(2300, GF));
    // ---- zone 2: the spider home — perches for mushrooms #2 and #3 ----
    addPlat(lv, 2880, GF - 130, 160);
    lv.checks.push(new Checkpoint(2800, GF));
    addPlat(lv, 3420, GF - 150, 160);
    candyRow(lv, 2500, 2650, GF - 55, 2);
    // ---- zone 3/4: the flower person, then the flight field ----
    lv.checks.push(new Checkpoint(4100, GF));
    candyArc(lv, 4700, 5100, GF - 760, GF - 400, 6);   // sketches the flight line
    candyArc(lv, 5250, 5700, GF - 900, GF - 500, 6);
    candyArc(lv, 5850, 6200, GF - 820, GF - 300, 6);
    for (const [x, y] of [[4900, GF - 640], [5450, GF - 860], [6000, GF - 760]]) pick(lv, x, y, 'star');
    // ---- zone 5: the castle + dragon ----
    lv.checks.push(new Checkpoint(6320, GF));
    candyRow(lv, 6350, 6650, GF - 55, 4);
    pick(lv, 6550, GF - 80, 'heart');
    // ---- zone 6: the cloud — ship, race, party ----
    lv.checks.push(new Checkpoint(7300, C)); // past the ship's stern
    candyRow(lv, 7500, 8800, C - 60, 8);
    lv.checks.push(new Checkpoint(8960, C));
    lv.goalStar = { x: FL.STAR.x, y: FL.STAR.y };
    lv.puzzle = new FlowerLand(lv);
    for (const s of lv.puzzle.solids) lv.solids.push(s);
    lv.decor.flowers = []; lv.decor.trees = []; lv.decor.clouds = [];
    for (let x = 60; x < 6200; x += rand(70, 160)) lv.decor.flowers.push({ x, y: GF, c: randi(0, 4), s: rand(0.9, 1.5) });
    for (let i = 0; i < 26; i++) lv.decor.clouds.push({ x: rand(0, lv.w), y: rand(60, 420), s: rand(0.7, 1.6) });
  }

  if (n === 'countblocks') { // ---------------- COUNTING BLOCKS (Count the Objects)
    // The Mountain World learning room and the first QUANTITY BLOCKS mode:
    // same single-screen garden as the letter rooms (three bonkable number
    // blocks, candy per solve, continuous replay, always-open EXIT door) with
    // a group of objects to count up top and a "?" slot for the numeral.
    lv.w = 1280; lv.h = 720;
    lv.playerStart = { x: 90, y: G - 94 };
    addGround(lv, 0, 1280, G);
    lv.puzzle = new CountBlocksMachine(G);
    for (const s of lv.puzzle.solids) lv.solids.push(s);
    lv.exitDoors.push(new ExitDoor(1150, G));
    lv.checks.push(new Checkpoint(120, G));
    lv.decor.pines = [{ x: 40, s: 1.1 }, { x: 1240, s: 0.9 }]; lv.decor.peaks = true;
  }

  if (n === 'piperoom') { // ---------------- SECRET PIPE ROOM (cause & effect)
    // One single non-scrolling screen so the whole machine is observable at
    // once: hoppers up top, eater machines below, mis-aimed chutes between.
    // Everything happens on the flat floor — this is a puzzle room, not a
    // platforming challenge. The machine itself is lv.puzzle (PipeWorks).
    lv.w = 1280; lv.h = 720;
    lv.playerStart = { x: 70, y: 460 };
    addGround(lv, 0, 1280, G);
    lv.puzzle = new PipeWorks(G);
    lv.checks.push(new Checkpoint(120, G)); // heart refill on the way in
    lv.decor.stals = [];
    for (let x = 40; x < 1280; x += rand(150, 280)) lv.decor.stals.push({ x, h: rand(30, 80), w: rand(22, 40) });
    lv.decor.crystals = [{ x: 90, y: G - 30, s: 1.1, c: 0 }, { x: 1190, y: G - 30, s: 1.3, c: 1 }];
  }

  if (n === 'torchcave') { // ---------------- TORCH CAVERN (observation & matching)
    lv.w = 1920; lv.h = 720; lv.dark = true;
    lv.playerStart = { x: 70, y: 460 };
    addGround(lv, 0, 1920, G);
    // two one-way ledges climb toward the higher torches; every step stays
    // under the 148px jump rise (620 -> 490 -> 355)
    addPlat(lv, 960, 490, 220, { oneWay: true });
    addPlat(lv, 1250, 355, 220, { oneWay: true });
    lv.puzzle = new TorchCavern(G);
    lv.solids.push(lv.puzzle.doorSolid); // the sealed stone door
    lv.checks.push(new Checkpoint(140, G));
    pick(lv, 250, G - 84, 'fire'); // torches also light from a fireball — learned in this very cave
    lv.decor.stals = []; lv.decor.crystals = [];
    for (let x = 60; x < 1920; x += rand(140, 260)) lv.decor.stals.push({ x, h: rand(40, 110), w: rand(24, 46) });
    lv.decor.crystals.push({ x: 200, y: G - 30, s: 1, c: 0 }); // one glow near the entrance
  }

  if (n === 'treehouse') { // ---------------- JUNGLE TREEHOUSE TRAIL (a mini-adventure)
    // The biggest secret so far — two jungles in one. Region A (floor y=2540):
    // the jungle floor, a climbing treehouse cluster, and the sad monkey's
    // clearing with the whole banana machine. Region B (floor y=1500): the
    // sunlit upper canopy, reachable ONLY by monkey airline across the
    // waterfall gorge that splits the world. A giant leaf trampoline spans the
    // gorge bottom, so falling in is a bounce and a giggle — and its launch
    // apex (bounceVy² / 3200 = 760 px above y 2560) can reach region A's rim
    // but never region B's higher floor: the gorge stays uncrossable until
    // the monkey is a friend. No enemies anywhere: the whole trail is
    // exploration, machines, and friends.
    const GF = 2540, GB = 1500;
    lv.w = 4600; lv.h = 2620;
    lv.playerStart = { x: 110, y: GF - 140 };
    addGround(lv, 0, 2350, GF);            // region A: the jungle floor
    addGround(lv, 3150, 1450, GB);         // region B: the highland canopy
    lv.solids.push({ x: 2350, y: 2560, w: 800, h: 60, bouncy: true, bounceVy: -1560, net: true });
    // ---- region A: intro + the treehouse cluster ----
    lv.hints.push({ x: 260, y: GF - 190, icon: 'arrows' });
    lv.hints.push({ x: 410, y: GF - 310, icon: 'up' }); // jump — into the vine!
    addPlat(lv, 700, GF - 40, 90, { bouncy: true, h: 40, bounceVy: -1150 }); // booster mushroom
    addPlat(lv, 620, 2160, 200);
    addPlat(lv, 950, 2300, 170);
    addPlat(lv, 900, 2020, 170);
    addPlat(lv, 1090, 1900, 260, { plank: true }); // rope bridge between trunks
    addPlat(lv, 1370, 1800, 220);                  // treehouse A porch
    addPlat(lv, 1650, 1860, 170);                  // the bathtub room ledge
    // ---- region A: the monkey clearing (machine lives in lv.puzzle) ----
    addPlat(lv, 1660, GF - 260, 200);              // lever-house porch
    addPlat(lv, 1965, GF - 40, 90, { bouncy: true, h: 40, bounceVy: -1150 }); // bounce flower under the toucan
    lv.puzzle = new TreehouseTrail(GF, GB);
    for (const r of lv.puzzle.rungs) lv.solids.push(r); // ladder rungs, hidden until the plate
    // ---- region B: the upper canopy ----
    addPlat(lv, 3430, 1360, 190);                  // first highland ledge
    addPlat(lv, 3200, GB - 40, 90, { bouncy: true, h: 40, bounceVy: -1300 }); // GOLD flower straight up to the disco
    addPlat(lv, 3150, 1140, 180);                  // the Monkey Disco ledge
    addPlat(lv, 3750, 1340, 300);                  // vine-route catch ledge (wide, below the swing)
    addPlat(lv, 4080, 1210, 160);                  // hop up toward vine 2
    addPlat(lv, 4420, 1360, 180);                  // ladder route (vine-free alternative)
    addPlat(lv, 4280, 1250, 260, { plank: true }); // mid-tier bridge — both routes meet here
    addPlat(lv, 3760, 760, 380, { plank: true });  // the Grand Treehouse balcony
    // ---- vines (deterministic phases so swings are learnable AND testable) ----
    lv.vines = [
      new Vine(500, 2140, 270, { phase: 0 }),      // the teacher, over flat safe ground
      new Vine(1560, 1490, 250, { phase: 0.9 }),   // treehouse-cluster joyride
      new Vine(3650, 1000, 250, { phase: 1.8 }),   // canopy crossing 1
      new Vine(4270, 880, 240, { phase: 2.6 })     // canopy crossing 2
    ];
    // ---- candy + rewards ----
    candyRow(lv, 260, 620, GF - 55, 4);
    candyArc(lv, 640, 900, 2240, GF - 70, 4);      // traces the mushroom launch
    candyRow(lv, 1100, 1330, 1850, 3);             // along the rope bridge
    candyArc(lv, 1400, 1620, 1700, 1810, 3);
    pick(lv, 1730, 1800, 'heart');                 // bathtub room reward
    candyRow(lv, 1500, 2170, GF - 55, 5);          // the clearing floor
    // candy floating along the great-throw arc — collected mid-WHEEE
    pick(lv, 2650, 1598, 'candy'); pick(lv, 2805, 1377, 'candy');
    pick(lv, 2956, 1258, 'candy'); pick(lv, 3106, 1245, 'candy');
    candyRow(lv, 3420, 3720, GB - 55, 3);
    candyArc(lv, 3520, 4000, 1160, 1320, 4);       // sketches the vine route
    pick(lv, 4500, 1310, 'heart');                 // ladder-route reward
    candyRow(lv, 4310, 4510, 1200, 3);             // along the mid-tier bridge
    candyRow(lv, 3800, 4100, 710, 4);              // the balcony
    lv.checks.push(new Checkpoint(1560, GF));
    lv.checks.push(new Checkpoint(3400, GB));
    // ---- scenery ----
    lv.decor.trailTrunks = [
      { x: 872, top: 2040, base: GF, w: 56 },
      { x: 1420, top: 1690, base: GF, w: 72 },
      { x: 3560, top: 1040, base: GB, w: 60 },
      { x: 4140, top: 640, base: GB, w: 88 },      // the grand tree under the balcony
      { x: 4480, top: 1120, base: GB, w: 52 }
    ];
    lv.decor.sloth = { x: 1432, y: 2200 };
    lv.decor.tubSpider = { x: 1735, y: 1860 };
    lv.decor.gorgeFalls = { x: 3150, top: GB, bottom: 2620 };
    lv.decor.monkeySign = { x: 3300, y: GB };
    lv.decor.frogs = [{ x: 350, g: GF }, { x: 1180, g: GF }, { x: 2180, g: GF }, { x: 3740, g: GB }];
    lv.decor.floorFerns = [];
    for (let x = 80; x < 2320; x += rand(150, 290)) lv.decor.floorFerns.push({ x, g: GF, s: rand(0.8, 1.4), c: randi(0, 3) });
    for (let x = 3180; x < 4560; x += rand(150, 290)) lv.decor.floorFerns.push({ x, g: GB, s: rand(0.8, 1.4), c: randi(0, 3) });
  }

  if (n === 'beatbash') { // ---------------- PIT STOP BEAT BASH (rhythm!)
    // One single non-scrolling screen: the whole garage band is observable at
    // once and the shrinking beat ring is always in view. Flat floor, zero
    // enemies, zero hazards — this room is a different GENRE, not a level.
    // The entire show lives in lv.puzzle (BeatBash): count-in, beats, band
    // build-up, monster-truck finale, golden star.
    lv.w = 1280; lv.h = 720;
    lv.playerStart = { x: 70, y: 460 };
    addGround(lv, 0, 1280, G);
    lv.puzzle = new BeatBash(G);
  }

  if (n === 'zombietown') { // ---------------- ZOMBIE TOWN AFTER DARK (a town to save)
    // Jack's own idea: Zombieland + the night sky + PEOPLE. A compact
    // explorable town under a huge moon: four townspeople each have one small
    // visual problem (a granny stuck on a roof, a lost balloon, a "scary"
    // tiny zombie, a broken festival cart), each solved with a different verb
    // (bounce-rescue / knock-loose-and-carry / give candy with ★ / roll the
    // wheel home). Every rescue walks someone to the town square and turns
    // more of the town on; all four gathered = ring the clock tower at
    // midnight for the ZOMBIE FESTIVAL. The whole cast, town, sky, and
    // festival live in lv.puzzle (ZombieTown); its skipDraw solids (roof,
    // haystack, crates) are pushed into lv.solids here. No enemies, no
    // hazards — wrong guesses are jokes.
    lv.w = 3000; lv.h = 720;
    lv.playerStart = { x: 80, y: 460 };
    addGround(lv, 0, 3000, G);
    lv.puzzle = new ZombieTown(G);
    for (const s of lv.puzzle.solids) lv.solids.push(s);
    lv.hints.push({ x: 320, y: G - 260, icon: 'arrows' });
    // candy placement is part of the puzzle spread: none near the hungry
    // zombie's alley (the nearest is back in the square), a rooftop row that
    // sketches the walk back to granny, and an arc tracing the haystack launch
    candyRow(lv, 1560, 2060, G - 55, 4);
    candyRow(lv, 760, 940, 430, 3);
    candyArc(lv, 990, 1120, 330, 540, 4);
  }

  if (n === 'zerog') { // ---------------- ZERO-G STAR CHAMBER (spatial planning)
    lv.w = 2600; lv.h = 1560;
    lv.water = true; lv.space = true; // weightless swim, same as the maze
    lv.playerStart = { x: 170, y: 720 };
    // chamber shell
    lv.solids.push({ x: 0, y: 0, w: 2600, h: 90, pile: true });
    lv.solids.push({ x: 0, y: 1470, w: 2600, h: 90, pile: true });
    lv.solids.push({ x: 0, y: 0, w: 70, h: 1560, pile: true });
    lv.solids.push({ x: 2530, y: 0, w: 70, h: 1560, pile: true });
    // STAR 2's asteroid pocket (top right): a C-shaped nest, open on the left
    lv.solids.push({ x: 1980, y: 190, w: 480, h: 70, pile: true });   // pocket roof
    lv.solids.push({ x: 1980, y: 450, w: 480, h: 70, pile: true });   // pocket floor
    lv.solids.push({ x: 2390, y: 260, w: 70, h: 190, pile: true });   // sealed far side
    // STAR 3's solar-wind curtain (bottom left): an up-blowing stream between
    // the middle of the room and the star's nook — crossing it is a playful
    // deflection, never a wall (push 1300 < swim thrust 1400)
    lv.currents = [{ x: 700, y: 950, w: 190, h: 520, dir: 'up' }];
    // STAR 4's energy gate (top left pocket)
    lv.solids.push({ x: 90, y: 190, w: 420, h: 60, pile: true });     // pocket roof lip
    lv.solids.push({ x: 90, y: 470, w: 420, h: 60, pile: true });     // pocket floor lip
    const zGate = { x: 510, y: 190, w: 46, h: 340, gate: 'energy', kind: 'ice' };
    lv.solids.push(zGate);
    lv.puzzle = new StarChamber(1300, 800, zGate);
    // the rainbow block for the silly alien (STAR 5) floats near it
    pick(lv, 1900, 1250, 'rainbow');
    // candy sprinkles trace the room's corners
    candyRow(lv, 500, 700, 500, 3);
    candyRow(lv, 1600, 1800, 950, 3);
    pick(lv, 350, 1050, 'candy'); pick(lv, 2250, 800, 'candy');
    lv.checks.push(new Checkpoint(240, 1470));
    lv.hints.push({ x: 320, y: 560, icon: 'updown' });
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
  if (th === 'meadow' || th === 'cloud' || th === 'ocean') {
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
  } else if (th === 'ocean') {
    drawBGClouds(ctx, lv, cam, t, 0.4); // open sky over the surf (Ocean Surf paints its own sea)
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
    // (world 10 only — the Treehouse Trail shares the jungle theme but draws
    // its own gorge waterfall in world space)
    const wx = lv.n === 10 ? 4620 - cam.x : -9999;
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
    const rx3 = lv.n === 10 ? 5150 - cam.x * 0.9 : -9999;
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
    if (s.vent) { // steam vent: idle rock nozzle -> bubbling warning -> blast
      const ph = s.ventT || 0;
      const erupt = ph >= 2.4, warn = ph >= 1.7 && !erupt;
      const mx = s.x + s.w / 2;
      if (erupt) { // the blast column
        const k = (ph - 2.4) / 0.8;
        const hgt = 360 * Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5);
        for (let i = 0; i < 7; i++) {
          const yy = s.y - 6 - (i / 6) * hgt;
          ctx.save();
          ctx.globalAlpha = 0.85 - i * 0.09;
          ctx.fillStyle = ['#ffe156', '#ff9f43', '#fff'][i % 3];
          ctx.beginPath();
          ctx.arc(mx + Math.sin(t * 18 + i * 1.7) * (4 + i * 2), yy, 16 + i * 2.5, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      }
      // the nozzle: a squat volcanic mound with a glowing mouth
      const wob = warn ? Math.sin(t * 26) * 2 : 0;
      ctx.fillStyle = '#2e1620';
      ctx.beginPath();
      ctx.moveTo(s.x - 8, s.y + s.h);
      ctx.quadraticCurveTo(s.x + 4 + wob, s.y + 4, s.x + 22, s.y + 2);
      ctx.lineTo(s.x + s.w - 22, s.y + 2);
      ctx.quadraticCurveTo(s.x + s.w - 4 - wob, s.y + 4, s.x + s.w + 8, s.y + s.h);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#571d14'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = erupt ? '#ffe156' : 'rgba(255,138,43,' + (warn ? 0.9 : 0.5 + 0.2 * Math.sin(t * 3 + s.x)) + ')';
      ctx.beginPath(); ctx.ellipse(mx, s.y + 4, s.w / 2 - 24, 6 + (warn ? 2 : 0), 0, 0, TAU); ctx.fill();
      if (warn && chance(0.35)) { // bubbling warning — THE telegraph
        Particles.burst(mx + rand(-18, 18), s.y + 2, 1, { colors: ['#ff9f43', '#ffe156'], type: 'circle', sp1: 40, grav: -140, l1: 0.5, s1: 8, up: 0 });
      }
      drawFace(ctx, mx, s.y + s.h - 14, 20, erupt ? 'surprised' : warn ? 'grin' : 'sleepy', t, s.x);
      continue;
    }
    if (s.gate === 'energy') { // Star Chamber: a humming striped energy field
      const p = POW[s.kind] || POW.ice;
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.15 * Math.sin(t * 4);
      ctx.fillStyle = p.c;
      rr(ctx, s.x, s.y, s.w, s.h, 14); ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = p.c2; ctx.lineWidth = 4;
      rr(ctx, s.x, s.y, s.w, s.h, 14); ctx.stroke();
      // scrolling energy stripes
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      for (let yy = s.y + ((t * 40) % 34); yy < s.y + s.h - 4; yy += 34) {
        ctx.beginPath(); ctx.moveTo(s.x + 6, yy); ctx.lineTo(s.x + s.w - 6, yy + 10); ctx.stroke();
      }
      ctx.restore();
      continue;
    }
    if (s.valve) { // bubble valve: a shimmering membrane sealing the shaft
      const p = POW[s.kind] || POW.none;
      ctx.save();
      ctx.globalAlpha = 0.6 + 0.15 * Math.sin(t * 3 + s.y);
      ctx.fillStyle = p.c;
      rr(ctx, s.x, s.y + Math.sin(t * 2 + s.y) * 2, s.w, s.h, s.h / 2); ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = p.c2; ctx.lineWidth = 3;
      rr(ctx, s.x, s.y + Math.sin(t * 2 + s.y) * 2, s.w, s.h, s.h / 2); ctx.stroke();
      // little trapped bubbles straining against it
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(s.x + 24 + i * 46, s.y + s.h + 8 + Math.sin(t * 5 + i * 2) * 3, 5 + i, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
      continue;
    }
    if (s.net) { // the gorge trampoline: one giant springy lily-leaf
      const mx = s.x + s.w / 2;
      const sq = 1 + Math.sin(t * 4) * 0.04;
      ctx.fillStyle = '#57b84a';
      ctx.beginPath(); ctx.ellipse(mx, s.y + 24, s.w / 2 + 8, 30 * sq, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2f8a3c'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(mx, s.y + 24, s.w / 2 + 8, 30 * sq, 0, 0, TAU); ctx.stroke();
      // radial leaf veins
      ctx.lineWidth = 3;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(mx, s.y + 24);
        ctx.lineTo(mx + i * s.w * 0.13, s.y + 24 - 24 * sq * (1 - Math.abs(i) * 0.18));
        ctx.stroke();
      }
      // curled-up edges: springy!
      ctx.fillStyle = '#6fcf5f';
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(mx + sd * (s.w / 2 - 12), s.y + 6, 24, 16, sd * 0.5, 0, TAU);
        ctx.fill();
      }
      drawFace(ctx, mx, s.y + 22, 30, 'grin', t, 69);
      continue;
    }
    if (s.plank) { // rope bridge: wooden slats slung between trunks
      const sag = Math.min(10, s.w * 0.03);
      // side ropes
      ctx.strokeStyle = '#d9b98a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (const oy of [-14, 2]) {
        ctx.beginPath();
        ctx.moveTo(s.x - 8, s.y + oy);
        ctx.quadraticCurveTo(s.x + s.w / 2, s.y + oy + sag * 2, s.x + s.w + 8, s.y + oy);
        ctx.stroke();
      }
      // slats
      for (let px2 = s.x + 4; px2 < s.x + s.w - 4; px2 += 26) {
        const k = (px2 - s.x) / s.w;
        const dip = Math.sin(k * Math.PI) * sag;
        ctx.fillStyle = (Math.floor(px2 / 26) % 2) ? '#b0743e' : '#a06a3e';
        rr(ctx, px2, s.y + 2 + dip, 20, 14, 4); ctx.fill();
        ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 2;
        rr(ctx, px2, s.y + 2 + dip, 20, 14, 4); ctx.stroke();
      }
      continue;
    }
    if (s.buddy) { // Buddy Block: turquoise block wearing a golden mushroom emblem
      const hop = s.bumpT ? Math.sin((s.bumpT / 0.35) * Math.PI) * 12 : 0;
      const by = s.y - hop;
      const mx = s.x + s.w / 2;
      if (!s.used) { // pulsing glow, like a pickup: "come bonk me!"
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.12 * Math.sin(t * 4);
        ctx.fillStyle = '#ffd24a';
        ctx.beginPath(); ctx.arc(mx, by + s.h / 2, 46, 0, TAU); ctx.fill();
        ctx.restore();
      }
      // spent one-shot blocks go gray; spent REFILL blocks stay dimly teal with a
      // slow pulsing outline — "I'll wake back up if you need me"
      ctx.fillStyle = s.used ? (s.refill ? '#2f8f86' : '#9a94a8') : '#3ec6b8';
      rr(ctx, s.x, by, s.w, s.h, 10); ctx.fill();
      ctx.strokeStyle = s.used ? (s.refill ? 'rgba(62,198,184,' + (0.45 + 0.35 * Math.sin(t * 2)) + ')' : '#6a6478') : '#1e8a80';
      ctx.lineWidth = 3;
      rr(ctx, s.x, by, s.w, s.h, 10); ctx.stroke();
      // golden mushroom emblem up top (gray once spent)
      ctx.fillStyle = s.used ? '#c9c1d6' : '#ffd24a';
      ctx.beginPath(); ctx.ellipse(mx, by + 15, 13, 9, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      rr(ctx, mx - 4, by + 15, 8, 7, 3); ctx.fill();
      drawFace(ctx, mx, by + 36, 20, s.used ? 'sleepy' : 'happy', t, s.x);
      continue;
    }
    if (s.bigBonus) { // candy crate: pink stripes — only a BIG buddy can crack it
      const hop = s.bumpT ? Math.sin((s.bumpT / 0.25) * Math.PI) * 8 : 0;
      const by = s.y - hop;
      ctx.fillStyle = '#fff';
      rr(ctx, s.x, by, s.w, s.h, 10); ctx.fill();
      ctx.save();
      ctx.beginPath(); rr(ctx, s.x, by, s.w, s.h, 10); ctx.clip();
      ctx.fillStyle = '#ff8fb0';
      for (let d = -s.h; d < s.w; d += 24) { // diagonal candy stripes
        ctx.beginPath();
        ctx.moveTo(s.x + d, by + s.h); ctx.lineTo(s.x + d + s.h, by);
        ctx.lineTo(s.x + d + s.h + 12, by); ctx.lineTo(s.x + d + 12, by + s.h);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = '#d6559a'; ctx.lineWidth = 3.5;
      rr(ctx, s.x, by, s.w, s.h, 10); ctx.stroke();
      drawFace(ctx, s.x + s.w / 2, by + s.h / 2 + 4, 22, s.bumpT ? 'surprised' : 'grin', t, s.x);
      continue;
    }
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
      } else { // spring block — color says what it does: pink = bounce,
        // gold + star = SUPER bounce, blue + tilted arrow = sideways launch
        const superB = (s.bounceVy || -980) <= -1300, sideB = !!s.bounceVx;
        const fillC = sideB ? '#7fd8ff' : superB ? '#ffd24a' : '#ff8fb0';
        const edgeC = sideB ? '#3a8ac2' : superB ? '#c8861b' : '#d6559a';
        ctx.fillStyle = fillC;
        rr(ctx, s.x, s.y - (sq - 1) * 20, s.w, s.h + (sq - 1) * 20, 10); ctx.fill();
        ctx.strokeStyle = edgeC; ctx.lineWidth = 3;
        rr(ctx, s.x, s.y - (sq - 1) * 20, s.w, s.h + (sq - 1) * 20, 10); ctx.stroke();
        const mx = s.x + s.w / 2, my = s.y + (s.h > 30 ? 14 : s.h / 2 + 2);
        if (sideB) { // tilted arrow showing the launch direction
          const dir = Math.sign(s.bounceVx);
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(mx - dir * 14, my + 6); ctx.lineTo(mx + dir * 10, my - 4);
          ctx.moveTo(mx + dir * 10, my - 4); ctx.lineTo(mx + dir * 1, my - 6);
          ctx.moveTo(mx + dir * 10, my - 4); ctx.lineTo(mx + dir * 8, my + 5);
          ctx.stroke();
        } else if (superB) {
          ctx.fillStyle = '#fff';
          starPath(ctx, mx, my, 11, 5);
          ctx.fill();
        } else {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.moveTo(mx - 12, my + 6); ctx.lineTo(mx, my - 6); ctx.lineTo(mx + 12, my + 6);
          ctx.closePath(); ctx.fill();
        }
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
    if (s.bigBrick) { // BIG-brick wall: only a BIG buddy plows through
      for (let by = s.y, row = 0; by < s.y + s.h - 1; by += 24, row++) {
        const off = (row % 2) * 24; // offset courses like real brickwork
        for (let bx = s.x - 24 + off; bx < s.x + s.w; bx += 48) {
          const x0 = Math.max(bx, s.x), x1 = Math.min(bx + 46, s.x + s.w);
          if (x1 - x0 < 6) continue;
          ctx.fillStyle = ((row + Math.floor(bx / 48)) % 2) ? '#c94f3d' : '#b8432f';
          rr(ctx, x0 + 1, by + 1, x1 - x0 - 2, 22, 4); ctx.fill();
          ctx.strokeStyle = '#8a2e24'; ctx.lineWidth = 2;
          rr(ctx, x0 + 1, by + 1, x1 - x0 - 2, 22, 4); ctx.stroke();
        }
      }
      // one sturdy face per wall, low enough for the hero to meet its eyes
      drawFace(ctx, s.x + s.w / 2, s.y + s.h - 46, 26, s.hintT ? 'surprised' : 'grin', t, s.x);
      if (s.hintT > 0) { // wordless hint: think MUSHROOM
        const a = Math.min(1, s.hintT * 2);
        const hx = s.x + s.w / 2, hy = s.y - 44;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(hx, hy, 30, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(hx - 20, hy + 32, 7, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(hx - 28, hy + 44, 4, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(40,25,50,0.4)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(hx, hy, 30, 0, TAU); ctx.stroke();
        // mini growth mushroom: gold cap, turquoise spots, little stalk
        ctx.fillStyle = '#fff7e8';
        rr(ctx, hx - 7, hy - 2, 14, 14, 5); ctx.fill();
        ctx.fillStyle = '#ffd24a';
        ctx.beginPath(); ctx.ellipse(hx, hy - 2, 15, 11, 0, Math.PI, TAU); ctx.fill();
        ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(hx, hy - 2, 15, 11, 0, Math.PI, TAU); ctx.stroke();
        ctx.fillStyle = '#3ec6b8';
        for (const [ox, oy, r2] of [[-8, -5, 2.8], [1, -8, 3.4], [9, -4, 2.6]]) {
          ctx.beginPath(); ctx.arc(hx + ox, hy - 2 + oy, r2, 0, TAU); ctx.fill();
        }
        ctx.restore();
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
  // rising lava (Volcano Escape): a level-wide molten floor creeping upward
  if (lv.risingLava) {
    const top = lv.risingLava.y;
    if (top < cam.y + H + 80) {
      ctx.save();
      ctx.globalAlpha = 0.4 + Math.sin(t * 3) * 0.12;
      ctx.fillStyle = '#ff9f43';
      rr(ctx, cam.x - 20, top - 18, W + 40, 34, 12); ctx.fill();
      ctx.restore();
      const g3 = ctx.createLinearGradient(0, top, 0, top + 260);
      g3.addColorStop(0, '#ffe14d'); g3.addColorStop(0.4, '#ff8a2b'); g3.addColorStop(1, '#c2451a');
      ctx.fillStyle = g3;
      ctx.fillRect(cam.x - 20, top, W + 40, cam.y + H + 100 - top);
      ctx.fillStyle = '#ffe156';
      for (let bx = Math.floor(cam.x / 26) * 26; bx < cam.x + W + 26; bx += 26) {
        ctx.beginPath();
        ctx.arc(bx, top + Math.sin(t * 4 + bx) * 3, 9, Math.PI, TAU);
        ctx.fill();
      }
      if (chance(0.25)) {
        Particles.burst(cam.x + rand(40, W - 40), top, 1, { colors: ['#ffe156', '#ff9f43'], type: 'circle', sp1: 40, grav: -220, l1: 0.7, s1: 9, up: 0 });
      }
    }
  }
  // bubble currents (Bubble Maze): readable direction, streaming bubbles
  if (lv.currents) {
    for (const cu of lv.currents) {
      if (cu.on === false) continue;
      if (cu.x + cu.w < cam.x - 60 || cu.x > cam.x + W + 60) continue;
      if (cu.y + cu.h < cam.y - 60 || cu.y > cam.y + H + 60) continue;
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = '#bfe8ff';
      rr(ctx, cu.x, cu.y, cu.w, cu.h, 18); ctx.fill();
      ctx.restore();
      // marching chevrons show which way it pushes
      const horiz = cu.dir === 'left' || cu.dir === 'right';
      const sign = (cu.dir === 'left' || cu.dir === 'up') ? -1 : 1;
      const len = horiz ? cu.w : cu.h;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let k = 0; k < len; k += 70) {
        let off = (k + t * 110) % len;
        if (sign < 0) off = len - off;
        const px2 = horiz ? cu.x + off : cu.x + cu.w / 2;
        const py2 = horiz ? cu.y + cu.h / 2 : cu.y + off;
        ctx.beginPath();
        if (horiz) {
          ctx.moveTo(px2 - sign * 9, py2 - 11); ctx.lineTo(px2 + sign * 9, py2); ctx.lineTo(px2 - sign * 9, py2 + 11);
        } else {
          ctx.moveTo(px2 - 11, py2 - sign * 9); ctx.lineTo(px2, py2 + sign * 9); ctx.lineTo(px2 + 11, py2 - sign * 9);
        }
        ctx.stroke();
      }
      ctx.restore();
      // streaming bubbles carried along the current
      if (chance(0.35)) {
        const bx = cu.x + rand(10, cu.w - 10), by = cu.y + rand(10, cu.h - 10);
        const spX = horiz ? sign * 160 : 0, spY = horiz ? 0 : sign * 160;
        Particles.add({ x: bx, y: by, vx: spX, vy: spY, life: rand(0.6, 1.1), size: rand(5, 10), color: 'rgba(255,255,255,0.7)', type: 'bubble', grav: 0, spin: 0 });
      }
    }
  }
  // shell switches (Bubble Maze): giant color-coded scallops
  if (lv.shellSwitches) {
    for (const sw of lv.shellSwitches) {
      if (sw.x + sw.w < cam.x - 80 || sw.x > cam.x + W + 80) continue;
      const p = POW[sw.kind] || POW.none;
      const mx = sw.x + sw.w / 2, base = sw.y + sw.h;
      ctx.save();
      if (!sw.on) { // beckoning glow
        ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 3 + sw.x);
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(mx, base - 24, 56, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // shell: fan of ribs
      ctx.fillStyle = sw.on ? p.glow : p.c;
      ctx.beginPath();
      ctx.moveTo(mx, base);
      ctx.arc(mx, base, sw.w / 2, Math.PI, TAU);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = p.c2; ctx.lineWidth = 3.5; ctx.stroke();
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(mx, base);
        ctx.lineTo(mx + i * sw.w * 0.16, base - sw.h * (1 - Math.abs(i) * 0.14));
        ctx.stroke();
      }
      if (sw.on) { // pressed: pearl pops up + its color star floats above
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(mx, base - sw.h - 8, 9, 0, TAU); ctx.fill();
        ctx.fillStyle = p.c;
        starPath(ctx, mx, base - sw.h - 34 + Math.sin(t * 3) * 3, 12, 5.5);
        ctx.fill();
      } else {
        drawFace(ctx, mx, base - 16, 20, 'happy', t, sw.x);
      }
      ctx.restore();
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


// Landmarks and easter eggs for the mini-games (drawn for any theme).
function drawSubDecor(ctx, lv, cam, t, d, visible) {
  if (d.skyCastle && visible(d.skyCastle.x)) { // cloud castle on the sky summit
    const c = d.skyCastle, g = c.y;
    for (const [ox, w2, h2, roof] of [[-150, 90, 130, '#ff8fb0'], [0, 120, 190, '#ff5fa2'], [170, 90, 150, '#ff8fb0']]) {
      ctx.fillStyle = '#fff';
      rr(ctx, c.x + ox, g - h2, w2, h2, 10); ctx.fill();
      ctx.strokeStyle = '#c9d4e8'; ctx.lineWidth = 3;
      rr(ctx, c.x + ox, g - h2, w2, h2, 10); ctx.stroke();
      ctx.fillStyle = roof;
      ctx.beginPath();
      ctx.moveTo(c.x + ox - 12, g - h2); ctx.lineTo(c.x + ox + w2 / 2, g - h2 - 60); ctx.lineTo(c.x + ox + w2 + 12, g - h2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8fd0ff';
      rr(ctx, c.x + ox + w2 / 2 - 12, g - h2 + 24, 24, 34, 10); ctx.fill();
      ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(c.x + ox + w2 / 2, g - h2 - 60); ctx.lineTo(c.x + ox + w2 / 2, g - h2 - 84); ctx.stroke();
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.moveTo(c.x + ox + w2 / 2, g - h2 - 84); ctx.lineTo(c.x + ox + w2 / 2 + 22, g - h2 - 77); ctx.lineTo(c.x + ox + w2 / 2, g - h2 - 70);
      ctx.closePath(); ctx.fill();
    }
    drawFace(ctx, c.x + 60, g - 130, 34, 'happy', t, 17);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.arc(c.x - 160 + i * 90, g - 4, 26, 0, TAU); ctx.fill();
    }
  }
  if (d.snoozeCloud && visible(d.snoozeCloud.x)) { // easter egg: a snoozing cloud kitten
    const e = d.snoozeCloud;
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 30, 0, TAU); ctx.arc(e.x - 30, e.y + 8, 22, 0, TAU); ctx.arc(e.x + 30, e.y + 8, 22, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd7e0'; // little ears
    for (const ox of [-16, 16]) {
      ctx.beginPath();
      ctx.moveTo(e.x + ox - 8, e.y - 24); ctx.lineTo(e.x + ox, e.y - 40); ctx.lineTo(e.x + ox + 8, e.y - 24);
      ctx.closePath(); ctx.fill();
    }
    drawFace(ctx, e.x, e.y, 26, 'sleepy', t, 23);
    if (chance(0.03)) Particles.burst(e.x + 26, e.y - 30, 1, { colors: ['#bfe8ff'], type: 'bubble', sp1: 15, grav: -35, l1: 1.4, s1: 7, up: 0 });
  }
  if (d.moonBig && visible(d.moonBig.x)) { // THE MOON
    const m = d.moonBig;
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.1 * Math.sin(t * 2);
    ctx.fillStyle = '#fff8d0';
    ctx.beginPath(); ctx.arc(m.x, m.y, 150, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffe9a0';
    ctx.beginPath(); ctx.arc(m.x, m.y, 104, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#e0c060'; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = '#f0d070';
    for (const [ox, oy, r2] of [[-40, -30, 16], [30, -50, 11], [45, 25, 14], [-25, 45, 9]]) {
      ctx.beginPath(); ctx.arc(m.x + ox, m.y + oy, r2, 0, TAU); ctx.fill();
    }
    drawFace(ctx, m.x, m.y, 62, 'grin', t, 29);
  }
  for (const b of d.balloons || []) { // drifting party balloons
    b.y -= b.sp * 0.016;
    if (b.y < 100) b.y = lv.h - 200;
    if (!visible(b.x)) continue;
    const bx = b.x + Math.sin(t * 1.2 + b.x) * 8;
    ctx.strokeStyle = 'rgba(90,74,134,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx, b.y + 24); ctx.quadraticCurveTo(bx + 5, b.y + 50, bx, b.y + 74); ctx.stroke();
    ctx.fillStyle = ['#ff5a8a', '#ffb62b', '#7fd8ff', '#b06cf0'][b.c];
    ctx.beginPath(); ctx.ellipse(bx, b.y, 18, 24, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(bx - 6, b.y - 8, 5, 8, 0.4, 0, TAU); ctx.fill();
  }
  if (d.balloonSpider && visible(d.balloonSpider.x)) { // easter egg: balloonist spider
    const e = d.balloonSpider;
    const ey = e.y + Math.sin(t * 1.1) * 10;
    ctx.fillStyle = '#e86a5a';
    ctx.beginPath(); ctx.ellipse(e.x, ey - 70, 26, 32, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(90,74,134,0.7)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(e.x, ey - 40); ctx.lineTo(e.x, ey - 16); ctx.stroke();
    ctx.fillStyle = '#b06cf0';
    ctx.beginPath(); ctx.arc(e.x, ey, 20, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#b06cf0'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { // dangling legs + one waving
      ctx.beginPath();
      ctx.moveTo(e.x - 10 + i * 10, ey + 14);
      ctx.lineTo(e.x - 13 + i * 11, ey + 30 + Math.sin(t * 3 + i) * 3);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(e.x + 16, ey - 4);
    ctx.lineTo(e.x + 28, ey - 16 + Math.sin(t * 7) * 6);
    ctx.stroke();
    drawFace(ctx, e.x, ey - 2, 17, 'grin', t, 37);
  }
  if (d.secretChamber && visible(d.secretChamber.x)) { // the secret summit chamber
    const c = d.secretChamber, g = c.y, rich = !!c.rich;
    if (rich) { // golden ambience over the whole ridiculous hoard
      ctx.save();
      ctx.globalAlpha = 0.16 + 0.06 * Math.sin(t * 2.2);
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.ellipse(c.x - 80, g - 110, 420, 220, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // candy mountain (a proper GOLD MOUNTAIN when rich)
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    if (rich) {
      ctx.moveTo(c.x - 340, g);
      ctx.quadraticCurveTo(c.x - 250, g - 150, c.x - 150, g - 190);
      ctx.quadraticCurveTo(c.x - 60, g - 150, c.x + 20, g);
    } else {
      ctx.moveTo(c.x - 260, g); ctx.quadraticCurveTo(c.x - 130, g - 150, c.x - 40, g);
    }
    ctx.closePath(); ctx.fill();
    if (rich) {
      ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 4; ctx.stroke();
      // the mound is PAVED in coins...
      ctx.fillStyle = '#ffe27a';
      for (let i = 0; i < 14; i++) {
        const k = i / 13;
        const mx2 = c.x - 320 + k * 320;
        const my2 = g - 8 - Math.sin(k * Math.PI) * 155 - (i % 3) * 14;
        ctx.beginPath(); ctx.ellipse(mx2 + (i % 2) * 16, my2 + 16, 13, 8, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 2; ctx.stroke();
      }
      // ...crowned, obviously
      drawCrown(ctx, c.x - 150, g - 194, 22);
      // coin stacks between the chest and the yeti
      for (const [ox, n2] of [[212, 5], [252, 7], [292, 4]]) {
        for (let i = 0; i < n2; i++) {
          ctx.fillStyle = i % 2 ? '#ffd24a' : '#ffe27a';
          ctx.beginPath(); ctx.ellipse(c.x + ox, g - 8 - i * 13, 17, 8, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 2; ctx.stroke();
        }
      }
      // loose coins spilled along the ground
      ctx.fillStyle = '#ffd24a';
      for (const ox of [-360, -338, 40, 66, 180, 330, 356, 400]) {
        ctx.beginPath(); ctx.ellipse(c.x + ox, g - 5, 11, 6, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 2; ctx.stroke();
      }
      if (chance(0.25)) Particles.burst(c.x + rand(-320, 300), g - rand(10, 220), 1, { colors: ['#ffe156', '#fff', '#ffd24a'], type: 'sparkle', sp1: 25, grav: -45, l1: 1, s1: 9, up: 0 });
    }
    const nCandy = rich ? 16 : 9;
    for (let i = 0; i < nCandy; i++) {
      const bx3 = rich ? c.x - 300 + (i % 6) * 48 + (i > 5 ? 24 : 0) : c.x - 240 + (i % 5) * 44 + (i > 4 ? 24 : 0);
      const by3 = g - 14 - Math.floor(i / (rich ? 6 : 5)) * 34 - (i % 3) * 12;
      drawCandy(ctx, bx3, by3, rich ? 19 : 17, i % 3, t + i);
    }
    // giant golden chest, lid open, glowing
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3);
    ctx.fillStyle = '#ffe156';
    ctx.beginPath(); ctx.arc(c.x + 90, g - 60, 120, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd24a';
    rr(ctx, c.x + 20, g - 80, 150, 80, 10); ctx.fill();
    ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 4;
    rr(ctx, c.x + 20, g - 80, 150, 80, 10); ctx.stroke();
    ctx.fillStyle = '#ffe27a';
    rr(ctx, c.x + 8, g - 128, 174, 42, 14); ctx.fill();
    ctx.strokeStyle = '#c8861b';
    rr(ctx, c.x + 8, g - 128, 174, 42, 14); ctx.stroke();
    for (let i = 0; i < 4; i++) drawCandy(ctx, c.x + 45 + i * 30, g - 84 - (i % 2) * 10, 15, i, t + i);
    // the giant friendly yeti, waving
    const yx = c.x + 330, wob = Math.sin(t * 1.5) * 3;
    ctx.fillStyle = '#f4f8ff';
    ctx.beginPath(); ctx.ellipse(yx, g - 95 + wob, 85, 100, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#b8cce8'; ctx.lineWidth = 4; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(yx, g - 25, 95, 30, 0, 0, TAU); ctx.fill(); // furry base
    ctx.fillStyle = '#dce8f8'; // belly
    ctx.beginPath(); ctx.ellipse(yx, g - 70 + wob, 52, 58, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#f4f8ff'; ctx.lineWidth = 16; ctx.lineCap = 'round'; // waving arm
    ctx.beginPath();
    ctx.moveTo(yx + 70, g - 120 + wob);
    ctx.quadraticCurveTo(yx + 110, g - 160, yx + 118, g - 190 + Math.sin(t * 5) * 14);
    ctx.stroke();
    ctx.beginPath(); // other arm resting
    ctx.moveTo(yx - 70, g - 110 + wob);
    ctx.quadraticCurveTo(yx - 100, g - 80, yx - 92, g - 50);
    ctx.stroke();
    for (const ox of [-30, 30]) { // little horns
      ctx.fillStyle = '#8fd0ff';
      ctx.beginPath();
      ctx.moveTo(yx + ox - 8, g - 178 + wob); ctx.lineTo(yx + ox, g - 200 + wob); ctx.lineTo(yx + ox + 8, g - 178 + wob);
      ctx.closePath(); ctx.fill();
    }
    drawFace(ctx, yx, g - 130 + wob, 46, 'grin', t, 53);
    if (chance(0.04)) Particles.burst(yx + rand(-60, 60), g - 180, 1, { colors: ['#ff8fb0'], type: 'heart', sp1: 40, grav: -60, l1: 1, s1: 9, up: 10 });
  }
  if (d.dinoPeek && visible(d.dinoPeek.x)) { // easter egg: a jungle friend hiding here?!
    const e = d.dinoPeek, g = e.y;
    ctx.fillStyle = '#8d8fa0';
    ctx.beginPath(); ctx.ellipse(e.x + 34, g - 20, 40, 26, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#5f6070'; ctx.lineWidth = 3; ctx.stroke();
    const peek = Math.sin(t * 0.8) > 0 ? 1 : 0.2; // shyly ducks in and out
    ctx.fillStyle = '#57c25c';
    ctx.beginPath(); ctx.arc(e.x - 4, g - 28 - 14 * peek, 15, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2f8a3c'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(e.x - 16, g - 25 - 14 * peek, 8, 6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (peek === 1) drawFace(ctx, e.x - 2, g - 29 - 14 * peek, 14, 'happy', t, 91);
  }
  if (d.dinoTruck && visible(d.dinoTruck.x)) { // easter egg — sssh
    const e = d.dinoTruck, g = 620;
    const hop = Math.abs(Math.sin(t * 5)) * 3;
    ctx.save();
    ctx.translate(e.x, g - hop);
    ctx.scale(0.42, 0.42);
    drawTruckBody(ctx, -52, -96, 104, 96, t, { driving: false, facing: -1, spin: t * 2 });
    ctx.restore();
    // a very proud tiny dino at the wheel
    const hx = e.x + 2, hy = g - 34 - hop;
    ctx.fillStyle = '#57c25c';
    ctx.beginPath(); ctx.arc(hx, hy, 9, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2f8a3c'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hx - 8, hy + 2, 5, 3.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
    drawFace(ctx, hx + 1, hy, 9, 'grin', t, 97);
    if (chance(0.02)) Particles.burst(hx, hy - 14, 1, { colors: ['#ff8fb0'], type: 'heart', sp1: 30, grav: -60, l1: 0.9, s1: 7, up: 0 });
  }
  if (d.lavaTreasure && visible(d.lavaTreasure.x)) { // Volcano Escape summit hoard
    const c = d.lavaTreasure, g = c.y;
    ctx.save();
    ctx.globalAlpha = 0.32 + 0.14 * Math.sin(t * 3);
    ctx.fillStyle = '#ffe156';
    ctx.beginPath(); ctx.arc(c.x + 60, g - 55, 105, 0, TAU); ctx.fill();
    ctx.restore();
    // open golden chest
    ctx.fillStyle = '#ffd24a';
    rr(ctx, c.x, g - 62, 120, 62, 9); ctx.fill();
    ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 4;
    rr(ctx, c.x, g - 62, 120, 62, 9); ctx.stroke();
    ctx.fillStyle = '#ffe27a';
    rr(ctx, c.x - 8, g - 100, 136, 34, 12); ctx.fill();
    ctx.strokeStyle = '#c8861b';
    rr(ctx, c.x - 8, g - 100, 136, 34, 12); ctx.stroke();
    for (let i = 0; i < 4; i++) drawCandy(ctx, c.x + 22 + i * 26, g - 66 - (i % 2) * 9, 14, i, t + i);
    // candy spill down the rim
    for (let i = 0; i < 5; i++) drawCandy(ctx, c.x + 130 + i * 30, g - 10 - (i % 3) * 8, 13, i, t + i * 2);
  }
  if (d.bigStarfish && visible(d.bigStarfish.x)) { // Bubble Maze landmark: STARFISH ROOM
    const e = d.bigStarfish, g = e.y;
    ctx.save();
    ctx.translate(e.x, g - 52);
    ctx.rotate(Math.sin(t * 1.2) * 0.08);
    ctx.fillStyle = '#ff9f43';
    starPath(ctx, 0, 0, 58, 27);
    ctx.fill();
    ctx.strokeStyle = '#d97a1a'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = '#ffce8a';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * TAU / 5;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 34, Math.sin(a) * 34, 5, 0, TAU); ctx.fill();
    }
    drawFace(ctx, 0, 4, 34, 'happy', t, 61);
    ctx.restore();
  }
  if (d.bigClam && visible(d.bigClam.x)) { // landmark: CLAM ROOM
    const e = d.bigClam, g = e.y;
    const open = 0.35 + Math.max(0, Math.sin(t * 0.8)) * 0.35;
    ctx.fillStyle = '#d88ab0';
    ctx.beginPath(); ctx.ellipse(e.x, g - 18, 62, 26, 0, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = '#a85a80'; ctx.lineWidth = 4; ctx.stroke();
    ctx.save(); // top shell hinges open
    ctx.translate(e.x - 58, g - 22);
    ctx.rotate(-open);
    ctx.fillStyle = '#f0a8c8';
    ctx.beginPath(); ctx.ellipse(58, 0, 62, 30, 0, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = '#a85a80'; ctx.stroke();
    for (let i = -2; i <= 2; i++) { // ribs
      ctx.beginPath(); ctx.moveTo(58, 0); ctx.lineTo(58 + i * 22, -28 + Math.abs(i) * 5); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#fff'; // little pearl peeking out
    ctx.beginPath(); ctx.arc(e.x + 8, g - 26, 11, 0, TAU); ctx.fill();
    drawFace(ctx, e.x, g - 8, 24, 'grin', t, 62);
    if (chance(0.04)) Particles.burst(e.x, g - 40, 1, { color: 'rgba(255,255,255,0.7)', type: 'bubble', sp1: 20, grav: -120, l1: 1.2, s1: 8, up: 0 });
  }
  if (d.coralGarden && visible(d.coralGarden.x)) { // landmark: CORAL ROOM
    const e = d.coralGarden, g = e.y;
    for (let i = 0; i < 4; i++) {
      const cx2 = e.x + i * 52 - 78, s = 1 + (i % 2) * 0.4;
      ctx.fillStyle = ['#ff8fb0', '#ff9f43', '#e86ad0', '#7fd8ff'][i];
      for (let j = -1; j <= 1; j++) {
        const sway = Math.sin(t * 1.4 + i + j) * 3;
        rr(ctx, cx2 + j * 13 * s - 5 * s + sway, g - (52 - Math.abs(j) * 16) * s, 10 * s, (52 - Math.abs(j) * 16) * s, 5 * s);
        ctx.fill();
      }
    }
    drawFace(ctx, e.x - 26, g - 34, 18, 'happy', t, 63);
  }
  if (d.trailTrunks) { // Treehouse Trail: the giant trunks holding the canopy up
    for (const tr of d.trailTrunks) {
      if (!visible(tr.x)) continue;
      ctx.fillStyle = '#8a5a34';
      rr(ctx, tr.x - tr.w / 2, tr.top, tr.w, tr.base - tr.top, 12); ctx.fill();
      ctx.strokeStyle = '#5f3a1e'; ctx.lineWidth = 4;
      rr(ctx, tr.x - tr.w / 2, tr.top, tr.w, tr.base - tr.top, 12); ctx.stroke();
      // bark seams + a knothole
      ctx.strokeStyle = 'rgba(95,58,30,0.55)'; ctx.lineWidth = 3;
      for (const k of [0.3, 0.7]) {
        ctx.beginPath();
        ctx.moveTo(tr.x - tr.w / 2 + tr.w * k, tr.top + 20);
        ctx.quadraticCurveTo(tr.x - tr.w / 2 + tr.w * k + 8, (tr.top + tr.base) / 2, tr.x - tr.w / 2 + tr.w * k - 5, tr.base - 20);
        ctx.stroke();
      }
      ctx.fillStyle = '#5f3a1e';
      ctx.beginPath(); ctx.ellipse(tr.x + tr.w * 0.16, lerp(tr.top, tr.base, hash2(tr.x, 3) * 0.5 + 0.3), 7, 10, 0, 0, TAU); ctx.fill();
      // canopy crown
      ctx.fillStyle = '#3f9c3a';
      for (const [ox, r2] of [[-tr.w * 0.7, tr.w * 0.62], [0, tr.w * 0.8], [tr.w * 0.7, tr.w * 0.58]]) {
        ctx.beginPath(); ctx.arc(tr.x + ox, tr.top - tr.w * 0.2, r2, 0, TAU); ctx.fill();
      }
      if (hash2(tr.x, 9) < 0.4) drawFace(ctx, tr.x - tr.w * 0.1, tr.top + 60, Math.min(24, tr.w * 0.35), 'sleepy', t, tr.x);
    }
  }
  if (d.gorgeFalls && visible(d.gorgeFalls.x)) { // the uncrossable waterfall gorge
    const e = d.gorgeFalls;
    const wg = ctx.createLinearGradient(0, e.top, 0, e.bottom);
    wg.addColorStop(0, '#bfe8ff'); wg.addColorStop(1, '#7fd8ff');
    ctx.fillStyle = wg;
    ctx.fillRect(e.x - 34, e.top, 104, e.bottom - e.top);
    // mossy lip where the water pours over
    ctx.fillStyle = '#3fae5a';
    ctx.beginPath(); ctx.ellipse(e.x + 18, e.top, 78, 14, 0, Math.PI, TAU); ctx.fill();
    // tumbling foam blobs
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 8; i++) {
      const fy = e.top + 20 + ((i * 173 + t * 300) % (e.bottom - e.top - 20));
      ctx.beginPath(); ctx.ellipse(e.x + 16 + Math.sin(i * 3) * 30, fy, 15, 26, 0, 0, TAU); ctx.fill();
    }
    // spray + mist pooling over the leaf trampoline
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(e.x - 260 - i * 190, e.bottom - 60, 150, 34 + i * 6, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    if (chance(0.2)) Particles.burst(e.x + rand(-30, 40), e.bottom - rand(60, 140), 1, { colors: ['#fff', '#bfe8ff'], type: 'bubble', sp1: 40, grav: -70, l1: 0.9, s1: 8, up: 20 });
    // a soft rainbow hanging in the gorge spray
    ctx.save();
    ctx.globalAlpha = 0.35; ctx.lineWidth = 10;
    RAINBOW.forEach((c, i) => {
      ctx.strokeStyle = c;
      ctx.beginPath(); ctx.arc(e.x - 400, e.bottom + 60, 330 - i * 11, Math.PI, TAU); ctx.stroke();
    });
    ctx.restore();
  }
  if (d.sloth && visible(d.sloth.x)) { // micro-discovery: the world's sleepiest neighbor
    const e = d.sloth;
    const wave = Math.sin(t * 0.6) > 0.55 ? Math.sin(t * 3) * 4 : 0; // waves in slow motion, occasionally
    ctx.strokeStyle = '#9a8a6a'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(e.x - 20, e.y - 26); ctx.lineTo(e.x - 2, e.y - 2); ctx.stroke();  // gripping arm
    ctx.beginPath(); ctx.moveTo(e.x - 20, e.y + 30); ctx.lineTo(e.x - 2, e.y + 16); ctx.stroke(); // gripping leg
    ctx.fillStyle = '#b0a082';
    ctx.beginPath(); ctx.ellipse(e.x + 6, e.y + 6, 20, 26, 0.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8a7a5c'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#e8dcc0';
    ctx.beginPath(); ctx.arc(e.x + 14, e.y - 14, 13, 0, TAU); ctx.fill();
    // droopy eye patches
    ctx.fillStyle = '#8a7a5c';
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(e.x + 14 + sd * 6, e.y - 15, 4.5, 6.5, sd * 0.4, 0, TAU); ctx.fill();
    }
    drawFace(ctx, e.x + 14, e.y - 12, 15, 'sleepy', t * 0.3, 27);
    // waving arm (the fastest thing he does all day)
    ctx.strokeStyle = '#b0a082'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(e.x + 16, e.y + 2); ctx.lineTo(e.x + 34, e.y - 12 - wave); ctx.stroke();
    if (chance(0.008)) Particles.burst(e.x + 26, e.y - 30, 1, { colors: ['#cfe9ff'], type: 'sparkle', sp1: 12, grav: -40, l0: 1.6, l1: 2.6, s1: 8, up: 0 });
  }
  if (d.tubSpider && visible(d.tubSpider.x)) { // micro-discovery: the jungle bathtub
    const e = d.tubSpider, g = e.y;
    // wooden tub
    ctx.fillStyle = '#b0743e';
    rr(ctx, e.x - 34, g - 34, 68, 34, 8); ctx.fill();
    ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 3.5;
    rr(ctx, e.x - 34, g - 34, 68, 34, 8); ctx.stroke();
    for (const bx of [-20, 0, 20]) { // barrel staves
      ctx.beginPath(); ctx.moveTo(e.x + bx, g - 32); ctx.lineTo(e.x + bx, g - 4); ctx.stroke();
    }
    // bubble foam + a very relaxed little spider
    ctx.fillStyle = '#fff';
    for (const [ox, r2] of [[-22, 9], [-8, 12], [8, 11], [22, 8]]) {
      ctx.beginPath(); ctx.arc(e.x + ox, g - 36, r2, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#9a6ad0';
    ctx.beginPath(); ctx.arc(e.x, g - 44, 12, 0, TAU); ctx.fill();
    // shower cap
    ctx.fillStyle = '#ff8fb0';
    ctx.beginPath(); ctx.arc(e.x, g - 50, 11, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(e.x, g - 58, 3.5, 0, TAU); ctx.fill();
    drawFace(ctx, e.x, g - 42, 15, 'sleepy', t, 28);
    if (chance(0.05)) Particles.burst(e.x + rand(-20, 20), g - 50, 1, { color: 'rgba(255,255,255,0.8)', type: 'bubble', sp1: 20, grav: -90, l1: 1.2, s1: 8, up: 0 });
  }
  if (d.monkeySign && visible(d.monkeySign.x)) { // welcome to the highlands
    const e = d.monkeySign, g = e.y;
    ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(e.x, g); ctx.lineTo(e.x, g - 92); ctx.stroke();
    ctx.fillStyle = '#b0743e';
    rr(ctx, e.x - 52, g - 138, 104, 54, 10); ctx.fill();
    ctx.strokeStyle = '#6a4020'; ctx.lineWidth = 3.5;
    rr(ctx, e.x - 52, g - 138, 104, 54, 10); ctx.stroke();
    // a painted banana and an up-arrow: "the good stuff is UP"
    ctx.save();
    ctx.translate(e.x - 18, g - 111);
    ctx.rotate(0.5);
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.quadraticCurveTo(12, -2, 4, 12);
    ctx.quadraticCurveTo(0, 14, -3, 11); ctx.quadraticCurveTo(5, -2, -5, -10);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#ffe156';
    ctx.beginPath();
    ctx.moveTo(e.x + 22, g - 128); ctx.lineTo(e.x + 34, g - 116) ; ctx.lineTo(e.x + 27, g - 116);
    ctx.lineTo(e.x + 27, g - 96); ctx.lineTo(e.x + 17, g - 96); ctx.lineTo(e.x + 17, g - 116);
    ctx.lineTo(e.x + 10, g - 116);
    ctx.closePath(); ctx.fill();
  }
  if (d.floorFerns) { // Treehouse Trail undergrowth (per-region floor heights)
    for (const f of d.floorFerns) {
      if (!visible(f.x)) continue;
      const g = f.g;
      ctx.strokeStyle = ['#3f9c3a', '#57b84a'][f.c % 2]; ctx.lineWidth = 4.5 * f.s; ctx.lineCap = 'round';
      for (let i = -2; i <= 2; i++) {
        const sway = Math.sin(t * 1.3 + f.x + i) * 5;
        ctx.beginPath();
        ctx.moveTo(f.x, g + 4);
        ctx.quadraticCurveTo(f.x + i * 20 * f.s + sway, g - 48 * f.s, f.x + i * 40 * f.s + sway, g - 66 * f.s + Math.abs(i) * 16 * f.s);
        ctx.stroke();
      }
      if (f.c === 3) { // a flower face here and there
        ctx.fillStyle = '#ff8fb0';
        for (let i = 0; i < 5; i++) {
          const a = i * TAU / 5 + t * 0.4;
          ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * 10 * f.s, g - 60 * f.s + Math.sin(a) * 10 * f.s, 6 * f.s, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#ffe156';
        ctx.beginPath(); ctx.arc(f.x, g - 60 * f.s, 6 * f.s, 0, TAU); ctx.fill();
      }
    }
  }
  if (d.frogs) { // tiny green spectators, hopping in place
    for (const fr of d.frogs) {
      if (!visible(fr.x)) continue;
      const hop = Math.max(0, Math.sin(t * 2.6 + fr.x)) * 16;
      const fy = fr.g - 10 - hop;
      ctx.fillStyle = '#57d357';
      ctx.beginPath(); ctx.ellipse(fr.x, fy, 12, 9, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2f8a3c'; ctx.lineWidth = 2.5; ctx.stroke();
      for (const sd of [-1, 1]) { // bulgy eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(fr.x + sd * 6, fy - 8, 4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3a2a3a';
        ctx.beginPath(); ctx.arc(fr.x + sd * 6, fy - 8, 1.8, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = '#2f8a3c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(fr.x, fy + 1, 5, 0.3, Math.PI - 0.3); ctx.stroke();
    }
  }
  if (d.pearlShrine && visible(d.pearlShrine.x)) { // the BUBBLE MAZE treasure
    const e = d.pearlShrine, g = e.y;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 2.5);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(e.x, g - 90, 120, 0, TAU); ctx.fill();
    ctx.restore();
    // open shell pedestal
    ctx.fillStyle = '#d88ab0';
    ctx.beginPath(); ctx.ellipse(e.x, g - 14, 78, 26, 0, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = '#a85a80'; ctx.lineWidth = 4; ctx.stroke();
    // THE GIANT PEARL
    const pg = ctx.createRadialGradient(e.x - 16, g - 96, 8, e.x, g - 84, 62);
    pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.7, '#e8ecff'); pg.addColorStop(1, '#c0cbe8');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(e.x, g - 78, 56, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#9aa8d0'; ctx.lineWidth = 3; ctx.stroke();
    drawFace(ctx, e.x, g - 74, 36, 'grin', t, 64);
    // scattered gold coins
    ctx.fillStyle = '#ffd24a';
    for (const [ox, oy] of [[-96, -8], [-70, -16], [88, -10], [110, -6], [66, -18]]) {
      ctx.beginPath(); ctx.ellipse(e.x + ox, g + oy, 12, 7, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 2; ctx.stroke();
    }
    if (chance(0.15)) Particles.burst(e.x + rand(-50, 50), g - rand(40, 130), 1, { colors: ['#fff', '#ffe156'], type: 'sparkle', sp1: 25, grav: -40, l1: 0.9, s1: 8, up: 0 });
  }
}

function drawDecor(ctx, lv, cam, t) {
  const th = lv.theme, d = lv.decor;
  const visible = x => x > cam.x - 150 && x < cam.x + W + 150;
  drawSubDecor(ctx, lv, cam, t, d, visible); // mini-game landmarks & easter eggs
  if (d.crashedPod && visible(d.crashedPod.x)) ST_ART.crashedPod(ctx, d.crashedPod.x, 620, t); // the jungle's crash site (8-2 continuity)
  if (th === 'meadow') {
    for (const tr of d.trees || []) {
      if (!visible(tr.x)) continue;
      const s = tr.s, gy = tr.y || 620;
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
      const gy = f.y || 620, s = f.s;
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
      const wg = groundTopAt(lv, wd.x) ?? 1130;
      ctx.strokeStyle = '#2e9c5a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(wd.x, wg);
      ctx.quadraticCurveTo(wd.x + Math.sin(t * 1.5 + wd.seed) * 18, wg - wd.h * 0.5, wd.x + Math.sin(t * 1.5 + wd.seed) * 30, wg - wd.h);
      ctx.stroke();
    }
    for (const co of d.corals || []) {
      if (!visible(co.x)) continue;
      const s = co.s;
      const cg = groundTopAt(lv, co.x) ?? 1130;
      ctx.fillStyle = ['#ff8fb0', '#ff9f43', '#e86ad0'][co.c];
      for (let i = -1; i <= 1; i++) {
        rr(ctx, co.x + i * 12 * s - 5 * s, cg - (44 - Math.abs(i) * 14) * s, 10 * s, (44 - Math.abs(i) * 14) * s, 5 * s);
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
