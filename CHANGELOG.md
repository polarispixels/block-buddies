# Changelog

All notable changes to Block Buddies are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/); versioning: [SEMVER](https://semver.org/).

Policy: **MAJOR** = breaks saved progress (`localStorage` keys/format) or the documented
architecture; **MINOR** = new player-visible content (level, vehicle, enemy, power);
**PATCH** = fixes and tuning. Every release bumps `GAME_VERSION` in `js/util.js`, adds an
entry here, updates `docs/index.html`, and gets a git tag `vX.Y.Z`.

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
