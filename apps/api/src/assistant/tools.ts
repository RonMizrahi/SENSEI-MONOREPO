import { Logger } from '@nestjs/common';

/**
 * The assistant's tools: read-only, GET-only, same-host.
 *
 * Two tools are exposed to the model:
 * - `discover_api` — reads this API's live OpenAPI spec and returns the available
 *   GET endpoints, stripped to the minimal shape to save tokens.
 * - `http_get` — issues a GET to a same-host path (SSRF/traversal guarded).
 *
 * Scope is set by `allowAllGets`: when false (default) both tools are confined to the
 * PHI-safe `/assistant/context/*` surface; when true (demo) they reach any GET on this
 * API. The HTTP fetcher is injected so tests never touch the network.
 */

const logger = new Logger('AssistantTools');

/** The PHI-safe namespace the tools are confined to when `allowAllGets` is false. */
export const SAFE_PREFIX = '/assistant/context/';

/** Options for one injected GET. */
export interface FetchOptions {
  headers: Record<string, string>;
  params?: Record<string, string>;
}

/** Performs one GET; returns [statusCode, parsedBody]. */
export interface Fetcher {
  (url: string, opts: FetchOptions): Promise<[number, unknown]>;
}

/** One OpenAI function-tool spec offered to the model. */
export interface ToolSpec {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** Construction arguments for {@link AssistantTools}. */
export interface AssistantToolsOptions {
  baseUrl: string;
  fetch: Fetcher;
  authHeader?: string;
  allowAllGets: boolean;
}

/** True when `value` is a non-null plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * A same-host GET path: absolute, no traversal, no host/scheme escape. When
 * `allowAll` is false, additionally confined to the PHI-safe context namespace.
 * @param path The candidate request path.
 * @param allowAll Whether any same-host GET is permitted.
 */
export function isSafePath(path: string, allowAll: boolean): boolean {
  if (!path.startsWith('/') || path.includes('..') || path.slice(1).includes('//')) {
    return false;
  }
  return allowAll ? true : path.startsWith(SAFE_PREFIX);
}

/**
 * The minimal shape the model needs to call a GET endpoint — path, plus a non-empty
 * summary / param-name list. Everything else in the OpenAPI operation is dropped.
 * @param path The endpoint path.
 * @param operation The OpenAPI `get` operation object.
 */
function stripEndpoint(path: string, operation: Record<string, unknown>): Record<string, unknown> {
  const entry: Record<string, unknown> = { path };
  const summary = operation.summary;
  if (typeof summary === 'string' && summary) entry.summary = summary;
  const rawParams = operation.parameters;
  if (Array.isArray(rawParams)) {
    const names = rawParams
      .filter(isRecord)
      .map((param) => param.name)
      .filter((name): name is string => typeof name === 'string' && name.length > 0);
    if (names.length > 0) entry.params = names;
  }
  return entry;
}

/** The tool descriptions offered to the model (verbatim Hebrew from senseiAPI). */
const DISCOVER_DESCRIPTION =
  'מחזיר את רשימת נקודות הקצה הזמינות (GET בלבד) לשליפת מידע מהמערכת. ' +
  'השתמשו בזה תחילה כדי לגלות אילו נתונים ניתן לשלוף ובאילו נתיבים.';

const HTTP_GET_DESCRIPTION =
  'שולף מידע בבקשת GET מנקודת קצה במערכת. השתמשו ב-path כפי ' +
  'שהתקבל מ-discover_api, אך החליפו פרמטרים בנתיב (כמו ' +
  '{patient_id}) בערך עצמו בתוך ה-path — למשל ' +
  '/assistant/context/patient/<id>/meetings — ולא כפרמטר query.';

/** Registry of the assistant's read-only tools. */
export class AssistantTools {
  private readonly base: string;
  private readonly fetch: Fetcher;
  private readonly headers: Record<string, string>;
  private readonly allowAll: boolean;

  constructor(options: AssistantToolsOptions) {
    this.base = options.baseUrl.replace(/\/+$/, '');
    this.fetch = options.fetch;
    this.headers = options.authHeader ? { Authorization: options.authHeader } : {};
    this.allowAll = options.allowAllGets;
  }

  /** The OpenAI function-tool specs for the two exposed tools. */
  specs(): ToolSpec[] {
    return [
      {
        type: 'function',
        function: {
          name: 'discover_api',
          description: DISCOVER_DESCRIPTION,
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'http_get',
          description: HTTP_GET_DESCRIPTION,
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'נתיב במערכת כפי שהתקבל מ-discover_api.',
              },
              query: {
                type: 'object',
                description: 'פרמטרי שאילתה אופציונליים.',
                additionalProperties: { type: 'string' },
              },
            },
            required: ['path'],
          },
        },
      },
    ];
  }

  /**
   * Dispatches a tool call by name.
   * @param name The tool name (`discover_api` or `http_get`).
   * @param args The parsed tool arguments.
   * @throws Error when the tool name is not implemented.
   */
  dispatch(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (name === 'discover_api') return this.discover();
    if (name === 'http_get') {
      const path = typeof args.path === 'string' ? args.path : '';
      const query = isRecord(args.query) ? args.query : undefined;
      return this.httpGet(path, query);
    }
    return Promise.reject(new Error(`tool '${name}' is not implemented`));
  }

  /** Reads the OpenAPI spec and returns the allow-listed GET endpoints. */
  async discover(): Promise<Record<string, unknown>> {
    const [status, spec] = await this.fetch(`${this.base}/openapi.json`, { headers: this.headers });
    if (status !== 200 || !isRecord(spec)) {
      return { error: 'could not load the API description' };
    }
    const paths = isRecord(spec.paths) ? spec.paths : {};
    const endpoints: Record<string, unknown>[] = [];
    for (const [path, methods] of Object.entries(paths)) {
      if (!this.allowAll && !path.startsWith(SAFE_PREFIX)) continue;
      const operation = isRecord(methods) ? methods.get : undefined;
      if (isRecord(operation)) endpoints.push(stripEndpoint(path, operation));
    }
    return { endpoints };
  }

  /**
   * Issues a guarded GET to a same-host path.
   * @param path The request path (must pass {@link isSafePath}).
   * @param query Optional query parameters.
   */
  async httpGet(
    path: string,
    query?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!isSafePath(path, this.allowAll)) {
      logger.warn(`http_get refused non-allow-listed path: ${path}`);
      return { error: `refused: ${path} is not an allowed path` };
    }
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(query ?? {})) {
      params[key] = String(value);
    }
    const [status, body] = await this.fetch(`${this.base}${path}`, {
      headers: this.headers,
      params,
    });
    return { status, body };
  }
}
