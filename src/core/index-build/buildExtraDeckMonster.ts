import { worstParseStatus } from '../domain/enums';
import type { Card, ExtraDeckMonster } from '../domain/types';
import { parseMaterials } from '../parser/parseMaterials';

/** Turn a normalized Extra Deck {@link Card} + its material text into a parsed monster. */
export function buildExtraDeckMonster(card: Card, materialsText: string): ExtraDeckMonster | null {
  if (!card.summonType) return null;
  const paths = parseMaterials(materialsText, {
    summonType: card.summonType,
    level: card.level,
    rank: card.rank,
    linkRating: card.linkRating,
  });
  const parseStatus = paths.map((p) => p.parseStatus).reduce(worstParseStatus, 'exact' as const);
  return { ...card, summonType: card.summonType, materialsRaw: materialsText, paths, parseStatus };
}
