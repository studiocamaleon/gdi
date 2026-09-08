import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { serviciosRecorridoF4 } from '../../../test/soporte-recorridos-f4';
import type { CurrentAuth } from '../../auth/auth.types';

describe('ejecución concurrente de un lote real (PostgreSQL)', () => {
  const db = new PrismaClient();
  const tenantId = randomUUID();
  // A diferencia de las otras fixtures, se confirma una cuenta exclusivamente
  // de prueba para que dos conexiones puedan competir por el mismo paso.
  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: tenantId } });
    expect(await db.ordenTrabajoItemPaso.count({ where: { tenantId } })).toBe(
      0,
    );
    await db.$disconnect();
  });

  it('respeta gates, registra un solo inicio/cierre y sincroniza las participaciones sin duplicar tiempo', async () => {
    await db.tenant.create({
      data: {
        id: tenantId,
        slug: `f4-concurrencia-${tenantId}`,
        nombre: 'Aceptación F4 · concurrencia',
      },
    });
    const actor = await db.user.findFirstOrThrow();
    const auth = {
      tenantId,
      userId: actor.id,
      email: actor.email,
      permisos: new Set(['produccion.supervisar']),
    } as CurrentAuth;
    const { ordenes } = serviciosRecorridoF4(db);
    const orden = await db.ordenTrabajo.create({
      data: {
        tenantId,
        numero: 'OT-PRUEBA-CONCURRENTE',
        estado: 'pendiente',
        items: {
          create: {
            tenantId,
            codigo: 'KIT',
            nombre: 'Kit con lote compartido',
            familia: 'Kit',
            cantidad: 10,
            cantidadUnidad: 'unidad',
            subtotal: 100,
            impuestos: 0,
            total: 100,
          },
        },
      },
      include: { items: true },
    });
    const raiz = orden.items[0];
    const pasos = [];
    for (let i = 0; i < 2; i++) {
      const item = await db.ordenTrabajoItem.create({
        data: {
          tenantId,
          ordenId: orden.id,
          parentItemId: raiz.id,
          codigo: `VINILO-${i}`,
          nombre: `Vinilo ${i}`,
          familia: 'Vinilo',
          cantidad: 30,
          cantidadUnidad: 'unidad',
          subtotal: 0,
          impuestos: 0,
          total: 0,
        },
      });
      pasos.push(
        await db.ordenTrabajoItemPaso.create({
          data: {
            tenantId,
            ordenId: orden.id,
            itemId: item.id,
            indice: 0,
            nodoClave: 'ruta:imprimir',
            nombre: 'Imprimir lote',
            familiaCodigo: 'impresion_por_area',
            categoriaFamilia: 'produccion',
            modoRegistro: 'cronometro',
            nestingLoteId: 'lote-f4',
            nestingLoteRol: i === 0 ? 'OPERATIVO' : 'PARTICIPANTE',
            duracionEstimadaMin: i === 0 ? 30 : 0,
          },
        }),
      );
    }
    const [operativo, alias] = pasos;
    const gate = await db.ordenTrabajoPasoGate.create({
      data: {
        tenantId,
        ordenId: orden.id,
        pasoId: operativo.id,
        tipo: 'MATERIAL',
        estado: 'PENDIENTE',
      },
    });
    const accionar = (accion: 'iniciar' | 'completar') =>
      ordenes.accionPaso(auth, orden.id, operativo.itemId, operativo.id, {
        accion,
      });
    await expect(accionar('iniciar')).rejects.toThrow(
      /condici|Material|material/,
    );
    expect(await db.ordenTrabajoPasoTramo.count({ where: { tenantId } })).toBe(
      0,
    );
    await ordenes.resolverGatePaso(auth, operativo.id, {
      tipo: 'MATERIAL',
      estado: 'CUMPLIDO',
      detalle: 'Material confirmado para el lote',
    });
    expect(
      await db.ordenTrabajoPasoGate.findUnique({ where: { id: gate.id } }),
    ).toMatchObject({ resueltoPorId: actor.id, estado: 'CUMPLIDO' });
    const inicios = await Promise.allSettled([
      accionar('iniciar'),
      accionar('iniciar'),
    ]);
    expect(inicios.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await db.ordenTrabajoPasoTramo.count({
        where: { pasoId: operativo.id, finEl: null },
      }),
    ).toBe(1);
    expect(
      await db.ordenTrabajoItemPaso.findUnique({ where: { id: alias.id } }),
    ).toMatchObject({ estado: 'en_curso' });
    const cierres = await Promise.allSettled([
      accionar('completar'),
      accionar('completar'),
    ]);
    expect(cierres.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.ordenTrabajoPasoTramo.count({ where: { tenantId } })).toBe(
      1,
    );
    expect(
      await db.ordenTrabajoPasoTramo.count({
        where: { tenantId, finEl: null },
      }),
    ).toBe(0);
    expect(
      await db.ordenTrabajo.findUnique({ where: { id: orden.id } }),
    ).toMatchObject({ estado: 'finalizada', progresoPct: 100 });
    const participacion = await db.ordenTrabajoItemPaso.findUniqueOrThrow({
      where: { id: alias.id },
    });
    expect(participacion.estado).toBe('hecho');
    expect(Number(participacion.tiempoRealMin)).toBe(0);
    expect(
      await db.ordenTrabajoEvento.count({ where: { tenantId, tipo: 'paso' } }),
    ).toBe(2);
    expect(
      await db.ordenTrabajoItemPaso.count({
        where: { tenantId, nestingLoteRol: 'OPERATIVO' },
      }),
    ).toBe(1);
  });
});
