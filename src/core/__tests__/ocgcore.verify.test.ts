import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { OcgcoreSummonEngine } from '../matching/engines/ocgcore/ocgcoreEngine';
import type { MaterialInstance } from '../domain/query';
import { mkCard } from './helpers';

// Integration test for the real ocgcore engine. Needs the vendored upstream assets
// (`pnpm vendor:ocgcore`) AND node:sqlite (`--experimental-sqlite`). Skips otherwise,
// so plain `pnpm test` / CI without the assets stays green.
const VENDOR = join(process.cwd(), 'vendor', 'ocgcore');
const CDB = join(VENDOR, 'BabelCDB', 'cards.cdb');
const SCRIPTS = join(VENDOR, 'CardScripts');

function sqliteAvailable(): boolean {
  try {
    createRequire(import.meta.url)('node:sqlite');
    return true;
  } catch {
    return false;
  }
}
// Assets first, so CI without the vendored checkout never probes (and warns on) node:sqlite.
const RUN = existsSync(CDB) && existsSync(join(SCRIPTS, 'utility.lua')) && sqliteAvailable();

const mat = (id: string, name: string): MaterialInstance => ({ instanceId: id, card: mkCard({ id, name }) });
// Dynamic import keeps node:sqlite out of the module graph when the suite is skipped.
const newEngine = async () => {
  const { createNodeProvider } = await import('../../pipeline/ocgcore/nodeProvider');
  return new OcgcoreSummonEngine(createNodeProvider({ cdbPaths: [CDB], scriptRoot: SCRIPTS }));
};

(RUN ? describe : describe.skip)(
  'ocgcore verifier — integration (needs `pnpm vendor:ocgcore` + --experimental-sqlite)',
  () => {
    it('confirms candidates whose materials are present and denies the rest', async () => {
      const engine = await newEngine();
      // Board: two Level-4 monsters.
      const materials = [mat('69140098', 'Gemini Elf'), mat('91731841', 'Gem-Knight Garnet')];
      await engine.prime(materials, [84013237, 21044178, 29669359, 44508094]);
      expect(engine.confirms('84013237')).toBe(true); // Number 39: Utopia — "2 Level 4 monsters"
      expect(engine.confirms('21044178')).toBe(true); // Abyss Dweller — Rank 4
      expect(engine.confirms('29669359')).toBe(false); // Number 61: Volcasaurus — Rank 5
      expect(engine.confirms('44508094')).toBe(false); // Stardust Dragon — needs a Tuner
    });

    it('denies everything from a board with no valid materials', async () => {
      const engine = await newEngine();
      // A single Level-7 can't make a Rank-4 Xyz (needs two Level-4s).
      await engine.prime([mat('46986414', 'Dark Magician')], [84013237, 21044178]);
      expect(engine.confirms('84013237')).toBe(false);
      expect(engine.confirms('21044178')).toBe(false);
    });

    it('marks a candidate with no card data as un-evaluable (so its parser verdict is kept)', async () => {
      const engine = await newEngine();
      const materials = [mat('69140098', 'Gemini Elf'), mat('91731841', 'Gem-Knight Garnet')];
      await engine.prime(materials, [84013237, 99999999]); // 99999999 isn't in cards.cdb
      expect(engine.confirms('84013237')).toBe(true);
      expect(engine.wasEvaluable('84013237')).toBe(true);
      expect(engine.wasEvaluable('99999999')).toBe(false); // missing data ⇒ keep parser verdict
    });

    it('primes within a reasonable latency budget (warm core)', async () => {
      const engine = await newEngine();
      const materials = [mat('69140098', 'Gemini Elf'), mat('91731841', 'Gem-Knight Garnet')];
      const candidates = [84013237, 21044178, 29669359, 44508094];
      await engine.prime(materials, candidates); // warm-up (pays one-time core init)
      const t0 = performance.now();
      await engine.prime(materials, candidates);
      const ms = performance.now() - t0;
      console.log(`[ocgcore] warm prime: ${ms.toFixed(0)}ms for ${candidates.length} candidates`);
      expect(ms).toBeLessThan(5000); // generous ceiling — catches hangs, not perf jitter
    });

    it('build-time extraction round-trips card structs through JSON', async () => {
      const { buildOcgcoreAssets } = await import('../../pipeline/ocgcore/buildOcgcoreAssets');
      const { createNodeProvider } = await import('../../pipeline/ocgcore/nodeProvider');
      const out = mkdtempSync(join(tmpdir(), 'ocgcore-assets-'));
      const codes = [84013237, 44508094, 4731783]; // Xyz, Synchro, Link (exercises link_marker)
      const res = await buildOcgcoreAssets({ codes, cdbPaths: [CDB], outDir: out });
      expect(res.count).toBeGreaterThanOrEqual(2);

      const json = JSON.parse(
        readFileSync(join(out, 'ocgcore', 'cards.codes.json'), 'utf-8'),
      ) as Record<string, { race: string; setcodes: number[]; type: number; link_marker: number }>;
      const provider = createNodeProvider({ cdbPaths: [CDB], scriptRoot: SCRIPTS });
      for (const code of codes) {
        const fromJson = json[code];
        if (!fromJson) continue;
        const fromDb = provider.readCard(code)!;
        expect(BigInt(fromJson.race)).toBe(fromDb.race); // 64-bit race survives JSON
        expect(fromJson.setcodes).toEqual(fromDb.setcodes);
        expect(fromJson.type).toBe(fromDb.type);
        expect(fromJson.link_marker).toBe(fromDb.link_marker);
      }
    });
  },
);
