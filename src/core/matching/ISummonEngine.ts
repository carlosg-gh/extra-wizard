import type { ExtraDeckMonster } from '../domain/types';
import type { MatchExplanation, MaterialInstance, MatchMode } from '../domain/query';

/**
 * The V2 seam. Any strategy for deciding "can these materials summon this
 * monster" implements this. V1 ships {@link ParserSummonEngine}; later an
 * ocgcore-wasm adapter or curated-override engine can be dropped in without
 * touching the app, worker, or pipeline.
 */
export interface ISummonEngine {
  readonly id: string;
  match(
    monster: ExtraDeckMonster,
    materials: MaterialInstance[],
    mode: MatchMode,
  ): MatchExplanation | null;
}
