import { describe, expect, it } from 'vitest';
import { ctxOf, matchedIds, mkCard, mkEdm } from './helpers';

describe('match modes: any-subset vs use-all', () => {
  const a4 = mkCard({ id: 'a4', name: 'Lv4 A', level: 4 });
  const b4 = mkCard({ id: 'b4', name: 'Lv4 B', level: 4 });
  const c4 = mkCard({ id: 'c4', name: 'Lv4 C', level: 4 });
  const rank4 = mkEdm({ id: 'r4', name: 'Generic Rank 4', summonType: 'Xyz', rank: 4 }, '2 Level 4 monsters');

  it('any-subset matches when a subset suffices', () => {
    const ctx = ctxOf([rank4], [a4, b4, c4]);
    expect(matchedIds(ctx, ['a4', 'b4', 'c4'], 'any-subset').has('r4')).toBe(true);
  });

  it('use-all fails when not every provided card is consumed', () => {
    const ctx = ctxOf([rank4], [a4, b4, c4]);
    expect(matchedIds(ctx, ['a4', 'b4', 'c4'], 'use-all').has('r4')).toBe(false);
  });

  it('use-all matches when the whole set is exactly consumed', () => {
    const ctx = ctxOf([rank4], [a4, b4]);
    expect(matchedIds(ctx, ['a4', 'b4'], 'use-all').has('r4')).toBe(true);
  });
});
