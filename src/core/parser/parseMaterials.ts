import type { SummonType } from '../domain/enums';
import type { MaterialConstraint, MaterialGroup, SummoningPath } from '../domain/types';
import { detectTokensExcluded, detectUniqueness } from './lexicon';
import { normalize, splitTopLevel } from './tokenizer';
import { parseFusion } from './grammar/fusion';
import { parseLink } from './grammar/link';
import { parseSynchro } from './grammar/synchro';
import { parseXyz } from './grammar/xyz';
import { totals } from './grammar/shared';

/** The minimal monster facts the parser needs. */
export interface ParserMonsterMeta {
  summonType: SummonType;
  level: number | null;
  rank: number | null;
  linkRating: number | null;
}

/**
 * Parse a material string into one or more {@link SummoningPath}s. The caller
 * (pipeline) should pass `card.materials ?? firstLineOf(card.text.en)`; if that
 * is empty we emit a structural fallback derived from the monster's own stats.
 */
export function parseMaterials(
  rawInput: string | null | undefined,
  monster: ParserMonsterMeta,
): SummoningPath[] {
  const raw = rawInput ? normalize(rawInput) : '';
  if (!raw) return [structuralFallback(monster)];

  const segments = splitTopLevel(raw);
  const uniqueness = detectUniqueness(raw);
  const tokensExcluded = detectTokensExcluded(raw);

  let group: MaterialGroup;
  let exact: boolean;
  let targetRank: number | undefined;
  let targetLinkRating: number | undefined;

  switch (monster.summonType) {
    case 'Synchro':
      ({ group, exact } = parseSynchro(segments, monster.level));
      break;
    case 'Xyz':
      ({ group, exact, targetRank } = parseXyz(segments, monster.rank));
      break;
    case 'Link':
      ({ group, exact, targetLinkRating } = parseLink(segments, monster.linkRating));
      break;
    case 'Fusion':
      ({ group, exact } = parseFusion(segments));
      break;
    default:
      return [structuralFallback(monster)];
  }

  if (group.constraints.length === 0) return [structuralFallback(monster)];
  if (uniqueness) group.uniqueness = uniqueness;
  if (tokensExcluded) for (const c of group.constraints) c.tokenAllowed = false;

  const path: SummoningPath = {
    summonType: monster.summonType,
    groups: [group],
    parseStatus: exact ? 'exact' : 'approximate',
  };
  if (targetRank != null) path.targetRank = targetRank;
  if (targetLinkRating != null) path.targetLinkRating = targetLinkRating;
  return [path];
}

/** A best-effort path inferred from the monster's own stats when text is missing. */
function structuralFallback(monster: ParserMonsterMeta): SummoningPath {
  const st = monster.summonType;
  let group: MaterialGroup;

  if (st === 'Synchro') {
    const cs: MaterialConstraint[] = [
      { min: 1, max: 1, requireTuner: true, raw: '(structural) 1 Tuner' },
      { min: 1, max: null, requireNonTuner: true, raw: '(structural) 1+ non-Tuner' },
    ];
    group = { constraints: cs, ...totals(cs) };
    if (monster.level != null) group.synchroTargetLevel = monster.level;
  } else if (st === 'Xyz') {
    const c: MaterialConstraint = {
      min: 2,
      max: 2,
      tokenAllowed: false,
      raw: '(structural) 2 same-Level monsters',
    };
    if (monster.rank != null) c.level = [monster.rank];
    group = { constraints: [c], ...totals([c]) };
  } else if (st === 'Link') {
    const c: MaterialConstraint = {
      min: 1,
      max: monster.linkRating ?? null,
      raw: '(structural) Link materials',
    };
    group = { constraints: [c], ...totals([c]) };
    if (monster.linkRating != null) group.linkContribTarget = monster.linkRating;
  } else {
    const c: MaterialConstraint = { min: 2, max: null, raw: '(structural) materials unknown' };
    group = { constraints: [c], ...totals([c]) };
  }

  const path: SummoningPath = {
    summonType: st,
    groups: [group],
    parseStatus: st === 'Fusion' ? 'unparsed' : 'approximate',
    notes: 'structural fallback',
  };
  if (monster.rank != null) path.targetRank = monster.rank;
  if (monster.linkRating != null) path.targetLinkRating = monster.linkRating;
  return path;
}
