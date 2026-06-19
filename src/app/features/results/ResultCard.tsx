import { useState } from 'react';
import type { MatchResult } from '../../data/types';
import { levelRankLabel } from '../../lib/cardMeta';
import { cardImageUrl } from '../../lib/images';

export function ResultCard({ result }: { result: MatchResult }) {
  const { monster: m, explanation } = result;
  const [imgOk, setImgOk] = useState(true);
  const [showWhy, setShowWhy] = useState(false);

  const statLine = [
    levelRankLabel(m),
    m.attribute ?? undefined,
    m.race,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="rc">
      <div className="rc__art">
        {imgOk ? (
          <img
            loading="lazy"
            src={cardImageUrl(m.imageId)}
            alt=""
            onError={() => setImgOk(false)}
          />
        ) : (
          <div className="rc__art-fallback">{m.name}</div>
        )}
        <span className={`tag tag--${m.summonType.toLowerCase()}`}>{m.summonType}</span>
        {m.parseStatus !== 'exact' && (
          <span
            className="badge badge--approx"
            title="Material text only partially parsed — this match is approximate."
          >
            approx
          </span>
        )}
      </div>

      <div className="rc__body">
        <h3 className="rc__name" title={m.name}>
          {m.name}
        </h3>
        <div className="rc__meta">{statLine}</div>
        {(m.atk != null || m.def != null) && (
          <div className="rc__stats">
            {m.atk != null ? `ATK ${m.atk}` : ''}
            {m.def != null ? `${m.atk != null ? ' / ' : ''}DEF ${m.def}` : ''}
          </div>
        )}
        <p className="rc__mats">{m.materialsRaw}</p>
        <button type="button" className="link-btn" onClick={() => setShowWhy((v) => !v)}>
          {showWhy ? 'Hide details' : 'Why it matches'}
        </button>
        {showWhy && (
          <ul className="rc__why">
            {explanation.assignment
              .filter((a) => a.instanceIds.length > 0)
              .map((a, i) => (
                <li key={i}>
                  <span className="rc__why-req">{a.constraintRaw}</span>
                  <span className="rc__why-n">{a.instanceIds.length}×</span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </article>
  );
}
