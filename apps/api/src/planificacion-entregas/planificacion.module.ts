import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { PlanificacionCotizacionController } from './planificacion-cotizacion.controller';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlanificacionEntregasService } from './planificacion.service';
import { EtaCalculoModule } from '../eta/eta-calculo.module';
import { OrdenesTrabajoModule } from '../ordenes-trabajo/ordenes-trabajo.module';
import { PlanificacionEntregasController } from './planificacion.controller';
import { PlanificacionEntregasDispatcher } from './planificacion-dispatcher';

@Module({
  imports: [CapacidadesEmpresaModule,PrismaModule, EtaCalculoModule, OrdenesTrabajoModule],
  controllers: [
    PlanificacionEntregasController,
    PlanificacionCotizacionController,
  ],
  providers: [PlanificacionEntregasService, PlanificacionEntregasDispatcher],
})
export class PlanificacionEntregasModule {}
