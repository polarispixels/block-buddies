# World Map layer — design (Space World is the first instance)

Date: 2026-09-12. Status: shipped as v1.31.0.

## Goal

A reusable, data-driven WORLD MAP screen between the title and a world's
destinations. The title screen is unchanged; picking Space World (displayed
"8", internal n=9) opens a Space star chart instead of launching a stage.
The map lets Jack pick and replay any destination he has unlocked or
discovered, with little or no reading.

Space map destinations: **8-1 Space Maze** (stage), **Zero-G Star Chamber**
(optional), **Planet Blocks** (optional), **8-2 Alien Space Station** (stage,
requires the maze). First visit: only the maze is available. Optional rooms
stay hidden until Jack enters them through their existing doors inside the
maze (which keep working exactly as today).

## Architecture (new file `js/worldmap.js`, loaded after `js/rescue.js`, before `js/levels.js`)

Three layers, mirroring Puzzle Blocks:

1. **Data** — `WORLD_MAPS[w] = { theme, nodes, paths }`.
   Node: `{ id, level, kind: 'stage' | 'optional', x, y, icon, label?, requires?: [ids] }`.
   A stage node is unlocked when every node in `requires` is completed (the
   first stage has none). An optional node is selectable once discovered.
   `paths` are `[idA, idB]` pairs (drawn as dotted lines, lit when both ends
   are selectable). Adding a biome = one `WORLD_MAPS` entry + one
   `MAP_THEMES` entry; the controller never knows about space.
2. **Progress** — `MapProgress`, persisted in ONE new additive localStorage key
   `ffbg_map` = JSON `{ "<w>": { u: [ids], d: [ids], c: [ids], l: id } }`
   (unlocked, discovered, completed, last played). Four separate concepts,
   as the brief requires; "furthest stage" is never forced — the cursor
   starts on `l` and every unlocked node stays selectable.
   - `MapProgress.get(w)` creates + **infers** a world's entry on first sight
     from the existing saves: stage node at chain index `i` is unlocked if
     `i === 0` or `stageProg[w] >= i` or `unlocked > w`; completed if
     `stageProg[w] > i` or `unlocked > w`; an optional node is discovered and
     completed if `miniDone[level]`. `l` defaults to the first stage.
   - Generic hooks by level id (no-ops for levels on no map):
     `MapProgress.onEnter(levelId)` marks discovered (called from
     `game.enterSub` and when launched from a map);
     `MapProgress.onLevelDone(levelId)` marks completed and unlocks every
     stage node whose `requires` are now all complete, queuing the newly
     unlocked ids in `pendingReveal[w]` (called from `mazeWin`, `subWin`,
     `worldWin`, `stageClear`, `advanceStage`, `jungleWin`).
   - `game.resetProgress` removes `ffbg_map`; `unlockAll` leaves maps alone
     (worlds open on the title; each map still starts at its first stage).
3. **Controller** — `class WorldMap` on `game.map`, driven by a new game state
   `'map'` (update/render dispatch next to `'title'`): selection, rocket
   cursor tween, launch, tap, back button, reveal animation; `MAP_THEMES[theme]`
   supplies `drawBG(ctx, t, map)`, `drawNode(ctx, node, st, t)` and
   `music`. `st = { state: 'hidden'|'locked'|'open'|'done', selected, reveal }`.

## Flow

- **Title → map**: `game.startWorld(w)` opens the map when `WORLD_MAPS[w]`
  exists (medallion tap, digit key, Space all route through `startWorld`);
  every other world is unchanged. A direct `game.startLevel(9)` (the Unicorn
  Forest party's chain jump) is NOT map-launched and behaves as today.
- **Launch**: `map.launch(i)` → `MapProgress.setRecent`, `onEnter`,
  `game.mapReturn = w`, `game.startLevel(node.level)` as a FULL level (no
  `subReturn`). `startLevel` leaves `mapReturn` alone; `goTitle` and a
  non-map `startWorld` clear it.
- **Return to map** (`game.returnToMap()`): if the finished level is a stage
  node with a next chain stage, record `stageProg[w] = max(., idx+1)` (keeps
  legacy resume and inference consistent), then `openMap(w)`. Triggers:
  - the party's Space press: `subReturn` → `exitSub` (in-maze rooms return
    into the maze, as today); else `mapReturn` → `returnToMap`; else the
    existing chain rules. `worldWin` still unlocks the next world and resets
    the chain before this runs, so the station's escape pod unlocks Dino
    Jungle on the title and then returns to the map with the station starred.
  - `exitSub` with no `subReturn` and a `mapReturn` (the Planet Blocks exit
    door) → `returnToMap`.
  - the `'stageclear'` state with `mapReturn` → `returnToMap` instead of
    starting the next stage (reusable for future maps; no space stage uses it).
  - Escape (physical keyboard, not fullscreen): in a map-launched level →
    the map; on the map → title; elsewhere → title (unchanged).
  - The **hold-to-return button** (touch): a round map button at
    `TouchUI.mapBtn = { x: 272, y: 44, r: 30 }` (right of the hearts, left of
    the fullscreen button), drawn only when `TouchUI.enabled && game.mapReturn`
    and the state is a level state. Touch-down inside it starts
    `TouchUI.mapHold = { id, t }`; the game advances `t` each frame and at
    1.0 s calls `returnToMap`; touch-up cancels. A ring fills around the
    button as feedback. Harness-facing API: `TouchUI.mapHoldStart(id)`,
    `TouchUI.mapHoldEnd(id)`.
