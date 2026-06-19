import type { MaterialConstraint, MaterialGroup } from '../../domain/types';
import { buildConstraint, parseCount, parseFilters, totals } from './shared';

/**
 * Link: "N monsters" / "2+ monsters" / "2 Effect Monsters" / "N \"Arch\"
 * monsters", optionally "..., including a X". Count is capped at the Link
 * Rating; the matcher enforces that materials' Link contributions sum to the
 * Rating via `linkContribTarget`.
 */
export function parseLink(
  segments: string[],
  linkRating: number | null,
): { group: MaterialGroup; exact: boolean; targetLinkRating?: number } {
  const constraints: MaterialConstraint[] = [];
  let exact = true;
  for (const seg of segments) {
    const incl = seg.split(/,?\s+including\s+/i);
    const base = incl[0];
    const { min, max, rest } = parseCount(base);
    const f = parseFilters(rest);
    if (!f.exact) exact = false;
    constraints.push(buildConstraint(min, max, f, base));
    if (incl[1]) {
      const f2 = parseFilters(incl[1]);
      if (!f2.exact) exact = false;
      constraints.push(buildConstraint(1, 1, f2, `including ${incl[1]}`));
    }
  }
  // You can't use more materials than the Link Rating, so cap unbounded counts.
  if (linkRating != null) {
    for (const c of constraints) if (c.max == null) c.max = linkRating;
  }
  const group: MaterialGroup = { constraints, ...totals(constraints) };
  if (linkRating != null) group.linkContribTarget = linkRating;
  return { group, exact, targetLinkRating: linkRating ?? undefined };
}
