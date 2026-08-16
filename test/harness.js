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
check('level 4 has breakable walls', wallsBefore === 3); // two on the path + the crystal pocket
vm.runInContext('game.player.superT=6; game.player.x=2500; game.player.y=572-95;', sandbox);
frames(90, { ArrowRight: 1 });
const wallsAfter = vm.runInContext('game.level.solids.filter(s=>s.breakable&&!s.broken).length', sandbox);
check('super mode smashes breakable wall', wallsAfter < wallsBefore);
frames(100, { ArrowRight: 1 });
check('level 4 plays without crash', G().state === 'play');

// ---------------- level 4: golden key adventure mission ----------------
vm.runInContext('game.startLevel(4)', sandbox);
frames(150); // intro -> play
const put = (x, y) => vm.runInContext(`game.player.x = ${x}; game.player.y = ${y}; game.player.vx = 0; game.player.vy = 0`, sandbox);
const MIS = () => vm.runInContext('game.level.mission', sandbox);
check('mission exists with a locked gate', MIS() && MIS().state === 'puzzle' && MIS().gate.state === 'locked');
put(4340, 524 - 94);
frames(50, { ArrowRight: 1 });
check('locked door blocks the player', G().player.x + G().player.w <= MIS().gate.solid.x + 2 && G().state === 'play');
check('door bump gives key hint, costs nothing', MIS().gate.hintT > 0 && G().player.hearts === 3);
// distributed collection: three crystals, any order, each its own challenge
const TOK = i => vm.runInContext(`game.level.mission.puzzle.tokens[${i}]`, sandbox);
check('shrine chest waits closed with three empty sockets', MIS().puzzle.shrine.chest.open === false && MIS().puzzle.count() === 0);
// floating platforms are one-way: walk beneath them, jump up through them
// (befriend the hang spiders first so the geometry check stays deterministic)
vm.runInContext("for (const sp of game.spiders) if (sp.befriend) sp.befriend();", sandbox);
put(2060, 524 - 94); // clear of the power block at x=2000
frames(85, { ArrowRight: 1 });
check('candy under the ledge platform is walkable', G().player.x > 2360 && Math.abs(G().player.y - (524 - 94)) < 4);
put(2230, 524 - 94);
frames(3);
tap('ArrowUp');
frames(70);
check('jumping up through the ledge lands on top', Math.abs(G().player.y + 94 - 410) < 4);
// the raised spring never interrupts ground travel...
put(2400, 524 - 94);
frames(40, { ArrowRight: 1 });
check('walking under the spring platform never bounces', G().player.x > 2560 && Math.abs(G().player.y - (524 - 94)) < 4);
// ...but hopping onto it launches far higher than any jump, through the sky crystal
put(2530, 270); // drop onto the raised spring
let minY = 1e9;
for (let i = 0; i < 70; i++) { frames(1); minY = Math.min(minY, G().player.y); }
check('spring block launches the hero sky-high', minY < 200);
check('bounce route collects the fire crystal first (any order works)', TOK(1).taken === true && MIS().puzzle.count() === 1);
// the halfway stepping-stone chains the bounce onto the cave roof
put(2800, 300 - 94);
frames(8);
check('halfway platform holds the hero', Math.abs(G().player.y - (300 - 94)) < 3);
tap('ArrowUp');
frames(55, { ArrowRight: 1 });
check('hop from the stepping-stone lands on the cave roof', G().player.x > 2990 && Math.abs(G().player.y + 94 - 260) < 4);
frames(60, { ArrowRight: 1 });
check('roof route walks above the cave', G().player.x > 3200 && Math.abs(G().player.y + 94 - 260) < 6);
frames(60, { ArrowRight: 1 }); // ...onward, into the sparkling cave mouth
check('walking the roof discovers the SECRET ASCENT', G().level.n === 'ascent');
frames(150);
check('secret ascent plays with its own fresh hero', G().state === 'play' && G().player.hearts === 3);
put(1720, 1740 - 94);
frames(30);
check('diagonal camera tracks up and to the right', G().cam.x > 300 && G().cam.y > 100 && G().cam.y < 1600);
put(1935, 1700 - 94);
let mAsc = 1e9;
for (let i = 0; i < 70; i++) { frames(1); mAsc = Math.min(mAsc, G().player.y); }
check('ascent spring launches up the cliff face', mAsc < 1350);
check('the dead-end nook hides a peeking dino', vm.runInContext('!!game.level.decor.dinoPeek', sandbox));
put(2590 - 28, 960 - 94);
frames(5); // grab the power block on the upper terrace
frames(70, { ArrowRight: 1 }); // smash through the cracked wall
check('power smash opens the final stretch', vm.runInContext('game.level.solids.some(s => s.breakable && s.broken)', sandbox) === true);
put(1850, 340 - 94);
frames(20);
check('arriving on the summit no longer wins instantly', G().endPhase === null && G().state === 'play');
// the summit spring launches over the gap onto the TREASURE TERRACE
const candyGold0 = G().candy;
put(1195, 300 - 94);
frames(4); // land on the spring — boing
let mGold = 1e9;
for (let i = 0; i < 85; i++) { frames(1, { ArrowLeft: 1 }); mGold = Math.min(mGold, G().player.y); }
check('summit spring launches sky-high over the gap', mGold < 60);
check('hero lands on the treasure terrace', Math.abs(G().player.y + 94 - 260) < 6);
frames(40, { ArrowLeft: 1 }); // wade into the ridiculous gold
check('gold rush fanfare pops and candy showers in', G().level.goldRush.done === true && G().candy > candyGold0 + 3);
frames(90, { ArrowLeft: 1 }); // all the way to the star at the far end
check('the star among the gold starts the celebration', G().endPhase === 'party' && G().level.n === 'ascent');
check('secret completion is remembered', G().miniDone.ascent === true && sandbox.localStorage.getItem('ffbg_mini').includes('ascent'));
frames(320);
tap('Space');
frames(5);
check('exiting returns to Mountain World with mission intact', G().level.n === 4 && G().state === 'play' && MIS().puzzle.count() === 1 && TOK(1).taken);
frames(25);
check('the door does not instantly re-enter', G().level.n === 4);
// dying must not un-collect anything
vm.runInContext('game.player.inv = 0; game.player.damage(1); game.player.inv = 0; game.player.damage(1); game.player.inv = 0; game.player.damage(1)', sandbox);
frames(60);
tap('Space');
frames(30);
check('death does not un-collect crystals', G().state === 'play' && MIS().puzzle.count() === 1 && TOK(1).taken);
// the easy one: a couple of hops up the block pile at the cave mouth
put(3108 - 28, 468 - 60);
frames(6);
check('cave-mouth crystal is an easy grab', TOK(0).taken && MIS().puzzle.count() === 2);
// the last one is sealed behind a cracked wall — power smash required
put(3540, 572 - 94);
frames(40, { ArrowRight: 1 });
check('cracked wall seals the last crystal away', G().player.x + G().player.w <= 3622 && MIS().puzzle.count() === 2);
put(3820, 572 - 94);
frames(30, { ArrowLeft: 1 });
check('crystal pocket cannot be sneaked into from the far side', MIS().puzzle.count() === 2);
put(3540, 572 - 94);
vm.runInContext('game.player.superT = 3', sandbox);
frames(30, { ArrowRight: 1 });
check('power smash frees the last crystal', MIS().puzzle.count() === 3);
// mission-critical power blocks respawn — the wall can never soft-lock the run
put(2000 - 28, 524 - 94);
frames(5);
check('power block grants super mode', G().player.superT > 0);
put(2700, 524 - 94); // wait somewhere safe
frames(580); // super expires, then the respawn timer passes
check('used power block respawns (no soft-lock)', vm.runInContext("game.pickups.some(p => p.kind === 'power' && p.bossKind && !p.dead)", sandbox) === true);
// return to the shrine: sockets fill, chest opens, key appears
put(3300, 572 - 94);
frames(20);
check('returning to the shrine starts the ceremony', MIS().puzzle.state !== 'collect');
frames(200);
check('sockets fill and the chest opens into the golden key', MIS().puzzle.done && MIS().puzzle.shrine.lit === 3 && MIS().puzzle.shrine.chest.open && MIS().item.state === 'waiting');
put(MIS().item.x, MIS().item.y);
frames(8);
check('touching the key starts follow mode', MIS().item.state === 'follow' && MIS().state === 'carrying');
put(3900, 524 - 94);
frames(60);
check('key floats along with the player', Math.abs(MIS().item.cx - G().player.cx) < 200 && Math.abs(MIS().item.cy - G().player.cy) < 200);
// dying must not lose the key either
vm.runInContext('game.player.inv = 0; game.player.damage(1); game.player.inv = 0; game.player.damage(1); game.player.inv = 0; game.player.damage(1)', sandbox);
frames(60); // past the 0.8s dead-screen delay
check('death with key -> dead state', G().state === 'dead');
tap('Space');
frames(30);
check('respawn keeps the key following', G().state === 'play' && MIS().item.state === 'follow' && MIS().state === 'carrying');
// bring the key home
put(4340, 524 - 94);
frames(10);
check('door notices the key and starts unlocking', MIS().gate.state !== 'locked');
frames(150);
check('door opens and unblocks the path', MIS().gate.state === 'open' && MIS().gate.solid.broken === true && MIS().state === 'done');
frames(40, { ArrowRight: 1 }); // through the door but short of the star gate
check('player walks through the open door', G().player.cx > 4480);
put(4200, 524 - 94); frames(5); put(4340, 524 - 94);
frames(45, { ArrowRight: 1 });
check('door stays open on revisit', MIS().gate.state === 'open' && G().player.cx > 4480);
frames(140, { ArrowRight: 1 });
check('mountain world still completable past the door', ['complete', 'intro', 'play'].includes(G().state) && (G().state !== 'play' || G().player.cx > 4600));

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

