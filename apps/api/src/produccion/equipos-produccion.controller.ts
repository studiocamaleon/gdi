import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';
import { EquipoProduccionDto } from './dto/equipo-produccion.dto';
import { EquiposProduccionService } from './equipos-produccion.service';

@Permiso('produccion.configurar')
@Controller('produccion/equipos')
export class EquiposProduccionController {
  constructor(private readonly service: EquiposProduccionService) {}

  @Get()
  listar(@CurrentSession() auth: CurrentAuth) {
    return this.service.listar(auth.tenantId);
  }

  @Post()
  crear(@CurrentSession() auth: CurrentAuth, @Body() dto: EquipoProduccionDto) {
    return this.service.guardar(auth.tenantId, dto);
  }

  @Put(':id')
  actualizar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EquipoProduccionDto,
  ) {
    return this.service.guardar(auth.tenantId, dto, id);
  }
}
