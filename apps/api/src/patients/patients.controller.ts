import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreatePatientDto } from './dto/create-patient.dto';
import { ListPatientsQueryDto } from './dto/list-patients-query.dto';
import { PatientResponseDto } from './dto/patient-response.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientsService } from './patients.service';

/** /patients CRUD — dispatch only; logic lives in PatientsService. */
@ApiTags('patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @ApiOperation({
    summary: 'List patients',
    description:
      'Active patients by default, ordered by created_at descending; ?archived=true returns only archived ones.',
  })
  @ApiOkResponse({ type: PatientResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  /** Lists patients — the DTO owns the archived default (false). */
  list(@Query() query: ListPatientsQueryDto): Promise<PatientResponseDto[]> {
    return this.patientsService.list(query.archived);
  }

  @Post()
  @ApiOperation({ summary: 'Create a patient' })
  @ApiBody({ type: CreatePatientDto })
  @ApiCreatedResponse({ type: PatientResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed (name/phone bounds, email format)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  /** Creates a patient from the validated payload. */
  create(@Body() dto: CreatePatientDto): Promise<PatientResponseDto> {
    return this.patientsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a patient', description: 'Partial update; at least one field is required.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Patient id' })
  @ApiBody({ type: UpdatePatientDto })
  @ApiOkResponse({ type: PatientResponseDto })
  @ApiBadRequestResponse({ description: 'Empty body, invalid field, or malformed id' })
  @ApiNotFoundResponse({ description: 'Unknown patient id' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  /** Partially updates a patient by id. */
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientDto,
  ): Promise<PatientResponseDto> {
    return this.patientsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a patient' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Patient id' })
  @ApiNoContentResponse({ description: 'Patient deleted' })
  @ApiBadRequestResponse({ description: 'Malformed id' })
  @ApiNotFoundResponse({ description: 'Unknown patient id' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  /** Deletes a patient by id. */
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.patientsService.remove(id);
  }
}
