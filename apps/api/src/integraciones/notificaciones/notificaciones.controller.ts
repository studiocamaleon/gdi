import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { RolSistema } from '@prisma/client';

import { Roles } from '../../auth/roles.decorator';
import { CambiarConfigDto, CambiarEventoDto } from './notificaciones.dto';
import { NotificacionesService } from './notificaciones.service';
import type { EventoNotificacion } from '../wati/catalogo';
import { Permiso } from '../../auth/permiso.decorator';

/**
 * Configuración → Integraciones → Wati → Notificaciones.
 *
 * Leer lo puede cualquiera del tenant: saber por qué a un cliente no le llegó
 * un aviso es una pregunta de mostrador, no de administración. Escribir pide
 * ADMINISTRADOR — encender un evento le manda WhatsApps a todos los clientes
 * desde el número oficial de la empresa.
 */
@Permiso('configuracion.ver')
@Controller('integraciones/notificaciones')
export class NotificacionesController {
  constructor(private readonly service: NotificacionesService) {}

  @Get()
  async estado() {
    const [configuracion, eventos, consentimiento] = await Promise.all([
      this.service.configuracion(),
      this.service.eventos(),
      this.service.resumenConsentimiento(),
    ]);
    return { configuracion, eventos, consentimiento };
  }

  @Get('log')
  log(@Query('limite') limite?: string) {
    const n = Number(limite);
    return this.service.log(Number.isFinite(n) && n > 0 ? n : 100);
  }

  @Permiso('configuracion.gestionar')
  @Put('configuracion')
  @Roles(RolSistema.ADMINISTRADOR)
  cambiarConfiguracion(@Body() dto: CambiarConfigDto) {
    return this.service.cambiarConfiguracion(dto);
  }

  @Permiso('configuracion.gestionar')
  @Put('eventos/:evento')
  @Roles(RolSistema.ADMINISTRADOR)
  cambiarEvento(
    @Param('evento') evento: string,
    @Body() dto: CambiarEventoDto,
  ) {
    return this.service.cambiarEvento(evento as EventoNotificacion, dto.activo);
  }
}
