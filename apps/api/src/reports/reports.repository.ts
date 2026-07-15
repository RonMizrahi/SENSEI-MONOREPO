import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CalendarEvent } from '../calendar/entities/calendar-event.entity';
import { Patient } from '../patients/entities/patient.entity';
import { MeetingSummary } from '../summaries/entities/meeting-summary.entity';
import { PatientReport } from './entities/patient-report.entity';
import { STATUS_FAILED, STATUS_PENDING, STATUS_READY, STATUS_RUNNING } from './reports.constants';

/** Injection token for the reports data layer (TypeORM in production, seeded in-memory in MOCK_MODE). */
export const REPORTS_REPOSITORY = Symbol('REPORTS_REPOSITORY');

/** One ready meeting summary joined to its calendar event (ordered by start_at). */
export interface ReadyMeetingSummary {
  meetingId: string;
  text: string;
}

/** Fields written when a generation run succeeds. */
export interface ReadyReportFields {
  intro: string;
  changes: string[];
  openTopics: string[];
  sourceMeetingIds: string[];
  lastSummaryExcerpt: string | null;
  generatedAt: Date;
  model: string;
}

/** Fresh field values for a wiped 'pending' report row (fresh arrays every call). */
export function pendingResetFields(): Pick<
  PatientReport,
  | 'status'
  | 'intro'
  | 'changes'
  | 'openTopics'
  | 'sourceMeetingIds'
  | 'lastSummaryExcerpt'
  | 'generatedAt'
  | 'model'
  | 'error'
> {
  return {
    status: STATUS_PENDING,
    intro: null,
    changes: [],
    openTopics: [],
    sourceMeetingIds: [],
    lastSummaryExcerpt: null,
    generatedAt: null,
    model: '',
    error: null,
  };
}

/** All persistence for the next-meeting prep report lifecycle. */
export interface ReportsRepository {
  /** Whether a patient row exists for the id. */
  patientExists(patientId: string): Promise<boolean>;
  /** Whether the therapist owns at least one meeting with the patient. */
  therapistHasMeetingWithPatient(patientId: string, therapistId: string): Promise<boolean>;
  /** The patient's report row, or null when none was ever requested. */
  findByPatientId(patientId: string): Promise<PatientReport | null>;
  /** Creates or wipes the patient's report row back to a clean 'pending' state. */
  resetToPending(patientId: string): Promise<PatientReport>;
  /** Marks the patient's report row 'running'. */
  markRunning(patientId: string): Promise<void>;
  /** Marks the patient's report row 'ready' with the generated content. */
  markReady(patientId: string, fields: ReadyReportFields): Promise<void>;
  /** Marks the patient's report row 'failed' with a user-facing error. */
  markFailed(patientId: string, error: string): Promise<void>;
  /** The therapist's READY summaries for the patient, ordered by start time (oldest first). */
  findReadySummaries(patientId: string, therapistId: string): Promise<ReadyMeetingSummary[]>;
  /**
   * Fails every row stranded 'running' (startup sweep after a crash/restart).
   * @returns The number of rows swept.
   */
  failStrandedRunning(error: string): Promise<number>;
}

/** TypeORM-backed reports repository — owns every query for the reports module. */
@Injectable()
export class TypeormReportsRepository implements ReportsRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Whether a patient row exists for the id. */
  patientExists(patientId: string): Promise<boolean> {
    return this.dataSource.getRepository(Patient).existsBy({ id: patientId });
  }

  /** Whether the therapist owns at least one meeting with the patient. */
  therapistHasMeetingWithPatient(patientId: string, therapistId: string): Promise<boolean> {
    return this.dataSource
      .getRepository(CalendarEvent)
      .exists({ where: { patientId, therapistId } });
  }

  /** The patient's report row, or null when none was ever requested. */
  findByPatientId(patientId: string): Promise<PatientReport | null> {
    return this.dataSource.getRepository(PatientReport).findOne({ where: { patientId } });
  }

  /** Creates or wipes the patient's report row back to a clean 'pending' state (atomic upsert). */
  async resetToPending(patientId: string): Promise<PatientReport> {
    const repository = this.dataSource.getRepository(PatientReport);
    // ON CONFLICT (patient_id) DO UPDATE — concurrent first POSTs cannot violate the unique key
    await repository.upsert({ patientId, ...pendingResetFields() }, ['patientId']);
    const report = await repository.findOne({ where: { patientId } });
    if (!report) throw new Error(`patient report upsert did not persist for ${patientId}`);
    return report;
  }

  /** Marks the patient's report row 'running'. */
  async markRunning(patientId: string): Promise<void> {
    await this.dataSource
      .getRepository(PatientReport)
      .update({ patientId }, { status: STATUS_RUNNING });
  }

  /** Marks the patient's report row 'ready' with the generated content. */
  async markReady(patientId: string, fields: ReadyReportFields): Promise<void> {
    await this.dataSource.getRepository(PatientReport).update(
      { patientId },
      {
        status: STATUS_READY,
        intro: fields.intro,
        changes: fields.changes,
        openTopics: fields.openTopics,
        sourceMeetingIds: fields.sourceMeetingIds,
        lastSummaryExcerpt: fields.lastSummaryExcerpt,
        generatedAt: fields.generatedAt,
        model: fields.model,
        error: null,
      },
    );
  }

  /** Marks the patient's report row 'failed' with a user-facing error. */
  async markFailed(patientId: string, error: string): Promise<void> {
    await this.dataSource
      .getRepository(PatientReport)
      .update({ patientId }, { status: STATUS_FAILED, error });
  }

  /** The therapist's READY summaries for the patient, ordered by start time (oldest first). */
  async findReadySummaries(
    patientId: string,
    therapistId: string,
  ): Promise<ReadyMeetingSummary[]> {
    const summaries = await this.dataSource
      .getRepository(MeetingSummary)
      .createQueryBuilder('summary')
      .innerJoin(CalendarEvent, 'event', 'event.id = summary.meetingId')
      .where('event.patientId = :patientId', { patientId })
      .andWhere('event.therapistId = :therapistId', { therapistId })
      .andWhere('summary.status = :status', { status: STATUS_READY })
      .orderBy('event.startAt', 'ASC')
      .getMany();
    return summaries.map((summary) => ({
      meetingId: summary.meetingId,
      text: summary.text ?? '',
    }));
  }

  /** Fails every row stranded 'running' (startup sweep after a crash/restart). */
  async failStrandedRunning(error: string): Promise<number> {
    const result = await this.dataSource
      .getRepository(PatientReport)
      .update({ status: STATUS_RUNNING }, { status: STATUS_FAILED, error });
    return result.affected ?? 0;
  }
}
