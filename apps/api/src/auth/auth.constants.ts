import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';

/** Issuer claim minted into and REQUIRED from every access token. */
export const JWT_ISSUER = 'sensei-api';

/** The only auth mechanism today. */
export const AUTH_TYPE_PASSWORD = 'password';

/** The only role today. */
export const ROLE_THERAPIST = 'therapist';

/**
 * Principal injected on protected routes in MOCK_MODE when no Bearer token is
 * sent — mirrors senseiAPI's ENABLE_SECURITY=false TEST_USER behavior so every
 * module can be exercised end-to-end before/without the auth flow.
 */
export const TEST_USER: AuthenticatedUser = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 'rotem@clinic.co.il',
  fullName: 'ד״ר רותם שגב',
  role: ROLE_THERAPIST,
};
