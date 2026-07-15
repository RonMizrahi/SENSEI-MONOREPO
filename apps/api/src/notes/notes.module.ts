import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isMockMode, provideMockSwappable } from '../common/mock-mode';
import { PatientNote } from './entities/patient-note.entity';
import { NotesController } from './notes.controller';
import {
  NOTES_REPOSITORY,
  NotesRepository,
  type NotesRepositoryContract,
} from './notes.repository';
import { MockNotesRepository } from './notes.repository.mock';
import { NotesService } from './notes.service';

/** Per-therapist patient notes — TypeORM-backed, or seeded in-memory in MOCK_MODE. */
@Module({
  imports: [...(isMockMode() ? [] : [TypeOrmModule.forFeature([PatientNote])])],
  controllers: [NotesController],
  providers: [
    NotesService,
    provideMockSwappable<NotesRepositoryContract>(
      NOTES_REPOSITORY,
      NotesRepository,
      MockNotesRepository,
    ),
  ],
})
export class NotesModule {}
