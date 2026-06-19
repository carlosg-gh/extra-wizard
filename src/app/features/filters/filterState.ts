import type { ResultFilters, SummonType } from '@core';
import type { MatchResult, ResultMonster } from '../../data/types';

function inRange(v: number | null, r: { min?: number; max?: number }): boolean {
  if (r.min == null && r.max == null) return true;
  if (v == null) return false;
  if (r.min != null && v < r.min) return false;
  if (r.max != null && v > r.max) return false;
  return true;
}

export function levelRankOf(m: ResultMonster): number | null {
  return m.level ?? m.rank ?? null;
}

export function applyFilters(results: MatchResult[], f: ResultFilters): MatchResult[] {
  return results.filter(({ monster: m }) => {
    if (f.summonType?.length && !f.summonType.includes(m.summonType)) return false;
    if (f.parseStatus?.length && !f.parseStatus.includes(m.parseStatus)) return false;
    if (f.attribute?.length && (!m.attribute || !f.attribute.includes(m.attribute))) return false;
    if (f.race?.length && !f.race.includes(m.race)) return false;
    if (f.archetype?.length && !f.archetype.some((a) => m.series.includes(a))) return false;
    if (f.linkRating && !inRange(m.linkRating, f.linkRating)) return false;
    if (f.levelRank && !inRange(levelRankOf(m), f.levelRank)) return false;
    if (f.atk && !inRange(m.atk, f.atk)) return false;
    if (f.def && !inRange(m.def, f.def)) return false;
    return true;
  });
}

export interface Facets {
  summonTypes: SummonType[];
  archetypes: string[];
  attributes: string[];
  races: string[];
  hasApproximate: boolean;
}

/** Derive the set of facet values present in the current results (so empty facets hide). */
export function deriveFacets(results: MatchResult[]): Facets {
  const summonTypes = new Set<SummonType>();
  const archetypes = new Set<string>();
  const attributes = new Set<string>();
  const races = new Set<string>();
  let hasApproximate = false;

  for (const { monster: m } of results) {
    summonTypes.add(m.summonType);
    for (const s of m.series) archetypes.add(s);
    if (m.attribute) attributes.add(m.attribute);
    if (m.race) races.add(m.race);
    if (m.parseStatus !== 'exact') hasApproximate = true;
  }

  const sortStr = (a: string, b: string) => a.localeCompare(b);
  return {
    summonTypes: [...summonTypes].sort(sortStr),
    archetypes: [...archetypes].sort(sortStr),
    attributes: [...attributes].sort(sortStr),
    races: [...races].sort(sortStr),
    hasApproximate,
  };
}
