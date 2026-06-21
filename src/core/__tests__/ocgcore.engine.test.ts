import { describe, expect, it } from 'vitest';
import { runQuery } from '../matching';
import { OCGCORE_ENABLED, OcgcoreSummonEngine } from '../matching/engines/ocgcore/ocgcoreEngine';
import { ctxOf, mkCard, mkEdm } from './helpers';

describe('ocgcore engine scaffold (Phase 2 — off by default)', () => {
  const mon = mkEdm({ id: 'L1', name: 'Some Link-1', summonType: 'Link', linkRating: 1 }, '1 monster');
  const ctx = ctxOf([mon], [mkCard({ id: 'a', name: 'Alpha' })]);

  it('is disabled by default', () => {
    expect(OCGCORE_ENABLED).toBe(false);
  });

  it('plugs into runQuery through the ISummonEngine seam', () => {
    const cold = new OcgcoreSummonEngine();
    expect(runQuery({ cardIds: ['a'], mode: 'any-subset' }, ctx, { engine: cold }).items).toEqual([]);

    const warm = new OcgcoreSummonEngine().primeWith(['L1']);
    const hit = runQuery({ cardIds: ['a'], mode: 'any-subset' }, ctx, { engine: warm });
    expect(hit.items.map((i) => i.monsterId)).toEqual(['L1']);
  });

  it('prime() throws until the WASM core is wired (Stage 1)', async () => {
    await expect(new OcgcoreSummonEngine().prime([])).rejects.toThrow(/not wired/i);
  });
});
