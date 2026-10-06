import { pipeline } from 'node:stream/promises';
import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ProhibidoImpersonando } from '../auth/prohibido-impersonando.decorator';
import type { Response } from 'express';

import type { CurrentAuth } from '../auth/auth.types';
import { CurrentSession } from '../auth/current-auth.decorator';
import { ArchivosService } from './archivos.service';
import {
  ActualizarArchivoDto,
  ConfirmarSubidaDto,
  IniciarSubidaDto,
  ListarArchivosDto,
} from './dto/archivos.dto';
import { SoloAutenticado } from '../auth/permiso.decorator';
import { AccesoArchivo, ArchivosAccesoGuard } from './archivos-acceso.guard';

/**
 * El permiso depende del módulo del archivo y se resuelve en el guard propio.
 * @SoloAutenticado delega esa autorización dinámica; no sustituye el guard.
 */
@SoloAutenticado()
@UseGuards(ArchivosAccesoGuard)
@Controller('archivos')
export class ArchivosController {
  private readonly logger = new Logger(ArchivosController.name);
  constructor(private readonly service: ArchivosService) {}

  @Get()
  @AccesoArchivo({ origen: 'query', accion: 'leer' })
  listar(@Query() query: ListarArchivosDto) {
    return this.service.listar(query);
  }

  /**
   * Todo lo adjunto a una orden (documento + cada item) de una sola vez.
   * Declarado antes de `:id/...`: "de-orden" no es un uuid, pero mejor no
   * depender del orden de evaluación de rutas para eso.
   */
  @Get('de-orden/:ordenId')
  @AccesoArchivo({ origen: 'orden', accion: 'leer' })
  deOrden(@Param('ordenId', ParseUUIDPipe) ordenId: string) {
    return this.service.deOrden(ordenId);
  }

  @Get('de-orden/:ordenId/zip')
  @AccesoArchivo({ origen: 'orden', accion: 'leer' })
  async zipOrden(@CurrentSession() auth: CurrentAuth, @Param('ordenId', ParseUUIDPipe) id: string, @Query('comprobar') comprobar: string | undefined, @Res() res: Response) {
    return this.enviarZip(auth.tenantId, { ordenId: id }, comprobar, res);
  }

  @Get('de-item/:itemId/zip')
  @AccesoArchivo({ origen: 'orden', accion: 'leer' })
  async zipItem(@CurrentSession() auth: CurrentAuth, @Param('itemId', ParseUUIDPipe) id: string, @Query('comprobar') comprobar: string | undefined, @Res() res: Response) {
    return this.enviarZip(auth.tenantId, { itemId: id }, comprobar, res);
  }

  private async enviarZip(tenantId: string, destino: { ordenId: string } | { itemId: string }, comprobar: string | undefined, res: Response) {
    const paquete = await this.service.prepararDescargaZip(tenantId, destino);
    res.setHeader('Cache-Control', 'private, no-store');
    if (comprobar === '1') { res.json({ cantidad: paquete.cantidad }); return; }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="archivos.zip"; filename*=UTF-8''${encodeURIComponent(paquete.nombre)}`);
    try { await pipeline(paquete.stream(), res); }
    catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) this.logger.error('No se pudo completar la descarga ZIP de archivos.');
      if (!res.destroyed) res.destroy(error instanceof Error ? error : undefined);
    }
  }

  /** Cuánto espacio ocupa el tenant y en qué. */
  @Get('uso')
  @AccesoArchivo({ origen: 'uso' })
  uso(@CurrentSession() auth: CurrentAuth) {
    return this.service.uso(auth.tenantId);
  }

  /** Lo borrado que todavía se puede recuperar. */
  @Get('papelera')
  @AccesoArchivo({ origen: 'query', accion: 'leer' })
  papelera(@Query() query: ListarArchivosDto) {
    return this.service.papelera(query);
  }

  @Post(':id/restaurar')
  @AccesoArchivo({ origen: 'archivo', accion: 'escribir' })
  restaurar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.restaurar(auth, id);
  }

  /** Paso 1 de la subida: devuelve la URL firmada para el PUT directo. */
  @Post('iniciar')
  @AccesoArchivo({ origen: 'body', accion: 'escribir' })
  iniciar(@CurrentSession() auth: CurrentAuth, @Body() dto: IniciarSubidaDto) {
    return this.service.iniciar(auth, dto);
  }

  /**
   * Paso 2: el objeto ya está arriba; se verifica y se hace visible. En las
   * subidas en partes, el body trae los ETags que devolvió cada PUT — sin
   * ellos el multipart no se puede cerrar.
   */
  @Post(':id/confirmar')
  @AccesoArchivo({ origen: 'archivo', accion: 'escribir' })
  confirmar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmarSubidaDto,
  ) {
    return this.service.confirmar(auth, id, dto);
  }

  @Post(':id/cancelar-subida')
  @AccesoArchivo({ origen: 'archivo', accion: 'escribir' })
  async cancelarSubida(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.cancelarSubida(auth, id);
    return { ok: true };
  }

  /**
   * Descarga. Responde 302 a una URL firmada de 60 s: la banda va del storage
   * al navegador sin pasar por el API.
   *
   * OJO: esta ruta NO se puede consumir por el proxy BFF de Next
   * (/api/backend/*), que sigue los redirects internamente y volvería a
   * bufferear el archivo entero en memoria. El front la llama directo contra
   * el API. Ver docs/archivos-r2-diseno.md §D4.
   */
  @Get(':id/contenido')
  @AccesoArchivo({ origen: 'archivo', accion: 'leer' })
  async contenido(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.service.urlDeDescarga(id);
    res.redirect(302, url);
  }

  @Patch(':id')
  @AccesoArchivo({ origen: 'archivo', accion: 'escribir' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarArchivoDto,
  ) {
    return this.service.actualizar(id, dto);
  }

  @ProhibidoImpersonando()
  @Delete(':id')
  @AccesoArchivo({ origen: 'archivo', accion: 'escribir' })
  async eliminar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ ok: true }> {
    await this.service.eliminar(auth, id);
    return { ok: true };
  }
}
