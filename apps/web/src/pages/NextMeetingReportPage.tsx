// Next-meeting report launcher — pick a patient, then open the prep report.
import { useState } from 'react';
import { useApp } from '../store/AppStore';
import { formatMeetingWhen } from '../components/patient/UpcomingMeetingList';
import { usePatientNextMeeting } from '../hooks/usePatientNextMeeting';
import { CARD_SHADOW } from '../utils/styles';
import './nextMeetingReport.css';

export default function NextMeetingReportPage() {
  const { S, navigate, toast } = useApp();
  const defaultPid = S.patientId || S.patients[0]?.id || '';
  const [patientId, setPatientId] = useState(defaultPid);

  const selected = S.patients.find((p: any) => p.id === patientId) ?? S.patients[0];
  const selectedId = selected?.id || '';
  const { nextMeetingStart, loading: meetingsLoading } = usePatientNextMeeting(
    selectedId,
    selected?.name || '',
    S.scheduledAppts || [],
    S.patients,
    S.calendarRefreshNonce,
  );

  const openReport = () => {
    if (!selectedId) {
      toast('יש לבחור מטופל', 'error');
      return;
    }
    navigate('report', { patientId: selectedId });
  };

  const empty = S.patients.length === 0 || S.demoEmpty;
  const noMeetingFallback = 'אין פגישה מתוכננת · הדוח יתבסס על הפגישה האחרונה';

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 27, fontWeight: 900, letterSpacing: '-.6px' }}>דוח לפגישה הבאה</h1>
      <p style={{ margin: '0 0 22px', color: 'var(--text-secondary)', fontSize: 15 }}>
        בחרו מטופל ויצרו דוח הכנה אוטומטי לפגישה הקרובה · סיכום, נושאים פתוחים ותובנות מהפגישה האחרונה.
      </p>

      <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 24 }}>
        {empty ? (
          <div style={{ textAlign: 'center', padding: '28px 12px' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>אין מטופלים פעילים</h2>
            <p style={{ margin: '0 0 18px', color: 'var(--text-secondary)', fontSize: 14.5 }}>הוסיפו מטופל כדי ליצור דוח הכנה.</p>
            <button
              type="button"
              onClick={() => navigate('patients')}
              className="nmr-primary-btn"
              style={{ height: 44, padding: '0 20px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}
            >
              מעבר למטופלים
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 18 }}>
              <label htmlFor="nmr-patient" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>מטופל</label>
              <select
                id="nmr-patient"
                aria-label="בחירת מטופל לדוח"
                value={selectedId}
                onChange={(e) => setPatientId(e.target.value)}
                className="app-select" style={{ width: '100%' }}
              >
                {S.patients.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {selected && (
              <div style={{ marginBottom: 22, padding: '12px 14px', borderRadius: 10, background: 'var(--primary-surface)', border: '1px solid var(--primary-border)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>הפגישה הבאה</div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: meetingsLoading ? 'var(--text-muted)' : 'var(--primary)' }}>
                  {meetingsLoading ? 'טוען פגישות…' : (nextMeetingStart ? formatMeetingWhen(nextMeetingStart) : noMeetingFallback)}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={openReport}
              disabled={!selectedId}
              aria-label="יצירת דוח הכנה"
              className="nmr-primary-btn"
              style={{
                width: '100%', height: 46, border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)',
                fontSize: 15, fontWeight: 700, cursor: selectedId ? 'pointer' : 'default', opacity: selectedId ? 1 : 0.55,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              יצירת דוח
            </button>
          </>
        )}
      </div>
    </div>
  );
}
