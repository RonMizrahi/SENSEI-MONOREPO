// "שאל את סנסיי" AI assistant panel + floating action button.
// Ported from the prototype overlays + its aiSend/aiTyping/aiAnswer view model.
// The assistant is a demo: deterministic canned answers, no network — engineered
// like any unreliable dependency (typing delay, transparent disclaimer).
import { useEffect, useRef } from 'react';
import { useApp } from '../../store/AppStore';

// Deterministic canned answers — ported verbatim from the prototype's aiAnswer().
function aiAnswer(q: string): string {
  const t = q || '';
  if (t.includes('סיכון גבוה') || t.includes('מי המטופלים')) return 'כרגע שלושה מטופלים מסומנים בסיכון גבוה: מיכל כהן (PTSD), נועה שפירא (הפרעת אכילה) ואבי פרץ במעקב. מומלץ לתעדף את מיכל ונועה. בשתיהן זוהתה עלייה בסימני מצוקה בפגישה האחרונה.';
  if (t.includes('מיכל')) return 'אצל מיכל כהן נצפתה לאחרונה עלייה בתסמיני הימנעות וערנות יתר. רמת הסיכון המוערכת עלתה בפגישה האחרונה. כדאי להתמקד בביסוס תחושת ביטחון ובטכניקות הארקה (grounding).';
  if (t.includes('דנה')) return 'לקראת הפגישה הבאה עם דנה לוי: לחזק את חוויית ההצלחה מההצגה בעבודה, לחבר אותה לתחושת מסוגלות כללית, ולהציע משימת חשיפה הדרגתית נוספת ברמת קושי בינונית. שווה גם לבדוק את איכות השינה.';
  if (t.includes('שינה')) return 'נושא השינה חוזר אצל מספר מטופלים סביב תקופות לחץ. אצל דנה ומיכל הוא קשור ישירות לאירועים מלחיצים. כדאי לשקול תרגול היגיינת שינה ותיעוד יומן שינה קצר.';
  return 'על סמך הסיכומים שנותחו, המגמה הכללית יציבה עם מוקדי תשומת לב בודדים. אפשר לשאול אותי על מטופל ספציפי, על מי שבסיכון גבוה, או מה כדאי להכין לפגישה הקרובה.';
}

