# Block Buddies v1.18.0 — Letter Blocks Framework + First Mini-Game (spec, verbatim from Ryan)

## Objective

Build a reusable Letter Blocks mini-game framework inside Block Buddies, then implement the first instance in Block Meadow.

The first game teaches missing first letters using simple picture words.

Example:

- Show a picture of a cat
- Show "_AT"
- Present three physical answer blocks: "B", "C", "H"
- Player jumps and bumps the "C" block
- "C" flies into the blank
- Word becomes "CAT"
- Candy is awarded
- Next puzzle loads
- Player may continue indefinitely or leave through an exit door

The experience should feel like a Block Buddies secret room, not like educational software pasted into the game.

---

## Product Philosophy

Letter Blocks should become a reusable educational mini-game system, not a one-off level.

The core interaction model is:

Prompt → physical answer choices → player selects by gameplay action → satisfying confirmation → reward → next puzzle

The framework should eventually support variations such as:

- missing first letter
- missing last letter
- picture-to-word matching
- beginning sounds
- word families
- rhyming
- simple vocabulary
- counting
- simple arithmetic
- colors
- shapes
- sequencing

Do not build all of these now.

Build the architecture so future mini-games can reuse the same basic system with different content and puzzle rules.

Prefer configuration/data-driven content over hard-coded puzzle-specific logic where practical.

Keep the framework simple. Do not over-engineer it.

---

## First Instance

### Name

Letter Blocks: Beginning Letters

### Location

Place the first Letter Blocks room in Block Meadow.

It should be a replayable secret/sublevel using the existing Block Buddies sublevel architecture where appropriate.

The visual theme should feel like a small magical Block Meadow learning garden or block chamber.

Avoid making it look like a literal school classroom.

---

## Core Gameplay

The player enters the room and sees:

1. A large subject image
2. The corresponding word with the first letter missing
3. Three large answer blocks
4. A visible EXIT door

The player moves normally and jumps beneath one of the answer blocks. The answer is selected by bumping the underside of the block with the player's head. Use the existing movement and collision conventions whenever possible.

### Correct Answer Behavior

1. Lock additional answers temporarily.
2. Give clear positive visual/audio feedback.
3. Animate the selected letter traveling from the answer block into the blank.
4. Display the completed word briefly.
5. Spawn or award candy, incrementing the player's existing candy counter using the normal game economy/state.
6. After a short delay, load the next puzzle.
7. Randomize the answer block positions again.

The interaction should feel physical and satisfying. The flying-letter animation is an important part of the feature.

### Wrong Answer Behavior

Wobble/bounce/shake the block, play a mild incorrect sound, keep the puzzle active, allow immediate retry. Do NOT remove candy, damage the player, reset the room, or end the mini-game.

### Continuous Play

No required number of rounds. After each correct answer, automatically generate another puzzle. A clearly visible EXIT door remains available throughout; walking through it returns to Block Meadow via normal sublevel return behavior. Do not force completion before exiting.

### Puzzle Selection

Shuffle the word pool, work through it before repeating, reshuffle on exhaustion, never repeat the same word twice in a row, and randomize which answer choice sits on which block each round.

### Initial Word Bank

cat, dog, pig, fox, bug, fish, bird, frog, duck, bear, ball, book, bed, cup, hat, car, sun, moon, tree, apple — each needs a canonical word, a missing-first-letter display form, the correct letter, an image, and incorrect answer candidates.

### Distractor Philosophy

Wrong answers should generally be plausible letters, not purely random alphabet characters, and some word families should intentionally overlap (e.g. `_AT`: cat, hat) — the image is what disambiguates.

### Image Requirements

Every prompt needs a simple, unmistakable image: large, minimal clutter, no ambiguous subjects (e.g. a sofa/couch is a poor choice).

### Visual Layout

Top/center: large picture + missing-letter word. Ground level: three answer blocks spaced far enough apart to jump beneath individually. Side of room: EXIT door. Blocks should look like native Block Buddies objects, not HTML quiz buttons, with large readable uppercase letters.

---

## Framework Architecture

Reusable concepts:

