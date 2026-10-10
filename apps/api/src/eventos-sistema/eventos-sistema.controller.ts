import {
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  Sse,
  UnauthorizedException,
} from '@nestjs/common';
import type { CurrentAuth } from '../auth/auth.types';
import { CurrentSession } from '../auth/current-auth.decorator';
import { Permiso, SoloAutenticado } from '../auth/permiso.decorator';
import { EventosSistemaService } from './eventos-sistema.service';
import {
  REVALIDAR_ACCESO,
  type RequestConRevalidacion,
} from '../auth/revalidacion-acceso';

@Permiso('panel.ver')
@Controller('eventos-sistema')
export class EventosSistemaController {
  constructor(private readonly service: EventosSistemaService) {}

  // La bandeja es personal: el servicio exige tenant y usuario de la sesión.
  // No requiere acceso al Panel ni habilita el canal de cambios del negocio.
  @SoloAutenticado()
  @Get('notificaciones')
  listar(
    @CurrentSession() auth: CurrentAuth,
    @Query('limite') limite?: string,
  ) {
    return this.service.listarNotificaciones(auth, limite);
  }

  @SoloAutenticado()
  @Get('notificaciones/no-leidas')
  noLeidas(@CurrentSession() auth: CurrentAuth) {
    return this.service.contarNoLeidas(auth);
  }

  @Get('cambios')
  cambios(@CurrentSession() auth: CurrentAuth, @Query('desde') desde?: string) {
    return this.service.cambiosDesde(auth, desde);
  }

  @SoloAutenticado()
  @Patch('notificaciones/leer-todas')
  leerTodas(@CurrentSession() auth: CurrentAuth) {
    return this.service.marcarTodasLeidas(auth);
  }

  @SoloAutenticado()
  @Patch('notificaciones/:id/leer')
  leer(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.marcarLeida(auth, id);
  }

  @Sse('stream')
  stream(
    @CurrentSession() auth: CurrentAuth,
    @Req() request: RequestConRevalidacion,
    @Headers('last-event-id') lastEventId?: string,
  ) {
    const revalidar = request[REVALIDAR_ACCESO];
    if (!revalidar) throw new UnauthorizedException();
    return this.service.stream(auth, revalidar, lastEventId);
  }
}
