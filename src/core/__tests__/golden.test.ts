import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runQuery } from '../matching';
import type { Card, ExtraDeckMonster } from '../domain/types';

const DIR = resolve(process.cwd(), 'public', 'data');
const HAS_INDEX = existsSync(resolve(DIR, 'input-pool.json'));

const read = <T>(file: string): T => JSON.parse(readFileSync(resolve(DIR, file), 'utf8')) as T;

// Skips cleanly if the index hasn't been generated (e.g. fresh clone before `data:refresh`).
const suite = HAS_INDEX ? describe : describe.skip;

suite('golden query against the built index', () => {
  const pool = read<Card[]>('input-pool.json');
  const monsters = (['fusion', 'synchro', 'xyz', 'link'] as const).flatMap((t) =>
    read<ExtraDeckMonster[]>(`index.${t}.json`),
  );
  const cardsById = new Map(pool.map((c) => [c.id, c]));

  it('two Level 4 main-deck monsters can make at least one Rank 4 Xyz', () => {
    const lvl4 = pool.filter((c) => c.level === 4 && c.summonType === null).slice(0, 2);
    expect(lvl4.length).toBe(2);
    const res = runQuery(
      { cardIds: lvl4.map((c) => c.id), mode: 'any-subset' },
      { monsters, cardsById },
    );
    expect(res.items.some((it) => it.summonType === 'Xyz')).toBe(true);
  });

  it('parses the vast majority of Extra Deck monsters', () => {
    const parsed = monsters.filter((m) => m.parseStatus !== 'unparsed').length;
    expect(parsed / monsters.length).toBeGreaterThan(0.9);
  });
});
