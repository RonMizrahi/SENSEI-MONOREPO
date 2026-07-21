import { ClassSerializerInterceptor, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { seconds, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AssistantModule } from './assistant/assistant.module';
import { AudioModule } from './audio/audio.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { CalendarModule } from './calendar/calendar.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { HttpThrottlerGuard } from './common/guards/http-throttler.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TrimPipe } from './common/pipes/trim.pipe';
import { validateEnv, type Env } from './config/env.schema';
import { DbModule } from './db/db.module';
import { HealthModule } from './health/health.module';
import { NotesModule } from './notes/notes.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PatientsModule } from './patients/patients.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { SummariesModule } from './summaries/summaries.module';
import { TranscriptionModule } from './transcription/transcription.module';
import { TranscriptsModule } from './transcripts/transcripts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    DbModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: seconds(1), limit: 10 },
        { name: 'long', ttl: seconds(60), limit: 100 },
      ],
    }),
    HealthModule,
    AuthModule,
    PatientsModule,
    CalendarModule,
    AudioModule,
    TranscriptionModule,
    TranscriptsModule,
    SummariesModule,
    ReportsModule,
    NotificationsModule,
    SettingsModule,
    NotesModule,
    AssistantModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          genReqId: (req, res) => {
            const incoming = req.headers['x-request-id'];
            const requestId = typeof incoming === 'string' ? incoming : randomUUID();
            res.setHeader('x-request-id', requestId);
            return requestId;
          },
          customProps: (req) => ({ correlationId: req.id }),
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          transport:
            config.get('NODE_ENV', { infer: true }) === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
  ],
  providers: [
    // trims string route/query params BEFORE validation sees them
    { provide: APP_PIPE, useClass: TrimPipe },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
      }),
    },
    // catch-all first, specific second — Nest picks the last matching filter
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    // guard order: throttle before auth (brute force blocked pre-auth)
    { provide: APP_GUARD, useClass: HttpThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
