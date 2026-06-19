import type { Card, ExtraDeckMonster, MaterialGroup } from '../domain/types';
import type {
  BridgeQueryResult,
  BridgeResultItem,
  BuildStep,
  MatchContext,
  QueryInput,
} from '../domain/query';
import type { ParseStatus } from '../domain/enums';
import { worstParseStatus } from '../domain/enums';
import { cardSatisfiesConstraint } from './constraintEval';

/**
 * "Bridge mode" — reachability through a *chain* of summons, where a produced
 * Extra Deck monster becomes a material for a further summon. Example: with
 * A, B, C, if A+B makes D and D+C makes E, bridge mode surfaces E with the full
 * intermediary chain.
 *
 * It reuses the same per-constraint logic as {@link matchGroup} but tracks a
 * **footprint** per material (the set of base-card instances it consumes
 * transitively) and enforces **footprint-disjointness**: a base card cannot be
 * reused across two branches of a chain. The search is bounded — depth ≤
 * {@link MAX_BRIDGE_DEPTH}, a deduplicated pool, and a global step budget — so a
 * truncated run degrades gracefully (it may miss exotic deep chains, but never
 * emits a wrong chain).
 */

/** Longest summon chain (root→leaf) considered. depth 1 = direct match. */
const MAX_BRIDGE_DEPTH = 3;
/** Cap on distinct produced monsters kept as reusable materials. */
const MAX_POOL_INTERMEDIATES = 80;
/** Per-match backtracking guard (mirrors matchGroup's MAX_STEPS). */
const MAX_MATCH_STEPS = 200_000;
/** Whole-query step budget across all matches; exhaustion stops the search. */
const GLOBAL_STEP_BUDGET = 6_000_000;

/** A material available to the chain: a base card or a produced intermediate. */
interface BridgeItem {
  /** Pool-unique key: base instanceId, or `prod:${monsterId}` for an intermediate. */
  key: string;
  card: Card;
  /** Base-card instance ids consumed transitively (singleton for base items). */
  footprint: Set<string>;
  /** Number of summon nodes in this item's build (0 for a base card). */
  steps: number;
  /** Worst parse status across this item's whole build. */
  parseStatus: ParseStatus;
  build: BuildStep;
}

interface Budget {
  steps: number;
}

interface MonsterWitness {
  monster: ExtraDeckMonster;
  footprint: Set<string>;
  steps: number;
  parseStatus: ParseStatus;
  build: BuildStep;
}

function intersects(a: Set<string>, b: Set<string>): boolean {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) if (large.has(x)) return true;
  return false;
}

function uniquenessOk(
  kind: NonNullable<MaterialGroup['uniqueness']>,
  chosen: BridgeItem[],
): boolean {
  const keys = chosen.map(({ card }) =>
    kind === 'names' ? card.name : kind === 'attributes' ? card.attribute ?? '' : card.race,
  );
  return new Set(keys).size === keys.length;
}

/**
 * Footprint-aware sibling of {@link matchGroup}: assign distinct pool items to
 * the group's constraints (always `any-subset`), rejecting any item whose
 * footprint overlaps one already chosen. Returns the chosen items per
 * constraint, or null. Base items have singleton footprints, so this reduces to
 * the ordinary matcher when the pool is all base cards.
 */
