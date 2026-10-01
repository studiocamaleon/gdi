import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';
import {
  ComandoReservasDto,
  PoliticaReservasDto,
  InicioInventarioDto,
} from './dto/comando-reservas.dto';
import { ReservasMaterialService } from './reservas-material.service';
@Controller()
export class ReservasMaterialController {
  constructor(private readonly reservas: ReservasMaterialService) {}
  @Get('inventario/inicio')
  @Permiso(
    'comercial.ordenes.ver',
    'comercial.presupuestos.ver',
    'inventario.stock.ver',
  )
  inicio(@CurrentSession() auth: CurrentAuth) {
    return this.reservas.consultarInicio(auth.tenantId);
  }
  @Put('inventario/inicio')
  @Permiso('inventario.stock.gestionar')
  configurarInicio(
    @CurrentSession() auth: CurrentAuth,
    @Body() data: InicioInventarioDto,
  ) {
    return this.reservas.guardarInicio(auth, data);
  }
  @Get('inventario/reservas/configuracion')
  @Permiso('inventario.stock.ver')
  politica(@CurrentSession() auth: CurrentAuth) {
    return this.reservas.politica(auth.tenantId);
  }
  @Put('inventario/reservas/configuracion')
  @Permiso('inventario.stock.gestionar')
  configurar(
    @CurrentSession() auth: CurrentAuth,
    @Body() data: PoliticaReservasDto,
  ) {
    return this.reservas.guardarPolitica(auth.tenantId, data);
  }
  @Get('inventario/reservas/:varianteId')
  @Permiso('inventario.stock.ver')
  listar(
    @CurrentSession() auth: CurrentAuth,
    @Param('varianteId', ParseUUIDPipe) varianteId: string,
    @Query('ubicacionId', new ParseUUIDPipe({ optional: true }))
    ubicacionId?: string,
  ) {
    return this.reservas.listarReservas(auth.tenantId, varianteId, ubicacionId);
  }
  @Post('ordenes-trabajo/:id/materiales/operaciones')
  @Permiso('inventario.stock.gestionar')
  ejecutar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: ComandoReservasDto,
  ) {
    return this.reservas.ejecutar(auth, id, data);
  }
}
