import { MetaCargasService } from './inbox/meta-cargas.service';
import { MetaEnviosService } from './inbox/meta-envios.service';
import {
  AbrirArchivoPlantillaDto,
  CatalogoPlantillasInboxDto,
  EnviarPlantillaInboxDto,
  EnviarTextoInboxDto,
  IniciarCargaInboxDto,
  EnviarMedioInboxDto,
} from './inbox/meta-envios.dto';
import { MetaAdjuntosService } from './inbox/meta-adjuntos.service';
import {
  Redirect,
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
    private readonly cargas: MetaCargasService,
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

  @Post('conversaciones/:id/cargas')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  iniciarCarga(
    @CurrentSession() auth: CurrentAuth,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IniciarCargaInboxDto,
  ) {
    return this.cargas.iniciar(auth, ipDeRequest(req), id, dto);
  }
  @Post('conversaciones/:id/cargas/:archivoId/cancelar')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  cancelarCarga(
    @CurrentSession() auth: CurrentAuth,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('archivoId', ParseUUIDPipe) archivoId: string,
    @Body() dto: CatalogoPlantillasInboxDto,
  ) {
    return this.cargas.cancelar(
      auth,
      ipDeRequest(req),
      id,
      dto.canalId,
      archivoId,
    );
  }
  @Post('conversaciones/:id/medio')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  enviarMedio(
    @CurrentSession() auth: CurrentAuth,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnviarMedioInboxDto,
  ) {
    return this.envios.enviarMedio(auth, ipDeRequest(req), id, dto);
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
  @Get('conversaciones/:id/archivos-plantilla')
  @Header('Cache-Control', 'private, no-store')
  archivosPlantilla(
    @CurrentSession() auth: CurrentAuth,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: CatalogoPlantillasInboxDto,
  ) {
    return this.envios.archivosPlantilla(auth, ipDeRequest(req), id, dto);
  }
  @Get('conversaciones/:id/archivos-plantilla/:archivoId')
  @Header('Cache-Control', 'private, no-store')
  @Redirect()
  abrirArchivoPlantilla(
    @CurrentSession() auth: CurrentAuth,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('archivoId', ParseUUIDPipe) archivoId: string,
    @Query() dto: AbrirArchivoPlantillaDto,
  ) {
    return this.envios.abrirArchivoPlantilla(
      auth,
      ipDeRequest(req),
      id,
      archivoId,
      dto,
    );
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
