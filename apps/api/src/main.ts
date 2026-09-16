import 'reflect-metadata';
import { rateLimit } from 'express-rate-limit';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { readConfig } from './config.js';

async function bootstrap(): Promise<void> {
  const config = readConfig();
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.setGlobalPrefix('api/v1');
  if (config.TRUST_PROXY) app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use('/api/v1/auth', rateLimit({ windowMs: 60000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Trop de tentatives. Réessayez dans une minute.' } }));
  app.enableShutdownHooks();
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('AlarMap API').setVersion('0.1.0-dev.1').addBearerAuth().build());
  SwaggerModule.setup('api/docs', app, document);
  await app.listen(config.API_PORT, '0.0.0.0');
}
bootstrap().catch(() => { console.error('Impossible de démarrer AlarMap. Vérifiez la configuration et le port.'); process.exitCode = 1; });
