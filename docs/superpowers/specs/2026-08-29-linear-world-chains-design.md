# Block Buddies v1.20.0 — Linear World Chains (design, approved by Ryan 2026-08-29)

## Decision

Worlds become **linear stage chains** (Ryan chose *strictly linear* over a
skip-valve variant, with eyes open on the trade-off): the end of stage n-1 is
the doorway to n-2, and the end of a world's final stage advances to the next
world. Stage-2 levels stop being optional side-trips. Celebrations are tiered:
a **light ~2.5s stage-clear beat** between stages, the **full party/spectacle
reserved for world completion** (Ryan's second choice).

Consequence accepted explicitly: Underwater locks behind Block Meadow 0-2;
Mountain World locks behind the Weather Factory. Forgiveness moves to the
title screen (per-stage resume) and the Up×5 unlock-all combo remains the
parental override.

## Chain data

```js
const WORLD_STAGES = { 1: [1, 'meadow2'], 2: [2, 'water2'], 3: [3, 'cloud2'] };
stageChain(w)   // -> the world's ordered level-id list (default [w])
stageInfo(id)   // -> {world, stage} for chain members; null for secret rooms
```

Worlds 4–10 are single-stage chains until their stage-2s ship (Frozen
Observatory etc. slot in by editing the table). Secret rooms (piperoom,
letterblocks, treehouse, ...) are NOT chain members — they stay optional
sublevels via enterSub/exitSub, unchanged.

## Flow changes

- **Worlds 1–3 endings**: the star `Gate` is removed; the stagegate archway
  becomes the stage ending — moved to (or near) the old gate position, walk-in
  like a gate. `SubDoor` gains `{advance: true}`: on touch it calls
  `game.stageClear(nextId)` instead of `enterSub`; dormancy/gold-star logic
  does not apply.
- **`game.stageClear(nextId)`**: new `'stageclear'` state — fanfare +
  confetti + a short card (next stage's name), ~2.4s, then
  `startLevel(nextId)` directly (full level, no subReturn). Persists stage
  progress.
- **World completion**: the final stage's existing finale star. The goalStar
  touch for chain members (when not entered as a sublevel) calls
  `game.worldWin(world)` instead of `subWin`: full party, unlock world+1,
  reset that world's stage progress, party-Space starts the next world.
  Secret rooms keep `subWin`/`ffbg_mini` exactly as today.
- **`game.startWorld(w)`**: resolves the chain + furthest-reached stage.
  Title medallions/digits, the `'complete'` auto-advance (world 4's gate),
  and party chains route through it.

## Persistence (additive — MINOR, no save break)

New key `ffbg_stage` ("w:idx,..."), loaded into `game.stageProg`. Furthest
stage is recorded when a stage is reached via stageClear; world completion
resets it to 0 (a beaten world replays from stage 1). `ffbg_unlocked`
semantics unchanged; worlds 1–3 now unlock their successor at chain end
instead of at a gate. Old `ffbg_mini` entries for meadow2/water2/cloud2
become inert (harmless).

## Verification

Harness progression rework: world-1 archway ridden for real → stageclear card
→ meadow2 → finale → world party → unlock check → Space → Underwater;
water2/cloud2 sections converted from enter-and-return to chain flow; title
stage-resume checks (quit mid-stage-2, medallion resumes there; beaten world
starts at stage 1); regression that secret rooms still enter/exit as
sublevels. Screenshots: stage-clear card, a stage-2 entered via the chain.
Docs/CHANGELOG/CLAUDE.md progression rewrite; v1.20.0; live deploy check.
