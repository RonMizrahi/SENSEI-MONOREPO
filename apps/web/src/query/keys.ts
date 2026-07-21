// Canonical React Query keys for senseiapi-backed data.
export const queryKeys = {
  patients: ['patients'] as const,
  calendar: ['calendar'] as const,
  calendarWeek: (from: string, to: string) => ['calendar', 'week', from, to] as const,
  patientUpcoming: (patientId: string) => ['calendar', 'upcoming', patientId] as const,
  patientPast: (patientId: string) => ['calendar', 'past', patientId] as const,
};

export function invalidatePatients(client: { invalidateQueries: (opts: { queryKey: readonly unknown[] }) => unknown }) {
  return client.invalidateQueries({ queryKey: queryKeys.patients });
}

export function invalidateCalendar(client: { invalidateQueries: (opts: { queryKey: readonly unknown[] }) => unknown }) {
  return client.invalidateQueries({ queryKey: queryKeys.calendar });
}
