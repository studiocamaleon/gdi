import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { textoErrorLog } from '../common/log-seguro';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  Logger.log(
    `Proceso worker iniciado (pid=${process.pid}).`,
    'WorkerBootstrap',
  );
}

void bootstrap().catch((error: unknown) => {
  Logger.error(textoErrorLog(error), 'WorkerBootstrap');
  process.exitCode = 1;
});
