import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NoteResponseDto, UpdateNoteDto } from './dto/note.dto';
import { NotesService } from './notes.service';

/** Clinical notes — /patients/{id}/notes (unversioned, per-therapist). */
@ApiTags('notes')
@ApiBearerAuth()
@Controller('patients/:patientId/notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  @ApiOperation({ summary: 'Get the therapist’s clinical note for a patient' })
  @ApiParam({ name: 'patientId', description: 'Patient id', format: 'uuid' })
  @ApiOkResponse({ type: NoteResponseDto, description: 'The note (empty body when unset)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ): Promise<NoteResponseDto> {
    return this.notes.get(user, patientId);
  }

  @Put()
  @ApiOperation({ summary: 'Replace the therapist’s clinical note for a patient' })
  @ApiParam({ name: 'patientId', description: 'Patient id', format: 'uuid' })
  @ApiBody({ type: UpdateNoteDto })
  @ApiOkResponse({ type: NoteResponseDto, description: 'The stored note' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  replace(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: UpdateNoteDto,
  ): Promise<NoteResponseDto> {
    return this.notes.replace(user, patientId, dto);
  }
}
