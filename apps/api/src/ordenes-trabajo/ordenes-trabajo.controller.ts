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
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { OrdenesTrabajoService } from './ordenes-trabajo.service';
import { OrdenesTrabajoQueryDto } from './dto/ordenes-trabajo-query.dto';
import {
  CambiarEstadoOrdenTrabajoDto,
  CancelarOrdenTrabajoDto,
  CrearOrdenTrabajoDto,
  CrearOrdenTrabajoItemDto,
  EditarOrdenTrabajoDto,
} from './dto/crear-orden-trabajo.dto';
import { AccionPasoOrdenTrabajoDto } from './dto/accion-paso.dto';
import { MesaPasoDto } from './dto/mesa-paso.dto';
import { AvanzarCompraDto } from './dto/avanzar-compra.dto';
import { CompletarPasosLoteDto } from './dto/completar-pasos-lote.dto';
import { Public } from '../auth/public.decorator';
import { Permiso } from '../auth/permiso.decorator';
import { OcultaMargenes } from '../auth/margenes.decorator';

/**
 * La orden de trabajo la miran los dos lados del mostrador, así que el
 * controller se parte por acción y no por módulo:
 *
 * - Leerla y ejecutarla es PRODUCCIÓN: el operario entra al tablero, toma su
 *   paso en la mesa y lo completa.
 * - Crearla, editarle los ítems y cambiarle el estado es COMERCIAL: es la
 *   venta, no el taller.
 *
 * Por eso la base es `produccion.ver` y cada método dice lo suyo.
 */
@OcultaMargenes()
@Permiso('produccion.ver')
@Controller('ordenes-trabajo')
export class OrdenesTrabajoController {
  constructor(private readonly ordenesTrabajoService: OrdenesTrabajoService) {}

  /**
   * Seguimiento PÚBLICO por link privado (sin sesión). El token único ES la
   * credencial; devuelve sólo la proyección cliente-facing. Declarado antes
   * de :id — "track" no es un id. Ver docs/tracking-publico-diseno.md
   */
  @Public()
  @Get('track/:token')
  trackingPublico(@Param('token') token: string) {
    return this.ordenesTrabajoService.trackingPublico(token);
  }

  /**
   * Logo de la imprenta en el seguimiento del cliente. Redirige a una URL
   * firmada de 60 s: el bucket es privado y acá no hay sesión, así que el
   * token de la orden es lo único que autoriza.
   */
  @Public()
  @Get('track/:token/logo')
  async logoPublico(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.ordenesTrabajoService.logoPublicoPorToken(token);
    if (!url) {
      res.status(404).end();
      return;
    }
    res.redirect(302, url);
  }

  /**
   * Adjunto que la imprenta marcó visible para el cliente (prueba de color,
   * foto del trabajo terminado). El token autoriza, y el service comprueba
   * además que el archivo sea de ESA orden.
   */
  @Public()
  @Get('track/:token/archivos/:archivoId')
  async archivoPublico(
    @Param('token') token: string,
    @Param('archivoId', ParseUUIDPipe) archivoId: string,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.ordenesTrabajoService.archivoPublicoPorToken(
      token,
      archivoId,
    );
    if (!url) {
      res.status(404).end();
      return;
    }
    res.redirect(302, url);
  }

  @Get()
  findAll(
    @CurrentSession() auth: CurrentAuth,
    @Query() query: OrdenesTrabajoQueryDto,
  ) {
    return this.ordenesTrabajoService.findAll(auth, query);
  }

  /** Dataset del Tablero de producción (antes de :id: "tablero" no es un id). */
  @Get('tablero')
  tablero(@CurrentSession() auth: CurrentAuth) {
    return this.ordenesTrabajoService.tablero(auth);
  }

  /** Completar varios pasos de una (simulador de impresión). */
  @Permiso('produccion.gestionar')
  @Post('tablero/pasos/completar-lote')
  completarPasosLote(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: CompletarPasosLoteDto,
  ) {
    return this.ordenesTrabajoService.completarPasosLote(
      auth,
      payload.pasoIds,
      payload.duracionTandaMin,
      payload.ahorro,
    );
  }

