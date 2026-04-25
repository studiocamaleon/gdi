import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ProductosServiciosService } from './productos-servicios.service';
import { ActualizarProductoDto, CrearProductoDto } from './dto/producto.dto';
import { ActualizarRutaDto, CrearRutaDto } from './dto/ruta.dto';

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

  @Post('productos')
  async crearProducto(@Req() req: RequestWithAuth, @Body() dto: CrearProductoDto) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.crearProducto(tenantId, dto);
  }

  @Patch('productos/:id')
  async actualizarProducto(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: ActualizarProductoDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.actualizarProducto(tenantId, id, dto);
  }

  @Delete('productos/:id')
  @HttpCode(204)
  async eliminarProducto(@Req() req: RequestWithAuth, @Param('id') id: string) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    await this.service.eliminarProducto(tenantId, id);
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

  @Post('rutas')
  async crearRuta(@Req() req: RequestWithAuth, @Body() dto: CrearRutaDto) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.crearRuta(tenantId, dto);
  }

  @Patch('rutas/:id')
  async actualizarRuta(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: ActualizarRutaDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.actualizarRuta(tenantId, id, dto);
  }

  @Delete('rutas/:id')
  @HttpCode(204)
  async eliminarRuta(@Req() req: RequestWithAuth, @Param('id') id: string) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    await this.service.eliminarRuta(tenantId, id);
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
