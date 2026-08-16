# Funny Face Block Game

A zero-build, zero-dependency 2D canvas platformer built for a five-year-old.
Nine worlds, two bosses, three vehicles, procedural art and audio, installable PWA.

- **Play:** https://polarispixels.github.io/block-buddies/
- **Developer & agent docs:** https://polarispixels.github.io/block-buddies/docs/
  (architecture, all nine levels, core systems, versioning, collaboration workflow)
- **Changelog:** [CHANGELOG.md](CHANGELOG.md) — SEMVER, current version in
  `GAME_VERSION` (`js/util.js`)
- **Agent instructions:** [CLAUDE.md](CLAUDE.md) — hard rules and working agreements
  for AI collaborators

## Quick start

No build step: open `index.html` in a browser (works from `file://`).

Verify changes with the headless harness and screenshot tool:

```sh
node test/harness.js          # must print ALL CHECKS PASSED
tools/screenshot.sh <name> '<js-hook>'
```
