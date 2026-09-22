import { PanelAdminService } from './panel-admin.service';
import { PanelActividadService } from './panel-actividad.service';
import { Module } from '@nestjs/common';

import { OrdenesTrabajoModule } from '../ordenes-trabajo/ordenes-trabajo.module';
import { PanelGeneralController } from './panel-general.controller';
import { PanelGeneralService } from './panel-general.service';
import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';

@Module({
  imports: [OrdenesTrabajoModule, CapacidadesEmpresaModule],
  controllers: [PanelGeneralController],
  providers: [PanelGeneralService, PanelAdminService, PanelActividadService],
})
export class PanelGeneralModule {}
