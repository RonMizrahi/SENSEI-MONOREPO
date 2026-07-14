import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const correlationId = crypto.randomUUID();
  const reply = jest.fn((_res: unknown, _body: unknown, _status: number): void => undefined);
  const adapterHost = { httpAdapter: { reply } } as unknown as HttpAdapterHost;
  const filter = new HttpExceptionFilter(adapterHost);

  const response = {};
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: '/v1/things', id: correlationId }),
    }),
  } as unknown as ArgumentsHost;

  beforeEach(() => jest.clearAllMocks());

  it('normalizes an HttpException into the standard envelope (happy path)', () => {
    filter.catch(new BadRequestException('bad input'), host);

    expect(reply).toHaveBeenCalledWith(
      response,
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'BAD_REQUEST',
        message: 'bad input',
        path: '/v1/things',
        correlationId,
        timestamp: expect.any(String) as string,
      }),
      HttpStatus.BAD_REQUEST,
    );
  });

  it('rethrows on non-HTTP contexts (Kafka events) instead of replying', () => {
    const rpcHost = { getType: () => 'rpc' } as unknown as ArgumentsHost;
    const boom = new BadRequestException('consumer failure');

    expect(() => filter.catch(boom, rpcHost)).toThrow(boom);
    expect(reply).not.toHaveBeenCalled();
  });
});
