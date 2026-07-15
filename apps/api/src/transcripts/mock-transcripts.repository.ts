import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SEED_EVENTS, SEED_USER } from '../mock/seed';
import { Transcript } from './entities/transcript.entity';
import type { NewTranscript, TranscriptStore } from './transcript-store';

/** MOCK_MODE transcript store — in-memory, keyed by meeting id (no database). */
@Injectable()
export class MockTranscriptsRepository implements TranscriptStore {
  private readonly byMeetingId = new Map<string, Transcript>();

  /** Returns the meeting's transcript, or null when none exists. */
  getByMeetingId(meetingId: string): Promise<Transcript | null> {
    return Promise.resolve(this.byMeetingId.get(meetingId) ?? null);
  }

  /** The single seeded therapist owns every seeded meeting (mock parity). */
  meetingBelongsToTherapist(meetingId: string, therapistId: string): Promise<boolean> {
    return Promise.resolve(
      therapistId === SEED_USER.id && SEED_EVENTS.some((event) => event.id === meetingId),
    );
  }

  /** True when a transcript already exists for the meeting. */
  existsByMeetingId(meetingId: string): Promise<boolean> {
    return Promise.resolve(this.byMeetingId.has(meetingId));
  }

  /** Stores a new transcript in memory and returns it. */
  create(transcript: NewTranscript): Promise<Transcript> {
    const stored = new Transcript();
    stored.id = randomUUID();
    stored.meetingId = transcript.meetingId;
    stored.rawText = transcript.rawText;
    stored.language = transcript.language;
    stored.diarizedSegments = transcript.diarizedSegments;
    stored.createdAt = new Date();
    this.byMeetingId.set(stored.meetingId, stored);
    return Promise.resolve(stored);
  }
}
