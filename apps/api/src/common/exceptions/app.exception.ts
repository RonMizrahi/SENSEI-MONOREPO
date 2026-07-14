import { HttpException, HttpStatus } from '@nestjs/common';

/** Structured, JSON-safe extra context attached to an AppException. */
export type ExceptionDetails = Record<string, string | number | boolean | null>;

/**
 * Base domain exception — carries a machine-readable code alongside the message.
 * Throw subclasses of this instead of assembling HTTP responses in services.
 */
export class AppException extends HttpException {
  constructor(code: string, message: string, status: HttpStatus, details?: ExceptionDetails) {
    super({ code, message, details }, status);
  }
}

/** Thrown when a requested resource does not exist — maps to 404. */
export class ResourceNotFoundException extends AppException {
  constructor(resource: string, id: string) {
    super('RESOURCE_NOT_FOUND', `${resource} ${id} not found`, HttpStatus.NOT_FOUND);
  }
}

/** Thrown on a uniqueness conflict (e.g. duplicate email) — maps to 409. */
export class DuplicateResourceException extends AppException {
  constructor(resource: string, field: string) {
    super(
      'RESOURCE_ALREADY_EXISTS',
      `${resource} with this ${field} already exists`,
      HttpStatus.CONFLICT,
    );
  }
}
