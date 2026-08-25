import { SetMetadata } from '@nestjs/common';

export const PERMITIR_SUSCRIPCION_INACTIVA_KEY =
  'permitirSuscripcionInactiva';

/** Permite una mutación imprescindible para recuperar/salir de la cuenta. */
export const PermitirSuscripcionInactiva = () =>
  SetMetadata(PERMITIR_SUSCRIPCION_INACTIVA_KEY, true);
