import type { MaterialConstraint, MaterialGroup } from '../../domain/types';
import { buildConstraint, parseCount, parseFilters, totals } from './shared';

/**
 * Synchro: "1 Tuner + 1 or more non-Tuner monsters" and variants. Each segment
 * becomes a constraint; the matcher enforces the Level-sum rule via
 * `synchroTargetLevel`.
 */
export function parseSynchro(
  segments: string[],
  level: number | null,
): { group: MaterialGroup; exact: boolean } {
  const constraints: MaterialConstraint[] = [];
  let exact = true;
  for (const seg of segments) {
    const { min, max, rest } = parseCount(seg);
    const f = parseFilters(rest);
    if (!f.exact) exact = false;
    constraints.push(buildConstraint(min, max, f, seg));
  }
  // A standard Synchro names a Tuner. If none was detected, the wording is
  // non-standard — keep what we parsed but flag it.
  if (!constraints.some((c) => c.requireTuner)) exact = false;

  const group: MaterialGroup = {
    constraints,
    ...totals(constraints),
  };
  if (level != null) group.synchroTargetLevel = level;
  return { group, exact };
}
