import { Global, Module } from '@nestjs/common';

import { SecretosService } from './cripto/secretos.service';
import { IntegracionesController } from './integraciones.controller';
import { IntegracionesService } from './integraciones.service';
import { WatiClient } from './wati/wati.client';
import { DespachoService } from './notificaciones/despacho.service';
import { NotificacionesController } from './notificaciones/notificaciones.controller';
import { NotificacionesScheduler } from './notificaciones/notificaciones.scheduler';
import { NotificacionesService } from './notificaciones/notificaciones.service';
import { WatiScheduler } from './wati/wati.scheduler';

/**
 * Cimientos compartidos por todas las integraciones con terceros.
 *
 * Por ahora sólo el cifrado de credenciales, pero es global a propósito: Wati,
 * AFIP y Mercado Pago van a guardar secretos con las mismas exigencias, y una
 * implementación por integración es la forma segura de terminar con tres
 * criterios distintos y dos mal hechos.
 *
 * Ver docs/integraciones-wati-diseno.md
 */
@Global()
@Module({
  controllers: [IntegracionesController, NotificacionesController],
  providers: [
    SecretosService,
    IntegracionesService,
    WatiClient,
    WatiScheduler,
    DespachoService,
    NotificacionesService,
    NotificacionesScheduler,
  ],
  exports: [
    NotificacionesService,
    SecretosService,
    IntegracionesService,
    WatiClient,
  ],
})
export class IntegracionesModule {}
