import { Inject, Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  CALENDAR_REPOSITORY,
  type CalendarRepository,
} from '../calendar/calendar.repository';
import type { CalendarEvent } from '../calendar/entities/calendar-event.entity';
import {
  PATIENTS_REPOSITORY,
  type PatientsRepositoryContract,
} from '../patients/patients.repository';
import {
  SUMMARIES_REPOSITORY,
  type SummariesRepository,
} from '../summaries/summaries.repository';
import {
  AgendaItemDto,
  CadenceDto,
  PatientBriefDto,
  PatientMeetingDto,
} from './dto/context.dto';

/**
 * Builds the PHI-safe context views from the existing repositories. Calendar events
 * are therapist-scoped via {@link CalendarRepository.findOverlapping}; patients are
 * not scoped in the monorepo (its data model). Every timestamp is pre-formatted as a
 * numeric local string so the model never sees raw ISO.
 */

/** IANA zone used to render all readable times. */
const ISRAEL_TZ = 'Asia/Jerusalem';
/** Numeric local time format the frontend/tool contract expects. */
const TIME_FORMAT = 'dd/MM/yyyy HH:mm';
/** Milliseconds in one day. */
const DAY_MS = 24 * 60 * 60 * 1000;
/** ±window for cadence/meetings lookups (365 days). */
const CADENCE_WINDOW_MS = 365 * DAY_MS;
/** The generation status that counts as a real, viewable summary. */
const READY_STATUS = 'ready';

/** Renders a UTC timestamp as a plain numeric local string (e.g. "21/07/2026 10:59"). */
function readable(date: Date): string {
  return DateTime.fromJSDate(date).setZone(ISRAEL_TZ).toFormat(TIME_FORMAT);
}

/** The latest date in a non-empty list. */
function maxDate(dates: Date[]): Date {
  return dates.reduce((latest, current) => (current > latest ? current : latest));
}

/** The earliest date in a non-empty list. */
function minDate(dates: Date[]): Date {
  return dates.reduce((earliest, current) => (current < earliest ? current : earliest));
}

@Injectable()
export class AssistantContextService {
  private readonly logger = new Logger(AssistantContextService.name);

  constructor(
    @Inject(PATIENTS_REPOSITORY) private readonly patients: PatientsRepositoryContract,
    @Inject(CALENDAR_REPOSITORY) private readonly events: CalendarRepository,
    @Inject(SUMMARIES_REPOSITORY) private readonly summaries: SummariesRepository,
  ) {}

  /** A patientId→name map for resolving event owners. */
  private async patientNames(): Promise<Map<string, string>> {
    const patients = await this.patients.findAll(false);
    return new Map(patients.map((patient) => [patient.id, patient.name]));
  }

  /**
   * The patient roster (name only) so the assistant can resolve a name to an id.
   * @param _userId Authenticated therapist (patients are not scoped in the monorepo).
   */
  async listPatients(_userId: string): Promise<PatientBriefDto[]> {
    const patients = await this.patients.findAll(false);
    return patients.map((patient) => ({ id: patient.id, name: patient.name }));
  }

  /**
   * Upcoming meetings in the next `days` days — "who is next".
   * @param userId Authenticated therapist (scopes the events).
   * @param days Look-ahead window in days.
   */
  async agenda(userId: string, days: number): Promise<AgendaItemDto[]> {
    const now = new Date();
    const events = await this.events.findOverlapping(
      userId,
      now,
      new Date(now.getTime() + days * DAY_MS),
    );
    const names = await this.patientNames();
    return events.map((event) => ({
      patient_name: event.patientId ? (names.get(event.patientId) ?? null) : null,
      starts_at: readable(event.startAt),
    }));
  }

  /**
   * Meeting cadence for one patient — last/next meeting and total count.
   * @param userId Authenticated therapist (scopes the events).
   * @param patientId Patient to summarize cadence for.
   * @returns Cadence, or a zeroed result on a bad id / DB error.
   */
  async cadence(userId: string, patientId: string): Promise<CadenceDto> {
    try {
      const now = new Date();
      const mine = await this.patientEvents(userId, patientId, now);
      const past = mine.filter((event) => event.startAt < now).map((event) => event.startAt);
      const future = mine.filter((event) => event.startAt >= now).map((event) => event.startAt);
      const names = await this.patientNames();
      return {
        patient_name: names.get(patientId) ?? null,
        last_meeting_at: past.length > 0 ? readable(maxDate(past)) : null,
        next_meeting_at: future.length > 0 ? readable(minDate(future)) : null,
        total_meetings: mine.length,
      };
    } catch (error) {
      this.logger.warn(`cadence lookup failed for patient ${patientId}`, error);
      return { patient_name: null, last_meeting_at: null, next_meeting_at: null, total_meetings: 0 };
    }
  }

  /**
   * A patient's meetings — each with its meeting_id (for the summary) and readable time.
   * @param userId Authenticated therapist (scopes the events).
   * @param patientId Patient whose meetings to list.
   * @returns Meetings newest-first, or an empty list on a bad id / DB error.
   */
  async patientMeetings(userId: string, patientId: string): Promise<PatientMeetingDto[]> {
    try {
      const now = new Date();
      const mine = (await this.patientEvents(userId, patientId, now)).sort(
        (a, b) => b.startAt.getTime() - a.startAt.getTime(),
      );
      const result: PatientMeetingDto[] = [];
      for (const event of mine) {
        const summary = await this.summaries.findByMeetingId(event.id);
        result.push({
          meeting_id: event.id,
          starts_at: readable(event.startAt),
          has_summary: summary !== null && summary.status === READY_STATUS,
        });
      }
      return result;
    } catch (error) {
      this.logger.warn(`meetings lookup failed for patient ${patientId}`, error);
      return [];
    }
  }

  /** The therapist's events for one patient within the ±365-day window around `now`. */
  private async patientEvents(
    userId: string,
    patientId: string,
    now: Date,
  ): Promise<CalendarEvent[]> {
    const events = await this.events.findOverlapping(
      userId,
      new Date(now.getTime() - CADENCE_WINDOW_MS),
      new Date(now.getTime() + CADENCE_WINDOW_MS),
    );
    return events.filter((event) => event.patientId === patientId);
  }
}
