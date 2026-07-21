// Privacy notice: the capability-derived SSOT must reflect the app's ACTUAL
// behavior per environment (never hardcoded, never misleading), and the shared
// component must be an accessible disclosure reused across the app.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { resolvePrivacyCapabilities, privacyItems, PRIVACY_HEADLINE, PRIVACY_FALLBACK } from '../src/data/privacyNotice';
import PrivacyNotice from '../src/components/shared/PrivacyNotice';

afterEach(cleanup);

describe('privacy capabilities SSOT', () => {
  it('client-only (no backend): local storage, nothing transmitted, audio not retained, user controls', () => {
    const items = privacyItems(resolvePrivacyCapabilities(false));
    const text = items.map((i) => i.text).join(' | ');
    expect(text).toContain('מקומית');
    expect(text).toContain('אינו נשלח');
    expect(text).toContain('אינו נשמר');
    expect(text).toContain('ייצוא, שחזור ומחיקה');
    // never asserts server-side security it does not have
    expect(text).not.toMatch(/HTTPS|בשרת/);
  });

  it('backend wired: server storage + HTTPS transit + controls; audio retention NOT asserted (unknown)', () => {
    const items = privacyItems(resolvePrivacyCapabilities(true));
    const text = items.map((i) => i.text).join(' | ');
    expect(text).toContain('בשרת');
    expect(text).toContain('HTTPS');
    expect(text).not.toContain('אינו נשמר'); // audio retention is backend policy → omitted
  });

  it('no capability metadata → empty item list (component shows the generic fallback)', () => {
    expect(privacyItems(null)).toEqual([]);
    expect(PRIVACY_FALLBACK).toMatch(/מדיניות הפרטיות/);
  });
});

describe('PrivacyNotice component (accessible disclosure)', () => {
  it('renders the headline and a "?" toggle that reveals the capability items', () => {
    render(<PrivacyNotice apiConfigured={false} />);
    expect(screen.getByText(PRIVACY_HEADLINE)).toBeTruthy();
    const toggle = screen.getByRole('button', { name: 'פרטיות ואבטחה' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    act(() => { fireEvent.click(toggle); });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    // panel content is the SSOT items
    expect(document.body.textContent).toContain('מקומית');
    // controls target size: the toggle carries the tap44 hit-expansion class
    expect(toggle.className).toContain('tap44');
  });
});
