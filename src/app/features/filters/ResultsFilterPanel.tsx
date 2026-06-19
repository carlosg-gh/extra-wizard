import type { ReactNode } from 'react';
import type { ResultFilters } from '@core';
import type { Facets } from './filterState';

function toggle<T>(arr: T[] | undefined, v: T): T[] | undefined {
  const s = new Set(arr ?? []);
  if (s.has(v)) s.delete(v);
  else s.add(v);
  return s.size ? [...s] : undefined;
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fgroup">
      <div className="fgroup__label">{label}</div>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className={`fchip ${active ? 'is-active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

type Range = { min?: number; max?: number };

function RangeInputs({
  value,
  onChange,
  step = 1,
}: {
  value?: Range;
  onChange: (r: Range | undefined) => void;
  step?: number;
}) {
  const v = value ?? {};
  const upd = (patch: Range) => {
    const next = { ...v, ...patch };
    onChange(next.min == null && next.max == null ? undefined : next);
  };
  const numOrUndef = (s: string) => (s === '' ? undefined : Number(s));
  return (
    <div className="range">
      <input
        type="number"
        step={step}
        placeholder="min"
        value={v.min ?? ''}
        onChange={(e) => upd({ min: numOrUndef(e.target.value) })}
      />
      <span>–</span>
      <input
        type="number"
        step={step}
        placeholder="max"
        value={v.max ?? ''}
        onChange={(e) => upd({ max: numOrUndef(e.target.value) })}
      />
    </div>
  );
}

export function ResultsFilterPanel({
  facets,
  filters,
  onChange,
  resultCount,
  totalCount,
}: {
  facets: Facets;
  filters: ResultFilters;
  onChange: (f: ResultFilters) => void;
  resultCount: number;
  totalCount: number;
}) {
  const set = (patch: Partial<ResultFilters>) => onChange({ ...filters, ...patch });
  const showApprox = !filters.parseStatus || filters.parseStatus.includes('approximate');

  return (
    <aside className="filters">
      <div className="filters__head">
        <h2>Filters</h2>
        <span className="muted small">
          {resultCount} / {totalCount}
        </span>
      </div>

      {facets.summonTypes.length > 1 && (
        <FilterGroup label="Summon type">
          <div className="fchips">
            {facets.summonTypes.map((t) => (
              <Chip
                key={t}
                active={filters.summonType?.includes(t)}
                onClick={() => set({ summonType: toggle(filters.summonType, t) })}
              >
                {t}
              </Chip>
            ))}
          </div>
        </FilterGroup>
      )}

      {facets.attributes.length > 1 && (
        <FilterGroup label="Attribute">
          <div className="fchips">
            {facets.attributes.map((a) => (
              <Chip
                key={a}
                active={filters.attribute?.includes(a)}
                onClick={() => set({ attribute: toggle(filters.attribute, a) })}
              >
                {a}
              </Chip>
            ))}
          </div>
        </FilterGroup>
      )}

      {facets.races.length > 1 && (
        <FilterGroup label="Type">
          <div className="fchips fchips--scroll">
            {facets.races.map((r) => (
              <Chip
                key={r}
                active={filters.race?.includes(r)}
                onClick={() => set({ race: toggle(filters.race, r) })}
              >
                {r}
              </Chip>
            ))}
          </div>
        </FilterGroup>
      )}

      {facets.archetypes.length > 0 && (
        <FilterGroup label="Archetype">
          <select
            className="select"
            value={filters.archetype?.[0] ?? ''}
            onChange={(e) => set({ archetype: e.target.value ? [e.target.value] : undefined })}
          >
            <option value="">Any archetype</option>
            {facets.archetypes.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </FilterGroup>
      )}

      <FilterGroup label="Level / Rank">
        <RangeInputs value={filters.levelRank} onChange={(r) => set({ levelRank: r })} />
      </FilterGroup>

      <FilterGroup label="Link rating">
        <RangeInputs value={filters.linkRating} onChange={(r) => set({ linkRating: r })} />
      </FilterGroup>

      <FilterGroup label="ATK">
        <RangeInputs value={filters.atk} step={100} onChange={(r) => set({ atk: r })} />
      </FilterGroup>

      {facets.hasApproximate && (
        <FilterGroup label="Parse quality">
          <label className="check">
            <input
              type="checkbox"
              checked={showApprox}
              onChange={(e) => set({ parseStatus: e.target.checked ? undefined : ['exact'] })}
            />
            Show approximate matches
          </label>
        </FilterGroup>
      )}

      <button type="button" className="btn-clear" onClick={() => onChange({})}>
        Reset filters
      </button>
    </aside>
  );
}
