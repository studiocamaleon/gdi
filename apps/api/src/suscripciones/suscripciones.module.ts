import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CobroModule } from '../cobro/cobro.module';
import { SuscripcionController } from './suscripcion.controller';
import { SuscripcionesService } from './suscripciones.service';

/**
 * Lecturas de plan/suscripción, compartidas entre el tenant plane (feature
 * gates como el de AFIP) y el control plane (la consola).
 */
@Module({
  imports: [PrismaModule, CobroModule],
  controllers: [SuscripcionController],
  providers: [SuscripcionesService],
  exports: [SuscripcionesService],
})
export class SuscripcionesModule {}
