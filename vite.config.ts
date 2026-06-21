import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages *project* sites serve the app from /<repo>/. Override with
// VITE_BASE (e.g. "/" for a user/org page or a custom domain).
const base = process.env.VITE_BASE ?? '/extra-wizard/';

// `vite build` and `vite preview` must use the deployed base so built asset
// URLs resolve; only the dev server (`vite`) serves from the root.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? base : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      // The package root (`mod.js`, `export *`) drops `createCore`'s default export
      // and the `exports` map blocks the deep specifier — so point the browser build
      // straight at dist/index.js, which exposes both the default and the named enums.
      '@n1xx1/ocgcore-wasm': fileURLToPath(
        new URL('./node_modules/@n1xx1/ocgcore-wasm/dist/index.js', import.meta.url),
      ),
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'esnext',
  },
}));
