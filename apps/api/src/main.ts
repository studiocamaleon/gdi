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
  //
  // `verify` guarda el body CRUDO sólo en las rutas de webhook: la firma de
  // Paddle es un HMAC sobre el texto exacto que llegó, así que verificarla
  // contra el JSON re-serializado falla (cambia el orden o el espaciado).
  // Se acota por path para no retener un Buffer extra en cada request.
  const bodyLimit = process.env.BODY_LIMIT ?? '1mb';
  app.use(
    json({
      limit: bodyLimit,
      verify: (req: { url?: string; rawBody?: Buffer }, _res, buf: Buffer) => {
        if (req.url?.startsWith('/api/webhooks/')) {
          req.rawBody = buf;
        }
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  // CORS: sin fallback permisivo. Si falta FRONTEND_URL, no se habilita ningún
  // origen cross-origin (el tráfico del navegador va por el proxy same-origin).
  const origins = process.env.FRONTEND_URL?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (origins && origins.length > 0) {
    app.enableCors({
      origin: origins,
      credentials: true,
      // La subida en partes necesita leer el ETag que devuelve cada PUT para
      // poder cerrar el multipart. Sin exponerlo, el navegador lo esconde y
      // el completar falla sin síntoma claro. El bucket de R2 necesita la
      // misma configuración (ExposeHeaders).
      exposedHeaders: ['ETag'],
    });
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
