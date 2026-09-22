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
import { Permiso } from '../auth/permiso.decorator';
import { AsignacionPersonalService } from './asignacion-personal.service';
import { RequiereCapacidad } from '../suscripciones/capacidad.guard';
import {
  ConfirmarAsignacionPersonalDto,
  SimularAsignacionPersonalDto,
} from './dto/asignacion-personal.dto';

@Permiso('produccion.supervisar')
@RequiereCapacidad('asignacion_automatica')
@Controller('ordenes-trabajo/tablero/pasos/:pasoId/asignacion-personal')
export class AsignacionPersonalController {
  constructor(private readonly asignacion: AsignacionPersonalService) {}

  @Get()
  contexto(
    @CurrentSession() auth: CurrentAuth,
    @Param('pasoId', ParseUUIDPipe) pasoId: string,
  ) {
    return this.asignacion.contexto(auth, pasoId);
  }

  @Post('simular')
  simular(
    @CurrentSession() auth: CurrentAuth,
    @Param('pasoId', ParseUUIDPipe) pasoId: string,
    @Body() body: SimularAsignacionPersonalDto,
  ) {
    return this.asignacion.simular(auth, pasoId, body.empleadoIds);
  }

  @Post('confirmar')
  confirmar(
    @CurrentSession() auth: CurrentAuth,
    @Param('pasoId', ParseUUIDPipe) pasoId: string,
    @Body() body: ConfirmarAsignacionPersonalDto,
  ) {
    return this.asignacion.confirmar(auth, pasoId, body);
  }
}
