import { describe, expect, it } from 'vitest';
import type { MatchResult, ResultMonster } from '../../data/types';
import { activeFilterCount, applyFilters, deriveFacets } from './filterState';

function mk(over: Partial<ResultMonster>): MatchResult {
  return {
    monster: {
      id: 'x',
      password: null,
      konamiId: 0,
      name: 'X',
      race: 'Dragon',
      typeLineTags: ['Synchro'],
      attribute: 'WIND',
      level: 8,
      rank: null,
      linkRating: null,
      linkArrows: null,
      atk: 2000,
      def: 2000,
      series: [],
      isTuner: false,
      isEffect: true,
      isToken: false,
      isPendulum: false,
      isFusionSubstitute: false,
      summonType: 'Synchro',
      materialsRaw: '',
      imageId: 'x',
      parseStatus: 'exact',
      ...over,
    } as ResultMonster,
  };
}

describe('filterState — ability facet & filter', () => {
  const results = [
    mk({ id: 'a', typeLineTags: ['Synchro', 'Tuner'] }),
    mk({ id: 'b', typeLineTags: ['Synchro'] }),
    mk({ id: 'c', summonType: 'Xyz', typeLineTags: ['Xyz', 'Pendulum', 'Effect'] }),
  ];

  it('derives abilities, excluding summon mechanics and Effect', () => {
    expect(deriveFacets(results).abilities).toEqual(['Pendulum', 'Tuner']);
  });

  it('filters by ability tag', () => {
    const ids = applyFilters(results, { ability: ['Tuner'] }).map((r) => r.monster.id);
    expect(ids).toEqual(['a']);
  });

  it('counts active filter groups', () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ ability: ['Tuner'], atk: { min: 2000 } })).toBe(2);
    expect(activeFilterCount({ atk: {} })).toBe(0);
  });
});
