import { Module } from '@nestjs/common';
import { PasswordService } from './password.service';

/** Single home for password hashing — imported by AuthModule and UsersModule. */
@Module({
  providers: [PasswordService],
  exports: [PasswordService],
})
export class PasswordModule {}
