/**
 * Claims carried by our access tokens — custom-claim parity with senseiAPI's
 * PyJWT payload (foundation-frozen; the auth worker implements issuance around it).
 * NOTE: unlike the Python tokens, ours also carry `iss: 'sensei-api'` — issue
 * tokens ONLY through the AuthModule's JwtModule (it signs with the issuer the
 * strategy requires); hand-rolled tokens without `iss` will fail verification.
 */
export interface JwtPayload {
  /** Subject — the user id. */
  sub: string;
  email: string;
  full_name: string | null;
  /** Authentication mechanism — 'password'. */
  auth_type: string;
  /** Coarse role — 'therapist'. */
  role: string;
  /** Must match the user row's token_version, else the token is revoked. */
  token_version: number;
  /** Issued-at / expiry (unix seconds) — added by the JWT library. */
  iat?: number;
  exp?: number;
}
