import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Logging estructurado (pino) con request-id.
  app.useLogger(app.get(Logger));

  app.setGlobalPrefix('api');

  // Cabeceras de seguridad. La API sirve solo JSON, así que los defaults de
  // helmet no interfieren.
  app.use(helmet());
  app.use(compression());

  // Límite de tamaño de body (evita DoS por payloads gigantes).
  const bodyLimit = process.env.BODY_LIMIT ?? '1mb';
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  // CORS: sin fallback permisivo. Si falta FRONTEND_URL, no se habilita ningún
  // origen cross-origin (el tráfico del navegador va por el proxy same-origin).
  const origins = process.env.FRONTEND_URL?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (origins && origins.length > 0) {
    app.enableCors({ origin: origins, credentials: true });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
