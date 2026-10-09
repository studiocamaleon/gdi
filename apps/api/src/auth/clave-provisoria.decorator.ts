import { SetMetadata } from '@nestjs/common';

export const CLAVE_PROVISORIA = 'clave_provisoria';
/** Sólo consultar la sesión, elegir clave personal y cerrar sesión. */
export const PermitirClaveProvisoria = () =>
  SetMetadata(CLAVE_PROVISORIA, true);
