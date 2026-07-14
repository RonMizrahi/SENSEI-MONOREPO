import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isMockMode, provideMockSwappable } from '../common/mock-mode';
import { Patient } from './entities/patient.entity';
import { PatientsController } from './patients.controller';
import { PATIENTS_REPOSITORY, PatientsRepository } from './patients.repository';
import type { PatientsRepositoryContract } from './patients.repository';
import { MockPatientsRepository } from './patients.repository.mock';
import { PatientsService } from './patients.service';

/** Patient roster CRUD — TypeORM-backed, or seeded in-memory in MOCK_MODE. */
@Module({
  imports: [...(isMockMode() ? [] : [TypeOrmModule.forFeature([Patient])])],
  controllers: [PatientsController],
  providers: [
    PatientsService,
    provideMockSwappable<PatientsRepositoryContract>(
      PATIENTS_REPOSITORY,
      PatientsRepository,
      MockPatientsRepository,
    ),
  ],
})
export class PatientsModule {}
