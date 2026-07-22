import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull, Not } from 'typeorm';
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

/** All persistence for the prep report lifecycle (per-patient next-meeting + per-meeting). */
export interface ReportsRepository {
  /** Whether a patient row exists for the id. */
  patientExists(patientId: string): Promise<boolean>;
  /** Whether the therapist owns at least one meeting with the patient. */
  therapistHasMeetingWithPatient(patientId: string, therapistId: string): Promise<boolean>;
  /** Whether the meeting exists AND is owned by (patient, therapist). */
  meetingBelongsToPatientAndTherapist(
    patientId: string,
    therapistId: string,
    meetingId: string,
  ): Promise<boolean>;
  /** The therapist's next-meeting report row for the patient (meeting_id IS NULL), or null. */
  findByPatientAndTherapist(patientId: string, therapistId: string): Promise<PatientReport | null>;
  /** Creates or wipes the therapist's next-meeting report row (meeting_id IS NULL) to 'pending'. */
  resetToPending(patientId: string, therapistId: string): Promise<PatientReport>;
  /** Marks the therapist's next-meeting report row (meeting_id IS NULL) 'running'. */
  markRunning(patientId: string, therapistId: string): Promise<void>;
  /** Marks the therapist's next-meeting report row (meeting_id IS NULL) 'ready'. */
  markReady(patientId: string, therapistId: string, fields: ReadyReportFields): Promise<void>;
  /** Marks the therapist's next-meeting report row (meeting_id IS NULL) 'failed'. */
  markFailed(patientId: string, therapistId: string, error: string): Promise<void>;
  /** The therapist's per-meeting report rows for the patient (newest first). */
  listMeetingReports(patientId: string, therapistId: string): Promise<PatientReport[]>;
  /** The therapist's report row for a specific meeting, or null when none was requested. */
  findByMeeting(
    patientId: string,
    therapistId: string,
    meetingId: string,
  ): Promise<PatientReport | null>;
  /** Creates or wipes the therapist's per-meeting report row back to a clean 'pending' state. */
  resetMeetingToPending(
    patientId: string,
    therapistId: string,
    meetingId: string,
  ): Promise<PatientReport>;
  /** Marks the therapist's per-meeting report row 'running'. */
  markMeetingRunning(patientId: string, therapistId: string, meetingId: string): Promise<void>;
  /** Marks the therapist's per-meeting report row 'ready' with the generated content. */
  markMeetingReady(
    patientId: string,
    therapistId: string,
    meetingId: string,
    fields: ReadyReportFields,
  ): Promise<void>;
  /** Marks the therapist's per-meeting report row 'failed' with a user-facing error. */
  markMeetingFailed(
    patientId: string,
    therapistId: string,
    meetingId: string,
    error: string,
  ): Promise<void>;
  /** The therapist's READY summaries for the patient, ordered by start time (oldest first). */
  findReadySummaries(patientId: string, therapistId: string): Promise<ReadyMeetingSummary[]>;
  /**
   * Fails every row stranded 'running' (startup sweep after a crash/restart).
   * @returns The number of rows swept.
   */
  failStrandedRunning(error: string): Promise<number>;
}

/** Partial-index predicate isolating the per-patient next-meeting report row. */
const NEXT_MEETING_PREDICATE = 'meeting_id IS NULL';
/** Partial-index predicate isolating the per-meeting report rows. */
const PER_MEETING_PREDICATE = 'meeting_id IS NOT NULL';

