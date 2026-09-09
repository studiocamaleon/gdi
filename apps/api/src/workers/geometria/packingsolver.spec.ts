import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  convertirPackingSolver,
  instanciaPackingSolver,
  presupuestoPackingSolver,
} from './packingsolver';
import { validarResultadoNestingOpenNest } from './validar-nesting-opennest';
import type {
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
} from '../colas';

describe('contrato de geometría de PackingSolver', () => {
  const { entrada, solucionDosPlacas } = JSON.parse(
    readFileSync(join(__dirname, 'fixtures/puma-200cm.json'), 'utf8'),
  ) as {
    entrada: NestingIrregularOpenNestData;
    solucionDosPlacas: NestingIrregularOpenNestResult;
  };
  const certificado = () => ({
    certificado: {
      bins: [0, 1].map((placa) => ({
        copies: 1,
        items: solucionDosPlacas.placements
          .filter((p) => p.placa === placa)
          .map((p) => ({
            id: entrada.piezas.findIndex((tipo) => tipo.id === p.piezaId),
            x: p.traslacion.x,
            y: p.traslacion.y,
            angle: p.rotacionGrados,
            mirror: false,
          })),
      })),
    },
    duracionMs: 500,
  });

  it('reserva la búsqueda corta de lotes grandes al selector y mantiene el motor rápido para pocas piezas', () => {
    const lote = {
      ...entrada,
      piezas: entrada.piezas.map((p) => ({ ...p, cantidad: p.cantidad * 100 })),
    };
    expect(presupuestoPackingSolver(lote, 15000)).toBe(0);
    expect(presupuestoPackingSolver(lote, 120000)).toBe(40000);
    expect(presupuestoPackingSolver(entrada, 15000)).toBe(5250);
    expect(presupuestoPackingSolver(entrada, 3000)).toBe(0);
  });

  it('conserva demanda, originales y huecos con procedencia explícita', () => {
    const original = JSON.stringify(entrada);
    const result = validarResultadoNestingOpenNest(
      entrada,
      convertirPackingSolver(entrada, certificado(), 'packingsolver:fixture'),
    );
    expect(result).toMatchObject({
      placasUsadas: 2,
      cantidadColocada: 8,
      algoritmo: 'grafonest-packingsolver-v1',
      motorEjecutor: 'packingsolver',
    });
    expect(result.placements.flatMap((p) => p.huecos).length).toBeGreaterThan(
      0,
    );
    expect(JSON.stringify(entrada)).toBe(original);
    const instance = instanciaPackingSolver(entrada);
    expect(instance.item_types.map((p) => p.copies)).toEqual(
      entrada.piezas.map((p) => p.cantidad),
    );
    expect(instance.parameters.item_item_minimum_spacing).toBe(
      entrada.separacionMm,
    );
    expect(instance.bin_types[0].item_bin_minimum_spacing).toBe(
      entrada.placa.margenMm,
    );
    expect(instance.item_types.every((p) => p.allow_mirroring === false)).toBe(
      true,
    );
    expect(instance.item_types[0].allowed_rotations).toHaveLength(
      entrada.piezas[0].rotaciones,
    );
  });

  it('rechaza parcialidades, espejado, duplicados y expansiones desproporcionadas', () => {
    const cambios = [
      (c: ReturnType<typeof certificado>) => c.certificado.bins.pop(),
      (c: ReturnType<typeof certificado>) => {
        c.certificado.bins[0].items[0].mirror = true;
      },
      (c: ReturnType<typeof certificado>) => {
        c.certificado.bins[0].copies = Number.MAX_SAFE_INTEGER;
      },
      (c: ReturnType<typeof certificado>) => {
        c.certificado.bins[0].items[0].id = -1;
      },
      (c: ReturnType<typeof certificado>) => {
        c.certificado.bins[0].items[0].angle = NaN;
      },
    ];
    for (const cambiar of cambios) {
      const c = certificado();
      cambiar(c);
      expect(() =>
        convertirPackingSolver(entrada, c, 'packingsolver:test'),
      ).toThrow();
    }
  });

  it('el validador independiente rechaza giros, separación y procedencias falsas', () => {
    const c = certificado();
    c.certificado.bins[0].items[0].angle = 7;
    expect(() =>
      validarResultadoNestingOpenNest(
        entrada,
        convertirPackingSolver(entrada, c, 'packingsolver:test'),
      ),
    ).toThrow();
    const result = convertirPackingSolver(
      entrada,
      certificado(),
      'packingsolver:test',
    );
    expect(() =>
      validarResultadoNestingOpenNest(entrada, {
        ...result,
        algoritmo: 'opennest-v1',
      }),
    ).toThrow('procedencia');
    expect(() =>
      validarResultadoNestingOpenNest(entrada, {
        ...result,
        motorEjecutor: undefined,
      }),
    ).toThrow('procedencia');
    expect(() =>
      validarResultadoNestingOpenNest({ ...entrada, separacionMm: 40 }, result),
    ).toThrow();
  });
});
