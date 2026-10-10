import '../workers/instrument';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { cerrarMonitoreo, reportarFallo } from '../common/observabilidad';
import { textoErrorLog } from '../common/log-seguro';
import { FacturacionWorkerModule } from './facturacion-worker.module';

void NestFactory.createApplicationContext(FacturacionWorkerModule)
  .then((app) => {
    app.enableShutdownHooks();
    Logger.log('Worker dedicado de facturación iniciado.', 'FacturacionWorker');
  })
  .catch(async (error) => {
    reportarFallo(error, { area: 'administracion', operacion: 'inicio' });
    await cerrarMonitoreo();
    Logger.error(textoErrorLog(error), 'FacturacionWorker');
    process.exitCode = 1;
  });
