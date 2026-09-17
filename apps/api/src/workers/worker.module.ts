import { PlanificacionEntregasCoreModule } from '../planificacion-entregas/planificacion-core.module';
import { PlanificacionEntregasWorker } from '../planificacion-entregas/planificacion.worker';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GeometriaWorker } from './geometria/geometria.worker';
import { OpenNestService } from './geometria/opennest.service';
import { ControlTrabajosGeometriaService } from './control-trabajos-geometria.service';
import { MotorUniversalModule } from '../motor-universal/motor.module';
import { CotizacionWorker } from './cotizacion/cotizacion.worker';
import { TenantConcurrencyService } from './tenant-concurrency.service';
import { NestingsGuardadosModule } from './geometria/nestings-guardados.service';
import { CotizacionJobsModule } from './cotizacion/cotizacion-jobs.module';
import { CapacidadGeometriaModule } from './geometria/capacidad-geometria.service';

/**
 * Aplicación Nest independiente del API HTTP. No importa AppModule a
 * propósito: así no levanta controllers, guards ni crons del proceso web.
 */
@Module({
  imports: [PlanificacionEntregasCoreModule, ConfigModule.forRoot({ isGlobal: true }), MotorUniversalModule, NestingsGuardadosModule, CotizacionJobsModule, CapacidadGeometriaModule],
  providers: [
    GeometriaWorker,
    OpenNestService,
    ControlTrabajosGeometriaService,
    TenantConcurrencyService,
    CotizacionWorker,
    PlanificacionEntregasWorker,
  ],
})
export class WorkerModule {}
