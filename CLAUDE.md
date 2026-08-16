# Funny Face Block Game

A 2D platformer built for Jack (Ryan's ~5-year-old). Nine worlds, zero build
step, zero dependencies. The design doc's success metric governs everything:
**"Does Jack immediately understand it, and does he want to play again?"**

- **Live:** https://polarispixels.github.io/block-buddies/ (GitHub Pages, repo
  `polarispixels/block-buddies`, main branch, root). Deploy = commit + push;
  Pages rebuilds in ~40-60s. Verify with
  `curl -s <live-url>/js/<file>.js | grep <new-string>`.
- **Docs for collaborators:** `docs/index.html`, served at
  https://polarispixels.github.io/block-buddies/docs/ — architecture, per-level
  detail, systems, versioning. Keep it in sync with reality on every change.
- **Versioning (SEMVER):** `GAME_VERSION` in `js/util.js` (also stamped tiny on
  the title screen — handy live-deploy check). Every release: bump it (MAJOR =
  breaks localStorage saves, MINOR = new level/feature, PATCH = fix), add a
  `## [x.y.z]` entry to `CHANGELOG.md`, update the badge in `docs/index.html`,
  and `git tag vX.Y.Z && git push --tags`. The harness enforces the sync.
- It's a PWA (`manifest.webmanifest` + `sw.js`, network-first cache): "Add to
  Home Screen" gives fullscreen app-like play, including iPhone (where the
  in-game ⛶ button is hidden because Safari forbids the Fullscreen API).
- There is also an older claude.ai artifact copy (single-file bundle) —
  abandoned in favor of Pages because the artifact iframe blocks fullscreen
  and public share links pin old versions. Don't maintain it unless asked.

## Hard rules

1. **Zero build step.** Plain `<script>` tags, no ES modules, no npm deps, no
   bundler. `index.html` must keep working from `file://`.
2. **No asset files.** All art is procedural canvas drawing; all audio is
   procedural WebAudio (`js/audio.js`). Everything cartoon-cute: big faces on
   *everything* (blocks, terrain, sun, trees, the volcano...), no gore —
   enemies "poof" into stars/candy.
3. **Design for a 5-year-old.** Forgiveness beats challenge: icons instead of
   text, generous hitboxes, frequent checkpoints (which refill hearts), no
   fall deaths (cloud-catch / lava bounces you out), auto step-up on ≤52px
   ledges, unlimited retries from checkpoints, boss stages show icon hints.
4. **Verify before claiming done.** Run `node test/harness.js` (see below)
   and screenshot new visuals with `tools/screenshot.sh`.

## Architecture (load order matters — plain script tags share globals)

| File | Contents |
|---|---|
| `js/util.js` | Constants (W=1280, H=720), helpers (rr, drawFace, drawBlock, drawCrown, keycaps, candy), palettes (`POW`, `RAINBOW`), keyboard input (`keys`/`justP`), `TouchUI` (two-thumb touch layout + fullscreen button + title tap hook) |
| `js/audio.js` | `AudioSys`: procedural sfx (one `sfx(name)` switch) + step-sequenced music (`SONGS` table: midi arrays per theme). Unlocked on first input. |
| `js/particles.js` | `Particles` pool (star/sparkle/heart/block/confetti/candy/flame/bubble), `candyBurst` |
| `js/entities.js` | `moveEntity` physics (AABB, one-way platforms, bouncy, breakable, auto step-up), `Player` (vehicles: wheel/truck/unicorn + water/space movement), `Spider` (kinds walk/jump/hang/swim/tornado/alien; states angry/frozen/friend/burning/flying), `Centipede`, `Projectile`, `Pickup`, `Checkpoint`, `Gate`, `Zombie`, `Magma`, `LavaBlob`, `Shoe`, `Chest`, `ParkedTruck`/`drawTruckBody`, `ParkedUnicorn`/`drawUnicornBody` |
| `js/levels.js` | `LEVEL_META`, `buildLevel(n)` (all level data), `buildSpaceMaze()`, theme rendering: `drawBG`, `drawSolids` (incl. lava pools, ramps, turbo pads, goal star), `drawDecor` (incl. castle, grandstand, royals) |
| `js/game.js` | The `game` state machine, boss/ending flows, cutscenes (`updateCut`), camera, HUD, title screen (hero picker + level picker), darkness overlay, main loop |

Entity convention: `x,y` = top-left, `w,h` box, `cx/cy` getters. World units
= pixels. Ground top is y=620 in most levels (1000 in forest; maze is a grid).

## The nine worlds

