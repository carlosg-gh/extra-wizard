import { useEffect, useMemo, useState } from 'react';
import type { Card } from '@core';

interface CardDb {
  ready: boolean;
  error: string | null;
  pool: Card[];
  byId: Map<string, Card>;
  search: (query: string, limit?: number) => Card[];
}

/**
 * Loads the input-card pool (every monster usable as a material) on the main
 * thread for autocomplete + selected-chip display. The heavy target index lives
 * in the worker.
 */
export function useCardDb(): CardDb {
  const [pool, setPool] = useState<Card[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.BASE_URL || '/';
    fetch(`${base}data/input-pool.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Card[]>;
      })
      .then((data) => {
        if (cancelled) return;
        setPool(data);
        setReady(true);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byId = useMemo(() => {
    const m = new Map<string, Card>();
    for (const c of pool) m.set(c.id, c);
    return m;
  }, [pool]);

  const search = useMemo(() => {
    const lowered = pool.map((c) => ({ c, n: c.name.toLowerCase() }));
    return (query: string, limit = 40): Card[] => {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      const starts: Card[] = [];
      const contains: Card[] = [];
      for (const { c, n } of lowered) {
        if (n.startsWith(q)) starts.push(c);
        else if (n.includes(q)) contains.push(c);
        if (starts.length >= limit) break;
      }
      return [...starts, ...contains].slice(0, limit);
    };
  }, [pool]);

  return { ready, error, pool, byId, search };
}
