import { Module } from '@nestjs/common';
import { OrdenesTrabajoController } from './ordenes-trabajo.controller';
import { OrdenesTrabajoService } from './ordenes-trabajo.service';

@Module({
  controllers: [OrdenesTrabajoController],
  providers: [OrdenesTrabajoService],
  // Presupuestos convierte en OT reusando el create canónico.
  exports: [OrdenesTrabajoService],
})
export class OrdenesTrabajoModule {}
