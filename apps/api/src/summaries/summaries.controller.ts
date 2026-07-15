import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SummaryResponseDto } from './dto/summary-response.dto';
import type { GenerationStatus } from './entities/meeting-summary.entity';
import { SummariesService } from './summaries.service';

/** HTTP status per generation state — in-flight states answer 202, terminal states 200. */
const STATUS_CODE_BY_GENERATION: Record<GenerationStatus, HttpStatus> = {
  pending: HttpStatus.ACCEPTED,
  running: HttpStatus.ACCEPTED,
  ready: HttpStatus.OK,
  failed: HttpStatus.OK,
};

/** AI meeting summaries — senseiAPI /meetings/{id}/summary parity (unversioned). */
@ApiTags('summaries')
@ApiBearerAuth()
@Controller('meetings')
export class SummariesController {
  constructor(private readonly summariesService: SummariesService) {}

  @Get(':meetingId/summary')
  @ApiOperation({
    summary: 'Fetch the meeting summary',
    description:
      'Returns 202 with the body while generation is pending/running, and 200 once it is ' +
      'ready or failed — a failed summary is a successful request whose summary failed. ' +
      'The summary is a drafting aid the therapist reviews; it is not a clinical record.',
  })
  @ApiParam({ name: 'meetingId', description: 'Meeting (calendar event) id', format: 'uuid' })
  @ApiOkResponse({ type: SummaryResponseDto, description: 'Summary is ready or failed' })
  @ApiAcceptedResponse({ type: SummaryResponseDto, description: 'Generation pending or running' })
  @ApiNotFoundResponse({ description: 'No summary (or the meeting is another therapist’s)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  async getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SummaryResponseDto> {
    const summary = await this.summariesService.getSummary(user, meetingId);
    response.status(STATUS_CODE_BY_GENERATION[summary.status]);
    return summary;
  }

  @Post(':meetingId/summary')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Queue (or re-queue) summary generation',
    description:
      'Creates or resets the summary row to pending and starts generation in the background. ' +
      'The frontend poller POSTs here on 404/failed and then polls GET until terminal.',
  })
  @ApiParam({ name: 'meetingId', description: 'Meeting (calendar event) id', format: 'uuid' })
  @ApiAcceptedResponse({ type: SummaryResponseDto, description: 'Generation queued (pending)' })
  @ApiNotFoundResponse({ description: 'Meeting does not exist (or is another therapist’s)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  requestSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ): Promise<SummaryResponseDto> {
    return this.summariesService.requestSummary(user, meetingId);
  }
}
