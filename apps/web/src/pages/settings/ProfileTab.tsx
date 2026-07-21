// Settings · Profile tab — name, email, phone, and Google connection status.
import React, { useRef, useState } from 'react';
import { useApp } from '../../store/AppStore';
import { EMAIL_RE } from '../../utils';
import { restoreSession } from '../../services/mockAuth';
import { isApiConfigured } from '../../services/apiClient';
import { fetchProfile, updateProfile } from '../../services/profile';
import { labelStyle } from '../../utils/styles';
import { downloadTextFile } from '../../utils/download';

const inputStyle: React.CSSProperties = { width: '100%', height: 44, border: '1px solid var(--border-input)', borderRadius: 10, padding: '0 12px', fontSize: 14.5, outline: 'none' };
const ltrInputStyle: React.CSSProperties = { ...inputStyle, textAlign: 'start' };

export default function ProfileTab() {
  const { S, set, toast } = useApp();
  const PS = S.profile;
  const PD = S.profileDraft;
  const setPD = (patch: any) => set((s: any) => ({ profileDraft: { ...s.profileDraft, ...patch } }));

  // Load the real therapist profile into the store when wired to a backend, so the
  // fields reflect the account (demo mode keeps the seeded profile). Runs once.
  const apiMode = isApiConfigured();
  React.useEffect(() => {
    if (!apiMode) return undefined;
    const ac = new AbortController();
    fetchProfile(ac.signal)
      .then((p) => {
        const mapped = {
          name: p.full_name ?? '', email: p.email, phone: p.phone ?? '', title: p.title ?? '',
          gender: p.gender ?? '', license: p.license_number ?? '', org: p.org ?? '', bio: p.bio ?? '',
        };
        set((s: any) => ({ profile: { ...s.profile, ...mapped }, profileDraft: { ...s.profileDraft, ...mapped } }));
      })
      .catch(() => { /* keep the seeded profile */ });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiMode]);

  const nameErr = !String(PD.name || '').trim() ? 'יש להזין שם מלא' : '';
  const emailErr = !String(PD.email || '').trim() ? 'יש להזין כתובת דוא״ל' : (!EMAIL_RE.test(String(PD.email).trim()) ? 'כתובת דוא״ל לא תקינה' : '');
  const valid = !nameErr && !emailErr;
  const dirty = JSON.stringify({ name: PD.name, email: PD.email, phone: PD.phone }) !== JSON.stringify({ name: PS.name, email: PS.email, phone: PS.phone });
  const showName = S.profileSaveTried && !!nameErr;
  const showEmail = S.profileSaveTried && !!emailErr;

  const session = restoreSession();
  const googleConnected = !!(session && 'user' in session && session.user.provider === 'google');
  const googleLabel = googleConnected ? 'מחובר' : 'לא מחובר';
  const googleDetail = googleConnected && session && 'user' in session ? session.user.email : 'התחברות עם Google לא פעילה';

  // Full data export — the exact persisted record (the app's single source of
  // persisted truth), pretty-printed. Dated filename; canonical download path.
  const exportData = () => {
    let raw: string | null = null;
    try { raw = localStorage.getItem('sensei_session_react_v1'); } catch { /* storage unavailable */ }
    if (!raw) { toast('אין עדיין נתונים שמורים לייצוא', 'info'); return; }
    let pretty = raw;
    try { pretty = JSON.stringify(JSON.parse(raw), null, 2); } catch { /* export as-is */ }
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    downloadTextFile('sensei-data-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '.json', pretty);
    toast('הנתונים יוצאו לקובץ JSON');
  };

  // Restore from a backup file — the counterpart of the export above. Two-step:
  // pick a file, validate it is a Sensei backup, then require an explicit
  // confirmation (it replaces the data on this device) before writing and
  // rehydrating through the normal restore path (a full reload, so migrations
  // and normalization run exactly as on any startup).
  const importInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    const fr = new FileReader();
    fr.onerror = () => toast('לא ניתן היה לקרוא את הקובץ', 'error');
    fr.onload = () => {
      try {
        const parsed = JSON.parse(String(fr.result).replace(/^\uFEFF/, ''));
        const looksLikeBackup = parsed && typeof parsed === 'object'
          && (Array.isArray(parsed.patients) || typeof parsed.__savedAt === 'number');
        if (!looksLikeBackup) { toast('הקובץ אינו גיבוי של סנסיי', 'error'); return; }
        setPendingImport(JSON.stringify(parsed));
      } catch { toast('הקובץ אינו קובץ JSON תקין', 'error'); }
    };
    fr.readAsText(file);
  };
  const confirmImport = () => {
    if (!pendingImport) return;
    try { localStorage.setItem('sensei_session_react_v1', pendingImport); } catch { toast('שמירת הגיבוי נכשלה במכשיר זה', 'error'); return; }
    setPendingImport(null);
    window.location.reload();
  };

  const saveProfile = () => {
    if (!valid) { set({ profileSaveTried: true }); toast('יש לתקן את השדות המסומנים', 'error'); return; }
    if (!dirty) return;
    const clean = {
      ...PS,
      name: String(PD.name).trim(),
      email: String(PD.email).trim(),
      phone: String(PD.phone || '').trim(),
    };
    set({ profile: clean, profileDraft: clean, profileSaveTried: false });
    if (apiMode) updateProfile({ full_name: clean.name, phone: clean.phone }).catch(() => { /* optimistic */ });
    toast('הפרופיל עודכן ונשמר');
  };
  const discardProfile = () => {
    if (!dirty) return;
    set({ profileDraft: { ...PS }, profileSaveTried: false });
    toast('השינויים בוטלו', 'info');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 22 }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 18, fontWeight: 700 }}>פרופיל</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13.5 }}>פרטי הקשר שלכם במערכת</p>
        </div>
        {dirty && (
          <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--warning-strong)', background: 'var(--warning-bg)', padding: '5px 11px', borderRadius: 20, whiteSpace: 'nowrap' }}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--warning-strong)' }}></span>
            שינויים לא שמורים
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }} className="rx-2to1">
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>שם מלא</label>
          <input value={PD.name} onChange={(e) => setPD({ name: e.target.value })} aria-label="שם מלא" className="set-input" style={{ ...inputStyle, border: `1px solid ${showName ? 'var(--error)' : 'var(--primary-border)'}` }} />
          {showName && <div role="alert" style={{ marginTop: 6, fontSize: 12.5, color: 'var(--error)', fontWeight: 600 }}>{nameErr}</div>}
        </div>
        <div>
          <label style={labelStyle}>דוא״ל</label>
          <input value={PD.email} onChange={(e) => setPD({ email: e.target.value })} aria-label="דוא״ל" dir="ltr" className="set-input" style={{ ...ltrInputStyle, border: `1px solid ${showEmail ? 'var(--error)' : 'var(--primary-border)'}` }} />
          {showEmail && <div role="alert" style={{ marginTop: 6, fontSize: 12.5, color: 'var(--error)', fontWeight: 600 }}>{emailErr}</div>}
        </div>
        <div>
          <label style={labelStyle}>טלפון</label>
          <input value={PD.phone} onChange={(e) => setPD({ phone: e.target.value })} aria-label="טלפון" dir="ltr" className="set-input" style={ltrInputStyle} />
        </div>
        <div>
          {/* "לשון פנייה" · the single source of truth the Hebrew grammar layer (window.HG)
              resolves every gendered string against. State-driven, so all personalized
              copy updates live, without a reload. */}
          <label style={labelStyle}>לשון פנייה</label>
          <select value={PD.gender || ''} onChange={(e) => setPD({ gender: e.target.value })} aria-label="לשון פנייה" className="app-select" style={{ width: '100%' }}>
            <option value="f">לשון נקבה</option>
            <option value="m">לשון זכר</option>
          </select>
        </div>
      </div>

      <div style={{ border: '1px solid var(--divider)', borderRadius: 12, overflow: 'hidden', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 16px' }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>חשבון Google</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }} dir="ltr">{googleDetail}</div>
          </div>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap',
            background: googleConnected ? 'var(--success-bg)' : 'var(--surface-2)',
            color: googleConnected ? 'var(--success)' : 'var(--text-secondary)',
          }}>{googleLabel}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={saveProfile} style={{ height: 44, padding: '0 22px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14.5, fontWeight: 700, cursor: dirty && valid ? 'pointer' : 'not-allowed', opacity: dirty && valid ? '1' : '.55', fontFamily: 'inherit' }}>שמירת שינויים</button>
        <button onClick={discardProfile} className="set-hov-border-sec" style={{ height: 44, padding: '0 18px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', color: 'var(--text-2)', fontSize: 14, fontWeight: 600, cursor: dirty ? 'pointer' : 'not-allowed', opacity: dirty ? '1' : '.45', fontFamily: 'inherit' }}>ביטול שינויים</button>
      </div>

      <div style={{ marginTop: 36, paddingTop: 24, borderTop: '1px solid var(--divider)' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.04em', marginBottom: 10 }}>הנתונים שלך</div>
        <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>הורדת עותק מלא של הנתונים השמורים במכשיר זה (מטופלים, פגישות, הערות והעדפות) כקובץ JSON.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={exportData} className="set-hov-border-sec" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', color: 'var(--text-2)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /></svg>
            ייצוא הנתונים
          </button>
          <button onClick={() => importInputRef.current?.click()} className="set-hov-border-sec" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', color: 'var(--text-2)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M5 15h4v6h6v-6h4l-7-7-7 7zM5 4v2h14V4H5z" /></svg>
            שחזור מגיבוי
          </button>
          <input ref={importInputRef} type="file" accept=".json,application/json" onChange={onImportFile} aria-label="בחירת קובץ גיבוי לשחזור" style={{ display: 'none' }} />
        </div>
        {pendingImport && (
          <div role="alertdialog" aria-label="אישור שחזור מגיבוי" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'var(--warning-bg)', border: '1px solid var(--primary-border)', borderRadius: 10, padding: '12px 14px' }}>
            <span style={{ flex: 1, minWidth: 200, fontSize: 13.5, fontWeight: 600, color: 'var(--text-2)', lineHeight: 1.5 }}>השחזור יחליף את כל הנתונים השמורים במכשיר זה בתוכן הגיבוי. להמשיך?</span>
            <button onClick={confirmImport} style={{ height: 36, padding: '0 16px', border: 'none', borderRadius: 8, background: 'var(--primary)', color: 'var(--paper)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>שחזור והחלפה</button>
            <button onClick={() => setPendingImport(null)} style={{ height: 36, padding: '0 14px', border: '1px solid var(--border-input)', borderRadius: 8, background: 'var(--paper)', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>ביטול</button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 36, paddingTop: 24, borderTop: '1px solid var(--divider)' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.04em', marginBottom: 10 }}>אזור מסוכן</div>
        <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>מחיקת החשבון תסיר לצמיתות את פרטי ההתחברות, המטופלים והנתונים השמורים במכשיר זה.</p>
        <button onClick={() => set({ dialog: 'deleteAccount' })} className="set-hov-danger" style={{ height: 42, padding: '0 18px', border: '1px solid var(--error-border, var(--error))', borderRadius: 10, background: 'var(--paper)', color: 'var(--error-dark)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>מחיקת חשבון</button>
      </div>
    </div>
  );
}
