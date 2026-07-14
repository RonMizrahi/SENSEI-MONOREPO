import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extname } from 'node:path';
import { AppException, ResourceNotFoundException } from '../common/exceptions/app.exception';
import type { Env } from '../config/env.schema';
import { SUMMARY_QUEUE, type SummaryQueue } from '../summaries/summary-queue';
import type { DiarizedSegment } from '../transcripts/entities/transcript.entity';
import { TRANSCRIPT_STORE, type TranscriptStore } from '../transcripts/transcript-store';
import {
  TRANSCRIPTION_PROVIDER,
  type TranscribedWord,
  type TranscriptionProvider,
  type TranscriptionResult,
} from '../transcription/transcription.provider';
import { ALLOWED_AUDIO_TYPES, DEFAULT_MIME_TYPE, MIME_BY_EXTENSION } from './audio.constants';
import { AudioStorageService } from './audio-storage.service';
import {
  AudioFileInfoDto,
  AudioUploadResponseDto,
  TranscriptionResponseDto,
} from './dto/audio-response.dto';
import { UploadAudioDto } from './dto/upload-audio.dto';
import { UPLOAD_TARGETS_REPOSITORY, type UploadTargetsRepository } from './audio.repository';

/** Fallback transcript language when the provider reports none. */
const DEFAULT_TRANSCRIPT_LANGUAGE = 'he';

/** A downloadable stored audio file. */
export interface AudioDownload {
  filename: string;
  contentType: string;
  data: Buffer;
}

/**
 * Orchestrates the audio flow: validate → store → transcribe → persist the
 * transcript → queue the summary (senseiAPI audio service + router parity).
 */
@Injectable()
export class AudioService {
  private readonly logger = new Logger(AudioService.name);

  constructor(
    private readonly storage: AudioStorageService,
    private readonly config: ConfigService<Env, true>,
    @Inject(TRANSCRIPTION_PROVIDER) private readonly transcriber: TranscriptionProvider,
    @Inject(TRANSCRIPT_STORE) private readonly transcripts: TranscriptStore,
    @Inject(UPLOAD_TARGETS_REPOSITORY) private readonly uploadTargets: UploadTargetsRepository,
    @Inject(SUMMARY_QUEUE) private readonly summaryQueue: SummaryQueue,
  ) {}

  /**
   * Validates, transcribes, and persists an uploaded meeting recording.
   * @throws AppException 400/404/409/413/415 per the matrix, 502 on provider failure.
   */
  async upload(
    file: Express.Multer.File | undefined,
    fields: UploadAudioDto,
  ): Promise<AudioUploadResponseDto> {
    const upload = this.validateFile(file);
    await this.validateTargets(fields);

    const saved = await this.storage.save(upload.buffer, upload.originalname, upload.mimetype);
    // On transcription failure the stored file is kept so the client can retry.
    const result = await this.transcribe(upload.buffer, saved.filename);

    const transcript = await this.transcripts.create({
      meetingId: fields.meeting_id,
      rawText: result.text,
      language: result.language || DEFAULT_TRANSCRIPT_LANGUAGE,
      diarizedSegments: this.toDiarizedSegments(result.words),
    });
    // The recording is transient (senseiAPI parity): once transcribed, delete it.
    await this.storage.delete(saved.id);

    if (this.config.get('SUMMARY_ENABLED', { infer: true })) {
      await this.summaryQueue.enqueue(fields.meeting_id);
    }

    return {
      id: saved.id,
      filename: saved.filename,
      content_type: saved.contentType,
      size_bytes: saved.sizeBytes,
      language: transcript.language,
      text: transcript.rawText,
      meeting_id: transcript.meetingId,
      transcript_id: transcript.id,
    };
  }

  /** Lists the audio files currently in the upload directory. */
  async list(): Promise<AudioFileInfoDto[]> {
    const files = await this.storage.list();
    return files.map((file) => ({ id: file.id, size_bytes: file.sizeBytes }));
  }