| # | Name | Theme key | Gimmick | Ending |
|---|---|---|---|---|
| 1 | Block Meadow | meadow | tutorial, fire block | star gate |
| 2 | Underwater World | water | 4-dir swim (`lv.water`) | star gate |
| 3 | Cloud World | cloud | one-way clouds, rainbow bridges, cloud-catch | star gate |
| 4 | Mountain World | mountain | power block smashes breakable walls | star gate |
| 5 | Zombie Cave | cave | darkness overlay + lights; ZOMBIE boss (fire→ice→rainbow) | Golden Candy Treasure chest |
| 6 | Lava World | lava | fire ignites spiders → panic → explosion chains; lava pools; KING MAGMA boss (ice×3→power ram→rainbow) | Candy Volcano eruption |
| 7 | Monster Truck Rally | dirt | `vehicle='truck'`, ramps+auto backflips, turbo pad, dirt tornadoes | finish line → grandstand + Candy Trophy |
| 8 | Unicorn Forest | forest | `vehicle='unicorn'`, Up-mash = wing flight + glitter, horn always fires rainbows, Centipede chains | castle coronation → permanent crown (`game.royal`) |
| 9 | Space Maze | space | `lv.space` (weightless swim), 44×19 BFS-verified maze, saucer aliens | golden star → MAZE MASTER (befriends all aliens) |

Progression: gates advance 1→5; beating each boss/finale unlocks the next
bonus world (zombie→6, magma→7, rally→8, coronation→9) and party exits chain
5→6→7→8→9→title. Persistence (localStorage): `ffbg_unlocked` (1-9),
`ffbg_char` ('boy'/'girl'), `ffbg_royal` ('1' after coronation → crown drawn
everywhere via `drawBoy`/`drawHead`).

## Key subsystems

- **Vehicles**: `player.vehicle` ∈ wheel/truck/unicorn; board via
  ParkedTruck/ParkedUnicorn pushed into `lv.pickups`. Boarding resizes the
  hitbox. Respawns keep the vehicle.
- **Bosses** share one slot: `game.zombie` holds Zombie OR Magma (same
  interface: update/draw/hitBy/setState/hp/groundY). `game.bossPlan` maps
  stage→required power; wrong hits show an icon hint bubble. Boss pickups
  respawn via `bossKind`. Arena respawn: death during a boss respawns
  *inside* the sealed arena at `arenaL+20` (never at the outside checkpoint —
  that was a real shipped bug).
- **Cutscenes**: `game.cut = {name, t}` handled in `updateCut` (bossintro,
  magmaintro, rumble, chestfall, eruption, coronation). Player input frozen.
- **Endings**: `game.endPhase` phases → `'party'` (big text per level in
  `drawPartyOverlay`, Space after 5s advances the chain).
- **Touch**: `TouchUI.layout()` — left thumb ◀▶ (+▼ duck), right thumb big
  JUMP + ★ action; underwater/space the right cluster becomes ▲▼. Tap
  anywhere = action (menus work by tapping). Title has tappable portraits
  and level medallions via `game.titleTap`.
- **Title**: hero picker (Up/Down or tap; girl has curly blonde hair), level
  picker (Left/Right ring or tap medallion, digits 1-9 jump, Space = play
  selected).

## Testing & verification (do this every change)

- **`node test/harness.js`** — headless smoke test that stubs DOM/canvas/
  audio in a node `vm` and *plays the entire game through*: every level,
  every boss stage, both endings, vehicles, touch-tap paths, title pickers,
  plus a BFS solvability check of the space maze (zero sealed rooms, long
  goal path) and version/changelog/docs sync checks. 115 checks; must print
  `ALL CHECKS PASSED`. Run it 2-3× — a
  flaky pass usually means a real nondeterminism bug. Add checks for every
  new feature and every bug fix (regression tests caught 3 shipped bugs).
- **`tools/screenshot.sh <name> '<js-hook>'`** — real-render screenshots via
  Windows Chrome headless (WSL interop). Linux Playwright Chromium is broken
  here (missing libnspr4). Look at the PNGs — the canvas stub in the harness
  cannot catch visual/layering bugs.
- `node --check js/*.js` for quick syntax validation.

## Recurring bug class — watch for it

**Projectile/target height mismatches.** Three shipped bugs were "the shot
sails N pixels over the enemy's hitbox on flat ground" (fireball vs spider,
unicorn rainbow vs centipede, plus the crouch-shot request). Whenever adding
an enemy or firing height, add a harness check that *actually fires* the
projectile from ground level at the enemy and asserts the hit.

## Development method (agents)

- Use whatever plugins, skills, and tools are appropriate for the task at hand
  — don't limit yourself to raw file edits when a better tool exists.
- Use multi-agent architecture whenever appropriate to balance speed, quality,
  and cost: the top-tier model (e.g. Fable) belongs at the outermost
  orchestration layer — decomposing work, reviewing results, handling the
  trickiest design/debugging — while well-scoped subtasks (searches, mechanical
  edits, screenshot loops, boilerplate, parallel level work) should be
  delegated to subagents on lesser models (Sonnet/Haiku) for token efficiency.
  Solo work is fine when a task is small enough that delegation overhead would
  cost more than it saves.

## Working agreements with Ryan

- Ship in one shot: implement fully, verify with harness + screenshots, then
  commit (`git -c user.name="Ryan Gris" -c user.email="ryan@polarispixels.com"`),
  push, and confirm the live deploy before reporting done.
- Ryan playtests on his phone from the live URL; the service worker is
  network-first so one refresh picks up deploys.
- New levels so far have followed a pattern: new traversal mechanic + new
  enemy + themed spectacle ending + harness coverage + progression hookup
  (unlock, party chain, title medallion, level icon, clamps 1..N in
  game.js — grep for the previous max level number to find every spot).
