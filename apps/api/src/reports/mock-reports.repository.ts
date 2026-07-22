import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SEED_EVENTS, SEED_PATIENTS, SEED_SUMMARY_TEXT, SEED_USER } from '../mock/seed';
import { PatientReport } from './entities/patient-report.entity';
import {
  pendingResetFields,
  ReadyMeetingSummary,
  ReadyReportFields,
  ReportsRepository,
} from './reports.repository';
import { STATUS_FAILED, STATUS_READY, STATUS_RUNNING } from './reports.constants';

/** Seeded in-memory reports repository for MOCK_MODE — no database required. */
@Injectable()
export class MockReportsRepository implements ReportsRepository {
  private readonly reports = new Map<string, PatientReport>();

  /**
   * Composite in-memory key. The per-patient next-meeting row keys on
   * (patient, therapist); a per-meeting row appends the meeting id so the two
   * kinds never alias (mirrors the partial unique indexes).
   */
  private keyFor(patientId: string, therapistId: string, meetingId: string | null = null): string {
    return meetingId === null
      ? `${patientId}:${therapistId}`
      : `${patientId}:${therapistId}:${meetingId}`;
  }

  /** Wipes (or creates) the row at `key` back to a clean 'pending' state. */
  private resetRow(key: string, patientId: string, therapistId: string, meetingId: string | null): PatientReport {
    const existing = this.reports.get(key);
    const report = existing ?? new PatientReport();
    if (!existing) {
      report.id = randomUUID();
      report.patientId = patientId;
      report.therapistId = therapistId;
      report.createdAt = new Date();
    }
    Object.assign(report, pendingResetFields());
    report.meetingId = meetingId;
    report.updatedAt = new Date();
    this.reports.set(key, report);
    return report;
  }

  /** Applies the generated 'ready' content to a stored row. */
  private applyReady(report: PatientReport, fields: ReadyReportFields): void {
    report.status = STATUS_READY;
    report.intro = fields.intro;
    report.changes = fields.changes;
    report.openTopics = fields.openTopics;
    report.sourceMeetingIds = fields.sourceMeetingIds;
    report.lastSummaryExcerpt = fields.lastSummaryExcerpt;
    report.generatedAt = fields.generatedAt;
    report.model = fields.model;
    report.error = null;
    report.updatedAt = new Date();
  }

  /** Whether the id belongs to a seeded demo patient. */
  patientExists(patientId: string): Promise<boolean> {
    return Promise.resolve(SEED_PATIENTS.some((patient) => patient.id === patientId));
  }

  /** Whether SEED_USER owns a seeded meeting with the patient (parity scoping). */
  therapistHasMeetingWithPatient(patientId: string, therapistId: string): Promise<boolean> {
    return Promise.resolve(
      therapistId === SEED_USER.id && SEED_EVENTS.some((event) => event.patientId === patientId),
    );
  }

  /** Whether SEED_USER owns the seeded meeting for the patient. */
  meetingBelongsToPatientAndTherapist(
    patientId: string,
    therapistId: string,
    meetingId: string,
  ): Promise<boolean> {
    return Promise.resolve(
      therapistId === SEED_USER.id &&
        SEED_EVENTS.some((event) => event.id === meetingId && event.patientId === patientId),
    );
  }

  /** The therapist's next-meeting report row for the patient, or null when none was requested. */
  findByPatientAndTherapist(
    patientId: string,
    therapistId: string,
  ): Promise<PatientReport | null> {
    return Promise.resolve(this.reports.get(this.keyFor(patientId, therapistId)) ?? null);
  }

  /** Creates or wipes the therapist's next-meeting report row back to a clean 'pending' state. */
  resetToPending(patientId: string, therapistId: string): Promise<PatientReport> {
    return Promise.resolve(
      this.resetRow(this.keyFor(patientId, therapistId), patientId, therapistId, null),
    );
  }

  /** Marks the therapist's next-meeting report row 'running'. */
  markRunning(patientId: string, therapistId: string): Promise<void> {
    const report = this.reports.get(this.keyFor(patientId, therapistId));
    if (report) {
      report.status = STATUS_RUNNING;
      report.updatedAt = new Date();
    }
    return Promise.resolve();
  }

