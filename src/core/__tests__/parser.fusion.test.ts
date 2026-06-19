import { describe, expect, it } from 'vitest';
import { parseMaterials } from '../parser/parseMaterials';

const fusion = (m: string) =>
  parseMaterials(m, { summonType: 'Fusion', level: null, rank: null, linkRating: null })[0];

describe('fusion parser', () => {
  it('parses two named vanilla materials', () => {
    const p = fusion('"Trakodon" + "Flame Viper"');
    expect(p.parseStatus).toBe('exact');
    expect(p.groups[0].constraints).toHaveLength(2);
    expect(p.groups[0].constraints[0]).toMatchObject({ namedCards: ['Trakodon'], min: 1, max: 1 });
    expect(p.groups[0].constraints[1]).toMatchObject({ namedCards: ['Flame Viper'], min: 1, max: 1 });
  });

  it('parses named + generic OR-attribute', () => {
    const p = fusion('"Dark Magician" + 1 LIGHT or DARK monster');
    expect(p.parseStatus).toBe('exact');
    expect(p.groups[0].constraints[0]).toMatchObject({ namedCards: ['Dark Magician'] });
    expect(p.groups[0].constraints[1]).toMatchObject({ attribute: ['LIGHT', 'DARK'], min: 1, max: 1 });
  });

  it('parses archetype + generic', () => {
    const p = fusion('1 "Despia" monster + 1 LIGHT or DARK monster');
    expect(p.parseStatus).toBe('exact');
    expect(p.groups[0].constraints[0]).toMatchObject({ archetype: ['Despia'], min: 1, max: 1 });
  });

  it('parses generic count + race', () => {
    const p = fusion('5 Dragon monsters');
    expect(p.parseStatus).toBe('exact');
    expect(p.groups[0].constraints[0]).toMatchObject({ race: ['Dragon'], min: 5, max: 5 });
  });

  it('flags a leftover stat clause as approximate', () => {
    const p = fusion('1 "Yubel" monster + 1 Fiend-Type monster with 0 ATK and DEF');
    expect(p.parseStatus).toBe('approximate');
    expect(p.groups[0].constraints[1]).toMatchObject({ race: ['Fiend'] });
  });
});
