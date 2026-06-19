# Extra Wizard

A website of YuGiOh deckbuilding tools. The first tool is the **Extra Deck Monster
Searcher**: give it the monster cards you control, and it shows every Extra Deck monster
(Fusion / Synchro / Xyz / Link) you could summon from them as materials — with filters to
narrow the results.

## How it works

- A **build-time pipeline** downloads card data ([yaml-yugi](https://github.com/DawnbrandBots/yaml-yugi))
  and parses each Extra Deck monster's free-text material requirement into a structured
  schema, so the app itself only does fast, simple matching.
- Matching runs in a **Web Worker** for a responsive UI; filtering happens instantly on the
  results.
- Two match modes:
  - **Any subset** — everything summonable using *some* of your cards (discovery).
  - **Use all** — only what consumes *every* card you provided.
- A match is marked **approx** when the card's wording was only partially parsed; such
  results may be over-inclusive. Material text that can't be parsed at all is hidden by
  default.

## Quick start

```bash
pnpm install
pnpm data:refresh   # fetch + parse card data into public/data (committed; run to update)
pnpm dev            # http://localhost:5173
```

Other commands: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

## Tech

React + TypeScript + Vite, fully client-side (static hosting). Pure domain logic lives in
`src/core` (parser + matching), shared by the app, the data pipeline, and the tests. See
[`CLAUDE.md`](./CLAUDE.md) for architecture and contributor notes.

## Roadmap

- Decklist / YDKE import (decoder already in `src/app/lib/ydke.ts`).
- Curated overrides for effect-text alternative summons (e.g. TY-PHON).
- Optional [ocgcore-wasm](https://github.com/n1xx1/ocgcore-wasm) engine for the long tail.

## Data & credits

Card data from **yaml-yugi** (DawnbrandBots). Card images from **YGOPRODeck**. Card names,
text, and images are © Studio Dice / SHUEISHA / TV TOKYO / KONAMI; this is an unofficial
fan tool. Per YGOPRODeck's policy, re-host or proxy card images in production rather than
hotlinking.