  /** Tramos de trabajo abiertos del usuario (widget flotante "En curso"). */
  @Get('tablero/mis-tramos')
  misTramos(@CurrentSession() auth: CurrentAuth) {
    return this.ordenesTrabajoService.misTramosAbiertos(auth);
  }

  /** Pausa automática por inactividad (D13): sin respuesta al countdown. */
  @Permiso('produccion.gestionar')
  @Patch('tablero/pasos/:pasoId/auto-pausa')
  autoPausa(
    @CurrentSession() auth: CurrentAuth,
    @Param('pasoId') pasoId: string,
  ) {
    return this.ordenesTrabajoService.autoPausarPaso(auth, pasoId);
  }

  /** Tomar/soltar un paso de MI mesa de trabajo (vista Por estación). */
  @Permiso('produccion.gestionar')
  @Patch('tablero/pasos/:pasoId/mesa')
  mesaPaso(
    @CurrentSession() auth: CurrentAuth,
    @Param('pasoId') pasoId: string,
    @Body() payload: MesaPasoDto,
  ) {
    return this.ordenesTrabajoService.mesaPaso(auth, pasoId, payload.en);
  }

  /** Panel de Compras: avanzar el estado de una compra tercerizada (F2). */
  @Permiso('produccion.gestionar')
  @Patch('tablero/pasos/:pasoId/compra')
  avanzarCompra(
    @CurrentSession() auth: CurrentAuth,
    @Param('pasoId') pasoId: string,
    @Body() payload: AvanzarCompraDto,
  ) {
    return this.ordenesTrabajoService.avanzarCompra(
      auth,
      pasoId,
      payload.estadoCompra,
    );
  }

  @Get(':id')
  findOne(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.ordenesTrabajoService.findOne(auth, id);
  }

  /** Pasos materializados de la orden (tab Producción del detalle). */
  @Get(':id/pasos')
  pasosDeOrden(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.ordenesTrabajoService.pasosDeOrden(auth, id);
  }

  @Permiso('comercial.gestionar')
  @Post()
  create(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: CrearOrdenTrabajoDto,
  ) {
    return this.ordenesTrabajoService.create(auth, payload);
  }

  @Permiso('comercial.gestionar')
  @Patch(':id')
  editar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: EditarOrdenTrabajoDto,
  ) {
    return this.ordenesTrabajoService.editar(auth, id, payload);
  }

  @Permiso('comercial.gestionar')
  @Post(':id/items')
  agregarItem(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: CrearOrdenTrabajoItemDto,
  ) {
    return this.ordenesTrabajoService.agregarItem(auth, id, payload);
  }

  @Permiso('comercial.gestionar')
  @Patch(':id/items/:itemId')
  editarItem(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() payload: CrearOrdenTrabajoItemDto,
  ) {
    return this.ordenesTrabajoService.editarItem(auth, id, itemId, payload);
  }

  @Permiso('comercial.gestionar')
  @Delete(':id/items/:itemId')
  quitarItem(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.ordenesTrabajoService.quitarItem(auth, id, itemId);
  }

  @Permiso('produccion.gestionar')
  @Patch(':id/items/:itemId/pasos/:pasoId')
  accionPaso(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Param('pasoId') pasoId: string,
    @Body() payload: AccionPasoOrdenTrabajoDto,
  ) {
    return this.ordenesTrabajoService.accionPaso(
      auth,
      id,
      itemId,
      pasoId,
      payload,
    );
  }

  /**
   * Cancelar la orden. Lo hace Comercial —quien cierra la venta es quien se
   * entera de que se cayó—, y queda todo en el historial de la orden: quién,
   * cuándo, por qué y con cuánto trabajo encima.
   */
  @Permiso('comercial.gestionar')
  @Post(':id/cancelar')
  cancelar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: CancelarOrdenTrabajoDto,
  ) {
    return this.ordenesTrabajoService.cancelar(auth, id, payload);
  }

  @Permiso('comercial.gestionar')
  @Patch(':id/estado')
  cambiarEstado(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: CambiarEstadoOrdenTrabajoDto,
  ) {
    return this.ordenesTrabajoService.cambiarEstado(auth, id, payload);
  }
}
