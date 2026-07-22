import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ResourceNotFoundException } from '../common/exceptions/app.exception';
import { PatientReport } from './entities/patient-report.entity';
import type { GeneratedReport, ReportGenerator } from './report-generator.interface';
import {
  EXCERPT_MAX_CHARS,
  NO_SUMMARIES_ERROR,
  RESTART_SWEEP_ERROR,
} from './reports.constants';
import type { ReportsRepository } from './reports.repository';
import { ReportsService } from './reports.service';

/** Flushes the microtask queue so fire-and-forget generation settles. */
async function flushAsync(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

function pendingRow(patientId: string): PatientReport {
  const row = new PatientReport();
  row.id = randomUUID();
  row.patientId = patientId;
  row.status = 'pending';
  row.intro = null;
  row.changes = [];
  row.openTopics = [];
  row.sourceMeetingIds = [];
  row.lastSummaryExcerpt = null;
  row.generatedAt = null;
  row.model = '';
  row.error = null;
  row.createdAt = new Date();
  row.updatedAt = new Date();
  return row;
}

/** Function-property mock shape — keeps expect(mock.method) free of unbound-method lint. */
type MockedMethods<T> = { [K in keyof T]: jest.Mock };

const makeUser = (userId: string): AuthenticatedUser => ({
  userId,
  email: 'therapist@test.local',
  fullName: 'Test Therapist',
  role: 'therapist',
});

describe('ReportsService', () => {
  let repository: MockedMethods<ReportsRepository>;
  let generator: MockedMethods<ReportGenerator>;
  let service: ReportsService;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  const user = makeUser(randomUUID());
  const generated: GeneratedReport = {
    intro: 'מבוא',
    changes: ['שינוי'],
    openTopics: ['נושא'],
    model: 'claude-test',
  };

  beforeEach(() => {
    repository = {
      patientExists: jest.fn(),
      therapistHasMeetingWithPatient: jest.fn().mockResolvedValue(true),
      meetingBelongsToPatientAndTherapist: jest.fn().mockResolvedValue(true),
      findByPatientAndTherapist: jest.fn(),
      resetToPending: jest.fn(),
      markRunning: jest.fn().mockResolvedValue(undefined),
      markReady: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      listMeetingReports: jest.fn(),
      findByMeeting: jest.fn(),
      resetMeetingToPending: jest.fn(),
      markMeetingRunning: jest.fn().mockResolvedValue(undefined),
      markMeetingReady: jest.fn().mockResolvedValue(undefined),
      markMeetingFailed: jest.fn().mockResolvedValue(undefined),
      findReadySummaries: jest.fn(),
      failStrandedRunning: jest.fn(),
    };
    generator = { generate: jest.fn() };
    service = new ReportsService(repository, generator);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('getReport', () => {
    it('throws 404 when the caller has no meeting with the patient (never reads the row)', async () => {
      repository.therapistHasMeetingWithPatient.mockResolvedValue(false);
      await expect(service.getReport(user, randomUUID())).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.findByPatientAndTherapist).not.toHaveBeenCalled();
    });

    it('throws 404 when no report row exists', async () => {
      repository.findByPatientAndTherapist.mockResolvedValue(null);
      await expect(service.getReport(user, randomUUID())).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it('maps the row to the snake_case contract', async () => {
      const patientId = randomUUID();
      const row = pendingRow(patientId);
      row.status = 'ready';
      row.intro = 'מבוא';
      row.changes = ['שינוי'];
      row.openTopics = ['נושא'];
      row.sourceMeetingIds = ['m1'];
      row.lastSummaryExcerpt = 'תקציר';
      row.generatedAt = new Date('2026-07-14T10:00:00Z');
      row.model = 'claude-test';
      repository.findByPatientAndTherapist.mockResolvedValue(row);

      const dto = await service.getReport(user, patientId);
      expect(dto).toEqual({
        patient_id: patientId,
        status: 'ready',
        intro: 'מבוא',
        changes: ['שינוי'],
        open_topics: ['נושא'],
        questions: [],
        source_meeting_ids: ['m1'],
        last_summary_excerpt: 'תקציר',
        generated_at: '2026-07-14T10:00:00.000Z',
        model: 'claude-test',
        error: null,
      });
    });

    it('maps an empty model to null while pending', async () => {
      const patientId = randomUUID();
      repository.findByPatientAndTherapist.mockResolvedValue(pendingRow(patientId));
      const dto = await service.getReport(user, patientId);
      expect(dto.model).toBeNull();
      expect(dto.generated_at).toBeNull();
      expect(dto.status).toBe('pending');
    });
  });

  describe('requestReport', () => {
    it('throws 404 for an unknown patient and never touches the row', async () => {
      repository.patientExists.mockResolvedValue(false);
      await expect(service.requestReport(user, randomUUID())).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.resetToPending).not.toHaveBeenCalled();
    });

    it('throws 404 when the patient exists but the caller has no meeting with them', async () => {
      repository.patientExists.mockResolvedValue(true);
      repository.therapistHasMeetingWithPatient.mockResolvedValue(false);
      await expect(service.requestReport(user, randomUUID())).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.resetToPending).not.toHaveBeenCalled();
    });

    it('scopes the ready-summary lookup to the calling therapist', async () => {
      const patientId = randomUUID();
      repository.patientExists.mockResolvedValue(true);
      repository.resetToPending.mockResolvedValue(pendingRow(patientId));
      repository.findReadySummaries.mockResolvedValue([{ meetingId: 'm1', text: 'סיכום' }]);
      generator.generate.mockResolvedValue(generated);

      await service.requestReport(user, patientId);
      await flushAsync();
      expect(repository.findReadySummaries).toHaveBeenCalledWith(patientId, user.userId);
    });

    it('returns the pending body and completes generation to ready', async () => {
      const patientId = randomUUID();
      repository.patientExists.mockResolvedValue(true);
      repository.resetToPending.mockResolvedValue(pendingRow(patientId));
      repository.findReadySummaries.mockResolvedValue([
        { meetingId: 'm-old', text: 'סיכום ישן' },
        { meetingId: 'm-new', text: 'סיכום חדש' },
      ]);
      generator.generate.mockResolvedValue(generated);

      const dto = await service.requestReport(user, patientId);
      expect(dto.status).toBe('pending');
      expect(dto.patient_id).toBe(patientId);

      await flushAsync();
      expect(repository.markRunning).toHaveBeenCalledWith(patientId, user.userId);
      expect(repository.markReady).toHaveBeenCalledWith(
        patientId,
        user.userId,
        expect.objectContaining({
          intro: generated.intro,
          changes: generated.changes,
          openTopics: generated.openTopics,
          sourceMeetingIds: ['m-old', 'm-new'],
          lastSummaryExcerpt: 'סיכום חדש',
          model: generated.model,
          generatedAt: expect.any(Date) as Date,
        }),
      );
      expect(repository.markFailed).not.toHaveBeenCalled();
    });

    it('truncates the excerpt of the most recent summary to the cap', async () => {
      const patientId = randomUUID();
      const longText = 'א'.repeat(EXCERPT_MAX_CHARS + 100);
      repository.patientExists.mockResolvedValue(true);
      repository.resetToPending.mockResolvedValue(pendingRow(patientId));
      repository.findReadySummaries.mockResolvedValue([{ meetingId: 'm1', text: longText }]);
      generator.generate.mockResolvedValue(generated);

      await service.requestReport(user, patientId);
      await flushAsync();
      expect(repository.markReady).toHaveBeenCalledWith(
        patientId,
        user.userId,
        expect.objectContaining({
          lastSummaryExcerpt: longText.slice(0, EXCERPT_MAX_CHARS),
        }),
      );
    });

    it('fails with the Hebrew message when the patient has no ready summaries', async () => {
      const patientId = randomUUID();
      repository.patientExists.mockResolvedValue(true);
      repository.resetToPending.mockResolvedValue(pendingRow(patientId));
      repository.findReadySummaries.mockResolvedValue([]);

      await service.requestReport(user, patientId);
      await flushAsync();
      expect(repository.markFailed).toHaveBeenCalledWith(
        patientId,
        user.userId,
        NO_SUMMARIES_ERROR,
      );
      expect(repository.markRunning).not.toHaveBeenCalled();
      expect(generator.generate).not.toHaveBeenCalled();
    });

    it('marks the row failed when the generator rejects (never strands running)', async () => {
      const patientId = randomUUID();
      repository.patientExists.mockResolvedValue(true);
      repository.resetToPending.mockResolvedValue(pendingRow(patientId));
      repository.findReadySummaries.mockResolvedValue([{ meetingId: 'm1', text: 'סיכום' }]);
      generator.generate.mockRejectedValue(new Error('anthropic exploded'));

      await service.requestReport(user, patientId);
      await flushAsync();
      expect(repository.markFailed).toHaveBeenCalledWith(
        patientId,
        user.userId,
        'anthropic exploded',
      );
    });

    it('marks the row failed when persisting the ready result throws', async () => {
      const patientId = randomUUID();
      repository.patientExists.mockResolvedValue(true);
      repository.resetToPending.mockResolvedValue(pendingRow(patientId));
      repository.findReadySummaries.mockResolvedValue([{ meetingId: 'm1', text: 'סיכום' }]);
      generator.generate.mockResolvedValue(generated);
      repository.markReady.mockRejectedValue(new Error('db write failed'));

      await service.requestReport(user, patientId);
      await flushAsync();
      expect(repository.markFailed).toHaveBeenCalledWith(patientId, user.userId, 'db write failed');
    });

    it('a superseded (stale) run never writes over the newer run', async () => {
      const patientId = randomUUID();
      repository.patientExists.mockResolvedValue(true);
      repository.resetToPending.mockResolvedValue(pendingRow(patientId));
      repository.findReadySummaries.mockResolvedValue([{ meetingId: 'm1', text: 'סיכום' }]);
      let rejectFirstRun: (reason: Error) => void = () => undefined;
      generator.generate
        .mockImplementationOnce(
          () => new Promise((_resolve, reject) => (rejectFirstRun = reject)),
        )
        .mockResolvedValue(generated);

      await service.requestReport(user, patientId); // run 1 — hangs on the generator
      await flushAsync();
      await service.requestReport(user, patientId); // run 2 — supersedes and settles
      await flushAsync();
      expect(repository.markReady).toHaveBeenCalledTimes(1);

      rejectFirstRun(new Error('stale anthropic timeout')); // run 1 finally fails
      await flushAsync();
      expect(repository.markFailed).not.toHaveBeenCalled();
      expect(repository.markReady).toHaveBeenCalledTimes(1);
    });

    it('resolves even when the failure fallback itself rejects (fire never rejects)', async () => {
      const patientId = randomUUID();
      repository.patientExists.mockResolvedValue(true);
      repository.resetToPending.mockResolvedValue(pendingRow(patientId));
      repository.findReadySummaries.mockRejectedValue(new Error('db down'));
      repository.markFailed.mockRejectedValue(new Error('db still down'));

      await expect(service.requestReport(user, patientId)).resolves.toMatchObject({
        status: 'pending',
      });
      await flushAsync();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('listForPatient', () => {
    it('throws 404 when the caller has no meeting with the patient', async () => {
      repository.therapistHasMeetingWithPatient.mockResolvedValue(false);
      await expect(service.listForPatient(user, randomUUID())).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
      expect(repository.listMeetingReports).not.toHaveBeenCalled();
    });

    it('maps each per-meeting row to the list-item shape', async () => {
      const patientId = randomUUID();
      const meetingId = randomUUID();
      const row = pendingRow(patientId);
      row.meetingId = meetingId;
      row.status = 'ready';
      row.generatedAt = new Date('2026-07-14T10:00:00Z');
      repository.listMeetingReports.mockResolvedValue([row]);

      await expect(service.listForPatient(user, patientId)).resolves.toEqual([
        { meeting_id: meetingId, status: 'ready', generated_at: '2026-07-14T10:00:00.000Z' },
      ]);
      expect(repository.listMeetingReports).toHaveBeenCalledWith(patientId, user.userId);
    });
  });

  describe('getMeetingReport', () => {
    it('throws 404 when the meeting is not the caller’s (never reads the row)', async () => {
      repository.meetingBelongsToPatientAndTherapist.mockResolvedValue(false);
      await expect(
        service.getMeetingReport(user, randomUUID(), randomUUID()),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
      expect(repository.findByMeeting).not.toHaveBeenCalled();
    });

    it('throws 404 when the meeting has no report yet', async () => {
      repository.findByMeeting.mockResolvedValue(null);
      await expect(
        service.getMeetingReport(user, randomUUID(), randomUUID()),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });

    it('maps the row and echoes the meeting id in the contract', async () => {
      const patientId = randomUUID();
      const meetingId = randomUUID();
      const row = pendingRow(patientId);
      row.meetingId = meetingId;
      row.status = 'ready';
      repository.findByMeeting.mockResolvedValue(row);

      const dto = await service.getMeetingReport(user, patientId, meetingId);
      expect(dto).toMatchObject({ patient_id: patientId, meeting_id: meetingId, status: 'ready' });
    });
  });

  describe('requestMeetingReport', () => {
    it('throws 404 when the meeting is not the caller’s and never touches the row', async () => {
      repository.meetingBelongsToPatientAndTherapist.mockResolvedValue(false);
      await expect(
        service.requestMeetingReport(user, randomUUID(), randomUUID()),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
      expect(repository.resetMeetingToPending).not.toHaveBeenCalled();
    });

    it('returns an already pending/running report as-is without restarting it', async () => {
      const patientId = randomUUID();
      const meetingId = randomUUID();
      const running = pendingRow(patientId);
      running.meetingId = meetingId;
      running.status = 'running';
      repository.findByMeeting.mockResolvedValue(running);

      const dto = await service.requestMeetingReport(user, patientId, meetingId);
      expect(dto).toMatchObject({ meeting_id: meetingId, status: 'running' });
      expect(repository.resetMeetingToPending).not.toHaveBeenCalled();
      await flushAsync();
      expect(repository.markMeetingRunning).not.toHaveBeenCalled();
    });

    it('resets to pending and generates a settled per-meeting report', async () => {
      const patientId = randomUUID();
      const meetingId = randomUUID();
      const pending = pendingRow(patientId);
      pending.meetingId = meetingId;
      repository.findByMeeting.mockResolvedValue(null);
      repository.resetMeetingToPending.mockResolvedValue(pending);
      repository.findReadySummaries.mockResolvedValue([
        { meetingId: 'm-old', text: 'סיכום ישן' },
        { meetingId: 'm-new', text: 'סיכום חדש' },
      ]);
      generator.generate.mockResolvedValue(generated);

      const dto = await service.requestMeetingReport(user, patientId, meetingId);
      expect(dto).toMatchObject({ meeting_id: meetingId, status: 'pending' });

      await flushAsync();
      expect(repository.markMeetingRunning).toHaveBeenCalledWith(patientId, user.userId, meetingId);
      expect(repository.markMeetingReady).toHaveBeenCalledWith(
        patientId,
        user.userId,
        meetingId,
        expect.objectContaining({
          sourceMeetingIds: ['m-old', 'm-new'],
          lastSummaryExcerpt: 'סיכום חדש',
          model: generated.model,
        }),
      );
      expect(repository.markMeetingFailed).not.toHaveBeenCalled();
    });

    it('fails the per-meeting row with the Hebrew message when there are no ready summaries', async () => {
      const patientId = randomUUID();
      const meetingId = randomUUID();
      const pending = pendingRow(patientId);
      pending.meetingId = meetingId;
      repository.findByMeeting.mockResolvedValue(null);
      repository.resetMeetingToPending.mockResolvedValue(pending);
      repository.findReadySummaries.mockResolvedValue([]);

      await service.requestMeetingReport(user, patientId, meetingId);
      await flushAsync();
      expect(repository.markMeetingFailed).toHaveBeenCalledWith(
        patientId,
        user.userId,
        meetingId,
        NO_SUMMARIES_ERROR,
      );
      expect(repository.markMeetingRunning).not.toHaveBeenCalled();
    });
  });

  describe('onApplicationBootstrap (startup sweep)', () => {
    it('fails stranded running rows with the restart message', async () => {
      repository.failStrandedRunning.mockResolvedValue(2);
      await service.onApplicationBootstrap();
      expect(repository.failStrandedRunning).toHaveBeenCalledWith(RESTART_SWEEP_ERROR);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('never blocks boot when the sweep throws', async () => {
      repository.failStrandedRunning.mockRejectedValue(new Error('relation does not exist'));
      await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    });

    it('stays quiet when nothing was stranded', async () => {
      repository.failStrandedRunning.mockResolvedValue(0);
      await service.onApplicationBootstrap();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
