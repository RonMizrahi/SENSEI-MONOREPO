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
  ApiBadRequestResponse,
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
import type { GenerationStatus } from '../summaries/entities/meeting-summary.entity';
import { MeetingReportDto, MeetingReportListItemDto } from './dto/meeting-report.dto';
import { STATUS_PENDING, STATUS_RUNNING } from './reports.constants';
import { ReportsService } from './reports.service';

/** 202 while generation is in flight, 200 once it settled (ready/failed). */
function httpStatusFor(status: GenerationStatus): HttpStatus {
  return status === STATUS_PENDING || status === STATUS_RUNNING
    ? HttpStatus.ACCEPTED
    : HttpStatus.OK;
}

/** Per-meeting prep report endpoints — one report per specific meeting (the SPA polls GET after a POST). */
@ApiTags('reports')
@ApiBearerAuth()
@Controller('patients/:patientId/meeting-reports')
export class MeetingReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({
    summary: 'List the patient’s per-meeting prep reports',
    description: 'Returns one entry per meeting the caller has requested a report for.',
  })
  @ApiParam({ name: 'patientId', description: 'Patient id', format: 'uuid' })
  @ApiOkResponse({ type: [MeetingReportListItemDto], description: 'The patient’s meeting reports' })
  @ApiBadRequestResponse({ description: 'patientId is not a UUID' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  @ApiNotFoundResponse({ description: 'The caller owns no meeting with this patient' })
  listMeetingReports(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
  ): Promise<MeetingReportListItemDto[]> {
    return this.reportsService.listForPatient(user, patientId);
  }

  @Post(':meetingId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Start (or resume) generation of a specific meeting’s prep report',
    description:
      'Starts generation asynchronously — poll GET for the result. A report already ' +
      'pending or running is returned as-is (never restarted).',
  })
  @ApiParam({ name: 'patientId', description: 'Patient id', format: 'uuid' })
  @ApiParam({ name: 'meetingId', description: 'Meeting (calendar event) id', format: 'uuid' })
  @ApiAcceptedResponse({ type: MeetingReportDto, description: 'Generation started or already in progress' })
  @ApiBadRequestResponse({ description: 'patientId or meetingId is not a UUID' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  @ApiNotFoundResponse({ description: 'The meeting is not the caller’s (or does not exist)' })
  requestMeetingReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
  ): Promise<MeetingReportDto> {
    return this.reportsService.requestMeetingReport(user, patientId, meetingId);
  }

  @Get(':meetingId')
  @ApiOperation({
    summary: 'Fetch a specific meeting’s prep report',
    description: '202 with body while pending/running, 200 once ready or failed.',
  })
  @ApiParam({ name: 'patientId', description: 'Patient id', format: 'uuid' })
  @ApiParam({ name: 'meetingId', description: 'Meeting (calendar event) id', format: 'uuid' })
  @ApiOkResponse({ type: MeetingReportDto, description: 'Report settled (ready or failed)' })
  @ApiAcceptedResponse({ type: MeetingReportDto, description: 'Generation in progress' })
  @ApiBadRequestResponse({ description: 'patientId or meetingId is not a UUID' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  @ApiNotFoundResponse({ description: 'No report yet (or the meeting is not the caller’s)' })
  async getMeetingReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MeetingReportDto> {
    const report = await this.reportsService.getMeetingReport(user, patientId, meetingId);
    response.status(httpStatusFor(report.status));
    return report;
  }
}
