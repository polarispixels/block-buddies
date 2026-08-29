'use strict';
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const lightCv = document.createElement('canvas');
lightCv.width = W; lightCv.height = H;
const lctx = lightCv.getContext('2d');

function fitCanvas() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  cv.style.width = Math.floor(W * s) + 'px';
  cv.style.height = Math.floor(H * s) + 'px';
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

let saveUnlocked = 1, saveChar = 'boy', saveRoyal = false;
const saveMini = {}, saveStage = {};
try {
  saveUnlocked = clamp(parseInt(localStorage.getItem('ffbg_unlocked') || '1', 10) || 1, 1, 10);
  if (localStorage.getItem('ffbg_char') === 'girl') saveChar = 'girl';
  saveRoyal = localStorage.getItem('ffbg_royal') === '1';
  for (const k of (localStorage.getItem('ffbg_mini') || '').split(',')) if (k) saveMini[k] = true;
  // furthest stage reached per world ("w:idx,..." — linear chains, v1.20.0)
  for (const pair of (localStorage.getItem('ffbg_stage') || '').split(',')) {
    const [w, s] = pair.split(':').map(Number);
    if (w >= 1 && w <= 10 && s > 0) saveStage[w] = s;
  }
} catch (e) {}

const game = {
  state: 'title', t: 0,
  level: null, player: null,
  spiders: [], projectiles: [], pickups: [], shoes: [],
  checkpoint: null, lastSafe: { x: 100, y: 400 },
  cam: { x: 0, y: 0 },
  candy: 0, friendCount: 0,
  shake: 0, hudPulse: 0, heartFlash: 0,
  unlocked: saveUnlocked,
  character: saveChar,
  royal: saveRoyal,
  crowned: false,
  selLevel: saveUnlocked,
  introT: 0, completeT: 0, deadT: 0,
  caught: null, cut: null,
  zombie: null, bossStage: 0, arenaL: 4020, arenaR: 4960,
  bossPlan: { 1: 'fire', 2: 'ice', 3: 'rainbow' },
  stageHintT: 0, bossPickups: [],
  chest: null, endPhase: null, partyT: 0,
  titleT: 0, titleBoyX: 300, titleBoyD: 1,
  titlePlayer: null, titleSpider: null,
  combo: { up: 0, down: 0, t: 0 }, titleMsg: null,
  subReturn: null, miniDone: saveMini, stageProg: saveStage, flightStars: 0,
  partsDelivered: false,
  deathPos: null
};

