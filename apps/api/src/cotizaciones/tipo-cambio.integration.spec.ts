import { randomUUID } from 'node:crypto';
import { serviciosRecorridoF4 } from '../../test/soporte-recorridos-f4';
import type { CurrentAuth } from '../auth/auth.types';
import { Prisma, PrismaClient } from '@prisma/client';
import { TipoCambioService } from './tipo-cambio.service';
import { MotorUniversalService } from '../motor-universal/motor.service';
import { AplicarPrecioService } from '../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import { CentroCopiadoService } from '../centro-copiado/centro-copiado.service';
import { declararUnidadPrecioFixture } from '../../test/fixture-unidad-precio';
import { cambioDelSnapshot } from './validar-moneda-documento';

const prisma = new PrismaClient();
let tenantId: string;
let restaurarUnidades: (() => Promise<void>) | undefined;
let originales: Array<{ id: string; moneda: string | null }> = [];
const cotizaciones: string[] = [];
const ordenesCreadas: string[] = [];
const cambios: string[] = [];
let motor: MotorUniversalService;
let cambioService: TipoCambioService;
const proveedor = { dolar: jest.fn() };

beforeAll(async () => {
  tenantId = (
    await prisma.tenant.findUniqueOrThrow({ where: { slug: 'gdi-demo' } })
  ).id;
  restaurarUnidades = await declararUnidadPrecioFixture(prisma, tenantId);
  originales = await prisma.materiaPrimaVariante.findMany({
    where: { tenantId },
    select: { id: true, moneda: true },
  });
  await prisma.materiaPrimaVariante.updateMany({
    where: { tenantId },
    data: { moneda: 'USD' },
  });
  cambioService = new TipoCambioService(prisma as never, proveedor as never);
  motor = new MotorUniversalService(
    prisma as never,
    new AplicarPrecioService(),
    new PreciosEspecialesClientesService(prisma as never),
  );
  Object.assign(motor, { tipoCambio: cambioService });
});
afterAll(async () => {
  for (const v of originales)
    await prisma.materiaPrimaVariante.update({
      where: { id: v.id },
      data: { moneda: v.moneda },
    });
  await restaurarUnidades?.();
  await prisma.ordenTrabajo.deleteMany({
    where: { id: { in: ordenesCreadas } },
  });
  await prisma.cotizacionItem.deleteMany({
    where: { cotizacionId: { in: cotizaciones } },
  });
  await prisma.cotizacion.deleteMany({ where: { id: { in: cotizaciones } } });
  await prisma.tipoCambioCotizacion.deleteMany({
    where: { id: { in: cambios } },
  });
  await prisma.$disconnect();
});
async function manual(tasa: number) {
  const snapshot = await cambioService.crear(tenantId, null, {
    modo: 'manual',
    tasa,
  });
  cambios.push(snapshot.id);
  return snapshot;
}

