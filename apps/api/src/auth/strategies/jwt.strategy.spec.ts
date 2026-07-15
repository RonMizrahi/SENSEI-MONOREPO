/* eslint-disable @typescript-eslint/unbound-method -- jest.Mocked call assertions are safe unbound references */
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Env } from '../../config/env.schema';
import { User } from '../entities/user.entity';
import type { JwtPayload } from '../jwt-payload.interface';
import type { UserRepository } from '../user.repository';
import { JwtStrategy } from './jwt.strategy';

function buildUser(overrides: Partial<User> = {}): User {
  const user = new User();
  user.id = randomUUID();
  user.authType = 'password';
  user.role = 'therapist';
  user.email = `s-${randomUUID()}@test.local`;
  user.fullName = 'Strategy Test';
  user.passwordHash = 'hash';
  user.tokenVersion = 2;
  user.createdAt = new Date();
  return Object.assign(user, overrides);
}

function buildPayload(user: User): JwtPayload {
  return {
    sub: user.id,
    email: user.email,
    full_name: user.fullName,
    auth_type: user.authType,
    role: user.role,
    token_version: user.tokenVersion,
  };
}

describe('JwtStrategy.validate', () => {
  const config = {
    get: jest.fn().mockReturnValue('unit-test-secret-at-least-32-chars!!'),
  } as unknown as ConfigService<Env, true>;
  let users: jest.Mocked<UserRepository>;
  let strategy: JwtStrategy;

  beforeEach(() => {
    users = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      incrementTokenVersion: jest.fn(),
      changePassword: jest.fn(),
    };
    strategy = new JwtStrategy(config, users);
  });

  it('returns the principal built from the DB row (not the token claims)', async () => {
    const user = buildUser();
    users.findById.mockResolvedValue(user);
    // stale display data in the token must not leak into the principal
    const payload = { ...buildPayload(user), email: 'stale@test.local', full_name: 'Stale' };

    await expect(strategy.validate(payload)).resolves.toEqual({
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });
    expect(users.findById).toHaveBeenCalledWith(user.id);
  });

  it('rejects when the user no longer exists', async () => {
    users.findById.mockResolvedValue(null);

    await expect(strategy.validate(buildPayload(buildUser()))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when token_version mismatches (revoked token)', async () => {
    const user = buildUser({ tokenVersion: 5 });
    users.findById.mockResolvedValue(user);

    await expect(
      strategy.validate({ ...buildPayload(user), token_version: 4 }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
