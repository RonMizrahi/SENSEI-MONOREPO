import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/** PATCH /notifications/{id} body — toggle read and/or archived state. */
export class UpdateNotificationDto {
  @ApiPropertyOptional({ description: 'Mark read (true) or unread (false)' })
  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @ApiPropertyOptional({ description: 'Archive (true) or restore (false)' })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
