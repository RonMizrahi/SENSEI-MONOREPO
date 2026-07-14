// Patients list — patient roster.
import { useApp } from '../store/AppStore';
import { avatarColors } from '../utils';
import {
  patientInitials, patientAvatarColor, formatPatientSince, displayPatientEmail,
} from '../services/patients';
import './patients.css';
import { CARD_SHADOW } from '../utils/styles';

export default function PatientsPage() {
  const { S, set, navigate } = useApp();

  const openCreatePatient = () => set({
    dialog: 'create', form: { name: '', phone: '', email: '' },
    errors: {},
  });

  let filtered: any[] = S.demoEmpty ? [] : S.patients;

  const sortBy = S.sortBy;
  if (sortBy === 'name' || sortBy === 'relevance') filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'he'));
  else if (sortBy === 'recent') filtered = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const patientCountLabel = S.patients.length + ' מטופלים פעילים';

  const rows = filtered.map((p: any) => {
    const color = patientAvatarColor(p.id);
    const a = avatarColors(color);
    const open = () => navigate('patient', { patientId: p.id });
    return {
      ...p, avBg: a.bg, avColor: a.color, initials: patientInitials(p.name),
      meta: p.phone + ' · ' + displayPatientEmail(p.email),
      since: formatPatientSince(p.created_at),
      onOpen: open,
      onEdit: (e: any) => {
        e.stopPropagation();
        set({
          dialog: 'edit', dialogPatientId: p.id,
          form: { name: p.name, phone: p.phone, email: p.email || '' },
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

      <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
        {patientsEmpty && (
          <div style={{ padding: '52px 24px', textAlign: 'center' }}>
            <img src="/assets/sensei-fan.png" alt="" aria-hidden="true" width={140} height={108} style={{ display: 'block', margin: '0 auto 16px', objectFit: 'contain', opacity: 0.8 }} />
            <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 700 }}>אין מטופלים עדיין</h2>
            <p style={{ margin: '0 auto 20px', color: 'var(--text-secondary)', fontSize: 14.5, maxWidth: 420 }}>הוסיפו את המטופל הראשון שלכם כדי להתחיל לנהל פגישות ותובנות.</p>
            <button onClick={openCreatePatient} className="pat-new-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 44, padding: '0 20px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--on-accent)"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>מטופל חדש
            </button>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 3 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{p.name}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.meta} · מאז {p.since}</div>
              </div>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button onClick={p.onEdit} aria-label="עריכת מטופל" title="עריכת מטופל" className="pat-icon-btn" style={{ width: 34, height: 34, border: '1px solid var(--divider)', borderRadius: 8, background: 'var(--paper)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" /></svg>
              </button>
              <button onClick={p.onDelete} aria-label="העברה לארכיון" title="העברה לארכיון" className="pat-archive-btn" style={{ width: 34, height: 34, border: '1px solid var(--divider)', borderRadius: 8, background: 'var(--paper)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
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
