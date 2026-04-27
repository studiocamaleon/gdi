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
import { ComisionesCatalogoService } from './comisiones-catalogo.service';
import {
  ActualizarComisionCatalogoDto,
  CrearComisionCatalogoDto,
} from '../dto/comision-catalogo.dto';

interface RequestWithAuth extends Request {
  auth?: { tenantId: string; userId: string };
}

function tenantId(req: RequestWithAuth): string {
  const t = req.auth?.tenantId;
  if (!t) throw new UnauthorizedException('Falta tenant en auth');
  return t;
}

@Controller('productos-servicios/comisiones-catalogo')
export class ComisionesCatalogoController {
  constructor(private readonly service: ComisionesCatalogoService) {}

  @Get()
  async listar(@Req() req: RequestWithAuth, @Query('soloActivos') soloActivos?: string) {
    const filtro = soloActivos !== 'false';
    return this.service.listar(tenantId(req), filtro);
  }

  @Get(':id')
  async obtener(@Req() req: RequestWithAuth, @Param('id') id: string) {
    return this.service.obtener(tenantId(req), id);
  }

  @Post()
  async crear(@Req() req: RequestWithAuth, @Body() dto: CrearComisionCatalogoDto) {
    return this.service.crear(tenantId(req), dto);
  }

  @Patch(':id')
  async actualizar(
    @Req() req: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: ActualizarComisionCatalogoDto,
  ) {
    return this.service.actualizar(tenantId(req), id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  async eliminar(@Req() req: RequestWithAuth, @Param('id') id: string) {
    return this.service.eliminar(tenantId(req), id);
  }
}
