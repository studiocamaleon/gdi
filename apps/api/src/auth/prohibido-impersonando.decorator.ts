import { SetMetadata } from '@nestjs/common';

export const PROHIBIDO_IMPERSONANDO = 'prohibidoImpersonando';

/**
 * Marca un endpoint como NO ejecutable durante una impersonación.
 *
 * El staff que entra a un tenant diagnostica y opera el negocio del cliente;
 * no toma control de su cuenta. Por eso quedan afuera: conectar/desconectar
 * integraciones, administrar usuarios y borrar archivos — todo lo que
 * cambiaría el acceso o destruiría datos del cliente.
 *
 * El ImpersonacionGuard (global) lo hace cumplir: con `auth.impersonacion`
 * presente en un handler marcado, responde 403.
 * Ver docs/control-plane-diseno.md (etapa C, límites deliberados).
 */
export const ProhibidoImpersonando = () =>
  SetMetadata(PROHIBIDO_IMPERSONANDO, true);
