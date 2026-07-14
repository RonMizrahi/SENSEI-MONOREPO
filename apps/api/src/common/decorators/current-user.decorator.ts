import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** The authenticated principal attached to the request by the JWT strategy. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  fullName: string | null;
  /** Coarse role from the verified token — 'therapist'. */
  role: string;
}

/** Injects the authenticated user (`req.user`) into a handler parameter. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser =>
    ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user,
);
