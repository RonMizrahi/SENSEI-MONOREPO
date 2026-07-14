import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CalendarEvent } from '../calendar/entities/calendar-event.entity';
import { SEED_EVENTS, SEED_MOCK_MODEL, SEED_SUMMARY_TEXT } from '../mock/seed';
import { MeetingSummary } from './entities/meeting-summary.entity';

/** Injection token — real TypeORM repository, or the seeded in-memory one in MOCK_MODE. */
export const SUMMARIES_REPOSITORY = Symbol('SUMMARIES_REPOSITORY');

/** Persistence contract for meeting-summary rows (one row per meeting). */
export interface SummariesRepository {
  /** Creates the row as pending, or resets an existing one (re-request semantics). */
  createPending(meetingId: string): Promise<void>;
  /** Marks the row as running (generation started). */
  markRunning(meetingId: string): Promise<void>;
  /** Marks the row ready with the generated text and producing model. */
  markReady(meetingId: string, text: string, model: string): Promise<void>;
  /** Marks the row failed with a human-readable error. */
  markFailed(meetingId: string, error: string): Promise<void>;
  /** Returns the meeting's summary row, or null when none exists. */
  findByMeetingId(meetingId: string): Promise<MeetingSummary | null>;
  /** Fails every row stranded in 'running'; returns how many were swept. */
  failAllRunning(error: string): Promise<number>;
  /** Whether the meeting (calendar event) exists. */
  meetingExists(meetingId: string): Promise<boolean>;
}

/** Postgres-backed implementation over the MeetingSummary entity. */
@Injectable()
export class SummariesTypeormRepository implements SummariesRepository {
  constructor(
    @InjectRepository(MeetingSummary)
    private readonly summaries: Repository<MeetingSummary>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Creates the row as pending, or resets an existing one — atomic upsert on meeting_id. */
  async createPending(meetingId: string): Promise<void> {
    await this.summaries.upsert({ meetingId, status: 'pending', text: null, error: null }, [
      'meetingId',
    ]);
  }

  /** Marks the row as running (generation started). */
  async markRunning(meetingId: string): Promise<void> {
    await this.summaries.update({ meetingId }, { status: 'running' });
  }

  /** Marks the row ready with the generated text and producing model. */
  async markReady(meetingId: string, text: string, model: string): Promise<void> {
    await this.summaries.update({ meetingId }, { status: 'ready', text, model, error: null });
  }

  /** Marks the row failed with a human-readable error. */
  async markFailed(meetingId: string, error: string): Promise<void> {
    await this.summaries.update({ meetingId }, { status: 'failed', error });
  }

  /** Returns the meeting's summary row, or null when none exists. */
  findByMeetingId(meetingId: string): Promise<MeetingSummary | null> {
    return this.summaries.findOne({ where: { meetingId } });
  }

  /** Fails every row stranded in 'running'; returns how many were swept. */
  async failAllRunning(error: string): Promise<number> {
    const result = await this.summaries.update({ status: 'running' }, { status: 'failed', error });
    return result.affected ?? 0;
  }

  /** Whether the meeting (calendar event) exists. */
  meetingExists(meetingId: string): Promise<boolean> {
    return this.dataSource.getRepository(CalendarEvent).exists({ where: { id: meetingId } });
  }
}

/**
 * MOCK_MODE implementation — in-memory rows, pre-seeded with one ready summary
 * for the first seeded meeting so the SPA has content out of the box.
 */
@Injectable()
export class SummariesMockRepository implements SummariesRepository {
  private readonly rows = new Map<string, MeetingSummary>();

  constructor() {
    this.seedReadySummary();
  }

  /** Creates the row as pending, or resets an existing one (re-request semantics). */
  createPending(meetingId: string): Promise<void> {
    if (this.rows.has(meetingId)) {
      this.patch(meetingId, { status: 'pending', text: null, error: null });
    } else {
      this.rows.set(meetingId, this.buildRow(meetingId));
    }
    return Promise.resolve();
  }

  /** Marks the row as running (generation started). */
  markRunning(meetingId: string): Promise<void> {
    this.patch(meetingId, { status: 'running' });
    return Promise.resolve();
  }

  /** Marks the row ready with the generated text and producing model. */
  markReady(meetingId: string, text: string, model: string): Promise<void> {
    this.patch(meetingId, { status: 'ready', text, model, error: null });
    return Promise.resolve();
  }

  /** Marks the row failed with a human-readable error. */
  markFailed(meetingId: string, error: string): Promise<void> {
    this.patch(meetingId, { status: 'failed', error });
    return Promise.resolve();
  }

  /** Returns the meeting's summary row, or null when none exists. */
  findByMeetingId(meetingId: string): Promise<MeetingSummary | null> {
    const row = this.rows.get(meetingId);
    return Promise.resolve(row ? { ...row } : null);
  }

  /** Fails every row stranded in 'running'; returns how many were swept. */
  failAllRunning(error: string): Promise<number> {
    let swept = 0;
    for (const row of this.rows.values()) {
      if (row.status === 'running') {
        row.status = 'failed';
        row.error = error;
        row.updatedAt = new Date();
        swept += 1;
      }
    }
    return Promise.resolve(swept);
  }

  /** Whether the meeting exists in the seeded demo calendar. */
  meetingExists(meetingId: string): Promise<boolean> {
    return Promise.resolve(SEED_EVENTS.some((event) => event.id === meetingId));
  }

  /** Builds a fresh pending row shaped like the MeetingSummary entity. */
  private buildRow(meetingId: string): MeetingSummary {
    const row = new MeetingSummary();
    row.id = crypto.randomUUID();
    row.meetingId = meetingId;
    row.status = 'pending';
    row.text = null;
    row.model = '';
    row.error = null;
    row.createdAt = new Date();
    row.updatedAt = new Date();
    return row;
  }

  /** Applies a partial update to an existing row (no-op when the row is absent). */
  private patch(meetingId: string, changes: Partial<MeetingSummary>): void {
    const row = this.rows.get(meetingId);
    if (!row) return;
    Object.assign(row, changes);
    row.updatedAt = new Date();
  }

  /** Pre-seeds a ready summary for the first seeded meeting (demo content). */
  private seedReadySummary(): void {
    const row = this.buildRow(SEED_EVENTS[0].id);
    row.status = 'ready';
    row.text = SEED_SUMMARY_TEXT;
    row.model = SEED_MOCK_MODEL;
    this.rows.set(row.meetingId, row);
  }
}
