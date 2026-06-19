/**
 * Candidate URLs for the aggregated yaml-yugi card data, tried in order.
 * GitHub Pages + jsDelivr are preferred (CDN, fast); the raw.githubusercontent
 * `aggregate` branch is a reliable fallback (and the one reachable from
 * restricted CI/sandbox networks).
 */
const CARD_URLS = [
  'https://dawnbrandbots.github.io/yaml-yugi/cards.json',
  'https://cdn.jsdelivr.net/gh/DawnbrandBots/yaml-yugi@aggregate/cards.json',
  'https://raw.githubusercontent.com/DawnbrandBots/yaml-yugi/aggregate/cards.json',
];

export interface FetchResult {
  raws: unknown[];
  source: string;
}

/** Fetch and JSON-parse the aggregated card list from the first reachable source. */
export async function fetchYamlYugi(urls: string[] = CARD_URLS): Promise<FetchResult> {
  const errors: string[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) {
        errors.push(`${url} → HTTP ${res.status}`);
        continue;
      }
      const data: unknown = await res.json();
      const raws = Array.isArray(data) ? data : Object.values(data as Record<string, unknown>);
      return { raws, source: url };
    } catch (err) {
      errors.push(`${url} → ${(err as Error).message}`);
    }
  }
  throw new Error(`Could not fetch yaml-yugi from any source:\n  ${errors.join('\n  ')}`);
}
