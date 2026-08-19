/**
 * Tomo compuesto (Tomo-A): un tomo anillado = UN CotizacionItem sintético que
 * agrega la impresión de sus sub-documentos (costos/precio sumados, pasos
 * concatenados → materializable). DB aislada (gdi_saas_test).
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

const dtoTomo = () => ({
  documentos: [
    {
      id: 'C',
      nombre: 'Contrato.pdf',
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
      id: 'E',
      nombre: 'Escritura.pdf',
      paginas: 6,
      copias: 1,
      tamano: 'A4',
      tamanoAnchoMm: 210,
      tamanoAltoMm: 297,
      papelMateriaPrimaId: papel,
      color: 'BN' as const,
      faz: 1 as const,
      grupoId: 'T',
    },
    // Un suelto para verificar que NO se colapsa.
    {
      id: 'S',
      nombre: 'Suelto.pdf',
      paginas: 4,
      copias: 1,
      tamano: 'A4',
      tamanoAnchoMm: 210,
      tamanoAltoMm: 297,
      papelMateriaPrimaId: papel,
      color: 'BN' as const,
      faz: 1 as const,
    },
  ],
  // Sin terminaciones: verifica el COLAPSO del tomo, no el anillado (que sumaría
  // un renglón aparte si hay anilladora cargada en paralelo).
  grupos: [{ id: 'T', nombre: 'Expediente Paz', juegos: 2, terminaciones: [] }],
});

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
    orderBy: { nombre: 'asc' },
  });
  papel = p.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

it('construir-items colapsa el tomo en UN item compuesto (+ el suelto aparte)', async () => {
  if (!tenantId) return;
  const r = await service.construirItems(tenantId, dtoTomo(), '2026-03');

  // 1 compuesto (tomo) + 1 suelto = 2 items.
  expect(r.items).toHaveLength(2);
  const tomo = r.items.find(
    (i) =>
      (i.jobContext as { _centroCopiado?: { esTomo?: boolean } })._centroCopiado
        ?.esTomo,
  )!;
  const suelto = r.items.find((i) => i.documentoId === 'S')!;
  expect(tomo).toBeDefined();
  expect(suelto).toBeDefined();

  expect(tomo.error).toBeNull();
  expect(tomo.cotizacion).not.toBeNull();
  // Agrega los 2 sub-documentos: al menos 2 pasos de impresión concatenados.
  const pasos =
    (
      tomo.cotizacion as {
        pasos?: { familiaCodigo?: string; rutaPasoOrden?: number }[];
      }
    ).pasos ?? [];
  expect(
    pasos.filter((p) => p.familiaCodigo === 'impresion_por_hoja').length,
  ).toBeGreaterThanOrEqual(2);
  // rutaPasoOrden re-indexado y único (si no, la ficha colisiona keys de React).
  const ordenes = pasos.map((p) => p.rutaPasoOrden);
  expect(new Set(ordenes).size).toBe(ordenes.length);

  // Desglose consistente (no el bug del margen negativo): precioBase y comisiones
  // son totales del tomo, así el IIBB (residual = neto − base − comisiones) es
  // razonable y el margen (base − costo) queda positivo.
  const cot = tomo.cotizacion as {
    costos: { total: number };
    desglosePrecio: {
      precioBase: number;
      totalComisiones: number;
      precioNetoTotal: number;
    };
  };
  const dg = cot.desglosePrecio;
  expect(dg.precioBase).toBeGreaterThan(cot.costos.total); // margen positivo
  const iibb = dg.precioNetoTotal - dg.precioBase - dg.totalComisiones;
  expect(iibb).toBeGreaterThanOrEqual(-1); // no negativo (salvo redondeo)
  expect(iibb / dg.precioNetoTotal).toBeLessThan(0.3); // no el 65% del bug
  // Especificaciones del tomo.
  expect(tomo.especificaciones['Terminación']).toBe('Ninguna');
  expect(tomo.especificaciones['Documentos']).toBe('2');
  expect(tomo.especificaciones['Documento 1']).toContain('Contrato.pdf');
  expect(tomo.cantidad).toBe(2); // juegos
  // Metadata con los segmentos para rehidratar.
  const meta = (tomo.jobContext as { _centroCopiado: { segmentos: unknown[] } })
    ._centroCopiado;
  expect(meta.segmentos).toHaveLength(2);
});

it('guardar-tomo persiste UN CotizacionItem con pasos concatenados y metadata', async () => {
  if (!tenantId) return;
  const dto = dtoTomo();
  const r = await service.guardarTomo(
    tenantId,
    {
      documentos: dto.documentos.filter((d) => d.grupoId === 'T'),
      grupos: dto.grupos,
    },
    '2026-03',
  );
  expect(r.error).toBeNull();
  expect(r.cotizacionItemId).toBeTruthy();
  expect(r.total).toBeGreaterThan(0);

  const ci = await prisma.cotizacionItem.findUniqueOrThrow({
    where: { id: r.cotizacionItemId! },
  });
  const pasos =
    (ci.trazabilidadJson as { pasos?: { familiaCodigo?: string }[] }).pasos ??
    [];
  expect(
    pasos.filter((p) => p.familiaCodigo === 'impresion_por_hoja').length,
  ).toBeGreaterThanOrEqual(2);
  const meta = (
    ci.jobContextJson as {
      _centroCopiado?: { esTomo?: boolean; segmentos?: unknown[] };
    }
  )._centroCopiado;
  expect(meta?.esTomo).toBe(true);
  expect(meta?.segmentos).toHaveLength(2);
  expect(Number(ci.costoTotal)).toBeGreaterThan(0);
  expect(Number(ci.precioNetoTotal)).toBe(r.subtotal);
  expect(Number(ci.impuestosPorFueraTotal)).toBe(r.iva);
  expect(Number(ci.precioTotal)).toBe(r.total);
});

it('un fallo de cotización no deja una cotización vacía', async () => {
  if (!tenantId) return;
  const antes = await prisma.cotizacion.count({ where: { tenantId } });
  const motorFallido = {
    cotizar: jest.fn().mockResolvedValue({
      exitoso: false,
      errores: [{ mensaje: 'fallo inducido del motor' }],
    }),
  };
  const servicioFallido = new CentroCopiadoService(
    prisma as never,
    motorFallido as never,
  );
  const dto = dtoTomo();

  const resultado = await servicioFallido.guardarTomo(
    tenantId,
    {
      documentos: dto.documentos.filter((d) => d.grupoId === 'T'),
      grupos: dto.grupos,
    },
    '2026-03',
  );

  expect(resultado.error).toContain('fallo inducido');
  await expect(prisma.cotizacion.count({ where: { tenantId } })).resolves.toBe(
    antes,
  );
});
