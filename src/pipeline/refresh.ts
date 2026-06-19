import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SUMMON_TYPES } from '../core/domain/enums';
import type { Card, ExtraDeckMonster } from '../core/domain/types';
import { buildExtraDeckMonster } from '../core/index-build/buildExtraDeckMonster';
import { buildIndex, type BuiltIndex } from '../core/index-build/buildIndex';
import { normalizeCard, pickMaterials } from '../core/index-build/normalizeCard';
import { coveragePassRate, formatCoverage } from './report/coverage';
import { RawCardSchema } from './schema/yamlYugiCard';
import { fetchYamlYugi } from './sources/yamlYugi';

const OUT_DIR = resolve(process.cwd(), 'public', 'data');
const COVERAGE_THRESHOLD = 0.85;

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

  console.log('Fetching yaml-yugi aggregate…');
  const { raws, source } = await fetchYamlYugi();
  console.log(`Fetched ${raws.length} records from ${source}`);

  const inputPool: Card[] = [];
  const monsters: ExtraDeckMonster[] = [];
  const seen = new Set<string>();
  let invalid = 0;
  let processed = 0;

  for (const raw of raws) {
    if (processed >= limit) break;
    const parsed = RawCardSchema.safeParse(raw);
    if (!parsed.success) {
      invalid += 1;
      continue;
    }
    const card = normalizeCard(parsed.data);
    if (!card || seen.has(card.id)) continue;
    seen.add(card.id);
    inputPool.push(card);
    if (card.summonType) {
      const edm = buildExtraDeckMonster(card, pickMaterials(parsed.data));
      if (edm) monsters.push(edm);
    }
    processed += 1;
  }

  const built = buildIndex(inputPool, monsters, source);
  console.log(`\nMonsters (usable as materials): ${inputPool.length}`);
  console.log(`Extra Deck monsters: ${monsters.length}  (skipped ${invalid} invalid records)`);
  console.log(formatCoverage(built.meta.coverage));

  if (!coverageOnly) {
    await writeArtifacts(built);
    console.log(`\nWrote artifacts to ${OUT_DIR}`);
  }

  const rate = coveragePassRate(built.meta.coverage);
  console.log(`\nCoverage pass rate: ${(rate * 100).toFixed(1)}%`);
  if (rate < COVERAGE_THRESHOLD) {
    console.error(`Below threshold ${(COVERAGE_THRESHOLD * 100).toFixed(0)}% — failing.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
