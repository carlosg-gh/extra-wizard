import { describe, expect, it } from 'vitest';
import { normalizeYgoprodeckCard, ygoprodeckMaterials } from '../index-build/normalizeYgoprodeck';
import type { YgoprodeckRaw } from '../index-build/normalizeYgoprodeck';

const map = (raw: YgoprodeckRaw) => normalizeYgoprodeckCard(raw);

describe('normalizeYgoprodeck', () => {
  it('maps a Synchro (level holds Level; Effect inferred)', () => {
    const c = map({
      id: 44508094,
      name: 'Stardust Dragon',
      type: 'Synchro Monster',
      frameType: 'synchro',
      desc: '1 Tuner + 1 or more non-Tuner monsters\nWhen a card...',
      race: 'Dragon',
      attribute: 'WIND',
      atk: 2500,
      def: 2000,
      level: 8,
      archetype: 'Stardust',
    })!;
    expect(c).toMatchObject({
      id: '44508094',
      summonType: 'Synchro',
      level: 8,
      rank: null,
      linkRating: null,
      race: 'Dragon',
      attribute: 'WIND',
      isEffect: true,
      isTuner: false,
      series: ['Stardust'],
    });
    expect(c.typeLineTags).toEqual(['Synchro']);
  });

  it('flags a Synchro Tuner via typeLineTags + isTuner', () => {
    const c = map({ id: 1, name: 'Formula Synchron', type: 'Synchro Tuner Monster', frameType: 'synchro', desc: '1 Tuner + 1 non-Tuner monster', race: 'Machine', attribute: 'LIGHT', level: 2 })!;
    expect(c.isTuner).toBe(true);
    expect(c.typeLineTags).toEqual(['Synchro', 'Tuner']);
  });

  it('maps an Xyz (Rank stored in `level`)', () => {
    const c = map({ id: 84013237, name: 'Number 39: Utopia', type: 'XYZ Monster', frameType: 'xyz', desc: '2 Level 4 monsters', race: 'Warrior', attribute: 'LIGHT', level: 4, atk: 2500, def: 2000 })!;
    expect(c).toMatchObject({ summonType: 'Xyz', rank: 4, level: null });
    expect(c.typeLineTags).toEqual(['Xyz']); // "XYZ" normalized
  });

  it('maps a Link (linkval + linkmarkers)', () => {
    const c = map({
      id: 1861629,
      name: 'Decode Talker',
      type: 'Link Monster',
      frameType: 'link',
      desc: '2+ Effect Monsters',
      race: 'Cyberse',
      attribute: 'DARK',
      atk: 2300,
      linkval: 3,
      linkmarkers: ['Top', 'Bottom-Left', 'Bottom-Right'],
    })!;
    expect(c).toMatchObject({ summonType: 'Link', linkRating: 3, level: null, rank: null, def: null });
    expect(c.linkArrows).toEqual(['T', 'BL', 'BR']);
  });

  it('exposes Pendulum/Flip/Gemini/Union as ability tags', () => {
    expect(map({ id: 2, name: 'P', type: 'Pendulum Effect Monster', frameType: 'effect_pendulum', race: 'Spellcaster', attribute: 'DARK', level: 4, scale: 5 })!.typeLineTags).toContain('Pendulum');
    expect(map({ id: 3, name: 'F', type: 'Flip Effect Monster', frameType: 'effect', race: 'Rock', attribute: 'EARTH', level: 4 })!.typeLineTags).toContain('Flip');
    expect(map({ id: 4, name: 'G', type: 'Gemini Monster', frameType: 'effect', race: 'Fiend', attribute: 'DARK', level: 4 })!.typeLineTags).toContain('Gemini');
    expect(map({ id: 5, name: 'U', type: 'Union Effect Monster', frameType: 'effect', race: 'Machine', attribute: 'LIGHT', level: 4 })!.typeLineTags).toContain('Union');
  });

  it('treats Normal monsters as non-Effect and skips non-monsters', () => {
    expect(map({ id: 6, name: 'Vanilla', type: 'Normal Monster', frameType: 'normal', race: 'Dragon', attribute: 'LIGHT', level: 4 })!.isEffect).toBe(false);
    expect(map({ id: 7, name: 'Pot of Greed', type: 'Spell Card', frameType: 'spell', race: 'Normal' })).toBeNull();
    expect(map({ id: 8, name: 'Trap', type: 'Trap Card', frameType: 'trap', race: 'Normal' })).toBeNull();
    expect(map({ name: 'no id', type: 'Effect Monster', frameType: 'effect' })).toBeNull();
  });

  it('extracts materials from the first desc line', () => {
    expect(ygoprodeckMaterials({ desc: '2 Level 4 monsters\nOnce per turn...' })).toBe('2 Level 4 monsters');
    expect(ygoprodeckMaterials({})).toBe('');
  });
});
