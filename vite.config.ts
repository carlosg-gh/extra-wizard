import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages *project* sites serve the app from /<repo>/. Override with
// VITE_BASE (e.g. "/" for a user/org page or a custom domain).
const base = process.env.VITE_BASE ?? '/extra-wizard/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? base : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'esnext',
  },
}));
