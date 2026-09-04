import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  Logger.log(
    `Proceso worker iniciado (pid=${process.pid}).`,
    'WorkerBootstrap',
  );
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack : String(error);
  Logger.error(message, 'WorkerBootstrap');
  process.exitCode = 1;
});
