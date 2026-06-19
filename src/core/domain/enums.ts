/**
 * Closed vocabularies used across the domain. These are string-literal unions
 * (not TS `const enum`s) so they serialize cleanly to JSON and survive
 * `isolatedModules`.
 */

export type SummonType = 'Fusion' | 'Synchro' | 'Xyz' | 'Link';

export const SUMMON_TYPES: readonly SummonType[] = ['Fusion', 'Synchro', 'Xyz', 'Link'];

export type Attribute = 'LIGHT' | 'DARK' | 'EARTH' | 'WATER' | 'FIRE' | 'WIND' | 'DIVINE';

export const ATTRIBUTES: readonly Attribute[] = [
  'LIGHT',
  'DARK',
  'EARTH',
  'WATER',
  'FIRE',
  'WIND',
  'DIVINE',
];

/**
 * Konami monster "Types" — called "races" here so the word "type" can refer
 * unambiguously to the summon mechanic (SummonType). Ordered longest-first
 * matters for some callers; keep the canonical list in {@link MONSTER_RACES}.
 */
export const MONSTER_RACES = [
  'Aqua',
  'Beast',
  'Beast-Warrior',
  'Creator God',
  'Cyberse',
  'Dinosaur',
  'Divine-Beast',
  'Dragon',
  'Fairy',
  'Fiend',
  'Fish',
  'Illusion',
  'Insect',
  'Machine',
  'Plant',
  'Psychic',
  'Pyro',
  'Reptile',
  'Rock',
  'Sea Serpent',
  'Spellcaster',
  'Thunder',
  'Warrior',
  'Winged Beast',
  'Wyrm',
  'Zombie',
] as const;

export type MonsterRace = (typeof MONSTER_RACES)[number];

/** Link arrow positions, compass-style abbreviations. */
export type LinkArrow = 'TL' | 'T' | 'TR' | 'L' | 'R' | 'BL' | 'B' | 'BR';

/**
 * How confident the parser is in a {@link SummoningPath}.
 * - `exact`: every fragment of the material text matched a known production.
 * - `approximate`: structure recognized but a stricter sub-clause was dropped,
 *   or the requirement was inferred from the monster's own stats. Matching such
 *   a path yields a safe *superset* (over-inclusion), surfaced with a badge.
 * - `unparsed`: structure could not be established. Hidden by default in the UI.
 */
export type ParseStatus = 'exact' | 'approximate' | 'unparsed';

/** Returns the "worst" (least confident) of two parse statuses. */
export function worstParseStatus(a: ParseStatus, b: ParseStatus): ParseStatus {
  const rank: Record<ParseStatus, number> = { exact: 0, approximate: 1, unparsed: 2 };
  return rank[a] >= rank[b] ? a : b;
}
