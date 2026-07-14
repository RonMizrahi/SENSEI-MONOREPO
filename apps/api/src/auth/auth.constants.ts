import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';

/** Issuer claim minted into and REQUIRED from every access token. */
export const JWT_ISSUER = 'sensei-api';

/** The only auth mechanism today. */
export const AUTH_TYPE_PASSWORD = 'password';

/** The only role today. */
export const ROLE_THERAPIST = 'therapist';

/** RFC 6750 token type reported by /auth/token. */
export const TOKEN_TYPE_BEARER = 'bearer';

/** Password length bounds (senseiAPI UserCreate/PasswordChange parity). */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 1024;

/** current_password only needs to be non-empty — the account may predate the minimum. */
export const CURRENT_PASSWORD_MIN_LENGTH = 1;

/** Display-name column width (users.full_name varchar(255)). */
export const FULL_NAME_MAX_LENGTH = 255;

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