it('cotiza todos los materiales en USD, congela la tasa y persiste su trazabilidad', async () => {
  const producto = await prisma.producto.findFirstOrThrow({
    where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
  });
  const fx = await manual(1500);
  const entrada = {
    tenantId,
    productoId: producto.id,
    tipoCambioId: fx.id,
    periodo: '2026-03',
    jobContext: {
      cantidad: 1,
      piezas: [{ cantidad: 1, anchoMm: 1000, altoMm: 500 }],
    },
  };
  const guardado = await motor.cotizarYGuardar(entrada);
  expect(
    guardado.result.errores.filter((e) => e.severidad === 'ERROR'),
  ).toEqual([]);
  expect(guardado.result.exitoso).toBe(true);
  expect(guardado.cotizacionItemId).toBeTruthy();
  cotizaciones.push(guardado.cotizacionId!);
  const quote = guardado.result.cotizacion!;
  expect(quote.tipoCambio).toEqual(fx);
  expect(quote.costosMaterialesMoneda?.length).toBeGreaterThan(0);
  for (const m of quote.costosMaterialesMoneda!)
    expect(m.costoUnitarioDestino).toBeCloseTo(
      m.precioPorUnidadUsoOrigen * 1500,
      5,
    );
  const persistido = await prisma.cotizacionItem.findUniqueOrThrow({
    where: { id: guardado.cotizacionItemId },
  });
  expect(cambioDelSnapshot(persistido.snapshotJson)).toEqual(fx);
  const actualizado = await manual(2000);
  const nueva = await motor.cotizar({
    ...entrada,
    tipoCambioId: actualizado.id,
  });
  expect(nueva.exitoso).toBe(true);
  expect(nueva.cotizacion!.costos.materialesTotal).toBeCloseTo(
    (quote.costos.materialesTotal * 2000) / 1500,
    3,
  );
  const historico = await motor.cotizar(entrada);
  expect(historico.cotizacion!.costos.materialesTotal).toBe(
    quote.costos.materialesTotal,
  );
  expect(proveedor.dolar).not.toHaveBeenCalled();
  await expect(
    motor.cotizarYGuardar({
      ...entrada,
      cotizacionId: guardado.cotizacionId,
      tipoCambioId: actualizado.id,
    }),
  ).rejects.toThrow('mismo para todos');
});

it('Centro de copiado comparte la tasa entre segmentos y guarda el tomo completo', async () => {
  const papel = await prisma.materiaPrima.findFirstOrThrow({
    where: { tenantId, subfamilia: 'SUSTRATO_HOJA' },
    orderBy: { nombre: 'asc' },
  });
  const fx = await manual(1500);
  const dto = {
    tipoCambioId: fx.id,
    documentos: [10, 6].map((paginas, index) => ({
      id: String(index),
      paginas,
      copias: 1,
      tamano: 'A4',
      tamanoAnchoMm: 210,
      tamanoAltoMm: 297,
      papelMateriaPrimaId: papel.id,
      color: 'BN' as const,
      faz: 1 as const,
      grupoId: 'T',
    })),
    grupos: [{ id: 'T', juegos: 2, terminaciones: [] }],
  };
  const service = new CentroCopiadoService(prisma as never, motor);
  const construido = await service.construirItems(tenantId, dto, '2026-03');
  expect(construido.items[0].error).toBeNull();
  expect(construido.items[0].cotizacion?.tipoCambio).toEqual(fx);
  const guardado = await service.guardarTomo(tenantId, dto, '2026-03');
  expect(guardado.error).toBeNull();
  cotizaciones.push(guardado.cotizacionId!);
  const item = await prisma.cotizacionItem.findUniqueOrThrow({
    where: { id: guardado.cotizacionItemId! },
  });
  expect(cambioDelSnapshot(item.snapshotJson)).toEqual(fx);
  expect(guardado.total).toBe(construido.items[0].total);
});

