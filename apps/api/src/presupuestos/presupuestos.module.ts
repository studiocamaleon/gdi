import { Module } from '@nestjs/common';
import { ArchivosModule } from '../archivos/archivos.module';
import { EnlacesPublicosModule } from '../enlaces-publicos/enlaces-publicos.module';
import { OrdenesTrabajoModule } from '../ordenes-trabajo/ordenes-trabajo.module';
import { DatosEmpresaModule } from '../tenants/datos-empresa.module';
import { PresupuestosController } from './presupuestos.controller';
import { PresupuestosService } from './presupuestos.service';
import { PresupuestoPdfService } from './presupuesto-pdf.service';

@Module({
  imports: [
    OrdenesTrabajoModule,
    ArchivosModule,
    EnlacesPublicosModule,
    DatosEmpresaModule,
  ],
  controllers: [PresupuestosController],
  providers: [PresupuestosService, PresupuestoPdfService],
})
export class PresupuestosModule {}
