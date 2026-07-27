import { Module } from '@nestjs/common';

import { ArchivosModule } from '../archivos/archivos.module';
import { DatosEmpresaModule } from '../tenants/datos-empresa.module';
import { EgresosController } from './egresos.controller';
import { EgresosService } from './egresos.service';
import { OrdenPagoPdfService } from './orden-pago-pdf.service';
import { RecurrentesService } from './recurrentes.service';
import { RecurrentesScheduler } from './recurrentes.scheduler';

@Module({
  imports: [ArchivosModule, DatosEmpresaModule],
  controllers: [EgresosController],
  providers: [
    EgresosService,
    OrdenPagoPdfService,
    RecurrentesService,
    RecurrentesScheduler,
  ],
  exports: [EgresosService, RecurrentesService],
})
export class EgresosModule {}
