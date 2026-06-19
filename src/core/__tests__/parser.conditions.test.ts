import { describe, expect, it } from 'vitest';
import {
  detectContactFusion,
  extractAlternativePaths,
  extractRestrictions,
} from '../parser/grammar/conditions';

describe('extractRestrictions', () => {
  it('forbids the named native mechanic', () => {
    expect(extractRestrictions('Cannot be Synchro Summoned.').forbiddenNative).toEqual(['Synchro']);
    expect(
      extractRestrictions('Cannot be Fusion Summoned. Cannot be Xyz Summoned.').forbiddenNative.sort(),
    ).toEqual(['Fusion', 'Xyz']);
  });

  it('does NOT forbid on bare / zone Special-Summon rules or affirmations', () => {
    expect(extractRestrictions('Cannot be Special Summoned from the GY.').forbiddenNative).toEqual([]);
    expect(extractRestrictions('Must be Synchro Summoned.').forbiddenNative).toEqual([]);
  });
});

describe('extractAlternativePaths — tribute special summon', () => {
  it('Bishbaalkin-style: "by Tributing 5 Zombie monsters"', () => {
    const text =
      'Cannot be Synchro Summoned. Must first be Special Summoned (from your hand) by Tributing 5 Zombie monsters.';
    const paths = extractAlternativePaths(text, 'Synchro');
    expect(paths).toHaveLength(1);
    expect(paths[0]).toEqual(
      expect.objectContaining({
        method: 'special-condition',
        costKind: 'tribute',
        requiresExtraCard: false,
        exact: true,
      }),
    );
    expect(paths[0].group.constraints).toEqual([
      expect.objectContaining({ min: 5, max: 5, race: ['Zombie'] }),
    ]);
  });
});

describe('extractAlternativePaths — send-from-field with breakdown', () => {
  it('Ursarctic-style: send to GY with per-slot parenthetical', () => {
    const text =
      'Cannot be Synchro Summoned. Must be Special Summoned (from your Extra Deck) by sending 2 monsters you control with a Level difference of 7 to the GY (1 Level 8 or higher Tuner and 1 non-Tuner Synchro Monster).';
    const paths = extractAlternativePaths(text, 'Synchro');
    expect(paths).toHaveLength(1);
    expect(paths[0].costKind).toBe('send-to-gy');
    expect(paths[0].exact).toBe(false); // Level-difference relation can't be modeled → superset
    expect(paths[0].group.constraints).toEqual([
      expect.objectContaining({ requireTuner: true, levelMin: 8 }),
      expect.objectContaining({ requireNonTuner: true, requireSummonType: ['Synchro'] }),
    ]);
  });
});

describe('extractAlternativePaths — send-from-field merges the outer Level floor', () => {
  it('Bishbaalkin: "sending 2 Level 8 or higher monsters ... (1 Tuner and 1 non-Tuner)"', () => {
    const text =
      'Cannot be Synchro Summoned. Must be Special Summoned (from your Extra Deck) by sending 2 Level 8 or higher monsters you control with the same Level to the Graveyard (1 Tuner and 1 non-Tuner), and cannot be Special Summoned by other ways.';
    const paths = extractAlternativePaths(text, 'Synchro');
    expect(paths).toHaveLength(1);
    expect(paths[0].costKind).toBe('send-to-gy');
    expect(paths[0].exact).toBe(false); // "same Level" relation + outer summary → superset
    expect(paths[0].group.constraints).toEqual([
      expect.objectContaining({ requireTuner: true, levelMin: 8 }),
      expect.objectContaining({ requireNonTuner: true, levelMin: 8 }),
    ]);
  });
});

describe('extractAlternativePaths — out-of-scope costs emit no field path', () => {
  it('banish-from-GY / discard-from-hand are ignored', () => {
    expect(
      extractAlternativePaths(
        'Must be Special Summoned by banishing 2 Spellcaster monsters from your GY.',
        'Fusion',
      ),
    ).toEqual([]);
    expect(
      extractAlternativePaths('You can Special Summon this card by discarding 1 card.', 'Synchro'),
    ).toEqual([]);
  });
});

describe('extractAlternativePaths — alternate Xyz', () => {
  it('requires an Xyz monster (rank dropped → approximate)', () => {
    const paths = extractAlternativePaths(
      'You can also Xyz Summon this card by using 1 Rank 4 Xyz Monster you control.',
      'Xyz',
    );
    expect(paths).toHaveLength(1);
    expect(paths[0]).toEqual(
      expect.objectContaining({ method: 'alt-xyz', summonType: 'Xyz', exact: false }),
    );
    expect(paths[0].group.constraints[0]).toEqual(
      expect.objectContaining({ requireSummonType: ['Xyz'] }),
    );
  });
});

describe('detectContactFusion', () => {
  it('matches "without Polymerization" / "by sending the above"', () => {
    expect(
      detectContactFusion('You can Special Summon this card by sending the above monsters you control to the GY.'),
    ).toBe(true);
    expect(detectContactFusion('"Elemental HERO Neos" + 1 Neo-Spacian monster')).toBe(false);
  });
});
