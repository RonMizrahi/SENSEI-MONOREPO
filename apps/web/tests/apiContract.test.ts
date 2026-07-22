// Contract lock — the senseiapi backend is the single source of truth
// (docs/INTEGRATION.md). These static sweeps pin the frontend to routes and
// payload shapes the backend actually implements, so a drift (new path, revived
// POST to a GET-only route, archive PATCH, stray form fields) fails CI.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('senseiapi contract lock', () => {
  it('services only reference routes that exist on the backend (or documented-absent probes)', () => {
    const files = fs.readdirSync('src/services').filter((f) => f.endsWith('.ts'));
    const pathLits = files.flatMap((f) => {
      const src = read('src/services/' + f);
      return [...src.matchAll(/'(\/[a-z_]+(?:\/[a-z_'+ .A-Za-z()-]*)?)'/g)].map((m) => m[1]);
    });
    const roots = new Set(pathLits.map((p) => '/' + p.split('/')[1]));
    // Backend routers: /auth /patients /calendar /audio /meetings (+/health,/ready unused).
    // The monorepo NestJS backend (apps/api) additionally provides /notifications,
    // /settings, and per-patient /notes — consumed by the live-backend service layer.
    // /meetings/{id}/transcript and /patients/{id}/next-meeting-report are documented
    // backend gaps (INTEGRATION.md §gaps) probed with graceful-absence handling.
    for (const root of roots) {
      expect(['/auth', '/patients', '/calendar', '/audio', '/meetings', '/notifications', '/settings', '/notes'], 'unknown API root ' + root)
        .toContain(root);
    }
  });

  it('summary service may DELETE (re-upload) but never POSTs regenerate', () => {
    const src = read('src/services/meetingSummary.ts');
    expect(src).not.toMatch(/method:\s*'POST'/);
    expect(src).toMatch(/method:\s*'DELETE'/);
  });

  it('patient PATCH never sends archive state and list sends no query params', () => {
    const src = read('src/services/patients.ts');
    expect(src).not.toContain('archived=true');
    expect(src).not.toMatch(/body\.archived/);
  });

  it('audio upload sends only the contract form fields (file, patient_id, meeting_id)', () => {
    const src = read('src/services/upload.ts');
    const appended = [...src.matchAll(/form\.append\('([^']+)'/g)].map((m) => m[1]);
    expect(appended.sort()).toEqual(['file', 'meeting_id', 'patient_id']);
  });

  it('every request target derives from the environment base URL (none hardcoded)', () => {
    // Demo fixture links (calendar.google.com etc.) are data, not request
    // targets — so assert on fetch()/xhr.open() call sites specifically.
    const files = fs.readdirSync('src/services').filter((f) => f.endsWith('.ts'));
    for (const f of files) {
      const src = read('src/services/' + f);
      expect(src, f + ' fetches a hardcoded URL').not.toMatch(/fetch\(\s*'http/);
      expect(src, f + ' opens XHR to a hardcoded URL').not.toMatch(/\.open\(\s*'[A-Z]+',\s*'http/);
    }
    // The single base-URL definition reads only from import.meta.env.
    expect(read('src/services/apiClient.ts')).toContain("(import.meta.env.VITE_API_BASE_URL || '')");
  });
});
