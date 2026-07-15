import { randomUUID } from 'node:crypto';
import { QueryFailedError, Repository } from 'typeorm';
import { PatientHasLinkedEventsException } from '../common/exceptions/app.exception';
import { Patient } from './entities/patient.entity';
import { definedPatientFields, PatientsRepository } from './patients.repository';

function makePatient(overrides: Partial<Patient> = {}): Patient {
  const patient = new Patient();
  patient.id = randomUUID();
  patient.name = 'דנה לוי';
  patient.phone = '054-1234567';
  patient.email = null;
  patient.archived = false;
  patient.createdAt = new Date();
  return Object.assign(patient, overrides);
}

describe('definedPatientFields', () => {
  it('keeps only defined fields, including explicit email null', () => {
    expect(definedPatientFields({ email: null, archived: true })).toEqual({
      email: null,
      archived: true,
    });
  });

  it('returns an empty object when nothing is defined', () => {
    expect(definedPatientFields({})).toEqual({});
    expect(definedPatientFields({ name: undefined })).toEqual({});
  });
});

describe('PatientsRepository', () => {
  let typeormRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let repository: PatientsRepository;

  beforeEach(() => {
    typeormRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    repository = new PatientsRepository(typeormRepository as unknown as Repository<Patient>);
  });

  it('findAll filters by archived state and orders newest first', async () => {
    typeormRepository.find.mockResolvedValue([]);
    await repository.findAll(true);
    expect(typeormRepository.find).toHaveBeenCalledWith({
      where: { archived: true },
      order: { createdAt: 'DESC' },
    });
  });

  it('create persists a new entity built from the fields', async () => {
    const patient = makePatient();
    typeormRepository.create.mockReturnValue(patient);
    typeormRepository.save.mockResolvedValue(patient);

    const fields = { name: patient.name, phone: patient.phone, email: null };
    await expect(repository.create(fields)).resolves.toBe(patient);
    expect(typeormRepository.create).toHaveBeenCalledWith(fields);
    expect(typeormRepository.save).toHaveBeenCalledWith(patient);
  });

  it('update returns null without re-reading when no row was affected', async () => {
    typeormRepository.update.mockResolvedValue({ affected: 0, raw: {}, generatedMaps: [] });
    await expect(repository.update(randomUUID(), { phone: '050-0000000' })).resolves.toBeNull();
    expect(typeormRepository.findOne).not.toHaveBeenCalled();
  });

  it('update issues one atomic UPDATE with only the defined fields, then re-reads', async () => {
    const patient = makePatient({ email: null, archived: true });
    typeormRepository.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });
    typeormRepository.findOne.mockResolvedValue(patient);

    const updated = await repository.update(patient.id, { archived: true, email: null });

    expect(typeormRepository.update).toHaveBeenCalledWith(
      { id: patient.id },
      { archived: true, email: null },
    );
    expect(typeormRepository.findOne).toHaveBeenCalledWith({ where: { id: patient.id } });
    expect(updated).toBe(patient);
  });

  it('delete maps affected rows to a boolean', async () => {
    typeormRepository.delete.mockResolvedValue({ affected: 1, raw: {} });
    await expect(repository.delete(randomUUID())).resolves.toBe(true);

    typeormRepository.delete.mockResolvedValue({ affected: 0, raw: {} });
    await expect(repository.delete(randomUUID())).resolves.toBe(false);
  });

  it('delete translates a Postgres 23503 FK violation to a 409 conflict', async () => {
    const fkViolation = new QueryFailedError(
      'DELETE',
      [],
      Object.assign(new Error('fk'), { code: '23503' }),
    );
    typeormRepository.delete.mockRejectedValue(fkViolation);
    await expect(repository.delete(randomUUID())).rejects.toBeInstanceOf(
      PatientHasLinkedEventsException,
    );
  });

  it('delete rethrows non-FK query failures unchanged', async () => {
    const otherError = new QueryFailedError(
      'DELETE',
      [],
      Object.assign(new Error('other'), { code: '23505' }),
    );
    typeormRepository.delete.mockRejectedValue(otherError);
    await expect(repository.delete(randomUUID())).rejects.toBe(otherError);
  });
});
