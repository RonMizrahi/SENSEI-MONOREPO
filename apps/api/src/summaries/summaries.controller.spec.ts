import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { SummaryResponseDto } from './dto/summary-response.dto';
import type { GenerationStatus } from './entities/meeting-summary.entity';
import { SummariesController } from './summaries.controller';
import type { SummariesService } from './summaries.service';

function makeBody(meetingId: string, status: GenerationStatus): SummaryResponseDto {
  const dto = SummaryResponseDto.pending(meetingId);
  dto.status = status;
  return dto;
}

describe('SummariesController', () => {
  let service: jest.Mocked<Pick<SummariesService, 'getSummary' | 'requestSummary'>>;
  let controller: SummariesController;
  let response: jest.Mocked<Pick<Response, 'status'>>;
  const meetingId = crypto.randomUUID();

  beforeEach(() => {
    service = { getSummary: jest.fn(), requestSummary: jest.fn() };
    response = { status: jest.fn() };
    controller = new SummariesController(service as unknown as SummariesService);
  });

  it.each<[GenerationStatus, HttpStatus]>([
    ['pending', HttpStatus.ACCEPTED],
    ['running', HttpStatus.ACCEPTED],
    ['ready', HttpStatus.OK],
    ['failed', HttpStatus.OK],
  ])('GET answers %s with HTTP %d', async (status, expectedCode) => {
    service.getSummary.mockResolvedValue(makeBody(meetingId, status));

    const body = await controller.getSummary(meetingId, response as unknown as Response);

    expect(response.status).toHaveBeenCalledWith(expectedCode);
    expect(body.status).toBe(status);
  });

  it('POST dispatches to the service and returns its pending body', async () => {
    service.requestSummary.mockResolvedValue(makeBody(meetingId, 'pending'));

    const body = await controller.requestSummary(meetingId);

    expect(service.requestSummary).toHaveBeenCalledWith(meetingId);
    expect(body).toEqual({
      meeting_id: meetingId,
      status: 'pending',
      text: null,
      model: null,
      error: null,
    });
  });
});
