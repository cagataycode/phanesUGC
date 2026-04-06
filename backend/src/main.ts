import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { Env } from './config/env';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<Env>);
  const apiPrefix = configService.get('API_PREFIX', { infer: true }) ?? 'api';
  const port = configService.get('PORT', { infer: true }) ?? 3000;

  app.useGlobalFilters(new AllExceptionsFilter());

  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error on unknown properties
      transform: true, // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: false, // Explicit type conversion only
      },
    }),
  );

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'https://phanesugc.com',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Business-Id',
      'x-business-id',
    ],
    credentials: true,
  });

  app.setGlobalPrefix(apiPrefix);

  await app.listen(port);
}
void bootstrap();
