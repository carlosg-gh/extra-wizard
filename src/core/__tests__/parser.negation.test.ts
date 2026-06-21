import { describe, expect, it } from 'vitest';
import { parseMaterials } from '../parser/parseMaterials';

const link = (m: string, linkRating = 1) =>
  parseMaterials(m, { summonType: 'Link', level: null, rank: null, linkRating })[0];

describe('parser — negation, Extra Monster Zone, Link rating', () => {
  it('"non-FIRE" → excludeAttribute (NOT a required attribute), and stays exact', () => {
    const p = link('1 non-FIRE "Sky Striker Ace" monster');
    expect(p.parseStatus).toBe('exact');
    const c = p.groups[0].constraints[0];
    expect(c).toMatchObject({ excludeAttribute: ['FIRE'], archetype: ['Sky Striker Ace'] });
    expect(c.attribute).toBeUndefined();
  });

  it('"non-Dragon" → excludeRace', () => {
    const p = link('2 non-Dragon monsters', 2);
    const c = p.groups[0].constraints[0];
    expect(c.excludeRace).toEqual(['Dragon']);
    expect(c.race).toBeUndefined();
  });

  it('"non-Synchro" generalizes to excludeSummonType', () => {
    const p = link('2 non-Synchro monsters', 2);
    expect(p.groups[0].constraints[0].excludeSummonType).toEqual(['Synchro']);
  });

  it('"in an Extra Monster Zone" → requireExtraDeck, exact (Gravity Controller)', () => {
    const p = link('1 non-Link Monster in an Extra Monster Zone');
    expect(p.parseStatus).toBe('exact');
    const c = p.groups[0].constraints[0];
    expect(c.requireExtraDeck).toBe(true);
    expect(c.excludeSummonType).toEqual(['Link']);
  });

  it('"Link-2 or higher Link Monster" → linkRatingMin, exact (Linkross)', () => {
    const p = link('1 Link-2 or higher Link Monster');
    expect(p.parseStatus).toBe('exact');
    expect(p.groups[0].constraints[0]).toMatchObject({
      requireSummonType: ['Link'],
      linkRatingMin: 2,
    });
  });

  it('bare "Link-3" pins both bounds', () => {
    const p = link('1 Link-3 monster');
    expect(p.groups[0].constraints[0]).toMatchObject({
      requireSummonType: ['Link'],
      linkRatingMin: 3,
      linkRatingMax: 3,
    });
  });
});
