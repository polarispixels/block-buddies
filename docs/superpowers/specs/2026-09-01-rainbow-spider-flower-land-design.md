# Giant Rainbow Spider Flower Land — design

Jack's level (spec written with a planning agent; Ryan's answers: host =
Block Meadow 0-2, full storybook scale ~6-8 min, hat is level-only, polish
every beat). This document is the HOW.

## Identity

- Level id `'flowerland'`, name **RAINBOW SPIDER FLOWER LAND**, theme
  `meadow` (sky gradient), music `forest` (the magical one), `win` at the party.
- A true sublevel (enterSub/exitSub), completion in `ffbg_mini` → gold star on
  the door, replay by stand + Space. Not a chain stage.
- Entrance: a new `SubDoor` style **`'flower'`** (a giant pink bloom with a
  face and a door in its heart) in `'meadow2'` at x=2900 on the flat, calm
  middle (spider at 2500±170 is left of it, the spring at 3050 right of it),
  `{press: true}` because it sits on the main walking route.

## Geometry (world units)

- `lv.w = 9600`, `lv.h = 1500`. Ground floor **G = 1400** (zones 1-4). The
  **giant cloud** is a one-way solid at y=600 spanning x 6750→9600 (zones
  5-6); falling off it lands on the ground by the castle — the friendly
  recovery. Vertical camera is automatic (lv.h > H).
- Zone map (x ranges):
  1. Flower Place 0–2400
  2. Giant Spider Home 2400–4000 (secret door at 2700)
  3. Flower Person 4000–4600
  4. Flower Field flight 4600–6200
  5. Rainbow Castle + Dragon 6200–7000 (ground), bubble column at x≈6880
  6. Cloud: ship 6900–7250, robot + chest 7350, race 7500→8900, party door
     9150, party room 9250–9600 with the goal star at 9450.
- Checkpoints: 300, 2300, 2800, 4100, 6300, 7100 (cloud), 8950.

## Files

- `js/flowerart.js` (NEW, art pack, loads before flowerland.js): pure drawing
  functions in one `FL_ART` object. Every function takes `(ctx, ...)` and
  draws in world space; no game state reads except `game.t` when passed.
- `js/flowerland.js` (NEW): actors + the `FlowerLand` machine (`lv.puzzle`).
- `js/entities.js`: Player gets `hat`, `hatFly`; a hat-flight physics branch;
  hat drawing in `drawBody`; SubDoor `'flower'` style.
- `js/game.js`: cutscenes `'spidergrow'`, `'hatgift'`, `'racestart'`; party
  overlay text; `respawnPlayer` keeps the hat.
- `js/levels.js`: LEVEL_META, the door in meadow2, the `'flowerland'` builder.
- `index.html`, `sw.js`, `tools/screenshot.sh`, `test/harness.js` load lists.

## Actors (js/flowerland.js)

All actors live on the machine; the level only adopts their solids.

- **`MagicShroom`** — purple cap, pink spots, googly stalk face (NOT the gold
  Big-Buddy shroom; different rule, different look). States `waiting`
  (bobbing + glow + sparkles) → `follow` (bobs behind the hero exactly like
  `MissionItem.follow`, snaps across respawns) → `eaten`. Delivery = the
  following shroom overlaps a hungry/guarding spider. Two of them: #1 on a
  low platform at x≈650, #2 inside the spider home at x≈2950. One follows at
  a time (touching a second while carrying one is ignored). Never lost.
- **`RainbowSpider`** kind `'rainbow'` — big (150×100 at scale 1), rainbow
  striped abdomen, eight bouncy legs, huge happy face. Never hostile, no
  damage. States: `hungry` (bob, looks at hero, thought bubble with a
  mushroom) → `eat` (0.9 s munch) → `grow` (1.4 s scale 1→2.2 with 'grow'
  sfx + sparkles; the cutscene camera holds) → `walk` (to the flower) →
  `smash` (rear up, stomp: 'smash' sfx, shake, petals as confetti, the
  flower solid breaks, key reveals) → `happy` (giant, dances forever; joins
  the party). Spider A at x≈1450 with flower A at x≈1800. A second rainbow
  spider B sits deeper in the home (x≈3700, optional flavor: hungry, but
  mushroom #2 goes to the guards; B still cheers and grows when the guards
  sleep — "the whole family celebrates" — no gate).