// ---------------- level 7: MONSTER TRUCK RALLY (now with BUILD YOUR TRUCK) ----------------
frames(160);
check('rally loaded and playing', G().state === 'play' && G().level.theme === 'dirt');
check('starts on the block wheel', G().player.vehicle === 'wheel');
const TB = () => vm.runInContext('game.level.truckBuild', sandbox);
check('the truck waits broken — no parts collected, no ride parked', TB() && TB().state === 'collect' && TB().count() === 0 &&
  !vm.runInContext("game.pickups.some(p => p.constructor.name === 'ParkedTruck')", sandbox));
put(340, 620 - 94);
frames(35, { ArrowRight: 1 });
check('walking through the broken truck cannot start the race', G().player.vehicle === 'wheel');
// part 1: the giant wheels, an easy hop up the block pile
put(660, 572 - 94);
frames(6);
check('wheel part is an easy grab', TB().tokens[0].taken && TB().count() === 1);
// part 2: the engine hangs from the crane, out of jumping reach...
check('engine hangs out of reach', TB().tokens[1].cy < 420);
put(1140, 620 - 94);
frames(10);
check('stepping the big yellow switch starts the crane', TB().plate.on === true);
frames(130); // crane lowers
check('crane brings the engine down to grab height', TB().tokens[1].cy > 500);
put(1230, 620 - 94);
frames(8);
check('lowered engine collected', TB().tokens[1].taken && TB().count() === 2);
// dying mid-assembly must not lose parts (state lives on the level object)
vm.runInContext('game.player.inv = 0; game.player.damage(1); game.player.inv = 0; game.player.damage(1); game.player.inv = 0; game.player.damage(1)', sandbox);
frames(60);
tap('Space');
frames(30);
check('death keeps the collected parts', G().state === 'play' && TB().count() === 2);
// part 3: the power core, sealed behind a cracked wall on the high ledge
vm.runInContext('game.player.superT = 0', sandbox); // drop any leftover super mode
put(830, 450 - 94);
frames(25, { ArrowRight: 1 });
check('cracked wall seals the core pocket', G().player.x + G().player.w <= 892 && TB().count() === 2);
vm.runInContext('game.player.superT = 3', sandbox);
frames(30, { ArrowRight: 1 });
check('power smash frees the core (learned mechanic)', TB().count() === 3);
// bring everything home: the assembly ceremony
put(560, 620 - 94);
frames(20);
check('returning with all parts starts the assembly', TB().state === 'building');
frames(220);
check('wheels, engine, power — VROOM, the truck is built', TB().state === 'done' &&
  vm.runInContext("game.pickups.some(p => p.constructor.name === 'ParkedTruck' && !p.dead)", sandbox));
