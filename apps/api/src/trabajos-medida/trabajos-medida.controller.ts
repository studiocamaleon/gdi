import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso, RequiereVista } from '../auth/permiso.decorator';
import { TrabajoMedidaDto } from './trabajo-medida.dto';
import { TrabajosMedidaService } from './trabajos-medida.service';
import { PERMISO_TRABAJO_MEDIDA } from './trabajo-medida.permiso';

@Controller('trabajos-medida')
@Permiso(PERMISO_TRABAJO_MEDIDA)
@RequiereVista(
  'comercial.ordenes.gestionar',
  'comercial.presupuestos.gestionar',
)
export class TrabajosMedidaController {
  constructor(private readonly trabajos: TrabajosMedidaService) {}
  @Get('opciones') opciones(@CurrentSession() auth: CurrentAuth) {
    return this.trabajos.opciones(auth);
  }
  @Get(':id') obtener(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.trabajos.obtener(auth, id);
  }
  @Post('calcular') calcular(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: TrabajoMedidaDto,
  ) {
    return this.trabajos.calcular(auth, dto);
  }
  @Post('guardar') guardar(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: TrabajoMedidaDto,
  ) {
    return this.trabajos.guardar(auth, dto);
  }
}
