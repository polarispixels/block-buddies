# Block Buddies: The Adventures of Jack-Jack and Becca

(Formerly "Funny Face Block Game" — internal names like `ffbg_*` localStorage
keys and the `ffbg-v1` SW cache keep the old prefix; renaming them would break
saves.) The playable heroes are Jack-Jack (`'boy'`, cap) and Becca (`'girl'`,
curly blonde hair).

A 2D platformer built for Jack (Ryan's ~5-year-old). Ten worlds, zero build
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
| `js/entities.js` | `moveEntity` physics (AABB, one-way platforms, bouncy, breakable, auto step-up), `Player` (vehicles: wheel/truck/unicorn + water/space movement), `Spider` (kinds walk/jump/hang/swim/tornado/alien; states angry/frozen/friend/burning/flying), `Centipede`, `Projectile`, `Pickup`, `Checkpoint`, `Gate`, `Zombie`, `Magma`, `LavaBlob`, `Shoe`, `Chest`, `ParkedTruck`/`drawTruckBody`, `ParkedUnicorn`/`drawUnicornBody`, adventure-mission kit (`Mission`, `MissionGate`, `MissionItem`, `MissionToken`, `Shrine`, `CollectionPuzzle`), `FireBreather`, `Spino` boss, `SubDoor` (mini-game entrances), `Vine` (swinging vines, `lv.vines`), `Monkey` (companion), secret-room machines `PipeWorks`/`TorchCavern`/`StarChamber`/`TreehouseTrail`/`BeatBash`/`ZombieTown` (attached as `lv.puzzle`) |
| `js/levels.js` | `LEVEL_META`, `buildLevel(n)` (all level data), `buildSpaceMaze()`, theme rendering: `drawBG`, `drawSolids` (incl. lava pools, ramps, turbo pads, goal star), `drawDecor` (incl. castle, grandstand, royals) |
| `js/game.js` | The `game` state machine, boss/ending flows, cutscenes (`updateCut`), camera, HUD, title screen (hero picker + level picker), darkness overlay, main loop |

Entity convention: `x,y` = top-left, `w,h` box, `cx/cy` getters. World units
= pixels. Ground top is y=620 in most levels (1000 in forest; maze is a grid).

## The ten worlds

PLAYERS SEE WORLDS **0-9** (display = n-1, applied only in the display layer:
intro card, medallion number badges, title digit keys — since v1.9.0). ALL
code, saves, and harness checks use internal n = 1-10 as in this table; never
renumber the internals (breaks `ffbg_unlocked` saves).

| # (internal n) | Name | Theme key | Gimmick | Ending |
|---|---|---|---|---|
| 1 | Block Meadow | meadow | tutorial, fire block | star gate |
| 2 | Underwater World | water | 4-dir swim (`lv.water`) | star gate |
| 3 | Cloud World | cloud | one-way clouds, rainbow bridges, cloud-catch | star gate |
| 4 | Mountain World | mountain | power block smashes breakable walls; Golden Key mission (locked door + collect 3 Mountain Crystals: easy / spring-launch / wall-smash) | star gate |
| 5 | Zombie Cave | cave | darkness overlay + lights; ZOMBIE boss (fire→ice→rainbow) | Golden Candy Treasure chest |
| 6 | Lava World | lava | fire ignites spiders → panic → explosion chains; lava pools; KING MAGMA boss (ice×3→power ram→rainbow) | Candy Volcano eruption |
| 7 | Monster Truck Rally | dirt | Build-Your-Truck opening (find wheels/engine/core, assembly ceremony) then `vehicle='truck'`, ramps+auto backflips, turbo pad, dirt tornadoes | finish line → grandstand + Candy Trophy |
| 8 | Unicorn Forest | forest | `vehicle='unicorn'`, Up-mash = wing flight + glitter, horn always fires rainbows, Centipede chains | castle coronation → permanent crown (`game.royal`) |
| 9 | Space Maze | space | `lv.space` (weightless swim), 44×19 BFS-verified maze, saucer aliens | golden star → MAZE MASTER (befriends all aliens) |
| 10 | Dino Jungle | jungle | `FireBreather` dinos (jump the telegraphed flame), vine spiders, Dino Key mission (ancient gate + 3 lost eggs: platform / mushroom-bounce / flame-timed), friendly dinos (longnecks/trike/T-Rex) | GIANT SPINOSAURUS boss in the valley (ice×3 douses flames→fire×3 hiccups→rainbow; both-side arena walls via `game.spinoWalls`, `lv.bossX` trigger) → golden star → party |

Progression: gates advance 1→5; beating each boss/finale unlocks the next
bonus world (zombie→6, magma→7, rally→8, coronation→9, maze star→10) and party
exits chain 5→6→7→8→9→10→title (internal n). Title digit keys use DISPLAYED numbers: 0 = meadow … 9 = jungle (digit d starts internal d+1).
Persistence (localStorage): `ffbg_unlocked` (1-10),
`ffbg_char` ('boy'/'girl'), `ffbg_royal` ('1' after coronation → crown drawn
everywhere via `drawBoy`/`drawHead`).

## Key subsystems

- **Vehicles**: `player.vehicle` ∈ wheel/truck/unicorn; board via
  ParkedTruck/ParkedUnicorn pushed into `lv.pickups`. Boarding resizes the
  hitbox. Respawns keep the vehicle.
- **Bosses** share one slot: `game.zombie` holds Zombie, Magma, OR Spino (same
  interface: update/draw/hitBy/setState/hp/groundY). `game.bossPlan` maps
  stage→required power; wrong hits show an icon hint bubble. Boss pickups
  respawn via `bossKind`. Arena respawn: death during a boss respawns
  *inside* the sealed arena at `arenaL+20` (never at the outside checkpoint —
  that was a real shipped bug). Boss trigger x is `lv.bossX` (default 3900);
  Spino's befriending breaks `game.spinoWalls` and the jungle goal star
  requires the boss (if any) to be a friend.
- **Adventure missions (distributed collection)**: `lv.mission` (built in
  `buildLevel`, classes at the end of entities.js). `Mission` lifecycle
  `'puzzle'→'reward'→'carrying'→'done'`; `MissionGate` pushes its own solid
  into `lv.solids`, clears it with the smashed-wall `solid.broken = true`
  trick, and only checks the mission reached `'carrying'`. The objective is a
  `CollectionPuzzle`: scattered `MissionToken`s (skins `'crystal'`/`'egg'`,
  kind = POW color; `MissionToken.drawIcon` reused for sockets + progress
  toast) + a `Shrine` (chest with ghost-silhouette sockets; themes
  `'stone'`/`'nest'`). Any collection order; zero wrong inputs; collected
  tokens survive death/respawn (mission state lives on the level object).
  Return-with-all-three runs a ~3s ceremony → chest opens →
  `mission.item.revealAt(...)`. Difficulty = *reach*, not logic: token 1 easy
  grab, token 2 high ledge via a bouncer, token 3 behind a learned mechanic
  (power-smash wall / fire-dino timing) — and seal mechanic-gated pockets on
  the far side so they can't be sneaked into (that was a real caught bug).
  Wordless progress: toast over the hero after each pickup. Keep mission areas
  enemy-free (jump spiders chase from 430px). Theming is config: gate
  `{theme:'wood'|'jungle'}`, shrine `{theme:'stone'|'nest'}`, item kinds
  `'key'`/`'dinokey'` pick the `drawKey` style.
- **Bouncers**: any solid with `bouncy: true`; `bounceVy` sets launch power
  (default -980 ≈ 2× jump, mission ledges -1150 ≈ 3×). Themed skins are
  automatic (spring block; mushroom in forest/jungle). Land targets should be
  wide `oneWay` platforms — never precision.
- **FireBreather** (`kind='firedino'`, lives in `lv.spiders` so all enemy
  plumbing just works): deterministic cycle idle 1.6s → inhale 1.1s (cheeks
  puff = telegraph, `inhale` sfx) → flame 1.1s. The flame box hugs the ground
  (`flameBox()`, 44px tall) so jumping clears it; damage is 1 heart + a gentle
  shove. `opt.offset` staggers pairs; ice freezes/pauses, rainbow befriends,
  fire makes him burp harmlessly. Reuse it anywhere a timed jump-over hazard
  is wanted.
- **Mini-games/sublevels**: levels with STRING ids in `LEVEL_META`/`buildLevel`
  ('cloudclimb', 'ascent', 'skyflight', 'volcanoescape', 'bubblemaze',
  'piperoom', 'torchcave', 'zerog', 'treehouse', 'beatbash', 'zombietown'), entered
  via `SubDoor` in `lv.subDoors` (styles cloud/cave/rainbow/crack/bubble/
  pipe/eyes/asteroid/ladder/garage/moonwell — 'garage' also requires slow/stopped
  entry in the truck so a race is never hijacked;
  re-arms only after horizontal separation so exit never re-enters; once
  COMPLETED a door goes dormant — shrunken trophy w/ gold star, walk-over
  never enters, replay = stand on it + Space). `game.enterSub(id)` stashes the whole
  host state incl. the Player INSTANCE and live level object; `exitSub()`
  restores it verbatim (mission progress survives, no physics/camera leaks).
  Sub finales use `lv.goalStar` -> `game.subWin()` -> party -> Space exits
  back to the host. Completion persists in `ffbg_mini` (gold star on the
  door). `lv.flight` = hold-Up flight physics (Sky Flight). Bouncer variants:
  gold star spring = super (`bounceVy` <= -1300 draws gold), blue arrow =
  side launch (`bounceVx` + a 1.3s airborne momentum window `launchT` on the
  wheel). Vertical/diagonal camera is automatic when `lv.h > H`. Secret-area
  mechanics live ONLY on the sublevel object so exitSub can't leak them:
  `lv.risingLava` (creeping lava that pauses near the hero, drops back at
  checkpoints/respawns), `lv.vents` (timed eruption bouncers: idle → bubble
  warning → blast, cycled in updatePlay), `lv.currents` (directional water
  push at 1300 < swim thrust 1400 so steering stays free, applied in the
  Player water branch), `lv.shellSwitches` + valve solids (color-matched,
  popped via `solid.broken`), and `lv.puzzle` (one machine class per secret
  room — PipeWorks / TorchCavern / StarChamber / BeatBash — updated+drawn by
  generic hooks in game.js like lv.mission; an optional `lv.puzzle.drawBack()`
  paints a room interior BEHIND solids + goal star; finales reveal
  `lv.goalStar` so subWin/persistence/replay come free; `lv.puzzle.lights()` feeds the
  darkness overlay, and sub-doors themselves glow in dark levels).
  Pit Stop Beat Bash ('beatbash', off world 7) is the first RHYTHM GAME: a
  deterministic BeatBash machine (song clock, fixed beat intervals, 8-step
  groove sequencer, +/-0.3s hit window, shrinking-ring cue as timing truth) —
  misses are comedy, 4 hits/instrument build the band, 6 full-band hits fire
  the monster-truck backflip finale. Zombie Town After Dark ('zombietown',
  off world 5 via a moonlit ceiling shaft) is the first PEOPLE adventure: a
  compact moonlit town (ZombieTown machine: night sky via drawBack, reveal
  pan cut 'townreveal', four NPCs with a need->solved->walk->square state
  model, four different solve verbs incl. spending a HUD candy with Space,
  and a clock-tower festival finale gated on all four reaching the square). The Jungle Treehouse Trail ('treehouse',
  the biggest secret — a mini-adventure off world 10) adds two more reusable pieces: `lv.vines`
  (`Vine` class: contextual jump-in grab, deterministic pendulum swing,
  Up/Space release with momentum + a friendly boost; `lv.vineHold` tracks the
  held vine and `lv.vineLock` suspends grabbing during scripted flights) and
  the `Monkey` companion (sad → banana ceremony → follows like a friend →
  throw pads hurl the player along scripted arcs — the only way across the
  trail's gorge). Its whole machine (plate→ladder, lever→pulley, toucan
  blocker, disco, Banana Bell finale) is `TreehouseTrail` on `lv.puzzle`.
  Rally's `lv.truckBuild` (TruckBuild,
  entities.js) reuses MissionToken with skins 'wheels'/'engine'/'core'; its
  assembly ceremony spawns the ParkedTruck that starts the race.
