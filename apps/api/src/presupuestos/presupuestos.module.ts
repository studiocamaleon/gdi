import { Module } from '@nestjs/common';
import { OrdenesTrabajoModule } from '../ordenes-trabajo/ordenes-trabajo.module';
import { PresupuestosController } from './presupuestos.controller';
import { PresupuestosService } from './presupuestos.service';
import { PresupuestoPdfService } from './presupuesto-pdf.service';

@Module({
  imports: [OrdenesTrabajoModule],
  controllers: [PresupuestosController],
  providers: [PresupuestosService, PresupuestoPdfService],
})
export class PresupuestosModule {}
