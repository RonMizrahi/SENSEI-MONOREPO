import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CalendarEvent } from '../calendar/entities/calendar-event.entity';
import { Transcript } from './entities/transcript.entity';
import type { NewTranscript, TranscriptStore } from './transcript-store';

/** TypeORM-backed transcript persistence (real TRANSCRIPT_STORE / TRANSCRIPT_READER). */
@Injectable()
export class TranscriptsRepository implements TranscriptStore {
  constructor(
    @InjectRepository(Transcript) private readonly repository: Repository<Transcript>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Whether the meeting exists AND is owned by the therapist (scoped read). */
  meetingBelongsToTherapist(meetingId: string, therapistId: string): Promise<boolean> {
    return this.dataSource
      .getRepository(CalendarEvent)
      .exists({ where: { id: meetingId, therapistId } });
  }

  /** Returns the meeting's transcript, or null when none exists. */
  getByMeetingId(meetingId: string): Promise<Transcript | null> {
    return this.repository.findOne({ where: { meetingId } });
  }

  /** True when a transcript already exists for the meeting. */
  existsByMeetingId(meetingId: string): Promise<boolean> {
    return this.repository.existsBy({ meetingId });
  }

  /** Inserts a new transcript row and returns it. */
  create(transcript: NewTranscript): Promise<Transcript> {
    return this.repository.save(this.repository.create(transcript));
  }
}
