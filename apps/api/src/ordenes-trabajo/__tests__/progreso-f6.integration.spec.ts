import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdenesTrabajoService } from '../ordenes-trabajo.service';
import { CampanasService } from '../../campanas/campanas.service';
import type { CurrentAuth } from '../../auth/auth.types';
import { crearFixtureLotesF6 } from '../../../test/soporte-lotes-f6';
import { serviciosRecorridoF4 } from '../../../test/soporte-recorridos-f4';
import { OrdenesTrabajoQueryDto } from '../dto/ordenes-trabajo-query.dto';
import { CampanasQueryDto } from '../../campanas/dto/campanas.dto';

const db = new PrismaService();
afterAll(() => db.$disconnect());
it('OT, seguimiento, lotes y campaña derivan avance del trabajo real persistido, sin snapshots en listados ni cruces de tenant', async () => {
  const rollback = new Error('rollback progreso');
  await expect(
    db.$transaction(
      async (tx) => {
        const f = await crearFixtureLotesF6(tx, db);
        const { ordenes: productor } = serviciosRecorridoF4(tx);
        await productor.sincronizarLotesEntrega(tx, f.tenantId, f.raiz.id);
        const auth = {
          tenantId: f.tenantId,
          userId: randomUUID(),
          permisos: new Set(['produccion.ver', 'comercial.ver']),
        } as CurrentAuth;
        const cliente = await tx.cliente.findFirstOrThrow({
          where: { tenantId: f.tenantId },
        });
        const campana = await tx.proyectoCampana.create({
          data: {
            tenantId: f.tenantId,
            clienteId: cliente.id,
            codigo: `QA-${randomUUID()}`,
            nombre: 'Campaña progreso QA',
            estado: 'activo',
          },
        });
        await tx.ordenTrabajo.update({
          where: { id: f.orden.id },
          data: {
            clienteId: cliente.id,
            publicToken: randomUUID(),
            proyectoCampanaId: campana.id,
            progresoPct: 89,
          },
        });
        const lotes = await tx.loteProduccionEntrega.findMany({
          where: { productoItemId: f.raiz.id },
          orderBy: { secuencia: 'asc' },
        });
        await tx.ordenTrabajoItemPaso.updateMany({
          where: { ordenId: f.orden.id, item: { loteEntregaId: lotes[0].id } },
          data: { estado: 'hecho' },
        });
        const prisma = new Proxy(tx, {
          get(target, prop) {
            if (prop === '$transaction')
              return (arg: unknown) =>
                Array.isArray(arg)
                  ? Promise.all(arg)
                  : (arg as (t: typeof tx) => unknown)(tx);
            return Reflect.get(target, prop) as unknown;
          },
        });
        const ot = Object.create(
          OrdenesTrabajoService.prototype,
        ) as OrdenesTrabajoService;
        Object.assign(ot, {
          prisma,
          enlaces: {
            resolver: () => Promise.resolve({ entidadId: f.orden.id }),
          },
          empresa: { paraDocumentos: () => Promise.resolve({}) },
        });
        const detalle = await ot.findOne(auth, f.orden.id);
        expect(detalle.progresoPct).toBe(25);
        expect(detalle.progresoLotes.map((l) => l.progreso.porcentaje)).toEqual(
          [100, 0, 0, 0],
        );
        expect(detalle.progresoLotes.map((l) => l.cantidad)).toEqual([
          50, 50, 50, 50,
        ]);
        expect(detalle.progreso.operacionesTotal).toBe(16);
        const tracking = await ot.trackingPublico('qa-token');
        expect(tracking.progresoPct).toBe(25);
        expect(tracking.progreso).toEqual(detalle.progreso);
        expect(tracking.items).toHaveLength(1);
        expect(tracking.items[0].progresoPct).toBe(25);
        expect(JSON.stringify(tracking)).not.toMatch(
          /calculoJson|costoTotal|jobContext/,
        );
        const lista = await ot.findAll(
          auth,
          Object.assign(new OrdenesTrabajoQueryDto(), {
            q: f.orden.numero,
            page: 1,
            limit: 20,
          }),
        );
        expect(lista.data.find((o) => o.id === f.orden.id)?.progresoPct).toBe(
          25,
        );
        expect(JSON.stringify(lista)).not.toMatch(
          /calculoJson|trazabilidadJson|snapshotJson/,
        );
        const campanas = new CampanasService(prisma as never);
        const antes = await campanas.detalle(auth, campana.id);
        expect(antes.dashboard.produccion.avancePct).toBe(25);
        // Una segunda OT pendiente tiene tres veces el trabajo de la primera.
        const otra = await tx.ordenTrabajo.create({
          data: {
            tenantId: f.tenantId,
            numero: `QA-${randomUUID()}`,
            estado: 'pendiente',
            proyectoCampanaId: campana.id,
            items: {
              create: {
                tenantId: f.tenantId,
                codigo: 'OT2',
                nombre: 'Trabajo largo',
                familia: 'QA',
                cantidad: 1,
                cantidadUnidad: 'u',
                subtotal: 0,
                impuestos: 0,
                total: 0,
              },
            },
          },
          include: { items: true },
        });
        await tx.ordenTrabajoItemPaso.create({
          data: {
            tenantId: f.tenantId,
            ordenId: otra.id,
            itemId: otra.items[0].id,
            indice: 0,
            nombre: 'Trabajo largo',
            familiaCodigo: 'trabajo_manual',
            categoriaFamilia: 'produccion',
            duracionEstimadaMin: detalle.progreso.minutosTotal! * 3,
            estado: 'pendiente',
          },
        });
        const despues = await campanas.detalle(auth, campana.id);
        expect(despues.dashboard.produccion.avancePct).toBe(6);
        expect(
          despues.ordenes.find((o) => o.id === f.orden.id)?.progresoPct,
        ).toBe(25);
        const listado = await campanas.listar(
          auth,
          Object.assign(new CampanasQueryDto(), {
            q: campana.codigo,
            page: 1,
            limit: 20,
          }),
        );
        expect(listado.data[0].avancePct).toBe(6);
        await tx.ordenTrabajo.update({
          where: { id: otra.id },
          data: { estado: 'cancelada' },
        });
        expect(
          (await campanas.detalle(auth, campana.id)).dashboard.produccion
            .avancePct,
        ).toBe(25);
        // Reabrir una operación invalida el 100% del lote y recalcula toda la cadena.
        const primerPaso = await tx.ordenTrabajoItemPaso.findFirstOrThrow({
          where: { ordenId: f.orden.id, item: { loteEntregaId: lotes[0].id } },
        });
        await tx.ordenTrabajoItemPaso.update({
          where: { id: primerPaso.id },
          data: { estado: 'pendiente' },
        });
        const reabierta = await ot.findOne(auth, f.orden.id);
        expect(reabierta.progresoPct).toBeLessThan(25);
        expect(reabierta.progresoLotes[0].progreso.porcentaje).toBeLessThan(
          100,
        );
        expect((await ot.trackingPublico('qa-token')).progresoPct).toBe(
          reabierta.progresoPct,
        );
        await expect(
          ot.findOne({ ...auth, tenantId: randomUUID() }, f.orden.id),
        ).rejects.toThrow('No se encontró');
        await expect(
          campanas.detalle({ ...auth, tenantId: randomUUID() }, campana.id),
        ).rejects.toThrow();
        throw rollback;
      },
      { timeout: 60000 },
    ),
  ).rejects.toBe(rollback);
}, 65000);
