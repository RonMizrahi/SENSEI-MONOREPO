import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePatientDto } from './create-patient.dto';

async function validationErrors(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(CreatePatientDto, body);
  const errors = await validate(dto, { whitelist: true });
  return errors.map((error) => error.property);
}

describe('CreatePatientDto validation', () => {
  const valid = { name: 'דנה לוי', phone: '054-1234567', email: 'dana.l@mail.com' };

  it('accepts a full valid payload', async () => {
    await expect(validationErrors(valid)).resolves.toEqual([]);
  });

  it('accepts an omitted email', async () => {
    await expect(validationErrors({ name: valid.name, phone: valid.phone })).resolves.toEqual([]);
  });

  it('accepts an explicit null email', async () => {
    await expect(validationErrors({ ...valid, email: null })).resolves.toEqual([]);
  });

  it.each([
    ['missing name', { phone: valid.phone }, 'name'],
    ['empty name', { ...valid, name: '' }, 'name'],
    ['whitespace-only name', { ...valid, name: '   ' }, 'name'],
    ['whitespace-only phone', { ...valid, phone: '    ' }, 'phone'],
    ['null name', { ...valid, name: null }, 'name'],
    ['null phone', { ...valid, phone: null }, 'phone'],
    ['name over 255 chars', { ...valid, name: 'א'.repeat(256) }, 'name'],
    ['missing phone', { name: valid.name }, 'phone'],
    ['phone under 3 chars', { ...valid, phone: '05' }, 'phone'],
    ['phone over 32 chars', { ...valid, phone: '0'.repeat(33) }, 'phone'],
    ['non-string name', { ...valid, name: 42 }, 'name'],
    ['invalid email', { ...valid, email: 'not-an-email' }, 'email'],
  ])('rejects %s', async (_label, body, property) => {
    await expect(validationErrors(body)).resolves.toContain(property);
  });

  it('boundary: 255-char name and 3/32-char phones pass', async () => {
    await expect(validationErrors({ ...valid, name: 'א'.repeat(255) })).resolves.toEqual([]);
    await expect(validationErrors({ ...valid, phone: '050' })).resolves.toEqual([]);
    await expect(validationErrors({ ...valid, phone: '0'.repeat(32) })).resolves.toEqual([]);
  });

  it('trims surrounding whitespace from name and phone before validating', async () => {
    const dto = plainToInstance(CreatePatientDto, { name: '  דנה לוי  ', phone: ' 054-1234567 ' });
    await expect(validate(dto, { whitelist: true })).resolves.toEqual([]);
    expect(dto.name).toBe('דנה לוי');
    expect(dto.phone).toBe('054-1234567');
  });
});
