import { Module } from '@nestjs/common';

import { ArchivosModule } from '../archivos/archivos.module';
import { DatosEmpresaModule } from '../tenants/datos-empresa.module';
import { EgresosController } from './egresos.controller';
import { EgresosService } from './egresos.service';
import { OrdenPagoPdfService } from './orden-pago-pdf.service';

@Module({
  imports: [ArchivosModule, DatosEmpresaModule],
  controllers: [EgresosController],
  providers: [EgresosService, OrdenPagoPdfService],
  exports: [EgresosService],
})
export class EgresosModule {}