function matchGroupItems(
  group: MaterialGroup,
  items: BridgeItem[],
  budget: Budget,
): BridgeItem[][] | null {
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

  const its =
    sumTarget != null ? [...items].sort((a, b) => weight(b.card) - weight(a.card)) : items;

  const compat: number[][] = its.map((m) => {
    const list: number[] = [];
    for (let ci = 0; ci < cs.length; ci++) {
      if (cardSatisfiesConstraint(m.card, cs[ci])) list.push(ci);
    }
    return list;
  });

  const assigned: number[][] = cs.map(() => []);
  const counts = cs.map(() => 0);
  const usedBase = new Set<string>();
  let local = 0;

  const validate = (sum: number): boolean => {
    for (let ci = 0; ci < cs.length; ci++) {
      if (counts[ci] < cs[ci].min) return false;
      if (cs[ci].max != null && counts[ci] > (cs[ci].max as number)) return false;
    }
    if (sumTarget != null && sum !== sumTarget) return false;
    if (group.uniqueness) {
      const chosen = assigned.flat().map((i) => its[i]);
      if (!uniquenessOk(group.uniqueness, chosen)) return false;
    }
    return true;
  };

  const rec = (idx: number, sum: number): boolean => {
    if (++local > MAX_MATCH_STEPS || --budget.steps <= 0) return false;
    if (idx === its.length) return validate(sum);

    const item = its[idx];
    if (!intersects(item.footprint, usedBase)) {
      for (const ci of compat[idx]) {
        if (cs[ci].max != null && counts[ci] >= (cs[ci].max as number)) continue;
        const w = sumTarget != null ? weight(item.card) : 0;
        if (sumTarget != null && sum + w > sumTarget) continue; // weights are >= 0
        assigned[ci].push(idx);
        counts[ci]++;
        for (const b of item.footprint) usedBase.add(b);
        if (rec(idx + 1, sum + w)) return true;
        for (const b of item.footprint) usedBase.delete(b);
        counts[ci]--;
        assigned[ci].pop();
      }
    }

    // any-subset: this item may be left unused.
    return rec(idx + 1, sum);
  };

  if (!rec(0, 0)) return null;
  return cs.map((_, ci) => assigned[ci].map((i) => its[i]));
}

/**
 * Try to summon `monster` from `pool` via any of its parsed paths. Returns the
 * assembled build (chain), the union footprint, total step count, and the worst
 * parse status across the chain — or null if no path matches.
 */
function tryMatchMonster(
  monster: ExtraDeckMonster,
  pool: BridgeItem[],
  budget: Budget,
): Omit<MonsterWitness, 'monster'> | null {
  for (const path of monster.paths) {
    if (path.parseStatus === 'unparsed') continue;
    const group = path.groups[0];
    if (!group) continue;
    const assignment = matchGroupItems(group, pool, budget);
    if (!assignment) continue;

    const chosen = assignment.flat();
    const footprint = new Set<string>();
    let steps = 1; // this summon
    let status: ParseStatus = path.parseStatus;
    const children: BuildStep[] = [];
    for (const it of chosen) {
      for (const b of it.footprint) footprint.add(b);
      steps += it.steps;
      status = worstParseStatus(status, it.parseStatus);
      children.push(it.build);
    }
    const build: BuildStep = {
      monsterId: monster.id,
      name: monster.name,
      summonType: monster.summonType,
      materialsRaw: monster.materialsRaw,
      children,
    };
    return { footprint, steps, parseStatus: status, build };
  }
  return null;
}

/** Necessary-condition prune over the whole pool (mirrors runQuery.quickFeasible). */
interface Rollup {
  count: number;
  hasTuner: boolean;
  levelSum: number;
  levelCounts: Map<number, number>;
}

function poolRollup(pool: BridgeItem[]): Rollup {
  let hasTuner = false;
  let levelSum = 0;
  const levelCounts = new Map<number, number>();
  for (const { card } of pool) {
    if (card.isTuner) hasTuner = true;
    if (card.level != null) {
      levelSum += card.level;
      levelCounts.set(card.level, (levelCounts.get(card.level) ?? 0) + 1);
    }
  }
  return { count: pool.length, hasTuner, levelSum, levelCounts };
}

function feasible(monster: ExtraDeckMonster, roll: Rollup): boolean {
  for (const path of monster.paths) {
    if (path.parseStatus === 'unparsed') continue;
    const g = path.groups[0];
    if (!g) continue;
    if (roll.count < g.minTotal) continue;
    if (path.summonType === 'Synchro' && g.synchroTargetLevel != null) {
      if (!roll.hasTuner) continue;
      if (roll.levelSum < g.synchroTargetLevel) continue;
    }
    if (path.summonType === 'Xyz' && path.targetRank != null) {
      const need = g.constraints.reduce((s, c) => s + c.min, 0) || 2;
      if ((roll.levelCounts.get(path.targetRank) ?? 0) < need) continue;
    }
    return true;
  }
  return false;
}

