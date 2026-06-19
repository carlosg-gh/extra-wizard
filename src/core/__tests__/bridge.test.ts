import { describe, expect, it } from 'vitest';
import type { BridgeQueryResult, BuildStep } from '../domain/query';
import { runBridgeQuery } from '../matching/bridge';
import { ctxOf, matchedIds, mkCard, mkEdm } from './helpers';

function bridge(
  monsters: Parameters<typeof ctxOf>[0],
  inputs: Parameters<typeof ctxOf>[1],
  cardIds: string[],
): BridgeQueryResult {
  return runBridgeQuery({ cardIds, mode: 'any-subset' }, ctxOf(monsters, inputs));
}

function item(res: BridgeQueryResult, id: string) {
  return res.items.find((i) => i.monsterId === id);
}

/** Every monster id appearing along any root→leaf path of the chain. */
function pathHasDuplicate(step: BuildStep, seen: string[] = []): boolean {
  if (step.monsterId) {
    if (seen.includes(step.monsterId)) return true;
    seen = [...seen, step.monsterId];
  }
  return step.children.some((c) => pathHasDuplicate(c, seen));
}

describe('bridge mode — chained summoning', () => {
  it('reaches a monster only via an intermediary, with the full chain', () => {
    // A+B make D; D+C make E. E names D, so it is unreachable without building D first.
    const A = mkCard({ id: 'a', name: 'Alpha' });
    const B = mkCard({ id: 'b', name: 'Beta' });
    const C = mkCard({ id: 'c', name: 'Gamma' });
    const D = mkEdm({ id: 'D', name: 'Dee', summonType: 'Fusion', level: 6 }, '"Alpha" + "Beta"');
    const E = mkEdm({ id: 'E', name: 'Eee', summonType: 'Fusion', level: 8 }, '"Dee" + "Gamma"');

    const ctx = ctxOf([D, E], [A, B, C]);
    const ids = ['a', 'b', 'c'];

    // Normal query: D is summonable, E is not (its named material D isn't in hand).
    const direct = matchedIds(ctx, ids, 'any-subset');
    expect(direct.has('D')).toBe(true);
    expect(direct.has('E')).toBe(false);

    const res = runBridgeQuery({ cardIds: ids, mode: 'any-subset' }, ctx);
    const d = item(res, 'D');
    const e = item(res, 'E');
    expect(d?.steps).toBe(1); // direct
    expect(e?.steps).toBe(2); // via D

    // E's chain: E ← D(← Alpha + Beta) + Gamma.
    const sub = e?.chain.children.find((c) => c.monsterId === 'D');
    expect(sub).toBeDefined();
    expect(sub?.children.map((c) => c.name).sort()).toEqual(['Alpha', 'Beta']);
    expect(e?.chain.children.some((c) => c.monsterId === null && c.name === 'Gamma')).toBe(true);
  });

  it('rejects chains that would reuse the same base card (footprint-disjoint)', () => {
    // D1 and D2 both consume the single "Shared"; T needs both, so it must reuse Shared.
    const shared = mkCard({ id: 's', name: 'Shared' });
    const x = mkCard({ id: 'x', name: 'Ex' });
    const y = mkCard({ id: 'y', name: 'Why' });
    const D1 = mkEdm({ id: 'D1', name: 'Dee One', summonType: 'Fusion', level: 6 }, '"Shared" + "Ex"');
    const D2 = mkEdm({ id: 'D2', name: 'Dee Two', summonType: 'Fusion', level: 6 }, '"Shared" + "Why"');
    const T = mkEdm({ id: 'T', name: 'Tee', summonType: 'Fusion', level: 10 }, '"Dee One" + "Dee Two"');

    const res = bridge([D1, D2, T], [shared, x, y], ['s', 'x', 'y']);
    expect(item(res, 'D1')?.steps).toBe(1);
    expect(item(res, 'D2')?.steps).toBe(1);
    expect(item(res, 'T')).toBeUndefined(); // can't build both D1 and D2 from one Shared
  });

  it('combines two intermediaries when their footprints are disjoint', () => {
    const A = mkCard({ id: 'a', name: 'Alpha' });
    const B = mkCard({ id: 'b', name: 'Beta' });
    const C = mkCard({ id: 'c', name: 'Gamma' });
    const Dd = mkCard({ id: 'd', name: 'Delta' });
    const D1 = mkEdm({ id: 'D1', name: 'Dee One', summonType: 'Fusion', level: 6 }, '"Alpha" + "Beta"');
    const D2 = mkEdm({ id: 'D2', name: 'Dee Two', summonType: 'Fusion', level: 6 }, '"Gamma" + "Delta"');
    const T = mkEdm({ id: 'T', name: 'Tee', summonType: 'Fusion', level: 10 }, '"Dee One" + "Dee Two"');

    const res = bridge([D1, D2, T], [A, B, C, Dd], ['a', 'b', 'c', 'd']);
    const t = item(res, 'T');
    expect(t?.steps).toBe(3); // T + D1 + D2
    expect(t?.chain.children.filter((c) => c.monsterId != null).map((c) => c.monsterId).sort()).toEqual([
      'D1',
      'D2',
    ]);
  });

  it('respects the depth cap (a 4-summon chain is not reached at depth 3)', () => {
    const A = mkCard({ id: 'a', name: 'Alpha' });
    const B = mkCard({ id: 'b', name: 'Beta' });
    const C = mkCard({ id: 'c', name: 'Gamma' });
    const Dd = mkCard({ id: 'd', name: 'Delta' });
    const Ee = mkCard({ id: 'e', name: 'Epsilon' });
    const L1 = mkEdm({ id: 'L1', name: 'Link One', summonType: 'Fusion', level: 5, race: 'Dragon' }, '"Alpha" + "Beta"');
    const L2 = mkEdm({ id: 'L2', name: 'Link Two', summonType: 'Fusion', level: 6, race: 'Warrior' }, '"Link One" + "Gamma"');
    const L3 = mkEdm({ id: 'L3', name: 'Link Three', summonType: 'Fusion', level: 7, race: 'Fiend' }, '"Link Two" + "Delta"');
    const L4 = mkEdm({ id: 'L4', name: 'Link Four', summonType: 'Fusion', level: 8, race: 'Spellcaster' }, '"Link Three" + "Epsilon"');

    const res = bridge([L1, L2, L3, L4], [A, B, C, Dd, Ee], ['a', 'b', 'c', 'd', 'e']);
    expect(item(res, 'L1')?.steps).toBe(1);
    expect(item(res, 'L2')?.steps).toBe(2);
    expect(item(res, 'L3')?.steps).toBe(3);
    expect(item(res, 'L4')).toBeUndefined(); // would need a 4th round
  });

  it('never places a monster inside its own chain (acyclic)', () => {
    const A = mkCard({ id: 'a', name: 'Alpha' });
    const B = mkCard({ id: 'b', name: 'Beta' });
    const C = mkCard({ id: 'c', name: 'Gamma' });
    const D = mkEdm({ id: 'D', name: 'Dee', summonType: 'Fusion', level: 6 }, '"Alpha" + "Beta"');
    const E = mkEdm({ id: 'E', name: 'Eee', summonType: 'Fusion', level: 8 }, '"Dee" + "Gamma"');

    const res = bridge([D, E], [A, B, C], ['a', 'b', 'c']);
    for (const it of res.items) {
      expect(pathHasDuplicate(it.chain)).toBe(false);
    }
  });

  it('returns nothing for an empty hand', () => {
    const D = mkEdm({ id: 'D', name: 'Dee', summonType: 'Fusion', level: 6 }, '"Alpha" + "Beta"');
    const res = bridge([D], [], []);
    expect(res.items).toEqual([]);
    expect(res.inputCount).toBe(0);
  });
});
