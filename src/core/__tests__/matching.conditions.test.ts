import { describe, expect, it } from 'vitest';
import { ctxOf, matchedIds, mkCard, mkEdm } from './helpers';

describe('Synchro cannot use Link/Xyz monsters as material (bug #1)', () => {
  const tuner = mkCard({ id: 't', name: 'Tuner2', level: 2, isTuner: true });
  const link = mkCard({ id: 'L', name: 'Linky', summonType: 'Link', linkRating: 1 }); // level === null
  const nonTuner = mkCard({ id: 'n', name: 'Beater', level: 6 });
  const syn = mkEdm({ id: 'S8', name: 'Level8 Synchro', summonType: 'Synchro', level: 8 }, '1 Tuner + 1 non-Tuner monster');

  it('a Link monster (no Level) cannot fill the non-Tuner slot', () => {
    expect(matchedIds(ctxOf([syn], [tuner, link]), ['t', 'L'], 'any-subset').has('S8')).toBe(false);
  });
  it('two leveled monsters summing to the Level still work', () => {
    expect(matchedIds(ctxOf([syn], [tuner, nonTuner]), ['t', 'n'], 'any-subset').has('S8')).toBe(true);
  });
});

describe('Normal vs Effect material (bug #2)', () => {
  const normal = mkCard({ id: 'nm', name: 'Vanilla', level: 4, isEffect: false });
  const effect = mkCard({ id: 'ef', name: 'Effecty', level: 4, isEffect: true });
  // Link Spider: "1 Normal Monster".
  const spider = mkEdm({ id: 'LS', name: 'Link Spider', summonType: 'Link', linkRating: 1 }, '1 Normal Monster');

  it('only a Normal monster satisfies "1 Normal Monster"', () => {
    expect(matchedIds(ctxOf([spider], [normal]), ['nm'], 'any-subset').has('LS')).toBe(true);
    expect(matchedIds(ctxOf([spider], [effect]), ['ef'], 'any-subset').has('LS')).toBe(false);
  });
});

describe('tribute Special Summon parsed from full text (Bishbaalkin-style)', () => {
  const text =
    "Cannot be Synchro Summoned. Must first be Special Summoned (from your hand) by Tributing 5 Zombie monsters.";
  const boss = mkEdm(
    { id: 'BB', name: 'Bishbaalkin', summonType: 'Synchro', level: 12 },
    "(This card's original Level is always treated as 12.)",
    text,
  );
  const zombies = ['1', '2', '3', '4', '5'].map((i) => mkCard({ id: `z${i}`, name: `Z${i}`, level: 4, race: 'Zombie' }));
  const zIds = zombies.map((z) => z.id);

  it('needs five Zombies, and is not Synchro-summonable', () => {
    expect(matchedIds(ctxOf([boss], zombies), zIds, 'any-subset').has('BB')).toBe(true);
    expect(matchedIds(ctxOf([boss], zombies.slice(0, 4)), zIds.slice(0, 4), 'any-subset').has('BB')).toBe(false);
  });
});