/** Material signature: produced monsters that share it are interchangeable as materials. */
function signature(c: Card): string {
  return [
    c.summonType ?? '',
    c.level ?? '',
    c.rank ?? '',
    c.linkRating ?? '',
    c.race,
    c.attribute ?? '',
    c.isTuner ? 'T' : '',
    c.isEffect ? 'E' : '',
    c.isToken ? 'K' : '',
    c.isFusionSubstitute ? 'S' : '',
    [...c.series].sort().join(','),
  ].join('|');
}

/**
 * Find every Extra Deck monster reachable from the provided cards through a
 * chain of up to {@link MAX_BRIDGE_DEPTH} summons. Direct matches come back as
 * `steps: 1`; bridged ones as `steps ≥ 2`, each with a self-contained build
 * chain (names resolved, no client lookups needed).
 */
export function runBridgeQuery(input: QueryInput, ctx: MatchContext): BridgeQueryResult {
  const baseItems: BridgeItem[] = [];
  input.cardIds.forEach((id, i) => {
    const card = ctx.cardsById.get(id);
    if (!card) return;
    const instanceId = `${id}#${i}`;
    baseItems.push({
      key: instanceId,
      card,
      footprint: new Set([instanceId]),
      steps: 0,
      parseStatus: 'exact',
      build: { monsterId: null, name: card.name, summonType: null, children: [] },
    });
  });
  const inputCount = baseItems.length;
  if (inputCount === 0) return { items: [], inputCount };

  const monsters = ctx.monsters.filter((m) => m.parseStatus !== 'unparsed');

  // Names referenced by any recipe; produced monsters bearing one are retained
  // even when their generic signature is already covered.
  const wantedNames = new Set<string>();
  for (const m of monsters) {
    for (const path of m.paths) {
      for (const g of path.groups) {
        for (const c of g.constraints) {
          if (c.namedCards) for (const n of c.namedCards) wantedNames.add(n);
        }
      }
    }
  }

  const budget: Budget = { steps: GLOBAL_STEP_BUDGET };
  const reached = new Map<string, MonsterWitness>();
  const pool: BridgeItem[] = [...baseItems];
  const sigSeen = new Set<string>();
  const nameSeen = new Set<string>();
  let intermediates = 0;

  for (let depth = 1; depth <= MAX_BRIDGE_DEPTH; depth++) {
    const roll = poolRollup(pool);
    const roundItems: BridgeItem[] = [];

    for (const monster of monsters) {
      if (budget.steps <= 0) break;
      if (reached.has(monster.id)) continue; // an earlier (fewer-step) build already won
      if (!feasible(monster, roll)) continue;
      const m = tryMatchMonster(monster, pool, budget);
      if (!m) continue;

      reached.set(monster.id, { monster, ...m });
      roundItems.push({
        key: `prod:${monster.id}`,
        card: monster,
        footprint: m.footprint,
        steps: m.steps,
        parseStatus: m.parseStatus,
        build: m.build,
      });
    }

    if (roundItems.length === 0 || budget.steps <= 0) break;
    if (depth === MAX_BRIDGE_DEPTH) break; // no further round will consume these

    // Merge this round's products into the pool. Dedupe by material signature
    // (smallest footprint wins), always retaining name-bearing items wanted by
    // some recipe. Earlier rounds have ≤ footprints, so a seen signature never
    // improves — first-come (smallest-first) is optimal.
    roundItems.sort((a, b) => a.footprint.size - b.footprint.size);
    for (const item of roundItems) {
      if (intermediates >= MAX_POOL_INTERMEDIATES) break;
      const sig = signature(item.card);
      const newSig = !sigSeen.has(sig);
      const wantedNew = wantedNames.has(item.card.name) && !nameSeen.has(item.card.name);
      if (!newSig && !wantedNew) continue;
      pool.push(item);
      intermediates++;
      sigSeen.add(sig);
      if (wantedNames.has(item.card.name)) nameSeen.add(item.card.name);
    }
  }

  const items: BridgeResultItem[] = [];
  for (const w of reached.values()) {
    items.push({
      monsterId: w.monster.id,
      summonType: w.monster.summonType,
      steps: w.steps,
      parseStatus: w.parseStatus,
      chain: w.build,
    });
  }
  return { items, inputCount };
}
