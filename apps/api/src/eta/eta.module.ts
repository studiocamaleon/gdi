import { Module } from '@nestjs/common';
import { ProduccionModule } from '../produccion/produccion.module';
import { EtaController } from './eta.controller';
import { EtaSnapshotScheduler } from './eta-snapshot.scheduler';
import { EtaService } from './eta.service';

@Module({
  imports: [ProduccionModule],
  controllers: [EtaController],
  providers: [EtaService, EtaSnapshotScheduler],
  // OrdenesTrabajo captura la promesa al emitir y el cierre al finalizar.
  exports: [EtaService],
})
export class EtaModule {}
