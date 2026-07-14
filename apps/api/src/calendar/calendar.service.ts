import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { DateTime, IANAZone } from 'luxon';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ResourceNotFoundException } from '../common/exceptions/app.exception';
import {
  DATE_ONLY_PATTERN,
  DAYS_PER_WEEK,
  DEFAULT_TIME_ZONE,
  MAX_RANGE_DAYS,
  WEEK_END_OFFSET_DAYS,
} from './calendar.constants';
import { CALENDAR_REPOSITORY } from './calendar.repository';
import type { CalendarRepository, UpdateCalendarEventData } from './calendar.repository';
import { CalendarEventResponseDto } from './dto/calendar-event-response.dto';
import { ListCalendarEventsQueryDto } from './dto/calendar-query.dto';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { CalendarEvent } from './entities/calendar-event.entity';

const CALENDAR_EVENT_RESOURCE = 'calendar event';

/** UTC listing window derived from the query — end bound exclusive. */
export interface ListWindow {
  fromAt: Date;
  toAtExclusive: Date;
}

/**
 * Validates an IANA zone name, applying the default when omitted.
 * @throws BadRequestException on an unknown zone.
 */
export function resolveTimeZone(timeZone: string | undefined): string {
  const zone = timeZone ?? DEFAULT_TIME_ZONE;
  if (!IANAZone.isValidZone(zone)) {
    throw new BadRequestException('invalid time_zone');
  }
  return zone;
}

/**
 * Parses an ISO 8601 body timestamp into a UTC instant — naive values are
 * read in the requested zone, offset-carrying values keep their instant.
 * @throws BadRequestException when the value is not a real timestamp.
 */
export function parseInstant(value: string, zone: string, field: string): Date {
  const parsed = DateTime.fromISO(value, { zone });
  if (!parsed.isValid) {
    throw new BadRequestException(`invalid ${field}`);
  }
  return parsed.toJSDate();
}

/**
 * Parses a YYYY-MM-DD query date as start-of-day in the zone.
 * @throws BadRequestException on malformed or impossible dates.
 */
function parseDateOnly(value: string, zone: string, field: string): DateTime {
  const parsed = DATE_ONLY_PATTERN.test(value) ? DateTime.fromISO(value, { zone }) : null;
  if (!parsed?.isValid) {
    throw new BadRequestException(`invalid ${field}`);
  }
  return parsed;
}

/**
 * Resolves the GET /calendar window (senseiAPI rules): no bounds → current
 * Sun–Sat week in the zone; one bound → the other is ±6 days; both → validated.
 * @throws BadRequestException when from > to or the span exceeds 365 days.
 */
export function resolveListWindow(
  zone: string,
  fromDate: string | undefined,
  toDate: string | undefined,
  now: DateTime = DateTime.now(),
): ListWindow {
  let from: DateTime;
  let to: DateTime;
  if (fromDate !== undefined && toDate !== undefined) {
    from = parseDateOnly(fromDate, zone, 'from');
    to = parseDateOnly(toDate, zone, 'to');
    if (from > to) {
      throw new BadRequestException("'from' must be on or before 'to'");
    }
    if (to.diff(from, 'days').days > MAX_RANGE_DAYS) {
      throw new BadRequestException(`date range must not exceed ${MAX_RANGE_DAYS} days`);
    }
  } else if (fromDate !== undefined) {
    from = parseDateOnly(fromDate, zone, 'from');
    to = from.plus({ days: WEEK_END_OFFSET_DAYS });
  } else if (toDate !== undefined) {
    to = parseDateOnly(toDate, zone, 'to');
    from = to.minus({ days: WEEK_END_OFFSET_DAYS });
  } else {
    const today = now.setZone(zone).startOf('day');
    from = today.minus({ days: today.weekday % DAYS_PER_WEEK });
    to = from.plus({ days: WEEK_END_OFFSET_DAYS });
  }
  return { fromAt: from.toJSDate(), toAtExclusive: to.plus({ days: 1 }).toJSDate() };
}

