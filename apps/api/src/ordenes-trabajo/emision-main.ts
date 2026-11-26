import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { textoErrorLog } from '../common/log-seguro';
import { EmisionModule } from './emision.module';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), EmisionModule] })
class EmisionLocalModule {}

void NestFactory.createApplicationContext(EmisionLocalModule)
  .then((app) => app.enableShutdownHooks())
  .catch((error: unknown) => {
    Logger.error(textoErrorLog(error), 'EmisionWorker');
    process.exitCode = 1;
  });