  /**
   * Reads a stored audio file for download.
   * @throws ResourceNotFoundException when the id is unsafe or missing.
   */
  async download(audioId: string): Promise<AudioDownload> {
    const stored = await this.storage.read(audioId);
    if (stored === null) throw new ResourceNotFoundException('audio', audioId);
    return {
      filename: stored.id,
      contentType: MIME_BY_EXTENSION[extname(stored.id)] ?? DEFAULT_MIME_TYPE,
      data: stored.data,
    };
  }

  /**
   * Deletes a stored audio file.
   * @throws ResourceNotFoundException when the id is unsafe or missing.
   */
  async remove(audioId: string): Promise<void> {
    const deleted = await this.storage.delete(audioId);
    if (!deleted) throw new ResourceNotFoundException('audio', audioId);
  }

  /**
   * Transcribes an already-stored audio file, deleting it on success.
   * @throws ResourceNotFoundException 404 / AppException 502 on provider failure.
   */
  async transcribeStored(audioId: string): Promise<TranscriptionResponseDto> {
    const stored = await this.storage.read(audioId);
    if (stored === null) throw new ResourceNotFoundException('audio', audioId);
    // On transcription failure the stored file is kept so the client can retry.
    const result = await this.transcribe(stored.data, stored.id);
    await this.storage.delete(audioId);
    return {
      id: audioId,
      language: result.language,
      text: result.text,
      words: result.words.map((word) => ({ text: word.text, start: word.start, end: word.end })),
    };
  }

  /** Rejects missing (400), unsupported (415), empty (400), and oversized (413) uploads. */
  private validateFile(file: Express.Multer.File | undefined): Express.Multer.File {
    if (file === undefined) {
      throw new AppException(
        'AUDIO_FILE_REQUIRED',
        'an audio file is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!ALLOWED_AUDIO_TYPES.has(file.mimetype)) {
      throw new AppException(
        'UNSUPPORTED_AUDIO_TYPE',
        `unsupported audio type: ${file.mimetype || 'unknown'}`,
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }
    if (file.buffer.length === 0) {
      throw new AppException('EMPTY_AUDIO', 'uploaded audio file is empty', HttpStatus.BAD_REQUEST);
    }
    const maxBytes = this.config.get('MAX_UPLOAD_BYTES', { infer: true });
    if (file.buffer.length > maxBytes) {
      throw new AppException(
        'AUDIO_TOO_LARGE',
        `audio is ${file.buffer.length} bytes; max allowed is ${maxBytes}`,
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
    return file;
  }

  /** Validates meeting existence, patient linkage, and transcript uniqueness. */
  private async validateTargets(fields: UploadAudioDto): Promise<void> {
    const meeting = await this.uploadTargets.findMeeting(fields.meeting_id);
    if (meeting === null) throw new ResourceNotFoundException('meeting', fields.meeting_id);

    if (fields.patient_id !== undefined) {
      if (!(await this.uploadTargets.patientExists(fields.patient_id))) {
        throw new ResourceNotFoundException('patient', fields.patient_id);
      }
      if (meeting.patientId !== null && meeting.patientId !== fields.patient_id) {
        throw new AppException(
          'TRANSCRIPT_PATIENT_MISMATCH',
          `meeting ${fields.meeting_id} belongs to a different patient`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (await this.transcripts.existsByMeetingId(fields.meeting_id)) {
      throw new AppException(
        'TRANSCRIPT_ALREADY_EXISTS',
        `a transcript already exists for meeting ${fields.meeting_id}`,
        HttpStatus.CONFLICT,
      );
    }
  }

  /** Runs the provider, mapping any failure to a 502 (upstream fault). */
  private async transcribe(data: Buffer, filename: string): Promise<TranscriptionResult> {
    try {
      return await this.transcriber.transcribe(data, filename);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`transcription failed: ${reason}`);
      throw new AppException(
        'TRANSCRIPTION_FAILED',
        'transcription failed',
        HttpStatus.BAD_GATEWAY,
        {
          reason,
        },
      );
    }
  }

  /** Maps word timings into the transcripts.diarized_segments shape (no real speakers yet). */
  private toDiarizedSegments(words: TranscribedWord[]): DiarizedSegment[] {
    return words.map((word) => ({
      speaker: 'unknown',
      start_time: word.start,
      end_time: word.end,
      text: word.text,
    }));
  }
}
