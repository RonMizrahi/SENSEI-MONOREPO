import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NoteResponseDto, UpdateNoteDto } from './dto/note.dto';
import { NOTES_REPOSITORY, type NotesRepositoryContract } from './notes.repository';

/** Read + replace operations behind the /patients/{id}/notes endpoints. */
@Injectable()
export class NotesService {
  constructor(@Inject(NOTES_REPOSITORY) private readonly notes: NotesRepositoryContract) {}

  /** Returns the caller's note for a patient (empty body when none). */
  async get(user: AuthenticatedUser, patientId: string): Promise<NoteResponseDto> {
    return NoteResponseDto.of(patientId, await this.notes.find(user.userId, patientId));
  }

  /** Upserts the caller's note for a patient and returns it. */
  async replace(
    user: AuthenticatedUser,
    patientId: string,
    dto: UpdateNoteDto,
  ): Promise<NoteResponseDto> {
    const note = await this.notes.upsert(user.userId, patientId, dto.body);
    return NoteResponseDto.of(patientId, note);
  }
}
