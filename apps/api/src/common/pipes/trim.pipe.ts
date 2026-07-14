import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

/** Trims surrounding whitespace from a string route/query parameter. */
@Injectable()
export class TrimPipe implements PipeTransform<string, string> {
  transform(value: string, _metadata: ArgumentMetadata): string {
    return typeof value === 'string' ? value.trim() : value;
  }
}