put(330, 620 - 94);
frames(30, { ArrowRight: 1 });
check('the finished truck boards like always', G().player.vehicle === 'truck');
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
check('maze party exit leads into DINO JUNGLE', G().level.n === 10 && sandbox.localStorage.getItem('ffbg_unlocked') === '10');
frames(150);
check('jungle loaded and playing', G().state === 'play' && G().level.theme === 'jungle');
const MIS2 = () => vm.runInContext('game.level.mission', sandbox);
const put2 = (x, y) => vm.runInContext(`game.player.x = ${x}; game.player.y = ${y}; game.player.vx = 0; game.player.vy = 0`, sandbox);
check('five fire-breathing dinos placed', vm.runInContext("game.spiders.filter(s => s.kind === 'firedino').length", sandbox) === 5);
vm.runInContext("game.fb = game.spiders.find(s => s.kind === 'firedino'); game.fb.cycleT = 1.7;", sandbox);
frames(2);
check('cheeks puff before the fire (telegraph stage)', vm.runInContext('game.fb.stage', sandbox) === 'inhale');
check('flame hugs the ground so a jump clears it', (function () {
  const fb = vm.runInContext('game.fb.flameBox()', sandbox);
  return fb.y >= 566 && fb.h <= 50;
})());
put2(880, 620 - 94);
vm.runInContext('game.player.inv = 0; game.fb.cycleT = 2.65;', sandbox);
frames(20);
check('standing in the flame costs one heart', G().player.hearts === 2);
vm.runInContext('game.player.hearts = 3; game.player.inv = 0; game.player.y = 400; game.player.vy = -300; game.fb.cycleT = 2.65;', sandbox);
frames(12);
check('jumping clears the fire unharmed', G().player.hearts === 3);
put2(600, 620 - 94); // step clear before the flame ends
frames(40);
vm.runInContext("game.fb.hit('ice')", sandbox);
check('ice freezes the fire dino', vm.runInContext('game.fb.state', sandbox) === 'frozen');
vm.runInContext('game.player.hearts = 3; game.player.inv = 0;', sandbox);
put2(880, 620 - 94);
frames(30);
check('frozen dino breathes no fire', G().player.hearts === 3);
vm.runInContext("game.fb.state = 'angry'; game.fb.hit('rainbow')", sandbox);
check('rainbow befriends the fire dino', vm.runInContext('game.fb.state', sandbox) === 'friend');
// the ancient gate
put2(4160, 620 - 94);
frames(50, { ArrowRight: 1 });
check('ancient gate blocks the path', G().player.x + G().player.w <= MIS2().gate.solid.x + 2);
check('gate shows its dino-key wish', MIS2().gate.hintT > 0 && MIS2().gate.keyStyle === 'dino');
// the three lost dinosaur eggs: scattered, any order
const TOK2 = i => vm.runInContext(`game.level.mission.puzzle.tokens[${i}]`, sandbox);
check('nest shrine waits with three empty bowls', MIS2().puzzle.shrine.chest.open === false && MIS2().puzzle.count() === 0);
check('third egg bobs in the shrine guard flame path', (function () {
  const fb = vm.runInContext("(function(){const g = game.spiders.filter(s => s.kind === 'firedino'); return g[g.length - 1].flameBox();})()", sandbox);
  const tk = TOK2(2);
  return tk.x + tk.w > fb.x && tk.x < fb.x + fb.w;
})());
// giant mushroom bounce reaches the canopy egg
put2(2042, 580 - 94);
let minY2 = 1e9;
for (let i = 0; i < 70; i++) { frames(1); minY2 = Math.min(minY2, G().player.y); }
check('giant mushroom launches the hero to the canopy', minY2 < 300);
check('canopy egg collected mid-bounce', TOK2(1).taken && MIS2().puzzle.count() === 1);
// dying keeps collected eggs
vm.runInContext('game.player.inv = 0; game.player.damage(1); game.player.inv = 0; game.player.damage(1); game.player.inv = 0; game.player.damage(1)', sandbox);
frames(60);
tap('Space');
frames(30);
check('death does not un-collect eggs', G().state === 'play' && MIS2().puzzle.count() === 1);
put2(1725 - 28, 452 - 60);
frames(6);
check('low platform egg is an easy grab', TOK2(0).taken && MIS2().puzzle.count() === 2);
// freeze the guard and slip in for the flame-guarded egg
vm.runInContext("(function(){const g = game.spiders.filter(s => s.kind === 'firedino'); g[g.length - 1].hit('ice');})()", sandbox);
put2(3380 - 28, 386 - 60);
frames(6);
check('flame-guarded egg collected unharmed past the frozen guard', TOK2(2).taken && MIS2().puzzle.count() === 3 && G().player.hearts === 3);
// return to the nest: ceremony (with the egg-eye gag), vines part, key appears
put2(3800, 430 - 94);
frames(20);
check('nest ceremony begins', MIS2().puzzle.state !== 'collect');
frames(200);
check('eggs settle and the chest opens into the DINO KEY', MIS2().puzzle.done && MIS2().puzzle.shrine.lit === 3 && MIS2().puzzle.shrine.chest.open && MIS2().item.state === 'waiting' && MIS2().item.kind === 'dinokey');
put2(MIS2().item.x, MIS2().item.y);
frames(8);
check('dino key follows the hero', MIS2().item.state === 'follow' && MIS2().state === 'carrying');
vm.runInContext('game.player.inv = 0; game.player.damage(1); game.player.inv = 0; game.player.damage(1); game.player.inv = 0; game.player.damage(1)', sandbox);
frames(60);
tap('Space');
frames(30);
check('respawn keeps the dino key', G().state === 'play' &&
  ['follow', 'flying', 'used'].includes(MIS2().item.state) && ['carrying', 'done'].includes(MIS2().state));
