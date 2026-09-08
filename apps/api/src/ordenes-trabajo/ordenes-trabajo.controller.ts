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
  EditarOrdenTrabajoLoteDto,
  TratamientoFiscalDto,
} from './dto/crear-orden-trabajo.dto';
import { AccionPasoOrdenTrabajoDto } from './dto/accion-paso.dto';
import {
  EntregarItemsDto,
  EscanearOrdenDto,
  RevertirEntregaDto,
} from './dto/entrega.dto';
import { EntregaService } from './entrega.service';
import { MesaPasoDto } from './dto/mesa-paso.dto';
import { AvanzarCompraDto } from './dto/avanzar-compra.dto';
import { ResolverGatePasoDto } from './dto/resolver-gate-paso.dto';
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
  constructor(
    private readonly ordenesTrabajoService: OrdenesTrabajoService,
    private readonly entrega: EntregaService,
  ) {}

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
   * QR de retiro de la orden. Se sirve como PNG para dos consumidores: la
   * vista pública de seguimiento (la muestra el cliente en el mostrador) y el
   * header de imagen del WhatsApp de "orden lista" (Meta busca esta URL al
   * enviar). El token de la orden es lo único que autoriza.
   */
  @Public()
  @Get('track/:token/qr-retiro.png')
  async qrRetiroPublico(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const png = await this.ordenesTrabajoService.qrRetiroPorToken(token);
    if (!png) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', 'image/png');
    // El QR es el número de la orden: estable, no cambia. Se puede cachear
    // fuerte, y así WhatsApp no golpea el endpoint en cada reintento de envío.
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.end(png);
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
  @Permiso(
    'produccion.ver',
    'comercial.ver',
    'administracion.ver',
    'administracion.gestionar',
  )
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
  @Permiso('produccion.ejecutar', 'produccion.supervisar')
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
      payload.validarCompatibilidadLaser,
    );
  }

  /** Tramos de trabajo abiertos del usuario (widget flotante "En curso"). */
  @Get('tablero/mis-tramos')
  misTramos(@CurrentSession() auth: CurrentAuth) {
    return this.ordenesTrabajoService.misTramosAbiertos(auth);
  }

  /** Pausa automática por inactividad (D13): sin respuesta al countdown. */
  @Permiso('produccion.ejecutar', 'produccion.supervisar')
  @Patch('tablero/pasos/:pasoId/auto-pausa')
  autoPausa(
    @CurrentSession() auth: CurrentAuth,
    @Param('pasoId') pasoId: string,
  ) {
    return this.ordenesTrabajoService.autoPausarPaso(auth, pasoId);
  }

  /** Tomar/soltar un paso de MI mesa de trabajo (vista Por estación). */
  @Permiso('produccion.ejecutar', 'produccion.supervisar')
  @Patch('tablero/pasos/:pasoId/mesa')
  mesaPaso(
    @CurrentSession() auth: CurrentAuth,
    @Param('pasoId') pasoId: string,
    @Body() payload: MesaPasoDto,
  ) {
    return this.ordenesTrabajoService.mesaPaso(auth, pasoId, payload.en);
  }

  /** Panel de Compras: avanzar el estado de una compra tercerizada (F2). */
  @Permiso('produccion.supervisar')
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

  /** Resolver/reabrir una condición operativa de material o calidad. */
  @Permiso('produccion.supervisar')
  @Patch('tablero/pasos/:pasoId/gate')
  resolverGatePaso(
    @CurrentSession() auth: CurrentAuth,
    @Param('pasoId') pasoId: string,
    @Body() payload: ResolverGatePasoDto,
  ) {
    return this.ordenesTrabajoService.resolverGatePaso(auth, pasoId, payload);
  }

  @Get(':id')
  @Permiso(
    'produccion.ver',
    'comercial.ver',
    'administracion.ver',
    'administracion.gestionar',
  )
  findOne(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.ordenesTrabajoService.findOne(auth, id);
  }

  /** Pasos materializados de la orden (tab Producción del detalle). */
  @Get(':id/pasos')
  @Permiso('produccion.ver', 'comercial.ver')
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
  @Patch(':id/lote')
  editarLote(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: EditarOrdenTrabajoLoteDto,
  ) {
    return this.ordenesTrabajoService.editarLote(auth, id, payload);
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

  /**
   * Enciende/apaga el tratamiento SIN comprobante fiscal de la orden. Es una
   * decisión de precio (misma llave que el descuento), por eso
   * `comercial.gestionar`. Ver docs/margen-y-decisiones-de-precio.md §6.
   */
  @Permiso('comercial.gestionar')
  @Patch(':id/tratamiento-fiscal')
  setTratamientoFiscal(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: TratamientoFiscalDto,
  ) {
    return this.ordenesTrabajoService.setTratamientoFiscal(
      auth,
      id,
      payload.tratamientoFiscal,
    );
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

  @Permiso('produccion.ejecutar', 'produccion.supervisar')
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

  // ── Mostrador: entrega por escaneo ──────────────────────────────────
  // Resolver el código es de lectura (el operador todavía no hizo nada);
  // entregar y revertir mueven el estado de la orden.

  @Post('escaneo')
  escanear(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: EscanearOrdenDto,
  ) {
    return this.entrega.escanear(auth, payload.codigo);
  }

  @Permiso('produccion.gestionar')
  @Post(':id/entregar')
  entregar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: EntregarItemsDto,
  ) {
    return this.entrega.entregar(auth, id, payload);
  }

  /** Deshacer una entrega: el único retroceso desde `entregada`. */
  @Permiso('produccion.gestionar')
  @Post(':id/entregar/revertir')
  revertirEntrega(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: RevertirEntregaDto,
  ) {
    return this.entrega.revertir(auth, id, payload);
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
