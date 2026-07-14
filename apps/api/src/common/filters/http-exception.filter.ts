import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Request } from 'express';

/**
 * Normalizes every thrown HttpException (4xx/5xx) into one predictable envelope:
 * statusCode, error, message/code/details, path, timestamp, correlationId.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: HttpException, host: ArgumentsHost): void {
    // HTTP-only envelope — RPC/event errors rethrow to Nest's transport handler
    if (host.getType() !== 'http') throw exception;

    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const raw = exception.getResponse();
    const payload = typeof raw === 'string' ? { message: raw } : raw;

    httpAdapter.reply(
      ctx.getResponse(),
      {
        statusCode: status,
        ...payload,
        // canonical machine-readable code wins over Nest's human-readable `error` field
        error: HttpStatus[status],
        path: request.url,
        timestamp: new Date().toISOString(),
        correlationId: request.id,
      },
      status,
    );
  }
}
