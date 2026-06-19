import type { MaterialConstraint, MaterialGroup } from '../../domain/types';
import { buildConstraint, parseCount, parseFilters, totals } from './shared';

/**
 * Xyz: "N Level R [filters] monsters". Materials' Level must equal the Rank, so
 * we default the level filter to the monster's Rank when the text omits it.
 * Tokens cannot be Xyz materials.
 */
export function parseXyz(
  segments: string[],
  rank: number | null,
): { group: MaterialGroup; exact: boolean; targetRank?: number } {
  const constraints: MaterialConstraint[] = [];
  let exact = true;
  for (const seg of segments) {
    const { min, max, rest } = parseCount(seg);
    const f = parseFilters(rest);
    if (!f.exact) exact = false;
    const c = buildConstraint(min, max, f, seg, false);
    if (!c.level && rank != null) {
      c.level = [rank];
    } else if (c.level && rank != null && !c.level.includes(rank)) {
      // Material level disagrees with the Rank — unusual; keep but flag.
      exact = false;
    }
    constraints.push(c);
  }
  const group: MaterialGroup = { constraints, ...totals(constraints) };
  return { group, exact, targetRank: rank ?? undefined };
}
