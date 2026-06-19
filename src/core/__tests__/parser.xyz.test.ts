import { describe, expect, it } from 'vitest';
import { parseMaterials } from '../parser/parseMaterials';

const xyz = (m: string, rank: number) =>
  parseMaterials(m, { summonType: 'Xyz', level: null, rank, linkRating: null })[0];

describe('xyz parser', () => {
  it('parses "2 Level 4 monsters"', () => {
    const p = xyz('2 Level 4 monsters', 4);
    expect(p.parseStatus).toBe('exact');
    expect(p.targetRank).toBe(4);
    expect(p.groups[0].constraints[0]).toMatchObject({
      min: 2,
      max: 2,
      level: [4],
      tokenAllowed: false,
    });
  });

  it('parses a race restriction (hyphenated)', () => {
    const p = xyz('2 Level 7 Dragon-Type monsters', 7);
    expect(p.parseStatus).toBe('exact');
    expect(p.groups[0].constraints[0]).toMatchObject({ level: [7], race: ['Dragon'], min: 2, max: 2 });
  });

  it('parses newer race wording without -Type', () => {
    const p = xyz('3 Level 6 Winged Beast monsters', 6);
    expect(p.parseStatus).toBe('exact');
    expect(p.groups[0].constraints[0]).toMatchObject({
      level: [6],
      race: ['Winged Beast'],
      min: 3,
      max: 3,
    });
  });

  it('defaults the material level to the Rank when omitted', () => {
    const p = xyz('2 monsters', 4);
    expect(p.groups[0].constraints[0]).toMatchObject({ level: [4], min: 2, max: 2 });
  });
});
