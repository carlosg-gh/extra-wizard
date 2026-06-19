import { describe, expect, it } from 'vitest';
import { parseMaterials } from '../parser/parseMaterials';
import { ctxOf, matchedIds, mkCard, mkEdm } from './helpers';

const fusion = (m: string) =>
  parseMaterials(m, { summonType: 'Fusion', level: null, rank: null, linkRating: null })[0];

describe('level-range materials', () => {
  it('parses "Level N or higher"', () => {
    const p = fusion('1 "Eldlich" monster + 1 Level 5 or higher Zombie-Type monster');
    expect(p.parseStatus).toBe('exact');
    expect(p.groups[0].constraints[1]).toMatchObject({ levelMin: 5, race: ['Zombie'] });
  });

  it('parses "Level N or lower"', () => {
    const p = fusion('1 Level 4 or lower Dragon monster');
    expect(p.parseStatus).toBe('exact');
    expect(p.groups[0].constraints[0]).toMatchObject({ levelMax: 4, race: ['Dragon'] });
  });

  it('matches within the range only', () => {
    const mon = mkEdm(
      { id: 'F', name: 'RangeFusion', summonType: 'Fusion' },
      '1 Level 4 or lower Dragon monster',
    );
    const lo = mkCard({ id: 'lo', name: 'Lv3 Dragon', level: 3, race: 'Dragon' });
    const hi = mkCard({ id: 'hi', name: 'Lv6 Dragon', level: 6, race: 'Dragon' });
    const ctx = ctxOf([mon], [lo, hi]);
    expect(matchedIds(ctx, ['lo'], 'any-subset').has('F')).toBe(true);
    expect(matchedIds(ctx, ['hi'], 'any-subset').has('F')).toBe(false);
  });
});
