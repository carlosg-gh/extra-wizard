import type { BanRegion } from '../domain/enums';
import type { Card } from '../domain/types';
import type { BuildStep } from '../domain/query';
import { isForbidden } from '../domain/banlist';

/**
 * Walk a bridge build chain and report whether any *summon node* — the target
 * monster or an intermediate Extra Deck monster — is Forbidden in `region`. Base
 * leaves (the user's own input cards, `monsterId === null`) are intentionally
 * ignored: the user already owns those.
 */
export function chainUsesBanned(
  step: BuildStep,
  resolve: (id: string) => Pick<Card, 'banTcg' | 'banOcg'> | undefined,
  region: BanRegion,
): boolean {
  if (step.monsterId) {
    const card = resolve(step.monsterId);
    if (card && isForbidden(card, region)) return true;
  }
  return step.children.some((child) => chainUsesBanned(child, resolve, region));
}
