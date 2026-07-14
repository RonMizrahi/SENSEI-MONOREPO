import { CallHandler, ExecutionContext } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import { firstValueFrom, of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  const logInfo = jest.fn();
  const logger = { info: logInfo } as unknown as PinoLogger;
  const interceptor = new LoggingInterceptor(logger);
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ method: 'GET', url: '/v1/things' }) }),
    getClass: () => ({ name: 'ThingsController' }),
    getHandler: () => ({ name: 'findAll' }),
  } as unknown as ExecutionContext;
  const expectedMeta = {
    method: 'GET',
    url: '/v1/things',
    handler: 'ThingsController.findAll',
    durationMs: expect.any(Number) as number,
  };

  beforeEach(() => jest.clearAllMocks());

  it('logs method, url, handler, and latency after completion (happy path)', async () => {
    const next: CallHandler = { handle: () => of('ok') };

    await firstValueFrom(interceptor.intercept(context, next));

    expect(logInfo).toHaveBeenCalledWith(expectedMeta, 'Handler timed');
  });

  it('still logs latency when the handler throws', async () => {
    const next: CallHandler = { handle: () => throwError(() => new Error('boom')) };

    await expect(firstValueFrom(interceptor.intercept(context, next))).rejects.toThrow('boom');
    expect(logInfo).toHaveBeenCalledWith(expectedMeta, 'Handler timed');
  });
});
