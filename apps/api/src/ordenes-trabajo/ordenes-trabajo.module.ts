import { Module } from '@nestjs/common';
import { ArchivosModule } from '../archivos/archivos.module';
import { AdministracionModule } from '../administracion/administracion.module';
import { EtaModule } from '../eta/eta.module';
import { EnlacesPublicosModule } from '../enlaces-publicos/enlaces-publicos.module';
import { DatosEmpresaModule } from '../tenants/datos-empresa.module';
import { OrdenesTrabajoController } from './ordenes-trabajo.controller';
import { OrdenesTrabajoService } from './ordenes-trabajo.service';
import { EntregaService } from './entrega.service';

@Module({
  imports: [
    // "Acreditar y cancelar" en un paso necesita emitir la NC. Dependencia de
    // ida: Administración no importa este módulo.
    AdministracionModule,
    EtaModule,
    ArchivosModule,
    EnlacesPublicosModule,
    DatosEmpresaModule,
  ],
  controllers: [OrdenesTrabajoController],
  providers: [OrdenesTrabajoService, EntregaService],
  // Presupuestos convierte en OT reusando el create canónico.
  exports: [OrdenesTrabajoService],
})
export class OrdenesTrabajoModule {}
