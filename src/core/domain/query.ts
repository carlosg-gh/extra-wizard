import type { Card, ExtraDeckMonster } from './types';
import type { ParseStatus, SummonMethod, SummonType } from './enums';

/**
 * - `any-subset`: the monster is summonable using SOME subset of the provided
 *   cards (leftovers allowed). The default "what can I make?" mode.
 * - `use-all`: the materials must consume EVERY provided card exactly once.
 */
export type MatchMode = 'any-subset' | 'use-all';

export interface QueryInput {
  /** Multiset of card ids the user added; duplicates are significant. */
  cardIds: string[];
  mode: MatchMode;
}

/** One material instance in the user's pool (a specific added card). */
export interface MaterialInstance {
  instanceId: string;
  card: Card;
}

/** Which input instances satisfied a given constraint, for the "why it matched" UI. */
export interface ConstraintAssignment {
  constraintRaw: string;
  instanceIds: string[];
}

export interface MatchExplanation {
  pathIndex: number;
  assignment: ConstraintAssignment[];
  parseStatus: ParseStatus;
}

export interface QueryResultItem {
  monsterId: string;
  summonType: SummonType;
  explanation: MatchExplanation;
}

export interface QueryResult {
  items: QueryResultItem[];
  mode: MatchMode;
  inputCount: number;
}

/** Context the matcher needs: the target monsters + a resolver for input cards. */
export interface MatchContext {
  monsters: ExtraDeckMonster[];
  cardsById: Map<string, Card>;
}

/** Client-side, post-query facet filters applied to results. */
export interface ResultFilters {
  summonType?: SummonType[];
  /** Filter by how the monster is summoned (native / special-condition / contact-fusion / alt-xyz). */
  summonMethod?: SummonMethod[];
  archetype?: string[];
  attribute?: string[];
  race?: string[];
  /** Monster ability tags: Tuner, Flip, Gemini, Spirit, Union, Toon, Pendulum. */
  ability?: string[];
  levelRank?: { min?: number; max?: number };
  linkRating?: { min?: number; max?: number };
  atk?: { min?: number; max?: number };
  def?: { min?: number; max?: number };
  parseStatus?: ParseStatus[];
}

/**
 * A node in a bridge-mode build chain. A summon node has `monsterId` set and its
 * `children` are the materials it consumed (base-card leaves or sub-summons);
 * a base-card leaf has `monsterId: null` and no children.
 */
export interface BuildStep {
  monsterId: string | null;
  name: string;
  summonType: SummonType | null;
  materialsRaw?: string;
  children: BuildStep[];
}

export interface BridgeResultItem {
  monsterId: string;
  summonType: SummonType;
  /** Total summons in the chain (1 = direct, ≥2 = reached via intermediaries). */
  steps: number;
  parseStatus: ParseStatus;
  chain: BuildStep;
}

export interface BridgeQueryResult {
  items: BridgeResultItem[];
  inputCount: number;
}
