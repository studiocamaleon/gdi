/**
 * Etapa F — E2E backend del camino de staging del modal:
 *   construir-items (payload del modal)
 *     → cotizarYGuardar (lo que hace persistirSnapshotsItems al "Guardar cambios")
 *       → CotizacionItem con trazabilidad de pasos (materializable) + metadata.
 *
 * Prueba que el jobContext que arma el modal sobrevive el round-trip de guardado
 * y produce un item estándar listo para la OT. DB aislada (gdi_saas_test).
 */
import { PrismaClient } from '@prisma/client';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import { CentroCopiadoService } from '../centro-copiado.service';

const prisma = new PrismaClient();

let tenantId: string;
let motor: MotorUniversalService;
let service: CentroCopiadoService;
let papel: string;

beforeAll(async () => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'gdi-demo' },
  });
  tenantId = tenant?.id ?? '';
  if (!tenantId) return;

  motor = new MotorUniversalService(
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

it('construir-items → cotizarYGuardar → CotizacionItem materializable con metadata', async () => {
  if (!tenantId) return;

  // 1) El modal arma el payload del documento.
  const construidos = await service.construirItems(
    tenantId,
    {
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
          color: 'BN',
          faz: 2,
        },
      ],
    },
    '2026-03',
  );
  const payload = construidos.items[0];
  expect(payload.error).toBeNull();
  expect(payload.cotizacion).not.toBeNull();

  // 2) "Guardar cambios" (persistirSnapshotsItems): cotizarYGuardar con el mismo
  //    productoId + jobContext que el modal dejó en el PropuestaItem.
  const res = await motor.cotizarYGuardar({
    tenantId,
    productoId: payload.productoId,
    jobContext: payload.jobContext as never,
    periodo: '2026-03',
  });
  expect(res.result.exitoso).toBe(true);
  expect(res.cotizacionItemId).toBeTruthy();

  // 3) El CotizacionItem persistido es estándar y materializable.
  const ci = await prisma.cotizacionItem.findUniqueOrThrow({
    where: { id: res.cotizacionItemId! },
  });
  const pasos = (
    ci.trazabilidadJson as { pasos?: { familiaCodigo?: string }[] }
  ).pasos;
  expect(Array.isArray(pasos)).toBe(true);
  expect(pasos!.some((p) => p.familiaCodigo === 'impresion_por_hoja')).toBe(
    true,
  );

  // 4) La metadata de la carga sobrevivió el guardado (para el alta de OT).
  const meta = (ci.jobContextJson as { _centroCopiado?: { hojas?: number } })
    ._centroCopiado;
  expect(meta?.hojas).toBe(12);
});
