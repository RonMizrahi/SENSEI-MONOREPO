import { ApiProperty } from '@nestjs/swagger';
import type { Notification, NotificationKind } from '../entities/notification.entity';

const NOTIFICATION_KINDS: NotificationKind[] = ['summary', 'risk', 'reminder', 'system'];

/** GET /notifications item — snake_case contract shared with the SPA. */
export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification id', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Category', enum: NOTIFICATION_KINDS, example: 'summary' })
  kind!: NotificationKind;

  @ApiProperty({ description: 'Related patient id (null for system items)', format: 'uuid', nullable: true })
  patient_id!: string | null;

  @ApiProperty({ description: 'Title line', example: 'סיכום AI מוכן' })
  title!: string;

  @ApiProperty({ description: 'Body text', example: 'ניתוח הפגישה של דנה לוי הושלם' })
  body!: string;

  @ApiProperty({ description: 'Display bucket (היום / אתמול / קודם)', example: 'היום' })
  group_label!: string;

  @ApiProperty({ description: 'Relative display time string', example: 'לפני 8 דק׳' })
  display_time!: string;

  @ApiProperty({ description: 'Whether the therapist has read it' })
  read!: boolean;

  @ApiProperty({ description: 'Whether the therapist has archived it' })
  archived!: boolean;

  @ApiProperty({ description: 'Creation timestamp (ISO 8601)', format: 'date-time' })
  created_at!: string;

  /** Maps a Notification row onto the wire shape (timestamps → booleans). */
  static fromEntity(notification: Notification): NotificationResponseDto {
    const dto = new NotificationResponseDto();
    dto.id = notification.id;
    dto.kind = notification.kind;
    dto.patient_id = notification.patientId;
    dto.title = notification.title;
    dto.body = notification.body;
    dto.group_label = notification.groupLabel;
    dto.display_time = notification.displayTime;
    dto.read = notification.readAt !== null;
    dto.archived = notification.archivedAt !== null;
    dto.created_at = notification.createdAt.toISOString();
    return dto;
  }
}
