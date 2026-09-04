# Alien Space Station (Space 8-2) — design

Ryan's spec, 2026-09-04. Backlog #4. The HOW.

## Identity + progression

- Level id `'space2'`, name **THE ALIEN SPACE STATION 8-2**, theme `space`
  (dark bg; the station paints itself), `lv.dark = true`.
- **World 9 becomes a chain** `9: [9, 'space2']`. The Space Maze's golden
  star keeps its alien party (`mazeWin`) but no longer unlocks world 10;
  Space after that party now records stage progress and starts `'space2'`
  (`game.advanceStage`). The station's escape-pod finale is
  `game.worldWin(9)`: unlocks Dino Jungle, full party, Space → world 10.
  Title resume (`ffbg_stage`) works as for every chain.
- **Dino Jungle continuity**: the crashed pod is drawn near the start of
  world 10 (`lv.decor.crashedPod = { x: 180 }`).

## Files

- `js/stationart.js` (`ST_ART`: alien spiders incl. the boss, eyes, web
  glob + web wrap, escape pod, crashed pod, the escape cinematic frames).
- `js/stationscene.js` (`ST_SCENE`: station walls/floors/decor, the
  battery + socket + cable kit, every machine).
- `js/station.js`: the reusable **PowerGrid kit** (`Battery`, `Socket`,
  machine classes) + `AlienSpider` + `GiantSpider` + the `AlienStation`
  machine on `lv.puzzle` (lighting director, acts, ambushes, boss, escape).
- game.js: darkness reads `lv.darkAlpha` / `lv.playerLight`; a
  `lv.puzzle.drawFront` hook after the darkness (glowing eyes); `lv.gravK`
  gravity multiplier in the on-foot branch (entities.js); `pl.webT` web-
  trap slow (entities.js); cutscenes `stationboss`, `escape` delegate to
  the machine; party text; `advanceStage`.
- levels.js: LEVEL_META, WORLD_STAGES, the `'space2'` builder, theme
  hooks, the jungle's crashed pod.

## Geometry (lv.w 11600, lv.h 1500)

Lower deck **G = 1400**, upper deck **U = 950** (platform tops).

1. **ACT 1 — The Black Hallway** x 0–4200 (floor G, ceiling at G-300 with
   gaps = ceiling openings). Steps of ≤52 px up and down (auto step-up), a
   bend (floor climbs 150 via three steps at 1500–1800 and drops back at
   2600), side alcoves (ceiling gaps with a ledge and a candy), vents on the
   walls, broken doors, abandoned equipment silhouettes, a dead end alcove at
   3300 with candy. Lighting: `darkAlpha` 0.97 → 0.86 across the act,
   `playerLight` 150 → 240. Lights: faint red emergency lights (pulse),
   flickering ceiling lights (on 0.3 s in every ~2.5 s), tiny glyphs,
   sparks (particles) at broken machinery, a lit doorway at 4200.
   Ambushes: `AlienSpider` kinds `drop` (eyes only in a ceiling gap until
   the hero is within 170 px, then drops with a `squawk`), `vent` (pops out
   of a wall vent), `crawl` (patrols), a `shooter` at 3900 (web globs).
   Fire power: a `fire` pickup at 120 with `bossKind='fire'` (respawns) and
   more at 1400, 2800, 3800, 5200, 6600, 8000, 9300 — shooting is the
   language, never runs out.
2. **ACT 2 — Webbed interior** x 4200–7600. Lighting 0.86 → 0.6, light 240 →
   320, webs, goo, broken robots, pods, panels, glowing pipes.
   - **Battery 1** on the floor at 4500. **Socket S1** in the doorway wall
     of **blast door D1** (4900; reachable from both sides). Insert → D1
     opens (cable pulses). Past it the hero needs the battery again:
     pull it out (Space at the socket) — D1 slams behind (harmless).
   - **S2 elevator** (5500): a car that rides G ↔ U while powered; ride it
     up (it carries the hero). Upper deck: **S3 vending machine** (5900,
     funny: spits candy while powered, 6 max), **Battery 2** already
     socketed in **S4 hologram** (6300: a giant alien face hums; pull the
     battery → face fizzles with a raspberry). **S5 blast door D2** (7400,
     upper deck) → Act 3. Battery 1 may stay in the elevator.
3. **ACT 3 — Bright machine rooms** x 7600–9200 (upper deck continues,
   then a tall room). Lighting 0.6 → 0.15 as machines are powered (each
   powered machine also subtracts 0.06), light 320 → 520, neon everything.
   - **Gravity room** (7700–8600, floor U, exit ledge at U-420): **S6
     gravity machine** at 7850: while powered `lv.gravK = 0.32` (float
     jumps); the hero reaches the ledge. **Battery 3** sits in **S7 high-
     five hand** (8000, funny: the hand slaps the hero with a `boing` hop
     every 2 s while powered; pull it out).
   - Ledge: **S8 bridge machine** (8700): three plates slide out across the
     gap (8800–9150) while powered; cross; leaving the battery there is
     fine (the arena has its own).
