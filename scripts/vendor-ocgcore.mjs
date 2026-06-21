#!/usr/bin/env node
/**
 * Vendors the ocgcore-wasm engine's upstream assets into ./vendor/ocgcore/
 * (git-ignored) at PINNED commits, so the Node provider + tests + the
 * `--with-ocgcore` asset build have a reproducible card DB + Lua scripts.
 *
 *   - ProjectIgnis/BabelCDB    → cards.cdb (card data, incl. real setcodes)
 *   - ProjectIgnis/CardScripts → per-card Lua + system scripts (utility/constant/proc_*)
 *
 * These are large (tens of MB) and carry their own licenses (see THIRD_PARTY_LICENSES.md),
 * so they are never committed. Run once per machine: `pnpm vendor:ocgcore`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(ROOT, 'vendor', 'ocgcore');

// Pinned to a known-good, mutually-compatible ProjectIgnis snapshot.
// Bump both together (BabelCDB setcodes must match the CardScripts dialect).
const REPOS = [
  { dir: 'BabelCDB', url: 'https://github.com/ProjectIgnis/BabelCDB.git', sha: '0513c77d30b0656652b1e05cf959b339c0b1dd16' },
  { dir: 'CardScripts', url: 'https://github.com/ProjectIgnis/CardScripts.git', sha: '6329dd086a6c8304f8e619b6da2ac9599924b690' },
];

const git = (args, cwd) => execFileSync('git', args, { cwd, stdio: 'inherit', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });

mkdirSync(VENDOR, { recursive: true });
for (const { dir, url, sha } of REPOS) {
  const path = join(VENDOR, dir);
  if (existsSync(join(path, '.git'))) {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: path }).toString().trim();
    if (head === sha) {
      console.log(`✓ ${dir} already at ${sha.slice(0, 10)}`);
      continue;
    }
  }
  console.log(`↓ fetching ${dir} @ ${sha.slice(0, 10)} …`);
  mkdirSync(path, { recursive: true });
  git(['init', '-q'], path);
  try {
    git(['remote', 'add', 'origin', url], path);
  } catch {
    git(['remote', 'set-url', 'origin', url], path);
  }
  git(['fetch', '-q', '--depth', '1', 'origin', sha], path);
  git(['checkout', '-q', 'FETCH_HEAD'], path);
  console.log(`✓ ${dir} ready`);
}
console.log('ocgcore assets vendored under vendor/ocgcore/ (git-ignored).');
