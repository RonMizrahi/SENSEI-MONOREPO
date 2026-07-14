import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { SEED_EVENTS, SEED_USER } from '../mock/seed';
import { DEFAULT_TIME_ZONE } from './calendar.constants';
import { CalendarEvent } from './entities/calendar-event.entity';

/** Injection token bound to the mode-appropriate CalendarRepository. */
export const CALENDAR_REPOSITORY = Symbol('CALENDAR_REPOSITORY');

/** Fields required to persist a new event — therapistId always the caller. */
export interface CreateCalendarEventData {
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  therapistId: string;
  patientId: string | null;
}

/** Partial column updates applied by PATCH — absent keys stay untouched. */
export interface UpdateCalendarEventData {
  title?: string;
  description?: string | null;
  startAt?: Date;
  endAt?: Date;
  patientId?: string | null;
}

/** Data access for calendar events — every query is scoped to one therapist. */
export interface CalendarRepository {
  create(data: CreateCalendarEventData): Promise<CalendarEvent>;
  findOverlapping(therapistId: string, fromAt: Date, toAtExclusive: Date): Promise<CalendarEvent[]>;
  findById(therapistId: string, id: string): Promise<CalendarEvent | null>;
  update(
    therapistId: string,
    id: string,
    updates: UpdateCalendarEventData,
  ): Promise<CalendarEvent | null>;
  delete(therapistId: string, id: string): Promise<boolean>;
}

/** PostgreSQL-backed implementation (real mode). */
@Injectable()
export class TypeOrmCalendarRepository implements CalendarRepository {
  constructor(
    @InjectRepository(CalendarEvent) private readonly events: Repository<CalendarEvent>,
  ) {}

  /**
   * Inserts a new event row.
   * @returns The stored event with generated id and created_at.
   */
  async create(data: CreateCalendarEventData): Promise<CalendarEvent> {
    return this.events.save(this.events.create(data));
  }

  /**
   * Lists the therapist's events overlapping the half-open UTC window
   * [fromAt, toAtExclusive), ordered by start time.
   */
  async findOverlapping(
    therapistId: string,
    fromAt: Date,
    toAtExclusive: Date,
  ): Promise<CalendarEvent[]> {
    return this.events.find({
      where: { therapistId, startAt: LessThan(toAtExclusive), endAt: MoreThan(fromAt) },
      order: { startAt: 'ASC' },
    });
  }

  /** Finds one of the therapist's events by id, or null when absent/foreign. */
  async findById(therapistId: string, id: string): Promise<CalendarEvent | null> {
    return this.events.findOne({ where: { id, therapistId } });
  }

  /**
   * Applies the provided column updates to the therapist's event.
   * @returns The updated event, or null when absent/foreign.
   */
  async update(
    therapistId: string,
    id: string,
    updates: UpdateCalendarEventData,
  ): Promise<CalendarEvent | null> {
    const event = await this.findById(therapistId, id);
    if (!event) return null;
    return this.events.save(this.events.merge(event, updates));
  }

  /**
   * Deletes the therapist's event by id.
   * @returns true when a row was removed, false when absent/foreign.
   */
  async delete(therapistId: string, id: string): Promise<boolean> {
    const result = await this.events.delete({ id, therapistId });
    return (result.affected ?? 0) > 0;
  }
}

/**
 * Seeded in-memory implementation (MOCK_MODE) — SEED_EVENTS materialized
 * around "now" in the default zone, owned by the seeded demo therapist.
 */
@Injectable()
export class MockCalendarRepository implements CalendarRepository {
  private readonly events: CalendarEvent[];

  constructor() {
    const today = DateTime.now().setZone(DEFAULT_TIME_ZONE).startOf('day');
    this.events = SEED_EVENTS.map((seed) => {
      const startAt = today.plus({ days: seed.dayOffset }).set({ hour: seed.startHour });
      const event = new CalendarEvent();
      event.id = seed.id;
      event.title = seed.title;
      event.description = seed.description;
      event.startAt = startAt.toJSDate();
      event.endAt = startAt.plus({ minutes: seed.durationMinutes }).toJSDate();
      event.createdAt = new Date();
      event.therapistId = SEED_USER.id;
      event.patientId = seed.patientId;
      return event;
    });
  }

  /** Appends a new in-memory event with a random id. */
  create(data: CreateCalendarEventData): Promise<CalendarEvent> {
    const event = new CalendarEvent();
    Object.assign(event, data);
    event.id = randomUUID();
    event.createdAt = new Date();
    this.events.push(event);
    return Promise.resolve(event);
  }

  /** Same half-open [fromAt, toAtExclusive) overlap contract as the real repo. */
  findOverlapping(
    therapistId: string,
    fromAt: Date,
    toAtExclusive: Date,
  ): Promise<CalendarEvent[]> {
    const matches = this.events
      .filter(
        (event) =>
          event.therapistId === therapistId &&
          event.startAt < toAtExclusive &&
          event.endAt > fromAt,
      )
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    return Promise.resolve(matches);
  }

  /** Finds one of the therapist's events by id, or null when absent/foreign. */
  findById(therapistId: string, id: string): Promise<CalendarEvent | null> {
    const event = this.events.find(
      (candidate) => candidate.id === id && candidate.therapistId === therapistId,
    );
    return Promise.resolve(event ?? null);
  }

  /** Applies the provided updates in place, or returns null when absent/foreign. */
  async update(
    therapistId: string,
    id: string,
    updates: UpdateCalendarEventData,
  ): Promise<CalendarEvent | null> {
    const event = await this.findById(therapistId, id);
    if (!event) return null;
    if (updates.title !== undefined) event.title = updates.title;
    if (updates.description !== undefined) event.description = updates.description;
    if (updates.startAt !== undefined) event.startAt = updates.startAt;
    if (updates.endAt !== undefined) event.endAt = updates.endAt;
    if (updates.patientId !== undefined) event.patientId = updates.patientId;
    return event;
  }

  /** Removes the therapist's event; false when absent/foreign. */
  delete(therapistId: string, id: string): Promise<boolean> {
    const index = this.events.findIndex(
      (candidate) => candidate.id === id && candidate.therapistId === therapistId,
    );
    if (index < 0) return Promise.resolve(false);
    this.events.splice(index, 1);
    return Promise.resolve(true);
  }
}
