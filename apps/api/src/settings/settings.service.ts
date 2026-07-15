import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SettingsResponseDto, UpdateSettingsDto } from './dto/settings.dto';
import {
  SETTINGS_REPOSITORY,
  type SettingsRepositoryContract,
} from './settings.repository';

/** Read + replace operations behind the /settings endpoints. */
@Injectable()
export class SettingsService {
  constructor(
    @Inject(SETTINGS_REPOSITORY) private readonly settings: SettingsRepositoryContract,
  ) {}

  /** Returns the caller's preferences blob. */
  async get(user: AuthenticatedUser): Promise<SettingsResponseDto> {
    return SettingsResponseDto.of(await this.settings.getForUser(user.userId));
  }

  /** Replaces the caller's preferences blob and returns it. */
  async replace(user: AuthenticatedUser, dto: UpdateSettingsDto): Promise<SettingsResponseDto> {
    return SettingsResponseDto.of(await this.settings.replace(user.userId, dto.preferences));
  }
}
