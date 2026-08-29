# Block Buddies — Puzzle Blocks Learning Framework Backlog (spec, verbatim from Ryan, 2026-08-29)

## Purpose

Formalize the existing Letter Blocks system into a broader reusable Puzzle Blocks framework for educational and cognitive mini-games inside Block Buddies.

The current Letter Blocks game has validated the core interaction:

Prompt → physical answer choices → player bumps a block → feedback → reward → next puzzle

The children are already engaging with this mechanic successfully. We should preserve that familiarity while expanding the kinds of thinking the system can support.

The goal is not to turn Block Buddies into educational software.

The goal is to hide learning, reasoning, memory, and problem-solving inside normal Block Buddies gameplay.

## Naming

Use **Puzzle Blocks** as the general framework/system. **Letter Blocks** becomes one type of Puzzle Blocks game.

Conceptually: Puzzle Blocks → Letter Blocks, Word Blocks, Number Blocks, Pattern Blocks, Logic Blocks, Category Blocks, Memory Blocks, Sequence Blocks.

Exact code naming is up to the implementation, but avoid architectural assumptions that Puzzle Blocks only supports letters or strings.

## Core Puzzle Blocks Model

1. Present a prompt.
2. Present several physical answer blocks.
3. Player selects an answer through normal Block Buddies movement, usually by jumping and bumping a block.
4. Give immediate physical and visual feedback.
5. Correct answers produce a satisfying result and reward.
6. Incorrect answers allow another attempt with little or no punishment.
7. Advance automatically to the next puzzle.
8. Player can continue as long as desired or leave.

Puzzle definitions should ideally be data/configuration driven. The framework should eventually support: text prompts, images, groups of images, numbers, symbols, colors, shapes, sequences, multiple-part answers, ordered answers. Do not over-engineer all of these capabilities in advance — extend the framework when actual games require them.

## Design Principles

1. **Gameplay first.** The child should feel like they are playing Block Buddies. Avoid conventional educational UI (radio buttons, worksheets, forms, menus, quizzes with Next buttons, score screens after every question). Answers should exist physically in the game world whenever practical.
2. **Familiar mechanic, changing mental challenge.** Do not constantly invent new controls. The player repeatedly uses move → jump → bump while the cognitive task changes.
3. **Low punishment.** Wrong answers wobble, make a funny sound, briefly indicate failure, remain available. Never: losing candy, damage, lives, timers, game-over states, resetting substantial progress.
4. **Strong reward loop.** Letter/number/object flies into its destination, block animation, completed word or equation, success sound, candy pop, celebration, character reaction. Candy feeds the existing economy.
5. **Replayability.** Indefinite play, shuffled content pools, voluntary exit — never a fixed number of questions.
6. **Visual clarity.** Large images, large text, obvious answer choices, strong spacing, limited clutter. Pictures used as vocabulary prompts must have one obvious interpretation.

## Learning Backlog

### A. Letter and Phonics Games
- **A1. Beginning Letter Blocks** — BUILT (v1.18.0, second-gen art + 60 words v1.19.0). Picture CAT, "_AT", choices B/C/H.
- **A2. Ending Letter Blocks** — Picture CAT, "CA_", choices T/P/R. Ending sounds, basic spelling, phonics. Choose vocabulary where one letter cleanly completes the word.
- **A3. Middle Letter Blocks** — "C_T", choices A/O/U. Focus heavily on vowels (CAT, DOG, PIG, SUN, BED).
- **A4. Beginning Sound Blocks** — image only (no partial word shown); picture FISH, choices F/S/B. Identifying the initial sound.
- **A5. Whole Word Match** — picture DOG, choices DOG/LOG/DIG. Transition from letters to whole-word recognition.
- **A6. Rhyming Blocks** — prompt "CAT", choices BAT/DOG/SUN → BAT. Future versions could use pictures.
- **A7. Word Family Blocks** — "_AT" with CAT/HAT/BAT; identify a requested image or build several members of a family.
- **A8. Build the Entire Word** (advanced/future) — picture CAT, slots "_ _ _", blocks C/A/T/B/O, bump C→A→T in order; letters fly into slots; reward after the whole word. Introduces multi-step state and ordered answers.

