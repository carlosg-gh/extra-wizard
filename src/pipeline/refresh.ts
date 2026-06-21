import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SUMMON_TYPES } from '../core/domain/enums';
import type { Card, ExtraDeckMonster } from '../core/domain/types';
import { buildExtraDeckMonster } from '../core/index-build/buildExtraDeckMonster';
import { buildIndex, type BuiltIndex } from '../core/index-build/buildIndex';
import { coveragePassRate, formatCoverage } from './report/coverage';
import type { CardSource } from './sources/types';
import { ygoprodeckSource } from './sources/ygoprodeck';
import { yamlYugiSource } from './sources/yamlYugi';

const OUT_DIR = resolve(process.cwd(), 'public', 'data');
const COVERAGE_THRESHOLD = 0.85;

/** Primary = YGOPRODeck (most complete; CI only); fallback = yaml-yugi (sandbox-reachable). */
function pickSources(args: Set<string>): CardSource[] {
  const forced = [...args].find((a) => a.startsWith('--source='))?.split('=')[1];
  if (forced === 'ygoprodeck') return [ygoprodeckSource];
  if (forced === 'yaml-yugi') return [yamlYugiSource];
  return [ygoprodeckSource, yamlYugiSource];
}

function sha(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

async function writeArtifacts(built: BuiltIndex): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const shards: Array<{ file: string; count: number; bytes: number; sha256: string }> = [];

  for (const type of SUMMON_TYPES) {
    const file = `index.${type.toLowerCase()}.json`;
    const json = JSON.stringify(built.monstersByType[type]);
    await writeFile(resolve(OUT_DIR, file), json);
    shards.push({ file, count: built.monstersByType[type].length, bytes: Buffer.byteLength(json), sha256: sha(json) });
  }

  const poolJson = JSON.stringify(built.inputPool);
  await writeFile(resolve(OUT_DIR, 'input-pool.json'), poolJson);
  shards.push({
    file: 'input-pool.json',
    count: built.inputPool.length,
    bytes: Buffer.byteLength(poolJson),
    sha256: sha(poolJson),
  });

  await writeFile(resolve(OUT_DIR, 'meta.json'), JSON.stringify(built.meta, null, 2));
  await writeFile(resolve(OUT_DIR, 'coverage.json'), JSON.stringify(built.meta.coverage, null, 2));
  await writeFile(
    resolve(OUT_DIR, 'manifest.json'),
    JSON.stringify({ generatedAt: built.meta.generatedAt, source: built.meta.source, shards }, null, 2),
  );
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const coverageOnly = args.has('--coverage-only');
  const limitArg = [...args].find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

  // Try sources in order until one is reachable.
  const sources = pickSources(args);
  let chosen: { source: CardSource; raws: unknown[]; url: string } | null = null;
  for (const source of sources) {
    try {
      console.log(`Fetching from ${source.name}...`);
      const { raws, url } = await source.fetchRaw();
      chosen = { source, raws, url };
      console.log(`Fetched ${raws.length} records from ${source.name} (${url})`);
      break;
    } catch (err) {
      console.warn(`  [${source.name}] ${(err as Error).message}`);
    }
  }
  if (!chosen) throw new Error('No card source reachable.');

  const { source, raws, url } = chosen;
  const inputPool: Card[] = [];
  const monsters: ExtraDeckMonster[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let processed = 0;

  for (const raw of raws) {
    if (processed >= limit) break;
    const normalized = source.normalize(raw);
    if (!normalized) {
      skipped += 1;
      continue;
    }
    const { card, materialsText, fullText } = normalized;
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    inputPool.push(card);
    if (card.summonType) {
      const edm = buildExtraDeckMonster(card, materialsText, fullText);
      if (edm) monsters.push(edm);
    }
    processed += 1;
  }

  const built = buildIndex(inputPool, monsters, `${source.name}:${url}`);
  console.log(`\nMonsters (usable as materials): ${inputPool.length}`);
  console.log(`Extra Deck monsters: ${monsters.length}  (skipped ${skipped} non-monster/invalid records)`);
  console.log(formatCoverage(built.meta.coverage));

  if (!coverageOnly) {
    await writeArtifacts(built);
    console.log(`\nWrote artifacts to ${OUT_DIR}`);

    // Opt-in (and non-fatal): extract the ocgcore card-data shard from the vendored
    // BabelCDB. Needs `pnpm vendor:ocgcore` + node --experimental-sqlite (use the
    // `data:ocgcore` script); otherwise it logs and skips, like `--with-images`.
    if (args.has('--with-ocgcore')) {
      try {
        const { buildOcgcoreAssets } = await import('./ocgcore/buildOcgcoreAssets');
        const codes = built.inputPool
          .map((c) => c.password)
          .filter((p): p is number => p != null);
        const cdb = resolve(process.cwd(), 'vendor', 'ocgcore', 'BabelCDB', 'cards.cdb');
        const r = await buildOcgcoreAssets({ codes, cdbPaths: [cdb], outDir: OUT_DIR });
        console.log(
          `ocgcore: ${r.count} cards (${(r.bytes / 1024).toFixed(0)} KB, ${r.missing} missing) → ${OUT_DIR}/ocgcore`,
        );
      } catch (err) {
        console.warn(`[--with-ocgcore] skipped: ${(err as Error).message}`);
      }
    }
  }

  const rate = coveragePassRate(built.meta.coverage);
  console.log(`\nCoverage pass rate: ${(rate * 100).toFixed(1)}%`);
  if (rate < COVERAGE_THRESHOLD) {
    console.error(`Below threshold ${(COVERAGE_THRESHOLD * 100).toFixed(0)}% - failing.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
