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
| `js/entities.js` | `moveEntity` physics (AABB, one-way platforms, bouncy, breakable, auto step-up), `Player` (vehicles: wheel/truck/unicorn + water/space movement), `Spider` (kinds walk/jump/hang/swim/tornado/alien; states angry/frozen/friend/burning/flying), `Centipede`, `Projectile`, `Pickup`, `GrowthShroom` (Big Buddy mushroom), `Checkpoint`, `Gate`, `Zombie`, `Magma`, `LavaBlob`, `Shoe`, `Chest`, `ParkedTruck`/`drawTruckBody`, `ParkedUnicorn`/`drawUnicornBody`, adventure-mission kit (`Mission`, `MissionGate`, `MissionItem`, `MissionToken`, `Shrine`, `CollectionPuzzle`), `FireBreather`, `Spino` boss, `SubDoor` (mini-game entrances), `ExitDoor` (non-solid exit trigger for win-state-free sublevels, `lv.exitDoors`), `Vine` (swinging vines, `lv.vines`), `Monkey` (companion), secret-room machines `PipeWorks`/`TorchCavern`/`StarChamber`/`TreehouseTrail`/`BeatBash`/`ZombieTown`/`SunkenTemple`/`WeatherFactory` (attached as `lv.puzzle`) |
| `js/puzzleblocks.js` | The PUZZLE BLOCKS educational mini-game framework (BACKLOG.md item 11), three layers: `PuzzleBlocksMachine` (generic ENGINE — pool shuffle/no-repeat, `puzzleBlock` answer solids, lock/cooldown, wobble/fly/hold phases, reward hook; attached as `lv.puzzle` like other secret-room machines), MODE config objects (round generation + prompt/choice rendering + optional `roundsToWin`/`onWin` success state and `cx` placement for scrolling levels; `LetterBlocksMachine` is mode #1, `PatternBlocksMachine` — complete-the-color-pattern, no reading — is mode #2, debuting in the Sand Slide; `EndingLetterBlocksMachine` — the blank moves to the END of the word, "CA_"→T — is mode #3, in the 'endingblocks' cloud room; `CountBlocksMachine` — COUNT THE OBJECTS, the first QUANTITY BLOCKS mode, is mode #4 in Mountain World's 'countblocks' room, built on shared numeric helpers `QB_OBJECTS`/`qbLayout`/`qbDrawGroup`/`qbDrawNumeral`/`qbDrawSlot` meant for numeral→quantity, more/fewer, missing-number and +/− modes later; per-visit difficulty ladder `CB_TIERS`, count-up with number badges, bonus party every fifth solve; the engine's only addition was an opt-in `mode.holdTime`), and CONTENT tables (`LB_WORDS` 60-word bank, `EL_WORDS` 38-word ending bank — crisp single-letter endings only, icons 100% reused, `LB_ICONS` procedural icons — every icon must pass a contact-sheet screenshot review at in-game size; that's what caught v1's four-eyed frog; counting reuses 27 of them at s=66-92 plus `dino`/`bunny`) |
| `js/ride.js` | RIDE MODE, the reusable automatic-traversal framework: `RideMode` (generic heightfield rider — auto-forward, gravity, jump+coyote, natural ramp launches off falling-away lips, airborne trick combos; nothing desert-specific — future snowboards/minecarts/lava surfing reuse it), `RideCourse` (template procgen: terrain nodes + things, speed-scaled breather-flat constraint after every template), `SandSlide` (desert content + orchestration on `lv.ride`: pattern-puzzle→board handoff, friendship cactus, 5 truck parts with loss/re-queue that can never soft-lock, victory run, mega-ramp `stageClear(7)` with `game.partsDelivered`), plus the contact-sheet-reviewed desert art pack |
| `js/beams.js` | The reusable LIGHT-BEAM puzzle kit: `castBeams` 8-direction raycast (recomputed every frame), `BeamLantern`, `BeamMirror` (redirector dish — bump underside rotates 45° CCW, face+gold pointer show the aim; `fixed` gold relays for high routing; `frozen` = ground-reaching ice crust, one fire shot thaws), `BeamVent` (steam plume scatters beams; one ice shot freezes forever), `BeamSensor` (lights + latches forever, fires a reward hook), the `FrozenObservatory` machine (`lv.puzzle` for 'mountain2': four stations, respawning fire/ice pickups via `bossKind` = never-soft-lock, `telescopeLit` → the 'telescope' cutscene), the observatory art pack + `drawTelescopeCutscene` |
| `js/surfart.js` / `js/surf.js` | OCEAN SURF (v1.26.0), Ride Mode's second instance: `SURF_ART` (surfboard, sea, waves, shark, red ski ramps, floating chest, the monster-truck pirate boat, cannonball/splash/target ring, the Kraken with a controllable arm tentacle returning its tip, rock, island props, giant chest, surfboard door) and `OceanSurf` on `lv.ride` (phases by distance, wipeout→swim→remount, boat encounters enter→shoot→rev→ram→leave, the Kraken boss with rocks + the re-spawning rainbow block, the victory script friend→boatgrab→pickup→launch→coast→done, the island's giant chest paying `SURF.BIG_CANDY`). Engine: ride gate releases on `state === 'done'`, rides may supply `drawRider`, `lv.skyCam` lets a 720-tall level's camera rise for a launch, theme `'ocean'` = sky + clouds only. |
| `js/flowerart.js` / `js/flowerscene.js` | Art packs for RAINBOW SPIDER FLOWER LAND (Jack's level, v1.25.0): `FL_ART` creatures (rainbow/grump giant spiders with `scale` + moods, magic shroom, flower person, flower hat, bubble dragon, race bot, captain, gold bar, bubble) and `FL_SCENE` scenery (giant flowers incl. broken, rainbow-block castle, spider-home dome, pirate ship + `SHIP_DECK`, cloud island, tiny clouds, flags, party decor, gold chest, the meadow's flower door). Pure drawing functions, contact-sheet reviewed; no game-state reads. |
| `js/flowerland.js` | `FL` constants + actors (`MagicShroom` follow-item, `GiantFlower` smashable solids, `RainbowSpider` kinds rainbow/grump with eat→grow→walk→smash / eat→yawn→sleep, `FlowerPerson`, `GoldItem` (a `MissionItem`), `RaceBot` rubber-band racer) and the `FlowerLand` machine on `lv.puzzle`: two `Mission`s (key door, gold door) it updates itself, the dragon's bubble pool (one-way bouncy solids that lift a standing hero), the race + countdown, the party cast; `cutTick(dt, c)` runs its own cutscenes (`spidergrow`, `hatgift`, `racestart`) since updatePlay skips machines during cuts. |
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
| 1 | Block Meadow | meadow | tutorial, fire block; Letter Blocks learning room (SubDoor x=2700, rainbow style) — a reusable picture-prompt mini-game framework, first instance Beginning Letters | stage archway (x=4230) → BLOCK MEADOW 0-2 ('meadow2': 6800px, bigBrick walls + refill buddy blocks; a press-gated FLOWER door at x=2900 opens Jack's RAINBOW SPIDER FLOWER LAND sublevel); its finale star completes the world |
| 2 | Underwater World | water | 4-dir swim (`lv.water`); OCEAN SURF ride via a press-gated surfboard door on the seafloor (x=450) | stage archway (x=3880) → SUNKEN TEMPLE 1-2; its treasure star completes the world |
| 3 | Cloud World | cloud | one-way clouds, rainbow bridges, cloud-catch; Ending Blocks learning room (press-gated rainbow SubDoor x=460 on the start platform) — Puzzle Blocks mode #3, ending letters | stage archway (x=4700 island) → WEATHER FACTORY 2-2; its lonely star completes the world |
| 4 | Mountain World | mountain | power block smashes breakable walls; Golden Key mission (locked door + collect 3 Mountain Crystals: easy / spring-launch / wall-smash); Counting Blocks learning room (press-gated rainbow SubDoor x=300 on the start flat) — Puzzle Blocks mode #4, Count the Objects | stage archway (x=4700) → THE FROZEN OBSERVATORY 3-2 ('mountain2', js/beams.js): three beam-routing terraces (bump-rotate mirror dishes, fire-thaw frozen mirrors, ice-freeze steam vents, latching sensors thaw snow staircases) → dome grand alignment → telescope cutscene (Space Maze aliens wave back, gift the star) completes the world |
| 5 | Zombie Cave | cave | darkness overlay + lights; ZOMBIE boss (fire→ice→rainbow) | Golden Candy Treasure chest |
| 6 | Lava World | lava | fire ignites spiders → panic → explosion chains; lava pools; KING MAGMA boss (ice×3→power ram→rainbow) | Candy Volcano eruption |
| 7 | Monster Truck Rally | dirt | STAGE 6-1 is the DESERT SAND SLIDE ('sandslide', js/ride.js): pattern puzzle → boogie board → procedural downhill ride collecting 5 truck parts → victory run → mega-ramp launch; arriving sets `game.partsDelivered` so the rally's TruckBuild starts in `delivered` mode (token hunt skipped, ceremony fires on approach; a direct startLevel(7) keeps the classic hunt); a press-gated back-door SubDoor (`{goTo: 'sandslide'}`, x=140) at the rally start replays the slide, tutorial skipped via `game.slideReplay`. Then Build-Your-Truck (find wheels/engine/core, assembly ceremony — or delivered) then `vehicle='truck'`, ramps+auto backflips, turbo pad, dirt tornadoes | finish line → grandstand + Candy Trophy |
| 8 | Unicorn Forest | forest | `vehicle='unicorn'`, Up-mash = wing flight + glitter, horn always fires rainbows, Centipede chains | castle coronation → permanent crown (`game.royal`) |
| 9 | Space Maze | space | `lv.space` (weightless swim), 44×19 BFS-verified maze, saucer aliens | golden star → MAZE MASTER (befriends all aliens) |
| 10 | Dino Jungle | jungle | `FireBreather` dinos (jump the telegraphed flame), vine spiders, Dino Key mission (ancient gate + 3 lost eggs: platform / mushroom-bounce / flame-timed), friendly dinos (longnecks/trike/T-Rex) | GIANT SPINOSAURUS boss in the valley (ice×3 douses flames→fire×3 hiccups→rainbow; both-side arena walls via `game.spinoWalls`, `lv.bossX` trigger) → golden star → party |

Progression (LINEAR WORLD CHAINS since v1.20.0): each world is an ordered
stage list in `WORLD_STAGES` (levels.js) — currently `1: [1,'meadow2']`,
`2: [2,'water2']`, `3: [3,'cloud2']`, `4: [4,'mountain2']`,
`7: ['sandslide', 7]`, everything else single-stage. A stage's
ending is a `{advance: true}` stagegate SubDoor → `game.stageClear(next)`
(a light ~2.4s STAGE CLEAR card, then the next stage loads as a FULL level —
no enterSub). The FINAL stage's goalStar → `game.worldWin(w)`: full party,
unlocks world w+1, resets that world's stage progress. Every base world (1-4)
is a two-stage chain now (no star `Gate`s left); beating each boss/finale unlocks the
bonus worlds as before (zombie→6, magma→7, rally→8, coronation→9, maze
star→10) and party exits chain 5→6→7→8→9→10→title (internal n). Picking a
world (medallion/digit/Space → `game.startWorld`) resumes at the furthest
stage reached; a beaten world restarts at stage 1. Title digit keys use
DISPLAYED numbers: 0 = meadow … 9 = jungle (digit d starts internal d+1).
Persistence (localStorage): `ffbg_unlocked` (1-10), `ffbg_stage` (furthest
stage per world, "w:idx,...", additive — old saves unaffected), `ffbg_char`
('boy'/'girl'), `ffbg_royal` ('1' after coronation → crown drawn everywhere
via `drawBoy`/`drawHead`).

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
- **Big Buddy growth (v1.14.0)**: solids flagged `{buddy: true}` are bonkable
  head-hit blocks (`moveEntity` reports the hit solid via `res.headS`; the
  player's on-foot branch calls `game.bumpBlock(s)`); a bonk spawns a
  `GrowthShroom` (waddling gold mushroom in `game.pickups`, 85 px/s, turns at
  walls, teleports home if lost) and marks the block `used` (one-shot;
  `s.bumpT` hop anim decayed in `updatePlay`). Collecting it → `Player.grow()`:
  `big = true`, hitbox 56×94 → 78×130 (feet planted), art scales via lerped
  `drawK` around the feet. The shrink-instead-of-heart rule lives at the TOP of
  `Player.damage()` so every hazard gets it free (`shrinkDown()`, `inv = 2`, no
  heart). `{bigBonus: true}` solids are pink candy crates only a big bonk
  breaks (own flag, NOT `breakable`, so Super Mode can't smash them; always
  optional). Vehicles/water/space: `grow()` just cheers; boarding resets big;
  new levels/sublevels start normal; `exitSub` restores bigness with the host
  player. Block placement rule: underside at G-190 (bonkable from ground,
  walk-under for Big Jack 130). Placed in meadow (3540 + crate 3920) and
  jungle (560, before dino #1 whose flame reaches x≈758). Since v1.15.0:
  `{bigBrick: true}` solids are tall red-brick walls BIG Jack rams through in
  either axis (moveEntity, mirrors breakable×superT via `smashWall(s, cols)`);
  small hero pushing one sets `s.hintT` → mushroom thought bubble. A wall that
  gates a MANDATORY route must be ≥240 tall (jump 148 + step-up 52 = 200
  clearable) and paired with a `{buddy: true, refill: true}` block, which
  re-arms on bonk when the hero is small and no live shroom exists — the
  never-soft-lock rule. Both debut in 'meadow2'.
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
  'piperoom', 'torchcave', 'zerog', 'treehouse', 'beatbash', 'zombietown',
  'meadow2', 'water2', 'cloud2', 'mountain2', 'letterblocks', 'endingblocks', 'countblocks', 'flowerland', 'surf'; since v1.20.0
  meadow2/water2/cloud2/mountain2 are CHAIN STAGES started via `startLevel`, not
  sublevels — the rest are true sublevels), entered
  via `SubDoor` in `lv.subDoors` (styles cloud/cave/rainbow/crack/bubble/
  pipe/eyes/asteroid/ladder/garage/moonwell/stagegate — opts {press: true} makes
  a door Space/★-only with a bobbing key hint, for doors on busy routes (the
  letterblocks door); 'garage' also requires slow/stopped
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
  and a clock-tower festival finale gated on all four reaching the square).
  OCEAN SURF ('surf', off Underwater World, v1.26.0) is Ride Mode's second
  instance (js/surf.js + js/surfart.js): a beach, the board, five surf phases
  by distance (waves/sharks/red ramps/chests/the monster-truck pirate boat),
  the surf-along Kraken befriended with the re-spawning rainbow block, and
  the oversized victory (boat flung, hero launched with `lv.skyCam`, island,
  giant chest +100 candy → subWin). Wipeouts (wave/shark/cannonball/ram/
  rock) are swim-and-remount, never damage.
  RAINBOW SPIDER FLOWER LAND ('flowerland', off Block Meadow 0-2, v1.25.0) is
  JACK'S OWN storybook level (spec in docs/superpowers/specs/): a 10000×1500
  world with ground floor G=1400 and a one-way giant cloud at y=600 — six
  beats (mushroom→giant rainbow spider grows→smashes the flower→key→secret
  door; mushroom→grumpy guards sleep; flower person→magic hat→ON-FOOT flight
  (`player.hatFly`, only west of the castle gate x=6250); dragon bubbles
  (one-way bouncy solids that lift a standing hero) up through the cloud;
  pirate ship + robot race with a 3-2-1 countdown cut and a touch rematch;
  gold→party door→goal star→subWin). No enemies, no damage; the level adopts
  the machine's solids. Player physics for the hat lives in entities.js.
  Letter Blocks ('letterblocks', off Block Meadow) is the first PUZZLE BLOCKS
  mode — the educational mini-game framework in `js/puzzleblocks.js` (see that
  row above and BACKLOG.md item 11 for the full mode backlog; Count the
  Objects shipped v1.24.0 as Mountain World's 'countblocks' room — the first
  Quantity Blocks mode; Ending Letter Blocks v1.22.0 as Cloud World's
  'endingblocks' room, Pattern Blocks v1.21.0). It's also
  the first sublevel with no win state — a new `ExitDoor` primitive
  (`lv.exitDoors`) lets the room be left at any time via `game.exitSub()`
  directly, skipping `subWin`/party entirely, and re-entry always rebuilds a
  fresh puzzle. The Jungle Treehouse Trail ('treehouse',
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
- **Title**: Escape (justK, keyboard only) quits any level back here — skipped
  while `document.fullscreenElement` is set, since the browser owns that Esc
  press to exit fullscreen. Hero picker (Up/Down or tap; girl has curly blonde hair), level
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
  actual badge/footer values). 754 checks; must print
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
  and cost. Model assignment by phase:
  - **Fable (top-level session)** — brainstorming/design decisions, specs and
    implementation plans, architecture and progression/flow changes, reviewing
    subagent output (e.g. contact-sheet art review), the trickiest debugging,
    and final ship judgment.
  - **Sonnet (subagents)** — substantive well-scoped work from a precise
    brief: parallel art/level batches with their own verify loops, feature
    implementation of a planned task, screenshot-iterate cycles.
  - **Haiku (subagents)** — mechanical work: searches, renames, bulk data
    edits, boilerplate, doc-sync sweeps.
  - Solo work by the session model is fine when a task is small enough that
    delegation overhead would cost more than it saves.
  - NOTE: this file only steers delegation downward. The top-level session
    model is chosen at launch (or `/model`) — Ryan's standing preference is
    Fable there; if a session starts on a lesser model with architectural
    work ahead, say so early instead of silently proceeding.

## Backlog

`BACKLOG.md` (repo root) is the single source of truth for future work — a
design document with a Status board at the top. Update its Status board in the
same release commit that ships an item (mark `✅ shipped vX.Y.0` + one line on
what was actually built). Current phase: Stage 2 puzzle expansions (Sunken
Temple → Weather Factory → Frozen Observatory). Playtest notes may arrive as
GitHub issues; fold them into BACKLOG.md during planning, then close them.

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
