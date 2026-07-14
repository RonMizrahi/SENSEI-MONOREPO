import { Transform } from 'class-transformer';

/**
 * Trims surrounding whitespace from an incoming string body field before
 * validation (the global TrimPipe only reaches string-typed route/query params).
 */
export function TrimmedString(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}
