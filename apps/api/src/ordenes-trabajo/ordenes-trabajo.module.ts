import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { AsignacionPersonalController } from './asignacion-personal.controller';
import { AsignacionPersonalService } from './asignacion-personal.service';
import { ReservasMaterialModule } from '../inventario/reservas-material.module';
import { InventarioModule } from '../inventario/inventario.module';
import { Module } from '@nestjs/common';
import { ArchivosModule } from '../archivos/archivos.module';
import { AdministracionModule } from '../administracion/administracion.module';
import { EtaModule } from '../eta/eta.module';
import { EnlacesPublicosModule } from '../enlaces-publicos/enlaces-publicos.module';
import { DatosEmpresaModule } from '../tenants/datos-empresa.module';
import { OrdenesTrabajoController } from './ordenes-trabajo.controller';
import { AccionesColaController } from './acciones-cola.controller';
import { OrdenesTrabajoService } from './ordenes-trabajo.service';
import { EntregaService } from './entrega.service';
import { MaterialesOrdenService } from './materiales-orden.service';
import { RecorridosVectorialesModule } from '../recorridos-vectoriales/recorridos-vectoriales.module';
import { DesarrolloDocumentalModule } from '../desarrollo-documental/desarrollo-documental.module';

@Module({
  imports: [CapacidadesEmpresaModule,
    InventarioModule,
    ReservasMaterialModule,
    // "Acreditar y cancelar" en un paso necesita emitir la NC. Dependencia de
    // ida: Administración no importa este módulo.
    AdministracionModule,
    EtaModule,
    ArchivosModule,
    EnlacesPublicosModule,
    DatosEmpresaModule,
    RecorridosVectorialesModule,
    DesarrolloDocumentalModule,
  ],
  controllers: [AsignacionPersonalController, OrdenesTrabajoController, AccionesColaController],
  providers: [
    OrdenesTrabajoService,
    EntregaService,
    AsignacionPersonalService,
    MaterialesOrdenService,
  ],
  // Presupuestos convierte en OT reusando el create canónico.
  exports: [OrdenesTrabajoService],
})
export class OrdenesTrabajoModule {}
