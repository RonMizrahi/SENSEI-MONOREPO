import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isMockMode } from '../common/mock-mode';
import { CalendarEvent } from './entities/calendar-event.entity';

/**
 * Foundation skeleton — the calendar worker adds the controller, service
 * (timezone/range logic), and repository (real + seeded mock).
 */
@Module({
  imports: [...(isMockMode() ? [] : [TypeOrmModule.forFeature([CalendarEvent])])],
})
export class CalendarModule {}
