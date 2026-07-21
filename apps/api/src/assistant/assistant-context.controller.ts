import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AssistantContextService } from './assistant-context.service';
import {
  AgendaItemDto,
  AgendaQueryDto,
  CadenceDto,
  PatientBriefDto,
  PatientMeetingDto,
} from './dto/context.dto';

/**
 * PHI-safe, read-only context surface the assistant's http_get tool reaches. Every
 * view is scoped to the authenticated therapist.
 */
@ApiTags('assistant-context')
@ApiBearerAuth()
@Controller('assistant/context')
export class AssistantContextController {
  constructor(private readonly contextService: AssistantContextService) {}

  @Get('patients')
  @ApiOperation({
    summary: 'The patient roster (name only)',
    description: 'Lets the assistant resolve a patient name to an id.',
  })
  @ApiOkResponse({ type: [PatientBriefDto], description: 'Patient roster' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  listPatients(@CurrentUser() user: AuthenticatedUser): Promise<PatientBriefDto[]> {
    return this.contextService.listPatients(user.userId);
  }

  @Get('agenda')
  @ApiOperation({
    summary: 'Upcoming meetings — "who is next"',
    description: 'Meetings in the next `days` days (default 7, range 1..60).',
  })
  @ApiOkResponse({ type: [AgendaItemDto], description: 'Upcoming meetings, earliest first' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  agenda(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AgendaQueryDto,
  ): Promise<AgendaItemDto[]> {
    return this.contextService.agenda(user.userId, query.days);
  }

  @Get('patient/:patientId/cadence')
  @ApiOperation({
    summary: 'Meeting cadence for one patient',
    description: 'Last/next meeting time and total count within the ±365-day window.',
  })
  @ApiParam({ name: 'patientId', description: 'Patient id', format: 'uuid' })
  @ApiOkResponse({ type: CadenceDto, description: 'Patient cadence' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  cadence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ): Promise<CadenceDto> {
    return this.contextService.cadence(user.userId, patientId);
  }

  @Get('patient/:patientId/meetings')
  @ApiOperation({
    summary: 'A patient\'s meetings',
    description:
      'Each meeting with its meeting_id (for the summary), a readable time, and whether ' +
      'a ready summary exists — how the assistant reaches a patient\'s session content.',
  })
  @ApiParam({ name: 'patientId', description: 'Patient id', format: 'uuid' })
  @ApiOkResponse({ type: [PatientMeetingDto], description: 'Meetings, newest first' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  patientMeetings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ): Promise<PatientMeetingDto[]> {
    return this.contextService.patientMeetings(user.userId, patientId);
  }
}
