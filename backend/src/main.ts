import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<Env>);
  const apiPrefix = configService.get('API_PREFIX', { infer: true }) ?? 'api';
  const port = configService.get('PORT', { infer: true }) ?? 3000;

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'https://phanesugc.com',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.setGlobalPrefix(apiPrefix);

  await app.listen(port);
}
void bootstrap();