export default function AiAssistant() {
  const { S, set } = useApp();
  const aiTimer = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // keep the conversation pinned to the latest message
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [S.aiMessages, S.aiTyping, S.aiOpen]);

  // focus the message input when the panel opens, so keyboard users can type
  // immediately (matches the command palette). Non-modal, so no focus trap.
  useEffect(() => {
    if (S.aiOpen) inputRef.current?.focus();
  }, [S.aiOpen]);

  useEffect(() => () => clearTimeout(aiTimer.current), []);

  const sendAI = (text: string) => {
    const q = (text || '').trim();
    if (!q) return;
    set((s: any) => ({ aiMessages: [...s.aiMessages, { role: 'me', text: q }], aiInput: '', aiTyping: true }));
    clearTimeout(aiTimer.current);
    aiTimer.current = setTimeout(() => {
      set((s: any) => ({ aiMessages: [...s.aiMessages, { role: 'ai', text: aiAnswer(q) }], aiTyping: false }));
    }, 900);
  };

  const closeAI = () => set({ aiOpen: false });
  const openAI = () => set({ aiOpen: true });

  const suggestions = [
    { label: 'מי המטופלים בסיכון גבוה?', q: 'מי המטופלים בסיכון גבוה?' },
    { label: 'סכם את המגמה של מיכל כהן', q: 'סכם את המגמה של מיכל כהן' },
    { label: 'מה כדאי להכין לפגישה עם דנה?', q: 'מה כדאי להכין לפגישה עם דנה?' },
  ];

  if (!S.aiOpen) {
    return (
      <button onClick={openAI} aria-label="שאל את סנסיי" title="שאל את סנסיי" className="shell-fab" style={{ position: 'fixed', bottom: 24, insetInlineEnd: 24, width: 60, height: 60, padding: 0, border: '2px solid var(--primary)', borderRadius: '50%', background: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 10px 28px rgba(31,99,214,.4)', zIndex: 140, transition: 'box-shadow .18s ease,transform .18s ease' }}>
        <img src="/assets/sensei-mark.png" alt="" aria-hidden="true" width={60} height={60} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%' }} />
      </button>
    );
  }

  const messages = S.aiMessages.map((m: any) => {
    const me = m.role === 'me';
    return { text: m.text, me, justify: me ? 'flex-end' : 'flex-start', bubble: me ? 'var(--primary)' : 'var(--surface-2)', color: me ? 'var(--paper)' : 'var(--text)', border: me ? 'var(--primary)' : 'var(--divider)' };
  });

  return (
    <div role="dialog" aria-label="שאל את סנסיי" style={{ position: 'fixed', bottom: 24, insetInlineEnd: 24, width: 390, maxWidth: 'calc(100vw - 48px)', height: '72vh', maxHeight: 620, background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 18, boxShadow: '0 24px 70px rgba(8,20,40,.3)', zIndex: 150, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'pop .22s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '16px 18px', borderBottom: '1px solid var(--line)', background: 'linear-gradient(120deg,var(--accent-grad-1),var(--accent-grad-2))' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          <img src="/assets/sensei-mark.png" alt="" aria-hidden="true" width={38} height={38} style={{ width: 38, height: 38, objectFit: 'cover', objectPosition: '50% 20%' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'var(--on-accent)', fontSize: 15.5, fontWeight: 800, lineHeight: 1.1 }}>שאל את סנסיי</div>
          <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 11.5 }}>עוזר AI · מבוסס על הסיכומים שלכם</div>
        </div>
        <svg onClick={closeAI} role="button" tabIndex={0} aria-label="סגירה" viewBox="0 0 24 24" width="22" height="22" fill="rgba(255,255,255,.9)" style={{ cursor: 'pointer' }}><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
      </div>

      <div ref={scrollRef} id="ai-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m: any, i: number) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.justify }}>
            <div style={{ maxWidth: '84%', background: m.bubble, color: m.color, border: '1px solid ' + m.border, borderRadius: 10, padding: '11px 14px', fontSize: 14, lineHeight: 1.6 }}>{m.text}</div>
          </div>
        ))}
        {S.aiTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--divider)', borderRadius: 10, padding: '13px 16px', display: 'flex', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-muted)', animation: 'pulse 1s ease-in-out infinite' }} />
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-muted)', animation: 'pulse 1s ease-in-out .2s infinite' }} />
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-muted)', animation: 'pulse 1s ease-in-out .4s infinite' }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '10px 14px 6px', display: 'flex', gap: 7, flexWrap: 'wrap', borderTop: '1px solid var(--line)' }}>
        {suggestions.map((sg) => (
          <a key={sg.q} onClick={() => sendAI(sg.q)} className="shell-ai-chip" style={{ fontSize: 12, padding: '6px 11px', border: '1px solid var(--primary-border)', borderRadius: 18, color: 'var(--primary)', background: 'var(--primary-surface)', cursor: 'pointer', fontWeight: 600 }}>{sg.label}</a>
        ))}
      </div>

      <div style={{ padding: '10px 14px 14px', display: 'flex', gap: 9, alignItems: 'center' }}>
        <input ref={inputRef} value={S.aiInput || ''} onInput={(e: any) => set({ aiInput: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAI(S.aiInput); } }} aria-label="הקלדת שאלה" placeholder="כתבו שאלה…" className="shell-input" style={{ flex: 1, height: 44, border: '1px solid var(--border-input)', borderRadius: 10, padding: '0 14px', fontSize: 14, outline: 'none' }} />
        <button onClick={() => sendAI(S.aiInput)} aria-label="שליחה" className="shell-send" style={{ width: 44, height: 44, border: 'none', borderRadius: 10, background: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--on-accent)" style={{ transform: 'scaleX(-1)' }}><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
        </button>
      </div>
      <div style={{ padding: '0 16px 12px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>סנסיי מבוסס על סיכומים שנותחו ועשוי לטעות · אינו תחליף לשיקול דעת קליני</div>
    </div>
  );
}
