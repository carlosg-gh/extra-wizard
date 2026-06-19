import type { SummonType } from '@core';

interface CardLike {
  summonType: SummonType | null;
  level: number | null;
  rank: number | null;
  linkRating: number | null;
  race: string;
  attribute: string | null;
}

/** Short level/rank/link label, e.g. "Lv 8", "Rank 4", "LINK-3". */
export function levelRankLabel(c: CardLike): string {
  if (c.summonType === 'Link') return `LINK-${c.linkRating ?? '?'}`;
  if (c.summonType === 'Xyz' || c.rank != null) return `Rank ${c.rank ?? '?'}`;
  if (c.level != null) return `Lv ${c.level}`;
  return '';
}

/** One-line summary used in search rows and chips. */
export function cardMetaLine(c: CardLike): string {
  return [levelRankLabel(c), c.race, c.attribute].filter(Boolean).join(' · ');
}
