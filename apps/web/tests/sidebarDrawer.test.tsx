// Off-canvas drawer hygiene (desktop shell, ≤860px band): opening the drawer
// locks background scroll, moves focus into it, and traps Tab; closing restores
// focus to the menu toggle. The drawer width must be viewport-responsive.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import fs from 'node:fs';
import App from '../src/App';
import { AppStoreProvider } from '../src/store/AppStore';

const settle = () => act(() => new Promise((r) => setTimeout(r, 30)));

function installMatchMedia(drawerBand: boolean) {
  window.matchMedia = ((q: string) => ({
    // the drawer effect asks for (max-width: 860px); useIsMobile asks for 767px
    matches: q.includes('860') ? drawerBand : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as any;
}

async function mountSignedIn() {
  localStorage.setItem('sensei_auth', JSON.stringify({ signedIn: true }));
  render(<AppStoreProvider><App /></AppStoreProvider>);
  await settle();
}

describe('off-canvas nav drawer (≤860px)', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { cleanup(); document.body.style.overflow = ''; });

  it('open → scroll lock + focus moves into the drawer; close → focus returns to the toggle', async () => {
    installMatchMedia(true);
    await mountSignedIn();
    const toggle = screen.getByRole('button', { name: 'פתיחת תפריט הניווט' });

    fireEvent.click(toggle);
    await settle();
    expect(document.body.style.overflow).toBe('hidden');
    const aside = document.querySelector('.app-sidebar')!;
    expect(aside.classList.contains('open')).toBe(true);
    expect(aside.contains(document.activeElement)).toBe(true);

    fireEvent.click(toggle); // toggle closes
    await settle();
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(document.activeElement).toBe(toggle);
  });

  it('Tab wraps inside the open drawer (focus trap)', async () => {
    installMatchMedia(true);
    await mountSignedIn();
    fireEvent.click(screen.getByRole('button', { name: 'פתיחת תפריט הניווט' }));
    await settle();
    const aside = document.querySelector('.app-sidebar')!;
    const focusables = Array.from(aside.querySelectorAll<HTMLElement>('[tabindex="0"], button'));
    expect(focusables.length).toBeGreaterThan(3);
    const last = focusables[focusables.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' }); // forward from last wraps to first
    expect(document.activeElement).toBe(focusables[0]);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); // back from first wraps to last
    expect(document.activeElement).toBe(last);
  });

  it('on desktop (no drawer band) opening state never locks scroll', async () => {
    installMatchMedia(false);
    await mountSignedIn();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('on-ink sidebar texts (brand title, profile name) never use --paper (goes dark-on-dark in dark theme)', () => {
    // --paper is #122038 in dark theme → 1.12:1 against the --ink sidebar. On-ink
    // text must use the ink-panel token. --paper stays allowed on --primary fills.
    const src = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');
    const onInkLines = src.split('\n').filter((l) => l.includes('סנסיי</div>') || l.includes('{PS.name}</div>'));
    expect(onInkLines.length).toBe(2);
    for (const l of onInkLines) {
      expect(l).toContain("color: 'var(--ink-text)'");
      expect(l).not.toContain('--paper');
    }
  });

  it('drawer width is viewport-responsive and full-height (static CSS contract)', () => {
    const css = fs.readFileSync('src/styles/tokens.css', 'utf8');
    expect(css).toContain('width:min(256px,86vw) !important');
    expect(css).toMatch(/\.app-sidebar\{height:100vh;height:100dvh\}/);
  });
});
