import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DEFAULT_TIME_ZONE } from './calendar.constants';
import { CalendarService } from './calendar.service';
import { CalendarEventResponseDto } from './dto/calendar-event-response.dto';
import { ListCalendarEventsQueryDto, TimeZoneQueryDto } from './dto/calendar-query.dto';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

const TIME_ZONE_QUERY = {
  name: 'time_zone',
  required: false,
  description: `IANA time zone (default ${DEFAULT_TIME_ZONE})`,
} as const;

/** /calendar — therapist-scoped meeting CRUD (senseiAPI calendar_events parity). */
@ApiTags('calendar')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post()
  @ApiOperation({ summary: 'Create a calendar event owned by the caller' })
  @ApiQuery(TIME_ZONE_QUERY)
  @ApiBody({ type: CreateCalendarEventDto })
  @ApiCreatedResponse({ type: CalendarEventResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid body or time_zone' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TimeZoneQueryDto,
    @Body() dto: CreateCalendarEventDto,
  ): Promise<CalendarEventResponseDto> {
    return this.calendarService.create(user, query.time_zone, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List the caller’s events overlapping a date window',
    description:
      'No bounds → current Sun–Sat week in the zone; a single bound implies the other (±6 days); explicit ranges are capped at 365 days.',
  })
  @ApiOkResponse({ type: CalendarEventResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'Invalid dates, range, or time_zone' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCalendarEventsQueryDto,
  ): Promise<CalendarEventResponseDto[]> {
    return this.calendarService.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch one of the caller’s events' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery(TIME_ZONE_QUERY)
  @ApiOkResponse({ type: CalendarEventResponseDto })
  @ApiBadRequestResponse({ description: 'Malformed id or invalid time_zone' })
  @ApiNotFoundResponse({ description: 'Unknown event (or owned by another therapist)' })
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TimeZoneQueryDto,
  ): Promise<CalendarEventResponseDto> {
    return this.calendarService.getById(user, id, query.time_zone);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update one of the caller’s events' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery(TIME_ZONE_QUERY)
  @ApiBody({ type: UpdateCalendarEventDto })
  @ApiOkResponse({ type: CalendarEventResponseDto })
  @ApiBadRequestResponse({ description: 'Empty update, invalid field, or invalid time_zone' })
  @ApiNotFoundResponse({ description: 'Unknown event (or owned by another therapist)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TimeZoneQueryDto,
    @Body() dto: UpdateCalendarEventDto,
  ): Promise<CalendarEventResponseDto> {
    return this.calendarService.update(user, id, query.time_zone, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete one of the caller’s events' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery(TIME_ZONE_QUERY)
  @ApiNoContentResponse({ description: 'Event deleted' })
  @ApiBadRequestResponse({ description: 'Malformed id or invalid time_zone' })
  @ApiNotFoundResponse({ description: 'Unknown event (or owned by another therapist)' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TimeZoneQueryDto,
  ): Promise<void> {
    return this.calendarService.remove(user, id, query.time_zone);
  }
}
