import { randomUUID } from 'node:crypto';
import { SEED_PATIENTS } from '../mock/seed';
import { MockPatientsRepository } from './patients.repository.mock';

describe('MockPatientsRepository', () => {
  let repository: MockPatientsRepository;

  beforeEach(() => {
    repository = new MockPatientsRepository();
  });

  describe('findAll', () => {
    it('seeds the demo roster as active patients, newest first', async () => {
      const patients = await repository.findAll(false);

      expect(patients).toHaveLength(SEED_PATIENTS.length);
      expect(patients.map((patient) => patient.id)).toEqual(
        expect.arrayContaining(SEED_PATIENTS.map((seed) => seed.id)),
      );
      const times = patients.map((patient) => patient.createdAt.getTime());
      expect(times).toEqual([...times].sort((a, b) => b - a));
    });

    it('returns only archived patients when asked', async () => {
      await expect(repository.findAll(true)).resolves.toEqual([]);
      const [first] = await repository.findAll(false);
      await repository.update(first.id, { archived: true });

      const archived = await repository.findAll(true);
      expect(archived.map((patient) => patient.id)).toEqual([first.id]);

      const active = await repository.findAll(false);
      expect(active.map((patient) => patient.id)).not.toContain(first.id);
    });
  });

  describe('create', () => {
    it('adds an active patient with a fresh uuid and timestamp', async () => {
      const name = `patient-${randomUUID()}`;
      const created = await repository.create({ name, phone: '050-1112233', email: null });

      expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(created.archived).toBe(false);
      expect(created.email).toBeNull();
      expect(created.createdAt).toBeInstanceOf(Date);

      const active = await repository.findAll(false);
      expect(active.map((patient) => patient.name)).toContain(name);
    });

    it('lists back-to-back creations newest-first even on equal timestamps', async () => {
      const older = await repository.create({
        name: `patient-${randomUUID()}`,
        phone: '050-1112233',
        email: null,
      });
      const newer = await repository.create({
        name: `patient-${randomUUID()}`,
        phone: '050-4445566',
        email: null,
      });

      const ids = (await repository.findAll(false)).map((patient) => patient.id);
      expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
    });
  });

  describe('update', () => {
    it('applies partial fields and leaves the rest untouched', async () => {
      const created = await repository.create({
        name: `patient-${randomUUID()}`,
        phone: '050-1112233',
        email: 'a@b.co',
      });

      const updated = await repository.update(created.id, { phone: '052-9998877' });

      expect(updated?.phone).toBe('052-9998877');
      expect(updated?.name).toBe(created.name);
      expect(updated?.email).toBe('a@b.co');
    });

    it('clears the email on explicit null', async () => {
      const created = await repository.create({
        name: `patient-${randomUUID()}`,
        phone: '050-1112233',
        email: 'a@b.co',
      });
      const updated = await repository.update(created.id, { email: null });
      expect(updated?.email).toBeNull();
    });

    it('returns null for an unknown id', async () => {
      await expect(repository.update(randomUUID(), { phone: '050-0000000' })).resolves.toBeNull();
    });
  });

  describe('delete', () => {
    it('removes the patient and reports true', async () => {
      const created = await repository.create({
        name: `patient-${randomUUID()}`,
        phone: '050-1112233',
        email: null,
      });

      await expect(repository.delete(created.id)).resolves.toBe(true);
      const remaining = await repository.findAll(false);
      expect(remaining.map((patient) => patient.id)).not.toContain(created.id);
    });

    it('reports false for an unknown id', async () => {
      await expect(repository.delete(randomUUID())).resolves.toBe(false);
    });
  });

  it('instances are isolated — seeds are not shared module state', async () => {
    const other = new MockPatientsRepository();
    const created = await repository.create({
      name: `patient-${randomUUID()}`,
      phone: '050-1112233',
      email: null,
    });
    const otherActive = await other.findAll(false);
    expect(otherActive.map((patient) => patient.id)).not.toContain(created.id);
  });
});
