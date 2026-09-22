import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MotorUniversalController } from './motor.controller';
import { MotorUniversalService } from './motor.service';
import { PrecioModule } from '../productos-servicios/precio/precio.module';
import { GeometriaVectorialCacheService } from './geometria-vectorial/geometria-vectorial-cache.service';
import { RecorridosVectorialesModule } from '../recorridos-vectoriales/recorridos-vectoriales.module';
import { ProductosServiciosModule } from '../productos-servicios/productos-servicios.module';
import { GeometriaJobsModule } from '../workers/geometria/geometria-jobs.module';
import { AnalisisVectorialAsyncService } from './geometria-vectorial/analisis-vectorial-async.service';
import { CotizacionJobsModule } from '../workers/cotizacion/cotizacion-jobs.module';
import { CotizacionesModule } from '../cotizaciones/cotizaciones.module';

/**
 * MotorUniversalModule importa PrecioModule para que MotorUniversalService pueda
 * inyectar AplicarPrecioService + PreciosEspecialesClientesService al persistir
 * un CotizacionItem (Sprint 5.a — snapshots inmutables del Tab Precio).
 */
@Module({
  imports: [
    CapacidadesEmpresaModule,
    PrismaModule,
    PrecioModule,
    RecorridosVectorialesModule,
    ProductosServiciosModule,
    GeometriaJobsModule,
    CotizacionJobsModule,
    CotizacionesModule,
  ],
  controllers: [MotorUniversalController],
  providers: [
    MotorUniversalService,
    GeometriaVectorialCacheService,
    AnalisisVectorialAsyncService,
  ],
  exports: [MotorUniversalService],
})
export class MotorUniversalModule {}
