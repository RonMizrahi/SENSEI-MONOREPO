import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { Env } from '../config/env.schema';
import {
  DEFAULT_EXTENSION,
  EXTENSION_BY_TYPE,
  SAFE_EXTENSION_PATTERN,
  STORED_AUDIO_ID_PATTERN,
} from './audio.constants';

/** Metadata of a freshly stored upload. */
export interface SavedAudio {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

/** Contents of a stored audio file. */
export interface StoredAudioContent {
  id: string;
  data: Buffer;
}

/**
 * Stores uploaded audio on the local filesystem under UPLOAD_DIR.
 * Files are named `{uuid-hex}{ext}`; lookups reject anything else, so no
 * path traversal can escape the upload directory (senseiAPI loader parity).
 */
@Injectable()
export class AudioStorageService {
  private readonly uploadDir: string;

  constructor(config: ConfigService<Env, true>) {
    this.uploadDir = config.get('UPLOAD_DIR', { infer: true });
  }

  /**
   * Persists validated audio bytes under a fresh `{uuid-hex}{ext}` name.
   * @returns The stored metadata (id, original filename, MIME type, size).
   */
  async save(data: Buffer, filename: string, contentType: string): Promise<SavedAudio> {
    const storedName = `${randomUUID().replaceAll('-', '')}${this.extensionFor(filename, contentType)}`;
    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(join(this.uploadDir, storedName), data);
    return {
      id: storedName,
      filename: filename || storedName,
      contentType,
      sizeBytes: data.length,
    };
  }

  /** Reads a stored file's bytes, or null when the id is unsafe or missing. */
  async read(audioId: string): Promise<StoredAudioContent | null> {
    if (!this.isSafeId(audioId)) return null;
    try {
      const data = await readFile(join(this.uploadDir, audioId));
      return { id: audioId, data };
    } catch {
      return null;
    }
  }

  /**
   * Deletes a stored file.
   * @returns false when the id is unsafe or the file does not exist.
   */
  async delete(audioId: string): Promise<boolean> {
    if (!this.isSafeId(audioId)) return false;
    try {
      await unlink(join(this.uploadDir, audioId));
      return true;
    } catch {
      return false;
    }
  }

  /** True when the id matches the `{uuid-hex}{ext}` pattern save() produces. */
  isSafeId(audioId: string): boolean {
    return STORED_AUDIO_ID_PATTERN.test(audioId);
  }

  /** Picks the stored extension: filename suffix, then MIME fallback, then .bin. */
  private extensionFor(filename: string, contentType: string): string {
    const suffix = extname(filename).toLowerCase();
    if (SAFE_EXTENSION_PATTERN.test(suffix)) return suffix;
    return EXTENSION_BY_TYPE[contentType] ?? DEFAULT_EXTENSION;
  }
}
