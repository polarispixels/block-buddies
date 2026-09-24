// CHARACTER CATALOG for the coloring-book gallery (docs/characters/).
// Every entry draws a character with the game's OWN drawing code (no image
// files, same as the game), feet on (CAT_CX, CAT_G) in a 1000x1000 scratch
// space. The page trims to the drawn pixels and re-renders at full size.
// The harness loads this file after the game and calls every draw(), so a
// renamed game function breaks the build instead of silently breaking the page.
// Adding a character = one more entry here, then run tools/export-characters.py
// to publish its PNGs + update assets/characters.json (the harness enforces it).
// IDs are PUBLIC and PERMANENT (external tools fetch assets/characters/<id>.png):
// never rename or reuse one — change `name` freely instead.
const CAT_CX = 500, CAT_G = 760, CAT_T = 1.0; // t=1.0: every face's eyes are open (no blink)

function catPlayer(character, vehicle, opts = {}) {
  const pl = new Player(CAT_CX - 28, CAT_G - 94);
  pl.t = CAT_T; pl.facing = 1; pl.mood = opts.mood || 'happy';
  pl.onGround = true; pl.inv = 0;
  if (vehicle === 'unicorn') { pl.vehicle = 'unicorn'; pl.w = 112; pl.h = 98; }
  pl.x = CAT_CX - pl.w / 2; pl.y = CAT_G - pl.h;
  return pl;
}
// the heroes read game.character / game.royal while drawing; set them for one draw and restore
function catAsHero(character, fn) {
  const c = game.character, r = game.royal, lv = game.level;
  game.character = character; game.royal = false; game.level = null;
  try { fn(); } finally { game.character = c; game.royal = r; game.level = lv; }
}
function catBoss(Cls, state) {
  const b = new Cls(CAT_CX, CAT_G);
  b.x = CAT_CX - b.w / 2; b.y = CAT_G - b.h;
  b.t = CAT_T; b.facing = 1; b.state = state; b.st = 1;
  return b;
}
function catWithBoss(fn) { // bossStage 0 hides the hp hearts; a far-right player keeps eyes looking forward
  const bs = game.bossStage, pl = game.player;
  game.bossStage = 0; game.player = catPlayer('boy', 'wheel');
  game.player.x = CAT_CX + 400;
  try { fn(); } finally { game.bossStage = bs; game.player = pl; }
}

