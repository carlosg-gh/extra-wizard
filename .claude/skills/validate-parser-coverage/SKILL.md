---
name: validate-parser-coverage
description: Report how well the material parser covers the card pool (use when asked about parser quality/coverage, before/after parser changes, or to find the highest-value wordings to fix next).
---

# Validate parser coverage

## Steps

1. Run `pnpm data:coverage` — prints per-summon-type `exact` / `approximate` / `unparsed`
   percentages and writes `public/data/coverage.json`.
2. Summarize: overall pass rate (exact + approximate), and which summon type has the most
   `approximate`/`unparsed` (usually Fusion and Link — the messiest grammars).
3. List the top candidate wordings to fix from `coverage.json` → `samples`, grouped by the
   pattern they share (e.g. "X or higher", archetype phrasing, "with the same name").
4. Recommend the next 1-3 grammar additions and hand off to `add-material-grammar-pattern`.

## Targets

- Overall exact+approximate ≥ 90% (the pipeline fails CI below 85%).
- Drive `unparsed` toward 0 over time; never let a real summon under-match (prefer
  `approximate`).
