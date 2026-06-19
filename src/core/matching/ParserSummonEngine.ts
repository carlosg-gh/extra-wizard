import type { ExtraDeckMonster } from '../domain/types';
import type { MatchExplanation, MaterialInstance, MatchMode } from '../domain/query';
import type { ISummonEngine } from './ISummonEngine';
import { matchGroup } from './groupMatch';

/** V1 engine: matches against the build-time-parsed {@link SummoningPath}s. */
export class ParserSummonEngine implements ISummonEngine {
  readonly id = 'parser-v1';

  match(
    monster: ExtraDeckMonster,
    materials: MaterialInstance[],
    mode: MatchMode,
  ): MatchExplanation | null {
    for (let pi = 0; pi < monster.paths.length; pi++) {
      const group = monster.paths[pi].groups[0];
      if (!group) continue;
      const assignment = matchGroup(group, materials, mode);
      if (assignment) {
        return { pathIndex: pi, assignment, parseStatus: monster.paths[pi].parseStatus };
      }
    }
    return null;
  }
}
