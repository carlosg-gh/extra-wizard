import type { SelectedEntry } from '../../data/types';
import { cardMetaLine } from '../../lib/cardMeta';

export function SelectedCardList({
  entries,
  onInc,
  onDec,
  onRemove,
  onClear,
}: {
  entries: SelectedEntry[];
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (entries.length === 0) {
    return (
      <p className="muted small selected__empty">
        No materials yet — search above to add the monsters you control.
      </p>
    );
  }
  const total = entries.reduce((s, e) => s + e.count, 0);

  return (
    <div className="selected">
      <div className="selected__head">
        <span className="muted small">
          {total} card{total === 1 ? '' : 's'} ({entries.length} unique)
        </span>
        <button type="button" className="link-btn" onClick={onClear}>
          Clear all
        </button>
      </div>
      <ul className="chips">
        {entries.map(({ card, count }) => (
          <li key={card.id} className="chip">
            <div className="chip__body">
              <span className="chip__name">{card.name}</span>
              <span className="chip__meta">{cardMetaLine(card)}</span>
            </div>
            <div className="stepper" role="group" aria-label={`Quantity of ${card.name}`}>
              <button type="button" onClick={() => onDec(card.id)} aria-label="Remove one">
                −
              </button>
              <span className="stepper__n">{count}</span>
              <button type="button" onClick={() => onInc(card.id)} aria-label="Add one">
                +
              </button>
            </div>
            <button
              type="button"
              className="chip__x"
              onClick={() => onRemove(card.id)}
              aria-label={`Remove ${card.name}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
