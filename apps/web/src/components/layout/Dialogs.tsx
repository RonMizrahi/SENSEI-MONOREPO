// Global overlays: keyboard-shortcuts reference + all action dialogs
// (patient create/edit, delete patient, delete session, wipe data, delete account,
// schedule appointment). Ported from the prototype overlays template + its
// dialog view-model handlers. Enter-to-submit is wired here (the store's
// Escape cascade closes overlays globally).
import React, { useEffect, useRef } from 'react';
import { useApp } from '../../store/AppStore';
import { findPatient, getPatient, hg, EMAIL_RE, isValidPhone, mergeAppointments } from '../../utils';
import { fmtTime } from '../../utils/dates';
import { purgePatientReferences } from '../../utils/patientReferences';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useTts } from '../../hooks/useTts';
import { sessionSummaries } from '../../data/sessions';
import Checkbox from '../shared/Checkbox';
import { labelStyle } from '../../utils/styles';
import { buildAppointmentTimes, createCalendarEvent, dayKey, defaultScheduleForm, deleteCalendarEvent, resolveCalendarEventApiId, UUID_RE } from '../../services/calendar';
import {
  createPatient, updatePatient, archivePatient, deletePatient, localPatient,
} from '../../services/patients';
import { isApiConfigured } from '../../services/apiClient';
import { deleteMeetingTranscript } from '../../services/meetingTranscript';
import { SHORTCUTS } from '../../data/shortcuts';
import { queryClient } from '../../query/queryClient';
import { invalidateCalendar, invalidatePatients } from '../../query/keys';

const CLOSE_X = 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';
const btnCancel: React.CSSProperties = { height: 44, padding: '0 20px', border: '1px solid var(--border-input)', borderRadius: 10, background: 'var(--paper)', fontSize: 14.5, fontWeight: 600, cursor: 'pointer' };
const btnPrimary: React.CSSProperties = { height: 44, padding: '0 22px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: 'var(--paper)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' };
const btnDanger: React.CSSProperties = { height: 44, padding: '0 22px', border: '1px solid var(--error)', borderRadius: 10, background: 'transparent', color: 'var(--error-dark)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' };

// Shared destructive-confirmation dialog body — single source of truth for the
// archive / permanent-delete / delete-session / delete-transcript / delete-meeting
// / wipe-data / delete-account confirmations (previously seven near-identical
// blocks). Per-dialog icon, copy, confirm label + handler, and optional extra
// content (e.g. the wipe backup note) are props; the frame is identical.
const IC_TRASH = 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z';
const IC_WARN = 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z';
const IC_ACCOUNT = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z';

function ConfirmDialog({ icon, iconBg = 'var(--error-bg)', title, confirmLabel, onConfirm, onCancel, extra, children }: {
  icon: string; iconBg?: string; title: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void; extra?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="var(--error)"><path d={icon} /></svg>
        </div>
        <div>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14.5, lineHeight: 1.6 }}>{children}</p>
        </div>
      </div>
      {extra}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-start' }}>
        <button onClick={onConfirm} className="shell-danger-btn" style={btnDanger}>{confirmLabel}</button>
        <button onClick={onCancel} style={btnCancel}>ביטול</button>
      </div>
    </div>
  );
}

