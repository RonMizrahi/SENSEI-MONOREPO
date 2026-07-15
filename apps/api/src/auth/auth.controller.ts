import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { PasswordChangeRequestDto } from './dto/password-change.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { RegisterRequestDto, RegisterResponseDto } from './dto/register.dto';
import { TokenRequestDto, TokenResponseDto } from './dto/token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { WhoamiResponseDto } from './dto/whoami.dto';

/** /auth endpoints — dispatch only; all logic lives in AuthService. */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Creates a therapist account. */
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a therapist account' })
  @ApiBody({ type: RegisterRequestDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Account created', type: RegisterResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid email or password shorter than 8 characters' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Email already registered' })
  register(@Body() dto: RegisterRequestDto): Promise<RegisterResponseDto> {
    return this.authService.register(dto);
  }

  /** Exchanges form-urlencoded credentials for a Bearer token. */
  @Public()
  @Post('token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue an access token (OAuth2 password form)' })
  @ApiConsumes('application/x-www-form-urlencoded')
  @ApiBody({ type: TokenRequestDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Token issued', type: TokenResponseDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid credentials' })
  issueToken(@Body() dto: TokenRequestDto): Promise<TokenResponseDto> {
    return this.authService.issueToken(dto.username, dto.password);
  }

  /** Revokes every token issued to the current user. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke ALL issued tokens for the current user' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Tokens revoked' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Missing/invalid token' })
  logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.authService.logout(user.userId);
  }

  /** Returns the authenticated user's identity. */
  @Get('whoami')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Identify the current user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Current user', type: WhoamiResponseDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Missing/invalid token' })
  whoami(@CurrentUser() user: AuthenticatedUser): WhoamiResponseDto {
    return WhoamiResponseDto.fromPrincipal(user);
  }

  /** Returns the authenticated therapist's full editable profile. */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current therapist profile' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Profile', type: ProfileResponseDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Missing/invalid token' })
  getProfile(@CurrentUser() user: AuthenticatedUser): Promise<ProfileResponseDto> {
    return this.authService.getProfile(user.userId);
  }

  /** Applies profile edits for the authenticated therapist. */
  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update the current therapist profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Updated profile', type: ProfileResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid field' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Missing/invalid token' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return this.authService.updateProfile(user.userId, dto);
  }

  /** Rotates the password after verifying the current one. */
  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password and revoke ALL issued tokens' })
  @ApiBody({ type: PasswordChangeRequestDto })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Password changed, tokens revoked' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'New password shorter than 8 characters' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Wrong current password or invalid token' })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PasswordChangeRequestDto,
  ): Promise<void> {
    return this.authService.changePassword(user.userId, dto);
  }
}
