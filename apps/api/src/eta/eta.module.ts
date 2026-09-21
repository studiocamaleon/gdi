import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { Module } from '@nestjs/common';
import { EtaCalculoModule } from './eta-calculo.module';
import { EtaController } from './eta.controller';
import { EtaSnapshotScheduler } from './eta-snapshot.scheduler';

@Module({
  imports: [CapacidadesEmpresaModule,EtaCalculoModule],
  controllers: [EtaController],
  providers: [EtaSnapshotScheduler],
  // OrdenesTrabajo captura la promesa al emitir y el cierre al finalizar.
  exports: [EtaCalculoModule],
})
export class EtaModule {}