### B. Vocabulary and Classification
- **B1. Picture Category Blocks** — picture DOG, choices ANIMAL/FOOD/VEHICLE. Categories: animal, food, vehicle, toy, plant, clothing, tool.
- **B2. More Specific Categories** — APPLE: FRUIT/VEGETABLE/ANIMAL; later FROG: MAMMAL/AMPHIBIAN/BIRD. Keep age-appropriate.
- **B3. Opposites** — "HOT": COLD/BIG/FAST. Pairs: up/down, big/small, fast/slow, wet/dry, day/night, happy/sad, open/closed. Images can support.
- **B4. Descriptive Vocabulary** — picture of red ball, "WHAT COLOR?", RED/BLUE/GREEN. Also big/small, tall/short, round/square, full/empty.

### C. Number Blocks
Strategically important: proves Puzzle Blocks is not inherently a literacy system.
- **C1. Count the Objects** — show 🍎🍎🍎🍎, "HOW MANY?", 3/4/5. Start with small quantities.
- **C2. Number Recognition** — show "7", choices as object groups; or show seven stars, choose the numeral.
- **C3. Simple Addition** — "2 + 3 = ?", 4/5/6. Small, visually supported.
- **C4. Simple Subtraction** — "5 - 2 = ?", 2/3/4. Later: five objects appear, two physically disappear before answer blocks activate.
- **C5. Which Number Is Bigger?** — "WHICH IS BIGGEST?", 4/7/2. Variants: biggest, smallest, more, fewer.
- **C6. Missing Number Sequence** — "1 2 3 _", 4/5/7; later "2 4 6 _".

### D. Shapes and Spatial Concepts
- **D1. Shape Identification** — show triangle, choices TRIANGLE/CIRCLE/SQUARE.
- **D2. Shape Matching** — target shape; answer blocks contain shapes, not text.
- **D3. Spatial Vocabulary** — "WHICH BLOCK IS ABOVE THE TREE?" — above/below/beside/inside/outside/left/right; could eventually use actual world geometry.

### E. Pattern Blocks
High-priority: introduces reasoning rather than recognition.
- **E1. Alternating Pattern** — RED, BLUE, RED, BLUE, ? → RED/BLUE/YELLOW.
- **E2. Shape Pattern** — CIRCLE, SQUARE, CIRCLE, SQUARE, ?.
- **E3. Growing Pattern** — 1 block, 2 blocks, 3 blocks, ? — choose the next group.
- **E4. More Complex Patterns** — A,A,B,A,A,B,? / RED,RED,BLUE,... Gradual difficulty.

### F. Logic and Categorization
- **F1. Odd One Out** — CAT/DOG/APPLE, "WHICH ONE IS DIFFERENT?" → APPLE.
- **F2. What Belongs Together?** — DOG: BONE/CAR/MOON; BIRD: NEST/SHOE/SPOON. Obvious relationships at early difficulty.
- **F3. Cause and Effect** — "WHAT MAKES ICE MELT?" SUN/SNOW/ROCK. Fits the Weather Factory especially well.
- **F4. What Happens Next?** — dark cloud → ? RAIN/FIRE/ROCK. Simple everyday causality.

### G. Sequence Blocks
Ordered multi-step answers (needs multi-step architecture).
- **G1. Life Sequence** — seed → sprout → flower, what comes next.
- **G2. Daily Sequence** — wake up / get dressed / eat breakfast; toothpaste / brush / rinse.
- **G3. Story Sequence** — scrambled visual events, bump blocks in correct order.

### H. Memory Blocks
Keep memory challenges short and forgiving.
- **H1. Remember the Picture** — show FROG briefly, hide, choose FROG/DUCK/BEAR.
- **H2. Remember the Number** — show 5 stars briefly, hide, choose 4/5/6.
- **H3. Remember the Sequence** — show RED→BLUE→YELLOW, hide, ask for the next or missing element.

## Multi-Step Puzzle Architecture (future)

Current interaction assumes one selection → one answer. Eventually support multiple selections → completed solution: spell a word (C→A→T), build a sequence, order pictures, multi-part arithmetic. The framework should eventually support: ordered answer slots, multiple correct selections, progress through a puzzle, resetting an incorrect sequence, completing only after all required steps. Do not necessarily build this immediately.

