// Validation matrix for the /auth request DTOs (class-validator breadth).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PasswordChangeRequestDto } from './password-change.dto';
import { RegisterRequestDto } from './register.dto';
import { TokenRequestDto } from './token.dto';

async function violations(dto: object): Promise<string[]> {
  const errors = await validate(dto);
  return errors.map((error) => error.property);
}

describe('RegisterRequestDto', () => {
  const valid = { email: 'a@b.test', password: 'password-123', full_name: 'Test' };

  it('accepts a valid payload', async () => {
    await expect(violations(plainToInstance(RegisterRequestDto, valid))).resolves.toEqual([]);
  });

  it('accepts a missing full_name (optional)', async () => {
    const dto = plainToInstance(RegisterRequestDto, { email: 'a@b.test', password: 'password-123' });
    await expect(violations(dto)).resolves.toEqual([]);
  });

  it.each([
    ['not-an-email', 'email'],
    ['', 'email'],
  ])('rejects invalid email %p', async (email, property) => {
    const dto = plainToInstance(RegisterRequestDto, { ...valid, email });
    await expect(violations(dto)).resolves.toContain(property);
  });

  it('rejects a 7-char password and accepts an 8-char one', async () => {
    const short = plainToInstance(RegisterRequestDto, { ...valid, password: '1234567' });
    const minimum = plainToInstance(RegisterRequestDto, { ...valid, password: '12345678' });
    await expect(violations(short)).resolves.toContain('password');
    await expect(violations(minimum)).resolves.toEqual([]);
  });

  it('rejects a full_name longer than 255 chars', async () => {
    const dto = plainToInstance(RegisterRequestDto, { ...valid, full_name: 'x'.repeat(256) });
    await expect(violations(dto)).resolves.toContain('full_name');
  });
});

describe('TokenRequestDto', () => {
  it('accepts the OAuth2 form fields', async () => {
    const dto = plainToInstance(TokenRequestDto, { username: 'a@b.test', password: 'p' });
    await expect(violations(dto)).resolves.toEqual([]);
  });

  it('accepts a non-email username (401 is decided by the service, not validation)', async () => {
    const dto = plainToInstance(TokenRequestDto, { username: 'not-an-email', password: 'p' });
    await expect(violations(dto)).resolves.toEqual([]);
  });

  it.each([
    [{ password: 'p' }, 'username'],
    [{ username: 'a@b.test' }, 'password'],
    [{ username: '', password: 'p' }, 'username'],
  ])('rejects %p', async (payload, property) => {
    const dto = plainToInstance(TokenRequestDto, payload);
    await expect(violations(dto)).resolves.toContain(property);
  });
});

describe('PasswordChangeRequestDto', () => {
  it('accepts a valid change', async () => {
    const dto = plainToInstance(PasswordChangeRequestDto, {
      current_password: 'x',
      new_password: 'password-123',
    });
    await expect(violations(dto)).resolves.toEqual([]);
  });

  it.each([
    [{ current_password: '', new_password: 'password-123' }, 'current_password'],
    [{ current_password: 'x', new_password: '1234567' }, 'new_password'],
    [{ current_password: 'x' }, 'new_password'],
  ])('rejects %p', async (payload, property) => {
    const dto = plainToInstance(PasswordChangeRequestDto, payload);
    await expect(violations(dto)).resolves.toContain(property);
  });
});
