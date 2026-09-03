# Ocean Surf — design (Ryan's spec, 2026-09-02)

A scrolling surfboard ride off Underwater World that reuses RIDE MODE
(`js/ride.js`: `RideMode` physics + `RideCourse` procgen) the way the Desert
Sand Slide does, ending in a surf-along Kraken boss befriended with the
rainbow power and an oversized launch-to-island victory.

## Identity

- Level id `'surf'`, name **OCEAN SURF**, theme `dirt` (sky gradient + the
  beach strip draws as sand), music `dirt` (energetic). A true sublevel
  (enterSub/exitSub, `ffbg_mini`, gold star on the door).
- Entrance: a new `SubDoor` style **`'surfboard'`** (a surfboard planted in
  the sand with a face) on Underwater World's seafloor at x=450, press-gated
  (Space/★ while touching), before the first swim spider (1300±160).

## Files

- `js/surfart.js` (NEW, art pack `SURF_ART`, pure drawing).
- `js/surf.js` (NEW): `OceanSurf` machine on `lv.ride` (the ride hooks in
  game.js/entities.js already exist for `lv.ride`): course generation,
  things, wipeouts, the pirate boat, the Kraken boss, the victory script.
- `js/game.js`: rider drawing delegates to `lv.ride.drawRider` when present;
  party overlay text.
- `js/entities.js`: `SubDoor` style `'surfboard'`.
- `js/levels.js`: LEVEL_META, the door in Underwater World, the `'surf'`
  builder (a 520 px beach strip, then open water; `lv.w` is huge, the
  camera only follows x; `lv.ride = new OceanSurf(...)`).
- load lists (index.html, sw.js, tools/screenshot.sh, harness).

## Geometry

Waterline **G = 620** (the ride's heightfield base). The beach strip is solid
ground x 0–520 at G; the board waits at x≈420 (state `intro` → touch it →
`riding`, like the slide). Course from x=520 on. The world is 22000 px
wide; camera clamps normally. `lv.h = 720`.

## Ride

`RideMode({speed: 400, jumpVy: -780})`; speed per phase: learn 400,
sharks 440, waves 470, pirate 500, rush 540, boss 480, victory 480. Terrain
is flat water except **red water-ski ramps** (terrain nodes: rise 70/120
over 220/300 px, then a drop — the ride's natural launch; each ramp is
recorded in `ramps[]` for drawing) and tiny rideable ripples. No quicksand.

## Things (course.things kinds)

- `candy` (arcs, rows, high over ramps, above waves).
- `wave` big: 90×120 obstacle; small rideable waves are terrain bumps
  (rise 22 over 60 px). Hitting a big wave = **wipeout**.
- `shark`: 110×50 at the waterline, swims left at 130 px/s with a fin
  bob; hit = wipeout; a rainbow shot befriends it (hearts, it flips over
  and waves).
- `chest`: 70×60 floating chest; touch = opens, +6 candy, `chest` sfx +
  candy burst.
- `rainbow`: the friendship block (the slide's established pattern);
  during the boss it re-spawns ahead every ~900 px while the hero's power
  is not rainbow (never blockable).
- `rock`: a Kraken rock that splashed down and floats (68×54); jump it.

## Wipeout (waves, sharks, cannonballs, boat rams)

`state = 'swim'`, 1.5 s of invulnerability: the hero pops off (hop -420),
the board drifts ahead at 0.65× speed, the hero swims at 0.9× speed bobbing
half-submerged (drawn behind a water band), catches the board, `boing`,
back to `riding`. Speed multiplier 0.45 recovering (RideMode.crashSlow).
Candy still collects while swimming. Never damage, never death.

## The monster-truck pirate boat (`this.boat`)

A machine actor (not a course thing): a pirate ship hull on four monster
truck wheels. Encounter script (`boat.state`): `enter` (drives in from the
right edge, settles ~560 px ahead of the hero matching speed, 2 s) →
`shoot` (three cannonballs at 1.5 s intervals, lobbed to land ~100 px
ahead of where the hero will be; a bobbing target ring on the water marks
the splash point 0.8 s early; a ball in the air or on the water for 0.6 s
after splash = wipeout) → `ram` (turns and charges LEFT through the hero's
lane at 520 px/s; 240×150 body — a jump clears it (jump rise ≈ 203 px);
hit = wipeout) → `leave` (drives off left, done). Phase 4 runs two
encounters, phase 5 one. During the boss the boat parks ahead so the Kraken
can deal with it.

## Kraken boss (surfing continues)

Trigger at course x ≥ 14000 (after rush): `boss = { state: 'rise' }` — the
Kraken rises at screen-right (`x = cam.x + W - 260`, it moves with the
camera), 1.6 s rise with `rumble`, then `throw`: every 1.9 s it raises a
tentacle (0.7 s telegraph) and lobs a rock that lands 260 px ahead of the
hero (target ring); the rock floats as an obstacle. Hostile-phase course
templates: flat + candy + ramps + the rainbow block re-spawner. Each
rainbow projectile that overlaps the Kraken's head counts a hit (5 hearts,
`hit` reaction: dizzy face + `bong`), wrong powers show the rainbow-block
hint bubble (the bosses' `wrongT` convention). Five hits → `friend`.

## Victory script (`boss.state`)

1. `friend` (1.4 s): hearts, `friend` + `cheer`, attacks stop, rocks
   despawn, ride speed 300.
2. `boatgrab` (2.6 s): the boat drives in from the right; the Kraken's
   tentacle seizes it, lifts it high, spins it, and flings it off the top
   of the screen (`whoosh`, splash later off-screen).
3. `pickup` (1.4 s): a tentacle scoops the hero + board; `pl.y` follows the
   tentacle tip up to y≈180.
4. `launch`: `state = 'launched'` — `ride.vy = -520`, gravity 240, flips
   auto-stack every 0.5 s and every Up press adds one (the biggest trick
   window in the game), rainbow star trail, 6 s of flight while the course
   ends in the **island** (terrain: a 900 px sand mound rising to G-90).
5. Landing on the island: `landed` → the ride stops (`speed 0`), the hero
   walks (normal on-foot physics resume by setting `lv.ride.state =
   'done'`, which the entities.js ride gate treats as riding-over) to the
   **giant chest** (a `Chest` at 2.4× scale drawn by the machine): Space
   opens it (the `endPhase = 'prompt'` convention), +100 candy with a
   counting toast and a huge candy burst, then `game.subWin()` (party,
   Space exits to Underwater World).

## Harness

Ride it for real: door press-entry, board grab, jump/trick presses, a
wave wipeout → swim → remount, a shark wipeout, chest candy, ramp launch
(airborne after a lip), boat encounter (cannonball target ring, a ram
jumped), boss rise, the rainbow block re-spawner, five real rainbow shots →
friend, the whole victory script through the island landing, Space on the
chest → +100 candy → subWin → exit.
