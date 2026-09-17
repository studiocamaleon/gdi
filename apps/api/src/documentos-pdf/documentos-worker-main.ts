import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentosWorkerModule } from './documentos-worker.module';
import { DocumentosPdfWorker } from './documentos-pdf.worker';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(
    DocumentosWorkerModule,
  );
  // Drena trabajos ANTES de que Nest cierre Prisma y el semáforo Redis.
  let cerrando = false;
  const cerrar = async () => {
    if (cerrando) return;
    cerrando = true;
    await app.get(DocumentosPdfWorker).onApplicationShutdown();
    await app.close();
  };
  process.once('SIGTERM', () => void cerrar());
  process.once('SIGINT', () => void cerrar());
  Logger.log(
    `Worker de documentos iniciado (pid=${process.pid}).`,
    'PdfBootstrap',
  );
}
void bootstrap().catch((error: unknown) => {
  Logger.error(
    error instanceof Error ? error.stack : String(error),
    'PdfBootstrap',
  );
  process.exitCode = 1;
});
