import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
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
import { RegisterRequestDto, RegisterResponseDto } from './dto/register.dto';
import { TokenRequestDto, TokenResponseDto } from './dto/token.dto';
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
