import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';
import { ComprobantesService } from '../comprobantes.service';
import { EmisionFiscalService } from '../emision-fiscal.service';
import { FacturacionOrdenesService } from '../facturacion-ordenes.service';
import { ManualProvider } from '../invoicing/manual.provider';
import { FacturaService } from '../factura.service';
import { ClientesService } from '../../clientes/clientes.service';
import { ClientesQueryDto } from '../../clientes/dto/clientes-query.dto';

const db = new PrismaService();
const capacidades = { exigir: jest.fn(), exigirOperacionTx: jest.fn() };
const motor = new FacturacionOrdenesService(db);
const manual = new ManualProvider();
const enviar = jest.spyOn(manual, 'emitir');
const emisiones = new EmisionFiscalService(
  db,
  manual,
  {} as never,
  motor,
  capacidades as never,
);
const service = Object.assign(Object.create(ComprobantesService.prototype), {
  prisma: db,
  capacidades,
  afipIntegracion: { facturacionHabilitada: async () => true },
}) as ComprobantesService;
let tenantId: string,
  clienteId: string,
  puntoVentaId: string,
  auth: CurrentAuth;

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (
    !url.pathname.endsWith('_test') ||
    !['localhost', '127.0.0.1'].includes(url.hostname)
  )
    throw new Error('Sólo base local de pruebas.');
});
beforeEach(async () => {
  enviar.mockClear();
  tenantId = randomUUID();
  await db.tenant.create({
    data: { id: tenantId, slug: tenantId, nombre: 'Imprenta ficticia' },
  });
  auth = {
    tenantId,
    userId: randomUUID(),
    permisos: new Set(['administracion.gestionar', 'administracion.anular']),
  } as CurrentAuth;
  const config = await db.configuracionFiscal.create({
    data: {
      tenantId,
      razonSocial: 'Emisor ficticio',
      cuit: '30000000015',
      condicionFiscal: 'RI',
      proveedorFacturacion: 'manual',
    },
  });
  puntoVentaId = (
    await db.puntoVenta.create({
      data: {
        tenantId,
        configuracionFiscalId: config.id,
        numero: 1,
        nombre: 'Local',
      },
    })
  ).id;
  clienteId = (
    await db.cliente.create({
      data: {
        tenantId,
        nombre: 'Taller ficticio',
        razonSocial: 'Receptor anterior',
        cuit: '30000000015',
        condicionFiscal: 'consumidor_final',
        telefonoCodigo: '54',
        telefonoNumero: '1111111111',
        paisCodigo: 'AR',
      },
    })
  ).id;
});
afterEach(async () => {
  await db.tenant.delete({ where: { id: tenantId } });
});
afterAll(() => db.$disconnect());
const borrador = () =>
  service.crear(auth, {
    tipo: 'factura',
    clienteId,
    puntoVentaId,
    items: [
      {
        descripcion: 'Impresión ficticia',
        cantidad: 1,
        precioUnitarioSinIva: 121,
        alicuotaIva: 21,
      },
    ],
  });
const leer = (id: string) =>
  db.comprobante.findUniqueOrThrow({ where: { id } });

