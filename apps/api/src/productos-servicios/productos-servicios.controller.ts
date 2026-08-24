import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ListProductosQueryDto } from './dto/list-productos-query.dto';
import {
  ActualizarPasoTenantDto,
  CrearPasoTenantDto,
} from './dto/paso-tenant.dto';
import { PasosTenantService } from './pasos-tenant.service';
import { ProductosServiciosService } from './productos-servicios.service';
import {
  ActualizarProductoDto,
  CrearProductoDto,
  DuplicarProductoDto,
} from './dto/producto.dto';
import {
  ActualizarRutaDto,
  CrearRutaDto,
  DuplicarRutaDto,
  MigrarProductosRutaDto,
} from './dto/ruta.dto';
import {
  ActualizarPasoExtraDto,
  ActualizarProductoRutaAlternativaDto,
  AgregarPasoExtraDto,
  CrearProductoRutaAlternativaDto,
  DuplicarProductoRutaAlternativaDto,
  UpsertProductoConfigPasoDto,
} from './dto/producto-ruta.dto';
import {
  ActualizarAsociacionCargoDto,
  ActualizarCargoDirectoDto,
  AsociarCargoCotizacionDto,
  AsociarCargoPasoDto,
  CrearCargoDirectoDto,
} from './dto/cargo-directo.dto';
import { Permiso } from '../auth/permiso.decorator';
import { FormularioCotizacionService } from './formulario-cotizacion.service';

interface RequestWithAuth extends Request {
  auth?: { tenantId: string; userId: string };
}

/**
 * Controller F.3 — Endpoints CRUD del Modelo Universal V2.
 *
 * MVP: read-only. POST/PUT/DELETE se agregan en sub-fases siguientes
 * cuando la UI de edición esté lista (F.3.x).
 */
@Permiso('costos.ver')
@Controller('productos-servicios')
export class ProductosServiciosController {
  constructor(
    private readonly service: ProductosServiciosService,
    private readonly pasosTenant: PasosTenantService,
    private readonly formulario: FormularioCotizacionService,
  ) {}

  @Get('catalogo-comercial')
  listarCatalogoComercial() {
    return this.service.listarCatalogoComercial();
  }

  @Get('productos')
  async listarProductos(
    @Req() req: RequestWithAuth,
    @Query() query: ListProductosQueryDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.listarProductos(tenantId, {
      pagination: query,
      activo: query.activo,
      search: query.search?.trim() || undefined,
      unidadComercial: query.unidadComercial,
      subcategoriaCodigo: query.subcategoriaCodigo?.trim() || undefined,
      categoriaCodigo: query.categoriaCodigo?.trim() || undefined,
      orden: query.orden,
    });
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

  /**
   * Formulario de cotización derivado: las preguntas que hay que responder
   * para cotizar este producto, con su clave de jobContext explícita. Es la
   * vista COMERCIAL del producto (sin costos), por eso baja el permiso de la
   * clase (costos.ver) a comercial.ver — lo consume el MCP y a futuro el
   * propio sheet. Ver docs/mcp-cotizador-diseno.md §4.
   */
  @Permiso('comercial.ver')
  @Get('productos/:id/formulario-cotizacion')
  async formularioCotizacion(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Query('rutaAlternativaId') rutaAlternativaId?: string,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.formulario.obtener(
      tenantId,
      id,
      rutaAlternativaId?.trim() || undefined,
    );
  }

  @Permiso('costos.gestionar')
  @Post('productos')
  async crearProducto(
    @Req() req: RequestWithAuth,
    @Body() dto: CrearProductoDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.crearProducto(tenantId, dto);
  }

  @Permiso('costos.gestionar')
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

  @Permiso('costos.gestionar')
  @Post('productos/:id/duplicar')
  async duplicarProducto(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: DuplicarProductoDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.duplicarProducto(tenantId, id, dto);
  }

  @Permiso('costos.gestionar')
  @Delete('productos/:id')
  @HttpCode(204)
  async eliminarProducto(@Req() req: RequestWithAuth, @Param('id') id: string) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    await this.service.eliminarProducto(tenantId, id);
  }

