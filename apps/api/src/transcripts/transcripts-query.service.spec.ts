import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ResourceNotFoundException } from '../common/exceptions/app.exception';
import type { Transcript } from './entities/transcript.entity';
import type { TranscriptStore } from './transcript-store';
import { TranscriptsQueryService } from './transcripts-query.service';

const USER: AuthenticatedUser = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 't@x.co',
  fullName: 'T',
  role: 'therapist',
};
const MEETING_ID = '11111111-1111-4111-8111-111111111111';

/** A TranscriptStore stub plus refs to its mocks, for configurable ownership + transcript. */
function createStore(owns: boolean, transcript: Transcript | null) {
  const getByMeetingId = jest.fn(() => Promise.resolve(transcript));
  const meetingBelongsToTherapist = jest.fn(() => Promise.resolve(owns));
  const store: TranscriptStore = {
    getByMeetingId,
    existsByMeetingId: jest.fn(() => Promise.resolve(transcript !== null)),
    create: jest.fn(),
    meetingBelongsToTherapist,
  };
  return { store, getByMeetingId, meetingBelongsToTherapist };
}

function buildTranscript(): Transcript {
  return {
    id: 'abc',
    meetingId: MEETING_ID,
    rawText: 'מטפל/ת: שלום\nמטופל/ת: היי',
    diarizedSegments: [
      { speaker: 'מטפל/ת', start_time: 0, end_time: 0, text: 'שלום' },
      { speaker: 'מטופל/ת', start_time: 0, end_time: 0, text: 'היי' },
    ],
    language: 'he',
    createdAt: new Date(),
  };
}

describe('TranscriptsQueryService', () => {
  it('returns the mapped transcript for an owned meeting with a transcript', async () => {
    const service = new TranscriptsQueryService(createStore(true, buildTranscript()).store);

    const dto = await service.getForMeeting(USER, MEETING_ID);

    expect(dto.meeting_id).toBe(MEETING_ID);
    expect(dto.language).toBe('he');
    expect(dto.raw_text).toContain('שלום');
    expect(dto.segments).toEqual([
      { speaker: 'מטפל/ת', text: 'שלום' },
      { speaker: 'מטופל/ת', text: 'היי' },
    ]);
  });

  it('404s when the meeting is not the caller’s (before reading the transcript)', async () => {
    const mock = createStore(false, buildTranscript());
    const service = new TranscriptsQueryService(mock.store);

    await expect(service.getForMeeting(USER, MEETING_ID)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(mock.getByMeetingId).not.toHaveBeenCalled();
  });

  it('404s when the owned meeting has no transcript', async () => {
    const service = new TranscriptsQueryService(createStore(true, null).store);

    await expect(service.getForMeeting(USER, MEETING_ID)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });
});
