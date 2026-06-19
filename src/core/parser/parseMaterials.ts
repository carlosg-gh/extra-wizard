import type { SummonType } from '../domain/enums';
import type { MaterialConstraint, MaterialGroup, SummoningPath } from '../domain/types';
import { CURATED_PATHS } from './curatedPaths';
import { detectTokensExcluded, detectUniqueness } from './lexicon';
import { normalize, splitTopLevel } from './tokenizer';
import { parseFusion } from './grammar/fusion';
import { parseLink } from './grammar/link';
import { parseSynchro } from './grammar/synchro';
import { parseXyz } from './grammar/xyz';
import { totals } from './grammar/shared';
import {
  detectContactFusion,
  extractAlternativePaths,
  extractRestrictions,
  type ExtractedPath,
} from './grammar/conditions';

/** The minimal monster facts the parser needs. */
export interface ParserMonsterMeta {
  /** Card id (for curated overrides). Optional so test fixtures can omit it. */
  id?: string;
  summonType: SummonType;
  level: number | null;
  rank: number | null;
  linkRating: number | null;
  /** Full effect text, used to extract restrictions + alternative summon methods. */
  fullText?: string;
}

/**
 * Parse a material string into one or more {@link SummoningPath}s. The native
 * recipe comes from `rawInput` (the canonical material line); the optional
 * `monster.fullText` feeds the conditions layer (restrictions + alternative
 * summon methods). A monster matches if ANY of its paths match.
 */
export function parseMaterials(
  rawInput: string | null | undefined,
  monster: ParserMonsterMeta,
): SummoningPath[] {
  const fullText = monster.fullText ?? '';
  const restriction = fullText ? extractRestrictions(fullText) : { forbiddenNative: [] };
  const paths: SummoningPath[] = [];

  // 1. Native recipe — unless the card cannot be summoned by its own mechanic.
  if (!restriction.forbiddenNative.includes(monster.summonType)) {
    const native = parseNativeRecipe(rawInput, monster);
    const isContact =
      monster.summonType === 'Fusion' && fullText !== '' && detectContactFusion(fullText);
    for (const p of native) {
      if (isContact) {
        p.method = 'contact-fusion';
        p.costKind = 'send-to-gy';
        p.requiresExtraCard = false;
      } else {
        p.method = p.method ?? 'native';
        // Ordinary Fusions need a Fusion Spell; other mechanics are field-only.
        p.requiresExtraCard = p.requiresExtraCard ?? monster.summonType === 'Fusion';
      }
    }
    paths.push(...native);
  }

  // 2. Alternative summon methods extracted from full text.
  if (fullText) {
    for (const e of extractAlternativePaths(fullText, monster.summonType)) {
      paths.push(extractedToPath(e));
    }
  }

  // 3. Curated per-id overrides (escape hatch for the long tail).
  const override = monster.id ? CURATED_PATHS[monster.id] : undefined;
  if (override) paths.push(...override(monster));

  // 4. Nothing summonable by our model → a single hidden placeholder, never a fake recipe.
  if (paths.length === 0) return [unsummonablePlaceholder(monster)];
  return paths;
}

/** The per-type recipe grammar (unchanged) + a stats-only structural fallback. */
function parseNativeRecipe(
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

function extractedToPath(e: ExtractedPath): SummoningPath {
  const path: SummoningPath = {
    summonType: e.summonType,
    groups: [e.group],
    parseStatus: e.exact ? 'exact' : 'approximate',
    method: e.method,
    costKind: e.costKind,
    requiresExtraCard: e.requiresExtraCard,
  };
  if (e.targetRank != null) path.targetRank = e.targetRank;
  return path;
}

/** A monster with no parseable summon method: kept but hidden (opt-in via includeUnparsed). */
function unsummonablePlaceholder(monster: ParserMonsterMeta): SummoningPath {
  const c: MaterialConstraint = { min: 2, max: null, raw: '(no parseable summon method)' };
  return {
    summonType: monster.summonType,
    groups: [{ constraints: [c], ...totals([c]) }],
    parseStatus: 'unparsed',
    notes: 'no parseable summon method',
  };
}

/** A best-effort path inferred from the monster's own stats when text is missing. */
function structuralFallback(monster: ParserMonsterMeta): SummoningPath {
  const st = monster.summonType;
  let group: MaterialGroup;

  if (st === 'Synchro') {
    const cs: MaterialConstraint[] = [
      { min: 1, max: 1, requireTuner: true, requireLevel: true, raw: '(structural) 1 Tuner' },
      { min: 1, max: null, requireNonTuner: true, requireLevel: true, raw: '(structural) 1+ non-Tuner' },
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
