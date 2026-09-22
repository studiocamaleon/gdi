import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';
import { EmisionFiscalService } from '../emision-fiscal.service';
import { FacturacionOrdenesService } from '../facturacion-ordenes.service';
import { ManualProvider } from '../invoicing/manual.provider';
import type { AfipSdkProvider } from '../invoicing/afip-sdk.provider';
import type { EmitirInput } from '../invoicing/invoicing-provider';
const prisma = new PrismaClient();
const db = prisma as unknown as PrismaService;
afterAll(() => prisma.$disconnect());
beforeAll(async () => {
  const [fila] = await prisma.$queryRaw<
    Array<{ nombre: string }>
  >`SELECT current_database() AS nombre`;
  if (!fila.nombre.endsWith('_test')) throw new Error('Sólo base de pruebas.');
});
async function escenario(
  fn: (f: Awaited<ReturnType<typeof preparar>>) => Promise<void>,
) {
  const f = await preparar();
  try {
    await fn(f);
  } finally {
    await prisma.tenant.delete({ where: { id: f.tenantId } });
    await prisma.plan.delete({ where: { id: f.plan.id } });
  }
}
async function preparar() {
  const tenant = await prisma.tenant.create({
    data: {
      slug: `fiscal-concurrente-${randomUUID()}`,
      nombre: 'Ensayo concurrente',
    },
  });
  const tenantId = tenant.id;
  const plan = await prisma.plan.create({
    data: {
      codigo: randomUUID(),
      nombre: 'ARCA legacy',
      precioMensual: 190,
      featuresJson: { afip: true },
    },
  });
  await prisma.suscripcion.create({
    data: { tenantId, planId: plan.id, estado: 'activa' },
  });
  const config = await prisma.configuracionFiscal.create({
    data: {
      tenantId,
      razonSocial: 'Emisor',
      cuit: '30000000015',
      condicionFiscal: 'RI',
      proveedorFacturacion: 'afipsdk',
    },
  });
  await prisma.integracionTenant.create({
    data: { tenantId, proveedor: 'AFIP', estado: 'CONECTADA' },
  });
  const pvs = await Promise.all(
    [1, 2].map((numero) =>
      prisma.puntoVenta.create({
        data: {
          tenantId,
          configuracionFiscalId: config.id,
          numero,
          nombre: `Prueba ${numero}`,
        },
      }),
    ),
  );
  const auth = {
    tenantId,
    userId: randomUUID(),
    permisos: new Set(['administracion.gestionar']),
  } as CurrentAuth;
  const emitir = jest.fn((i: EmitirInput) =>
    Promise.resolve({
      estado: 'emitido' as const,
      numero: i.numero!,
      cae: '12345678901234',
      caeVencimiento: '2026-10-02',
      raw: {},
    }),
  );
  const provider = {
    codigo: 'afipsdk',
    disponible: true,
    environment: 'dev',
    cuitOperativo: (s: string) => s,
    ultimoNumero: () => Promise.resolve(0),
    emitir,
  } as unknown as AfipSdkProvider;
  const svc = new EmisionFiscalService(
    db,
    new ManualProvider(),
    provider,
    new FacturacionOrdenesService(db),
  );
  const nuevo = (pv: number, ordenId?: string) =>
    prisma.comprobante.create({
      data: {
        tenantId,
        puntoVentaId: pvs[pv].id,
        tipo: 'factura',
        letra: 'B',
        fecha: new Date('2026-09-22'),
        receptorSnapshot: {
          nombre: 'Consumidor Final',
          condicionFiscal: 'consumidor_final',
        },
        itemsJson: [
          {
            descripcion: 'Prueba',
            cantidad: 1,
            precioUnitarioSinIva: 121,
            alicuotaIva: 21,
          },
        ],
        netoGravado: 100,
        ivaPorAlicuota: [],
        ivaTotal: 21,
        total: 121,
        saldoPendiente: 121,
        idempotencyKey: randomUUID(),
        ...(ordenId
          ? { ordenes: { create: { tenantId, ordenId, monto: 121 } } }
          : {}),
      },
    });
  return { tenantId, plan, auth, svc, nuevo, emitir };
}
it('dos conexiones concurrentes no envían dos veces la misma serie', async () => {
  await escenario(async (f) => {
    const a = await f.nuevo(0),
      b = await f.nuevo(0);
    const resultados = await Promise.allSettled([
      f.svc.emitir(f.auth, a.id),
      f.svc.emitir(f.auth, b.id),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(f.emitir).toHaveBeenCalledTimes(1);
    expect(
      await prisma.comprobante.count({
        where: { tenantId: f.tenantId, estado: 'emitido' },
      }),
    ).toBe(1);
  });
});
it('dos puntos de venta concurrentes no facturan el doble de una misma OT', async () => {
  await escenario(async (f) => {
    const ot = await prisma.ordenTrabajo.create({
      data: {
        tenantId: f.tenantId,
        numero: 'OT-EMISION-CONCURRENTE',
        estado: 'finalizada',
        total: 121,
      },
    });
    const a = await f.nuevo(0, ot.id),
      b = await f.nuevo(1, ot.id);
    const resultados = await Promise.allSettled([
      f.svc.emitir(f.auth, a.id),
      f.svc.emitir(f.auth, b.id),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(f.emitir).toHaveBeenCalledTimes(1);
    expect(
      Number(
        (await prisma.ordenTrabajo.findUniqueOrThrow({ where: { id: ot.id } }))
          .facturadoTotal,
      ),
    ).toBe(121);
  });
});
it('series independientes alcanzan ARCA simultáneamente: no hay transacción esperando la red', async () => {
  await escenario(async (f) => {
    const a = await f.nuevo(0),
      b = await f.nuevo(1);
    let liberar!: () => void;
    const red = new Promise<void>((r) => {
      liberar = r;
    });
    const normal = f.emitir.getMockImplementation()!;
    f.emitir.mockImplementation(async (input) => {
      if (f.emitir.mock.calls.length === 2) liberar();
      await red;
      return normal(input);
    });
    let agotoTiempo = false;
    const limite = setTimeout(() => {
      agotoTiempo = true;
      liberar();
    }, 1500);
    try {
      const resultados = await Promise.all([
        f.svc.emitir(f.auth, a.id),
        f.svc.emitir(f.auth, b.id),
      ]);
      expect(agotoTiempo).toBe(false);
      expect(resultados.every((r) => r.aplicada)).toBe(true);
      expect(f.emitir).toHaveBeenCalledTimes(2);
    } finally {
      clearTimeout(limite);
      liberar();
    }
  });
});
