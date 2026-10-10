import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';
import { RequiereCapacidad } from '../suscripciones/capacidad.guard';
import {
  ConfirmarReprogramacionDto,
  SimularReprogramacionDto,
} from './dto/reprogramacion.dto';
import { ReprogramacionService } from './reprogramacion.service';

@Permiso('produccion.planificacion.ver')
@RequiereCapacidad('planificacion_avanzada')
@Controller('ordenes-trabajo/tablero/pasos/:pasoId/reprogramacion')
export class ReprogramacionController {
  constructor(private readonly servicio: ReprogramacionService) {}
  @Post('simular')
  simular(
    @CurrentSession() auth: CurrentAuth,
    @Param('pasoId', ParseUUIDPipe) pasoId: string,
    @Body() body: SimularReprogramacionDto,
  ) {
    return this.servicio.simular(auth, pasoId, body);
  }
  @Post('confirmar')
  confirmar(
    @CurrentSession() auth: CurrentAuth,
    @Param('pasoId', ParseUUIDPipe) pasoId: string,
    @Body() body: ConfirmarReprogramacionDto,
  ) {
    return this.servicio.confirmar(auth, pasoId, body);
  }
}
