import {
  normalizeYgoprodeckCard,
  ygoprodeckFullText,
  ygoprodeckMaterials,
} from '../../core/index-build/normalizeYgoprodeck';
import type { CardSource, NormalizedCard } from './types';

// One bulk request returns every card under `data`. `misc=yes` adds misc_info
// (formats / release dates) used to flag OCG-only cards.
const URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?misc=yes';

/**
 * YGOPRODeck — the most complete, frequently-updated DB. Reachable from CI;
 * blocked from the restricted dev sandbox (the pipeline falls back to yaml-yugi
 * there).
 */
export const ygoprodeckSource: CardSource = {
  name: 'ygoprodeck',
  async fetchRaw() {
    const res = await fetch(URL, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`ygoprodeck -> HTTP ${res.status}`);
    const body = (await res.json()) as { data?: unknown[] };
    if (!body || !Array.isArray(body.data)) {
      throw new Error('ygoprodeck: unexpected response shape (no `data` array)');
    }
    return { raws: body.data, url: URL };
  },
  normalize(raw: unknown): NormalizedCard | null {
    const typed = raw as Parameters<typeof normalizeYgoprodeckCard>[0];
    const card = normalizeYgoprodeckCard(typed);
    if (!card) return null;
    return { card, materialsText: ygoprodeckMaterials(typed), fullText: ygoprodeckFullText(typed) };
  },
};
