import { PanelActividadService } from './panel-actividad.service';
import { Controller, Get, Query } from '@nestjs/common';

import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';
import { PanelGeneralService } from './panel-general.service';

@Controller('panel-general')
@Permiso('panel.ver')
export class PanelGeneralController {
  constructor(
    private readonly panel: PanelGeneralService,
    private readonly actividad: PanelActividadService,
  ) {}

  @Get('actividad')
  listarActividad(
    @CurrentSession() auth: CurrentAuth,
    @Query('cursor') cursor?: string,
  ) {
    return this.actividad.listar(auth, cursor);
  }

  @Get()
  obtener(@CurrentSession() auth: CurrentAuth) {
    return this.panel.obtener(auth);
  }
}
