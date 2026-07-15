import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ResourceNotFoundException } from '../common/exceptions/app.exception';
import { TranscriptResponseDto } from './dto/transcript-response.dto';
import { TRANSCRIPT_STORE, type TranscriptStore } from './transcript-store';

/** Read side of the transcript resource behind GET /meetings/{id}/transcript. */
@Injectable()
export class TranscriptsQueryService {
  constructor(@Inject(TRANSCRIPT_STORE) private readonly store: TranscriptStore) {}

  /**
   * Fetches the caller's meeting transcript.
   * @throws ResourceNotFoundException when absent or the meeting is not the caller's (404).
   */
  async getForMeeting(
    user: AuthenticatedUser,
    meetingId: string,
  ): Promise<TranscriptResponseDto> {
    if (!(await this.store.meetingBelongsToTherapist(meetingId, user.userId))) {
      throw new ResourceNotFoundException('transcript for meeting', meetingId);
    }
    const transcript = await this.store.getByMeetingId(meetingId);
    if (!transcript) {
      throw new ResourceNotFoundException('transcript for meeting', meetingId);
    }
    return TranscriptResponseDto.fromEntity(transcript);
  }
}
