// Polyfill WebSocket with 'ws' package for Node.js compatibility
// The Sayna SDK uses WebSocket with headers, which Node.js native WebSocket doesn't support
import WebSocket from 'ws';
(globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket =
  WebSocket;

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger, LogLevel } from '@nestjs/common';
import { AppModule } from './app.module';
import { ValidatedEnv } from './config/env.validation';

/**
 * Determines log levels based on NODE_ENV.
 * Production: Only errors, warnings, and important logs
 * Development: Full logging including debug and verbose
 */
function getLogLevels(): LogLevel[] {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    return ['error', 'warn', 'log'];
  }
  return ['error', 'warn', 'log', 'debug', 'verbose'];
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: getLogLevels(),
  });

  // Enable CORS for the React UI
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
    ],
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true,
  });

  // Enable global validation with class-transformer support
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw on unknown properties
      transform: true, // Auto-transform to DTO class
      transformOptions: {
        enableImplicitConversion: true, // Convert types automatically
        excludeExtraneousValues: true, // Only include @Expose() properties
      },
    }),
  );

  const configService = app.get(ConfigService<ValidatedEnv, true>);
  const port = configService.get('PORT', { infer: true });

  await app.listen(port);

  logger.log(`Application running on port ${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
  logger.log(`Log levels: ${getLogLevels().join(', ')}`);
}
void bootstrap();
