import {
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Sse,
} from '@nestjs/common';
import type { CurrentAuth } from '../auth/auth.types';
import { CurrentSession } from '../auth/current-auth.decorator';
import { Permiso } from '../auth/permiso.decorator';
import { EventosSistemaService } from './eventos-sistema.service';

@Permiso('panel.ver')
@Controller('eventos-sistema')
export class EventosSistemaController {
  constructor(private readonly service: EventosSistemaService) {}

  @Get('notificaciones')
  listar(
    @CurrentSession() auth: CurrentAuth,
    @Query('limite') limite?: string,
  ) {
    return this.service.listarNotificaciones(auth, limite);
  }

  @Get('notificaciones/no-leidas')
  noLeidas(@CurrentSession() auth: CurrentAuth) {
    return this.service.contarNoLeidas(auth);
  }

  @Get('cambios')
  cambios(@CurrentSession() auth: CurrentAuth, @Query('desde') desde?: string) {
    return this.service.cambiosDesde(auth, desde);
  }

  @Patch('notificaciones/leer-todas')
  leerTodas(@CurrentSession() auth: CurrentAuth) {
    return this.service.marcarTodasLeidas(auth);
  }

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
    @Headers('last-event-id') lastEventId?: string,
  ) {
    return this.service.stream(auth, lastEventId);
  }
}
