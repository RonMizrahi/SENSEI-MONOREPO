import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import {
  CURRENT_PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../auth.constants';

/** POST /auth/password/change request body (senseiAPI PasswordChange parity). */
export class PasswordChangeRequestDto {
  @ApiProperty({ description: 'The password currently on the account', example: 'demo1234' })
  @IsString()
  @Length(CURRENT_PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  current_password!: string;

  @ApiProperty({
    description: 'Replacement password',
    example: 'new-demo-1234',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  new_password!: string;
}
