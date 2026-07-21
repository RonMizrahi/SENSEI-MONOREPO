import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isMockMode, provideMockSwappable } from '../common/mock-mode';
import { CalendarController } from './calendar.controller';
import type { CalendarRepository } from './calendar.repository';
import {
  CALENDAR_REPOSITORY,
  MockCalendarRepository,
  TypeOrmCalendarRepository,
} from './calendar.repository';
import { CalendarService } from './calendar.service';
import { CalendarEvent } from './entities/calendar-event.entity';

/** Calendar events CRUD — PostgreSQL-backed, or seeded in-memory in MOCK_MODE. */
@Module({
  imports: [...(isMockMode() ? [] : [TypeOrmModule.forFeature([CalendarEvent])])],
  controllers: [CalendarController],
  providers: [
    CalendarService,
    provideMockSwappable<CalendarRepository>(
      CALENDAR_REPOSITORY,
      TypeOrmCalendarRepository,
      MockCalendarRepository,
    ),
  ],
  exports: [CALENDAR_REPOSITORY],
})
export class CalendarModule {}