// ================================================================ flow
const PORTRAITS = [
  { who: 'boy', x: 200, y: 452, r: 46 },
  { who: 'girl', x: 318, y: 452, r: 46 }
];
const medalPos = i => ({ x: W / 2 - 382.5 + (i - 1) * 85, y: 688, r: 30 });
game.goTitle = function () {
  game.state = 'title';
  game.titleT = 0;
  game.selLevel = clamp(game.unlocked, 1, 10);
  AudioSys.setMusic('title');
};
game.setCharacter = function (who) {
  if (game.character === who) return;
  game.character = who;
  try { localStorage.setItem('ffbg_char', who); } catch (e) {}
  AudioSys.sfx('switch');
  const px2 = PORTRAITS.find(p => p.who === who);
  if (px2) Particles.burst(px2.x, px2.y, 10, { colors: ['#ffe156', '#ff8fb0', '#fff'], type: 'star', sp1: 220, l1: 0.6, s1: 9, grav: 200 });
};
game.unlockAll = function () { // secret combo: Up×5 fast on the title (keyboard only)
  game.unlocked = 10;
  game.selLevel = 10;
  try { localStorage.setItem('ffbg_unlocked', '10'); } catch (e) {}
  game.titleMsg = { text: 'ALL WORLDS OPEN!', t: 2.5 };
  AudioSys.sfx('fanfare');
  for (let i = 1; i <= 10; i++) {
    const m = medalPos(i);
    Particles.burst(m.x, m.y, 8, { colors: RAINBOW, type: 'confetti', sp1: 220, l0: 0.8, l1: 1.6, s1: 10, grav: 250, up: 180 });
  }
};
game.resetProgress = function () { // secret combo: Down×5 fast on the title (keyboard only)
  try {
    localStorage.removeItem('ffbg_unlocked');
    localStorage.removeItem('ffbg_char');
    localStorage.removeItem('ffbg_royal');
    localStorage.removeItem('ffbg_mini');
    localStorage.removeItem('ffbg_stage');
  } catch (e) {}
  game.stageProg = {};
  game.unlocked = 1;
  game.selLevel = 1;
  game.royal = false;
  game.miniDone = {};
  game.character = 'boy'; // direct set — setCharacter would re-save to the storage we just cleared
  game.titleMsg = { text: 'BRAND NEW GAME!', t: 2.5 };
  AudioSys.sfx('poof');
  Particles.burst(W / 2, 400, 26, { colors: ['#fff', '#ffe156', '#7fd8ff'], type: 'star', sp1: 320, l1: 1, s1: 12, grav: 150 });
};
game.titleTap = function (p) {
  for (const pt of PORTRAITS) {
    if (Math.hypot(p.x - pt.x, p.y - pt.y) < pt.r * 1.25) { game.setCharacter(pt.who); return true; }
  }
  for (let i = 1; i <= 10; i++) {
    const m = medalPos(i);
    if (Math.hypot(p.x - m.x, p.y - m.y) < m.r * 1.35) {
      if (i <= game.unlocked) { game.selLevel = i; game.startWorld(i); }
      else AudioSys.sfx('boing');
      return true;
    }
  }
  return false;
};
// ---------------- linear world chains (v1.20.0) ----------------
// Picking a world resumes at the furthest stage reached (never replay 1-1 to
// retry 1-2); a fully-beaten world starts back at stage 1 for free chain
// replay (worldWin resets its progress).
game.startWorld = function (w) {
  const chain = stageChain(w);
  const st = clamp(game.stageProg[w] || 0, 0, chain.length - 1);
  game.startLevel(chain[st]);
};
game.saveStageProg = function () {
  try {
    const parts = [];
    for (const w in game.stageProg) if (game.stageProg[w] > 0) parts.push(w + ':' + game.stageProg[w]);
    if (parts.length) localStorage.setItem('ffbg_stage', parts.join(','));
    else localStorage.removeItem('ffbg_stage');
  } catch (e) {}
};
// The light between-stages beat: fanfare + confetti + a short card, then the
// next stage loads as a FULL level (no subReturn). The big party stays
// reserved for world completion (worldWin).
game.stageClear = function (nextId) {
  if (game.state !== 'play' || game.cut || game.endPhase) return;
  game.state = 'stageclear'; game.completeT = 0; game.nextStage = nextId;
  AudioSys.sfx('fanfare');
  const info = stageInfo(nextId);
  if (info && (game.stageProg[info.world] || 0) < info.stage) {
    game.stageProg[info.world] = info.stage;
    game.saveStageProg();
  }
  Particles.burst(game.player.cx, game.player.y, 26,
    { colors: RAINBOW.concat(['#ffe156']), type: 'confetti', sp1: 380, l0: 0.8, l1: 1.8, s1: 12, grav: 300, up: 260 });
};
// World completion: the final stage's finale. Full party, next world
// unlocked, stage progress reset so the chain replays from its start.
game.worldWin = function (w) {
  if (game.mazeDone) return;
  game.mazeDone = true; // same per-level goal-reached guard as subWin/mazeWin
  game.endPhase = 'party'; game.partyT = 0;
  AudioSys.setMusic('win');
  AudioSys.sfx('chest');
  AudioSys.sfx('cheer');
  game.shake = Math.max(game.shake, 0.25);
  const gs = game.level.goalStar;
  if (gs) {
    Particles.burst(gs.x, gs.y, 30, { colors: ['#ffe156', '#ffd24a', '#fff'], type: 'star', sp1: 420, l0: 0.8, l1: 1.6, s1: 13, grav: 100 });
    Particles.candyBurst(gs.x, gs.y - 30, 12);
  }
  game.unlocked = Math.max(game.unlocked, Math.min(10, w + 1));
  try { localStorage.setItem('ffbg_unlocked', String(game.unlocked)); } catch (e) {}
  game.stageProg[w] = 0;
  game.saveStageProg();
  game.wonWorld = w;
};
game.startLevel = function (n) {
  game.subReturn = null; game.flightStars = 0;
  const lv = buildLevel(n);
  game.level = lv;
  game.player = new Player(lv.playerStart.x, lv.playerStart.y);
  game.spiders = lv.spiders;
  game.pickups = lv.pickups;
  game.projectiles = []; game.shoes = [];
  game.checkpoint = null;
  game.lastSafe = { x: lv.playerStart.x, y: lv.playerStart.y };
  game.friendCount = 0;
  game.zombie = null; game.bossStage = 0; game.bossPickups = []; game.spinoWalls = [];
  game.chest = null; game.endPhase = null; game.cut = null; game.caught = null;
  game.raceDone = false; game.cheerT = 0; game.crowned = false; game.mazeDone = false;
  game.wonWorld = 0;
  game.cam.x = 0;
  game.cam.y = lv.h > H ? clamp(game.player.cy - H * 0.5, 0, lv.h - H) : 0;
  game.state = 'intro'; game.introT = 0;
  AudioSys.setMusic(lv.music);
};
// ---------------- sublevels / mini-games ----------------
// enterSub stashes the ENTIRE host state (level object, player instance,
// enemy/pickup arrays, checkpoint, camera, music) and swaps in a freshly
// built sublevel. exitSub restores the stash verbatim, which guarantees the
// host's mission progress survives and no sublevel physics/camera state can
// leak back out (the sub gets its own Player instance).
game.enterSub = function (id) {
  game.subReturn = {
    level: game.level, player: game.player,
    spiders: game.spiders, pickups: game.pickups,
    checkpoint: game.checkpoint, lastSafe: game.lastSafe,
    camX: game.cam.x, camY: game.cam.y,
    mazeDone: game.mazeDone, music: game.level.music
  };
  const lv = buildLevel(id);
  game.level = lv;
  game.player = new Player(lv.playerStart.x, lv.playerStart.y);
  if (lv.flight) game.player.boardUnicorn();
  game.spiders = lv.spiders;
  game.pickups = lv.pickups;
  game.projectiles = []; game.shoes = [];
  game.checkpoint = null;
  game.lastSafe = { x: lv.playerStart.x, y: lv.playerStart.y };
  game.chest = null; game.endPhase = null; game.cut = null; game.caught = null;
  game.mazeDone = false;
  game.flightStars = 0;
  game.cam.x = clamp(game.player.cx - W / 2, 0, Math.max(0, lv.w - W));
  game.cam.y = lv.h > H ? clamp(game.player.cy - H * 0.5, 0, lv.h - H) : 0;
  game.state = 'intro'; game.introT = 0;
  AudioSys.sfx('rainbow');
  AudioSys.setMusic(lv.music);
};
game.exitSub = function () {
  const r = game.subReturn;
  if (!r) return;
  game.subReturn = null;
  game.level = r.level;
  game.player = r.player;
  game.spiders = r.spiders;
  game.pickups = r.pickups;
  game.checkpoint = r.checkpoint;
  game.lastSafe = r.lastSafe;
  game.projectiles = []; game.shoes = [];
  game.chest = null; game.endPhase = null; game.partyT = 0; game.cut = null; game.caught = null;
  game.mazeDone = r.mazeDone;
  game.player.vx = 0; game.player.vy = 0; game.player.inv = 1.5;
  game.cam.x = r.camX; game.cam.y = r.camY;
  game.state = 'play';
  AudioSys.sfx('switch');
  AudioSys.setMusic(r.music);
};
game.subWin = function () {
  if (game.mazeDone) return;
  game.mazeDone = true; // per-level goal-reached guard, same as the maze star
  game.endPhase = 'party'; game.partyT = 0;
  AudioSys.setMusic('win');
  AudioSys.sfx('chest');
  AudioSys.sfx('cheer');
  game.shake = Math.max(game.shake, 0.25);
  const gs = game.level.goalStar;
  if (gs) {
    Particles.burst(gs.x, gs.y, 30, { colors: ['#ffe156', '#ffd24a', '#fff'], type: 'star', sp1: 420, l0: 0.8, l1: 1.6, s1: 13, grav: 100 });
    Particles.candyBurst(gs.x, gs.y - 30, 12);
  }
  game.miniDone[game.level.n] = true;
  try { localStorage.setItem('ffbg_mini', Object.keys(game.miniDone).join(',')); } catch (e) {}
};
game.respawnPlayer = function () {
  const lv = game.level, pl = game.player, cp = game.checkpoint;
  pl.x = cp ? cp.x - 20 : lv.playerStart.x;
  pl.y = cp ? cp.groundY - pl.h - 4 : lv.playerStart.y;
  if (lv.water && cp) pl.y = cp.groundY - pl.h - 40;
  if (game.zombie) {
    // the rock wall has sealed the arena — respawn just inside it, not at the flag
    pl.x = game.arenaL + 20;
    pl.y = game.zombie.groundY - pl.h - 4;
  }
  pl.vx = 0; pl.vy = 0; pl.hearts = 3; pl.inv = 2; pl.mood = 'happy';
  game.projectiles = []; game.shoes = [];
  if (lv.risingLava) { // the lava backs way off after a tumble — fresh start
    lv.risingLava.y = Math.max(lv.risingLava.y, (cp ? cp.groundY : lv.playerStart.y + 100) + 420);
    lv.risingLava.y = Math.min(lv.risingLava.y, lv.risingLava.y0);
  }
  if (game.zombie && game.bossStage > 0 && game.zombie.state !== 'friend') {
    const z = game.zombie;
    z.x = game.arenaR - 220; z.y = z.groundY - z.h;
    z.vx = 0; z.vy = 0; z.hits = 0;
    z.setState('chase');
  }
  game.state = 'play';
};
game.softRespawn = function () {
  const pl = game.player, cp = game.checkpoint, lv = game.level;
  pl.x = cp ? cp.x - 20 : lv.playerStart.x;
  pl.y = cp ? cp.groundY - pl.h - 4 : lv.playerStart.y;
  pl.vx = 0; pl.vy = 0; pl.inv = 1.5;
};
game.die = function () {
  if (game.state !== 'play') return;
  game.state = 'dead'; game.deadT = 0;
  game.deathPos = { x: game.player.cx, y: game.player.y + game.player.h };
  AudioSys.sfx('lose');
  const p = POW[game.player.power];
  Particles.burst(game.player.cx, game.player.cy + 20, 16, {
    colors: [p.c, p.c2, '#ffd24a', '#ff5a5a', '#4a6cff'],
    type: 'block', sp1: 430, l0: 0.8, l1: 1.6, s0: 8, s1: 14, grav: 900
  });
};
game.levelComplete = function () {
  if (game.state !== 'play' || game.cut) return;
  game.state = 'complete'; game.completeT = 0;
  AudioSys.sfx('fanfare');
  game.unlocked = Math.max(game.unlocked, Math.min(6, game.level.n + 1));
  try { localStorage.setItem('ffbg_unlocked', String(game.unlocked)); } catch (e) {}
  Particles.burst(game.player.cx, game.player.y, 26, { colors: ['#ffe156', '#57d357', '#4aa3ff', '#ff8fb0'], type: 'star', sp1: 430, l1: 1.2, s1: 13 });
};
game.smashWall = function (s, cols) {
  if (s.broken) return;
  s.broken = true;
  AudioSys.sfx('smash');
  if (cols) AudioSys.sfx('boom'); // big-brick ram: extra drama
  game.shake = Math.max(game.shake, 0.4);
  for (let by = s.y; by < s.y + s.h; by += 48)
    for (let bx = s.x; bx < s.x + s.w; bx += 48)
      Particles.burst(bx + 24, by + 24, 3, { colors: cols || ['#d9b98a', '#a8895a'], type: 'block', sp1: 380, l1: 1, s1: 12, grav: 900 });
};
game.bumpBlock = function (s) { // head-bonk on a Buddy Block, a candy crate, or a Puzzle Blocks answer
  const pl = game.player;
  if (s.puzzleBlock) { game.level.puzzle.onAnswer(s); return; }
  if (s.buddy) {
    // refill blocks guard MANDATORY brick walls: once the mushroom is spent and
    // Jack is small again, a fresh bonk re-arms the block — never a soft-lock
    if (s.used && s.refill && !pl.big && !game.pickups.some(p => p instanceof GrowthShroom && !p.dead)) s.used = false;
    if (s.used) { s.bumpT = 0.2; AudioSys.sfx('thud'); return; } // sleepy now
    s.used = true; s.bumpT = 0.35;
    AudioSys.sfx('boing');
    AudioSys.sfx('collect');
    pl.setMood('surprised', 0.8);
    Particles.burst(s.x + s.w / 2, s.y, 12, { colors: ['#ffd24a', '#3ec6b8', '#fff'], type: 'sparkle', sp1: 240, l1: 0.7, s1: 10, grav: 150 });
    game.pickups.push(new GrowthShroom(s));
    return;
  }
  if (s.bigBonus && !s.broken) {
    if (pl.big) { // SMASH! candy everywhere
      s.broken = true;
      AudioSys.sfx('smash');
      AudioSys.sfx('candy');
      game.shake = Math.max(game.shake, 0.35);
      pl.setMood('grin', 1.5);
      Particles.candyBurst(s.x + s.w / 2, s.y + s.h / 2, 10);
      Particles.burst(s.x + s.w / 2, s.y + s.h / 2, 14, { colors: ['#ff8fb0', '#fff', '#ffd24a'], type: 'block', sp1: 360, l1: 0.9, s1: 12, grav: 800 });
      for (let i = 0; i < 3; i++) {
        const c = new Pickup(s.x + s.w / 2, s.y - 20, 'candy');
        c.physics = true;
        c.vx = (i - 1) * 130;
        c.vy = -330;
        game.pickups.push(c);
      }
    } else { // small Jack just wobbles it — funny, not punishing
      s.bumpT = 0.25;
      AudioSys.sfx('thud');
      pl.setMood('surprised', 0.6);
      Particles.burst(s.x + s.w / 2, s.y + s.h, 4, { colors: ['#fff'], sp1: 90, l1: 0.3, grav: 200, up: 10, s1: 6 });
    }
  }
};
game.activateBridge = function (b) {
  if (b.active) return;
  b.active = true;
  game.level.solids.push({ x: b.x, y: b.y, w: b.w, h: 26, oneWay: true, skipDraw: true });
  AudioSys.sfx('fanfare');
  Particles.burst(b.x + b.w / 2, b.y, 24, { colors: RAINBOW, type: 'star', sp1: 350, l1: 1, s1: 12 });
};
game.startCloudCatch = function () {
  if (game.state !== 'play') return;
  game.state = 'caught';
  game.caught = { t: 0, fromX: game.player.x, fromY: game.level.h + 120, tx: game.lastSafe.x, ty: game.lastSafe.y };
  AudioSys.sfx('whoosh');
};
game.startBossIntro = function () {
  const G = 620;
  if (game.level.n === 10) {
    game.zombie = new Spino(5150, G); // same slot as the zombie — same interface
    game.zombie.state = 'intro';
    game.bossPlan = { 1: 'ice', 2: 'fire', 3: 'rainbow' };
    game.arenaL = 4430; game.arenaR = 5440;
    // vine-covered rocks seal the valley on BOTH sides — the way onward opens
    // only once the spinosaurus is a friend
    const wl = { x: 4392, y: G - 260, w: 56, h: 260, pile: true };
    const wr = { x: 5450, y: G - 260, w: 56, h: 260, pile: true };
    game.level.solids.push(wl, wr);
    game.spinoWalls = [wl, wr];
    Particles.burst(4420, G - 180, 12, { colors: ['#8a9a7a', '#57b84a'], type: 'block', sp1: 300, l1: 1, s1: 12, grav: 900 });
    Particles.burst(5478, G - 180, 12, { colors: ['#8a9a7a', '#57b84a'], type: 'block', sp1: 300, l1: 1, s1: 12, grav: 900 });
    game.cut = { name: 'spinointro', t: 0 };
  } else if (game.level.n === 6) {
    game.zombie = new Magma(4720, G); // same slot as the zombie — same interface
    game.zombie.state = 'intro';
    game.bossPlan = { 1: 'ice', 2: 'power', 3: 'rainbow' };
    game.arenaL = 3950; game.arenaR = 4810;
    game.level.solids.push({ x: 3870, y: G - 260, w: 56, h: 260, pile: true });
    Particles.burst(3898, G - 180, 14, { colors: ['#43222e', '#ff7a2b'], type: 'block', sp1: 300, l1: 1, s1: 12, grav: 900 });
    game.cut = { name: 'magmaintro', t: 0 };
  } else {
    game.zombie = new Zombie(4760, G);
    game.zombie.state = 'enter';
    game.bossPlan = { 1: 'fire', 2: 'ice', 3: 'rainbow' };
    game.arenaL = 3900; game.arenaR = 4960;
    // rocks fall BEHIND the player, sealing the arena entrance
    game.level.solids.push({ x: 3820, y: G - 260, w: 56, h: 260, pile: true });
    Particles.burst(3848, G - 180, 14, { colors: ['#453563', '#6a4fa0'], type: 'block', sp1: 300, l1: 1, s1: 12, grav: 900 });
    game.cut = { name: 'bossintro', t: 0 };
  }
  game.shake = 0.5;
  AudioSys.sfx('rumble');
  AudioSys.setMusic('');
};
game.setBossStage = function (k) {
  game.bossStage = k;
  game.stageHintT = 3.5;
  const kind = game.bossPlan[k];
  for (const p of game.bossPickups) { p.bossKind = null; p.dead = true; }
  game.bossPickups = [];
  for (const px of [game.arenaL + 250, game.arenaL + 680]) {
    const p = new Pickup(px, 556, kind);
    p.bossKind = kind;
    game.pickups.push(p);
    game.bossPickups.push(p);
  }
  AudioSys.setMusic('boss');
};
game.startCoronation = function () {
  if (game.crowned) return;
  game.crowned = true;
  game.unlocked = Math.max(game.unlocked, 9); // royalty gets a rocket trip
  try { localStorage.setItem('ffbg_unlocked', String(game.unlocked)); } catch (e) {}
  game.cut = { name: 'coronation', t: 0 };
  AudioSys.setMusic('');
};
game.mazeWin = function () {
  if (game.mazeDone) return;
  game.mazeDone = true;
  game.endPhase = 'party'; game.partyT = 0;
  AudioSys.setMusic('win');
  AudioSys.sfx('chest');
  AudioSys.sfx('cheer');
  game.shake = Math.max(game.shake, 0.25);
  const gs = game.level.goalStar;
  Particles.burst(gs.x, gs.y, 30, { colors: ['#ffe156', '#ffd24a', '#fff'], type: 'star', sp1: 420, l0: 0.8, l1: 1.6, s1: 13, grav: 100 });
  Particles.candyBurst(gs.x, gs.y - 30, 14);
  // the star's magic befriends every alien in the maze — party for all!
  for (const sp of game.spiders) if (sp.kind === 'alien' && sp.state === 'angry') sp.befriend();
  game.unlocked = Math.max(game.unlocked, 10); // the maze star opens the jungle
  try { localStorage.setItem('ffbg_unlocked', String(game.unlocked)); } catch (e) {}
};
game.jungleWin = function () {
  if (game.mazeDone) return; // shares the goal-star guard flag
  game.mazeDone = true;
  game.endPhase = 'party'; game.partyT = 0;
  AudioSys.setMusic('win');
  AudioSys.sfx('chest');
  AudioSys.sfx('cheer');
  game.shake = Math.max(game.shake, 0.25);
  const gs = game.level.goalStar;
  Particles.burst(gs.x, gs.y, 30, { colors: ['#ffe156', '#7be07b', '#fff'], type: 'star', sp1: 420, l0: 0.8, l1: 1.6, s1: 13, grav: 100 });
  Particles.candyBurst(gs.x, gs.y - 30, 14);
  // every dino and spider in the valley joins the party
  for (const sp of game.spiders) if (sp.state === 'angry' && sp.befriend) sp.befriend();
  if (game.zombie) game.zombie.setState('dance');
};
game.finishRace = function () {
  if (game.raceDone) return;
  game.raceDone = true;
  game.unlocked = Math.max(game.unlocked, 8); // winning the rally unlocks the forest
  try { localStorage.setItem('ffbg_unlocked', String(game.unlocked)); } catch (e) {}
  game.endPhase = 'party'; game.partyT = 0;
  AudioSys.setMusic('win');
  AudioSys.sfx('cheer');
  AudioSys.sfx('fanfare');
  game.shake = Math.max(game.shake, 0.3);
  Particles.candyBurst(game.player.cx, game.player.y - 40, 16);
  Particles.burst(game.player.cx, game.player.y, 24, { colors: RAINBOW, type: 'confetti', sp1: 400, l0: 1, l1: 2, s1: 12, grav: 300 });
};
game.startEnding = function () {
  // each boss beaten unlocks the next bonus world
  game.unlocked = Math.max(game.unlocked, game.level.n === 6 ? 7 : 6);
  try { localStorage.setItem('ffbg_unlocked', String(game.unlocked)); } catch (e) {}
  if (game.level.n === 6) {
    game.endPhase = 'erupting';
    game.cut = { name: 'eruption', t: 0 };
  } else {
    game.endPhase = 'rumble';
    game.cut = { name: 'rumble', t: 0 };
  }
  AudioSys.setMusic('');
  AudioSys.sfx('rumble');
  game.shake = 0.8;
};


