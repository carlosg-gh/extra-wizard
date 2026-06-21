export type ResultTab = 'direct' | 'bridge';

/**
 * Direct vs Bridge result tabs. Reuses the `.seg` segmented-control styling.
 * "Direct" = summonable straight from the input cards; "Bridge" = reachable only
 * through one or more intermediate summons.
 */
export function ResultsTabs({
  tab,
  onChange,
  directCount,
  bridgeCount,
  bridgeLoading,
  bridgeReady,
}: {
  tab: ResultTab;
  onChange: (t: ResultTab) => void;
  directCount: number;
  bridgeCount: number;
  bridgeLoading: boolean;
  /** Bridge has been computed at least once — only then is a count meaningful. */
  bridgeReady: boolean;
}) {
  const bridgeLabel = bridgeLoading ? 'Bridge …' : bridgeReady ? `Bridge (${bridgeCount})` : 'Bridge';
  const tabs: Array<{ value: ResultTab; label: string }> = [
    { value: 'direct', label: `Direct (${directCount})` },
    { value: 'bridge', label: bridgeLabel },
  ];
  return (
    <div className="seg" role="tablist" aria-label="Result kind">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={tab === t.value}
          className={`seg__btn ${tab === t.value ? 'is-active' : ''}`}
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
