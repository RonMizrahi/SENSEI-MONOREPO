import type { GenerationStatus } from '../summaries/entities/meeting-summary.entity';

/** Lifecycle status literals (typed against the shared GenerationStatus union). */
export const STATUS_PENDING: GenerationStatus = 'pending';
export const STATUS_RUNNING: GenerationStatus = 'running';
export const STATUS_READY: GenerationStatus = 'ready';
export const STATUS_FAILED: GenerationStatus = 'failed';

/** User-facing failure when the patient has no ready meeting summaries yet. */
export const NO_SUMMARIES_ERROR = 'אין עדיין סיכומי פגישות למטופל זה';

/** Written onto rows found 'running' during the startup sweep. */
export const RESTART_SWEEP_ERROR = 'generation was interrupted by a server restart';

/** Failure when the Anthropic key is absent in a real-mode deployment. */
export const MISSING_API_KEY_ERROR =
  'ANTHROPIC_API_KEY is not configured — report generation is unavailable';

/** Failure when the model response cannot be parsed into a report. */
export const REPORT_PARSE_ERROR = 'The model returned a response that is not a valid report JSON';

/** Max characters kept from the most recent ready summary as the excerpt. */
export const EXCERPT_MAX_CHARS = 500;

/** Output token budget for the Anthropic prep-report call. */
export const REPORT_MAX_TOKENS = 2048;