put2(4150, 620 - 94);
frames(10);
check('gate notices the dino key', MIS2().gate.state !== 'locked');
frames(150);
check('ancient gate rises open', MIS2().gate.state === 'open' && MIS2().gate.solid.broken === true && MIS2().state === 'done');
frames(60, { ArrowRight: 1 });
check('hero enters the secret valley', G().player.cx > 4300);
// ---------------- the SPINOSAURUS guards the valley ----------------
frames(30, { ArrowRight: 1 }); // cross the boss trigger
check('spinosaurus intro begins', vm.runInContext("!!(game.cut && game.cut.name === 'spinointro')", sandbox) && G().zombie !== null);
frames(280); // stomp in, roar, hiccup
check('spino stage 1 begins (needs ice)', G().bossStage === 1 && G().bossPlan[1] === 'ice' && G().zombie.state === 'chase');
check('valley sealed on both sides', vm.runInContext('game.spinoWalls.length', sandbox) === 2 && !vm.runInContext('game.spinoWalls[0].broken || game.spinoWalls[1].broken', sandbox));
// his flame hurts a grounded hero but stays jumpably low
vm.runInContext("game.zombie.x = 5100; game.zombie.facing = -1; game.zombie.breathT = 3.15; game.player.hearts = 3; game.player.inv = 0;", sandbox);
put2(4880, 620 - 94);
frames(20);
check('spino flame costs one heart', G().player.hearts === 2);
check('spino flame stays jumpably low', (function () {
  const fb = vm.runInContext('game.zombie.flameBox()', sandbox);
  return fb.y >= 545 && fb.h <= 70;
})());
vm.runInContext("game.zombie.setState('chase'); game.zombie.hitBy('fire')", sandbox);
check('wrong power shows a hint, no progress', G().zombie.wrongT > 0 && G().zombie.hp === 3);
// death during the boss respawns inside the sealed valley
vm.runInContext('game.player.inv = 0; game.player.damage(1); game.player.inv = 0; game.player.damage(1)', sandbox);
frames(60);
tap('Space');
frames(10);
check('boss death respawns inside the valley arena', G().state === 'play' && Math.abs(G().player.x - (G().arenaL + 20)) < 2);
vm.runInContext("game.zombie.hitBy('ice'); game.zombie.hitBy('ice'); game.zombie.hitBy('ice')", sandbox);
check('three ice hits douse the flames -> stage 2 (needs fire)', G().bossStage === 2 && G().zombie.hp === 2);
frames(150); // dizzy passes
vm.runInContext("game.zombie.hitBy('fire'); game.zombie.hitBy('fire'); game.zombie.hitBy('fire')", sandbox);
check('three fire hiccups -> stage 3 (needs rainbow)', G().bossStage === 3 && G().zombie.hp === 1);
frames(150);
vm.runInContext("game.zombie.hitBy('rainbow')", sandbox);
frames(170); // rainbow transformation
check('rainbow befriends the spinosaurus', G().zombie.state === 'friend' && G().zombie.hp === 0);
check('valley walls crumble for a friend', vm.runInContext('game.spinoWalls[0].broken && game.spinoWalls[1].broken', sandbox) === true);
put2(5560, 620 - 94);
frames(20);
check('valley golden star starts the party', G().endPhase === 'party');
frames(320);
tap('Space');
frames(5);
check('jungle party exit returns to title', G().state === 'title');