// -------- keyboard shortcuts dialog --------
function ShortcutsDialog() {
  const { S, set } = useApp();
  const trapRef = useFocusTrap<HTMLDivElement>(S.shortcutsOpen);
  if (!S.shortcutsOpen) return null;
  const close = () => set({ shortcutsOpen: false });
  return (
    <>
      <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(10,15,40,.5)', zIndex: 180, backdropFilter: 'blur(2px)' }} />
      <div ref={trapRef} role="dialog" aria-modal="true" aria-label="קיצורי מקלדת" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 480, maxWidth: 'calc(100vw - 32px)', background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 16, boxShadow: '0 24px 70px rgba(8,20,50,.32)', zIndex: 181, overflow: 'hidden', animation: 'pop .16s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg viewBox="0 0 24 24" width="21" height="21" fill="var(--primary)"><path d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z" /></svg>
            <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 700 }}>קיצורי מקלדת</h3>
          </div>
          <svg onClick={close} className="shell-close-x" role="button" tabIndex={0} aria-label="סגירה" viewBox="0 0 24 24" width="20" height="20" fill="var(--text-muted)" style={{ cursor: 'pointer' }}><path d={CLOSE_X} /></svg>
        </div>
        <div style={{ padding: '10px 22px 20px', display: 'flex', flexDirection: 'column' }}>
          {SHORTCUTS.map((s) => (
            <div key={s.d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: '1px solid var(--line)' }}>
              <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{s.d}</span>
              <kbd dir="ltr" style={{ fontFamily: 'monospace', fontSize: 12.5, fontWeight: 700, background: 'var(--surface-2)', border: '1px solid var(--divider)', borderBottomWidth: 2, borderRadius: 7, padding: '4px 9px', color: 'var(--text)', whiteSpace: 'nowrap' }}>{s.k}</kbd>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// -------- action dialogs (S.dialog) --------
function ActionDialog() {
  const { S, set, toast, navigate, deleteAccount } = useApp();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(!!S.dialog);
  const tts = useTts();

  const isForm = S.dialog === 'create' || S.dialog === 'edit';
  const isDelete = S.dialog === 'delete';
  const isDeletePatientPermanent = S.dialog === 'deletePatientPermanent';
  const isDelSession = S.dialog === 'delSession';
  const isDelTranscript = S.dialog === 'delTranscript';
  const isDelMeeting = S.dialog === 'delMeeting';
  const isWipe = S.dialog === 'wipe';
  const isDeleteAccount = S.dialog === 'deleteAccount';
  const isSchedule = S.dialog === 'schedule';
  const isCalEvent = S.dialog === 'calEvent';

  useEffect(() => {
    if (S.dialog && firstFieldRef.current) firstFieldRef.current.focus();
  }, [S.dialog]);

  if (!S.dialog) return null;

  const closeDialog = () => set({ dialog: null, errors: {}, calEventDetail: null });
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  // ---- Enter-to-submit (mirrors the prototype's global keydown for open dialogs) ----
  const onDialogKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    const tag = (e.target as any)?.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (isForm) { e.preventDefault(); submitPatient(); }
    else if (isSchedule) { e.preventDefault(); submitAppt(); }
  };

  // ===== patient create/edit form =====
  const form = S.form || {};
  // R-2: soft, non-blocking duplicate detection — warn if the phone/email matches
  // an existing patient, but never prevent a legitimate save (shared family
  // numbers / no email are valid). Excludes the record being edited.
  const formPhoneDigits = (form.phone || '').replace(/\D/g, '');
  const formEmailNorm = (form.email || '').trim().toLowerCase();
  const dupMatch = isForm && (formPhoneDigits || formEmailNorm)
    ? [...(S.patients || []), ...(S.archivedPatients || [])].find((p: any) =>
      p.id !== S.dialogPatientId && (
        (formPhoneDigits && (p.phone || '').replace(/\D/g, '') === formPhoneDigits) ||
        (formEmailNorm && (p.email || '').trim().toLowerCase() === formEmailNorm)
      ))
    : null;
  const errors = S.errors || {};
  const dialogTitle = S.dialog === 'edit' ? 'עריכת מטופל' : 'מטופל חדש';
  const dialogSubmitLabel = S.dialog === 'edit' ? 'שמירת שינויים' : 'יצירת מטופל';
  const nameBorder = errors.name ? 'var(--error)' : 'var(--primary-border)';
  const phoneBorder = errors.phone ? 'var(--error)' : 'var(--primary-border)';
  const emailBorder = errors.email ? 'var(--error)' : 'var(--primary-border)';

  const submitPatient = async () => {
    const errs: any = {};
    if (!(form.name || '').trim()) errs.name = 'יש להזין שם מלא';
    const phone = (form.phone || '').trim();
    if (!phone) errs.phone = 'יש להזין מספר טלפון';
    else if (!isValidPhone(phone)) errs.phone = 'יש להזין מספר טלפון תקין (למשל 050-1234567)';
    const email = (form.email || '').trim();
    if (email && !EMAIL_RE.test(email)) errs.email = 'יש להזין כתובת דוא״ל תקינה';
    if (Object.keys(errs).length) {
      set({ errors: errs });
      const f = errs.name ? 'name' : errs.phone ? 'phone' : 'email';
      setTimeout(() => { const el = document.querySelector<HTMLElement>('[data-field="' + f + '"]'); if (el) el.focus(); }, 0);
      return;
    }
    const nm = form.name.trim();
    const payload = { name: nm, phone, email: email || null, address: (form.address || '').trim() || null };
    if (S.dialog === 'edit') {
      if (isApiConfigured()) {
        try {
          const updated = await updatePatient(S.dialogPatientId, payload);
          set({
            patients: S.patients.map((p: any) => p.id === updated.id ? updated : p),
            dialog: null, errors: {},
          });
          void invalidatePatients(queryClient);
          toast('הפרטים עודכנו');
          return;
        } catch {
          toast('עדכון בשרת נכשל · נשמר מקומית', 'error');
        }
      }
      set({
        patients: S.patients.map((p: any) => p.id === S.dialogPatientId ? { ...p, ...payload } : p),
        dialog: null, errors: {},
      });
      toast('הפרטים עודכנו');
    } else {
      if (isApiConfigured()) {
        try {
          const created = await createPatient(payload);
          set({ patients: [created, ...S.patients], dialog: null, errors: {}, demoEmpty: false });
          void invalidatePatients(queryClient);
          toast(hg('[[המטופל נוצר|המטופלת נוצרה|הרשומה נוצרה]] בהצלחה', 'u'));
          return;
        } catch {
          toast('יצירה בשרת נכשלה · נשמר מקומית', 'error');
        }
      }
      const np = localPatient(payload);
      const base = { patients: [np, ...S.patients], errors: {}, demoEmpty: false };
      // Opt-in: jump straight into scheduling the new patient's first meeting.
      if (form.scheduleAfter) set({ ...base, dialog: 'schedule', apptForm: defaultScheduleForm(np.id) });
      else set({ ...base, dialog: null });
      toast(hg('[[המטופל נוצר|המטופלת נוצרה|הרשומה נוצרה]] בהצלחה', 'u'));
    }
  };

  // ===== archive patient =====
  const dp = S.dialogPatientId ? getPatient(S.patients, S.dialogPatientId) : null;
  const deleteName = dp ? dp.name : '';
  const confirmDelete = async () => {
    const removed = S.patients.find((p: any) => p.id === S.dialogPatientId);
    const idx = S.patients.findIndex((p: any) => p.id === S.dialogPatientId);
    const id = S.dialogPatientId;
    const navigateAway = S.patientId === id;
    // Archive is a client-side lifecycle state in BOTH modes — the backend has
    // no archive concept (docs/INTEGRATION.md). The record stays on the server.
    const archivedRecord = removed ? archivePatient(removed) : null;
    set({
      patients: S.patients.filter((p: any) => p.id !== S.dialogPatientId),
      archivedPatients: archivedRecord ? [archivedRecord, ...(S.archivedPatients || [])] : (S.archivedPatients || []),
      dialog: null,
      ...(navigateAway ? { route: 'patients', patientId: null } : {}),
    });
    toast('התיק הועבר לארכיון · ניתן לבטל', 'success', archivedRecord ? { label: 'ביטול', onClick: () => {
      set((s: any) => { const arr = s.patients.slice(); arr.splice(Math.max(0, idx), 0, removed); return {
        patients: arr,
        archivedPatients: (s.archivedPatients || []).filter((p: any) => p.id !== removed.id),
      }; }); toast('התיק שוחזר בהצלחה');
    } } : null);
  };

  // ===== permanent delete patient (from archive) =====
  const archivedPatient = S.dialogPatientId
    ? getPatient(S.patients, S.dialogPatientId, S.archivedPatients || [])
    : null;
  const permanentDeleteName = archivedPatient?.name || deleteName;
  const confirmDeletePatientPermanent = async () => {
    const id = S.dialogPatientId;
    if (!id) return;
    const removed = archivedPatient || S.patients.find((p: any) => p.id === id);
    const navigateAway = S.patientId === id;
    const postDeleteRoute = S.route === 'patientArchive' ? 'patientArchive' : 'patients';
    if (isApiConfigured()) {
      try {
        await deletePatient(id);
        set((s: any) => ({
          ...purgePatientReferences(id, s),
          patients: s.patients.filter((p: any) => p.id !== id),
          archivedPatients: (s.archivedPatients || []).filter((p: any) => p.id !== id),
          dialog: null,
          ...(navigateAway ? { route: postDeleteRoute, patientId: null } : {}),
        }));
        void invalidatePatients(queryClient);
        toast('התיק נמחק לצמיתות');
        return;
      } catch {
        toast('מחיקה בשרת נכשלה · נשמר מקומית', 'error');
      }
    }
    set((s: any) => ({
      ...purgePatientReferences(id, s),
      patients: s.patients.filter((p: any) => p.id !== id),
      archivedPatients: (s.archivedPatients || []).filter((p: any) => p.id !== id),
      dialog: null,
      ...(navigateAway ? { route: postDeleteRoute, patientId: null } : {}),
    }));
    toast('התיק נמחק לצמיתות · ניתן לבטל', 'success', removed ? {
      label: 'ביטול',
      onClick: () => {
        if (!removed.archived) {
          set((s: any) => ({ patients: [removed, ...s.patients] }));
        } else {
          set((s: any) => ({ archivedPatients: [removed, ...(s.archivedPatients || [])] }));
        }
        toast('התיק שוחזר');
      },
    } : null);
  };

  // ===== delete session =====
  const delSessionLabel = S.dialogSessionLabel || '';
  const confirmDelSession = () => {
    const key = S.dialogSessionKey;
    set((s: any) => ({ dialog: null, deletedSessions: key ? [...(s.deletedSessions || []), key] : (s.deletedSessions || []) }));
    toast('הפגישה הועברה לסל המיחזור · ניתן לבטל', 'success', key ? { label: 'ביטול', onClick: () => {
      set((s: any) => ({ deletedSessions: (s.deletedSessions || []).filter((k: any) => k !== key) })); toast('הפגישה שוחזרה');
    } } : null);
  };

  // ===== delete transcript + summary + re-upload =====
  const delTranscriptPid = S.dialogTranscriptPatientId || null;
  const delTranscriptName = delTranscriptPid ? getPatient(S.patients, delTranscriptPid, S.archivedPatients || []).name : '';
  const confirmDelTranscript = async () => {
    const pid = delTranscriptPid;
    if (!pid) { set({ dialog: null, dialogTranscriptPatientId: null, dialogMeetingId: null }); return; }
    const stored = S.transcriptsByPatient?.[pid];
    const meetingId = (S.dialogMeetingId && UUID_RE.test(String(S.dialogMeetingId)) && String(S.dialogMeetingId))
      || (stored?.meetingId && UUID_RE.test(String(stored.meetingId)) && String(stored.meetingId))
      || (S.meetingId && UUID_RE.test(String(S.meetingId)) && String(S.meetingId))
      || '';
    if (isApiConfigured() && meetingId) {
      try {
        await deleteMeetingTranscript(meetingId);
      } catch {
        toast('מחיקה בשרת נכשלה · נסו שוב', 'error');
        return;
      }
    }
    set((s: any) => {
      const map = { ...(s.transcriptsByPatient || {}) };
      delete map[pid];
      const edits = { ...(s.summaryEdits || {}) };
      delete edits[pid];
      const drafts = { ...(s.summaryDrafts || {}) };
      delete drafts[pid];
      return {
        transcriptsByPatient: map,
        summaryEdits: edits,
        summaryDrafts: drafts,
        activeTranscriptPatientId: s.activeTranscriptPatientId === pid ? null : s.activeTranscriptPatientId,
        dialog: null,
        dialogTranscriptPatientId: null,
        dialogMeetingId: null,
        meetingId: meetingId || s.meetingId,
        upload: { state: 'idle', progress: 0, fileName: '', error: '' },
        uploadPatientId: pid,
      };
    });
    void invalidateCalendar(queryClient);
    navigate('upload', { patientId: pid, ...(meetingId ? { meetingId } : {}) });
    toast('התמלול והסיכום נמחקו · ניתן להעלות אודיו חדש', 'success');
  };

  // ===== delete scheduled meeting (calendar / local) =====
  const delMeetingLabel = S.dialogMeetingLabel || '';
  const confirmDelMeeting = async () => {
    const eventId = S.dialogMeetingId;
    if (!eventId) return;
    const removedAppt = (S.scheduledAppts || []).find((a: any) => a.id === eventId) ?? null;
    const applyLocalRemoval = () => set((s: any) => ({
      dialog: null,
      calEventDetail: null,
      scheduledAppts: (s.scheduledAppts || []).filter((a: any) => a.id !== eventId),
      hiddenMeetingIds: [...new Set([...(s.hiddenMeetingIds || []), eventId])],
      calendarRefreshNonce: (s.calendarRefreshNonce || 0) + 1,
    }));
    const undoLocalRemoval = () => set((s: any) => ({
      hiddenMeetingIds: (s.hiddenMeetingIds || []).filter((id: string) => id !== eventId),
      scheduledAppts: removedAppt ? [...(s.scheduledAppts || []), removedAppt] : (s.scheduledAppts || []),
      calendarRefreshNonce: (s.calendarRefreshNonce || 0) + 1,
    }));
    const apiId = resolveCalendarEventApiId(eventId);
    if (isApiConfigured() && apiId) {
      try {
        await deleteCalendarEvent(eventId);
        applyLocalRemoval();
        void invalidateCalendar(queryClient);
        toast('הפגישה נמחקה');
        return;
      } catch {
        toast('מחיקה בשרת נכשלה · נשמר מקומית', 'error');
      }
    }
    applyLocalRemoval();
    toast('הפגישה נמחקה · ניתן לבטל', 'success', {
      label: 'ביטול',
      onClick: () => { undoLocalRemoval(); toast('הפגישה שוחזרה'); },
    });
  };

  // ===== wipe data =====
  const confirmWipe = () => { set({ dialog: null }); toast('בקשת מחיקת כל המידע נשלחה לעיבוד', 'error'); };

  // ===== delete account =====
  const confirmDeleteAccount = () => {
    if (deleteAccount()) toast('החשבון נמחק', 'info');
  };

  // ===== schedule appointment =====
  const apptForm = S.apptForm || {};
  const isEditAppt = !!apptForm.editId;
  const apptTodayKey = dayKey(new Date());
  const apptFormDate = (apptForm.date || apptTodayKey).trim();
  const apptTimeBorder = errors.apptTime ? 'var(--error)' : 'var(--primary-border)';
  const apptDateBorder = errors.apptDate ? 'var(--error)' : 'var(--primary-border)';
  const apptPatientOpts = S.patients.map((p: any) => ({ value: p.id, label: p.name }));
  const apptDurOpts = ['30', '45', '50', '60', '90'].map((d) => ({ value: d, label: d + ' דקות' }));
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const addMin = (t: string, m: number) => { const [h, mm] = t.split(':').map(Number); const tot = h * 60 + mm + m; return String(Math.floor(tot / 60)).padStart(2, '0') + ':' + String(tot % 60).padStart(2, '0'); };
  const formatApptDate = (key: string) => {
    const [y, mo, d] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(y, mo - 1, d));
  };
  const BASE_APPTS = isApiConfigured()
    ? []
    : [
      { time: '09:00', pid: 'p1', dur: 50 }, { time: '10:30', pid: 'p3', dur: 50 },
      { time: '13:00', pid: 'p2', dur: 50 }, { time: '16:00', pid: 'p5', dur: 50 },
    ];
  const allAppts = mergeAppointments(BASE_APPTS, S.scheduledAppts || []);
  let apptConflict = false, apptNoConflict = false, apptConflictMsg = '', apptConfirmMsg = '';
  {
    const t = (apptForm.time || '').trim();
    const okFmt = /^([01]?\d|2[0-3]):[0-5]\d$/.test(t);
    const okDate = /^\d{4}-\d{2}-\d{2}$/.test(apptFormDate);
    if (okFmt && okDate) {
      const start = toMin(t), dur = Number(apptForm.dur || 50), end = start + dur;
      const clash = allAppts.find((a: any) => {
        const aDate = a.date || apptTodayKey;
        if (aDate !== apptFormDate) return false;
        const s = toMin(a.time);
        return start < s + Number(a.dur || 50) && s < end;
      });
      if (clash) {
        const cp2 = getPatient(S.patients, clash.pid);
        apptConflict = true;
        apptConflictMsg = 'חופף לפגישה עם ' + (cp2 ? cp2.name : 'מטופל') + ' · ' + clash.time + '–' + addMin(clash.time, clash.dur) + ' · ניתן לקבוע בכל זאת';
      } else {
        apptNoConflict = true;
        apptConfirmMsg = formatApptDate(apptFormDate) + ' · השעה פנויה · הפגישה תסתיים ב-' + addMin(t, dur);
      }
    }
  }
  const submitAppt = async () => {
    const f = S.apptForm;
    const date = (f.date || apptTodayKey).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      set({ errors: { apptDate: 'יש לבחור תאריך תקין' } });
      setTimeout(() => { const el = document.querySelector<HTMLElement>('[data-field="appt-date"]'); if (el) el.focus(); }, 0);
      return;
    }
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test((f.time || '').trim())) {
      set({ errors: { apptTime: 'יש לבחור שעה לפגישה' } });
      setTimeout(() => { const el = document.querySelector<HTMLElement>('[data-field="appt-time"]'); if (el) el.focus(); }, 0);
      return;
    }
    const p = findPatient(S.patients, f.pid) ?? getPatient(S.patients, f.pid);
    const time = f.time.trim();
    const dur = Number(f.dur);
    const title = (p.name || '').trim() || 'פגישה';
    const description = (f.description || '').trim();

    // Edit an existing local appointment in place (single occurrence, no recurrence).
    if (f.editId) {
      set({
        scheduledAppts: (S.scheduledAppts || []).map((a: any) => a.id === f.editId ? { ...a, date, time, pid: f.pid, dur, description } : a),
        dialog: null, errors: {},
      });
      toast('הפגישה עם ' + p.name + ' עודכנה ל-' + formatApptDate(date) + ' · ' + time);
      return;
    }

    const recurCount = f.recur === 'weekly8' ? 8 : f.recur === 'weekly4' ? 4 : 1;
    const rand = Math.random().toString(36).slice(2, 7);
    const occurrences = Array.from({ length: recurCount }, (_, i) => {
      const d = new Date(date + 'T00:00:00');
      d.setDate(d.getDate() + i * 7);
      return { id: `sched-${Date.now()}-${i}-${rand}`, date: dayKey(d), time, pid: f.pid, dur, description, status: 'upcoming' as const };
    });

    if (isApiConfigured()) {
      try {
        const { start_at, end_at } = buildAppointmentTimes(time, dur, date);
        await createCalendarEvent({
          title,
          description: description || null,
          start_at,
          end_at,
          patient_id: f.pid,
        });
        set({
          calendarRefreshNonce: (S.calendarRefreshNonce || 0) + 1,
          dialog: null,
          errors: {},
        });
        void invalidateCalendar(queryClient);
        toast('הפגישה עם ' + p.name + ' נקבעה ל-' + formatApptDate(date) + ' · ' + time);
        return;
      } catch {
        toast('שמירה ביומן השרת נכשלה · הפגישה נשמרה מקומית', 'error');
      }
    }

    set({
      scheduledAppts: [...(S.scheduledAppts || []), ...occurrences],
      dialog: null,
      errors: {},
    });
    toast(recurCount > 1
      ? 'נקבעו ' + recurCount + ' פגישות שבועיות עם ' + p.name + ' · החל מ-' + formatApptDate(date)
      : 'הפגישה עם ' + p.name + ' נקבעה ל-' + formatApptDate(date) + ' · ' + time);
  };

  // ===== calendar event details =====
  const calEvent = isCalEvent ? (S.calEventDetail || null) : null;
  const calEventStart = calEvent ? new Date(calEvent.start) : null;
  const calEventEnd = calEvent ? new Date(calEvent.end) : null;
  const fmtEventTime = fmtTime;
  const calEventDateLabel = calEventStart
    ? new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(calEventStart)
    : '';
  const calEventTimeLabel = calEvent?.allDay
    ? 'כל היום'
    : calEventStart && calEventEnd
      ? fmtEventTime(calEventStart) + '–' + fmtEventTime(calEventEnd)
      : '';
  const openCalEventPatient = () => {
    if (!calEvent?.patientId) return;
    set({ dialog: null, calEventDetail: null });
    navigate('patient', { patientId: calEvent.patientId });
  };
  // "Previously on" recap: the patient's most recent session summary, so the
  // therapist sees where things stand before the meeting (and can hear it read).
  const calEventRecap = calEvent?.patientId ? sessionSummaries({ id: calEvent.patientId })[0] : '';
  const openCalEventReport = () => {
    if (!calEvent?.patientId) return;
    set({ dialog: null, calEventDetail: null });
    navigate('report', { patientId: calEvent.patientId });
  };
  const openCalEventUpload = () => {
    if (!calEvent?.patientId) return;
    navigate('upload', { dialog: null, calEventDetail: null, patientId: calEvent.patientId, upload: { state: 'idle', progress: 0, fileName: '', error: '' } });
  };
  // Only locally-scheduled appointments can be edited in place (fixture demo
  // events aren't in the local schedule).
  const editableAppt = calEvent ? (S.scheduledAppts || []).find((a: any) => a.id === calEvent.id) : null;
  const openCalEventEdit = () => {
    if (!editableAppt) return;
    set({
      dialog: 'schedule', calEventDetail: null,
      apptForm: { pid: editableAppt.pid, date: editableAppt.date, time: editableAppt.time, dur: String(editableAppt.dur), description: editableAppt.description || '', editId: editableAppt.id },
      errors: {},
    });
  };
  const openDeleteMeeting = () => {
    if (!calEvent) return;
    set({
      dialog: 'delMeeting',
      dialogMeetingId: calEvent.id,
      dialogMeetingLabel: calEvent.title + (calEventDateLabel ? ' · ' + calEventDateLabel : ''),
    });
  };

  return (
    <div onClick={closeDialog} onKeyDown={onDialogKey} style={{ position: 'fixed', inset: 0, background: 'rgba(15,28,46,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 160, padding: 20, animation: 'pop .2s ease' }}>
      {/* The read-only session-details dialog earns a wider canvas (840px) so its
          meta fields sit in a two-column grid and all actions fit one row. */}
      <div ref={trapRef} onClick={stop} role="dialog" aria-modal="true" aria-label="חלון פעולה" style={{ background: 'var(--paper)', borderRadius: 15, width: '100%', maxWidth: isCalEvent ? 840 : 520, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', boxShadow: '0 24px 70px rgba(8,20,40,.35)', animation: 'pop .25s ease' }}>

        {isForm && (
          <div>
            <div style={{ padding: '22px 26px', borderBottom: '1px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{dialogTitle}</h2>
              <svg onClick={closeDialog} className="shell-close-x" role="button" tabIndex={0} aria-label="סגירת החלון" viewBox="0 0 24 24" width="22" height="22" fill="var(--text-muted)" style={{ cursor: 'pointer' }}><path d={CLOSE_X} /></svg>
            </div>
            <div style={{ padding: '24px 26px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={{ gridColumn: '1/3' }}>
                  <label style={labelStyle}>שם מלא <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input ref={firstFieldRef} value={form.name} onInput={(e: any) => set({ form: { ...S.form, name: e.target.value }, errors: { ...S.errors, name: undefined } })} aria-label="שם מלא" aria-invalid={!!errors.name} aria-describedby="err-name" data-field="name" placeholder="שם המטופל" className="shell-input" style={{ width: '100%', height: 44, border: '1.5px solid ' + nameBorder, borderRadius: 10, padding: '0 12px', fontSize: 14.5, outline: 'none' }} />
                  {errors.name && <span id="err-name" role="alert" style={{ display: 'block', fontSize: 12.5, color: 'var(--error)', marginTop: 5 }}>{errors.name}</span>}
                </div>
                <div>
                  <label style={labelStyle}>טלפון <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input value={form.phone} onInput={(e: any) => set({ form: { ...S.form, phone: e.target.value }, errors: { ...S.errors, phone: undefined } })} aria-label="טלפון" aria-invalid={!!errors.phone} aria-describedby="err-phone" data-field="phone" inputMode="tel" placeholder="050-1234567" className="shell-input" style={{ width: '100%', height: 44, border: '1.5px solid ' + phoneBorder, borderRadius: 10, padding: '0 12px', fontSize: 14.5, outline: 'none' }} dir="ltr" />
                  {errors.phone && <span id="err-phone" role="alert" style={{ display: 'block', fontSize: 12.5, color: 'var(--error)', marginTop: 5 }}>{errors.phone}</span>}
                </div>
                <div>
                  <label style={labelStyle}>דוא״ל <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>(לא חובה)</span></label>
                  <input value={form.email} onInput={(e: any) => set({ form: { ...S.form, email: e.target.value }, errors: { ...S.errors, email: undefined } })} aria-label="דוא״ל" aria-invalid={!!errors.email} aria-describedby="err-email" data-field="email" inputMode="email" placeholder="dana@mail.com" className="shell-input" style={{ width: '100%', height: 44, border: '1.5px solid ' + emailBorder, borderRadius: 10, padding: '0 12px', fontSize: 14.5, outline: 'none' }} dir="ltr" />
                  {errors.email && <span id="err-email" role="alert" style={{ display: 'block', fontSize: 12.5, color: 'var(--error)', marginTop: 5 }}>{errors.email}</span>}
                </div>
                <div>
                  <label style={labelStyle}>כתובת <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>(לא חובה)</span></label>
                  <input value={form.address || ''} onInput={(e: any) => set({ form: { ...S.form, address: e.target.value } })} aria-label="כתובת" data-field="address" placeholder="רחוב, עיר" className="shell-input" style={{ width: '100%', height: 44, border: '1.5px solid var(--primary-border)', borderRadius: 10, padding: '0 12px', fontSize: 14.5, outline: 'none' }} />
                </div>
                {dupMatch && (
                  <div role="status" data-testid="dup-warning" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--warning-bg)', border: '1px solid var(--warning-strong)', fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
                    <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 1, fontWeight: 700, color: 'var(--warning-strong)' }}>!</span>
                    <span>ייתכן שהמטופל <strong style={{ fontWeight: 600, color: 'var(--text)' }}>{dupMatch.name}</strong> כבר קיים במערכת (טלפון או דוא״ל זהים). אפשר להמשיך בכל זאת.</span>
                  </div>
                )}
                {S.dialog === 'create' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 14, color: 'var(--text-2)', marginTop: 2 }}>
                    <Checkbox checked={!!form.scheduleAfter} onChange={(e: any) => set({ form: { ...S.form, scheduleAfter: e.target.checked } })} aria-label="קביעת פגישה ראשונה לאחר היצירה" />
                    קביעת פגישה ראשונה לאחר היצירה
                  </label>
                )}
              </div>
            </div>
            <div style={{ padding: '16px 26px', borderTop: '1px solid var(--bg)', display: 'flex', gap: 10, justifyContent: 'flex-start' }}>
              <button onClick={submitPatient} style={btnPrimary}>{dialogSubmitLabel}</button>
              <button onClick={closeDialog} style={btnCancel}>ביטול</button>
            </div>
          </div>
        )}

        {isDelete && (
          <ConfirmDialog icon={IC_TRASH} title="העברת התיק לארכיון" confirmLabel="העברה לארכיון" onConfirm={confirmDelete} onCancel={closeDialog}>
            התיק של <b>{deleteName}</b> יוסר מרשימת המטופלים הפעילים ויועבר לארכיון. ניתן לשחזר אותו בכל עת מעמוד הארכיון.
          </ConfirmDialog>
        )}

        {isDeletePatientPermanent && (
          <ConfirmDialog icon={IC_TRASH} title="מחיקת מטופל לצמיתות" confirmLabel="מחיקה לצמיתות" onConfirm={confirmDeletePatientPermanent} onCancel={closeDialog}>
            התיק של <b>{permanentDeleteName}</b> יימחק לצמיתות יחד עם כל הנתונים המשויכים אליו. לא ניתן לשחזר את הפעולה.
          </ConfirmDialog>
        )}

        {isDelSession && (
          <ConfirmDialog icon={IC_TRASH} title="מחיקת פגישה" confirmLabel="מחיקת הפגישה" onConfirm={confirmDelSession} onCancel={closeDialog}>
            ההקלטה, התמלול וניתוח ה-AI של <b>{delSessionLabel}</b> יועברו לסל המיחזור. שאר תיק המטופל יישאר כמות שהוא, ותוכלו לבטל את הפעולה מיד לאחר ביצועה.
          </ConfirmDialog>
        )}

        {isDelTranscript && (
          <ConfirmDialog icon={IC_TRASH} title="מחיקת תמלול וסיכום" confirmLabel="מחיקה והעלאה מחדש" onConfirm={() => { void confirmDelTranscript(); }} onCancel={closeDialog}>
            התמלול והסיכום{delTranscriptName ? <> של <b>{delTranscriptName}</b></> : ''} יימחקו ותועברו לעמוד ההעלאה כדי להעלות הקלטה חדשה לפגישה זו.
          </ConfirmDialog>
        )}

        {isDelMeeting && (
          <ConfirmDialog icon={IC_TRASH} title="מחיקת פגישה מתוכננת" confirmLabel="מחיקת הפגישה" onConfirm={confirmDelMeeting} onCancel={closeDialog}>
            הפגישה <b>{delMeetingLabel}</b> תימחק מהיומן. הפעולה אינה הפיכה כאשר מחוברים לשרת.
          </ConfirmDialog>
        )}

        {isWipe && (
          <ConfirmDialog
            icon={IC_WARN}
            iconBg="var(--surface-2)"
            title="מחיקת כל המידע בחשבון"
            confirmLabel="מחיקה מלאה לצמיתות"
            onConfirm={confirmWipe}
            onCancel={closeDialog}
            extra={<div style={{ background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, padding: '12px 14px', marginBottom: 18, fontSize: 13, color: 'var(--text-secondary)' }}>להמשך, וודאו שגיביתם כל מידע שתרצו לשמור.</div>}
          >
            פעולה זו תמחק לצמיתות את <b>כל</b> המטופלים, הפגישות, התמלולים וניתוחי ה-AI בחשבונכם. הפעולה אינה הפיכה.
          </ConfirmDialog>
        )}

        {isDeleteAccount && (
          <ConfirmDialog icon={IC_ACCOUNT} title="מחיקת חשבון" confirmLabel="מחיקת החשבון לצמיתות" onConfirm={confirmDeleteAccount} onCancel={closeDialog}>
            פעולה זו תמחק לצמיתות את החשבון שלכם, כולל כל המטופלים, הפגישות והנתונים השמורים במכשיר זה. לא תוכלו להתחבר שוב עם אותם פרטים, והפעולה אינה הפיכה.
          </ConfirmDialog>
        )}

        {isSchedule && (
          <div>
            <div style={{ padding: '22px 26px', borderBottom: '1px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{isEditAppt ? 'עריכת פגישה' : 'קביעת פגישה חדשה'}</h2>
              <svg onClick={closeDialog} className="shell-close-x" role="button" tabIndex={0} aria-label="סגירה" viewBox="0 0 24 24" width="22" height="22" fill="var(--text-muted)" style={{ cursor: 'pointer' }}><path d={CLOSE_X} /></svg>
            </div>
            <div style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>מטופל <span style={{ color: 'var(--error)' }}>*</span></label>
                <select value={apptForm.pid} onChange={(e: any) => set({ apptForm: { ...S.apptForm, pid: e.target.value } })} aria-label="בחירת מטופל" className="app-select" style={{ width: '100%' }}>
                  {apptPatientOpts.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>תאריך <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input ref={firstFieldRef} type="date" value={apptFormDate} onChange={(e: any) => set({ apptForm: { ...S.apptForm, date: e.target.value }, errors: {} })} aria-label="תאריך הפגישה" aria-invalid={!!errors.apptDate} aria-describedby="err-appt-date" data-field="appt-date" dir="ltr" className="shell-input" style={{ width: '100%', height: 44, border: '1.5px solid ' + apptDateBorder, borderRadius: 10, padding: '0 12px', fontSize: 14.5, outline: 'none', textAlign: 'start', fontFamily: 'inherit' }} />
                  {errors.apptDate && <div id="err-appt-date" role="alert" style={{ fontSize: 12, color: 'var(--error)', marginTop: 5 }}>{errors.apptDate}</div>}
                </div>
                <div>
                  <label style={labelStyle}>שעה <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input type="time" value={apptForm.time} onChange={(e: any) => set({ apptForm: { ...S.apptForm, time: e.target.value }, errors: {} })} aria-label="שעת הפגישה" aria-invalid={!!errors.apptTime} aria-describedby="err-appt-time" data-field="appt-time" dir="ltr" className="shell-input" style={{ width: '100%', height: 44, border: '1.5px solid ' + apptTimeBorder, borderRadius: 10, padding: '0 12px', fontSize: 14.5, outline: 'none', textAlign: 'start' }} />
                  {errors.apptTime && <div id="err-appt-time" role="alert" style={{ fontSize: 12, color: 'var(--error)', marginTop: 5 }}>{errors.apptTime}</div>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>משך</label>
                  <select value={apptForm.dur} onChange={(e: any) => set({ apptForm: { ...S.apptForm, dur: e.target.value } })} aria-label="משך הפגישה" className="app-select" style={{ width: '100%' }}>
                    {apptDurOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {!isEditAppt && (
                  <div>
                    <label style={labelStyle}>חזרה</label>
                    <select value={apptForm.recur || 'none'} onChange={(e: any) => set({ apptForm: { ...S.apptForm, recur: e.target.value } })} aria-label="חזרה על הפגישה" className="app-select" style={{ width: '100%' }}>
                      <option value="none">חד-פעמית</option>
                      <option value="weekly4">שבועית · 4 מפגשים</option>
                      <option value="weekly8">שבועית · 8 מפגשים</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>תיאור <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>(לא חובה)</span></label>
                <textarea value={apptForm.description || ''} onInput={(e: any) => set({ apptForm: { ...S.apptForm, description: e.target.value } })} aria-label="תיאור הפגישה" placeholder="הערות, נושאים לדיון, מיקום..." rows={3} className="shell-input" style={{ width: '100%', minHeight: 88, border: '1.5px solid var(--primary-border)', borderRadius: 10, padding: '10px 12px', fontSize: 14.5, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
              </div>
              {apptNoConflict && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, padding: '11px 14px' }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--primary)" style={{ flexShrink: 0 }}><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                  <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{apptConfirmMsg}</span>
                </div>
              )}
              {apptConflict && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, background: 'var(--paper)', border: '1px solid var(--divider)', borderRadius: 10, padding: '11px 14px' }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--warning-strong)" style={{ flexShrink: 0, marginTop: 1 }}><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
                  <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{apptConflictMsg}</span>
                </div>
              )}
            </div>
            <div style={{ padding: '16px 26px', borderTop: '1px solid var(--bg)', display: 'flex', gap: 10, justifyContent: 'flex-start' }}>
              <button onClick={submitAppt} style={btnPrimary}>{isEditAppt ? 'שמירת שינויים' : 'קביעת פגישה'}</button>
              <button onClick={closeDialog} style={btnCancel}>ביטול</button>
            </div>
          </div>
        )}

        {isCalEvent && calEvent && (
          <div>
            <div style={{ padding: '22px 26px', borderBottom: '1px solid var(--bg)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 700 }}>{calEvent.title}</h2>
                <span style={{ display: 'inline-flex', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{calEvent.statusLabel}</span>
              </div>
              <svg onClick={closeDialog} className="shell-close-x" role="button" tabIndex={0} aria-label="סגירה" viewBox="0 0 24 24" width="22" height="22" fill="var(--text-muted)" style={{ cursor: 'pointer', flexShrink: 0 }}><path d={CLOSE_X} /></svg>
            </div>
            <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Meta fields in a responsive 2-up grid — the wide dialog reads as one
                  compact scan line pair instead of a tall single column. */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '16px 22px', background: 'var(--surface-2)', border: '1px solid var(--divider)', borderRadius: 12, padding: '16px 18px' }}>
                <div>
                  <div style={labelStyle}>תאריך</div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5 }}>{calEventDateLabel}</div>
                </div>
                <div>
                  <div style={labelStyle}>שעה</div>
                  <div dir="ltr" style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5, textAlign: 'start' }}>{calEventTimeLabel}</div>
                </div>
                {calEvent.guestName && (
                  <div>
                    <div style={labelStyle}>מטופל</div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5 }}>{calEvent.guestName}</div>
                  </div>
                )}
                {calEvent.location && (
                  <div>
                    <div style={labelStyle}>מיקום</div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5 }}>{calEvent.location}</div>
                  </div>
                )}
              </div>
              {calEvent.description && (
                <div>
                  <div style={labelStyle}>תיאור</div>
                  <div style={{ fontSize: 14.5, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{calEvent.description}</div>
                </div>
              )}
              {calEvent.patientId && calEventRecap && (
                <div style={{ background: 'var(--primary-surface)', border: '1px solid var(--primary-border)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8z" /></svg>
                      מהפגישה הקודמת
                    </div>
                    {tts.supported && (
                      <button
                        type="button"
                        onClick={() => tts.toggle('מהפגישה הקודמת. ' + calEventRecap)}
                        aria-label={tts.speaking ? 'עצירת ההקראה' : 'הקראת סיכום הפגישה הקודמת'}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 11px', border: '1px solid var(--primary-border)', borderRadius: 8, background: 'var(--paper)', color: 'var(--primary)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                      >
                        {tts.speaking ? (
                          <><svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M6 6h4v12H6zm8 0h4v12h-4z" /></svg>עצירה</>
                        ) : (
                          <><svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>השמעה</>
                        )}
                      </button>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-2)' }}>{calEventRecap}</p>
                </div>
              )}
            </div>
            {/* Benign actions grouped together; the destructive delete is pushed to
                the opposite edge so it isn't fat-fingered among navigation buttons. */}
            <div style={{ padding: '16px 26px', borderTop: '1px solid var(--bg)', display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {calEvent.patientId && (
                  <button onClick={openCalEventPatient} style={btnPrimary}>מעבר לתיק המטופל</button>
                )}
                {calEvent.patientId && (
                  <button onClick={openCalEventUpload} style={btnCancel}>העלאת הקלטה</button>
                )}
                {calEvent.patientId && (
                  <button onClick={openCalEventReport} style={btnCancel}>דוח הכנה</button>
                )}
                {editableAppt && (
                  <button onClick={openCalEventEdit} style={btnCancel}>עריכת הפגישה</button>
                )}
                <button onClick={closeDialog} style={btnCancel}>סגירה</button>
              </div>
              <button onClick={openDeleteMeeting} className="shell-danger-btn" style={btnDanger}>מחיקת הפגישה</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dialogs() {
  return (
    <>
      <ShortcutsDialog />
      <ActionDialog />
    </>
  );
}
