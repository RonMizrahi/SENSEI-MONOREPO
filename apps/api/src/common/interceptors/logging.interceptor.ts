import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { finalize, Observable } from 'rxjs';

/** Logs per-handler latency with the resolved controller/handler names. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@InjectPinoLogger(LoggingInterceptor.name) private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const { method, url } = context.switchToHttp().getRequest<Request>();
    const handler = `${context.getClass().name}.${context.getHandler().name}`;

    return next.handle().pipe(
      // finalize (not tap) so failing requests get timed too
      finalize(() =>
        this.logger.info({ method, url, handler, durationMs: Date.now() - start }, 'Handler timed'),
      ),
    );
  }
}
