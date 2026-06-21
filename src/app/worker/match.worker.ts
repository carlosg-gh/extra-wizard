import * as Comlink from 'comlink';
import {
  cardCode,
  chainUsesBanned,
  OcgcoreSummonEngine,
  OCGCORE_ENABLED,
  runBridgeQuery,
  runQuery,
  verifyItems,
  type Card,
  type ExtraDeckMonster,
  type MatchMode,
} from '@core';
import type { QueryAllResult, ResultMonster } from '../data/types';

const SHARDS = ['fusion', 'synchro', 'xyz', 'link'] as const;

/**
 * Build the ocgcore verifier if the flag is on and its assets are present; otherwise
 * null (→ the worker stays parser-only). The browser provider + wasm package are
 * imported lazily here so they're tree-shaken out of the default (flag-off) build.
 */
async function createVerifier(): Promise<OcgcoreSummonEngine | null> {
  if (!OCGCORE_ENABLED) return null;
  try {
    const base = import.meta.env.BASE_URL || '/';
    const ok = await fetch(`${base}data/ocgcore/cards.codes.json`, { method: 'HEAD' })
      .then((r) => r.ok)
      .catch(() => false);
    if (!ok) return null;
    const { createBrowserProvider } = await import('./ocgcoreBrowserProvider');
    return new OcgcoreSummonEngine(createBrowserProvider());
  } catch {
    return null; // any failure → fall back to the parser
  }
}

function stripPaths(m: ExtraDeckMonster): ResultMonster {
  const clone: Record<string, unknown> = { ...m };
  delete clone.paths;
  return clone as unknown as ResultMonster;
}

/**
 * Owns the Extra Deck target index and runs `runQuery` off the main thread.
 * The (small) set of selected input cards is passed in per query, so the worker
 * never needs the full input pool.
 */
class MatchEngineWorker {
  private monsters: ExtraDeckMonster[] = [];
  private byId = new Map<string, ExtraDeckMonster>();
  private verifier: OcgcoreSummonEngine | null = null;
  private readonly ready: Promise<void>;

  constructor() {
    this.ready = this.load();
  }

  private async load(): Promise<void> {
    const base = import.meta.env.BASE_URL || '/';
    const [shards] = await Promise.all([
      Promise.all(
        SHARDS.map((s) =>
          fetch(`${base}data/index.${s}.json`).then((r) => r.json() as Promise<ExtraDeckMonster[]>),
        ),
      ),
      createVerifier().then((v) => {
        this.verifier = v;
      }),
    ]);
    this.monsters = shards.flat();
    for (const m of this.monsters) this.byId.set(m.id, m);
  }

  async whenReady(): Promise<number> {
    await this.ready;
    return this.monsters.length;
  }

  /**
   * Run both matchers and return split result sets. `direct` honors the chosen
   * mode; `bridge` (computed only when `wantBridge`, the heavy path) is always
   * subset-based, restricted to genuinely multi-step chains (`steps >= 2`) that
   * are NOT already directly summonable — so the Bridge tab is strictly additive.
   * Each bridge result is pre-flagged for both banlist regions so the UI can
   * hide/reveal banned chains and flip TCG/OCG without a re-query.
   */
  async queryAll(
    selected: Card[],
    mode: MatchMode,
    opts: { wantBridge: boolean; includeUnparsed?: boolean; excludeFusions?: boolean },
  ): Promise<QueryAllResult> {
    await this.ready;
    const cardsById = new Map<string, Card>();
    for (const c of selected) cardsById.set(c.id, c);
    const cardIds = selected.map((c) => c.id);
    const ctx = { monsters: this.monsters, cardsById };

    let directItems = runQuery({ cardIds, mode }, ctx, {
      includeUnparsed: opts.includeUnparsed ?? false,
    }).items;
    let engine: QueryAllResult['engine'] = 'parser-v1';

    // Verifier pass: ocgcore prunes the parser's candidates to what the real ruleset
    // allows (keeping any it couldn't evaluate). Any failure falls back to the parser.
    if (this.verifier) {
      try {
        const candidateCodes = directItems.map((it) => cardCode(this.byId.get(it.monsterId)!));
        const materials = selected.map((c, i) => ({ instanceId: `${c.id}#${i}`, card: c }));
        await this.verifier.prime(materials, candidateCodes);
        directItems = verifyItems(directItems, this.verifier);
        engine = 'ocgcore-wasm';
      } catch {
        engine = 'parser-v1';
      }
    }

    const direct = directItems.map((it) => ({
      monster: stripPaths(this.byId.get(it.monsterId) as ExtraDeckMonster),
    }));

    if (!opts.wantBridge) return { direct, bridge: [], engine };

    const directIds = new Set(direct.map((r) => r.monster.id));
    const resolve = (id: string) => this.byId.get(id);
    const bridge = runBridgeQuery({ cardIds, mode: 'any-subset' }, ctx, {
      excludeExtraCardPaths: opts.excludeFusions ?? true,
    })
      .items.filter((it) => it.steps >= 2 && !directIds.has(it.monsterId))
      .map((it) => ({
        monster: stripPaths(this.byId.get(it.monsterId) as ExtraDeckMonster),
        steps: it.steps,
        chain: it.chain,
        usesBannedTcg: chainUsesBanned(it.chain, resolve, 'tcg'),
        usesBannedOcg: chainUsesBanned(it.chain, resolve, 'ocg'),
      }));

    return { direct, bridge, engine };
  }
}

Comlink.expose(new MatchEngineWorker());