it.each([false, true])(
  'guarda revisiones de OT y conserva los históricos (orden anterior a USD: %s)',
  async (legacy) => {
    const producto = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
    });
    const fxOriginal = await manual(1500);
    const fxNueva = await manual(2000);
    const entrada = {
      tenantId,
      productoId: producto.id,
      periodo: '2026-03',
      jobContext: {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 1000, altoMm: 500 }],
      },
    };
    const original = await motor.cotizarYGuardar({
      ...entrada,
      tipoCambioId: fxOriginal.id,
    });
    const nuevo = await motor.cotizarYGuardar({
      ...entrada,
      tipoCambioId: fxNueva.id,
    });
    expect(original.result.exitoso && nuevo.result.exitoso).toBe(true);
    cotizaciones.push(original.cotizacionId!, nuevo.cotizacionId!);
    if (legacy) {
      const item = await prisma.cotizacionItem.findUniqueOrThrow({
        where: { id: original.cotizacionItemId! },
      });
      const snapshot = { ...(item.snapshotJson as Prisma.JsonObject) };
      delete snapshot.tipoCambio;
      delete snapshot.costosMaterialesMoneda;
      await prisma.cotizacionItem.update({
        where: { id: item.id },
        data: { snapshotJson: snapshot as Prisma.InputJsonObject },
      });
      await prisma.cotizacion.update({
        where: { id: original.cotizacionId! },
        data: { tipoCambioId: null },
      });
    }
    const anterior = await prisma.cotizacionItem.findUniqueOrThrow({
      where: { id: original.cotizacionItemId! },
    });
    const orden = await prisma.ordenTrabajo.create({
      data: {
        tenantId,
        numero: `OT-USD-${randomUUID()}`,
        estado: 'borrador',
        canalVenta: 'mostrador',
        cotizacionId: original.cotizacionId,
        items: {
          create: {
            tenantId,
            cotizacionItemId: original.cotizacionItemId,
            codigo: producto.codigo,
            nombre: producto.nombre,
            familia: 'Vinilo',
            cantidad: 0.5,
            cantidadUnidad: 'm2',
            subtotal: anterior.precioNetoTotal!,
            impuestos: anterior.impuestosPorFueraTotal!,
            total: anterior.precioTotal!,
          },
        },
      },
      include: { items: true },
    });
    ordenesCreadas.push(orden.id);
    const actor = await prisma.user.findFirstOrThrow();
    const auth = {
      tenantId,
      userId: actor.id,
      email: actor.email,
      permisos: new Set([
        'comercial.gestionar',
        'comercial.ver',
        'comercial.ver_margenes',
      ]),
    } as CurrentAuth;
    const { ordenes } = serviciosRecorridoF4(prisma);
    const siguiente = await prisma.cotizacionItem.findUniqueOrThrow({
      where: { id: nuevo.cotizacionItemId! },
    });
    const payload = {
      expectedVersion: orden.updatedAt.toISOString(),
      tipoCambioId: fxNueva.id,
      items: [
        {
          id: orden.items[0].id,
          cotizacionItemId: nuevo.cotizacionItemId!,
          codigo: producto.codigo,
          nombre: producto.nombre,
          familia: 'Vinilo',
          cantidad: 0.5,
          cantidadUnidad: 'm2',
          subtotal: Number(siguiente.precioNetoTotal),
          impuestos: Number(siguiente.impuestosPorFueraTotal),
          total: Number(siguiente.precioTotal),
        },
      ],
    };
    if (legacy) {
      // Agregar una línea actual no obliga a cambiar importes de líneas antiguas.
      payload.items.push({
        ...payload.items[0],
        cotizacionItemId: anterior.id,
        subtotal: Number(anterior.precioNetoTotal),
        impuestos: Number(anterior.impuestosPorFueraTotal),
        total: Number(anterior.precioTotal),
      });
      payload.items[0] = { ...payload.items[0], id: undefined! };
    }
    await expect(
      ordenes.editarLote(auth, orden.id, {
        ...payload,
        tipoCambioId: fxOriginal.id,
      }),
    ).rejects.toThrow('distintos tipos');
    await ordenes.editarLote(auth, orden.id, payload);
    const guardada = await prisma.ordenTrabajo.findUniqueOrThrow({
      where: { id: orden.id },
      include: { items: true },
    });
    expect(guardada.cotizacionId).toBe(original.cotizacionId);
    expect(
      guardada.items.some(
        (item) => item.cotizacionItemId === nuevo.cotizacionItemId,
      ),
    ).toBe(true);
    if (legacy)
      expect(
        guardada.items.some((item) => item.cotizacionItemId === anterior.id),
      ).toBe(true);
    const intacto = await prisma.cotizacionItem.findUniqueOrThrow({
      where: { id: original.cotizacionItemId! },
    });
    expect(intacto.snapshotJson).toEqual(anterior.snapshotJson);
    expect(intacto.precioTotal).toEqual(anterior.precioTotal);
  },
);
