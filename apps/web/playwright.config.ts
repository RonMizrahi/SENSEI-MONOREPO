import { defineConfig, devices } from '@playwright/test';

// E2E drives the real SPA against a live backend. In CI it boots a MOCK_MODE API
// (seeded, no DB) + the Vite dev server wired to it; locally it reuses whatever
// is already running (e.g. a Supabase-backed API) — both serve the same seeded
// Hebrew world, so the journeys hold either way.
const WEB = 'http://localhost:3110';
const API = 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts', // keep separate from the vitest *.test.ts suite
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: { baseURL: WEB, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter api start:dev',
      env: { MOCK_MODE: 'true', PORT: '3000', LOG_LEVEL: 'warn', SEED_DEMO_DATA: 'false' },
      url: `${API}/health`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter @sensei/web dev',
      env: { VITE_API_BASE_URL: API },
      url: WEB,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
