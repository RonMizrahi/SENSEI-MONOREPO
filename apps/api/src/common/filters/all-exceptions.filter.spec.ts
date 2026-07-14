import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { PinoLogger } from 'nestjs-pino';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  const correlationId = crypto.randomUUID();
  let capturedBody: unknown;
  const reply = jest.fn((_res: unknown, body: unknown, _status: number): void => {
    capturedBody = body;
  });
  const adapterHost = { httpAdapter: { reply } } as unknown as HttpAdapterHost;
  const logError = jest.fn();
  const logger = { error: logError } as unknown as PinoLogger;
  const filter = new AllExceptionsFilter(logger, adapterHost);

  const response = {};
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: 'GET', url: '/v1/boom', id: correlationId }),
    }),
  } as unknown as ArgumentsHost;

  beforeEach(() => jest.clearAllMocks());

  it('maps an unknown error to a clean 500 without leaking internals', () => {
    const boom = new Error('secret internal detail');
    filter.catch(boom, host);

    expect(reply).toHaveBeenCalledWith(
      response,
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        path: '/v1/boom',
        correlationId,
      }),
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(JSON.stringify(capturedBody)).not.toContain('secret internal detail');
    // structured, metadata-first: the raw error goes to the log, never the response
    expect(logError).toHaveBeenCalledWith(
      { err: boom, method: 'GET', url: '/v1/boom' },
      'Unhandled exception',
    );
  });

  it('rethrows on non-HTTP contexts (Kafka events) instead of replying', () => {
    const rpcHost = { getType: () => 'rpc' } as unknown as ArgumentsHost;
    const boom = new Error('consumer failure');

    expect(() => filter.catch(boom, rpcHost)).toThrow(boom);
    expect(reply).not.toHaveBeenCalled();
  });
});
