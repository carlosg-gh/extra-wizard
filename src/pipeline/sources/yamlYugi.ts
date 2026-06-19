import { normalizeCard, pickMaterials } from '../../core/index-build/normalizeCard';
import { RawCardSchema } from '../schema/yamlYugiCard';
import type { CardSource, NormalizedCard } from './types';

/**
 * Candidate URLs for the aggregated yaml-yugi card data, tried in order.
 * GitHub Pages + jsDelivr are preferred; the raw.githubusercontent `aggregate`
 * branch is the fallback reachable from restricted CI/sandbox networks.
 */
const CARD_URLS = [
  'https://dawnbrandbots.github.io/yaml-yugi/cards.json',
  'https://cdn.jsdelivr.net/gh/DawnbrandBots/yaml-yugi@aggregate/cards.json',
  'https://raw.githubusercontent.com/DawnbrandBots/yaml-yugi/aggregate/cards.json',
];

/** yaml-yugi — fallback source (its bulk feed is reachable from the sandbox). */
export const yamlYugiSource: CardSource = {
  name: 'yaml-yugi',
  async fetchRaw() {
    const errors: string[] = [];
    for (const url of CARD_URLS) {
      try {
        const res = await fetch(url, { headers: { accept: 'application/json' } });
        if (!res.ok) {
          errors.push(`${url} -> HTTP ${res.status}`);
          continue;
        }
        const data: unknown = await res.json();
        const raws = Array.isArray(data) ? data : Object.values(data as Record<string, unknown>);
        return { raws, url };
      } catch (err) {
        errors.push(`${url} -> ${(err as Error).message}`);
      }
    }
    throw new Error(`yaml-yugi unreachable:\n  ${errors.join('\n  ')}`);
  },
  normalize(raw: unknown): NormalizedCard | null {
    const parsed = RawCardSchema.safeParse(raw);
    if (!parsed.success) return null;
    const card = normalizeCard(parsed.data);
    if (!card) return null;
    return { card, materialsText: pickMaterials(parsed.data) };
  },
};