it('NC B conserva al receptor original y refactura A con datos actuales sin duplicar deuda ni perder el pago', async () => {
  const ot = await db.ordenTrabajo.create({
    data: {
      tenantId,
      clienteId,
      numero: 'OT-FICTICIA',
      estado: 'finalizada',
      total: 121,
      cobradoTotal: 121,
      items: {
        create: {
          tenantId,
          nombre: 'Impresión',
          codigo: 'F',
          familia: 'Prueba',
          cantidad: 1,
          cantidadUnidad: 'unidad',
          subtotal: 100,
          impuestos: 21,
          total: 121,
        },
      },
    },
  });
  const original = await service.facturarOrden(auth, ot.id, {
    puntoVentaId,
    emitir: false,
  });
  await emisiones.emitir(auth, original.id);
  const metodo = await db.metodoPago.create({
    data: {
      tenantId,
      nombre: 'Efectivo ficticio',
      codigo: 'test',
      tipo: 'efectivo',
    },
  });
  const cuenta = await db.cuentaFondos.create({
    data: { tenantId, nombre: 'Caja ficticia', tipo: 'caja' },
  });
  const cobro = await db.cobro.create({
    data: {
      tenantId,
      clienteId,
      ordenId: ot.id,
      fecha: new Date(),
      metodoPagoId: metodo.id,
      cuentaDestinoId: cuenta.id,
      montoBruto: 121,
      netoAcreditado: 121,
      disponibleReal: 121,
      estadoAcreditacion: 'acreditado',
    },
  });
  await db.$transaction((tx) => motor.matchearCobro(tx, tenantId, cobro.id));
  await db.cliente.update({
    where: { id: clienteId },
    data: {
      razonSocial: 'Receptor actualizado',
      condicionFiscal: 'RI',
      cuit: '30000000023',
    },
  });
  const nc = await service.notaCreditoTotal(auth, original.id);
  await emisiones.emitir(auth, original.id);
  expect(nc.estado).toBe('borrador');
  expect(enviar).toHaveBeenCalledTimes(1);
  expect(nc.letra).toBe('B');
  expect(nc.total).toBe(121);
  expect((await leer(nc.id)).receptorSnapshot).toEqual(
    (await leer(original.id)).receptorSnapshot,
  );
  expect(nc.ordenes).toEqual(original.ordenes);
  expect((await service.obtener(auth, original.id)).notasCredito).toEqual([
    { id: nc.id, estado: 'borrador', total: 121 },
  ]);
  await emisiones.emitir(auth, nc.id);
  expect(
    Number(
      (await db.ordenTrabajo.findUniqueOrThrow({ where: { id: ot.id } }))
        .facturadoTotal,
    ),
  ).toBe(0);
  expect(Number((await leer(original.id)).saldoPendiente)).toBe(0);
  expect(
    await db.cobroImputacion.count({ where: { comprobanteId: original.id } }),
  ).toBe(0);
  const nueva = await service.facturarOrden(auth, ot.id, {
    puntoVentaId,
    emitir: false,
  });
  expect(nueva.letra).toBe('A');
  expect(nueva.total).toBe(121);
  expect(nueva.clienteRazonSocial).toBe('Receptor actualizado');
  await emisiones.emitir(auth, nueva.id);
  const ordenFinal = await db.ordenTrabajo.findUniqueOrThrow({
    where: { id: ot.id },
  });
  expect(Number(ordenFinal.facturadoTotal)).toBe(121);
  expect(Number(ordenFinal.cobradoTotal)).toBe(121);
  expect(Number((await leer(nueva.id)).saldoPendiente)).toBe(0);
  expect(await db.cobro.count({ where: { tenantId } })).toBe(1);
  expect((await service.obtener(auth, original.id)).clienteCuit).toBe(
    '30000000015',
  );
  const pdf = await new FacturaService(db, {
    paraDocumentos: async () => ({ nombre: 'Empresa ficticia' }),
  } as never).documento(tenantId, nc.id);
  expect(pdf.receptor.razonSocial).toBe('Receptor anterior');
  expect(pdf.receptor.cuit).toBe('30-00000001-5');
});

it.each(['razonSocial', 'cuit', 'condicionFiscal'] as const)(
  'rechaza antes de enviar un borrador si cambia %s',
  async (campo) => {
    const c = await borrador();
    await db.cliente.update({
      where: { id: clienteId },
      data: {
        [campo]:
          campo === 'cuit'
            ? '30000000023'
            : campo === 'condicionFiscal'
              ? 'RI'
              : 'Otro receptor',
      },
    });
    await expect(emisiones.emitir(auth, c.id)).rejects.toThrow(
      'datos fiscales del cliente cambiaron',
    );
    expect(enviar).not.toHaveBeenCalled();
    expect(
      await db.comprobanteEmision.count({ where: { comprobanteId: c.id } }),
    ).toBe(0);
    expect((await leer(c.id)).numero).toBeNull();
  },
);

it('conserva descuentos, varias alícuotas y USD sin recalcularlos con la condición nueva', async () => {
  const c = await service.crear(auth, {
    tipo: 'factura',
    clienteId,
    puntoVentaId,
    moneda: 'USD',
    cotizacion: 1200,
    items: [
      {
        descripcion: 'Uno',
        cantidad: 3,
        precioUnitarioSinIva: 121,
        alicuotaIva: 21,
        bonificacionPct: 10,
      },
      {
        descripcion: 'Dos',
        cantidad: 2,
        precioUnitarioSinIva: 110.5,
        alicuotaIva: 10.5,
      },
    ],
  });
  await emisiones.emitir(auth, c.id);
  const nc = await service.notaCreditoTotal(auth, c.id);
  for (const campo of [
    'items',
    'ivaPorAlicuota',
    'ivaTotal',
    'netoGravado',
    'total',
    'moneda',
    'cotizacion',
  ] as const)
    expect(nc[campo]).toEqual(c[campo]);
  await expect(service.notaCreditoTotal(auth, c.id)).rejects.toThrow(
    'ya tiene una nota',
  );
});

