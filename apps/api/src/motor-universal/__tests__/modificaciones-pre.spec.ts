import {
  aplicarMutacionPre,
  calcularMetrosLinealesUnion,
} from '../modificaciones-pre';
import { declaraEfectoDemasia, leerEfectoDemasia } from '../efectos-paso';
import { congelarMedidaVisible } from '../job-context-metrics';
import type { JobContext } from '../tipos';

/** Lona 1500×1000 visible, 1 unidad — el caso base del diseño. */
function lona(cantidad = 1): JobContext {
  const jc: JobContext = {
    cantidad,
    piezas: [{ cantidad, anchoMm: 1500, altoMm: 1000 }],
    medidaCustomMm: { anchoMm: 1500, altoMm: 1000 },
    piezaAreaTotalM2: 1.5 * cantidad,
    piezaPerimetroTotalM: 5 * cantidad,
  };
  congelarMedidaVisible(jc);
  return jc;
}

describe('leerEfectoDemasia', () => {
  it('lee el formato NUEVO y normaliza el orden de los lados', () => {
    expect(
      leerEfectoDemasia({
        efectos: {
          demasiaMedida: {
            lados: ['inferior', 'superior'],
            mm: 100,
            refuerza: false,
          },
        },
      }),
    ).toEqual({ lados: ['superior', 'inferior'], mm: 100, refuerza: false });
  });

  /** Compat: las rutas guardadas antes de los efectos tienen los campos en la
   *  raíz de paramsPasoJson, con el preset en vez de la capacidad. */
  it('lee el formato VIEJO y deriva `refuerza` del preset', () => {
    expect(
      leerEfectoDemasia({
        subTipo: 'refuerzo',
        lados: ['superior'],
        demasiaMm: 40,
      }),
    ).toEqual({ lados: ['superior'], mm: 40, refuerza: true });

    expect(
      leerEfectoDemasia({
        subTipo: 'bolsillo',
        lados: ['superior'],
        demasiaMm: 100,
      })?.refuerza,
    ).toBe(false);
  });

  it('descarta lados desconocidos', () => {
    expect(
      leerEfectoDemasia({ lados: ['superior', 'diagonal'], mm: 40 })?.lados,
    ).toEqual(['superior']);
  });

  it('devuelve null si no hay lados o la demasía no sirve', () => {
    expect(leerEfectoDemasia({ mm: 100 })).toBeNull();
    expect(leerEfectoDemasia({ lados: [], mm: 100 })).toBeNull();
    expect(leerEfectoDemasia({ lados: ['superior'], mm: 0 })).toBeNull();
  });
});

describe('declaraEfectoDemasia', () => {
  it('distingue "no tiene efecto" de "lo quiso pero le falta un dato"', () => {
    // Sin efecto: el paso se ignora en la pre-pasada.
    expect(declaraEfectoDemasia({ tipoTrabajo: 'tensado' })).toBe(false);
    // Con intención pero incompleto: el motor tiene que AVISAR, no cotizar
    // de menos en silencio.
    expect(declaraEfectoDemasia({ lados: ['superior'] })).toBe(true);
    expect(declaraEfectoDemasia({ efectos: { demasiaMedida: { mm: 40 } } })).toBe(
      true,
    );
  });
});

describe('calcularMetrosLinealesUnion', () => {
  it('caso A del diseño: bolsillo sup+inf en 1500 de ancho = 3.00 ml', () => {
    const jc = lona();
    expect(
      calcularMetrosLinealesUnion(jc, {
        lados: ['superior', 'inferior'],
      }),
    ).toBeCloseTo(3, 6);
  });

  it('caso B del diseño: refuerzo en los 4 lados = 5.00 ml', () => {
    const jc = lona();
    expect(
      calcularMetrosLinealesUnion(jc, {
        lados: ['superior', 'inferior', 'izquierdo', 'derecho'],
      }),
    ).toBeCloseTo(5, 6);
  });

  it('escala con la cantidad de paños', () => {
    const jc = lona(3);
    expect(
      calcularMetrosLinealesUnion(jc, {
        lados: ['superior', 'inferior'],
      }),
    ).toBeCloseTo(9, 6);
  });

  /** La regla de oro: la soldadura corre por el borde terminado. */
  it('se mide sobre la medida VISIBLE, no sobre la ya mutada', () => {
    const jc = lona();
    // Un paso PRE anterior ya agrandó el material.
    jc.piezas![0].altoMm = 1200;

    expect(
      calcularMetrosLinealesUnion(jc, {
        lados: ['izquierdo', 'derecho'],
      }),
      // Sobre la visible: 2 × 1000mm = 2.00 ml. Sobre la mutada daría 2.40.
    ).toBeCloseTo(2, 6);
  });
});