- **Puzzle definition** — prompt content, image, expected answer, answer options, optional metadata.
- **Puzzle controller** — selects next puzzle, shuffles, generates answer choices, tracks state, handles correct/incorrect selection, prevents double-triggering during transitions, advances to the next puzzle.
- **Physical answer objects** — expose a generic answer-selection mechanism; the puzzle controller (not the block) determines correctness. Avoid embedding word-specific logic in individual blocks.
- **Reward hook** — a puzzle/mini-game configuration can define rewards; for this instance, 1 solved puzzle = 1 candy via the existing candy/state system.
- **Prompt renderer** — supports different future prompt formats (for now: image + word-with-missing-first-character), without being so rigid a future mode requires replacing the whole system.

---

## Future Expansion (not built now, architecture must stay compatible)

Block Meadow (beginning letters, this build), Underwater (picture-to-word matching), Cloud World (missing final letter), Mountains (similar-word discrimination), Dino Jungle (animal names/beginning sounds), Weather Factory (weather vocabulary/sequencing). Same physical mechanic should support all of these.

---

## UX Principles

Prioritize immediate comprehension, large readable visuals, physical interaction, rapid feedback, low punishment, repeatability, delight. Avoid unnecessary instructions, menus, scoring complexity, lives, timers, streak requirements, progress gates, failure screens.

## Audio / Feedback

Reuse existing Block Buddies audio conventions. Correct = cheerful confirmation + candy sound + satisfying block effect. Incorrect = soft bump/boop, clearly different from success, not harsh. Letter insertion has a strong visual response even if sound fails.

## Persistence

Candy earned persists exactly like candy earned elsewhere. No separate score or completion state is required; the room stays replayable indefinitely.

## Important Edge Cases

Rapid double-hits, repeated head collision, leaving mid-animation, re-entering the room, exhausting the word pool, missing/failed image asset, answer duplication, consecutive duplicate puzzles. The room must never get stuck.

## Definition of Done

1. Letter Blocks exists as a reusable mini-game framework.
2. A Block Meadow Letter Blocks room is accessible and replayable.
3. The player sees a picture and missing-first-letter word.
4. Three randomized physical letter blocks appear.
5. Bumping the correct block completes the word.
6. The selected letter visibly moves into the blank.
7. Candy is awarded through the existing candy system.
8. A new randomized puzzle follows automatically.
9. Wrong answers allow immediate retry without punishment.
10. The player can leave at any time through an EXIT door.
11. The initial 20-word pool works without obvious repetition or answer-position patterns.
12. The implementation is structured so future Letter Blocks modes can reuse the framework without rewriting the core interaction system.

Update relevant documentation, backlog/changelog/version information, and tests consistent with normal Block Buddies project conventions. The coding agent may make reasonable implementation decisions independently where this spec does not prescribe them.

---

## Technical Direction (agreed in brainstorming, 2026-08-29)

### File layout

New `js/letterblocks.js`, loaded after `entities.js` and before `levels.js`. Holds the content table, icon renderers, and the puzzle-controller class — kept out of `entities.js` specifically because it's a growing *content* module (word banks + icon art), not physics/entity code. `index.html` gets one new `<script>` tag; `CLAUDE.md`'s architecture table gets a new row.

The generic `ExitDoor` entity (non-solid overlap trigger that calls `game.exitSub()` directly — no existing sublevel exits outside a win/`subWin` flow, so this is a new small reusable primitive) lives in `entities.js` next to `SubDoor`.

### Physical interaction

Answer blocks are plain solids pushed into `lv.solids`, exactly like Big Buddy blocks:

```js
{ x, y, w: 84, h: 84, letterBlock: true, idx: 0, skipDraw: true }
```

`skipDraw: true` means the shared `drawSolids` renderer ignores them; `LetterBlocksMachine.draw()` paints the actual block art (rounded rect, big outlined letter, wobble/lock state) itself. Underside height uses the same proven `G-190` convention as Buddy Blocks (top = `G - 190 - h`), just with a bigger block for a readable letter. `game.bumpBlock` gets one new branch: `if (s.letterBlock) return game.level.puzzle.onAnswer(s);` — the block carries no word-specific logic; the machine decides correctness.

### `LetterBlocksMachine` (puzzle controller, lives on `lv.puzzle`)

