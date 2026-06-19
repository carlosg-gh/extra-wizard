import { describe, expect, it } from 'vitest';
import { parseMaterials } from '../parser/parseMaterials';

const link = (m: string, linkRating: number) =>
  parseMaterials(m, { summonType: 'Link', level: null, rank: null, linkRating })[0];

describe('link parser', () => {
  it('parses "2 monsters"', () => {
    const p = link('2 monsters', 2);
    expect(p.parseStatus).toBe('exact');
    expect(p.groups[0].linkContribTarget).toBe(2);
    expect(p.groups[0].constraints[0]).toMatchObject({ min: 2, max: 2 });
  });

  it('parses "2 Effect Monsters"', () => {
    const p = link('2 Effect Monsters', 2);
    expect(p.parseStatus).toBe('exact');
    expect(p.groups[0].constraints[0]).toMatchObject({ requireEffect: true, min: 2, max: 2 });
  });

  it('parses an archetype restriction', () => {
    const p = link('3 "Tindangle" monsters', 3);
    expect(p.parseStatus).toBe('exact');
    expect(p.groups[0].constraints[0]).toMatchObject({ archetype: ['Tindangle'], min: 3, max: 3 });
  });

  it('parses "2+ monsters with different names" and caps max at the rating', () => {
    const p = link('2+ monsters with different names', 3);
    expect(p.parseStatus).toBe('exact');
    expect(p.groups[0].uniqueness).toBe('names');
    expect(p.groups[0].constraints[0]).toMatchObject({ min: 2, max: 3 });
  });

  it('parses a Cyberse type restriction', () => {
    const p = link('2 Cyberse monsters', 2);
    expect(p.parseStatus).toBe('exact');
    expect(p.groups[0].constraints[0]).toMatchObject({ race: ['Cyberse'], min: 2, max: 2 });
  });
});
