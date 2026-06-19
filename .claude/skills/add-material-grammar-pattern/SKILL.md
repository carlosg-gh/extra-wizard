---
name: add-material-grammar-pattern
description: Extend the material-requirement parser to handle a new or mis-parsed card wording (use when a card shows the "approx" badge incorrectly, appears in coverage.json samples, or a summon requirement isn't matched). Adds a grammar production + test and re-checks coverage.
---

# Add a material grammar pattern

The parser turns a card's material string into structured `MaterialConstraint`s. When a
wording is mis-parsed it is flagged `approximate` (safe over-inclusion) rather than failing.
This skill upgrades a pattern to `exact` (or fixes a wrong parse).

## Steps

1. **Find offenders:** run `pnpm data:coverage` and inspect
   `public/data/coverage.json` → `samples.approximate` / `samples.unparsed` for the wording.
2. **Locate the grammar:** edit the relevant module in `src/core/parser/grammar/`
   (`synchro.ts` / `xyz.ts` / `link.ts` / `fusion.ts`), or the shared productions in
   `grammar/shared.ts` (`parseCount`, `parseFilters`, `buildConstraint`). New filler words
   or vocab go in `grammar/shared.ts` (`FILLER`) or `domain/enums.ts`.
3. **Add a test FIRST:** add a table row to the matching `src/core/__tests__/parser.*.test.ts`
   asserting the produced constraints (counts, filters) and `parseStatus: 'exact'`.
4. **Implement** the production. Guiding rule: **prefer `approximate` over wrong-`exact`** —
   never under-include. If a clause can't be modeled precisely, drop it and leave the result
   a superset (flagged approximate).
5. **Verify:** `pnpm test`, then `pnpm data:refresh` and confirm coverage improved without
   regressions elsewhere.

## Gotchas

- Quoted tokens are archetypes in counted segments (`1 "Bujin" monster`) but named cards in
  standalone Fusion segments (`"Dark Magician"`). See `grammar/fusion.ts`.
- Archetype constraints match against a card's `series`; verify the parsed name matches the
  exact yaml-yugi `series` string.
- Synchro uses `synchroTargetLevel` (Level sum); Link uses `linkContribTarget` (rating sum).
