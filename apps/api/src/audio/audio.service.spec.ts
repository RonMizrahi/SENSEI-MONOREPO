/* eslint-disable @typescript-eslint/unbound-method -- expect(mock.fn) assertions on jest mocks */
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Env } from '../config/env.schema';
import type { SummaryQueue } from '../summaries/summary-queue';
import { Transcript } from '../transcripts/entities/transcript.entity';
import type { TranscriptStore } from '../transcripts/transcript-store';
import type { TranscriptionProvider } from '../transcription/transcription.provider';
import type { AudioStorageService } from './audio-storage.service';
import type { UploadTargetsRepository } from './audio.repository';
import { AudioService } from './audio.service';

const MAX_BYTES = 100;

type EnvValues = Partial<Record<keyof Env, unknown>>;

const makeConfig = (values: EnvValues): ConfigService<Env, true> =>
  ({ get: (key: keyof Env) => values[key] }) as unknown as ConfigService<Env, true>;

const makeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
  ({
    fieldname: 'file',
    originalname: 'session.mp3',
    encoding: '7bit',
    mimetype: 'audio/mpeg',
    size: 4,
    buffer: Buffer.from('data'),
    ...overrides,
  }) as Express.Multer.File;

const storedTranscript = (meetingId: string): Transcript => {
  const transcript = new Transcript();
  transcript.id = randomUUID();
  transcript.meetingId = meetingId;
  transcript.rawText = 'טקסט לדוגמה';
  transcript.language = 'he';
  transcript.diarizedSegments = [];
  transcript.createdAt = new Date();
  return transcript;
};

async function expectHttpStatus(promise: Promise<unknown>, status: number): Promise<void> {
  const error: unknown = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(HttpException);
  expect((error as HttpException).getStatus()).toBe(status);
}