- **Map open**: `game.openMap(w)` builds `new WorldMap(w)`, consumes
  `pendingReveal[w]` (those nodes scale in over 0.7 s with confetti + a
  fanfare, their paths light up), sets `game.state = 'map'`, music from the
  theme, `mapReturn = 0`.

## The map screen (input)

- Left/Right: move the cursor to the previous/next **selectable** node in
  `nodes` order (clamped, `candy` sfx); the rocket tweens to the node.
- Space: launch the selected node.
- Tap (`game.map.tap(p)`, wired in `TouchUI.start` like `titleTap`): the
  back button → title; a selectable node → select + launch; a visibly locked
  node → `boing`; a hidden node → ignored. Any other tap falls through to
  Space (launch selected), matching the title's tap-anywhere convention.
- Escape / the back button → `goTitle`.

## The Space theme (`MAP_THEMES.space`)

- Background: the space sky via `drawBG(ctx, bgLv, {x:0,y:0}, t)` with
  `bgLv = newLevel(9)` built once (starfield, nebula, the decorative planets,
  shooting stars) plus a small world icon (`drawLevelIcon` 'space') top-centre.
- Nodes (all procedural, faces on everything): `maze` = a blue-gray asteroid
  with a maze-line pattern; `station` = the saucer-shaped station with lit
  windows and an antenna; `asteroid` = the cracked asteroid with gold
  sparkles (the Zero-G door); `planet` = `PL_ART.planet` ringed skin.
  States: `locked` = gray silhouette + padlock; `hidden` = a faint twinkling
  "?" nebula at the node position (something is there, nothing is spoiled);
  `open` = full colour; `done` = full colour + gold star badge; `selected` =
  pulsing gold ring + the bobbing spacebar hint below. Stage labels ("8-1",
  "8-2") sit under stage nodes.
- Cursor: a small `PL_ART.rocket` (s≈90) hovering above the selected node
  with the hero's head (`drawHead`) in its window, flame on while tweening.
- Paths: dotted lines, lit when both ends selectable, dim otherwise.
- Back button: top-left round button with a left-arrow glyph.

Positions (1280×720): maze (250, 470), zerog (470, 250), planets (700, 520),
station (1010, 300). Paths: maze–zerog, maze–planets, maze–station.

## Testing (harness; real input where it matters)

1. Title: digit 8 opens the map for world 9 (`state === 'map'`,
   `game.map.w === 9`); digit 0 still starts level 1; `startWorld(1)` unchanged.
2. Fresh progress (`resetProgress` clears `ffbg_map`): maze selectable, station
   visible-locked, zerog/planets hidden; cursor on maze.
3. Space launches the maze as a full level with `mapReturn === 9` and no
   `subReturn`; `l === 'maze'`.
4. Reaching the maze star, party, Space → back on the map with the station
   unlocked, maze completed, `stageProg[9] === 1`, the reveal queue consumed.
5. Right arrow skips hidden nodes to the station; Space starts `'space2'`.
6. Escape in a map-launched level → map; Escape on the map → title.
7. In-maze doors: from a map-launched maze, the asteroid door still enters
   Zero-G via `enterSub` (zerog discovered), its star's party Space returns
   INTO the maze (`subReturn` precedence); the planet hatch enters Planet
   Blocks (planets discovered), its exit door returns into the maze.
8. Map-launched Zero-G: party Space → map with zerog completed (star);
   map-launched Planet Blocks: exit door → map.
9. Hold button: `mapHoldStart` + 30 frames → still in the level; + 40 more →
   map; start then `mapHoldEnd` after 10 frames → never leaves.
10. Inference from legacy saves (no `ffbg_map`): `ffbg_stage` "9:1" → station
    unlocked + maze completed; `ffbg_unlocked` 10 → station completed;
    `ffbg_mini` with zerog → discovered + completed; planets stay hidden.
11. `ffbg_map` round-trips through `MapProgress.load()`; `resetProgress`
    removes it.
12. A direct `startLevel(9)` maze party still advances to `'space2'` (the
    existing chain check stays green) and marks the maze completed on the map.
13. Tap paths: tapping the station while locked → `boing`, state stays map;
    tapping the maze → launches; tapping the back button → title.

Screenshots: fresh map, map after the maze (station revealed), full map
with everything discovered and starred; a map-launched level showing the
hold button ring.

## Release

v1.31.0 (MINOR). CHANGELOG, docs/index.html (architecture row, a "World Map"
systems section, the Space Maze world section), BACKLOG (new item 23 ✅ +
a note that other biomes can now define maps), CLAUDE.md (architecture row,
persistence key, title/flow notes), sw.js precache, harness script list,
screenshot.sh, tag, push, verify live.
