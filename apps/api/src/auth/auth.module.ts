import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isMockMode, provideMockSwappable } from '../common/mock-mode';
import type { Env } from '../config/env.schema';
import { JWT_ISSUER } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { PasswordModule } from './password.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserMockRepository } from './user.mock.repository';
import { USER_REPOSITORY, UserTypeOrmRepository } from './user.repository';
import type { UserRepository } from './user.repository';

/**
 * Authentication — /auth endpoints, JWT verification with token_version
 * revocation, argon2id hashing, and the mode-swapped user repository.
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
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    AuthService,
    provideMockSwappable<UserRepository>(USER_REPOSITORY, UserTypeOrmRepository, UserMockRepository),
  ],
  exports: [JwtModule, PasswordModule],
})
export class AuthModule {}
