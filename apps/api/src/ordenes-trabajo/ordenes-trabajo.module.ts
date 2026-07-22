import { Module } from '@nestjs/common';
import { EtaModule } from '../eta/eta.module';
import { OrdenesTrabajoController } from './ordenes-trabajo.controller';
import { OrdenesTrabajoService } from './ordenes-trabajo.service';

@Module({
  imports: [EtaModule],
  controllers: [OrdenesTrabajoController],
  providers: [OrdenesTrabajoService],
  // Presupuestos convierte en OT reusando el create canónico.
  exports: [OrdenesTrabajoService],
})
export class OrdenesTrabajoModule {}
