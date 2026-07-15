import { ApiProperty } from '@nestjs/swagger';
import type { User } from '../entities/user.entity';

/** GET/PATCH /auth/me response — the therapist's editable profile (snake_case). */
export class ProfileResponseDto {
  @ApiProperty({ description: 'User id', format: 'uuid' })
  user_id!: string;

  @ApiProperty({ description: 'Email', example: 'rotem@clinic.co.il' })
  email!: string;

  @ApiProperty({ description: 'Display name', nullable: true, example: 'ד״ר רותם שגב' })
  full_name!: string | null;

  @ApiProperty({ description: 'Phone', nullable: true, example: '050-123-4567' })
  phone!: string | null;

  @ApiProperty({ description: "Gender ('f' | 'm') for gendered microcopy", nullable: true })
  gender!: string | null;

  @ApiProperty({ description: 'Professional title', nullable: true, example: 'פסיכולוגית קלינית' })
  title!: string | null;

  @ApiProperty({ description: 'License number', nullable: true, example: '27-104882' })
  license_number!: string | null;

  @ApiProperty({ description: 'Organization / clinic', nullable: true })
  org!: string | null;

  @ApiProperty({ description: 'Short bio', nullable: true })
  bio!: string | null;

  @ApiProperty({ description: 'Avatar background colour', nullable: true, example: '#1F63D6' })
  avatar_color!: string | null;

  @ApiProperty({ description: 'Role', example: 'therapist' })
  role!: string;

  @ApiProperty({ description: 'Account creation timestamp', format: 'date-time' })
  created_at!: string;

  /** Maps a User row onto the profile wire shape. */
  static fromEntity(user: User): ProfileResponseDto {
    const dto = new ProfileResponseDto();
    dto.user_id = user.id;
    dto.email = user.email;
    dto.full_name = user.fullName;
    dto.phone = user.phone;
    dto.gender = user.gender;
    dto.title = user.title;
    dto.license_number = user.licenseNumber;
    dto.org = user.org;
    dto.bio = user.bio;
    dto.avatar_color = user.avatarColor;
    dto.role = user.role;
    dto.created_at = user.createdAt.toISOString();
    return dto;
  }
}
