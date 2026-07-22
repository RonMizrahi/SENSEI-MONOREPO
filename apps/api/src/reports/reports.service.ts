import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ResourceNotFoundException } from '../common/exceptions/app.exception';
import { MeetingReportDto, MeetingReportListItemDto } from './dto/meeting-report.dto';
import { NextMeetingReportDto } from './dto/next-meeting-report.dto';
import { PatientReport } from './entities/patient-report.entity';
import { GeneratedReport, REPORT_GENERATOR } from './report-generator.interface';
import type { ReportGenerator } from './report-generator.interface';
import {
  EXCERPT_MAX_CHARS,
  NO_SUMMARIES_ERROR,
  RESTART_SWEEP_ERROR,
  STATUS_PENDING,
  STATUS_RUNNING,
} from './reports.constants';
import { ReadyMeetingSummary, ReadyReportFields, REPORTS_REPOSITORY } from './reports.repository';
import type { ReportsRepository } from './reports.repository';

/** Normalizes an unknown thrown value to a user-facing message. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Assembles the persisted 'ready' fields from the source summaries and the generated content. */
function buildReadyFields(
  summaries: ReadyMeetingSummary[],
  generated: GeneratedReport,
): ReadyReportFields {
  const mostRecent = summaries[summaries.length - 1];
  return {
    intro: generated.intro,
    changes: generated.changes,
    openTopics: generated.openTopics,
    sourceMeetingIds: summaries.map((summary) => summary.meetingId),
    lastSummaryExcerpt: mostRecent.text.slice(0, EXCERPT_MAX_CHARS),
    generatedAt: new Date(),
    model: generated.model,
  };
}

