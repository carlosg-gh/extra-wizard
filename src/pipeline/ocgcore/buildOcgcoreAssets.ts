/**
 * Build-time extraction of the card data ocgcore needs (incl. real 64-bit setcodes)
 * from BabelCDB `cards.cdb` into a compact, code-keyed JSON — so the browser provider
 * reads one small JSON instead of shipping SQLite + the multi-MB .cdb at runtime.
 * Node-only; emitted to `public/data/ocgcore/` (git-ignored, opt-in via `--with-ocgcore`).
 */
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { SerializedCardStruct } from '../../core/matching/engines/ocgcore/types';
import { createNodeProvider } from './nodeProvider';

export interface BuildOcgcoreAssetsOptions {
  /** Passcodes to extract (e.g. every monster in the input pool + Extra Deck). */
  codes: Iterable<number>;
  /** BabelCDB `cards.cdb` path(s), queried in order. */
  cdbPaths: string[];
  /** `public/data` (the `ocgcore/` subdir is created under it). */
  outDir: string;
  /** Provenance string for the manifest (e.g. the pinned BabelCDB SHA). */
  cdbLabel?: string;
}

export interface BuildOcgcoreAssetsResult {
  count: number;
  missing: number;
  bytes: number;
  sha256: string;
}

export async function buildOcgcoreAssets(
  opts: BuildOcgcoreAssetsOptions,
): Promise<BuildOcgcoreAssetsResult> {
  // readCard reuses the exact cdb→struct mapping (setcode unpack, level/scale split,
  // link-marker-from-def). scriptRoot is unused here (extraction reads no Lua).
  const provider = createNodeProvider({ cdbPaths: opts.cdbPaths, scriptRoot: '' });

  const cards: Record<string, SerializedCardStruct> = {};
  const seen = new Set<number>();
  let missing = 0;
  for (const code of opts.codes) {
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const s = provider.readCard(code);
    if (!s) {
      missing += 1;
      continue;
    }
    cards[code] = { ...s, race: s.race.toString() };
  }

  const json = JSON.stringify(cards);
  const sha256 = createHash('sha256').update(json).digest('hex').slice(0, 16);
  const dir = join(opts.outDir, 'ocgcore');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'cards.codes.json'), json);

  // Self-host the (small) sync WASM so the browser provider can fetch it as a plain
  // asset and pass it as `wasmBinary` — avoiding the package's blocked `lib/*.wasm`
  // subpath and any bundler wasm-URL guesswork. (Per-card Lua is lazy-fetched from a
  // pinned CDN at runtime; not bundled here.)
  const req = createRequire(import.meta.url);
  const wasmSrc = req.resolve('@n1xx1/ocgcore-wasm').replace(/mod\.js$/, 'lib/ocgcore.sync.wasm');
  await copyFile(wasmSrc, join(dir, 'ocgcore.sync.wasm'));
  await writeFile(
    join(dir, 'manifest.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        cdb: opts.cdbLabel ?? opts.cdbPaths.join(','),
        cards: 'cards.codes.json',
        count: Object.keys(cards).length,
        missing,
        sha256,
      },
      null,
      2,
    ),
  );

  return { count: Object.keys(cards).length, missing, bytes: Buffer.byteLength(json), sha256 };
}
