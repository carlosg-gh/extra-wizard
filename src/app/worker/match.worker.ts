import * as Comlink from 'comlink';
import { runQuery, type Card, type ExtraDeckMonster, type MatchMode } from '@core';
import type { MatchResult, ResultMonster } from '../data/types';

const SHARDS = ['fusion', 'synchro', 'xyz', 'link'] as const;

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
  private readonly ready: Promise<void>;

  constructor() {
    this.ready = this.load();
  }

  private async load(): Promise<void> {
    const base = import.meta.env.BASE_URL || '/';
    const shards = await Promise.all(
      SHARDS.map((s) =>
        fetch(`${base}data/index.${s}.json`).then((r) => r.json() as Promise<ExtraDeckMonster[]>),
      ),
    );
    this.monsters = shards.flat();
    for (const m of this.monsters) this.byId.set(m.id, m);
  }

  async whenReady(): Promise<number> {
    await this.ready;
    return this.monsters.length;
  }

  async query(selected: Card[], mode: MatchMode, includeUnparsed: boolean): Promise<MatchResult[]> {
    await this.ready;
    const cardsById = new Map<string, Card>();
    for (const c of selected) cardsById.set(c.id, c);
    const cardIds = selected.map((c) => c.id);

    const result = runQuery({ cardIds, mode }, { monsters: this.monsters, cardsById }, { includeUnparsed });

    return result.items.map((it) => ({
      monster: stripPaths(this.byId.get(it.monsterId) as ExtraDeckMonster),
      explanation: it.explanation,
    }));
  }
}

Comlink.expose(new MatchEngineWorker());
