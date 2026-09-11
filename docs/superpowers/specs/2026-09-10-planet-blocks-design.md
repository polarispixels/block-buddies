# Planet Blocks — design (Puzzle Blocks mode #5, the first COMPARISON mode)

Date: 2026-09-10. Status: approved in chat, building as v1.30.0.

Jack asked for the next learning module to be "in the space area" and, when
asked what space thing, said **planets**. This is that room.

## What it is

PLANET BLOCKS is Puzzle Blocks mode #5 and the first mode on the spec's
*reasoning* rung (family C5 "which is biggest / more / fewer" plus the D-family
size idea): a single-screen space room in the shape of the counting room —
three bonkable answers, one candy per solve, endless replay with an invisible
per-visit difficulty ladder, an always-open exit door, no enemies, no damage.

A friendly ROCKET sits on a launch pad at the top of the room. Its thought
bubble shows which planet it wants to visit. Three planets with faces hover
over the pad. Jack bumps the planet that matches the bubble; that planet flies
up into the bubble, the rocket blasts off in a puff of candy, and three new
planets drift in.

Success metric, as always: Jack immediately understands it and wants to play
again.

## The planets ARE the blocks (one small generic engine extension)

Today `PuzzleBlocksMachine` owns three fixed 84×84 answer solids and draws a
blue tile with the mode's `drawChoice` inside. Size comparison inside an 84px
tile would need an indirection (big planets up top, tiny match-me planets in
the tiles). Instead the engine gains two **opt-in** hooks, both ignored by the
four shipped modes:

- `mode.blockSize(value) -> {w, h}` — called from `nextPuzzle()` for each
  slot; the engine resizes that slot's solid with the **underside pinned at
  `G-190`** (bonkable from the ground, exactly where the tiles are today) and
  the box centred on the slot x. Absent = 84×84.
- `mode.drawBlock(ctx, value, x, y, w, h, info)` — replaces the blue tile AND
  the choice drawing for that slot; `info = {wobble, dim, idx}` so the mode
  can wobble/dim exactly as the engine would. Absent = today's tile + choice.

The fly animation keeps using `drawChoice` (a planet shrinking into the
bubble). Everything else — pool shuffle, lock/cooldown, wobble on a wrong
bump, fly/hold, `onCorrect`, `holdTime` — is untouched. Any future mode whose
answers are *objects* (shapes, animals, toys) can reuse the hooks.

Solids are plain objects in `lv.solids`; mutating `x/y/w/h` in place is safe
(the level pushes the same three objects once at build time).

## Rounds

Rounds are generated, not authored (like counting). Each round has a `kind`:

| kind | the bubble asks | the three planets |
|---|---|---|
| `biggest` | BIGGEST | three sizes, equal moons (none) |
| `smallest` | SMALLEST | three sizes, no moons |
| `most` | MOST MOONS | equal size (96px), 1–7 moons each in an arc above |
| `fewest` | FEWEST MOONS | equal size, moons as above |

Choice values are the slot's **planet descriptor index** (0/1/2, primitives —
the engine compares with `===`); the mode keeps a `cur.planets[3]` table of
`{size, moons, skin}`. Size rounds always use three *distinct* sizes; moon
rounds three *distinct* counts, so there is exactly one honest answer.

Planet skins (`PL_SKINS`, six): distinct hue + ring/stripe/crater variant +
face. A round draws three different skins so "the red one" is always a valid
way for a five-year-old to think about it. Skins never correlate with the
answer.

### The invisible ladder (per visit; a new machine per entry)

| rounds | kinds | sizes (px diameter) | moon counts |
|---|---|---|---|
| 1–2 | biggest | far apart: pick 3 of {64, 96, 140} | — |
| 3–4 | biggest, then smallest | closer: 3 of {72, 96, 120, 140} with min gap 20 | — |
| 5–6 | most | — | far apart: three counts with min gap 2 from 1–7 |
| 7+ | random of all four | moderate: min gap 18 from {64…140} | close: min gap 1 from 1–7 (e.g. 4/5/6), never the same trio twice in a row |

Never the same kind three times in a row from round 7 on (so the bubble keeps
mattering). Sizes are never within 12px of each other (no trick-the-eye
rounds; the challenge is comparing, never squinting).

### Prompt cue (no reading required)

The rocket's thought bubble holds the question word (BIGGEST / SMALLEST /
MOST MOONS / FEWEST MOONS, drawn like the other rooms' prompt text) **and** a
pictogram in one fixed convention: three gray silhouette planets, the wanted
one drawn gold with a small star over it.

- biggest: small / medium / big silhouettes, big one gold
- smallest: same, small one gold
- most moons: three equal silhouettes with 1 / 2 / 3 dots above, the 3-dot one gold
- fewest moons: same, the 1-dot one gold

Once "the gold one is the one the rocket wants" is learned, no reading is
needed. The bubble is the `flyTarget` (the winning planet shrinks into it).

### Feedback

