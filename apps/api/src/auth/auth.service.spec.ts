/* eslint-disable @typescript-eslint/unbound-method -- jest.Mocked call assertions are safe unbound references */
import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import {
  DuplicateResourceException,
  ResourceNotFoundException,
} from '../common/exceptions/app.exception';
import { AUTH_TYPE_PASSWORD, ROLE_THERAPIST, TOKEN_TYPE_BEARER } from './auth.constants';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import type { PasswordService } from './password.service';
import type { UserRepository } from './user.repository';

function buildUser(overrides: Partial<User> = {}): User {
  const user = new User();
  user.id = randomUUID();
  user.authType = AUTH_TYPE_PASSWORD;
  user.role = ROLE_THERAPIST;
  user.email = `u-${randomUUID()}@test.local`;
  user.fullName = 'Unit Test';
  user.passwordHash = 'stored-hash';
  user.tokenVersion = 0;
  user.createdAt = new Date('2026-07-14T10:00:00.000Z');
  return Object.assign(user, overrides);
}

describe('AuthService', () => {
  let users: jest.Mocked<UserRepository>;
  let passwords: jest.Mocked<Pick<PasswordService, 'hash' | 'verify'>>;
  let jwt: jest.Mocked<Pick<JwtService, 'signAsync'>>;
  let service: AuthService;

  beforeEach(() => {
    users = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      updateProfile: jest.fn(),
      incrementTokenVersion: jest.fn(),
      changePassword: jest.fn(),
    };
    passwords = {
      hash: jest.fn().mockResolvedValue('new-hash'),
      verify: jest.fn().mockResolvedValue(true),
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') };
    service = new AuthService(
      users,
      passwords as unknown as PasswordService,
      jwt as unknown as JwtService,
    );
  });

  describe('register', () => {
    it('hashes the password and returns the created user wire shape', async () => {
      const created = buildUser();
      users.create.mockResolvedValue(created);

      const result = await service.register({
        email: created.email,
        password: 'password-123',
        full_name: 'Unit Test',
      });

      expect(passwords.hash).toHaveBeenCalledWith('password-123');
      expect(users.create).toHaveBeenCalledWith({
        email: created.email,
        fullName: 'Unit Test',
        passwordHash: 'new-hash',
        authType: AUTH_TYPE_PASSWORD,
        role: ROLE_THERAPIST,
      });
      expect(result).toEqual({
        user_id: created.id,
        auth_type: AUTH_TYPE_PASSWORD,
        role: ROLE_THERAPIST,
        email: created.email,
        full_name: 'Unit Test',
        created_at: '2026-07-14T10:00:00.000Z',
      });
    });

    it('normalizes the email to trimmed lowercase', async () => {
      users.create.mockResolvedValue(buildUser());

      await service.register({ email: '  MiXeD@Example.COM ', password: 'password-123' });

      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'mixed@example.com' }),
      );
    });

    it('maps a missing full_name to null', async () => {
      users.create.mockResolvedValue(buildUser({ fullName: null }));

      const result = await service.register({ email: 'a@b.test', password: 'password-123' });

      expect(users.create).toHaveBeenCalledWith(expect.objectContaining({ fullName: null }));
      expect(result.full_name).toBeNull();
    });

    it('throws 409 when the email is already registered', async () => {
      users.create.mockResolvedValue(null);

      await expect(
        service.register({ email: 'dup@test.local', password: 'password-123' }),
      ).rejects.toThrow(DuplicateResourceException);
    });
  });

  describe('issueToken', () => {
    it('signs the full JwtPayload claims for valid credentials', async () => {
      const user = buildUser({ tokenVersion: 3 });
      users.findByEmail.mockResolvedValue(user);

      const result = await service.issueToken(user.email, 'password-123');

      expect(passwords.verify).toHaveBeenCalledWith('stored-hash', 'password-123');
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
        full_name: user.fullName,
        auth_type: AUTH_TYPE_PASSWORD,
        role: ROLE_THERAPIST,
        token_version: 3,
      });
      expect(result).toEqual({ access_token: 'signed-token', token_type: TOKEN_TYPE_BEARER });
    });

    it('normalizes the username before lookup', async () => {
      users.findByEmail.mockResolvedValue(buildUser());

      await service.issueToken(' Rotem@Clinic.CO.IL ', 'password-123');

      expect(users.findByEmail).toHaveBeenCalledWith('rotem@clinic.co.il');
    });

    it('hashes a dummy password on unknown user to equalize timing, then 401s', async () => {
      users.findByEmail.mockResolvedValue(null);

      await expect(service.issueToken('ghost@test.local', 'password-123')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(passwords.hash).toHaveBeenCalledWith('password-123');
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('401s on a wrong password without signing', async () => {
      users.findByEmail.mockResolvedValue(buildUser());
      passwords.verify.mockResolvedValue(false);

      await expect(service.issueToken('a@b.test', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('bumps the token_version of the current user', async () => {
      users.incrementTokenVersion.mockResolvedValue(true);
      const userId = randomUUID();

      await expect(service.logout(userId)).resolves.toBeUndefined();
      expect(users.incrementTokenVersion).toHaveBeenCalledWith(userId);
    });

    it('401s when the user no longer exists', async () => {
      users.incrementTokenVersion.mockResolvedValue(false);

      await expect(service.logout(randomUUID())).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    const dto = { current_password: 'old-password-1', new_password: 'new-password-1' };

    it('verifies the current password, stores the new hash, and revokes tokens', async () => {
      const user = buildUser();
      users.findById.mockResolvedValue(user);
      users.changePassword.mockResolvedValue(true);

      await expect(service.changePassword(user.id, dto)).resolves.toBeUndefined();

      expect(passwords.verify).toHaveBeenCalledWith('stored-hash', 'old-password-1');
      expect(passwords.hash).toHaveBeenCalledWith('new-password-1');
      expect(users.changePassword).toHaveBeenCalledWith(user.id, 'new-hash');
    });

    it('401s when the user is missing', async () => {
      users.findById.mockResolvedValue(null);

      await expect(service.changePassword(randomUUID(), dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(users.changePassword).not.toHaveBeenCalled();
    });

    it('401s on a wrong current password without updating', async () => {
      users.findById.mockResolvedValue(buildUser());
      passwords.verify.mockResolvedValue(false);

      await expect(service.changePassword(randomUUID(), dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(users.changePassword).not.toHaveBeenCalled();
    });

    it('401s when the update races a deleted user', async () => {
      users.findById.mockResolvedValue(buildUser());
      users.changePassword.mockResolvedValue(false);

      await expect(service.changePassword(randomUUID(), dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getProfile', () => {
    it('maps the user row onto the profile wire shape', async () => {
      const user = buildUser({ phone: '050-1', title: 'קלינאית', licenseNumber: 'L1' });
      users.findById.mockResolvedValue(user);

      const profile = await service.getProfile(user.id);

      expect(profile).toMatchObject({
        user_id: user.id,
        email: user.email,
        phone: '050-1',
        title: 'קלינאית',
        license_number: 'L1',
      });
    });

    it('404s when the account no longer exists', async () => {
      users.findById.mockResolvedValue(null);

      await expect(service.getProfile(randomUUID())).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('applies edits (snake_case → repo fields) and returns the updated profile', async () => {
      const user = buildUser({ phone: '052-9', gender: 'f' });
      users.updateProfile.mockResolvedValue(user);

      const profile = await service.updateProfile(user.id, { phone: '052-9', gender: 'f' });

      expect(users.updateProfile).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({ phone: '052-9', gender: 'f' }),
      );
      expect(profile).toMatchObject({ phone: '052-9', gender: 'f' });
    });

    it('404s when the account no longer exists', async () => {
      users.updateProfile.mockResolvedValue(null);

      await expect(service.updateProfile(randomUUID(), { phone: 'x' })).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });
});
