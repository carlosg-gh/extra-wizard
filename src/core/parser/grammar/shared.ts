import type { Attribute, SummonType } from '../../domain/enums';
import { ATTRIBUTES, MONSTER_RACES } from '../../domain/enums';
import type { MaterialConstraint, MaterialGroup } from '../../domain/types';

const RACE_ALTERNATION = [...MONSTER_RACES]
  .sort((a, b) => b.length - a.length)
  .map((r) => r.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'))
  .join('|');
const RACE_RE = new RegExp(`\\b(${RACE_ALTERNATION})(?:-Type| Type)?\\b`, 'g');
const ATTR_RE = new RegExp(`\\b(${ATTRIBUTES.join('|')})\\b`, 'g');

const SUMMON_WORD: Record<string, SummonType> = {
  Fusion: 'Fusion',
  Synchro: 'Synchro',
  Xyz: 'Xyz',
  XYZ: 'Xyz',
  Link: 'Link',
};

const FILLER = new Set([
  'monster',
  'monsters',
  'the',
  'a',
  'an',
  'of',
  'that',
  'and',
  'with',
  'original',
  'token',
  'tokens',
  'each',
  'or',
  'more',
  'different',
  'names',
  'attributes',
  'types',
  'including',
  'except',
]);

/** Monster ability words checked against a card's `typeLineTags` (Tuner handled separately). */
const ABILITY_WORDS = ['Flip', 'Gemini', 'Union', 'Spirit', 'Toon'] as const;

export interface ParsedCount {
  min: number;
  max: number | null;
  rest: string;
  hadCount: boolean;
}

/** Peel a leading count: "N+", "N or more", or "N"; default 1 (exactly) if none. */
export function parseCount(seg: string): ParsedCount {
  let m = seg.match(/^\s*(\d+)\s*\+\s*/);
  if (m) return { min: +m[1], max: null, rest: seg.slice(m[0].length), hadCount: true };
  m = seg.match(/^\s*(\d+)\s+or\s+more\b\s*/i);
  if (m) return { min: +m[1], max: null, rest: seg.slice(m[0].length), hadCount: true };
  m = seg.match(/^\s*(\d+)\s+/);
  if (m) return { min: +m[1], max: +m[1], rest: seg.slice(m[0].length), hadCount: true };
  return { min: 1, max: 1, rest: seg, hadCount: false };
}

export interface FilterResult {
  attribute?: Attribute[];
  excludeAttribute?: Attribute[];
  race?: string[];
  excludeRace?: string[];
  level?: number[];
  levelMin?: number;
  levelMax?: number;
  linkRatingMin?: number;
  linkRatingMax?: number;
  archetype?: string[];
  requireTuner?: boolean;
  requireNonTuner?: boolean;
  requireEffect?: boolean;
  requireNonEffect?: boolean;
  requireAbility?: string[];
  requireSummonType?: SummonType[];
  excludeSummonType?: SummonType[];
  requireExtraDeck?: boolean;
  /** Unrecognized residual text (non-empty ⇒ the segment is only approximate). */
  leftover: string;
  exact: boolean;
}

/**
 * Peel known filter productions (attribute / race / Level / Tuner status /
 * Effect / summon-type / quoted-archetype) out of a segment. Quoted tokens here
 * are treated as ARCHETYPES (e.g. `1 "Bujin" monster`); the Fusion grammar
 * handles standalone quoted NAMED materials before calling this.
 */
export function parseFilters(input: string): FilterResult {
  let rest = ` ${input} `;
  const out: FilterResult = { leftover: '', exact: true };

  const arche: string[] = [];
  rest = rest.replace(/"([^"]+)"/g, (_m, name) => {
    arche.push(name);
    return ' ';
  });
  if (arche.length) out.archetype = arche;

  // "... in an Extra Monster Zone": only Extra Deck monsters occupy the EMZ, so the
  // material must itself be an Extra Deck monster (e.g. Gravity Controller).
  if (/\bExtra Monster Zone\b/i.test(rest)) {
    out.requireExtraDeck = true;
    rest = rest.replace(/\bin\s+(?:an?|the)\s+Extra Monster Zones?\b/gi, ' ');
    rest = rest.replace(/\bExtra Monster Zones?\b/gi, ' ');
  }

  // Link-rating requirement on the material itself ("Link-2 or higher Link Monster").
  // Peeled before the summon-type pass so it isn't double-read as a plain "Link".
  // A bare "Link-N" pins both bounds. Each form also implies a Link Monster.
  const linkHi = rest.match(/\bLink-(\d+)\s+or\s+higher\b/i);
  const linkLo = rest.match(/\bLink-(\d+)\s+or\s+lower\b/i);
  if (linkHi) {
    out.linkRatingMin = parseInt(linkHi[1], 10);
    out.requireSummonType = ['Link'];
    rest = rest.replace(linkHi[0], ' ');
  } else if (linkLo) {
    out.linkRatingMax = parseInt(linkLo[1], 10);
    out.requireSummonType = ['Link'];
    rest = rest.replace(linkLo[0], ' ');
  } else {
    const linkEq = rest.match(/\bLink-(\d+)\b/i);
    if (linkEq) {
      out.linkRatingMin = parseInt(linkEq[1], 10);
      out.linkRatingMax = out.linkRatingMin;
      out.requireSummonType = ['Link'];
      rest = rest.replace(linkEq[0], ' ');
    }
  }

  // non-<SummonType> (generalizes "non-Link") → excludeSummonType. Must precede the
  // positive summon-type pass, which would otherwise read the "Link" in "non-Link".
  const exSts: SummonType[] = [];
  rest = rest.replace(/\bnon-(Fusion|Synchro|Xyz|Link)\b/gi, (_m, w: string) => {
    const k = w.toLowerCase();
    exSts.push(k === 'fusion' ? 'Fusion' : k === 'synchro' ? 'Synchro' : k === 'xyz' ? 'Xyz' : 'Link');
    return ' ';
  });
  if (exSts.length) out.excludeSummonType = Array.from(new Set(exSts));

  if (/\bnon-Tuners?\b/i.test(rest)) {
    out.requireNonTuner = true;
    rest = rest.replace(/\bnon-Tuners?\b/gi, ' ');
  } else if (/\bTuners?\b/i.test(rest)) {
    out.requireTuner = true;
  }
  rest = rest.replace(/\bTuners?\b/gi, ' ');

  // non-<Attribute> ("non-FIRE") → excludeAttribute. Peeled before the positive pass
  // so the negated attribute isn't mistakenly read as a *required* one.
  const exAttrs: Attribute[] = [];
  rest = rest.replace(new RegExp(`\\bnon-(${ATTRIBUTES.join('|')})\\b`, 'g'), (_m, a: string) => {
    exAttrs.push(a as Attribute);
    return ' ';
  });
  if (exAttrs.length) out.excludeAttribute = exAttrs;

  const attrs: Attribute[] = [];
  rest = rest.replace(ATTR_RE, (a) => {
    attrs.push(a as Attribute);
    return ' ';
  });
  if (attrs.length) out.attribute = attrs;

  const sts: SummonType[] = [];
  rest = rest.replace(/\b(Fusion|Synchro|Xyz|XYZ|Link)\b/g, (w) => {
    const t = SUMMON_WORD[w];
    if (t) sts.push(t);
    return ' ';
  });
  if (sts.length) out.requireSummonType = Array.from(new Set(sts));

  // Normal (non-Effect) and ability words must be peeled BEFORE the generic
  // "Effect" rule so "non-Effect"/"Normal" aren't misread as requireEffect and
  // "Gemini"/"Flip Effect" capture the ability without leaking to leftover.
  if (/\bnon-Effect\b/i.test(rest)) {
    out.requireNonEffect = true;
    rest = rest.replace(/\bnon-Effect\b/gi, ' ');
  } else if (/\bNormal\b/i.test(rest)) {
    out.requireNonEffect = true;
    rest = rest.replace(/\bNormal\b/gi, ' ');
  }

  const abilities = ABILITY_WORDS.filter((a) => new RegExp(`\\b${a}\\b`, 'i').test(rest));
  if (abilities.length) {
    out.requireAbility = [...abilities];
    for (const a of abilities) rest = rest.replace(new RegExp(`\\b${a}\\b`, 'gi'), ' ');
  }

  if (/\bEffect\b/i.test(rest)) {
    out.requireEffect = true;
    rest = rest.replace(/\bEffect\b/gi, ' ');
  }

  // non-<Race> ("non-Dragon") → excludeRace, before the positive race pass.
  const exRaces: string[] = [];
  rest = rest.replace(new RegExp(`\\bnon-(${RACE_ALTERNATION})(?:-Type| Type)?\\b`, 'g'), (_m, r: string) => {
    exRaces.push(r);
    return ' ';
  });
  if (exRaces.length) out.excludeRace = exRaces;

  const races: string[] = [];
  rest = rest.replace(RACE_RE, (_m, r) => {
    races.push(r);
    return ' ';
  });
  if (races.length) out.race = races;

  const loRank = rest.match(/\b(?:Level|Rank)\s+(\d+)\s+or\s+lower\b/i);
  const hiRank = rest.match(/\b(?:Level|Rank)\s+(\d+)\s+or\s+higher\b/i);
  if (loRank) {
    out.levelMax = parseInt(loRank[1], 10);
    rest = rest.replace(loRank[0], ' ');
  } else if (hiRank) {
    out.levelMin = parseInt(hiRank[1], 10);
    rest = rest.replace(hiRank[0], ' ');
  } else {
    const lvl = rest.match(/\b(?:Level|Rank)\s+(\d+)\b/i);
    if (lvl) {
      out.level = [parseInt(lvl[1], 10)];
      rest = rest.replace(/\b(?:Level|Rank)\s+\d+\b/i, ' ');
    }
  }

  const residual = rest
    .split(/\s+/)
    .map((t) => t.replace(/[.,]/g, ''))
    .filter(Boolean)
    .filter((t) => !FILLER.has(t.toLowerCase()));
  out.leftover = residual.join(' ').trim();
  out.exact = out.leftover.length === 0;
  return out;
}

