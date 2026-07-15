import { Injectable } from '@nestjs/common';
import { SEED_USER } from '../mock/seed';
import { Preferences } from './entities/user-settings.entity';
import type { SettingsRepositoryContract } from './settings.repository';

/** Demo therapist preferences — parity with the SPA seed.ts blobs. */
const SEED_PREFERENCES: Preferences = {
  a11y: {
    textSize: 'default',
    contrast: 'normal',
    reduceMotion: false,
    strongFocus: false,
    reading: 'default',
    underlineLinks: false,
  },
  notifPrefs: {
    channels: { inapp: true, email: true, sms: false, push: true },
    frequency: 'instant',
    digestTime: '18:00',
    quiet: true,
    quietFrom: '21:00',
    quietTo: '07:00',
  },
  appearance: { theme: 'light', themePref: 'system' },
  security: { twoFA: false, sessionTimeout: '30', retainAudio: false },
};

/** MOCK_MODE settings store — in-memory, pre-seeded for the demo therapist. */
@Injectable()
export class MockSettingsRepository implements SettingsRepositoryContract {
  private readonly byUser = new Map<string, Preferences>([[SEED_USER.id, SEED_PREFERENCES]]);

  /** Returns the user's preferences, or an empty object when unset. */
  getForUser(userId: string): Promise<Preferences> {
    return Promise.resolve(this.byUser.get(userId) ?? {});
  }

  /** Replaces the user's preferences and returns the stored blob. */
  replace(userId: string, preferences: Preferences): Promise<Preferences> {
    this.byUser.set(userId, preferences);
    return Promise.resolve(preferences);
  }
}
