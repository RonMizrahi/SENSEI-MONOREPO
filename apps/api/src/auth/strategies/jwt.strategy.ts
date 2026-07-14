import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import type { Env } from '../../config/env.schema';
import { JWT_ISSUER } from '../auth.constants';
import { JwtPayload } from '../jwt-payload.interface';
import { USER_REPOSITORY } from '../user.repository';
import type { UserRepository } from '../user.repository';

/**
 * Validates Bearer JWTs and shapes req.user for guards and @CurrentUser().
 * Rejects tokens whose user is gone or whose token_version was bumped
 * (logout / password change) — in both real and mock modes via the repository.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<Env, true>,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
      // confine verification to our own issuer + algorithm (no cross-service tokens)
      issuer: JWT_ISSUER,
      algorithms: ['HS256'],
    });
  }

  /**
   * Loads the token's user and maps it onto the request principal.
   * @throws UnauthorizedException when the user is missing or the token was revoked.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.token_version) {
      throw new UnauthorizedException();
    }
    return {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }
}
