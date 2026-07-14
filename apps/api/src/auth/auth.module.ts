import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isMockMode } from '../common/mock-mode';
import type { Env } from '../config/env.schema';
import { JWT_ISSUER } from './auth.constants';
import { User } from './entities/user.entity';
import { PasswordModule } from './password.module';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Foundation skeleton — JWT verification + password hashing wiring.
 * The auth worker adds the /auth endpoints, user repository (real + mock),
 * and token_version revocation.
 */
@Module({
  imports: [
    ...(isMockMode() ? [] : [TypeOrmModule.forFeature([User])]),
    PasswordModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', { infer: true }),
          issuer: JWT_ISSUER,
        },
      }),
    }),
  ],
  providers: [JwtStrategy],
  exports: [JwtModule, PasswordModule],
})
export class AuthModule {}
