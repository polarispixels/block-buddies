# Changelog

All notable changes to Block Buddies are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/); versioning: [SEMVER](https://semver.org/).

Policy: **MAJOR** = breaks saved progress (`localStorage` keys/format) or the documented
architecture; **MINOR** = new player-visible content (level, vehicle, enemy, power);
**PATCH** = fixes and tuning. Every release bumps `GAME_VERSION` in `js/util.js`, adds an
entry here, updates `docs/index.html`, and gets a git tag `vX.Y.Z`.

## [1.19.2] - 2026-08-29

### Changed

- The Puzzle Blocks rainbow door in Block Meadow no longer swallows a
  passer-by: entering is now a deliberate stand-on-it + Space/★ (Ryan's
  playtest note — the door sits on the main walking route). A bobbing
  action-key hint appears while the hero stands on the doorstep. New
  `SubDoor` option `{press: true}` for any future door on a busy route.

## [1.19.1] - 2026-08-29

### Changed — PUZZLE BLOCKS: the framework gets its name and its seams

No player-visible changes — this release formalizes Letter Blocks into the
**Puzzle Blocks** framework ahead of the next three planned modes (Ending
Letter Blocks, Count the Objects, Pattern Blocks):

- `js/letterblocks.js` → `js/puzzleblocks.js`, split into three layers:
  the generic `PuzzleBlocksMachine` engine (pool shuffle/no-repeat, block
  solids, lock/cooldown, wobble/fly/hold phases, reward hook), a small MODE
  config object defining semantics (round generation, prompt + choice
  rendering, fly target), and pure CONTENT tables (`LB_WORDS`/`LB_ICONS`).
  `LetterBlocksMachine` is now a thin mode on the engine. Answer solids are
  flagged `puzzleBlock` (was `letterBlock`).
- Harness proves the reuse contract for real: a throwaway numeric counting
  mode is driven through a full round (choices, correct answer, candy
  reward, auto-advance) on the untouched engine — 549 checks.
- The full Puzzle Blocks Learning Framework backlog (mode families A–H,
  biome fits, progression philosophy, multi-step future, what never to
  build) is documented in BACKLOG.md item 11, spec preserved verbatim in
  `docs/superpowers/specs/2026-08-29-puzzle-blocks-framework.md`.

## [1.19.0] - 2026-08-29

### Changed — LETTER BLOCKS second generation: 60 words, kid-proof icons

Playtest feedback from the kids (the four-eyed frog, the book that read as
a card, the cat Rebecca called "that guy") drove a full second iteration:

- **All 20 original icons redrawn + 40 new ones**, every single icon
  individually verified on contact-sheet screenshots at in-game size — the
  process gap that let v1's misses ship. New craft rules: silhouette first,
  at most one face (only where natural), features scaled to read at 190px,
  no composite operations (fixes the v1 moon punching a hole in the sky).
- **Word bank tripled to 60**: new `_AN` (van/can/fan/pan), `_ELL`
  (bell), `_ING` (ring/king), `_OAT` (goat/boat), `_OUSE` (mouse/house),
  `_AKE` (snake/cake) families plus bat/log/box/truck/star joining the
  existing cat-hat/dog/fox/duck/car families, and 20 more animals and
  everyday objects — all vetted for the "kid says a different word"
  ambiguity trap.
- Icon batches drawn by parallel subagents, each running its own
  screenshot-review loop before an orchestrator-level review of the full
  60-icon contact sheet.

## [1.18.0] - 2026-08-29

### Added — LETTER BLOCKS: a reusable educational mini-game framework

The first non-platforming mini-game: a picture-prompt puzzle framework
(`js/letterblocks.js`) built to grow into future modes (missing-last-letter,
picture-to-word matching, word families, counting, colors...), plus its
first instance, **Beginning Letters**, in Block Meadow.

- **The room**: a small learning-garden screen off a new rainbow-sparkle
  door (x=2700, past the second spider) — a picture, a word with its first
  letter missing (e.g. "_AT"), and three big physical answer blocks. Jump up
  and bonk the correct one from underneath, exactly like a Buddy Block; the
  letter flies into the blank, the word completes, and candy is awarded
  through the normal economy. Wrong answers just wobble and bounce — no
  punishment, no reset, unlimited retries.
- **20-word pool**: cat, dog, pig, fox, bug, fish, bird, frog, duck, bear,
  ball, book, bed, cup, hat, car, sun, moon, tree, apple — each with its own
  procedural icon and plausible-letter distractors (some intentionally
  overlapping word families, e.g. cat/hat share `_AT`). Shuffled and cycled
  without back-to-back repeats; reshuffles once exhausted.
- **Always replayable**: no required round count, no completion state, no
  score beyond the shared candy counter. A new `ExitDoor` primitive lets the
  room be left at any time, mid-animation or not — the first sublevel exit
  that isn't gated behind a win condition.

## [1.17.0] - 2026-08-23

### Added — THE WEATHER FACTORY 2-2: recipes in the sky

Release two of the *Puzzle & Long-Level* direction (BACKLOG item 2): a
weather-making factory in the open sky above Cloud World — at 7600px the
biggest level in the game, with wide stretches of open air between its four
island stations (big levels should breathe — Ryan's note).

- **Levers & recipes**: six big levers with icon knobs (💧 water, ❄ cold,
  ☀ sun, fan) toggle with Space and stay reversible until a station latches
  done. Recipes are taught by doing: water → RAIN; fan → WIND; water + cold →
  SNOW; water + sun → RAINBOW.
- **The power cable**: the fan spins the windmill, which latches POWER
  forever (flywheel!) — a visible sagging cable with traveling sparks feeds
  the freezer and the sun lamp, so nothing cold or bright works until the
  windmill turns. No power = the freezer sputters gray puffs (funny, never
  punishing).
- **Four stations, visibly transforming**: rain blooms the wilted flower
  garden and grows a giant stalk stairway to the high deck; snow builds the
  hopeful puddle (thought-bubble: a snowman) into a waving snowman,
  ball by ball; rain + sun over the great gap paints a RAINBOW you can
  actually walk across.
- **The lonely star**: all four weather orbs lit → the golden star ignites on
  its own island, a full rainbow-crossing away — with a pedestal whose four
  weather slots fill in as wordless progress.
- No enemies, no hazards; falling just means the cloud-catch. Cloud World
  grew (4600 → 5000, gate to 4930) to give the stage archway its own island.

### Changed

- Sunken Temple's golden star moved deeper into the treasure chamber (spacing
  note from Ryan's playtest — rewards get their own space).

## [1.16.0] - 2026-08-23

### Added — SUNKEN TEMPLE 1-2: the first puzzle stage

The first release of the *Puzzle & Long-Level* direction (BACKLOG item 1):
a big drowned temple (5200 × 1600, entered through a stage archway on
Underwater World's seabed) built entirely from visible cause-and-effect.

- **Valves & currents**: bronze valve wheels (Space nearby turns them; a green
  lamp shows ON; always reversible) toggle water-current streams — the same
  generic currents that push the hero, with marching chevrons and bubble
  trails showing exactly which way each one flows.
- **Pearls & sockets**: currents carry shimmering googly pearls; each seeks
  its clam socket (a ghost-pearl silhouette shows what it wants) with a
  forgiving magnet for near-misses. A pearl knocked out of its wing pops back
  to its home bowl — it can never be lost.
- **Three puzzle wings, any order**: the valve lesson (one valve → one
  stream → click); the up-shaft (two valves — one alone strands the pearl
  below the shaft, visibly waiting); and the cage (a shell switch pops a
  membrane — flip the current first and the pearl strains against the cage
  until you free it: wrong order is funny, then it whooshes).
- **The waking door**: each finished wing lights an orb, a glowing stream
  arcs to the great door, and its three pearl slots fill in (wordless
  progress). All three → the sleeping stone face wakes GRINNING, the slab
  crumbles, and the golden star appears in the treasure chamber you could
  see through the walls the whole time.
- No enemies or hazards inside the temple (two swim spiders in the open-sea
  approach only) — thinking is the whole game here.

## [1.15.0] - 2026-08-23

### Added — BLOCK MEADOW 0-2: the first stage-two level

- **A wooden stage archway** (golden star on the arch, big friendly "2" badge)
  now stands on the walk to Block Meadow's goal gate — the meadow grew a
  little (4200 → 4650) to make room. Walk in and the meadow keeps going:
  **BLOCK MEADOW 0-2**, at 6800px the longest level in the game, still gentle
  meadow all the way.
- **Big-brick walls**: the route through 0-2 is barred twice by tall red-brick
  walls (one single, one double guarding a candy vault). They cannot be
  jumped, stepped, or Super-Moded — the ONLY way through is to become Big
  Buddy and **ram straight through them** (boom, brick shrapnel, onward).
  A small hero pushing one gets a wordless thought-bubble hint: a little gold
  mushroom.
- **Refilling buddy blocks**: the block before each wall re-arms itself after
  its mushroom is spent (dim teal pulse instead of sleepy gray), so shrinking
  never soft-locks the stage — bonk, chase, grow, smash, repeat.
- Other 0-2 fun: a spring-block sky path, a jump spider, an optional candy
  crate, two hearts, generous checkpoints, and a golden-star finale party.
  Completion earns the archway its gold trophy star (replay anytime with
  Space, like every stage door).

## [1.14.1] - 2026-08-23

### Added — Escape quits to the title (Ryan's desktop request)

- Pressing **Escape** during any level (play, intro card, lose screen,
  celebrations, mini-games) returns to the main menu. Physical keyboard only
  (`justK`), so touch play is untouched. While fullscreen, the browser owns
  Esc (it exits fullscreen) — that press is deliberately ignored, and a
  second Esc then quits the level.

## [1.14.0] - 2026-08-23

### Added — Big Buddy growth system

- **Buddy Blocks**: glowing turquoise blocks with a golden mushroom emblem
  float overhead. Bonk one from below with your head and it hops, goes
  sleepy-gray, and a **gold, turquoise-spotted mushroom with tiny walking
  feet** pops out and waddles around (slow enough that the chase is always a
  win; it can never be permanently lost — it pops back to its block if it
  ever tumbles away).
- **Big Jack / Big Becca**: catch the mushroom and grow ~40% BIGGER (wheel
  and all) with a stretchy pop and a rising jingle. Staying big is a free
  extra layer: the first hit — spider, flame, lava, anything — shrinks you
  back with a pop instead of costing a heart. Hearts work exactly as before
  after that.
- **Candy crates**: pink-striped bonus blocks only BIG buddies can smash from
  underneath — a candy explosion inside. Small buddies just wobble them
  (funny, not punishing). Super Mode can't smash them; only bigness can.
- Placements: Block Meadow teaches the whole sequence after the last
  checkpoint (buddy block → chase → grow → last spider → optional candy
  crate → gate); Dino Jungle reinforces it with a buddy block right at the
  entrance, so the first fire dino's flame demonstrates the shrink rule
  wordlessly.
- New `grow` / `shrinkpop` sounds; vehicles, water, and space are unchanged
  (boarding or a new level resets to normal size).

## [1.13.1] - 2026-08-20

### Changed — Zombie Town: the answers moved across town (Ryan's playtest note)

Each problem's solution used to sit right beside it; now discovery takes real
exploring, and every answer lives somewhere else in town:

- **Granny's haystack** moved two houses down the street: bounce onto the
  *shop* roof, leap the rooftop gap, and walk the ridge back to her — and her
  thank-you leap is now one enormous cartoon arc clear over the shop into the
  hay.
- **The balloon** is now snagged on a chimney at the far end of town, a whole
  street away from the kid — and floats high enough that only the crate climb
  reaches it (a plain ground jump could quietly grab the old one; the harness
  now guards against that).
- **The cart's wheel** is wedged by the old well at the opposite end of the
  map. Walking past does nothing; ★ pops it loose (it strains and wiggles as a
  hint), and it then rolls the entire street home, straight through the
  square.
- **Candy** no longer spawns near the hungry tiny zombie — the nearest pieces
  are back in the square or up on the rooftops (a candy row now sketches the
  rooftop route, and an arc traces the haystack launch).
- Harness rides all the new longer routes end-to-end: 423 checks (was 420).

## [1.13.0] - 2026-08-20

### Added — ZOMBIE TOWN AFTER DARK: a whole little world above the cave (Jack's idea)

Concept by Jack himself: Zombieland + the night sky + PEOPLE. Deep in Zombie
Cave a shaft of real moonlight now pours through a crack in the ceiling —
stars twinkle up there, dust motes drift in the beam, music notes float down,
a faint far-away bell rings, and rock rungs climb the wall. Step into the
beam and climb up into a small moonlit town that has been waiting up there
the whole time. Arrival plays one slow wordless camera pan across the whole
town — rooftops, chimneys, streetlights, a clock tower at five-to-midnight —
before handing back control.

- **Four townspeople, four different verbs, zero words.** Every problem is
  told in thought bubbles and body language, and each solves differently:
  - **Granny on the roof** (traversal): she waves for help from her rooftop;
    the haystack below is a bouncy mushroom in disguise — bounce up, reach
    her, and she leaps into the hay (WHEE!) and trots off to the square.
  - **The lost balloon** (knock loose + carry): a sad-faced balloon is stuck
    under the streetlamp's arm; climb the crates, bump it free, and it
    happily tails the hero like a puppy all the way back to the kid.
  - **The "scary" tiny zombie** (spend candy with ★): a very respectable
    gentleman is terrified of a knee-high zombie whose own thought bubble
    just shows CANDY. Stand close, press ★, and one candy from the actual
    HUD counter flies over — munch, hearts, instant best friends. Pressing
    with empty pockets makes the zombie beg extra hopefully (nothing breaks).
  - **The broken festival cart** (cause and effect): the missing wheel leans
    on a fence down the street; one touch sends it rolling home by itself —
    KLUNK — and the carter rides his repaired cart into the square. Obviously.
- **The town visibly comes alive** with every rescue: windows glow warm,
  streetlights switch on pair by pair, bunting turns colorful, distant
  horizon windows light, and little zombies start peeking from doorways.
- **MIDNIGHT.** All four gathered, the clock tower arms and glows. Press ★
  beneath it: the music stops, BONG — BONG — BONG — the minute hand sweeps
  to twelve, and the ZOMBIE FESTIVAL erupts: a zombie conga line (one
  dancing the wrong way, one tiny one in an enormous hat), a skeleton
  playing trombone badly on a schedule, a spider drummer from the cave
  downstairs, fireworks rockets bursting all over the sky, candy rain, a
  briefly smug moon, and the golden star answering over the square.
  **MIDNIGHT HERO!** — completion persists in `ffbg_mini`, the moonbeam
  becomes a dormant trophy, and replay is stand-in-the-beam + Space.
- **A real night sky**: layered twinkling stars, shooting stars, clouds
  drifting across a huge cratered moon, silhouette rooftops — drawn behind
  the playable town via the `drawBack` hook from v1.12.0.
- New `midnight` waltz for exploration, `bong` and `firework` sfx, a new
  `moonwell` SubDoor style, and the game's first ordinary-people cast
  (granny, kid, gentleman, carter — simple state model:
  need → solved → walk → square → festival).

### Changed

- The harness now walks all of Zombie Town too (reveal pan, all four solves
  ridden for real, premature-bell guard, festival, persistence, replay, and
  cave-intact checks): 420 checks (was 392).

## [1.12.0] - 2026-08-19

### Added — PIT STOP BEAT BASH: the first rhythm game (a whole new genre inside a secret)

Monster Truck Rally hides a pit garage that is very obviously having a party
inside: the whole building thumps to a muffled BOOM-BOOM-…-HONK, colored light
strobes through the roller-door seams, a wrench occasionally flies off the
roof, and every so often a tiny mechanic peeks out, sees you, and SLAMS the
door. Racing past at monster-truck speed never interrupts the race — stop (or
press ★) at the strange garage and you're pulled into the band room.

- **One control, one idea.** Space/★ when the big colored ring shrinks onto
  the glowing instrument. The hit window is ±0.3s (huge), a bouncing spacebar
  icon teaches it wordlessly for the first two beats, and a dashed target
  circle always shows where to look.
- **Misses are jokes, never punishment.** No lives, no game over, no resets:
  a wrong-time press gets a weak *plop* or a sad deflating honk and a pit-crew
  shrug ("?"); a beat nobody hits earns a confused tire wobble and the next
  beat simply queues up. Cumulative progress only ever goes up.
- **The band builds as you succeed.** Tire drum → hubcap cymbal → exhaust
  horns → engine-block bass: every 4 good hits, the featured instrument JOINS
  THE BAND and its layer starts looping in the groove, so the garage audibly
  and visibly comes alive — string lights, lug-nut equalizer bars, dancing
  wrenches, pumping pistons. Six more full-band hits (varied but readable
  spacing) and…
- **The monster-truck finale.** Music stops, garage shakes, the big doors fly
  open, and the MONSTER TRUCK rolls in to play an engine-rev solo, do one
  completely unnecessary backflip, and detonate a candy-and-confetti eruption.
  The golden star pops out at the doorway: **PIT STOP SUPERSTAR!**
- **All the secret plumbing comes free.** Completion persists in `ffbg_mini`,
  the door becomes a dormant gold-star trophy (drive over it forever, replay
  by standing on it + Space), and exiting restores the rally — truck, race,
  and all — exactly as you left it.
- **Deterministic rhythm engine** (`BeatBash`, on `lv.puzzle` like every
  secret-room machine): a dt-driven song clock, fixed beat intervals, a fixed
  8-step groove sequencer, and the shrinking ring as the single source of
  timing truth — reliable under any frame-rate wobble, no audio sync needed.
  New reusable hook: `lv.puzzle.drawBack()` paints a room interior *behind*
  the solids and goal star. Nine new procedural sfx (tire kick, hubcap,
  honks, bass, plop, count-in tick, muffled thumps, wrench clank).

### Changed

- The harness now also plays the whole Beat Bash through (drive-by immunity,
  window edges, whiffs, misses, band order, finale, persistence, replay, and
  a post-secret rally run): 392 checks (was 367).

## [1.11.0] - 2026-08-18

### Added — the JUNGLE TREEHOUSE TRAIL: the game's first mini-ADVENTURE

The biggest optional level so far, entered through a rope-ladder trunk right at
Dino Jungle's edge (leaves flutter down, a tiny treehouse peeks through the
canopy far above, and a faint monkey whoop drifts down). Built for curiosity,
not speed: two whole jungles in one world, split by a waterfall gorge that can
only be crossed one way — and finding that way is the story.

- **The sad monkey.** Slumped at the gorge rim, sighing, dreaming of a banana
  in a thought bubble. The banana hangs on a palm just out of jump reach, and
  freeing it is a multi-step, any-order machine the player can SEE working: a
  pressure plate unrolls a rope ladder; the treehouse porch lever spins a
  pulley that pays the banana rope down; and a grumpy toucan sitting on the
  rope pins it halfway ("?!") until the bounce flower beneath launches the
  hero past and startles it off (thrown blocks work too). Wrong-order attempts
  are jokes, never damage. Deliver the banana → munch-munch-munch → hearts,
  confetti, a discarded peel — **monkey friend acquired, forever**.
- **Monkey airline.** The new friend bounds along behind the hero and, at
  wooden launch pads, grabs them, winds up, and HURLS them along a huge
  "WHEEE!" arc — across the gorge into the sunlit upper canopy (with candy
  floating along the flight path), and later straight up to the Grand
  Treehouse balcony. The monkey leaps across right behind you every time.
- **Swinging vines** (new reusable mechanic, `Vine` in entities.js): jump into
  the dangling leaf grip to grab on, ride the steady pendulum, press Up/★ to
  let go with the swing's momentum plus a friendly boost — bad timing is never
  a plummet. Four vines: a safe floor-level teacher, a treehouse joyride, and
  two canopy crossings (a vine-free ladder route runs beside them).
- **No way to lose.** No enemies anywhere; falling into the gorge lands on a
  giant grinning leaf trampoline that bounces you back to the near side; all
  machine/friendship state lives on the level object, so death and respawn
  lose nothing.
- **The MONKEY DISCO.** A gold bounce flower fires the hero up to a hidden
  hollow-trunk club where three baby monkeys dance under sweeping party lights
  around a spinning glitter banana. Finding it pops candy, a heart, and
  confetti.
- **The Banana Bell finale.** Reaching the highest balcony with the monkey
  sends him scampering up the bell rope: BONG ×3, candy rain, and the golden
  star answers the bell. Completion persists in `ffbg_mini` like every secret.
- Extra jungle life: a slow-motion waving sloth, a spider taking a bubble bath
  in a wooden tub, hopping frogs, giant trunks, rope bridges (new plank skin),
  a gorge waterfall with its own rainbow, and a new `treetop` canopy-marimba
  song plus monkey/squawk/sad-monkey sound effects.

### Changed

- The test harness now parses the ACTUAL docs version badge and footer values
  instead of substring-matching (a stale badge could previously hide behind
  body text like "since v1.9.0"), and rides the whole Treehouse Trail for
  real — vines, ladder, machine, throws, disco, bell — 367 checks total.

## [1.10.0] - 2026-08-17

### Added — SECRETS PACK II: three new secret mini-games

Each one exercises a different kind of thinking, always through the same loop:
notice something strange → investigate → experiment → see a reaction → figure
it out → big payoff. No reading, no punishment, no way to get stuck.

- **Secret Pipe Room** (World 0, *cause and effect*): a suspiciously oversized
  green pipe in the meadow keeps burping candy — walk in and FWOOOP. Inside, a
  one-screen candy machine: three hoppers drop funny-face blocks down visible
  chutes that start aimed at the WRONG eater machines; color-ringed floor
  buttons swing each pipe with a CLUNK. Correct feeds gulp and latch a bulb ON
  forever; wrong feeds are the comedy (steam-cloud cough, melting puddle with
  eyes, confetti explosions). Three bulbs → KA-CHUNK ×3 → candy eruption with
  real collectible candy → the golden star pops out.
- **Torch Cavern** (World 4, *observation and matching* — never Simon Says): a
  dark side tunnel where two glowing eyes blink beside a tiny torch. Inside,
  a sealed stone door shows three dim symbols (star/heart/candy); five torches
  wait in the dark, each findable by its faint ember. Touch one (or hit it
  with a fireball — a fire block waits by the entrance) and it lights: symbol
  torches send a glowing wisp into the matching door slot; the other two are
  gags (a goofy stone bat wakes up; a giant Zzz rises from behind the door,
  which also leaks muffled snores as the audio clue). Ice re-douses a torch
  for a laugh but filled slots stay filled. All three home → the slab grinds
  open, the cavern floods with light, and the "scary" secret is four baby
  zombies at a slumber party — they wake, boggle, and dance; chest + star.
- **Zero-G Star Chamber** (World 8, *spatial planning* — a transport puzzle,
  not another maze): a cracked asteroid below the maze start leaks golden
  sparkles. Inside, a huge weightless chamber with an unfinished constellation:
  five color sockets, five faced stars. Touch a star and it TAILS you (star
  trains allowed; a lagging star snap-teleports back — unloseable); carry each
  home and it snaps in with a chime. Star 1 teaches; star 2 hides in an
  asteroid pocket; star 3 sits past an up-blowing solar-wind current; star 4
  waits behind an energy gate popped by one big button; star 5 belongs to a
  silly alien — bumps make it giggle, a fired rainbow makes it hand the star
  over. All five home → the constellation connects and resolves into
  Jack-Jack or Becca made of stars (crown included for royalty) → candy
  fireworks → golden star.
- New reusable plumbing, kept deliberately small: a generic `lv.puzzle` slot
  (update/draw hooks in `game.js`, exactly like `lv.mission`), three new
  `SubDoor` styles (`pipe`/`eyes`/`asteroid`), puzzle light sources feeding
  the darkness overlay via `lv.puzzle.lights()`, sub-doors now glow in dark
  levels so secrets stay findable, and a `snore` sfx. Everything else reuses
  existing systems (goal star → `subWin` → `ffbg_mini` persistence + dormant
  trophy doors), so saves are untouched.
- Harness grows 266 → 325 checks: every secret is entered through its real
  door, solved by really riding the jumps/currents/projectiles (no teleports
  across traversals), checked for comedy-not-failure on wrong inputs, and
  verified to leak nothing back into its host world.

## [1.9.0] - 2026-08-17

### Changed
- **Worlds are now numbered 0-9** (Ryan's call): with five "bonus" levels the
  bonus framing stopped making sense. World 0 is the training meadow, world 9
  is Dino Jungle. Intro cards now say "LEVEL 0"-"LEVEL 9" for every world (no
  more "BONUS LEVEL!"), medallion badges show 0-9, and the title digit keys
  match what's shown (0 starts the meadow, 9 the jungle). This is display-only:
  internally everything stays n = 1-10 (`buildLevel`, `ffbg_unlocked`, the
  harness), so saved progress is untouched — displayed number = n - 1.

### Fixed
- Mini-game intro cards used to render "LEVEL cloudclimb"; they now say
  "MINI-GAME!" above the sublevel's name.

## [1.8.3] - 2026-08-16

### Fixed
- **Completed mini-game doors kept swallowing the hero** (found by Ryan): doors
  like the Secret Ascent's sit right on normal walking routes, so after
  finishing the mini-game you kept falling back into it by accident. Completed
  doors now go DORMANT: they shrink into a quiet trophy marker with the gold
  star, and walking over them never re-enters. Replaying is deliberate — stand
  on the marker (a wordless Space hint pops up) and press Space/★. The bubble
  door's inviting bubble stream also stops once its secret is found.

## [1.8.2] - 2026-08-16

### Fixed
- **Volcano Escape's top section was practically unfinishable** (found by Ryan):
  the crater rim was two solid rock slabs whose undersides hung at exactly head
  height over BOTH routes — the express vent fired the hero straight into the
  left slab's belly (a guaranteed bonk 4px before clearing it), and the ladder
  route's final hops bonked the right slab. The big terraces were solid too
  (bonks from below), and the top checkpoint was buried inside the crater wall.
  Now: every terrace is jump-through one-way (the Cloud Climb rule), the crater
  rim is two thinner slabs floating above any jump's reach, the express vent
  moved under the open throat and fires harder (−1540) so it lands you directly
  ON the top terrace, the checkpoint moved into the open, and the summit
  treasure sits on the right rim beside the star. The beloved mini volcanoes
  are untouched — they just stop launching you into ceilings.
- Five new harness checks actually RIDE the express vent to the top terrace,
  hop up through the one-way terrace, and verify a full jump under the crater
  rim reaches its natural apex (262 checks; the old suite teleported past this
  stretch, which is how the bonk shipped).

## [1.8.1] - 2026-08-16

### Fixed
- Secret Ascent finale, from playtest: the golden star sat right where you hop
  onto the summit, so the party (which freezes the hero in mini-games) started
  instantly and the yeti/chest/candy mountain were unreachable scenery. The
  summit is now just the arrival ledge; a spring at its left end launches you
  over a gap onto a new **treasure terrace** — a ridiculous coin-paved gold
  mountain wearing a crown, coin stacks, loose coins, the giant chest and the
  waving yeti, ~23 collectible candies (plus a heart) to wade through, a
  one-shot gold-rush fanfare + candy fountain on first landing, and the star
  moved to the far end of the hoard so the celebration happens IN the gold.
  Undershooting the gap just drops you back onto the climb — no punishment.

## [1.8.0] - 2026-08-16

### Added
- **Monster Truck: Build Your Truck** — the Rally now opens with the monster truck
  broken: slumped on the dirt with no wheels, an empty engine bay, a drooping
  exhaust, a sad face, and the occasional cough. A sign shows ghost silhouettes of
  the three missing parts (`TruckBuild` + new `MissionToken` skins
  `wheels`/`engine`/`core`): the giant wheels wait on a block pile (easy hops),
  the engine hangs from a crane lowered by a big yellow floor switch (cause and
  effect, no words), and the power core is sealed behind a cracked wall on a high
  ledge (the learned power-smash; a respawning power block waits nearby). Return
  with all three for the assembly ceremony — BOOM wheels, clunk engine, bzzt
  lights — VROOOOOM, and the race begins exactly as before. Parts survive death;
  any collection order works.
- **Secret Volcano Escape** (Lava World) — a glowing cracked volcanic wall before
  the first lava pool hides a vertical climb through the inside of a volcano
  (1600×3000): slowly **rising lava** that pauses whenever it nears the hero,
  backs off at checkpoints and respawns, and only ever costs the lava-pool heart
  + mercy bounce; **steam vents** — timed bouncers that idle, bubble a warning,
  then erupt and launch you sky-high; two rejoining route choices; and a finale
  where a super vent blasts the hero out of the crater onto the sunny rim (golden
  star, candy hoard).
- **Secret Bubble Maze** (Underwater World) — a strange stream of bubbles rises
  from a seaweed-framed sea cave on the seafloor. Inside: five landmark chambers
  (starfish, giant clam, coral garden, treasure vault) connected by **bubble
  currents** (strong directional assistance that never overrides steering), and
  one explicit puzzle: three color-coded bubble valves seal the treasure shaft,
  popped by touching the three matching giant shell switches scattered one per
  chamber. Open them all and the current lifts you straight to the GIANT PEARL.
  No enemies, no timing, no way to die.
- New `SubDoor` styles: `crack` (glowing volcanic fissures) and `bubble`
  (bubble-breathing sea cave) — both leave visual evidence, per the secret-design
  rules now documented in docs.
- One tiny new easter egg, somewhere in the Rally. We don't say where.
- Harness grows to 253 checks: full truck-assembly walk (blocked ride, crane
  switch, sealed pocket, death persistence, ceremony, race regression), volcano
  escape (rising-lava pacing/mercy/reset, vent launch, summit, host-state
  restore), bubble maze (current ride + steering, valve blocking, switch/valve
  matching, pearl finale, host-state restore).

### Changed
- Rally opening rearranged for an enemy-free build zone (first walker removed,
  arrows hint moved to the spawn); Lava World's first walker patrols short of the
  new secret door; underwater weeds/corals now root on the actual ground height
  so they render correctly in the maze's chambers.

## [1.7.1] - 2026-08-16

### Fixed
- **Cloud Climb was impossible to finish** (found by Jack): the rest ledges and
  the summit were solid clouds, so jumping — and especially the final super
  bounce — bonked the hero's head on their undersides. Every cloud in the
  climb is now one-way, and the summit gained real clearance so the last
  bounce sails up through it and lands at the castle. The Secret Ascent summit
  had the same latent bug and got the same fix.
- New end-to-end harness check: ride the final super cloud from the pad all
  the way up onto the summit (no teleporting past the bounce this time).

## [1.7.0] - 2026-08-16

### Added
- **Mini-games & sublevels.** Worlds can now contain doors into smaller
  gameplay spaces. The shared system: `SubDoor` entrances (cloud swirl / cave
  mouth / rainbow ring), string-id levels, `enterSub`/`exitSub` that stash and
  restore the ENTIRE host state (live level object, the Player instance,
  camera, music) so mission progress survives and no sublevel physics can leak
  out, goal-star finales with per-game party headlines, replayable doors, and
  completion persisted in `ffbg_mini` (gold star over a finished door).
- **Cloud Climb** (door on Cloud World's middle island): a pure vertical climb
  through stacked one-way clouds with checkpointed rest-ledges. Three bouncer
  flavors, now visually distinct game-wide: pink = bounce, GOLD STAR = super
  bounce, BLUE ARROW = sideways launch (new `bounceVx` + an airborne momentum
  window). Route choice: the tempting gold spring loops back; the blue arrow
  is the way on. Summit: cloud castle + golden star; a snoozing cloud-kitten
  hides off-route.
- **Mountain Secret Ascent** (sparkling cave mouth at the end of the cave-roof
  route): a hidden diagonal climb of rock terraces marching up-and-right, with
  a cliff spring, a route choice whose dead-end nook hides a peeking baby dino,
  and a cracked-wall/power-block reprise. Summit: giant golden chest, candy
  mountain, and a huge waving yeti.
- **Unicorn Sky Flight** (rainbow ring in Unicorn Forest): a new flight model —
  HOLD Up to rise, release to drift down, steer with Left/Right — through a
  tall sky of cloud bars, balloons, and route choices, collecting rainbow
  stars into a wordless five-star tally (reaching THE MOON always succeeds;
  all five earns a bigger celebration). A sixth secret star floats beside a
  spider drifting on a balloon.
- 27 new harness checks: all three entrances, vertical/diagonal cameras,
  one-way climb-through, super vs normal vs side bounces, flight rise/fall/
  steer, star collection, summits, persistence, host-state restoration
  (mission progress intact after a sublevel), door re-entry protection, and a
  flight-physics-leak regression (215 checks total).

## [1.6.3] - 2026-08-16

### Fixed
- **Floating platforms are now one-way by default, game-wide.** Thin platforms
  used to be a mix: some one-way, some solid — visually identical, but the
  solid ones blocked walking underneath (like the Mountain ledge that trapped
  candy under it and shoved players around). `addPlat` now makes every thin
  floating platform one-way (walk beneath freely, jump up through, land on
  top) across Meadow, Underwater, Cloud, Mountain, Lava, and the Jungle. Thick
  structural slabs (h ≥ 60, e.g. Cloud World's islands) stay solid, and
  `opts.solid` can force it. Spring pads are one-way too — mounting them from
  above now never bonks your head on the underside.
- Harness: walk-under-the-ledge and jump-up-through regression checks
  ( checks total). Also caught and fixed a test bug where the harness
  player spawned on the respawning power block and silently super-smashed
  walls across the level.

## [1.6.2] - 2026-08-16

### Fixed
- **Mountain: the spring bounce now chains somewhere.** Added a halfway
  one-way stepping-stone between the spring and the cave roof, so after the
  bounce Jack can hop rightward onto the ledge above the treasure-chest cave,
  follow a candy trail across the roof, and drop back to the path at the far
  end — no more nearly-impossible drift-jump to continue rightward from the
  spring. (The spring itself stays put, keeping the ground path clear.)
- Harness: stepping-stone landing, roof crossing, and path-rejoin checks
  ( checks total).

## [1.6.1] - 2026-08-16

Playtest fixes from Jack's Mountain run.

### Fixed
- **The spring pad no longer ambushes ground travel.** It used to sit on the
  walking path, flinging anyone heading for the cave. It now sits on a raised
  one-way platform above head height on the tier-3 straightaway: walking
  underneath never touches it, and hopping onto it is a deliberate choice —
  the bounce carries you straight up through the relocated sky-high fire
  crystal (with instant boing-retry if you miss).
- **The mission can no longer soft-lock.** Both Mountain power blocks now
  respawn (~3 seconds after super mode runs out, reusing the boss-pickup
  respawner), so the cracked-wall crystal is always reachable even if the
  power block was spent elsewhere first.
- The power hint sign moved next to the cracked wall it explains (it had ended
  up hovering over the spring, implying the wrong thing), and the respawning
  power block moved clear of the spider patrol.
- Harness: walk-under-never-bounces and power-block-respawn regression checks
  ( checks total).

## [1.6.0] - 2026-08-16

### Added
- **Dino Jungle boss: the GIANT SPINOSAURUS.** Passing through the opened
  Ancient Gate now triggers a boss fight in the Secret Dino Valley (same shared
  boss slot and interface as the Zombie and King Magma). Vine-covered rocks
  seal the valley on BOTH sides; the golden star waits beyond.
  - Intro cutscene: he stomps in shaking the ground, ROARS with his sail
    flaring... then hiccups.
  - Stage 1 (❄️ ice ×3): he chases and breathes boss-sized fire — cheeks and
    sail glow during the inhale telegraph, and the flame hugs the ground so
    jumping clears it. Each ice hit douses the wind-up with a steam-fizzle.
  - Stage 2 (🔥 fire ×3): flames doused, he throws a stompy tantrum; fireballs
    give him the hiccups — his own medicine.
  - Stage 3 (🌈 rainbow): the transformation. He becomes a friend, gets a
    flower behind his ear, the valley walls crumble, and from then on he
    breathes CONFETTI. He dances at the valley party.
  - Wrong powers show the icon hint bubble (fire in stage 1 just feeds him);
    deaths respawn inside the sealed arena; boss hearts shown as always.
- 11 harness checks: intro trigger, stage plan, arena sealing, flame damage +
  jumpable-low flame, wrong-power hint, in-arena respawn, all three stages,
  befriending, wall crumble, and the star gated behind friendship.

## [1.5.0] - 2026-08-16

Both adventure missions redesigned from trivial walk-through sequences into
small genuine adventures: **distributed collection puzzles**.

### Changed
- **New pattern (both missions):** discover the gate → find the Shrine showing
  three empty ghost-silhouette sockets → explore and collect three scattered
  tokens in ANY order → return → ceremony (tokens fly into sockets one at a
  time, shrine shakes, chest opens) → mission key appears → carry it to the
  gate. Difficulty comes from *reaching* things, never logic: token 1 is an
  easy visible grab, token 2 is high overhead (a bouncer launches you), token 3
  sits behind a mechanic learned earlier.
- **Mountain:** the cave now holds the crystal Shrine. Ice crystal on a block
  pile at the cave mouth; fire crystal on a high ledge via a spring-block
  launch; power crystal sealed in a pocket behind a cracked wall (power-smash
  it — the pocket's far side is solid rock so it can't be sneaked into, a
  bypass caught during testing).
- **Jungle:** the terrace holds the Dinosaur Nest Shrine (vine-wrapped chest,
  three nest bowls). Egg 1 on a low leaf platform; egg 2 in the canopy via a
  giant bouncy mushroom; egg 3 bobbing in the shrine guard's flame path (time
  the fire — or freeze/befriend the guard). The ceremony includes a one-second
  gag: a placed egg cracks and a baby eye peeks out.
- Wordless progress: after each pickup a toast pops over the hero — three
  icons, collected ones bright with a star. Collected tokens survive death and
  checkpoint respawns.

### Added
- Reusable **Bouncer** upgrade: any bouncy solid now takes `bounceVy` (default
  −980 ≈ 2× jump; mission ledges use −1150 ≈ 3×) with theme-automatic skins
  (spring block / giant pink mushroom).
- `MissionToken`, `Shrine`, `CollectionPuzzle` in the mission kit
  (`SequencePuzzle`/`PuzzleSwitch` retired with their sequence puzzles).

## [1.4.0] - 2026-08-16

### Added
- **World 10: DINO JUNGLE** — a full new bonus biome, unlocked by the Space Maze
  star (party chain now 5→…→9→10→title; Digit 0 on the title jumps to it).
  - Lush prehistoric jungle theme (`jungle`): parallax canopy, swaying vines,
    mist, giant ferns/flowers/mushrooms, dino footprints, a sleepy smoking
    volcano, and a Secret Dino Valley with waterfall, rainbow, and giant
    flowers behind the gate. New jungle song and `inhale`/`grind` sfx.
  - **`FireBreather`** — new reusable enemy/hazard (`kind='firedino'`, lives in
    `lv.spiders`): deterministic idle → cheek-puffing inhale telegraph → low
    ground-hugging flame that is jumped over, not fought. One heart + gentle
    shove on contact; ice pauses it, rainbow befriends it, fire makes it burp.
    Four escalating encounters, including a staggered pair and a shrine guard.
  - **Dino Key mission** — the Mountain mission kit reused via configuration:
    `MissionGate` theme `'jungle'` (mossy stone gate, dino carvings, statues,
    grind sfx, rising slab, leafy celebration), egg-skinned `PuzzleSwitch`es
    (three giant spotted eggs on pedestals; the last correct egg hatches a baby
    dino), a carved stone clue tablet, and `MissionItem` kind `'dinokey'` (green
    dino-head key with an amber gem).
  - Friendly dinosaurs: two long-necks that lean toward the hero and blow
    hearts, a wandering flower-sniffing baby triceratops that hops when you
    approach, and a goofy stomping T-Rex that roars… then sneezes.
  - Title screen now shows ten medallions (row recentered, arrow keycaps moved
    outward); unlock-all combo opens all ten; `ffbg_unlocked` range is 1–10.
- 25 new harness checks: full jungle mission flow, fire-breather telegraph/
  hitbox/jump-clearance/freeze/befriend behavior, egg puzzle edge cases,
  death-with-key, gate persistence, valley finale, and a jungle soak test.

## [1.3.0] - 2026-08-16

### Added
- **Adventure mission system** — a small reusable framework in `js/entities.js`:
  `Mission` (lifecycle `'puzzle' → 'reward' → 'carrying' → 'done'`), `MissionGate`
  (blocks the path, hints its need visually, unlocks when the item arrives),
  `MissionItem` (floats behind the player once acquired — a wordless "I have it"),
  `PuzzleSwitch` + `SequencePuzzle` (step-on plates, shown order, funny harmless
  resets). Gates only care that the mission reaches `'carrying'`, so future
  missions can earn their item any other way (other puzzles, rhythm pads, favors).
- **Mountain World: the Golden Key Door.** A big wooden door with googly eyes and
  a golden keyhole blocks the path between the smashable wall and the star gate;
  bumping it shakes it (CLUNK) and pops a key thought-bubble. The old spider cave
  is now an enemy-free puzzle chamber: three floor plates (🔥 ❄️ ⭐) under a
  hanging sign showing the order. Right steps ding and light up; wrong steps
  boing and wobble everything, then reset instantly — no damage, no respawn,
  unlimited tries. Solving drops a treasure chest that opens into a huge golden
  key; the key follows the hero (and survives death/respawn) until the door
  notices it, pulls it into the lock, and swings open for good — confetti,
  fanfare, and a candy waiting inside the doorway.
- `drawKey` helper in `js/util.js` (item, keyhole, hint bubble all share it).
- 17 harness checks covering the full mission flow and its edge cases (blocked
  door, wrong/repeat switch presses, streak reset, chest/key reveal, follow
  behavior, death with key, unlock, stay-open, level still completable).

### Changed
- Mountain World enemy placement: hang spiders moved from the cave (now the
  puzzle chamber) to under the high ledge; the chamber-side jump spider became a
  short-range walker parked outside the cave mouth so nothing can chase the
  player into the puzzle.

## [1.2.0] - 2026-08-16

### Added
- Secret title-screen keyboard combos (physical keyboard only — touch-synthesized
  presses are excluded via the new `justK` map, so a child mashing touch buttons
  can never trigger them):
  - **Up ×5 quickly** → unlock all nine worlds ("ALL WORLDS OPEN!", fanfare,
    confetti over the medallions)
  - **Down ×5 quickly** → clear all saved progress (`ffbg_unlocked`, `ffbg_char`,
    `ffbg_royal`) and reset to a brand-new game ("BRAND NEW GAME!")
  - Presses must be ≤1.2 s apart to count as a streak.
- Four harness checks: both combos, streak expiry, and touch-press immunity.

## [1.1.0] - 2026-08-16

Renamed the game: **Block Buddies: The Adventures of Jack-Jack and Becca**
(formerly "Funny Face Block Game").

### Changed
- Title screen: new title and subtitle; the hero portraits are now labeled
  with the heroes' names, JACK-JACK and BECCA.
- Page title, PWA manifest (`name`, `short_name` "Block Buddies", refreshed
  nine-world description), docs, README, and CLAUDE.md all renamed.
- Internal identifiers intentionally unchanged (`ffbg_*` localStorage keys,
  `ffbg-v1` service-worker cache) so saved progress survives the rename.

## [1.0.0] - 2026-08-16

First versioned release — the complete nine-world game, now with public developer/agent
documentation at `/docs`.

### Added
- `GAME_VERSION` constant (`js/util.js`) rendered as a tiny stamp on the title screen
  (doubles as a live-deploy check).
- `docs/index.html` — full developer & agent documentation: architecture, core systems,
  all nine levels (biome / enemies / objectives / new mechanics / cameos), progression,
  testing, and collaboration workflow. Served at
  <https://polarispixels.github.io/block-buddies/docs/>.
- This changelog, SEMVER policy, and harness checks that version, changelog, and docs
  stay in sync.
- `README.md` repo landing page.

### Pre-1.0 history (unversioned commits)

- **Initial release** — zero-build canvas platformer: worlds 1–5 (Block Meadow,
  Underwater World, Cloud World, Mountain World, Zombie Cave with the three-stage
  ZOMBIE boss and Golden Candy Treasure ending), fire/ice/rainbow/power blocks,
  touch controls, PWA install support, procedural art and audio throughout.
- **Fix** — boss-fight death respawn stranding the player outside the sealed arena wall.
- **Level 6: Lava World** — exploding spider ignition chains, lava pools, KING MAGMA boss,
  Candy Volcano eruption ending.
- **Title screen** — playable girl character and a visible nine-medallion level picker.
- **Level 7: Monster Truck Rally** — truck vehicle, ramps with auto backflips, turbo pad,
  dirt tornadoes, grandstand finish and Candy Trophy.
- **Level 8: Unicorn Forest** — unicorn flight, horn rainbows, centipedes, castle
  coronation with a permanent crown.
- **Fix** — unicorn rainbow shots sailing over centipedes.
- **Level 9: Space Maze** — weightless movement, BFS-verified 44×19 maze, alien saucers,
  golden star / MAZE MASTER finale.
- **Tooling** — in-repo test harness (`test/harness.js`) and screenshot tool
  (`tools/screenshot.sh`), long-term project documentation in `CLAUDE.md`.
