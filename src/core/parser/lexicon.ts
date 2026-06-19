/**
 * Small curated lookups the parser/matcher need beyond the closed vocabularies
 * in `domain/enums`.
 */

/**
 * "Fusion Substitute" monsters: each can stand in for any 1 named Fusion
 * Material. Kept as an explicit id set (keyed by `password`) because this is a
 * global rule, not something stated on the Fusion monster's own text.
 */
export const FUSION_SUBSTITUTE_IDS: ReadonlySet<string> = new Set([
  '79109599', // King of the Swamp
  '99426834', // Beastking of the Swamps
  '15150365', // The Light - Hex-Sealed Fusion
  '76590649', // The Dark - Hex-Sealed Fusion
  '88696724', // The Earth - Hex-Sealed Fusion
  '53493204', // Goddess with the Third Eye
  '50259460', // Versago the Destroyer
  '05709606', // Mystical Sheep #1 (legacy substitute) — defensive
]);

/** Detect a group-wide uniqueness rule from the raw material text. */
export function detectUniqueness(raw: string): 'names' | 'attributes' | 'types' | null {
  if (/different names?/i.test(raw)) return 'names';
  if (/different attributes?/i.test(raw)) return 'attributes';
  if (/different (?:monster )?types?/i.test(raw)) return 'types';
  return null;
}

/** "Token(s) cannot be used" / "except Tokens" → Tokens disallowed for this group. */
export function detectTokensExcluded(raw: string): boolean {
  return /except tokens?/i.test(raw) || /tokens? cannot be used/i.test(raw);
}
