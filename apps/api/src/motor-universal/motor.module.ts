import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MotorUniversalController } from './motor.controller';
import { MotorUniversalService } from './motor.service';
import { PrecioModule } from '../productos-servicios/precio/precio.module';
import { GeometriaVectorialCacheService } from './geometria-vectorial/geometria-vectorial-cache.service';
import { RecorridosVectorialesModule } from '../recorridos-vectoriales/recorridos-vectoriales.module';

/**
 * MotorUniversalModule importa PrecioModule para que MotorUniversalService pueda
 * inyectar AplicarPrecioService + PreciosEspecialesClientesService al persistir
 * un CotizacionItem (Sprint 5.a — snapshots inmutables del Tab Precio).
 */
@Module({
  imports: [PrismaModule, PrecioModule, RecorridosVectorialesModule],
  controllers: [MotorUniversalController],
  providers: [MotorUniversalService, GeometriaVectorialCacheService],
  exports: [MotorUniversalService],
})
export class MotorUniversalModule {}
