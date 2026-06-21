import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BanRegion, Card, MatchMode, ResultFilters } from '@core';
import { useCardDb } from './data/useCardDb';
import type { MatchResult, SelectedEntry } from './data/types';
import { CardSearchInput } from './features/card-input/CardSearchInput';
import { SelectedCardList } from './features/card-input/SelectedCardList';
import { activeFilterCount, applyFilters, deriveFacets } from './features/filters/filterState';
import { ResultsFilterPanel } from './features/filters/ResultsFilterPanel';
import { MatchModeToggle } from './features/mode-toggle/MatchModeToggle';
import { ResultsEmptyState } from './features/results/ResultsEmptyState';
import { ResultsGrid } from './features/results/ResultsGrid';
import { ResultsTabs, type ResultTab } from './features/results/ResultsTabs';
import { CardDetailModal } from './features/results/CardDetailModal';
import { useMatchWorker } from './worker/useMatchWorker';

export default function App() {
  const db = useCardDb();
  const { api, ready: workerReady, dbCount } = useMatchWorker();

  const [selected, setSelected] = useState<SelectedEntry[]>([]);
  const [mode, setMode] = useState<MatchMode>('any-subset');
  const [tab, setTab] = useState<ResultTab>('direct');
  const [includeFusions, setIncludeFusions] = useState(false);
  const [region, setRegion] = useState<BanRegion>('tcg');
  const [showBanned, setShowBanned] = useState(false);
  const [filters, setFilters] = useState<ResultFilters>({});
  const [direct, setDirect] = useState<MatchResult[]>([]);
  const [bridge, setBridge] = useState<MatchResult[]>([]);
  const [bridgeLoaded, setBridgeLoaded] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [bridgeQuerying, setBridgeQuerying] = useState(false);
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

  // Bridge is the heavy path, so it's computed lazily — only once the Bridge tab has
  // been opened (then it stays fresh so the tab count keeps updating).
  const wantBridge = tab === 'bridge' || bridgeLoaded;

  // Re-run the (worker) query when inputs/mode/options change. Debounced for snappy
  // typing; the bridge path gets a longer debounce.
  useEffect(() => {
    if (!workerReady) return;
    if (expanded.length === 0) {
      setDirect([]);
      setBridge([]);
      return;
    }
    let cancelled = false;
    setQuerying(true);
    if (wantBridge) setBridgeQuerying(true);
    const t = window.setTimeout(
      () => {
        void api.current
          ?.queryAll(expanded, mode, { wantBridge, excludeFusions: !includeFusions })
          .then((r) => {
            if (cancelled) return;
            setDirect(r.direct);
            if (wantBridge) {
              setBridge(r.bridge);
              setBridgeLoaded(true);
            }
            setQuerying(false);
            setBridgeQuerying(false);
          });
      },
      wantBridge ? 300 : 120,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [expanded, mode, wantBridge, includeFusions, workerReady, api]);

  // Hide chains that rely on a Forbidden card (in the selected region) unless revealed.
  const bridgeVisible = useMemo(() => {
    if (showBanned) return bridge;
    return bridge.filter((r) => !(region === 'ocg' ? r.usesBannedOcg : r.usesBannedTcg));
  }, [bridge, showBanned, region]);
  const bannedHiddenCount = bridge.length - bridgeVisible.length;

  const activeResults = tab === 'bridge' ? bridgeVisible : direct;
  const facets = useMemo(() => deriveFacets(activeResults), [activeResults]);
  // Direct matches lead; bridged ones follow by chain length, then by ATK.
  const sorted = useMemo(
    () =>
      applyFilters(activeResults, filters).sort((a, b) => {
        const sa = a.steps ?? 1;
        const sb = b.steps ?? 1;
        if (sa !== sb) return sa - sb;
        return (b.monster.atk ?? 0) - (a.monster.atk ?? 0);
      }),
    [activeResults, filters],
  );

  const ready = db.ready && workerReady;
  const activeFilters = activeFilterCount(filters);
  const tabLoading = tab === 'bridge' ? bridgeQuerying : querying;

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
            <MatchModeToggle mode={mode} onChange={setMode} />
          </div>
          {db.error && <p className="error">Failed to load card data: {db.error}</p>}
          <p className="muted xsmall status">
            {ready
              ? `${db.pool.length.toLocaleString()} monsters · ${dbCount.toLocaleString()} Extra Deck targets`
              : 'Loading card data…'}
          </p>
        </section>

        <section className="results-area">
          <div className="results-area__head">
            <ResultsTabs
              tab={tab}
              onChange={setTab}
              directCount={direct.length}
              bridgeCount={bridgeVisible.length}
              bridgeLoading={bridgeQuerying && !bridgeLoaded}
              bridgeReady={bridgeLoaded}
            />
            <div className="results-area__head-right">
              <span className="muted small">
                {sorted.length} result{sorted.length === 1 ? '' : 's'}
                {querying ? ' …' : ''}
              </span>
              <button
                type="button"
                className="filters-toggle"
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
              >
                Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}
              </button>
            </div>
          </div>

          {tab === 'bridge' && (
            <div className="results-toolbar">
              <label className="toolbar-toggle" title="Fusions need a Fusion Spell, so they're off by default in chains.">
                <input
                  type="checkbox"
                  role="switch"
                  className="switch"
                  checked={includeFusions}
                  onChange={(e) => setIncludeFusions(e.target.checked)}
                  aria-label="Include Fusions"
                />
                <span>Include Fusions</span>
              </label>
              <label className="toolbar-toggle" title="Reveal chains that need a Forbidden card in the selected banlist.">
                <input
                  type="checkbox"
                  role="switch"
                  className="switch"
                  checked={showBanned}
                  onChange={(e) => setShowBanned(e.target.checked)}
                  aria-label="Show chains using banned cards"
                />
                <span>
                  Show banned-card chains
                  {!showBanned && bannedHiddenCount > 0 ? ` (${bannedHiddenCount} hidden)` : ''}
                </span>
              </label>
              <label className="toolbar-region">
                <span className="muted small">Banlist</span>
                <select
                  className="select select--sm"
                  value={region}
                  onChange={(e) => setRegion(e.target.value as BanRegion)}
                  aria-label="Banlist region"
                >
                  <option value="tcg">TCG</option>
                  <option value="ocg">OCG</option>
                </select>
              </label>
            </div>
          )}

          {sorted.length > 0 ? (
            <ResultsGrid results={sorted} onSelect={setSelectedCard} region={region} />
          ) : (
            <ResultsEmptyState hasInput={expanded.length > 0} loading={tabLoading} />
          )}
        </section>

        <ResultsFilterPanel
          facets={facets}
          filters={filters}
          onChange={setFilters}
          resultCount={sorted.length}
          totalCount={activeResults.length}
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
        />

        {selectedCard && (
          <CardDetailModal
            result={selectedCard}
            region={region}
            onClose={() => setSelectedCard(null)}
          />
        )}
      </main>
    </div>
  );
}
