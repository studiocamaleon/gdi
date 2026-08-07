/**
 * [F3 efectos] La fuente de cantidad "borde que este paso trabaja".
 *
 * El paso que EXIGE material extra (tensar una lona, coser un bolsillo) se
 * cobra por el borde que recorre: los lados que su efecto declara, medidos
 * sobre la medida VISIBLE. Contra `perimetro_piezas_m` hay dos diferencias que
 * son justamente el motivo de que exista: aquélla cuenta SIEMPRE los cuatro
 * lados, y los cuenta sobre la pieza ya agrandada por la pre-pasada.
 *
 * Ver docs/efectos-de-paso-diseno.md §7.
 *
 * Unitario sin DB: invoca el método privado directo sobre el prototype.
 */

import { MotorUniversalService } from '../motor.service';
import type { JobContext, PasoCargado } from '../tipos';

type MotorConPrivados = {
  resolverCantidadProductividadPropia: (
    paso: PasoCargado,
    jobContext: JobContext,
    nesting?: unknown,
    material?: unknown,
  ) => number;
};

function createService(): MotorConPrivados {
  return Object.create(
    MotorUniversalService.prototype,
  ) as unknown as MotorConPrivados;
}

function paso(paramsPasoJson: Record<string, unknown>): PasoCargado {
  return {
    configPasoId: 'cp-1',
    familiaCodigo: 'trabajo_manual',
    paramsPasoJson,
  } as unknown as PasoCargado;
}

/** Lona de 2,00 × 1,00 m ya agrandada por un efecto de 100 mm en los 4 lados:
 *  el material mide 2,20 × 1,20, pero el borde terminado sigue siendo el
 *  visible. Perímetro visible = 6,00 m; perímetro del material = 6,80 m. */
function lona(): JobContext {
  return {
    cantidad: 1,
    medidaVisibleMm: { anchoMm: 2000, altoMm: 1000 },
    medidaCustomMm: { anchoMm: 2200, altoMm: 1200 },
    piezas: [{ cantidad: 1, anchoMm: 2200, altoMm: 1200 }],
    // La foto de lo que pidió el cliente, que la pre-pasada preserva.
    piezasVisibles: [{ cantidad: 1, anchoMm: 2000, altoMm: 1000 }],
    piezaPerimetroTotalM: 6.8,
  } as unknown as JobContext;
}

describe('fuente de cantidad perimetro_lados_efecto', () => {
  it('los 4 lados: mide el borde VISIBLE (6,00 m), no la lona agrandada', () => {
    const cantidad = createService().resolverCantidadProductividadPropia(
      paso({
        productivityQuantitySource: 'perimetro_lados_efecto',
        efectos: {
          demasiaMedida: {
            lados: ['superior', 'inferior', 'izquierdo', 'derecho'],
            mm: 100,
            refuerza: true,
          },
        },
      }),
      lona(),
    );
    expect(cantidad).toBeCloseTo(6, 6);
  });

  it('sólo dos lados: cuenta esos dos, no el perímetro completo', () => {
    const cantidad = createService().resolverCantidadProductividadPropia(
      paso({
        productivityQuantitySource: 'perimetro_lados_efecto',
        efectos: {
          demasiaMedida: {
            lados: ['superior', 'inferior'],
            mm: 100,
            refuerza: false,
          },
        },
      }),
      lona(),
    );
    // 2 × 2,00 m de ancho visible.
    expect(cantidad).toBeCloseTo(4, 6);
  });

  it('lee también el formato viejo de las rutas guardadas', () => {
    const cantidad = createService().resolverCantidadProductividadPropia(
      paso({
        productivityQuantitySource: 'perimetro_lados_efecto',
        subTipo: 'bolsillo',
        lados: ['izquierdo', 'derecho'],
        demasiaMm: 100,
      }),
      lona(),
    );
    // 2 × 1,00 m de alto visible.
    expect(cantidad).toBeCloseTo(2, 6);
  });

  it('sin efecto configurado cae a la cantidad del paso, no a cero', () => {
    const jc = lona();
    (jc as unknown as Record<string, unknown>).cantidad = 7;
    const cantidad = createService().resolverCantidadProductividadPropia(
      paso({ productivityQuantitySource: 'perimetro_lados_efecto' }),
      jc,
    );
    expect(cantidad).toBe(7);
  });
});
