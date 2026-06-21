import type { SummonType } from '../domain/enums';
import { worstParseStatus } from '../domain/enums';
import type { Card, ExtraDeckMonster } from '../domain/types';
import type { MatchContext } from '../domain/query';
import { parseMaterials } from '../parser/parseMaterials';
import { runQuery } from '../matching';

let seq = 0;

/** Build a normalized Card with sensible defaults for tests. */
export function mkCard(p: Partial<Card> & { name: string }): Card {
  const id = p.id ?? `c${++seq}`;
  return {
    id,
    password: Number(id) || null,
    konamiId: 0,
    name: p.name,
    race: p.race ?? 'Warrior',
    typeLineTags: p.typeLineTags ?? [],
    attribute: p.attribute ?? null,
    level: p.level ?? null,
    rank: p.rank ?? null,
    linkRating: p.linkRating ?? null,
    linkArrows: p.linkArrows ?? null,
    atk: p.atk ?? null,
    def: p.def ?? null,
    series: p.series ?? [],
    isTuner: p.isTuner ?? false,
    isEffect: p.isEffect ?? true,
    isToken: p.isToken ?? false,
    isPendulum: p.isPendulum ?? false,
    ocgOnly: p.ocgOnly ?? false,
    banTcg: p.banTcg ?? null,
    banOcg: p.banOcg ?? null,
    isFusionSubstitute: p.isFusionSubstitute ?? false,
    summonType: p.summonType ?? null,
    imageId: id,
  };
}

/** Build an Extra Deck monster by parsing the given material string (+ optional full text). */
export function mkEdm(
  p: Partial<Card> & { name: string; summonType: SummonType },
  materials: string,
  fullText?: string,
): ExtraDeckMonster {
  const base = mkCard(p);
  const paths = parseMaterials(materials, {
    id: base.id,
    summonType: p.summonType,
    level: base.level,
    rank: base.rank,
    linkRating: base.linkRating,
    fullText,
  });
  const parseStatus = paths.map((x) => x.parseStatus).reduce(worstParseStatus, 'exact');
  return { ...base, summonType: p.summonType, materialsRaw: materials, paths, parseStatus };
}

export function ctxOf(monsters: ExtraDeckMonster[], inputs: Card[]): MatchContext {
  const cardsById = new Map<string, Card>();
  for (const m of monsters) cardsById.set(m.id, m);
  for (const c of inputs) cardsById.set(c.id, c);
  return { monsters, cardsById };
}

/** Convenience: the set of monster ids matched for a given input set + mode. */
export function matchedIds(
  ctx: MatchContext,
  cardIds: string[],
  mode: 'any-subset' | 'use-all',
): Set<string> {
  return new Set(runQuery({ cardIds, mode }, ctx).items.map((i) => i.monsterId));
}
