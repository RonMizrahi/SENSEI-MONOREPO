import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  DuplicateResourceException,
  ResourceNotFoundException,
} from '../common/exceptions/app.exception';
import { AUTH_TYPE_PASSWORD, ROLE_THERAPIST, TOKEN_TYPE_BEARER } from './auth.constants';
import { PasswordChangeRequestDto } from './dto/password-change.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { RegisterRequestDto, RegisterResponseDto } from './dto/register.dto';
import { TokenResponseDto } from './dto/token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User } from './entities/user.entity';
import { JwtPayload } from './jwt-payload.interface';
import { PasswordService } from './password.service';
import { USER_REPOSITORY } from './user.repository';
import type { UserRepository } from './user.repository';

/** Business logic for registration, login, revocation, and password change. */
@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Registers a therapist account with a normalized email.
   * @throws DuplicateResourceException (409) when the email is taken.
   */
  async register(dto: RegisterRequestDto): Promise<RegisterResponseDto> {
    const email = this.normalizeEmail(dto.email);
    const passwordHash = await this.passwordService.hash(dto.password);
    const user = await this.users.create({
      email,
      fullName: dto.full_name ?? null,
      passwordHash,
      authType: AUTH_TYPE_PASSWORD,
      role: ROLE_THERAPIST,
    });
    if (!user) throw new DuplicateResourceException('user', 'email');
    return RegisterResponseDto.fromUser(user);
  }

  /**
   * Loads the caller's full profile.
   * @throws ResourceNotFoundException when the account no longer exists.
   */
  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new ResourceNotFoundException('user', userId);
    return ProfileResponseDto.fromEntity(user);
  }

  /**
   * Applies profile edits for the caller and returns the updated profile.
   * @throws ResourceNotFoundException when the account no longer exists.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileResponseDto> {
    const updated = await this.users.updateProfile(userId, {
      fullName: dto.full_name,
      phone: dto.phone,
      gender: dto.gender,
      title: dto.title,
      licenseNumber: dto.license_number,
      org: dto.org,
      bio: dto.bio,
      avatarColor: dto.avatar_color,
    });
    if (!updated) throw new ResourceNotFoundException('user', userId);
    return ProfileResponseDto.fromEntity(updated);
  }

  /**
   * Verifies credentials and mints an access token.
   * @throws UnauthorizedException (401) on unknown email or wrong password.
   */
  async issueToken(username: string, password: string): Promise<TokenResponseDto> {
    const user = await this.users.findByEmail(this.normalizeEmail(username));
    if (!user) {
      // hash a dummy so unknown-user and wrong-password take the same time (senseiAPI parity)
      await this.passwordService.hash(password);
      throw new UnauthorizedException();
    }
    if (!(await this.passwordService.verify(user.passwordHash, password))) {
      throw new UnauthorizedException();
    }
    const response = new TokenResponseDto();
    response.access_token = await this.signToken(user);
    response.token_type = TOKEN_TYPE_BEARER;
    return response;
  }

  /**
   * Revokes every issued token by bumping the user's token_version.
   * @throws UnauthorizedException (401) when the user no longer exists.
   */
  async logout(userId: string): Promise<void> {
    if (!(await this.users.incrementTokenVersion(userId))) {
      throw new UnauthorizedException();
    }
  }

  /**
   * Verifies the current password, stores the new hash, and revokes old tokens.
   * @throws UnauthorizedException (401) on a missing user or wrong current password.
   */
  async changePassword(userId: string, dto: PasswordChangeRequestDto): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    if (!(await this.passwordService.verify(user.passwordHash, dto.current_password))) {
      throw new UnauthorizedException();
    }
    const newPasswordHash = await this.passwordService.hash(dto.new_password);
    if (!(await this.users.changePassword(userId, newPasswordHash))) {
      throw new UnauthorizedException();
    }
  }

  /** Signs the JwtPayload claims for a user via the module-configured JwtService. */
  private signToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      full_name: user.fullName,
      auth_type: user.authType,
      role: user.role,
      token_version: user.tokenVersion,
    };
    return this.jwtService.signAsync(payload);
  }

  /** Lowercases and trims an email (senseiAPI validate_email normalization parity). */
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
