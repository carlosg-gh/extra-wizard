/**
 * Node-only {@link OcgResourceProvider} for tests + the build-time asset extraction.
 * Reads card structs from BabelCDB `cards.cdb` (via `node:sqlite`, needs
 * `--experimental-sqlite`) and Lua from a CardScripts checkout. Lives in the pipeline
 * so `src/core` stays fs/sqlite/package-free.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { DatabaseSync as DatabaseSyncCtor } from 'node:sqlite';
import type {
  OcgCardStruct,
  OcgConstants,
  OcgCoreLike,
  OcgResourceProvider,
  OcgRuntime,
} from '../../core/matching/engines/ocgcore/types';

const TYPE_LINK = 0x4000000;

/**
 * Structural view of `@n1xx1/ocgcore-wasm`'s runtime module. We import it by resolved
 * file path (the package root drops the `createCore` default and TS can't follow its
 * `export * from "./dist/index.d.ts"`), so we type it here rather than statically.
 */
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

export interface NodeProviderOptions {
  /** One or more `cards.cdb` files, queried in order (first hit wins). */
  cdbPaths: string[];
  /** CardScripts checkout root (holds `utility.lua` + `official/c*.lua`). */
  scriptRoot: string;
}

/** Unpack the cdb's packed 64-bit `setcode` column into up to four 16-bit codes. */
function unpackSetcodes(packed: string): number[] {
  let v = BigInt(packed);
  const out: number[] = [];
  for (let i = 0; i < 4; i++) {
    const code = Number(v & 0xffffn);
    if (code) out.push(code);
    v >>= 16n;
  }
  return out;
}

export function createNodeProvider(opts: NodeProviderOptions): OcgResourceProvider {
  // Load node:sqlite (and later the wasm package) via createRequire so bundlers
  // (Vitest's Vite transform) never try to resolve these Node-only specifiers.
  const nodeRequire = createRequire(import.meta.url);
  const { DatabaseSync } = nodeRequire('node:sqlite') as { DatabaseSync: typeof DatabaseSyncCtor };
  const stmts = opts.cdbPaths.map((p) =>
    new DatabaseSync(p, { readOnly: true }).prepare(
      'SELECT id, alias, type, atk, def, level, attribute, ' +
        'CAST(setcode AS TEXT) AS setcode_s, CAST(race AS TEXT) AS race_s ' +
        'FROM datas WHERE id = ?',
    ),
  );

  function readCard(code: number): OcgCardStruct | null {
    for (const stmt of stmts) {
      const row = stmt.get(code) as Record<string, number | string> | undefined;
      if (!row) continue;
      const type = Number(row.type);
      const isLink = (type & TYPE_LINK) !== 0;
      const lvl = Number(row.level);
      return {
        code: Number(row.id),
        alias: Number(row.alias),
        setcodes: unpackSetcodes(row.setcode_s as string),
        type,
        level: lvl & 0xff,
        attribute: Number(row.attribute),
        race: BigInt(row.race_s as string),
        attack: Number(row.atk),
        // cdb stores the link-marker mask in the `def` column for Link monsters.
        defense: isLink ? 0 : Number(row.def),
        lscale: (lvl >> 24) & 0xff,
        rscale: (lvl >> 16) & 0xff,
        link_marker: isLink ? Number(row.def) : 0,
      };
    }
    return null;
  }

  function readScript(name: string): string | null {
    const file = /c\d+\.lua/.test(name)
      ? join(opts.scriptRoot, 'official', name)
      : join(opts.scriptRoot, name);
    try {
      return readFileSync(file, 'utf-8');
    } catch {
      return null; // vanilla monsters / absent scripts are tolerated by the core
    }
  }

  async function createRuntime(): Promise<OcgRuntime> {
    // `createCore` is a default export the package root drops (`export *`) and the
    // exports map blocks the deep specifier — so resolve the file and import it.
    const distUrl = pathToFileURL(
      nodeRequire.resolve('@n1xx1/ocgcore-wasm').replace(/mod\.js$/, 'dist/index.js'),
    ).href;
    const mod = (await import(distUrl)) as OcgModule;
    const core = (await mod.default({ sync: true })) as OcgCoreLike;
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

  // Node reads on demand (sync fs/db); nothing to prefetch.
  function prepare(): Promise<void> {
    return Promise.resolve();
  }

  return { createRuntime, prepare, readCard, readScript };
}