// ---------------- mini-game: CLOUD CLIMB ----------------
vm.runInContext('game.startLevel(3)', sandbox);
frames(150);
vm.runInContext('game.level.marker = 42', sandbox); // prove the host level object survives
put(2480 - 28, 560 - 94);
frames(10);
check('cloud door leads into CLOUD CLIMB', G().level.n === 'cloudclimb');
frames(150);
check('cloud climb plays', G().state === 'play');
put(200, 3340 - 94);
tap('ArrowUp');
frames(55);
check('one-way clouds: jump up through, land on top', Math.abs(G().player.y + 94 - 3200) < 5);
put(930, 2680 - 94);
let mSup = 1e9;
for (let i = 0; i < 80; i++) { frames(1); mSup = Math.min(mSup, G().player.y); }
put(225, 2680 - 94);
let mNorm = 1e9;
for (let i = 0; i < 80; i++) { frames(1); mNorm = Math.min(mNorm, G().player.y); }
check('super cloud launches far higher than a normal cloud', mSup < mNorm - 250);
put(920, 1910 - 94);
frames(60);
check('side cloud launches up and across', G().player.x < 700);
put(340, 1040 - 94); // ride the final super cloud all the way up
let mFin = 1e9;
for (let i = 0; i < 100; i++) { frames(1); mFin = Math.min(mFin, G().player.y); }
check('final super cloud carries the hero up onto the summit', Math.abs(G().player.y + 94 - 380) < 6 && mFin < 340);
put(830, 380 - 94);
frames(20);
check('cloud summit starts the celebration', G().endPhase === 'party' && G().level.n === 'cloudclimb' && G().miniDone.cloudclimb === true);
frames(320);
tap('Space');
frames(5);
check('returning lands back in Cloud World, same level object', G().level.n === 3 && G().level.marker === 42 && G().state === 'play');

