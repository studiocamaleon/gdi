import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { CambiarTipoBorradorService } from '../cambiar-tipo-borrador.service';
import type { CurrentAuth } from '../../auth/auth.types';
import { bloquearCupoUsuarios } from '../../suscripciones/cupos-usuarios';

const db = new PrismaClient();
const capacidades = {
  exigirOperacionTx: async (tx: Prisma.TransactionClient, tenantId: string) =>
    bloquearCupoUsuarios(tx, tenantId),
};
const servicio = (prisma: unknown = db) =>
  new CambiarTipoBorradorService(prisma as never, capacidades as never);
const tenantId = randomUUID(),
  userId = randomUUID(),
  categoriaId = randomUUID(),
  subcategoriaId = randomUUID();
const auth = {
  tenantId,
  userId,
  email: 'vendedor@example.invalid',
  permisos: new Set([
    'comercial.ordenes.gestionar',
    'comercial.presupuestos.gestionar',
  ]),
} as CurrentAuth;
let productoId: string;
beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('_test'))
    throw Error('Sólo base de pruebas.');
  await db.tenant.create({
    data: {
      id: tenantId,
      nombre: 'QA cambio de borrador',
      slug: `qa-${tenantId}`,
    },
  });
  await db.user.create({
    data: { id: userId, email: `${userId}@example.invalid` },
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
  const p = await db.producto.create({
    data: {
      tenantId,
      subcategoriaComercialId: subcategoriaId,
      codigo: 'QA-1',
      nombre: 'Impresión ficticia',
    },
  });
  productoId = p.id;
});
afterAll(async () => {
  await db.tenant.delete({ where: { id: tenantId } });
  await db.user.delete({ where: { id: userId } });
  await db.productoSubcategoriaComercial.delete({
    where: { id: subcategoriaId },
  });
  await db.productoCategoriaComercial.delete({ where: { id: categoriaId } });
  await db.$disconnect();
});
async function crearOrden() {
  const c = await db.cotizacion.create({
    data: {
      tenantId,
      items: {
        create: {
          tenantId,
          productoId,
          cantidad: 5,
          jobContextJson: { cantidad: 5, centroCopiado: { papel: 'Obra A4' } },
          snapshotJson: {
            producto: { codigo: 'QA-1', nombre: 'Impresión ficticia' },
            precio: { total: 1210 },
          },
          costoTotal: 450,
          precioNetoTotal: 1000,
          impuestosPorFueraTotal: 210,
          precioTotal: 1210,
          trazabilidadJson: { pasos: [{ nombre: 'Impresión', tiempoMin: 4 }] },
          descuentoTipo: 'PORCENTAJE',
          descuentoValor: 10,
          descuentoMonto: 111.11,
        },
      },
    },
    include: { items: true },
  });
  return db.ordenTrabajo.create({
    data: {
      tenantId,
      numero: `BORRADOR-${randomUUID()}`,
      cotizacionId: c.id,
      estado: 'borrador',
      canalVenta: 'mostrador',
      observaciones: 'Conservar la nota ficticia',
      fechaEntrega: new Date('2030-06-20'),
      subtotal: 1000,
      impuestos: 210,
      total: 1331,
      cargosDirectos: 121,
      cargosDirectosJson: [
        { nombreSnapshot: 'Envío ficticio', montoNeto: 100, total: 121 },
      ],
      descuentoTotal: 111.11,
      items: {
        create: {
          tenantId,
          cotizacionItemId: c.items[0].id,
          codigo: 'QA-1',
          nombre: 'Impresión ficticia',
          familia: 'Copiado',
          cantidad: 5,
          cantidadUnidad: 'hojas',
          subtotal: 1000,
          impuestos: 210,
          total: 1210,
          descuentoTipo: 'PORCENTAJE',
          descuentoValor: 10,
          descuentoMonto: 111.11,
          listoEnMostrador: true,
          fechaEntrega: new Date('2030-06-20'),
          specsJson: [{ etiqueta: 'Papel', valor: 'Obra A4' }],
          adicionalesJson: ['Anillado'],
          personalPrevistoJson: {
            version: 1,
            cotizacionItemId: c.items[0].id,
            pasos: [],
          },
        },
      },
    },
    include: { items: { include: { cotizacionItem: true } } },
  });
}
const cambiar = (
  tipo: 'orden' | 'presupuesto',
  id: string,
  version: Date,
  actor = auth,
) => servicio().cambiar(actor, tipo, id, version.toISOString());

