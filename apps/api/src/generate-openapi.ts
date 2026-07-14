import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './app.setup';

/**
 * Emits the OpenAPI JSON consumed by @repo/api-client. Runs in Nest **preview mode**
 * so the module graph is built without instantiating providers — no DB/Redis/Kafka
 * connection is attempted, only the controller metadata Swagger needs.
 */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { preview: true, logger: false });
  // Mirror the runtime URI versioning so generated paths match what's actually served
  // (/v1/users, /v1/auth/*; health stays version-neutral).
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  const document = buildOpenApiDocument(app);
  const outPath = resolve(__dirname, '../../../packages/api-client/openapi.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  console.log(`OpenAPI document written to ${outPath}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
