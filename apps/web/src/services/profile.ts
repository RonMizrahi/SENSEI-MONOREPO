// Therapist profile — GET/PATCH /auth/me against senseiapi.
import { apiRequest, isApiConfigured } from './apiClient';

export interface ApiProfile {
  user_id: string
  email: string
  full_name: string | null
  phone: string | null
  gender: string | null
  title: string | null
  license_number: string | null
  org: string | null
  bio: string | null
  avatar_color: string | null
  role: string
  created_at: string
}

/** Editable subset of the profile (snake_case, all optional). */
export type ProfilePatch = Partial<
  Pick<
    ApiProfile,
    'full_name' | 'phone' | 'gender' | 'title' | 'license_number' | 'org' | 'bio' | 'avatar_color'
  >
>;

/** Fetches the current therapist profile. Throws NO_API when the backend is unset. */
export async function fetchProfile(signal?: AbortSignal): Promise<ApiProfile> {
  if (!isApiConfigured()) {
    throw Object.assign(new Error('API not configured'), { code: 'NO_API' });
  }
  return apiRequest<ApiProfile>('/auth/me', { method: 'GET', signal });
}

/** Applies profile edits and returns the updated profile. Throws NO_API when unset. */
export async function updateProfile(patch: ProfilePatch, signal?: AbortSignal): Promise<ApiProfile> {
  if (!isApiConfigured()) {
    throw Object.assign(new Error('API not configured'), { code: 'NO_API' });
  }
  return apiRequest<ApiProfile>('/auth/me', { method: 'PATCH', body: patch, signal });
}
