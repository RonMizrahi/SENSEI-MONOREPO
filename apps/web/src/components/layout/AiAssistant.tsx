// "שאל את סנסיי" AI assistant panel + floating action button.
//
// Two modes, chosen once at mount by whether a backend is configured:
// - Live (VITE_API_BASE_URL set): streams answers from the senseiapi /assistant/chat
//   endpoint via @ai-sdk/react's useChat (Vercel AI-SDK UI message stream).
// - Demo (no backend): deterministic canned answers, no network — the original mock,
//   kept so the client-only build and offline/CI runs behave exactly as before.
// Both render the same presentational panel; the disclaimer stays either way.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, getToolName, isTextUIPart, isToolUIPart, type UIMessage } from 'ai';
import { useApp } from '../../store/AppStore';
import { API_BASE_URL, isApiConfigured } from '../../services/apiClient';
import { getApiAccessToken } from '../../services/apiAuth';

// One tool call as the panel shows it: a 1-line label that expands to the full
// request/response of what the assistant fetched from the backend.
interface ToolView {
  id: string
  label: string
  input: unknown
  output: unknown
  done: boolean
}

// A message as the panel renders it: which side, its text, and any tool calls.
interface PanelMessage {
  me: boolean
  text: string
  tools?: ToolView[]
}

// The subset of an AI-SDK tool part we read (its typed shape varies by state).
interface ToolPartLike {
  toolCallId: string
  state?: string
  input?: unknown
  output?: unknown
}

// Turn a UIMessage's tool parts into 1-line views. discover_api → "גילוי כלים";
// http_get → "קריאה ל-API · <path>" so the therapist sees exactly what was fetched.
function toolViews(message: UIMessage): ToolView[] {
  return message.parts.filter(isToolUIPart).map((part) => {
    const name = getToolName(part);
    const p = part as unknown as ToolPartLike;
    const path =
      p.input && typeof p.input === 'object' ? (p.input as { path?: string }).path : undefined;
    const label =
      name === 'http_get' && path
        ? `קריאה ל-API · ${path}`
        : name === 'discover_api'
          ? 'גילוי כלים זמינים'
          : `כלי · ${name}`;
    return { id: p.toolCallId, label, input: p.input, output: p.output, done: p.state === 'output-available' };
  });
}

const SUGGESTIONS = [
  { label: 'מה יש לי ביומן היום?', q: 'מה יש לי ביומן היום?' },
  { label: 'מתי נפגשתי לאחרונה עם סימבה?', q: 'מתי נפגשתי לאחרונה עם סימבה?' },
  { label: 'סכמו את הפגישה האחרונה עם סימבה', q: 'סכמו את הפגישה האחרונה עם סימבה' },
];

// Deterministic canned answers — ported verbatim from the prototype's aiAnswer().
function aiAnswer(q: string): string {
  const t = q || '';
  if (t.includes('סיכון גבוה') || t.includes('מי המטופלים')) return 'כרגע שלושה מטופלים מסומנים בסיכון גבוה: מיכל כהן (PTSD), נועה שפירא (הפרעת אכילה) ואבי פרץ במעקב. מומלץ לתעדף את מיכל ונועה. בשתיהן זוהתה עלייה בסימני מצוקה בפגישה האחרונה.';
  if (t.includes('מיכל')) return 'אצל מיכל כהן נצפתה לאחרונה עלייה בתסמיני הימנעות וערנות יתר. רמת הסיכון המוערכת עלתה בפגישה האחרונה. כדאי להתמקד בביסוס תחושת ביטחון ובטכניקות הארקה (grounding).';
  if (t.includes('דנה')) return 'לקראת הפגישה הבאה עם דנה לוי: לחזק את חוויית ההצלחה מההצגה בעבודה, לחבר אותה לתחושת מסוגלות כללית, ולהציע משימת חשיפה הדרגתית נוספת ברמת קושי בינונית. שווה גם לבדוק את איכות השינה.';
  if (t.includes('שינה')) return 'נושא השינה חוזר אצל מספר מטופלים סביב תקופות לחץ. אצל דנה ומיכל הוא קשור ישירות לאירועים מלחיצים. כדאי לשקול תרגול היגיינת שינה ותיעוד יומן שינה קצר.';
  return 'על סמך הסיכומים שנותחו, המגמה הכללית יציבה עם מוקדי תשומת לב בודדים. אפשר לשאול אותי על מטופל ספציפי, על מי שבסיכון גבוה, או מה כדאי להכין לפגישה הקרובה.';
}

