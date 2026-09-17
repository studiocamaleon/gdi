import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';
import { Public } from '../auth/public.decorator';
import { DesarrolloDocumentalService } from './desarrollo-documental.service';
import {
  CrearArchivoMaestroDto,
  CrearGateDocumentoDto,
  CrearRevisionArchivoDto,
  DecidirAprobacionDocumentoDto,
  DecisionPublicaDocumentoDto,
  EmitirLinkAprobacionDto,
  SolicitarAprobacionDocumentoDto,
} from './dto/desarrollo-documental.dto';

@Permiso('comercial.ver')
@Controller('desarrollo-documental')
export class DesarrolloDocumentalController {
  constructor(private readonly service: DesarrolloDocumentalService) {}

  @Public()
  @Get('publico/:token')
  publico(@Param('token') token: string) {
    return this.service.publico(token);
  }

  @Public()
  @Get('publico/:token/archivo')
  async archivoPublico(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.service.archivoPublico(token);
    res.redirect(302, url);
  }

  @Public()
  @Post('publico/:token/decision')
  decidirPublico(
    @Param('token') token: string,
    @Body() dto: DecisionPublicaDocumentoDto,
  ) {
    return this.service.decidirPublico(token, dto);
  }

  @Get('campanas/:campanaId')
  listarCampana(
    @CurrentSession() auth: CurrentAuth,
    @Param('campanaId', ParseUUIDPipe) campanaId: string,
  ) {
    return this.service.listarCampana(auth, campanaId);
  }

  @Permiso('produccion.ver', 'comercial.ver')
  @Get('ordenes/:ordenId')
  estadoOrden(
    @CurrentSession() auth: CurrentAuth,
    @Param('ordenId', ParseUUIDPipe) ordenId: string,
  ) {
    return this.service.estadoOrden(auth, ordenId);
  }

  @Permiso('comercial.gestionar')
  @Post('maestros')
  crearMaestro(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: CrearArchivoMaestroDto,
  ) {
    return this.service.crearMaestro(auth, dto);
  }

  @Permiso('comercial.gestionar')
  @Post('maestros/:maestroId/revisiones')
  crearRevision(
    @CurrentSession() auth: CurrentAuth,
    @Param('maestroId', ParseUUIDPipe) maestroId: string,
    @Body() dto: CrearRevisionArchivoDto,
  ) {
    return this.service.crearRevision(auth, maestroId, dto);
  }

  @Permiso('comercial.gestionar')
  @Post('revisiones/:revisionId/solicitudes')
  solicitar(
    @CurrentSession() auth: CurrentAuth,
    @Param('revisionId', ParseUUIDPipe) revisionId: string,
    @Body() dto: SolicitarAprobacionDocumentoDto,
  ) {
    return this.service.solicitar(auth, revisionId, dto);
  }

  @Permiso('comercial.gestionar')
  @Post('solicitudes/:solicitudId/link')
  emitirLink(
    @CurrentSession() auth: CurrentAuth,
    @Param('solicitudId', ParseUUIDPipe) solicitudId: string,
    @Body() dto: EmitirLinkAprobacionDto,
  ) {
    return this.service.emitirLink(auth, solicitudId, dto);
  }

  @Permiso('comercial.gestionar')
  @Delete('solicitudes/:solicitudId/link')
  revocarLink(
    @CurrentSession() auth: CurrentAuth,
    @Param('solicitudId', ParseUUIDPipe) solicitudId: string,
  ) {
    return this.service.revocarLink(auth, solicitudId);
  }

  @Permiso('comercial.gestionar')
  @Post('solicitudes/:solicitudId/decision')
  decidir(
    @CurrentSession() auth: CurrentAuth,
    @Param('solicitudId', ParseUUIDPipe) solicitudId: string,
    @Body() dto: DecidirAprobacionDocumentoDto,
  ) {
    return this.service.decidir(auth, solicitudId, dto);
  }

  @Permiso('comercial.gestionar')
  @Post('revisiones/:revisionId/liberar')
  liberar(
    @CurrentSession() auth: CurrentAuth,
    @Param('revisionId', ParseUUIDPipe) revisionId: string,
  ) {
    return this.service.liberar(auth, revisionId);
  }

  @Permiso('comercial.gestionar')
  @Post('gates')
  crearGate(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: CrearGateDocumentoDto,
  ) {
    return this.service.crearGate(auth, dto);
  }

  @Permiso('comercial.gestionar')
  @Delete('gates/:gateId')
  eliminarGate(
    @CurrentSession() auth: CurrentAuth,
    @Param('gateId', ParseUUIDPipe) gateId: string,
  ) {
    return this.service.eliminarGate(auth, gateId);
  }
}
