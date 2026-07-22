import { describe, expect, it } from 'vitest';
import { ALL_ROUTES, navConfig, ROUTE_TITLES } from '../src/nav/navConfig';

describe('navConfig — single source of truth (v2.2.0 contract)', () => {
  const destinations = navConfig().filter((n) => n.key);

  it('exposes all sidebar destinations, grouped for scanning and discoverability', () => {
    expect(destinations.map((d) => d.key)).toEqual([
      // upload was removed from the nav by request — it stays reachable from the
      // home cards, agenda quick actions, patient file, and the #/upload deep link
      'dashboard', 'patients', 'calendar', 'nextMeetingReport', 'meetingHistory', 'patientArchive',
      'help', 'settings',
    ]);
  });

  it('groups the review-oriented destinations under a non-pinned "מעקב ותיעוד" label', () => {
    // IA: the primary daily-action tools stay unlabelled at the top; the
    // records/reference destinations (reports · history · archive) sit under a
    // grouping label so the nav reads as "act" vs "review".
    const raw = navConfig();
    const trackIdx = raw.findIndex((n) => n.section === 'מעקב ותיעוד' && !n.pinned);
    expect(trackIdx, 'a non-pinned "מעקב ותיעוד" section header must exist').toBeGreaterThan(-1);
    const afterTrack = raw.slice(trackIdx + 1).filter((n) => n.key && !n.section).map((n) => n.key);
    // the three review destinations immediately follow the label (before the pinned group)
    expect(afterTrack.slice(0, 3)).toEqual(['nextMeetingReport', 'meetingHistory', 'patientArchive']);
  });

  it('the General utility section is pinned so Settings/Help stay reachable as the nav grows', () => {
    const sections = navConfig().filter((n) => n.section);
    const pinned = sections.filter((n) => n.pinned);
    expect(pinned.map((s) => s.section)).toEqual(['כללי']);
    const raw = navConfig();
    const pinnedIdx = raw.findIndex((n) => n.pinned);
    const pinnedKeys = raw.slice(pinnedIdx + 1).filter((n) => n.key).map((n) => n.key);
    expect(pinnedKeys).toEqual(['help', 'settings']); // הגדרות is the FINAL menu item (pinned bottom)
  });

  it('every navigable top-level page has a sidebar entry (no orphaned routes)', () => {
    const CONTEXTUAL = new Set([
      'patient', 'upload', 'transcript', 'summary', 'session', 'report', 'letter',
      'upcomingMeetings', 'search', 'notifications',
    ]);
    const orphaned = ALL_ROUTES.filter((r) => !CONTEXTUAL.has(r) && !destinations.some((d) => d.key === r));
    expect(orphaned, `top-level routes with no sidebar entry:\n${orphaned.join('\n')}`).toEqual([]);
  });

  it('every destination has a label and a distinct icon (no duplicate glyphs)', () => {
    for (const d of destinations) {
      expect(d.label).toBeTruthy();
      expect(d.icon).toBeTruthy();
    }
    const icons = destinations.map((d) => d.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('every destination has a document title', () => {
    for (const d of destinations) expect(ROUTE_TITLES[d.key!]).toBeTruthy();
  });

  it('covers all content routes with titles', () => {
    expect(ALL_ROUTES.length).toBe(18);
  });
});
