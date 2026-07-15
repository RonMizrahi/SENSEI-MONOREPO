import type { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Env } from '../config/env.schema';
import { AudioStorageService } from './audio-storage.service';

const STORED_ID_PATTERN = /^[0-9a-f]{32}\.[a-z0-9]{1,8}$/;

describe('AudioStorageService', () => {
  let uploadDir: string;
  let storage: AudioStorageService;

  const configFor = (dir: string): ConfigService<Env, true> =>
    ({
      get: (key: string) => (key === 'UPLOAD_DIR' ? dir : undefined),
    }) as unknown as ConfigService<Env, true>;

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'audio-storage-'));
    storage = new AudioStorageService(configFor(uploadDir));
  });

  afterEach(async () => {
    await rm(uploadDir, { recursive: true, force: true });
  });

  describe('save', () => {
    it('stores the file under a {uuid-hex}{ext} name from the filename suffix', async () => {
      const saved = await storage.save(Buffer.from('abc'), 'Session.MP3', 'audio/mpeg');
      expect(saved.id).toMatch(STORED_ID_PATTERN);
      expect(saved.id.endsWith('.mp3')).toBe(true);
      expect(saved.filename).toBe('Session.MP3');
      expect(saved.contentType).toBe('audio/mpeg');
      expect(saved.sizeBytes).toBe(3);
    });

    it('falls back to the MIME-mapped extension when the filename has none', async () => {
      const saved = await storage.save(Buffer.from('abc'), 'recording', 'audio/x-m4a');
      expect(saved.id.endsWith('.m4a')).toBe(true);
    });

    it('falls back to .bin for unknown MIME types and unsafe suffixes', async () => {
      const weirdSuffix = await storage.save(Buffer.from('abc'), 'a.mp3$', 'application/x-thing');
      expect(weirdSuffix.id.endsWith('.bin')).toBe(true);
    });

    it('uses the stored name as filename when the original is empty', async () => {
      const saved = await storage.save(Buffer.from('abc'), '', 'audio/wav');
      expect(saved.filename).toBe(saved.id);
    });
  });

  describe('read', () => {
    it('returns the stored bytes', async () => {
      const saved = await storage.save(Buffer.from('hello'), 'a.mp3', 'audio/mpeg');
      const stored = await storage.read(saved.id);
      expect(stored?.data.toString()).toBe('hello');
    });

    it('returns null for a missing file', async () => {
      await expect(storage.read(`${'0'.repeat(32)}.mp3`)).resolves.toBeNull();
    });

    it.each([
      '../secret.mp3',
      'nested/f.mp3',
      '..',
      'UPPER.mp3',
      `${'0'.repeat(32)}`,
      `${'g'.repeat(32)}.mp3`,
    ])('rejects the unsafe id %s without touching the filesystem', async (unsafeId) => {
      await writeFile(join(uploadDir, 'secret.mp3'), 'x').catch(() => undefined);
      await expect(storage.read(unsafeId)).resolves.toBeNull();
    });
  });

  describe('delete', () => {
    it('deletes a stored file and reports missing ones', async () => {
      const saved = await storage.save(Buffer.from('abc'), 'a.mp3', 'audio/mpeg');
      await expect(storage.delete(saved.id)).resolves.toBe(true);
      await expect(storage.delete(saved.id)).resolves.toBe(false);
      await expect(storage.read(saved.id)).resolves.toBeNull();
    });

    it('rejects traversal ids', async () => {
      await expect(storage.delete('../outside.mp3')).resolves.toBe(false);
    });
  });

  describe('isSafeId', () => {
    it('accepts only lowercase uuid-hex names with a short extension', () => {
      expect(storage.isSafeId(`${'a'.repeat(32)}.webm`)).toBe(true);
      expect(storage.isSafeId(`${'a'.repeat(31)}.mp3`)).toBe(false);
      expect(storage.isSafeId(`${'a'.repeat(32)}.`)).toBe(false);
      expect(storage.isSafeId(`${'a'.repeat(32)}.verylongext`)).toBe(false);
    });
  });
});