- Wrong bump: the planet wobbles (engine) with the `plop` sfx; its face goes
  `'surprised'` for the wobble duration. Nothing else changes.
- Correct bump: sparkle burst (engine), the planet flies into the bubble
  (0.6s), then `hold` (1.1s): the bubble shows the planet with a green ring,
  the rocket blasts off (flame + smoke particles, rises out of frame,
  `whoosh` sfx), candy +1 through the normal economy. Every fifth solve throws
  the counting room's bonus party (+2 candy, star banner, confetti). A fresh
  rocket is sitting on the pad when the next round starts.

## The room ('planetblocks', PLANET BLOCKS)

- `LEVEL_META.planetblocks = { name: 'PLANET BLOCKS', theme: 'space', music: 'space' }`
- 1280×720, ground `G = 620`, **gravity on** (`lv.space = false`, `lv.water = false`)
  so the on-foot bonk branch fires. `playerStart` (90, G-94), a checkpoint at
  120, `ExitDoor` at 1150, no spiders.
- Floor is the space theme's ground; decor: a humming **gravity generator**
  (reuse `ST_SCENE.gravityMachine`, `on = 1`) at the far left to explain why
  there is gravity, the launch pad + rocket top-centre, the star field from
  the space `drawBG`. Planets are drawn by the machine (`lv.puzzle.draw`) so
  they layer above the pad.
- Door: a press-gated `SubDoor` style `'planet'` (a ringed-planet hatch with
  a face; sparkle colours purple/gold) on the **floor of the Space Maze's
  start pocket** at `(430, 18*CELL)` — the same pocket as the Zero-G asteroid
  crack (x=180), well separated. `{ press: true }` with the bobbing spacebar
  hint like the other learning doors. The maze stays weightless; the room has
  gravity.
- No win state and no `miniDone` flag (like the letter/counting rooms):
  re-entry rebuilds a fresh machine at the bottom of the ladder.

## Art (all procedural, contact-sheet reviewed)

- `PL_ART.planet(ctx, cx, cy, d, skin, mood, t)` — six skins: ringed (tilted
  ellipse ring drawn behind+in front), striped gas giant, cratered, swirly,
  banded with a polar cap, plain bright — each with `drawFace`. Must read at
  64, 96 and 140px.
- `PL_ART.moon(ctx, x, y, d)` — small gray cratered ball (24px).
- `PL_ART.rocket(ctx, cx, baseY, s, t, flame)` — red/white rocket with a
  round window and a face, fins, optional flame + smoke.
- `PL_ART.pad(ctx, cx, y, w)` — launch pad with blinking lights.
- `PL_ART.cue(ctx, cx, cy, kind)` — the four pictograms.
- The `'planet'` door skin.
- Contact sheet: every skin at the three sizes, the moon arc at 1 and 7,
  the four cues, the rocket idle/blasting, the door — reviewed at in-game
  size before shipping (the rule that caught the four-eyed frog).

## Testing (harness, all real-input where it matters)

1. The maze start pocket has a press-gated `'planet'` door; walking (swimming)
   over it never auto-enters; standing on it + Space enters `'planetblocks'`.
2. The room: 1280 wide, gravity on (player falls to the floor), one exit
   door, no spiders, `lv.puzzle instanceof PlanetBlocksMachine`.
3. Round 1 is `biggest` with three distinct sizes and three distinct skins;
   the correct slot's solid is the widest; every solid's underside is exactly
   `G-190` and no two solids overlap.
4. A **real jump** from the floor into a wrong planet wobbles it, pays no
   candy, leaves state `'idle'`.
5. A real jump into the correct planet on the WIDEST (140) and the NARROWEST
   (64) planet both lock the round (`state !== 'idle'`) — the narrow one is
   the hitbox-generosity check.
6. After fly+hold: candy +1 exactly once, a new round with different planets.
7. Driving the machine through 12 rounds (via `onAnswer` on the correct
   slot): the ladder yields `biggest` for rounds 1–2, `smallest` appears by
   round 4, `most` for 5–6, all four kinds appear by round 12; every round
   has exactly one slot equal to `answer`; moon rounds have distinct counts
   and equal sizes; size rounds have distinct sizes with gaps ≥ 12.
8. The fifth solve pays the +2 bonus party; the engine's four existing modes
   still report default 84×84 solids (the hooks are opt-in).
9. Exit door returns to the maze with `lv.puzzle === null`, no `miniDone`
   flag; re-entry starts the ladder over.
10. `drawBlock`/`blockSize` fallbacks: a machine with no hooks draws the tile
    path (existing count/letter checks cover this).

Screenshots: round 1 (biggest), a moons round, the contact sheet, the door
in the maze.

## Release

v1.30.0 (MINOR: new room). CHANGELOG entry, docs/index.html (architecture
row for `js/puzzleblocks.js`, a Planet Blocks section, badge), BACKLOG status
board (new item 22, ✅), CLAUDE.md table rows (world 9 gimmick, puzzleblocks
row, sublevel id list), tag `v1.30.0`, push, verify live.
