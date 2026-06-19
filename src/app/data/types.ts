import type { Card, ExtraDeckMonster, MatchExplanation } from '@core';

/** Result monster without the heavy parsed `paths` (not needed for display). */
export type ResultMonster = Omit<ExtraDeckMonster, 'paths'>;

export interface MatchResult {
  monster: ResultMonster;
  explanation: MatchExplanation;
}

/** A selected input card and how many copies the user added. */
export interface SelectedEntry {
  card: Card;
  count: number;
}
