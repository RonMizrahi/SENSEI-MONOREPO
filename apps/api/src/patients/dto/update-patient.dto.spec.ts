import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePatientDto } from './update-patient.dto';

async function validationErrors(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(UpdatePatientDto, body);
  const errors = await validate(dto, { whitelist: true });
  return errors.map((error) => error.property);
}

describe('UpdatePatientDto validation', () => {
  it('accepts each single-field update', async () => {
    await expect(validationErrors({ name: 'יוסי מזרחי' })).resolves.toEqual([]);
    await expect(validationErrors({ phone: '052-7654321' })).resolves.toEqual([]);
    await expect(validationErrors({ email: 'yossi.m@mail.com' })).resolves.toEqual([]);
    await expect(validationErrors({ archived: true })).resolves.toEqual([]);
  });

  it('accepts an explicit null email (clears it)', async () => {
    await expect(validationErrors({ email: null })).resolves.toEqual([]);
  });

  it('passes DTO validation on an empty body — the service owns the at-least-one rule', async () => {
    await expect(validationErrors({})).resolves.toEqual([]);
  });

  it.each([
    ['empty name', { name: '' }, 'name'],
    ['whitespace-only name', { name: '   ' }, 'name'],
    ['name over 255 chars', { name: 'א'.repeat(256) }, 'name'],
    ['null name (not nullable)', { name: null }, 'name'],
    ['phone under 3 chars', { phone: '05' }, 'phone'],
    ['phone over 32 chars', { phone: '0'.repeat(33) }, 'phone'],
    ['null phone (not nullable)', { phone: null }, 'phone'],
    ['invalid email', { email: 'not-an-email' }, 'email'],
    ['non-boolean archived', { archived: 'yes' }, 'archived'],
    ['null archived (not nullable)', { archived: null }, 'archived'],
  ])('rejects %s', async (_label, body, property) => {
    await expect(validationErrors(body)).resolves.toContain(property);
  });

  it('trims surrounding whitespace from name and phone', async () => {
    const dto = plainToInstance(UpdatePatientDto, { name: '  דנה לוי  ', phone: ' 054-1234567 ' });
    await expect(validate(dto, { whitelist: true })).resolves.toEqual([]);
    expect(dto.name).toBe('דנה לוי');
    expect(dto.phone).toBe('054-1234567');
  });
});
