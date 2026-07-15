import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ResourceNotFoundException } from '../common/exceptions/app.exception';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import {
  NOTIFICATIONS_REPOSITORY,
  type NotificationsRepositoryContract,
} from './notifications.repository';

/** Business logic behind the /notifications endpoints. */
@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly notifications: NotificationsRepositoryContract,
  ) {}

  /**
   * Lists the caller's notifications, newest first.
   * @returns The therapist's notifications as wire DTOs.
   */
  async list(user: AuthenticatedUser): Promise<NotificationResponseDto[]> {
    const rows = await this.notifications.findAllForTherapist(user.userId);
    return rows.map((row) => NotificationResponseDto.fromEntity(row));
  }

  /**
   * Toggles read/archived state on a caller-owned notification.
   * @throws ResourceNotFoundException when the id is unknown or another therapist's (404).
   */
  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateNotificationDto,
  ): Promise<NotificationResponseDto> {
    const updated = await this.notifications.update(user.userId, id, dto);
    if (!updated) {
      throw new ResourceNotFoundException('notification', id);
    }
    return NotificationResponseDto.fromEntity(updated);
  }
}
