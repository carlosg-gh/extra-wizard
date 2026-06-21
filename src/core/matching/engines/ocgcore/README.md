# ocgcore-wasm engine (Phase 2 — in progress, OFF by default)

Goal: replace/augment the build-time parser with the **real** Yu-Gi-Oh! ruleset
(EDOPro's `ygopro-core`, aka ocgcore) compiled to WebAssembly, behind the existing
[`ISummonEngine`](../../ISummonEngine.ts) seam. The parser engine (`parser-v1`) stays
the default and the shipping path; this engine is selected only when its flag is on and
its assets are available, and it falls back to the parser otherwise.

## Package & data

- **Engine:** [`@n1xx1/ocgcore-wasm`](https://github.com/n1xx1/ocgcore-wasm) — EDOPro
  `ygopro-core` built with emscripten; runs in browsers/Node/Deno. API:
  `createCore({ sync })` → `createDuel({ flags, seed, players, cardReader, scriptReader,
  errorHandler })` → process loop `startDuel` / `duelProcess` / `duelGetMessage` /
  `duelSetResponse`. It bundles **no data**: the caller supplies card data and per-card
  Lua via the `cardReader(code)` / `scriptReader(path)` callbacks.
- **Card DB:** [ProjectIgnis/BabelCDB](https://github.com/ProjectIgnis/BabelCDB)
  (`cards.cdb`, SQLite) — or synthesize the fields ocgcore needs from our own index.
- **Scripts:** [ProjectIgnis/CardScripts](https://github.com/ProjectIgnis/CardScripts)
  (one Lua file per card code, tens of MB). Lazy-fetch per code in `scriptReader`.

## Why this is non-trivial

ocgcore is a **duel simulator**, not a query engine — there is no "list everything
summonable" call. To enumerate makeable Extra Deck monsters we set up a board (the user's
materials on the field + the full Extra Deck), advance to Main Phase 1, and read the
special-summon candidate list out of the `MSG_SELECT_IDLECMD` message.

It is also **asynchronous** (WASM, optionally JS Promise Integration), whereas the current
[`ISummonEngine.match`](../../ISummonEngine.ts) is **synchronous and per-monster**. The
adapter here bridges that with a two-phase shape:

1. `prime(materials)` — async: load the core/assets once, build the field, enumerate the
   summonable Extra Deck monster ids into a `Set`.
2. `match(monster, …)` — sync: answer from the primed set.

Promoting this to the default likely means making the seam async end-to-end (`runQuery`
and the worker's `queryAll` are already async, so the ripple is small).

## Stages

0. **Scaffold (done):** this module — `ISummonEngine` adapter skeleton + flag + smoke test.
1. **Wire the core:** `pnpm add @n1xx1/ocgcore-wasm`; lazy-load it in a worker; implement
   `cardReader`/`scriptReader` against cards.cdb + CardScripts; implement `prime()` to
   drive the duel and read `MSG_SELECT_IDLECMD`.
2. **Asset pipeline:** decide hosting/proxy + lazy per-code fetching to keep initial load small.
3. **Integrate behind the flag:** pass the engine to `runQuery({ engine })`; fall back to
   `parser-v1` when WASM/assets are unavailable.
4. **Validate:** golden tests comparing `parser-v1` vs `ocgcore-wasm` on a curated set;
   measure worker latency. **Flip the default only when** it matches/exceeds parser recall
   on the golden set with no false positives and acceptable latency.
