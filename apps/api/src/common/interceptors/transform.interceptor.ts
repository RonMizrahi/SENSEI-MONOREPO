import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

/** Uniform response envelope. */
export interface Enveloped<T> {
  data: T;
}

/**
 * Opt-in `{ data }` envelope — apply per controller with `@UseInterceptors(TransformInterceptor)`
 * (kept off the global chain so infra endpoints like health/metrics keep their raw shape).
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Enveloped<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<Enveloped<T>> {
    return next.handle().pipe(map((data) => ({ data })));
  }
}