// The visible text of a UIMessage is the concatenation of its text parts.
function messageText(message: UIMessage): string {
  return message.parts.filter(isTextUIPart).map((part) => part.text).join('');
}

// Turn `#/patient/<id>` deep links the assistant may include into clickable links
// to the patient's card (the app navigates on hash change). The raw id/URL stays in
// the href only — the visible label is friendly, so no bare id is shown as text.
const PATIENT_LINK_RE = /#\/patient\/[A-Za-z0-9_-]+/g;

function linkifyPatientLinks(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(PATIENT_LINK_RE)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    nodes.push(
      <a key={key++} href={match[0]} className="shell-ai-link" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}>פתיחת הכרטיס</a>,
    );
    last = start + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length ? nodes : text;
}

export default function AiAssistant() {
  // The backend is either configured for the whole session or not, so choosing the
  // mode at a component boundary keeps hook order stable in both branches.
  return isApiConfigured() ? <LiveAssistant /> : <MockAssistant />;
}

// --- Live mode: stream from the backend via useChat ------------------------------

function LiveAssistant() {
  const { S, set, toast } = useApp();
  const [input, setInput] = useState('');
  // Seed the conversation once with whatever is already persisted (the greeting on
  // first run); lazy init so it does not re-read the store on every render.
  const [initialMessages] = useState(() => storeToUiMessages(S.aiMessages));

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_BASE_URL}/assistant/chat`,
        credentials: 'omit',
        // Bearer token when the backend enforces auth; absent in the open dev default.
        headers: (): Record<string, string> => {
          const token = getApiAccessToken();
          const h: Record<string, string> = {};
          if (token) h.Authorization = `Bearer ${token}`;
          return h;
        },
      }),
    [],
  );

  const { messages, sendMessage, status } = useChat({
    id: 'sensei-assistant',
    messages: initialMessages,
    transport,
    onError: () => toast('לא הצלחנו לקבל תשובה מסנסיי כרגע. נסו שוב.', 'error'),
    // Persist the finished transcript so it survives a reload (as the demo mode does).
    onFinish: ({ messages: final }) => set({ aiMessages: uiToStoreMessages(final) }),
  });

  const panelMessages: PanelMessage[] = messages.map((m) => ({
    me: m.role === 'user',
    text: messageText(m),
    tools: m.role === 'user' ? undefined : toolViews(m),
  }));
  // Show the typing dots while waiting, and until the first streamed token arrives.
  const lastText = panelMessages.length ? panelMessages[panelMessages.length - 1] : null;
  const typing = status === 'submitted' || (status === 'streaming' && (!lastText || lastText.me || !lastText.text));

  const onSend = (text: string) => {
    const q = (text || '').trim();
    if (!q || status === 'submitted' || status === 'streaming') return;
    setInput('');
    void sendMessage({ text: q });
  };

  return (
    <AiPanel
      open={S.aiOpen}
      onOpen={() => set({ aiOpen: true })}
      onClose={() => set({ aiOpen: false })}
      messages={panelMessages}
      typing={typing}
      input={input}
      onInput={setInput}
      onSend={onSend}
    />
  );
}

function storeToUiMessages(stored: { role: string; text: string }[]): UIMessage[] {
  return (stored || []).map((m, i) => ({
    id: `seed-${i}`,
    role: m.role === 'me' ? 'user' : 'assistant',
    parts: [{ type: 'text', text: m.text }],
  }));
}

function uiToStoreMessages(messages: UIMessage[]): { role: 'me' | 'ai'; text: string }[] {
  return messages.map((m) => ({ role: m.role === 'user' ? 'me' : 'ai', text: messageText(m) }));
}

// --- Demo mode: the original canned assistant, unchanged in behaviour ------------

function MockAssistant() {
  const { S, set } = useApp();
  const aiTimer = useRef<any>(null);

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

  const messages: PanelMessage[] = S.aiMessages.map((m: any) => ({ me: m.role === 'me', text: m.text }));

  return (
    <AiPanel
      open={S.aiOpen}
      onOpen={() => set({ aiOpen: true })}
      onClose={() => set({ aiOpen: false })}
      messages={messages}
      typing={S.aiTyping}
      input={S.aiInput || ''}
      onInput={(v) => set({ aiInput: v })}
      onSend={sendAI}
    />
  );
}

// --- Presentational panel (shared by both modes) ---------------------------------

interface AiPanelProps {
  open: boolean
  onOpen: () => void
  onClose: () => void
  messages: PanelMessage[]
  typing: boolean
  input: string
  onInput: (value: string) => void
  onSend: (text: string) => void
}

function AiPanel({ open, onOpen, onClose, messages, typing, input, onInput, onSend }: AiPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // keep the conversation pinned to the latest message
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing, open]);

  // focus the message input when the panel opens, so keyboard users can type
  // immediately (matches the command palette). Non-modal, so no focus trap.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <button onClick={onOpen} aria-label="שאל את סנסיי" title="שאל את סנסיי" className="shell-fab" style={{ position: 'fixed', bottom: 24, insetInlineEnd: 24, width: 60, height: 60, padding: 0, border: '2px solid var(--primary)', borderRadius: '50%', background: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 10px 28px rgba(31,99,214,.4)', zIndex: 140, transition: 'box-shadow .18s ease,transform .18s ease' }}>
        <img src="/assets/sensei-mark.png" alt="" aria-hidden="true" width={60} height={60} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%' }} />
      </button>
    );
  }

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
        <svg onClick={onClose} role="button" tabIndex={0} aria-label="סגירה" viewBox="0 0 24 24" width="22" height="22" fill="rgba(255,255,255,.9)" style={{ cursor: 'pointer' }}><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
      </div>

      <div ref={scrollRef} id="ai-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {m.tools?.map((t) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <ToolCallChip tool={t} />
              </div>
            ))}
            {m.text && (
              <div style={{ display: 'flex', justifyContent: m.me ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '84%', background: m.me ? 'var(--primary)' : 'var(--surface-2)', color: m.me ? 'var(--paper)' : 'var(--text)', border: '1px solid ' + (m.me ? 'var(--primary)' : 'var(--divider)'), borderRadius: 10, padding: '11px 14px', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.me ? m.text : linkifyPatientLinks(m.text)}</div>
              </div>
            )}
          </div>
        ))}
        {typing && (
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
        {SUGGESTIONS.map((sg) => (
          <a key={sg.q} onClick={() => onSend(sg.q)} className="shell-ai-chip" style={{ fontSize: 12, padding: '6px 11px', border: '1px solid var(--primary-border)', borderRadius: 18, color: 'var(--primary)', background: 'var(--primary-surface)', cursor: 'pointer', fontWeight: 600 }}>{sg.label}</a>
        ))}
      </div>

      <div style={{ padding: '10px 14px 14px', display: 'flex', gap: 9, alignItems: 'center' }}>
        <input ref={inputRef} value={input} onInput={(e: any) => onInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(input); } }} aria-label="הקלדת שאלה" placeholder="כתבו שאלה…" className="shell-input" style={{ flex: 1, height: 44, border: '1px solid var(--primary-border)', borderRadius: 10, padding: '0 14px', fontSize: 14, outline: 'none' }} />
        <button onClick={() => onSend(input)} aria-label="שליחה" className="shell-send" style={{ width: 44, height: 44, border: 'none', borderRadius: 10, background: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--on-accent)" style={{ transform: 'scaleX(-1)' }}><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
        </button>
      </div>
      <div style={{ padding: '0 16px 12px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>סנסיי מבוסס על סיכומים שנותחו ועשוי לטעות · אינו תחליף לשיקול דעת קליני</div>
    </div>
  );
}

// A tool call: a collapsed 1-line row that expands to the full request/response,
// so the therapist can see exactly what the assistant fetched from the backend.
function ToolCallChip({ tool }: { tool: ToolView }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ maxWidth: '92%', border: '1px solid var(--divider)', borderRadius: 8, background: 'var(--surface-2)', overflow: 'hidden' }}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="shell-ai-tool" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', textAlign: 'start' }}>
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: tool.done ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }} />
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tool.label}</span>
        <span aria-hidden="true" style={{ flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s ease' }}>‹</span>
      </button>
      {open && (
        <pre dir="ltr" style={{ margin: 0, padding: '8px 10px', borderTop: '1px solid var(--divider)', fontSize: 11, lineHeight: 1.5, color: 'var(--text)', overflowX: 'auto', maxHeight: 220, whiteSpace: 'pre', fontFamily: 'monospace' }}>{toolDetail(tool)}</pre>
      )}
    </div>
  );
}

function toolDetail(tool: ToolView): string {
  const sections: string[] = [];
  if (tool.input !== undefined) sections.push('request:\n' + safeJson(tool.input));
  if (tool.output !== undefined) sections.push('response:\n' + safeJson(tool.output));
  return sections.join('\n\n') || '…';
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
