import { Global, Module } from '@nestjs/common';

import { SecretosService } from './cripto/secretos.service';
import { IntegracionesController } from './integraciones.controller';
import { IntegracionesService } from './integraciones.service';
import { WatiClient } from './wati/wati.client';
import { DespachoService } from './notificaciones/despacho.service';
import { NotificacionesController } from './notificaciones/notificaciones.controller';
import { NotificacionesOrdenesService } from './notificaciones/notificaciones-ordenes.service';
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
  // El ORDEN importa y no es cosmético: IntegracionesController tiene
  // `@Get(':proveedor')`, que matchea cualquier segmento — incluido
  // `/integraciones/notificaciones`. Registrado primero, se comía la ruta y el
  // ParseEnumPipe contestaba "Validation failed (enum string is expected)".
  // Nest resuelve por orden de registro, así que las rutas concretas van antes
  // que las que tienen comodín.
  controllers: [NotificacionesController, IntegracionesController],
  providers: [
    SecretosService,
    IntegracionesService,
    WatiClient,
    WatiScheduler,
    DespachoService,
    NotificacionesService,
    NotificacionesOrdenesService,
    NotificacionesScheduler,
  ],
  exports: [
    NotificacionesService,
    NotificacionesOrdenesService,
    SecretosService,
    IntegracionesService,
    WatiClient,
  ],
})
export class IntegracionesModule {}
