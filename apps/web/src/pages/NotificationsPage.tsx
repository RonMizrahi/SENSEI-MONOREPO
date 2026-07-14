// Notification center — ported from 'Sensei demo.dc.html'
// (template lines 1354–1429 · logic: renderVals notification-center section ~4400–4490).
import { useApp } from '../store/AppStore';
import { CARD_SHADOW } from '../utils/styles';
import './notifications.css';
import { NOTIFS } from '../data/catalogs';

// Static notification feed — ported verbatim from the prototype logic class.

const ENV_ICON = 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z';
const CHK_ICON = 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z';

function nMeta(k: string): any {
  return k === 'risk' ? { color: 'var(--error)', bg: 'var(--error-bg)', label: 'דגל סיכון', icon: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z' }
    : k === 'reminder' ? { color: 'var(--primary)', bg: 'var(--primary-tint)', label: 'תזכורת', icon: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z' }
      : k === 'system' ? { color: 'var(--info)', bg: 'var(--info-bg)', label: 'מערכת', icon: 'M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z' }
        : { color: 'var(--secondary-strong)', bg: 'var(--secondary-bg)', label: 'סיכום AI', icon: 'M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21.4 8 14 2 9.4h7.6z' };
}

const FILT = [
  { key: 'all', label: 'הכל' }, { key: 'unread', label: 'לא נקראו' }, { key: 'summary', label: 'סיכומי AI' },
  { key: 'risk', label: 'דגלי סיכון' }, { key: 'reminder', label: 'תזכורות' },
  { key: 'system', label: 'מערכת' }, { key: 'archived', label: 'ארכיון' },
];

const routeFor = (k: string) => k === 'system' ? 'settings' : k === 'reminder' ? 'calendar' : k === 'risk' ? 'patient' : 'summary';

export default function NotificationsPage() {
  const { S, set, navigate, toast } = useApp();

  const isRead = (id: string) => S.notifRead.includes(id);
  const isArch = (id: string) => S.notifArchived.includes(id);
  const markRead = (id: string, val: boolean) => set((s: any) => ({
    notifRead: val ? (s.notifRead.includes(id) ? s.notifRead : [...s.notifRead, id]) : s.notifRead.filter((x: string) => x !== id),
  }));

  const buildRow = (n: any) => {
    const m = nMeta(n.kind); const read = isRead(n.id); const arch = isArch(n.id);
    return {
      id: n.id, title: n.title, text: n.text, time: n.time, icon: m.icon, iconColor: m.color, iconBg: m.bg,
      catLabel: m.label, catColor: m.color, catBg: m.bg, unread: !read, isArchived: arch,
      rowBg: read ? 'var(--paper)' : 'var(--primary-surface)', accent: read ? 'transparent' : m.color,
      readToggleLabel: read ? 'סימון כלא-נקרא' : 'סימון כנקרא', readToggleIcon: read ? ENV_ICON : CHK_ICON,
      onOpen: () => { markRead(n.id, true); set({ notifOpen: false }); navigate(routeFor(n.kind), n.pid ? { patientId: n.pid } : {}); },
      onToggleRead: (e?: any) => { if (e) e.stopPropagation(); markRead(n.id, read ? false : true); },
      onArchive: (e?: any) => {
        if (e) e.stopPropagation();
        set((s: any) => ({ notifArchived: [...s.notifArchived, n.id] }));
        toast('ההתראה הועברה לארכיון', 'success', { label: 'ביטול', onClick: () => set((s: any) => ({ notifArchived: s.notifArchived.filter((x: string) => x !== n.id) })) });
      },
      onRestore: (e?: any) => { if (e) e.stopPropagation(); set((s: any) => ({ notifArchived: s.notifArchived.filter((x: string) => x !== n.id) })); toast('ההתראה שוחזרה'); },
    };
  };

  const markAllRead = () => set({ notifRead: NOTIFS.filter((n) => !isArch(n.id)).map((n) => n.id) });
  const archiveReadNotifs = () => {
    const ids = NOTIFS.filter((n) => !isArch(n.id) && isRead(n.id)).map((n) => n.id);
    if (!ids.length) { toast('אין התראות שנקראו לניקוי', 'info'); return; }
    set((s: any) => ({ notifArchived: [...s.notifArchived, ...ids] }));
    toast(ids.length + ' התראות שנקראו הועברו לארכיון');
  };

  const fCount = (key: string) => key === 'archived' ? NOTIFS.filter((n) => isArch(n.id)).length
    : key === 'all' ? NOTIFS.filter((n) => !isArch(n.id)).length
      : key === 'unread' ? NOTIFS.filter((n) => !isArch(n.id) && !isRead(n.id)).length
        : NOTIFS.filter((n) => !isArch(n.id) && n.kind === key).length;

  const notifFilters = FILT.map((f) => {
    const active = S.notifFilter === f.key; const c = fCount(f.key);
    return {
      key: f.key, label: f.label, count: String(c), showCount: c > 0, onClick: () => set({ notifFilter: f.key }),
      bg: active ? 'var(--primary)' : 'var(--paper)', color: active ? 'var(--paper)' : 'var(--text-2)', border: active ? 'var(--primary)' : 'var(--divider)',
      countBg: active ? 'rgba(255,255,255,.22)' : 'var(--surface-2)', countColor: active ? 'var(--paper)' : 'var(--text-muted)',
    };
  });

  let visible: any[];
  if (S.notifFilter === 'archived') visible = NOTIFS.filter((n) => isArch(n.id));
  else {
    visible = NOTIFS.filter((n) => !isArch(n.id));
    if (S.notifFilter === 'unread') visible = visible.filter((n) => !isRead(n.id));
    else if (S.notifFilter !== 'all') visible = visible.filter((n) => n.kind === S.notifFilter);
  }

  const groupBy = S.notifGroupBy || 'time';
  const notifGroupOpts = [{ key: 'time', label: 'לפי זמן' }, { key: 'type', label: 'לפי סוג' }].map((o) => {
    const on = groupBy === o.key;
    return {
      key: o.key, label: o.label, onClick: () => set({ notifGroupBy: o.key }), ariaSel: (on ? 'true' : 'false') as ('true' | 'false'),
      bg: on ? 'var(--paper)' : 'transparent', color: on ? 'var(--primary)' : 'var(--text-muted)', weight: on ? 700 : 600, shadow: on ? '0 1px 2px rgba(16,40,80,.12)' : 'none',
    };
  });

  const markGroupRead = (ids: string[]) => { if (ids.length) set((s: any) => ({ notifRead: [...new Set([...s.notifRead, ...ids])] })); };
  const buildGroup = (label: string, items: any[]) => {
    const unread = items.filter((n) => !isRead(n.id)).length;
    return {
      label, items: items.map(buildRow), unread, unreadLabel: unread + ' חדשות', hasUnread: unread > 0,
      onMarkRead: (e?: any) => { if (e) e.stopPropagation(); markGroupRead(items.filter((n) => !isRead(n.id)).map((n) => n.id)); },
    };
  };

  let groupDefs: any[];
  if (groupBy === 'type') {
    const order: [string, string][] = [['risk', 'דגלי סיכון'], ['summary', 'סיכומי AI'], ['reminder', 'תזכורות'], ['system', 'מערכת']];
    groupDefs = order.map(([k, label]) => buildGroup(label, visible.filter((n) => n.kind === k)));
  } else {
    groupDefs = ['היום', 'אתמול', 'קודם'].map((g) => buildGroup(g, visible.filter((n) => n.group === g)));
  }
  const notifGroups = groupDefs.filter((gr) => gr.items.length > 0);
  const notifCenterEmpty = visible.length === 0;
  const emptyMap: Record<string, [string, string]> = {
    unread: ['הכול נקרא', 'אין התראות שלא נקראו. עבודה יפה.'], archived: ['הארכיון ריק', 'התראות שתעבירו לארכיון יופיעו כאן.'],
    summary: ['אין סיכומי AI', 'כשסיכום חדש יהיה מוכן הוא יופיע כאן.'], risk: ['אין דגלי סיכון', 'לא זוהו התראות סיכון פתוחות.'],
    reminder: ['אין תזכורות', 'תזכורות לפגישות ומסמכים יופיעו כאן.'],
    system: ['אין עדכוני מערכת', 'הודעות מערכת ועדכוני גרסה יופיעו כאן.'], all: ['אין התראות', 'אין התראות פעילות כרגע.'],
  };
  const em = emptyMap[S.notifFilter] || emptyMap.all;
  const notifEmptyTitle = em[0]; const notifEmptyText = em[1];
  const notifCenterUnread = String(NOTIFS.filter((n) => !isArch(n.id) && !isRead(n.id)).length);
  const notifCenterTotal = String(NOTIFS.filter((n) => !isArch(n.id)).length);

  return (
    <div data-screen-label="מרכז ההתראות" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 27, fontWeight: 900, letterSpacing: '-.6px' }}>מרכז ההתראות</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>{notifCenterUnread} התראות שלא נקראו מתוך {notifCenterTotal} פעילות</p>
        </div>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <button onClick={markAllRead} className="notif-hdr-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, height: 40, padding: '0 15px', border: '1px solid var(--divider)', borderRadius: 10, background: 'var(--paper)', color: 'var(--text-2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="var(--primary)"><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" /></svg>סמנו הכל כנקרא
          </button>
          <button onClick={archiveReadNotifs} className="notif-hdr-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, height: 40, padding: '0 15px', border: '1px solid var(--divider)', borderRadius: 10, background: 'var(--paper)', color: 'var(--text-2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="var(--text-muted)"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z" /></svg>ניקוי נקראות
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {notifFilters.map((f) => (
          <a key={f.key} onClick={f.onClick} role="button" tabIndex={0} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 20, cursor: 'pointer', border: '1px solid ' + f.border, background: f.bg, color: f.color }}>
            {f.label}
            {f.showCount && (
              <span style={{ minWidth: 19, height: 19, padding: '0 5px', borderRadius: 10, background: f.countBg, color: f.countColor, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{f.count}</span>
            )}
          </a>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>קיבוץ לפי</span>
        <div role="tablist" aria-label="קיבוץ התראות" style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--divider)', borderRadius: 9, padding: 3, gap: 2 }}>
          {notifGroupOpts.map((o) => (
            <button key={o.key} onClick={o.onClick} role="tab" aria-selected={o.ariaSel} style={{ height: 30, padding: '0 15px', border: 'none', borderRadius: 7, background: o.bg, color: o.color, fontWeight: o.weight, fontSize: 12.5, cursor: 'pointer', boxShadow: o.shadow, fontFamily: 'inherit' }}>{o.label}</button>
          ))}
        </div>
      </div>

      {notifGroups.map((g, gi) => (
        <div key={gi} style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '0 0 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.2px' }}>{g.label}</h2>
              {g.hasUnread && (
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-tint)', padding: '1px 8px', borderRadius: 20 }}>{g.unreadLabel}</span>
              )}
            </div>
            {g.hasUnread && (
              <a onClick={g.onMarkRead} role="button" tabIndex={0} className="notif-group-mark" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" /></svg>סמנו קבוצה כנקראה
              </a>
            )}
          </div>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 12, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
            {g.items.map((n: any) => (
              <div key={n.id} className="notif-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px', borderBottom: '1px solid var(--line)', cursor: 'pointer', background: n.rowBg, borderInlineStart: '3px solid ' + n.accent }}>
                <button type="button" onClick={n.onOpen} aria-label={n.title} style={{ border: 'none', background: 'none', padding: 0, margin: 0, font: 'inherit', color: 'inherit', textAlign: 'start', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: n.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" width="21" height="21" fill={n.iconColor}><path d={n.icon} /></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 14.5 }}>{n.title}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: n.catBg, color: n.catColor }}>{n.catLabel}</span>
                      {n.unread && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />}
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.55 }}>{n.text}</p>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{n.time}</span>
                  </div>
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  {n.isArchived && (
                    <button onClick={n.onRestore} aria-label="שחזור מהארכיון" title="שחזור" className="notif-icon-btn" style={{ width: 34, height: 34, border: 'none', borderRadius: 9, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--text-muted)"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" /></svg>
                    </button>
                  )}
                  <button onClick={n.onToggleRead} aria-label={n.readToggleLabel} title={n.readToggleLabel} className="notif-icon-btn" style={{ width: 34, height: 34, border: 'none', borderRadius: 9, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--text-muted)"><path d={n.readToggleIcon} /></svg>
                  </button>
                  <button onClick={n.onArchive} aria-label="העברה לארכיון" title="העברה לארכיון" className="notif-arch-btn" style={{ width: 34, height: 34, border: 'none', borderRadius: 9, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--text-muted)"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {notifCenterEmpty && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 12, padding: '56px 20px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg viewBox="0 0 24 24" width="30" height="30" fill="var(--text-muted)"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5S10.5 3.17 10.5 4v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" /></svg>
          </div>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>{notifEmptyTitle}</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>{notifEmptyText}</p>
        </div>
      )}
    </div>
  );
}
