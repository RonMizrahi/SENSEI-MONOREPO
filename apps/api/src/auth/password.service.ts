import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** OWASP-recommended minimum memory cost for argon2id (KiB). */
const ARGON2_MEMORY_KIB = 19_456;

/** Hashes and verifies passwords with argon2id (OWASP parameters). */
@Injectable()
export class PasswordService {
  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: ARGON2_MEMORY_KIB,
    timeCost: 2,
    parallelism: 1,
  };

  /**
   * Hashes a plaintext password.
   * @param plain The plaintext password.
   * @returns The encoded argon2id hash.
   */
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  /**
   * Verifies a plaintext password against a stored hash (constant-time).
   * @returns true when the password matches.
   */
  verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}
