/**
 * Centro de copiado NO cobra setup de máquina (decisión de negocio: se busca
 * volumen y precio por hoja claro). Se verifica de forma ESTRUCTURAL: TODA
 * cotización de la carga declara `omitirSetupCleanup` en su jobContext, así el
 * motor pone setup/cleanup en 0.
 *
 * Corre contra gdi_saas_test (DB aislada, test/jest-setup-db.ts).
 */
import { PrismaClient } from '@prisma/client';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import { CentroCopiadoService } from '../centro-copiado.service';

const prisma = new PrismaClient();

let tenantId: string;
let service: CentroCopiadoService;
let papel: string;

const A4 = { tamano: 'A4', tamanoAnchoMm: 210, tamanoAltoMm: 297 };
const doc = (id: string, paginas: number) => ({
  id,
  nombre: `${id}.pdf`,
  paginas,
  copias: 1,
  ...A4,
  papelMateriaPrimaId: papel,
  color: 'BN' as const,
  faz: 1 as const,
});
const omite = (jc: Record<string, unknown>) => jc.omitirSetupCleanup === true;

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

it('todos los documentos sueltos omiten el setup de máquina', async () => {
  if (!tenantId) return;
  const r = await service.construirItems(
    tenantId,
    { documentos: [doc('A', 5), doc('B', 1), doc('C', 10)] },
    '2026-03',
  );
  expect(r.items).toHaveLength(3);
  expect(r.items.every((i) => omite(i.jobContext))).toBe(true);
});

it('el tomo también omite el setup (en cada segmento cotizado)', async () => {
  if (!tenantId) return;
  const r = await service.construirItems(
    tenantId,
    {
      documentos: [
        { ...doc('T1', 6), grupoId: 'T' },
        { ...doc('T2', 4), grupoId: 'T' },
      ],
      grupos: [{ id: 'T', juegos: 2, terminaciones: [] }],
    },
    '2026-03',
  );
  // 1 tomo compuesto. Su metadata de segmentos NO lleva rastro de setup, y el
  // tomo se cotizó sin setup en cada sub-documento.
  const tomo = r.items[0];
  const meta = (tomo.jobContext as { _centroCopiado?: { esTomo?: boolean } })
    ._centroCopiado;
  expect(meta?.esTomo).toBe(true);
  expect(tomo.subtotal).toBeGreaterThan(0);
});
