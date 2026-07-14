import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CalendarEvent } from '../calendar/entities/calendar-event.entity';
import { SEED_EVENTS, SEED_PATIENTS } from '../mock/seed';
import { Patient } from '../patients/entities/patient.entity';

/** Injection token for the upload-target lookups (meeting + patient existence). */
export const UPLOAD_TARGETS_REPOSITORY = Symbol('UPLOAD_TARGETS_REPOSITORY');

/** The slice of a calendar event the upload flow validates against. */
export interface UploadMeeting {
  id: string;
  patientId: string | null;
}

/** Existence checks for the entities an upload references. */
export interface UploadTargetsRepository {
  /** Returns the meeting's id + linked patient, or null when it does not exist. */
  findMeeting(meetingId: string): Promise<UploadMeeting | null>;
  /** True when a patient with this id exists. */
  patientExists(patientId: string): Promise<boolean>;
}

/** Database-backed lookups against the frozen CalendarEvent/Patient entities. */
@Injectable()
export class TypeOrmUploadTargetsRepository implements UploadTargetsRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Loads the meeting row by id, or null when absent. */
  async findMeeting(meetingId: string): Promise<UploadMeeting | null> {
    const meeting = await this.dataSource
      .getRepository(CalendarEvent)
      .findOne({ where: { id: meetingId } });
    return meeting === null ? null : { id: meeting.id, patientId: meeting.patientId };
  }

  /** Checks the patients table for the id. */
  patientExists(patientId: string): Promise<boolean> {
    return this.dataSource.getRepository(Patient).existsBy({ id: patientId });
  }
}

/** MOCK_MODE lookups against the shared seed world (no database). */
@Injectable()
export class MockUploadTargetsRepository implements UploadTargetsRepository {
  /** Finds the seeded event by id. */
  findMeeting(meetingId: string): Promise<UploadMeeting | null> {
    const event = SEED_EVENTS.find((seeded) => seeded.id === meetingId);
    return Promise.resolve(
      event === undefined ? null : { id: event.id, patientId: event.patientId },
    );
  }

  /** Checks the seeded roster for the id. */
  patientExists(patientId: string): Promise<boolean> {
    return Promise.resolve(SEED_PATIENTS.some((seeded) => seeded.id === patientId));
  }
}
