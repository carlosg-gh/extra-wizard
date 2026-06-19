import type { ParseStatus, SummonType } from '../domain/enums';
import { SUMMON_TYPES } from '../domain/enums';
import type { Card, ExtraDeckMonster } from '../domain/types';

export interface CoverageBucket {
  exact: number;
  approximate: number;
  unparsed: number;
  total: number;
}

export interface Coverage {
  overall: CoverageBucket;
  byType: Record<SummonType, CoverageBucket>;
  /** Capped samples of raw material strings, for the validate-coverage skill. */
  samples: { approximate: string[]; unparsed: string[] };
}

export interface IndexMeta {
  generatedAt: string;
  source: string;
  counts: {
    inputPool: number;
    monsters: number;
    byType: Record<SummonType, number>;
  };
  coverage: Coverage;
}

export interface BuiltIndex {
  monstersByType: Record<SummonType, ExtraDeckMonster[]>;
  inputPool: Card[];
  meta: IndexMeta;
}

const SAMPLE_CAP = 60;

function emptyBucket(): CoverageBucket {
  return { exact: 0, approximate: 0, unparsed: 0, total: 0 };
}

function tally(bucket: CoverageBucket, status: ParseStatus): void {
  bucket[status] += 1;
  bucket.total += 1;
}

export function buildIndex(
  inputPool: Card[],
  monsters: ExtraDeckMonster[],
  source: string,
): BuiltIndex {
  const monstersByType = Object.fromEntries(
    SUMMON_TYPES.map((t) => [t, [] as ExtraDeckMonster[]]),
  ) as Record<SummonType, ExtraDeckMonster[]>;

  const overall = emptyBucket();
  const byType = Object.fromEntries(SUMMON_TYPES.map((t) => [t, emptyBucket()])) as Record<
    SummonType,
    CoverageBucket
  >;
  const samples: Coverage['samples'] = { approximate: [], unparsed: [] };

  for (const m of monsters) {
    monstersByType[m.summonType].push(m);
    tally(overall, m.parseStatus);
    tally(byType[m.summonType], m.parseStatus);
    if (m.parseStatus === 'approximate' && samples.approximate.length < SAMPLE_CAP) {
      samples.approximate.push(`${m.name}: ${m.materialsRaw}`);
    } else if (m.parseStatus === 'unparsed' && samples.unparsed.length < SAMPLE_CAP) {
      samples.unparsed.push(`${m.name}: ${m.materialsRaw}`);
    }
  }

  const meta: IndexMeta = {
    generatedAt: new Date().toISOString(),
    source,
    counts: {
      inputPool: inputPool.length,
      monsters: monsters.length,
      byType: Object.fromEntries(
        SUMMON_TYPES.map((t) => [t, monstersByType[t].length]),
      ) as Record<SummonType, number>,
    },
    coverage: { overall, byType, samples },
  };

  return { monstersByType, inputPool, meta };
}
