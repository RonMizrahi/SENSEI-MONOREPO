// Per-patient Documents — the clinical letter (built-in) plus uploaded files.
// Client-only demo: metadata is persisted (documentsByPatient); the bytes of
// small files are kept as a data URI so Download works, larger files store
// metadata only (real storage is backend scope). Supports add / categorize /
// download / delete, and a filter once the list grows.
import { useState } from 'react';
import { useApp } from '../../store/AppStore';
import { CARD_SHADOW } from '../../utils/styles';
import { normHe } from '../../utils/search';

export const DOC_CATEGORIES = ['מכתב קליני', 'הפניה', 'טופס', 'סיכום', 'אחר'];
const MAX_INLINE_BYTES = 512 * 1024; // keep bytes only for small files

interface PatientDoc { id: string; name: string; category: string; addedAt: string; size: number; dataUrl?: string }

export default function PatientDocuments({ patientId }: { patientId: string }) {
  const { S, set, navigate, toast } = useApp();
  const docs: PatientDoc[] = (S.documentsByPatient || {})[patientId] || [];
  const [query, setQuery] = useState('');

  const writeDocs = (next: PatientDoc[]) => set({ documentsByPatient: { ...(S.documentsByPatient || {}), [patientId]: next } });
  const goLetter = () => navigate('letter', { patientId });

  const addDoc = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.txt';
    inp.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const commit = (dataUrl?: string) => {
        writeDocs([{ id: 'doc-' + Date.now(), name: file.name, category: 'אחר', addedAt: new Date().toISOString(), size: file.size, dataUrl }, ...docs]);
        toast('המסמך נוסף');
      };
      if (file.size <= MAX_INLINE_BYTES) {
        const r = new FileReader();
        r.onload = () => commit(typeof r.result === 'string' ? r.result : undefined);
        r.onerror = () => commit();
        r.readAsDataURL(file);
      } else commit();
    };
    inp.click();
  };

  const download = (doc: PatientDoc) => {
    if (!doc.dataUrl) { toast('הקובץ אינו זמין להורדה בהדגמה · יסונכרן מהשרת', 'info'); return; }
    const a = document.createElement('a');
    a.href = doc.dataUrl; a.download = doc.name; a.click();
  };
  const setCategory = (id: string, category: string) => writeDocs(docs.map((d) => d.id === id ? { ...d, category } : d));
  const remove = (id: string) => { writeDocs(docs.filter((d) => d.id !== id)); toast('המסמך נמחק', 'info'); };

  const q = normHe(query.trim());
  const filtered = q ? docs.filter((d) => normHe(d.name).includes(q) || normHe(d.category).includes(q)) : docs;

  const chip = (label: string) => (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
  );

  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>מסמכים</h2>
        <button type="button" onClick={addDoc} aria-label="העלאת מסמך" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 11px', border: '1px solid var(--border-input)', borderRadius: 8, background: 'var(--paper)', color: 'var(--primary)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" /></svg>
          העלאת מסמך
        </button>
      </div>

      {docs.length > 3 && (
        <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="חיפוש במסמכים" placeholder="חיפוש מסמך…" style={{ width: '100%', height: 36, border: '1px solid var(--primary-border)', borderRadius: 8, padding: '0 11px', fontSize: 13, outline: 'none', marginBottom: 10, fontFamily: 'inherit', background: 'var(--primary-surface)', color: 'var(--text)' }} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Built-in clinical letter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line)', borderRadius: 9, padding: '9px 11px' }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--primary)" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" /></svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>מכתב קליני</div>
          </div>
          {chip('מכתב קליני')}
          <button type="button" onClick={goLetter} aria-label="פתיחת המכתב הקליני" title="פתיחה" style={{ height: 28, padding: '0 10px', border: '1px solid var(--primary-border)', borderRadius: 7, background: 'var(--primary-surface)', color: 'var(--primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>פתיחה</button>
        </div>

        {filtered.map((doc) => (
          <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line)', borderRadius: 9, padding: '9px 11px' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--text-muted)" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" /></svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={doc.name}>{doc.name}</div>
            </div>
            <select value={doc.category} onChange={(e) => setCategory(doc.id, e.target.value)} aria-label={'קטגוריה · ' + doc.name} style={{ height: 26, border: '1px solid var(--primary-border)', borderRadius: 7, background: 'var(--primary-surface)', color: 'var(--text-2)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0, maxWidth: 84 }}>
              {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="button" onClick={() => download(doc)} aria-label={'הורדת ' + doc.name} title="הורדה" style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-input)', borderRadius: 7, background: 'var(--paper)', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /></svg>
            </button>
            <button type="button" onClick={() => remove(doc.id)} aria-label={'מחיקת ' + doc.name} title="מחיקה" style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--divider)', borderRadius: 7, background: 'var(--paper)', color: 'var(--error)', cursor: 'pointer', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
            </button>
          </div>
        ))}

        {q && filtered.length === 0 && (
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>לא נמצאו מסמכים התואמים לחיפוש.</p>
        )}
      </div>
    </div>
  );
}
