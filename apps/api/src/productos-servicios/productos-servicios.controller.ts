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
import {
  ActualizarProductoRutaAlternativaDto,
  AgregarPasoExtraDto,
  CrearProductoRutaAlternativaDto,
  UpsertProductoConfigPasoDto,
} from './dto/producto-ruta.dto';
import {
  ActualizarCargoDirectoDto,
  AsociarCargoCotizacionDto,
  AsociarCargoPasoDto,
  CrearCargoDirectoDto,
} from './dto/cargo-directo.dto';

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

  @Get('catalogo-comercial')
  listarCatalogoComercial() {
    return this.service.listarCatalogoComercial();
  }

  @Get('productos')
  async listarProductos(
    @Req() req: RequestWithAuth,
    @Query('activo') activo?: string,
  ) {
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

  @Get('productos/:id/validar')
  async validarProducto(@Req() req: RequestWithAuth, @Param('id') id: string) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.validarProducto(tenantId, id);
  }

  @Post('productos')
  async crearProducto(
    @Req() req: RequestWithAuth,
    @Body() dto: CrearProductoDto,
  ) {
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

  // === PRODUCTO ↔ RUTAS ALTERNATIVAS ===

  @Post('productos/:productoId/rutas-alternativas')
  async crearProductoRutaAlternativa(
    @Req() req: RequestWithAuth,
    @Param('productoId') productoId: string,
    @Body() dto: CrearProductoRutaAlternativaDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.crearProductoRutaAlternativa(tenantId, productoId, dto);
  }

  @Patch('productos/rutas-alternativas/:rutaAltId')
  async actualizarProductoRutaAlternativa(
    @Req() req: RequestWithAuth,
    @Param('rutaAltId') rutaAltId: string,
    @Body() dto: ActualizarProductoRutaAlternativaDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.actualizarProductoRutaAlternativa(
      tenantId,
      rutaAltId,
      dto,
    );
  }

  @Delete('productos/rutas-alternativas/:rutaAltId')
  @HttpCode(204)
  async eliminarProductoRutaAlternativa(
    @Req() req: RequestWithAuth,
    @Param('rutaAltId') rutaAltId: string,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    await this.service.eliminarProductoRutaAlternativa(tenantId, rutaAltId);
  }

  @Post('productos/rutas-alternativas/:rutaAltId/config-pasos')
  async upsertConfigPaso(
    @Req() req: RequestWithAuth,
    @Param('rutaAltId') rutaAltId: string,
    @Body() dto: UpsertProductoConfigPasoDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.upsertConfigPaso(tenantId, rutaAltId, dto);
  }

  @Get('familias')
  listarFamilias() {
    return this.service.listarFamilias();
  }

  @Get('lookups-config-paso')
  async listarLookupsConfigPaso(@Req() req: RequestWithAuth) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.listarLookupsConfigPaso(tenantId);
  }

  @Get('cargos-directos')
  async listarCargosDirectos(
    @Req() req: RequestWithAuth,
    @Query('soloActivos') soloActivos?: string,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.listarCargosDirectos(tenantId, soloActivos !== 'false');
  }

  @Post('cargos-directos')
  async crearCargoDirecto(
    @Req() req: RequestWithAuth,
    @Body() dto: CrearCargoDirectoDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.crearCargoDirecto(tenantId, dto);
  }

  @Patch('cargos-directos/:id')
  async actualizarCargoDirecto(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: ActualizarCargoDirectoDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.actualizarCargoDirecto(tenantId, id, dto);
  }

  @Delete('cargos-directos/:id')
  @HttpCode(204)
  async eliminarCargoDirecto(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    await this.service.eliminarCargoDirecto(tenantId, id);
  }

  // === ASOCIACIÓN cargos ↔ producto/paso (F.3.10) ===

  @Post('productos/:productoId/cargos-cotizacion')
  async asociarCargoCotizacion(
    @Req() req: RequestWithAuth,
    @Param('productoId') productoId: string,
    @Body() dto: AsociarCargoCotizacionDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.asociarCargoCotizacion(tenantId, productoId, dto);
  }

  @Delete('productos/cargos-cotizacion/:asociacionId')
  @HttpCode(204)
  async desasociarCargoCotizacion(
    @Req() req: RequestWithAuth,
    @Param('asociacionId') asociacionId: string,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    await this.service.desasociarCargoCotizacion(tenantId, asociacionId);
  }

  @Post('productos/config-pasos/:configPasoId/cargos')
  async asociarCargoPaso(
    @Req() req: RequestWithAuth,
    @Param('configPasoId') configPasoId: string,
    @Body() dto: AsociarCargoPasoDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.asociarCargoPaso(tenantId, configPasoId, dto);
  }

  @Delete('productos/config-pasos/cargos/:asociacionId')
  @HttpCode(204)
  async desasociarCargoPaso(
    @Req() req: RequestWithAuth,
    @Param('asociacionId') asociacionId: string,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    await this.service.desasociarCargoPaso(tenantId, asociacionId);
  }

  // === PASOS EXTRAS INLINE (G-F3) ===

  @Post('productos/:productoId/pasos-extras')
  async agregarPasoExtra(
    @Req() req: RequestWithAuth,
    @Param('productoId') productoId: string,
    @Body() dto: AgregarPasoExtraDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.agregarPasoExtra(tenantId, productoId, dto);
  }

  @Delete('productos/pasos-extras/:pasoExtraId')
  @HttpCode(204)
  async eliminarPasoExtra(
    @Req() req: RequestWithAuth,
    @Param('pasoExtraId') pasoExtraId: string,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    await this.service.eliminarPasoExtra(tenantId, pasoExtraId);
  }
}
