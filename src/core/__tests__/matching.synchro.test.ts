import { describe, expect, it } from 'vitest';
import { ctxOf, matchedIds, mkCard, mkEdm } from './helpers';

describe('synchro matching (level subset-sum)', () => {
  const tuner3 = mkCard({ id: 't3', name: 'Tuner Lv3', level: 3, isTuner: true });
  const non5 = mkCard({ id: 'n5', name: 'Non-Tuner Lv5', level: 5 });
  const non4 = mkCard({ id: 'n4', name: 'Non-Tuner Lv4', level: 4 });

  const syn8 = mkEdm({ id: 's8', name: 'Generic Lv8', summonType: 'Synchro', level: 8 }, '1 Tuner + 1 or more non-Tuner monsters');
  const syn7 = mkEdm({ id: 's7', name: 'Generic Lv7', summonType: 'Synchro', level: 7 }, '1 Tuner + 1 or more non-Tuner monsters');
  const syn10 = mkEdm({ id: 's10', name: 'Generic Lv10', summonType: 'Synchro', level: 10 }, '1 Tuner + 1 or more non-Tuner monsters');

  it('matches a Synchro whose Level equals the chosen subset sum', () => {
    const ctx = ctxOf([syn8, syn7, syn10], [tuner3, non5, non4]);
    const ids = matchedIds(ctx, ['t3', 'n5', 'n4'], 'any-subset');
    expect(ids.has('s8')).toBe(true); // 3 + 5
    expect(ids.has('s7')).toBe(true); // 3 + 4
    expect(ids.has('s10')).toBe(false); // no tuner-including subset sums to 10
  });

  it('requires a Tuner', () => {
    const ctx = ctxOf([syn8], [non5, non4, mkCard({ id: 'x', name: 'Lv4 b', level: 4 })]);
    expect(matchedIds(ctx, ['n5', 'n4', 'x'], 'any-subset').has('s8')).toBe(false);
  });

  it('respects an archetype-locked Tuner', () => {
    const swordsoul = mkEdm(
      { id: 'ss8', name: 'Swordsoul Synchro', summonType: 'Synchro', level: 8 },
      '1 "Swordsoul" Tuner + 1 or more non-Tuner monsters',
    );
    const plainTuner = mkCard({ id: 'pt', name: 'Plain Tuner', level: 3, isTuner: true });
    const ssTuner = mkCard({ id: 'st', name: 'Swordsoul Tuner', level: 3, isTuner: true, series: ['Swordsoul'] });

    const ctxPlain = ctxOf([swordsoul], [plainTuner, non5]);
    expect(matchedIds(ctxPlain, ['pt', 'n5'], 'any-subset').has('ss8')).toBe(false);

    const ctxSs = ctxOf([swordsoul], [ssTuner, non5]);
    expect(matchedIds(ctxSs, ['st', 'n5'], 'any-subset').has('ss8')).toBe(true);
  });
});
