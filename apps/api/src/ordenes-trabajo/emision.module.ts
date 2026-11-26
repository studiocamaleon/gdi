import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RecorridosVectorialesModule } from '../recorridos-vectoriales/recorridos-vectoriales.module';
import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { EtaCalculoModule } from '../eta/eta-calculo.module';
import { PrevisionMaterialesService } from '../inventario/prevision-materiales.service';
import { EventosSistemaModule } from '../eventos-sistema/eventos-sistema.module';
import { IntegracionesModule } from '../integraciones/integraciones.module';
import { EmisionWorker } from './emision.worker';

@Module({
  imports: [
    PrismaModule,
    CapacidadesEmpresaModule,
    RecorridosVectorialesModule,
    EtaCalculoModule,
    EventosSistemaModule,
    IntegracionesModule,
  ],
  providers: [EmisionWorker, PrevisionMaterialesService],
})
export class EmisionModule {}
