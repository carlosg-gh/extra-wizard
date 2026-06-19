import { describe, expect, it } from 'vitest';
import { ctxOf, matchedIds, mkCard, mkEdm } from './helpers';

describe('fusion matching (named + generic + substitute)', () => {
  const trakodon = mkCard({ id: 'trk', name: 'Trakodon' });
  const flameViper = mkCard({ id: 'fv', name: 'Flame Viper' });
  const random = mkCard({ id: 'rnd', name: 'Random Beast' });
  const kingOfTheSwamp = mkCard({
    id: '79109599',
    name: 'King of the Swamp',
    isFusionSubstitute: true,
  });

  const flameSwordsman = mkEdm(
    { id: 'FS', name: 'Flame-ish Fusion', summonType: 'Fusion' },
    '"Trakodon" + "Flame Viper"',
  );

  it('matches only when both named materials are present', () => {
    const have = ctxOf([flameSwordsman], [trakodon, flameViper]);
    expect(matchedIds(have, ['trk', 'fv'], 'any-subset').has('FS')).toBe(true);

    const missing = ctxOf([flameSwordsman], [trakodon, random]);
    expect(matchedIds(missing, ['trk', 'rnd'], 'any-subset').has('FS')).toBe(false);
  });

  it('lets a Fusion Substitute stand in for a named material', () => {
    const ctx = ctxOf([flameSwordsman], [trakodon, kingOfTheSwamp]);
    expect(matchedIds(ctx, ['trk', '79109599'], 'any-subset').has('FS')).toBe(true);
  });

  it('matches a named + generic recipe', () => {
    const darkMagician = mkCard({ id: 'dm', name: 'Dark Magician', attribute: 'DARK' });
    const lightMon = mkCard({ id: 'lm', name: 'Some LIGHT', attribute: 'LIGHT' });
    const recipe = mkEdm(
      { id: 'DMF', name: 'DM Fusion', summonType: 'Fusion' },
      '"Dark Magician" + 1 LIGHT or DARK monster',
    );
    const ctx = ctxOf([recipe], [darkMagician, lightMon]);
    expect(matchedIds(ctx, ['dm', 'lm'], 'any-subset').has('DMF')).toBe(true);
  });
});
