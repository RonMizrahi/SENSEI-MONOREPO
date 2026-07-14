import { randomUUID } from 'node:crypto';
import { SEED_USER } from '../mock/seed';
import { PasswordService } from './password.service';
import { UserMockRepository } from './user.mock.repository';
import type { CreateUserFields } from './user.repository';

// Real argon2 hashing — each hash takes tens of ms, so share one repository.
jest.setTimeout(30_000);

function buildFields(overrides: Partial<CreateUserFields> = {}): CreateUserFields {
  return {
    email: `m-${randomUUID()}@test.local`,
    fullName: 'Mock Test',
    passwordHash: 'irrelevant-hash',
    authType: 'password',
    role: 'therapist',
    ...overrides,
  };
}

describe('UserMockRepository', () => {
  const passwordService = new PasswordService();
  let repository: UserMockRepository;

  beforeAll(() => {
    repository = new UserMockRepository(passwordService);
  });

  it('seeds the demo therapist with a hash that verifies demo1234', async () => {
    const seeded = await repository.findByEmail(SEED_USER.email);

    expect(seeded).not.toBeNull();
    expect(seeded?.id).toBe(SEED_USER.id);
    expect(seeded?.fullName).toBe(SEED_USER.fullName);
    await expect(
      passwordService.verify(seeded?.passwordHash ?? '', SEED_USER.password),
    ).resolves.toBe(true);
  });

  it('creates a user retrievable by id and email, starting at token_version 0', async () => {
    const fields = buildFields();

    const created = await repository.create(fields);

    expect(created?.tokenVersion).toBe(0);
    await expect(repository.findById(created?.id ?? '')).resolves.toBe(created);
    await expect(repository.findByEmail(fields.email)).resolves.toBe(created);
  });

  it('returns null when creating a duplicate email', async () => {
    const fields = buildFields();
    await repository.create(fields);

    await expect(repository.create(fields)).resolves.toBeNull();
  });

  it('returns null for unknown lookups', async () => {
    await expect(repository.findById(randomUUID())).resolves.toBeNull();
    await expect(repository.findByEmail(`ghost-${randomUUID()}@test.local`)).resolves.toBeNull();
  });

  it('incrementTokenVersion bumps the stored user and reports a missing one', async () => {
    const created = await repository.create(buildFields());

    await expect(repository.incrementTokenVersion(created?.id ?? '')).resolves.toBe(true);
    expect(created?.tokenVersion).toBe(1);
    await expect(repository.incrementTokenVersion(randomUUID())).resolves.toBe(false);
  });

  it('changePassword replaces the hash AND bumps token_version', async () => {
    const created = await repository.create(buildFields());

    await expect(repository.changePassword(created?.id ?? '', 'replacement-hash')).resolves.toBe(
      true,
    );
    expect(created?.passwordHash).toBe('replacement-hash');
    expect(created?.tokenVersion).toBe(1);
    await expect(repository.changePassword(randomUUID(), 'x')).resolves.toBe(false);
  });
});
