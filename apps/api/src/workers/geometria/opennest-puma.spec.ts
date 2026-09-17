import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
} from '../colas';
import {
  calcularMinimoTeoricoPlacas,
  OpenNestService,
} from './opennest.service';
import { validarResultadoNestingOpenNest } from './validar-nesting-opennest';

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/puma-200cm.json'), 'utf8'),
) as {
  entrada: NestingIrregularOpenNestData;
  solucionDosPlacas: NestingIrregularOpenNestResult;
};

it('las ocho partes del Puma de 200 cm caben en dos placas sin cambiar margen ni separación', () => {
  const { entrada, solucionDosPlacas } = fixture;
  expect(entrada.placa).toMatchObject({
    anchoMm: 1200,
    altoMm: 600,
    margenMm: 10,
  });
  expect(entrada.separacionMm).toBe(5);
  expect(calcularMinimoTeoricoPlacas(entrada)).toBe(2);
  const validado = validarResultadoNestingOpenNest(entrada, solucionDosPlacas);
  expect(validado.placasUsadas).toBe(2);
  expect(validado.cantidadColocada).toBe(8);
});

// Prueba real, opt-in: requiere el entorno de compas_nest y consume CPU.
(process.env.OPENNEST_INTEGRATION === '1' ? it : it.skip).each([1, 2, 3])(
  'el motor real encuentra el mínimo del Puma con la política de producción (repetición %s)',
  async () => {
    const result = await new OpenNestService().resolver({
      ...fixture.entrada,
      timeoutMs: 120_000,
    });
    expect(result.placasUsadas).toBe(2);
    expect(result.cantidadColocada).toBe(8);
    expect(result.busqueda?.motivoFin).toBe('MINIMO_PLACAS');
  },
  140_000,
);
