import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TranscriptResponseDto } from './dto/transcript-response.dto';
import { TranscriptsQueryService } from './transcripts-query.service';

/** Transcript reads — GET /meetings/{id}/transcript (unversioned, therapist-scoped). */
@ApiTags('transcripts')
@ApiBearerAuth()
@Controller('meetings')
export class TranscriptsController {
  constructor(private readonly transcripts: TranscriptsQueryService) {}

  @Get(':meetingId/transcript')
  @ApiOperation({
    summary: 'Fetch the meeting transcript',
    description:
      'Returns the stored transcript (raw text plus speaker-attributed segments) for a ' +
      'meeting the caller owns. 404 when there is no transcript or the meeting is another ' +
      'therapist’s.',
  })
  @ApiParam({ name: 'meetingId', description: 'Meeting (calendar event) id', format: 'uuid' })
  @ApiOkResponse({ type: TranscriptResponseDto, description: 'The meeting transcript' })
  @ApiNotFoundResponse({ description: 'No transcript (or the meeting is another therapist’s)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  getTranscript(
    @CurrentUser() user: AuthenticatedUser,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ): Promise<TranscriptResponseDto> {
    return this.transcripts.getForMeeting(user, meetingId);
  }
}
