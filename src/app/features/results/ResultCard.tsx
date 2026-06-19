import { useState } from 'react';
import type { MatchResult } from '../../data/types';
import { levelRankLabel } from '../../lib/cardMeta';
import { cardImageUrl } from '../../lib/images';

export function ResultCard({
  result,
  onSelect,
}: {
  result: MatchResult;
  onSelect: (r: MatchResult) => void;
}) {
  const { monster: m } = result;
  const [imgOk, setImgOk] = useState(true);
  const bridged = result.steps != null && result.steps > 1;

  const statLine = [levelRankLabel(m), m.attribute ?? undefined, m.race].filter(Boolean).join(' · ');

  return (
    <article
      className="rc"
      role="button"
      tabIndex={0}
      aria-label={`${m.name} details`}
      onClick={() => onSelect(result)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(result);
        }
      }}
    >
      <div className="rc__art">
        {imgOk ? (
          <img loading="lazy" src={cardImageUrl(m.imageId)} alt={m.name} onError={() => setImgOk(false)} />
        ) : (
          <div className="rc__art-fallback">{m.name}</div>
        )}
        {m.ocgOnly && <span className="ribbon ribbon--ocg">OCG</span>}
      </div>

      <div className="rc__body">
        <h3 className="rc__name" title={m.name}>
          {m.name}
        </h3>
        <div className="rc__tags">
          <span className={`tag tag--${m.summonType.toLowerCase()}`}>{m.summonType}</span>
          {bridged && (
            <span
              className="badge badge--bridge"
              title={`Reached through a chain of ${result.steps} summons — open for the full build.`}
            >
              {result.steps}-step
            </span>
          )}
          {m.parseStatus !== 'exact' && (
            <span
              className="badge badge--approx"
              title="Material text only partially parsed — this match is approximate."
            >
              approx
            </span>
          )}
        </div>
        <div className="rc__meta">{statLine}</div>
        {(m.atk != null || m.def != null) && (
          <div className="rc__stats">
            {m.atk != null ? `ATK ${m.atk}` : ''}
            {m.def != null ? `${m.atk != null ? ' / ' : ''}DEF ${m.def}` : ''}
          </div>
        )}
        <p className="rc__mats">{m.materialsRaw}</p>
      </div>
    </article>
  );
}
