import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { OrdenesTrabajoService } from '../ordenes-trabajo.service';
import type { CurrentAuth } from '../../auth/auth.types';
import type { DescuentoOrdenDto } from '../dto/descuento-orden.dto';
const db = new PrismaClient();
const tenantId = randomUUID(),
  userId = randomUUID(),
  categoriaId = randomUUID(),
  subcategoriaId = randomUUID(),
  productoId = randomUUID();
const auth = {
  tenantId,
  userId,
  email: 'operador@example.invalid',
  role: 'ADMINISTRADOR',
  sessionId: randomUUID(),
  membershipId: randomUUID(),
} as CurrentAuth;
const service = Object.create(
  OrdenesTrabajoService.prototype,
) as OrdenesTrabajoService;
Object.assign(service, {
  prisma: db,
  capacidades: { exigirOperacionTx: jest.fn(), exigir: jest.fn() },
  findOne: async (_auth: CurrentAuth, id: string) =>
    db.ordenTrabajo.findFirstOrThrow({
      where: { id, tenantId },
      include: { items: true },
    }),
});
beforeAll(async () => {
  await db.tenant.create({
    data: {
      id: tenantId,
      slug: 'qa-descuentos-' + tenantId,
      nombre: 'Empresa ficticia descuentos',
    },
  });
  await db.user.create({
    data: { id: userId, email: userId + '@example.invalid' },
  });
  await db.productoCategoriaComercial.create({
    data: { id: categoriaId, codigo: categoriaId, nombre: 'QA' },
  });
  await db.productoSubcategoriaComercial.create({
    data: {
      id: subcategoriaId,
      categoriaId,
      codigo: subcategoriaId,
      nombre: 'QA',
      atributosSchemaJson: {},
    },
  });
  await db.producto.create({
    data: {
      id: productoId,
      tenantId,
      subcategoriaComercialId: subcategoriaId,
      codigo: 'QA',
      nombre: 'Producto ficticio',
    },
  });
});
afterAll(async () => {
  await db.tenant.deleteMany({
    where: { id: tenantId, slug: 'qa-descuentos-' + tenantId },
  });
  await db.user.deleteMany({ where: { id: userId } });
  await db.productoSubcategoriaComercial.deleteMany({
    where: { id: subcategoriaId },
  });
  await db.productoCategoriaComercial.deleteMany({
    where: { id: categoriaId },
  });
  await db.$disconnect();
});
async function nueva(extra = {}) {
  const cot = await db.cotizacion.create({
    data: { tenantId, notificarWhatsapp: false },
  });
  const snap = await db.cotizacionItem.create({
    data: {
      tenantId,
      cotizacionId: cot.id,
      productoId,
      cantidad: 1,
      jobContextJson: { cantidad: 1 },
      snapshotJson: {
        ejecucion: { cantidadComercialPricing: 1, costos: { total: 300 } },
      },
      costoUnitario: 300,
      costoTotal: 300,
      precioNetoTotal: 1000,
      precioNetoUnitario: 1000,
      precioTotal: 1210,
      precioUnitario: 1210,
      impuestosPorFueraTotal: 210,
      impuestosSnapshotJson: [{ porcentaje: 21, traslado: 'POR_FUERA' }],
    },
  });
  const orden = await db.ordenTrabajo.create({
    data: {
      tenantId,
      numero: 'QA-' + randomUUID(),
      estado: 'en_produccion',
      subtotal: 1000,
      impuestos: 210,
      total: 1210,
      ...extra,
      items: {
        create: {
          tenantId,
          cotizacionItemId: snap.id,
          codigo: 'QA',
          nombre: 'Producto ficticio',
          familia: 'impresion',
          cantidad: 1,
          cantidadUnidad: 'u',
          subtotal: 1000,
          impuestos: 210,
          total: 1210,
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
      nodoClave: 'qa',
      nombre: 'Paso terminado',
      familiaCodigo: 'impresion_por_area',
      categoriaFamilia: 'produccion_impresion',
      estado: 'completado',
    },
  });
  return { orden, snap, paso, cot };
}
async function aplicar(
  id: string,
  dto: Omit<DescuentoOrdenDto, 'expectedVersion'>,
  a = auth,
) {
  const o = await db.ordenTrabajo.findUniqueOrThrow({ where: { id } });
  return service.aplicarDescuentoOrden(a, id, {
    ...dto,
    expectedVersion: o.updatedAt.toISOString(),
  }) as any;
}
it('ajusta el precio en producción conservando el avance, costo y presupuesto originales', async () => {
  const { orden, snap, paso, cot } = await nueva();
  const resultado = await aplicar(orden.id, {
    modo: 'manual',
    tipo: 'PORCENTAJE',
    valor: 10,
  });
  expect(Number(resultado.total)).toBe(1089);
  expect(resultado.items[0].id).toBe(orden.items[0].id);
  expect(
    await db.ordenTrabajoItemPaso.findUnique({ where: { id: paso.id } }),
  ).toEqual(paso);
  expect(
    await db.cotizacionItem.findUnique({ where: { id: snap.id } }),
  ).toEqual(snap);
  expect(
    await db.cotizacionItem.count({ where: { cotizacionId: cot.id } }),
  ).toBe(1);
  const nuevo = await db.cotizacionItem.findUniqueOrThrow({
    where: { id: resultado.items[0].cotizacionItemId },
  });
  expect(Number(nuevo.costoTotal)).toBe(300);
  expect(Number(nuevo.precioTotal)).toBe(1089);
  expect(nuevo.cotizacionId).not.toBe(cot.id);
});
it('cupón de un uso: reaplicar no duplica, quitar libera y reaplicar vuelve a consumir', async () => {
  const { orden } = await nueva({ estado: 'finalizada' });
  const cupon = await db.cupon.create({
    data: {
      tenantId,
      codigo: 'QA-' + randomUUID(),
      tipo: 'PORCENTAJE',
      valor: 10,
      alcanceTipo: 'ORDEN',
      usoMax: 1,
    },
  });
  for (let n = 0; n < 2; n++) {
    expect(
      Number(
        (await aplicar(orden.id, { modo: 'cupon', codigo: cupon.codigo }))
          .total,
      ),
    ).toBe(1089);
    expect(
      (await db.cupon.findUniqueOrThrow({ where: { id: cupon.id } })).usoCount,
    ).toBe(1);
  }
  expect(Number((await aplicar(orden.id, { modo: 'quitar' })).total)).toBe(
    1210,
  );
  expect(
    (await db.cupon.findUniqueOrThrow({ where: { id: cupon.id } })).usoCount,
  ).toBe(0);
  await aplicar(orden.id, { modo: 'cupon', codigo: cupon.codigo });
  expect(
    (await db.cupon.findUniqueOrThrow({ where: { id: cupon.id } })).usoCount,
  ).toBe(1);
  expect(
    await db.cuponRedencion.count({
      where: { ordenId: orden.id, estado: 'CONSUMIDA' },
    }),
  ).toBe(1);
});
it.each([
  { cobradoTotal: 1100 },
  { facturadoTotal: 1 },
  { estado: 'cancelada' },
])('rechaza sin mutar precios ni snapshots: %j', async (extra) => {
  const { orden } = await nueva(extra);
  const previo = await db.cotizacionItem.count({ where: { tenantId } });
  await expect(
    aplicar(orden.id, { modo: 'manual', tipo: 'PORCENTAJE', valor: 10 }),
  ).rejects.toThrow();
  expect(
    (await db.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } }))
      .total,
  ).toEqual(orden.total);
  expect(await db.cotizacionItem.count({ where: { tenantId } })).toBe(previo);
});
it('dos editores con la misma versión no pisan el precio del otro', async () => {
  const { orden } = await nueva();
  const dto = {
    modo: 'manual',
    tipo: 'PORCENTAJE',
    valor: 10,
    expectedVersion: orden.updatedAt.toISOString(),
  } as const;
  const resultados = await Promise.allSettled([
    service.aplicarDescuentoOrden(auth, orden.id, dto),
    service.aplicarDescuentoOrden(auth, orden.id, dto),
  ]);
  expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(resultados.filter((r) => r.status === 'rejected')).toHaveLength(1);
});
it('no permite modificar una orden de otra empresa', async () => {
  const { orden } = await nueva();
  await expect(
    aplicar(
      orden.id,
      { modo: 'manual', tipo: 'MONTO', valor: 10 },
      { ...auth, tenantId: randomUUID() },
    ),
  ).rejects.toThrow('No se encontró');
});
it('un cupón agotado no cambia otra orden', async () => {
  const { orden: a } = await nueva(),
    { orden: b } = await nueva();
  const cupon = await db.cupon.create({
    data: {
      tenantId,
      codigo: 'QA-' + randomUUID(),
      tipo: 'MONTO',
      valor: 100,
      alcanceTipo: 'ORDEN',
      usoMax: 1,
    },
  });
  const resultados = await Promise.allSettled([
    aplicar(a.id, { modo: 'cupon', codigo: cupon.codigo }),
    aplicar(b.id, { modo: 'cupon', codigo: cupon.codigo }),
  ]);
  expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(
    (await db.cupon.findUniqueOrThrow({ where: { id: cupon.id } })).usoCount,
  ).toBe(1);
});
it('bloquea una factura preparada aunque todavía no haya importe facturado', async () => {
  const { orden } = await nueva();
  const cfg = await db.configuracionFiscal.create({
    data: { tenantId, razonSocial: 'Empresa ficticia', cuit: '20000000001' },
  });
  const pv = await db.puntoVenta.create({
    data: {
      tenantId,
      configuracionFiscalId: cfg.id,
      numero: 1,
      nombre: 'Ensayo aislado',
      modalidad: 'manual',
    },
  });
  await db.comprobante.create({
    data: {
      tenantId,
      tipo: 'factura',
      letra: 'B',
      puntoVentaId: pv.id,
      fecha: new Date(),
      receptorSnapshot: {},
      itemsJson: [],
      netoGravado: 1000,
      ivaTotal: 210,
      ivaPorAlicuota: [],
      total: 1210,
      idempotencyKey: randomUUID(),
      estado: 'borrador',
      ordenes: { create: { tenantId, ordenId: orden.id, monto: 1210 } },
    },
  });
  await expect(
    aplicar(orden.id, { modo: 'manual', tipo: 'PORCENTAJE', valor: 10 }),
  ).rejects.toThrow('facturación');
  expect(
    Number(
      (await db.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } }))
        .total,
    ),
  ).toBe(1210);
});
it('respeta el máximo de descuento del operador en una orden emitida', async () => {
  const { orden } = await nueva();
  await db.configuracionPresupuestos.create({
    data: { tenantId, aprobacionDescuentoMaxPct: 5 },
  });
  await expect(
    aplicar(
      orden.id,
      { modo: 'manual', tipo: 'PORCENTAJE', valor: 10 },
      { ...auth, role: 'OPERADOR' },
    ),
  ).rejects.toThrow('máximo');
  expect(
    Number(
      (
        await aplicar(
          orden.id,
          { modo: 'manual', tipo: 'PORCENTAJE', valor: 5 },
          { ...auth, role: 'OPERADOR' },
        )
      ).total,
    ),
  ).toBe(1149.5);
});