// ================================================================ update
function updateCut(dt) {
  const c = game.cut, z = game.zombie;
  c.t += dt;
  if (z) { z.t += dt; z.st += dt; }
  if (c.name === 'bossintro') {
    const t = c.t;
    if (t < 1.4) { z.x = lerp(4760, 4560, t / 1.4); z.facing = -1; }
    else if (t < 2.6) { if (z.state !== 'roar') { z.state = 'roar'; z.st = 0; AudioSys.sfx('roar'); game.shake = 0.5; } }
    else if (t < 3.3) { if (z.state !== 'hiccup') { z.state = 'hiccup'; z.st = 0; AudioSys.sfx('hiccup'); } }
    else if (t < 4.7) {
      if (z.state !== 'trip') {
        z.state = 'trip'; z.st = 0;
        AudioSys.sfx('thud'); game.shake = 0.3;
        Particles.burst(z.cx, z.y + z.h, 10, { colors: ['#8a7fae', '#fff'], type: 'star', sp1: 210, l1: 0.6, s1: 9 });
      }
    }
    else if (t < 5.7) { if (z.state !== 'getup') { z.state = 'getup'; z.st = 0; } }
    else { game.cut = null; z.setState('chase'); game.setBossStage(1); }
    const tx = clamp(z.cx - W * 0.55, 0, game.level.w - W);
    game.cam.x = lerp(game.cam.x, tx, 1 - Math.exp(-4 * dt));
  } else if (c.name === 'magmaintro') {
    const t = c.t;
    if (t < 1.5) { // rises out of the lava, dripping
      z.y = lerp(660, 480, Math.min(1, t / 1.5));
      if (chance(0.5)) Particles.burst(z.cx + rand(-60, 60), 648, 2, { colors: ['#ff8a2b', '#ffe156'], type: 'flame', sp1: 200, grav: -60, l1: 0.6, s1: 11 });
    }
    else if (t < 2.7) { if (!c.blorped) { c.blorped = true; AudioSys.sfx('roar'); AudioSys.sfx('blorp'); game.shake = 0.5; } }
    else if (t < 3.5) {
      if (!c.sneezed) {
        c.sneezed = true;
        AudioSys.sfx('hiccup');
        z.crownDrop = true; // AH-CHOO — crown slips over his eyes
        Particles.burst(z.cx - 60, z.y + 50, 14, { colors: ['#ff9f43', '#ffe156'], type: 'flame', sp1: 320, l1: 0.6, s1: 10 });
      }
    }
    else if (t < 4.6) { z.x += Math.sin(t * 12) * 60 * dt; } // stumbles around blind
    else {
      z.crownDrop = false;
      game.cut = null;
      z.setState('chase');
      game.setBossStage(1);
    }
    const tx = clamp(z.cx - W * 0.55, 0, game.level.w - W);
    game.cam.x = lerp(game.cam.x, tx, 1 - Math.exp(-4 * dt));
  } else if (c.name === 'spinointro') {
    const t = c.t;
    if (t < 1.6) { // stomps in from the deep valley
      z.x = lerp(5250, 4950, t / 1.6);
      z.facing = -1;
      if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) {
        AudioSys.sfx('thud'); game.shake = Math.max(game.shake, 0.25);
        Particles.burst(z.cx, z.groundY, 6, { colors: ['#7a5230', '#57b84a'], sp1: 130, l1: 0.5, s1: 8, up: 60 });
      }
    }
    else if (t < 2.8) { // the big roar, sail flaring
      if (!c.roared) { c.roared = true; AudioSys.sfx('roar'); game.shake = 0.5; }
      if (chance(0.4)) Particles.burst(z.cx - 90, z.y - 40, 2, { colors: ['#ff9f43', '#ffe156'], type: 'flame', sp1: 200, grav: -120, l1: 0.5, s1: 11 });
    }
    else if (t < 3.7) { // ...then a giant hiccup. Very fierce.
      if (!c.hicced) { c.hicced = true; AudioSys.sfx('hiccup'); z.hiccupT = 0.8; }
    }
    else { game.cut = null; z.setState('chase'); game.setBossStage(1); }
    const tx = clamp(z.cx - W * 0.55, 0, game.level.w - W);
    game.cam.x = lerp(game.cam.x, tx, 1 - Math.exp(-4 * dt));
  } else if (c.name === 'eruption') {
    game.shake = Math.max(game.shake, 0.45);
    if (c.t > 0.5) {
      Particles.candyBurst(4470 + rand(-50, 50), 250, 2);
      if (chance(0.5)) Particles.burst(4470 + rand(-50, 50), 245, 2, { colors: ['#ff9f43', '#ffe156'], type: 'flame', sp1: 240, grav: 300, l1: 1, s1: 11, up: 300 });
    }
    if (c.t > 2.4) {
      game.cut = null;
      game.endPhase = 'party'; game.partyT = 0;
      AudioSys.setMusic('win');
      if (game.zombie) game.zombie.setState('dance');
      game.player.setMood('grin', 999);
    }
  } else if (c.name === 'coronation') {
    const pl = game.player;
    pl.t += dt;
    pl.x += (5190 - pl.x) * Math.min(1, 3 * dt);
    pl.vx = 0; pl.facing = 1;
    pl.y = Math.min(pl.y + 500 * dt, 1000 - pl.h);
    if (c.t > 1 && !c.bells) {
      c.bells = true;
      AudioSys.sfx('bells');
      AudioSys.sfx('fanfare');
    }
    if (c.t > 1 && chance(0.5)) {
      Particles.burst(5100 + rand(0, 400), 480 + rand(0, 80), 2, { colors: RAINBOW.concat(['#fff']), type: 'sparkle', sp1: 40, grav: 220, l0: 1, l1: 2, s1: 9, up: 0 });
    }
    if (c.t > 2.6 && !c.crownOn) {
      c.crownOn = true;
      game.royal = true;
      try { localStorage.setItem('ffbg_royal', '1'); } catch (e) {}
      AudioSys.sfx('chest');
      Particles.burst(pl.cx, pl.y - 10, 20, { colors: ['#ffd24a', '#fff', '#ffe156'], type: 'star', sp1: 300, l1: 0.9, s1: 11 });
    }
    if (c.t > 3.6) {
      game.cut = null;
      game.endPhase = 'party'; game.partyT = 0;
      AudioSys.setMusic('win');
    }
    const tx = clamp(5330 - W * 0.5, 0, game.level.w - W);
    game.cam.x = lerp(game.cam.x, tx, 1 - Math.exp(-3.5 * dt));
    const ty = clamp(pl.cy - H * 0.55, 0, game.level.h - H);
    game.cam.y = lerp(game.cam.y, ty, 1 - Math.exp(-4 * dt));
  } else if (c.name === 'townreveal') {
    // emerging from the cave: one slow wordless pan across the moonlit town —
    // "wait... there are PEOPLE up here?" — then back to the hero
    const sq = clamp(1800 - W / 2, 0, game.level.w - W);
    let tx = 0;
    if (c.t < 1.7) { const k = c.t / 1.7; tx = lerp(0, sq, k * k * (3 - 2 * k)); }
    else if (c.t < 2.6) tx = sq;
    else { const k = clamp((c.t - 2.6) / 1.5, 0, 1); tx = lerp(sq, 0, k * k * (3 - 2 * k)); }
    game.cam.x = tx;
    if (c.t > 4.2 || justP.Space) { game.cut = null; game.cam.x = 0; }
  } else if (c.name === 'rumble') {
    game.shake = Math.max(game.shake, 0.4);
    if (c.t > 1.4) {
      game.chest = new Chest(4450, 620);
      game.cut = { name: 'chestfall', t: 0 };
    }
  } else if (c.name === 'chestfall') {
    if (game.chest) {
      game.chest.update(dt);
      if (game.chest.landed && c.t > 1.2) { game.cut = null; game.endPhase = 'prompt'; }
    }
  }
}
function updateCamera(dt) {
  const lv = game.level, pl = game.player;
  const lead = pl.vehicle === 'truck' ? 180 : 70; // look further ahead at rally speed
  const tx = clamp(pl.cx + pl.facing * lead - W * 0.5, 0, lv.w - W);
  game.cam.x = lerp(game.cam.x, tx, 1 - Math.exp(-(pl.turboT > 0 ? 10 : 6) * dt));
  const ty = lv.h > H ? clamp(pl.cy - H * 0.52, 0, lv.h - H) : 0;
  game.cam.y = lerp(game.cam.y, ty, 1 - Math.exp(-6 * dt));
}
function updatePlay(dt) {
  const lv = game.level, pl = game.player;
  if (game.cut) { updateCut(dt); return; }
  if (lv.boss && !game.zombie && pl.x > (lv.bossX || 3900)) { game.startBossIntro(); return; }

  // treasure chest opening gets first claim on Space
  if (game.endPhase === 'prompt' && justP.Space && game.chest && Math.abs(pl.cx - game.chest.cx) < 150) {
    if (game.chest.tryOpen()) {
      game.endPhase = 'party'; game.partyT = 0;
      AudioSys.setMusic('win');
      if (game.zombie) game.zombie.setState('dance');
      pl.setMood('grin', 999);
      delete justP.Space;
    }
  }

  // coronation happens when you reach the castle
  if (lv.castleX && !game.crowned && pl.x > lv.castleX) { game.startCoronation(); return; }
  // touching the golden star wins the maze
  if (lv.goalStar && !game.mazeDone && (!game.zombie || game.zombie.state === 'friend' || game.zombie.state === 'dance') &&
      Math.hypot(pl.cx - lv.goalStar.x, pl.cy - lv.goalStar.y) < 115) {
    if (typeof lv.n === 'string') {
      const info = stageInfo(lv.n);
      if (info && !game.subReturn) game.worldWin(info.world); // final chain stage
      else game.subWin(); // secret rooms (and any sub-entered replay)
    }
    else if (lv.n === 10) game.jungleWin();
    else game.mazeWin();
  }
  if (game.endPhase !== 'party' || lv.n >= 7) pl.update(dt); // victory laps and flying allowed!
  else {
    pl.t += dt;
    pl.squash = 1 + Math.sin(game.t * 8) * 0.08;
    pl.spin += dt * 3;
  }

  for (const sp of game.spiders) {
    if (sp.dead) continue;
    sp.update(dt);
    if ((sp.state === 'angry' || sp.state === 'burning') && !sp.dead && overlaps(sp, pl)) {
      if (pl.superT > 0) sp.knockAway(pl.cx);
      else pl.damage(1);
    }
  }
  for (const cn of lv.centipedes) {
    cn.update(dt);
    if (cn.touches(pl) && pl.superT <= 0) pl.damage(1);
  }
  if (game.state !== 'play') { Particles.update(0); return; } // died this frame

  for (const pr of game.projectiles) {
    if (pr.dead) continue;
    pr.update(dt);
    if (pr.dead) continue;
    for (const sp of game.spiders) {
      if (sp.dead || sp.state === 'friend' || sp.state === 'flying') continue;
      if (pr.hitSet.has(sp)) continue;
      if (overlaps(pr, sp)) {
        pr.hitSet.add(sp);
        sp.hit(pr.kind);
        if (pr.kind !== 'rainbow') { pr.impact(true); break; }
      }
    }
    if (pr.dead) continue;
    for (const cn of lv.centipedes) {
      if (pr.hitSet.has(cn)) continue;
      if (cn.overlapsRect(pr)) {
        pr.hitSet.add(cn);
        cn.hitBy(pr.kind);
        if (pr.kind !== 'rainbow') { pr.impact(true); break; }
      }
    }
    if (pr.dead) continue;
    const z = game.zombie;
    if (z && game.bossStage > 0 && overlaps(pr, z)) { z.hitBy(pr.kind); pr.impact(true); }
  }

  for (const s of lv.solids) { // block bonk hop + brick-wall hint bubble timers
    if (s.bumpT) s.bumpT = Math.max(0, s.bumpT - dt);
    if (s.hintT) s.hintT = Math.max(0, s.hintT - dt);
  }
  for (const p of game.pickups) p.update(dt);
  for (const c of lv.checks) c.update(dt);
  if (lv.gate) lv.gate.update(dt);
  for (const sd of lv.subDoors) sd.update(dt);
  for (const ed of lv.exitDoors) ed.update(dt);
  if (lv.mission) lv.mission.update(dt, pl);
  if (lv.truckBuild) lv.truckBuild.update(dt, pl);
  if (lv.puzzle) lv.puzzle.update(dt, pl); // secret-room machines (Pipe Room / Torch Cavern / Star Chamber / Treehouse Trail)
  if (lv.ride && lv.ride.state === 'intro') lv.ride.updateIntro(dt, pl); // board pickup watch (js/ride.js)
  if (lv.vines) for (const v of lv.vines) v.update(dt, pl, lv); // swinging jungle vines
  // steam vents (Volcano Escape): idle platform -> bubbling warning -> blast.
  // The eruption phase turns the solid bouncy, and anyone already standing on
  // it gets launched too — timing stays forgiving either way.
  if (lv.vents) {
    for (const v of lv.vents) {
      const prev = v.ventT;
      v.ventT = (v.ventT + dt) % 3.2;
      const erupt = v.ventT >= 2.4;
      v.bouncy = erupt;
      const nearCam = Math.abs(v.x + v.w / 2 - (game.cam.x + W / 2)) < W && Math.abs(v.y - (game.cam.y + H / 2)) < H;
      if (prev < 1.7 && v.ventT >= 1.7 && nearCam) AudioSys.sfx('steam');
      if (prev < 2.4 && v.ventT >= 2.4 && nearCam) AudioSys.sfx('launch');
      if (erupt) {
        if (pl.onGround && pl.vy >= 0 && pl.x + pl.w > v.x && pl.x < v.x + v.w && Math.abs(pl.y + pl.h - v.y) < 8) {
          pl.vy = v.bounceVy || -1400;
          pl.onGround = false;
          pl.squash = 1.45;
          pl.setMood('grin', 1);
          AudioSys.sfx('bounce');
        }
        if (chance(0.5)) Particles.burst(v.x + v.w / 2 + rand(-20, 20), v.y - rand(0, 90), 1, { colors: ['#ffe156', '#ff9f43', '#fff'], type: 'flame', sp1: 90, grav: -160, l1: 0.5, s1: 12, up: 20 });
      }
    }
  }
  // rising lava (Volcano Escape): slow, and it PAUSES whenever it gets close
  // beneath the hero — a friendly menace, never a speedrun timer. Reaching a
  // checkpoint pushes it well back down.
  if (lv.risingLava) {
    const rl = lv.risingLava;
    if (game.checkpoint !== rl.lastCp && game.checkpoint) {
      rl.lastCp = game.checkpoint;
      rl.y = Math.max(rl.y, game.checkpoint.groundY + 420);
    }
    const gap = rl.y - (pl.y + pl.h);
    if (gap > 260) rl.y -= rl.speed * 1.7 * dt; // far below: hustle a little
    else if (gap > 140) rl.y -= rl.speed * dt;  // close: creep
    rl.y = clamp(rl.y, rl.minY, rl.y0);
  }
  // gold rush (Secret Ascent): first landing in the treasure hoard = fanfare
  if (lv.goldRush && !lv.goldRush.done && pl.x < lv.goldRush.x && pl.y < lv.goldRush.y) {
    lv.goldRush.done = true;
    AudioSys.sfx('chest');
    AudioSys.sfx('cheer');
    game.shake = Math.max(game.shake, 0.3);
    pl.setMood('grin', 3);
    Particles.candyBurst(pl.cx, pl.y - 40, 22);
    Particles.burst(pl.cx, pl.y, 22, { colors: ['#ffd24a', '#ffe156', '#fff'], type: 'star', sp1: 400, l0: 0.7, l1: 1.4, s1: 12, grav: 300 });
  }
  // shell switches (Bubble Maze): touch one, its color-matched valve pops
  if (lv.shellSwitches) {
    for (const sw of lv.shellSwitches) {
      if (sw.on || !overlaps(sw, pl)) continue;
      sw.on = true;
      AudioSys.sfx('switch');
      AudioSys.sfx('powerup');
      Particles.burst(sw.x + sw.w / 2, sw.y, 14, { colors: [POW[sw.kind].c, '#fff'], type: 'star', sp1: 240, l1: 0.8, s1: 10 });
      const valve = lv.solids.find(s => s.valve && !s.broken && s.kind === sw.kind);
      if (valve) {
        valve.broken = true;
        Particles.burst(valve.x + valve.w / 2, valve.y + valve.h / 2, 18, { colors: [POW[sw.kind].c, '#fff'], type: 'bubble', sp1: 260, grav: -80, l1: 1, s1: 11 });
        AudioSys.sfx('shatter');
      }
      pl.setMood('grin', 1.2);
    }
  }
  for (const sh of game.shoes) if (!sh.dead) sh.update(dt);
  if (game.zombie && !game.cut) game.zombie.update(dt);
  if (game.chest) game.chest.update(dt);

  if (game.endPhase === 'party') {
    game.partyT += dt;
    for (const sp of game.spiders) if (sp.state === 'friend') sp.danceT = 1;
    if (game.partyT > 1.5 && chance(0.2)) {
      Particles.candyBurst(game.cam.x + rand(150, W - 150), game.cam.y + rand(100, 300), 1);
    }
    if (lv.n === 6 && chance(0.4)) Particles.candyBurst(4470 + rand(-60, 60), 250, 1); // the volcano keeps giving
    if (lv.n === 7) { // the crowd goes wild
      game.cheerT -= dt;
      if (game.cheerT <= 0) {
        game.cheerT = 1.5;
        AudioSys.sfx('cheer');
        Particles.burst(6870 + rand(-260, 260), 470, 10, { colors: RAINBOW, type: 'confetti', sp1: 260, l0: 1, l1: 2, s1: 11, grav: 250, up: 200 });
      }
    }
    if (lv.n === 8) { // royal celebration
      game.cheerT -= dt;
      if (game.cheerT <= 0) {
        game.cheerT = 2;
        AudioSys.sfx('bells');
        Particles.burst(5150 + rand(0, 420), 460, 12, { colors: RAINBOW.concat(['#fff']), type: 'confetti', sp1: 240, l0: 1, l1: 2.2, s1: 11, grav: 220, up: 150 });
      }
    }
    if (lv.n === 10 && chance(0.4)) { // gentle rain of leaves and petals
      Particles.burst(game.cam.x + rand(0, W), game.cam.y - 10, 1, { colors: ['#57d357', '#7be07b', '#ffe156', '#ff8fb0'], type: 'confetti', sp1: 50, l0: 2, l1: 3.5, s1: 11, grav: 90, up: 0 });
    }
    if (lv.n === 9) { // star fireworks in zero-g
      game.cheerT -= dt;
      if (game.cheerT <= 0) {
        game.cheerT = 1.2;
        AudioSys.sfx('candy');
        Particles.burst(game.cam.x + rand(200, W - 200), game.cam.y + rand(100, H - 200), 14, { colors: RAINBOW.concat(['#ffe156', '#fff']), type: 'star', sp1: 300, l0: 0.7, l1: 1.4, s1: 11, grav: 0, up: 0 });
      }
    }
    if (game.partyT > 5 && justP.Space) {
      if (game.subReturn) game.exitSub(); // mini-game over — back to the world
      else if (game.wonWorld) { const w = game.wonWorld; game.wonWorld = 0; if (w < 10) game.startWorld(w + 1); else game.goTitle(); }
      else if (lv.n === 5) game.startLevel(6); // surprise: the bonus world!
      else if (lv.n === 6) game.startWorld(7); // and another one! (via the SAND SLIDE — world 6's chain)
      else if (lv.n === 7) game.startLevel(8); // and one more!
      else if (lv.n === 8) game.startLevel(9); // to infinity!
      else if (lv.n === 9) game.startLevel(10); // ...and beyond, to the dinosaurs!
      else game.goTitle();
    }
  }

  game.projectiles = game.projectiles.filter(p => !p.dead);
  game.shoes = game.shoes.filter(s => !s.dead);
  game.pickups = game.pickups.filter(p => !p.dead || p.bossKind);
  game.spiders = game.spiders.filter(s => !s.dead);
  game.stageHintT = Math.max(0, game.stageHintT - dt);
  updateCamera(dt);
}
function updateTitle(dt) {
  game.titleT += dt;
  if (!game.titlePlayer) {
    game.titlePlayer = new Player(300, 620 - 94);
    game.titleSpider = new Spider(W - 300, 620, 'walk');
    game.titleSpider.state = 'friend';
  }
  const tp = game.titlePlayer, kinds = ['none', 'fire', 'ice', 'rainbow', 'power'];
  game.titleBoyX += game.titleBoyD * 130 * dt;
  if (game.titleBoyX > W - 420) game.titleBoyD = -1;
  if (game.titleBoyX < 160) game.titleBoyD = 1;
  tp.x = game.titleBoyX; tp.facing = game.titleBoyD;
  tp.t += dt; tp.spin += game.titleBoyD * 4.5 * dt;
  tp.power = kinds[Math.floor(game.titleT / 2.5) % kinds.length];
  const ts = game.titleSpider;
  ts.t += dt; ts.danceT = 1;
  // Up/Down (or tapping a portrait) switches the hero
  if (justP.ArrowUp || justP.ArrowDown) game.setCharacter(game.character === 'boy' ? 'girl' : 'boy');
  // secret keyboard combos (justK = physical keys only, so touch can't trigger):
  // Up ×5 fast = unlock all worlds; Down ×5 fast = wipe progress, fresh game
  game.combo.t = Math.max(0, game.combo.t - dt);
  if (justK.ArrowUp || justK.ArrowDown) {
    if (game.combo.t <= 0) { game.combo.up = 0; game.combo.down = 0; }
    game.combo.t = 1.2; // max gap between presses in the streak
    if (justK.ArrowUp) { game.combo.up++; game.combo.down = 0; }
    else { game.combo.down++; game.combo.up = 0; }
    if (game.combo.up >= 5) { game.combo.up = 0; game.combo.t = 0; game.unlockAll(); }
    else if (game.combo.down >= 5) { game.combo.down = 0; game.combo.t = 0; game.resetProgress(); }
  }
  if (game.titleMsg && (game.titleMsg.t -= dt) <= 0) game.titleMsg = null;
  // Left/Right (or tapping a medallion) picks the level to play
  if (justP.ArrowLeft && game.selLevel > 1) { game.selLevel--; AudioSys.sfx('candy'); }
  if (justP.ArrowRight && game.selLevel < game.unlocked) { game.selLevel++; AudioSys.sfx('candy'); }
  // digit keys use the DISPLAYED world numbers 0-9 (0 = the training meadow);
  // internally worlds stay n = 1-10 (saves, buildLevel, harness — display = n-1)
  for (let d = 0; d <= 9; d++) {
    if (justP['Digit' + d] && d + 1 <= game.unlocked) { game.selLevel = d + 1; game.startWorld(d + 1); return; }
  }
  if (justP.Space) game.startWorld(clamp(game.selLevel, 1, game.unlocked));
}
function update(dt) {
  game.t += dt;
  game.shake = Math.max(0, game.shake - dt * 2);
  game.hudPulse = Math.max(0, game.hudPulse - dt * 2);
  game.heartFlash = Math.max(0, game.heartFlash - dt);
  if (justP.KeyM) AudioSys.toggleMute();
  // Escape quits any level back to the title (desktop QoL). justK = physical
  // keyboard only. While fullscreen the browser owns Esc (it exits fullscreen),
  // so that press is ignored — a second Esc then quits the level.
  if (justK.Escape && game.state !== 'title' && !document.fullscreenElement) game.goTitle();
  AudioSys.update();
  switch (game.state) {
    case 'title':
      updateTitle(dt);
      Particles.update(dt);
      break;
    case 'intro':
      game.introT += dt;
      if (game.introT > 2.2 || justP.Space) game.state = 'play';
      break;
    case 'play':
      updatePlay(dt);
      Particles.update(dt);
      break;
    case 'dead':
      game.deadT += dt;
      Particles.update(dt);
      if (game.deadT > 0.8 && justP.Space) game.respawnPlayer();
      break;
    case 'caught': {
      const c = game.caught, pl = game.player;
      c.t += dt;
      const k = Math.min(1, c.t / 1.6);
      pl.x = lerp(c.fromX, c.tx, k);
      pl.y = lerp(c.fromY, c.ty - 10, 1 - Math.pow(1 - k, 2));
      pl.vy = 0; pl.t += dt;
      Particles.update(dt);
      updateCamera(dt);
      if (c.t >= 1.75) { game.state = 'play'; pl.inv = 1; game.caught = null; }
      break;
    }
    case 'complete':
      game.completeT += dt;
      Particles.update(dt);
      if (game.completeT > 2.4) {
        if (game.level.n < 5) game.startWorld(game.level.n + 1);
        else game.goTitle();
      }
      break;
    case 'stageclear': // the light between-stages beat (linear chains)
      game.completeT += dt;
      Particles.update(dt);
      if (game.completeT > 2.4) game.startLevel(game.nextStage);
      break;
  }
  endFrameInput();
}

