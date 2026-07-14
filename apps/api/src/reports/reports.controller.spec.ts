import { HttpStatus } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import type { NextMeetingReportDto } from './dto/next-meeting-report.dto';
import { ReportsController } from './reports.controller';
import type { ReportsService } from './reports.service';

function reportDto(status: NextMeetingReportDto['status']): NextMeetingReportDto {
  return {
    patient_id: randomUUID(),
    status,
    intro: null,
    changes: [],
    open_topics: [],
    source_meeting_ids: [],
    last_summary_excerpt: null,
    generated_at: null,
    model: null,
    error: null,
  };
}

describe('ReportsController', () => {
  let service: jest.Mocked<Pick<ReportsService, 'getReport' | 'requestReport'>>;
  let controller: ReportsController;
  let response: jest.Mocked<Pick<Response, 'status'>>;

  beforeEach(() => {
    service = { getReport: jest.fn(), requestReport: jest.fn() };
    // test-only cast: the controller consumes just these two service methods
    controller = new ReportsController(service as unknown as ReportsService);
    response = { status: jest.fn() };
  });

  it.each(['pending', 'running'] as const)('GET responds 202 while %s', async (status) => {
    const dto = reportDto(status);
    service.getReport.mockResolvedValue(dto);
    const result = await controller.getReport(dto.patient_id, response as unknown as Response);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.ACCEPTED);
    expect(result).toBe(dto);
  });

  it.each(['ready', 'failed'] as const)('GET responds 200 once %s', async (status) => {
    const dto = reportDto(status);
    service.getReport.mockResolvedValue(dto);
    await controller.getReport(dto.patient_id, response as unknown as Response);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
  });

  it('POST dispatches to the service and returns its body', async () => {
    const dto = reportDto('pending');
    service.requestReport.mockResolvedValue(dto);
    await expect(controller.requestReport(dto.patient_id)).resolves.toBe(dto);
    expect(service.requestReport).toHaveBeenCalledWith(dto.patient_id);
  });
});
