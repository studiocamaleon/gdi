import { enContextoDe } from '../contexto';
import {
  getCurrentTenantId,
  runWithTenant,
} from '../../../common/tenant-context';

/**
 * Este helper existe porque las rutas públicas —aprobar un presupuesto desde
 * el link del cliente— no pasan por el guard y no tienen tenant en contexto.
 * Sin él, el aviso fallaba con "sin contexto de tenant" y se perdía callado.
 *
 * Pero al resolver eso aparece un riesgo: si el tenant saliera SIEMPRE de la
 * entidad, pasar el id de una entidad ajena sería una forma de saltarse el
 * aislamiento. Por eso el contexto existente siempre gana.
 */
describe('enContextoDe', () => {
  it('sin contexto previo usa el de la entidad', async () => {
    const visto = await enContextoDe('tenant-de-la-entidad', () =>
      Promise.resolve(getCurrentTenantId()),
    );
    expect(visto).toBe('tenant-de-la-entidad');
  });

  it('con contexto previo NO lo pisa, aunque la entidad diga otra cosa', async () => {
    const visto = await runWithTenant('tenant-de-la-sesion', () =>
      enContextoDe('tenant-ajeno', () => Promise.resolve(getCurrentTenantId())),
    );
    expect(visto).toBe('tenant-de-la-sesion');
  });

  it('deja pasar el valor devuelto', async () => {
    await expect(enContextoDe('t', () => Promise.resolve(42))).resolves.toBe(
      42,
    );
  });
});
