import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { OrdenesTrabajoService } from './ordenes-trabajo.service';
import { OrdenesTrabajoQueryDto } from './dto/ordenes-trabajo-query.dto';
import {
  CambiarEstadoOrdenTrabajoDto,
  CrearOrdenTrabajoDto,
  CrearOrdenTrabajoItemDto,
  EditarOrdenTrabajoDto,
} from './dto/crear-orden-trabajo.dto';
import { AccionPasoOrdenTrabajoDto } from './dto/accion-paso.dto';
import { MesaPasoDto } from './dto/mesa-paso.dto';
import { CompletarPasosLoteDto } from './dto/completar-pasos-lote.dto';
import { Public } from '../auth/public.decorator';

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
  @Patch('tablero/pasos/:pasoId/auto-pausa')
  autoPausa(@CurrentSession() auth: CurrentAuth, @Param('pasoId') pasoId: string) {
    return this.ordenesTrabajoService.autoPausarPaso(auth, pasoId);
  }

  /** Tomar/soltar un paso de MI mesa de trabajo (vista Por estación). */
  @Patch('tablero/pasos/:pasoId/mesa')
  mesaPaso(
    @CurrentSession() auth: CurrentAuth,
    @Param('pasoId') pasoId: string,
    @Body() payload: MesaPasoDto,
  ) {
    return this.ordenesTrabajoService.mesaPaso(auth, pasoId, payload.en);
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

  @Post()
  create(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: CrearOrdenTrabajoDto,
  ) {
    return this.ordenesTrabajoService.create(auth, payload);
  }

  @Patch(':id')
  editar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: EditarOrdenTrabajoDto,
  ) {
    return this.ordenesTrabajoService.editar(auth, id, payload);
  }

  @Post(':id/items')
  agregarItem(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: CrearOrdenTrabajoItemDto,
  ) {
    return this.ordenesTrabajoService.agregarItem(auth, id, payload);
  }

  @Patch(':id/items/:itemId')
  editarItem(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() payload: CrearOrdenTrabajoItemDto,
  ) {
    return this.ordenesTrabajoService.editarItem(auth, id, itemId, payload);
  }

  @Delete(':id/items/:itemId')
  quitarItem(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.ordenesTrabajoService.quitarItem(auth, id, itemId);
  }

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

  @Patch(':id/estado')
  cambiarEstado(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: CambiarEstadoOrdenTrabajoDto,
  ) {
    return this.ordenesTrabajoService.cambiarEstado(auth, id, payload);
  }
}