// ================================================================ render
function drawLevelIcon(ctx, x, y, s, theme, t) {
  ctx.save();
  ctx.translate(x, y);
  if (theme === 'meadow') {
    ctx.fillStyle = '#ff5a8a';
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 + t * 0.4;
      ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55, s * 0.38, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#ffe156';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.36, 0, TAU); ctx.fill();
    drawFace(ctx, 0, 0, s * 0.5, 'happy', t, 21);
  } else if (theme === 'water') {
    ctx.fillStyle = '#ff9f43';
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.8, s * 0.5, 0, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, 0); ctx.lineTo(-s * 1.15, -s * 0.4); ctx.lineTo(-s * 1.15, s * 0.4);
    ctx.closePath(); ctx.fill();
    drawFace(ctx, s * 0.25, 0, s * 0.55, 'happy', t, 22);
  } else if (theme === 'cloud') {
    ctx.lineWidth = s * 0.16;
    RAINBOW.slice(0, 4).forEach((c, i) => {
      ctx.strokeStyle = c;
      ctx.beginPath(); ctx.arc(0, s * 0.7, s * (1 - i * 0.16), Math.PI, TAU); ctx.stroke();
    });
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-s * 0.8, s * 0.55, s * 0.42, 0, TAU);
    ctx.arc(s * 0.8, s * 0.55, s * 0.42, 0, TAU);
    ctx.fill();
  } else if (theme === 'mountain') {
    ctx.fillStyle = '#8d8fa0';
    ctx.beginPath();
    ctx.moveTo(-s, s * 0.8); ctx.lineTo(0, -s * 0.9); ctx.lineTo(s, s * 0.8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s * 0.36); ctx.lineTo(0, -s * 0.9); ctx.lineTo(s * 0.3, -s * 0.36);
    ctx.lineTo(s * 0.15, -s * 0.45); ctx.lineTo(0, -s * 0.3); ctx.lineTo(-s * 0.15, -s * 0.45);
    ctx.closePath(); ctx.fill();
  } else if (theme === 'lava') {
    ctx.fillStyle = '#4a1410';
    ctx.beginPath();
    ctx.moveTo(-s, s * 0.8); ctx.lineTo(-s * 0.3, -s * 0.7); ctx.lineTo(s * 0.3, -s * 0.7); ctx.lineTo(s, s * 0.8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff8a2b';
    ctx.beginPath(); ctx.ellipse(0, -s * 0.68, s * 0.32, s * 0.12, 0, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.16, -s * 0.62); ctx.quadraticCurveTo(-s * 0.3, s * 0.1, -s * 0.2, s * 0.5);
    ctx.lineTo(0, s * 0.5); ctx.quadraticCurveTo(-s * 0.05, 0, -s * 0.02, -s * 0.62);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe156';
    ctx.beginPath(); ctx.arc(0, -s * 0.95 - Math.abs(Math.sin(t * 3)) * s * 0.2, s * 0.14, 0, TAU); ctx.fill();
  } else if (theme === 'dirt') {
    ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.6, s); ctx.lineTo(-s * 0.6, -s * 0.95); ctx.stroke();
    for (let r2 = 0; r2 < 2; r2++) {
      for (let c2 = 0; c2 < 3; c2++) {
        ctx.fillStyle = (r2 + c2) % 2 ? '#3a2a3a' : '#fff';
        ctx.fillRect(-s * 0.55 + c2 * s * 0.38, -s * 0.95 + r2 * s * 0.34 + Math.sin(t * 3 + c2) * s * 0.05, s * 0.38, s * 0.34);
      }
    }
  } else if (theme === 'forest') {
    ctx.fillStyle = '#fdf6ff';
    rr(ctx, -s * 0.85, -s * 0.4, s * 0.55, s * 1.3, s * 0.1); ctx.fill();
    rr(ctx, s * 0.3, -s * 0.4, s * 0.55, s * 1.3, s * 0.1); ctx.fill();
    rr(ctx, -s * 0.45, -s * 0.05, s * 0.9, s * 0.95, s * 0.1); ctx.fill();
    ctx.fillStyle = '#b06cf0';
    for (const tx4 of [-s * 0.58, s * 0.58]) {
      ctx.beginPath();
      ctx.moveTo(tx4 - s * 0.4, -s * 0.4); ctx.lineTo(tx4, -s * 0.95); ctx.lineTo(tx4 + s * 0.4, -s * 0.4);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#8a5fd0';
    ctx.beginPath();
    ctx.arc(0, s * 0.5, s * 0.28, Math.PI, TAU);
    ctx.rect(-s * 0.28, s * 0.5, s * 0.56, s * 0.4);
    ctx.fill();
    ctx.fillStyle = '#ff8fb0';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.75); ctx.lineTo(s * 0.35, -s * 0.62); ctx.lineTo(0, -s * 0.5);
    ctx.closePath(); ctx.fill();
  } else if (theme === 'space') {
    ctx.fillStyle = '#4aa3ff';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.62, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a5fd0';
    ctx.beginPath(); ctx.arc(-s * 0.2, -s * 0.15, s * 0.18, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.22, s * 0.22, s * 0.13, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = s * 0.16;
    ctx.beginPath(); ctx.ellipse(0, s * 0.08, s * 1, s * 0.3, -0.3, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ffe156';
    starPath(ctx, s * 0.72, -s * 0.72, s * 0.26, s * 0.12, 5, t);
    ctx.fill();
  } else if (theme === 'jungle') {
    // little green dino head peeking over a leaf
    ctx.fillStyle = '#57c25c';
    ctx.beginPath(); ctx.arc(0, -s * 0.1, s * 0.55, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.02, s * 0.3, s * 0.22, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2f8a3c';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.45 + i * s * 0.3, -s * 0.5);
      ctx.lineTo(-s * 0.3 + i * s * 0.3, -s * 0.85);
      ctx.lineTo(-s * 0.15 + i * s * 0.3, -s * 0.5);
      ctx.closePath(); ctx.fill();
    }
    drawFace(ctx, -s * 0.05, -s * 0.08, s * 0.55, 'happy', t, 45);
    ctx.fillStyle = '#3f9c3a';
    ctx.beginPath(); ctx.ellipse(0, s * 0.72, s * 0.85, s * 0.28, 0, Math.PI, TAU); ctx.fill();
  } else if (theme === 'cave') {
    ctx.fillStyle = '#cfc8e0';
    rr(ctx, -s * 0.7, -s * 0.8, s * 1.4, s * 1.2, s * 0.35); ctx.fill();
    ctx.fillStyle = '#3a2a55';
    ctx.beginPath(); ctx.arc(-s * 0.3, -s * 0.3, s * 0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.3, -s * 0.3, s * 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-s * 0.2, s * 0.05, s * 0.17, s * 0.3);
    ctx.fillRect(s * 0.03, s * 0.05, s * 0.17, s * 0.3);
  }
  ctx.restore();
}
function drawHints(ctx, lv, t) {
  for (const h of lv.hints) {
    if (h.x < game.cam.x - 220 || h.x > game.cam.x + W + 220) continue;
    const top = h.y + 46;
    const gt = groundTopAt(lv, h.x);
    if (gt !== null && gt > top) {
      ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(h.x, gt); ctx.lineTo(h.x, top); ctx.stroke();
    }
    const bw = (h.icon === 'arrows' || h.icon === 'updown') ? 150 : h.icon === 'space' ? 175 : 95;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    rr(ctx, h.x - bw / 2, h.y - 46, bw, 92, 16); ctx.fill();
    ctx.strokeStyle = '#8a7fae'; ctx.lineWidth = 4;
    rr(ctx, h.x - bw / 2, h.y - 46, bw, 92, 16); ctx.stroke();
    if (h.icon === 'arrows') { drawKeycap(ctx, h.x - 33, h.y, 52, 'left', t); drawKeycap(ctx, h.x + 33, h.y, 52, 'right', t + 0.5); }
    else if (h.icon === 'updown') { drawKeycap(ctx, h.x - 33, h.y, 52, 'up', t); drawKeycap(ctx, h.x + 33, h.y, 52, 'down', t + 0.5); }
    else if (h.icon === 'up') drawKeycap(ctx, h.x, h.y, 56, 'up', t);
    else if (h.icon === 'space') drawSpacebar(ctx, h.x, h.y, 135, t);
    else if (h.icon === 'power') drawBlock(ctx, h.x - 27, h.y - 27, 54, 'power', t, { wobble: true });
  }
}
function drawCatchCloud(c) {
  const pl = game.player, t = game.t;
  const cx = pl.cx, cy = pl.y + pl.h + 20;
  c.fillStyle = 'rgba(255,255,255,0.95)';
  c.beginPath();
  c.arc(cx, cy, 42, 0, TAU);
  c.arc(cx - 40, cy + 8, 28, 0, TAU);
  c.arc(cx + 40, cy + 8, 28, 0, TAU);
  c.fill();
  drawFace(c, cx, cy + 2, 38, 'happy', t, 55);
}
function drawDarkness() {
  const cam = game.cam, lv = game.level;
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, W, H);
  lctx.fillStyle = 'rgba(8,4,22,0.84)';
  lctx.fillRect(0, 0, W, H);
  lctx.globalCompositeOperation = 'destination-out';
  const light = (wx, wy, r, a = 1) => {
    const x = wx - cam.x, y = wy - cam.y;
    if (x < -r || x > W + r || y < -r || y > H + r) return;
    const g = lctx.createRadialGradient(x, y, r * 0.12, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,' + a + ')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    lctx.fillStyle = g;
    lctx.beginPath(); lctx.arc(x, y, r, 0, TAU); lctx.fill();
  };
  const pl = game.player;
  light(pl.cx, pl.cy, 310);
  for (const c of lv.decor.crystals || []) light(c.x, c.y - 20, 155, 0.85);
  for (const p of game.pickups) if (!p.dead) light(p.cx, p.cy, 130, 0.9);
  for (const pr of game.projectiles) light(pr.cx, pr.cy, 150);
  for (const c of lv.checks) light(c.x, c.y + 30, 130, 0.85);
  for (const sd of lv.subDoors) {
    light(sd.cx, sd.cy, 170, 0.9); // secrets must be findable in the dark
    if (sd.style === 'moonwell') light(sd.cx, sd.cy - 300, 280, 0.75); // the moonbeam glows all the way up
  }
  if (lv.puzzle && lv.puzzle.lights) for (const L of lv.puzzle.lights()) light(L.x, L.y, L.r, L.a ?? 1);
  if (game.zombie) light(game.zombie.cx, game.zombie.cy, 260, 0.9);
  if (game.chest) light(game.chest.cx, game.chest.y + 40, 340);
  if (game.endPhase === 'party') light(cam.x + W / 2, cam.y + H / 2, 950);
  ctx.drawImage(lightCv, 0, 0);
}
function drawTouchUI() {
  if (!TouchUI.enabled) return;
  const t = game.t;
  // fullscreen button (only where the browser allows it)
  if (TouchUI.fsAvailable()) {
    const f = TouchUI.fsBtn;
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8a7fae'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#5a4a86'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    const s = f.r * 0.42;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath();
      ctx.moveTo(f.x + dx * s, f.y + dy * s * 0.4);
      ctx.lineTo(f.x + dx * s, f.y + dy * s);
      ctx.lineTo(f.x + dx * s * 0.4, f.y + dy * s);
      ctx.stroke();
    }
    ctx.restore();
  }
  for (const b of TouchUI.layout()) {
    const held = keys[b.key];
    ctx.save();
    ctx.globalAlpha = held ? 0.85 : 0.4;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = held ? '#ffa726' : '#8a7fae';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#5a4a86';
    if (b.glyph === 'star') {
      starPath(ctx, b.x, b.y, b.r * 0.5, b.r * 0.24, 5, -Math.PI / 2 + Math.sin(t) * 0.1);
      ctx.fill();
    } else {
      const dirs = { left: Math.PI, right: 0, up: -Math.PI / 2, down: Math.PI / 2 };
      ctx.translate(b.x, b.y); ctx.rotate(dirs[b.glyph]);
      ctx.beginPath();
      ctx.moveTo(b.r * 0.45, 0); ctx.lineTo(-b.r * 0.22, -b.r * 0.42); ctx.lineTo(-b.r * 0.22, b.r * 0.42);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}
function drawHUD() {
  const t = game.t, pl = game.player;
  for (let i = 0; i < 3; i++) {
    const sc = 26 * (game.heartFlash > 0 ? 1 + game.heartFlash * 0.25 : 1);
    drawHeartIcon(ctx, 48 + i * 62, 52, sc, i < pl.hearts, t + i * 0.4);
  }
  // candy counter
  drawCandy(ctx, W - 205, 48, 21, 1, t);
  outlineText(ctx, '× ' + game.candy, W - 262, 50, 32, '#ffd24a', '#5a4a86');
  if (game.level.flight) { // wordless star tally for Sky Flight
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.globalAlpha = i < game.flightStars ? 1 : 0.3;
      ctx.fillStyle = i < game.flightStars ? '#ffd24a' : '#fff';
      starPath(ctx, W / 2 - 96 + i * 48, 52, 16, 7);
      ctx.fill();
      if (i < game.flightStars) { ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 2.5; ctx.stroke(); }
      ctx.restore();
    }
  }
  // current block
  const bx = W - 88, by = 64;
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(bx, by, 46 + game.hudPulse * 8, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#8a7fae'; ctx.lineWidth = 4; ctx.stroke();
  ctx.restore();
  const bs = 60 + game.hudPulse * 14;
  drawBlock(ctx, bx - bs / 2, by - bs / 2, bs, pl.superT > 0 ? 'power' : pl.power, t);
  if (pl.superT > 0) {
    ctx.strokeStyle = '#ffa726'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(bx, by, 53, -Math.PI / 2, -Math.PI / 2 + TAU * (pl.superT / 6)); ctx.stroke();
  }
}
function drawIntroCard() {
  const t = game.introT, lv = game.level;
  const k = Math.min(1, t * 3);
  ctx.save();
  ctx.globalAlpha = 0.5 * k;
  ctx.fillStyle = '#1a1030'; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  const y = H / 2 - 400 * (1 - k);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  rr(ctx, W / 2 - 330, y - 140, 660, 280, 30); ctx.fill();
  ctx.strokeStyle = '#8a7fae'; ctx.lineWidth = 6;
  rr(ctx, W / 2 - 330, y - 140, 660, 280, 30); ctx.stroke();
  // worlds are shown as 0-9 (display = internal n - 1); mini-games get a label
  outlineText(ctx, typeof lv.n === 'number' ? 'LEVEL ' + (lv.n - 1) : 'MINI-GAME!', W / 2, y - 75, 56, '#ffd24a', '#5a4a86');
  outlineText(ctx, lv.name, W / 2, y, 44, '#5a4a86', '#fff');
  drawLevelIcon(ctx, W / 2, y + 85, 38, lv.theme, game.t);
  ctx.restore();
}
function drawDeadOverlay() {
  const t = game.deadT;
  ctx.fillStyle = 'rgba(20,10,40,' + Math.min(0.45, t) + ')';
  ctx.fillRect(0, 0, W, H);
  if (t > 0.6) {
    const y = H / 2 - 40 + Math.sin(game.t * 3) * 6;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    rr(ctx, W / 2 - 300, y - 95, 600, 200, 30); ctx.fill();
    ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 7;
    rr(ctx, W / 2 - 300, y - 95, 600, 200, 30); ctx.stroke();
    outlineText(ctx, 'TRY AGAIN!', W / 2, y - 30, 62, '#ff5a5a', '#fff');
    drawSpacebar(ctx, W / 2, y + 58, 150, game.t);
  }
}
function drawCompleteOverlay() {
  const t = game.completeT, k = Math.min(1, t * 3);
  ctx.save();
  ctx.globalAlpha = 0.4 * k;
  ctx.fillStyle = '#1a1030'; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const y = H / 2;
  ctx.save();
  ctx.translate(W / 2, y - 20);
  ctx.rotate(game.t * 0.6);
  ctx.fillStyle = 'rgba(255,225,86,' + 0.5 * k + ')';
  starPath(ctx, 0, 0, 240 * k, 115 * k, 8);
  ctx.fill();
  ctx.restore();
  outlineText(ctx, 'HOORAY!', W / 2, y - 30, 82, '#ffe156', '#5a4a86');
  if (game.level.n < 5) drawLevelIcon(ctx, W / 2, y + 80, 38, LEVEL_META[game.level.n + 1].theme, game.t);
}
function drawStageClearOverlay() {
  const t = game.completeT, k = Math.min(1, t * 3);
  ctx.save();
  ctx.globalAlpha = 0.35 * k;
  ctx.fillStyle = '#1a1030'; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const y = H / 2;
  ctx.save();
  ctx.translate(W / 2, y - 20);
  ctx.rotate(game.t * 0.6);
  ctx.fillStyle = 'rgba(255,225,86,' + 0.45 * k + ')';
  starPath(ctx, 0, 0, 200 * k, 95 * k, 8);
  ctx.fill();
  ctx.restore();
  const meta = LEVEL_META[game.nextStage];
  outlineText(ctx, 'STAGE CLEAR!', W / 2, y - 50, 66, '#7be07b', '#2a4a2a');
  if (meta) outlineText(ctx, meta.name, W / 2, y + 40, 44, '#ffe156', '#5a4a86');
}
function drawPartyOverlay() {
  const t = game.partyT;
  if (t > 0.8) {
    const k = Math.min(1, (t - 0.8) * 2);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * -60);
    if (game.level.n === 'cloudclimb') {
      outlineText(ctx, 'SKY SUMMIT!', W / 2, 140, 80, '#8fd0ff', '#3a5a86');
      outlineText(ctx, 'YOU CLIMBED ABOVE THE CLOUDS!', W / 2, 212, 36, '#fff', '#3a5a86');
    } else if (game.level.n === 'ascent') {
      outlineText(ctx, 'SECRET SUMMIT!', W / 2, 140, 78, '#ffd24a', '#5a4a86');
      outlineText(ctx, 'YOU FOUND THE HIDDEN MOUNTAIN!', W / 2, 212, 34, '#fff', '#5a4a86');
    } else if (game.level.n === 'volcanoescape') {
      outlineText(ctx, 'VOLCANO ESCAPE!', W / 2, 140, 76, '#ff9f43', '#5a1a10');
      outlineText(ctx, 'YOU BURST OUT OF THE VOLCANO!', W / 2, 212, 34, '#ffe156', '#5a1a10');
    } else if (game.level.n === 'bubblemaze') {
      outlineText(ctx, 'THE GIANT PEARL!', W / 2, 140, 76, '#e8ecff', '#2a4a86');
      outlineText(ctx, 'YOU SOLVED THE BUBBLE MAZE!', W / 2, 212, 34, '#7fd8ff', '#2a4a86');
    } else if (game.level.n === 'piperoom') {
      outlineText(ctx, 'THE CANDY MACHINE!', W / 2, 140, 76, '#ffd24a', '#5a4a86');
      outlineText(ctx, 'YOU FIXED ALL THE PIPES!', W / 2, 212, 34, '#7fd8ff', '#5a4a86');
    } else if (game.level.n === 'torchcave') {
      outlineText(ctx, 'BABY ZOMBIE PARTY!', W / 2, 140, 74, '#7be07b', '#3d3766');
      outlineText(ctx, 'THE SPOOKY CAVE WAS A SLUMBER PARTY!', W / 2, 212, 32, '#ffe156', '#3d3766');
    } else if (game.level.n === 'zerog') {
      outlineText(ctx, game.character === 'girl' ? 'BECCA IN THE STARS!' : 'JACK-JACK IN THE STARS!', W / 2, 140, 66, '#ffe156', '#3d3766');
      outlineText(ctx, 'YOU BUILT THE CONSTELLATION!', W / 2, 212, 34, '#7fd8ff', '#3d3766');
    } else if (game.level.n === 'zombietown') {
      outlineText(ctx, 'MIDNIGHT HERO!', W / 2, 140, 76, '#ffe156', '#2a2150');
      outlineText(ctx, 'THE ZOMBIES ARE HAVING A PARTY!', W / 2, 212, 34, '#9fe07b', '#2a2150');
    } else if (game.level.n === 'beatbash') {
      outlineText(ctx, 'PIT STOP SUPERSTAR!', W / 2, 140, 74, '#ffb62b', '#3a3448');
      outlineText(ctx, 'YOU GOT THE WHOLE GARAGE ROCKING!', W / 2, 212, 34, '#ffe156', '#3a3448');
    } else if (game.level.n === 'treehouse') {
      outlineText(ctx, 'BEST MONKEY FRIENDS!', W / 2, 140, 68, '#ffd24a', '#2f5a2a');
      outlineText(ctx, 'YOU RANG THE GREAT BANANA BELL!', W / 2, 212, 34, '#7be07b', '#2f5a2a');
    } else if (game.level.n === 'skyflight') {
      outlineText(ctx, 'TO THE MOON!', W / 2, 132, 80, '#ffe9a0', '#5a4a86');
      for (let i = 0; i < 5; i++) { // the stars you gathered on the way
        ctx.fillStyle = i < game.flightStars ? '#ffd24a' : 'rgba(255,255,255,0.35)';
        starPath(ctx, W / 2 - 120 + i * 60, 210, 22, 10, 5, -Math.PI / 2 + Math.sin(game.t * 2 + i) * 0.15);
        ctx.fill();
        if (i < game.flightStars) { ctx.strokeStyle = '#c8861b'; ctx.lineWidth = 3; ctx.stroke(); }
      }
      if (game.flightStars >= 5) outlineText(ctx, 'ALL THE STARS!', W / 2, 268, 36, '#ffd24a', '#5a4a86');
    } else if (game.level.n === 10) {
      outlineText(ctx, 'SECRET DINO VALLEY!', W / 2, 135, 68, '#7be07b', '#2f5a2a');
      outlineText(ctx, 'DINO FRIENDS FOREVER!', W / 2, 210, 42, '#ffe156', '#2f5a2a');
    } else if (game.level.n === 9) {
      outlineText(ctx, 'MAZE MASTER!', W / 2, 140, 80, '#ffe156', '#3d3766');
      ctx.fillStyle = '#ffd24a';
      starPath(ctx, W / 2, 225, 34, 15, 5, -Math.PI / 2 + Math.sin(game.t * 2) * 0.2);
      ctx.fill();
    } else if (game.level.n === 8) {
      outlineText(ctx, game.character === 'girl' ? 'YOU ARE A PRINCESS!' : 'YOU ARE A PRINCE!', W / 2, 140, 66, '#ffd24a', '#8a5fd0');
      drawCrown(ctx, W / 2, 220, 26);
    } else if (game.level.n === 7) {
      outlineText(ctx, 'CANDY TROPHY!', W / 2, 130, 76, '#ffd24a', '#5a4a86');
      outlineText(ctx, 'YOU WIN THE RACE!', W / 2, 205, 44, '#fff', '#5a4a86');
    } else if (game.level.n === 6) {
      outlineText(ctx, 'CANDY VOLCANO!', W / 2, 150, 80, '#ffd24a', '#8a2a10');
    } else {
      outlineText(ctx, 'YOU FOUND THE', W / 2, 130, 52, '#ffd24a', '#5a4a86');
      outlineText(ctx, 'GOLDEN CANDY TREASURE!', W / 2, 205, 62, '#ffd24a', '#5a4a86');
    }
    ctx.restore();
  }
  if (t > 5) drawSpacebar(ctx, W / 2, H - 70, 130, game.t);
}
function renderWorld() {
  const lv = game.level, cam = game.cam, t = game.t;
  drawBG(ctx, lv, cam, t);
  ctx.save();
  let sx = 0, sy = 0;
  if (game.shake > 0) { sx = rand(-1, 1) * game.shake * 14; sy = rand(-1, 1) * game.shake * 10; }
  ctx.translate(-Math.round(cam.x - sx), -Math.round(cam.y - sy));
  // secret-room machines may paint a whole room interior BEHIND the solids and
  // goal star (the Beat Bash garage walls/roller door live here)
  if (lv.puzzle && lv.puzzle.drawBack) lv.puzzle.drawBack(ctx, t);
  if (lv.ride) lv.ride.drawBack(ctx, t); // ride-mode heightfield terrain
  drawSolids(ctx, lv, cam, t);
  drawHints(ctx, lv, t);
  for (const c of lv.checks) c.draw(ctx);
  if (lv.gate) lv.gate.draw(ctx);
  for (const sd of lv.subDoors) sd.draw(ctx);
  for (const ed of lv.exitDoors) ed.draw(ctx);
  if (lv.mission) lv.mission.draw(ctx, t);
  if (lv.truckBuild) lv.truckBuild.draw(ctx, t);
  if (lv.puzzle) lv.puzzle.draw(ctx, t);
  if (lv.ride) lv.ride.draw(ctx, t);
  if (lv.vines) for (const v of lv.vines) v.draw(ctx, t);
  for (const p of game.pickups) p.draw(ctx);
  for (const cn of lv.centipedes) cn.draw(ctx);
  for (const sp of game.spiders) sp.draw(ctx);
  if (game.chest) game.chest.draw(ctx);
  if (game.zombie) game.zombie.draw(ctx);
  for (const sh of game.shoes) sh.draw(ctx);
  for (const pr of game.projectiles) pr.draw(ctx);
  if (game.state === 'dead') {
    if (game.deathPos) game.player.drawSitting(ctx, game.deathPos.x, game.deathPos.y - 58);
  } else {
    if (lv.ride && lv.ride.state !== 'intro') {
      // riding: board underfoot, whole hero spins with the trick combo
      const pl = game.player, rm = lv.ride.ride;
      ctx.save();
      ctx.translate(pl.cx, pl.cy);
      ctx.rotate(rm.spin);
      if (rm.trickN >= 3) ctx.translate(0, -6 - Math.sin(game.t * 12) * 4); // superman wobble
      ctx.translate(-pl.cx, -pl.cy);
      drawBoogieBoard(ctx, pl.cx, pl.y + pl.h + 4, 96, game.t);
      game.player.draw(ctx);
      ctx.restore();
      if (rm.trickN >= 4 && chance(0.5)) Particles.burst(pl.cx, pl.cy, 2, { colors: RAINBOW, type: 'star', sp1: 120, l1: 0.5, s1: 8 });
    } else game.player.draw(ctx);
  }
  if (game.state === 'caught') drawCatchCloud(ctx);
  Particles.draw(ctx);
  if (game.cut && game.cut.name === 'bossintro' && game.zombie) {
    const z = game.zombie;
    if (game.cut.t >= 1.4 && game.cut.t < 2.6) outlineText(ctx, 'RAWR!', z.cx, z.y - 80, 62, '#ff5a5a', '#fff');
    else if (game.cut.t >= 2.6 && game.cut.t < 3.3) outlineText(ctx, '...hic!', z.cx, z.y - 80, 42, '#ffe156', '#5a4a86');
  }
  if (game.cut && game.cut.name === 'coronation') {
    const k = clamp((game.cut.t - 1) / 1.6, 0, 1);
    if (k > 0 && k < 1) {
      const ck = 1 - Math.pow(1 - k, 2);
      drawCrown(ctx, game.player.cx, lerp(game.cam.y + 240, game.player.y - 22, ck), 24 - ck * 9);
    }
  }
  if (game.cut && game.cut.name === 'magmaintro' && game.zombie) {
    const z = game.zombie;
    if (game.cut.t >= 1.5 && game.cut.t < 2.7) outlineText(ctx, 'BLORP!', z.cx, z.y - 90, 62, '#ff9f43', '#fff');
    else if (game.cut.t >= 2.7 && game.cut.t < 3.5) outlineText(ctx, 'AH-CHOO!', z.cx, z.y - 90, 48, '#ffe156', '#8a2a10');
    else if (game.cut.t >= 3.5 && game.cut.t < 4.6) outlineText(ctx, '?!', z.cx, z.y - 90, 54, '#fff', '#8a2a10');
  }
  if (game.cut && game.cut.name === 'spinointro' && game.zombie) {
    const z = game.zombie;
    if (game.cut.t >= 1.7 && game.cut.t < 2.7) outlineText(ctx, 'RAWR!', z.cx, z.y - 100, 64, '#ff6b35', '#fff');
    else if (game.cut.t >= 2.9 && game.cut.t < 3.6) outlineText(ctx, '...HIC!', z.cx, z.y - 100, 46, '#ffe156', '#2a7a64');
  }
  if (game.endPhase === 'prompt' && game.chest && game.chest.landed && !game.chest.open) {
    drawSpacebar(ctx, game.chest.cx, game.chest.y - 70, 120, t);
  }
  if (game.stageHintT > 0 && game.bossStage > 0) {
    for (const p of game.bossPickups) {
      if (p.dead) continue;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      const ay = p.cy - 76 + Math.sin(t * 6) * 9;
      ctx.beginPath();
      ctx.moveTo(p.cx, ay); ctx.lineTo(p.cx, ay + 32);
      ctx.moveTo(p.cx - 11, ay + 19); ctx.lineTo(p.cx, ay + 34); ctx.lineTo(p.cx + 11, ay + 19);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
  if (lv.dark) drawDarkness();
  drawHUD();
  if (game.state === 'intro') drawIntroCard();
  if (game.state === 'dead') drawDeadOverlay();
  if (game.state === 'complete') drawCompleteOverlay();
  if (game.state === 'stageclear') drawStageClearOverlay();
  if (game.endPhase === 'party') drawPartyOverlay();
  drawTouchUI();
}
function renderTitle() {
  const t = game.titleT;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#6ec6ff'); g.addColorStop(1, '#c9f0ff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // sun
  const sx = 1120, sy = 100;
  ctx.fillStyle = '#ffe156';
  ctx.beginPath(); ctx.arc(sx, sy, 50, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ffe156'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (let i = 0; i < 10; i++) {
    const a = i * TAU / 10 + t * 0.25;
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(a) * 60, sy + Math.sin(a) * 60);
    ctx.lineTo(sx + Math.cos(a) * 78, sy + Math.sin(a) * 78);
    ctx.stroke();
  }
  drawFace(ctx, sx, sy, 50, 'happy', t, 11);
  // drifting clouds
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 300 + t * 22) % (W + 240)) - 120, cy = 90 + (i % 3) * 70;
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, TAU); ctx.arc(cx + 28, cy + 6, 24, 0, TAU); ctx.arc(cx - 28, cy + 8, 22, 0, TAU);
    ctx.fill();
  }
  // ground
  ctx.fillStyle = '#b07845'; ctx.fillRect(0, 650, W, H - 650);
  ctx.fillStyle = '#5ecb4a';
  rr(ctx, -20, 616, W + 40, 40, 8); ctx.fill();
  // title
  outlineText(ctx, 'BLOCK BUDDIES', W / 2, 145 + Math.sin(t * 2) * 5, 92, '#ffd24a', '#5a4a86');
  outlineText(ctx, 'The Adventures of Jack-Jack and Becca', W / 2, 232 + Math.sin(t * 2 + 0.6) * 4, 40, '#ff8fb0', '#5a4a86');
  // bouncing blocks
  ['fire', 'ice', 'rainbow', 'power'].forEach((k, i) => {
    const bx = W / 2 - 165 + i * 110;
    const by = 330 - Math.abs(Math.sin(t * 3 + i * 0.7)) * 28;
    drawBlock(ctx, bx - 32, by - 32, 64, k, t, { wobble: true, seed: i * 3 });
  });
  // characters
  if (game.titlePlayer) game.titlePlayer.draw(ctx);
  if (game.titleSpider) game.titleSpider.draw(ctx);
  // hero picker: two portraits, Up/Down or tap to switch
  for (const pt of PORTRAITS) {
    const sel = game.character === pt.who;
    ctx.save();
    if (sel) {
      ctx.globalAlpha = 0.45 + 0.2 * Math.sin(t * 4);
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r + 12, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = sel ? '#fff' : 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = sel ? '#ffa726' : '#8a7fae'; ctx.lineWidth = sel ? 6 : 4;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, TAU); ctx.stroke();
    drawHead(ctx, pt.x, pt.y + 4, pt.who, t, sel);
    outlineText(ctx, pt.who === 'girl' ? 'BECCA' : 'JACK-JACK', pt.x, pt.y + pt.r + 16, 17, sel ? '#ffe156' : '#fff', '#5a4a86');
    ctx.restore();
  }
  drawKeycap(ctx, 259, 538, 36, 'up', t);
  drawKeycap(ctx, 259, 582, 36, 'down', t + 0.5);
  // press space
  drawSpacebar(ctx, W / 2, 475, 175, t, false);
  ctx.save();
  ctx.globalAlpha = 0.7 + Math.sin(t * 4) * 0.3;
  outlineText(ctx, 'PRESS SPACE', W / 2, 545, 34, '#fff', '#5a4a86');
  ctx.restore();
  // world medallions: Left/Right or tap to pick where to play
  drawKeycap(ctx, W / 2 - 458, 688, 40, 'left', t);
  drawKeycap(ctx, W / 2 + 458, 688, 40, 'right', t + 0.5);
  for (let i = 1; i <= 10; i++) {
    const m = medalPos(i);
    const open = i <= game.unlocked;
    const sel = i === game.selLevel && open;
    const my = m.y - (sel ? 6 : 0);
    if (sel) {
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 5);
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.arc(m.x, my, m.r + 10, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = open ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.arc(m.x, my, m.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = sel ? '#ffa726' : open ? '#ffd24a' : '#8a8a9a'; ctx.lineWidth = sel ? 5 : 4;
    ctx.beginPath(); ctx.arc(m.x, my, m.r, 0, TAU); ctx.stroke();
    if (open) {
      drawLevelIcon(ctx, m.x, my, 15, LEVEL_META[i].theme, t);
      // number badge
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(m.x + 22, my - 22, 11, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8a7fae'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(m.x + 22, my - 22, 11, 0, TAU); ctx.stroke();
      outlineText(ctx, String(i - 1), m.x + 22, my - 21, 16, '#5a4a86', '#fff'); // displayed 0-9
    } else {
      ctx.fillStyle = '#8a8a9a';
      rr(ctx, m.x - 10, my - 6, 20, 15, 4); ctx.fill();
      ctx.strokeStyle = '#8a8a9a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(m.x, my - 7, 7, Math.PI, TAU); ctx.stroke();
    }
  }
  // combo feedback banner (unlock-all / reset)
  if (game.titleMsg) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, game.titleMsg.t * 1.5);
    outlineText(ctx, game.titleMsg.text, W / 2, 398 - Math.sin(t * 5) * 4, 54, '#ffe156', '#5a4a86');
    ctx.restore();
  }
  // tiny version stamp (also handy for verifying live deploys)
  outlineText(ctx, 'v' + GAME_VERSION, 46, H - 14, 15, 'rgba(255,255,255,0.8)', '#5a4a86');
  Particles.draw(ctx);
  drawTouchUI();
}
function drawHead(ctx, x, y, who, t, sel) {
  ctx.fillStyle = '#ffcf9f';
  ctx.beginPath(); ctx.arc(x, y, 22, 0, TAU); ctx.fill();
  if (who === 'girl') {
    ctx.fillStyle = '#ffd84f';
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + i * Math.PI / 6;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 20, y + Math.sin(a) * 20, 9, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath(); ctx.arc(x - 24, y + 10, 7, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 24, y + 10, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff5fa2';
    ctx.beginPath();
    ctx.moveTo(x + 12, y - 15); ctx.lineTo(x + 4, y - 21); ctx.lineTo(x + 5, y - 10);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 12, y - 15); ctx.lineTo(x + 20, y - 21); ctx.lineTo(x + 19, y - 10);
    ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = '#ffa62b';
    ctx.beginPath(); ctx.arc(x, y - 2, 22.5, Math.PI, TAU); ctx.fill();
    rr(ctx, x + 2, y - 10, 24, 8, 4); ctx.fill();
  }
  if (game.royal) drawCrown(ctx, x, y - 17, 13);
  drawFace(ctx, x, y + 6, 34, sel ? 'grin' : 'happy', t, who === 'girl' ? 13 : 3);
}
function render() {
  if (game.state === 'title') renderTitle();
  else renderWorld();
}

// ================================================================ main loop
let lastT = 0;
function frame(ts) {
  const dt = Math.min(0.033, (ts - lastT) / 1000 || 0.016);
  lastT = ts;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
AudioSys.setMusic('title');
requestAnimationFrame(frame);
