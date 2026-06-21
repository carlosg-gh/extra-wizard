import type { Card, MaterialConstraint } from '../domain/types';

/**
 * Does a single card satisfy a constraint's FILTERS (ignoring counts)?
 * Scalar fields AND together; array fields OR within themselves.
 */
export function cardSatisfiesConstraint(card: Card, c: MaterialConstraint): boolean {
  if (c.namedCards && c.namedCards.length) {
    // A Fusion Substitute monster may stand in for any single named material.
    if (card.isFusionSubstitute) return true;
    if (!c.namedCards.includes(card.name)) return false;
  }
  if (c.tokenAllowed === false && card.isToken) return false;
  if (c.requireTuner && !card.isTuner) return false;
  if (c.requireNonTuner && card.isTuner) return false;
  if (c.requireEffect && !card.isEffect) return false;
  // A Normal Monster is a non-Effect, non-Token monster.
  if (c.requireNonEffect && (card.isEffect || card.isToken)) return false;
  // Material must have a Level (Synchro): excludes Link/Xyz monsters (level === null).
  if (c.requireLevel && card.level == null) return false;
  if (c.requireAbility && !c.requireAbility.every((a) => card.typeLineTags.includes(a))) {
    return false;
  }
  if (c.level && (card.level == null || !c.level.includes(card.level))) return false;
  if (c.levelMin != null && (card.level == null || card.level < c.levelMin)) return false;
  if (c.levelMax != null && (card.level == null || card.level > c.levelMax)) return false;
  if (c.linkRatingMin != null && (card.linkRating == null || card.linkRating < c.linkRatingMin)) {
    return false;
  }
  if (c.linkRatingMax != null && (card.linkRating == null || card.linkRating > c.linkRatingMax)) {
    return false;
  }
  if (c.race && !c.race.includes(card.race)) return false;
  if (c.excludeRace && c.excludeRace.includes(card.race)) return false;
  if (c.attribute && (card.attribute == null || !c.attribute.includes(card.attribute))) return false;
  if (c.excludeAttribute && card.attribute != null && c.excludeAttribute.includes(card.attribute)) {
    return false;
  }
  // Archetype membership is name-based in-game ("a card with 'X' in its name"); union with
  // the curated `series` (which also covers non-substring members). Strictly inclusive.
  if (c.archetype && !c.archetype.some((a) => card.series.includes(a) || card.name.includes(a))) {
    return false;
  }
  // Only Extra Deck monsters can be in an Extra Monster Zone.
  if (c.requireExtraDeck && card.summonType == null) return false;
  if (
    c.requireSummonType &&
    (card.summonType == null || !c.requireSummonType.includes(card.summonType))
  ) {
    return false;
  }
  if (c.excludeSummonType && card.summonType != null && c.excludeSummonType.includes(card.summonType)) {
    return false;
  }
  return true;
}
