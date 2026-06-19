# CLAUDE.md

Operating guide for working in **extra-wizard** — a website of YuGiOh deckbuilding
tools. The first tool is the **Extra Deck Monster Searcher**: the user lists monster
cards they control, and the app returns every Extra Deck monster (Fusion / Synchro /
Xyz / Link) summonable from them as materials, with filters.

## Architecture in one breath

```
pipeline (Node, build-time)  →  static JSON index  →  Web Worker (matching)  →  React app
   src/pipeline                 public/data/*.json     src/app/worker          src/app
   uses src/core                                       uses src/core           uses src/core
```

The expensive, fragile work (parsing free-text material requirements) is **frontloaded
at build time** into a structured schema, so runtime queries are a fast, pure pass over
small data. Matching runs in a Web Worker; result filters run on the main thread.

Key decisions (see `/root/.claude/plans/` history): V1 parses the material string; we do
**not** embed the EDOPro/ocgcore engine. The matching layer sits behind `ISummonEngine`
so an ocgcore-wasm adapter or curated overrides can be added later without a rewrite.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server (uses the committed `public/data`; no network). |
| `pnpm build` | `data:refresh` then `build:app`. |
| `pnpm build:app` | `tsc --noEmit` + `vite build` (no data fetch). |
| `pnpm data:refresh` | **Only networked script.** Fetch yaml-yugi, parse, emit `public/data`. |
| `pnpm data:coverage` | Same parse, prints coverage, writes nothing (`--coverage-only`). |
| `pnpm test` / `pnpm test:watch` | Vitest (parser, matching, golden query). |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm lint` | ESLint (flat config). |

`data:refresh` accepts `--limit=N` (process first N records) for quick iteration.

## Layout & boundaries

- **`src/core/`** — pure, **DOM-free, no `fs`/network**. Domain types, the material
  **parser**, the **matching** engine, and build-time `index-build` helpers. Imported by
  the app, the pipeline, and tests. *Never import React, `fs`, or the network here.*
- **`src/pipeline/`** — Node-only (run via `tsx`). The only place doing network + file IO.
  Imports core via **relative** paths (tsx doesn't resolve the `@core` alias).
- **`src/app/`** — React SPA. Imports core via the **`@core`** alias (Vite/tsconfig).
  - `app/worker/match.worker.ts` is the *only* place `runQuery` executes at runtime.
  - Result **filters run on the main thread** (`features/filters/filterState.ts`); they
    never re-invoke the worker. The worker re-runs only when `{selected cards, mode}` change.

## Data pipeline

- **Source:** `yaml-yugi` aggregated `cards.json` (`src/pipeline/sources/yamlYugi.ts`
  tries GitHub Pages → jsDelivr → `raw.githubusercontent` `aggregate` branch). The
  pre-extracted **`materials`** field is the primary input; when absent (common for some
  Link monsters) we fall back to the **first line of `text.en`** (`pickMaterials`).
- **Skipped:** non-monsters, Rush Duel cards (`materials` is an object), records missing
  type line / id.
- **Emitted to `public/data/`** (committed to the repo so fresh clones work offline):
  `index.{fusion,synchro,xyz,link}.json` (parsed targets), `input-pool.json` (every
  monster usable as a material, for autocomplete + matching), `meta.json`, `coverage.json`,
  `manifest.json` (shard hashes).
- **Refresh:** `.github/workflows/refresh-data.yml` re-runs the pipeline on a schedule and
  opens a PR with the coverage delta. The pipeline exits non-zero if parse coverage drops
  below 85% (regression guard).
- **Images:** thumbnails come from YGOPRODeck (`images.ygoprodeck.com/.../cards_small/{password}.jpg`,
  see `src/app/lib/images.ts`). YGOPRODeck asks consumers **not to continuously hotlink** —
  for production, route through an edge proxy / re-host. The grid degrades gracefully
  (name placeholder) when an image fails.

## How matching works (mental model)

Every monster's requirement is parsed into `SummoningPath[]` → one `MaterialGroup` →
`MaterialConstraint[]`. The matcher (`src/core/matching/groupMatch.ts`) finds an assignment
of the user's cards to the constraints such that counts fit `[min,max]`, filters pass, any
**sum target** is met exactly, and uniqueness holds:

- **Synchro** → `group.synchroTargetLevel`: chosen materials' Levels sum to the monster's Level (Tuner + non-Tuner constraints).
- **Xyz** → constraint `level = [Rank]`, count = N; Tokens excluded.
- **Link** → `group.linkContribTarget`: each material contributes 1 (or its own Rating if it's a Link monster); must sum to the Rating.
- **Fusion** → named + generic constraints; a Fusion Substitute (`FUSION_SUBSTITUTE_IDS`) can fill one named slot.

**Modes:** `any-subset` allows leftovers; `use-all` requires every provided card be consumed.

## parseStatus philosophy — never silently wrong

Each path is `exact`, `approximate`, or `unparsed`:
- `approximate` = structure understood, a *stricter* sub-clause dropped → match is a safe
  **superset** (over-includes), shown with an "approx" badge.
- `unparsed` = structure not established → kept in the data but **hidden** unless the query
  opts in. Prefer **approximate over wrong-exact** when adding grammar.

## Extending the parser / matcher

- **New material wording:** add a production to the right `src/core/parser/grammar/*.ts`
  (shared helpers in `grammar/shared.ts`), add a table-driven test row, then
  `pnpm test` and `pnpm data:coverage`. See the `add-material-grammar-pattern` skill.
- **Curated effect-summon override (e.g. TY-PHON):** future — add an extra `SummoningPath`
  for that monster id (matching iterates paths, so no engine change).
- **ocgcore-wasm engine (V2):** implement `ISummonEngine` and pass it to `runQuery`; the
  app/worker/pipeline are unaffected.

## Domain glossary

- **Extra Deck** — Fusion / Synchro / Xyz / Link monsters, summoned from a separate deck using materials.
- **Material** — a monster used to summon an Extra Deck monster.
- **Tuner / non-Tuner** — Synchro needs 1+ Tuner; the rest are non-Tuners. (`Card.isTuner`)
- **Level vs Rank vs Link Rating** — Synchro/Fusion use **Level**; Xyz use **Rank**; Link use a **Rating** (= number of `link_arrows`). Stored as `level` / `rank` / `linkRating`.
- **Type (Race)** — the creature type (Dragon, Cyberse…). Called `race` in code to free up "type" for the summon mechanic.
- **Archetype** — a card "family" (Blue-Eyes, Swordsoul…). From yaml-yugi `series`; stored as `series`.
- **Token** — a generated monster; cannot be an Xyz material.
- **Fusion Substitute** — e.g. King of the Swamp; stands in for one named Fusion material.

## Conventions

- TypeScript strict; named exports in `core` (no default exports there).
- Card id = `String(password ?? konami_id)`.
- Tests are table-driven and live in `src/core/__tests__/`.
- Keep `core` free of React/Node APIs.
