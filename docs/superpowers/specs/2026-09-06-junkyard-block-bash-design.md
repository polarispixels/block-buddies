# Junkyard Block Bash — design spec (v1.29.0)

Status: approved 2026-09-06. The first ARCADE MODE level: Breakout interpreted
through Block Buddies. Short (3–5 min), fast, destructive, forgiving, replayable.
Deliberately NOT a puzzle level — decisions happen through movement, timing,
prediction and target selection.

Success metric (as always): does Jack immediately understand it, and does he
want to play again?

## 1. Placement & shell

- New sublevel id `'blockbash'`. `LEVEL_META.blockbash = { name: 'JUNKYARD BLOCK
  BASH', theme: 'dirt', music: 'arcade' }`. `'arcade'` is a NEW fast chiptune in
  `SONGS` (js/audio.js); the finale switches to `'boss'`, victory to `'win'`.
- Entered from Monster Truck Rally (internal world 7) via a NEW press-gated
  `SubDoor` style `'arcade'` at `cx = 280` on the flat start ground (free x
  200–370, enemy-free build zone). `new SubDoor(280, G, 'blockbash', 'arcade',
  { press: true })`. The door art is a junkyard arcade cabinet: a tire for a
  base, a screen with a bouncing ball, a flashing "BASH" marquee, big face.
- Completion persists in `ffbg_mini` (`game.subWin()` → `miniDone.blockbash`);
  the completed door goes trophy-dormant, replay = stand on it + Space
  (existing SubDoor behaviour). `drawPartyOverlay` gets a `'blockbash'`
  headline: "JUNKYARD CHAMPION!" / "YOU BASHED THE JUNKBOT!".
- Level: `lv.w = 1280; lv.h = 720` (camera pinned, no camera work). Floor
  `G = 620` (one ground solid, `skipDraw`, the arcade paints the junk floor).
  `lv.arcade = new BlockBash(lv)`. `lv.touchLayout = 'arcade'`.
- The Player spawns ALREADY IN THE TRUCK (`vehicle = 'truck'` via the existing
  boarding path) at x ≈ 590, on the floor. No walk-in; the arcade owns the
  player from frame 1. Exit only via victory → party → Space → `exitSub`
  (Escape still quits to the title as everywhere). No ExitDoor.

## 2. The `lv.arcade` slot (engine additions, all tiny)

- `newLevel`: `arcade: null`, `touchLayout: null` defaults.
- `Player.update` (entities.js, top, before the ride gate): `if (lv.arcade) {
  lv.arcade.updatePlayer(this, dt); return; }`. The arcade owns paddle physics
  entirely (no gravity/ramp/turbo code paths run). Player art still draws
  normally (truck body + hero), so `game.player.vehicle === 'truck'` and the
  truck hitbox are the real paddle box.
- game.js hooks, mirroring `lv.puzzle`: `lv.arcade.update(dt, pl)` right after
  the puzzle hook; `drawBack(ctx, t)` before `drawSolids`; `draw(ctx, t)` after
  the puzzle draw (balls/blocks/capsules/junkbot — drawn BEFORE the player so
  the truck sits in front); `drawFront(ctx, t)` after darkness, screen-space
  chrome (banners, modifier chips, combo pops) — drawn before `drawHUD`.
- TouchUI `layout()`: `if (game.level.touchLayout === 'arcade' && game.state
  !== 'title')` → left ◀, right ▶ (same spots as land), big JUMP, ★ (no ▼).
- Sublevel plumbing is untouched: `enterSub` builds it, `exitSub` restores the
  host verbatim; harness asserts `game.level.arcade === null` back in the rally
  and the racer is still in the truck.

## 3. Arena & controls

- Bounds: walls at x = 40 and x = 1240 (drawn as stacked-tire bumpers with
  faces), ceiling y = 90 (under a crane rail; the HUD lives above), floor y = 620.
  "Below floor" = ball centre y > 640 = a miss.
- Block grid: 12 columns × 96 px (x 64 … 1216), rows 48 px tall from y = 110
  (row 0) to row 4 (y 302–350). Truck roof ≈ y 523 → ≥ 170 px of open air.
- Truck paddle: input `keys.ArrowLeft/Right`; accel 2600 px/s², max 520 px/s,
  friction stops it in ~0.15 s; clamped to the walls. Facing follows motion.
  Paddle box = the truck box widened by 6 px each side (forgiving).
- Ball ↔ paddle: return angle from hit offset (centre = straight up, edge =
  ~65° from vertical), truck vx adds ±120 px/s of english, and the ball always
  leaves upward. Speed is preserved (phase speed), except:
- JUMP (`justP.ArrowUp` or the JUMP button) = truck HOP: 0.35 s, +60 px arc
  (the arcade animates `pl.y`, no gravity). A ball struck while the truck is
  rising gets BUMP!: +25 % speed for that flight (still ≤ cap), steeper angle,
  `bashbump` sfx, big pop text. A hopping truck also catches capsules mid-air.
