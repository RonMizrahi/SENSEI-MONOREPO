// uploadToApi (via submitUpload) — the XHR multipart path against the senseiapi
// POST /audio/upload contract: UUID guards, exact form fields, status mapping.
import { afterEach, describe, expect, it, vi } from 'vitest';

const BASE = 'https://api.test.example';
const MEETING = '33333333-3333-3333-3333-333333333333';
const PATIENT = '44444444-4444-4444-4444-444444444444';

function loadUpload() {
  vi.resetModules();
  vi.stubEnv('VITE_API_BASE_URL', BASE);
  return import('../src/services/upload');
}

class FakeXHR {
  static last: FakeXHR | null = null;
  static nextStatus = 201;
  static nextBody: unknown = null;
  method = ''; url = ''; status = 0; response: unknown = null; responseText = '';
  responseType = ''; headers: Record<string, string> = {}; sentForm: FormData | null = null;
  upload = { onprogress: null as any, onload: null as any };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  open(m: string, u: string) { this.method = m; this.url = u; FakeXHR.last = this; }
  setRequestHeader(k: string, v: string) { this.headers[k] = v; }
  abort() { this.onabort?.(); }
  send(form: FormData) {
    this.sentForm = form;
    this.status = FakeXHR.nextStatus;
    this.response = FakeXHR.nextBody;
    queueMicrotask(() => { this.upload.onload?.(); this.onload?.(); });
  }
}

function install(status: number, body: unknown = null) {
  FakeXHR.nextStatus = status;
  FakeXHR.nextBody = body;
  vi.stubGlobal('XMLHttpRequest', FakeXHR as unknown as typeof XMLHttpRequest);
}

const baseOpts = (over: Record<string, unknown> = {}) => ({
  patientId: PATIENT, meetingId: MEETING, online: true, onProgress: () => {}, ...over,
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); localStorage.clear(); sessionStorage.clear(); });

describe('submitUpload → POST /audio/upload', () => {
  const file = new File(['abc'], 'session.mp3', { type: 'audio/mpeg' });

  it('success: posts to /audio/upload with exactly the contract form fields + Bearer', async () => {
    localStorage.setItem('sensei_api_access_token_v1', 'tok-up');
    install(201, { id: 'aud-1', text: 'תמלול', language: 'he', meeting_id: MEETING, transcript_id: 'tr-1' });
    const { submitUpload } = await loadUpload();
    const res = await submitUpload(file, baseOpts() as any);
    expect(res.status).toBe('success');
    expect(res.transcript?.text).toBe('תמלול');
    expect(res.transcript?.transcriptId).toBe('tr-1');
    const xhr = FakeXHR.last!;
    expect(xhr.url).toBe(BASE + '/audio/upload');
    expect(xhr.headers.Authorization).toBe('Bearer tok-up');
    expect([...xhr.sentForm!.keys()].sort()).toEqual(['file', 'meeting_id', 'patient_id']);
    expect(xhr.sentForm!.get('meeting_id')).toBe(MEETING);
  });

  it('non-UUID patient id is omitted from the form (server validates UUIDs)', async () => {
    install(201, { id: 'aud-1', text: 'x', language: 'he' });
    const { submitUpload } = await loadUpload();
    await submitUpload(file, baseOpts({ patientId: 'p5' }) as any);
    expect([...FakeXHR.last!.sentForm!.keys()].sort()).toEqual(['file', 'meeting_id']);
  });

  it.each([
    [undefined, 'missing meeting'],
    ['local-appt-1', 'non-UUID meeting'],
  ] as Array<[string | undefined, string]>)('meetingId %s → rejected before any request with the pick-a-meeting message', async (meetingId) => {
    install(201, {});
    FakeXHR.last = null;
    const { submitUpload } = await loadUpload();
    await expect(submitUpload(file, baseOpts({ meetingId }) as any))
      .rejects.toThrow('נא לבחור פגישה מהיומן לפני ההעלאה');
    expect(FakeXHR.last).toBeNull();
  });

  it.each([
    [409, 'לפגישה זו כבר יש תמלול'],
    [400, 'נא לבחור פגישה מהיומן לפני ההעלאה'],
    [404, 'הפגישה או המטופל לא נמצאו'],
    [413, 'הקובץ גדול מדי · הגודל המרבי הוא 25MB'],
    [415, 'סוג הקובץ אינו נתמך · העלו mp3, wav או m4a'],
  ])('backend %i maps to its Hebrew message', async (status, message) => {
    install(status);
    const { submitUpload } = await loadUpload();
    await expect(submitUpload(file, baseOpts() as any)).rejects.toThrow(message);
  });

  it('2xx with an invalid body rejects instead of resolving garbage', async () => {
    install(201, { nope: true });
    const { submitUpload } = await loadUpload();
    await expect(submitUpload(file, baseOpts() as any)).rejects.toThrow('Invalid upload response');
  });
});
