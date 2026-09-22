import { Module } from '@nestjs/common';
import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { InventarioModule } from './inventario.module';
import { ReservasMaterialService } from './reservas-material.service';
import { ReservasMaterialController } from './reservas-material.controller';
@Module({
  imports: [InventarioModule, CapacidadesEmpresaModule],
  controllers: [ReservasMaterialController],
  providers: [ReservasMaterialService],
  exports: [ReservasMaterialService],
})
export class ReservasMaterialModule {}
