import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SEED_USER } from '../mock/seed';
import { User } from './entities/user.entity';
import { PasswordService } from './password.service';
import {
  definedProfileFields,
  type CreateUserFields,
  type UpdateProfileFields,
  type UserRepository,
} from './user.repository';

/**
 * Seeded in-memory user store for MOCK_MODE — the demo therapist (SEED_USER)
 * is registered at construction so the SPA's rotem@clinic.co.il login works.
 */
@Injectable()
export class UserMockRepository implements UserRepository {
  private readonly usersById = new Map<string, User>();
  /** Resolves once SEED_USER's password hash is computed — every method awaits it. */
  private readonly seeded: Promise<void>;

  constructor(passwordService: PasswordService) {
    this.seeded = passwordService.hash(SEED_USER.password).then((passwordHash) => {
      const seed = new User();
      seed.id = SEED_USER.id;
      seed.authType = SEED_USER.authType;
      seed.role = SEED_USER.role;
      seed.email = SEED_USER.email;
      seed.fullName = SEED_USER.fullName;
      seed.passwordHash = passwordHash;
      seed.tokenVersion = SEED_USER.tokenVersion;
      seed.createdAt = new Date();
      this.usersById.set(seed.id, seed);
    });
  }

  /** Inserts a new user; returns null when the email is already registered. */
  async create(fields: CreateUserFields): Promise<User | null> {
    await this.seeded;
    if (this.lookupByEmail(fields.email)) return null;
    const user = new User();
    user.id = randomUUID();
    user.authType = fields.authType;
    user.role = fields.role;
    user.email = fields.email;
    user.fullName = fields.fullName;
    user.passwordHash = fields.passwordHash;
    user.tokenVersion = 0;
    user.createdAt = new Date();
    this.usersById.set(user.id, user);
    return user;
  }

  /** Finds a user by normalized email, or null. */
  async findByEmail(email: string): Promise<User | null> {
    await this.seeded;
    return this.lookupByEmail(email);
  }

  /** Finds a user by id, or null. */
  async findById(id: string): Promise<User | null> {
    await this.seeded;
    return this.usersById.get(id) ?? null;
  }

  /** Applies profile field updates; returns the updated user or null when missing. */
  async updateProfile(id: string, fields: UpdateProfileFields): Promise<User | null> {
    await this.seeded;
    const user = this.usersById.get(id);
    if (!user) return null;
    Object.assign(user, definedProfileFields(fields));
    return user;
  }

  /** Bumps token_version; false when the user is missing. */
  async incrementTokenVersion(id: string): Promise<boolean> {
    await this.seeded;
    const user = this.usersById.get(id);
    if (!user) return false;
    user.tokenVersion += 1;
    return true;
  }

  /** Replaces the password hash and bumps token_version. */
  async changePassword(id: string, newPasswordHash: string): Promise<boolean> {
    await this.seeded;
    const user = this.usersById.get(id);
    if (!user) return false;
    user.passwordHash = newPasswordHash;
    user.tokenVersion += 1;
    return true;
  }

  /** Linear email scan — the mock store holds a handful of users at most. */
  private lookupByEmail(email: string): User | null {
    for (const user of this.usersById.values()) {
      if (user.email === email) return user;
    }
    return null;
  }
}
