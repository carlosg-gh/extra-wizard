import { describe, expect, it } from 'vitest';
import { parseMaterials } from '../parser/parseMaterials';

const syn = (m: string, level: number) =>
  parseMaterials(m, { summonType: 'Synchro', level, rank: null, linkRating: null })[0];

describe('synchro parser', () => {
  it('parses the standard 1 Tuner + 1 or more non-Tuner', () => {
    const p = syn('1 Tuner + 1 or more non-Tuner monsters', 8);
    expect(p.parseStatus).toBe('exact');
    expect(p.groups[0].synchroTargetLevel).toBe(8);
    expect(p.groups[0].constraints[0]).toMatchObject({ requireTuner: true, min: 1, max: 1 });
    expect(p.groups[0].constraints[1]).toMatchObject({ requireNonTuner: true, min: 1, max: null });
  });

  it('parses the "1+" shorthand', () => {
    const p = syn('1 Tuner + 1+ non-Tuner monsters', 7);
    expect(p.parseStatus).toBe('exact');
    expect(p.groups[0].constraints[1]).toMatchObject({ requireNonTuner: true, min: 1, max: null });
  });

  it('parses an archetype Tuner', () => {
    const p = syn('1 "Vylon" Tuner + 1 or more non-Tuner monsters', 6);
    expect(p.parseStatus).toBe('exact');
    expect(p.groups[0].constraints[0]).toMatchObject({ requireTuner: true, archetype: ['Vylon'] });
  });

  it('parses attribute-restricted Tuner and non-Tuner', () => {
    const p = syn('1 LIGHT Tuner + 1 or more non-Tuner DARK monsters', 5);
    expect(p.parseStatus).toBe('exact');
    expect(p.groups[0].constraints[0]).toMatchObject({ requireTuner: true, attribute: ['LIGHT'] });
    expect(p.groups[0].constraints[1]).toMatchObject({ requireNonTuner: true, attribute: ['DARK'] });
  });

  it('parses a race-restricted single non-Tuner', () => {
    const p = syn('1 Tuner + 1 non-Tuner Spellcaster-Type monster', 7);
    expect(p.parseStatus).toBe('exact');
    expect(p.groups[0].constraints[1]).toMatchObject({
      requireNonTuner: true,
      race: ['Spellcaster'],
      min: 1,
      max: 1,
    });
  });

  it('flags a trailing stat clause as approximate', () => {
    const p = syn('1 Tuner + 1 or more non-Tuner monsters with 2500 original ATK & DEF', 9);
    expect(p.parseStatus).toBe('approximate');
    // still captured the structural counts
    expect(p.groups[0].constraints[0]).toMatchObject({ requireTuner: true });
  });

  it('parses multi-Tuner wording', () => {
    const p = syn('2 Tuners + 1 non-Tuner monster', 10);
    expect(p.groups[0].constraints[0]).toMatchObject({ requireTuner: true, min: 2, max: 2 });
    expect(p.groups[0].constraints[1]).toMatchObject({ requireNonTuner: true, min: 1, max: 1 });
  });
});
