import { Controller, Get, Param, Query, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ProductosServiciosService } from './productos-servicios.service';

interface RequestWithAuth extends Request {
  auth?: { tenantId: string; userId: string };
}

/**
 * Controller F.3 — Endpoints CRUD del Modelo Universal V2.
 *
 * MVP: read-only. POST/PUT/DELETE se agregan en sub-fases siguientes
 * cuando la UI de edición esté lista (F.3.x).
 */
@Controller('productos-servicios')
export class ProductosServiciosController {
  constructor(private readonly service: ProductosServiciosService) {}

  @Get('productos')
  async listarProductos(@Req() req: RequestWithAuth, @Query('activo') activo?: string) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    const filtroActivo = activo === undefined ? undefined : activo !== 'false';
    return this.service.listarProductos(tenantId, filtroActivo);
  }

  @Get('productos/:id')
  async obtenerProducto(@Req() req: RequestWithAuth, @Param('id') id: string) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.obtenerProducto(tenantId, id);
  }

  @Get('rutas')
  async listarRutas(@Req() req: RequestWithAuth) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.listarRutas(tenantId);
  }

  @Get('rutas/:id')
  async obtenerRuta(@Req() req: RequestWithAuth, @Param('id') id: string) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.obtenerRuta(tenantId, id);
  }

  @Get('familias')
  listarFamilias() {
    return this.service.listarFamilias();
  }

  @Get('cargos-directos')
  async listarCargosDirectos(@Req() req: RequestWithAuth) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.listarCargosDirectos(tenantId);
  }
}
