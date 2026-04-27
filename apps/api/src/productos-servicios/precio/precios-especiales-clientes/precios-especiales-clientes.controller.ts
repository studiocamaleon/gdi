import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PreciosEspecialesClientesService } from './precios-especiales-clientes.service';
import {
  ActualizarPrecioEspecialClienteDto,
  CrearPrecioEspecialClienteDto,
} from '../dto/precio-especial-cliente.dto';

interface RequestWithAuth extends Request {
  auth?: { tenantId: string; userId: string };
}

function tenantId(req: RequestWithAuth): string {
  const t = req.auth?.tenantId;
  if (!t) throw new UnauthorizedException('Falta tenant en auth');
  return t;
}

/**
 * URL base: /productos-servicios/productos/:productoId/precios-especiales
 *
 *   GET    /                                — listar todos los del producto
 *   POST   /                                — crear nuevo (cliente + config)
 *   PATCH  /productos-servicios/precios-especiales/:id   — actualizar config / activo
 *   DELETE /productos-servicios/precios-especiales/:id   — borrar
 *
 * Las rutas de actualizar/borrar usan path absoluto sin productoId porque el
 * id del precio especial es único globalmente.
 */
@Controller()
export class PreciosEspecialesClientesController {
  constructor(private readonly service: PreciosEspecialesClientesService) {}

  @Get('productos-servicios/productos/:productoId/precios-especiales')
  async listar(@Req() req: RequestWithAuth, @Param('productoId') productoId: string) {
    return this.service.listarPorProducto(tenantId(req), productoId);
  }

  @Post('productos-servicios/productos/:productoId/precios-especiales')
  async crear(
    @Req() req: RequestWithAuth,
    @Param('productoId') productoId: string,
    @Body() dto: CrearPrecioEspecialClienteDto,
  ) {
    return this.service.crear(tenantId(req), productoId, dto);
  }

  @Patch('productos-servicios/precios-especiales/:id')
  async actualizar(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: ActualizarPrecioEspecialClienteDto,
  ) {
    return this.service.actualizar(tenantId(req), id, dto);
  }

  @Delete('productos-servicios/precios-especiales/:id')
  @HttpCode(200)
  async eliminar(@Req() req: RequestWithAuth, @Param('id') id: string) {
    return this.service.eliminar(tenantId(req), id);
  }
}
