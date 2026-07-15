import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Preferences, UserSettings } from './entities/user-settings.entity';

/** DI token consumers use to obtain the settings repository (real or mock). */
export const SETTINGS_REPOSITORY = Symbol('SETTINGS_REPOSITORY');

/** Data-access contract for per-user preferences. */
export interface SettingsRepositoryContract {
  /** Returns the user's preferences, or an empty object when unset. */
  getForUser(userId: string): Promise<Preferences>;
  /** Replaces the user's preferences (upsert) and returns the stored blob. */
  replace(userId: string, preferences: Preferences): Promise<Preferences>;
}

/** PostgreSQL-backed settings repository (upsert on the user_settings PK). */
@Injectable()
export class SettingsRepository implements SettingsRepositoryContract {
  constructor(
    @InjectRepository(UserSettings) private readonly settings: Repository<UserSettings>,
  ) {}

  /** Returns the user's preferences, or an empty object when no row exists yet. */
  async getForUser(userId: string): Promise<Preferences> {
    const row = await this.settings.findOne({ where: { userId } });
    return row?.preferences ?? {};
  }

  /** Upserts the preferences blob for a user (save keys on the user_id PK) and returns it. */
  async replace(userId: string, preferences: Preferences): Promise<Preferences> {
    const row = this.settings.create({ userId, preferences });
    await this.settings.save(row);
    return preferences;
  }
}
