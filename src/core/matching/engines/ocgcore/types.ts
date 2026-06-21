/**
 * Structural seam for the ocgcore-wasm engine — DEFINED IN CORE, which must stay
 * DOM-free, fs-free, and free of any import of `@n1xx1/ocgcore-wasm`. The concrete
 * {@link OcgResourceProvider}s (browser-fetch in `src/app`, Node-fs in `src/pipeline`)
 * own the real package and inject it here. The duel driver ({@link ./duelDriver}) and
 * engine ({@link ./ocgcoreEngine}) are generic over these hand-written shapes.
 */

/**
 * Card data the core requests via `cardReader`. Mirrors the package's `OcgCardData`.
 * `race` is a 64-bit bitmask (JS `bigint`); `setcodes` are numeric archetype codes —
 * both come from BabelCDB `cards.cdb`, not our index. `level` carries Level OR Rank OR
 * Link rating; `link_marker` is the arrow bitmask.
 */
export interface OcgCardStruct {
  code: number;
  alias: number;
  setcodes: number[];
  type: number;
  level: number;
  attribute: number;
  race: bigint;
  attack: number;
  defense: number;
  lscale: number;
  rscale: number;
  link_marker: number;
}

/** Stable ocgcore ABI constants the driver needs, sourced from the package by a provider. */
export interface OcgConstants {
  /** Master Rule 5 duel-mode mask (a composite `bigint`). */
  modeMR5: bigint;
  locMzone: number;
  locExtra: number;
  posFaceupAttack: number;
  posFacedownDefense: number;
  /** `MSG_SELECT_IDLECMD` message type. */
  msgSelectIdlecmd: number;
  /** `OcgResponseType.SELECT_IDLECMD` response discriminant. */
  respSelectIdlecmd: number;
  /** `SelectIdleCMDAction.TO_EP` (end turn without committing a summon). */
  actionToEp: number;
  procEnd: number;
  procWaiting: number;
  procContinue: number;
}

/** Card placement record passed to `duelNewCard`. */
export interface OcgNewCardInfoLike {
  team: 0 | 1;
  duelist: number;
  code: number;
  controller: 0 | 1;
  location: number;
  sequence: number;
  position: number;
}

/** Duel-creation options passed to `createDuel` (sync-core shape: sync readers). */
export interface OcgDuelOptionsLike {
  flags: bigint;
  seed: [bigint, bigint, bigint, bigint];
  team1: { startingLP: number; startingDrawCount: number; drawCountPerTurn: number };
  team2: { startingLP: number; startingDrawCount: number; drawCountPerTurn: number };
  cardReader: (code: number) => OcgCardStruct | null;
  scriptReader: (name: string) => string | null;
  errorHandler?: (type: number, text: string) => void;
}

/** Only the fields the driver reads off a duel message. */
export interface OcgMessageLike {
  type: number;
  player?: number;
  special_summons?: { code: number }[];
}

export type OcgDuelHandle = unknown;

/** The subset of the sync core the driver calls. Providers supply the real instance. */
export interface OcgCoreLike {
  createDuel(opts: OcgDuelOptionsLike): OcgDuelHandle | null;
  loadScript(handle: OcgDuelHandle, name: string, content: string): boolean;
  duelNewCard(handle: OcgDuelHandle, info: OcgNewCardInfoLike): void;
  startDuel(handle: OcgDuelHandle): void;
  duelProcess(handle: OcgDuelHandle): number;
  duelGetMessage(handle: OcgDuelHandle): OcgMessageLike[];
  duelSetResponse(handle: OcgDuelHandle, response: unknown): void;
  destroyDuel(handle: OcgDuelHandle): void;
}

/** A loaded core plus its constants. Built once per session (core init is expensive). */
export interface OcgRuntime {
  core: OcgCoreLike;
  constants: OcgConstants;
}

/**
 * Supplies everything the engine needs, hiding the env-specific bits (wasm loading,
 * card/script IO). Readers are SYNC because the sync core calls them synchronously;
 * a browser provider must therefore `prepare()` (async fetch into memory) first.
 */
export interface OcgResourceProvider {
  /** Lazy-load the wasm core and build its constants. Cache + reuse across primes. */
  createRuntime(): Promise<OcgRuntime>;
  /** Make card data + scripts for these codes available to the sync readers. */
  prepare(codes: number[]): Promise<void>;
  readCard(code: number): OcgCardStruct | null;
  readScript(name: string): string | null;
}

/** Materials on the field + the candidate Extra Deck monsters to test, as passcodes. */
export interface PrimeRequest {
  materialCodes: number[];
  candidateCodes: number[];
}

/**
 * JSON-serializable {@link OcgCardStruct}: `race` (a 64-bit bigint) is a decimal
 * string. This is the on-disk contract of `public/data/ocgcore/cards.codes.json`
 * — written by the pipeline, read (and re-hydrated to a bigint) by the browser provider.
 */
export type SerializedCardStruct = Omit<OcgCardStruct, 'race'> & { race: string };
