import { useEffect, useState } from 'react';
import { mapYgoprodeckDetail, type CardDetail } from '../data/cardDetail';

// Cache details across opens so re-clicking a card is instant and re-fetch-free.
const cache = new Map<string, CardDetail>();

/**
 * Fetch a card's live detail (full text, prices, sets) from YGOPRODeck on demand.
 * Fails gracefully — the modal still shows everything we have in the local index.
 */
export function useCardDetail(password: string | null): {
  detail: CardDetail | null;
  loading: boolean;
  error: string | null;
} {
  const [detail, setDetail] = useState<CardDetail | null>(
    password ? (cache.get(password) ?? null) : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!password) {
      setDetail(null);
      setError(null);
      return;
    }
    const cached = cache.get(password);
    if (cached) {
      setDetail(cached);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);

    fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${encodeURIComponent(password)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ data?: unknown[] }>;
      })
      .then((body) => {
        const raw = body?.data?.[0];
        if (!raw) throw new Error('not found');
        const mapped = mapYgoprodeckDetail(raw as Parameters<typeof mapYgoprodeckDetail>[0]);
        cache.set(password, mapped);
        if (!cancelled) {
          setDetail(mapped);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [password]);

  return { detail, loading, error };
}