describe('AudioService', () => {
  let storage: jest.Mocked<
    Pick<AudioStorageService, 'save' | 'list' | 'read' | 'delete' | 'isSafeId'>
  >;
  let transcriber: jest.Mocked<TranscriptionProvider>;
  let transcripts: jest.Mocked<TranscriptStore>;
  let uploadTargets: jest.Mocked<UploadTargetsRepository>;
  let summaryQueue: jest.Mocked<SummaryQueue>;
  let meetingId: string;
  let patientId: string;

  const buildService = (envOverrides: EnvValues = {}): AudioService =>
    new AudioService(
      storage as unknown as AudioStorageService,
      makeConfig({ MAX_UPLOAD_BYTES: MAX_BYTES, SUMMARY_ENABLED: true, ...envOverrides }),
      transcriber,
      transcripts,
      uploadTargets,
      summaryQueue,
    );

  beforeEach(() => {
    meetingId = randomUUID();
    patientId = randomUUID();
    storage = {
      save: jest.fn().mockResolvedValue({
        id: `${'a'.repeat(32)}.mp3`,
        filename: 'session.mp3',
        contentType: 'audio/mpeg',
        sizeBytes: 4,
      }),
      list: jest.fn().mockResolvedValue([]),
      read: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(true),
      isSafeId: jest.fn().mockReturnValue(true),
    };
    transcriber = {
      transcribe: jest.fn().mockResolvedValue({
        text: 'שלום עולם',
        language: 'he',
        words: [
          { text: 'שלום', start: 0, end: 0.4 },
          { text: 'עולם', start: 0.4, end: 0.8 },
        ],
      }),
    };
    transcripts = {
      getByMeetingId: jest.fn().mockResolvedValue(null),
      existsByMeetingId: jest.fn().mockResolvedValue(false),
      create: jest
        .fn()
        .mockImplementation((input: { meetingId: string }) =>
          Promise.resolve(storedTranscript(input.meetingId)),
        ),
    };
    uploadTargets = {
      findMeeting: jest
        .fn()
        .mockImplementation(() => Promise.resolve({ id: meetingId, patientId: null })),
      patientExists: jest.fn().mockResolvedValue(true),
    };
    summaryQueue = { enqueue: jest.fn().mockResolvedValue(undefined) };
  });

  describe('upload — file validation', () => {
    it('rejects a missing file with 400', async () => {
      await expectHttpStatus(
        buildService().upload(undefined, { meeting_id: meetingId }),
        HttpStatus.BAD_REQUEST,
      );
    });

    it('rejects an unsupported MIME type with 415', async () => {
      await expectHttpStatus(
        buildService().upload(makeFile({ mimetype: 'text/plain' }), { meeting_id: meetingId }),
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    });

    it('rejects an empty file with 400', async () => {
      await expectHttpStatus(
        buildService().upload(makeFile({ buffer: Buffer.alloc(0) }), { meeting_id: meetingId }),
        HttpStatus.BAD_REQUEST,
      );
    });

    it('rejects an oversized file with 413', async () => {
      await expectHttpStatus(
        buildService().upload(makeFile({ buffer: Buffer.alloc(MAX_BYTES + 1) }), {
          meeting_id: meetingId,
        }),
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    });

    it.each([
      'audio/wav',
      'audio/x-wav',
      'audio/mp4',
      'audio/aac',
      'audio/ogg',
      'audio/flac',
      'audio/webm',
    ])('accepts the allowed MIME type %s', async (mimetype) => {
      await expect(
        buildService().upload(makeFile({ mimetype }), { meeting_id: meetingId }),
      ).resolves.toMatchObject({ meeting_id: meetingId });
    });
  });

  describe('upload — target validation', () => {
    it('rejects an unknown meeting with 404 before storing anything', async () => {
      uploadTargets.findMeeting.mockResolvedValue(null);
      await expectHttpStatus(
        buildService().upload(makeFile(), { meeting_id: meetingId }),
        HttpStatus.NOT_FOUND,
      );
      expect(storage.save).not.toHaveBeenCalled();
      expect(transcriber.transcribe).not.toHaveBeenCalled();
    });

    it('rejects an unknown patient with 404', async () => {
      uploadTargets.patientExists.mockResolvedValue(false);
      await expectHttpStatus(
        buildService().upload(makeFile(), { meeting_id: meetingId, patient_id: patientId }),
        HttpStatus.NOT_FOUND,
      );
    });

    it('rejects a patient that does not match the meeting with 400', async () => {
      uploadTargets.findMeeting.mockResolvedValue({ id: meetingId, patientId: randomUUID() });
      await expectHttpStatus(
        buildService().upload(makeFile(), { meeting_id: meetingId, patient_id: patientId }),
        HttpStatus.BAD_REQUEST,
      );
    });

    it('accepts a patient when the meeting has no linked patient', async () => {
      uploadTargets.findMeeting.mockResolvedValue({ id: meetingId, patientId: null });
      await expect(
        buildService().upload(makeFile(), { meeting_id: meetingId, patient_id: patientId }),
      ).resolves.toMatchObject({ meeting_id: meetingId });
    });

    it('accepts a patient that matches the meeting', async () => {
      uploadTargets.findMeeting.mockResolvedValue({ id: meetingId, patientId });
      await expect(
        buildService().upload(makeFile(), { meeting_id: meetingId, patient_id: patientId }),
      ).resolves.toMatchObject({ meeting_id: meetingId });
    });

    it('rejects a meeting that already has a transcript with 409', async () => {
      transcripts.existsByMeetingId.mockResolvedValue(true);
      await expectHttpStatus(
        buildService().upload(makeFile(), { meeting_id: meetingId }),
        HttpStatus.CONFLICT,
      );
      expect(transcripts.create).not.toHaveBeenCalled();
    });
  });

  describe('upload — happy path', () => {
    it('persists the transcript with the diarized word mapping', async () => {
      await buildService().upload(makeFile(), { meeting_id: meetingId });
      expect(transcripts.create).toHaveBeenCalledWith({
        meetingId,
        rawText: 'שלום עולם',
        language: 'he',
        diarizedSegments: [
          { speaker: 'unknown', start_time: 0, end_time: 0.4, text: 'שלום' },
          { speaker: 'unknown', start_time: 0.4, end_time: 0.8, text: 'עולם' },
        ],
      });
    });

    it('returns the upload response shape and deletes the stored file', async () => {
      const response = await buildService().upload(makeFile(), { meeting_id: meetingId });
      expect(response).toMatchObject({
        id: `${'a'.repeat(32)}.mp3`,
        filename: 'session.mp3',
        content_type: 'audio/mpeg',
        size_bytes: 4,
        language: 'he',
        meeting_id: meetingId,
      });
      expect(typeof response.transcript_id).toBe('string');
      expect(storage.delete).toHaveBeenCalledWith(`${'a'.repeat(32)}.mp3`);
    });

    it('enqueues the summary when SUMMARY_ENABLED', async () => {
      await buildService().upload(makeFile(), { meeting_id: meetingId });
      expect(summaryQueue.enqueue).toHaveBeenCalledWith(meetingId);
    });

    it('does not enqueue when SUMMARY_ENABLED is false', async () => {
      await buildService({ SUMMARY_ENABLED: false }).upload(makeFile(), { meeting_id: meetingId });
      expect(summaryQueue.enqueue).not.toHaveBeenCalled();
    });

    it('falls back to Hebrew when the provider reports no language', async () => {
      transcriber.transcribe.mockResolvedValue({ text: 'טקסט', language: '', words: [] });
      await buildService().upload(makeFile(), { meeting_id: meetingId });
      expect(transcripts.create).toHaveBeenCalledWith(expect.objectContaining({ language: 'he' }));
    });
  });

  describe('upload — provider failure', () => {
    it('maps a provider failure to 502 and keeps the stored file', async () => {
      transcriber.transcribe.mockRejectedValue(new Error('upstream exploded'));
      await expectHttpStatus(
        buildService().upload(makeFile(), { meeting_id: meetingId }),
        HttpStatus.BAD_GATEWAY,
      );
      expect(storage.delete).not.toHaveBeenCalled();
      expect(transcripts.create).not.toHaveBeenCalled();
      expect(summaryQueue.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('maps stored files to the wire shape', async () => {
      storage.list.mockResolvedValue([{ id: `${'b'.repeat(32)}.wav`, sizeBytes: 9 }]);
      await expect(buildService().list()).resolves.toEqual([
        { id: `${'b'.repeat(32)}.wav`, size_bytes: 9 },
      ]);
    });
  });

  describe('download', () => {
    it('returns the bytes with the extension-derived MIME type', async () => {
      const id = `${'c'.repeat(32)}.mp3`;
      storage.read.mockResolvedValue({ id, data: Buffer.from('xyz') });
      await expect(buildService().download(id)).resolves.toEqual({
        filename: id,
        contentType: 'audio/mpeg',
        data: Buffer.from('xyz'),
      });
    });

    it('serves unknown extensions as octet-stream', async () => {
      const id = `${'c'.repeat(32)}.bin`;
      storage.read.mockResolvedValue({ id, data: Buffer.from('xyz') });
      await expect(buildService().download(id)).resolves.toMatchObject({
        contentType: 'application/octet-stream',
      });
    });

    it('404s for a missing file', async () => {
      await expectHttpStatus(buildService().download('nope'), HttpStatus.NOT_FOUND);
    });
  });

  describe('remove', () => {
    it('resolves when the file was deleted', async () => {
      await expect(buildService().remove(`${'d'.repeat(32)}.mp3`)).resolves.toBeUndefined();
    });

    it('404s when nothing was deleted', async () => {
      storage.delete.mockResolvedValue(false);
      await expectHttpStatus(buildService().remove('missing'), HttpStatus.NOT_FOUND);
    });
  });

  describe('transcribeStored', () => {
    it('transcribes, deletes the file, and returns the words', async () => {
      const id = `${'e'.repeat(32)}.mp3`;
      storage.read.mockResolvedValue({ id, data: Buffer.from('xyz') });
      const response = await buildService().transcribeStored(id);
      expect(response).toEqual({
        id,
        language: 'he',
        text: 'שלום עולם',
        words: [
          { text: 'שלום', start: 0, end: 0.4 },
          { text: 'עולם', start: 0.4, end: 0.8 },
        ],
      });
      expect(storage.delete).toHaveBeenCalledWith(id);
    });

    it('404s for a missing file', async () => {
      await expectHttpStatus(buildService().transcribeStored('missing'), HttpStatus.NOT_FOUND);
    });

    it('maps provider failures to 502 and keeps the file', async () => {
      const id = `${'e'.repeat(32)}.mp3`;
      storage.read.mockResolvedValue({ id, data: Buffer.from('xyz') });
      transcriber.transcribe.mockRejectedValue(new Error('boom'));
      await expectHttpStatus(buildService().transcribeStored(id), HttpStatus.BAD_GATEWAY);
      expect(storage.delete).not.toHaveBeenCalled();
    });
  });
});
