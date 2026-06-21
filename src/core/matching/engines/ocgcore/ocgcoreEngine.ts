import type { ExtraDeckMonster } from '../../../domain/types';
import type { MatchExplanation, MaterialInstance, MatchMode } from '../../../domain/query';
import type { ISummonEngine } from '../../ISummonEngine';
import type { OcgResourceProvider, OcgRuntime } from './types';
import { enumerateSummonable } from './duelDriver';
import { cardCode } from './passcode';

/**
 * When `true`, the app/worker may select the ocgcore engine. OFF until the WASM
 * core + assets are wired and validated (see README.md). Keep this the single
 * switch so enabling the engine is a one-line change.
 */
export const OCGCORE_ENABLED = false;

/**
 * ocgcore-wasm adapter. Used as a **verifier over the parser's candidates**: the
 * worker runs the parser, then `prime(materials, candidateCodes)` asks the real
 * ruleset which of those candidates are actually summonable from the board;
 * `confirms(id)` answers per monster (the worker keeps the parser's recipe).
 *
 * Two-phase because ocgcore is async + a duel simulator while `ISummonEngine.match`
 * is sync/per-monster:
 *   1. `prime(...)` — async: (lazily) load the core, build the field, read the
 *      summonable set out of `MSG_SELECT_IDLECMD`.
 *   2. `match()` / `confirms()` — sync: answer from that set.
 *
 * Without an {@link OcgResourceProvider} it stays inert (`prime` throws); the engine
 * is OFF by default, so `runQuery` keeps using `ParserSummonEngine`.
 */
export class OcgcoreSummonEngine implements ISummonEngine {
  readonly id = 'ocgcore-wasm';
  private summonable: Set<string> | null = null;
  private runtime: OcgRuntime | null = null;

  constructor(private readonly provider?: OcgResourceProvider) {}

  /** Enumerate which `candidateCodes` are summonable from `materials`, into a set. */
  async prime(materials: MaterialInstance[], candidateCodes: number[] = []): Promise<void> {
    if (!this.provider) {
      throw new Error(
        'ocgcore-wasm engine is not wired yet — construct it with an OcgResourceProvider ' +
          '(see src/core/matching/engines/ocgcore/README.md).',
      );
    }
    this.runtime ??= await this.provider.createRuntime();
    const materialCodes = materials.map((m) => cardCode(m.card));
    await this.provider.prepare([...materialCodes, ...candidateCodes]);
    const codes = enumerateSummonable(this.runtime, this.provider, { materialCodes, candidateCodes });
    this.summonable = new Set([...codes].map(String));
  }

  /**
   * Dev/test seam: inject a known summonable set, standing in for `prime()` without
   * the async core. Lets the adapter be exercised through `runQuery`.
   */
  primeWith(ids: Iterable<string>): this {
    this.summonable = new Set(ids);
    return this;
  }

  /** Verifier API: did ocgcore confirm this monster id is summonable? */
  confirms(id: string): boolean {
    return this.summonable?.has(id) ?? false;
  }

  /** The primed set (monster ids), or null before the first `prime`/`primeWith`. */
  get summonableSet(): ReadonlySet<string> | null {
    return this.summonable;
  }

  match(
    monster: ExtraDeckMonster,
    _materials: MaterialInstance[],
    _mode: MatchMode,
  ): MatchExplanation | null {
    if (!this.summonable?.has(monster.id)) return null;
    // ocgcore decides legality holistically; per-constraint assignment isn't available,
    // so the explanation is intentionally empty. (In the worker's verifier path the
    // parser's own explanation/recipe is kept; this is only used via runQuery({engine}).)
    return { pathIndex: 0, assignment: [], parseStatus: 'exact' };
  }
}
