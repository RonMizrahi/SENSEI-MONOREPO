// URL-hash routing (`src/nav/urlHash.ts`) — the canonical mapping between the
// store's state-driven route and the shareable fragment. These lock the deep-
// link contract: every screen round-trips, patient screens carry their id,
// and no malformed/hand-edited fragment can ever inject state or crash.
import { describe, expect, it } from 'vitest';
import { ALL_ROUTES } from '../src/nav/navConfig';
import { PATIENT_ROUTES, parseHash, routeToHash } from '../src/nav/urlHash';

describe('urlHash — routeToHash', () => {
  it('session detail carries patient id and session number', () => {
    expect(routeToHash('session', 'p3', 7)).toBe('#/session/p3/7');
    expect(parseHash('#/session/p3/7')).toEqual({ route: 'session', patientId: 'p3', sessionNum: 7 });
    expect(parseHash('#/session/p3')).toBeNull();
    expect(parseHash('#/session/p3/abc')).toBeNull();
  });
  it('every one of the app routes produces a parseable fragment (full round-trip)', () => {
    for (const route of ALL_ROUTES) {
      if (route === 'session') continue;
      const h = routeToHash(route);
      expect(h.startsWith('#/')).toBe(true);
      expect(parseHash(h)).toEqual({ route });
    }
  });
  it('patient-scoped screens carry the patient id; others ignore it', () => {
    expect(routeToHash('patient', 'p3')).toBe('#/patient/p3');
    expect(parseHash('#/patient/p3')).toEqual({ route: 'patient', patientId: 'p3' });
    expect(routeToHash('dashboard', 'p3')).toBe('#/dashboard'); // id meaningless here
    for (const r of PATIENT_ROUTES) expect(routeToHash(r, 'p1')).toBe(`#/${r}/p1`);
  });
  it('an unknown route falls back to the dashboard fragment (never a broken URL)', () => {
    expect(routeToHash('no-such-screen')).toBe('#/dashboard');
  });
  it('a malformed id is dropped rather than serialized into the URL', () => {
    expect(routeToHash('patient', '<img src=x>')).toBe('#/patient');
    expect(routeToHash('patient', 'x'.repeat(65))).toBe('#/patient');
  });
});

describe('urlHash — parseHash (hand-edited URLs can never inject state)', () => {
  it('returns null for empty, root, and unknown fragments', () => {
    expect(parseHash('')).toBeNull();
    expect(parseHash('#/')).toBeNull();
    expect(parseHash('#/definitely-not-a-route')).toBeNull();
  });
  it('rejects ids on non-patient routes and malformed ids on patient routes', () => {
    expect(parseHash('#/settings/p1')).toBeNull();
    expect(parseHash('#/patient/<script>')).toBeNull();
    expect(parseHash('#/patient/' + 'x'.repeat(65))).toBeNull();
  });
  it('tolerates missing leading slash', () => {
    expect(parseHash('#help')).toEqual({ route: 'help' });
  });
});