- **`RainbowSpider`** kind `'grump'` — the guards (two, x≈3150/3300, purple
  with furrowed brows, arms crossed). While awake they own one solid
  `{x: 3120, y: G-200, w: 240, h: 200}` (the bump wall; pushing into it →
  grumble bubble "✋", 'thud', a gentle shove back, NO damage). Fed → `eat`
  → `yawn` → `sleep` (curled, Z's rising, 'snore' sfx), the wall breaks
  (`solid.broken = true`, same trick as smashed walls).
- **`GiantFlower`** — tall stem + a huge bloom with a face. Flower A is the
  smashable one (solid `{x: 1760, w: 110, h: 360, flower: true, skipDraw}`)
  blocking the route; `broken` → toppled stem stub + scattered petals. The
  flight field (zone 4) has six tall flower solids (h 380–720, blooms are
  one-way rest platforms on top) with gaps that require flying. Decorative
  giant flowers stand in the backdrop everywhere (drawBack).
- **`FlowerPerson`** — a walking daisy with a leaf skirt, tiny, adorable;
  stands at x≈4250. Hero within 90 px → `greet` (hops, hearts) → `gift`
  (the hat flies from its hands to the hero's head over 1.2 s, cutscene
  `'hatgift'`) → `done` (waves). Then hint bubble "▲▲" (hold Up) appears
  over the hero for 4 s.
- **The hat** — `player.hat = true`; drawn in `Player.drawBody` at the crown
  hook: a flower-petal hat with a glowing center. `player.hatFly` is set by
  the machine each frame: `hat && pl.cx < 6250` (the flower field; the castle
  gate is the boundary). Active = petals spin + sparkle trail + Up rises.
  Crossing the boundary: petals fold with a soft 'plop' — a wordless
  "the hat is resting". Level-only: `exitSub` restores the host player.
- **`BubbleDragon`** — round teal dragon, tiny wings, googly crossed eyes,
  tongue out; sits at x≈6800 facing the cloud. Every 1.3 s it puffs a bubble
  (`'blorp'`) from its raised snout at (6880, G-120). **`Bubble`** = a
  one-way bouncy solid `{w: 150, h: 34, bouncy: true, bounceVy: -1000,
  oneWay: true, bubble: true}` rising at 120 px/s with a gentle sway,
  popping at y=540 or on bounce ('blorp', bubble particles). Pool of 8
  solids pre-pushed into `lv.solids` (inactive = `broken: true`). Bounce
  apex 312 px vs bubble spacing ~156 px → there is always a next bubble; the
  column passes up THROUGH the one-way cloud at x≈6880, so the last bounce
  lands the hero on the cloud. Miss = fall to the ground next to the
  dragon, try again.
- **`PirateShip`** parked on the cloud (x 6900–7250, hull + mast + sail +
  a skull-and-hearts flag) with the **captain** (big mustache, striped shirt,
  tricorn hat, parrot) on deck: thought bubble gold coin → door.
- **`RaceBot`** — small round robot with antenna and rubber-band arms, at
  x≈7380 beside the **gold chest** (reuses `Chest`-like art, own draw).
  Bubble: 🏁. Hero passes within 110 px → cutscene `'racestart'` (3-2-1-GO
  digits, 'bong' ×3 then 'fanfare', player frozen at the start line
  x=7450) → `race`: bot runs right at 235 px/s, scripted hops over each
  tiny cloud; rubber band: if bot leads by > 320 px it "waits" (speed 90,
  looks back, beeps); if the hero leads it speeds to 300 (still < hero 340).
  Finish line x=8900 (checkered flag). Hero first → `lost` (bot cheers, no
  sulking) → chest opens → **`GoldItem`** (a `MissionItem` subclass drawing
  a gold bar) reveals and follows. Bot first → `again`: bot walks back to
  the start with a "↻" bubble; touching it resets both to the line and
  re-runs the countdown. Tiny clouds: five solids `{w: 64, h: 72}` at 7600,
  7850, 8100, 8380, 8650 (72 > the 52 px auto step-up, so a jump is
  needed; bumping one just stops you).
- **Doors** — two `MissionGate`s (theme `'wood'`) driven by two `Mission`
  objects owned by the machine (lv.mission stays null): key mission
  (puzzle = "flower A smashed", item = `MissionItem('key')`) at x=2700; gold
  mission (puzzle = "race won", item = `GoldItem`) at x=9150 on the cloud.
  The machine updates/draws both. Their solids are adopted by lv.solids.
- **Party** — the room past the gold door: balloons, a banner, a cake table
  (drawBack), the goal star at (9450, 470). When the gold door opens, the
  cast appears in the room dancing: flower person, both rainbow spiders
  (big), the dragon, the captain, the robot (draw-only copies, bobbing to
  the beat). Goal star → `game.subWin()` → overlay "SURPRISE PARTY!" /
  "EVERYONE CAME TO CELEBRATE!" → Space exits to the meadow.

## Cutscenes (`updateCut`)

- `'spidergrow'` (3.6 s): camera eases to spider A; eat → grow → walk → smash
  → key sparkle; back to the hero. Fires when shroom #1 is delivered.
- `'hatgift'` (1.6 s): the hat arcs from the flower person to the hero.
- `'racestart'` (3.4 s): digits 3-2-1 then GO! over the start line; hero and
  bot released at GO.
Input is frozen in all three (existing cut plumbing).

## Kid-friendly rules honored

No enemies, no damage anywhere except the guards' harmless shove. Every
gate is a visible cause → effect with icon bubbles (mushroom, ✋, ▲▲, gold,
🏁, ↻). Nothing can be lost: shrooms follow forever, items snap across
respawns, race rematch is instant, bubbles never stop coming, falling off the
cloud lands you next to the dragon. Auto step-up still works everywhere
except the deliberate 72 px race bumps.

## Harness coverage (new section, ridden for real)

Door press-entry from meadow2; shroom pickup → follow → delivery → grow
cutscene → flower solid broken → key → door open; guard wall solid while
awake, shove without damage, shroom → sleep → wall broken; flower person →
hat → hold-Up flight actually rises on foot; flight dead past the castle
boundary; one real bubble bounce (vy reversed) and the column reaching the
cloud's height; race countdown cutscene, a real run with jumps over every
bump, hero wins, gold follows; the lose path (bot teleported to the finish →
'again' → touch → reset); gold door opens; goal star → subWin → miniDone;
Space exits to meadow2 with host state intact and the hat gone.
