import { bloquearColaEntrega } from './reprogramacion-bloqueo';
import { PlanificacionEntregasService } from './planificacion.service';
import { proponerEntregasPiloto } from '../eta/planificacion/prototipo-entregas';
/* eslint-disable @typescript-eslint/require-await -- Contexto determinista de prueba. */
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrdenesTrabajoService } from '../ordenes-trabajo/ordenes-trabajo.service';
import { crearFixtureLotesF6 } from '../../test/soporte-lotes-f6';
import {
  huellaContextoPlan,
  type ResultadoPlanGuardado,
} from './planificacion-contrato';
import { exhibidorControlado } from '../../test/fixtures/f6-planificacion/exhibidor-controlado';
import type { EtaService } from '../eta/eta.service';

const db = new PrismaService();
const rollback = new Error('rollback QA');
afterAll(() => db.$disconnect());

async function fixture(tx: Prisma.TransactionClient, cambiaEntrega = false) {
  const f = await crearFixtureLotesF6(tx, db);
  const otra = await tx.ordenTrabajo.create({
    data: {
      tenantId: f.tenantId,
      numero: `QA-reprogramar-${randomUUID()}`,
      estado: 'pendiente',
      fechaEntrega: new Date('2026-09-18T00:00:00Z'),
      items: {
        create: {
          tenantId: f.tenantId,
          codigo: 'OTRA',
          nombre: 'Otro trabajo',
          familia: 'QA',
          cantidad: 1,
          cantidadUnidad: 'u',
          subtotal: 1,
          impuestos: 0,
          total: 1,
        },
      },
    },
    include: { items: true },
  });
  const paso = await tx.ordenTrabajoItemPaso.create({
    data: {
      tenantId: f.tenantId,
      ordenId: otra.id,
      itemId: otra.items[0].id,
      indice: 0,
      nombre: 'Corte',
      familiaCodigo: 'corte',
      categoriaFamilia: 'QA',
      estado: 'pendiente',
      duracionEstimadaMin: 60,
    },
  });
  const taller = {
    ...exhibidorControlado().taller,
    ahora: new Date('2026-09-10T11:00:00Z'),
    items: [],
    margenEtaDias: 2,
  };
  const eta = {
    contextoSimulacion: async () => taller,
  } as unknown as EtaService;
  const service = new OrdenesTrabajoService(
    db,
    eta,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const resultado = f.rev.resultadoJson as unknown as ResultadoPlanGuardado;
  const a = resultado.resultado.alternativas[0];
  a.id = 'reprogramar-qa';
  a.traza = a.traza.map((t) => ({
    ...t,
    fin: new Date(new Date(t.inicio).getTime() + 60_000),
  }));
  a.reprogramacion = {
    nivel: cambiaEntrega ? 'CAMBIA_ENTREGAS' : 'MARGEN_REDUCIDO',
    ordenesMovidas: [otra.id],
    agenda: [
      ...a.traza.map((t) => ({
        pasoId: t.pasoId,
        inicio: String(t.inicio),
        fin: t.fin.toISOString(),
      })),
      {
        pasoId: paso.id,
        inicio: '2026-09-17T11:00:00Z',
        fin: '2026-09-17T12:00:00Z',
        atencionPlanificada: {
          version: 1,
          contexto: 'fixture de persistencia de agenda',
          inicio: Date.parse('2026-09-17T11:00:00Z'),
          fin: Date.parse('2026-09-17T12:00:00Z'),
          finOcupacion: Date.parse('2026-09-17T12:05:00Z'),
          reservas: [
            {
              inicio: Date.parse('2026-09-17T11:00:00Z'),
              fin: Date.parse('2026-09-17T11:10:00Z'),
              personas: 1,
            },
          ],
        },
      },
    ],
    cambios: [
      {
        pasoId: paso.id,
        ordenId: otra.id,
        ordenNumero: otra.numero,
        item: 'Otro trabajo',
        operacion: 'Corte',
        recurso: 'Corte',
        inicioAnterior: '2026-09-16T11:00:00Z',
        finAnterior: '2026-09-16T12:00:00Z',
        inicio: '2026-09-17T11:00:00Z',
        fin: '2026-09-17T12:00:00Z',
      },
    ],
    entregasAfectadas: [
      {
        ordenId: otra.id,
        ordenNumero: otra.numero,
        raizId: otra.items[0].id,
        loteId: null,
        itemIds: [otra.items[0].id],
        nombre: 'Otro trabajo',
        fechaActual: '2026-09-18',
        fechaPropuesta: cambiaEntrega ? '2026-09-21' : '2026-09-18',
        finAnterior: '2026-09-16T12:00:00Z',
        finPropuesto: '2026-09-17T12:00:00Z',
        margenAnterior: 2,
        margenRestante: 1,
        demoraHabiles: cambiaEntrega ? 1 : 0,
        cambiaEntrega,
      },
    ],
  };
  await tx.planEntregaRevision.update({
    where: { id: f.rev.id },
    data: {
      resultadoJson: JSON.parse(
        JSON.stringify(resultado),
      ) as Prisma.InputJsonValue,
      calculadaEl: taller.ahora,
      contextoHuella: huellaContextoPlan(taller, 2),
    },
  });
  await tx.planEntregaItem.update({
    where: { id: f.plan.id },
    data: { alternativaElegidaId: a.id, cambioEntregasAceptado: cambiaEntrega },
  });
  return { ...f, otra, paso, taller, service };
}

it('publica agenda de ambas OT y lotes en una transacción; conserva promesas y es idempotente', async () => {
  await expect(
    db.$transaction(
      async (tx) => {
        const f = await fixture(tx);
        await f.service.sincronizarLotesEntrega(tx, f.tenantId, f.raiz.id);
        const leer = () =>
          tx.ordenTrabajoItemPaso.findMany({
            where: {
              tenantId: f.tenantId,
              ordenId: { in: [f.orden.id, f.otra.id] },
            },
          });
        const pasos = await leer();
        expect(pasos).toHaveLength(17);
        expect(pasos.every((p) => p.planificadoHasta)).toBe(true);
        expect(
          pasos.find((p) => p.id === f.paso.id)!.atencionPlanificadaJson,
        ).toMatchObject({
          version: 1,
          contexto: 'fixture de persistencia de agenda',
          finOcupacion: Date.parse('2026-09-17T12:05:00Z'),
          reservas: [
            {
              inicio: Date.parse('2026-09-17T11:00:00Z'),
              fin: Date.parse('2026-09-17T11:10:00Z'),
              personas: 1,
            },
          ],
        });
        expect(
          (
            await tx.ordenTrabajo.findUniqueOrThrow({
              where: { id: f.otra.id },
            })
          ).fechaEntrega
            ?.toISOString()
            .slice(0, 10),
        ).toBe('2026-09-18');
        expect(
          (
            await tx.planEntregaItem.findUniqueOrThrow({
              where: { id: f.plan.id },
            })
          ).reprogramacionAplicadaRevisionId,
        ).toBe(f.rev.id);
        const antes = await tx.ordenTrabajoEvento.count({
          where: { ordenId: f.otra.id, tipo: 'reprogramacion_entregas' },
        });
        await f.service.sincronizarLotesEntrega(tx, f.tenantId, f.raiz.id);
        expect((await leer()).map((p) => p.id).sort()).toEqual(
          pasos.map((p) => p.id).sort(),
        );
        expect(
          await tx.ordenTrabajoEvento.count({
            where: { ordenId: f.otra.id, tipo: 'reprogramacion_entregas' },
          }),
        ).toBe(antes);
        throw rollback;
      },
      { timeout: 60_000 },
    ),
  ).rejects.toBe(rollback);
}, 65_000);
it('borrador no mueve la otra OT; emitir aplica y actualiza sólo fechas explícitamente aceptadas', async () => {
  await expect(
    db.$transaction(
      async (tx) => {
        const f = await fixture(tx, true);
        await tx.ordenTrabajo.update({
          where: { id: f.orden.id },
          data: { estado: 'borrador' },
        });
        await f.service.sincronizarLotesEntrega(tx, f.tenantId, f.raiz.id);
        expect(
          (
            await tx.ordenTrabajoItemPaso.findUniqueOrThrow({
              where: { id: f.paso.id },
            })
          ).planificadoHasta,
        ).toBeNull();
        await tx.ordenTrabajo.update({
          where: { id: f.orden.id },
          data: { estado: 'pendiente' },
        });
        await f.service.sincronizarLotesEntrega(tx, f.tenantId, f.raiz.id);
        expect(
          (
            await tx.ordenTrabajo.findUniqueOrThrow({
              where: { id: f.otra.id },
            })
          ).fechaEntrega
            ?.toISOString()
            .slice(0, 10),
        ).toBe('2026-09-21');
        throw rollback;
      },
      { timeout: 60_000 },
    ),
  ).rejects.toBe(rollback);
}, 65_000);
it('si el escenario vence, emitir no mueve ningún trabajo', async () => {
  await expect(
    db.$transaction(
      async (tx) => {
        const f = await fixture(tx);
        f.taller.ahora = new Date('2026-09-10T11:06:00Z');
        await expect(
          f.service.sincronizarLotesEntrega(tx, f.tenantId, f.raiz.id),
        ).rejects.toThrow(/venció/);
        expect(
          await tx.loteProduccionEntrega.count({
            where: { productoItemId: f.raiz.id },
          }),
        ).toBe(0);
        expect(
          (
            await tx.ordenTrabajoItemPaso.findUniqueOrThrow({
              where: { id: f.paso.id },
            })
          ).planificadoHasta,
        ).toBeNull();
        throw rollback;
      },
      { timeout: 60_000 },
    ),
  ).rejects.toBe(rollback);
}, 65_000);
it('un paso iniciado durante la confirmación revierte la aplicación completa', async () => {
  let otraId = '',
    tenantId = '';
  await expect(
    db.$transaction(
      async (tx) => {
        const f = await fixture(tx);
        otraId = f.otra.id;
        tenantId = f.tenantId;
        await tx.ordenTrabajoItemPaso.update({
          where: { id: f.paso.id },
          data: { estado: 'en_curso' },
        });
        await f.service.sincronizarLotesEntrega(tx, f.tenantId, f.raiz.id);
      },
      { timeout: 60_000 },
    ),
  ).rejects.toThrow(/cambió/);
  expect(await db.ordenTrabajo.count({ where: { id: otraId, tenantId } })).toBe(
    0,
  );
}, 65_000);

it('buscar opciones crea una revisión nueva reutilizando las fuentes sin cambiar la cola; controla versión y permisos', async () => {
  await expect(
    db.$transaction(
      async (tx) => {
        const f = await crearFixtureLotesF6(tx, db);
        const entrada = exhibidorControlado();
        entrada.porEntrega = true;
        const taller = { ...entrada.taller, margenEtaDias: 2 };
        const envuelto = new Proxy(tx, {
          get(target, key) {
            if (key === '$transaction')
              return (fn: (t: Prisma.TransactionClient) => Promise<unknown>) =>
                fn(tx);
            if (key === 'prepararSnapshot') return db.prepararSnapshot.bind(db);
            return Reflect.get(target, key) as unknown;
          },
        }) as unknown as PrismaService;
        const service = new PlanificacionEntregasService(envuelto, {
          contextoSimulacion: async () => taller,
        } as unknown as EtaService);
        const origen = await service['origen'](f.tenantId, f.raiz.id);
        await tx.planEntregaRevision.update({
          where: { id: f.rev.id },
          data: {
            origenHuella: origen.huella,
            resultadoJson: JSON.parse(
              JSON.stringify({
                politica: 'POR_ENTREGA',
                schemaVersion: 1,
                operaciones: entrada.operaciones,
                detalles: [],
                fuentes: [],
                resultado: proponerEntregasPiloto(entrada),
                nesting: { estado: 'CONSERVADO' },
              }),
            ) as Prisma.InputJsonValue,
          },
        });
        const auth = {
          tenantId: f.tenantId,
          userId: randomUUID(),
          role: 'ADMINISTRADOR',
          permisos: new Set(['produccion.supervisar']),
        } as const;
        const dto = {
          expectedVersion: 0,
          revisionId: f.rev.id,
          ordenesExcluidas: [],
        };
        const { plan } = await service.reprogramar(
          auth as never,
          f.raiz.id,
          dto,
        );
        expect(plan!.revision).toBe(2);
        expect(plan!.reprogramacion).toBeTruthy();
        expect(plan!.alternativaElegidaId).toBeNull();
        const viejo = await tx.fuenteProduccionEntrega.findFirstOrThrow({
          where: { revisionId: f.rev.id },
        });
        const nuevo = await tx.fuenteProduccionEntrega.findFirstOrThrow({
          where: { revisionId: plan!.revisionId },
        });
        expect(nuevo.calculoJson).toEqual(viejo.calculoJson);
        expect(nuevo.contextoJson).toEqual(viejo.contextoJson);
        expect(
          await tx.loteProduccionEntrega.count({
            where: { productoItemId: f.raiz.id },
          }),
        ).toBe(0);
        await expect(
          service.reprogramar(auth as never, f.raiz.id, dto),
        ).rejects.toThrow(/Cambió/);
        await expect(
          service.reprogramar(
            { ...auth, role: 'VENDEDOR', permisos: new Set<string>() } as never,
            f.raiz.id,
            dto,
          ),
        ).rejects.toThrow(/permiso/);
        throw rollback;
      },
      { timeout: 60_000 },
    ),
  ).rejects.toBe(rollback);
}, 65_000);

it('la publicación espera al operario concurrente y vuelve a leer su estado antes de moverlo', async () => {
  const tenantId = randomUUID();
  await db.tenant.create({
    data: {
      id: tenantId,
      nombre: 'QA concurrencia agenda',
      slug: `qa-${tenantId}`,
    },
  });
  let liberar!: () => void, listo!: () => void;
  const espera = new Promise<void>((r) => {
      liberar = r;
    }),
    tomoOrden = new Promise<void>((r) => {
      listo = r;
    });
  try {
    const orden = await db.ordenTrabajo.create({
      data: {
        tenantId,
        numero: 'QA-concurrente',
        estado: 'pendiente',
        items: {
          create: {
            tenantId,
            codigo: 'QA',
            nombre: 'QA',
            familia: 'QA',
            cantidad: 1,
            cantidadUnidad: 'u',
            subtotal: 1,
            impuestos: 0,
            total: 1,
          },
        },
      },
      include: { items: true },
    });
    const paso = await db.ordenTrabajoItemPaso.create({
      data: {
        tenantId,
        ordenId: orden.id,
        itemId: orden.items[0].id,
        indice: 0,
        nombre: 'Corte',
        familiaCodigo: 'corte',
        categoriaFamilia: 'QA',
        estado: 'pendiente',
        duracionEstimadaMin: 60,
      },
    });
    const operario = db.$transaction(
      async (tx) => {
        await tx.ordenTrabajo.update({
          where: { id: orden.id },
          data: { estado: 'produccion' },
        });
        await tx.ordenTrabajoItemPaso.update({
          where: { id: paso.id },
          data: { estado: 'en_curso' },
        });
        listo();
        await espera;
      },
      { timeout: 15_000 },
    );
    await tomoOrden;
    const publicacion = db.$transaction(
      async (tx) => {
        await bloquearColaEntrega(tx, tenantId);
        return tx.ordenTrabajoItemPaso.updateMany({
          where: { tenantId, id: paso.id, estado: 'pendiente' },
          data: { planificadoHasta: new Date() },
        });
      },
      { timeout: 15_000 },
    );
    liberar();
    await operario;
    expect((await publicacion).count).toBe(0);
    expect(
      (
        await db.ordenTrabajoItemPaso.findUniqueOrThrow({
          where: { id: paso.id },
        })
      ).planificadoHasta,
    ).toBeNull();
  } finally {
    liberar();
    await db.tenant.delete({ where: { id: tenantId } });
  }
}, 20_000);

it('no permite cambiar la dotación del equipo a mitad de publicar una agenda', async () => {
  const tenantId = randomUUID();
  await db.tenant.create({
    data: {
      id: tenantId,
      nombre: 'QA bloqueo de equipo',
      slug: `equipo-${tenantId}`,
    },
  });
  const equipo = await db.equipoProduccion.create({
    data: { tenantId, nombre: 'Compartido', personas: 2, calendarioJson: {} },
  });
  let liberar!: () => void, listo!: () => void;
  const espera = new Promise<void>((r) => {
    liberar = r;
  });
  const bloqueado = new Promise<void>((r) => {
    listo = r;
  });
  const publicacion = db.$transaction(
    async (tx) => {
      await bloquearColaEntrega(tx, tenantId);
      listo();
      await espera;
    },
    { timeout: 10_000 },
  );
  try {
    await bloqueado;
    await expect(
      db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '100ms'");
        return tx.equipoProduccion.update({
          where: { id: equipo.id },
          data: { personas: 1 },
        });
      }),
    ).rejects.toThrow();
    expect(
      (
        await db.equipoProduccion.findUniqueOrThrow({
          where: { id: equipo.id },
        })
      ).personas,
    ).toBe(2);
    liberar();
    await publicacion;
    expect(
      (
        await db.equipoProduccion.update({
          where: { id: equipo.id },
          data: { personas: 1 },
        })
      ).personas,
    ).toBe(1);
  } finally {
    liberar();
    await publicacion;
    await db.tenant.delete({ where: { id: tenantId } });
  }
});
