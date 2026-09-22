import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { serviciosRecorridoF4 } from '../../../test/soporte-recorridos-f4';
import type { CurrentAuth } from '../../auth/auth.types';

describe('Compras tercerizadas dentro del DAG (PostgreSQL)', () => {
  const db = new PrismaClient();
  const tenantId = randomUUID();
  const otroTenantId = randomUUID();
  let auth: CurrentAuth;
  const { ordenes } = serviciosRecorridoF4(db);
  beforeAll(async () => {
    await db.tenant.create({
      data: {
        id: tenantId,
        slug: `f4-compras-${tenantId}`,
        nombre: 'Aceptación F4 · compras',
      },
    });
    await db.tenant.create({
      data: {
        id: otroTenantId,
        slug: `f4-compras-${otroTenantId}`,
        nombre: 'Otra empresa QA',
      },
    });
    const usuario = await db.user.findFirstOrThrow();
    auth = {
      tenantId,
      userId: usuario.id,
      email: usuario.email,
      permisos: new Set(['produccion.supervisar']),
    } as CurrentAuth;
  });
  afterAll(async () => {
    await db.tenant.deleteMany({
      where: { id: { in: [tenantId, otroTenantId] } },
    });
    expect(await db.ordenTrabajo.count({ where: { tenantId } })).toBe(0);
    await db.$disconnect();
  });
  const nueva = () =>
    db.ordenTrabajo.create({
      data: {
        tenantId,
        numero: `OT-${randomUUID()}`,
        estado: 'pendiente',
        items: {
          create: {
            tenantId,
            codigo: 'COMPRA',
            nombre: 'Producto de aceptación',
            familia: 'Producto',
            cantidad: 1,
            cantidadUnidad: 'unidad',
            subtotal: 100,
            impuestos: 0,
            total: 100,
          },
        },
      },
      include: { items: true },
    });
  const agregarPaso = (
    ordenId: string,
    itemId: string,
    indice: number,
    tercerizado = false,
    nodoClave: string | null = `paso-${indice}`,
  ) =>
    db.ordenTrabajoItemPaso.create({
      data: {
        tenantId,
        ordenId,
        itemId,
        indice,
        nodoClave,
        nombre: `Paso ${indice}`,
        familiaCodigo: 'trabajo_manual',
        categoriaFamilia: 'produccion',
        tipoEjecucion: tercerizado ? 'tercerizado' : 'interno',
        estadoCompra: tercerizado ? 'pendiente' : null,
        modoRegistro: 'cronometro',
        duracionEstimadaMin: 10,
      },
    });

  it('respeta dependencias entre hijos, ramas paralelas, gates y recepción concurrente', async () => {
    const orden = await nueva();
    const raiz = orden.items[0];
    const hijo = await db.ordenTrabajoItem.create({
      data: {
        tenantId,
        ordenId: orden.id,
        parentItemId: raiz.id,
        codigo: 'HIJO',
        nombre: 'Diseño',
        familia: 'Diseño',
        cantidad: 1,
        cantidadUnidad: 'unidad',
        subtotal: 0,
        impuestos: 0,
        total: 0,
      },
    });
    const paralelo = await agregarPaso(orden.id, raiz.id, 0);
    const compra = await agregarPaso(orden.id, raiz.id, 1, true);
    const ensamble = await agregarPaso(orden.id, raiz.id, 2);
    const diseno = await agregarPaso(orden.id, hijo.id, 0);
    await db.ordenTrabajoPasoDependencia.createMany({
      data: [
        [diseno, compra],
        [compra, ensamble],
        [paralelo, ensamble],
      ].map(([a, b]) => ({
        tenantId,
        ordenId: orden.id,
        predecesorPasoId: a.id,
        sucesorPasoId: b.id,
        obligatoria: true,
      })),
    });
    await expect(
      ordenes.avanzarCompra(auth, compra.id, 'pedido'),
    ).rejects.toThrow(/dependencias/);
    await db.ordenTrabajoItemPaso.update({
      where: { id: diseno.id },
      data: { estado: 'hecho' },
    });
    await db.ordenTrabajoPasoGate.create({
      data: {
        tenantId,
        ordenId: orden.id,
        pasoId: compra.id,
        tipo: 'MATERIAL',
        estado: 'PENDIENTE',
      },
    });
    await expect(
      ordenes.avanzarCompra(auth, compra.id, 'pedido'),
    ).rejects.toThrow(/condiciones/);
    await ordenes.resolverGatePaso(auth, compra.id, {
      tipo: 'MATERIAL',
      estado: 'CUMPLIDO',
      detalle: 'Material confirmado para el proveedor',
    });
    // El índice 0 sigue pendiente pero es una rama paralela, no un requisito.
    await ordenes.avanzarCompra(auth, compra.id, 'pedido');
    await Promise.all([
      ordenes.avanzarCompra(auth, compra.id, 'recibido'),
      ordenes.avanzarCompra(auth, compra.id, 'recibido'),
    ]);
    expect(
      await db.ordenTrabajoEvento.count({
        where: { ordenId: orden.id, tipo: 'compra' },
      }),
    ).toBe(2);
    expect(
      await db.ordenTrabajo.findUnique({ where: { id: orden.id } }),
    ).toMatchObject({ progresoPct: 50 });
    await expect(
      ordenes.avanzarCompra(
        { ...auth, tenantId: otroTenantId },
        compra.id,
        'pendiente',
      ),
    ).rejects.toThrow(/encontrado/);
    await ordenes.accionPaso(auth, orden.id, raiz.id, paralelo.id, {
      accion: 'iniciar',
    });
    await ordenes.accionPaso(auth, orden.id, raiz.id, paralelo.id, {
      accion: 'completar',
      sinTiempoConfirmado: true,
    });
    await ordenes.accionPaso(auth, orden.id, raiz.id, ensamble.id, {
      accion: 'iniciar',
    });
    await expect(
      ordenes.avanzarCompra(auth, compra.id, 'pendiente'),
    ).rejects.toThrow(/posteriores/);
    expect(
      await db.ordenTrabajoItemPaso.findUnique({ where: { id: compra.id } }),
    ).toMatchObject({ estado: 'hecho', estadoCompra: 'recibido' });
    await ordenes.accionPaso(auth, orden.id, raiz.id, ensamble.id, {
      accion: 'completar',
      sinTiempoConfirmado: true,
    });
    expect(
      await db.ordenTrabajo.findUnique({ where: { id: orden.id } }),
    ).toMatchObject({ estado: 'finalizada', progresoPct: 100 });
  });

  it('conserva la secuencia histórica y reabre una recepción terminal sin perder la primera finalización', async () => {
    const orden = await nueva();
    const item = orden.items[0];
    const previo = await agregarPaso(orden.id, item.id, 0, false, null);
    const compra = await agregarPaso(orden.id, item.id, 1, true, null);
    await expect(
      ordenes.avanzarCompra(auth, compra.id, 'pedido'),
    ).rejects.toThrow(/dependencias/);
    await db.ordenTrabajoItemPaso.update({
      where: { id: previo.id },
      data: { estado: 'hecho' },
    });
    await ordenes.avanzarCompra(auth, compra.id, 'recibido');
    const final = await db.ordenTrabajo.findUniqueOrThrow({
      where: { id: orden.id },
    });
    expect(final.estado).toBe('finalizada');
    expect(final.fechaFinalizada).not.toBeNull();
    await ordenes.avanzarCompra(auth, compra.id, 'pendiente');
    expect(
      await db.ordenTrabajo.findUnique({ where: { id: orden.id } }),
    ).toMatchObject({
      estado: 'produccion',
      progresoPct: 50,
      fechaFinalizada: final.fechaFinalizada,
    });
    await db.ordenTrabajo.update({
      where: { id: orden.id },
      data: { estado: 'entregada' },
    });
    await expect(
      ordenes.avanzarCompra(auth, compra.id, 'recibido'),
    ).rejects.toThrow(/no permite/);
  });
});
