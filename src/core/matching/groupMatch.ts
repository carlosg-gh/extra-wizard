import type { Card, MaterialGroup } from '../domain/types';
import type { ConstraintAssignment, MaterialInstance, MatchMode } from '../domain/query';
import { cardSatisfiesConstraint } from './constraintEval';

/** Safety valve against pathological backtracking; real inputs are tiny. */
const MAX_STEPS = 300_000;

/**
 * Find an assignment of distinct material instances to the group's constraints
 * such that every constraint's count is within `[min, max]`, each assigned card
 * passes that constraint's filters, any sum target (Synchro Level / Link
 * contribution) is met exactly, and any uniqueness rule holds.
 *
 * - `any-subset`: leftover materials are allowed.
 * - `use-all`: every material must be assigned.
 *
 * Returns the first satisfying assignment (for the "why it matched" UI) or null.
 */
export function matchGroup(
  group: MaterialGroup,
  materials: MaterialInstance[],
  mode: MatchMode,
): ConstraintAssignment[] | null {
  const cs = group.constraints;
  if (cs.length === 0) return null;

  const hasSynchroSum = group.synchroTargetLevel != null;
  const hasLinkSum = !hasSynchroSum && group.linkContribTarget != null;
  const sumTarget = hasSynchroSum
    ? (group.synchroTargetLevel as number)
    : hasLinkSum
      ? (group.linkContribTarget as number)
      : null;

  const weight = (card: Card): number => {
    if (hasSynchroSum) return card.level ?? 0;
    if (hasLinkSum) return card.summonType === 'Link' ? card.linkRating ?? 1 : 1;
    return 0;
  };

  // Sorting heaviest-first tightens the overshoot prune when a sum target exists.
  const mats = sumTarget != null ? [...materials].sort((a, b) => weight(b.card) - weight(a.card)) : materials;

  // Precompute which constraints each material is eligible for.
  const compat: number[][] = mats.map((m) => {
    const list: number[] = [];
    for (let ci = 0; ci < cs.length; ci++) {
      if (cardSatisfiesConstraint(m.card, cs[ci])) list.push(ci);
    }
    return list;
  });

  const assigned: number[][] = cs.map(() => []);
  const counts = cs.map(() => 0);
  let steps = 0;

  const validate = (sum: number): boolean => {
    for (let ci = 0; ci < cs.length; ci++) {
      if (counts[ci] < cs[ci].min) return false;
      if (cs[ci].max != null && counts[ci] > (cs[ci].max as number)) return false;
    }
    if (sumTarget != null && sum !== sumTarget) return false;
    if (group.uniqueness && !uniquenessOk(group.uniqueness, assigned, mats)) return false;
    return true;
  };

  const rec = (idx: number, sum: number): boolean => {
    if (++steps > MAX_STEPS) return false;
    if (idx === mats.length) return validate(sum);

    for (const ci of compat[idx]) {
      if (cs[ci].max != null && counts[ci] >= (cs[ci].max as number)) continue;
      const w = sumTarget != null ? weight(mats[idx].card) : 0;
      if (sumTarget != null && sum + w > sumTarget) continue; // weights are >= 0
      assigned[ci].push(idx);
      counts[ci]++;
      if (rec(idx + 1, sum + w)) return true;
      counts[ci]--;
      assigned[ci].pop();
    }

    if (mode === 'any-subset' && rec(idx + 1, sum)) return true;
    return false;
  };

  if (!rec(0, 0)) return null;
  return cs.map((c, ci) => ({
    constraintRaw: c.raw,
    instanceIds: assigned[ci].map((i) => mats[i].instanceId),
  }));
}

function uniquenessOk(
  kind: NonNullable<MaterialGroup['uniqueness']>,
  assigned: number[][],
  mats: MaterialInstance[],
): boolean {
  const keys: string[] = [];
  for (const list of assigned) {
    for (const i of list) {
      const card = mats[i].card;
      keys.push(kind === 'names' ? card.name : kind === 'attributes' ? card.attribute ?? '' : card.race);
    }
  }
  return new Set(keys).size === keys.length;
}
