import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isMockMode, provideMockSwappable } from '../common/mock-mode';
import { UserSettings } from './entities/user-settings.entity';
import { SettingsController } from './settings.controller';
import {
  SETTINGS_REPOSITORY,
  SettingsRepository,
  type SettingsRepositoryContract,
} from './settings.repository';
import { MockSettingsRepository } from './settings.repository.mock';
import { SettingsService } from './settings.service';

/** Per-therapist preferences — TypeORM-backed, or seeded in-memory in MOCK_MODE. */
@Module({
  imports: [...(isMockMode() ? [] : [TypeOrmModule.forFeature([UserSettings])])],
  controllers: [SettingsController],
  providers: [
    SettingsService,
    provideMockSwappable<SettingsRepositoryContract>(
      SETTINGS_REPOSITORY,
      SettingsRepository,
      MockSettingsRepository,
    ),
  ],
})
export class SettingsModule {}
