// Archived patients — inactive client files with restore action.
import { useEffect, useState } from 'react';
import { useApp } from '../store/AppStore';
import { avatarColors } from '../utils';
import {
  displayPatientEmail, formatPatientSince, loadArchivedPatientsWithFallback,
  patientAvatarColor, patientInitials, restorePatient,
} from '../services/patients';
import { isApiConfigured } from '../services/apiClient';
import './patients.css';
import { CARD_SHADOW } from '../utils/styles';

export default function PatientArchivePage() {
  const { S, set, navigate, toast } = useApp();
  const [loading, setLoading] = useState(isApiConfigured());

  useEffect(() => {
    let cancelled = false;
    if (isApiConfigured()) {
      setLoading(true);
      // Fallback is unused on the API path (success or catch); omit S.archivedPatients
      // from deps so setting it after fetch does not re-trigger this effect.
      loadArchivedPatientsWithFallback([])
        .then(({ patients }) => {
          if (cancelled) return;
          set({ archivedPatients: patients });
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
    return () => { cancelled = true; };
  }, [S.calendarRefreshNonce, set]);

  const archived = S.archivedPatients || [];
  const filtered = [...archived];
  if (S.sortBy === 'name' || S.sortBy === 'relevance') {
    filtered.sort((a, b) => a.name.localeCompare(b.name, 'he'));
  } else if (S.sortBy === 'recent') {
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const countLabel = archived.length + ' מטופלים בארכיון';

  const restore = async (id: string) => {
    const record = archived.find((p: any) => p.id === id);
    if (!record) return;
    if (isApiConfigured()) {
      try {
        const restored = await restorePatient(id);
        set({
          archivedPatients: archived.filter((p: any) => p.id !== id),
          patients: [restored, ...S.patients],
        });
        toast('התיק שוחזר לרשימת המטופלים הפעילים');
        return;
      } catch {
        toast('שחזור בשרת נכשל · נשמר מקומית', 'error');
      }
    }
    const restored = { ...record, archived: false };
    set({
      archivedPatients: archived.filter((p: any) => p.id !== id),
      patients: [restored, ...S.patients],
    });
    toast('התיק שוחזר לרשימת המטופלים הפעילים');
  };

  const rows = filtered.map((p: any) => {
    const color = patientAvatarColor(p.id);
    const a = avatarColors(color);
    return {
      ...p,
      avBg: a.bg,
      avColor: a.color,
      initials: patientInitials(p.name),
      meta: p.phone + ' · ' + displayPatientEmail(p.email),
      since: formatPatientSince(p.created_at),
      onOpen: () => navigate('patient', { patientId: p.id }),
      onRestore: (e: any) => { e.stopPropagation(); restore(p.id); },
    };
  });

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 27, fontWeight: 900, letterSpacing: '-.6px' }}>ארכיון מטופלים</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>{countLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('patients')}
          className="pat-new-btn"
          style={{ display: 'flex', alignItems: 'center', gap: 7, height: 44, padding: '0 18px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', color: 'var(--text-2)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}
        >
          חזרה למטופלים פעילים
        </button>
      </div>

      <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
        {loading && (
          <div style={{ padding: '52px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>טוען ארכיון…</div>
        )}

        {!loading && archived.length === 0 && (
          <div style={{ padding: '52px 24px', textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 700 }}>הארכיון ריק</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14.5, maxWidth: 420, marginInline: 'auto' }}>
              מטופלים שהועברו לארכיון יופיעו כאן. ניתן לשחזר אותם בכל עת לרשימת המטופלים הפעילים.
            </p>
          </div>
        )}

        {!loading && rows.map((p: any) => (
          <div
            key={p.id}
            className="pat-row"
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 22px', borderBottom: '1px solid var(--line)' }}
          >
            <button
              type="button"
              onClick={p.onOpen}
              aria-label={p.name}
              style={{ border: 'none', background: 'none', padding: 0, margin: 0, font: 'inherit', color: 'inherit', textAlign: 'start', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}
            >
              <span style={{ width: 44, height: 44, borderRadius: '50%', background: p.avBg, color: p.avColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0, opacity: 0.85 }}>{p.initials}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 3 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{p.name}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: 20, padding: '2px 8px' }}>בארכיון</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.meta} · מאז {p.since}</div>
              </div>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button onClick={p.onRestore} aria-label="שחזור מטופל" className="pat-icon-btn" style={{ height: 34, padding: '0 12px', border: '1px solid var(--primary-border)', borderRadius: 8, background: 'var(--primary-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: 12.5, fontWeight: 700 }}>
                שחזור
              </button>
              <button onClick={(e) => { e.stopPropagation(); set({ dialog: 'deletePatientPermanent', dialogPatientId: p.id }); }} aria-label="מחיקת מטופל לצמיתות" className="pat-del-btn" style={{ width: 34, height: 34, border: '1px solid var(--divider)', borderRadius: 8, background: 'var(--paper)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--error)"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
              </button>
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
