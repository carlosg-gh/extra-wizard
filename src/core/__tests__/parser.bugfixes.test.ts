import { describe, expect, it } from 'vitest';
import { parseFilters } from '../parser/grammar/shared';
import { parseMaterials } from '../parser/parseMaterials';

describe('parseFilters — Normal & abilities (bug #2)', () => {
  it('"Normal" → requireNonEffect (not requireEffect), exact', () => {
    const f = parseFilters('Normal Monster');
    expect(f.requireNonEffect).toBe(true);
    expect(f.requireEffect).toBeUndefined();
    expect(f.exact).toBe(true);
  });

  it('"non-Effect" → requireNonEffect', () => {
    expect(parseFilters('non-Effect Monster').requireNonEffect).toBe(true);
  });

  it('ability words captured against typeLineTags, exact', () => {
    expect(parseFilters('Flip monster')).toEqual(
      expect.objectContaining({ requireAbility: ['Flip'], exact: true }),
    );
    const g = parseFilters('Level 8 Gemini monster');
    expect(g.requireAbility).toEqual(['Gemini']);
    expect(g.level).toEqual([8]);
    expect(g.exact).toBe(true);
  });

  it('"Flip Effect Monster" → ability + requireEffect (both)', () => {
    const f = parseFilters('Flip Effect Monster');
    expect(f.requireAbility).toEqual(['Flip']);
    expect(f.requireEffect).toBe(true);
    expect(f.requireNonEffect).toBeUndefined();
  });
});

describe('parseMaterials — Synchro requireLevel (bug #1)', () => {
  it('every Synchro constraint requires a Level', () => {
    const paths = parseMaterials('1 Tuner + 1 or more non-Tuner monsters', {
      summonType: 'Synchro',
      level: 8,
      rank: null,
      linkRating: null,
    });
    const cs = paths[0].groups[0].constraints;
    expect(cs.length).toBeGreaterThan(0);
    expect(cs.every((c) => c.requireLevel === true)).toBe(true);
  });
});