export function buildConstraint(
  min: number,
  max: number | null,
  f: FilterResult,
  raw: string,
  tokenAllowed?: boolean,
): MaterialConstraint {
  const c: MaterialConstraint = { min, max, raw };
  if (f.attribute) c.attribute = f.attribute;
  if (f.excludeAttribute) c.excludeAttribute = f.excludeAttribute;
  if (f.race) c.race = f.race;
  if (f.excludeRace) c.excludeRace = f.excludeRace;
  if (f.level) c.level = f.level;
  if (f.levelMin != null) c.levelMin = f.levelMin;
  if (f.levelMax != null) c.levelMax = f.levelMax;
  if (f.linkRatingMin != null) c.linkRatingMin = f.linkRatingMin;
  if (f.linkRatingMax != null) c.linkRatingMax = f.linkRatingMax;
  if (f.archetype) c.archetype = f.archetype;
  if (f.requireTuner) c.requireTuner = true;
  if (f.requireNonTuner) c.requireNonTuner = true;
  if (f.requireEffect) c.requireEffect = true;
  if (f.requireNonEffect) c.requireNonEffect = true;
  if (f.requireAbility) c.requireAbility = f.requireAbility;
  if (f.requireSummonType) c.requireSummonType = f.requireSummonType;
  if (f.excludeSummonType) c.excludeSummonType = f.excludeSummonType;
  if (f.requireExtraDeck) c.requireExtraDeck = true;
  if (tokenAllowed !== undefined) c.tokenAllowed = tokenAllowed;
  return c;
}

/** Compute total-count bounds for a set of constraints (for fast pruning). */
export function totals(constraints: MaterialConstraint[]): Pick<MaterialGroup, 'minTotal' | 'maxTotal'> {
  let minTotal = 0;
  let maxTotal = 0;
  let unbounded = false;
  for (const c of constraints) {
    minTotal += c.min;
    if (c.max == null) unbounded = true;
    else maxTotal += c.max;
  }
  return { minTotal, maxTotal: unbounded ? null : maxTotal };
}
