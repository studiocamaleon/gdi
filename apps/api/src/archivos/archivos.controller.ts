import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import type { CurrentAuth } from '../auth/auth.types';
import { CurrentSession } from '../auth/current-auth.decorator';
import { ArchivosService } from './archivos.service';
import {
  ActualizarArchivoDto,
  IniciarSubidaDto,
  ListarArchivosDto,
} from './dto/archivos.dto';

@Controller('archivos')
export class ArchivosController {
  constructor(private readonly service: ArchivosService) {}

  @Get()
  listar(@Query() query: ListarArchivosDto) {
    return this.service.listar(query);
  }

  /**
   * Todo lo adjunto a una orden (documento + cada item) de una sola vez.
   * Declarado antes de `:id/...`: "de-orden" no es un uuid, pero mejor no
   * depender del orden de evaluación de rutas para eso.
   */
  @Get('de-orden/:ordenId')
  deOrden(@Param('ordenId', ParseUUIDPipe) ordenId: string) {
    return this.service.deOrden(ordenId);
  }

  /** Paso 1 de la subida: devuelve la URL firmada para el PUT directo. */
  @Post('iniciar')
  iniciar(@CurrentSession() auth: CurrentAuth, @Body() dto: IniciarSubidaDto) {
    return this.service.iniciar(auth, dto);
  }

  /** Paso 2: el objeto ya está arriba; se verifica y se hace visible. */
  @Post(':id/confirmar')
  confirmar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.confirmar(auth, id);
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
  async contenido(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.service.urlDeDescarga(id);
    res.redirect(302, url);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarArchivoDto,
  ) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  async eliminar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ ok: true }> {
    await this.service.eliminar(auth, id);
    return { ok: true };
  }
}
