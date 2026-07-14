import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../common/exceptions/app.exception';
import { SummaryResponseDto } from './dto/summary-response.dto';
import { SUMMARIES_REPOSITORY, type SummariesRepository } from './summaries.repository';
import { SUMMARY_QUEUE, type SummaryQueue } from './summary-queue';

/** Read + (re)queue operations behind the /meetings/{id}/summary endpoints. */
@Injectable()
export class SummariesService {
  constructor(
    @Inject(SUMMARIES_REPOSITORY) private readonly summaries: SummariesRepository,
    @Inject(SUMMARY_QUEUE) private readonly queue: SummaryQueue,
  ) {}

  /**
   * Fetches the meeting's summary row.
   * @throws ResourceNotFoundException when no summary row exists (404).
   */
  async getSummary(meetingId: string): Promise<SummaryResponseDto> {
    const summary = await this.summaries.findByMeetingId(meetingId);
    if (!summary) {
      throw new ResourceNotFoundException('summary for meeting', meetingId);
    }
    return SummaryResponseDto.fromEntity(summary);
  }

  /**
   * Validates the meeting and (re)queues generation; returns the pending body.
   * @throws ResourceNotFoundException when the meeting does not exist (404).
   */
  async requestSummary(meetingId: string): Promise<SummaryResponseDto> {
    if (!(await this.summaries.meetingExists(meetingId))) {
      throw new ResourceNotFoundException('meeting', meetingId);
    }
    await this.queue.enqueue(meetingId);
    return SummaryResponseDto.pending(meetingId);
  }
}
