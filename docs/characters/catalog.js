// CHARACTER CATALOG for the coloring-book gallery (docs/characters/).
// Every entry draws a character with the game's OWN drawing code (no image
// files, same as the game), feet on (CAT_CX, CAT_G) in a 1000x1000 scratch
// space. The page trims to the drawn pixels and re-renders at full size.
// The harness loads this file after the game and calls every draw(), so a
// renamed game function breaks the build instead of silently breaking the page.
// Adding a character = one more entry here.
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

const CHARACTER_CATALOG = [
  { id: 'jack-jack', name: 'Jack-Jack', group: 'Heroes', blurb: 'Our hero, in his orange cap, on his trusty wheel.',
    draw(ctx) { catAsHero('boy', () => catPlayer('boy', 'wheel').draw(ctx)); } },
  { id: 'becca', name: 'Becca', group: 'Heroes', blurb: 'Curly blonde hair and a little pink bow.',
    draw(ctx) { catAsHero('girl', () => catPlayer('girl', 'wheel').draw(ctx)); } },
  { id: 'unicorn', name: 'The Unicorn', group: 'Friends', blurb: 'The rainbow-horned flying unicorn of Unicorn Forest.',
    draw(ctx) { drawUnicornBody(ctx, CAT_CX - 56, CAT_G - 98, 112, 98, CAT_T, { facing: 1 }); } },
  { id: 'unicorn-flying', name: 'Unicorn in Flight', group: 'Friends', blurb: 'Wings up — mid-flap over the forest.',
    draw(ctx) { drawUnicornBody(ctx, CAT_CX - 56, CAT_G - 98, 112, 98, CAT_T, { facing: 1, airborne: true, flapT: 0.2 }); } },
  { id: 'jack-jack-unicorn', name: 'Jack-Jack Rides the Unicorn', group: 'Heroes', blurb: 'Jack-Jack in the saddle.',
    draw(ctx) { catAsHero('boy', () => catPlayer('boy', 'unicorn').draw(ctx)); } },
  { id: 'becca-unicorn', name: 'Becca Rides the Unicorn', group: 'Heroes', blurb: 'Becca in the saddle.',
    draw(ctx) { catAsHero('girl', () => catPlayer('girl', 'unicorn').draw(ctx)); } },
  { id: 'monster-truck', name: 'The Monster Truck', group: 'Friends', blurb: 'Jack-Jack at the wheel of the rally truck.',
    draw(ctx) { catAsHero('boy', () => drawTruckBody(ctx, CAT_CX - 52, CAT_G - 96, 104, 96, CAT_T, { character: 'boy', facing: 1, mood: 'grin' })); } },
  { id: 'zombie', name: 'The Zombie', group: 'Bosses', blurb: 'Boss of Zombie Cave (a big softie, really).',
    draw(ctx) { catWithBoss(() => catBoss(Zombie, 'chase').draw(ctx)); } },
  { id: 'king-magma', name: 'King Magma', group: 'Bosses', blurb: 'The molten king of Lava World.',
    draw(ctx) { catWithBoss(() => catBoss(Magma, 'chase').draw(ctx)); } },
  { id: 'spinosaurus', name: 'Giant Spinosaurus', group: 'Bosses', blurb: 'The Dino Jungle boss, befriended with a rainbow.',
    draw(ctx) { catWithBoss(() => catBoss(Spino, 'chase').draw(ctx)); } }
];
