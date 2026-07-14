import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes and verifies a password (happy path)', async () => {
    const plain = `pw-${crypto.randomUUID()}`;

    const hash = await service.hash(plain);

    expect(hash).toContain('$argon2id$');
    await expect(service.verify(hash, plain)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash(`pw-${crypto.randomUUID()}`);

    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });
});
