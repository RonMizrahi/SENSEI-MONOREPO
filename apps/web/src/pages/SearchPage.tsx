// Unified search results — ported from 'Sensei demo.dc.html'
// (template lines 1430–1485 · logic: renderVals search section ~4629–4667, helpers ~3257–3282).
import { useApp } from '../store/AppStore';
import { avatarColors } from '../utils';
import { patientInitials, patientAvatarColor } from '../services/patients';
import { scoreP, hlParts, normHe } from '../utils/search';
import './search.css';
import { SESSION_DATES, sessionSummaries } from '../data/sessions';

const CAL_I = 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z';

function buildSessions(p: any, deleted: string[]): any[] {
  const dates = SESSION_DATES;
  const summaries = sessionSummaries(p);
  const n = 0;
  const out: any[] = [];
  for (let i = 0; i < n; i++) {
    const num = p.sessions - i;
    const key = p.id + '#' + num;
    if (deleted.indexOf(key) !== -1) continue;
    out.push({ num, date: dates[i], summary: summaries[i % summaries.length] });
  }
  return out;
}


export default function SearchPage() {
  const { S, set, navigate } = useApp();

  const searchQuery = S.searchQuery;
  const onSearchInput = (e: any) => set({ searchQuery: e.target.value, searchType: 'all' });
  const clearSearchInput = () => set({ searchQuery: '' });

  const sq = (S.searchQuery || '').trim();
  const sType = S.searchType || 'all';
  const _hit = (txt: any) => { const a = normHe(txt), b = normHe(sq); return !!b && a.includes(b); };
  const goPatient = (p: any) => { set({ searchQuery: '' }); navigate('patient', { patientId: p.id }); };

  const sPatItems = sq ? S.patients.map((p: any) => ({ p, s: scoreP(p, sq) })).filter((x: any) => x.s > 0).sort((a: any, b: any) => b.s - a.s).map(({ p }: any) => {
    const a = avatarColors(patientAvatarColor(p.id));
    return { useAvatar: true, showIcon: false, avatarText: patientInitials(p.name), avBg: a.bg, avColor: a.color, titleParts: hlParts(p.name, sq), sub: p.phone, hasChip: false, onClick: () => goPatient(p) };
  }) : [];

  const sSesItems: any[] = [];
  if (sq) {
    S.patients.forEach((p: any) => {
      buildSessions(p, S.deletedSessions || []).forEach((se: any) => {
        if (_hit(se.summary)) {
          sSesItems.push({ useAvatar: false, showIcon: true, iconPath: CAL_I, iconBg: 'var(--primary-tint)', iconColor: 'var(--primary)', titleParts: hlParts('פגישה ' + se.num + ' · ' + p.name, sq), sub: se.summary, hasChip: false, onClick: () => { set({ searchQuery: '' }); navigate('summary', { patientId: p.id }); } });
        }
      });
    });
  }

  const S_CATS = [
    { key: 'patients', label: 'מטופלים', items: sPatItems },
    { key: 'sessions', label: 'פגישות', items: sSesItems },
  ];
  const sTotal = S_CATS.reduce((n, c) => n + c.items.length, 0);
  const searchHasQuery = !!sq;
  const searchNoQuery = !sq;
  const searchEmpty = !!sq && sTotal === 0;
  const searchHasResults = !!sq && sTotal > 0;
  const searchCountLabel = sTotal + (sTotal === 1 ? ' תוצאה' : ' תוצאות') + ' עבור “' + sq + '”';

  const S_FILT: [string, string][] = ([['all', 'הכל']] as [string, string][]).concat(S_CATS.map((c) => [c.key, c.label] as [string, string]));
  const searchFilters = S_FILT.map(([k, l]) => {
    const cnt = k === 'all' ? sTotal : (S_CATS.find((c) => c.key === k) as any).items.length;
    return { key: k, cnt, label: l + ' · ' + cnt };
  }).filter((f) => f.key === 'all' || f.cnt > 0).map((f) => {
    const on = sType === f.key;
    return { key: f.key, label: f.label, onClick: () => set({ searchType: f.key }), bg: on ? 'var(--primary)' : 'var(--paper)', color: on ? 'var(--paper)' : 'var(--text-2)', border: on ? 'var(--primary)' : 'var(--border-input)' };
  });
  const searchGroups = S_CATS.filter((c) => (sType === 'all' || sType === c.key) && c.items.length > 0).map((c) => ({
    key: c.key, label: c.label, count: c.items.length, items: c.items.slice(0, 8), hasMore: c.items.length > 8,
    moreLabel: c.items.length > 8 ? ('ועוד ' + (c.items.length - 8) + ' תוצאות. צמצמו את החיפוש') : '',
  }));

  return (
    <div data-screen-label="תוצאות חיפוש" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 27, fontWeight: 900, letterSpacing: '-.6px' }}>תוצאות חיפוש</h1>
        {searchHasResults && <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>{searchCountLabel}</p>}
      </div>
      <div style={{ position: 'relative', marginBottom: 18 }}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--text-muted)" style={{ position: 'absolute', insetInlineStart: 15, top: '50%', transform: 'translateY(-50%)' }}><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.49 4.49 0 0 1 9.5 14z" /></svg>
        <input value={searchQuery} onChange={onSearchInput} aria-label="חיפוש בכל המערכת" placeholder="חיפוש מטופלים ופגישות…" className="search-main-input" style={{ width: '100%', height: 52, border: '1px solid var(--divider)', background: 'var(--paper)', borderRadius: 12, padding: '0 48px', fontSize: 15.5, outline: 'none', fontFamily: 'inherit' }} />
        {searchHasQuery && (
          <svg onClick={clearSearchInput} role="button" tabIndex={0} aria-label="ניקוי" viewBox="0 0 24 24" width="19" height="19" fill="var(--text-muted)" className="search-clear" style={{ position: 'absolute', insetInlineEnd: 15, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer' }}><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
        )}
      </div>

      {searchHasResults && (
        <>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 22 }}>
            {searchFilters.map((f) => (
              <button key={f.key} onClick={f.onClick} style={{ height: 36, padding: '0 15px', border: '1px solid ' + f.border, borderRadius: 20, background: f.bg, color: f.color, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{f.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            {searchGroups.map((grp) => (
              <div key={grp.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, letterSpacing: '-.2px' }}>{grp.label}</h2>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: 20, padding: '2px 9px' }}>{grp.count}</span>
                </div>
                <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 14, overflow: 'hidden' }}>
                  {grp.items.map((it: any, ii: number) => (
                    <div key={ii} onClick={it.onClick} role="button" tabIndex={0} className="search-result-row" style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 17px', cursor: 'pointer', borderTop: '1px solid var(--line)' }}>
                      {it.useAvatar && (
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: it.avBg, color: it.avColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{it.avatarText}</div>
                      )}
                      {it.showIcon && (
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: it.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg viewBox="0 0 24 24" width="20" height="20" fill={it.iconColor}><path d={it.iconPath} /></svg>
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {it.titleParts.map((tp: any, ti: number) => (
                            <span key={ti} style={{ background: tp.bg, fontWeight: tp.fw, borderRadius: 3 }}>{tp.t}</span>
                          ))}
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{it.sub}</div>
                      </div>
                      {it.hasChip && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: it.chipBg, color: it.chipColor, flexShrink: 0, whiteSpace: 'nowrap' }}>{it.chipLabel}</span>
                      )}
                    </div>
                  ))}
                  {grp.hasMore && (
                    <div style={{ padding: '11px 17px', borderTop: '1px solid var(--line)', fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>{grp.moreLabel}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {searchEmpty && (
        <div style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg viewBox="0 0 24 24" width="30" height="30" fill="var(--text-muted)"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.49 4.49 0 0 1 9.5 14z" /></svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 5 }}>לא נמצאו תוצאות</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>נסו שם מטופל אחר</div>
        </div>
      )}

      {searchNoQuery && (
        <div style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 5 }}>התחילו לחפש</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>הקלידו בשדה החיפוש כדי למצוא מטופלים ופגישות</div>
        </div>
      )}
    </div>
  );
}
