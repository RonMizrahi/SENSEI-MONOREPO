import { ApiProperty } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

/** GET /auth/whoami 200 response (senseiAPI User schema parity). */
export class WhoamiResponseDto {
  @ApiProperty({ description: 'Authenticated user id', format: 'uuid' })
  user_id!: string;

  @ApiProperty({ description: 'Login email', example: 'therapist@clinic.co.il' })
  email!: string;

  @ApiProperty({ description: 'Display name', nullable: true, type: String })
  full_name!: string | null;

  /**
   * Maps the request principal onto the wire shape.
   * @param user The authenticated principal from the JWT strategy (or TEST_USER).
   */
  static fromPrincipal(user: AuthenticatedUser): WhoamiResponseDto {
    const dto = new WhoamiResponseDto();
    dto.user_id = user.userId;
    dto.email = user.email;
    dto.full_name = user.fullName;
    return dto;
  }
}
