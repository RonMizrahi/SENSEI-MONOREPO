// Full meeting history for one patient — all past recorded sessions.
import { useApp } from '../store/AppStore';
import { getPatient } from '../utils';
import { buildPatientSessions, enrichPatientSessions } from '../utils/patientSessions';
import PatientSessionList from '../components/patient/PatientSessionList';
import { CARD_SHADOW } from '../utils/styles';
import './meetingHistory.css';

export default function PatientMeetingHistoryPage() {
  const { S, set, navigate } = useApp();
  const cp = getPatient(S.patients, S.patientId, S.archivedPatients || []);
  const goPatient = () => navigate('patient', { patientId: S.patientId });

  const base = buildPatientSessions(cp, S.deletedSessions || [], { navigate, set });
  const sessions = enrichPatientSessions(base, S, cp.id);

  const onPatientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = S.patients.find((x: any) => x.name === e.target.value);
    if (p) navigate('meetingHistory', { patientId: p.id });
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        <a onClick={goPatient} className="mh-crumb" style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>{cp.name}</a>
        <span>›</span>
        <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>היסטוריית פגישות</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 27, fontWeight: 900, letterSpacing: '-.6px' }}>היסטוריית פגישות</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>{cp.name} · {sessions.length} פגישות</p>
        </div>
        <select
          onChange={onPatientSelect}
          value={cp.name}
          aria-label="בחירת מטופל"
          className="mh-patient-select"
          style={{ height: 44, border: '1px solid var(--divider)', borderRadius: 10, padding: '0 14px', fontSize: 14, background: 'var(--paper)', color: 'var(--text-2)', outline: 'none', cursor: 'pointer' }}
        >
          {S.patients.map((p: any) => <option key={p.id}>{p.name}</option>)}
        </select>
      </div>

      {S.loading && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: 26 }}>
          <div className="skeleton" style={{ width: '35%', height: 14, borderRadius: 6, marginBottom: 12 }} />
          <div className="skeleton" style={{ width: '90%', height: 11, borderRadius: 6 }} />
        </div>
      )}

      {!S.loading && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, boxShadow: CARD_SHADOW, padding: '8px 22px 18px' }}>
          <PatientSessionList sessions={sessions} />
        </div>
      )}
    </div>
  );
}
