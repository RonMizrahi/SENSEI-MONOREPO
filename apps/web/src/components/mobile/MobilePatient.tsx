// Mobile patient profile (design: "Sensei Mobile · Patient"). Avatar, contact,
// next meeting, and recent sessions. Uses the SAME upcoming-meetings hook as the
// desktop PatientPage (usePatientUpcomingMeetings → senseiapi `/calendar` when
// configured, local scheduled appts otherwise), so it's not demo-only.
import { useApp } from '../../store/AppStore';
import { avatarColors } from '../../utils';
import { patientInitials, patientAvatarColor, displayPatientEmail } from '../../services/patients';
import { formatMeetingWhen } from '../patient/UpcomingMeetingList';
import { usePatientUpcomingMeetings } from '../patient/usePatientUpcomingMeetings';
import { SESSION_DATES, sessionSummaries } from '../../data/sessions';
import { demoSessionCount } from '../../utils/patientSessions';
import { ChevronStartIcon } from './icons';

const RECENT_COUNT = 4;

export default function MobilePatient() {
  const { navigate } = useApp();
  const { cp, upcomingMeetings } = usePatientUpcomingMeetings();
  const av = avatarColors(patientAvatarColor(cp.id));

  const next = upcomingMeetings[0];
  const nextLabel = next ? formatMeetingWhen(new Date(next.start)) : 'טרם נקבעה';

  const summaries = sessionSummaries(cp);
  // Use the canonical per-patient session count (same as SessionDetailPage /
  // buildPatientSessions), so the newest session number is real and tapping a
  // row navigates to a session that exists.
  const total = demoSessionCount(cp);
  const sessions = SESSION_DATES.slice(0, RECENT_COUNT).map((date, i) => ({
    num: total - i,
    date,
    summary: summaries[i % summaries.length],
  }));

  return (
    <div className="mob-screen">
      <div className="mob-screen-header">
        <button type="button" className="mob-back" aria-label="חזרה" onClick={() => window.history.back()}>
          <ChevronStartIcon size={18} />
        </button>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary)' }}>תיק מטופל</div>
      </div>

      <div className="mob-screen-body">
        <div style={{ textAlign: 'center', padding: '6px 0 8px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: av.bg, color: av.color, fontSize: 26, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>{patientInitials(cp.name)}</div>
          <div style={{ fontSize: 21, fontWeight: 800, color: 'var(--primary)' }}>{cp.name}</div>
          <div dir="ltr" style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>{cp.phone} · {displayPatientEmail(cp.email)}</div>
        </div>

        <div className="mob-card" style={{ background: 'var(--primary-tint)', border: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>הפגישה הבאה</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary)' }}>{nextLabel}</div>
          </div>
          <button type="button" onClick={() => navigate('report', { patientId: cp.id })} style={{ padding: '10px 16px', border: 'none', borderRadius: 11, background: 'var(--primary)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>דוח הכנה</button>
        </div>

        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', margin: '6px 2px 2px' }}>פגישות אחרונות</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sessions.map((s) => (
            <button
              key={s.num}
              type="button"
              className="mob-sess-row"
              onClick={() => navigate('session', { patientId: cp.id, sessionNum: s.num })}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span dir="ltr" style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--primary)' }}>{s.date}</span>
                <span className="mob-badge">פגישה {s.num}</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-2)', textAlign: 'start' }}>{s.summary}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
