// Patient service — senseiapi `/patients` CRUD + shared patient shape.
import { apiRequest, isApiConfigured } from './apiClient';
import { MOCK_PATIENTS } from '../data/mockPatients';
import { AVATAR_PALETTE } from '../utils';

export interface Patient {
  id: string
  name: string
  phone: string
  email: string | null
  created_at: string
  archived?: boolean
}

export interface PatientCreatePayload {
  name: string
  phone: string
  email?: string | null
}

export interface PatientUpdatePayload {
  name?: string
  phone?: string
  email?: string | null
  archived?: boolean
}

export interface ListPatientsOptions {
  archived?: boolean
}

function normalizePatient(patient: Patient): Patient {
  return { ...patient, archived: !!patient.archived };
}

export async function listPatients(options: ListPatientsOptions = {}): Promise<Patient[]> {
  const archived = options.archived ?? false;
  const qs = archived ? '?archived=true' : '';
  const patients = await apiRequest<Patient[]>('/patients' + qs);
  return patients.map(normalizePatient);
}

export async function listArchivedPatients(): Promise<Patient[]> {
  return listPatients({ archived: true });
}

/** Load from API when configured; use mock roster only when VITE_API_BASE_URL is unset. */
export async function loadPatientsWithFallback(fallback: Patient[]): Promise<{ patients: Patient[]; source: 'api' | 'mock' }> {
  if (!isApiConfigured()) {
    const roster = fallback.length ? fallback : MOCK_PATIENTS;
    return {
      patients: roster.filter((p) => !p.archived),
      source: 'mock',
    };
  }
  try {
    return { patients: await listPatients({ archived: false }), source: 'api' };
  } catch {
    return { patients: [], source: 'api' };
  }
}

export async function loadArchivedPatientsWithFallback(fallback: Patient[]): Promise<{ patients: Patient[]; source: 'api' | 'mock' }> {
  if (!isApiConfigured()) {
    return {
      patients: fallback.filter((p) => !!p.archived),
      source: 'mock',
    };
  }
  try {
    return { patients: await listArchivedPatients(), source: 'api' };
  } catch {
    return { patients: [], source: 'api' };
  }
}

export async function createPatient(payload: PatientCreatePayload): Promise<Patient> {
  const body: PatientCreatePayload = {
    name: payload.name.trim(),
    phone: payload.phone.trim(),
  };
  const email = payload.email?.trim();
  if (email) body.email = email;
  const created = await apiRequest<Patient>('/patients', { method: 'POST', body });
  return normalizePatient(created);
}

export async function updatePatient(id: string, payload: PatientUpdatePayload): Promise<Patient> {
  const body: PatientUpdatePayload = {};
  if (payload.name !== undefined) body.name = payload.name.trim();
  if (payload.phone !== undefined) body.phone = payload.phone.trim();
  if ('email' in payload) body.email = payload.email?.trim() || null;
  if (payload.archived !== undefined) body.archived = payload.archived;
  const updated = await apiRequest<Patient>('/patients/' + encodeURIComponent(id), { method: 'PATCH', body });
  return normalizePatient(updated);
}

export async function archivePatient(id: string): Promise<Patient> {
  return updatePatient(id, { archived: true });
}

export async function restorePatient(id: string): Promise<Patient> {
  return updatePatient(id, { archived: false });
}

export async function deletePatient(id: string): Promise<void> {
  return apiRequest<void>('/patients/' + encodeURIComponent(id), { method: 'DELETE' });
}

export function patientInitials(name: string): string {
  return (name || '').trim().split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('') || '—';
}

export function patientAvatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

export function formatPatientSince(created_at: string): string {
  const d = new Date(created_at);
  if (Number.isNaN(d.getTime())) return '—';
  return String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
}

export function displayPatientEmail(email: string | null | undefined): string {
  return email && email.trim() ? email.trim() : '—';
}

export function localPatient(payload: PatientCreatePayload): Patient {
  return {
    id: 'p' + Date.now(),
    name: payload.name.trim(),
    phone: payload.phone.trim(),
    email: payload.email?.trim() || null,
    created_at: new Date().toISOString(),
    archived: false,
  };
}

export function activePatients(patients: Patient[]): Patient[] {
  return patients.filter((p) => !p.archived);
}

export function archivedPatients(patients: Patient[]): Patient[] {
  return patients.filter((p) => !!p.archived);
}
