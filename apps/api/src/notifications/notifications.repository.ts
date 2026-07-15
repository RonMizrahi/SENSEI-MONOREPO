import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';

/** DI token consumers use to obtain the notifications repository (real or mock). */
export const NOTIFICATIONS_REPOSITORY = Symbol('NOTIFICATIONS_REPOSITORY');

/** Read/archived toggles applied by PATCH — undefined leaves that state unchanged. */
export interface UpdateNotificationFields {
  read?: boolean;
  archived?: boolean;
}

/** Maps read/archived toggles onto the timestamp columns (true → now, false → null). */
export function notificationTimestampPatch(
  fields: UpdateNotificationFields,
  now: Date,
): Partial<Notification> {
  const patch: Partial<Notification> = {};
  if (fields.read !== undefined) patch.readAt = fields.read ? now : null;
  if (fields.archived !== undefined) patch.archivedAt = fields.archived ? now : null;
  return patch;
}

/** Data-access contract for notifications — TypeORM in production, in-memory in MOCK_MODE. */
export interface NotificationsRepositoryContract {
  /** Lists the therapist's notifications, newest first. */
  findAllForTherapist(therapistId: string): Promise<Notification[]>;
  /** Applies read/archived toggles for a therapist-owned row; null when not found/owned. */
  update(
    therapistId: string,
    id: string,
    fields: UpdateNotificationFields,
  ): Promise<Notification | null>;
}

/** PostgreSQL-backed notifications repository. */
@Injectable()
export class NotificationsRepository implements NotificationsRepositoryContract {
  constructor(
    @InjectRepository(Notification) private readonly repository: Repository<Notification>,
  ) {}

  /** Lists the therapist's notifications, newest first. */
  findAllForTherapist(therapistId: string): Promise<Notification[]> {
    return this.repository.find({ where: { therapistId }, order: { createdAt: 'DESC' } });
  }

  /**
   * Applies read/archived toggles for a therapist-owned notification.
   * @returns The updated row, or null when the id is unknown or another therapist's.
   */
  async update(
    therapistId: string,
    id: string,
    fields: UpdateNotificationFields,
  ): Promise<Notification | null> {
    const patch = notificationTimestampPatch(fields, new Date());
    if (Object.keys(patch).length > 0) {
      const result = await this.repository.update({ id, therapistId }, patch);
      if ((result.affected ?? 0) === 0) return null;
    }
    return this.repository.findOne({ where: { id, therapistId } });
  }
}
