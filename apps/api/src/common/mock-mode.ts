import type { Provider, Type } from '@nestjs/common';

/**
 * Whether the API runs on seeded in-memory data (no database, no AI keys).
 * Read at module-composition time — imports/providers are decided before Nest
 * boots and before Zod validation runs, so this is the one sanctioned direct
 * process.env read (mirrored by MOCK_MODE in env.schema.ts for everything else).
 */
export function isMockMode(): boolean {
  return process.env.MOCK_MODE === 'true';
}

/**
 * Binds `token` to the real implementation, or to the mock one in MOCK_MODE.
 * @param token Injection token the consumers depend on.
 * @param realClass Database/API-backed implementation.
 * @param mockClass Seeded in-memory implementation.
 */
export function provideMockSwappable<T>(
  token: string | symbol,
  realClass: Type<T>,
  mockClass: Type<T>,
): Provider {
  return { provide: token, useClass: isMockMode() ? mockClass : realClass };
}
