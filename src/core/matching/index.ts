import type { ExtraDeckMonster } from '../domain/types';
import type {
  MatchContext,
  MaterialInstance,
  QueryInput,
  QueryResult,
  QueryResultItem,
} from '../domain/query';
import type { ISummonEngine } from './ISummonEngine';
import { ParserSummonEngine } from './ParserSummonEngine';

export interface RunQueryOptions {
  engine?: ISummonEngine;
  /** Include monsters whose materials could not be parsed (hidden by default). */
  includeUnparsed?: boolean;
}

interface Rollup {
  count: number;
  hasTuner: boolean;
  levelSum: number;
  levelCounts: Map<number, number>;
}

function rollup(materials: MaterialInstance[]): Rollup {
  let hasTuner = false;
  let levelSum = 0;
  const levelCounts = new Map<number, number>();
  for (const { card } of materials) {
    if (card.isTuner) hasTuner = true;
    if (card.level != null) {
      levelSum += card.level;
      levelCounts.set(card.level, (levelCounts.get(card.level) ?? 0) + 1);
    }
  }
  return { count: materials.length, hasTuner, levelSum, levelCounts };
}

/**
 * Conservative necessary-condition check used to skip obviously-impossible
 * monsters before the full backtracking match. Must never reject a real match.
 */
function quickFeasible(
  monster: ExtraDeckMonster,
  count: number,
  roll: Rollup,
  mode: QueryInput['mode'],
): boolean {
  for (const path of monster.paths) {
    const g = path.groups[0];
    if (!g) continue;
    if (count < g.minTotal) continue;
    if (mode === 'use-all' && g.maxTotal != null && count > g.maxTotal) continue;

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

/**
 * Run a query: for each Extra Deck monster, ask the engine whether the provided
 * cards can summon it under the chosen mode.
 */
export function runQuery(
  input: QueryInput,
  ctx: MatchContext,
  opts: RunQueryOptions = {},
): QueryResult {
  const engine = opts.engine ?? new ParserSummonEngine();
  const materials: MaterialInstance[] = [];
  input.cardIds.forEach((id, i) => {
    const card = ctx.cardsById.get(id);
    if (card) materials.push({ instanceId: `${id}#${i}`, card });
  });

  const roll = rollup(materials);
  const items: QueryResultItem[] = [];

  for (const monster of ctx.monsters) {
    if (!opts.includeUnparsed && monster.parseStatus === 'unparsed') continue;
    if (!quickFeasible(monster, materials.length, roll, input.mode)) continue;
    const explanation = engine.match(monster, materials, input.mode);
    if (explanation) {
      items.push({ monsterId: monster.id, summonType: monster.summonType, explanation });
    }
  }

  return { items, mode: input.mode, inputCount: materials.length };
}