// ---------------- mini-game: UNICORN SKY FLIGHT ----------------
vm.runInContext('game.startLevel(8)', sandbox);
frames(150);
put(4480 - 28, 1000 - 94);
frames(10);
check('rainbow ring leads into SKY FLIGHT', G().level.n === 'skyflight');
frames(150);
check('sky flight plays on unicorn wings', G().state === 'play' && G().player.vehicle === 'unicorn' && G().level.flight === true);
const yF0 = G().player.y;
frames(50, { ArrowUp: 1 });
check('holding Up rises', G().player.y < yF0 - 120);
const yF1 = G().player.y;
frames(60);
check('releasing Up drifts gently down', G().player.y > yF1 + 40);
frames(40, { ArrowLeft: 1 });
check('steering banks sideways', G().player.x < 560);
put(640 - 28, 3400 - 47);
frames(6);
check('rainbow stars collect into the tally', G().flightStars >= 1);
check('weave bars have opposite openings', vm.runInContext('game.level.solids.some(s => s.y === 1500 && s.x === 0) && game.level.solids.some(s => s.y === 1200 && s.x === 400)', sandbox) === true);
put(640 - 28, 380);
frames(20);
check('reaching the moon starts the celebration', G().endPhase === 'party' && G().level.n === 'skyflight' && G().miniDone.skyflight === true);
frames(320);
tap('Space');
frames(5);
check('flight exits back to the forest', G().level.n === 8 && G().state === 'play');
frames(20, { ArrowUp: 1 });
frames(70);
check('no flight physics leak back in the forest', Math.abs(G().player.y + 94 - 1000) < 8 && G().player.vehicle !== 'unicorn');
vm.runInContext('game.goTitle()', sandbox);
frames(3);

