import type { BuildStep, Card, ExtraDeckMonster } from '@core';

/** Result monster without the heavy parsed `paths` (not needed for display). */
export type ResultMonster = Omit<ExtraDeckMonster, 'paths'>;

export interface MatchResult {
  monster: ResultMonster;
  /** Bridge mode only: total summons to reach this monster (1 = direct). */
  steps?: number;
  /** Bridge mode only: the build chain (root = this monster). */
  chain?: BuildStep;
  /** Bridge mode only: a TCG-Forbidden card appears somewhere in the chain. */
  usesBannedTcg?: boolean;
  /** Bridge mode only: an OCG-Forbidden card appears somewhere in the chain. */
  usesBannedOcg?: boolean;
}

/** Worker result for one query: direct matches and (optionally) bridged chains. */
export interface QueryAllResult {
  direct: MatchResult[];
  bridge: MatchResult[];
  /** Which engine produced `direct`: the parser, or ocgcore-verified. */
  engine?: 'parser-v1' | 'ocgcore-wasm';
}

/** A selected input card and how many copies the user added. */
export interface SelectedEntry {
  card: Card;
  count: number;
}