it('OT → presupuesto → OT conserva precios, costos, fechas, descuentos, adjuntos y estados sin emitir', async () => {
  const original = await crearOrden();
  const archivo = await db.archivo.create({
    data: {
      tenantId,
      scope: 'ORDEN_ITEM',
      ordenItemId: original.items[0].id,
      key: `qa/${randomUUID()}.pdf`,
      nombreOriginal: 'ejemplo.pdf',
      mimeType: 'application/pdf',
      estado: 'LISTO',
    },
  });
  const presupuesto = await cambiar('orden', original.id, original.updatedAt);
  const p = await db.cotizacion.findUniqueOrThrow({
    where: { id: presupuesto.id },
    include: { items: true },
  });
  expect(p).toMatchObject({
    estado: 'borrador',
    clienteId: null,
    fechaEmision: null,
    publicToken: null,
    notificarWhatsapp: false,
  });
  expect(Number(p.total)).toBe(1331);
  expect(p.items[0].snapshotJson).toEqual(
    original.items[0].cotizacionItem!.snapshotJson,
  );
  expect(p.items[0].trazabilidadJson).toEqual(
    original.items[0].cotizacionItem!.trazabilidadJson,
  );
  expect(Number(p.items[0].costoTotal)).toBe(450);
  expect(
    await db.archivo.findUnique({ where: { id: archivo.id } }),
  ).toMatchObject({
    scope: 'COTIZACION',
    cotizacionId: p.id,
    ordenItemId: null,
  });
  expect(
    await db.ordenTrabajo.findUnique({ where: { id: original.id } }),
  ).toMatchObject({ estado: 'cancelada', estadoAlCancelar: 'borrador' });
  const vuelta = await cambiar('presupuesto', p.id, p.updatedAt);
  const ot = await db.ordenTrabajo.findUniqueOrThrow({
    where: { id: vuelta.id },
    include: { items: { include: { cotizacionItem: true } }, pasos: true },
  });
  expect(ot).toMatchObject({
    estado: 'borrador',
    fechaEmision: null,
    publicToken: null,
    canalVenta: 'mostrador',
    observaciones: original.observaciones,
    fechaEntrega: original.fechaEntrega,
  });
  expect(
    [ot.subtotal, ot.impuestos, ot.total, ot.descuentoTotal].map(Number),
  ).toEqual([1000, 210, 1331, 111.11]);
  expect(ot.cargosDirectosJson).toEqual(original.cargosDirectosJson);
  expect(ot.items[0]).toMatchObject({
    specsJson: original.items[0].specsJson,
    adicionalesJson: original.items[0].adicionalesJson,
    listoEnMostrador: true,
    fechaEntrega: original.items[0].fechaEntrega,
  });
  expect(ot.items[0].cotizacionItem!.jobContextJson).toEqual(
    original.items[0].cotizacionItem!.jobContextJson,
  );
  expect(ot.pasos).toHaveLength(0);
  expect(await db.ordenTrabajoContador.count({ where: { tenantId } })).toBe(0);
  expect(
    await db.archivo.findUnique({ where: { id: archivo.id } }),
  ).toMatchObject({
    scope: 'ORDEN_ITEM',
    ordenItemId: ot.items[0].id,
    key: archivo.key,
  });
  expect(await db.cotizacion.findUnique({ where: { id: p.id } })).toMatchObject(
    { estado: 'descartado' },
  );
  expect(
    await db.ordenTrabajoEvento.count({
      where: { tenantId, ordenId: ot.id, tipo: 'cambio_tipo_borrador' },
    }),
  ).toBe(1);
  // El cambio puede volver a hacerse, sin depender de un documento recién creado.
  expect((await cambiar('orden', ot.id, ot.updatedAt)).tipo).toBe(
    'presupuesto',
  );
});

