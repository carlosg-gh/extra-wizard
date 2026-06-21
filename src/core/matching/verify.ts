/**
 * The verifier seam: ocgcore (or any oracle) confirming the parser's candidates.
 * Used by the worker to prune `runQuery` results down to what the real ruleset
 * actually allows — see the engine README ("verifier over the parser's candidates").
 */
export interface SummonVerifier {
  /** Did the oracle confirm this monster id is summonable from the board? */
  confirms(id: string): boolean;
  /**
   * Could the oracle even evaluate this id? `false` when its card data was missing
   * (e.g. not in cards.cdb), so we must NOT treat a non-confirmation as a denial.
   */
  wasEvaluable(id: string): boolean;
}

/**
 * Keep the parser candidates the verifier confirmed, PLUS any it couldn't evaluate
 * (missing data) — so the verifier only ever removes results it actively rejected,
 * never silently drops a parser match it had no opinion on.
 */
export function verifyItems<T extends { monsterId: string }>(
  items: T[],
  verifier: SummonVerifier,
): T[] {
  return items.filter((it) => verifier.confirms(it.monsterId) || !verifier.wasEvaluable(it.monsterId));
}
