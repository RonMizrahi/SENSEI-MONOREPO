import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppException, ResourceNotFoundException } from '../common/exceptions/app.exception';
import { CreatePatientDto } from './dto/create-patient.dto';
import { PatientResponseDto } from './dto/patient-response.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PATIENTS_REPOSITORY } from './patients.repository';
import type { PatientsRepositoryContract, UpdatePatientFields } from './patients.repository';

/** Business logic for the patient roster (CRUD + soft archiving). */
@Injectable()
export class PatientsService {
  constructor(
    @Inject(PATIENTS_REPOSITORY) private readonly repository: PatientsRepositoryContract,
  ) {}

  /**
   * Lists patients in one archive state, newest first.
   * @param archived true → only archived patients; false → only active ones.
   */
  async list(archived: boolean): Promise<PatientResponseDto[]> {
    const patients = await this.repository.findAll(archived);
    return patients.map((patient) => PatientResponseDto.fromEntity(patient));
  }

  /**
   * Creates a new active patient.
   * @param dto Validated create payload (email optional/nullable).
   */
  async create(dto: CreatePatientDto): Promise<PatientResponseDto> {
    const patient = await this.repository.create({
      name: dto.name,
      phone: dto.phone,
      email: dto.email ?? null,
    });
    return PatientResponseDto.fromEntity(patient);
  }

  /**
   * Applies a partial update (name/phone/email/archived); `email: null` clears the email.
   * @throws AppException 400 when no field is provided; ResourceNotFoundException on unknown id.
   */
  async update(id: string, dto: UpdatePatientDto): Promise<PatientResponseDto> {
    const fields: UpdatePatientFields = { ...dto };
    const hasChanges = Object.values(fields).some((value) => value !== undefined);
    if (!hasChanges) {
      throw new AppException(
        'EMPTY_UPDATE',
        'at least one of name, phone, email or archived must be provided',
        HttpStatus.BAD_REQUEST,
      );
    }
    const patient = await this.repository.update(id, fields);
    if (!patient) throw new ResourceNotFoundException('patient', id);
    return PatientResponseDto.fromEntity(patient);
  }

  /**
   * Permanently deletes a patient.
   * @throws ResourceNotFoundException on unknown id.
   */
  async remove(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) throw new ResourceNotFoundException('patient', id);
  }
}
