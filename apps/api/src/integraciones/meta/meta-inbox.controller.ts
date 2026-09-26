import { Controller, Get, Header, Query } from '@nestjs/common';
import { RolSistema } from '@prisma/client';
import type { CurrentAuth } from '../../auth/auth.types';
import { CurrentSession } from '../../auth/current-auth.decorator';
import { Permiso } from '../../auth/permiso.decorator';
import { ProhibidoImpersonando } from '../../auth/prohibido-impersonando.decorator';
import { Roles } from '../../auth/roles.decorator';
import { MetaInboxQueryDto } from './meta-inbox.dto';
import { MetaInboxService } from './meta-inbox.service';

/** Conserva exactamente el acceso del piloto: no habilita todavía operadores. */
@Controller('integraciones/meta/inbox')
@Roles(RolSistema.ADMINISTRADOR)
@Permiso('configuracion.gestionar')
@ProhibidoImpersonando()
export class MetaInboxController {
  constructor(private readonly service: MetaInboxService) {}

  @Get('disponibilidad')
  @Header('Cache-Control', 'no-store')
  disponibilidad(@CurrentSession() auth: CurrentAuth) {
    return this.service.disponibilidad(auth);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  consultar(
    @CurrentSession() auth: CurrentAuth,
    @Query() query: MetaInboxQueryDto,
  ) {
    return this.service.consultar(auth, query);
  }
}
