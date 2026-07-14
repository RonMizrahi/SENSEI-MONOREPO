import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transcript } from './entities/transcript.entity';
import type { NewTranscript, TranscriptStore } from './transcript-store';

/** TypeORM-backed transcript persistence (real TRANSCRIPT_STORE / TRANSCRIPT_READER). */
@Injectable()
export class TranscriptsRepository implements TranscriptStore {
  constructor(@InjectRepository(Transcript) private readonly repository: Repository<Transcript>) {}

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
