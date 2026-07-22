import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isMockMode, provideMockSwappable } from '../common/mock-mode';
import { MeetingSummary } from '../summaries/entities/meeting-summary.entity';
import { AnthropicReportGenerator } from './anthropic-report.generator';
import { PatientReport } from './entities/patient-report.entity';
import { MockReportGenerator } from './mock-report.generator';
import { MeetingReportsController } from './meeting-reports.controller';
import { MockReportsRepository } from './mock-reports.repository';
import { REPORT_GENERATOR } from './report-generator.interface';
import type { ReportGenerator } from './report-generator.interface';
import { ReportsController } from './reports.controller';
import { REPORTS_REPOSITORY, TypeormReportsRepository } from './reports.repository';
import type { ReportsRepository } from './reports.repository';
import { ReportsService } from './reports.service';

/**
 * Prep reports — the per-patient next-meeting report (GET/POST
 * /patients/{id}/next-meeting-report) and per-meeting reports (GET/POST
 * /patients/{id}/meeting-reports[/{meetingId}]), Anthropic (or canned mock)
 * generation, patient_reports lifecycle + startup sweep.
 */
@Module({
  imports: [...(isMockMode() ? [] : [TypeOrmModule.forFeature([PatientReport, MeetingSummary])])],
  controllers: [ReportsController, MeetingReportsController],
  providers: [
    ReportsService,
    provideMockSwappable<ReportsRepository>(
      REPORTS_REPOSITORY,
      TypeormReportsRepository,
      MockReportsRepository,
    ),
    provideMockSwappable<ReportGenerator>(
      REPORT_GENERATOR,
      AnthropicReportGenerator,
      MockReportGenerator,
    ),
  ],
})
export class ReportsModule {}
