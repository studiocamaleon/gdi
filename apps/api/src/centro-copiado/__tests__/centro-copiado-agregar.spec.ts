/**
 * Etapa D — agregar-a-orden: persiste la representación canónica de la carga
 * (un renglón por suelto y uno por tomo compuesto) en una cotización borrador.
 *
 * Corre contra gdi_saas_test (DB aislada).
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

function dtoBoceto() {
  return {
    documentos: [
      {
        id: 'A',
        nombre: 'Contrato.pdf',
        paginas: 12,
        copias: 2,
        tamano: 'A4',
        tamanoAnchoMm: 210,
        tamanoAltoMm: 297,
        papelMateriaPrimaId: papel,
        color: 'BN' as const,
        faz: 2 as const,
      },
      {
        id: 'C',
        nombre: 'Escritura.pdf',
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
        nombre: 'Reglamento.pdf',
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
    // Sin terminaciones: este spec verifica la estructura de impresión y no
    // depende de que exista una anilladora en la base compartida.
    grupos: [{ id: 'T', nombre: 'Expediente', juegos: 2, terminaciones: [] }],
  };
}

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

it('persiste sueltos y tomos con la misma representación canónica del staging', async () => {
  if (!tenantId) return;

  const r = await service.agregarAOrden(tenantId, dtoBoceto(), '2026-03');

  expect(r.cotizacionId).toBeTruthy();
  expect(r.items).toHaveLength(2);
  expect(r.items.every((i) => i.error === null && i.cotizacionItemId)).toBe(
    true,
  );
  // Un suelto + un tomo compuesto.
  expect(r.totales.tomos).toBe(1);
  expect(r.items.map((i) => i.documentoId).sort()).toEqual(['A', 'T']);

  // Persistencia real: las mismas 2 unidades visibles del staging.
  const dbItems = await prisma.cotizacionItem.findMany({
    where: { cotizacionId: r.cotizacionId },
  });
  expect(dbItems).toHaveLength(2);

  // Cada item es estándar (recotizable): tiene snapshot y trazabilidad.
  expect(
    dbItems.every(
      (i) => i.snapshotJson !== null && i.trazabilidadJson !== null,
    ),
  ).toBe(true);

  // Metadata de la carga persistida en jobContextJson, con un solo grupoCargaId.
  const metas = dbItems.map(
    (i) =>
      (
        i.jobContextJson as Record<
          string,
          {
            grupoTomoId?: string | null;
            grupoCargaId?: string;
            nombre?: string;
            esTomo?: boolean;
            tomoNombre?: string;
            segmentos?: unknown[];
          }
        >
      )._centroCopiado,
  );
  expect(metas.every((m) => m?.grupoCargaId === r.grupoCargaId)).toBe(true);
  expect(new Set(metas.map((m) => m?.grupoCargaId)).size).toBe(1);
  const tomo = metas.find((m) => m?.esTomo);
  expect(tomo?.tomoNombre).toBe('Expediente');
  expect(tomo?.segmentos).toHaveLength(2);
  expect(metas.find((m) => !m?.esTomo)?.nombre).toBe('Contrato.pdf');
});

it('construir-items: payload por doc con snapshot, especificaciones y jobContext', async () => {
  if (!tenantId) return;

  const r = await service.construirItems(tenantId, dtoBoceto(), '2026-03');

  expect(r.grupoCargaId).toBeTruthy();
  // 1 suelto (A) + 1 tomo compuesto (C+D) = 2 items.
  expect(r.items).toHaveLength(2);
  expect(r.items.every((i) => i.error === null)).toBe(true);

  const a = r.items.find((i) => i.documentoId === 'A')!;
  // Snapshot completo para renderizar sin guardar.
  expect(a.cotizacion).not.toBeNull();
  expect(a.productoId).toBeTruthy();
  // Especificaciones legibles para el renglón.
  expect(a.especificaciones['Tamaño']).toBe('A4');
  expect(a.especificaciones['Faz']).toBe('Doble faz (2 caras)');
  expect(a.especificaciones['Archivo']).toBe('Contrato.pdf');
  expect(a.especificaciones['Hojas físicas']).toBe('12');
  // El jobContext lleva la metadata de carga (persiste al guardar).
  const meta = (a.jobContext as { _centroCopiado?: { hojas?: number } })
    ._centroCopiado;
  expect(meta?.hojas).toBe(12);
  // Montos coherentes.
  expect(a.subtotal).toBeGreaterThan(0);
  expect(a.total).toBeGreaterThanOrEqual(a.subtotal);
  // impuestoMonto = IVA por fuera (bruto − neto), NO el totalImpuestos por unidad
  // (que daba un valor chico y rompía el Resumen financiero). En la DB de test el
  // IVA puede ser 0 (bruto = neto), así que sólo se verifica la relación.
  expect(a.impuestoMonto).toBeCloseTo(a.total - a.subtotal, 1);
});

it('agrega a una cotización borrador existente sin duplicarla', async () => {
  if (!tenantId) return;

  const primera = await service.agregarAOrden(tenantId, dtoBoceto(), '2026-03');
  const segunda = await service.agregarAOrden(
    tenantId,
    { ...dtoBoceto(), cotizacionId: primera.cotizacionId },
    '2026-03',
  );

  expect(segunda.cotizacionId).toBe(primera.cotizacionId);
  const dbItems = await prisma.cotizacionItem.findMany({
    where: { cotizacionId: primera.cotizacionId },
  });
  expect(dbItems).toHaveLength(4); // 2 + 2
});
