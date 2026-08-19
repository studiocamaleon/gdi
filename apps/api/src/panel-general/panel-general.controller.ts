import { Controller, Get, Query } from '@nestjs/common';

import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';
import {
  PanelGeneralService,
  type VistaPanelGeneral,
} from './panel-general.service';

@Controller('panel-general')
@Permiso('panel.ver')
export class PanelGeneralController {
  constructor(private readonly panel: PanelGeneralService) {}

  @Get()
  obtener(
    @CurrentSession() auth: CurrentAuth,
    @Query('vista') vista?: VistaPanelGeneral,
  ) {
    return this.panel.obtener(auth, vista);
  }
}