/** The `ready` field values shared by the per-patient and per-meeting mark-ready updates. */
function readyUpdate(fields: ReadyReportFields): Partial<PatientReport> {
  return {
    status: STATUS_READY,
    intro: fields.intro,
    changes: fields.changes,
    openTopics: fields.openTopics,
    sourceMeetingIds: fields.sourceMeetingIds,
    lastSummaryExcerpt: fields.lastSummaryExcerpt,
    generatedAt: fields.generatedAt,
    model: fields.model,
    error: null,
  };
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

  /** Whether the meeting exists AND is owned by (patient, therapist). */
  meetingBelongsToPatientAndTherapist(
    patientId: string,
    therapistId: string,
    meetingId: string,
  ): Promise<boolean> {
    return this.dataSource
      .getRepository(CalendarEvent)
      .exists({ where: { id: meetingId, patientId, therapistId } });
  }

  /** The therapist's next-meeting report row for the patient (meeting_id IS NULL), or null. */
  findByPatientAndTherapist(
    patientId: string,
    therapistId: string,
  ): Promise<PatientReport | null> {
    return this.dataSource
      .getRepository(PatientReport)
      .findOne({ where: { patientId, therapistId, meetingId: IsNull() } });
  }

  /** Creates or wipes the next-meeting report row (meeting_id IS NULL) to a clean 'pending' state. */
  async resetToPending(patientId: string, therapistId: string): Promise<PatientReport> {
    const repository = this.dataSource.getRepository(PatientReport);
    // ON CONFLICT (patient_id, therapist_id) WHERE meeting_id IS NULL — the partial unique index
    // keeps concurrent first POSTs from colliding while leaving per-meeting rows untouched.
    await repository.upsert(
      { patientId, therapistId, meetingId: null, ...pendingResetFields() },
      { conflictPaths: ['patientId', 'therapistId'], indexPredicate: NEXT_MEETING_PREDICATE },
    );
    const report = await repository.findOne({
      where: { patientId, therapistId, meetingId: IsNull() },
    });
    if (!report) {
      throw new Error(`patient report upsert did not persist for ${patientId}/${therapistId}`);
    }
    return report;
  }

  /** Marks the therapist's next-meeting report row (meeting_id IS NULL) 'running'. */
  async markRunning(patientId: string, therapistId: string): Promise<void> {
    await this.dataSource
      .getRepository(PatientReport)
      .update({ patientId, therapistId, meetingId: IsNull() }, { status: STATUS_RUNNING });
  }

  /** Marks the therapist's next-meeting report row (meeting_id IS NULL) 'ready'. */
  async markReady(
    patientId: string,
    therapistId: string,
    fields: ReadyReportFields,
  ): Promise<void> {
    await this.dataSource
      .getRepository(PatientReport)
      .update({ patientId, therapistId, meetingId: IsNull() }, readyUpdate(fields));
  }

  /** Marks the therapist's next-meeting report row (meeting_id IS NULL) 'failed'. */
  async markFailed(patientId: string, therapistId: string, error: string): Promise<void> {
    await this.dataSource
      .getRepository(PatientReport)
      .update(
        { patientId, therapistId, meetingId: IsNull() },
        { status: STATUS_FAILED, error },
      );
  }

  /** The therapist's per-meeting report rows for the patient (newest first). */
  listMeetingReports(patientId: string, therapistId: string): Promise<PatientReport[]> {
    return this.dataSource.getRepository(PatientReport).find({
      where: { patientId, therapistId, meetingId: Not(IsNull()) },
      order: { updatedAt: 'DESC' },
    });
  }

  /** The therapist's report row for a specific meeting, or null when none was requested. */
  findByMeeting(
    patientId: string,
    therapistId: string,
    meetingId: string,
  ): Promise<PatientReport | null> {
    return this.dataSource
      .getRepository(PatientReport)
      .findOne({ where: { patientId, therapistId, meetingId } });
  }

  /** Creates or wipes the therapist's per-meeting report row back to a clean 'pending' state. */
  async resetMeetingToPending(
    patientId: string,
    therapistId: string,
    meetingId: string,
  ): Promise<PatientReport> {
    const repository = this.dataSource.getRepository(PatientReport);
    // ON CONFLICT (patient_id, therapist_id, meeting_id) WHERE meeting_id IS NOT NULL.
    await repository.upsert(
      { patientId, therapistId, meetingId, ...pendingResetFields() },
      {
        conflictPaths: ['patientId', 'therapistId', 'meetingId'],
        indexPredicate: PER_MEETING_PREDICATE,
      },
    );
    const report = await repository.findOne({ where: { patientId, therapistId, meetingId } });
    if (!report) {
      throw new Error(
        `meeting report upsert did not persist for ${patientId}/${therapistId}/${meetingId}`,
      );
    }
    return report;
  }

  /** Marks the therapist's per-meeting report row 'running'. */
  async markMeetingRunning(
    patientId: string,
    therapistId: string,
    meetingId: string,
  ): Promise<void> {
    await this.dataSource
      .getRepository(PatientReport)
      .update({ patientId, therapistId, meetingId }, { status: STATUS_RUNNING });
  }

  /** Marks the therapist's per-meeting report row 'ready' with the generated content. */
  async markMeetingReady(
    patientId: string,
    therapistId: string,
    meetingId: string,
    fields: ReadyReportFields,
  ): Promise<void> {
    await this.dataSource
      .getRepository(PatientReport)
      .update({ patientId, therapistId, meetingId }, readyUpdate(fields));
  }

  /** Marks the therapist's per-meeting report row 'failed' with a user-facing error. */
  async markMeetingFailed(
    patientId: string,
    therapistId: string,
    meetingId: string,
    error: string,
  ): Promise<void> {
    await this.dataSource
      .getRepository(PatientReport)
      .update({ patientId, therapistId, meetingId }, { status: STATUS_FAILED, error });
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
