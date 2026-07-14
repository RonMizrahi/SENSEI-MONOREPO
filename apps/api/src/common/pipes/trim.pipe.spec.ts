import { ArgumentMetadata } from '@nestjs/common';
import { TrimPipe } from './trim.pipe';

describe('TrimPipe', () => {
  const pipe = new TrimPipe();
  const metadata: ArgumentMetadata = { type: 'param' };

  it('trims surrounding whitespace (happy path)', () => {
    expect(pipe.transform('  hello  ', metadata)).toBe('hello');
  });

  it('passes non-string values through untouched', () => {
    const value = 42 as unknown as string;
    expect(pipe.transform(value, metadata)).toBe(value);
  });
});
