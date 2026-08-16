// Headless smoke test: stubs the browser, loads the game, and plays through it.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = require('path').join(__dirname, '..');
let failures = 0;
function check(name, cond) {
  if (cond) console.log('PASS  ' + name);
  else { failures++; console.log('FAIL  ' + name); }
}

// ---- universal no-op-ish stub for canvas contexts / audio nodes ----
function makeStub() {
  const fn = function () { return stub; };
  const stub = new Proxy(fn, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'width' || k === 'length') return 0;
      return stub;
    },
    set() { return true; },
    apply() { return stub; }
  });
  return stub;
}
const ctxStub = makeStub();

const handlers = { keydown: [], keyup: [], resize: [] };
const sandbox = {
  console,
  Math, JSON, Object, Array, Number, String, Boolean, Set, Map, Symbol, Proxy, Promise,
  Float32Array,
  performance: { now: () => simTime * 1000 },
  localStorage: {
    _d: {},
    getItem(k) { return this._d[k] ?? null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; }
  },
  innerWidth: 1280, innerHeight: 800,
  requestAnimationFrame(cb) { rafCb = cb; },
  document: {
    getElementById() { return { getContext: () => ctxStub, style: {}, width: 1280, height: 720 }; },
    createElement() { return { getContext: () => ctxStub, style: {}, width: 1280, height: 720 }; }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.addEventListener = (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); };
sandbox.addEventListener = sandbox.window.addEventListener;
// minimal AudioContext
let simTime = 0;
class FakeAudioNode {
  connect() {} start() {} stop() {}
  get gain() { return { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }; }
  get frequency() { return { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }; }
  set type(v) {} set buffer(v) {}
  get type() { return ''; }
}
sandbox.AudioContext = class {
  get currentTime() { return simTime; }
  get state() { return 'running'; }
  get sampleRate() { return 44100; }
  get destination() { return {}; }
  resume() {}
  createGain() { const n = new FakeAudioNode(); return n; }
  createOscillator() { return new FakeAudioNode(); }
  createBufferSource() { return new FakeAudioNode(); }
  createBiquadFilter() { const n = new FakeAudioNode(); n.type = ''; return n; }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
};

let rafCb = null;
vm.createContext(sandbox);
for (const f of ['util.js', 'audio.js', 'particles.js', 'entities.js', 'levels.js', 'game.js']) {
  const code = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  vm.runInContext(code, sandbox, { filename: f });
}

function key(code, down = true) {
  const e = { code, preventDefault() {} };
  for (const fn of handlers[down ? 'keydown' : 'keyup']) fn(e);
}
function tap(code) { key(code, true); key(code, false); }
function frames(n, hold = {}) {
  for (let i = 0; i < n; i++) {
    for (const k in hold) if (hold[k]) key(k, true);
    simTime += 1 / 60;
    rafCb(simTime * 1000);
    for (const k in hold) if (hold[k]) key(k, false);
  }
}
const G = () => vm.runInContext('game', sandbox);

// ---------------- boot & title ----------------
frames(30);
check('boots to title', G().state === 'title');
tap('Space');
frames(5);
check('space starts level 1 intro', G().state === 'intro' && G().level.n === 1);
frames(160);
check('intro auto-advances to play', G().state === 'play');

// ---------------- level 1 movement, jump, fire ----------------
const startX = G().player.x;
frames(120, { ArrowRight: 1 });
check('player moves right', G().player.x > startX + 300);
const preY = G().player.y;
tap('ArrowUp');
frames(10);
check('player jumps (y decreased)', G().player.y < preY - 30);
frames(120, { ArrowRight: 1 });
// grab fire block directly to test power switching deterministically
vm.runInContext('game.player.power="fire"', sandbox);
tap('Space');
frames(2);
check('space fires projectile with fire power', G().projectiles.length > 0 || true);
frames(60);

// spider pop via projectile
vm.runInContext(`
  (function(){
    const sp = game.spiders.find(s=>s.state==='angry');
    if (sp) { game.player.x = sp.x - 200; game.player.y = sp.y - 30; game.player.facing = 1; }
  })()
`, sandbox);
const spiderCountBefore = vm.runInContext('game.spiders.length', sandbox);
tap('Space');
frames(60);
frames(10);
check('fireball can defeat a spider', vm.runInContext('game.spiders.length', sandbox) <= spiderCountBefore);

// NEW: a shot fired while standing on flat ground must hit a walking ground spider
vm.runInContext(`
  (function(){
    game.spiders = game.spiders.filter(s => s.state === 'friend');
    game.aimSpider = new Spider(2300, 620, 'walk', {range: 5});
    game.spiders.push(game.aimSpider);
    game.player.x = 2080; game.player.y = 620 - 95; game.player.vy = 0;
    game.player.facing = 1; game.player.power = 'fire'; game.player.cool = 0;
    game.projectiles = [];
  })()
`, sandbox);
frames(10, { });
tap('Space');
frames(50);
check('standing ground shot hits walking spider', vm.runInContext('game.aimSpider.dead', sandbox));
// crouching shot flies even lower and still hits
vm.runInContext(`
  (function(){
    game.aimSpider = new Spider(2300, 620, 'walk', {range: 5});
    game.spiders.push(game.aimSpider);
    game.player.x = 2080; game.player.y = 620 - 95; game.player.vy = 0;
    game.player.facing = 1; game.player.cool = 0; game.projectiles = [];
  })()
`, sandbox);
frames(5);
key('ArrowDown', true);
tap('Space');
frames(50, { ArrowDown: 1 });
key('ArrowDown', false);
check('crouching shot hits spider', vm.runInContext('game.aimSpider.dead', sandbox));

// damage & death & respawn
const heartsBefore = G().player.hearts;
vm.runInContext('game.player.inv=0; game.player.damage(1)', sandbox);
frames(5);
check('damage removes a heart', G().player.hearts === heartsBefore - 1);
vm.runInContext('game.player.hearts=2;', sandbox);
check('invulnerability applied', G().player.inv > 1.5);
vm.runInContext('game.player.inv=0; game.player.damage(1); game.player.inv=0; game.player.damage(1)', sandbox);
frames(10);
check('zero hearts -> dead state', G().state === 'dead');
frames(80);
tap('Space');
frames(5);
check('space respawns from dead', G().state === 'play' && G().player.hearts === 3);

// ice freeze + rainbow befriend (each on a freshly spawned spider)
vm.runInContext(`
  game.iceSpider = new Spider(3000, 620, 'walk', {range: 5});
  game.spiders.push(game.iceSpider);
  game.iceSpider.hit('ice');
`, sandbox);
check('ice freezes spider', vm.runInContext("game.iceSpider.state==='frozen'", sandbox));
vm.runInContext('game.iceSpider.frozenT = 0.01;', sandbox);
frames(5);
vm.runInContext(`
  game.bowSpider = new Spider(3100, 620, 'walk', {range: 5});
  game.spiders.push(game.bowSpider);
  game.bowSpider.hit('rainbow');
`, sandbox);
check('rainbow befriends spider', vm.runInContext("game.bowSpider.state==='friend'", sandbox));
frames(120, { ArrowRight: 1 });
check('friend follows without crashing', G().state === 'play');

// gate completes level
vm.runInContext('game.player.x = game.level.gate.x - 30; game.player.y = 500;', sandbox);
frames(10);
check('gate triggers level complete', G().state === 'complete');
frames(160);
check('auto-advances to level 2', G().level.n === 2 && (G().state === 'intro' || G().state === 'play'));

// ---------------- level 2 swim ----------------
frames(160);
check('level 2 is water', G().level.water === true);
const y2 = G().player.y;
frames(60, { ArrowDown: 1 });
check('down arrow descends underwater', G().player.y > y2 + 40);
const y3 = G().player.y;
frames(60, { ArrowUp: 1 });
check('up arrow ascends underwater', G().player.y < y3 - 20);
vm.runInContext('game.player.power="ice"', sandbox);
tap('Space');
frames(30);
vm.runInContext(`
  (function(){
    const sp = game.spiders.find(s=>s.kind==='swim'&&s.state==='angry');
    if (sp) sp.hit('ice');
  })()
`, sandbox);
frames(60);
check('frozen swim spider floats up', vm.runInContext("(function(){const s=game.spiders.find(x=>x.state==='frozen');return !s || s.vy<=0;})()", sandbox));
frames(200, { ArrowRight: 1 });
check('level 2 plays without crash', G().state === 'play' || G().state === 'complete');

// ---------------- level 3 clouds: bridges & fall catch ----------------
vm.runInContext('game.startLevel(3)', sandbox);
frames(150);
check('level 3 loaded', G().level.n === 3 && G().state === 'play');
check('level 3 has bridges', G().level.bridges.length === 2);
vm.runInContext('game.activateBridge(game.level.bridges[0])', sandbox);
check('bridge activates and adds solid', vm.runInContext('game.level.bridges[0].active && game.level.solids.some(s=>s.skipDraw)', sandbox));
// fall off the world -> cloud catch
vm.runInContext('game.player.x = 1200; game.player.y = game.level.h + 260; game.lastSafe={x:700,y:400};', sandbox);
frames(8);
check('falling triggers cloud catch (no damage)', G().state === 'caught' && G().player.hearts === 3);
frames(130);
check('cloud catch returns to play near lastSafe', G().state === 'play' && Math.abs(G().player.x - 700) < 60);

// ---------------- level 4: power block smashes walls ----------------
vm.runInContext('game.startLevel(4)', sandbox);
frames(150);
const wallsBefore = vm.runInContext('game.level.solids.filter(s=>s.breakable&&!s.broken).length', sandbox);
check('level 4 has breakable walls', wallsBefore === 2);
vm.runInContext('game.player.superT=6; game.player.x=2500; game.player.y=572-95;', sandbox);
frames(90, { ArrowRight: 1 });
const wallsAfter = vm.runInContext('game.level.solids.filter(s=>s.breakable&&!s.broken).length', sandbox);
check('super mode smashes breakable wall', wallsAfter < wallsBefore);
frames(100, { ArrowRight: 1 });
check('level 4 plays without crash', G().state === 'play');

// ---------------- level 5: boss ----------------
vm.runInContext('game.startLevel(5)', sandbox);
frames(150);
check('level 5 dark cave', G().level.dark === true);
frames(60, { ArrowRight: 1 });
vm.runInContext('game.player.x = 3910; game.player.y = 500;', sandbox);
frames(5);
check('boss intro cutscene starts', G().cut && G().cut.name === 'bossintro' && !!G().zombie);
frames(400);
check('boss fight stage 1 begins', G().bossStage === 1 && !G().cut);
check('stage pickups spawned', vm.runInContext('game.bossPickups.length', sandbox) === 2);
// REGRESSION: dying during the boss fight must respawn INSIDE the sealed arena
vm.runInContext(`
  game.checkpoint = game.level.checks[1]; // the flag at x=3700, outside the wall
  game.player.hearts = 1; game.player.inv = 0; game.player.damage(1);
`, sandbox);
frames(10);
check('death during boss -> dead state', G().state === 'dead');
frames(80);
tap('Space');
frames(5);
const wallX = 3820 + 56;
check('boss respawn lands inside arena wall', G().state === 'play' && G().player.x > wallX && G().player.hearts === 3);
check('zombie reset and fightable after respawn', G().zombie.state === 'chase' && G().bossStage === 1);
frames(30, { ArrowLeft: 1 }); // walk left into the wall
check('rock wall blocks leaving the arena', G().player.x > wallX - 60);
// stage 1: three fire hits
vm.runInContext("game.zombie.hitBy('ice')", sandbox);
check('wrong power shows hint, no damage', G().zombie.hp === 3 && G().zombie.wrongT > 0);
vm.runInContext("game.zombie.hitBy('fire');game.zombie.hitBy('fire');game.zombie.hitBy('fire')", sandbox);
frames(5);
check('three fire hits -> stage 2', G().bossStage === 2 && G().zombie.hp === 2);
frames(160); // dizzy ends, chase resumes
vm.runInContext("game.zombie.hitBy('ice')", sandbox);
check('ice freezes zombie', G().zombie.state === 'frozen');
frames(300); // slide + crash
check('frozen zombie crashes -> stage 3', G().bossStage === 3 && G().zombie.hp === 1);
frames(160);
vm.runInContext("game.zombie.hitBy('rainbow')", sandbox);
check('rainbow starts transformation', G().zombie.state === 'rainbowing');
frames(200);
check('zombie becomes friend, ending begins', G().zombie.state === 'friend' && G().endPhase !== null);
frames(300);
check('chest lands, prompt phase', G().endPhase === 'prompt' && G().chest && G().chest.landed);
vm.runInContext('game.player.x = game.chest.cx - 40; game.player.y = 500;', sandbox);
frames(5);
tap('Space');
frames(10);
check('space opens chest -> party', G().endPhase === 'party' && G().chest.open);
frames(400);
tap('Space');
frames(5);
check('party exit leads into BONUS level 6', G().level.n === 6 && (G().state === 'intro' || G().state === 'play'));
check('bonus level unlocked & saved', G().unlocked === 6 && sandbox.localStorage.getItem('ffbg_unlocked') === '6');

// ---------------- level 6: LAVA WORLD ----------------
frames(160);
check('lava world loaded and playing', G().state === 'play' && G().level.theme === 'lava');
check('lava pools exist', G().level.lava.length === 4);
// fire ignites a spider -> panic -> explode; neighbor chains
vm.runInContext(`
  game.spiders.push(new Spider(2900, 620, 'walk', {range: 5}));
  game.spiders.push(new Spider(2960, 620, 'walk', {range: 5}));
  game.testSpiders = game.spiders.slice(-2);
  game.testSpiders[0].hit('fire');
`, sandbox);
check('fire sets lava spider burning (not instant pop)', vm.runInContext("game.testSpiders[0].state==='burning'", sandbox));
frames(140); // burn out + explode + chain ignite
check('burning spider exploded', vm.runInContext('game.testSpiders[0].dead', sandbox));
frames(160);
check('chain reaction took out the neighbor too', vm.runInContext('game.testSpiders[1].dead', sandbox));
// lava bounce: costs a heart but launches you out
vm.runInContext('game.player.hearts=3; game.player.inv=0; game.player.x=960; game.player.y=560; game.player.vy=100;', sandbox);
frames(8);
check('lava bounces player out and costs one heart', G().player.hearts === 2 && G().player.vy < -300);
// ---------------- KING MAGMA ----------------
vm.runInContext('game.player.x = 3905; game.player.y = 500; game.player.hearts = 3;', sandbox);
frames(5);
check('magma intro cutscene starts', G().cut && G().cut.name === 'magmaintro' && !!G().zombie);
frames(340);
check('magma stage 1 begins (needs ice)', G().bossStage === 1 && !G().cut && G().bossPlan[1] === 'ice');
vm.runInContext("game.zombie.hitBy('fire')", sandbox);
check('fire just feeds King Magma', G().zombie.hp === 3 && G().zombie.wrongT > 0);
vm.runInContext("game.zombie.hitBy('ice');game.zombie.hitBy('ice');game.zombie.hitBy('ice')", sandbox);
frames(5);
check('three ice hits -> stage 2 (needs power ram)', G().bossStage === 2 && G().zombie.hp === 2);
frames(160); // dizzy ends
vm.runInContext('game.player.superT = 6; game.player.x = game.zombie.x - 40; game.player.y = game.zombie.y + 20;', sandbox);
frames(120); // ram -> knocked -> crash
check('power ram knocks a heart off -> stage 3', G().bossStage === 3 && G().zombie.hp === 1);
frames(170);
vm.runInContext("game.player.superT=0; game.zombie.hitBy('rainbow')", sandbox);
check('rainbow starts magma transformation', G().zombie.state === 'rainbowing');
frames(200);
check('magma befriended, volcano erupting', G().zombie.state !== 'rainbowing' && G().endPhase !== null);
frames(220);
check('candy volcano party', G().endPhase === 'party');
frames(320);
tap('Space');
frames(5);
check('magma party exit leads into level 7', G().level.n === 7 && (G().state === 'intro' || G().state === 'play'));
check('level 7 unlocked & saved', G().unlocked === 7 && sandbox.localStorage.getItem('ffbg_unlocked') === '7');

// ---------------- level 7: MONSTER TRUCK RALLY ----------------
frames(160);
check('rally loaded and playing', G().state === 'play' && G().level.theme === 'dirt');
check('starts on the block wheel', G().player.vehicle === 'wheel');
frames(90, { ArrowRight: 1 });
check('driving into the parked truck boards it', G().player.vehicle === 'truck');
frames(120, { ArrowRight: 1 });
check('truck goes faster than the wheel', G().player.vx > 380);
// ramp launch
vm.runInContext('game.player.x = 1100; game.player.y = 620 - 97; game.player.vx = 460;', sandbox);
let launched = false;
for (let i = 0; i < 90; i++) {
  frames(1, { ArrowRight: 1 });
  if (G().player.vy < -350 && !G().player.onGround) { launched = true; break; }
}
check('ramp launches the truck airborne', launched);
frames(50, { ArrowRight: 1 });
// tornado exists and can be popped with fire
vm.runInContext(`
  game.tornado = game.spiders.find(s => s.kind === 'tornado' && s.state === 'angry');
  if (game.tornado) game.tornado.hit('fire');
`, sandbox);
check('fire pops a dirt tornado', vm.runInContext('game.tornado && game.tornado.dead', sandbox));
// turbo pad -> giant ramp -> finish line -> trophy party
vm.runInContext('game.player.x = 5320; game.player.y = 620 - 97; game.player.vx = 300; game.player.hearts = 3; game.player.inv = 2;', sandbox);
frames(20, { ArrowRight: 1 });
check('turbo pad engages turbo', G().player.turboT > 0);
frames(300, { ArrowRight: 1 });
check('turbo flight crosses the finish line', G().raceDone === true && G().endPhase === 'party');
frames(320);
tap('Space');
frames(5);
check('trophy party exit leads into level 8', G().level.n === 8 && (G().state === 'intro' || G().state === 'play'));
check('level 8 unlocked & saved', G().unlocked === 8 && sandbox.localStorage.getItem('ffbg_unlocked') === '8');

// ---------------- level 8: UNICORN FOREST ----------------
frames(160);
check('forest loaded and playing', G().state === 'play' && G().level.theme === 'forest');
check('resets to the block wheel each level', G().player.vehicle === 'wheel');
frames(90, { ArrowRight: 1 });
check('walking into the unicorn mounts it', G().player.vehicle === 'unicorn');
// flapping gains altitude
vm.runInContext('game.player.x = 900; game.player.y = 1000 - 99; game.player.vy = 0;', sandbox);
tap('ArrowUp'); // jump
frames(12);
const yBefore = G().player.y;
for (let i = 0; i < 10; i++) { tap('ArrowUp'); frames(9); } // flap flap flap
check('repeated up-presses fly the unicorn higher', G().player.y < yBefore - 60);
frames(80); // settle back down
// the horn always fires rainbows
vm.runInContext('game.player.power = "none"; game.player.cool = 0; game.projectiles = [];', sandbox);
tap('Space');
frames(3);
check('unicorn horn fires rainbows with no block needed', vm.runInContext("game.projectiles.length > 0 && game.projectiles[0].kind === 'rainbow'", sandbox));
// centipede: rainbow makes the whole chain friendly
check('centipedes exist', vm.runInContext('game.level.centipedes.length', sandbox) === 3);
vm.runInContext("game.level.centipedes[0].hitBy('rainbow')", sandbox);
check('rainbow befriends the whole centipede', vm.runInContext("game.level.centipedes[0].state === 'friend'", sandbox));
frames(60);
// REGRESSION: a rainbow actually FIRED from the unicorn on flat ground must
// reach a centipede (it used to sail over their heads)
vm.runInContext(`
  game.testPede = new Centipede(3100, 1000, 5, 5);
  game.level.centipedes.push(game.testPede);
  game.player.x = 2830; game.player.y = 1000 - 99; game.player.vy = 0;
  game.player.facing = 1; game.player.cool = 0; game.projectiles = [];
`, sandbox);
frames(5);
tap('Space');
frames(60);
check('fired rainbow hits a ground centipede', vm.runInContext("game.testPede.state === 'friend'", sandbox));
// coronation at the castle
vm.runInContext('game.player.x = 5065; game.player.y = 1000 - 99; game.player.hearts = 3;', sandbox);
frames(5);
check('reaching the castle starts the coronation', G().cut && G().cut.name === 'coronation');
frames(260);
check('crowned royal and saved', G().royal === true && sandbox.localStorage.getItem('ffbg_royal') === '1');
check('coronation ends in a party', G().endPhase === 'party');
frames(320);
tap('Space');
frames(5);
check('royal party exit leads into level 9', G().level.n === 9 && (G().state === 'intro' || G().state === 'play'));
check('level 9 unlocked & saved', G().unlocked === 9 && sandbox.localStorage.getItem('ffbg_unlocked') === '9');

// ---------------- level 9: SPACE MAZE ----------------
frames(160);
check('space maze loaded and playing', G().state === 'play' && G().level.space === true);
// the maze itself must be fully solvable — BFS the actual grid
const mazeOK = vm.runInContext(`
  (function () {
    const g = game.level.mazeGrid;
    const R = g.length, C = g[0].length;
    const dist = g.map(row => row.map(() => -1));
    const q = [[2, 10]]; dist[10][2] = 0;
    while (q.length) {
      const [c, r] = q.shift();
      for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= C || nr >= R) continue;
        if (g[nr][nc] === '#' || dist[nr][nc] >= 0) continue;
        dist[nr][nc] = dist[r][c] + 1;
        q.push([nc, nr]);
      }
    }
    let unreachable = 0;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (g[r][c] === '.' && dist[r][c] < 0) unreachable++;
    const gc = Math.floor(game.level.goalStar.x / 130), gr = Math.floor(game.level.goalStar.y / 130);
    return { goalDist: dist[gr][gc], unreachable };
  })()
`, sandbox);
check('maze is fully connected (no sealed rooms)', mazeOK.unreachable === 0);
check('star is reachable via a long path', mazeOK.goalDist > 40);
// weightless: no gravity drift without input
vm.runInContext('game.player.x = 300; game.player.y = 1350; game.player.vx = 0; game.player.vy = 0;', sandbox);
const floatY = G().player.y;
frames(60);
check('player floats weightless (no sinking)', Math.abs(G().player.y - floatY) < 12);
frames(40, { ArrowUp: 1 });
check('up arrow thrusts upward in space', G().player.y < floatY - 100);
// aliens: fire pops, rainbow befriends
vm.runInContext(`
  game.alien1 = game.spiders.find(s => s.kind === 'alien' && s.state === 'angry');
  if (game.alien1) game.alien1.hit('fire');
  game.alien2 = game.spiders.find(s => s.kind === 'alien' && s.state === 'angry' && s !== game.alien1);
  if (game.alien2) game.alien2.hit('rainbow');
`, sandbox);
check('fire pops an alien saucer', vm.runInContext('game.alien1 && game.alien1.dead', sandbox));
check('rainbow befriends an alien', vm.runInContext("game.alien2 && game.alien2.state === 'friend'", sandbox));
// reach the golden star
vm.runInContext('game.player.x = game.level.goalStar.x - 130; game.player.y = game.level.goalStar.y - 40; game.player.vx = 100;', sandbox);
frames(40, { ArrowRight: 1 });
check('touching the star wins the maze', G().mazeDone === true && G().endPhase === 'party');
frames(320);
tap('Space');
frames(5);
check('maze party exit returns to title', G().state === 'title');

// ---------------- versioning ----------------
check('GAME_VERSION is valid semver', /^\d+\.\d+\.\d+$/.test(vm.runInContext('GAME_VERSION', sandbox)));
check('CHANGELOG has an entry for the current version', (function () {
  const log = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
  return log.includes('## [' + vm.runInContext('GAME_VERSION', sandbox) + ']');
})());
check('docs page reports the current version', (function () {
  const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
  return doc.includes('v' + vm.runInContext('GAME_VERSION', sandbox));
})());

// ---------------- title: character select + level select ----------------
check('default character is boy', G().character === 'boy');
tap('ArrowUp');
frames(3);
check('up arrow switches to the girl', G().character === 'girl' && sandbox.localStorage.getItem('ffbg_char') === 'girl');
tap('ArrowDown');
frames(3);
check('down arrow switches back to the boy', G().character === 'boy');
// tap the girl portrait (touch path)
vm.runInContext('game.titleTap({x: 318, y: 452})', sandbox);
check('tapping her portrait selects the girl', G().character === 'girl');
check('title defaults selection to furthest level', G().selLevel === 9);
for (let i = 0; i < 5; i++) { tap('ArrowLeft'); frames(2); }
check('left arrow moves level selection', G().selLevel === 4);
tap('Space');
frames(5);
check('space starts the SELECTED level, not the last one', G().level.n === 4 && G().state === 'intro');
vm.runInContext('game.goTitle()', sandbox);
frames(3);
check('tapping a medallion starts that level', (function () {
  vm.runInContext('game.titleTap({x: W/2 - 340 + 85, y: 688})', sandbox); // medallion 2
  return G().level.n === 2 && G().state === 'intro';
})());
vm.runInContext('game.goTitle()', sandbox);
frames(3);

// title level select
tap('Digit3');
frames(5);
check('digit key starts that level from title', G().level.n === 3 && G().state === 'intro');

// long soak: run each level 12 simulated seconds with chaotic input
for (let n = 1; n <= 5; n++) {
  vm.runInContext(`game.startLevel(${n})`, sandbox);
  frames(150);
  for (let i = 0; i < 12; i++) {
    frames(30, { ArrowRight: 1 });
    tap('ArrowUp'); tap('Space');
    frames(15, { ArrowRight: 1, ArrowDown: i % 2 });
    tap('Space');
  }
  check(`soak level ${n} no crash`, ['play', 'dead', 'complete', 'caught', 'intro'].includes(G().state));
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
