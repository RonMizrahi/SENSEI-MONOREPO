import { randomUUID } from 'node:crypto';
import { QueryFailedError } from 'typeorm';
import type { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { isUniqueViolation, UserTypeOrmRepository } from './user.repository';

type MockedOrmRepository = jest.Mocked<
  Pick<Repository<User>, 'create' | 'save' | 'findOne' | 'increment' | 'update'>
>;

function uniqueViolation(): QueryFailedError {
  return new QueryFailedError('INSERT', [], Object.assign(new Error('dup'), { code: '23505' }));
}

describe('isUniqueViolation', () => {
  it('detects the Postgres 23505 driver code', () => {
    expect(isUniqueViolation(uniqueViolation())).toBe(true);
  });

  it('rejects other QueryFailedError codes and non-TypeORM errors', () => {
    const otherCode = new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('nope'), { code: '23503' }),
    );
    expect(isUniqueViolation(otherCode)).toBe(false);
    expect(isUniqueViolation(new Error('plain'))).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});

describe('UserTypeOrmRepository', () => {
  let orm: MockedOrmRepository;
  let repository: UserTypeOrmRepository;

  beforeEach(() => {
    orm = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      increment: jest.fn(),
      update: jest.fn(),
    };
    repository = new UserTypeOrmRepository(orm as unknown as Repository<User>);
  });

  const fields = {
    email: `u-${randomUUID()}@test.local`,
    fullName: null,
    passwordHash: 'hash',
    authType: 'password',
    role: 'therapist',
  };

  describe('create', () => {
    it('saves a new row with tokenVersion 0', async () => {
      const entity = new User();
      orm.create.mockReturnValue(entity);
      orm.save.mockResolvedValue(entity);

      await expect(repository.create(fields)).resolves.toBe(entity);
      expect(orm.create).toHaveBeenCalledWith({ ...fields, tokenVersion: 0 });
    });

    it('returns null on a duplicate-email unique violation', async () => {
      orm.create.mockReturnValue(new User());
      orm.save.mockRejectedValue(uniqueViolation());

      await expect(repository.create(fields)).resolves.toBeNull();
    });

    it('rethrows non-unique-violation errors', async () => {
      orm.create.mockReturnValue(new User());
      orm.save.mockRejectedValue(new Error('connection lost'));

      await expect(repository.create(fields)).rejects.toThrow('connection lost');
    });
  });

  it('findByEmail/findById delegate to findOne with the right filter', async () => {
    orm.findOne.mockResolvedValue(null);
    const id = randomUUID();

    await repository.findByEmail(fields.email);
    await repository.findById(id);

    expect(orm.findOne).toHaveBeenNthCalledWith(1, { where: { email: fields.email } });
    expect(orm.findOne).toHaveBeenNthCalledWith(2, { where: { id } });
  });

  describe('incrementTokenVersion', () => {
    it('returns true when a row was bumped', async () => {
      orm.increment.mockResolvedValue({ affected: 1, generatedMaps: [], raw: [] });
      const id = randomUUID();

      await expect(repository.incrementTokenVersion(id)).resolves.toBe(true);
      expect(orm.increment).toHaveBeenCalledWith({ id }, 'tokenVersion', 1);
    });

    it('returns false when the user is missing', async () => {
      orm.increment.mockResolvedValue({ affected: 0, generatedMaps: [], raw: [] });

      await expect(repository.incrementTokenVersion(randomUUID())).resolves.toBe(false);
    });
  });

  describe('changePassword', () => {
    it('updates the hash and bumps token_version in one statement', async () => {
      orm.update.mockResolvedValue({ affected: 1, generatedMaps: [], raw: [] });
      const id = randomUUID();

      await expect(repository.changePassword(id, 'new-hash')).resolves.toBe(true);
      expect(orm.update).toHaveBeenCalledWith(
        { id },
        expect.objectContaining({ passwordHash: 'new-hash' }),
      );
    });

    it('returns false when the user is missing', async () => {
      orm.update.mockResolvedValue({ affected: 0, generatedMaps: [], raw: [] });

      await expect(repository.changePassword(randomUUID(), 'new-hash')).resolves.toBe(false);
    });
  });
});
