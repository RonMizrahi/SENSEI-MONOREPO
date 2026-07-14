import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import type { Env } from '../../config/env.schema';
import { JWT_ISSUER } from '../auth.constants';
import { JwtPayload } from '../jwt-payload.interface';

/**
 * Validates Bearer JWTs and shapes req.user for guards and @CurrentUser().
 * Foundation skeleton — the auth worker adds the token_version-vs-DB check.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
      // confine verification to our own issuer + algorithm (no cross-service tokens)
      issuer: JWT_ISSUER,
      algorithms: ['HS256'],
    });
  }

  /** Maps verified claims onto the request principal. */
  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      email: payload.email,
      fullName: payload.full_name ?? null,
      role: payload.role,
    };
  }
}
