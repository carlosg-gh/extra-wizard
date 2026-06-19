import { useEffect, useRef, useState } from 'react';
import type { BuildStep } from '@core';
import type { MatchResult } from '../../data/types';
import { cardMetaLine } from '../../lib/cardMeta';
import { cardImageUrl } from '../../lib/images';
import { useCardDetail } from '../../lib/useCardDetail';

const ABILITY_TAGS = new Set(['Tuner', 'Flip', 'Gemini', 'Spirit', 'Union', 'Toon', 'Pendulum']);

/** Renders a build-chain node: a base-card leaf, or a summon with its materials. */
function ChainNode({ step }: { step: BuildStep }) {
  const isSummon = step.monsterId != null;
  return (
    <li className={`chain-node ${isSummon ? 'chain-node--summon' : 'chain-node--leaf'}`}>
      <span className="chain-node__head">
        {isSummon && step.summonType && (
          <span className={`tag tag--${step.summonType.toLowerCase()}`}>{step.summonType}</span>
        )}
        <span className="chain-node__name">{step.name}</span>
      </span>
      {isSummon && step.materialsRaw && <span className="chain-node__mats">{step.materialsRaw}</span>}
      {step.children.length > 0 && (
        <ul className="chain-node__children">
          {step.children.map((c, i) => (
            <ChainNode key={`${c.monsterId ?? c.name}-${i}`} step={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CardDetailModal({ result, onClose }: { result: MatchResult; onClose: () => void }) {
  const m = result.monster;
  const { detail, loading, error } = useCardDetail(m.imageId);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const abilities = m.typeLineTags.filter((t) => ABILITY_TAGS.has(t));
  const stats = [m.atk != null ? `ATK ${m.atk}` : null, m.def != null ? `DEF ${m.def}` : null]
    .filter(Boolean)
    .join(' / ');
  const cardmarket = `https://www.cardmarket.com/en/YuGiOh/Products/Search?searchString=${encodeURIComponent(m.name)}`;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={m.name} onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} type="button" className="modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="modal__grid">
          <div className="modal__art">
            {imgOk && m.imageId ? (
              <img src={cardImageUrl(m.imageId, 'full')} alt={m.name} onError={() => setImgOk(false)} />
            ) : (
              <div className="rc__art-fallback">{m.name}</div>
            )}
          </div>

          <div className="modal__info">
            <h2 className="modal__name">{m.name}</h2>
            <div className="modal__tags">
              <span className={`tag tag--${m.summonType.toLowerCase()}`}>{m.summonType}</span>
              {abilities.map((a) => (
                <span key={a} className="tag tag--ability">
                  {a}
                </span>
              ))}
              {m.ocgOnly && <span className="tag tag--ocg">OCG only</span>}
              {result.steps != null && result.steps > 1 && (
                <span className="badge badge--bridge">{result.steps}-step chain</span>
              )}
              {m.parseStatus !== 'exact' && <span className="badge badge--approx">approx</span>}
            </div>

            <div className="modal__meta">
              {cardMetaLine(m)}
              {stats ? ` · ${stats}` : ''}
            </div>

            <p className="modal__mats">
              <strong>Materials:</strong> {m.materialsRaw || '—'}
            </p>

            {result.chain && result.steps != null && result.steps > 1 && (
              <div className="modal__chain">
                <h3>Build chain ({result.steps} summons)</h3>
                <ul className="chain-root">
                  {result.chain.children.map((c, i) => (
                    <ChainNode key={`${c.monsterId ?? c.name}-${i}`} step={c} />
                  ))}
                </ul>
                <p className="muted xsmall">
                  Summon order is bottom-up: build the nested materials first, then combine.
                </p>
              </div>
            )}

            {loading && <p className="muted small">Loading details…</p>}
            {error && !detail && <p className="muted small">Live details unavailable.</p>}

            {detail && (
              <>
                {detail.description && <p className="modal__text">{detail.description}</p>}
                {(detail.prices.cardmarket != null || detail.prices.tcgplayer != null) && (
                  <p className="modal__price">
                    {detail.prices.cardmarket != null && <span>Cardmarket €{detail.prices.cardmarket.toFixed(2)}</span>}
                    {detail.prices.tcgplayer != null && (
                      <span>
                        {detail.prices.cardmarket != null ? ' · ' : ''}TCGplayer ${detail.prices.tcgplayer.toFixed(2)}
                      </span>
                    )}
                  </p>
                )}
                {detail.sets.length > 0 && (
                  <div className="modal__sets">
                    <h3>Printings ({detail.sets.length})</h3>
                    <ul>
                      {detail.sets.map((s, i) => (
                        <li key={`${s.code}-${i}`}>
                          <span className="modal__set-code">{s.code}</span>
                          <span className="modal__set-name">{s.name}</span>
                          <span className="modal__set-rarity">{s.rarity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            <a className="modal__cm-link" href={cardmarket} target="_blank" rel="noopener noreferrer">
              View on Cardmarket ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
