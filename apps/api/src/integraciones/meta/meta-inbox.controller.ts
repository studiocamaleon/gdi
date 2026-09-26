import { MetaEnviosService } from './inbox/meta-envios.service';
import {
  CatalogoPlantillasInboxDto,
  EnviarPlantillaInboxDto,
  EnviarTextoInboxDto,
} from './inbox/meta-envios.dto';
import { MetaAdjuntosService } from './inbox/meta-adjuntos.service';
import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  Header,
  Headers,
  Query,
  Param,
  ParseUUIDPipe,
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
    private readonly adjuntos: MetaAdjuntosService,
    private readonly envios: MetaEnviosService,
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

  @Get('mensajes/:id/adjunto')
  @Header('Cache-Control', 'private, no-store')
  abrirAdjunto(
    @CurrentSession() auth: CurrentAuth,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adjuntos.abrir(auth, ipDeRequest(req), id);
  }

  @Post('conversaciones/:id/texto')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  enviarTexto(
    @CurrentSession() auth: CurrentAuth,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnviarTextoInboxDto,
  ) {
    return this.envios.enviar(auth, ipDeRequest(req), id, dto);
  }

  @Get('plantillas')
  @Header('Cache-Control', 'private, no-store')
  plantillas(
    @CurrentSession() auth: CurrentAuth,
    @Req() req: Request,
    @Query() dto: CatalogoPlantillasInboxDto,
  ) {
    return this.envios.catalogo(auth, ipDeRequest(req), dto);
  }
  @Post('conversaciones/:id/plantilla')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  enviarPlantilla(
    @CurrentSession() auth: CurrentAuth,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnviarPlantillaInboxDto,
  ) {
    return this.envios.enviarPlantilla(auth, ipDeRequest(req), id, dto);
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
