import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from './entities/patient.entity';

/** DI token consumers use to obtain the patients repository (real or mock). */
export const PATIENTS_REPOSITORY = Symbol('PATIENTS_REPOSITORY');

/** Fields persisted when creating a patient. */
export interface CreatePatientFields {
  name: string;
  phone: string;
  email: string | null;
}

/** Partial patient update — undefined fields stay unchanged; email null clears it. */
export interface UpdatePatientFields {
  name?: string;
  phone?: string;
  email?: string | null;
  archived?: boolean;
}

/**
 * Narrows an update payload to its defined fields (undefined = leave unchanged).
 * Single home of the updatable-field list — shared by the real and mock repositories.
 */
export function definedPatientFields(fields: UpdatePatientFields): Partial<Patient> {
  const defined: Partial<Patient> = {};
  if (fields.name !== undefined) defined.name = fields.name;
  if (fields.phone !== undefined) defined.phone = fields.phone;
  if (fields.email !== undefined) defined.email = fields.email;
  if (fields.archived !== undefined) defined.archived = fields.archived;
  return defined;
}

/** Data-access contract for patients — TypeORM in production, seeded in-memory in MOCK_MODE. */
export interface PatientsRepositoryContract {
  /** Lists patients in one archive state, newest first. */
  findAll(archived: boolean): Promise<Patient[]>;
  /** Inserts a new (active) patient and returns the stored row. */
  create(fields: CreatePatientFields): Promise<Patient>;
  /** Applies the defined fields; returns the updated patient or null when the id is unknown. */
  update(id: string, fields: UpdatePatientFields): Promise<Patient | null>;
  /** Deletes by id; returns false when the id is unknown. */
  delete(id: string): Promise<boolean>;
}

/** PostgreSQL-backed patients repository. */
@Injectable()
export class PatientsRepository implements PatientsRepositoryContract {
  constructor(@InjectRepository(Patient) private readonly repository: Repository<Patient>) {}

  /**
   * Lists patients in one archive state, newest first.
   * @param archived true → only archived patients; false → only active ones.
   */
  findAll(archived: boolean): Promise<Patient[]> {
    return this.repository.find({ where: { archived }, order: { createdAt: 'DESC' } });
  }

  /**
   * Inserts a new patient row.
   * @param fields Name, phone and nullable email.
   */
  create(fields: CreatePatientFields): Promise<Patient> {
    return this.repository.save(this.repository.create(fields));
  }

  /**
   * Applies the defined fields via a single atomic UPDATE (no read-modify-write race).
   * @returns The updated patient, or null when the id is unknown.
   */
  async update(id: string, fields: UpdatePatientFields): Promise<Patient | null> {
    const result = await this.repository.update({ id }, definedPatientFields(fields));
    if ((result.affected ?? 0) === 0) return null;
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Deletes a patient by id.
   * @returns true when a row was removed, false when the id is unknown.
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }
}
