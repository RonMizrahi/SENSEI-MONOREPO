// Patients list — patient roster.
import { useState } from 'react';
import Highlight from '../components/shared/Highlight';
import { useApp } from '../store/AppStore';
import { avatarColors, heCount } from '../utils';
import {
  patientInitials, patientAvatarColor, formatPatientSince, displayPatientEmail,
} from '../services/patients';
import { normHe } from '../utils/search';
import { dayKey } from '../services/calendar';
import './patients.css';
import { CARD_SHADOW } from '../utils/styles';

export default function PatientsPage() {
  const { S, set, navigate } = useApp();
  const [query, setQuery] = useState('');

  const openCreatePatient = () => set({
    dialog: 'create', form: { name: '', phone: '', email: '', address: '' },
    errors: {},
  });

  const roster: any[] = S.demoEmpty ? [] : S.patients;
  const q = normHe(query.trim());
  let filtered = q
    ? roster.filter((p: any) => normHe(p.name).includes(q) || normHe(p.phone || '').includes(q) || normHe(p.email || '').includes(q))
    : [...roster];

  const sortBy = S.sortBy === 'recent' ? 'recent' : 'name';
  if (sortBy === 'recent') filtered = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  else filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'he'));

  const patientCountLabel = q ? filtered.length + ' מתוך ' + S.patients.length + ' מטופלים' : heCount(S.patients.length, 'מטופל פעיל אחד', 'מטופלים פעילים');

  // Next upcoming appointment per patient — surfaced on the row for scannability.
  const todayKey = dayKey(new Date());
  const nextApptFor = (pid: string) => {
    const upcoming = (S.scheduledAppts || [])
      .filter((a: any) => a.pid === pid && a.date >= todayKey)
      .sort((a: any, b: any) => (a.date + a.time).localeCompare(b.date + b.time));
    if (!upcoming.length) return '';
    const a = upcoming[0];
    const label = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' }).format(new Date(a.date + 'T00:00:00'));
    return label + ' · ' + a.time;
  };

  const rows = filtered.map((p: any) => {
    const color = patientAvatarColor(p.id);
    const a = avatarColors(color);
    const open = () => navigate('patient', { patientId: p.id });
    return {
      ...p, avBg: a.bg, avColor: a.color, initials: patientInitials(p.name),
      meta: p.phone + ' · ' + displayPatientEmail(p.email),
      since: formatPatientSince(p.created_at),
      nextMeeting: nextApptFor(p.id),
      onOpen: open,
      onEdit: (e: any) => {
        e.stopPropagation();
        set({
          dialog: 'edit', dialogPatientId: p.id,
          form: { name: p.name, phone: p.phone, email: p.email || '', address: p.address || '' },
          errors: {},
        });
      },
      onDelete: (e: any) => { e.stopPropagation(); set({ dialog: 'delete', dialogPatientId: p.id }); },
    };
  });

  const patientsEmpty = S.patients.length === 0 || S.demoEmpty;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 27, fontWeight: 900, letterSpacing: '-.6px' }}>מטופלים</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>{patientCountLabel}</p>
        </div>
        <button onClick={openCreatePatient} className="pat-new-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, height: 44, padding: '0 18px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--paper)"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
          מטופל חדש
        </button>
      </div>

      {!patientsEmpty && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <svg viewBox="0 0 24 24" width="19" height="19" fill="var(--text-muted)" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 14, top: '50%', transform: 'translateY(-50%)' }}><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.49 4.49 0 0 1 9.5 14z" /></svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="חיפוש מטופלים" placeholder="חיפוש לפי שם, טלפון או דוא״ל…" className="app-search" />
          </div>
          <div role="group" aria-label="מיון מטופלים" style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--divider)', flexShrink: 0 }}>
            <button type="button" className="pat-sort-btn" aria-pressed={sortBy === 'name'} onClick={() => set({ sortBy: 'name' })} style={{ height: 44, padding: '0 16px', border: 'none', background: sortBy === 'name' ? 'var(--primary)' : 'var(--paper)', color: sortBy === 'name' ? 'var(--paper)' : 'var(--text-2)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>א־ת</button>
            <button type="button" className="pat-sort-btn" aria-pressed={sortBy === 'recent'} onClick={() => set({ sortBy: 'recent' })} style={{ height: 44, padding: '0 16px', border: 'none', borderInlineStart: '1px solid var(--divider)', background: sortBy === 'recent' ? 'var(--primary)' : 'var(--paper)', color: sortBy === 'recent' ? 'var(--paper)' : 'var(--text-2)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>לאחרונה</button>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
        {patientsEmpty && (
          <div style={{ padding: '52px 24px', textAlign: 'center' }}>
            <img src="/assets/sensei-fan.png" alt="" aria-hidden="true" width={140} height={108} style={{ display: 'block', margin: '0 auto 16px', objectFit: 'contain', opacity: 0.8 }} />
            <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 700 }}>אין מטופלים עדיין</h2>
            <p style={{ margin: '0 auto 20px', color: 'var(--text-secondary)', fontSize: 14.5, maxWidth: 420 }}>הוסיפו את המטופל הראשון שלכם כדי להתחיל לנהל פגישות ותובנות.</p>
            <button onClick={openCreatePatient} className="pat-new-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 44, padding: '0 20px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--on-accent)"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>מטופל חדש
            </button>
            <div style={{ marginTop: 14 }}>
              <a onClick={() => navigate('upload', { upload: { state: 'idle', progress: 0, fileName: '', error: '' } })} role="button" tabIndex={0} className="pat-empty-upload" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>או העלו הקלטה של מפגש כדי להתחיל ›</a>
            </div>
          </div>
        )}

        {!patientsEmpty && rows.length === 0 && (
          <div style={{ padding: '44px 24px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 14px', color: 'var(--text-secondary)', fontSize: 14.5 }}>לא נמצאו מטופלים התואמים לחיפוש “{query}”.</p>
            <button type="button" onClick={() => setQuery('')} style={{ height: 38, padding: '0 16px', border: '1px solid var(--border-input)', borderRadius: 9, background: 'var(--paper)', color: 'var(--text-2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>ניקוי החיפוש</button>
          </div>
        )}

        {!patientsEmpty && rows.map((p: any) => (
          <div
            key={p.id}
            className="pat-row"
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 22px', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
          >
            <button
              type="button"
              onClick={p.onOpen}
              aria-label={p.name}
              style={{ border: 'none', background: 'none', padding: 0, margin: 0, font: 'inherit', color: 'inherit', textAlign: 'start', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}
            >
              <span style={{ width: 44, height: 44, borderRadius: '50%', background: p.avBg, color: p.avColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{p.initials}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><Highlight text={p.name} query={query} /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span dir="ltr" style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'start' }}>{p.phone}</span>
                  {p.nextMeeting ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-tint)', borderRadius: 20, padding: '2px 9px' }}>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" /></svg>
                      {p.nextMeeting}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>אין פגישה מתוכננת</span>
                  )}
                </div>
              </div>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button onClick={p.onEdit} aria-label="עריכת מטופל" title="עריכת מטופל" className="pat-icon-btn tap44" style={{ width: 34, height: 34, border: '1px solid var(--divider)', borderRadius: 8, background: 'var(--paper)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" /></svg>
              </button>
              <button onClick={p.onDelete} aria-label="העברה לארכיון" title="העברה לארכיון" className="pat-archive-btn tap44" style={{ width: 34, height: 34, border: '1px solid var(--divider)', borderRadius: 8, background: 'var(--paper)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z" /></svg>
              </button>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--text-muted)" style={{ flexShrink: 0 }}><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
