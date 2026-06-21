/**
 * Build-time extraction of the card data ocgcore needs (incl. real 64-bit setcodes)
 * from BabelCDB `cards.cdb` into a compact, code-keyed JSON — so the browser provider
 * reads one small JSON instead of shipping SQLite + the multi-MB .cdb at runtime.
 * Node-only; emitted to `public/data/ocgcore/` (git-ignored, opt-in via `--with-ocgcore`).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createNodeProvider } from './nodeProvider';

/** JSON-safe {@link OcgCardStruct}: `race` (a 64-bit bigint) is a decimal string. */
export interface SerializedCardStruct {
  code: number;
  alias: number;
  setcodes: number[];
  type: number;
  level: number;
  attribute: number;
  race: string;
  attack: number;
  defense: number;
  lscale: number;
  rscale: number;
  link_marker: number;
}

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
