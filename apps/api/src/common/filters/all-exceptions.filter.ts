import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Request } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

/**
 * Catch-all safety net: any non-HttpException becomes a clean 500 without
 * leaking internals, and is logged with its stack for diagnosis.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(AllExceptionsFilter.name) private readonly logger: PinoLogger,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // HTTP-only envelope — RPC/event errors rethrow to Nest's transport handler
    if (host.getType() !== 'http') throw exception;

    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const status = HttpStatus.INTERNAL_SERVER_ERROR;

    this.logger.error(
      { err: exception, method: request.method, url: request.url },
      'Unhandled exception',
    );

    httpAdapter.reply(
      ctx.getResponse(),
      {
        statusCode: status,
        error: HttpStatus[status],
        message: 'Internal server error',
        path: request.url,
        timestamp: new Date().toISOString(),
        correlationId: request.id,
      },
      status,
    );
  }
}
