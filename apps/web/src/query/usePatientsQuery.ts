import { useQuery } from '@tanstack/react-query';
import { isApiConfigured } from '../services/apiClient';
import { listPatients } from '../services/patients';
import { queryKeys } from './keys';

/** Live roster from GET /patients. Disabled in demo (no VITE_API_BASE_URL). */
export function usePatientsQuery() {
  return useQuery({
    queryKey: queryKeys.patients,
    queryFn: ({ signal }) => listPatients(signal),
    enabled: isApiConfigured(),
  });
}
