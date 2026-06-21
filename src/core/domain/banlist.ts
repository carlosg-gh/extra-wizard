import type { BanRegion, BanStatus } from './enums';
import type { Card } from './types';

/**
 * Map a raw Forbidden & Limited value (YGOPRODeck `banlist_info`, yaml-yugi
 * `limit_regulation`) to our {@link BanStatus}. YGOPRODeck sometimes says
 * "Banned" for Forbidden; "Unlimited" / "Not yet released" / absent ⇒ `null`.
 */
export function normalizeBanStatus(raw: string | null | undefined): BanStatus {
  switch (raw) {
    case 'Forbidden':
    case 'Banned':
      return 'Forbidden';
    case 'Limited':
      return 'Limited';
    case 'Semi-Limited':
      return 'Semi-Limited';
    default:
      return null;
  }
}

/** A card's ban status in the given region. */
export function banStatusOf(card: Pick<Card, 'banTcg' | 'banOcg'>, region: BanRegion): BanStatus {
  return region === 'ocg' ? card.banOcg : card.banTcg;
}

/** Is this card Forbidden in the given region? */
export function isForbidden(card: Pick<Card, 'banTcg' | 'banOcg'>, region: BanRegion): boolean {
  return banStatusOf(card, region) === 'Forbidden';
}
