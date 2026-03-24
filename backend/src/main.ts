import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<Env>);
  const apiPrefix = configService.get('API_PREFIX', { infer: true }) ?? 'api';
  const port = configService.get('PORT', { infer: true }) ?? 3000;

  app.setGlobalPrefix(apiPrefix);

  await app.listen(port);
}
bootstrap();
