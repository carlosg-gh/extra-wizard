import type { Card } from '../../core/domain/types';

/** A normalized card plus the raw material text to parse (empty for main-deck monsters). */
export interface NormalizedCard {
  card: Card;
  materialsText: string;
}

/**
 * A card data source. The pipeline tries sources in order until one is
 * reachable, then maps every record through that source's `normalize`.
 */
export interface CardSource {
  name: string;
  /** Fetch the raw card array from the source (throws if unreachable). */
  fetchRaw(): Promise<{ raws: unknown[]; url: string }>;
  /** Map one raw record to a normalized card, or `null` to skip it. */
  normalize(raw: unknown): NormalizedCard | null;
}
