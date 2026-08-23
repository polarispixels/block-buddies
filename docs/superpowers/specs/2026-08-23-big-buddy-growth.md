# Block Buddies v1.14.0 — Big Buddy Growth System (spec, verbatim from Ryan)

## Goal

Add a new Mario-inspired growth mechanic to Block Buddies.

Jack should be able to:

1. Find a special block suspended above him.
2. Jump and hit the block with his head.
3. Cause a mushroom-like power-up to emerge from the block.
4. Chase and collect the moving mushroom.
5. Grow into a larger version of himself.
6. Remain large until he takes damage.
7. On the first hit while large, shrink back to normal size instead of losing a heart.

This should feel playful, obvious, forgiving, and consistent with the existing Block Buddies style rather than like a direct copy of Mario.

## Core Mechanic

Create a new player state tentatively called **Big Buddy**.

Normal progression:

```text
Normal Jack
   ↓ collects growth mushroom
Big Jack
   ↓ takes damage
Normal Jack, no heart lost
   ↓ takes later damage
Existing heart/damage system continues normally
```

Big Buddy should function as an extra temporary protection layer on top of the existing three-heart system.

Do not replace or substantially redesign the current health system.

## Buddy Block

Add a new interactive block that can be activated by jumping into its underside.

Expected behavior:

* Jack hits the bottom of the block with his head.
* Block performs a brief bounce/bonk animation.
* Block becomes visibly "used."
* A growth mushroom rises out of the top.
* Each block should normally activate only once.

Do not copy the Mario question-mark block visually.

Make it look like it belongs in Block Buddies. A block with a funny face, mushroom symbol, arrow, or other obvious visual indicator is appropriate.

## Growth Mushroom

Add a moving mushroom-like collectible.

Expected behavior:

* Emerges vertically from the Buddy Block.
* Falls or settles onto the terrain.
* Begins moving horizontally.
* Turns around when hitting walls or reasonable level boundaries.
* Moves slowly enough that Jack can easily chase it.
* Should be difficult or impossible to permanently lose.

This mechanic should create excitement, not punishment.

Do not use the same visual treatment as the existing pink bouncing mushrooms. The edible mushroom needs to be visually distinct.

Suggested direction:

* Gold/yellow cap
* Turquoise or contrasting spots
* Googly/funny face
* Tiny feet or walking animation

Exact art decisions are up to the implementation.

## Big Jack

When Jack collects the mushroom:

* Play a clear growth animation and sound.
* Increase Jack's visible size roughly 35–45%.
* Preserve the existing movement feel as much as practical.
* Slightly enlarge the block wheel if appropriate.
* Make the transformation exaggerated and funny.

Avoid making Jack so large that existing level geometry becomes unreliable.

The coding agent should make sensible decisions about collision box changes versus purely visual scaling. Gameplay stability matters more than exact dimensions.

## Damage and Shrinking

Centralize this behavior inside the existing player damage system if practical.

When Big Jack receives damage from an enemy, projectile, flame, lava, etc.:

* Shrink back to normal.
* Do not remove a heart.
* Trigger the existing or appropriate temporary invulnerability.
* Play a noticeable shrink/pop effect.
* Return to normal collision/movement behavior.

Subsequent damage should use the existing heart system.

The goal is for this to automatically work with as many existing hazards as possible without adding custom logic to every enemy.

## Big-Only Bonus Interaction

Give Big Jack one additional capability so growing is more than just an extra hit point.

Add a new **breakable bonus block** that only Big Jack can destroy by hitting it from underneath.

Important:

* This should be visually different from existing cracked walls and other Super Mode interactions.
* Normal Jack can bonk it but cannot break it.
* Big Jack breaks it dramatically.
* Breaking one can reveal candy or another small reward.

This should remain optional. It must not block the main route through a level.

## Initial Level Placement

### 1. Block Meadow

Introduce the mechanic late in Block Meadow, ideally after the later checkpoint and before the final spider/goal section.

The sequence should naturally teach the mechanic:

```text
Buddy Block → Bonk → Mushroom emerges → Chase mushroom → Become Big Jack
→ Encounter enemy / bonus block → Reach goal
```

No tutorial text should be necessary if the visual design is clear.

Include at least one optional Big-only breakable block nearby with a candy reward.

### 2. Dino Jungle

Add a second Buddy Block early enough in Dino Jungle that Jack can become Big before encountering a fire-breathing dinosaur.

This acts as the second lesson:

* Collect mushroom.
* Become big.
* Approach dinosaur.
* If hit by fire or enemy, shrink rather than lose a heart.

This should reinforce the mechanic without additional explanation.

## Scope Constraints

Keep this release focused.

For v1.14.0:

* Support Big Buddy during normal on-foot/block-wheel gameplay.
* Do not redesign truck gameplay around Big Buddy.
* Do not redesign unicorn gameplay around Big Buddy.
* Do not worry about special Big forms for underwater, zero-G, flying, or other unusual modes unless support falls out naturally.
* Reset Jack to normal size when entering a new level or mode if that avoids complexity.
* No new HUD is required.
* Do not build a large transformation system or multiple mushroom types yet.

The priority is one polished, reusable growth mechanic.

## Style and Feel

The feature should follow existing Block Buddies principles:

* Funny rather than serious.
* Easy to understand visually.
* Failure should be cheap.
* Rewards should be satisfying.
* Animations can be exaggerated.
* Procedural/simple art is fine.
* Preserve the existing control scheme.
* Avoid excessive instructions or UI.

Suggested effects — Growth: sparkles, vertical stretch, short freeze or squash, rising musical sound, Jack looks pleased or surprised. Shrink: small freeze-frame, pop, stars or particles, quick squash, surprised expression, brief invulnerability.

The coding agent can determine exact timing and implementation details.

## Technical Direction

Prefer integrating the feature into existing systems instead of building parallel mechanics. Likely areas: player state, player damage handler, collision detection for head-bonking, entity system for mushroom movement, level object definitions, rendering/animation helpers, existing particle/audio systems. Reuse existing architecture and conventions. Keep the implementation easy to extend later.

## Acceptance Criteria

The feature is complete when:

1. Jack can hit a Buddy Block from underneath.
2. A mushroom emerges and begins moving.
3. Jack can collect it.
4. Jack visibly becomes Big Jack.
5. Big Jack can continue playing normally.
6. Big Jack can break the new Big-only bonus block.
7. Big Jack taking damage shrinks him without losing a heart.
8. Normal Jack taking damage behaves exactly as before.
9. The mechanic works in Block Meadow.
10. A second example exists in Dino Jungle.
11. Existing levels, vehicles, enemies, hearts, checkpoints, and saves are not broken.
12. Relevant docs/backlog/version information are updated.

## Version

Treat this as a minor feature release: **v1.14.0**

## Future Direction, Not Part of This Build

Keep the system extensible enough that a future level could use growing and shrinking as a puzzle mechanic (possible future "Tiny & Giant Garden" concept: enter small passages, break large blocks, reach different routes, intentionally shrink). For now, build the foundational Big Buddy mechanic, introduce it cleanly in Block Meadow, and reinforce it once in Dino Jungle.
