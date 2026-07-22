import type { CalendarRepository } from '../calendar/calendar.repository';
import type { CalendarEvent } from '../calendar/entities/calendar-event.entity';
import type { PatientsRepositoryContract } from '../patients/patients.repository';
import type { MeetingSummary } from '../summaries/entities/meeting-summary.entity';
import type { SummariesRepository } from '../summaries/summaries.repository';
import { AssistantContextService } from './assistant-context.service';

const THERAPIST = 'therapist-1';
const READABLE = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function event(id: string, patientId: string | null, startAt: Date): CalendarEvent {
  return { id, patientId, startAt, endAt: startAt, therapistId: THERAPIST } as CalendarEvent;
}

/** Builds the service over in-memory fakes of the three reused repositories. */
function buildService(events: CalendarEvent[], readyMeetingIds: string[] = []) {
  const patients = {
    findAll: () =>
      Promise.resolve([
        { id: 'p1', name: 'דנה' },
        { id: 'p2', name: 'רון' },
      ]),
  } as unknown as PatientsRepositoryContract;
  const calendar = {
    findOverlapping: () => Promise.resolve(events),
  } as unknown as CalendarRepository;
  const summaries = {
    findByMeetingId: (meetingId: string) =>
      Promise.resolve(
        readyMeetingIds.includes(meetingId) ? ({ status: 'ready' } as MeetingSummary) : null,
      ),
  } as unknown as SummariesRepository;
  return new AssistantContextService(patients, calendar, summaries);
}

describe('AssistantContextService', () => {
  it('listPatients returns the roster as {id,name}', async () => {
    const service = buildService([]);
    expect(await service.listPatients(THERAPIST)).toEqual([
      { id: 'p1', name: 'דנה' },
      { id: 'p2', name: 'רון' },
    ]);
  });

  it('agenda resolves the patient name and formats the time numerically', async () => {
    const service = buildService([event('m1', 'p1', new Date(Date.now() + DAY_MS))]);
    const [item] = await service.agenda(THERAPIST, 7);
    expect(item.patient_name).toBe('דנה');
    expect(item.starts_at).toMatch(READABLE);
  });

  it('agenda leaves patient_name null for an unlinked event', async () => {
    const service = buildService([event('m9', null, new Date(Date.now() + DAY_MS))]);
    const [item] = await service.agenda(THERAPIST, 7);
    expect(item.patient_name).toBeNull();
  });

  it('cadence counts a patient’s past/future meetings within the window', async () => {
    const past = new Date(Date.now() - DAY_MS);
    const future = new Date(Date.now() + DAY_MS);
    const service = buildService([
      event('m1', 'p1', past),
      event('m2', 'p1', future),
      event('m3', 'p2', future), // another patient — excluded
    ]);
    const cadence = await service.cadence(THERAPIST, 'p1');
    expect(cadence.patient_name).toBe('דנה');
    expect(cadence.total_meetings).toBe(2);
    expect(cadence.last_meeting_at).toMatch(READABLE);
    expect(cadence.next_meeting_at).toMatch(READABLE);
  });

  it('patientMeetings lists newest-first with has_summary from a ready summary', async () => {
    const older = new Date(Date.now() - 2 * DAY_MS);
    const newer = new Date(Date.now() - DAY_MS);
    const service = buildService(
      [event('m-old', 'p1', older), event('m-new', 'p1', newer)],
      ['m-new'],
    );
    const meetings = await service.patientMeetings(THERAPIST, 'p1');
    expect(meetings.map((m) => m.meeting_id)).toEqual(['m-new', 'm-old']); // newest first
    expect(meetings[0].has_summary).toBe(true);
    expect(meetings[1].has_summary).toBe(false);
  });
});
