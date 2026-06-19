import { describe, expect, it } from 'vitest';
import { runBridgeQuery } from '../matching/bridge';
import { ctxOf, mkCard, mkEdm } from './helpers';

const a = mkCard({ id: 'a', name: 'Alpha' });
const b = mkCard({ id: 'b', name: 'Beta' });

/** A plain Polymerization Fusion: native path needs a Fusion Spell. */
const poly = mkEdm({ id: 'PF', name: 'PolyFusion', summonType: 'Fusion', level: 6 }, '"Alpha" + "Beta"');

/** A Fusion that can also be Special Summoned from the field by a tribute condition. */
const magiText =
  'Must be Fusion Summoned. You can also Special Summon this card (from your Extra Deck) by Tributing 2 monsters.';
const magi = mkEdm(
  { id: 'MG', name: 'Magistus-like', summonType: 'Fusion', level: 6 },
  '"Alpha" + "Beta"',
  magiText,
);

function reached(monsters: Parameters<typeof ctxOf>[0], exclude: boolean): Set<string> {
  const ctx = ctxOf(monsters, [a, b]);
  const res = runBridgeQuery({ cardIds: ['a', 'b'], mode: 'any-subset' }, ctx, {
    excludeExtraCardPaths: exclude,
  });
  return new Set(res.items.map((i) => i.monsterId));
}

describe('bridge mode — Fusion exclusion', () => {
  it('hides spell-requiring Fusions by default, shows them when included', () => {
    expect(reached([poly], true).has('PF')).toBe(false);
    expect(reached([poly], false).has('PF')).toBe(true);
  });

  it('keeps a self-Special-Summon Fusion even when Fusions are excluded', () => {
    expect(reached([magi], true).has('MG')).toBe(true);
  });
});
