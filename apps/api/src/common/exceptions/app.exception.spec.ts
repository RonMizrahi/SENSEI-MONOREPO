import { HttpStatus } from '@nestjs/common';
import {
  AppException,
  DuplicateResourceException,
  ResourceNotFoundException,
} from './app.exception';

describe('AppException', () => {
  it('carries code, message, and status (happy path)', () => {
    const exception = new AppException('LIMIT_REACHED', 'Too many things', HttpStatus.CONFLICT);

    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(exception.getResponse()).toEqual({
      code: 'LIMIT_REACHED',
      message: 'Too many things',
      details: undefined,
    });
  });

  it('includes structured details when provided', () => {
    const exception = new AppException('BAD_STATE', 'Nope', HttpStatus.BAD_REQUEST, { field: 'x' });

    expect(exception.getResponse()).toMatchObject({ details: { field: 'x' } });
  });
});

describe('DuplicateResourceException', () => {
  it('maps to 409 with a RESOURCE_ALREADY_EXISTS code', () => {
    const exception = new DuplicateResourceException('User', 'email');

    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(exception.getResponse()).toMatchObject({
      code: 'RESOURCE_ALREADY_EXISTS',
      message: 'User with this email already exists',
    });
  });
});

describe('ResourceNotFoundException', () => {
  it('maps to 404 with a RESOURCE_NOT_FOUND code', () => {
    const id = crypto.randomUUID();
    const exception = new ResourceNotFoundException('User', id);

    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(exception.getResponse()).toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      message: `User ${id} not found`,
    });
  });
});
