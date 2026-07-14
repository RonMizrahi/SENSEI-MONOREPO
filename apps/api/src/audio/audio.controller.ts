import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import { AudioService } from './audio.service';
import {
  AudioFileInfoDto,
  AudioUploadResponseDto,
  TranscriptionResponseDto,
} from './dto/audio-response.dto';
import { UploadAudioDto } from './dto/upload-audio.dto';

/** Audio endpoints — upload/transcribe meeting recordings (senseiAPI /audio parity). */
@ApiTags('audio')
@ApiBearerAuth()
@Controller('audio')
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload and transcribe a meeting recording',
    description:
      'Validates the audio, transcribes it, persists the transcript for the meeting, ' +
      'queues the AI summary, and deletes the stored recording.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'The audio file plus its meeting linkage',
    schema: {
      type: 'object',
      required: ['file', 'meeting_id'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'The audio recording' },
        meeting_id: { type: 'string', format: 'uuid' },
        patient_id: { type: 'string', format: 'uuid' },
        session_date: { type: 'string', description: 'Accepted and ignored' },
      },
    },
  })
  @ApiCreatedResponse({ type: AudioUploadResponseDto })
  @ApiBadRequestResponse({
    description: 'Missing/empty file, missing meeting_id, or patient–meeting mismatch',
  })
  @ApiNotFoundResponse({ description: 'Meeting or patient not found' })
  @ApiConflictResponse({ description: 'A transcript already exists for the meeting' })
  @ApiPayloadTooLargeResponse({ description: 'File exceeds MAX_UPLOAD_BYTES' })
  @ApiUnsupportedMediaTypeResponse({ description: 'Not an accepted audio MIME type' })
  @ApiBadGatewayResponse({ description: 'Transcription provider failure' })
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() fields: UploadAudioDto,
  ): Promise<AudioUploadResponseDto> {
    return this.audioService.upload(file, fields);
  }

  @Get()
  @ApiOperation({ summary: 'List stored audio files' })
  @ApiOkResponse({ type: [AudioFileInfoDto] })
  list(): Promise<AudioFileInfoDto[]> {
    return this.audioService.list();
  }

  @Get(':audioId')
  @ApiOperation({ summary: 'Download a stored audio file' })
  @ApiParam({ name: 'audioId', description: 'Stored audio id ({uuid-hex}{ext})' })
  @ApiOkResponse({
    description: 'The raw audio bytes',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiNotFoundResponse({ description: 'Audio not found' })
  async download(@Param('audioId') audioId: string): Promise<StreamableFile> {
    const stored = await this.audioService.download(audioId);
    return new StreamableFile(stored.data, {
      type: stored.contentType,
      disposition: `attachment; filename="${stored.filename}"`,
      length: stored.data.length,
    });
  }

  @Delete(':audioId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a stored audio file' })
  @ApiParam({ name: 'audioId', description: 'Stored audio id ({uuid-hex}{ext})' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ description: 'Audio not found' })
  remove(@Param('audioId') audioId: string): Promise<void> {
    return this.audioService.remove(audioId);
  }

  @Post(':audioId/transcribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transcribe a stored audio file (deletes it on success)' })
  @ApiParam({ name: 'audioId', description: 'Stored audio id ({uuid-hex}{ext})' })
  @ApiOkResponse({ type: TranscriptionResponseDto })
  @ApiNotFoundResponse({ description: 'Audio not found' })
  @ApiBadGatewayResponse({ description: 'Transcription provider failure' })
  transcribe(@Param('audioId') audioId: string): Promise<TranscriptionResponseDto> {
    return this.audioService.transcribeStored(audioId);
  }
}
