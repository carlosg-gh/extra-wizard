import type { ExtraDeckMonster } from '../../../domain/types';
import type { MatchExplanation, MaterialInstance, MatchMode } from '../../../domain/query';
import type { ISummonEngine } from '../../ISummonEngine';

/**
 * When `true`, the app/worker may select the ocgcore engine. OFF until the WASM
 * core + assets are wired and validated (see README.md). Keep this the single
 * switch so enabling the engine is a one-line change.
 */
export const OCGCORE_ENABLED = false;

/**
 * Stage-0 scaffold for the ocgcore-wasm engine (see README.md).
 *
 * ocgcore is an async duel *simulator*, which doesn't fit `ISummonEngine.match`'s
 * synchronous, per-monster shape — so the adapter is two-phase:
 *   1. `prime(materials)` (async, Stage 1): load the core + cards.cdb + Lua scripts,
 *      build the field, advance to Main Phase 1, and collect the summonable Extra
 *      Deck monster ids from `MSG_SELECT_IDLECMD`.
 *   2. `match()` (sync): answer from that primed set.
 *
 * Until Stage 1 lands, `prime()` throws; `match()` returns null unless a set was
 * injected via `primeWith()`. The engine is OFF by default, so `runQuery` keeps
 * using `ParserSummonEngine`.
 */
export class OcgcoreSummonEngine implements ISummonEngine {
  readonly id = 'ocgcore-wasm';
  private summonable: Set<string> | null = null;

  /** Stage 1 (TODO): async-enumerate summonable Extra Deck ids from `materials`. */
  async prime(_materials: MaterialInstance[]): Promise<void> {
    throw new Error(
      'ocgcore-wasm engine is not wired yet — see src/core/matching/engines/ocgcore/README.md (Stage 1).',
    );
  }

  /**
   * Dev/test seam: inject a known summonable set, standing in for `prime()` until
   * the async enumerator lands. Lets the adapter be exercised through `runQuery`.
   */
  primeWith(ids: Iterable<string>): this {
    this.summonable = new Set(ids);
    return this;
  }

  match(
    monster: ExtraDeckMonster,
    _materials: MaterialInstance[],
    _mode: MatchMode,
  ): MatchExplanation | null {
    if (!this.summonable?.has(monster.id)) return null;
    // ocgcore decides legality holistically; per-constraint assignment isn't available,
    // so the explanation is intentionally empty (the UI still shows the match + recipe).
    return { pathIndex: 0, assignment: [], parseStatus: 'exact' };
  }
}
