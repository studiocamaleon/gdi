import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EtaCalculoModule } from '../eta/eta-calculo.module';
import { PlanificacionEntregasService } from './planificacion.service';

@Module({
  imports: [PrismaModule, EtaCalculoModule],
  providers: [PlanificacionEntregasService],
  exports: [PlanificacionEntregasService],
})
export class PlanificacionEntregasCoreModule {}
