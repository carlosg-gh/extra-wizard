/** Live card detail fetched on demand from YGOPRODeck for the modal. */
export interface CardDetailSet {
  name: string;
  code: string;
  rarity: string;
}

export interface CardDetail {
  id: string;
  description: string;
  prices: { cardmarket?: number; tcgplayer?: number };
  sets: CardDetailSet[];
  imageUrl: string;
}

/** Shape of the fields we read from a YGOPRODeck `cardinfo.php` record. */
interface RawDetail {
  id?: number;
  desc?: string;
  card_prices?: Array<{ cardmarket_price?: string; tcgplayer_price?: string }>;
  card_sets?: Array<{ set_name?: string; set_code?: string; set_rarity?: string }>;
  card_images?: Array<{ image_url?: string }>;
}

function price(s?: string): number | undefined {
  const n = s != null ? parseFloat(s) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function mapYgoprodeckDetail(raw: RawDetail): CardDetail {
  const p = raw.card_prices?.[0] ?? {};
  const sets = (raw.card_sets ?? [])
    .map((s) => ({ name: s.set_name ?? '', code: s.set_code ?? '', rarity: s.set_rarity ?? '' }))
    .filter((s) => s.name || s.code);
  return {
    id: String(raw.id ?? ''),
    description: raw.desc ?? '',
    prices: { cardmarket: price(p.cardmarket_price), tcgplayer: price(p.tcgplayer_price) },
    sets,
    imageUrl: raw.card_images?.[0]?.image_url ?? '',
  };
}
