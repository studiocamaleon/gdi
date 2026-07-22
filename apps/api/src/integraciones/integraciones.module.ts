import { Global, Module } from '@nestjs/common';

import { SecretosService } from './cripto/secretos.service';

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
  providers: [SecretosService],
  exports: [SecretosService],
})
export class IntegracionesModule {}
