/** Public API of the DOM-free core (shared by the pipeline, the app, and tests). */

export * from './domain/enums';
export * from './domain/types';
export * from './domain/query';
export * from './domain/banlist';

export { parseMaterials } from './parser/parseMaterials';
export type { ParserMonsterMeta } from './parser/parseMaterials';
export { FUSION_SUBSTITUTE_IDS, detectUniqueness, detectTokensExcluded } from './parser/lexicon';

export { runQuery } from './matching';
export type { RunQueryOptions } from './matching';
export { runBridgeQuery } from './matching/bridge';
export { ParserSummonEngine } from './matching/ParserSummonEngine';
export type { ISummonEngine } from './matching/ISummonEngine';
export { cardSatisfiesConstraint } from './matching/constraintEval';
export { matchGroup } from './matching/groupMatch';
export { chainUsesBanned } from './matching/banWalk';
export { verifyItems } from './matching/verify';
export type { SummonVerifier } from './matching/verify';

// ocgcore-wasm engine (feature-flagged verifier; OFF by default). The seam types are
// exported so app/pipeline providers can implement them; no JSR package is imported here.
export { OcgcoreSummonEngine, OCGCORE_ENABLED } from './matching/engines/ocgcore/ocgcoreEngine';
export { enumerateSummonable } from './matching/engines/ocgcore/duelDriver';
export { cardCode, extraDeckCodesFrom } from './matching/engines/ocgcore/passcode';
export type {
  OcgCardStruct,
  OcgConstants,
  OcgCoreLike,
  OcgResourceProvider,
  OcgRuntime,
  PrimeRequest,
} from './matching/engines/ocgcore/types';
