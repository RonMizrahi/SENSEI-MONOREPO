import { z } from 'zod';

const JWT_SECRET_MIN_LENGTH = 32;
const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_TRANSCRIPT_CHARS = 40_000;
const DEFAULT_MAX_QUESTION_CHARS = 4_000;

/** Single source of truth for environment configuration — parsed once, fail-fast on boot. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  CORS_ORIGINS: z.string().default('http://localhost:3110'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SWAGGER_ENABLED: z.stringbool().default(true),
  // MOCK_MODE=true serves seeded in-memory data — no database or AI keys required.
  // Also read at module-composition time by src/common/mock-mode.ts (before Zod runs).
  MOCK_MODE: z.stringbool().default(false),
  // Gates the demo-data seed migrations (patients/calendar/sessions/etc.). When false
  // the seed files still apply and are tracked, but their guarded inserts affect 0 rows
  // — so production stays clean while dev/demo databases get the full mock world.
  // Takes effect only on a database's FIRST application of each seed file: once a seed
  // migration is recorded in _migrations it never re-runs, so flipping this later won't
  // retroactively seed an already-migrated database.
  SEED_DEMO_DATA: z.stringbool().default(false),
  DATABASE_URL: z.string().default('postgres://app:app@localhost:5432/app'),
  JWT_SECRET: z.string().min(JWT_SECRET_MIN_LENGTH).default('dev-only-secret-change-me-32-chars!!'),
  JWT_EXPIRES_IN: z.string().default('30d'),
  // --- audio upload ---
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(DEFAULT_MAX_UPLOAD_BYTES),
  // --- transcription (ElevenLabs Scribe; mock provider used in MOCK_MODE/tests) ---
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_MODEL: z.string().default('scribe_v2'),
  TRANSCRIBE_LANGUAGE: z.string().default('he'),
  // --- summaries + next-meeting reports (Anthropic Claude; mock in MOCK_MODE/tests) ---
  SUMMARY_ENABLED: z.stringbool().default(true),
  ANTHROPIC_API_KEY: z.string().optional(),
  SUMMARY_MODEL: z.string().default('claude-haiku-4-5'),
  MAX_TRANSCRIPT_CHARS: z.coerce.number().int().positive().default(DEFAULT_MAX_TRANSCRIPT_CHARS),
  // --- assistant chat ("שאל את סנסיי"; OpenAI, or MOCK_MODE mock) ---
  ASSISTANT_ENABLED: z.stringbool().default(false),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  // The assistant's tools call back into this API; forward the caller's bearer.
  ASSISTANT_SELF_BASE_URL: z.string().default('http://localhost:3000'),
  // true (demo only) lets the tools reach any GET on this API, incl. PHI.
  ASSISTANT_ALLOW_ALL_GETS: z.stringbool().default(false),
  ASSISTANT_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().optional(),
  ASSISTANT_MAX_QUESTION_CHARS: z.coerce.number().int().positive().default(DEFAULT_MAX_QUESTION_CHARS),
  ASSISTANT_MAX_TOTAL_INPUT_TOKENS: z.coerce.number().int().positive().optional(),
  // --- assistant tracing (Langfuse; disabled by default) ---
  LANGFUSE_ENABLED: z.stringbool().default(false),
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_BASE_URL: z.string().optional(),
});

/** Typed shape of the validated environment — use with `ConfigService<Env, true>`. */
export type Env = z.infer<typeof envSchema>;

/**
 * Validates raw environment variables against the schema.
 * @param raw Unvalidated process.env-shaped record (ConfigModule contract).
 * @throws Error with a readable summary when validation fails.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  // dev-only defaults must never silently apply in production.
  // JWT_SECRET is required unconditionally; DATABASE_URL only when not in MOCK_MODE.
  if (raw.NODE_ENV === 'production') {
    if (!raw.JWT_SECRET) {
      throw new Error('Invalid environment configuration — JWT_SECRET is required in production');
    }
    if (raw.MOCK_MODE !== 'true' && !raw.DATABASE_URL) {
      throw new Error(
        'Invalid environment configuration — DATABASE_URL is required in production',
      );
    }
  }
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration — ${issues}`);
  }
  return parsed.data;
}
