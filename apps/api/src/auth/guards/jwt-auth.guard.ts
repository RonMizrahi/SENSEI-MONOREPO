import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { isMockMode } from '../../common/mock-mode';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { TEST_USER } from '../auth.constants';

interface RequestWithAuth {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
}

/**
 * Global secure-by-default guard — every route requires a JWT unless @Public().
 * In MOCK_MODE, requests without a Bearer token get the seeded TEST_USER
 * (senseiAPI ENABLE_SECURITY=false parity); tokens, when sent, still validate.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (isMockMode() && !request.headers.authorization) {
      request.user = TEST_USER;
      return true;
    }
    return super.canActivate(context);
  }
}
