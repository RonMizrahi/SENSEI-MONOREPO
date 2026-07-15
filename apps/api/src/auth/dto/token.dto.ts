import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { TOKEN_TYPE_BEARER } from '../auth.constants';

/**
 * POST /auth/token request — application/x-www-form-urlencoded, OAuth2
 * password-grant field names (senseiAPI OAuth2PasswordRequestForm parity).
 * A non-email username is treated as unknown credentials (401), never 400.
 */
export class TokenRequestDto {
  @ApiProperty({ description: 'Login email (OAuth2 form field name)', example: 'therapist@clinic.co.il' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ description: 'Plain password', example: 'demo1234' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

/** POST /auth/token 200 response. */
export class TokenResponseDto {
  @ApiProperty({ description: 'Signed JWT access token' })
  access_token!: string;

  @ApiProperty({ description: 'Always "bearer"', example: TOKEN_TYPE_BEARER })
  token_type!: string;
}
