import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  it('wraps the handler result in a data envelope (happy path)', async () => {
    const interceptor = new TransformInterceptor<string>();
    const payload = crypto.randomUUID();
    const next: CallHandler<string> = { handle: () => of(payload) };

    const result = await firstValueFrom(interceptor.intercept({} as ExecutionContext, next));

    expect(result).toEqual({ data: payload });
  });
});
