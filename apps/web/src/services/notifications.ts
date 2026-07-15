// Notification center — GET /notifications, PATCH /notifications/{id} against senseiapi.
import { apiRequest, isApiConfigured } from './apiClient';

export type NotificationKind = 'summary' | 'risk' | 'reminder' | 'system';

export interface ApiNotification {
  id: string
  kind: NotificationKind
  patient_id: string | null
  title: string
  body: string
  group_label: string
  display_time: string
  read: boolean
  archived: boolean
  created_at: string
}

/** Lists the therapist's notifications, newest first. Throws NO_API when unset. */
export async function listNotifications(signal?: AbortSignal): Promise<ApiNotification[]> {
  if (!isApiConfigured()) {
    throw Object.assign(new Error('API not configured'), { code: 'NO_API' });
  }
  return apiRequest<ApiNotification[]>('/notifications', { method: 'GET', signal });
}

/** Toggles read/archived state on one notification. Throws NO_API when unset. */
export async function updateNotification(
  id: string,
  patch: { read?: boolean; archived?: boolean },
  signal?: AbortSignal,
): Promise<ApiNotification> {
  if (!isApiConfigured()) {
    throw Object.assign(new Error('API not configured'), { code: 'NO_API' });
  }
  return apiRequest<ApiNotification>('/notifications/' + encodeURIComponent(id), {
    method: 'PATCH',
    body: patch,
    signal,
  });
}
