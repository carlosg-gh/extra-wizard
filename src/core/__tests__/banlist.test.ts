import { describe, expect, it } from 'vitest';
import type { BuildStep } from '../domain/query';
import { isForbidden, normalizeBanStatus } from '../domain/banlist';
import { chainUsesBanned } from '../matching/banWalk';
import { mkCard } from './helpers';

describe('banlist', () => {
  it('normalizeBanStatus maps raw region values', () => {
    expect(normalizeBanStatus('Banned')).toBe('Forbidden');
    expect(normalizeBanStatus('Forbidden')).toBe('Forbidden');
    expect(normalizeBanStatus('Limited')).toBe('Limited');
    expect(normalizeBanStatus('Semi-Limited')).toBe('Semi-Limited');
    expect(normalizeBanStatus('Unlimited')).toBeNull();
    expect(normalizeBanStatus('Not yet released')).toBeNull();
    expect(normalizeBanStatus(undefined)).toBeNull();
  });

  it('isForbidden respects the selected region', () => {
    const c = mkCard({ name: 'X', banTcg: 'Forbidden', banOcg: null });
    expect(isForbidden(c, 'tcg')).toBe(true);
    expect(isForbidden(c, 'ocg')).toBe(false);
  });
});

describe('chainUsesBanned', () => {
  const forbiddenInter = mkCard({ id: 'D', name: 'Dee', summonType: 'Fusion', banTcg: 'Forbidden' });
  const target = mkCard({ id: 'E', name: 'Eee', summonType: 'Fusion' });
  const byId = new Map([
    ['D', forbiddenInter],
    ['E', target],
  ]);
  const resolve = (id: string) => byId.get(id);

  it('flags a Forbidden intermediate summon node', () => {
    // E ← (D ← Alpha) + Gamma, D is TCG-Forbidden.
    const chain: BuildStep = {
      monsterId: 'E',
      name: 'Eee',
      summonType: 'Fusion',
      children: [
        {
          monsterId: 'D',
          name: 'Dee',
          summonType: 'Fusion',
          children: [{ monsterId: null, name: 'Alpha', summonType: null, children: [] }],
        },
        { monsterId: null, name: 'Gamma', summonType: null, children: [] },
      ],
    };
    expect(chainUsesBanned(chain, resolve, 'tcg')).toBe(true);
    expect(chainUsesBanned(chain, resolve, 'ocg')).toBe(false);
  });

  it('ignores Forbidden status on base-card leaves (monsterId null)', () => {
    const chain: BuildStep = {
      monsterId: 'E',
      name: 'Eee',
      summonType: 'Fusion',
      children: [{ monsterId: null, name: 'BannedLeaf', summonType: null, children: [] }],
    };
    expect(chainUsesBanned(chain, resolve, 'tcg')).toBe(false);
  });
});
