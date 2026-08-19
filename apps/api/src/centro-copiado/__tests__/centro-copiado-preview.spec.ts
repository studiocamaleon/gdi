/**
 * Etapa C — preview del TPV Centro de copiado.
 * Cotiza varios documentos (sueltos + un tomo) y verifica la aritmética del
 * adaptador (páginas→carillas→hojas), la agrupación y los totales.
 * Precios: sólo se asertan relaciones (>0, tomo = suma de sus docs), no montos
 * absolutos (dependen de las tarifas del tenant).
 *
 * Corre contra gdi_saas_test (DB aislada, test/jest-setup-db.ts).
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import { CentroCopiadoService } from '../centro-copiado.service';
import { CC_PRODUCTO_CODIGO } from '../provisionar-plantilla';

const prisma = new PrismaClient();

let tenantId: string;
let service: CentroCopiadoService;
let papel: string;

beforeAll(async () => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'gdi-demo' },
  });
  tenantId = tenant?.id ?? '';
  if (!tenantId) return;

  const motor = new MotorUniversalService(
    prisma as never,
    new AplicarPrecioService(),
    new PreciosEspecialesClientesService(prisma as never),
  );
  service = new CentroCopiadoService(prisma as never, motor);
  // El servicio provisiona el plantilla lazy (idempotente y race-safe).

  const p = await prisma.materiaPrima.findFirstOrThrow({
    where: { tenantId, subfamilia: 'SUSTRATO_HOJA' },
    include: { variantes: { where: { activo: true } } },
    orderBy: { nombre: 'asc' },
  });
  papel = p.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

it('cotiza sueltos + un tomo: aritmética, agrupación y totales', async () => {
  if (!tenantId) return;

  const dto = {
    documentos: [
      // Suelto A: 12 págs × 2 copias, A4, B/N, doble faz ⇒ 24 carillas, 12 hojas
      {
        id: 'A',
        paginas: 12,
        copias: 2,
        tamano: 'A4',
        tamanoAnchoMm: 210,
        tamanoAltoMm: 297,
        papelMateriaPrimaId: papel,
        color: 'BN' as const,
        faz: 2 as const,
      },
      // Suelto B: 6 págs × 1, A3, color, simple faz ⇒ 6 carillas, 6 hojas
      {
        id: 'B',
        paginas: 6,
        copias: 1,
        tamano: 'A3',
        tamanoAnchoMm: 297,
        tamanoAltoMm: 420,
        papelMateriaPrimaId: papel,
        color: 'COLOR' as const,
        faz: 1 as const,
      },
      // Tomo T (2 juegos): C (10 págs, doble) + D (4 págs, simple)
      {
        id: 'C',
        paginas: 10,
        copias: 1,
        tamano: 'A4',
        tamanoAnchoMm: 210,
        tamanoAltoMm: 297,
        papelMateriaPrimaId: papel,
        color: 'BN' as const,
        faz: 2 as const,
        grupoId: 'T',
      },
      {
        id: 'D',
        paginas: 4,
        copias: 1,
        tamano: 'A4',
        tamanoAnchoMm: 210,
        tamanoAltoMm: 297,
        papelMateriaPrimaId: papel,
        color: 'BN' as const,
        faz: 1 as const,
        grupoId: 'T',
      },
    ],
    // Sin anillado: este spec verifica la ARITMÉTICA de impresión. Si el tomo
    // anillara (default) y hay anilladora cargada en paralelo, el subtotal del
    // tomo sumaría el anillado y no cerraría contra C+D.
    grupos: [{ id: 'T', juegos: 2, terminaciones: [] }],
  };

  const r = await service.cotizar(tenantId, dto, '2026-03');

  // Sin errores de cotización.
  const conError = r.documentos.filter((d) => d.error);
  if (conError.length)
    console.error(
      'DOCS CON ERROR:',
      conError.map((d) => `${d.id}: ${d.error}`).join(' | '),
    );
  expect(r.documentos.every((d) => d.error === null)).toBe(true);

  const byId = Object.fromEntries(r.documentos.map((d) => [d.id, d]));
  // Aritmética del adaptador.
  expect(byId.A.carillas).toBe(24);
  expect(byId.A.hojas).toBe(12);
  expect(byId.A.pliegos).toBe(12);
  expect(byId.B.carillas).toBe(6);
  expect(byId.B.hojas).toBe(6);
  // Agrupados: copias = juegos del tomo (2).
  expect(byId.C.carillas).toBe(20); // 10 × 2 juegos
  expect(byId.C.hojas).toBe(10); // doble faz
  expect(byId.D.carillas).toBe(8); // 4 × 2
  expect(byId.D.hojas).toBe(8); // simple faz

  // Totales.
  expect(r.totales.documentos).toBe(4);
  expect(r.totales.tomos).toBe(1);
  expect(r.totales.carillas).toBe(24 + 6 + 20 + 8); // 58
  expect(r.totales.hojasFisicas).toBe(12 + 6 + 10 + 8); // 36

  // Tomo: hojas por libro (un juego) = ceil(10/2) + 4 = 9; subtotal = suma de C+D.
  const tomo = r.grupos.find((g) => g.id === 'T')!;
  expect(tomo.hojasPorLibro).toBe(9);
  expect(tomo.subtotal).toBeCloseTo(byId.C.subtotal + byId.D.subtotal, 2);

  // Precios coherentes.
  expect(r.totales.subtotal).toBeGreaterThan(0);
  expect(r.totales.total).toBeGreaterThanOrEqual(r.totales.subtotal);
});

it('rechaza medidas que no coinciden con el formato declarado', async () => {
  if (!tenantId) return;
  await expect(
    service.cotizar(tenantId, {
      documentos: [
        {
          id: 'formato-adulterado',
          paginas: 1,
          copias: 1,
          tamano: 'A4',
          tamanoAnchoMm: 297,
          tamanoAltoMm: 420,
          papelMateriaPrimaId: papel,
          color: 'BN',
          faz: 1,
        },
      ],
    }),
  ).rejects.toThrow('no coincide con el catálogo');
});

it('aplica y deja snapshot del precio especial del cliente en Carga rápida', async () => {
  if (!tenantId) return;

  await service.getConfig(tenantId);
  const producto = await prisma.producto.findUniqueOrThrow({
    where: {
      tenantId_codigo: { tenantId, codigo: CC_PRODUCTO_CODIGO },
    },
    select: { id: true },
  });
  const sufijo = randomUUID().slice(0, 8);
  const cliente = await prisma.cliente.create({
    data: {
      tenantId,
      nombre: `Cliente CC especial ${sufijo}`,
      emailPrincipal: `cc-${sufijo}@test.local`,
      telefonoCodigo: '11',
      telefonoNumero: '55550000',
      paisCodigo: 'AR',
    },
  });
  const especial = await prisma.productoPrecioEspecialClienteV2.create({
    data: {
      tenantId,
      productoId: producto.id,
      clienteId: cliente.id,
      configJson: {
        metodoCalculo: 'por_margen',
        detalle: { marginPct: 5 },
      },
    },
  });

  try {
    const r = await service.construirItems(
      tenantId,
      {
        clienteId: cliente.id,
        documentos: [
          {
            id: 'especial-cliente',
            paginas: 2,
            copias: 1,
            tamano: 'A4',
            tamanoAnchoMm: 210,
            tamanoAltoMm: 297,
            papelMateriaPrimaId: papel,
            color: 'BN',
            faz: 1,
          },
        ],
      },
      '2026-03',
    );

    expect(r.items[0].error).toBeNull();
    expect(
      r.items[0].cotizacion?.desglosePrecio?.precioEspecialCliente,
    ).toEqual({ precioEspecialId: especial.id, clienteId: cliente.id });
  } finally {
    await prisma.productoPrecioEspecialClienteV2.delete({
      where: { id: especial.id },
    });
    await prisma.cliente.delete({ where: { id: cliente.id } });
  }
});
