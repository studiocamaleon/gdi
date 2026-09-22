import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { contarContinuidadImpresion } from './continuidad-impresion';
import { operacionesCambioPlan } from '../plataforma/planes/operaciones-cambio-plan';
import { ordenImpresionFixture } from '../../test/fixture-impresion-planes';

const db = new PrismaClient();
afterAll(() => db.$disconnect());
async function escenario(
  fn: (
    tenantId: string,
    tx: Parameters<typeof contarContinuidadImpresion>[0],
  ) => Promise<void>,
) {
  const rollback = new Error('Sólo fixture de test');
  await db
    .$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { nombre: 'Ensayo de continuidad', slug: randomUUID() },
      });
      await fn(tenant.id, tx);
      throw rollback;
    })
    .catch((e) => {
      if (e !== rollback) throw e;
    });
}

it('sin retirar impresión no consulta eventos, equipos ni archivos', async () => {
  const consulta = jest.fn();
  const operaciones = await operacionesCambioPlan(
    { $queryRaw: consulta } as never,
    randomUUID(),
    new Set(),
  );
  expect(consulta).not.toHaveBeenCalled();
  expect(operaciones.every((o) => o.cantidad === 0)).toBe(true);
  expect(operaciones.some((o) => o.codigo.startsWith('impresion_'))).toBe(
    false,
  );
});

it('separa documentos sin enviar de últimos envíos no verificados, sin duplicar reimpresiones o páginas CAD', () =>
  escenario(async (tenantId, tx) => {
    expect(await contarContinuidadImpresion(tx, tenantId)).toMatchObject({
      sinEnvio: 0,
      sinVerificar: 0,
    });
    const o = await ordenImpresionFixture(tx, tenantId);
    await o.solicitar(0);
    await o.enviar({ estado: 'ERROR', legacy: true });
    await o.enviar({ estado: 'COMPLETE' }); // Cuenta sólo este intento, aunque Windows diga terminado.
    await o.solicitar(1); // Sin envío.
    await o.solicitar(2);
    await o.enviar({ pagina: 2, estado: 'ERROR' });
    await o.enviar({ pagina: 2, verificado: true }); // No cuenta su error anterior.
    await o.enviar({ pagina: 3, estado: 'SIN_CONFIRMAR' }); // Anterior a la cola persistente.
    const operaciones = await operacionesCambioPlan(
      tx,
      tenantId,
      new Set(['colas_impresion']),
    );
    expect(operaciones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          codigo: 'impresion_sin_envio',
          cantidad: 1,
          permiteRetiradaConRevision: true,
        }),
        expect.objectContaining({
          codigo: 'impresion_sin_verificar',
          cantidad: 2,
          permiteRetiradaConRevision: true,
        }),
      ]),
    );
    const mismo = await operacionesCambioPlan(
      tx,
      tenantId,
      new Set(['impresion_directa', 'colas_impresion']),
    );
    expect(mismo).toEqual(operaciones);
  }));

it('excluye borradores, canceladas, solicitudes de ítems eliminados y datos de otra empresa', () =>
  escenario(async (tenantId, tx) => {
    for (const estado of ['borrador', 'cancelada'] as const) {
      const o = await ordenImpresionFixture(tx, tenantId, estado);
      await o.solicitar(1);
      await o.enviar({ pagina: 2 });
    }
    const huerfana = await ordenImpresionFixture(tx, tenantId);
    await huerfana.solicitar();
    await tx.ordenTrabajoItem.delete({ where: { id: huerfana.itemId } });
    const otra = await tx.tenant.create({
      data: { nombre: 'Otra', slug: randomUUID() },
    });
    const externa = await ordenImpresionFixture(tx, otra.id);
    await externa.solicitar(1);
    await externa.enviar({ pagina: 2 });
    expect(await contarContinuidadImpresion(tx, tenantId)).toMatchObject({
      sinEnvio: 0,
      sinVerificar: 0,
    });
    expect(await contarContinuidadImpresion(tx, otra.id)).toMatchObject({
      sinEnvio: 1,
      sinVerificar: 1,
    });
  }));

it('una OT entregada conserva la revisión de una salida no verificada', () =>
  escenario(async (tenantId, tx) => {
    const o = await ordenImpresionFixture(tx, tenantId, 'entregada');
    await o.enviar();
    expect(await contarContinuidadImpresion(tx, tenantId)).toMatchObject({
      sinEnvio: 0,
      sinVerificar: 1,
    });
  }));

it('la huella distingue trabajos distintos con la misma cantidad pendiente', () =>
  escenario(async (tenantId, tx) => {
    const o = await ordenImpresionFixture(tx, tenantId);
    const solicitud = await o.solicitar(1);
    await o.enviar({ pagina: 2 });
    const antes = await contarContinuidadImpresion(tx, tenantId);
    await tx.ordenTrabajoEvento.delete({ where: { id: solicitud.id } });
    await o.solicitar(3);
    await o.enviar({ pagina: 2 });
    const despues = await contarContinuidadImpresion(tx, tenantId);
    expect(despues.sinEnvio).toBe(antes.sinEnvio);
    expect(despues.sinVerificar).toBe(antes.sinVerificar);
    expect(despues.revisionSinEnvio).not.toBe(antes.revisionSinEnvio);
    expect(despues.revisionSinVerificar).not.toBe(antes.revisionSinVerificar);
  }));
