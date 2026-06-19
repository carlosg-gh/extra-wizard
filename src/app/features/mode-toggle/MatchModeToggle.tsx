import type { MatchMode } from '@core';

const OPTIONS: Array<{ value: MatchMode; label: string; hint: string }> = [
  { value: 'any-subset', label: 'Any subset', hint: 'Summonable using some of the cards' },
  { value: 'use-all', label: 'Use all', hint: 'Must consume every provided card' },
];

export function MatchModeToggle({
  mode,
  onChange,
  disabled = false,
}: {
  mode: MatchMode;
  onChange: (m: MatchMode) => void;
  /** When true (bridge mode), the toggle is inert — bridge is always subset-based. */
  disabled?: boolean;
}) {
  return (
    <div
      className={`seg ${disabled ? 'is-disabled' : ''}`}
      role="tablist"
      aria-label="Match mode"
      title={disabled ? 'Bridge mode always searches subsets' : undefined}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={mode === o.value}
          disabled={disabled}
          title={o.hint}
          className={`seg__btn ${mode === o.value ? 'is-active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
