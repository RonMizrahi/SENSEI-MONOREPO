/**
 * Audio upload constants — mirrors senseiAPI's ALLOWED_AUDIO_TYPES and the
 * MIME-to-extension mapping used to name stored files.
 */

/** MIME types accepted by POST /audio/upload (senseiAPI parity). */
export const ALLOWED_AUDIO_TYPES: ReadonlySet<string> = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
  'audio/x-flac',
  'audio/webm',
]);

/** Fallback file extension per MIME type when the upload has no usable suffix. */
export const EXTENSION_BY_TYPE: Readonly<Record<string, string>> = {
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/wave': '.wav',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/ogg': '.ogg',
  'audio/flac': '.flac',
  'audio/x-flac': '.flac',
  'audio/webm': '.webm',
};

/** Download MIME type per stored extension — derived from EXTENSION_BY_TYPE (first MIME wins). */
export const MIME_BY_EXTENSION: Readonly<Record<string, string>> = Object.entries(
  EXTENSION_BY_TYPE,
).reduce<Record<string, string>>((mimeByExtension, [mimeType, extension]) => {
  mimeByExtension[extension] ??= mimeType;
  return mimeByExtension;
}, {});

/** Extension used when neither the filename nor the MIME type gives one. */
export const DEFAULT_EXTENSION = '.bin';

/** MIME type served when a stored extension is unknown. */
export const DEFAULT_MIME_TYPE = 'application/octet-stream';

/** A lowercase dot-extension of 1–8 alphanumerics (what save() ever produces). */
export const SAFE_EXTENSION_PATTERN = /^\.[a-z0-9]{1,8}$/;

/**
 * Stored audio ids are `{uuid-hex}{ext}` — 32 hex chars plus a safe extension.
 * Anything else (traversal, nesting, foreign names) is rejected as not-found.
 */
export const STORED_AUDIO_ID_PATTERN = /^[0-9a-f]{32}\.[a-z0-9]{1,8}$/;
