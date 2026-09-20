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
} from './dto/comando-reservas.dto';
import { ReservasMaterialService } from './reservas-material.service';
@Controller()
export class ReservasMaterialController {
  constructor(private readonly reservas: ReservasMaterialService) {}
  @Get('inventario/reservas/configuracion')
  @Permiso('inventario.ver')
  politica(@CurrentSession() auth: CurrentAuth) {
    return this.reservas.politica(auth.tenantId);
  }
  @Put('inventario/reservas/configuracion')
  @Permiso('inventario.gestionar')
  configurar(
    @CurrentSession() auth: CurrentAuth,
    @Body() data: PoliticaReservasDto,
  ) {
    return this.reservas.guardarPolitica(auth.tenantId, data);
  }
  @Get('inventario/reservas/:varianteId')
  @Permiso('inventario.ver')
  listar(
    @CurrentSession() auth: CurrentAuth,
    @Param('varianteId', ParseUUIDPipe) varianteId: string,
    @Query('ubicacionId', new ParseUUIDPipe({ optional: true }))
    ubicacionId?: string,
  ) {
    return this.reservas.listarReservas(auth.tenantId, varianteId, ubicacionId);
  }
  @Post('ordenes-trabajo/:id/materiales/operaciones')
  @Permiso('inventario.gestionar')
  ejecutar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: ComandoReservasDto,
  ) {
    return this.reservas.ejecutar(auth, id, data);
  }
}
