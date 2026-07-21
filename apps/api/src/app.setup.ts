import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { Env } from './config/env.schema';

/**
 * Applies the HTTP hardening shared by main.ts and integration tests.
 * Routes are intentionally UNVERSIONED — the SPA's paths are the contract.
 * @param app The created Nest application.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.use(helmet());
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  const allowAllOrigins = corsOrigins === '*';
  app.enableCors({
    origin: allowAllOrigins ? true : corsOrigins.split(',').map((origin) => origin.trim()),
    // credentials + reflected wildcard origin is unsafe — only allow with an explicit allowlist
    credentials: !allowAllOrigins,
    // The assistant streams an AI-SDK "UI Message Stream"; the browser transport
    // (@ai-sdk/react useChat) only accepts the stream when it can read this header.
    exposedHeaders: ['x-vercel-ai-ui-message-stream'],
  });
  app.enableShutdownHooks();
}

/** Builds the OpenAPI document from the app's controller metadata (no listen needed). */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const openApiConfig = new DocumentBuilder()
    .setTitle('Sensei API')
    .setDescription('AI-assisted therapist practice management API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, openApiConfig);
}

/** Mounts Swagger UI at /docs (+ /docs/json) when SWAGGER_ENABLED. */
export function setupSwagger(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  if (!config.get('SWAGGER_ENABLED', { infer: true })) return;

  const document = buildOpenApiDocument(app);
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs/json' });
}
