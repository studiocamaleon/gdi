import { calcularTubosLed, seleccionarTubosLed } from '../iluminacion-tubos-led';
import { runDerivador } from '../derivadores';
import type { JobContext } from '../tipos';

const corto = { id: 'corto', precioReferencia: 10, atributosVarianteJson: { largo: 600, potencia: 9, tension: '220V', paso: 300 } };
const largo = { id: 'largo', precioReferencia: 15, atributosVarianteJson: { largo: 1200, potencia: 18, tension: '220V', paso: 300 } };
const params = { retiroBordeCm: 2, orientacion: 'automatico' };
const job = (anchoMm = 2360, altoMm = 1160, cantidad = 1): JobContext => ({ cantidad, interiorMm: { anchoMm, altoMm }, piezas: [{ cantidad, anchoMm, altoMm }] });

it('usa tubos de 60 cm cuando los de 120 cm no cubren el interior sin excederlo', () => {
  expect(seleccionarTubosLed([largo, corto], job(), params)?.id).toBe('corto');
  const r = calcularTubosLed(job(), params, corto.atributosVarianteJson);
  expect(r.magnitudes).toMatchObject({ tubos: 12, watts: 108 });
  expect(r.traza?.iluminacionTubos).toMatchObject({ filas: 4, tubosPorFila: 3, largoTuboMm: 600, tensionV: 220 });
  expect(runDerivador('sembrado_tubos_led', job(), params, corto.atributosVarianteJson)).toEqual(r);
});

it('elige 120 cm para un interior que los admite y escala por cantidad', () => {
  expect(seleccionarTubosLed([corto, largo], job(2960, 1460), params)?.id).toBe('largo');
  const r = calcularTubosLed(job(2960, 1460, 3), params, largo.atributosVarianteJson);
  expect(r.magnitudes).toMatchObject({ tubos: 30, watts: 540 });
  expect(r.traza?.iluminacionTubos).toMatchObject({ unidades: 3, tubosPorCartel: 10, wattsPorCartel: 180 });
  expect(r.magnitudes).not.toHaveProperty('fuentes');
});

it('respeta orientación, holgura y usa el interior aunque el frente sea mayor', () => {
  const ctx = { ...job(660, 1500), medidaVisibleMm: { anchoMm: 2000, altoMm: 2000 } };
  const r = calcularTubosLed(ctx, { ...params, orientacion: 'vertical' }, largo.atributosVarianteJson);
  expect(r.traza?.iluminacionTubos).toMatchObject({ orientacion: 'vertical', largoTuboMm: 1200, anchoMm: 660, tubosPorCartel: 3 });
  expect(calcularTubosLed(ctx, { ...params, orientacion: 'horizontal' }, largo.atributosVarianteJson).diagnostico).toBeDefined();
});

it.each([
  { ...corto.atributosVarianteJson, tension: '12V' },
  { ...corto.atributosVarianteJson, largo: undefined },
  { ...corto.atributosVarianteJson, paso: 0 },
  { ...corto.atributosVarianteJson, potencia: Infinity },
])('rechaza variantes incompletas o de baja tensión', attrs => {
  expect(calcularTubosLed(job(), params, attrs).diagnostico).toBeDefined();
});

it('rechaza caja pequeña, cantidades inválidas y medidas mezcladas', () => {
  for (const ctx of [job(400, 400), job(2360, 1160, 0), job(2360, 1160, 1.5), { ...job(), piezas: [...job().piezas!, { cantidad: 1, anchoMm: 900, altoMm: 800 }] }])
    expect(calcularTubosLed(ctx, params, corto.atributosVarianteJson).diagnostico).toBeDefined();
  expect(seleccionarTubosLed([{ ...corto, precioReferencia: 0 }], job(), params)).toBeNull();
});

it('ningún tubo ni hueco excede las dimensiones de la distribución', () => {
  for (let ancho = 650; ancho < 4000; ancho += 173) for (let alto = 650; alto < 2000; alto += 211) {
    for (const v of [corto, largo]) {
      const r = calcularTubosLed(job(ancho, alto), params, v.atributosVarianteJson);
      if (r.diagnostico) continue;
      const p = r.traza!.iluminacionTubos as import('../iluminacion-tubos-led').IluminacionTubosEjecutada;
      const longitudinal = p.orientacion === 'horizontal' ? ancho : alto;
      expect(p.separacionFilasMm).toBeLessThanOrEqual(300);
      expect(p.separacionExtremosMm).toBeGreaterThanOrEqual(0);
      expect(p.separacionExtremosMm).toBeLessThanOrEqual(300);
      expect(p.tubosPorFila * (p.largoTuboMm + p.separacionExtremosMm) + 2 * p.retiroMm).toBeCloseTo(longitudinal);
    }
  }
});
