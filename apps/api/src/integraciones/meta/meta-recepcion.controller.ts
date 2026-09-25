import { Controller, Get } from '@nestjs/common';
import { RolSistema } from '@prisma/client';
import { Roles } from '../../auth/roles.decorator';
import { Permiso } from '../../auth/permiso.decorator';
import { CurrentSession } from '../../auth/current-auth.decorator';
import type { CurrentAuth } from '../../auth/auth.types';
import { ProhibidoImpersonando } from '../../auth/prohibido-impersonando.decorator';
import { MetaRecepcionService } from './meta-recepcion.service';

@Controller('integraciones/meta/recepcion')
@Roles(RolSistema.ADMINISTRADOR)
@Permiso('configuracion.gestionar')
@ProhibidoImpersonando()
export class MetaRecepcionController {
  constructor(private readonly service: MetaRecepcionService) {}

  @Get()
  listar(@CurrentSession() auth: CurrentAuth) {
    return this.service.listar(auth.tenantId);
  }
}
