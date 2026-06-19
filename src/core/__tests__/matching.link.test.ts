import { describe, expect, it } from 'vitest';
import { ctxOf, matchedIds, mkCard, mkEdm } from './helpers';

describe('link matching (contribution sum)', () => {
  const m1 = mkCard({ id: 'm1', name: 'Mon A', level: 4 });
  const m2 = mkCard({ id: 'm2', name: 'Mon B', level: 4 });
  const m3 = mkCard({ id: 'm3', name: 'Mon C', level: 3 });
  const link2 = mkCard({ id: 'l2', name: 'Some Link-2', linkRating: 2, summonType: 'Link' });

  const link2req = mkEdm({ id: 'L2', name: 'Generic Link-2', summonType: 'Link', linkRating: 2 }, '2 monsters');
  const knightmare = mkEdm(
    { id: 'L3', name: 'Different-Name Link-3', summonType: 'Link', linkRating: 3 },
    '2+ monsters with different names',
  );

  it('matches a Link-2 from any two monsters', () => {
    const ctx = ctxOf([link2req], [m1, m2]);
    expect(matchedIds(ctx, ['m1', 'm2'], 'any-subset').has('L2')).toBe(true);
  });

  it('Link-3 needs contributions to sum to 3 (three normal monsters)', () => {
    const ctx = ctxOf([knightmare], [m1, m2, m3]);
    expect(matchedIds(ctx, ['m1', 'm2', 'm3'], 'any-subset').has('L3')).toBe(true);
  });

  it('Link-3 NOT made from two normal monsters (contribution only 2)', () => {
    const ctx = ctxOf([knightmare], [m1, m2]);
    expect(matchedIds(ctx, ['m1', 'm2'], 'any-subset').has('L3')).toBe(false);
  });

  it('Link-3 made from a Link-2 + one monster (2 + 1)', () => {
    const ctx = ctxOf([knightmare], [link2, m1]);
    expect(matchedIds(ctx, ['l2', 'm1'], 'any-subset').has('L3')).toBe(true);
  });

  it('enforces the different-names uniqueness rule', () => {
    const dupA = mkCard({ id: 'd1', name: 'Same Name', level: 4 });
    const dupB = mkCard({ id: 'd2', name: 'Same Name', level: 4 });
    const dupC = mkCard({ id: 'd3', name: 'Same Name', level: 4 });
    const ctx = ctxOf([knightmare], [dupA, dupB, dupC]);
    expect(matchedIds(ctx, ['d1', 'd2', 'd3'], 'any-subset').has('L3')).toBe(false);
  });
});