  /** Marks the therapist's next-meeting report row 'ready' with the generated content. */
  markReady(patientId: string, therapistId: string, fields: ReadyReportFields): Promise<void> {
    const report = this.reports.get(this.keyFor(patientId, therapistId));
    if (report) this.applyReady(report, fields);
    return Promise.resolve();
  }

  /** Marks the therapist's next-meeting report row 'failed' with a user-facing error. */
  markFailed(patientId: string, therapistId: string, error: string): Promise<void> {
    const report = this.reports.get(this.keyFor(patientId, therapistId));
    if (report) {
      report.status = STATUS_FAILED;
      report.error = error;
      report.updatedAt = new Date();
    }
    return Promise.resolve();
  }

  /** The therapist's per-meeting report rows for the patient (newest first). */
  listMeetingReports(patientId: string, therapistId: string): Promise<PatientReport[]> {
    const rows = [...this.reports.values()]
      .filter(
        (report) =>
          report.patientId === patientId &&
          report.therapistId === therapistId &&
          report.meetingId !== null,
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return Promise.resolve(rows);
  }

  /** The therapist's report row for a specific meeting, or null when none was requested. */
  findByMeeting(
    patientId: string,
    therapistId: string,
    meetingId: string,
  ): Promise<PatientReport | null> {
    return Promise.resolve(this.reports.get(this.keyFor(patientId, therapistId, meetingId)) ?? null);
  }

  /** Creates or wipes the therapist's per-meeting report row back to a clean 'pending' state. */
  resetMeetingToPending(
    patientId: string,
    therapistId: string,
    meetingId: string,
  ): Promise<PatientReport> {
    return Promise.resolve(
      this.resetRow(this.keyFor(patientId, therapistId, meetingId), patientId, therapistId, meetingId),
    );
  }

  /** Marks the therapist's per-meeting report row 'running'. */
  markMeetingRunning(patientId: string, therapistId: string, meetingId: string): Promise<void> {
    const report = this.reports.get(this.keyFor(patientId, therapistId, meetingId));
    if (report) {
      report.status = STATUS_RUNNING;
      report.updatedAt = new Date();
    }
    return Promise.resolve();
  }

  /** Marks the therapist's per-meeting report row 'ready' with the generated content. */
  markMeetingReady(
    patientId: string,
    therapistId: string,
    meetingId: string,
    fields: ReadyReportFields,
  ): Promise<void> {
    const report = this.reports.get(this.keyFor(patientId, therapistId, meetingId));
    if (report) this.applyReady(report, fields);
    return Promise.resolve();
  }

  /** Marks the therapist's per-meeting report row 'failed' with a user-facing error. */
  markMeetingFailed(
    patientId: string,
    therapistId: string,
    meetingId: string,
    error: string,
  ): Promise<void> {
    const report = this.reports.get(this.keyFor(patientId, therapistId, meetingId));
    if (report) {
      report.status = STATUS_FAILED;
      report.error = error;
      report.updatedAt = new Date();
    }
    return Promise.resolve();
  }

  /** The therapist's seeded meetings for the patient count as ready summaries (canned text). */
  findReadySummaries(patientId: string, therapistId: string): Promise<ReadyMeetingSummary[]> {
    if (therapistId !== SEED_USER.id) return Promise.resolve([]);
    const summaries = SEED_EVENTS.filter((event) => event.patientId === patientId)
      .sort((a, b) => a.dayOffset - b.dayOffset || a.startHour - b.startHour)
      .map((event) => ({ meetingId: event.id, text: SEED_SUMMARY_TEXT }));
    return Promise.resolve(summaries);
  }

  /** Fails every row stranded 'running' (startup sweep after a crash/restart). */
  failStrandedRunning(error: string): Promise<number> {
    let swept = 0;
    for (const report of this.reports.values()) {
      if (report.status === STATUS_RUNNING) {
        report.status = STATUS_FAILED;
        report.error = error;
        report.updatedAt = new Date();
        swept += 1;
      }
    }
    return Promise.resolve(swept);
  }
}
