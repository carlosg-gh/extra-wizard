import type { CostKind, SummonMethod, SummonType } from '../../domain/enums';
import type { MaterialConstraint, MaterialGroup } from '../../domain/types';
import { normalize } from '../tokenizer';
import { buildConstraint, parseCount, parseFilters, totals } from './shared';

/**
 * Build-time extraction of **summon restrictions** and **alternative summon
 * methods** from a monster's FULL effect text (not just the recipe line). This
 * complements the per-type recipe grammar: restrictions can suppress a card's
 * native path, and alternative clauses (tribute / send-from-field Special
 * Summons, alternate Xyz) become extra {@link SummoningPath}s.
 *
 * Philosophy (CLAUDE.md "never silently wrong"): only well-structured clauses
 * are emitted; a recognized-but-lossy clause is `approximate`, and costs that
 * reference non-field zones (hand/Deck/GY/banish) are never turned into field
 * material constraints.
 */

/** One alternative summon path lifted from effect text. */
export interface ExtractedPath {
  group: MaterialGroup;
  summonType: SummonType;
  method: SummonMethod;
  costKind: CostKind;
  requiresExtraCard: boolean;
  exact: boolean;
  targetRank?: number;
}

export interface RestrictionInfo {
  /** Native summon mechanics the card may NOT use → suppress those native paths. */
  forbiddenNative: SummonType[];
}

const CANNOT_RE = /Cannot be (Fusion|Synchro|Xyz|Link|Ritual) Summoned/gi;

/**
 * Detect "Cannot be {mechanic} Summoned." Anchored to the named summon mechanic
 * only — a bare "Cannot be Special Summoned (from the GY)" is a zone rule, not a
 * mechanic forbid, and must NOT suppress the native path.
 */
export function extractRestrictions(text: string): RestrictionInfo {
  const forbidden = new Set<SummonType>();
  for (const m of normalize(text).matchAll(CANNOT_RE)) {
    const t = m[1];
    if (t === 'Fusion' || t === 'Synchro' || t === 'Xyz' || t === 'Link') forbidden.add(t);
    // 'Ritual' is not an Extra Deck mechanic here — ignore for native suppression.
  }
  return { forbiddenNative: [...forbidden] };
}

/**
 * A Fusion Summoned without a Fusion Spell (Gladiator Beast, Neos, Mudragon) —
 * needs no main-deck card. Matches the canonical "(You do not use
 * 'Polymerization'.)" / "without using 'Polymerization'" plus the
 * "by {sending|shuffling|returning|Tributing} the above" contact phrasings.
 */
const CONTACT_RE =
  /(?:do not use|without(?: using)?) "Polymerization"|by (?:sending|shuffling|returning|Tributing) the above/i;
export function detectContactFusion(text: string): boolean {
  return CONTACT_RE.test(normalize(text));
}

/** A clause that summons THIS card via a stated cost (passive, or "Special Summon this card"). */
const SELF_SS_RE = /Must (?:first )?be Special Summoned|Special Summon this card/i;
const TRIBUTE_RE = /by Tributing (\d+) ([^.;()]*?monsters?)\b/i;
const SEND_FIELD_RE =
  /by sending (\d+) ([^.;()]*?) you control[^.()]*? to the (?:GY|Graveyard)(?:\s*\(([^)]*)\))?/i;
const ALT_XYZ_RE = /(?:You can )?also Xyz Summon this card by using ([^.]+?)(?:\.|$)/i;

/**
 * Scan full text for alternative summon methods → zero or more extra paths. Only
 * field-cost patterns are emitted (Tribute / send-you-control-to-GY / alt-Xyz);
 * hand/Deck/GY/banish costs are intentionally not modeled as field materials.
 */
export function extractAlternativePaths(text: string, summonType: SummonType): ExtractedPath[] {
  const out: ExtractedPath[] = [];
  const sentences = normalize(text).split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    const altXyz = extractAltXyz(s);
    if (altXyz) out.push(altXyz);

    if (!SELF_SS_RE.test(s)) continue;
    const cond = extractTribute(s, summonType) ?? extractSendField(s, summonType);
    if (cond) out.push(cond);
  }
  return out;
}

function extractTribute(s: string, summonType: SummonType): ExtractedPath | null {
  const m = s.match(TRIBUTE_RE);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1) return null;
  const f = parseFilters(m[2]);
  const c = buildConstraint(n, n, f, `Tributing ${m[1]} ${m[2].trim()}`);
  const group: MaterialGroup = { constraints: [c], ...totals([c]) };
  return {
    group,
    summonType,
    method: 'special-condition',
    costKind: 'tribute',
    requiresExtraCard: false,
    exact: f.exact,
  };
}

function extractSendField(s: string, summonType: SummonType): ExtractedPath | null {
  const m = s.match(SEND_FIELD_RE);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1) return null;

  const breakdown = m[3]?.trim();
  let constraints: MaterialConstraint[] = [];
  let exact = true;
  if (breakdown) {
    // "(1 Level 8 or higher Tuner and 1 non-Tuner Synchro Monster)" → per-slot constraints,
    // with the outer summary's scalar filters merged in as a floor (e.g. "Level 8 or higher").
    const outer = parseFilters(m[2]);
    const parts = breakdown
      .split(/\s+and\s+|,\s*/i)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const part of parts) {
      const { min, max, rest } = parseCount(part);
      const f = parseFilters(rest);
      if (!f.exact) exact = false;
      const c = buildConstraint(min, max, f, part);
      if (c.level == null && outer.level) c.level = outer.level;
      if (c.levelMin == null && outer.levelMin != null) c.levelMin = outer.levelMin;
      if (c.levelMax == null && outer.levelMax != null) c.levelMax = outer.levelMax;
      if (c.race == null && outer.race) c.race = outer.race;
      if (c.attribute == null && outer.attribute) c.attribute = outer.attribute;
      constraints.push(c);
    }
    // Cross-material relations ("Level difference of 7" / "same Level/Attribute") and any
    // outer summary we could only partially fold in make this a safe superset → approximate.
    if (/Level difference|same Level|same Attribute|different/i.test(m[0]) || !outer.exact) {
      exact = false;
    }
  }
  if (constraints.length === 0) {
    const f = parseFilters(m[2]);
    if (!f.exact) exact = false;
    constraints = [buildConstraint(n, n, f, m[0].trim())];
  }
  const group: MaterialGroup = { constraints, ...totals(constraints) };
  return {
    group,
    summonType,
    method: 'special-condition',
    costKind: 'send-to-gy',
    requiresExtraCard: false,
    exact,
  };
}

function extractAltXyz(s: string): ExtractedPath | null {
  const m = s.match(ALT_XYZ_RE);
  if (!m) return null;
  const { min, max, rest } = parseCount(m[1]);
  const f = parseFilters(rest);
  // The material is an existing Xyz monster (a Rank-Up / material transfer). Our
  // model can't check Rank on an Xyz card (rank lives in `rank`, not `level`), so
  // require an Xyz monster and drop the numeric rank → safe superset (approximate).
  const c: MaterialConstraint = { min, max, requireSummonType: ['Xyz'], raw: m[1].trim() };
  if (f.race) c.race = f.race;
  if (f.archetype) c.archetype = f.archetype;
  const group: MaterialGroup = { constraints: [c], ...totals([c]) };
  return {
    group,
    summonType: 'Xyz',
    method: 'alt-xyz',
    costKind: 'materials',
    requiresExtraCard: false,
    exact: false,
  };
}
