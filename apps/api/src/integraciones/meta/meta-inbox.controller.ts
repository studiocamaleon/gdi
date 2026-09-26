import {
  Controller,
  Get,
  Header,
  Headers,
  Query,
  Req,
  Sse,
} from '@nestjs/common';
import type { Request } from 'express';
import { ipDeRequest } from '../../auth/ip';
import {
  MetaInboxStreamService,
  vencimientoStream,
} from './meta-inbox-stream.service';
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
  constructor(
    private readonly service: MetaInboxService,
    private readonly tiempoReal: MetaInboxStreamService,
  ) {}

  @Sse('stream')
  stream(
    @CurrentSession() auth: CurrentAuth,
    @Req() req: Request,
    @Headers('authorization') authorization = '',
  ) {
    return this.tiempoReal.abrir(
      auth,
      ipDeRequest(req),
      vencimientoStream(authorization),
    );
  }

  @Get('disponibilidad')
  @Header('Cache-Control', 'no-store')
  disponibilidad(@CurrentSession() auth: CurrentAuth, @Req() req: Request) {
    return this.service.disponibilidad(auth, ipDeRequest(req));
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  consultar(
    @CurrentSession() auth: CurrentAuth,
    @Query() query: MetaInboxQueryDto,
    @Req() req: Request,
  ) {
    return this.service.consultar(auth, query, ipDeRequest(req));
  }
}
