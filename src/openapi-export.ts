/**
 * Standalone script to export OpenAPI (Swagger) JSON for codegen or docs.
 * Run: npx ts-node -r tsconfig-paths/register src/openapi-export.ts
 * Output: openapi.json in project root (or path from OPENAPI_OUTPUT env).
 */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function exportOpenApi() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const config = new DocumentBuilder()
    .setTitle('VSEEDS API')
    .setDescription('Centralized backend API for VSEEDS applications')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  const outputPath =
    process.env['OPENAPI_OUTPUT'] || join(process.cwd(), 'openapi.json');
  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');
  console.log(`OpenAPI spec written to ${outputPath}`);
  await app.close();
}

exportOpenApi().catch((err) => {
  console.error(err);
  process.exit(1);
});
