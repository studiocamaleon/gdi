import { Body, Controller, Post } from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';
import { PrevisionMaterialesDto } from './dto/prevision-materiales.dto';
import { PrevisionMaterialesService } from './prevision-materiales.service';
@Controller('inventario/prevision-materiales')
export class PrevisionMaterialesController {
  constructor(private readonly prevision: PrevisionMaterialesService) {}
  @Post()
  @Permiso('comercial.ver')
  consultar(
    @CurrentSession() auth: CurrentAuth,
    @Body() data: PrevisionMaterialesDto,
  ) {
    return this.prevision.consultar(auth.tenantId, data);
  }
}
