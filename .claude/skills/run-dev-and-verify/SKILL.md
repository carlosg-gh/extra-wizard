---
name: run-dev-and-verify
description: Run the app and confirm a change works end-to-end (use after UI/matching changes, or when asked to "run it" / "check it works" / "show the app").
---

# Run dev & verify

## Steps

1. Ensure data exists: if `public/data/input-pool.json` is missing, run `pnpm data:refresh`.
2. Start the dev server: `pnpm dev` (default http://localhost:5173).
3. Canonical smoke query: search and add two **Level 4** monsters, keep mode on **Any
   subset** → expect several generic **Rank 4 Xyz** results. Switch to **Use all** with
   exactly those two → the same Rank 4s should remain; adding a third Level 4 should drop
   the 2-material Xyz in "use all".
4. Spot-check a Synchro: add a Level 3 **Tuner** + a Level 5 non-Tuner → expect Level 8
   generic Synchros.
5. Confirm: the "approx" badge appears on partially-parsed cards, "Why it matches" expands,
   and changing **filters** updates results instantly (no worker spinner — filters run on
   the main thread).

For a non-interactive check, the golden test (`pnpm test`) runs a real query against the
built index. For production, `pnpm build:app` then `pnpm preview`.
