import { leerPlanReferencia } from '../produccion/plan-referencia-paso';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrdenesTrabajoService } from '../ordenes-trabajo/ordenes-trabajo.service';
import { crearFixtureLotesF6 } from '../../test/soporte-lotes-f6';
import { productosComercialesConTrabajo } from '../ordenes-trabajo/productos-comerciales';
import { DesarrolloDocumentalService } from '../desarrollo-documental/desarrollo-documental.service';

const db = new PrismaService();
const service = new OrdenesTrabajoService(
  db,
  {} as never,
  {} as never,
  {} as never,
  {} as never,
  {} as never,
  {} as never,
  {} as never,
  {} as never,
  {} as never,
  new DesarrolloDocumentalService(db, {} as never, {} as never),
);
const rollback = new Error('rollback de la prueba');
afterAll(() => db.$disconnect());

const fixture = (tx: Prisma.TransactionClient) => crearFixtureLotesF6(tx, db);

it('materializa 4×50 con rutas, cantidades y CAD por lote; reintentar no duplica y no entrega el total prematuramente', async () => {
  await expect(
    db.$transaction(
      async (tx) => {
        const f = await fixture(tx);
        await service.sincronizarLotesEntrega(tx, f.tenantId, f.raiz.id);
        const leer = () =>
          tx.ordenTrabajoItem.findMany({
            where: { tenantId: f.tenantId, ordenId: f.orden.id },
            include: { pasos: true },
          });
        const items = await leer();
        expect(items).toHaveLength(9); // comercial + cuatro lotes + sus cuatro componentes
        expect(
          items
            .filter((i) => i.parentItemId === f.raiz.id)
            .map((i) => Number(i.cantidad)),
        ).toEqual([50, 50, 50, 50]);
        expect(items.find((i) => i.id === f.raiz.id)?.pasos).toHaveLength(0);
        expect(items.flatMap((i) => i.pasos)).toHaveLength(16);
        expect(items.reduce((s, i) => s + Number(i.total), 0)).toBe(1000);
        const lotes = await tx.loteProduccionEntrega.findMany({
          where: { productoItemId: f.raiz.id },
          orderBy: { secuencia: 'asc' },
        });
        expect(
          lotes.map((l) => l.fechaEntrega.toISOString().slice(0, 10)),
        ).toEqual(['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18']);
        const dependencias = await tx.ordenTrabajoPasoDependencia.findMany({
          where: { ordenId: f.orden.id },
        });
        expect(dependencias).toHaveLength(12);
        const itemPorPaso = new Map(
          items.flatMap((i) => i.pasos.map((p) => [p.id, i] as const)),
        );
        for (const d of dependencias)
          expect(itemPorPaso.get(d.predecesorPasoId)?.loteEntregaId).toBe(
            itemPorPaso.get(d.sucesorPasoId)?.loteEntregaId,
          );
        for (const i of items.filter(
          (i) => i.loteEntregaId && i.parentItemId !== f.raiz.id,
        )) {
          const traza = i.trazabilidadSnapshotJson as unknown as {
            pasos: typeof f.c.pasos;
          };
          const cut = traza.pasos.find(
            (p) => p.familiaCodigo === 'corte_laser',
          )!;
          expect(cut.nestingResult?.substrates).toHaveLength(32);
          expect(cut.nestingResult?.placements).toHaveLength(450);
          expect(cut.nestingResult).toEqual(
            f.c.componentesFabricados![0].pasos!.find(
              (p) => p.familiaCodigo === 'corte_laser',
            )!.nestingResult,
          );
        }
        await service.sincronizarLotesEntrega(tx, f.tenantId, f.raiz.id);
        const repetidos = await leer();
        expect(repetidos.map((i) => i.id).sort()).toEqual(
          items.map((i) => i.id).sort(),
        );
        expect(
          repetidos.flatMap((i) => i.pasos.map((p) => p.id)).sort(),
        ).toEqual(items.flatMap((i) => i.pasos.map((p) => p.id)).sort());
        const comercial = productosComercialesConTrabajo(items);
        expect(comercial).toHaveLength(1);
        expect(comercial[0].pasos).toHaveLength(16);
        expect(comercial[0].pasos.every((p) => p.estado === 'hecho')).toBe(
          false,
        );
        // Incluso si sólo la primera entrega termina, el producto completo espera.
        const primerLote = lotes[0].id;
        items
          .filter((i) => i.loteEntregaId === primerLote)
          .forEach((i) =>
            i.pasos.forEach((p) => {
              p.estado = 'hecho';
            }),
          );
        expect(
          productosComercialesConTrabajo(items)[0].pasos.every(
            (p) => p.estado === 'hecho',
          ),
        ).toBe(false);
        await tx.ordenTrabajoItemPaso.update({
          where: { id: items.flatMap((i) => i.pasos)[0].id },
          data: { estado: 'en_curso' },
        });
        await expect(
          service.sincronizarLotesEntrega(tx, f.tenantId, f.raiz.id, true),
        ).rejects.toThrow(/trabajo/);
        throw rollback;
      },
      { timeout: 60_000 },
    ),
  ).rejects.toBe(rollback);
}, 65_000);

