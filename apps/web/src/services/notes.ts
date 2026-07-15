// Clinical notes — GET/PUT /patients/{id}/notes against senseiapi.
import { apiRequest, isApiConfigured } from './apiClient';

export interface PatientNote {
  patient_id: string
  body: string
  updated_at: string | null
}

function pathFor(patientId: string): string {
  return '/patients/' + encodeURIComponent(patientId) + '/notes';
}

/** Fetches the therapist's clinical note for a patient. Throws NO_API when unset. */
export async function fetchPatientNote(
  patientId: string,
  signal?: AbortSignal,
): Promise<PatientNote> {
  if (!isApiConfigured()) {
    throw Object.assign(new Error('API not configured'), { code: 'NO_API' });
  }
  return apiRequest<PatientNote>(pathFor(patientId), { method: 'GET', signal });
}

/** Replaces the therapist's clinical note for a patient. Throws NO_API when unset. */
export async function savePatientNote(
  patientId: string,
  body: string,
  signal?: AbortSignal,
): Promise<PatientNote> {
  if (!isApiConfigured()) {
    throw Object.assign(new Error('API not configured'), { code: 'NO_API' });
  }
  return apiRequest<PatientNote>(pathFor(patientId), { method: 'PUT', body: { body }, signal });
}
