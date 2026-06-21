# Third-party notices

This project bundles or relies on third-party works. Notices below.

## ocgcore-wasm engine (feature-flagged, `OCGCORE_ENABLED`)

> [!IMPORTANT]
> **Legal review required before enabling this on the public deployment.** The engine
> and card scripts are **AGPL-3.0**. Serving the compiled WebAssembly (or the Lua
> scripts) from the public site is "conveying"/network use of AGPL works and triggers
> **corresponding-source-availability** obligations. The notices here are a starting
> point, not legal advice. The engine ships **OFF by default**; do not flip the flag
> for a public build until this is signed off.

| Component | Used for | License | Upstream (pinned) |
| --- | --- | --- | --- |
| [`@n1xx1/ocgcore-wasm`](https://github.com/n1xx1/ocgcore-wasm) | WASM build + JS bindings | **MIT** (wrapper) | npm via JSR `@jsr/n1xx1__ocgcore-wasm@0.1.3` |
| [edo9300/ygopro-core](https://github.com/edo9300/ygopro-core) | the rules engine compiled **into** the above `.wasm` | **AGPL-3.0** | bundled in `@n1xx1/ocgcore-wasm@0.1.3` |
| [ProjectIgnis/CardScripts](https://github.com/ProjectIgnis/CardScripts) | per-card Lua rules | **AGPL-3.0** | `6329dd086a6c8304f8e619b6da2ac9599924b690` |
| [ProjectIgnis/BabelCDB](https://github.com/ProjectIgnis/BabelCDB) | card data (`cards.cdb`) | no explicit license in-repo — **confirm terms** | `0513c77d30b0656652b1e05cf959b339c0b1dd16` |

Notes:

- The pinned commits above are vendored on demand by `pnpm vendor:ocgcore` into the
  git-ignored `vendor/ocgcore/` and are **not** redistributed in this repository.
- Bump BabelCDB and CardScripts **together** (setcodes must match the script dialect).
- **Corresponding source** for the AGPL components is their upstream repositories at the
  pinned commits above; a public build that serves the `.wasm`/scripts must provide a
  prominent link to that source (an in-app credit is the intended mechanism).
- We extract only the card fields the engine needs from `cards.cdb` into
  `public/data/ocgcore/cards.codes.json` at build time (no SQLite ships at runtime).

## Card data sources (pre-existing, main shipping path)

- **YGOPRODeck** (primary, CI/deploy) and **yaml-yugi** (fallback) — see `CLAUDE.md`.
  Card images are hotlinked from YGOPRODeck; see `src/app/lib/images.ts`.
