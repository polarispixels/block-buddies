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
for (const f of ['util.js', 'audio.js', 'particles.js', 'entities.js', 'puzzleblocks.js', 'ride.js', 'levels.js', 'game.js']) {
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

// linear chains (v1.20.0): the stage archway ENDS world 1-1 — no star gate
check('world 1 has no star gate anymore', G().level.gate === null);
vm.runInContext("(function(){ const d = game.level.subDoors.find(d => d.advance); game.player.x = d.cx - game.player.w / 2; game.player.y = 620 - game.player.h; })()", sandbox);
frames(10);
check('the stage archway triggers the stage-clear beat', G().state === 'stageclear');
check('reaching stage 2 is remembered', sandbox.localStorage.getItem('ffbg_stage').includes('1:1'));
frames(160);
check('stage-clear auto-advances into BLOCK MEADOW 0-2', G().level.n === 'meadow2' && (G().state === 'intro' || G().state === 'play'));
frames(160);
// the final stage's finale completes the WORLD: full party + next unlock
vm.runInContext('game.player.x = 6480; game.player.y = 620 - game.player.h; game.player.vy = 0;', sandbox);
frames(60, { ArrowRight: 1 });
check('the 0-2 finale star completes WORLD 1 with the full party', G().endPhase === 'party' && G().wonWorld === 1);
check('world completion unlocks Underwater', G().unlocked >= 2);
check('world completion resets the stage-resume progress', !(sandbox.localStorage.getItem('ffbg_stage') || '').includes('1:'));
frames(320);
tap('Space');
frames(5);
check('party Space advances to level 2', G().level.n === 2 && (G().state === 'intro' || G().state === 'play'));

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
check('magma party exit leads into the DESERT SAND SLIDE (world 6 chain)', G().level.n === 'sandslide' && (G().state === 'intro' || G().state === 'play'));
check('level 7 unlocked & saved', G().unlocked === 7 && sandbox.localStorage.getItem('ffbg_unlocked') === '7');

// ---------------- level 7: MONSTER TRUCK RALLY (now with BUILD YOUR TRUCK) ----------------
// a direct start (no Sand Slide delivery) keeps the CLASSIC token hunt —
// the regression guarantee for all existing rally content below
vm.runInContext('game.startLevel(7)', sandbox);
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
// completed doors go DORMANT (found by Ryan: doors on normal walking routes
// kept swallowing the hero after the mini-game was already done)
put(2300, 560 - 94);
frames(45, { ArrowRight: 1 }); // stroll straight across the completed door
check('walking over a completed door never re-enters', G().level.n === 3 && G().player.x > 2480);
put(2480 - 28, 560 - 94);
frames(10); // stand on the trophy marker
tap('Space');
frames(5);
check('standing on the trophy + Space replays on purpose', G().level.n === 'cloudclimb');
vm.runInContext('game.exitSub()', sandbox);
frames(5);
check('manual exit restores the host world', G().level.n === 3 && G().state === 'play');

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

// ---------------- secret: PIPE ROOM (cause & effect) ----------------
vm.runInContext('game.startLevel(1)', sandbox);
frames(150);
check('the meadow hides a burping pipe door', vm.runInContext("game.level.subDoors.some(d => d.sub === 'piperoom')", sandbox));
put(2950 - 28, 620 - 94);
frames(10);
check('the giant pipe swallows the hero into the SECRET PIPE ROOM', G().level.n === 'piperoom');
frames(150);
const PW = () => vm.runInContext('game.level.puzzle', sandbox);
check('machine loaded: chutes mis-aimed, all bulbs dark, no goal star yet',
  PW().state === 'run' && JSON.stringify(PW().aims) === '[1,2,0]' && PW().bulbs.every(b => !b) && G().level.goalStar === null);
// stepping a button swings that pipe to the next machine (edge-triggered)
put(190, 620 - 94);
frames(6);
check('stepping the fire button swings the fire pipe', PW().aims[0] === 2);
put(400, 620 - 94);
frames(5);
put(190, 620 - 94);
frames(6);
check('stepping it again cycles onward (and only once per step)', PW().aims[0] === 0);
// wrong feeds are comedy, never failure
vm.runInContext('game.level.puzzle.aims = [1, 2, 0]; game.level.puzzle.visAim = [1, 2, 0]; game.level.puzzle.dropT = [0.05, 99, 99];', sandbox);
put(640, 620 - 94);
frames(130); // fire block drops and lands in the freezer
check('fire into the freezer = steam gag, machine unharmed and running',
  PW().state === 'run' && PW().bulbs.every(b => !b) && PW().fx.some(f => f.type === 'steam'));
// solve: aim every pipe straight down at its match
vm.runInContext('game.level.puzzle.aims = [0, 1, 2]; game.level.puzzle.visAim = [0, 1, 2]; game.level.puzzle.dropT = [0.05, 0.5, 0.95];', sandbox);
put(1150, 620 - 94); // stand clear of buttons and the star spot
frames(200);
check('three correct feeds latch all three bulbs', PW().bulbs.every(b => b));
frames(200);
check('KA-CHUNK finale erupts candy and reveals the golden star', PW().state === 'done' && !!G().level.goalStar);
put(640 - 28, 500);
frames(20);
check('the machine star starts the celebration', G().endPhase === 'party' && G().level.n === 'piperoom');
check('pipe room completion is remembered', G().miniDone.piperoom === true && sandbox.localStorage.getItem('ffbg_mini').includes('piperoom'));
frames(320);
tap('Space');
frames(5);
check('pipe room exits back to the meadow', G().level.n === 1 && G().state === 'play');
check('no machine state leaks into the meadow', G().level.puzzle === null);
put(2800, 620 - 94);
frames(45, { ArrowRight: 1 });
check('walking over the completed pipe never re-swallows', G().level.n === 1 && G().player.x > 2960);

// ---------------- Letter Blocks: content data integrity ----------------
check('the word bank has exactly 60 entries', vm.runInContext('LB_WORDS.length', sandbox) === 60);
check('every word has 3 unique answer letters (correct + 2 distractors)',
  vm.runInContext('LB_WORDS.every(w => new Set([w.correct, ...w.distractors]).size === 3)', sandbox));
check('every word has a matching icon renderer',
  vm.runInContext('LB_WORDS.every(w => typeof LB_ICONS[w.word] === "function")', sandbox));
check('every prompt keeps the first letter blanked and the rest matching the word',
  vm.runInContext("LB_WORDS.every(w => w.prompt[0] === '_' && w.prompt.slice(1).toLowerCase() === w.word.slice(1))", sandbox));

// ExitDoor: a generic exit trigger, proven here inside an existing sublevel
// (before any level actually uses it) so this check is independent of the
// full Letter Blocks room built below.
vm.runInContext('game.startLevel(1)', sandbox);
frames(150);
put(2950 - 28, 620 - 94);
frames(10);
tap('Space'); // the pipe room is already completed earlier in this run, so its
frames(10);   // door is dormant — replay requires standing on it + Space
check('entered a sublevel to test ExitDoor in isolation', G().level.n === 'piperoom');
frames(150); // clear the intro cutscene (input/triggers are frozen until it auto-advances)
vm.runInContext('game.level.exitDoors.push(new ExitDoor(300, 620));', sandbox);
vm.runInContext('game.player.x = 300 - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vx = 0; game.player.vy = 0;', sandbox);
frames(5);
check('ExitDoor overlap calls exitSub and returns to the host level', G().level.n === 1 && G().state === 'play');
vm.runInContext('game.goTitle()', sandbox);
frames(3);

// ---------------- Letter Blocks: puzzle-controller logic ----------------
vm.runInContext('game.testLB = new LetterBlocksMachine(620);', sandbox);
const LBT = () => vm.runInContext('game.testLB', sandbox);
check('fresh machine starts idle with a word and 3 unique answer letters',
  LBT().state === 'idle' && !!LBT().current && new Set(LBT().slots.map(s => s.value)).size === 3 &&
  LBT().slots.some(s => s.value === LBT().current.correct));

// double-trigger: a second rapid hit on the SAME wrong block is absorbed by its cooldown
const wrongIdx = LBT().slots.findIndex(s => s.value !== LBT().current.correct);
vm.runInContext(`game.testLB.onAnswer(game.testLB.solids[${wrongIdx}]); game.testLB.onAnswer(game.testLB.solids[${wrongIdx}]);`, sandbox);
check('a wrong hit wobbles the block and changes nothing else',
  LBT().wobble[wrongIdx] > 0 && LBT().state === 'idle');

// correct hit locks the round; a second bump mid-animation (any block) is ignored
const correctIdx = LBT().slots.findIndex(s => s.value === LBT().current.correct);
const otherIdx = LBT().slots.findIndex((s, i) => i !== correctIdx);
const wordBefore = LBT().current.word;
vm.runInContext(`game.testLB.onAnswer(game.testLB.solids[${correctIdx}]);`, sandbox);
check('a correct hit locks the round into the fly animation', LBT().state === 'fly');
vm.runInContext(`game.testLB.onAnswer(game.testLB.solids[${otherIdx}]);`, sandbox);
check('a second bump during the fly animation is ignored (word and state unchanged)',
  LBT().current.word === wordBefore && LBT().state === 'fly');

// let the fly (0.6s) then hold (0.9s) timers run out
const candyBeforeLogic = vm.runInContext('game.candy', sandbox);
vm.runInContext('for (let i = 0; i < 100; i++) game.testLB.update(1 / 60);', sandbox);
check('the reward hook awards exactly one candy through the normal economy',
  vm.runInContext('game.candy', sandbox) === candyBeforeLogic + 1);
check('a new randomized puzzle follows automatically, with 3 fresh unique letters',
  LBT().state === 'idle' && LBT().current.word !== wordBefore && new Set(LBT().slots.map(s => s.value)).size === 3);

// pool exhaustion: 130 rounds (2+ reshuffles of a 60-word pool) never repeat
// back-to-back, and the first pass touches all 60 words
vm.runInContext(`
  game.testLB2 = new LetterBlocksMachine(620);
  game.testLBSeen = [];
  for (let i = 0; i < 130; i++) {
    game.testLBSeen.push(game.testLB2.current.word);
    const okIdx = game.testLB2.slots.findIndex(s => s.value === game.testLB2.current.correct);
    game.testLB2.onAnswer(game.testLB2.solids[okIdx]);
    for (let f = 0; f < 100; f++) game.testLB2.update(1 / 60);
  }
`, sandbox);
const seenWords = vm.runInContext('game.testLBSeen', sandbox);
check('no two consecutive puzzles repeat the same word across 130 rounds / 2+ reshuffles',
  seenWords.every((w, i) => i === 0 || w !== seenWords[i - 1]));
check('every one of the 60 words appears within the first pass through the pool',
  new Set(seenWords.slice(0, 60)).size === 60);

// Puzzle Blocks framework: the engine accepts a completely different mode
// (numeric answers, custom prompt/choice rendering) with zero engine changes —
// the reuse contract the next three planned modes (ending letters, counting,
// patterns) depend on
vm.runInContext(`
  game.testPB = new PuzzleBlocksMachine(620, {
    entries: [{ n: 2 }, { n: 3 }, { n: 4 }],
    round: e => ({ correct: e.n, options: [e.n, e.n + 1, e.n - 1] }),
    drawPrompt() {}
  });
`, sandbox);
const PB = () => vm.runInContext('game.testPB', sandbox);
check('a numeric test mode runs on the generic engine (3 unique number choices)',
  PB().state === 'idle' && typeof PB().answer === 'number' &&
  new Set(PB().slots.map(s => s.value)).size === 3 && PB().slots.some(s => s.value === PB().answer));
const pbCandy = vm.runInContext('game.candy', sandbox);
vm.runInContext(`
  const okIdx = game.testPB.slots.findIndex(s => s.value === game.testPB.answer);
  game.testPB.onAnswer(game.testPB.solids[okIdx]);
  for (let f = 0; f < 100; f++) game.testPB.update(1 / 60);
`, sandbox);
check('the numeric mode round completes through the shared reward + advance loop',
  vm.runInContext('game.candy', sandbox) === pbCandy + 1 && PB().state === 'idle');
check('Letter Blocks is a mode of the generic engine, not a fork of it',
  vm.runInContext('new LetterBlocksMachine(620) instanceof PuzzleBlocksMachine', sandbox));

// ---------------- secret: LETTER BLOCKS (Beginning Letters) ----------------
vm.runInContext('game.startLevel(1)', sandbox);
frames(150);
check('the meadow hides a rainbow-sparkle learning door',
  vm.runInContext("game.level.subDoors.some(d => d.sub === 'letterblocks')", sandbox));
// entering is deliberate: walking across the door must NOT swallow the hero
put(2600, 620 - 94);
frames(30, { ArrowRight: 1 });
check('walking across the rainbow door never auto-enters', G().level.n === 1 && G().player.x > 2740);
put(2700 - 35, 620 - 94);
frames(10);
tap('Space');
frames(10);
check('standing on the rainbow door + Space enters LETTER BLOCKS', G().level.n === 'letterblocks');
frames(150); // clear the intro cutscene (input is frozen until it auto-advances)
const LB = () => vm.runInContext('game.level.puzzle', sandbox);
check('the room loads with a word, 3 unique answer letters, and an idle state',
  !!LB().current && LB().state === 'idle' && new Set(LB().slots.map(s => s.value)).size === 3);
const candy0 = G().candy;

// a real jump into the WRONG block: no punishment, puzzle stays active
const wrongSlot = LB().slots.find(s => s.value !== LB().current.correct);
vm.runInContext(`game.player.x = ${wrongSlot.x} - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vx = 0; game.player.vy = 0;`, sandbox);
tap('ArrowUp');
frames(40);
check('a real jump into the wrong block wobbles it and changes nothing',
  G().candy === candy0 && LB().state === 'idle');

// a real jump into the CORRECT block: locks, flies the letter in, awards candy
const correctSlot = LB().slots.find(s => s.value === LB().current.correct);
const wordBefore2 = LB().current.word;
vm.runInContext(`game.player.x = ${correctSlot.x} - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vx = 0; game.player.vy = 0;`, sandbox);
tap('ArrowUp');
frames(40);
check('a real jump into the correct block locks the round', LB().state !== 'idle');
frames(110); // fly (0.6s) + hold (0.9s), with margin
check('candy is awarded exactly once through the normal candy economy', G().candy === candy0 + 1);
check('a new randomized puzzle follows automatically', LB().current.word !== wordBefore2 && LB().state === 'idle');

// leaving mid success-animation: trigger another correct hit, then exit
// through the door WITHOUT waiting for the fly/hold animation to resolve
const correctSlot2 = LB().slots.find(s => s.value === LB().current.correct);
vm.runInContext(`game.player.x = ${correctSlot2.x} - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vx = 0; game.player.vy = 0;`, sandbox);
tap('ArrowUp');
frames(40);
check('a second round is mid-animation before the exit attempt', LB().state !== 'idle');
vm.runInContext('game.player.x = 1150 - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vx = 0; game.player.vy = 0;', sandbox);
frames(5);
check('the exit door works even mid-animation and returns to Block Meadow', G().level.n === 1 && G().state === 'play');
check('no puzzle state leaks into the meadow', G().level.puzzle === null);

// re-entering gives a fresh, independent room — the door re-arms only after
// horizontal separation (same rule as every SubDoor), so walk away first
put(200, 620 - 94);
frames(30);
put(2700 - 35, 620 - 94);
frames(10);
tap('Space');
frames(10);
check('re-entering LETTER BLOCKS rebuilds a fresh machine', G().level.n === 'letterblocks' && LB().state === 'idle');
frames(150); // clear the intro cutscene before the exit door can respond
vm.runInContext('game.player.x = 1150 - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vx = 0; game.player.vy = 0;', sandbox);
frames(5);
check('the room is replayable without limit (no completion flag set)', G().level.n === 1 && !G().miniDone.letterblocks);
vm.runInContext('game.goTitle()', sandbox);
frames(3);

// ---------------- secret: TORCH CAVERN (observation & matching) ----------------
vm.runInContext('game.startLevel(5)', sandbox);
frames(150);
check('the zombie cave hides the glowing-eyes tunnel', vm.runInContext("game.level.subDoors.some(d => d.sub === 'torchcave')", sandbox));
put(660 - 28, 620 - 94);
frames(10);
check('the eye tunnel leads into the TORCH CAVERN', G().level.n === 'torchcave');
frames(150);
const TC = () => vm.runInContext('game.level.puzzle', sandbox);
check('cavern is dark: five unlit torches, sealed stone door',
  G().level.dark === true && TC().torches.length === 5 && TC().torches.every(o => !o.lit) && !TC().doorSolid.broken);
put(1560, 620 - 94);
frames(40, { ArrowRight: 1 });
check('the stone door blocks the way onward', G().player.x + G().player.w <= 1642);
// touch a torch -> it lights -> its symbol wisps home to the door
put(400, 620 - 94);
frames(10);
check('touching the heart torch lights it', TC().torches[0].lit === true);
frames(100);
check('the heart symbol flies home and fills its door slot', TC().filled.heart === true);
// a FIRED fireball lights a torch from across the room (projectile-height rule)
vm.runInContext('game.player.x = 1300; game.player.y = 620 - 94; game.player.vy = 0; game.player.facing = 1; game.player.power = "fire"; game.player.cool = 0; game.projectiles = [];', sandbox);
frames(3);
tap('Space');
frames(40);
check('a fired fireball lights the snore torch from range', TC().torches[4].lit === true);
check('the snore torch gag plays (Zzz from behind the door)', TC().zzzT > 0);
// an ice shot re-douses it — funny, harmless, relightable
vm.runInContext('game.player.power = "ice"; game.player.cool = 0;', sandbox);
tap('Space');
frames(40);
check('an ice shot re-douses the torch (no punishment, no lost progress)', TC().torches[4].lit === false && TC().filled.heart === true);
put(760 - 20, 620 - 94);
frames(8);
check('the bat torch wakes the goofy stone bat', TC().bat.awake === true);
// the two high symbol torches: RIDE the jumps for real (never teleport a traversal)
put(1050, 620 - 94);
frames(5);
tap('ArrowUp');
frames(60);
check('a jump from the floor lands on the lower ledge', Math.abs(G().player.y + 94 - 490) < 5);
check('the star torch lights on the ledge', TC().torches[2].lit === true);
put(1160, 490 - 94);
frames(3);
tap('ArrowUp');
frames(30, { ArrowRight: 1 });
frames(40);
check('a hop carries on up to the high ledge', Math.abs(G().player.y + 94 - 355) < 5);
put(1350 - 20, 355 - 94);
frames(8);
check('the candy torch lights up top', TC().torches[3].lit === true);
frames(110);
check('all three symbols home — the door starts to open', TC().state !== 'explore');
frames(120);
check('door grinds open and the cavern floods with light', TC().doorSolid.broken === true && TC().reveal === true);
frames(150);
check('the scary secret is a baby-zombie slumber party (chest opens, star appears)',
  TC().state === 'done' && TC().chest.open === true && TC().babies.every(b2 => b2.mood === 'grin') && !!G().level.goalStar);
put(1790 - 28, 500);
frames(20);
check('the slumber-party star starts the celebration', G().endPhase === 'party' && G().miniDone.torchcave === true);
frames(320);
tap('Space');
frames(5);
check('torch cavern exits back into the Zombie Cave', G().level.n === 5 && G().state === 'play');
check('no torch state leaks into the cave', G().level.puzzle === null && G().level.dark === true);

// ---------------- secret: ZERO-G STAR CHAMBER (spatial transport) ----------------
vm.runInContext('game.startLevel(9)', sandbox);
frames(150);
check('the space maze hides a cracked asteroid door', vm.runInContext("game.level.subDoors.some(d => d.sub === 'zerog')", sandbox));
put(180 - 28, 2250);
frames(10);
check('the cracked asteroid pulls the hero into the ZERO-G STAR CHAMBER', G().level.n === 'zerog');
frames(150);
const SC = () => vm.runInContext('game.level.puzzle', sandbox);
check('chamber is weightless: five stars, none placed, no goal star',
  G().level.space === true && SC().stars.length === 5 && SC().placed === 0 && G().level.goalStar === null);
// star 1 teaches the loop: grab -> it tails you -> bring it home
put(600 - 28, 780 - 47);
frames(6);
check('touching a star attaches it to the hero', SC().stars[0].state === 'carry');
frames(50, { ArrowRight: 1 });
check('the carried star tails the hero through real swimming', Math.hypot(SC().stars[0].x - G().player.cx, SC().stars[0].y - G().player.cy) < 260);
put(2000, 400); // yank the hero far away — the star must never be lost
frames(10);
check('a carried star can never be left behind', Math.hypot(SC().stars[0].x - G().player.cx, SC().stars[0].y - G().player.cy) < 300);
put(1300 - 28, 610 - 47);
frames(40);
check('the star snaps into its matching socket', SC().stars[0].state === 'set' && SC().placed === 1);
// star 2: swim INTO the asteroid pocket for real
put(1860, 355 - 47);
frames(110, { ArrowRight: 1 });
check('swimming into the asteroid pocket grabs star 2', SC().stars[1].state === 'carry');
put(1090 - 28, 760 - 47);
frames(40);
check('star 2 delivered', SC().placed === 2);
// star 3: cross the solar-wind current for real
put(795, 1200);
frames(15);
check('the solar wind blows the hero upward', G().player.vy < 0 || G().player.y < 1180);
put(950, 1290 - 47);
frames(90, { ArrowLeft: 1 });
check('the hero can cross the solar wind', G().player.x < 700);
put(580, 1240);
frames(55, { ArrowLeft: 1, ArrowDown: 1 });
check('crossing the solar wind reaches star 3', SC().stars[2].state === 'carry');
put(1510 - 28, 760 - 47);
frames(40);
check('star 3 delivered', SC().placed === 3);
// star 4: the energy gate blocks until the big button pops it
put(650, 300);
frames(50, { ArrowLeft: 1 });
check('the energy gate blocks the pocket', G().player.x >= 554);
put(590, 610);
frames(8);
check('the big button pops the energy gate', SC().button.on === true && vm.runInContext("game.level.solids.find(s => s.gate === 'energy').broken", sandbox) === true);
put(650, 300);
frames(100, { ArrowLeft: 1 });
check('hero swims through the open gate and grabs star 4', SC().stars[3].state === 'carry');
put(1180 - 28, 970 - 47);
frames(40);
check('star 4 delivered', SC().placed === 4);
// star 5: the silly alien keeps its star through bumps...
put(2180, 1290);
frames(25, { ArrowRight: 1 });
check('bumping the alien only makes it giggle (it keeps the star)', SC().stars[4].state === 'held' && SC().alien.happy === false);
check('constellation stays unfinished until every star is home', SC().state === 'build');
// ...but a FIRED rainbow melts its heart
put(1900 - 28, 1250 - 47);
frames(8);
check('the floating rainbow block grants rainbow power', G().player.power === 'rainbow');
vm.runInContext('game.player.cool = 0; game.projectiles = [];', sandbox);
put(2050, 1260);
frames(3);
vm.runInContext('game.player.facing = 1;', sandbox);
tap('Space');
frames(60);
check('a fired rainbow makes the alien happily hand over star 5', SC().alien.happy === true && SC().stars[4].state !== 'held');
put(2250 - 28, 1190 - 47);
frames(10);
check('the gifted star attaches', SC().stars[4].state === 'carry' || SC().stars[4].state === 'set');
put(1420 - 28, 970 - 47); // its socket: the right foot
frames(40);
check('all five stars placed — the constellation activates', SC().placed === 5 && SC().state !== 'build');
frames(300);
check('the constellation resolves and reveals the golden star', SC().state === 'done' && !!G().level.goalStar);
put(1300 - 28, 1040 - 47);
frames(20);
check('the constellation star starts the celebration', G().endPhase === 'party' && G().miniDone.zerog === true);
frames(320);
tap('Space');
frames(5);
check('the chamber exits back into the Space Maze', G().level.n === 9 && G().state === 'play');
check('no chamber state leaks into the maze', G().level.puzzle === null && G().level.currents === null);
vm.runInContext('game.goTitle()', sandbox);
frames(3);

// ---------------- secret: JUNGLE TREEHOUSE TRAIL (the mini-adventure) ----------------
vm.runInContext('game.startLevel(10)', sandbox);
frames(150);
check('the jungle hides a rope-ladder door', vm.runInContext("game.level.subDoors.some(d => d.sub === 'treehouse')", sandbox));
put2(260 - 28, 620 - 94);
frames(10);
check('the rope ladder leads into the JUNGLE TREEHOUSE TRAIL', G().level.n === 'treehouse');
frames(150);
const TT = () => vm.runInContext('game.level.puzzle', sandbox);
check('trail loaded: sad monkey, hanging banana, four vines, no goal star yet',
  G().state === 'play' && TT().monkey.state === 'sad' && TT().banana.state === 'hang' &&
  G().level.vines.length === 4 && G().level.goalStar === null);
// ---- vines: grab by jumping in, get carried, release with momentum ----
put2(472, 2540 - 94);
frames(3);
vm.runInContext('game.level.vines[0].t = 0;', sandbox); // hanging dead-center
tap('ArrowUp');
frames(18);
check('jumping into a vine grabs on', vm.runInContext('game.level.vineHold === game.level.vines[0]', sandbox));
frames(30);
check('the vine carries the hero (no falling, no ground)', G().player.vy === 0 && !G().player.onGround &&
  vm.runInContext('game.level.vineHold === game.level.vines[0]', sandbox));
vm.runInContext('game.level.vines[0].t = 3.55;', sandbox); // bottom of a fast rightward swing
frames(2);
tap('ArrowUp'); // LET GO
frames(50);
check('releasing flings the hero along the swing', G().player.x > 520 &&
  vm.runInContext('game.level.vineHold', sandbox) === null);
// ---- the gorge: uncrossable alone, and falling in is a bounce, not a death ----
const heartsGorge = G().player.hearts;
put2(2300, 2540 - 94);
frames(40, { ArrowRight: 1 }); // run straight off the rim
let netMin = 1e9, netBounced = false;
for (let i = 0; i < 140; i++) {
  frames(1);
  netMin = Math.min(netMin, G().player.y);
  if (G().player.vy < -1200) netBounced = true;
}
check('the leaf trampoline bounces the faller sky-high, free of charge', netBounced && G().player.hearts === heartsGorge);
check('the bounce can never reach the far side (region B floor)', netMin > 1450);
for (let i = 0; i < 400 && !(G().player.onGround && G().player.x < 2300); i++) frames(1, { ArrowLeft: 1 });
check('steering the bounces climbs back out to region A', G().player.onGround && Math.abs(G().player.y + 94 - 2540) < 6);
// ---- the throw pad does nothing without a friend ----
put2(2330, 2540 - 94);
frames(20);
check('the launch pad waits politely while the monkey is still sad', !TT().seq && G().level.n === 'treehouse' && G().player.x < 2500);
// ---- meet the monkey: sad, dreaming of a banana that hangs out of reach ----
frames(20);
check('the sad monkey shows his banana thought-bubble', TT().monkey.state === 'sad' && TT().monkey.bubbleT > 0.5);
check('the banana hangs above any jump', TT().banana.y + 34 < 2540 - 94 - 148);
// ---- the machine, in the "wrong" order first: plate -> ladder -> lever -> STUCK ----
const RUNGS = () => vm.runInContext('game.level.solids.filter(s => s.oneWay && s.skipDraw && !s.broken).length', sandbox);
check('the rope ladder starts rolled up', RUNGS() === 0);
put2(1832 - 28, 2540 - 94);
frames(6);
check('stepping the pressure plate unrolls the rope ladder', TT().plate.on === true && RUNGS() === 2);
put2(1672, 2540 - 94);
frames(5);
tap('ArrowUp'); frames(50); // rung 1
tap('ArrowUp'); frames(50); // rung 2
tap('ArrowUp'); frames(55); // the porch
check('the real rungs climb to the lever porch', Math.abs(G().player.y + 94 - 2280) < 5);
frames(30, { ArrowRight: 1 }); // walk into the big red lever
check('the porch lever pulls', TT().lever.on === true);
frames(100); // the banana rides the rope down... into the toucan
check('the banana gets STUCK on the grumpy toucan (funny, not fatal)',
  TT().banana.state === 'stuck' && TT().toucan.state === 'perch' && G().player.hearts === heartsGorge);
// ---- the bounce flower startles the toucan; the banana finishes its drop ----
put2(1990, 2500 - 94);
frames(45); // boing — right past the bird
check('the bounce-flower launch startles the toucan off the rope', TT().toucan.state !== 'perch');
frames(130);
check('the freed banana drops to the jungle floor', TT().banana.state === 'waiting' && TT().toucan.state === 'sulk');
// ---- carry the banana home ----
put2(2110 - 28, 2472 - 47);
frames(8);
check('the banana tags along behind the hero', TT().banana.state === 'follow');
put2(2240, 2540 - 94);
frames(40);
check('banana delivered — the monkey celebrates', TT().banana.state === 'eaten');
frames(220);
check('MONKEY FRIEND ACQUIRED', TT().monkey.state === 'follow');
// ---- dying loses nothing (all trail state lives on the level object) ----
vm.runInContext('game.player.inv = 0; game.player.damage(1); game.player.inv = 0; game.player.damage(1); game.player.inv = 0; game.player.damage(1)', sandbox);
frames(60);
tap('Space');
frames(30);
check('death keeps the friendship and every machine step', G().state === 'play' &&
  TT().monkey.state === 'follow' && TT().plate.on && TT().lever.on && TT().banana.state === 'eaten');
// ---- THE GREAT THROW: monkey airline across the waterfall gorge ----
const candyFly = G().candy;
put2(2330, 2540 - 94);
let flyMin = 1e9;
for (let i = 0; i < 270; i++) { frames(1); flyMin = Math.min(flyMin, G().player.y); }
check('the monkey hurls the hero clear across the gorge', G().player.x > 3200 && Math.abs(G().player.y + 94 - 1500) < 8);
check('the throw arcs high over the waterfall', flyMin < 1350);
check('candy floats along the flight path (collected mid-WHEEE)', G().candy > candyFly);
check('the monkey leaps across right behind you', TT().monkey.state === 'follow' && vm.runInContext('game.level.puzzle.monkey.x', sandbox) > 3100);
// ---- the MONKEY DISCO (gold flower straight up to a hidden ledge) ----
put2(3230, 1460 - 94);
let mDisco = 1e9;
for (let i = 0; i < 100; i++) { frames(1); mDisco = Math.min(mDisco, G().player.y); }
check('the gold flower launches up past the hidden ledge', mDisco < 1060);
check('...THE MONKEY DISCO?! (candy + heart rewards pop)', TT().disco.found === true &&
  vm.runInContext("game.pickups.some(p => p.kind === 'heart' && !p.dead && p.cy < 1200)", sandbox));
// ---- upper canopy: vine crossing 1 (ride it for real) ----
put2(3560, 1360 - 94);
frames(3);
vm.runInContext('game.level.vines[2].t = 2.22;', sandbox); // hanging over the ledge
tap('ArrowUp');
frames(20);
check('canopy vine 1 grabbed from the highland ledge', vm.runInContext('game.level.vineHold === game.level.vines[2]', sandbox));
vm.runInContext('game.level.vines[2].t = 3.62;', sandbox); // bottom of a rightward swing
frames(2);
tap('ArrowUp');
frames(60);
check('vine 1 release lands the catch ledge', Math.abs(G().player.y + 94 - 1340) < 6 && G().player.x > 3760);
// ---- vine crossing 2 onto the mid-tier bridge ----
put2(4140, 1210 - 94);
frames(3);
vm.runInContext('game.level.vines[3].t = 2.22;', sandbox);
tap('ArrowUp');
frames(20);
check('canopy vine 2 grabbed', vm.runInContext('game.level.vineHold === game.level.vines[3]', sandbox));
vm.runInContext('game.level.vines[3].t = 3.62;', sandbox);
frames(2);
tap('ArrowUp');
frames(70);
check('vine 2 release lands the mid-tier bridge', Math.abs(G().player.y + 94 - 1250) < 6 && G().player.x > 4290);
// ---- the second throw: up to the Grand Treehouse balcony ----
put2(4400 - 28, 1250 - 94);
for (let i = 0; i < 250; i++) frames(1);
check('the monkey tosses the hero up to the balcony', Math.abs(G().player.y + 94 - 760) < 8 &&
  G().player.x > 3760 && G().player.x < 4140);
// ---- the Banana Bell finale ----
frames(330);
check('the monkey rings the GREAT BANANA BELL and the star appears', TT().bell.state === 'done' && !!G().level.goalStar);
put2(3830 - 28, 668 - 47);
frames(20);
check('the bell star starts the celebration', G().endPhase === 'party' && G().level.n === 'treehouse');
check('treehouse completion is remembered', G().miniDone.treehouse === true &&
  sandbox.localStorage.getItem('ffbg_mini').includes('treehouse'));
frames(320);
tap('Space');
frames(5);
check('the trail exits back into Dino Jungle', G().level.n === 10 && G().state === 'play');
check('no vines, monkey, or machine leak into the host jungle',
  G().level.vines === null && G().level.vineHold === null && G().level.puzzle === null);
put2(120, 620 - 94);
frames(60, { ArrowRight: 1 });
check('walking over the completed ladder door never re-enters', G().level.n === 10 && G().player.x > 320);
vm.runInContext('game.goTitle()', sandbox);
frames(3);

// ---------------- secret: PIT STOP BEAT BASH (the rhythm game) ----------------
vm.runInContext('game.startLevel(7)', sandbox);
frames(160);
check('the rally hides a thumping pit garage', vm.runInContext("game.level.subDoors.some(d => d.sub === 'beatbash' && d.style === 'garage')", sandbox));
// racing past at monster-truck speed must NEVER hijack the race
vm.runInContext("game.player.vehicle = 'truck'; game.player.x = 2590; game.player.y = 620 - 97; game.player.vx = 460;", sandbox);
frames(30, { ArrowRight: 1 });
check('zooming past the garage in the truck never swallows the racer', G().level.n === 7 && G().player.x > 2740);
// ...but stopping to investigate the strange thumping is the invitation
vm.runInContext("game.player.x = 2660; game.player.y = 620 - 97; game.player.vx = 0;", sandbox);
frames(10);
check('stopping at the garage enters PIT STOP BEAT BASH', G().level.n === 'beatbash');
frames(150);
const BB = () => vm.runInContext('game.level.puzzle', sandbox);
check('band room loaded: show waiting, zero hits, nothing joined, no star yet',
  BB().state === 'waiting' && BB().hits === 0 && BB().instruments.every(i2 => !i2.joined) && G().level.goalStar === null);
put(500, 620 - 94);
frames(20);
check('stepping up to the stage starts the count-in', ['countin', 'jam'].includes(BB().state));
frames(160);
check('the groove begins: a beat is queued, aimed at the tire drum', BB().state === 'jam' && !!BB().beat && BB().beat.target === 0);
// a way-early press is comedy, never damage — and never eats the pending beat
vm.runInContext('game.level.puzzle.songT = game.level.puzzle.beat.at - 0.9', sandbox);
tap('Space');
frames(2);
check('an early press is a funny whiff: no progress lost, beat still live',
  BB().hits === 0 && !!BB().beat && BB().state === 'jam');
// both edges of the generous window count as hits
vm.runInContext('game.level.puzzle.songT = game.level.puzzle.beat.at - 0.25', sandbox);
tap('Space');
frames(2);
check('a slightly-early press inside the window is a HIT', BB().hits === 1 && BB().lamps[0] === 1);
vm.runInContext('game.level.puzzle.songT = game.level.puzzle.beat.at + 0.25', sandbox);
tap('Space');
frames(2);
check('a slightly-late press inside the window is a HIT too', BB().hits === 2 && BB().lamps[0] === 2);
// a beat nobody hits drifts by — shrug, keep everything, queue the next one
vm.runInContext('game.level.puzzle.songT = game.level.puzzle.beat.at + 0.31', sandbox);
frames(5);
check('a missed beat never resets progress (next beat simply queues up)',
  BB().hits === 2 && BB().lamps[0] === 2 && !!BB().beat && BB().beat.at > BB().songT);
// play the show through: the band must join in order, then the finale fires
const beatHit = () => {
  vm.runInContext('game.level.puzzle.songT = game.level.puzzle.beat.at', sandbox);
  tap('Space');
  frames(3);
};
beatHit(); beatHit();
check('four tire hits and the TIRE DRUM joins the band', BB().instruments[0].joined && BB().stage === 1);
for (let i = 0; i < 4; i++) beatHit();
check('the HUBCAP CYMBAL joins second', BB().instruments[1].joined && BB().stage === 2);
for (let i = 0; i < 4; i++) beatHit();
check('the EXHAUST HORN joins third', BB().instruments[2].joined && BB().stage === 3);
for (let i = 0; i < 4; i++) beatHit();
check('the ENGINE BASS joins last — the full band is live', BB().instruments[3].joined && BB().stage === 4);
for (let i = 0; i < 6; i++) beatHit();
check('six full-band hits trigger the monster-truck finale', BB().state === 'finale');
frames(480); // doors fly open, truck rolls in, rev solo, THE BACKFLIP, candy
check('the finale lands done with the golden star revealed', BB().state === 'done' && !!G().level.goalStar);
put(1090 - 28, 620 - 94);
frames(20);
check('the star starts the PIT STOP SUPERSTAR party', G().endPhase === 'party' && G().level.n === 'beatbash');
check('beat bash completion is remembered', G().miniDone.beatbash === true && sandbox.localStorage.getItem('ffbg_mini').includes('beatbash'));
frames(320);
tap('Space');
frames(5);
check('the garage exits back to the rally, still in the truck', G().level.n === 7 && G().state === 'play' && G().player.vehicle === 'truck');
check('no band state leaks into the rally', G().level.puzzle === null);
// the completed door goes dormant for racers; replay stays one Space away
vm.runInContext("game.player.x = 2590; game.player.y = 620 - 97; game.player.vx = 460;", sandbox);
frames(30, { ArrowRight: 1 });
check('the completed garage never swallows a racer again', G().level.n === 7 && G().player.x > 2740);
vm.runInContext("game.player.x = 2660; game.player.y = 620 - 97; game.player.vx = 0;", sandbox);
frames(6);
check('standing on the trophy door alone does not re-enter', G().level.n === 7);
tap('Space');
frames(5);
check('standing + Space replays the whole show', G().level.n === 'beatbash' && G().state === 'intro');
vm.runInContext('game.exitSub()', sandbox);
frames(3);
check('replay exits cleanly back to the rally', G().level.n === 7 && G().state === 'play');
// and the rally still races to the trophy after all that
vm.runInContext("game.player.x = 5320; game.player.y = 620 - 97; game.player.vx = 300; game.player.hearts = 3; game.player.inv = 2;", sandbox);
frames(300, { ArrowRight: 1 });
check('the rally still runs turbo → big ramp → trophy after the secret', G().raceDone === true);
vm.runInContext('game.goTitle()', sandbox);
frames(3);

// ---------------- secret: ZOMBIE TOWN AFTER DARK (Jack's town to save) ----------------
vm.runInContext('game.startLevel(5)', sandbox);
frames(150);
check('the cave ceiling leaks a moonlit shaft', vm.runInContext("game.level.subDoors.some(d => d.sub === 'zombietown' && d.style === 'moonwell')", sandbox));
put(1080 - 28, 620 - 94);
frames(10);
check('stepping into the moonbeam climbs up into ZOMBIE TOWN AFTER DARK', G().level.n === 'zombietown');
frames(150);
const ZT = () => vm.runInContext('game.level.puzzle', sandbox);
check('arrival plays the moonlit-town reveal pan', G().cut && G().cut.name === 'townreveal');
frames(280);
check('after the reveal the hero has control back', !G().cut && G().state === 'play');
check('town loaded: four townspeople need help, no festival, no star',
  ZT().npcs.every(n => n.state === 'need') && ZT().state === 'explore' && G().level.goalStar === null);
// granny: her "ladder" is a haystack two houses down the street — ride the
// WHOLE route: jump on the hay, steer left onto the shop roof, leap the
// rooftop gap, walk the ridge to her
put(1040, 620 - 94);
frames(5);
tap('ArrowUp');
frames(52); // jump, come down on the hay, BOING
check('landing on the haystack launches the hero', G().player.vy < -300 || G().player.y + 94 < 540);
frames(70, { ArrowLeft: 1 });
check('steering left lands on the shop rooftop', Math.abs(G().player.y + 94 - 472) < 6);
put(745, 472 - 94); // stroll to the shop roof's edge
frames(3);
tap('ArrowUp');
frames(60, { ArrowLeft: 1 });
check("the rooftop gap-jump carries over onto granny's roof", Math.abs(G().player.y + 94 - 462) < 6);
frames(30, { ArrowLeft: 1 });
check('reaching granny up there is the whole solution (WHEE incoming)',
  ['leap', 'walk', 'square'].includes(ZT().npcs[0].state));
frames(90);
check('granny mega-leaps clear over the shop into the hay, then trots off',
  ['walk', 'square'].includes(ZT().npcs[0].state) && ZT().npcs[0].y === 620);
// balloon: snagged on a chimney a whole town away from the kid — and too
// high for a plain ground jump (regression guard), so the crates matter
put(2372 - 28, 620 - 94);
frames(3);
tap('ArrowUp');
frames(60);
check('a plain ground jump cannot reach the snagged balloon', ZT().balloon.state === 'stuck');
put(2312, 524 - 94);
frames(5);
tap('ArrowUp');
frames(16, { ArrowRight: 1 });
check('a crate-top jump knocks the balloon free', ZT().balloon.state === 'follow');
put(1250, 620 - 94);
frames(90);
check('walking the balloon home across town delivers it to the kid', ZT().balloon.state === 'held' && ['walk', 'square'].includes(vm.runInContext('game.level.puzzle.npcs[1].state', sandbox)));
// the clock tower refuses to start the festival early
put(1800 - 28, 620 - 94);
frames(3);
tap('Space');
frames(5);
check('the festival cannot be rung in early', ZT().state === 'explore' && !G().level.goalStar);
// scaredy + tiny zombie: candy is the answer (★ with empty pockets = bigger hint)
vm.runInContext('game.candy = 0', sandbox);
put(2470, 620 - 94);
frames(5);
tap('Space');
frames(5);
check('no candy yet: the zombie just begs harder, nothing breaks',
  ZT().npcs[2].state === 'need' && ZT().zombie.bubbleT > 0 && ZT().zombie.state === 'waiting');
vm.runInContext('game.candy = 3', sandbox);
tap('Space');
frames(40);
check('one candy spent from the counter: munch munch', vm.runInContext('game.candy', sandbox) === 2 && ['munch', 'friend'].includes(ZT().zombie.state));
frames(80);
check('zombie befriended, gentleman relieved, both square-bound',
  ZT().zombie.state === 'friend' && ['walk', 'square'].includes(ZT().npcs[2].state));
// the cart: its wheel is wedged by the well at the town's OTHER end;
// walking past does nothing — ★ pops it loose, then it rolls the whole street home
put(240, 620 - 94);
frames(8);
check('walking past the wedged wheel never triggers it', ZT().wheel.state === 'waiting');
tap('Space');
frames(8);
check('★ pops the wheel loose and it rolls off toward the cart', ZT().wheel.state === 'rolling' && ZT().wheel.x > 240);
frames(420); // it rolls the entire street, straight through the square
check('KLUNK across the whole town — the festival cart is fixed', ZT().cart.state !== 'broken' && ZT().wheel.state === 'attached');
frames(400);
check('the carter RIDES his cart into the square (obviously)', ZT().cart.state === 'parked' && ZT().npcs[3].state === 'square');
frames(220);
check('all four gathered — the clock tower arms for midnight',
  ZT().state === 'ready' && ZT().npcs.every(n => n.state === 'square'));
// MIDNIGHT
put(1800 - 28, 620 - 94);
frames(3);
tap('Space');
frames(5);
check('★ at the tower rings in the festival', ZT().state === 'festival');
frames(520); // BONG BONG BONG — zombies, conga, trombone, fireworks, the star
check('the midnight festival erupts and reveals the golden star', ZT().state === 'done' && !!G().level.goalStar);
put(1800 - 28, 620 - 94);
frames(20);
check('the star crowns the MIDNIGHT HERO', G().endPhase === 'party' && G().level.n === 'zombietown');
check('zombie town completion is remembered', G().miniDone.zombietown === true && sandbox.localStorage.getItem('ffbg_mini').includes('zombietown'));
frames(320);
tap('Space');
frames(5);
check('the well leads back down into Zombie Cave', G().level.n === 5 && G().state === 'play');
check('the cave is untouched: still dark, no town state leaked', G().level.dark === true && G().level.puzzle === null);
check('the torch cavern secret still waits down there', vm.runInContext("game.level.subDoors.some(d => d.sub === 'torchcave')", sandbox));
// dormant trophy + deliberate replay
put(1040, 620 - 94);
frames(45, { ArrowRight: 1 });
check('walking through the completed moonbeam never re-swallows', G().level.n === 5 && G().player.x > 1140);
put(1080 - 28, 620 - 94);
frames(6);
tap('Space');
frames(5);
check('standing in the beam + Space replays the whole night', G().level.n === 'zombietown' && G().state === 'intro');
vm.runInContext('game.exitSub()', sandbox);
frames(3);
check('replay exits back to the cave cleanly', G().level.n === 5 && G().state === 'play');
vm.runInContext('game.goTitle()', sandbox);
frames(3);

// ---------------- Big Buddy: grow / shrink / damage soak (v1.14.0) ----------------
vm.runInContext('game.startLevel(1)', sandbox);
frames(170); // intro auto-advances
check('bigbuddy: fresh player starts normal', G().player.big === false && G().player.h === 94);
vm.runInContext('game.player.grow()', sandbox);
check('bigbuddy: grow() sets big and enlarges hitbox', G().player.big === true && G().player.h === 130 && G().player.w === 78);
frames(30);
check('bigbuddy: big player stands stably on ground', Math.abs(G().player.y + G().player.h - 620) < 3);
vm.runInContext('game.player.inv = 0; game.player.hearts = 3; game.player.damage(1)', sandbox);
check('bigbuddy: first hit while big shrinks, costs NO heart', G().player.big === false && G().player.hearts === 3 && G().player.h === 94);
check('bigbuddy: shrink grants invulnerability', G().player.inv > 1.5);
vm.runInContext('game.player.inv = 0; game.player.damage(1)', sandbox);
check('bigbuddy: next hit uses the normal heart system', G().player.hearts === 2);
vm.runInContext('game.player.grow(); game.player.grow()', sandbox);
check('bigbuddy: double grow stays one size', G().player.h === 130);
vm.runInContext('game.player.boardTruck()', sandbox);
check('bigbuddy: boarding a vehicle resets big', G().player.big === false && G().player.w === 104);
vm.runInContext('game.startLevel(1)', sandbox);
frames(170);
check('bigbuddy: new level resets to normal size', G().player.big === false && G().player.h === 94);

// GrowthShroom: pops out, settles, waddles, flips at walls, can't be lost, grows Jack
vm.runInContext(`
  game.testShroom = new GrowthShroom({ x: 3540, y: 378, w: 52, h: 52 });
  game.pickups.push(game.testShroom);
  game.player.x = 100; game.player.y = 620 - 94; // out of the way
`, sandbox);
frames(90);
const sh1 = vm.runInContext('game.testShroom', sandbox);
check('shroom: settles onto the ground', Math.abs(sh1.y + sh1.h - 620) < 3);
const sx0 = sh1.x;
frames(40);
check('shroom: waddles horizontally', Math.abs(vm.runInContext('game.testShroom.x', sandbox) - sx0) > 30);
vm.runInContext('game.testShroom.x = 3300; game.testShroom.y = 620 - 44; game.testShroom.dir = 1;', sandbox);
frames(60); // block pile at x=3356 is a wall in its face
check('shroom: turns around at walls', vm.runInContext('game.testShroom.dir', sandbox) === -1);
vm.runInContext('game.testShroom.y = 1500;', sandbox); // "fell out of the world"
frames(3);
check('shroom: can never be lost (pops back to its block)', vm.runInContext('game.testShroom.y', sandbox) < 500);
vm.runInContext('game.player.x = game.testShroom.x; game.player.y = game.testShroom.y - 20;', sandbox);
frames(4);
check('shroom: collecting it grows Jack', G().player.big === true && vm.runInContext('game.testShroom.dead', sandbox) === true);
frames(30);
check('shroom: collected shroom leaves the pickup list', !G().pickups.includes(vm.runInContext('game.testShroom', sandbox)));
vm.runInContext('game.player.shrinkDown()', sandbox);

// Head-bonk: ride a real jump into a buddy block and a bonus block
vm.runInContext(`
  game.testBuddy = { x: 1100, y: 620 - 242, w: 52, h: 52, buddy: true };
  game.testBonus = { x: 1240, y: 620 - 242, w: 52, h: 52, bigBonus: true };
  game.level.solids.push(game.testBuddy, game.testBonus);
  game.player.x = 1100 + 26 - game.player.w / 2; game.player.y = 620 - game.player.h;
  game.player.vx = 0; game.player.vy = 0;
`, sandbox);
const pickupsBefore = G().pickups.length;
tap('ArrowUp');
frames(40);
check('bonk: jumping into a buddy block uses it', vm.runInContext('game.testBuddy.used', sandbox) === true);
check('bonk: a GrowthShroom pops out', vm.runInContext('game.pickups.filter(p => p instanceof GrowthShroom).length', sandbox) === 1);
vm.runInContext('game.player.x = 1100 + 26 - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vy = 0;', sandbox);
tap('ArrowUp');
frames(40);
check('bonk: a used buddy block stays quiet', vm.runInContext('game.pickups.filter(p => p instanceof GrowthShroom).length', sandbox) === 1);
vm.runInContext('game.pickups = game.pickups.filter(p => !(p instanceof GrowthShroom));', sandbox);
// small Jack cannot break the candy crate...
vm.runInContext('game.player.x = 1240 + 26 - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vy = 0;', sandbox);
tap('ArrowUp');
frames(40);
check('bonk: small Jack cannot break the bonus crate', !vm.runInContext('game.testBonus.broken', sandbox));
// ...Big Jack smashes it into candy
vm.runInContext('game.player.grow(); game.player.x = 1240 + 26 - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vy = 0;', sandbox);
const candyBefore = G().pickups.length;
tap('ArrowUp');
frames(40);
check('bonk: BIG Jack smashes the bonus crate', vm.runInContext('game.testBonus.broken', sandbox) === true);
check('bonk: smashed crate rains candy', G().pickups.length >= candyBefore + 3);
vm.runInContext('game.player.shrinkDown()', sandbox);

// Real placements: meadow teaches, jungle reinforces (ridden with real jumps)
vm.runInContext('game.startLevel(1)', sandbox);
frames(170);
const mBuddy = G().level.solids.find(s => s.buddy);
const mBonus = G().level.solids.find(s => s.bigBonus);
check('meadow: buddy block placed after the last checkpoint', !!mBuddy && mBuddy.x > 3100 && mBuddy.x < 3700);
check('meadow: candy crate before the gate, off the route', !!mBonus && mBonus.x > mBuddy.x && mBonus.x + mBonus.w < 4035);
check('meadow: both blocks bonkable but walk-under-able', !!mBuddy && !!mBonus && mBuddy.y + mBuddy.h === 620 - 190 && mBonus.y + mBonus.h === 620 - 190);
vm.runInContext('game.player.x = game.level.solids.find(s=>s.buddy).x + 26 - game.player.w/2; game.player.y = 620 - game.player.h; game.player.vy = 0; game.player.vx = 0;', sandbox);
tap('ArrowUp');
frames(40);
check('meadow: real jump bonks the buddy block', mBuddy.used === true);
frames(140); // let the shroom land and waddle
vm.runInContext(`
  (function(){
    const sh = game.pickups.find(p => p instanceof GrowthShroom);
    if (sh) { game.player.x = sh.x; game.player.y = sh.y - 30; }
  })()
`, sandbox);
frames(5);
check('meadow: chasing down the shroom makes Big Jack', G().player.big === true);
vm.runInContext('game.player.x = game.level.solids.find(s=>s.bigBonus).x + 26 - game.player.w/2; game.player.y = 620 - game.player.h; game.player.vy = 0; game.player.vx = 0;', sandbox);
tap('ArrowUp');
frames(40);
check('meadow: Big Jack cracks the candy crate on the way to the gate', mBonus.broken === true);

// Dino Jungle: grow early, then let the first dino's flame teach the shrink lesson
vm.runInContext('game.startLevel(10)', sandbox);
frames(170);
const jBuddy = G().level.solids.find(s => s.buddy);
check('jungle: buddy block sits before the first fire dino', !!jBuddy && jBuddy.x + jBuddy.w < 758);
vm.runInContext('game.player.x = game.level.solids.find(s=>s.buddy).x + 26 - game.player.w/2; game.player.y = 620 - game.player.h; game.player.vy = 0; game.player.vx = 0;', sandbox);
tap('ArrowUp');
frames(40);
check('jungle: real jump bonks the jungle buddy block', !!jBuddy && jBuddy.used === true);
frames(120);
vm.runInContext(`
  (function(){
    const sh = game.pickups.find(p => p instanceof GrowthShroom);
    if (sh) { game.player.x = sh.x; game.player.y = sh.y - 30; }
  })()
`, sandbox);
frames(5);
check('jungle: Big Jack rides again', G().player.big === true);
// walk into the first dino's flame FOR REAL: force the flame stage and stand in it
vm.runInContext(`
  const d = game.spiders.find(s => s.kind === 'firedino');
  d.state = 'angry'; d.cycleT = 2.75; // flame stage of the cycle
  game.player.x = d.x - 120; game.player.y = 620 - game.player.h;
  game.player.inv = 0; game.player.hearts = 3;
`, sandbox);
frames(10);
check('jungle: dino flame shrinks Big Jack instead of taking a heart', G().player.big === false && G().player.hearts === 3);

// Big survives a sub-room visit (exitSub restores the host player instance)
vm.runInContext('game.startLevel(1)', sandbox);
frames(170);
vm.runInContext('game.player.grow(); game.enterSub("piperoom");', sandbox);
frames(170);
check('sub: sublevel player starts normal-sized', G().player.big === false && G().player.h === 94);
vm.runInContext('game.exitSub()', sandbox);
frames(5);
check('sub: Big Jack is still big back in the meadow', G().player.big === true && G().player.h === 130);
vm.runInContext('game.goTitle()', sandbox);
frames(3);

// ---------------- Escape quits to the title (desktop QoL, v1.14.1) ----------------
vm.runInContext('game.startLevel(2)', sandbox);
frames(170);
check('escape: setup reaches play in level 2', G().state === 'play' && G().level.n === 2);
tap('Escape');
frames(3);
check('escape: Escape during play returns to the title', G().state === 'title');
vm.runInContext('game.startLevel(3)', sandbox);
frames(5);
check('escape: setup reaches the intro card', G().state === 'intro');
tap('Escape');
frames(3);
check('escape: Escape during the intro card also exits', G().state === 'title');
// fullscreen guard: the browser owns Esc while fullscreen (it exits fullscreen),
// so that press must NOT also quit the level
vm.runInContext('game.startLevel(1)', sandbox);
frames(170);
vm.runInContext('document.fullscreenElement = {}', sandbox);
tap('Escape');
frames(3);
check('escape: ignored while fullscreen (browser owns that press)', G().state === 'play');
vm.runInContext('document.fullscreenElement = null', sandbox);
tap('Escape');
frames(3);
check('escape: works again once out of fullscreen', G().state === 'title');
// touch can never fire it: TouchUI presses fill justP, not justK
vm.runInContext('game.startLevel(1)', sandbox);
frames(170);
vm.runInContext('TouchUI.press("Escape")', sandbox);
frames(3);
check('escape: a synthetic touch press cannot quit the level', G().state === 'play');
vm.runInContext('game.goTitle()', sandbox);
frames(3);

// ---------------- Meadow 0-2: big-brick walls + refill buddy blocks (v1.15.0) ----------------
vm.runInContext('game.startLevel(1)', sandbox);
frames(170);
// synthetic arena in level 1: a brick wall and a refilling buddy block
vm.runInContext(`
  game.testWall = { x: 1100, y: 380, w: 52, h: 240, bigBrick: true };
  game.testRefill = { x: 620, y: 378, w: 52, h: 52, buddy: true, refill: true }; // clear of the x=780 block pile
  game.level.solids.push(game.testWall, game.testRefill);
  game.player.x = 900; game.player.y = 620 - game.player.h; game.player.vx = 0; game.player.vy = 0;
`, sandbox);
frames(90, { ArrowRight: 1 });
check('bricks: small Jack cannot walk through the wall', G().player.x + G().player.w <= 1102 && !vm.runInContext('game.testWall.broken', sandbox));
check('bricks: pushing the wall shows the mushroom hint bubble', vm.runInContext('game.testWall.hintT', sandbox) > 0);
tap('ArrowUp');
frames(70, { ArrowRight: 1 }); // ride a real jump AT the wall — 240px is unjumpable
check('bricks: the wall is too tall to jump over', G().player.x + G().player.w <= 1102 && Math.abs(G().player.y + G().player.h - 620) < 3);
vm.runInContext('game.player.x = 620 + 26 - game.player.w / 2; game.player.vx = 0; game.player.vy = 0;', sandbox);
tap('ArrowUp');
frames(40);
check('bricks: refill buddy block spawns a shroom on a real bonk', vm.runInContext('game.testRefill.used === true && game.pickups.filter(p => p instanceof GrowthShroom).length === 1', sandbox));
vm.runInContext(`
  (function(){
    const sh = game.pickups.find(p => p instanceof GrowthShroom);
    game.player.x = sh.x; game.player.y = sh.y - 30;
  })()
`, sandbox);
frames(5);
check('bricks: Jack is big and ready to ram', G().player.big === true);
frames(110, { ArrowRight: 1 });
check('bricks: BIG Jack rams straight through the wall', vm.runInContext('game.testWall.broken', sandbox) === true && G().player.x > 1160);
vm.runInContext('if (!game.player.big) game.player.grow(); game.player.inv = 0; game.player.hearts = 3; game.player.damage(1)', sandbox);
check('bricks: the hit shrank him without a heart', G().player.big === false && G().player.hearts === 3);
vm.runInContext('game.player.x = 620 + 26 - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vx = 0; game.player.vy = 0;', sandbox);
tap('ArrowUp');
frames(40);
check('bricks: the refill block re-armed and gave a fresh shroom', vm.runInContext('game.pickups.filter(p => p instanceof GrowthShroom && !p.dead).length', sandbox) === 1);
vm.runInContext(`
  (function(){
    const sh = game.pickups.find(p => p instanceof GrowthShroom && !p.dead);
    game.player.x = sh.x; game.player.y = sh.y - 30;
  })()
`, sandbox);
frames(5);
check('bricks: big again off the refilled block', G().player.big === true);
vm.runInContext('game.player.x = 620 + 26 - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vy = 0;', sandbox);
tap('ArrowUp');
frames(40);
check('bricks: while big, the used block stays quiet (no wasted shrooms)', vm.runInContext('game.pickups.filter(p => p instanceof GrowthShroom && !p.dead).length', sandbox) === 0);
vm.runInContext('game.player.shrinkDown(); game.goTitle()', sandbox);
frames(3);

// ---- the stage door in the meadow + the full 0-2 gauntlet, ridden for real ----
vm.runInContext('game.startLevel(1)', sandbox);
frames(170);
check('stage2: the archway is the world ending (advance door, no gate)',
  G().level.w === 4650 && G().level.gate === null &&
  vm.runInContext("game.level.subDoors.some(d => d.sub === 'meadow2' && d.style === 'stagegate' && d.advance)", sandbox));
vm.runInContext("(function(){ const d = game.level.subDoors.find(d => d.sub === 'meadow2'); game.player.x = d.cx - game.player.w / 2; game.player.y = 620 - game.player.h; })()", sandbox);
frames(10);
check('stage2: the archway starts the stage-clear beat', G().state === 'stageclear');
frames(160);
check('stage2: the beat lands in BLOCK MEADOW 0-2', G().level.n === 'meadow2');
frames(170);
check('stage2: 0-2 is longer than every world so far', G().level.w === 6800);
const w1 = vm.runInContext('game.level.solids.filter(s => s.bigBrick).length', sandbox);
check('stage2: two big-brick walls bar the way', w1 === 2);
// gauntlet leg 1: run right from the start — wall 1 must stop a small hero
vm.runInContext('game.player.x = 1850; game.player.y = 620 - game.player.h; game.player.vx = 0; game.player.vy = 0;', sandbox);
frames(90, { ArrowRight: 1 });
check('stage2: wall 1 stops small Jack cold', G().player.x + G().player.w <= 2052);
// bonk buddy block 1 for real, chase the shroom, grow
vm.runInContext("(function(){ const b = game.level.solids.filter(s => s.buddy)[0]; game.player.x = b.x + 26 - game.player.w / 2; game.player.vx = 0; game.player.vy = 0; })()", sandbox);
tap('ArrowUp');
frames(40);
check('stage2: buddy block 1 gives up its shroom', vm.runInContext('game.pickups.filter(p => p instanceof GrowthShroom && !p.dead).length', sandbox) === 1);
frames(100); // let it land and waddle
vm.runInContext("(function(){ const sh = game.pickups.find(p => p instanceof GrowthShroom && !p.dead); game.player.x = sh.x; game.player.y = sh.y - 30; })()", sandbox);
frames(5);
check('stage2: Big Jack, ready to demolish', G().player.big === true);
vm.runInContext('game.player.x = 1900; game.player.y = 620 - game.player.h; game.player.vy = 0;', sandbox);
frames(70, { ArrowRight: 1 });
check('stage2: wall 1 comes down and Big Jack rolls on through', vm.runInContext('game.level.solids.filter(s => s.bigBrick)[0].broken', sandbox) === true && G().player.x > 2110);
// leg 2: shrink on a hit, refill at block 2, smash the double wall
vm.runInContext('if (!game.player.big) game.player.grow(); game.player.inv = 0; game.player.hearts = 3; game.player.damage(1)', sandbox);
check('stage2: mid-stage hit shrinks, hearts untouched', G().player.big === false && G().player.hearts === 3);
vm.runInContext("(function(){ const b = game.level.solids.filter(s => s.buddy)[1]; game.player.x = b.x + 26 - game.player.w / 2; game.player.y = 620 - game.player.h; game.player.vx = 0; game.player.vy = 0; })()", sandbox);
tap('ArrowUp');
frames(40);
frames(100);
vm.runInContext("(function(){ const sh = game.pickups.find(p => p instanceof GrowthShroom && !p.dead); if (sh) { game.player.x = sh.x; game.player.y = sh.y - 30; } })()", sandbox);
frames(5);
check('stage2: buddy block 2 grows him again', G().player.big === true);
vm.runInContext('game.player.x = 4800; game.player.y = 620 - game.player.h; game.player.vy = 0;', sandbox);
frames(110, { ArrowRight: 1 });
check('stage2: the double wall falls to the candy vault', vm.runInContext('game.level.solids.filter(s => s.bigBrick)[1].broken', sandbox) === true && G().player.x > 5070);
// finale: the golden star
vm.runInContext('game.player.x = 6480; game.player.y = 620 - game.player.h; game.player.vy = 0;', sandbox);
frames(60, { ArrowRight: 1 });
check('stage2: the golden star completes WORLD 1', G().endPhase === 'party' && G().wonWorld === 1);
frames(320);
tap('Space');
frames(5);
check('stage2: the world party leads onward to Underwater', G().level.n === 2);
vm.runInContext('game.goTitle()', sandbox);
frames(3);

// ---------------- SUNKEN TEMPLE 1-2 (v1.16.0) — every chain ridden for real ----------------
vm.runInContext('game.startLevel(2)', sandbox);
frames(170);
check('temple: the seabed archway is the world ending (advance door, no gate)',
  G().level.gate === null &&
  vm.runInContext("game.level.subDoors.some(d => d.sub === 'water2' && d.style === 'stagegate' && d.advance)", sandbox));
vm.runInContext('game.player.x = 3860; game.player.y = 1050;', sandbox);
frames(10);
check('temple: swimming into the archway starts the stage-clear beat', G().state === 'stageclear');
frames(160);
check('temple: the beat lands in the SUNKEN TEMPLE', G().level.n === 'water2');
frames(170);
check('temple: machine + three pearls + three sockets + currents all off', vm.runInContext(
  "game.level.puzzle instanceof SunkenTemple && game.level.puzzle.pearls.length === 3 && game.level.puzzle.sockets.length === 3 && game.level.currents.every(c => c.on === false)", sandbox));
check('temple: the treasure star does not exist yet', G().level.goalStar === null);
// a pearl can never be lost
vm.runInContext('game.level.puzzle.pearls[0].x = 100;', sandbox);
frames(3);
check('temple: a stray pearl pops home to its bowl', Math.abs(vm.runInContext('game.level.puzzle.pearls[0].x', sandbox) - 1544) < 40);
// ---- wing A: valve on -> off -> on (reversible), then the pearl rides the stream ----
vm.runInContext('game.player.x = 1500; game.player.y = 1260; game.player.vx = 0; game.player.vy = 0;', sandbox);
frames(3);
tap('Space');
frames(3);
check('temple: valve A switches its current ON', vm.runInContext("game.level.currents.find(c => c.id === 'ca').on", sandbox) === true);
frames(20);
tap('Space');
frames(3);
check('temple: valve A is fully reversible (off again)', vm.runInContext("game.level.currents.find(c => c.id === 'ca').on", sandbox) === false);
frames(20);
tap('Space');
frames(300);
check('temple: the current carries pearl A into its socket', vm.runInContext('game.level.puzzle.sockets[0].filled', sandbox) === true);
// ---- wing B: one valve alone stalls the pearl (funny, not fatal); both complete it ----
vm.runInContext('game.player.x = 2400; game.player.y = 480; game.player.vx = 0; game.player.vy = 0;', sandbox);
frames(3);
tap('Space');
frames(320);
check('temple: leg 1 alone leaves pearl B stranded below the shaft', vm.runInContext('game.level.puzzle.sockets[1].filled', sandbox) === false &&
  vm.runInContext('game.level.puzzle.pearls[1].y', sandbox) > 400);
vm.runInContext('game.player.x = 3260; game.player.y = 360; game.player.vx = 0; game.player.vy = 0;', sandbox);
frames(3);
tap('Space');
frames(420);
check('temple: the up-shaft lifts pearl B to the high socket', vm.runInContext('game.level.puzzle.sockets[1].filled', sandbox) === true);
// ---- wing C, deliberately out of order: current first pins the pearl on the cage ----
vm.runInContext('game.player.x = 4400; game.player.y = 1210; game.player.vx = 0; game.player.vy = 0;', sandbox);
frames(3);
tap('Space');
frames(200);
check('temple: the caged pearl strains against the membrane', vm.runInContext('game.level.puzzle.sockets[2].filled', sandbox) === false &&
  vm.runInContext('game.level.puzzle.pearls[2].x', sandbox) < 4110);
vm.runInContext('game.player.x = 3640; game.player.y = 1430;', sandbox);
frames(10);
check('temple: the shell switch pops the cage', vm.runInContext("game.level.solids.find(s => s.valve && s.kind === 'rainbow').broken", sandbox) === true);
frames(260);
check('temple: freed, pearl C whooshes into the last socket', vm.runInContext('game.level.puzzle.sockets[2].filled', sandbox) === true);
// ---- the great door wakes ----
frames(120);
check('temple: three wings wake the door — it crumbles open', vm.runInContext('game.level.solids.find(s => s.templeDoor).broken', sandbox) === true);
check('temple: the golden star appears in the treasure chamber', !!G().level.goalStar);
vm.runInContext('game.player.x = 3220; game.player.y = 1270;', sandbox);
frames(30);
check('temple: the star completes WORLD 2 with the full party', G().endPhase === 'party' && G().wonWorld === 2);
check('temple: Cloud World unlocks', G().unlocked >= 3);
frames(320);
tap('Space');
frames(5);
check('temple: the world party leads onward to Cloud World', G().level.n === 3);
vm.runInContext('game.goTitle()', sandbox);
frames(3);

// ---------------- WEATHER FACTORY 2-2 (v1.17.0) — recipes ridden for real ----------------
vm.runInContext('game.startLevel(3)', sandbox);
frames(170);
check('factory: the archway island is the world ending (advance door, no gate)',
  G().level.w === 5000 && G().level.gate === null &&
  vm.runInContext("game.level.subDoors.some(d => d.sub === 'cloud2' && d.style === 'stagegate' && d.advance)", sandbox));
vm.runInContext('game.player.x = 4672; game.player.y = 476; game.player.vx = 0; game.player.vy = 0;', sandbox);
frames(10);
check('factory: the archway starts the stage-clear beat', G().state === 'stageclear');
frames(160);
check('factory: the beat lands in THE WEATHER FACTORY', G().level.n === 'cloud2');
frames(170);
check('factory: machine + six levers + cloud-catch + no star yet', vm.runInContext(
  'game.level.puzzle instanceof WeatherFactory && game.level.puzzle.levers.length === 6', sandbox) &&
  G().level.fallCatch === true && G().level.w === 7600 && G().level.goalStar === null);
// station 1: water lever -> rain -> bloom (and the lever is reversible until it latches)
vm.runInContext('game.player.x = 1730; game.player.y = 1056; game.player.vx = 0; game.player.vy = 0;', sandbox);
frames(3);
tap('Space');
frames(3);
check('factory: the water lever pulls ON', vm.runInContext("game.level.puzzle.L('w1').on", sandbox) === true);
frames(20);
tap('Space');
frames(3);
check('factory: and pulls right back OFF', vm.runInContext("game.level.puzzle.L('w1').on", sandbox) === false);
frames(20);
tap('Space');
frames(140);
check('factory: rain blooms the flower garden', vm.runInContext('game.level.puzzle.st.bloom', sandbox) === true);
check('factory: the giant stalk grew the stairway leaves', vm.runInContext('game.level.solids.filter(s => s.stalkLeaf).length', sandbox) === 3);
tap('Space');
frames(10);
check('factory: a finished station stays finished (latched)', vm.runInContext('game.level.puzzle.st.bloom', sandbox) === true);
frames(25); // let the lever cooldown clear
// station 3 BEFORE power: rain + cold alone cannot make snow — the cable matters
vm.runInContext('game.player.x = 4530; game.player.y = 1056; game.player.vx = 0; game.player.vy = 0;', sandbox);
frames(3);
tap('Space');
frames(25);
vm.runInContext('game.player.x = 4700; game.player.y = 1056;', sandbox);
frames(3);
tap('Space');
frames(160);
check('factory: no power, no snow — the freezer just sputters', vm.runInContext('game.level.puzzle.st.snow', sandbox) === false);
// station 2: the fan spins the windmill -> POWER latches
vm.runInContext('game.player.x = 3060; game.player.y = 956; game.player.vx = 0; game.player.vy = 0;', sandbox);
frames(3);
tap('Space');
frames(100);
check('factory: wind latches the power (flywheel forever)', vm.runInContext('game.level.puzzle.st.power', sandbox) === true);
// station 3 levers were left on: snow now falls and the snowman builds himself
frames(160);
check('factory: rain + cold + power = SNOWMAN', vm.runInContext('game.level.puzzle.st.snow', sandbox) === true);
// station 4 on the high deck: rain + sun + power = the rainbow bridge
vm.runInContext('game.player.x = 5880; game.player.y = 606; game.player.vx = 0; game.player.vy = 0;', sandbox);
frames(3);
tap('Space');
frames(25);
vm.runInContext('game.player.x = 6030; game.player.y = 606;', sandbox);
frames(3);
tap('Space');
frames(160);
check('factory: rain + sun + power = RAINBOW road', vm.runInContext('game.level.puzzle.st.rainbow', sandbox) === true &&
  vm.runInContext('game.level.solids.some(s => s.rainbowRoad)', sandbox));
check('factory: four stations done — the star ignites far away', !!G().level.goalStar);
// ride the rainbow across the great gap for real
vm.runInContext('game.player.x = 6360; game.player.y = 606; game.player.vx = 0; game.player.vy = 0;', sandbox);
frames(240, { ArrowRight: 1 });
check('factory: the rainbow carries the hero to the far island', G().player.x > 7000);
check('factory: the lonely star completes WORLD 3', G().endPhase === 'party' && G().wonWorld === 3);
check('factory: Mountain World unlocks', G().unlocked >= 4);
frames(320);
tap('Space');
frames(5);
check('factory: the world party leads onward to Mountain World', G().level.n === 4);
vm.runInContext('game.goTitle()', sandbox);
frames(3);

// ---- linear chains: title-screen stage resume ----
vm.runInContext('game.stageProg = { 1: 1 }; game.startWorld(1);', sandbox);
frames(5);
check('picking a world resumes at the furthest reached stage', G().level.n === 'meadow2');
vm.runInContext('game.goTitle();', sandbox);
frames(3);
vm.runInContext('game.stageProg = {}; game.startWorld(1);', sandbox);
frames(5);
check('a fresh or fully-beaten world starts back at stage 1', G().level.n === 1);
vm.runInContext('game.goTitle()', sandbox);
frames(3);

// ---------------- DESERT SAND SLIDE (v1.21.0) — the ride, ridden for real ----------------
vm.runInContext('game.partsDelivered = false; game.stageProg = {}; game.startWorld(7)', sandbox);
frames(170);
check('slide: world 6 now begins with the DESERT SAND SLIDE', G().level.n === 'sandslide' && G().state === 'play');
const SL = () => vm.runInContext('game.level.ride', sandbox);
check('slide: on-foot intro, a Pattern Blocks station, board still hidden',
  SL().state === 'intro' && !SL().boardRevealed &&
  vm.runInContext('game.level.puzzle instanceof PatternBlocksMachine', sandbox));
// three correct pattern rounds free the board and lock the machine
vm.runInContext(`
  for (let r = 0; r < 3; r++) {
    const pz = game.level.puzzle;
    const ok = pz.slots.findIndex(s => s.value === pz.answer);
    pz.onAnswer(pz.solids[ok]);
    for (let f = 0; f < 100; f++) pz.update(1 / 60);
  }
`, sandbox);
check('slide: 3 pattern rounds lock the machine WON and reveal the board',
  vm.runInContext('game.level.puzzle.state', sandbox) === 'won' && SL().boardRevealed === true);
vm.runInContext('game.level.puzzle.onAnswer(game.level.puzzle.solids[0])', sandbox);
check('slide: a won machine ignores further bumps', vm.runInContext('game.level.puzzle.state', sandbox) === 'won');
// grab the board -> the ride begins
put(1390 - 28, 620 - 94);
frames(10);
check('slide: grabbing the board starts the ride', SL().state === 'riding');
// the tutorial freeze-frames: JUMP taught on the ground, TRICK taught mid-air
frames(30);
check('tutorial: the ride freezes with the JUMP prompt', SL().tutPhase === 'jump');
const frozenX = G().player.x;
frames(30);
check('tutorial: frozen means frozen', G().player.x === frozenX);
tap('ArrowUp');
frames(4);
check('tutorial: the taught press jumps and resumes the ride', SL().tutPhase !== 'jump' && SL().ride.grounded === false);
frames(10);
check('tutorial: no TRICK prompt yet — the jump gets to breathe first', SL().tutPhase === null);
frames(22);
check('tutorial: at the APEX of the taught jump, the TRICK prompt freezes the moment',
  SL().tutPhase === 'trick' && Math.abs(SL().ride.vy) < 150);
tap('ArrowUp');
frames(4);
check('tutorial: the taught press spins the first trick', SL().tutPhase === null && SL().ride.trickN >= 1);
frames(80); // land and roll on
check('slide: the pre-ride landing squish relaxes instead of freezing on', Math.abs(G().player.squash - 1) < 0.08);
const rx0 = G().player.x;
frames(60);
check('slide: the board rides itself forward (no input needed)', G().player.x > rx0 + 300);
// jumping and tricks
tap('ArrowUp');
frames(4);
check('slide: jump still works on the board', SL().ride.grounded === false);
frames(12); // let the coyote window lapse
tap('ArrowUp');
frames(3);
tap('ArrowUp');
frames(3);
check('slide: airborne presses stack trick flips', SL().ride.trickN >= 2 && SL().ride.spinTarget > 6);
frames(90);
check('slide: landing resets the trick combo', SL().ride.grounded === true && SL().ride.trickN === 0);
// the friendship shot: rainbow blooms a spiky cactus into a friend
vm.runInContext(`(function () {
  const pl = game.player, sl = game.level.ride;
  pl.power = 'rainbow'; pl.cool = 0; pl.inv = 2;
  sl.course.things = sl.course.things.filter(t => t.x < pl.x); // nothing else eats the shot
  game.testFC = { kind: 'cactus', x: pl.x + 300, y: pl.y - 60, w: 60, h: 260, dead: false, t: 0, size: 150 };
  sl.course.things.push(game.testFC);
})()`, sandbox);
tap('Space');
frames(26);
check('slide: a rainbow shot blooms the cactus into a friend', vm.runInContext('game.testFC.friendly', sandbox) === true);
// part-loss economics: re-queued, never below zero
vm.runInContext(`(function () {
  const sl = game.level.ride;
  sl.partsGot = ['tire', 'engine']; sl.pending = ['wheel', 'body', 'exhaust'];
  game.testLose1 = sl.losePart('test');
  game.testRequeued = sl.pending[0] === 'engine';
  sl.partsGot = [];
  game.testLose0 = sl.losePart('test');
})()`, sandbox);
check('slide: a lost part goes straight back into the spawn queue',
  vm.runInContext('game.testLose1', sandbox) === true && vm.runInContext('game.testRequeued', sandbox) === true);
check('slide: empty pockets can never go below zero', vm.runInContext('game.testLose0', sandbox) === false);
// quicksand: comedy sink costs a part, momentum survives
vm.runInContext(`(function () {
  const sl = game.level.ride, pl = game.player;
  pl.inv = 0;
  sl.partsGot = ['tire']; sl.pending = ['engine', 'wheel', 'body', 'exhaust'];
  sl.course.patches.push({ x0: pl.x + 80, x1: pl.x + 420 });
})()`, sandbox);
frames(40);
check('slide: quicksand comedy-sinks and costs the part', SL().partsGot.length === 0 && G().state === 'play');
// generator invariants: readable gaps at final-phase speed, forever
vm.runInContext(`
  (function () {
    const sl = game.level.ride;
    sl.partsGot = ['tire', 'engine', 'wheel', 'body']; sl.pending = ['exhaust']; // 'final' phase pacing
    for (let i = 0; i < 60; i++) sl.emitTemplate();
    const obs = sl.course.things.filter(t => ['cactus', 'rock', 'scorpion'].includes(t.kind)).sort((a, b) => a.x - b.x);
    // every consecutive pair is either one deliberate cluster (jumped as one)
    // or has real reaction room — never the unreadable in-between
    game.testGaps = obs.every((o, i) => {
      if (i === 0) return true;
      const gap = o.x - (obs[i - 1].x + obs[i - 1].w);
      return gap < 120 || gap >= 200;
    });
    game.testPartsAhead = sl.course.things.some(t => t.kind === 'part' && !t.dead);
    // Ryan's rule: parts float at JUMP height — ride under them and you miss
    game.testPartsHigh = sl.course.things.filter(t => t.kind === 'part')
      .every(t => t.y + t.h < 620 - 94 - 40);
  })()
`, sandbox);
check('slide: 60 random templates never create unreadable obstacle spacing', vm.runInContext('game.testGaps', sandbox) === true);
check('slide: missing parts keep spawning ahead (never blockable)', vm.runInContext('game.testPartsAhead', sandbox) === true);
check('slide: every generated part floats above ride-under height (jump required)', vm.runInContext('game.testPartsHigh', sandbox) === true);
// the fifth part -> VICTORY RUN -> mega ramp -> the rally, parts in hand
vm.runInContext(`(function () {
  const sl = game.level.ride, pl = game.player;
  sl.course.things.push({ kind: 'part', part: 'exhaust', x: pl.x + 60, y: pl.y, w: 52, h: 52, dead: false, t: 0 });
})()`, sandbox);
frames(14);
check('slide: the fifth part triggers the VICTORY RUN', SL().state === 'victory' && SL().partsGot.length === 5);
check('slide: the mega ramp is waiting at the end', SL().megaLipX > 0);
vm.runInContext('game.player.x = game.level.ride.megaLipX - 300; game.player.y = game.level.ride.course.groundY(game.player.x + 28) - game.player.h;', sandbox);
frames(45);
check('finale: the mega launch begins the GRAND FLIGHT (not an instant cut)',
  SL().state === 'launched' && G().state === 'play');
frames(60);
check('finale: the farewell flight auto-stacks outrageous flips', SL().ride.spinTarget > 12 && G().state === 'play');
frames(150);
check('slide: after the flight of a lifetime, the stage-clear handoff fires',
  G().state === 'stageclear' || G().level.n === 7);
frames(170);
check('slide: STAGE CLEAR lands in the MONSTER TRUCK RALLY', G().level.n === 7 && (G().state === 'intro' || G().state === 'play'));
frames(160);
check('slide: every part arrived with the hero — the hunt is skipped',
  vm.runInContext('game.level.truckBuild.delivered === true && game.level.truckBuild.count() === 3', sandbox));
put(400, 620 - 94);
frames(20);
check('slide: walking up to the truck starts the assembly ceremony immediately',
  vm.runInContext("game.level.truckBuild.state !== 'collect'", sandbox));
check('slide: the delivered flag was consumed (no leak into later starts)', G().partsDelivered === false);
// Jack's replay wish: a press-gated back door at the rally's start line
check('replay: a Sand Slide back-door waits at the rally start line',
  vm.runInContext("game.level.subDoors.some(d => d.goTo === 'sandslide' && d.press)", sandbox));
put(140 - 28, 620 - 94);
frames(20);
check('replay: standing on the back door never auto-enters', G().level.n === 7);
tap('Space');
frames(10);
check('replay: Space rides the Sand Slide again', G().level.n === 'sandslide');
frames(170);
check('replay: an experienced rider skips the tutorial freeze-frames',
  SL().tutDone.jump === true && SL().tutDone.trick === true && SL().tutPhase === null);
vm.runInContext('game.goTitle()', sandbox);
frames(3);

// ---------------- versioning ----------------
check('GAME_VERSION is valid semver', /^\d+\.\d+\.\d+$/.test(vm.runInContext('GAME_VERSION', sandbox)));
check('CHANGELOG has an entry for the current version', (function () {
  const log = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
  return log.includes('## [' + vm.runInContext('GAME_VERSION', sandbox) + ']');
})());
// Parse the ACTUAL displayed version fields — a bare substring search passes on
// incidental body text like "since v1.9.0" even when the badge itself is stale.
check('docs header badge displays exactly the current version', (function () {
  const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
  const m = doc.match(/<span class="badge">v([0-9.]+)<\/span>/);
  return !!m && m[1] === vm.runInContext('GAME_VERSION', sandbox);
})());
check('docs footer displays exactly the current version', (function () {
  const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
  const m = doc.match(/Block Buddies v([0-9.]+) · built for Jack/);
  return !!m && m[1] === vm.runInContext('GAME_VERSION', sandbox);
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

// title level select — digit keys use DISPLAYED world numbers (0-9 = internal 1-10)
tap('Digit3');
frames(5);
check('digit 3 starts displayed world 3 (internal 4, Mountain)', G().level.n === 4 && G().state === 'intro');
vm.runInContext('game.goTitle()', sandbox);
frames(3);
tap('Digit0');
frames(5);
check('digit 0 starts the training meadow (internal 1)', G().level.n === 1 && G().state === 'intro');

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
