import { Module } from '@nestjs/common';

import { OrdenesTrabajoModule } from '../ordenes-trabajo/ordenes-trabajo.module';
import { PanelGeneralController } from './panel-general.controller';
import { PanelGeneralService } from './panel-general.service';

@Module({
  imports: [OrdenesTrabajoModule],
  controllers: [PanelGeneralController],
  providers: [PanelGeneralService],
})
export class PanelGeneralModule {}
