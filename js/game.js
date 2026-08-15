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

let saveUnlocked = 1;
try { saveUnlocked = clamp(parseInt(localStorage.getItem('ffbg_unlocked') || '1', 10) || 1, 1, 6); } catch (e) {}

const game = {
  state: 'title', t: 0,
  level: null, player: null,
  spiders: [], projectiles: [], pickups: [], shoes: [],
  checkpoint: null, lastSafe: { x: 100, y: 400 },
  cam: { x: 0, y: 0 },
  candy: 0, friendCount: 0,
  shake: 0, hudPulse: 0, heartFlash: 0,
  unlocked: saveUnlocked,
  introT: 0, completeT: 0, deadT: 0,
  caught: null, cut: null,
  zombie: null, bossStage: 0, arenaL: 4020, arenaR: 4960,
  bossPlan: { 1: 'fire', 2: 'ice', 3: 'rainbow' },
  stageHintT: 0, bossPickups: [],
  chest: null, endPhase: null, partyT: 0,
  titleT: 0, titleBoyX: 300, titleBoyD: 1,
  titlePlayer: null, titleSpider: null,
  deathPos: null
};

// ================================================================ flow
game.startLevel = function (n) {
  const lv = buildLevel(n);
  game.level = lv;
  game.player = new Player(lv.playerStart.x, lv.playerStart.y);
  game.spiders = lv.spiders;
  game.pickups = lv.pickups;
  game.projectiles = []; game.shoes = [];
  game.checkpoint = null;
  game.lastSafe = { x: lv.playerStart.x, y: lv.playerStart.y };
  game.friendCount = 0;
  game.zombie = null; game.bossStage = 0; game.bossPickups = [];
  game.chest = null; game.endPhase = null; game.cut = null; game.caught = null;
  game.cam.x = 0;
  game.cam.y = lv.h > H ? clamp(game.player.cy - H * 0.5, 0, lv.h - H) : 0;
  game.state = 'intro'; game.introT = 0;
  AudioSys.setMusic(lv.music);
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
game.smashWall = function (s) {
  if (s.broken) return;
  s.broken = true;
  AudioSys.sfx('smash');
  game.shake = Math.max(game.shake, 0.4);
  for (let by = s.y; by < s.y + s.h; by += 48)
    for (let bx = s.x; bx < s.x + s.w; bx += 48)
      Particles.burst(bx + 24, by + 24, 3, { colors: ['#d9b98a', '#a8895a'], type: 'block', sp1: 380, l1: 1, s1: 12, grav: 900 });
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
  if (game.level.n === 6) {
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
game.startEnding = function () {
  game.unlocked = 6; // beating the zombie unlocks the bonus level
  try { localStorage.setItem('ffbg_unlocked', '6'); } catch (e) {}
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
  const tx = clamp(pl.cx + pl.facing * 70 - W * 0.5, 0, lv.w - W);
  game.cam.x = lerp(game.cam.x, tx, 1 - Math.exp(-6 * dt));
  const ty = lv.h > H ? clamp(pl.cy - H * 0.52, 0, lv.h - H) : 0;
  game.cam.y = lerp(game.cam.y, ty, 1 - Math.exp(-6 * dt));
}
function updatePlay(dt) {
  const lv = game.level, pl = game.player;
  if (game.cut) { updateCut(dt); return; }
  if (lv.boss && !game.zombie && pl.x > 3900) { game.startBossIntro(); return; }

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

  if (game.endPhase !== 'party') pl.update(dt);
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
    const z = game.zombie;
    if (z && game.bossStage > 0 && overlaps(pr, z)) { z.hitBy(pr.kind); pr.impact(true); }
  }

  for (const p of game.pickups) p.update(dt);
  for (const c of lv.checks) c.update(dt);
  if (lv.gate) lv.gate.update(dt);
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
    if (game.partyT > 5 && justP.Space) {
      if (lv.n === 5) game.startLevel(6); // surprise: the bonus world!
      else {
        game.state = 'title'; game.titleT = 0;
        AudioSys.setMusic('title');
      }
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
  for (let i = 1; i <= 6; i++) {
    if (justP['Digit' + i] && i <= game.unlocked) { game.startLevel(i); return; }
  }
  if (justP.Space) game.startLevel(clamp(game.unlocked, 1, 6));
}
function update(dt) {
  game.t += dt;
  game.shake = Math.max(0, game.shake - dt * 2);
  game.hudPulse = Math.max(0, game.hudPulse - dt * 2);
  game.heartFlash = Math.max(0, game.heartFlash - dt);
  if (justP.KeyM) AudioSys.toggleMute();
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
        if (game.level.n < 5) game.startLevel(game.level.n + 1);
        else { game.state = 'title'; game.titleT = 0; AudioSys.setMusic('title'); }
      }
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
  outlineText(ctx, lv.n === 6 ? 'BONUS LEVEL!' : 'LEVEL ' + lv.n, W / 2, y - 75, 56, '#ffd24a', '#5a4a86');
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
function drawPartyOverlay() {
  const t = game.partyT;
  if (t > 0.8) {
    const k = Math.min(1, (t - 0.8) * 2);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * -60);
    if (game.level.n === 6) {
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
  drawSolids(ctx, lv, cam, t);
  drawHints(ctx, lv, t);
  for (const c of lv.checks) c.draw(ctx);
  if (lv.gate) lv.gate.draw(ctx);
  for (const p of game.pickups) p.draw(ctx);
  for (const sp of game.spiders) sp.draw(ctx);
  if (game.chest) game.chest.draw(ctx);
  if (game.zombie) game.zombie.draw(ctx);
  for (const sh of game.shoes) sh.draw(ctx);
  for (const pr of game.projectiles) pr.draw(ctx);
  if (game.state === 'dead') {
    if (game.deathPos) game.player.drawSitting(ctx, game.deathPos.x, game.deathPos.y - 58);
  } else {
    game.player.draw(ctx);
  }
  if (game.state === 'caught') drawCatchCloud(ctx);
  Particles.draw(ctx);
  if (game.cut && game.cut.name === 'bossintro' && game.zombie) {
    const z = game.zombie;
    if (game.cut.t >= 1.4 && game.cut.t < 2.6) outlineText(ctx, 'RAWR!', z.cx, z.y - 80, 62, '#ff5a5a', '#fff');
    else if (game.cut.t >= 2.6 && game.cut.t < 3.3) outlineText(ctx, '...hic!', z.cx, z.y - 80, 42, '#ffe156', '#5a4a86');
  }
  if (game.cut && game.cut.name === 'magmaintro' && game.zombie) {
    const z = game.zombie;
    if (game.cut.t >= 1.5 && game.cut.t < 2.7) outlineText(ctx, 'BLORP!', z.cx, z.y - 90, 62, '#ff9f43', '#fff');
    else if (game.cut.t >= 2.7 && game.cut.t < 3.5) outlineText(ctx, 'AH-CHOO!', z.cx, z.y - 90, 48, '#ffe156', '#8a2a10');
    else if (game.cut.t >= 3.5 && game.cut.t < 4.6) outlineText(ctx, '?!', z.cx, z.y - 90, 54, '#fff', '#8a2a10');
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
  outlineText(ctx, 'FUNNY FACE', W / 2, 135 + Math.sin(t * 2) * 5, 92, '#ffd24a', '#5a4a86');
  outlineText(ctx, 'BLOCK GAME', W / 2, 235 + Math.sin(t * 2 + 0.6) * 5, 92, '#ff8fb0', '#5a4a86');
  // bouncing blocks
  ['fire', 'ice', 'rainbow', 'power'].forEach((k, i) => {
    const bx = W / 2 - 165 + i * 110;
    const by = 330 - Math.abs(Math.sin(t * 3 + i * 0.7)) * 28;
    drawBlock(ctx, bx - 32, by - 32, 64, k, t, { wobble: true, seed: i * 3 });
  });
  // characters
  if (game.titlePlayer) game.titlePlayer.draw(ctx);
  if (game.titleSpider) game.titleSpider.draw(ctx);
  // press space
  drawSpacebar(ctx, W / 2, 475, 175, t, false);
  ctx.save();
  ctx.globalAlpha = 0.7 + Math.sin(t * 4) * 0.3;
  outlineText(ctx, 'PRESS SPACE', W / 2, 545, 34, '#fff', '#5a4a86');
  ctx.restore();
  // world medallions
  for (let i = 1; i <= 6; i++) {
    const mx = W / 2 - 220 + (i - 1) * 88, my = 688;
    const open = i <= game.unlocked;
    ctx.fillStyle = open ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.arc(mx, my, 30, 0, TAU); ctx.fill();
    ctx.strokeStyle = open ? '#ffd24a' : '#8a8a9a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(mx, my, 30, 0, TAU); ctx.stroke();
    if (open) drawLevelIcon(ctx, mx, my, 15, LEVEL_META[i].theme, t);
    else {
      ctx.fillStyle = '#8a8a9a';
      rr(ctx, mx - 10, my - 6, 20, 15, 4); ctx.fill();
      ctx.strokeStyle = '#8a8a9a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(mx, my - 7, 7, Math.PI, TAU); ctx.stroke();
    }
  }
  Particles.draw(ctx);
  drawTouchUI();
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