State: shuffled `pool` of word indices, `poolPos`, `lastWord`, `current` (word entry + this round's letter→block assignment), `locked` (true from a correct hit until the next puzzle loads), `flyT` (flying-letter animation progress 0→1), and a short per-block cooldown so one jump arc can't double-trigger a block.

- `nextPuzzle()` — advances through the shuffled pool; reshuffles (Fisher-Yates) on exhaustion, swapping the head if it would repeat `lastWord`; shuffles `[correct, ...distractors]` onto the 3 fixed physical block slots (ground positions are fixed and spaced for individual jumps — only which letter appears on which block is randomized).
- `onAnswer(solid)` — no-op while `locked`. Wrong: per-block wobble + `plop` sfx, puzzle stays active. Correct: `locked = true`, `boing`→`collect` sfx, run the fly-into-blank animation (~0.6s), hold the completed word (~0.9s), fire the reward hook, call `nextPuzzle()`, clear `locked`.
- Reward hook is a constructor callback (`onCorrect`), defaulting to `game.candy++` + `AudioSys.sfx('candy')` + `Particles.candyBurst(...)` — a real seam for a future mini-game to award something else, without building a scoring system nobody asked for.
- `drawPrompt()` is kept as its own method, separate from the selection/reward loop, so a future mode (missing-last-letter, picture-match) can override just prompt rendering later. No plugin registry is built now — YAGNI.

### Room layout

Single non-scrolling 1280×720 screen (same template as `piperoom`), `theme: 'meadow'` (reuses the meadow background/music — a corner of the same world, not a new biome). Large picture top-center (~220px), missing-letter word below it, three answer blocks on the ground spaced for individual jumps, an always-active `ExitDoor` to the side. Entered via `SubDoor(560, G, 'letterblocks', 'rainbow')` placed in Block Meadow before the first block pile (x=780) — reusing the existing "rainbow" door style rather than adding a new one.

### Word bank (20 entries)

| word | prompt | correct | distractors |
|---|---|---|---|
| cat | _AT | C | B, H |
| dog | _OG | D | F, L |
| pig | _IG | P | B, D |
| fox | _OX | F | B, S |
| bug | _UG | B | R, M |
| fish | _ISH | F | D, W |
| bird | _IRD | B | G, T |
| frog | _ROG | F | D, P |
| duck | _UCK | D | L, T |
| bear | _EAR | B | P, W |
| ball | _ALL | B | F, T |
| book | _OOK | B | C, H |
| bed | _ED | B | R, W |
| cup | _UP | C | P, S |
| hat | _AT | H | B, C |
| car | _AR | C | F, J |
| sun | _UN | S | R, F |
| moon | _OON | M | N, S |
| tree | _REE | T | F, G |
| apple | _PPLE | A | O, U |

`cat`/`hat` intentionally share the `_AT` family. Each word gets a small procedural icon (`LB_ICONS.<word>`) — bold unambiguous silhouette, a simple face where it reads naturally (animals, sun, moon, apple, ball), no face where a face would look odd (book, bed, cup, car, tree, hat).

### Edge cases → mechanism

| Case | Mechanism |
|---|---|
| Rapid/repeated bonks on one block | per-block cooldown + round-level `locked` |
| Leaving mid success-animation | `ExitDoor` always works; `exitSub` just discards the sublevel object |
| Re-entering the room | `enterSub` rebuilds a fresh `LetterBlocksMachine` — stateless, always replayable |
| Pool exhaustion | reshuffle-avoiding-immediate-repeat in `nextPuzzle()` |
| Missing image asset | impossible — icons are code; harness asserts all 20 words have an `LB_ICONS` entry |
| Duplicate/colliding answer letters | harness check: correct + 2 distractors are 3 unique letters, for all 20 words |
| Consecutive duplicate puzzles | `lastWord` guard across reshuffle boundary |

### Integration checklist

- `LEVEL_META.letterblocks` + `buildLevel` case in `levels.js`; `lv.exitDoors = []` added to `newLevel()`'s base object, wired into `game.js`'s update/draw loops next to `lv.subDoors`.
- `index.html` script tag for `js/letterblocks.js`.
- `CLAUDE.md`: architecture table row, mini-games bullet list entry.
- `docs/index.html`: new section + version badge/footer.
- New harness checks: enter via SubDoor, wrong-hit is a no-op, correct-hit awards exactly 1 candy and swaps to a new word, exit door returns to Block Meadow, word-bank data integrity (uniqueness, icon coverage).
- Version: **v1.18.0** (MINOR — new feature, no save-format break). `CHANGELOG.md` entry, `docs/index.html` badge/footer sync (harness-enforced).

## Acceptance Criteria

Same as the Definition of Done above, verified by `node test/harness.js` (run 2-3×) plus `tools/screenshot.sh` visual verification of the room.
