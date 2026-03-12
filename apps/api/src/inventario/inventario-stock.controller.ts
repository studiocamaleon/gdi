import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { CurrentAuth } from '../auth/auth.types';
import { CurrentSession } from '../auth/current-auth.decorator';
import { GetKardexQueryDto } from './dto/get-kardex-query.dto';
import { GetStockQueryDto } from './dto/get-stock-query.dto';
import { RegistrarMovimientoStockDto } from './dto/registrar-movimiento-stock.dto';
import { RegistrarTransferenciaStockDto } from './dto/registrar-transferencia-stock.dto';
import { UpsertAlmacenDto } from './dto/upsert-almacen.dto';
import { UpsertUbicacionDto } from './dto/upsert-ubicacion.dto';
import { InventarioService } from './inventario.service';

@Controller('inventario')
export class InventarioStockController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Get('almacenes')
  getAlmacenes(@CurrentSession() auth: CurrentAuth) {
    return this.inventarioService.findAllAlmacenes(auth);
  }

  @Post('almacenes')
  createAlmacen(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertAlmacenDto,
  ) {
    return this.inventarioService.createAlmacen(auth, payload);
  }

  @Put('almacenes/:id')
  updateAlmacen(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertAlmacenDto,
  ) {
    return this.inventarioService.updateAlmacen(auth, id, payload);
  }

  @Patch('almacenes/:id/toggle')
  toggleAlmacen(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.inventarioService.toggleAlmacen(auth, id);
  }

  @Get('almacenes/:almacenId/ubicaciones')
  getUbicaciones(
    @CurrentSession() auth: CurrentAuth,
    @Param('almacenId') almacenId: string,
  ) {
    return this.inventarioService.findUbicacionesByAlmacen(auth, almacenId);
  }

  @Post('almacenes/:almacenId/ubicaciones')
  createUbicacion(
    @CurrentSession() auth: CurrentAuth,
    @Param('almacenId') almacenId: string,
    @Body() payload: UpsertUbicacionDto,
  ) {
    return this.inventarioService.createUbicacion(auth, almacenId, payload);
  }

  @Put('ubicaciones/:id')
  updateUbicacion(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertUbicacionDto,
  ) {
    return this.inventarioService.updateUbicacion(auth, id, payload);
  }

  @Patch('ubicaciones/:id/toggle')
  toggleUbicacion(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.inventarioService.toggleUbicacion(auth, id);
  }

  @Post('movimientos')
  registrarMovimiento(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: RegistrarMovimientoStockDto,
  ) {
    return this.inventarioService.registrarMovimiento(auth, payload);
  }

  @Post('movimientos/transferencia')
  registrarTransferencia(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: RegistrarTransferenciaStockDto,
  ) {
    return this.inventarioService.registrarTransferencia(auth, payload);
  }

  @Get('stock')
  getStock(@CurrentSession() auth: CurrentAuth, @Query() query: GetStockQueryDto) {
    return this.inventarioService.getStockActual(auth, query);
  }

  @Get('kardex')
  getKardex(
    @CurrentSession() auth: CurrentAuth,
    @Query() query: GetKardexQueryDto,
  ) {
    return this.inventarioService.getKardex(auth, query);
  }
}
