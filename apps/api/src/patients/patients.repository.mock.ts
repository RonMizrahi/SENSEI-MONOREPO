import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { SEED_PATIENTS, SeedPatient } from '../mock/seed';
import { Patient } from './entities/patient.entity';
import {
  CreatePatientFields,
  definedPatientFields,
  PatientsRepositoryContract,
  UpdatePatientFields,
} from './patients.repository';

/** Materializes one seed row into a Patient entity instance. */
function fromSeed(seed: SeedPatient): Patient {
  const patient = new Patient();
  patient.id = seed.id;
  patient.name = seed.name;
  patient.phone = seed.phone;
  patient.email = seed.email;
  patient.archived = seed.archived;
  patient.createdAt = new Date(seed.createdAt);
  return patient;
}

/** Seeded in-memory patients repository — bound in MOCK_MODE (no database). */
@Injectable()
export class MockPatientsRepository implements PatientsRepositoryContract {
  /** Kept ordered newest-first: seeds sorted once, new patients unshifted (ties stay newest-first). */
  private readonly patients: Patient[] = SEED_PATIENTS.map(fromSeed).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  /**
   * Lists patients in one archive state, newest first.
   * @param archived true → only archived patients; false → only active ones.
   */
  findAll(archived: boolean): Promise<Patient[]> {
    return Promise.resolve(this.patients.filter((patient) => patient.archived === archived));
  }

  /**
   * Adds a new active patient to the in-memory store.
   * @param fields Name, phone and nullable email.
   */
  create(fields: CreatePatientFields): Promise<Patient> {
    const patient = new Patient();
    patient.id = randomUUID();
    patient.name = fields.name;
    patient.phone = fields.phone;
    patient.email = fields.email;
    patient.archived = false;
    patient.createdAt = new Date();
    this.patients.unshift(patient);
    return Promise.resolve(patient);
  }

  /**
   * Applies the defined fields to a stored patient.
   * @returns The updated patient, or null when the id is unknown.
   */
  update(id: string, fields: UpdatePatientFields): Promise<Patient | null> {
    const patient = this.patients.find((candidate) => candidate.id === id);
    if (!patient) return Promise.resolve(null);
    Object.assign(patient, definedPatientFields(fields));
    return Promise.resolve(patient);
  }

  /**
   * Removes a patient from the in-memory store.
   * @returns true when a patient was removed, false when the id is unknown.
   */
  delete(id: string): Promise<boolean> {
    const index = this.patients.findIndex((candidate) => candidate.id === id);
    if (index === -1) return Promise.resolve(false);
    this.patients.splice(index, 1);
    return Promise.resolve(true);
  }
}
