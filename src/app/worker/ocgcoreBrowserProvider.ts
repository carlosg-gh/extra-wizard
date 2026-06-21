import type {
  OcgCardStruct,
  OcgConstants,
  OcgCoreLike,
  OcgResourceProvider,
  OcgRuntime,
  SerializedCardStruct,
} from '@core';

/**
 * Browser {@link OcgResourceProvider} (runs inside the match worker). The sync core
 * calls `readCard`/`readScript` synchronously, so {@link prepare} fetches everything
 * needed into memory first: card structs from the self-hosted `cards.codes.json`,
 * system + per-card Lua from a pinned CardScripts CDN. The WASM is self-hosted and
 * passed as `wasmBinary` (the package's `lib/*.wasm` subpath is export-blocked).
 */

// Pinned to match the vendored BabelCDB (see THIRD_PARTY_LICENSES.md / vendor script).
const SCRIPTS_SHA = '6329dd086a6c8304f8e619b6da2ac9599924b690';
const SCRIPT_CDN = `https://cdn.jsdelivr.net/gh/ProjectIgnis/CardScripts@${SCRIPTS_SHA}`;

// Root scripts the engine needs before any card runs: constant/utility plus everything
// utility.lua pulls in. Preloaded so the sync scriptReader can serve them; absent ones
// (e.g. proc_unofficial) 404 → null, which the core tolerates.
const SYSTEM_SCRIPTS = [
  'constant.lua', 'utility.lua', 'archetype_setcode_constants.lua', 'card_counter_constants.lua',
  'cards_specific_functions.lua', 'chain.lua', 'debug_utility.lua', 'deprecated_functions.lua',
  'proc_equip.lua', 'proc_fusion.lua', 'proc_fusion_spell.lua', 'proc_gemini.lua', 'proc_link.lua',
  'proc_maximum.lua', 'proc_normal.lua', 'proc_pendulum.lua', 'proc_persistent.lua', 'proc_ritual.lua',
  'proc_rush.lua', 'proc_skill.lua', 'proc_spirit.lua', 'proc_synchro.lua', 'proc_unofficial.lua',
  'proc_union.lua', 'proc_workaround.lua', 'proc_xyz.lua',
];

/** Structural view of the wasm module (resolved to dist/index.js via the Vite alias). */
interface OcgModule {
  default: (o: { sync: true; wasmBinary?: ArrayBuffer }) => Promise<unknown>;
  OcgDuelMode: { MODE_MR5: bigint };
  OcgLocation: { MZONE: number; EXTRA: number };
  OcgPosition: { FACEUP_ATTACK: number; FACEDOWN_DEFENSE: number };
  OcgMessageType: { SELECT_IDLECMD: number };
  OcgResponseType: { SELECT_IDLECMD: number };
  SelectIdleCMDAction: { TO_EP: number };
  OcgProcessResult: { END: number; WAITING: number; CONTINUE: number };
}

export interface BrowserProviderOptions {
  /** Base URL for Lua scripts (root system scripts + `official/c<code>.lua`).
   *  Defaults to the pinned CardScripts CDN; override to self-host. */
  scriptBase?: string;
}

export function createBrowserProvider(opts: BrowserProviderOptions = {}): OcgResourceProvider {
  const base = import.meta.env.BASE_URL || '/';
  const scriptBase = opts.scriptBase ?? SCRIPT_CDN;
  let cards: Map<number, OcgCardStruct> | null = null;
  const scripts = new Map<string, string | null>();

  async function loadCards(): Promise<Map<number, OcgCardStruct>> {
    if (cards) return cards;
    const raw = (await (await fetch(`${base}data/ocgcore/cards.codes.json`)).json()) as Record<
      string,
      SerializedCardStruct
    >;
    const m = new Map<number, OcgCardStruct>();
    for (const [code, s] of Object.entries(raw)) m.set(Number(code), { ...s, race: BigInt(s.race) });
    cards = m;
    return m;
  }

  async function fetchScript(name: string): Promise<void> {
    if (scripts.has(name)) return;
    const path = /c\d+\.lua/.test(name) ? `official/${name}` : name;
    try {
      const r = await fetch(`${scriptBase}/${path}`);
      scripts.set(name, r.ok ? await r.text() : null);
    } catch {
      scripts.set(name, null);
    }
  }

  async function createRuntime(): Promise<OcgRuntime> {
    const wasmBinary = await (await fetch(`${base}data/ocgcore/ocgcore.sync.wasm`)).arrayBuffer();
    const mod = (await import('@n1xx1/ocgcore-wasm')) as unknown as OcgModule;
    const core = (await mod.default({ sync: true, wasmBinary })) as OcgCoreLike;
    const constants: OcgConstants = {
      modeMR5: mod.OcgDuelMode.MODE_MR5,
      locMzone: mod.OcgLocation.MZONE,
      locExtra: mod.OcgLocation.EXTRA,
      posFaceupAttack: mod.OcgPosition.FACEUP_ATTACK,
      posFacedownDefense: mod.OcgPosition.FACEDOWN_DEFENSE,
      msgSelectIdlecmd: mod.OcgMessageType.SELECT_IDLECMD,
      respSelectIdlecmd: mod.OcgResponseType.SELECT_IDLECMD,
      actionToEp: mod.SelectIdleCMDAction.TO_EP,
      procEnd: mod.OcgProcessResult.END,
      procWaiting: mod.OcgProcessResult.WAITING,
      procContinue: mod.OcgProcessResult.CONTINUE,
    };
    return { core, constants };
  }

  async function prepare(codes: number[]): Promise<void> {
    await loadCards();
    const names = [...SYSTEM_SCRIPTS, ...codes.map((c) => `c${c}.lua`)];
    await Promise.all(names.map(fetchScript));
  }

  return {
    createRuntime,
    prepare,
    readCard: (code) => cards?.get(code) ?? null,
    readScript: (name) => scripts.get(name) ?? null,
  };
}
