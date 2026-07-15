import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './entities/user.entity';

/** Injection token for the user store — real TypeORM impl, or seeded mock in MOCK_MODE. */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

/** Fields required to persist a new user (hash computed by the service). */
export interface CreateUserFields {
  email: string;
  fullName: string | null;
  passwordHash: string;
  authType: string;
  role: string;
}

/** Editable therapist profile fields (undefined leaves that field unchanged). */
export interface UpdateProfileFields {
  fullName?: string | null;
  phone?: string | null;
  gender?: string | null;
  title?: string | null;
  licenseNumber?: string | null;
  org?: string | null;
  bio?: string | null;
  avatarColor?: string | null;
}

/** Narrows a profile update to its defined fields — shared by the real and mock repos. */
export function definedProfileFields(fields: UpdateProfileFields): Partial<User> {
  const defined: Partial<User> = {};
  if (fields.fullName !== undefined) defined.fullName = fields.fullName;
  if (fields.phone !== undefined) defined.phone = fields.phone;
  if (fields.gender !== undefined) defined.gender = fields.gender;
  if (fields.title !== undefined) defined.title = fields.title;
  if (fields.licenseNumber !== undefined) defined.licenseNumber = fields.licenseNumber;
  if (fields.org !== undefined) defined.org = fields.org;
  if (fields.bio !== undefined) defined.bio = fields.bio;
  if (fields.avatarColor !== undefined) defined.avatarColor = fields.avatarColor;
  return defined;
}

/** Persistence contract for therapist accounts. */
export interface UserRepository {
  /** Inserts a new user; returns null when the email is already registered. */
  create(fields: CreateUserFields): Promise<User | null>;
  /** Finds a user by normalized email, or null. */
  findByEmail(email: string): Promise<User | null>;
  /** Finds a user by id, or null. */
  findById(id: string): Promise<User | null>;
  /** Applies profile field updates; returns the updated user or null when missing. */
  updateProfile(id: string, fields: UpdateProfileFields): Promise<User | null>;
  /** Bumps token_version (revokes all issued tokens); false when the user is missing. */
  incrementTokenVersion(id: string): Promise<boolean>;
  /** Replaces the password hash AND bumps token_version; false when the user is missing. */
  changePassword(id: string, newPasswordHash: string): Promise<boolean>;
}

/** PostgreSQL error code for unique-constraint violations. */
const PG_UNIQUE_VIOLATION = '23505';

/**
 * True when the error is a Postgres unique-constraint violation.
 * @param error Anything thrown by a TypeORM query.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const code: unknown = Reflect.get(error.driverError, 'code');
  return code === PG_UNIQUE_VIOLATION;
}

/** Persists therapist accounts in PostgreSQL (senseiAPI UserRepository parity). */
@Injectable()
export class UserTypeOrmRepository implements UserRepository {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  /**
   * Inserts a new user row, relying on the unique email constraint for atomicity.
   * @returns The persisted user, or null on a duplicate email.
   */
  async create(fields: CreateUserFields): Promise<User | null> {
    try {
      return await this.users.save(this.users.create({ ...fields, tokenVersion: 0 }));
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  }

  /** Finds a user by normalized email, or null. */
  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email } });
  }

  /** Finds a user by id, or null. */
  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  /**
   * Applies the defined profile fields via a single atomic UPDATE.
   * @returns The updated user, or null when the id is unknown.
   */
  async updateProfile(id: string, fields: UpdateProfileFields): Promise<User | null> {
    const patch = definedProfileFields(fields);
    if (Object.keys(patch).length > 0) {
      const result = await this.users.update({ id }, patch);
      if ((result.affected ?? 0) === 0) return null;
    }
    return this.findById(id);
  }

  /** Atomically bumps token_version; false when the user is missing. */
  async incrementTokenVersion(id: string): Promise<boolean> {
    const result = await this.users.increment({ id }, 'tokenVersion', 1);
    return (result.affected ?? 0) > 0;
  }

  /** Replaces the password hash and bumps token_version in one UPDATE. */
  async changePassword(id: string, newPasswordHash: string): Promise<boolean> {
    const result = await this.users.update(
      { id },
      { passwordHash: newPasswordHash, tokenVersion: () => 'token_version + 1' },
    );
    return (result.affected ?? 0) > 0;
  }
}
