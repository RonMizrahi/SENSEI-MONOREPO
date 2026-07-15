// Therapist preferences — GET/PUT /settings against senseiapi.
import { apiRequest, isApiConfigured } from './apiClient';

/** Opaque client-owned preferences blob (a11y / notifPrefs / appearance / security). */
export type Preferences = Record<string, unknown>;

export interface SettingsPayload {
  preferences: Preferences
}

/** Fetches the therapist's preferences blob. Throws NO_API when the backend is unset. */
export async function fetchSettings(signal?: AbortSignal): Promise<Preferences> {
  if (!isApiConfigured()) {
    throw Object.assign(new Error('API not configured'), { code: 'NO_API' });
  }
  const res = await apiRequest<SettingsPayload>('/settings', { method: 'GET', signal });
  return res.preferences;
}

/** Replaces the therapist's preferences blob. Throws NO_API when the backend is unset. */
export async function saveSettings(
  preferences: Preferences,
  signal?: AbortSignal,
): Promise<Preferences> {
  if (!isApiConfigured()) {
    throw Object.assign(new Error('API not configured'), { code: 'NO_API' });
  }
  const res = await apiRequest<SettingsPayload>('/settings', {
    method: 'PUT',
    body: { preferences },
    signal,
  });
  return res.preferences;
}
