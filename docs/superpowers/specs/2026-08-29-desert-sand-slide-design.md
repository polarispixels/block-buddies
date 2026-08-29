# Block Buddies v1.21.0 — Desert Sand Slide (spec from Ryan + approved technical direction, 2026-08-29)

## Objective (Ryan's spec, condensed)

A new desert stage immediately before the monster truck content, introducing a
reusable **automatic downhill riding** traversal mechanic: auto-forward
movement, jumping, shooting while riding, procedural obstacles, collectibles,
airborne tricks. Fast, playful, slightly chaotic, highly replayable. Narrative
purpose: explains how the player acquires the monster truck.

Flow: desert arrival on foot → Puzzle Blocks pattern challenge (~3 rounds) →
boogie board revealed → collect it → Sand Slide begins → procedurally
generated ride (jump/shoot, obstacles, candy, 5 truck parts, parts can be
lost on major collisions but never below zero and never unwinnable) →
5/5 triggers a Victory Run (bigger ramps, more airtime, ridiculous trick
combos, spectacle over challenge) → giant final ramp → transition into the
existing monster truck sequence.

Obstacle pool: quicksand (jump it or sink comically, may cost a part),
scorpions (jump or shoot, readable early), spiky cactus (jump; multiple
sizes), rocks/debris, tumbleweeds (moving), sand ramps (launch + candy/part
arcs). Early on, a **friendship cactus moment**: rainbow power on a spiky
cactus → flowers, softer spikes, cheerful face. Short, readable, don't
overbuild.

Failure philosophy: funny and recoverable, momentum maintained, no lives, no
level restarts, no losing all progress, short invulnerability after hits.

Design priorities in order: fun, clear controls, jump timing, sense of speed,
funny failures, part progression, procedural replayability, fantastic tricks,
clean transition, reusable ride architecture. Don't overcomplicate.

## Approved decisions (Ryan, in brainstorming)

1. **Slide parts feed the ceremony**: 'sandslide' becomes World 6 (internal
   7)'s first stage via `WORLD_STAGES[7] = ['sandslide', 7]`. Its 5 parts ARE
   the truck parts. The Victory Run's giant ramp triggers the STAGE CLEAR
   beat; the rally then starts with `TruckBuild` in **delivered mode** — the
   3-token hunt skipped, tokens pre-collected, parts flying from the hero
   into the existing crane assembly ceremony, race untouched. A direct
   `startLevel(7)` without the delivered flag falls back to the classic
   hunt (zero regression to existing rally content/harness).
2. **Pattern puzzle = complete-the-pattern**: the queued Pattern Blocks mode
   (backlog #15) debuts here on the existing single-answer PuzzleBlocks
   engine — show a color sequence, bump the block that comes next, 3 correct
   rounds win. Requires one engine seam: `roundsToWin`/`onWin` (a success
   state the framework spec anticipated). No multi-step architecture.

## Technical direction

- **`js/ride.js`** (new file, loaded after puzzleblocks.js, before levels.js):
  - `RideMode` — the generic reusable rider: auto-forward speed, gravity,
    jump, airborne state, trick combo counter (jump-button presses while
    airborne → escalating spin/flip/grab/Superman poses, visual only),
    crash/land callbacks, HEIGHTFIELD terrain (segment list → groundY(x))
    instead of the solids system. Nothing desert-specific inside.
  - `RideCourse` — template-based procedural generator with constraint
    rules: minimum reaction gap after every obstacle scaled to speed,
    breather flats between templates, parts always ramp-reachable. Phases
    (Learn scripted opening w/ friendship cactus → Play → Combine → Final
    Collection → Victory Run) control template weights and speed.
  - Desert content: obstacle configs + draw functions (subagent art pack),
    5 part kinds (tire, engine, steering wheel, chassis, oversized exhaust),
    part-loss pool that re-queues missed AND lost part kinds forever.
- **`PatternBlocksMachine`** in js/puzzleblocks.js: color-sequence entries
  (no reading), custom drawPrompt (sequence + pulsing ?) and drawChoice
  (colored block), 3 rounds to win; `onWin` reveals the boogie board.
- **Player integration**: an early branch in `Player.update` hands control
  to `lv.ride` while riding (like vehicle branches). Shooting (Space) stays
  live; projectiles poof scorpions, rainbow blooms the friendship cactus.
- **Persistence/flow**: no new save keys. `game.partsDelivered` is a
  transient flag set at the victory launch, consumed by `buildLevel(7)`.
- Verification: deterministic harness strategy — generator invariants
  asserted over many random templates, RideMode physics driven over
  hand-crafted courses, the full flow ridden end-to-end (puzzle → board →
  ride → parts/loss → victory → stage clear → delivered ceremony → race),
  classic-hunt fallback, plus screenshots of the ride/tricks/friendship
  cactus. v1.21.0 MINOR, full docs/backlog sync (mark backlog #15 shipped
  inside Sand Slide).