4. **BOSS ARENA** x 9200–10600 (floor U-420 → call it A = 530; sealed by a
   wall behind once entered). **Battery 4** on the floor. Three machines
   with sockets: **S9 giant fan** (9350), **S10 laser** (9950), **S11
   magnet** (10450). `GiantSpider` drops from the ceiling (cut
   `stationboss`, 2.4 s), shield ON. Loop: powering any machine starts a
   5 s burst (fan blows the web shield away / laser burns it / magnet
   pulls the armor open) — shield OFF for the burst; the boss is hittable by
   any projectile (hp 6, `dizzy` flinch per hit); at the end the socket
   EJECTS the battery with a pop (overheated, 5 s cooldown, the socket
   smokes) so the next burst needs a battery moved to another machine.
   Meanwhile the boss lifts a spider from its back and throws it every 3.5
   s (cap 3 alive): it flies in an arc, lands (`stun` 0.6 s), then crawls
   and shoots webs. Hero shots pop spiders into candy (small 2 / big 5).
   Defeat: the boss inflates, pops into a **candy storm** — 60 real candy
   pickups rain across the arena plus 5 bursts and confetti, `boom`,
   `fanfare`, `cheer` — and the bay door (10600) opens.
5. **ESCAPE POD BAY** x 10600–11400: the pod; touching it starts cut
   `escape` (machine-drawn fullscreen frames, ~16 s, Space skips after
   3 s): hatch closes → warning lights → violent launch (shake) → space:
   station receding, stars, rocket flame, the green jungle planet grows →
   re-entry glow + shake → the crash in the jungle (smoke, leaves) → Jack
   climbs out → footstep rumbles, trees shake, a huge dino silhouette walks
   past behind, a baby dino peeks and chirps → `game.worldWin(9)`. Party
   text: "ESCAPED!" / "NEXT STOP: DINO JUNGLE!".

## Enemies: AlienSpider (lives in lv.spiders)

Biomechanical: neon cyan/magenta, 3 glowing eyes, antennae, 6 armored
legs, a glowing web gland. Kinds `crawl`, `jump`, `drop`, `vent`, `shooter`,
`thrown` (the boss's). State `angry` while active (contact = 1 heart,
knockback; the existing loop), `lurk` while hidden (eyes only, no harm),
`stun` after a throw landing. `hit(kind)` from any projectile → dead →
candy burst + real candy pickups. Web globs (machine-owned projectiles): a
hit sets `pl.webT = 1.4` → 35% speed, no jump, every Left/Right press
shakes 0.3 s off, a sticky web drawn on the hero; never damage.

## Batteries (the reusable PowerGrid kit)

`Battery` = the follow-item pattern (touch → follows the hero; one at a
time). `Socket` = a floor pedestal with a glowing cavity + a cable
polyline to its machine: while a following battery's hero overlaps the
socket zone it snaps in (`machine.power(true)`, cable pulses, machine
reacts big); Space while overlapping a powered socket ejects it (follows
again, `machine.power(false)`). Machines: `power(on)`, `update`, `draw`,
`lights()`, own solids. Nothing is ever destroyed; every socket is
reachable on foot (elevator/gravity/bridge only gate FORWARD progress and
each has its own battery on the near side). Sockets never accept a battery
during the 5 s arena cooldown (they smoke; a `plop`).

## Lighting director

`lv.darkAlpha` = base by hero x (act curve) − 0.06 × powered machines,
clamped [0.12, 0.97]; `lv.playerLight` by x. `lights()`: emergency lights
(r 90, pulsing), ceiling lights (r 160 when on), glyphs (r 40), batteries
(r 200), powered sockets/cables/machines (r 260–420), goo (r 70), the boss
(r 400), the party. `drawFront`: lurking eyes glow through the dark.

## Audio

Act 1: music off; a `grind`/`clank`/`steam` creak every 4–8 s at low
volume, `squawk` on ambushes. Act 2: `cave`. Act 3: `space`. Boss: `boss`.
Machines: `powerup`/`switch` on, `plop` off, `boom` bursts. Escape:
`launch`, `rumble`, `whoosh`, `thud`, `roar` (distant), `win`.

## Harness (ridden for real)

Maze party → Space → space2 (progress saved, resume works); darkness
values; fire pickup respawns; a drop spider lurks then drops and dies to a
real fireball into candy; a web glob slows the hero and shaking frees him;
battery follow → D1 opens → pull → D1 closes; elevator carries the hero
up; vending spits candy; hologram battery pulled; D2; gravity lowers
`gravK` and a jump reaches the ledge; bridge plates cross; arena seals,
boss shield blocks a shot, a burst opens it, hits land, eject + cooldown,
thrown spiders land and attack, defeat → candy storm (≥60 pickups) → bay
door → pod → escape cut → worldWin(9) → unlocks 10 → Space → world 10 with
the crashed pod in the jungle decor.
