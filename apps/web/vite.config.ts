/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Default 3110; a harness-assigned PORT (preview tooling) wins, and without
  // strictPort a second session auto-increments instead of failing to start.
  server: { port: Number(process.env.PORT) || 3110 },
  preview: { port: 3110 },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    globals: true,
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      // Focus coverage on the logic that unit/regression tests target — the
      // pure utils, store, hooks, nav, and data. Presentational pages are
      // exercised by the route smoke + a11y suites, not line-covered here.
      include: ['src/utils/**', 'src/store/**', 'src/hooks/**', 'src/nav/**', 'src/data/**'],
      thresholds: { statements: 70, branches: 70, functions: 70, lines: 70 },
    },
  },
});
