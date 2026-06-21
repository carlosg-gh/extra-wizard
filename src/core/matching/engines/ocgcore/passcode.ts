import type { Card, ExtraDeckMonster } from '../../../domain/types';

/**
 * ocgcore keys everything on the numeric passcode. Our card id is
 * `String(password ?? konami_id)`, so the password is the code when present;
 * fall back to the numeric id (konami-only cards won't exist in cards.cdb and
 * simply won't be confirmed — an acceptable miss).
 */
export function cardCode(card: Pick<Card, 'password' | 'id'>): number {
  return card.password ?? Number(card.id);
}

export function extraDeckCodesFrom(monsters: ExtraDeckMonster[]): number[] {
  return monsters.map(cardCode);
}
