import { Module } from '@nestjs/common';
import { ProduccionModule } from '../produccion/produccion.module';
import { EtaService } from './eta.service';

/** Cálculo compartido por HTTP y workers, sin iniciar el scheduler de snapshots. */
@Module({
  imports: [ProduccionModule],
  providers: [EtaService],
  exports: [EtaService],
})
export class EtaCalculoModule {}
