import { randomUUID } from 'node:crypto';
import { HttpStatus } from '@nestjs/common';
import { AppException, ResourceNotFoundException } from '../common/exceptions/app.exception';
import { Patient } from './entities/patient.entity';
import { PatientsService } from './patients.service';

function makePatient(overrides: Partial<Patient> = {}): Patient {
  const patient = new Patient();
  patient.id = randomUUID();
  patient.name = 'דנה לוי';
  patient.phone = '054-1234567';
  patient.email = 'dana.l@mail.com';
  patient.archived = false;
  patient.createdAt = new Date('2025-01-15T10:00:00Z');
  return Object.assign(patient, overrides);
}

describe('PatientsService', () => {
  let repository: { findAll: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
  let service: PatientsService;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    service = new PatientsService(repository);
  });

  describe('list', () => {
    it('returns wire-shaped patients and forwards the archived flag', async () => {
      const patient = makePatient();
      repository.findAll.mockResolvedValue([patient]);

      const result = await service.list(false);

      expect(repository.findAll).toHaveBeenCalledWith(false);
      expect(result).toEqual([
        {
          id: patient.id,
          name: patient.name,
          phone: patient.phone,
          email: patient.email,
          created_at: '2025-01-15T10:00:00.000Z',
          archived: false,
        },
      ]);
    });

    it('requests only archived patients when asked', async () => {
      repository.findAll.mockResolvedValue([]);
      await expect(service.list(true)).resolves.toEqual([]);
      expect(repository.findAll).toHaveBeenCalledWith(true);
    });
  });

  describe('create', () => {
    it('persists the payload and returns the wire shape', async () => {
      const patient = makePatient();
      repository.create.mockResolvedValue(patient);

      const result = await service.create({
        name: patient.name,
        phone: patient.phone,
        email: patient.email,
      });

      expect(repository.create).toHaveBeenCalledWith({
        name: patient.name,
        phone: patient.phone,
        email: patient.email,
      });
      expect(result.id).toBe(patient.id);
      expect(result.archived).toBe(false);
    });

    it('normalizes an omitted email to null', async () => {
      const patient = makePatient({ email: null });
      repository.create.mockResolvedValue(patient);

      const result = await service.create({ name: patient.name, phone: patient.phone });

      expect(repository.create).toHaveBeenCalledWith({
        name: patient.name,
        phone: patient.phone,
        email: null,
      });
      expect(result.email).toBeNull();
    });
  });

  describe('update', () => {
    it('rejects an empty update with 400 EMPTY_UPDATE', async () => {
      let caught: unknown;
      await service.update(randomUUID(), {}).catch((error: unknown) => {
        caught = error;
      });
      expect(caught).toBeInstanceOf(AppException);
      expect((caught as AppException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('throws 404 for an unknown id', async () => {
      repository.update.mockResolvedValue(null);
      await expect(service.update(randomUUID(), { phone: '050-0000000' })).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it('passes an explicit email null through (clears the email)', async () => {
      const patient = makePatient({ email: null });
      repository.update.mockResolvedValue(patient);

      const result = await service.update(patient.id, { email: null });

      expect(repository.update).toHaveBeenCalledWith(patient.id, { email: null });
      expect(result.email).toBeNull();
    });

    it('updates the archived flag alone', async () => {
      const patient = makePatient({ archived: true });
      repository.update.mockResolvedValue(patient);

      const result = await service.update(patient.id, { archived: true });

      expect(repository.update).toHaveBeenCalledWith(
        patient.id,
        expect.objectContaining({ archived: true }),
      );
      expect(result.archived).toBe(true);
    });
  });

  describe('remove', () => {
    it('resolves when the repository deletes a row', async () => {
      repository.delete.mockResolvedValue(true);
      const id = randomUUID();
      await expect(service.remove(id)).resolves.toBeUndefined();
      expect(repository.delete).toHaveBeenCalledWith(id);
    });

    it('throws 404 for an unknown id', async () => {
      repository.delete.mockResolvedValue(false);
      await expect(service.remove(randomUUID())).rejects.toBeInstanceOf(ResourceNotFoundException);
    });
  });
});
