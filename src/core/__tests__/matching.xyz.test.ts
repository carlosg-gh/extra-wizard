import { describe, expect, it } from 'vitest';
import { ctxOf, matchedIds, mkCard, mkEdm } from './helpers';

describe('xyz matching (same-level count)', () => {
  const a4 = mkCard({ id: 'a4', name: 'Lv4 A', level: 4 });
  const b4 = mkCard({ id: 'b4', name: 'Lv4 B', level: 4 });
  const c5 = mkCard({ id: 'c5', name: 'Lv5 C', level: 5 });

  const rank4 = mkEdm({ id: 'r4', name: 'Generic Rank 4', summonType: 'Xyz', rank: 4 }, '2 Level 4 monsters');
  const rank5 = mkEdm({ id: 'r5', name: 'Generic Rank 5', summonType: 'Xyz', rank: 5 }, '2 Level 5 monsters');
  const rank4dragon = mkEdm(
    { id: 'r4d', name: 'Rank 4 Dragon', summonType: 'Xyz', rank: 4 },
    '2 Level 4 Dragon monsters',
  );

  it('matches generic Rank 4 from two Level 4s, not Rank 5', () => {
    const ctx = ctxOf([rank4, rank5, rank4dragon], [a4, b4, c5]);
    const ids = matchedIds(ctx, ['a4', 'b4', 'c5'], 'any-subset');
    expect(ids.has('r4')).toBe(true);
    expect(ids.has('r5')).toBe(false);
    expect(ids.has('r4d')).toBe(false); // Level 4s aren't Dragons
  });

  it('excludes Tokens as Xyz materials', () => {
    const token4 = mkCard({ id: 'tk', name: 'Token Lv4', level: 4, isToken: true });
    const ctx = ctxOf([rank4], [a4, token4]);
    // only one valid (non-Token) Level 4 → cannot make a 2-material Rank 4
    expect(matchedIds(ctx, ['a4', 'tk'], 'any-subset').has('r4')).toBe(false);
  });
});
