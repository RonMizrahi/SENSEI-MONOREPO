import { HttpStatus } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import type { MeetingReportDto } from './dto/meeting-report.dto';
import { MeetingReportsController } from './meeting-reports.controller';
import type { ReportsService } from './reports.service';

const USER: AuthenticatedUser = {
  userId: randomUUID(),
  email: 'therapist@test.local',
  fullName: 'Test Therapist',
  role: 'therapist',
};

function meetingReportDto(status: MeetingReportDto['status']): MeetingReportDto {
  return {
    patient_id: randomUUID(),
    meeting_id: randomUUID(),
    status,
    intro: null,
    changes: [],
    open_topics: [],
    questions: [],
    source_meeting_ids: [],
    last_summary_excerpt: null,
    generated_at: null,
    model: null,
    error: null,
  };
}

describe('MeetingReportsController', () => {
  let service: jest.Mocked<
    Pick<ReportsService, 'listForPatient' | 'getMeetingReport' | 'requestMeetingReport'>
  >;
  let controller: MeetingReportsController;
  let response: jest.Mocked<Pick<Response, 'status'>>;

  beforeEach(() => {
    service = {
      listForPatient: jest.fn(),
      getMeetingReport: jest.fn(),
      requestMeetingReport: jest.fn(),
    };
    // test-only cast: the controller consumes just these three service methods
    controller = new MeetingReportsController(service as unknown as ReportsService);
    response = { status: jest.fn() };
  });

  it('GET (list) dispatches to the service and returns its body', async () => {
    const patientId = randomUUID();
    const list = [{ meeting_id: randomUUID(), status: 'ready' as const, generated_at: null }];
    service.listForPatient.mockResolvedValue(list);
    await expect(controller.listMeetingReports(USER, patientId)).resolves.toBe(list);
    expect(service.listForPatient).toHaveBeenCalledWith(USER, patientId);
  });

  it('POST dispatches to the service and returns its body', async () => {
    const dto = meetingReportDto('pending');
    service.requestMeetingReport.mockResolvedValue(dto);
    await expect(
      controller.requestMeetingReport(USER, dto.patient_id, dto.meeting_id),
    ).resolves.toBe(dto);
    expect(service.requestMeetingReport).toHaveBeenCalledWith(USER, dto.patient_id, dto.meeting_id);
  });

  it.each(['pending', 'running'] as const)('GET responds 202 while %s', async (status) => {
    const dto = meetingReportDto(status);
    service.getMeetingReport.mockResolvedValue(dto);
    const result = await controller.getMeetingReport(
      USER,
      dto.patient_id,
      dto.meeting_id,
      response as unknown as Response,
    );
    expect(response.status).toHaveBeenCalledWith(HttpStatus.ACCEPTED);
    expect(result).toBe(dto);
  });

  it.each(['ready', 'failed'] as const)('GET responds 200 once %s', async (status) => {
    const dto = meetingReportDto(status);
    service.getMeetingReport.mockResolvedValue(dto);
    await controller.getMeetingReport(
      USER,
      dto.patient_id,
      dto.meeting_id,
      response as unknown as Response,
    );
    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
  });
});
