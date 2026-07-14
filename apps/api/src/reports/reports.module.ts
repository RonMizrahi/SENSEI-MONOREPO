import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isMockMode } from '../common/mock-mode';
import { MeetingSummary } from '../summaries/entities/meeting-summary.entity';
import { PatientReport } from './entities/patient-report.entity';

/**
 * Foundation skeleton — the reports worker adds the next-meeting-report
 * endpoints, Claude prompt assembly, and lifecycle management.
 */
@Module({
  imports: [...(isMockMode() ? [] : [TypeOrmModule.forFeature([PatientReport, MeetingSummary])])],
})
export class ReportsModule {}