  @Get('rutas')
  async listarRutas(
    @Req() req: RequestWithAuth,
    @Query('incluirInactivas') incluirInactivas?: string,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.listarRutas(tenantId, incluirInactivas === 'true');
  }

  @Get('rutas/:id')
  async obtenerRuta(@Req() req: RequestWithAuth, @Param('id') id: string) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.obtenerRuta(tenantId, id);
  }

  @Permiso('costos.gestionar')
  @Post('rutas')
  async crearRuta(@Req() req: RequestWithAuth, @Body() dto: CrearRutaDto) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.crearRuta(tenantId, dto);
  }

  @Permiso('costos.gestionar')
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

  @Permiso('costos.gestionar')
  @Post('rutas/:id/duplicar')
  async duplicarRuta(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: DuplicarRutaDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.duplicarRuta(tenantId, id, dto);
  }

  @Permiso('costos.gestionar')
  @Post('rutas/:id/migrar-productos')
  async migrarProductosRuta(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: MigrarProductosRutaDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.migrarProductosRuta(
      tenantId,
      id,
      dto.rutaAlternativaIds,
    );
  }

  @Permiso('costos.gestionar')
  @Delete('rutas/:id')
  @HttpCode(204)
  async eliminarRuta(@Req() req: RequestWithAuth, @Param('id') id: string) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    await this.service.eliminarRuta(tenantId, id);
  }

  // === PRODUCTO ↔ RUTAS ALTERNATIVAS ===

  @Permiso('costos.gestionar')
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

  @Permiso('costos.gestionar')
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

  @Permiso('costos.gestionar')
  @Post('productos/rutas-alternativas/:rutaAltId/duplicar')
  async duplicarProductoRutaAlternativa(
    @Req() req: RequestWithAuth,
    @Param('rutaAltId') rutaAltId: string,
    @Body() dto: DuplicarProductoRutaAlternativaDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.duplicarProductoRutaAlternativa(
      tenantId,
      rutaAltId,
      dto,
    );
  }

  @Permiso('costos.gestionar')
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

  @Permiso('costos.gestionar')
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
  listarFamilias(@Req() req: RequestWithAuth) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.listarFamilias(tenantId);
  }

  // ── Familias del tenant (pasos componibles, Etapa C) ──────────────────
  // Mismo permiso que editar rutas y productos: definir cómo se costea un
  // paso es configuración estructural (decisión §8.7 — por default sólo el
  // administrador tiene costos.gestionar).

  @Get('pasos-tenant')
  @Permiso('costos.ver')
  listarPasosTenant(@Req() req: RequestWithAuth) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.pasosTenant.listar(tenantId);
  }

  /** Las plantillas que ofrece el modal de alta. */
  @Get('pasos-tenant/plantillas')
  @Permiso('costos.ver')
  listarPlantillasPaso() {
    return this.pasosTenant.listarPlantillas();
  }

  @Post('pasos-tenant')
  @Permiso('costos.gestionar')
  crearPasoTenant(
    @Req() req: RequestWithAuth,
    @Body() dto: CrearPasoTenantDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.pasosTenant.crear(tenantId, dto);
  }

  @Patch('pasos-tenant/:id')
  @Permiso('costos.gestionar')
  actualizarPasoTenant(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: ActualizarPasoTenantDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.pasosTenant.actualizar(tenantId, id, dto);
  }

  @Put('pasos-tenant/:id/configuracion-base')
  @Permiso('costos.gestionar')
  actualizarConfiguracionBasePasoTenant(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: UpsertProductoConfigPasoDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.pasosTenant.actualizarConfiguracionBase(tenantId, id, dto);
  }

  @Put('familias/:codigo/configuracion-base')
  @Permiso('costos.gestionar')
  actualizarConfiguracionBaseFamiliaSistema(
    @Req() req: RequestWithAuth,
    @Param('codigo') codigo: string,
    @Body() dto: UpsertProductoConfigPasoDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.pasosTenant.actualizarConfiguracionBaseSistema(
      tenantId,
      codigo,
      dto,
    );
  }

  @Delete('pasos-tenant/:id')
  @Permiso('costos.gestionar')
  eliminarPasoTenant(@Req() req: RequestWithAuth, @Param('id') id: string) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.pasosTenant.eliminar(tenantId, id);
  }

  @Get('lookups-config-paso')
  async listarLookupsConfigPaso(@Req() req: RequestWithAuth) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.listarLookupsConfigPaso(tenantId);
  }

  @Get('materias-primas/buscar')
  async buscarMateriasPrimas(
    @Req() req: RequestWithAuth,
    @Query('q') q?: string,
    @Query('familias') familias?: string,
    @Query('subfamilias') subfamilias?: string,
    @Query('templateIds') templateIds?: string,
    @Query('tipoTecnico') tipoTecnico?: string,
    @Query('ids') ids?: string,
    @Query('varianteIds') varianteIds?: string,
    @Query('limit') limit?: string,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    const split = (value?: string) =>
      value
        ?.split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    return this.service.buscarMateriasPrimas(tenantId, {
      q,
      familias: split(familias),
      subfamilias: split(subfamilias),
      templateIds: split(templateIds),
      tipoTecnico: split(tipoTecnico),
      ids: split(ids),
      varianteIds: split(varianteIds),
      limit: limit ? Number(limit) : undefined,
    });
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

  @Permiso('costos.gestionar')
  @Post('cargos-directos')
  async crearCargoDirecto(
    @Req() req: RequestWithAuth,
    @Body() dto: CrearCargoDirectoDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.crearCargoDirecto(tenantId, dto);
  }

  @Permiso('costos.gestionar')
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

  @Permiso('costos.gestionar')
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

  @Permiso('costos.gestionar')
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

  @Permiso('costos.gestionar')
  @Patch('productos/cargos-cotizacion/:asociacionId')
  async actualizarCargoCotizacion(
    @Req() req: RequestWithAuth,
    @Param('asociacionId') asociacionId: string,
    @Body() dto: ActualizarAsociacionCargoDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.actualizarCargoCotizacion(tenantId, asociacionId, dto);
  }

  @Permiso('costos.gestionar')
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

  @Permiso('costos.gestionar')
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

  @Permiso('costos.gestionar')
  @Patch('productos/config-pasos/cargos/:asociacionId')
  async actualizarCargoPaso(
    @Req() req: RequestWithAuth,
    @Param('asociacionId') asociacionId: string,
    @Body() dto: ActualizarAsociacionCargoDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.actualizarCargoPaso(tenantId, asociacionId, dto);
  }

  @Permiso('costos.gestionar')
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

  @Permiso('costos.gestionar')
  @Post('productos/config-pasos/cargos/:asociacionId/distribuir-niveles')
  async distribuirCargoPasoPorNiveles(
    @Req() req: RequestWithAuth,
    @Param('asociacionId') asociacionId: string,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.distribuirCargoPasoPorNiveles(tenantId, asociacionId);
  }

  // === PASOS EXTRAS INLINE (G-F3) ===

  @Permiso('costos.gestionar')
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

  @Permiso('costos.gestionar')
  @Patch('productos/pasos-extras/:pasoExtraId')
  async actualizarPasoExtra(
    @Req() req: RequestWithAuth,
    @Param('pasoExtraId') pasoExtraId: string,
    @Body() dto: ActualizarPasoExtraDto,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Falta tenant en auth');
    return this.service.actualizarPasoExtra(tenantId, pasoExtraId, dto);
  }

  @Permiso('costos.gestionar')
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