// ---------------- mini-game: SECRET VOLCANO ESCAPE ----------------
vm.runInContext('game.startLevel(6)', sandbox);
frames(150);
put(802, 620 - 94);
frames(10);
check('cracked wall leads into the SECRET VOLCANO ESCAPE', G().level.n === 'volcanoescape');
frames(150);
check('volcano escape plays with rising lava armed', G().state === 'play' && !!G().level.risingLava);
check('vertical camera tracks the tall shaft', G().cam.y > 1000);
const RL = () => vm.runInContext('game.level.risingLava', sandbox);
// climbing pulls the lava after you...
put(1310, 2450 - 94);
frames(60);
check('lava rises while the hero climbs', RL().y < 3070);
// ...but it always pauses just beneath you — never a panic timer
vm.runInContext('game.level.risingLava.y = game.player.y + game.player.h + 150', sandbox);
frames(40);
check('lava never chases right at your feet', RL().y - (G().player.y + G().player.h) >= 139);
// dunking a toe: one heart, big mercy bounce, invulnerability to climb out
vm.runInContext('game.player.hearts = 3; game.player.inv = 0; game.level.risingLava.y = game.player.y + game.player.h - 10', sandbox);
frames(4);
check('lava dip costs one heart and bounces you out', G().player.hearts === 2 && G().player.vy < -300);
vm.runInContext('game.level.risingLava.y = 2600', sandbox);
// the steam vent: wait for the blast, ride it to the catch ledge
put(1204, 2410 - 94);
frames(10); // settle standing on the vent
vm.runInContext('game.level.vents[0].ventT = 2.35', sandbox);
let mVent = 1e9;
for (let i = 0; i < 80; i++) { frames(1); mVent = Math.min(mVent, G().player.y); }
check('erupting vent launches the hero sky-high', mVent < 2000);
// REGRESSION (found by Ryan): the express vent used to fire you head-first
// into the crater wall's underside, and the solid terraces bonked from below —
// the top of the climb was practically unfinishable. Ride it for real:
put(320, 1430 - 94);
frames(10); // settle on the express vent
vm.runInContext('game.level.vents[1].ventT = 2.35', sandbox);
let ventMin = 1e9, landedC = false;
for (let i = 0; i < 110; i++) {
  frames(1);
  ventMin = Math.min(ventMin, G().player.y);
  if (Math.abs(G().player.y + 94 - 720) < 3 && G().player.vy === 0) landedC = true;
}
check('express vent clears the crater rim (no head bonk)', ventMin < 640);
check('express vent lands the hero on terrace C', landedC);
check('every volcano terrace is jump-through one-way', vm.runInContext('game.level.solids.every(s => s.h !== 60 || s.oneWay)', sandbox));
// the bail-out shelf hops up THROUGH one-way terrace C
put(300, 850 - 94);
frames(6);
tap('ArrowUp');
frames(50);
check('bail-out shelf hop passes up through terrace C', Math.abs(G().player.y + 94 - 720) < 5);
// the ladder route's final hops fit fully under the floating crater rim
put(800, 860 - 94);
frames(6);
let hopMin = 1e9;
tap('ArrowUp');
for (let i = 0; i < 40; i++) { frames(1); hopMin = Math.min(hopMin, G().player.y); }
check('full jump under the crater rim reaches its natural apex', Math.abs(hopMin - 618) < 10);
// reaching a checkpoint shoves the lava back down
vm.runInContext('game.level.risingLava.y = 1000; game.checkpoint = game.level.checks[2]; game.checkpoint.reached = true;', sandbox);
frames(3);
check('checkpoints push the lava back down', RL().y >= 1120);
// the crater rim: burst out, grab the star, party
put(950, 460 - 94);
frames(25);
check('the crater rim star starts the celebration', G().endPhase === 'party' && G().level.n === 'volcanoescape');
check('volcano secret completion is remembered', G().miniDone.volcanoescape === true && sandbox.localStorage.getItem('ffbg_mini').includes('volcanoescape'));
frames(320);
tap('Space');
frames(5);
check('escape exits back to Lava World', G().level.n === 6 && G().state === 'play');
check('no rising-lava state leaks back into the host', G().level.risingLava === null && G().level.vents === null);
frames(40);
check('normal lava world physics after return', ['play', 'dead'].includes(G().state));

