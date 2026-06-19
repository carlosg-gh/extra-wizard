import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Card, MatchMode, ResultFilters } from '@core';
import { useCardDb } from './data/useCardDb';
import type { MatchResult, SelectedEntry } from './data/types';
import { CardSearchInput } from './features/card-input/CardSearchInput';
import { SelectedCardList } from './features/card-input/SelectedCardList';
import { activeFilterCount, applyFilters, deriveFacets } from './features/filters/filterState';
import { ResultsFilterPanel } from './features/filters/ResultsFilterPanel';
import { MatchModeToggle } from './features/mode-toggle/MatchModeToggle';
import { ResultsEmptyState } from './features/results/ResultsEmptyState';
import { ResultsGrid } from './features/results/ResultsGrid';
import { CardDetailModal } from './features/results/CardDetailModal';
import { useMatchWorker } from './worker/useMatchWorker';

export default function App() {
  const db = useCardDb();
  const { api, ready: workerReady, dbCount } = useMatchWorker();

  const [selected, setSelected] = useState<SelectedEntry[]>([]);
  const [mode, setMode] = useState<MatchMode>('any-subset');
  const [bridgeMode, setBridgeMode] = useState(false);
  const [filters, setFilters] = useState<ResultFilters>({ parseStatus: ['exact'] });
  const [results, setResults] = useState<MatchResult[]>([]);
  const [querying, setQuerying] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<MatchResult | null>(null);

  const addCard = useCallback((c: Card) => {
    setSelected((prev) => {
      const i = prev.findIndex((e) => e.card.id === c.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], count: next[i].count + 1 };
        return next;
      }
      return [...prev, { card: c, count: 1 }];
    });
  }, []);
  const inc = useCallback((id: string) => {
    setSelected((p) => p.map((e) => (e.card.id === id ? { ...e, count: e.count + 1 } : e)));
  }, []);
  const dec = useCallback((id: string) => {
    setSelected((p) =>
      p.flatMap((e) => (e.card.id !== id ? [e] : e.count > 1 ? [{ ...e, count: e.count - 1 }] : [])),
    );
  }, []);
  const remove = useCallback((id: string) => {
    setSelected((p) => p.filter((e) => e.card.id !== id));
  }, []);
  const clear = useCallback(() => setSelected([]), []);

  // Expand the selection into per-instance cards (duplicates matter for Fusion/use-all).
  const expanded = useMemo(
    () => selected.flatMap((e) => Array.from({ length: e.count }, () => e.card)),
    [selected],
  );

  // Re-run the (worker) query when inputs/mode/bridge change. Debounced for snappy
  // typing; bridge mode is heavier, so it gets a longer debounce.
  useEffect(() => {
    if (!workerReady) return;
    if (expanded.length === 0) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setQuerying(true);
    const t = window.setTimeout(
      () => {
        void api.current?.query(expanded, mode, false, bridgeMode).then((r) => {
          if (!cancelled) {
            setResults(r);
            setQuerying(false);
          }
        });
      },
      bridgeMode ? 300 : 120,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [expanded, mode, bridgeMode, workerReady, api]);

  const facets = useMemo(() => deriveFacets(results), [results]);
  // Direct matches lead; bridged ones follow by chain length, then by ATK.
  const sorted = useMemo(
    () =>
      applyFilters(results, filters).sort((a, b) => {
        const sa = a.steps ?? 1;
        const sb = b.steps ?? 1;
        if (sa !== sb) return sa - sb;
        return (b.monster.atk ?? 0) - (a.monster.atk ?? 0);
      }),
    [results, filters],
  );

  const ready = db.ready && workerReady;
  const activeFilters = activeFilterCount(filters);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden>
            ✦
          </span>
          Extra&nbsp;Wizard
        </div>
        <div className="topbar__sub">Extra Deck Monster Searcher</div>
      </header>

      <main className="layout">
        <section className="panel input-panel">
          <h2 className="panel__title">Your materials</h2>
          <CardSearchInput search={db.search} onAdd={addCard} />
          <SelectedCardList
            entries={selected}
            onInc={inc}
            onDec={dec}
            onRemove={remove}
            onClear={clear}
          />
          <div className="mode-row">
            <span className="muted small">Match mode</span>
            <MatchModeToggle mode={mode} onChange={setMode} disabled={bridgeMode} />
          </div>
          <label className="bridge-row">
            <span className="bridge-row__text">
              <span className="bridge-row__title">Bridge mode</span>
              <span className="muted xsmall">
                Chain summons up to 3 deep — a monster you make can be material for the next.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={bridgeMode}
              onChange={(e) => setBridgeMode(e.target.checked)}
              aria-label="Bridge mode"
            />
          </label>
          {db.error && <p className="error">Failed to load card data: {db.error}</p>}
          <p className="muted xsmall status">
            {ready
              ? `${db.pool.length.toLocaleString()} monsters · ${dbCount.toLocaleString()} Extra Deck targets`
              : 'Loading card data…'}
          </p>
        </section>

        <section className="results-area">
          <div className="results-area__head">
            <h2 className="panel__title">
              {sorted.length} result{sorted.length === 1 ? '' : 's'}
              {querying ? ' …' : ''}
            </h2>
            <button
              type="button"
              className="filters-toggle"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
            >
              Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}
            </button>
          </div>
          {sorted.length > 0 ? (
            <ResultsGrid results={sorted} onSelect={setSelectedCard} />
          ) : (
            <ResultsEmptyState hasInput={expanded.length > 0} loading={querying} />
          )}
        </section>

        <ResultsFilterPanel
          facets={facets}
          filters={filters}
          onChange={setFilters}
          resultCount={sorted.length}
          totalCount={results.length}
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
        />

        {selectedCard && (
          <CardDetailModal result={selectedCard} onClose={() => setSelectedCard(null)} />
        )}
      </main>
    </div>
  );
}
