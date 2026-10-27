import {
  calcularTiraLed,
  seleccionarFuentesTira,
} from '../iluminacion-tira-led';
import { runDerivador } from '../derivadores';
import { derivacionesDelJobContext } from '../derivadores/tipos';
import { MotorUniversalService } from '../motor.service';
import type { JobContext } from '../tipos';

const job = (cantidad = 1) =>
  ({
    cantidad,
    profundidadMm: 150,
    piezas: [{ anchoMm: 2400, altoMm: 1200, cantidad }],
  }) as JobContext;
// Fixture ficticio: no define una densidad recomendada para un producto real.
const tira = { potencia: 8, tension: '12V', corte: 25 };
const params = { separacionCm: 10, retiroBordeCm: 2.5, margenFuentePct: 30 };
const fuente = (id: string, capacidad: number, tension = '12V') => ({
  id,
  sku: id,
  precioReferencia: 1000,
  unidadStock: 'UNIDAD',
  atributosVarianteJson: { capacidad, tension },
});

it('calcula metros instalados, cortes completos y consumo sin confundir LED con módulos', () => {
  const r = calcularTiraLed(job(), params, tira);
  expect(r.diagnostico).toBeUndefined();
  expect(r.magnitudes.metrosTira).toBeCloseTo(28.2);
  expect(r.magnitudes.wattsPorCartel).toBeCloseTo(225.6);
  expect(r.traza?.iluminacionTira).toMatchObject({
    filas: 12,
    largoFilaMm: 2350,
    alimentacionesMinimas: null,
  });
  expect(runDerivador('sembrado_tira_led', job(), params, tira)).toEqual(r);
});

it('usa la medida interior y no la lona con demasía ni un override de área', () => {
  const ctx = {
    ...job(),
    interiorMm: { anchoMm: 2320, altoMm: 1120 },
    piezaAreaTotalM2: 15,
  };
  const r = calcularTiraLed(ctx, params, tira);
  expect(r.traza?.iluminacionTira).toMatchObject({
    anchoMm: 2320,
    filas: 11,
    largoFilaMm: 2250,
  });
  expect(r.magnitudes.metrosTira).toBeCloseTo(24.75);
});

it('al girar las filas respeta los puntos de corte y el largo máximo por alimentación', () => {
  const r = calcularTiraLed(
    job(),
    { ...params, orientacion: 'vertical' },
    { ...tira, maxAlimentacion: 1 },
  );
  expect(r.traza?.iluminacionTira).toMatchObject({
    filas: 24,
    largoFilaMm: 1150,
    alimentacionesMinimas: 48,
  });
  expect(r.magnitudes.metrosTira).toBeCloseTo(27.6);
});

it.each([
  [{ ...tira, potencia: 0 }, params],
  [{ ...tira, potencia: undefined }, params],
  [{ ...tira, tension: '220V' }, params],
  [{ ...tira, corte: Infinity }, params],
  [tira, { ...params, separacionCm: 0 }],
  [tira, { ...params, separacionCm: undefined }],
  [tira, { ...params, retiroBordeCm: 200 }],
  [tira, { ...params, margenFuentePct: -10 }],
])(
  'bloquea datos inválidos y no devuelve un consumo eléctrico de cero',
  (attrs, config) => {
    expect(calcularTiraLed(job(), config, attrs).diagnostico).toBeDefined();
  },
);

it('rechaza varias medidas en un ítem y cantidades fraccionarias', () => {
  expect(
    calcularTiraLed(
      {
        ...job(),
        piezas: [...job().piezas!, { anchoMm: 100, altoMm: 200, cantidad: 1 }],
      },
      params,
      tira,
    ).diagnostico,
  ).toBeDefined();
  expect(calcularTiraLed(job(1.5), params, tira).diagnostico).toBeDefined();
});

it('acepta coma decimal y formato de tensión del proveedor', () => {
  expect(
    calcularTiraLed(job(), params, {
      potencia: '8,0',
      tension: '12 V DC',
      corte: '25',
    }).magnitudes.wattsPorCartel,
  ).toBeCloseTo(225.6);
});

it('elige una fuente compatible por cartel y el consumo escala con la cantidad', () => {
  const r = calcularTiraLed(job(2), params, tira);
  expect(r.magnitudes.metrosTira).toBeCloseTo(56.4);
  expect(r.magnitudes.wattsPorCartel).toBeCloseTo(225.6);
  const plan = seleccionarFuentesTira(
    [
      fuente('incorrecta', 300, '24V'),
      fuente('grande', 350),
      fuente('justa', 300),
    ],
    r.magnitudes,
  );
  expect(plan?.variante.id).toBe('justa');
  expect(plan?.cantidad).toBe(1);
});

it('dimensiona varias fuentes sin sobrecargar una por el redondeo de cortes', () => {
  const r = calcularTiraLed(job(), params, tira);
  const plan = seleccionarFuentesTira(
    [fuente('f150', 150), fuente('f100', 100)],
    r.magnitudes,
  )!;
  expect(plan.cantidad).toBe(2);
  expect(plan.variante.id).toBe('f150');
  expect(plan.consumoMaximoPorFuenteW * 1.3).toBeLessThanOrEqual(
    plan.capacidadW,
  );
  expect(
    seleccionarFuentesTira([fuente('otra', 350, '24V')], r.magnitudes),
  ).toBeNull();
});

it('integra selección y cantidad de fuentes en el motor, también para elección fija', async () => {
  const ctx = job(2);
  derivacionesDelJobContext(ctx).paso = calcularTiraLed(ctx, params, tira);
  const service = Object.create(MotorUniversalService.prototype);
  const paso = { configPasoId: 'paso', familiaCodigo: 'iluminacion_tira_led' };
  const variantes = [fuente('f150', 150), fuente('f24', 350, '24V')];
  service.cargarVariantePorId = jest.fn(async (_tenant: string, id: string) =>
    variantes.find((v) => v.id === id),
  );
  const slot = {
    slotCodigo: 'fuente',
    modoSeleccion: 'MOTOR_ELIGE_AUTO',
    formula: 'fijo',
    candidatos: [{ variantes: variantes.map((v) => ({ varianteId: v.id })) }],
  };
  const seleccion = await service.resolverMaterialSlot(
    'empresa-ficticia',
    slot,
    ctx,
    paso,
  );
  expect(seleccion?.id).toBe('f150');
  expect(service.cantidadSlotDerivada(paso, slot, ctx, seleccion)).toBe(4);
  expect(
    derivacionesDelJobContext(ctx).paso?.traza?.iluminacionTira,
  ).toMatchObject({ fuentes: { porCartel: 2, capacidadW: 150 } });
  expect(
    await service.resolverMaterialSlot(
      'empresa-ficticia',
      { ...slot, modoSeleccion: 'HARDCODED', materialVariante: variantes[1] },
      ctx,
      paso,
    ),
  ).toBeNull();
});