/** Renders a stored (UTC) event with ISO times carrying the zone's offset. */
export function toResponseDto(event: CalendarEvent, zone: string): CalendarEventResponseDto {
  const inZone = (value: Date): string => {
    const rendered = DateTime.fromJSDate(value).setZone(zone).toISO();
    if (rendered === null) {
      // zone is pre-validated, so only a corrupt stored timestamp lands here
      throw new InternalServerErrorException('invalid stored event time');
    }
    return rendered;
  };
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    start_at: inZone(event.startAt),
    end_at: inZone(event.endAt),
    created_at: inZone(event.createdAt),
    therapist_id: event.therapistId,
    patient_id: event.patientId,
  };
}

/** Calendar business logic — time-zone math, window rules, therapist scoping. */
@Injectable()
export class CalendarService {
  constructor(
    @Inject(CALENDAR_REPOSITORY) private readonly calendarRepository: CalendarRepository,
  ) {}

  /**
   * Creates an event owned by the caller; times are stored in UTC.
   * @returns The created event rendered in the requested zone.
   */
  async create(
    user: AuthenticatedUser,
    timeZone: string | undefined,
    dto: CreateCalendarEventDto,
  ): Promise<CalendarEventResponseDto> {
    const zone = resolveTimeZone(timeZone);
    const event = await this.calendarRepository.create({
      title: dto.title,
      description: dto.description ?? null,
      startAt: parseInstant(dto.start_at, zone, 'start_at'),
      endAt: parseInstant(dto.end_at, zone, 'end_at'),
      therapistId: user.userId,
      patientId: dto.patient_id ?? null,
    });
    return toResponseDto(event, zone);
  }

  /** Lists the caller's events overlapping the resolved window, by start time. */
  async list(
    user: AuthenticatedUser,
    query: ListCalendarEventsQueryDto,
  ): Promise<CalendarEventResponseDto[]> {
    const zone = resolveTimeZone(query.time_zone);
    const window = resolveListWindow(zone, query.from, query.to);
    const events = await this.calendarRepository.findOverlapping(
      user.userId,
      window.fromAt,
      window.toAtExclusive,
    );
    return events.map((event) => toResponseDto(event, zone));
  }

  /**
   * Fetches one of the caller's events.
   * @throws ResourceNotFoundException when absent or owned by another therapist.
   */
  async getById(
    user: AuthenticatedUser,
    id: string,
    timeZone: string | undefined,
  ): Promise<CalendarEventResponseDto> {
    const zone = resolveTimeZone(timeZone);
    const event = await this.calendarRepository.findById(user.userId, id);
    if (!event) {
      throw new ResourceNotFoundException(CALENDAR_EVENT_RESOURCE, id);
    }
    return toResponseDto(event, zone);
  }

  /**
   * Applies a partial update to one of the caller's events.
   * @throws BadRequestException when no field is provided; 404 when absent/foreign.
   */
  async update(
    user: AuthenticatedUser,
    id: string,
    timeZone: string | undefined,
    dto: UpdateCalendarEventDto,
  ): Promise<CalendarEventResponseDto> {
    const zone = resolveTimeZone(timeZone);
    const updates: UpdateCalendarEventData = {};
    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.start_at !== undefined) updates.startAt = parseInstant(dto.start_at, zone, 'start_at');
    if (dto.end_at !== undefined) updates.endAt = parseInstant(dto.end_at, zone, 'end_at');
    if (dto.patient_id !== undefined) updates.patientId = dto.patient_id;
    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('at least one event field must be provided');
    }
    const event = await this.calendarRepository.update(user.userId, id, updates);
    if (!event) {
      throw new ResourceNotFoundException(CALENDAR_EVENT_RESOURCE, id);
    }
    return toResponseDto(event, zone);
  }

  /**
   * Deletes one of the caller's events.
   * @throws ResourceNotFoundException when absent or owned by another therapist.
   */
  async remove(user: AuthenticatedUser, id: string, timeZone: string | undefined): Promise<void> {
    resolveTimeZone(timeZone);
    const deleted = await this.calendarRepository.delete(user.userId, id);
    if (!deleted) {
      throw new ResourceNotFoundException(CALENDAR_EVENT_RESOURCE, id);
    }
  }
}
