import type { BuildStep, Card, ExtraDeckMonster } from '@core';

/** Result monster without the heavy parsed `paths` (not needed for display). */
export type ResultMonster = Omit<ExtraDeckMonster, 'paths'>;

export interface MatchResult {
  monster: ResultMonster;
  /** Bridge mode only: total summons to reach this monster (1 = direct). */
  steps?: number;
  /** Bridge mode only: the build chain (root = this monster). */
  chain?: BuildStep;
}

/** A selected input card and how many copies the user added. */
export interface SelectedEntry {
  card: Card;
  count: number;
}
