import { describe, expect, it } from 'vitest';
import { ctxOf, matchedIds, mkCard, mkEdm } from './helpers';

describe('matching robustness fixes', () => {
  it('"non-FIRE \\"Sky Striker Ace\\"" matches non-FIRE members (Kagari ← Raye / Roze)', () => {
    const raye = mkCard({ id: 'raye', name: 'Sky Striker Ace - Raye', attribute: 'DARK', level: 4, series: ['Sky Striker', 'Sky Striker Ace'] });
    const roze = mkCard({ id: 'roze', name: 'Sky Striker Ace - Roze', attribute: 'LIGHT', level: 4, series: ['Sky Striker', 'Sky Striker Ace'] });
    const kagari = mkEdm(
      { id: 'kagari', name: 'Sky Striker Ace - Kagari', summonType: 'Link', linkRating: 1, attribute: 'FIRE' },
      '1 non-FIRE "Sky Striker Ace" monster',
    );
    expect(matchedIds(ctxOf([kagari], [raye]), ['raye'], 'any-subset').has('kagari')).toBe(true);
    expect(matchedIds(ctxOf([kagari], [roze]), ['roze'], 'any-subset').has('kagari')).toBe(true);
  });

  it('a FIRE "Sky Striker Ace" does NOT satisfy "non-FIRE"', () => {
    const fire = mkCard({ id: 'f', name: 'Sky Striker Ace - Hot', attribute: 'FIRE', level: 4, series: ['Sky Striker Ace'] });
    const kagari = mkEdm(
      { id: 'kagari', name: 'Kagari', summonType: 'Link', linkRating: 1 },
      '1 non-FIRE "Sky Striker Ace" monster',
    );
    expect(matchedIds(ctxOf([kagari], [fire]), ['f'], 'any-subset').has('kagari')).toBe(false);
  });

  it('archetype matches by card NAME even when series lacks it', () => {
    const raye = mkCard({ id: 'raye', name: 'Sky Striker Ace - Raye', attribute: 'DARK', level: 4, series: [] });
    const kagari = mkEdm({ id: 'kagari', name: 'Kagari', summonType: 'Link', linkRating: 1 }, '1 "Sky Striker Ace" monster');
    expect(matchedIds(ctxOf([kagari], [raye]), ['raye'], 'any-subset').has('kagari')).toBe(true);
  });

  it('Gravity Controller (EMZ) needs an Extra Deck monster, not a main-deck one', () => {
    const mainDeck = mkCard({ id: 'md', name: 'Main Deck Mon', summonType: null });
    const xyz = mkCard({ id: 'xz', name: 'Some Xyz', summonType: 'Xyz', rank: 4 });
    const gc = mkEdm(
      { id: 'gc', name: 'Gravity Controller', summonType: 'Link', linkRating: 1 },
      '1 non-Link Monster in an Extra Monster Zone',
    );
    expect(matchedIds(ctxOf([gc], [mainDeck]), ['md'], 'any-subset').has('gc')).toBe(false);
    expect(matchedIds(ctxOf([gc], [xyz]), ['xz'], 'any-subset').has('gc')).toBe(true);
  });

  it('Linkross rejects a lone Link-1 (needs Link-2 or higher)', () => {
    const link1 = mkCard({ id: 'l1', name: 'Gravity Controller', summonType: 'Link', linkRating: 1 });
    const linkross = mkEdm({ id: 'lk', name: 'Linkross', summonType: 'Link', linkRating: 1 }, '1 Link-2 or higher Link Monster');
    expect(matchedIds(ctxOf([linkross], [link1]), ['l1'], 'any-subset').has('lk')).toBe(false);
  });
});