/** Next-meeting prep report lifecycle — request, async generation, startup sweep. */
@Injectable()
export class ReportsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ReportsService.name);

  /** Latest generation run per patient — stale in-flight runs must never write over a newer one. */
  private readonly activeRuns = new Map<string, string>();

  /** Latest generation run per (patient, meeting) — same stale-run guard for per-meeting reports. */
  private readonly activeMeetingRuns = new Map<string, string>();

  constructor(
    @Inject(REPORTS_REPOSITORY) private readonly reportsRepository: ReportsRepository,
    @Inject(REPORT_GENERATOR) private readonly reportGenerator: ReportGenerator,
  ) {}

  /** Startup sweep — rows stranded 'running' by a crash/restart become 'failed'. */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const swept = await this.reportsRepository.failStrandedRunning(RESTART_SWEEP_ERROR);
      if (swept > 0) this.logger.warn(`Swept ${swept} patient report(s) stranded in 'running'`);
    } catch (error) {
      // never block boot on the sweep (e.g. schema not migrated yet)
      this.logger.warn(`Stranded-report sweep skipped: ${errorMessage(error)}`);
    }
  }

  /**
   * The caller's current report row for the patient.
   * @throws ResourceNotFoundException when unrequested or the caller has no meeting with them.
   */
  async getReport(user: AuthenticatedUser, patientId: string): Promise<NextMeetingReportDto> {
    if (!(await this.reportsRepository.therapistHasMeetingWithPatient(patientId, user.userId))) {
      throw new ResourceNotFoundException('Next-meeting report for patient', patientId);
    }
    const report = await this.reportsRepository.findByPatientAndTherapist(patientId, user.userId);
    if (!report) throw new ResourceNotFoundException('Next-meeting report for patient', patientId);
    return this.toDto(report);
  }

  /**
   * Resets the patient's report to 'pending' and fires generation without awaiting.
   * @throws ResourceNotFoundException when the patient is unknown or not the caller's.
   */
  async requestReport(user: AuthenticatedUser, patientId: string): Promise<NextMeetingReportDto> {
    const exists = await this.reportsRepository.patientExists(patientId);
    if (!exists) throw new ResourceNotFoundException('Patient', patientId);
    // 404 (never 403) unless the caller owns a meeting with this patient.
    if (!(await this.reportsRepository.therapistHasMeetingWithPatient(patientId, user.userId))) {
      throw new ResourceNotFoundException('Patient', patientId);
    }
    const pending = await this.reportsRepository.resetToPending(patientId, user.userId);
    const runId = randomUUID();
    this.activeRuns.set(patientId, runId);
    // fire-and-forget: failures land on the row inside generate(); this catch
    // only guards the guard (e.g. markFailed itself failing) so nothing rejects.
    void this.generate(patientId, user.userId, runId).catch((error: unknown) => {
      this.logger.error(
        `Report generation cleanup failed for patient ${patientId}: ${errorMessage(error)}`,
      );
    });
    return this.toDto(pending);
  }

  /** Whether this run is still the patient's latest (a re-POST supersedes older runs). */
  private isCurrentRun(patientId: string, runId: string): boolean {
    return this.activeRuns.get(patientId) === runId;
  }

  /** Runs one generation: collect summaries → running → ready, or failed on any error. */
  private async generate(patientId: string, therapistId: string, runId: string): Promise<void> {
    try {
      const summaries = await this.reportsRepository.findReadySummaries(patientId, therapistId);
      if (!this.isCurrentRun(patientId, runId)) return;
      if (summaries.length === 0) {
        await this.reportsRepository.markFailed(patientId, therapistId, NO_SUMMARIES_ERROR);
        return;
      }
      await this.reportsRepository.markRunning(patientId, therapistId);
      const generated = await this.reportGenerator.generate(summaries);
      if (!this.isCurrentRun(patientId, runId)) return;
      const mostRecent = summaries[summaries.length - 1];
      await this.reportsRepository.markReady(patientId, therapistId, {
        intro: generated.intro,
        changes: generated.changes,
        openTopics: generated.openTopics,
        sourceMeetingIds: summaries.map((summary) => summary.meetingId),
        lastSummaryExcerpt: mostRecent.text.slice(0, EXCERPT_MAX_CHARS),
        generatedAt: new Date(),
        model: generated.model,
      });
    } catch (error) {
      if (!this.isCurrentRun(patientId, runId)) return;
      await this.reportsRepository.markFailed(patientId, therapistId, errorMessage(error));
    } finally {
      // bounded map: forget the entry once the latest run settles
      if (this.isCurrentRun(patientId, runId)) this.activeRuns.delete(patientId);
    }
  }

  /** Composite key for the latest per-meeting run guard. */
  private meetingRunKey(patientId: string, meetingId: string): string {
    return `${patientId}:${meetingId}`;
  }

  /**
   * The caller's per-meeting reports for the patient (newest first).
   * @throws ResourceNotFoundException when the caller owns no meeting with the patient.
   */
  async listForPatient(
    user: AuthenticatedUser,
    patientId: string,
  ): Promise<MeetingReportListItemDto[]> {
    if (!(await this.reportsRepository.therapistHasMeetingWithPatient(patientId, user.userId))) {
      throw new ResourceNotFoundException('Patient', patientId);
    }
    const reports = await this.reportsRepository.listMeetingReports(patientId, user.userId);
    return reports.map((report) => this.toListItem(report));
  }

  /**
   * Verifies the meeting exists AND is owned by (patient, caller).
   * @throws ResourceNotFoundException (404, never 403) when it does not.
   */
  async verifyMeetingForPatient(
    user: AuthenticatedUser,
    patientId: string,
    meetingId: string,
  ): Promise<void> {
    const owned = await this.reportsRepository.meetingBelongsToPatientAndTherapist(
      patientId,
      user.userId,
      meetingId,
    );
    if (!owned) throw new ResourceNotFoundException('Meeting for patient', meetingId);
  }

  /**
   * The caller's report for a specific meeting.
   * @throws ResourceNotFoundException when the meeting is not the caller's or has no report yet.
   */
  async getMeetingReport(
    user: AuthenticatedUser,
    patientId: string,
    meetingId: string,
  ): Promise<MeetingReportDto> {
    await this.verifyMeetingForPatient(user, patientId, meetingId);
    const report = await this.reportsRepository.findByMeeting(patientId, user.userId, meetingId);
    if (!report) throw new ResourceNotFoundException('Meeting report for patient', meetingId);
    return this.toMeetingDto(report, meetingId);
  }

  /**
   * Starts (or resumes) generation for a specific meeting; a pending/running report is returned as-is.
   * @throws ResourceNotFoundException when the meeting is not the caller's.
   */
  async requestMeetingReport(
    user: AuthenticatedUser,
    patientId: string,
    meetingId: string,
  ): Promise<MeetingReportDto> {
    await this.verifyMeetingForPatient(user, patientId, meetingId);
    const existing = await this.reportsRepository.findByMeeting(patientId, user.userId, meetingId);
    if (existing && (existing.status === STATUS_PENDING || existing.status === STATUS_RUNNING)) {
      return this.toMeetingDto(existing, meetingId);
    }
    const pending = await this.reportsRepository.resetMeetingToPending(
      patientId,
      user.userId,
      meetingId,
    );
    const runId = randomUUID();
    const runKey = this.meetingRunKey(patientId, meetingId);
    this.activeMeetingRuns.set(runKey, runId);
    void this.generateMeeting(patientId, user.userId, meetingId, runId).catch((error: unknown) => {
      this.logger.error(
        `Meeting report generation cleanup failed for ${patientId}/${meetingId}: ${errorMessage(error)}`,
      );
    });
    return this.toMeetingDto(pending, meetingId);
  }

  /** Whether this run is still the latest for the (patient, meeting) pair. */
  private isCurrentMeetingRun(runKey: string, runId: string): boolean {
    return this.activeMeetingRuns.get(runKey) === runId;
  }

  /** Runs one per-meeting generation: summaries → running → ready, or failed on any error. */
  private async generateMeeting(
    patientId: string,
    therapistId: string,
    meetingId: string,
    runId: string,
  ): Promise<void> {
    const runKey = this.meetingRunKey(patientId, meetingId);
    try {
      const summaries = await this.reportsRepository.findReadySummaries(patientId, therapistId);
      if (!this.isCurrentMeetingRun(runKey, runId)) return;
      if (summaries.length === 0) {
        await this.reportsRepository.markMeetingFailed(
          patientId,
          therapistId,
          meetingId,
          NO_SUMMARIES_ERROR,
        );
        return;
      }
      await this.reportsRepository.markMeetingRunning(patientId, therapistId, meetingId);
      const generated = await this.reportGenerator.generate(summaries);
      if (!this.isCurrentMeetingRun(runKey, runId)) return;
      await this.reportsRepository.markMeetingReady(
        patientId,
        therapistId,
        meetingId,
        buildReadyFields(summaries, generated),
      );
    } catch (error) {
      if (!this.isCurrentMeetingRun(runKey, runId)) return;
      await this.reportsRepository.markMeetingFailed(
        patientId,
        therapistId,
        meetingId,
        errorMessage(error),
      );
    } finally {
      if (this.isCurrentMeetingRun(runKey, runId)) this.activeMeetingRuns.delete(runKey);
    }
  }

  /** Maps a per-meeting entity row to the SPA's snake_case response contract. */
  private toMeetingDto(report: PatientReport, meetingId: string): MeetingReportDto {
    return { ...this.toDto(report), meeting_id: meetingId };
  }

  /** Maps a per-meeting row to its list-item shape. */
  private toListItem(report: PatientReport): MeetingReportListItemDto {
    return {
      meeting_id: report.meetingId ?? '',
      status: report.status,
      generated_at: report.generatedAt ? report.generatedAt.toISOString() : null,
    };
  }

  /** Maps the entity row to the SPA's snake_case response contract. */
  private toDto(report: PatientReport): NextMeetingReportDto {
    return {
      patient_id: report.patientId,
      status: report.status,
      intro: report.intro,
      changes: report.changes,
      open_topics: report.openTopics,
      questions: report.questions ?? [],
      source_meeting_ids: report.sourceMeetingIds,
      last_summary_excerpt: report.lastSummaryExcerpt,
      generated_at: report.generatedAt ? report.generatedAt.toISOString() : null,
      model: report.model === '' ? null : report.model,
      error: report.error,
    };
  }
}
