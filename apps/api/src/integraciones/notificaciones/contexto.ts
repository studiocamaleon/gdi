import { getCurrentTenantId, runWithTenant } from '../../common/tenant-context';

/**
 * Corre `fn` con contexto de tenant, incluso si quien llamó no tenía.
 *
 * Las rutas PÚBLICAS —aprobar un presupuesto desde el link, el seguimiento de
 * una orden— no pasan por el guard de autenticación, así que no hay tenant en
 * el contexto: cada una resuelve el suyo a mano desde el token. Sin esto, un
 * aviso disparado desde ahí falla con "sin contexto de tenant" y se pierde en
 * silencio, que es exactamente lo que pasó al aprobar un presupuesto desde el
 * link del cliente.
 *
 * La regla de seguridad importa: si YA hay un tenant en contexto, gana ése.
 * El de la entidad sólo se usa cuando no hay ninguno. Al revés, pasar el id de
 * una entidad ajena sería una forma de saltar el aislamiento.
 */
export function enContextoDe<T>(
  tenantIdDeLaEntidad: string,
  fn: () => Promise<T>,
): Promise<T> {
  const actual = getCurrentTenantId();
  return runWithTenant(actual ?? tenantIdDeLaEntidad, fn);
}
