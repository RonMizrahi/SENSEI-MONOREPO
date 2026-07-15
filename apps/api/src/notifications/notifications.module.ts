import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isMockMode, provideMockSwappable } from '../common/mock-mode';
import { Notification } from './entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import {
  NOTIFICATIONS_REPOSITORY,
  NotificationsRepository,
  type NotificationsRepositoryContract,
} from './notifications.repository';
import { MockNotificationsRepository } from './notifications.repository.mock';
import { NotificationsService } from './notifications.service';

/** Notification center — TypeORM-backed, or seeded in-memory in MOCK_MODE. */
@Module({
  imports: [...(isMockMode() ? [] : [TypeOrmModule.forFeature([Notification])])],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    provideMockSwappable<NotificationsRepositoryContract>(
      NOTIFICATIONS_REPOSITORY,
      NotificationsRepository,
      MockNotificationsRepository,
    ),
  ],
})
export class NotificationsModule {}
