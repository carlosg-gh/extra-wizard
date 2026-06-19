#!/usr/bin/env bash
# Ensure web/CI sessions can immediately run tests, typecheck, and the dev server.
set -e
cd "${CLAUDE_PROJECT_DIR:-.}"

if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run)..."
  pnpm install --frozen-lockfile >/dev/null 2>&1 || pnpm install >/dev/null 2>&1 || true
fi

echo "extra-wizard ready - pnpm dev | pnpm test | pnpm typecheck | pnpm data:refresh"
