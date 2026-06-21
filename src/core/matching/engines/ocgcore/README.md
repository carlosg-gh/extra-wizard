# ocgcore-wasm engine (Phase 2 — in progress, OFF by default)

Goal: augment the build-time parser with the **real** Yu-Gi-Oh! ruleset (EDOPro's
`ygopro-core`, aka ocgcore) compiled to WebAssembly, behind the existing
[`ISummonEngine`](../../ISummonEngine.ts) seam. The parser engine (`parser-v1`) stays the
default and the shipping path; ocgcore is selected only when its flag is on and its assets
are available, and falls back to the parser otherwise.

## Role: a verifier over the parser's candidates

ocgcore is **not** used as an independent enumerator. The parser generates candidate Extra
Deck monsters (its `exact` + `approximate` matches, *with* the per-material recipe); ocgcore
then **confirms/denies** each candidate against the real ruleset. This keeps `runQuery` and
the recipe display untouched, keeps Bridge mode parser-backed, and — crucially — keeps the
board small (load only the candidates, not the whole ~13k Extra Deck). The parser may be made
*more permissive* (favor recall) precisely because ocgcore prunes the false positives.

## How enumeration works

ocgcore is a **duel simulator**, not a query engine. To learn which candidates are summonable
we build a single-player board (the user's materials face-up in `MZONE` + the candidate Extra
Deck monsters in `EXTRA`), advance to **Main Phase 1**, and read
`MSG_SELECT_IDLECMD.special_summons` — which lists exactly the monsters whose summon procedure
is performable *right now* (the engine has already validated their materials). One read; no
per-summon simulation.

The seam is two-phase (ocgcore is async; `ISummonEngine.match` is sync):
1. `prime(materials, candidateIds)` — async: load the core once, build the field, enumerate
   the summonable ids into a `Set`.
2. `match(monster, …)` — sync: answer from the primed set.

## Stage 0 — feasibility spike: **GO ✅** (verified, see findings below)

A Node spike (board = two Level-4 monsters) confirmed the load-bearing assumptions:
`special_summons` listed exactly the generic Rank-4 Xyz (Utopia, Abyss Dweller) and correctly
**excluded** a Rank-5 Xyz (Volcasaurus) and a Tuner-requiring Synchro (Stardust) — i.e. a
monster is offered **only when its materials are present**. MP1 was reached in ~56 ms with
empty decks + zero draws.

### Verified facts that constrain the implementation

- **Install is JSR, not npm.** `package.json` depends on
  `"@n1xx1/ocgcore-wasm": "npm:@jsr/n1xx1__ocgcore-wasm@^0.1.3"` with `.npmrc`
  `@jsr:registry=https://npm.jsr.io`. (`pnpm add @n1xx1/ocgcore-wasm` does **not** work.)
- **`createCore` import quirk.** It is a **default** export of `dist/index.js`, but the
  package root (`mod.js`, `export *`) drops it and the `exports` map blocks the deep bare
  specifier. Import the *named* enums from `@n1xx1/ocgcore-wasm`, but resolve `createCore` by
  file path (e.g. `createRequire(...).resolve('@n1xx1/ocgcore-wasm')` → swap `mod.js`→
  `dist/index.js` → `import(pathToFileURL(...))`). The providers must encapsulate this.
- **Use the sync build:** `createCore({ sync: true })`. No JSPI/stack-switching (no Node
  flag), no SharedArrayBuffer/threads → **no COOP/COEP headers** (GitHub Pages can't set them).
  The wasm auto-imports in Node; pass `wasmBinary` only if a bundler mishandles the URL.
- **Preload system scripts** after `createDuel`, before `startDuel`:
  `loadScript('constant.lua', …)` then `loadScript('utility.lua', …)`. `utility.lua` defines
  `GetID`/`Auxiliary` and `Duel.LoadScript()`s every `proc_*.lua` via our `scriptReader`.
  Without this, card `initial_effect`s fail on `global 'GetID'`.
- **Card data = BabelCDB `cards.cdb`**, not synthesized: `OcgCardData.race` is a 64-bit
  `bigint` and `setcodes` are numeric archetype codes our index lacks. Read 64-bit columns via
  `CAST(... AS TEXT)` to avoid JS precision loss; node:sqlite needs `--experimental-sqlite`.
- **`scriptReader` paths:** per-card `c<code>.lua` lives under `official/`; system scripts at
  the root. Vanilla monsters have no script → return `null` (tolerated).
- **Vendored assets** (`pnpm vendor:ocgcore`, git-ignored under `vendor/ocgcore/`) are pinned:
  BabelCDB `0513c77d30…`, CardScripts `6329dd086a…`. Bump both together.

## Remaining stages

1. **Provider seam in core:** `OcgResourceProvider` (readCard/readScript/createCore) +
   `OcgCardStruct`/`PrimeRequest` interfaces; `OcgcoreSummonEngine` takes a provider. No dep on
   the JSR package inside `src/core` (lazy `import()` lives in the provider).
2. **Duel driver + worker verifier:** `enumerateSummonable()` (build board → MP1 → read
   `special_summons`); worker runs the parser, primes ocgcore with the candidate ids, filters.
3. **Node provider + build-time `cards.cdb` extraction** → compact code-keyed JSON.
4. **Browser provider:** lazy wasm import in the worker; fetch+cache card JSON + Lua.
   - ⚠️ `createCore` resolution differs from Node: there's no `createRequire`, and the
     `exports` map blocks the deep specifier, so the browser path needs a Vite
     `resolve.alias` (e.g. `@n1xx1/ocgcore-wasm` → `dist/index.js`) or a resolver
     plugin. Verify with a real Vite worker build (Stage 7).
   - ⚠️ The **sync** core calls readers synchronously, so the browser provider's
     `prepare()` must fetch the card JSON + the system scripts (`constant`/`utility`/
     all `proc_*.lua`) + the per-code candidate/material scripts into memory *first*,
     then serve `readCard`/`readScript` from that cache.
5. **Asset pipeline + AGPL/attribution** (`--with-ocgcore`, `THIRD_PARTY_LICENSES.md`).
6. **Parser permissiveness pass** (raise the candidate-recall ceiling).
7. **Validation harness + flip:** parser-vs-ocgcore equivalence (zero false positives, recall
   ≥ parser, latency budget) → flip `OCGCORE_ENABLED`.
