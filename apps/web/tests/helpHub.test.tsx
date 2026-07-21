// Help & Support hub — FAQ, troubleshooting, contact, feedback, legal, version.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { AppStoreProvider } from '../src/store/AppStore';
import App from '../src/App';

const PKEY = 'sensei_session_react_v1';
afterEach(() => { cleanup(); localStorage.clear(); });

describe('help & support hub', () => {
  it('renders every hub section with contact, feedback, and version details', async () => {
    localStorage.setItem(PKEY, JSON.stringify({ __savedAt: Date.now(), view: 'app', route: 'help' }));
    render(<AppStoreProvider><App /></AppStoreProvider>);
    await act(() => new Promise((r) => setTimeout(r, 80)));
    await waitFor(() => expect(document.body.textContent).toContain('שאלות נפוצות'));
    const t = document.body.textContent!;
    for (const section of ['פתרון תקלות', 'קיצורי מקלדת', 'צריכים עזרה נוספת', 'אודות ומידע משפטי', 'שליחת משוב', 'גרסה']) {
      expect(t, section).toContain(section);
    }
    expect(document.querySelector('a[href^="mailto:support@sensei.co.il"]')).toBeTruthy();
  });
});

describe('truthfulness — no unverifiable security claims in this client-only build', () => {
  it('UI copy never claims encryption, PII scrubbing, RBAC, audit logs, or a 200MB limit', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true })
      .flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
    const FORBIDDEN = /AES-256|ניקוי פרטים מזהים|ניקוי PII|RBAC|מוצפן מקצה לקצה|יומן הפעילות|הגדרות הפרטיות|200MB/;
    const hits = walk('src').filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => FORBIDDEN.test(fs.readFileSync(f, 'utf8')))
      .map((f) => f);
    expect(hits, 'unverifiable claims (truthfulness rule, CONTENT_GUIDE §5)').toEqual([]);
  });
});
