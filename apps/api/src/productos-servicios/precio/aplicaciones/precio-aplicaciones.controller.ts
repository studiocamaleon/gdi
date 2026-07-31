import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrecioAplicacionesService } from './precio-aplicaciones.service';
import {
  AsignarComisionesBatchDto,
  AsignarImpuestosBatchDto,
  CategoriaFiscalDto,
} from '../dto/precio-aplicacion.dto';
import { Permiso } from '../../../auth/permiso.decorator';

interface RequestWithAuth extends Request {
  auth?: { tenantId: string; userId: string };
}

function tenantId(req: RequestWithAuth): string {
  const t = req.auth?.tenantId;
  if (!t) throw new UnauthorizedException('Falta tenant en auth');
  return t;
}

/**
 * Endpoints de aplicación de impuestos/comisiones a un producto.
 * URL base: /productos-servicios/productos/:productoId/precio
 *
 * GET impuestos        — listar aplicados
 * PUT impuestos        — replace-all (recibe lista completa)
 * DELETE impuestos/:id — quitar uno (utilitario)
 *
 * Idem comisiones.
 */
@Permiso('costos.ver')
@Controller('productos-servicios/productos/:productoId/precio')
export class PrecioAplicacionesController {
  constructor(private readonly service: PrecioAplicacionesService) {}

  // ── Impuestos ───────────────────────────────────────────────────────

  @Get('impuestos')
  async listarImpuestos(
    @Req() req: RequestWithAuth,
    @Param('productoId') productoId: string,
  ) {
    return this.service.listarImpuestosAplicados(tenantId(req), productoId);
  }

  @Permiso('costos.gestionar')
  @Put('impuestos')
  async setImpuestos(
    @Req() req: RequestWithAuth,
    @Param('productoId') productoId: string,
    @Body() dto: AsignarImpuestosBatchDto,
  ) {
    return this.service.setImpuestos(tenantId(req), productoId, dto);
  }

  @Permiso('costos.gestionar')
  @Delete('impuestos/:impuestoCatalogoId')
  @HttpCode(200)
  async quitarImpuesto(
    @Req() req: RequestWithAuth,
    @Param('productoId') productoId: string,
    @Param('impuestoCatalogoId') impuestoCatalogoId: string,
  ) {
    return this.service.quitarImpuesto(
      tenantId(req),
      productoId,
      impuestoCatalogoId,
    );
  }

  // ── Categoría fiscal (Fase 2: el IVA se resuelve por categoría) ──────

  @Get('categoria-fiscal')
  async getCategoriaFiscal(
    @Req() req: RequestWithAuth,
    @Param('productoId') productoId: string,
  ) {
    return this.service.getCategoriaFiscal(tenantId(req), productoId);
  }

  @Permiso('costos.gestionar')
  @Put('categoria-fiscal')
  async setCategoriaFiscal(
    @Req() req: RequestWithAuth,
    @Param('productoId') productoId: string,
    @Body() dto: CategoriaFiscalDto,
  ) {
    return this.service.setCategoriaFiscal(tenantId(req), productoId, dto);
  }

  // ── Comisiones ──────────────────────────────────────────────────────

  @Get('comisiones')
  async listarComisiones(
    @Req() req: RequestWithAuth,
    @Param('productoId') productoId: string,
  ) {
    return this.service.listarComisionesAplicadas(tenantId(req), productoId);
  }

  @Permiso('costos.gestionar')
  @Put('comisiones')
  async setComisiones(
    @Req() req: RequestWithAuth,
    @Param('productoId') productoId: string,
    @Body() dto: AsignarComisionesBatchDto,
  ) {
    return this.service.setComisiones(tenantId(req), productoId, dto);
  }

  @Permiso('costos.gestionar')
  @Delete('comisiones/:comisionCatalogoId')
  @HttpCode(200)
  async quitarComision(
    @Req() req: RequestWithAuth,
    @Param('productoId') productoId: string,
    @Param('comisionCatalogoId') comisionCatalogoId: string,
  ) {
    return this.service.quitarComision(
      tenantId(req),
      productoId,
      comisionCatalogoId,
    );
  }
}
