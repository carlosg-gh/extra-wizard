import type { Attribute, LinkArrow, ParseStatus, SummonType } from './enums';

/**
 * A single material requirement (one "slot specification").
 *
 * Semantics: scalar fields are ANDed together; array fields are ORed within
 * themselves (e.g. `attribute: ['LIGHT','DARK']` means LIGHT *or* DARK).
 * `min`/`max` bound how many distinct materials may satisfy this constraint.
 */
export interface MaterialConstraint {
  /** Minimum number of materials that must satisfy this constraint. */
  min: number;
  /** Maximum number; `null` means unbounded ("or more", "+"). */
  max: number | null;

  /** Allowed exact Levels (material's Level must be one of these). */
  level?: number[];
  /** Minimum Level ("Level N or higher"). */
  levelMin?: number;
  /** Maximum Level ("Level N or lower"). */
  levelMax?: number;
  /** Allowed races/Types (e.g. ['Dragon']). */
  race?: string[];
  /** Allowed attributes. */
  attribute?: Attribute[];
  /** Allowed archetypes — matched against a card's `series`. */
  archetype?: string[];
  /** Specific card names (Fusion named materials). */
  namedCards?: string[];

  /** Material must be a Tuner. */
  requireTuner?: boolean;
  /** Material must NOT be a Tuner. */
  requireNonTuner?: boolean;
  /** Material must be an Effect Monster. */
  requireEffect?: boolean;
  /** Material must be one of these summon types (e.g. "non-Tuner Synchro Monster"). */
  requireSummonType?: SummonType[];
  /** Material must NOT be one of these summon types (e.g. "non-Link monsters"). */
  excludeSummonType?: SummonType[];

  /** Whether Tokens may satisfy this constraint. Defaults false for Xyz, true otherwise. */
  tokenAllowed?: boolean;

  /** The raw text fragment this constraint was parsed from (for the "why" UI + debugging). */
  raw: string;
}

/**
 * A set of constraints that must be satisfied simultaneously by a partition of
 * the chosen materials. V1 emits exactly one group per {@link SummoningPath};
 * requirement-level OR is modeled as multiple paths.
 */
export interface MaterialGroup {
  constraints: MaterialConstraint[];
  /** Uniqueness rule across all materials chosen for this group. */
  uniqueness?: 'names' | 'attributes' | 'types' | null;
  /** Synchro only: the combined Level of all chosen materials must equal this. */
  synchroTargetLevel?: number;
  /**
   * Link only: the combined Link contribution of chosen materials must equal
   * this (a normal monster contributes 1; a Link monster contributes its Rating).
   */
  linkContribTarget?: number;
  /** Lower bound on total materials (sum of constraint minimums) — for fast pruning. */
  minTotal: number;
  /** Upper bound on total materials (`null` if any constraint is unbounded). */
  maxTotal: number | null;
}

/** One way to summon a monster. A monster matches if ANY of its paths match. */
export interface SummoningPath {
  summonType: SummonType;
  groups: MaterialGroup[];
  /** Xyz: the Rank produced (materials' Level must equal this). */
  targetRank?: number;
  /** Link: the Link Rating produced. */
  targetLinkRating?: number;
  parseStatus: ParseStatus;
  /** Free-text parser annotations (e.g. "structural fallback", "substitute allowed"). */
  notes?: string;
}

/**
 * A normalized monster card. Main-deck monsters (usable as materials) have
 * `summonType === null`; Extra Deck monsters narrow to {@link ExtraDeckMonster}.
 */
export interface Card {
  /** Stable id: `String(password ?? konami_id)`. */
  id: string;
  password: number | null;
  konamiId: number;
  name: string;
  /** Primary monster Type (first token of `monster_type_line`). */
  race: string;
  /** Remaining tokens of `monster_type_line` (e.g. ['Synchro','Effect','Tuner']). */
  typeLineTags: string[];
  attribute: Attribute | null;
  /** Synchro/Fusion/main-deck Level; `null` for Xyz and Link. */
  level: number | null;
  /** Xyz Rank; `null` otherwise. */
  rank: number | null;
  /** Link Rating (= linkArrows.length); `null` otherwise. */
  linkRating: number | null;
  linkArrows: LinkArrow[] | null;
  atk: number | null;
  def: number | null;
  /** Archetypes this card belongs to. */
  series: string[];
  isTuner: boolean;
  isEffect: boolean;
  isToken: boolean;
  isPendulum: boolean;
  /** True for the small set of "Fusion Substitute" monsters (e.g. King of the Swamp). */
  isFusionSubstitute: boolean;
  /** Extra Deck mechanic, or `null` for main-deck monsters. */
  summonType: SummonType | null;
  /** Id used to resolve a thumbnail image (usually equals `id`). */
  imageId: string;
}

/** An Extra Deck monster: a {@link Card} with a known summon type and parsed paths. */
export interface ExtraDeckMonster extends Card {
  summonType: SummonType;
  /** The raw material string the paths were parsed from. */
  materialsRaw: string;
  /** One or more summoning paths (≥1). */
  paths: SummoningPath[];
  /** Worst parse status across all paths (drives the badge + coverage report). */
  parseStatus: ParseStatus;
}
