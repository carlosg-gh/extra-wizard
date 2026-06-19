import { useMemo, useRef, useState } from 'react';
import type { Card } from '@core';
import { cardMetaLine } from '../../lib/cardMeta';

export function CardSearchInput({
  search,
  onAdd,
}: {
  search: (q: string, limit?: number) => Card[];
  onAdd: (c: Card) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<number | undefined>(undefined);

  const results = useMemo(() => search(q, 30), [q, search]);

  const choose = (c: Card) => {
    onAdd(c);
    setQ('');
    setActive(0);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="search">
      <input
        className="search__input"
        type="text"
        value={q}
        placeholder="Search a monster to add as material…"
        aria-label="Search monsters"
        autoComplete="off"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={onKeyDown}
      />
      {open && results.length > 0 && (
        <ul className="search__menu" role="listbox">
          {results.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={`search__item ${i === active ? 'is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  // prevent input blur firing before click
                  e.preventDefault();
                  if (blurTimer.current) window.clearTimeout(blurTimer.current);
                }}
                onClick={() => choose(c)}
              >
                <span className="search__name">{c.name}</span>
                <span className="search__meta">{cardMetaLine(c)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
