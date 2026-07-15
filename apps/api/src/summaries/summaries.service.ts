import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
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
   * Fetches the caller's meeting summary row.
   * @throws ResourceNotFoundException when absent or the meeting is not the caller's (404).
   */
  async getSummary(user: AuthenticatedUser, meetingId: string): Promise<SummaryResponseDto> {
    if (!(await this.summaries.meetingBelongsToTherapist(meetingId, user.userId))) {
      throw new ResourceNotFoundException('summary for meeting', meetingId);
    }
    const summary = await this.summaries.findByMeetingId(meetingId);
    if (!summary) {
      throw new ResourceNotFoundException('summary for meeting', meetingId);
    }
    return SummaryResponseDto.fromEntity(summary);
  }

  /**
   * Validates the caller's meeting and (re)queues generation; returns the pending body.
   * @throws ResourceNotFoundException when absent or the meeting is not the caller's (404).
   */
  async requestSummary(user: AuthenticatedUser, meetingId: string): Promise<SummaryResponseDto> {
    if (!(await this.summaries.meetingBelongsToTherapist(meetingId, user.userId))) {
      throw new ResourceNotFoundException('meeting', meetingId);
    }
    await this.queue.enqueue(meetingId);
    return SummaryResponseDto.pending(meetingId);
  }
}
