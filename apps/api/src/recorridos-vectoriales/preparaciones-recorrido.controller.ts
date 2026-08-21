import { Body, Controller, Get, Param, Patch, Post, Res } from '@nestjs/common';
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
