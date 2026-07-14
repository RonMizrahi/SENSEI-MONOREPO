import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearMemoryUploadQueue,
  countPendingUploads,
  enqueueUpload,
  listPendingUploads,
  removePendingUpload,
} from '../src/services/uploadQueue';
import { drainUploadQueue, submitUpload } from '../src/services/upload';

beforeEach(() => clearMemoryUploadQueue());
afterEach(() => clearMemoryUploadQueue());

describe('uploadQueue — offline persistence', () => {
  it('enqueues and lists pending uploads', async () => {
    const blob = new Blob(['audio'], { type: 'audio/webm' });
    const id = await enqueueUpload({
      fileName: 'rec.webm',
      mimeType: 'audio/webm',
      blob,
      patientId: 'p1',
      sessionDate: '2026-06-30',
    });
    expect(id).toBeTruthy();
    const all = await listPendingUploads();
    expect(all).toHaveLength(1);
    expect(all[0].fileName).toBe('rec.webm');
    expect(await countPendingUploads()).toBe(1);
    await removePendingUpload(id);
    expect(await countPendingUploads()).toBe(0);
  });
});

describe('submitUpload — offline queue', () => {
  it('queues when offline instead of uploading', async () => {
    const file = new File(['x'], 'session.webm', { type: 'audio/webm' });
    const progress: number[] = [];
    const result = await submitUpload(file, {
      patientId: 'p1',
      online: false,
      onProgress: (p) => progress.push(p),
    });
    expect(result.status).toBe('queued');
    expect(await countPendingUploads()).toBe(1);
    expect(progress).toEqual([]);
  });

  it('drains queued uploads when back online', async () => {
    const file = new File(['x'], 'session.webm', { type: 'audio/webm' });
    await submitUpload(file, { patientId: 'p1', online: false, onProgress: () => {} });
    const synced = await drainUploadQueue({ online: true });
    expect(synced.synced).toBe(1);
    expect(await countPendingUploads()).toBe(0);
  });
});
