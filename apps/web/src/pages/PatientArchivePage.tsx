// Archived patients — inactive client files with restore action.
import { useState } from 'react';
import { useApp } from '../store/AppStore';
import { avatarColors, heCount } from '../utils';
import {
  displayPatientEmail, formatTreatmentSpan,
  patientAvatarColor, patientInitials, restorePatient,
} from '../services/patients';
import { normHe } from '../utils/search';
import Highlight from '../components/shared/Highlight';
import './patients.css';
import { CARD_SHADOW } from '../utils/styles';

export default function PatientArchivePage() {
  const { S, set, navigate, toast } = useApp();
  // Archived files are client-side state in both modes (the backend has no
  // archive concept — docs/INTEGRATION.md), so there is nothing to fetch.
  const loading = false;
  const [query, setQuery] = useState('');

  const archived = S.archivedPatients || [];
  const q = normHe(query.trim());
  const filtered = archived.filter((p: any) =>
    !q || normHe(p.name).includes(q) || normHe(p.phone || '').includes(q) || normHe(p.email || '').includes(q),
  );
  if (S.sortBy === 'recent') {
    filtered.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } else {
    // Default: alphabetical, so a long archive stays scannable.
    filtered.sort((a: any, b: any) => a.name.localeCompare(b.name, 'he'));
  }

  const countLabel = heCount(archived.length, 'מטופל אחד בארכיון', 'מטופלים בארכיון');

  const restore = (id: string) => {
    const record = archived.find((p: any) => p.id === id);
    if (!record) return;
    // Client-side lifecycle transform in both modes — the backend has no
    // archive state (docs/INTEGRATION.md).
    const restored = restorePatient(record);
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
      since: formatTreatmentSpan(p.created_at, p.archived_at),
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

      {!loading && archived.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <svg viewBox="0 0 24 24" width="19" height="19" fill="var(--text-muted)" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 14, top: '50%', transform: 'translateY(-50%)' }}><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.49 4.49 0 0 1 9.5 14z" /></svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="חיפוש בארכיון"
            placeholder="חיפוש לפי שם, טלפון או דוא״ל…"
            className="app-search"
          />
        </div>
      )}

      <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
        {loading && (
          <div style={{ padding: '52px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>טוען ארכיון…</div>
        )}

        {!loading && archived.length > 0 && filtered.length === 0 && (
          <div style={{ padding: '52px 24px', textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14.5 }}>לא נמצאו מטופלים בארכיון התואמים לחיפוש “{query}”.</p>
          </div>
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
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}><Highlight text={p.name} query={query} /></span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.meta} · טיפול: {p.since}</div>
              </div>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button onClick={p.onRestore} aria-label="שחזור מטופל" className="pat-icon-btn tap44" style={{ height: 34, padding: '0 12px', border: '1px solid var(--primary-border)', borderRadius: 8, background: 'var(--primary-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: 12.5, fontWeight: 700 }}>
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
