import { PanelAdminService } from './panel-admin.service';
import { PanelActividadService } from './panel-actividad.service';
import { Module } from '@nestjs/common';

import { OrdenesTrabajoModule } from '../ordenes-trabajo/ordenes-trabajo.module';
import { PanelGeneralController } from './panel-general.controller';
import { PanelGeneralService } from './panel-general.service';

@Module({
  imports: [OrdenesTrabajoModule],
  controllers: [PanelGeneralController],
  providers: [PanelGeneralService, PanelAdminService, PanelActividadService],
})
export class PanelGeneralModule {}
