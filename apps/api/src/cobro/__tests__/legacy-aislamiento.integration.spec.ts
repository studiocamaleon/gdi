import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SuscripcionesService } from '../../suscripciones/suscripciones.service';
import type { SuscripcionReconciliacionScheduler } from '../../suscripciones/suscripcion-reconciliacion.scheduler';
import type { PaddleService } from '../paddle.service';
import { SuscripcionSyncService } from '../suscripcion-sync.service';

// custom_data puede provenir de Paddle.js. La firma del proveedor autentica
// el evento, pero no autoriza a contratar para el tenant escrito en ese campo.
const db = new PrismaService();
const sync = new SuscripcionSyncService(db);
const tenants: string[] = [];
let planId: string;
const priceId = `pri_${randomUUID().replaceAll('-', '').slice(0, 26)}`;
const referencia = `sub_${randomUUID().replaceAll('-', '').slice(0, 26)}`;
const paddle = {
  listarFacturas: jest.fn().mockResolvedValue([]),
  tarjetaDelCliente: jest.fn().mockResolvedValue(null),
};
const servicio = new SuscripcionesService(
  db,
  paddle as unknown as PaddleService,
  sync,
  {} as SuscripcionReconciliacionScheduler,
);

beforeAll(async () => {
  const plan = await db.plan.create({
    data: {
      codigo: `qa-legacy-${randomUUID()}`,
      nombre: 'Plan histórico ficticio',
      precioMensual: 49,
      featuresJson: {},
      publico: true,
      paddlePriceId: priceId,
    },
  });
  planId = plan.id;
  for (let i = 0; i < 4; i++) {
    const tenant = await db.tenant.create({
      data: {
        nombre: `Empresa ficticia ${i}`,
        slug: `qa-legacy-${randomUUID()}`,
      },
    });
    tenants.push(tenant.id);
  }
  await db.suscripcion.createMany({
    data: [
      { tenantId: tenants[0], planId, estado: 'activa', proveedor: 'manual' },
      {
        tenantId: tenants[2],
        planId,
        estado: 'activa',
        proveedor: 'paddle',
        referenciaExterna: referencia,
        clienteExternoId: 'ctm_ficticio',
      },
      {
        tenantId: tenants[3],
        planId,
        estado: 'baja',
        proveedor: 'paddle',
        referenciaExterna: `sub_baja_${randomUUID()}`,
      },
    ],
  });
});

afterAll(async () => {
  await db.tenant.deleteMany({ where: { id: { in: tenants } } });
  if (planId) await db.plan.delete({ where: { id: planId } });
  await db.$disconnect();
});

function evento(tenantId: string, ref = `sub_${randomUUID()}`) {
  return {
    referencia: ref,
    tenantId,
    estadoProveedor: 'active',
    clienteExterno: 'ctm_ficticio',
    proximoCobro: null,
    periodoDesde: null,
    precios: [priceId],
    cambioProgramado: null,
    cambioProgramadoEl: null,
  };
}

it.each([0, 1, 3])(
  'no vincula un precio histórico por custom_data de la empresa %s',
  async (i) => {
    const antes = await db.suscripcion.findMany({
      where: { tenantId: tenants[i] },
    });
    const resultado = await sync.aplicar(evento(tenants[i]), {
      origen: 'webhook',
    });
    expect(resultado.aplicado).toBe(false);
    expect(
      await db.suscripcion.findMany({ where: { tenantId: tenants[i] } }),
    ).toEqual(antes);
  },
);

it('renueva una referencia histórica ya vinculada e ignora otro tenant en custom_data', async () => {
  const antes = await db.suscripcion.findMany({
    where: { tenantId: tenants[0] },
  });
  expect(await sync.aplicar(evento(tenants[0], referencia))).toMatchObject({
    aplicado: true,
    tenantId: tenants[2],
    estado: 'activa',
  });
  expect(
    await db.suscripcion.findMany({ where: { tenantId: tenants[0] } }),
  ).toEqual(antes);
});

it.each([0, 1, 3])(
  'no ofrece un checkout histórico nuevo a la empresa %s',
  async (i) => {
    const estado = await servicio.estadoParaTenant(tenants[i]);
    expect(estado.planes.some((p) => p.priceId === priceId)).toBe(false);
  },
);

it('conserva el catálogo histórico para gestionar una referencia ya vinculada', async () => {
  const estado = await servicio.estadoParaTenant(tenants[2]);
  expect(estado.puedeCambiarSinPago).toBe(true);
  expect(estado.planes.some((p) => p.priceId === priceId)).toBe(true);
});
