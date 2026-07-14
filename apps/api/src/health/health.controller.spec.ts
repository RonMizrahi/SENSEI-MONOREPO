import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import type { HealthService } from './health.service';

describe('HealthController', () => {
  const makeController = (readiness: HealthService['readiness']): HealthController =>
    new HealthController({ readiness });

  it('root returns the welcome message', () => {
    const controller = makeController(jest.fn());
    expect(controller.root()).toEqual({ message: 'Welcome to SenseiAPI' });
  });

  it('health returns ok', () => {
    const controller = makeController(jest.fn());
    expect(controller.health()).toEqual({ status: 'ok' });
  });

  it('ready passes through a healthy readiness', async () => {
    const readiness = jest.fn(() => Promise.resolve({ status: 'ready', database: 'ok' }));
    const controller = makeController(readiness);
    await expect(controller.ready()).resolves.toEqual({ status: 'ready', database: 'ok' });
  });

  it('ready throws 503 carrying the readiness body when the database is unavailable', async () => {
    const body = { status: 'not_ready', database: 'unavailable' as const };
    const readiness = jest.fn(() => Promise.resolve(body));
    const controller = makeController(readiness);
    const error = await controller.ready().then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    const exception = error as ServiceUnavailableException;
    expect(exception.getStatus()).toBe(503);
    expect(exception.getResponse()).toEqual(body);
  });
});