describe('aplicarMutacionPre', () => {
  const paso = { rutaPasoId: 'rp-1', nombrePaso: 'Bolsillo sup+inf' };

  it('caso A del diseño: bolsillo sup+inf de 100mm lleva 1500×1000 a 1500×1200', () => {
    const jc = lona();

    const traza = aplicarMutacionPre(
      jc,
      { refuerza: false, lados: ['superior', 'inferior'], mm: 100 },
      paso,
    );

    expect(jc.piezas![0]).toEqual({
      cantidad: 1,
      anchoMm: 1500,
      altoMm: 1200,
    });
    expect(jc.piezaAreaTotalM2).toBeCloseTo(1.8, 6);
    expect(jc.piezaPerimetroTotalM).toBeCloseTo(5.4, 6);
    expect(jc.medidaCustomMm).toEqual({ anchoMm: 1500, altoMm: 1200 });
    // La visible no se toca nunca.
    expect(jc.medidaVisibleMm).toEqual({ anchoMm: 1500, altoMm: 1000 });

    expect(traza).toMatchObject({
      rutaPasoId: 'rp-1',
      refuerza: false,
      deltaAnchoMm: 0,
      deltaAltoMm: 200,
      metrosLinealesUnion: 3,
    });
    expect(traza!.piezas).toEqual([
      {
        antes: { anchoMm: 1500, altoMm: 1000 },
        despues: { anchoMm: 1500, altoMm: 1200 },
      },
    ]);
  });

  it('caso B del diseño: refuerzo de 40mm en los 4 lados lleva a 1580×1080', () => {
    const jc = lona();

    aplicarMutacionPre(
      jc,
      {
        refuerza: true,
        lados: ['superior', 'inferior', 'izquierdo', 'derecho'],
        mm: 40,
      },
      paso,
    );

    expect(jc.piezas![0]).toMatchObject({ anchoMm: 1580, altoMm: 1080 });
    expect(jc.piezaAreaTotalM2).toBeCloseTo(1.7064, 6);
    expect(jc.piezaPerimetroTotalM).toBeCloseTo(5.32, 6);
  });

  /**
   * El caso que motivó que la traza sea un array appendeado en vez de un
   * output canónico: el merge del loop pisaría la primera.
   */
  it('encadena dos pasos PRE y conserva las dos trazas', () => {
    const jc = lona();

    aplicarMutacionPre(
      jc,
      { refuerza: false, lados: ['superior', 'inferior'], mm: 100 },
      { rutaPasoId: 'rp-1', nombrePaso: 'Bolsillo' },
    );
    aplicarMutacionPre(
      jc,
      { refuerza: true, lados: ['izquierdo', 'derecho'], mm: 40 },
      { rutaPasoId: 'rp-2', nombrePaso: 'Refuerzo lateral' },
    );

    expect(jc.piezas![0]).toMatchObject({ anchoMm: 1580, altoMm: 1200 });
    expect(jc.mutacionesAplicadas).toHaveLength(2);
    expect(jc.mutacionesAplicadas!.map((m) => m.rutaPasoId)).toEqual([
      'rp-1',
      'rp-2',
    ]);
    // El segundo paso midió su soldadura sobre la visible (2 × 1000mm), no
    // sobre el alto ya agrandado por el bolsillo.
    expect(jc.mutacionesAplicadas![1].metrosLinealesUnion).toBeCloseTo(2, 6);
  });

  it('muta todas las piezas, no sólo la primera', () => {
    const jc: JobContext = {
      cantidad: 2,
      piezas: [
        { cantidad: 1, anchoMm: 1500, altoMm: 1000 },
        { cantidad: 2, anchoMm: 800, altoMm: 600 },
      ],
    };
    congelarMedidaVisible(jc);

    const traza = aplicarMutacionPre(
      jc,
      { refuerza: false, lados: ['superior'], mm: 100 },
      paso,
    );

    expect(jc.piezas![0]).toMatchObject({ anchoMm: 1500, altoMm: 1100 });
    expect(jc.piezas![1]).toMatchObject({ anchoMm: 800, altoMm: 700 });
    expect(traza!.piezas).toHaveLength(2);
    // Soldadura: 1×1500 + 2×800 = 3.10 ml
    expect(traza!.metrosLinealesUnion).toBeCloseTo(3.1, 6);
  });

  it('descarta el perímetro explícito que quedó viejo al agrandar la pieza', () => {
    const jc: JobContext = {
      cantidad: 1,
      piezas: [{ cantidad: 1, anchoMm: 1500, altoMm: 1000, perimetroMm: 9999 }],
    };
    congelarMedidaVisible(jc);

    aplicarMutacionPre(
      jc,
      { refuerza: false, lados: ['superior', 'inferior'], mm: 100 },
      paso,
    );

    expect(jc.piezas![0].perimetroMm).toBeUndefined();
    expect(jc.piezaPerimetroTotalM).toBeCloseTo(5.4, 6);
  });

  it('es un no-op cuando no hay piezas', () => {
    const jc: JobContext = { cantidad: 1 };

    expect(
      aplicarMutacionPre(
        jc,
        { refuerza: false, lados: ['superior'], mm: 100 },
        paso,
      ),
    ).toBeNull();
    expect(jc.mutacionesAplicadas).toBeUndefined();
  });
});