- LAUNCH: `justP.Space` (★ / tap anywhere) while the ball rests on the roof;
  auto-launch after 1.5 s so nothing ever stalls. Launch direction: up, ±20°
  biased toward the side with more blocks.

## 4. The ball — "Bouncy Buddy"

- r = 18 (giant = 32). Rubber ball, big face; moods: happy, dizzy (splat),
  rainbow (mode), boom (fuse-lit). Squash on every bounce, trail dots at speed.
- Speed by phase: 380 / 430 / 480 / 520 / boss 540; HARD CAP 620 (bump can't
  exceed). Minimum vertical component = 35 % of speed (re-steer on every
  bounce so it never flat-lines); minimum horizontal 8 % so it never
  pogo-sticks in one column forever.
- Collision: substepped sweep (≤ 8 px per substep) circle-vs-AABB against
  blocks, walls, ceiling, paddle, junkbot, junk net. Resolve by pushing out
  along the axis of least penetration and reflecting that axis. One block hit
  per substep. A block the hit DESTROYS does not deflect the ball — it plows
  on through (columns chain, combos build); only a block that survives the
  hit (tough, runner's first hit) bounces it. Rainbow mode additionally
  pierces surviving blocks. Harness runs 200 randomised max-speed shots at block edges and
  truck corners: zero tunnels.
- MISS: the ball splats into the junk floor (dizzy face, junk + a random
  hubcap / boot / rubber duck fly up, `crash` + `muffhonk`), the truck shows
  an "oops" face for 0.6 s, and 0.9 s later the ball pops back onto the roof
  (auto-launch rules apply). NOTHING resets — blocks, wave, mods, boss hp
  all persist. Multi-ball: losing one ball is a small plop; only the LAST ball
  splats. The junk net shield (see mods) bounces the ball off the floor.

## 5. Blocks (10 kinds)

All 96×48 with a face; each kind has an unmistakable silhouette/colour at
in-game size (contact-sheet reviewed). Every break pays candy (below), spawns
`block` particles + a pop, and drops candy pickups (see §7).

| kind | look | hits | behaviour |
|---|---|---|---|
| plain | POW colours, big smile | 1 | 1 candy |
| tough | riveted junk metal, grumpy | 3 | dents + increasingly dazed face per hit; 3 candy |
| candy | pink candy crate | 1 | bursts into 5 candy pickups |
| power | glowing gold ⭐ block | 1 | drops a power-up capsule |
| rainbow | rainbow stripes, starry eyes | 1 | RAINBOW MODE 6 s: ball pierces (no bounce) and breaks everything it touches, rainbow trail |
| boom | red oil drum, fuse, nervous face | 1 | explodes: destroys blocks within 1.5 block widths (chains through other barrels), shake |
| split | two faces side by side | 1 | releases one extra ball |
| runner | block with little legs | 2 | first hit: scoots along its row 2 columns (stops at walls/blocks), surprised face |
| faller | hangs from a hook on a chain | 1 | drops; truck catch = +5 candy + pop; floor = harmless thud + junk bits |
| surprise | yellow "?" toolbox | 1 | fires one environmental event (§6) |

Candy per break: plain 1, tough 3, candy 5 (as pickups), others 1.
Rainbow mode ends early if the ball is lost. Boom blast never damages the
truck (nothing ever does).

## 6. Environmental events (from surprise toolboxes / junkbot)

Spectacle first, mild consequences, never damage, never unwinnable:
- GIANT TIRE: a big tire rolls across the floor from one wall to the other;
  hitting the truck spins it out 0.5 s (control lost, dizzy stars, silly sfx).
- MAGNET SNATCH: the crane magnet on the ceiling rail drives over the ball,
  grabs it 0.8 s and flings it at a new angle (the ball is never lost by this).
- CONVEYOR: one random row of blocks starts sliding (wraps at the walls) —
  stays moving for the rest of the wave.
- JUNK TOWER: a stack of 3 plain blocks builds at one wall and topples into
  the arena as free candy pickups.
The crane is a permanent visible piece (magnet on a rail under the ceiling)
so the snatch and the anti-stall clear both read as "the crane did it".

## 7. Candy & score

- `game.candy` is the score (session counter; HUD candy). Block breaks pay
  directly. Candy pickups (from candy crates, towers, fallers) fall, drift
  gently toward the truck (magnet mod = fly straight to it), and lie on the
  floor for 6 s if missed — never punishing.
- Combo: consecutive block hits without touching the paddle grow a combo
  counter shown as a pop ("×3!"); at ×5 a bonus +5 candy and a mini burst.
- Junkbot part = 10 candy each (4 parts), finale shower = 100 (rolling
  counter, ~90/s like the surf chest).

## 8. Power-up capsules (7)

Dropped by power blocks (and junkbot junk), falling at 220 px/s, caught by the
truck (or lost harmlessly on the floor). Catch = icon toast over the truck +
banner ("MULTI BALL!", "GIANT!", "WIDE!", "BOOM BALL!", "MAGNET!", "SLOW-MO!",
"JUNK NET!") + a timer-ring chip while active (`Mods`).

| capsule | effect | dur |
|---|---|---|
| multi | current ball(s) split into 3 (max 6 balls total) | instant |
| giant | ball r 18 → 32 (bigger hit area, same speed) | 10 s |
| wide | scrap-metal plow bolts onto the truck: paddle width ×1.6 | 12 s |
| boom | every block the ball hits explodes like a barrel | 8 s |
| magnet | all candy pickups fly to the truck | 10 s |
| slow | ball speed ×0.55 (blocks/events unaffected) | 6 s |
| net | a junk net spans the floor: balls bounce off it | 12 s |

Capsule mix is weighted by phase (multi/wide/net favoured early; boom/giant
later). Mods stack (giant + boom + rainbow all at once is the point).

## 9. Waves & escalation (par ≈ 4 min including misses)

`WaveRunner` states: `build` (1.2 s: blocks rain in from the crane rail and
bounce into place — unhittable until landed) → `play` → `clear` (2 s "WAVE
CLEAR!" flourish, all balls collected back to the roof) → next.

| # | phase | layout | ball | new |
|---|---|---|---|---|
| 1 | LEARN | 2 rows plain (24) + 1 candy crate centre | 380 | — |
| 2 | POWER-UPS | 3 rows: plain + power ×3, candy ×2, split ×1, tough ×2 | 430 | capsules, multi |
| 3 | MOVING JUNK | 4 rows: rows 1 & 3 on opposing conveyors; faller ×3, runner ×2, boom ×2, surprise ×2, power ×3 | 480 | movement, events |
| 4 | CHAOS | 5 dense rows: rainbow ×2, boom ×4, split ×2, surprise ×2, power ×4, runners, fallers; every row moving; starts with 2 balls; junk tower each side | 520 | everything |
| 5 | FINALE | JUNKBOT (§10) | 540 | boss |

Never-stall rule: each wave has `par` (45 / 55 / 65 / 75 s). Past par, the
crane magnet drives to a random remaining block every 2.5 s and yanks it into
the ceiling crusher (clank + candy paid normally). Also, when ≤ 3 blocks
remain the survivors pulse (target highlight).

## 10. Finale — JUNKBOT

Lowered on a chain from the crane rail: tire shoulders, engine-block chest with
a glowing candy core, headlight eyes, a traffic-sign shield in one hand, a
crane-hook hand. Body box ≈ 340×260, paces x 200 … 1080 across y 150–330
(sinusoidal bob). HP 12, hittable anywhere on the body (big target); a
pulsing bullseye marks the next part to pop. Every 3 hits a part rockets off
(+10 candy, part burst, `bashclank`): sign shield → left tire → right tire →
core opens and takes the final 3. Each stage he gets madder:
- stage 1: drops a plain/tough junk block every 4 s into the rows below
  (more targets = more candy; capsules 30 % of the time);
- stage 2: + rolls a giant tire along the floor every 9 s;
- stage 3 (≤ 6 hp): + magnet beam every 8 s — grabs the nearest ball for 0.8 s
  and flings it;
- stage 4: faster pacing, core sparks.
Anti-stall: 60 s with no hit → he droops 60 px lower (twice max). No attack
ever damages the truck or loses the ball.
Victory `Sequence`: wobble + sparks (1.2 s) → parts rocket off one by one
(1.5 s) → GIANT junk explosion (flash, `shake` 0.6, junk everywhere, `boom` +
`tireboom`) → 100-candy shower auto-magneted into the truck with the rolling
counter (2.5 s, `candy` sfx) → fireworks (`firework`) → `game.subWin()`
(party overlay; Space after 5 s → `exitSub`).

## 11. Presentation

- Backdrop (`drawBack`): junkyard at dusk — sky gradient, silhouetted junk
  hills, a car crusher and forklift with faces in the back, hanging chains,
  the crane rail + magnet, stacked-tire walls, the tread-marked junk floor.
- Everything has a face: blocks, ball, tires, crane magnet, junkbot, the
  cabinet door.
- `drawFront` chrome: wave banner ("WAVE 2!" / capsule names, 1.4 s, big
  outline text), modifier chips bottom-left with shrinking timer rings, combo
  pops in world space near the hit.
- Intro (first 2 s after the intro card): the ball wiggles on the roof with a
  bobbing spacebar/★ hint and an `arrows` hint icon.
- Audio: new sfx cluster `bashhit` (pitch rises with combo), `bashbreak`,
  `bashmiss`, `bashbump`, `bashpow`, `bashclank`, `bashroar`, `bashsplit`;
  reuse `crash`, `muffhonk`, `boom`, `tireboom`, `candy`, `firework`, `cheer`.

## 12. Code shape

- `js/arcade.js` — the reusable ARCADE KIT (no Block Bash specifics):
  - `Mods` — timed modifiers: `add(name, dur)`, `has`, `left`, `update(dt)`
    (expiry callbacks), `list()` for chips.
  - `WaveRunner` — ordered wave defs `{ build(), par }`, states
    build/play/clear, `stallT`, `onStall(dt)` hook, `advance()`, `done`.
  - `Sequence` — timed steps `[{ dur, enter(), tick(k) }]` for intros/victories.
  - `Spawner` — interval + jitter schedule `{ every, jitter, fire() }`.
  - `ArcadeHud` — `banner(text, color, dur)`, `pop(x, y, text, color)`,
    `drawChips(ctx, mods, icons)`, `draw(ctx, t)`.
  - `payout(n, x, y)` — rolling candy counter + burst.
- `js/bashart.js` — `BASH_ART`: pure drawing (blocks per kind + damage states,
  ball moods, capsules + icons, junk floor/walls/rail/crane, giant tire,
  junkbot parts + poses, junk debris, the arcade cabinet door, plow). No game
  state reads. Contact-sheet screenshot reviewed at in-game size.
- `js/blockbash.js` — `BB` constants, `Ball`, `Block` (kind table), `Capsule`,
  `CandyDrop`, `Crane`, `GiantTire`, `JunkBot`, `WAVES`, and `BlockBash` on
  `lv.arcade` (`updatePlayer`, `update`, `drawBack`, `draw`, `drawFront`).
- Load order: … `ride.js`, `beams.js`, `arcade.js`, `bashart.js`,
  `blockbash.js`, … (before `levels.js`) in index.html, sw.js, harness,
  tools/screenshot.sh.

## 13. Verification (the release gate)

Harness (`test/harness.js`), new `blockbash` block:
- rally door at cx 280, style `'arcade'`, press-gated; walking past never
  enters; Space enters; `game.level.arcade instanceof BlockBash`; player in
  the truck; touch layout has no ▼.
- launch on Space; auto-launch by 1.6 s; paddle bounce (ball placed falling
  onto the roof → leaves upward); english; hop BUMP raises speed ≤ cap.
- every block kind: force the ball into one and assert its behaviour (tough
  3 hits, boom chain, split adds a ball, runner moves 2 columns, faller
  drops + truck catch pays 5, surprise fires an event, rainbow pierces ≥ 2
  blocks in one flight, candy crate spawns 5 pickups).
- every capsule: catch → mod active → measurable effect (paddle width, ball
  r, speed ×0.55, 3 balls, net bounce, magnet pulls, boom breaks neighbours).
- miss → splat → relaunch ≤ 1.6 s, blocks/wave/mods intact; last-ball rule.
- anti-tunnel: 200 random max-speed shots at block edges + truck corners.
- wave advance + build-in unhittable; par-time crane clear removes a block;
  speed cap 620 holds under bump+phase.
- junkbot: appears after wave 4; 3 hits pop a part + 10 candy; attacks never
  hurt (`hearts` unchanged, ball never lost by the beam); 12 hits → victory
  sequence → candy ≥ +100 → `subWin` → `miniDone.blockbash` → Space →
  rally with `arcade === null` and `vehicle === 'truck'`; completed door
  dormant; replay via Space.
- FULL SIMULATED RUNS: a "keep the truck under the nearest ball" policy must
  finish the whole game within 6 sim-minutes; a clumsy policy (wrong/idle on
  40 % of frames) within 10. Run the harness 3× — no flakes.
- `node --check js/*.js`; screenshots: each wave, a capsule catch, the miss
  splat, junkbot each stage, the explosion, victory; contact sheets for
  blocks (all kinds + damage states), capsules, ball moods, junkbot parts.

## 14. Docs & release

`GAME_VERSION = '1.29.0'`; CHANGELOG `## [1.29.0]`; docs/index.html badge +
footer + architecture rows + `#minigames` entry after Pit Stop Beat Bash +
`'arcade'` in the SubDoor style list + an "Arcade Mode" note in systems;
CLAUDE.md architecture table + world-7 row + mini-game list; BACKLOG.md
Status board: item 20 Junkyard Block Bash ✅ shipped v1.29.0 (Arcade Mode
#1), item 21 Blaster Run (fast shooting: move, jump, shoot targets at
heights) 🎯 next arcade release, item 6 Junkyard Bridge Builders stays 🎯
next Stage 2. Tag `v1.29.0`, push, verify live.
