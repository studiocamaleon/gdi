import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GeometriaWorker } from './geometria/geometria.worker';
import { OpenNestService } from './geometria/opennest.service';
import { ControlTrabajosGeometriaService } from './control-trabajos-geometria.service';
import { MotorUniversalModule } from '../motor-universal/motor.module';
import { CotizacionWorker } from './cotizacion/cotizacion.worker';
import { TenantConcurrencyService } from './tenant-concurrency.service';

/**
 * Aplicación Nest independiente del API HTTP. No importa AppModule a
 * propósito: así no levanta controllers, guards ni crons del proceso web.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MotorUniversalModule],
  providers: [
    GeometriaWorker,
    OpenNestService,
    ControlTrabajosGeometriaService,
    TenantConcurrencyService,
    CotizacionWorker,
  ],
})
export class WorkerModule {}