- **Cutscenes**: `game.cut = {name, t}` handled in `updateCut` (bossintro,
  magmaintro, rumble, chestfall, eruption, coronation). Player input frozen.
- **Endings**: `game.endPhase` phases → `'party'` (big text per level in
  `drawPartyOverlay`, Space after 5s advances the chain).
- **Touch**: `TouchUI.layout()` — left thumb ◀▶ (+▼ duck), right thumb big
  JUMP + ★ action; underwater/space the right cluster becomes ▲▼. Tap
  anywhere = action (menus work by tapping). Title has tappable portraits
  and level medallions via `game.titleTap`.
- **Title**: hero picker (Up/Down or tap; girl has curly blonde hair), level
  picker (Left/Right ring or tap medallion, digits 0-9 [displayed numbers] jump, Space = play
  selected). Secret combos (physical keyboard only, via `justK` — touch
  presses can't fire them; ≤1.2s between presses): Up×5 = unlock all worlds
  (`game.unlockAll`), Down×5 = wipe saves & reset (`game.resetProgress`).

## Testing & verification (do this every change)

- **`node test/harness.js`** — headless smoke test that stubs DOM/canvas/
  audio in a node `vm` and *plays the entire game through*: every level,
  every boss stage, both endings, vehicles, touch-tap paths, title pickers,
  plus a BFS solvability check of the space maze (zero sealed rooms, long
  goal path) and version/changelog/docs sync checks (the docs check parses the
  actual badge/footer values). 423 checks; must print
  `ALL CHECKS PASSED`. Run it 2-3× — a
  flaky pass usually means a real nondeterminism bug. Add checks for every
  new feature and every bug fix (regression tests caught 3 shipped bugs).
- **`tools/screenshot.sh <name> '<js-hook>'`** — real-render screenshots via
  Windows Chrome headless (WSL interop). Linux Playwright Chromium is broken
  here (missing libnspr4). Look at the PNGs — the canvas stub in the harness
  cannot catch visual/layering bugs.
- `node --check js/*.js` for quick syntax validation.

## Recurring bug classes — watch for them

**Solid ceilings over jump/launch paths.** Shipped twice (Cloud Climb v1.7.1,
Volcano Escape v1.8.2): a solid platform/wall underside sitting within jump or
bouncer-launch reach head-bonks the hero and can make a route unfinishable.
Rules: every landable surface on a climb is one-way; any solid that must stay
solid (walls, rims) floats HIGHER than apex-of-jump from every platform
beneath it (jump rise 148, launch rise = bounceVy^2/3200). Harness checks must
RIDE the launch/jump for real — teleporting past a traversal leg is how both
bugs shipped.

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
