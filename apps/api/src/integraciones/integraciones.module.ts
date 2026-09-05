import { AutomaticosWebController } from './whatsapp-web/automaticos.controller';
import { AutomaticosWebService } from './whatsapp-web/automaticos.service';
import { Global, Module } from '@nestjs/common';

import { DatosEmpresaModule } from '../tenants/datos-empresa.module';
import { SecretosService } from './cripto/secretos.service';
import { IntegracionesController } from './integraciones.controller';
import { IntegracionesService } from './integraciones.service';
import { WatiClient } from './wati/wati.client';
import { DespachoService } from './notificaciones/despacho.service';
import { NotificacionesController } from './notificaciones/notificaciones.controller';
import { NotificacionesCobrosService } from './notificaciones/notificaciones-cobros.service';
import { NotificacionesComprobantesService } from './notificaciones/notificaciones-comprobantes.service';
import { NotificacionesOrdenesService } from './notificaciones/notificaciones-ordenes.service';
import { NotificacionesPresupuestosService } from './notificaciones/notificaciones-presupuestos.service';
import { NotificacionesResenasService } from './notificaciones/notificaciones-resenas.service';
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
  imports: [DatosEmpresaModule],
  // El ORDEN importa y no es cosmético: IntegracionesController tiene
  // `@Get(':proveedor')`, que matchea cualquier segmento — incluido
  // `/integraciones/notificaciones`. Registrado primero, se comía la ruta y el
  // ParseEnumPipe contestaba "Validation failed (enum string is expected)".
  // Nest resuelve por orden de registro, así que las rutas concretas van antes
  // que las que tienen comodín.
  controllers: [
    AutomaticosWebController,
    NotificacionesController,
    IntegracionesController,
  ],
  providers: [
    AutomaticosWebService,
    SecretosService,
    IntegracionesService,
    WatiClient,
    WatiScheduler,
    DespachoService,
    NotificacionesService,
    NotificacionesOrdenesService,
    NotificacionesPresupuestosService,
    NotificacionesCobrosService,
    NotificacionesComprobantesService,
    NotificacionesResenasService,
    NotificacionesScheduler,
  ],
  exports: [
    NotificacionesService,
    NotificacionesOrdenesService,
    NotificacionesPresupuestosService,
    NotificacionesCobrosService,
    NotificacionesComprobantesService,
    NotificacionesResenasService,
    SecretosService,
    IntegracionesService,
    WatiClient,
  ],
})
export class IntegracionesModule {}
