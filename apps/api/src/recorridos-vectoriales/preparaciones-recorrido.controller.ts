import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';
import { PreparacionesRecorridoService } from './preparaciones-recorrido.service';

@Permiso('produccion.ver')
@Controller('recorridos-vectoriales')
export class PreparacionesRecorridoController {
  constructor(private readonly preparations: PreparacionesRecorridoService) {}

  @Post('items/:itemId/corte/preparar')
  list(@CurrentSession() auth: CurrentAuth, @Param('itemId') itemId: string) {
    return this.preparations.asegurarParaItem(auth, itemId);
  }

  @Get('items/:itemId/plantilla-instalacion')
  installationTemplate(
    @CurrentSession() auth: CurrentAuth,
    @Param('itemId') itemId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.preparations.plantillaInstalacion(
      auth,
      itemId,
      templateConfig(query),
    );
  }

  @Get('items/:itemId/plantilla-instalacion/descargar')
  async downloadInstallationTemplate(
    @CurrentSession() auth: CurrentAuth,
    @Param('itemId') itemId: string,
    @Query() query: Record<string, string | undefined>,
    @Res() response: Response,
  ) {
    const parsedPanel = Number(query.panel);
    const panel =
      query.panel != null && Number.isInteger(parsedPanel) && parsedPanel >= 0
        ? parsedPanel
        : null;
    const file = await this.preparations.descargarPlantillaInstalacion(
      auth,
      itemId,
      panel,
      templateConfig(query),
    );
    response.setHeader('Content-Type', file.mime);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.name.replace(/["\r\n]/g, '')}"`,
    );
    response.end(file.bytes);
  }

  @Get('items/:itemId/plantilla-instalacion/archivos/:formato')
  async downloadInstallationFile(
    @CurrentSession() auth: CurrentAuth,
    @Param('itemId') itemId: string,
    @Param('formato')
    formato:
      | 'paquete'
      | 'plano-pdf'
      | 'papel-plotter-pdf'
      | 'papel-mosaico-pdf'
      | 'rigida-dxf'
      | 'vinilo-eps'
      | 'pounce-dxf',
    @Query() query: Record<string, string | undefined>,
    @Res() response: Response,
  ) {
    const parsedPanel = Number(query.panel);
    const panel =
      query.panel != null && Number.isInteger(parsedPanel) && parsedPanel >= 0
        ? parsedPanel
        : null;
    const file = await this.preparations.descargarArchivoInstalacion(
      auth,
      itemId,
      formato,
      panel,
      templateConfig(query),
    );
    response.setHeader('Content-Type', file.mime);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.name.replace(/["\r\n]/g, '')}"`,
    );
    response.end(file.bytes);
  }

  @Permiso('produccion.supervisar')
  @Post('items/:itemId/corte/regenerar')
  regenerate(
    @CurrentSession() auth: CurrentAuth,
    @Param('itemId') itemId: string,
  ) {
    return this.preparations.asegurarParaItem(auth, itemId, true);
  }

  @Permiso('produccion.supervisar')
  @Patch('revisiones/:revisionId/estado')
  state(
    @CurrentSession() auth: CurrentAuth,
    @Param('revisionId') revisionId: string,
    @Body()
    body: { estado: 'REVISADA' | 'APROBADA' | 'ENVIADA_MAQUINA' },
  ) {
    return this.preparations.cambiarEstado(auth, revisionId, body.estado);
  }

  @Get('revisiones/:revisionId/:format')
  async download(
    @CurrentSession() auth: CurrentAuth,
    @Param('revisionId') revisionId: string,
    @Param('format') format: 'tap' | 'source-svg' | 'linked-svg',
    @Res() response: Response,
  ) {
    const file = await this.preparations.descargar(auth, revisionId, format);
    response.setHeader('Content-Type', file.mime);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.name.replace(/["\r\n]/g, '')}"`,
    );
    response.end(file.bytes);
  }
}

function templateConfig(query: Record<string, string | undefined>) {
  return {
    bordeMm: optionalNumber(query.bordeMm),
    anchoPanelMm: optionalNumber(query.anchoPanelMm),
    altoPanelMm: optionalNumber(query.altoPanelMm),
    solapeMm: optionalNumber(query.solapeMm),
  };
}

function optionalNumber(value: string | undefined) {
  if (value == null || value.trim() === '') return undefined;
  const result = Number(value.replace(',', '.'));
  return Number.isFinite(result) ? result : undefined;
}
