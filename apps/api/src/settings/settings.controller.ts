import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SettingsResponseDto, UpdateSettingsDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

/** Per-therapist UI preferences — /settings (unversioned, self-scoped). */
@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get the current therapist preferences' })
  @ApiOkResponse({ type: SettingsResponseDto, description: 'The preferences blob' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  get(@CurrentUser() user: AuthenticatedUser): Promise<SettingsResponseDto> {
    return this.settings.get(user);
  }

  @Put()
  @ApiOperation({ summary: 'Replace the current therapist preferences' })
  @ApiBody({ type: UpdateSettingsDto })
  @ApiOkResponse({ type: SettingsResponseDto, description: 'The stored preferences' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  replace(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ): Promise<SettingsResponseDto> {
    return this.settings.replace(user, dto);
  }
}
