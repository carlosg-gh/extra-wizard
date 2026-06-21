import { describe, it, expect } from 'vitest';
import { verifyItems, type SummonVerifier } from '../matching/verify';

/** A fake oracle driven by two id sets, so we can test the filter without ocgcore. */
function fakeVerifier(confirmed: string[], unevaluable: string[] = []): SummonVerifier {
  const ok = new Set(confirmed);
  const unknown = new Set(unevaluable);
  return {
    confirms: (id) => ok.has(id),
    wasEvaluable: (id) => !unknown.has(id),
  };
}

describe('verifyItems (verifier over parser candidates)', () => {
  const items = [{ monsterId: 'a' }, { monsterId: 'b' }, { monsterId: 'c' }, { monsterId: 'd' }];

  it('keeps confirmed candidates and drops evaluated-but-denied ones', () => {
    const out = verifyItems(items, fakeVerifier(['a', 'c']));
    expect(out.map((i) => i.monsterId)).toEqual(['a', 'c']); // b, d evaluated + denied → dropped
  });

  it('keeps candidates the oracle could not evaluate (missing data ≠ denial)', () => {
    // 'b' is denied-but-unevaluable → kept; 'd' is denied + evaluable → dropped.
    const out = verifyItems(items, fakeVerifier(['a'], ['b']));
    expect(out.map((i) => i.monsterId)).toEqual(['a', 'b']);
  });

  it('drops everything when nothing is confirmed and all were evaluable', () => {
    expect(verifyItems(items, fakeVerifier([]))).toEqual([]);
  });

  it('is a no-op shape (returns same items) when all are confirmed', () => {
    const out = verifyItems(items, fakeVerifier(['a', 'b', 'c', 'd']));
    expect(out).toHaveLength(4);
  });
});