## Biome-Specific Puzzle Opportunities

- **Block Meadow** — beginning letters (current Letter Blocks fits naturally), simple vocabulary, colors, basic counting.
- **Underwater** — counting fish, sea animal identification, more/fewer, big/small, whole-word matching, underwater categories ("WHICH GROUP HAS MORE?" with two fish groups).
- **Cloud World** — ending letters, weather vocabulary, patterns, colors, above/below.
- **Mountains** — shapes, spatial relationships, bigger/smaller, ordering, simple logic.
- **Dino Jungle** — animal names, beginning sounds, animal categorization, footprints, herbivore/carnivore if age-appropriate, matching dinosaurs to characteristics.
- **Weather Factory** — particularly strong integration: sun, rain, clouds, snow, ice, wind, hot/cold, melting/freezing, cause-and-effect ("WHAT MAKES ICE MELT?" SUN/SNOW/WIND; "WHAT COMES FROM A DARK RAIN CLOUD?" RAIN/FIRE/ROCK). Reinforce concepts already represented physically in the level.
- **Zombie Town** — playful, not frightening: rhyming, silly vocabulary, night/day, matching, memory games.

## Progression Philosophy

No rigid school-like curriculum. Gradual sophistication, invisible to the player:

1. **Recognition** — identify letter, image, count objects, identify color.
2. **Association** — picture→word, object→category, word→opposite, animal→habitat.
3. **Pattern Recognition** — next item, missing number, repeated visual pattern.
4. **Reasoning** — odd one out, biggest/smallest, cause and effect, what belongs together.
5. **Multi-Step Thinking** — spell whole word, arrange sequence, connected steps.

## Content Architecture

Separate where practical:
- **Puzzle engine** — current puzzle, answer selection, transitions, retries, reward, shuffled queues, input locking, multi-step state when eventually required.
- **Puzzle type** — interaction semantics (missingLetter, chooseWord, countObjects, chooseCategory, completePattern).
- **Puzzle content** — actual questions/answers, e.g. `{type: missingFirstLetter, word: CAT, image: cat, answer: C, distractors: [B, H]}` or `{type: countObjects, object: apple, count: 4, answer: 4, distractors: [3, 5]}`.

Do not introduce unnecessary abstractions until real game types require them.

## Difficulty

Eventually simple metadata (beginner/intermediate/advanced) driven by vocabulary complexity, number size, distractor similarity, choice count, pattern complexity, memory duration, step count. No complicated adaptive-learning system now — the priority is enjoyable content.

## Recommended Next Three Builds

1. **Ending Letter Blocks** ("CA_" → T/P/R) — very close to the successful implementation, inexpensive, tests prompt-structure reuse.
2. **Number Blocks: Count the Objects** (four apples, "HOW MANY?" → 3/4/5) — first move outside literacy; proves numeric answers and multi-object prompts.
3. **Pattern Blocks** (RED/BLUE/RED/BLUE/? → RED/BLUE/YELLOW) — introduces reasoning, requires no reading, proves visual-relationship puzzles.

## Longer-Term High-Priority Ideas (after the next three)

Whole Word Match, Middle Letter Blocks, Category Blocks, Simple Addition, Bigger/Smaller, Odd One Out, Rhyming Blocks, Missing Number Sequences, Memory Blocks, Build the Entire Word, Story/visual sequencing, Cause-and-effect puzzles.

## What Not to Build Yet

Formal lessons, curriculum dashboards, grades, percentages, parent reporting, timed testing, skill trees, XP systems, complex adaptive algorithms, required daily exercises, separate educational currencies. The current strength is that the child wants to play. Protect that.

## Immediate Coding-Agent Task

Create/update the internal Puzzle Blocks framework/backlog documentation (philosophy, architecture, current Letter Blocks implementation, backlog ideas, biome opportunities, multi-step direction, next three builds). Then prepare the codebase so future Puzzle Blocks modes build on the Letter Blocks interaction without duplication. Do not implement every backlog item. Next planned implementation candidates: Ending Letter Blocks, Number Blocks: Count the Objects, Pattern Blocks. Preserve the Block Buddies design philosophy throughout: simple controls, physical interaction, visible cause and effect, minimal punishment, candy rewards, exploration, replayability, delight.
