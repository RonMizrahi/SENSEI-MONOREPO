import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import type { Preferences } from '../entities/user-settings.entity';

/** GET/PUT /settings response — the therapist's opaque preferences blob. */
export class SettingsResponseDto {
  @ApiProperty({
    description: 'Client-owned preferences (a11y / notifPrefs / appearance / security)',
    type: Object,
    example: { appearance: { theme: 'light' } },
  })
  preferences!: Preferences;

  /** Wraps a preferences blob in the response shape. */
  static of(preferences: Preferences): SettingsResponseDto {
    const dto = new SettingsResponseDto();
    dto.preferences = preferences;
    return dto;
  }
}

/** PUT /settings body — replaces the whole preferences blob. */
export class UpdateSettingsDto {
  @ApiProperty({
    description: 'Full preferences object to store (replaces the previous one)',
    type: Object,
    example: { appearance: { theme: 'dark' } },
  })
  @IsObject()
  preferences!: Preferences;
}
