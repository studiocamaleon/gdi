import { SetMetadata } from '@nestjs/common';

export const ENROLAMIENTO_PLATAFORMA = 'enrolamiento_plataforma';
/** Excepción acotada: permite preparar MFA o salir, sin abrir el control plane. */
export const PermitirEnrolamientoPlataforma = () =>
  SetMetadata(ENROLAMIENTO_PLATAFORMA, true);

export function mfaPlataformaCompleta(
  mfa:
    | { activatedAt: Date | null; recuperacionConfirmadaEl: Date | null }
    | null
    | undefined,
  verificado: Date | null | undefined,
) {
  return !!(
    mfa?.activatedAt &&
    mfa.recuperacionConfirmadaEl &&
    verificado &&
    verificado >= mfa.activatedAt
  );
}
