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
import { NextMeetingReportDto } from './dto/next-meeting-report.dto';
import { STATUS_PENDING, STATUS_RUNNING } from './reports.constants';
import { ReportsService } from './reports.service';

/** 202 while generation is in flight, 200 once it settled (ready/failed). */
function httpStatusFor(status: GenerationStatus): HttpStatus {
  return status === STATUS_PENDING || status === STATUS_RUNNING
    ? HttpStatus.ACCEPTED
    : HttpStatus.OK;
}

/** Next-meeting prep report endpoints — the SPA polls GET after a POST. */
@ApiTags('reports')
@ApiBearerAuth()
@Controller('patients/:patientId/next-meeting-report')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({
    summary: 'Fetch the next-meeting prep report',
    description: '202 with body while pending/running, 200 once ready or failed.',
  })
  @ApiParam({ name: 'patientId', description: 'Patient id', format: 'uuid' })
  @ApiOkResponse({ type: NextMeetingReportDto, description: 'Report settled (ready or failed)' })
  @ApiAcceptedResponse({ type: NextMeetingReportDto, description: 'Generation in progress' })
  @ApiBadRequestResponse({ description: 'patientId is not a UUID' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  @ApiNotFoundResponse({ description: 'No report yet (or the patient is not the caller’s)' })
  async getReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<NextMeetingReportDto> {
    const report = await this.reportsService.getReport(user, patientId);
    response.status(httpStatusFor(report.status));
    return report;
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Request (re)generation of the next-meeting prep report',
    description: 'Resets the report to pending and generates asynchronously — poll GET for the result.',
  })
  @ApiParam({ name: 'patientId', description: 'Patient id', format: 'uuid' })
  @ApiAcceptedResponse({ type: NextMeetingReportDto, description: 'Generation started' })
  @ApiBadRequestResponse({ description: 'patientId is not a UUID' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  @ApiNotFoundResponse({ description: 'Patient not found (or not the caller’s)' })
  requestReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
  ): Promise<NextMeetingReportDto> {
    return this.reportsService.requestReport(user, patientId);
  }
}
