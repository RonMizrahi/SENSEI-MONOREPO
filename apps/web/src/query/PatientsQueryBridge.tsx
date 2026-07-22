// Mirrors the live patients query into AppStore so existing S.patients consumers
// keep working without a mass rewrite.
import { useEffect, useRef } from 'react';
import { useApp } from '../store/AppStore';
import { isApiConfigured } from '../services/apiClient';
import { usePatientsQuery } from './usePatientsQuery';

export default function PatientsQueryBridge() {
  const { S, set, toast } = useApp();
  const useApi = isApiConfigured();
  const { data, isError, isSuccess, isFetching } = usePatientsQuery();
  const patientsRef = useRef(S.patients);
  patientsRef.current = S.patients;
  const toastedEmpty = useRef(false);

  useEffect(() => {
    if (!useApi || !isSuccess || !data) return;
    const current = patientsRef.current || [];
    set((s: any) => {
      const patch: Record<string, unknown> = {
        patients: data,
        scheduledAppts: [],
      };
      const curId = s.patientId as string;
      if (!curId && data.length) {
        patch.patientId = data[0].id;
      } else if (curId && data.length && !data.some((p) => p.id === curId)) {
        const prev = current.find((p: any) => p.id === curId);
        if (prev) {
          const match = data.find((p) => p.name === prev.name);
          patch.patientId = match ? match.id : data[0].id;
        } else {
          patch.patientId = data[0].id;
        }
      }
      return patch;
    });
    if (data.length === 0 && !isFetching && !toastedEmpty.current) {
      toastedEmpty.current = true;
      toast('לא ניתן לטעון מטופלים מהשרת', 'error');
    }
    if (data.length > 0) toastedEmpty.current = false;
  }, [useApi, isSuccess, data, isFetching, set, toast]);

  useEffect(() => {
    if (!useApi || !isError || toastedEmpty.current) return;
    toastedEmpty.current = true;
    toast('לא ניתן לטעון מטופלים מהשרת', 'error');
  }, [useApi, isError, toast]);

  return null;
}
