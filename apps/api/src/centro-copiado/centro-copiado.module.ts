import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MotorUniversalModule } from '../motor-universal/motor.module';
import { CentroCopiadoController } from './centro-copiado.controller';
import { CentroCopiadoService } from './centro-copiado.service';
import { SuscripcionesModule } from '../suscripciones/suscripciones.module';
import { CentroCopiadoSaludService } from './centro-copiado-salud.service';
import { CentroCopiadoAuditoriaService } from './centro-copiado-auditoria.service';
import { CentroCopiadoIdempotenciaService } from './centro-copiado-idempotencia.service';

/**
 * TPV Centro de copiado. Consume el motor universal (via MotorUniversalModule)
 * para cotizar cada documento como un segmento de impresión sobre el producto
 * plantilla SYS-IMPRESION-DOC.
 */
@Module({
  imports: [PrismaModule, MotorUniversalModule, SuscripcionesModule],
  controllers: [CentroCopiadoController],
  providers: [
    CentroCopiadoService,
    CentroCopiadoSaludService,
    CentroCopiadoAuditoriaService,
    CentroCopiadoIdempotenciaService,
  ],
  exports: [
    CentroCopiadoService,
    CentroCopiadoSaludService,
    CentroCopiadoAuditoriaService,
    CentroCopiadoIdempotenciaService,
  ],
})
export class CentroCopiadoModule {}
