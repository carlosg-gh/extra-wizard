import type { SummoningPath } from '../domain/types';
import type { ParserMonsterMeta } from './parseMaterials';

/**
 * Per-id hand-authored summon paths for the long tail the text extractors can't
 * (or shouldn't) generalize — mirrors {@link FUSION_SUBSTITUTE_IDS} in
 * `lexicon.ts`. Keyed by card id (`String(password ?? konami_id)`). This is data,
 * not grammar: adding an entry needs no parser change.
 *
 * Empty by default — the conditions layer (`grammar/conditions.ts`) handles the
 * common patterns; add an entry only when a specific card is mis-parsed and a
 * regex generalization would be risky.
 */
export type CuratedPathFn = (monster: ParserMonsterMeta) => SummoningPath[];

export const CURATED_PATHS: Record<string, CuratedPathFn> = {};
