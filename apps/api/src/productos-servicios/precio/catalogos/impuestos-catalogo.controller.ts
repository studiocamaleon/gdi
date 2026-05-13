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
import { ImpuestosCatalogoService } from './impuestos-catalogo.service';
import {
  ActualizarImpuestoCatalogoDto,
  CrearImpuestoCatalogoDto,
} from '../dto/impuesto-catalogo.dto';

interface RequestWithAuth extends Request {
  auth?: { tenantId: string; userId: string };
}

function tenantId(req: RequestWithAuth): string {
  const t = req.auth?.tenantId;
  if (!t) throw new UnauthorizedException('Falta tenant en auth');
  return t;
}

/**
 * Controller del catálogo de impuestos del tenant.
 * URL: /productos-servicios/impuestos-catalogo
 */
@Controller('productos-servicios/impuestos-catalogo')
export class ImpuestosCatalogoController {
  constructor(private readonly service: ImpuestosCatalogoService) {}

  @Get()
  async listar(
    @Req() req: RequestWithAuth,
    @Query('soloActivos') soloActivos?: string,
  ) {
    const filtro = soloActivos !== 'false';
    return this.service.listar(tenantId(req), filtro);
  }

  @Get(':id')
  async obtener(@Req() req: RequestWithAuth, @Param('id') id: string) {
    return this.service.obtener(tenantId(req), id);
  }

  @Post()
  async crear(
    @Req() req: RequestWithAuth,
    @Body() dto: CrearImpuestoCatalogoDto,
  ) {
    return this.service.crear(tenantId(req), dto);
  }

  @Patch(':id')
  async actualizar(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: ActualizarImpuestoCatalogoDto,
  ) {
    return this.service.actualizar(tenantId(req), id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  async eliminar(@Req() req: RequestWithAuth, @Param('id') id: string) {
    return this.service.eliminar(tenantId(req), id);
  }
}