it('un borrador prepara los lotes sin enviar trabajo al taller; al emitir reutiliza sus identidades', async () => {
  await expect(
    db.$transaction(
      async (tx) => {
        const f = await fixture(tx);
        await tx.ordenTrabajo.update({
          where: { id: f.orden.id },
          data: { estado: 'borrador' },
        });
        await service.sincronizarLotesEntrega(tx, f.tenantId, f.raiz.id);
        const ids = (
          await tx.loteProduccionEntrega.findMany({
            where: { productoItemId: f.raiz.id },
          })
        )
          .map((l) => l.id)
          .sort();
        expect(ids).toHaveLength(4);
        expect(
          await tx.ordenTrabajoItemPaso.count({
            where: { ordenId: f.orden.id },
          }),
        ).toBe(0);
        await tx.ordenTrabajo.update({
          where: { id: f.orden.id },
          data: { estado: 'pendiente' },
        });
        // Empezar otra propuesta no invalida la distribución ya adoptada.
        await tx.planEntregaItem.update({
          where: { id: f.plan.id },
          data: { revisionActual: 2, alternativaElegidaId: null },
        });
        await tx.planEntregaRevision.create({
          data: {
            tenantId: f.tenantId,
            planId: f.plan.id,
            numero: 2,
            idempotencyKey: randomUUID(),
            solicitudHuella: 'nueva',
            origenHuella: 'nueva',
            cantidad: 200,
            solicitadoPorId: f.rev.solicitadoPorId,
            estado: 'SOLICITADA',
            solicitudJson: {},
          },
        });
        await service['materializarPasosItems'](tx, f.tenantId, [f.raiz]);
        expect(
          (
            await tx.loteProduccionEntrega.findMany({
              where: { productoItemId: f.raiz.id },
            })
          )
            .map((l) => l.id)
            .sort(),
        ).toEqual(ids);
        const pasos = await tx.ordenTrabajoItemPaso.findMany({
          where: { ordenId: f.orden.id },
        });
        expect(pasos).toHaveLength(16);
        expect(pasos.every((p) => p.planificadoDesde)).toBe(true);
        for (const p of pasos) {
          const referencia = leerPlanReferencia(p.planReferenciaJson);
          expect(referencia).toMatchObject({
            inicio: p.planificadoDesde!.toISOString(),
            origen: 'plan_aceptado',
          });
          expect(Date.parse(referencia!.fin)).toBeGreaterThanOrEqual(
            p.planificadoDesde!.getTime(),
          );
        }
        throw rollback;
      },
      { timeout: 60_000 },
    ),
  ).rejects.toBe(rollback);
}, 65_000);

