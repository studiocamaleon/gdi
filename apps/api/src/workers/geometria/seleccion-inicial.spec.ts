import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
} from '../colas';
import { patronesDeResultado } from './biblioteca-patrones.service';
import { materializarPatrones } from './cartera-patrones';
import { seleccionInicialDeResultado } from './seleccion-inicial';
import { validarResultadoNestingOpenNest } from './validar-nesting-opennest';

describe('combinación conocida para el selector', () => {
  const { entrada, solucionDosPlacas } = JSON.parse(
    readFileSync(join(__dirname, 'fixtures/puma-200cm.json'), 'utf8'),
  ) as {
    entrada: NestingIrregularOpenNestData;
    solucionDosPlacas: NestingIrregularOpenNestResult;
  };

  it('reconoce repeticiones con la cartera reordenada y reconstruye la demanda exacta', () => {
    const cartera = patronesDeResultado(entrada, solucionDosPlacas).reverse();
    const input = {
      ...entrada,
      piezas: entrada.piezas.map((p) => ({ ...p, cantidad: p.cantidad * 3 })),
    };
    const original = materializarPatrones(input, cartera, {
      seleccion: [
        { patron: 0, repeticiones: 3 },
        { patron: 1, repeticiones: 3 },
      ],
      optimoPlacasDentroCartera: false,
      optimoPatronesDentroCartera: false,
    });
    const seleccion = seleccionInicialDeResultado(input, cartera, original);
    expect(seleccion).toEqual([
      { patron: 0, repeticiones: 3 },
      { patron: 1, repeticiones: 3 },
    ]);
    const validado = validarResultadoNestingOpenNest(
      input,
      materializarPatrones(input, cartera, {
        seleccion: seleccion!,
        optimoPlacasDentroCartera: false,
        optimoPatronesDentroCartera: false,
      }),
    );
    expect(validado.placasUsadas).toBe(6);
    expect(validado.cantidadColocada).toBe(24);
  });

  it('omite una combinación que no se puede representar completamente', () => {
    const cartera = patronesDeResultado(entrada, solucionDosPlacas);
    expect(
      seleccionInicialDeResultado(entrada, cartera.slice(1), solucionDosPlacas),
    ).toBeUndefined();
    expect(
      seleccionInicialDeResultado(entrada, cartera, {
        ...solucionDosPlacas,
        placements: solucionDosPlacas.placements.slice(1),
      }),
    ).toBeUndefined();
    expect(seleccionInicialDeResultado(entrada, cartera)).toBeUndefined();
  });
});
