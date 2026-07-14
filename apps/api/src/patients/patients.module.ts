import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isMockMode } from '../common/mock-mode';
import { Patient } from './entities/patient.entity';

/**
 * Foundation skeleton — the patients worker adds the controller, service,
 * and repository (real + seeded mock).
 */
@Module({
  imports: [...(isMockMode() ? [] : [TypeOrmModule.forFeature([Patient])])],
})
export class PatientsModule {}