it('dos solicitudes simultáneas y un reintento crean un único destino', async () => {
  const o = await crearOrden();
  const resultados = await Promise.all([
    cambiar('orden', o.id, o.updatedAt),
    cambiar('orden', o.id, o.updatedAt),
  ]);
  expect(resultados[0]).toEqual(resultados[1]);
  expect(await cambiar('orden', o.id, o.updatedAt)).toEqual(resultados[0]);
  const p = await db.cotizacion.findUniqueOrThrow({
    where: { id: resultados[0].id },
  });
  const vueltas = await Promise.all([
    cambiar('presupuesto', p.id, p.updatedAt),
    cambiar('presupuesto', p.id, p.updatedAt),
  ]);
  expect(vueltas[0]).toEqual(vueltas[1]);
});

it.each(['pendiente', 'produccion', 'finalizada', 'entregada', 'cancelada'])(
  'rechaza una OT %s',
  async (estado) => {
    const o = await crearOrden();
    const modificada = await db.ordenTrabajo.update({
      where: { id: o.id },
      data: { estado },
    });
    await expect(cambiar('orden', o.id, modificada.updatedAt)).rejects.toThrow(
      'Sólo se puede',
    );
  },
);
it('rechaza pagos e importes facturados, una revisión vieja y otra empresa', async () => {
  const o = await crearOrden();
  await expect(cambiar('orden', o.id, new Date(0))).rejects.toThrow('cambió');
  await expect(
    cambiar('orden', o.id, o.updatedAt, { ...auth, tenantId: randomUUID() }),
  ).rejects.toThrow();
  const cobrada = await db.ordenTrabajo.update({
    where: { id: o.id },
    data: { cobradoTotal: 100 },
  });
  await expect(cambiar('orden', o.id, cobrada.updatedAt)).rejects.toThrow(
    'sin emisión',
  );
  const facturada = await db.ordenTrabajo.update({
    where: { id: o.id },
    data: { cobradoTotal: 0, facturadoTotal: 100 },
  });
  await expect(cambiar('orden', o.id, facturada.updatedAt)).rejects.toThrow(
    'sin emisión',
  );
});
it('requiere ambos permisos sin ejecutar la transacción', async () => {
  const prisma = { $transaction: jest.fn() };
  await expect(
    servicio(prisma).cambiar(
      { ...auth, permisos: new Set(['comercial.ordenes.gestionar']) },
      'orden',
      randomUUID(),
      new Date().toISOString(),
    ),
  ).rejects.toThrow('permiso');
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
it.each(['enviado', 'aprobado', 'convertido', 'descartado'])(
  'rechaza presupuesto %s sin cambiar la orden original',
  async (estado) => {
    const o = await crearOrden();
    const p = await cambiar('orden', o.id, o.updatedAt);
    const c = await db.cotizacion.update({
      where: { id: p.id },
      data: { estado },
    });
    await expect(cambiar('presupuesto', p.id, c.updatedAt)).rejects.toThrow(
      'Sólo se puede',
    );
  },
);
it('un fallo en adjuntos revierte también el destino, la numeración y el archivo del original', async () => {
  const o = await crearOrden();
  const antes = await db.cotizacionContador.findMany({ where: { tenantId } });
  const prisma = {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      db.$transaction((tx) =>
        fn(
          new Proxy(tx, {
            get(target, prop) {
              if (prop === 'archivo')
                return {
                  ...target.archivo,
                  updateMany: () => {
                    throw Error('fallo simulado');
                  },
                };
              return Reflect.get(target, prop);
            },
          }),
        ),
      ),
  };
  await expect(
    servicio(prisma).cambiar(auth, 'orden', o.id, o.updatedAt.toISOString()),
  ).rejects.toThrow('fallo simulado');
  expect(
    await db.ordenTrabajo.findUnique({ where: { id: o.id } }),
  ).toMatchObject({ estado: 'borrador' });
  expect(await db.cotizacionContador.findMany({ where: { tenantId } })).toEqual(
    antes,
  );
});

it('un presupuesto nativo pasa a OT con el cliente, los importes y la receta congelada', async () => {
  const c = await db.cotizacion.create({
    data: {
      tenantId,
      numero: `PRES-QA-${randomUUID()}`,
      subtotal: 2000,
      impuestos: 420,
      total: 2420,
      canalVenta: 'mostrador',
      items: {
        create: {
          tenantId,
          productoId,
          cantidad: 2,
          jobContextJson: { cantidad: 2 },
          snapshotJson: { receta: { bom: { version: 1, componentes: [] } } },
          precioNetoTotal: 2000,
          impuestosPorFueraTotal: 420,
          precioTotal: 2420,
        },
      },
    },
    include: { items: true },
  });
  const presupuesto = await db.cotizacion.update({
    where: { id: c.id },
    data: {
      emisionJson: {
        items: [
          {
            cotizacionItemId: c.items[0].id,
            codigo: 'QA-1',
            nombre: 'Trabajo ficticio',
            familia: 'Impresión',
            cantidad: 2,
            cantidadUnidad: 'u.',
            subtotal: 2000,
            impuestos: 420,
            total: 2420,
            specs: [],
            adicionales: [],
          },
        ],
      },
    },
  });
  const r = await cambiar('presupuesto', presupuesto.id, presupuesto.updatedAt);
  const ot = await db.ordenTrabajo.findUniqueOrThrow({
    where: { id: r.id },
    include: { items: true },
  });
  expect(Number(ot.total)).toBe(2420);
  expect(ot.items[0].recetaSnapshotJson).toEqual({
    version: 1,
    componentes: [],
  });
});
it('conserva tratamiento sin comprobante y el snapshot fiscal en ambos sentidos', async () => {
  const original = await crearOrden();
  const o = await db.ordenTrabajo.update({
    where: { id: original.id },
    data: {
      tratamientoFiscal: 'SIN_COMPROBANTE',
      impuestos: 0,
      total: 1100,
      cargosDirectos: 100,
    },
  });
  const r = await cambiar('orden', o.id, o.updatedAt);
  const p = await db.cotizacion.findUniqueOrThrow({ where: { id: r.id } });
  expect([p.impuestos, p.total].map(Number)).toEqual([0, 1100]);
  const vuelta = await cambiar('presupuesto', p.id, p.updatedAt);
  const ot = await db.ordenTrabajo.findUniqueOrThrow({
    where: { id: vuelta.id },
    include: { items: true },
  });
  expect(ot.tratamientoFiscal).toBe('SIN_COMPROBANTE');
  expect(Number(ot.total)).toBe(1100);
  expect(Number(ot.items[0].impuestos)).toBe(210);
});
it('rechaza el acceso a un documento de otra empresa aunque ambas empresas existan', async () => {
  const otra = await db.tenant.create({
    data: { nombre: 'Otra empresa ficticia', slug: `otra-${randomUUID()}` },
  });
  try {
    const o = await crearOrden();
    await expect(
      cambiar('orden', o.id, o.updatedAt, { ...auth, tenantId: otra.id }),
    ).rejects.toThrow('No se encontró');
    const p = await cambiar('orden', o.id, o.updatedAt);
    const presupuesto = await db.cotizacion.findUniqueOrThrow({
      where: { id: p.id },
    });
    await expect(
      cambiar('presupuesto', p.id, presupuesto.updatedAt, {
        ...auth,
        tenantId: otra.id,
      }),
    ).rejects.toThrow('No se encontró');
  } finally {
    await db.tenant.delete({ where: { id: otra.id } });
  }
});
it('presupuesto histórico o enviado no se disfraza de borrador para cambiar de tipo', async () => {
  const o = await crearOrden();
  const r = await cambiar('orden', o.id, o.updatedAt);
  const p = await db.cotizacion.update({
    where: { id: r.id },
    data: { versionVigente: false },
  });
  await expect(cambiar('presupuesto', p.id, p.updatedAt)).rejects.toThrow(
    'Sólo se puede',
  );
  const enviado = await db.cotizacion.update({
    where: { id: p.id },
    data: { versionVigente: true, fechaEnvio: new Date() },
  });
  await expect(cambiar('presupuesto', p.id, enviado.updatedAt)).rejects.toThrow(
    'Sólo se puede',
  );
});
it('traslada la reserva de puntos y la planificación sin reservar ni cobrar dos veces', async () => {
  const cli = await db.cliente.create({
    data: {
      tenantId,
      nombre: `Cliente QA ${randomUUID()}`,
      telefonoCodigo: '54',
      telefonoNumero: '',
      paisCodigo: 'AR',
    },
  });
  const cuenta = await db.fidelizacionCuenta.create({
    data: {
      tenantId,
      clienteId: cli.id,
      saldoPuntos: 100,
      reservadosPuntos: 10,
    },
  });
  const original = await crearOrden();
  const o = await db.ordenTrabajo.update({
    where: { id: original.id },
    data: {
      clienteId: cli.id,
      fidelizacionCanjePuntos: 10,
      fidelizacionCanjeMonto: 100,
    },
  });
  const reserva = await db.fidelizacionReserva.create({
    data: {
      tenantId,
      cuentaId: cuenta.id,
      clienteId: cli.id,
      ordenId: o.id,
      cotizacionId: o.cotizacionId,
      puntos: 10,
      monto: 100,
    },
  });
  const plan = await db.planEntregaItem.create({
    data: {
      tenantId,
      ordenItemId: original.items[0].id,
      cotizacionItemId: original.items[0].cotizacionItemId,
    },
  });
  const r = await cambiar('orden', o.id, o.updatedAt);
  const p = await db.cotizacion.findUniqueOrThrow({ where: { id: r.id } });
  expect(p.clienteId).toBe(cli.id);
  expect(
    await db.fidelizacionReserva.findUnique({ where: { id: reserva.id } }),
  ).toMatchObject({
    ordenId: null,
    cotizacionId: p.id,
    puntos: 10,
    estado: 'RESERVADA',
  });
  expect(
    await db.planEntregaItem.findUnique({ where: { id: plan.id } }),
  ).toMatchObject({ ordenItemId: null });
  const vuelta = await cambiar('presupuesto', p.id, p.updatedAt);
  const ot = await db.ordenTrabajo.findUniqueOrThrow({
    where: { id: vuelta.id },
    include: { items: true },
  });
  expect(
    await db.fidelizacionReserva.findUnique({ where: { id: reserva.id } }),
  ).toMatchObject({
    ordenId: ot.id,
    cotizacionId: ot.cotizacionId,
    puntos: 10,
    estado: 'RESERVADA',
  });
  expect(
    await db.planEntregaItem.findUnique({ where: { id: plan.id } }),
  ).toMatchObject({
    ordenItemId: ot.items[0].id,
    cotizacionItemId: ot.items[0].cotizacionItemId,
  });
  expect(
    await db.fidelizacionCuenta.findUnique({ where: { id: cuenta.id } }),
  ).toMatchObject({ saldoPuntos: 100, reservadosPuntos: 10 });
  expect(
    await db.fidelizacionMovimiento.count({
      where: { tenantId, cuentaId: cuenta.id },
    }),
  ).toBe(0);
});
it('distribuye una sola vez el canje de un presupuesto nativo al convertir a borrador OT', async () => {
  const original = await crearOrden();
  const r = await cambiar('orden', original.id, original.updatedAt);
  const p = await db.cotizacion.findUniqueOrThrow({ where: { id: r.id } });
  const emision = p.emisionJson as Prisma.JsonObject;
  // La proyección de un presupuesto nativo guarda las líneas previas al canje.
  const nativo = await db.cotizacion.update({
    where: { id: p.id },
    data: {
      fidelizacionCanjeMonto: 100,
      total: 1231,
      emisionJson: { ...emision, importesConCanjeDistribuido: false },
    },
  });
  const vuelta = await cambiar('presupuesto', p.id, nativo.updatedAt);
  const ot = await db.ordenTrabajo.findUniqueOrThrow({
    where: { id: vuelta.id },
    include: { items: true },
  });
  expect(Number(ot.items[0].total) + Number(ot.cargosDirectos)).toBe(1231);
  expect(Number(ot.total)).toBe(1231);
  const deNuevo = await cambiar('orden', ot.id, ot.updatedAt);
  const siguiente = await db.cotizacion.findUniqueOrThrow({
    where: { id: deNuevo.id },
  });
  const ultima = await cambiar(
    'presupuesto',
    siguiente.id,
    siguiente.updatedAt,
  );
  const final = await db.ordenTrabajo.findUniqueOrThrow({
    where: { id: ultima.id },
    include: { items: true },
  });
  expect(Number(final.items[0].total) + Number(final.cargosDirectos)).toBe(
    1231,
  );
});
