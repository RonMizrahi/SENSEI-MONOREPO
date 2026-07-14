import { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { HttpThrottlerGuard } from './http-throttler.guard';

describe('HttpThrottlerGuard', () => {
  const guard = Object.create(HttpThrottlerGuard.prototype) as HttpThrottlerGuard;

  it('passes non-HTTP contexts straight through (Kafka consumers)', async () => {
    const context = { getType: () => 'rpc' } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('delegates HTTP contexts to the stock throttler (happy path)', async () => {
    const context = { getType: () => 'http' } as unknown as ExecutionContext;
    const superSpy = jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(superSpy).toHaveBeenCalledWith(context);
    superSpy.mockRestore();
  });
});