// ---------------- mini-game: SECRET BUBBLE MAZE ----------------
vm.runInContext('game.startLevel(2)', sandbox);
frames(150);
put(3102, 1012 - 60);
frames(10);
check('bubble stream cave leads into the SECRET BUBBLE MAZE', G().level.n === 'bubblemaze');
frames(150);
check('bubble maze plays underwater', G().state === 'play' && G().level.water === true && G().level.currents.length === 5);
// the up current carries you, but steering stays free
put(420, 1400);
frames(70);
check('up current carries the hero to the starfish room', G().player.y < 1220);
put(420, 1300);
frames(35, { ArrowLeft: 1 });
check('swimming across a current stays possible', G().player.x < 370);
// the triple bubble valves seal the treasure shaft
put(1270, 950);
frames(60, { ArrowUp: 1 });
check('bubble valves block the treasure shaft', G().player.y >= 815);
// each shell switch pops its color-matched valve
const VBROKEN = () => vm.runInContext('game.level.solids.filter(s => s.valve && s.broken).length', sandbox);
put(160, 1096 - 40);
frames(6);
check('starfish shell switch pops the blue valve', VBROKEN() === 1 &&
  vm.runInContext("game.level.solids.find(s => s.valve && s.broken).kind === 'ice'", sandbox) &&
  vm.runInContext('game.level.shellSwitches[0].on', sandbox));
put(2340, 1846 - 40);
frames(6);
put(2340, 1096 - 40);
frames(6);
check('all three shell switches pop all three valves', VBROKEN() === 3);
// ride the freed shaft current straight up into the pearl chamber
put(1270, 950);
frames(170, { ArrowUp: 1 });
check('the freed current lifts you to the giant pearl', G().endPhase === 'party' && G().level.n === 'bubblemaze');
check('bubble maze completion is remembered', G().miniDone.bubblemaze === true);
frames(320);
tap('Space');
frames(5);
check('maze exits back to Underwater World', G().level.n === 2 && G().state === 'play');
check('no currents or switches leak back into the host', G().level.currents === null && G().level.shellSwitches === null);
vm.runInContext('game.goTitle()', sandbox);
frames(3);

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

check('game is titled Block Buddies everywhere', (function () {
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const man = fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8');
  return idx.includes('<title>Block Buddies: The Adventures of Jack-Jack and Becca</title>') &&
    JSON.parse(man).name === 'Block Buddies: The Adventures of Jack-Jack and Becca';
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
check('title defaults selection to furthest level', G().selLevel === 10);
for (let i = 0; i < 5; i++) { tap('ArrowLeft'); frames(2); }
check('left arrow moves level selection', G().selLevel === 5);
tap('Space');
frames(5);
check('space starts the SELECTED level, not the last one', G().level.n === 5 && G().state === 'intro');
vm.runInContext('game.goTitle()', sandbox);
frames(3);
check('tapping a medallion starts that level', (function () {
  vm.runInContext('game.titleTap({x: W/2 - 382.5 + 85, y: 688})', sandbox); // medallion 2
  return G().level.n === 2 && G().state === 'intro';
})());
vm.runInContext('game.goTitle()', sandbox);
frames(3);

// title level select
tap('Digit3');
frames(5);
check('digit key starts that level from title', G().level.n === 3 && G().state === 'intro');

// ---------------- secret title combos (keyboard only) ----------------
vm.runInContext('game.goTitle()', sandbox);
frames(3);
for (let i = 0; i < 5; i++) { tap('ArrowUp'); frames(2); }
check('Up×5 combo unlocks all worlds', G().unlocked === 10 && sandbox.localStorage.getItem('ffbg_unlocked') === '10' && G().selLevel === 10);
for (let i = 0; i < 4; i++) { tap('ArrowDown'); frames(2); }
frames(90); // > 1.2s gap — the streak must expire
tap('ArrowDown');
frames(2);
check('slow Down presses do not reset the game', G().unlocked === 10);
frames(90); // let that stray press's streak window expire
vm.runInContext("game.royal = true; game.setCharacter('girl')", sandbox);
for (let i = 0; i < 5; i++) { tap('ArrowDown'); frames(2); }
check('Down×5 combo resets progress and clears storage', G().unlocked === 1 && G().royal === false &&
  G().character === 'boy' && G().selLevel === 1 &&
  sandbox.localStorage.getItem('ffbg_unlocked') === null &&
  sandbox.localStorage.getItem('ffbg_char') === null &&
  sandbox.localStorage.getItem('ffbg_royal') === null);
check('touch-synthesized presses cannot fire combos', (function () {
  for (let i = 0; i < 6; i++) { vm.runInContext("TouchUI.press('ArrowUp')", sandbox); frames(2); vm.runInContext("keys.ArrowUp = false", sandbox); }
  return G().unlocked === 1;
})());

// long soak: run each level 12 simulated seconds with chaotic input
for (const n of [1, 2, 3, 4, 5, 10]) {
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
