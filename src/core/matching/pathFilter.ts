import type { ExtraDeckMonster, SummoningPath } from '../domain/types';

/**
 * Does this path need a main-deck card outside the field (a Fusion/Ritual Spell)?
 * Stored explicitly by the build-time parser; when absent (legacy shards), derive
 * it — an ordinary native Fusion needs a Fusion Spell, everything else is field-only.
 */
export function pathNeedsExtraCard(path: SummoningPath): boolean {
  if (path.requiresExtraCard != null) return path.requiresExtraCard;
  return path.summonType === 'Fusion' && (path.method == null || path.method === 'native');
}

/**
 * View of a monster with extra-card paths removed, or `null` if that leaves no
 * path. Returns the original reference when nothing is filtered (cheap fast path).
 */
export function withFieldOnlyPaths(monster: ExtraDeckMonster): ExtraDeckMonster | null {
  const allowed = monster.paths.filter((p) => !pathNeedsExtraCard(p));
  if (allowed.length === monster.paths.length) return monster;
  if (allowed.length === 0) return null;
  return { ...monster, paths: allowed };
}