it.each(['sin aceptación', 'sin fuente', 'receta distinta'])(
  'rechaza %s sin dejar lotes incompletos',
  async (caso) => {
    await expect(
      db.$transaction(
        async (tx) => {
          const f = await fixture(tx);
          if (caso === 'sin aceptación')
            await tx.planEntregaItem.update({
              where: { id: f.plan.id },
              data: { ajusteNestingAceptado: false },
            });
          if (caso === 'sin fuente')
            await tx.fuenteProduccionEntrega.deleteMany({
              where: { revisionId: f.rev.id },
            });
          if (caso === 'receta distinta')
            await tx.ordenTrabajoItem.update({
              where: { id: f.raiz.id },
              data: { recetaHuella: 'otra' },
            });
          await expect(
            service.sincronizarLotesEntrega(tx, f.tenantId, f.raiz.id),
          ).rejects.toThrow();
          expect(
            await tx.loteProduccionEntrega.count({
              where: { productoItemId: f.raiz.id },
            }),
          ).toBe(0);
          expect(
            (
              await tx.ordenTrabajoItem.findUniqueOrThrow({
                where: { id: f.raiz.id },
              })
            ).contieneLotesEntrega,
          ).toBe(false);
          throw rollback;
        },
        { timeout: 60_000 },
      ),
    ).rejects.toBe(rollback);
  },
  65_000,
);

it('retirar una distribución pendiente restaura la ruta y los componentes originales sin duplicar el precio', async () => {
  await expect(
    db.$transaction(
      async (tx) => {
        const f = await fixture(tx);
        await service.sincronizarLotesEntrega(tx, f.tenantId, f.raiz.id);
        await tx.planEntregaItem.update({
          where: { id: f.plan.id },
          data: { alternativaElegidaId: null },
        });
        await service.sincronizarLotesEntrega(tx, f.tenantId, f.raiz.id, true);
        const items = await tx.ordenTrabajoItem.findMany({
          where: { ordenId: f.orden.id },
          include: { pasos: true },
        });
        expect(items).toHaveLength(2);
        expect(
          items.every((i) => !i.loteEntregaId && !i.contieneLotesEntrega),
        ).toBe(true);
        expect(items.flatMap((i) => i.pasos)).toHaveLength(4);
        expect(items.every((i) => Number(i.cantidad) === 200)).toBe(true);
        expect(items.reduce((s, i) => s + Number(i.total), 0)).toBe(1000);
        expect(
          await tx.loteProduccionEntrega.count({
            where: { productoItemId: f.raiz.id },
          }),
        ).toBe(0);
        throw rollback;
      },
      { timeout: 60000 },
    ),
  ).rejects.toBe(rollback);
});

it('conserva propuestas históricas sin fin sin inventar una referencia ni impedir emitir', async () => {
  await expect(
    db.$transaction(
      async (tx) => {
        const f = await fixture(tx);
        const revision = await tx.planEntregaRevision.findUniqueOrThrow({
          where: { id: f.rev.id },
        });
        const resultado = revision.resultadoJson as unknown as {
          resultado: {
            alternativas: Array<{ traza: Array<{ fin?: string }> }>;
          };
        };
        resultado.resultado.alternativas.forEach((a) =>
          a.traza.forEach((t) => {
            delete t.fin;
          }),
        );
        await tx.planEntregaRevision.update({
          where: { id: f.rev.id },
          data: {
            resultadoJson: resultado as unknown as Prisma.InputJsonValue,
          },
        });
        await service.sincronizarLotesEntrega(tx, f.tenantId, f.raiz.id);
        const pasos = await tx.ordenTrabajoItemPaso.findMany({
          where: { ordenId: f.orden.id },
        });
        expect(pasos).toHaveLength(16);
        expect(
          pasos.every((p) => p.planificadoDesde && !p.planReferenciaJson),
        ).toBe(true);
        throw rollback;
      },
      { timeout: 60000 },
    ),
  ).rejects.toBe(rollback);
});
