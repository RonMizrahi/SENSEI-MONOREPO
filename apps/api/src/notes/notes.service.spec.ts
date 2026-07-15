import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PatientNote } from './entities/patient-note.entity';
import type { NotesRepositoryContract } from './notes.repository';
import { NotesService } from './notes.service';

const USER: AuthenticatedUser = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 't@x.co',
  fullName: 'T',
  role: 'therapist',
};
const PATIENT_ID = '00000000-0000-4000-8000-0000000000a1';

function buildNote(body: string): PatientNote {
  const note = new PatientNote();
  note.therapistId = USER.userId;
  note.patientId = PATIENT_ID;
  note.body = body;
  note.updatedAt = new Date('2026-07-15T09:00:00Z');
  return note;
}

function createRepo(): { repo: NotesRepositoryContract; find: jest.Mock; upsert: jest.Mock } {
  const find = jest.fn();
  const upsert = jest.fn();
  return { repo: { find, upsert }, find, upsert };
}

describe('NotesService', () => {
  it('returns the stored note body', async () => {
    const { repo, find } = createRepo();
    find.mockResolvedValue(buildNote('מטופל בטיפול'));
    const service = new NotesService(repo);

    const result = await service.get(USER, PATIENT_ID);

    expect(find).toHaveBeenCalledWith(USER.userId, PATIENT_ID);
    expect(result).toMatchObject({ patient_id: PATIENT_ID, body: 'מטופל בטיפול' });
    expect(result.updated_at).not.toBeNull();
  });

  it('returns an empty body (null timestamp) when no note exists', async () => {
    const { repo, find } = createRepo();
    find.mockResolvedValue(null);
    const service = new NotesService(repo);

    const result = await service.get(USER, PATIENT_ID);

    expect(result).toEqual({ patient_id: PATIENT_ID, body: '', updated_at: null });
  });

  it('upserts the note and echoes the stored body', async () => {
    const { repo, upsert } = createRepo();
    upsert.mockResolvedValue(buildNote('עודכן'));
    const service = new NotesService(repo);

    const result = await service.replace(USER, PATIENT_ID, { body: 'עודכן' });

    expect(upsert).toHaveBeenCalledWith(USER.userId, PATIENT_ID, 'עודכן');
    expect(result.body).toBe('עודכן');
  });
});