it('rechaza corregir una factura ajena y exige permiso de anular', async () => {
  const c = await borrador();
  await emisiones.emitir(auth, c.id);
  await expect(
    service.notaCreditoTotal({ ...auth, tenantId: randomUUID() }, c.id),
  ).rejects.toThrow('No se encontró');
  await expect(
    service.notaCreditoTotal(
      { ...auth, permisos: new Set(['administracion.comprobantes.gestionar']) },
      c.id,
    ),
  ).rejects.toThrow('permiso');
});

it('una factura agrupada libera todas sus órdenes y una segunda NC no puede duplicar el crédito', async () => {
  const ordenes = await Promise.all(
    [1, 2].map((n) =>
      db.ordenTrabajo.create({
        data: {
          tenantId,
          clienteId,
          numero: `OT-GRUPO-${n}`,
          estado: 'finalizada',
          total: 121,
        },
      }),
    ),
  );
  const c = await service.crear(auth, {
    tipo: 'factura',
    clienteId,
    puntoVentaId,
    ordenes: ordenes.map((o) => ({ ordenId: o.id, monto: 121 })),
    items: [
      {
        descripcion: 'Grupo ficticio',
        cantidad: 2,
        precioUnitarioSinIva: 121,
        alicuotaIva: 21,
      },
    ],
  });
  await emisiones.emitir(auth, c.id);
  const nc = await service.notaCreditoTotal(auth, c.id);
  const duplicada = await service.crear(auth, {
    tipo: 'nota_credito',
    clienteId,
    puntoVentaId,
    comprobanteOrigenId: c.id,
    items: [
      {
        descripcion: 'Grupo ficticio',
        cantidad: 2,
        precioUnitarioSinIva: 121,
        alicuotaIva: 21,
      },
    ],
    ordenes: ordenes.map((o) => ({ ordenId: o.id, monto: 121 })),
  });
  await emisiones.emitir(auth, nc.id);
  await expect(emisiones.emitir(auth, duplicada.id)).rejects.toThrow(
    'No se puede acreditar dos veces',
  );
  expect(enviar).toHaveBeenCalledTimes(2);
  for (const orden of ordenes)
    expect(
      Number(
        (await db.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } }))
          .facturadoTotal,
      ),
    ).toBe(0);
});

it('no incorpora en la nota ni en el PDF un CUIT agregado después de la factura', async () => {
  await db.cliente.update({ where: { id: clienteId }, data: { cuit: null } });
  const c = await borrador();
  await emisiones.emitir(auth, c.id);
  await db.cliente.update({
    where: { id: clienteId },
    data: { cuit: '30000000015', condicionFiscal: 'RI' },
  });
  const nc = await service.notaCreditoTotal(auth, c.id);
  expect(nc.clienteCuit).toBeNull();
  await emisiones.emitir(auth, nc.id);
  const pdf = await new FacturaService(db, {
    paraDocumentos: async () => ({ nombre: 'Empresa ficticia' }),
  } as never).documento(tenantId, nc.id);
  expect(pdf.receptor.cuit).toBeNull();
});

it('encuentra por razón social un cliente posterior al 200 y respeta empresa e ID', async () => {
  await db.cliente.createMany({
    data: Array.from({ length: 230 }, (_, i) => ({
      tenantId,
      nombre: `Cliente ${String(i).padStart(3, '0')}`,
      razonSocial: i === 229 ? 'Último receptor ficticio' : 'Empresa ejemplo',
      telefonoCodigo: '54',
      telefonoNumero: '1111111111',
      paisCodigo: 'AR',
    })),
  });
  const clientes = new ClientesService(db);
  const buscar = (f: Partial<ClientesQueryDto>) =>
    clientes.findAll(
      auth,
      Object.assign(new ClientesQueryDto(), { limit: 30 }, f),
    );
  const resultado = await buscar({ q: 'ultimo receptor' });
  expect((await buscar({ q: '30-00000001-5' })).data.map((c) => c.id)).toEqual([
    clienteId,
  ]);
  expect(resultado.total).toBe(1);
  expect(resultado.data[0].nombre).toBe('Cliente 229');
  expect((await buscar({ id: resultado.data[0].id })).data).toHaveLength(1);
  expect(
    (await buscar({ id: clienteId, q: 'ultimo receptor' })).data,
  ).toHaveLength(0);
  expect(
    (
      await clientes.findAll(
        { ...auth, tenantId: randomUUID() },
        Object.assign(new ClientesQueryDto(), { id: clienteId }),
      )
    ).data,
  ).toHaveLength(0);
});