// Drop see-through fills (glows, halos) while drawing — for art whose
// "I'm a prize" glow would leave a translucent wash on a standalone image.
function catNoGlow(real) {
  return new Proxy(real, {
    get(t, k) {
      if (k === 'fill' || k === 'fillRect') return (...a) => {
        const m = typeof t.fillStyle === 'string' && /rgba\([^)]*,\s*([\d.]+)\)/.exec(t.fillStyle); // colour alpha counts too
        if (t.globalAlpha * (m ? +m[1] : 1) >= 0.5) t[k](...a);
      };
      const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}
// Uniform scale around an anchor, for art functions without a size param.
function catScaled(ctx, cx, cy, s, fn) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
  try { fn(); } finally { ctx.restore(); }
}
// The jungle's friendly dinos are inline blocks in levels.js drawDecor(),
// gated by lv.theme/lv.decor — hand it the minimal level it reads.
function catJungleDecor(ctx, decor) { drawDecor(ctx, { theme: 'jungle', decor }, { x: 0 }, CAT_T); }

const CHARACTER_CATALOG = [
  { id: 'jack-jack', name: 'Jack-Jack', group: 'Heroes', blurb: 'Our hero, in his orange cap, on his trusty wheel.',
    draw(ctx) { catAsHero('boy', () => catPlayer('boy', 'wheel').draw(ctx)); } },
  { id: 'becca', name: 'Becca', group: 'Heroes', blurb: 'Curly blonde hair and a little pink bow.',
    draw(ctx) { catAsHero('girl', () => catPlayer('girl', 'wheel').draw(ctx)); } },
  { id: 'unicorn', name: 'The Unicorn', group: 'Friends', blurb: 'The rainbow-horned flying unicorn of Unicorn Forest.',
    draw(ctx) { drawUnicornBody(ctx, CAT_CX - 56, CAT_G - 98, 112, 98, CAT_T, { facing: 1 }); } },
  { id: 'unicorn-flying', name: 'Unicorn in Flight', group: 'Friends', blurb: 'Wings up — mid-flap over the forest.',
    draw(ctx) { drawUnicornBody(ctx, CAT_CX - 56, CAT_G - 98, 112, 98, CAT_T, { facing: 1, airborne: true, flapT: 0 }); } },
  { id: 'jack-jack-unicorn', name: 'Jack-Jack Rides the Unicorn', group: 'Heroes', blurb: 'Jack-Jack in the saddle.',
    draw(ctx) { catAsHero('boy', () => catPlayer('boy', 'unicorn').draw(ctx)); } },
  { id: 'becca-unicorn', name: 'Becca Rides the Unicorn', group: 'Heroes', blurb: 'Becca in the saddle.',
    draw(ctx) { catAsHero('girl', () => catPlayer('girl', 'unicorn').draw(ctx)); } },
  { id: 'monster-truck', name: 'The Monster Truck', group: 'Vehicles', blurb: 'Jack-Jack at the wheel of the rally truck.',
    draw(ctx) { catAsHero('boy', () => drawTruckBody(ctx, CAT_CX - 52, CAT_G - 96, 104, 96, CAT_T, { character: 'boy', facing: 1, mood: 'grin' })); } },
  { id: 'zombie', name: 'The Zombie', group: 'Bosses', blurb: 'Boss of Zombie Cave (a big softie, really).',
    draw(ctx) { catWithBoss(() => catBoss(Zombie, 'chase').draw(ctx)); } },
  { id: 'king-magma', name: 'King Magma', group: 'Bosses', blurb: 'The molten king of Lava World.',
    draw(ctx) { catWithBoss(() => catBoss(Magma, 'chase').draw(ctx)); } },
  { id: 'spinosaurus', name: 'Giant Spinosaurus', group: 'Bosses', blurb: 'The Dino Jungle boss, befriended with a rainbow.',
    draw(ctx) { catWithBoss(() => catBoss(Spino, 'chase').draw(ctx)); } },

  // ---- creatures from js/entities.js, js/util.js, js/levels.js ----
  { id: 'block-buddy', name: 'Block Buddy', group: 'Friends',
    blurb: 'One of the game’s namesake smiley blocks, found all over every world.',
    draw(ctx) {
      const s = 380;
      drawBlock(ctx, CAT_CX - s / 2, CAT_G - s, s, 'rainbow', CAT_T, {});
    } },

  { id: 'spider', name: 'Spider', group: 'Critters',
    blurb: 'A little purple spider from the early worlds — not so scary once you make friends.',
    draw(ctx) {
      const sp = new Spider(CAT_CX, CAT_G, 'walk');
      sp.t = CAT_T; sp.dir = 1; sp.state = 'angry'; sp.frozenT = 0; sp.danceT = 0; sp.burnT = 0;
      sp.draw(ctx);
    } },

  { id: 'centipede', name: 'Centipede', group: 'Critters',
    blurb: 'A many-legged critter that scurries through Unicorn Forest.',
    draw(ctx) {
      const cp = new Centipede(CAT_CX - 75, CAT_G, 6, 260);
      cp.t = CAT_T; cp.dir = 1;
      cp.update(0); // deterministic: dt=0, 'angry' branch only positions segments, no particles/game state
      cp.draw(ctx);
    } },

  { id: 'fire-dino', name: 'Fire-Breathing Dino', group: 'Critters',
    blurb: 'A fire-breathing dino from Dino Jungle, catching his breath between flame bursts.',
    draw(ctx) {
      const fb = new FireBreather(CAT_CX, CAT_G, 1);
      fb.t = CAT_T; fb.state = 'angry'; fb.stage = 'idle'; fb.cycleT = 0;
      fb.danceT = 0; fb.frozenT = 0; fb.burpT = 0;
      fb.draw(ctx);
    } },

  { id: 'monkey', name: 'Monkey', group: 'Friends',
    blurb: 'Jack-Jack’s banana-loving friend from the Jungle Treehouse Trail.',
    draw(ctx) {
      const mk = new Monkey(CAT_CX, CAT_G);
      mk.state = 'follow'; mk.facing = 1; mk.onGround = true; mk.vx = 50;
      mk.draw(ctx, CAT_T);
    } },

  { id: 'growth-shroom', name: 'Big Buddy Mushroom', group: 'Friends',
    blurb: 'The golden mushroom that makes heroes grow big and strong.',
    draw(ctx) {
      const gs = new GrowthShroom({ x: CAT_CX - 23, y: CAT_G, w: 46 });
      gs.t = CAT_T; gs.dead = false;
      gs.draw(catNoGlow(ctx)); // no translucent prize halo behind a standalone image
    } },

  { id: 'alien', name: 'Space Alien', group: 'Critters',
    blurb: 'A curious little saucer pilot zipping through the Space Maze.',
    draw(ctx) {
      const sp = new Spider(CAT_CX, CAT_G, 'alien', { axis: 'x', range: 150 });
      sp.t = CAT_T; sp.dir = 1; sp.state = 'angry'; sp.frozenT = 0;
      sp.draw(ctx);
    } },

  { id: 'zombie-town-kid', name: 'Zombie Town Kid', group: 'Friends',
    blurb: 'A kid with a propeller beanie, waiting to be helped in Zombie Town After Dark.',
    draw(ctx) {
      ZombieTown.prototype.drawPerson.call({}, ctx, 2.0, CAT_CX, CAT_G, 'kid', 'happy', 1);
    } },

  { id: 'jungle-longneck', name: 'Long-Neck Dino', group: 'Friends',
    blurb: 'A gentle long-neck dino that leans in to say hello in Dino Jungle.',
    draw(ctx) {
      catJungleDecor(ctx, { longnecks: [{ x: CAT_CX, s: 1.3, c: 0 }] });
    } },

  // ---- the story-level art packs (Flower Land, Ocean Surf, Block Bash, the Station, the Dino Rescue, Planet Blocks) ----
  { id: 'rainbow-spider', name: 'Rainbow Spider', group: 'Friends',
    blurb: 'The giant friendly spider who grows big in Jack’s Rainbow Spider Flower Land.',
    draw(ctx) { FL_ART.rainbowSpider(ctx, CAT_CX, CAT_G, { t: CAT_T, scale: 3, kind: 'rainbow', mood: 'happy', facing: 1 }); } },

  { id: 'flower-person', name: 'Flower Person', group: 'Friends',
    blurb: 'A cheerful daisy friend who lives in the Rainbow Spider Flower Land.',
    draw(ctx) { catScaled(ctx, CAT_CX, CAT_G, 5.2, () => FL_ART.flowerPerson(ctx, CAT_CX, CAT_G, CAT_T, { mood: 'happy', facing: 1 })); } },

  { id: 'bubble-dragon', name: 'Bubble Dragon', group: 'Friends',
    blurb: 'A silly teal dragon who blows bubbles in the Rainbow Spider Flower Land.',
    draw(ctx) { catScaled(ctx, CAT_CX, CAT_G, 2.1, () => FL_ART.bubbleDragon(ctx, CAT_CX, CAT_G, CAT_T, { puff: 0.55, facing: 1, mood: 'happy' })); } },

  { id: 'race-bot', name: 'Race Bot', group: 'Friends',
    blurb: 'A zippy little robot who races through the Rainbow Spider Flower Land.',
    draw(ctx) { catScaled(ctx, CAT_CX, CAT_G, 6.5, () => FL_ART.raceBot(ctx, CAT_CX, CAT_G, CAT_T, { run: 0, facing: 1, mood: 'happy' })); } },

  { id: 'kraken', name: 'The Kraken', group: 'Bosses',
    blurb: 'The giant octopus boss of Ocean Surf — befriend him with the rainbow block.',
    draw(ctx) { SURF_ART.kraken(ctx, CAT_CX, CAT_G, 480, CAT_T, { mood: 'happy', rise: 1, arm: 0 }); } },

  { id: 'shark', name: 'Shark', group: 'Critters',
    blurb: 'A cool shark who splashes surfers off their boards in Ocean Surf.',
    draw(ctx) { SURF_ART.shark(ctx, CAT_CX, CAT_G, 480, CAT_T, { dir: 1, friendly: true }); } },

  { id: 'junkbot', name: 'JunkBot', group: 'Bosses',
    blurb: 'The junkyard boss built from tires and scrap in Junkyard Block Bash.',
    draw(ctx) {
      const jb = { x: CAT_CX - 150, y: CAT_G - 470, w: 300, h: 380, parts: { sign: true, tireL: true, tireR: true, core: true },
        coreOpen: false, stage: 1, hurtT: 0, mood: 'happy', dir: 1, droop: 0, beamT: 0 };
      BASH_ART.junkbot(ctx, jb, CAT_T);
    } },

  { id: 'bouncy-buddy', name: 'Bouncy Buddy', group: 'Friends',
    blurb: 'Bouncy Buddy, the happy rubber ball from Junkyard Block Bash.',
    draw(ctx) { BASH_ART.ball(ctx, CAT_CX, CAT_G - 210, 210, CAT_T, { mood: 'happy' }); } },

  { id: 'giant-spider', name: 'Giant Space Spider', group: 'Bosses',
    blurb: 'The giant alien spider guarding the Alien Space Station.',
    draw(ctx) { ST_ART.bossSpider(ctx, CAT_CX, CAT_G, 460, CAT_T, { mood: 'happy', shield: 0, spawnK: 0, facing: 1 }); } },

  { id: 'alien-spider', name: 'Alien Spider', group: 'Critters',
    blurb: 'A glowing alien spider that scurries through the Alien Space Station.',
    draw(ctx) { ST_ART.alienSpider(ctx, CAT_CX, CAT_G, 380, CAT_T, { mood: 'crawl', size: 'small', facing: 1 }); } },

  { id: 'baby-dino', name: 'Baby Dino', group: 'Friends',
    blurb: 'A happy baby dinosaur rescued in the Great Dinosaur Rescue.',
    draw(ctx) { DINO_ART.baby(ctx, 'trike', CAT_CX, CAT_G, 480, CAT_T, { mood: 'idle', facing: 1 }); } },

  { id: 't-rex', name: 'Friendly T-Rex', group: 'Friends',
    blurb: 'The friendly T-Rex who carries you home in the Great Dinosaur Rescue.',
    draw(ctx) { DINO_ART.adult(ctx, 'rex', CAT_CX, CAT_G, 640, CAT_T, { mood: 'happy', facing: 1 }); } },

  { id: 'rocket', name: 'Rocket', group: 'Vehicles',
    blurb: 'The little rocket from Planet Blocks and the Space map.',
    draw(ctx) { PL_ART.rocket(ctx, CAT_CX, CAT_G, 500, CAT_T, 0, false); } },

  { id: 'pirate-boat', name: 'Monster-Truck Pirate Boat', group: 'Vehicles',
    blurb: 'The wild monster-truck pirate boat from Ocean Surf.',
    draw(ctx) { SURF_ART.pirateBoat(ctx, CAT_CX, CAT_G, 1.55, CAT_T, { facing: 1, mood: 'happy', fire: 0, tilt: 0 }); } },

  { id: 'surfboard', name: 'Surfboard', group: 'Vehicles',
    blurb: 'The surfboard that rides the waves in Ocean Surf.',
    draw(ctx) { SURF_ART.surfboard(catNoGlow(ctx), CAT_CX, CAT_G - 40, 760, CAT_T); } } // no translucent sea shadow
];
