// Session categories — the single source of truth for how a calendar event maps
// to a session type, its Hebrew label, and its on-brand swatch tokens (defined in
// styles/tokens.css, AA-verified in tests/contrast.test.ts). Consumed by the
// desktop week-view home and the mobile day view. Leaf data module — no imports.

export type CatKey = 'weekly' | 'followup' | 'intake' | 'video' | 'couples';

export interface SessionCategory {
  label: string
  bg: string
  bar: string
  text: string
}

export const SESSION_CATEGORIES: Record<CatKey, SessionCategory> = {
  weekly: { label: 'פגישה שבועית', bg: 'var(--cat-weekly-bg)', bar: 'var(--cat-weekly-bar)', text: 'var(--cat-weekly-text)' },
  followup: { label: 'פגישת מעקב', bg: 'var(--cat-followup-bg)', bar: 'var(--cat-followup-bar)', text: 'var(--cat-followup-text)' },
  intake: { label: 'אינטייק', bg: 'var(--cat-intake-bg)', bar: 'var(--cat-intake-bar)', text: 'var(--cat-intake-text)' },
  video: { label: 'פגישת וידאו', bg: 'var(--cat-video-bg)', bar: 'var(--cat-video-bar)', text: 'var(--cat-video-text)' },
  couples: { label: 'פגישה זוגית', bg: 'var(--cat-couples-bg)', bar: 'var(--cat-couples-bar)', text: 'var(--cat-couples-text)' },
};

export const CATEGORY_ORDER: CatKey[] = ['weekly', 'followup', 'intake', 'video', 'couples'];

/** Derive the session category from an event's title/description keywords. */
export function categoryOf(title: string, description = ''): CatKey {
  const hay = (title || '') + ' ' + (description || '');
  if (hay.includes('זוגי')) return 'couples';
  if (hay.includes('אינטייק')) return 'intake';
  if (hay.includes('וידאו')) return 'video';
  if (hay.includes('מעקב')) return 'followup';
  return 'weekly';
}
