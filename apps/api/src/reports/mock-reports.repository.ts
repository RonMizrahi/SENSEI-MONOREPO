import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SEED_EVENTS, SEED_PATIENTS, SEED_SUMMARY_TEXT } from '../mock/seed';
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

  /** Whether the id belongs to a seeded demo patient. */
  patientExists(patientId: string): Promise<boolean> {
    return Promise.resolve(SEED_PATIENTS.some((patient) => patient.id === patientId));
  }

  /** The patient's report row, or null when none was ever requested. */
  findByPatientId(patientId: string): Promise<PatientReport | null> {
    return Promise.resolve(this.reports.get(patientId) ?? null);
  }

  /** Creates or wipes the patient's report row back to a clean 'pending' state. */
  resetToPending(patientId: string): Promise<PatientReport> {
    const existing = this.reports.get(patientId);
    const report = existing ?? new PatientReport();
    if (!existing) {
      report.id = randomUUID();
      report.patientId = patientId;
      report.createdAt = new Date();
    }
    Object.assign(report, pendingResetFields());
    report.updatedAt = new Date();
    this.reports.set(patientId, report);
    return Promise.resolve(report);
  }

  /** Marks the patient's report row 'running'. */
  markRunning(patientId: string): Promise<void> {
    const report = this.reports.get(patientId);
    if (report) {
      report.status = STATUS_RUNNING;
      report.updatedAt = new Date();
    }
    return Promise.resolve();
  }

  /** Marks the patient's report row 'ready' with the generated content. */
  markReady(patientId: string, fields: ReadyReportFields): Promise<void> {
    const report = this.reports.get(patientId);
    if (report) {
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
    return Promise.resolve();
  }

  /** Marks the patient's report row 'failed' with a user-facing error. */
  markFailed(patientId: string, error: string): Promise<void> {
    const report = this.reports.get(patientId);
    if (report) {
      report.status = STATUS_FAILED;
      report.error = error;
      report.updatedAt = new Date();
    }
    return Promise.resolve();
  }

  /** Every seeded meeting of the patient counts as a ready summary (canned text). */
  findReadySummaries(patientId: string): Promise<ReadyMeetingSummary[]> {
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
