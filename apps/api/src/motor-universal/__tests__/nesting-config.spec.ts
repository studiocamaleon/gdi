import { resolveNestingConfig } from '../nesting-config';
import type { JobContext, PasoCargado } from '../tipos';

function paso(overrides: Partial<PasoCargado> = {}): PasoCargado {
  return {
    rutaPasoId: 'paso-1',
    rutaPasoOrden: 1,
    familiaCodigo: 'impresion_por_area',
    configPasoId: 'config-1',
    modoActivacion: 'OBLIGATORIO',
    condicionActivacionJson: null,
    modoTiempo: 'T-3',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    mecanismoCantidadConfigJson: null,
    multiplicadoresActivos: [],
    paramsPasoJson: null,
    maquinaM1Id: null,
    perfilM1Id: null,
    setupOverrideMin: null,
    cleanupOverrideMin: null,
    tiempoFijoOverrideMin: null,
    slots: [],
    cargosDirectosPaso: [],
    maquinasCandidatas: [],
    ...overrides,
  };
}

const jobContext: JobContext = { cantidad: 1 };

describe('resolveNestingConfig', () => {
  it('toma de la máquina la política para conservar la composición vectorial', () => {
    const config = resolveNestingConfig(
      paso({
        familiaCodigo: 'corte_hilo_caliente',
        maquina: {
          id: 'hotwire-1',
          codigo: 'HOTWIRE-001',
          nombre: 'Cortadora',
          plantilla: 'corte_hilo_caliente',
          parametrosTecnicosJson: {
            estrategiaNestingVectorial: 'preserve-original-if-fits',
          },
        },
      }),
      jobContext,
      null,
    );

    expect(config.preservarComposicionOriginalSiEntra).toBe(true);
  });

  it('resuelve la política de encastres configurada en la máquina', () => {
    const config = resolveNestingConfig(
      paso({
        familiaCodigo: 'corte_hilo_caliente',
        maquina: {
          id: 'hotwire-1',
          codigo: 'HOTWIRE-001',
          nombre: 'Cortadora',
          plantilla: 'corte_hilo_caliente',
          parametrosTecnicosJson: {
            tipoUnionVectorial: 'recta',
            anchoEncastreMm: 45,
            profundidadEncastreMm: 25,
            modoCantidadEncastres: 'cantidad_fija',
            cantidadFijaEncastres: 4,
            kerfEncastreMm: 0.5,
          },
        },
      }),
      jobContext,
      null,
    );

    expect(config.configuracionEncastres).toMatchObject({
      tipoUnion: 'recta',
      anchoEncastreMm: 45,
      profundidadEncastreMm: 25,
      modoCantidad: 'cantidad_fija',
      cantidadFija: 4,
      kerfMm: 0.5,
    });
  });

  it('hereda márgenes de la máquina', () => {
    const config = resolveNestingConfig(
      paso({
        maquina: {
          id: 'maq-1',
          codigo: 'M1',
          nombre: 'Máquina',
          plantilla: 'impresora_laser',
          parametrosTecnicosJson: {
            margenesNoImprimiblesMm: { izq: 4, der: 5, sup: 6, inf: 7 },
          },
        },
      }),
      jobContext,
      null,
    );

    expect(config.margins).toMatchObject({
      leftMm: 6.5,
      rightMm: 7.5,
      topMm: 8.5,
      bottomMm: 9.5,
      startMm: 8.5,
      endMm: 9.5,
    });
  });

  it('el override del paso gana sobre máquina', () => {
    const config = resolveNestingConfig(
      paso({
        paramsPasoJson: {
          nestingConfig: {
            margins: { leftMm: 12 },
            separationHMm: 8,
            allowRotation: false,
          },
        },
        maquina: {
          id: 'maq-1',
          codigo: 'M1',
          nombre: 'Máquina',
          plantilla: 'impresora_laser',
          parametrosTecnicosJson: {
            margenesNoImprimiblesMm: { izq: 4 },
          },
        },
      }),
      jobContext,
      null,
    );

    expect(config.pieceBleedMm).toBe(4);
    expect(config.separationHMm).toBe(8);
    expect(config.separationVMm).toBe(8);
    expect(config.margins.leftMm).toBe(16);
    expect(config.allowRotation).toBe(false);
  });

  it('suma margen extra del pliego al margen técnico efectivo', () => {
    const config = resolveNestingConfig(
      paso({
        paramsPasoJson: {
          nestingConfig: {
            extraMargins: { leftMm: 3, rightMm: 4, topMm: 5, bottomMm: 6 },
          },
        },
        maquina: {
          id: 'maq-1',
          codigo: 'M1',
          nombre: 'Máquina',
          plantilla: 'impresora_laser',
          parametrosTecnicosJson: {
            margenesNoImprimiblesMm: { izq: 4, der: 5, sup: 6, inf: 7 },
          },
        },
      }),
      jobContext,
      null,
    );

    expect(config.margins).toMatchObject({
      leftMm: 9.5,
      rightMm: 11.5,
      topMm: 13.5,
      bottomMm: 15.5,
      startMm: 13.5,
      endMm: 15.5,
    });
  });

  it('usa demasía por lado para derivar separación interna y margen exterior', () => {
    const config = resolveNestingConfig(
      paso({
        paramsPasoJson: {
          nestingConfig: {
            pieceBleedMm: 2,
          },
        },
        maquina: {
          id: 'maq-1',
          codigo: 'M1',
          nombre: 'Máquina',
          plantilla: 'impresora_laser',
          parametrosTecnicosJson: {
            margenesNoImprimiblesMm: { izq: 4, der: 5, sup: 6, inf: 7 },
          },
        },
      }),
      jobContext,
      null,
    );

    expect(config.pieceBleedMm).toBe(2);
    expect(config.separationHMm).toBe(4);
    expect(config.separationVMm).toBe(4);
    expect(config.margins).toMatchObject({
      leftMm: 6,
      rightMm: 7,
      topMm: 8,
      bottomMm: 9,
      startMm: 8,
      endMm: 9,
    });
  });

  it('convierte separación legacy simétrica a demasía por lado', () => {
    const config = resolveNestingConfig(
      paso({
        paramsPasoJson: {
          nestingConfig: {
            separationHMm: 4,
            separationVMm: 4,
          },
        },
      }),
      jobContext,
      null,
    );

    expect(config.pieceBleedMm).toBe(2);
    expect(config.separationHMm).toBe(4);
    expect(config.separationVMm).toBe(4);
  });

  it('convierte separación legacy desigual usando el mayor valor', () => {
    const config = resolveNestingConfig(
      paso({
        paramsPasoJson: {
          nestingConfig: {
            separationHMm: 4,
            separationVMm: 6,
          },
        },
      }),
      jobContext,
      null,
    );

    expect(config.pieceBleedMm).toBe(3);
    expect(config.separationHMm).toBe(6);
    expect(config.separationVMm).toBe(6);
  });

  it('toma tamaño de placa desde el material antes que desde la mesa', () => {
    const config = resolveNestingConfig(
      paso({
        maquina: {
          id: 'maq-1',
          codigo: 'M1',
          nombre: 'Máquina',
          plantilla: 'impresora_gran_formato_por_area',
          parametrosTecnicosJson: {
            geometria: 'MESA_EXTENSORA',
            anchoMesaMm: 710,
            largoMesaMm: 510,
          },
        },
      }),
      jobContext,
      { atributosVarianteJson: { anchoMm: 1830, largoMm: 2750 } },
    );

    expect(config.sheetWidthMm).toBe(1830);
    expect(config.sheetHeightMm).toBe(2750);
  });

  it('usa el pliego de impresión configurado para impresion_por_hoja', () => {
    const config = resolveNestingConfig(
      paso({
        familiaCodigo: 'impresion_por_hoja',
        paramsPasoJson: {
          nestingConfig: {
            pliegoImpresion: { anchoMm: 210, altoMm: 297 },
          },
        },
      }),
      jobContext,
      { atributosVarianteJson: { anchoMm: 320, largoMm: 460 } },
    );

    expect(config.sheetWidthMm).toBe(210);
    expect(config.sheetHeightMm).toBe(297);
    expect(config.purchaseSheetWidthMm).toBe(320);
    expect(config.purchaseSheetHeightMm).toBe(460);
  });

  it('mantiene el tamaño comprado como fallback si no hay pliego de impresión', () => {
    const config = resolveNestingConfig(
      paso({ familiaCodigo: 'impresion_por_hoja' }),
      jobContext,
      { atributosVarianteJson: { anchoMm: 320, largoMm: 460 } },
    );

    expect(config.sheetWidthMm).toBe(320);
    expect(config.sheetHeightMm).toBe(460);
  });

  it('toma ancho de rollo desde el material si la máquina no lo declara', () => {
    const config = resolveNestingConfig(
      paso({
        maquina: {
          id: 'maq-1',
          codigo: 'M1',
          nombre: 'Máquina',
          plantilla: 'impresora_gran_formato_por_area',
          parametrosTecnicosJson: { geometria: 'ROLLO' },
        },
      }),
      jobContext,
      { atributosVarianteJson: { anchoMm: 1520, largoRolloMm: 50_000 } },
    );

    expect(config.rollWidthMm).toBe(1520);
  });

  it('usa el ancho real del material y la máquina sólo como límite', () => {
    const config = resolveNestingConfig(
      paso({
        maquina: {
          id: 'maq-1',
          codigo: 'M1',
          nombre: 'Máquina',
          plantilla: 'impresora_gran_formato_por_area',
          parametrosTecnicosJson: {
            geometria: 'ROLLO',
            anchoMaxRolloMm: 1600,
          },
        },
      }),
      jobContext,
      { atributosVarianteJson: { anchoMm: 1520, largoRolloMm: 50_000 } },
    );

    expect(config.rollWidthMm).toBe(1520);
  });

  it('invalida un rollo más ancho que la capacidad de máquina', () => {
    const config = resolveNestingConfig(
      paso({
        maquina: {
          id: 'maq-1',
          codigo: 'M1',
          nombre: 'Máquina',
          plantilla: 'impresora_gran_formato_por_area',
          parametrosTecnicosJson: {
            geometria: 'ROLLO',
            anchoMaxRolloMm: 1370,
          },
        },
      }),
      jobContext,
      { atributosVarianteJson: { anchoMm: 1520, largoRolloMm: 50_000 } },
    );

    expect(config.rollWidthMm).toBeNull();
  });

  it('normaliza panelizado automático con defaults seguros', () => {
    const config = resolveNestingConfig(
      paso({
        paramsPasoJson: {
          nestingConfig: {
            panelizado: { enabled: true },
          },
        },
        maquina: {
          id: 'maq-1',
          codigo: 'M1',
          nombre: 'Máquina',
          plantilla: 'impresora_gran_formato_por_area',
          parametrosTecnicosJson: {
            geometria: 'ROLLO',
            anchoMaxRolloMm: 1370,
            margenesNoImprimiblesMm: { izq: 5, der: 5 },
          },
        },
      }),
      jobContext,
      null,
    );

    expect(config.panelizado).toMatchObject({
      enabled: true,
      mode: 'automatic',
      axis: 'automatic',
      overlapMm: 20,
      maxPanelWidthMm: 1355,
      distribution: 'equilibrada',
      widthInterpretation: 'total',
    });
  });

  it('origen de costo: default derivado, por_candidato solo si se declara', () => {
    const base = paso({ familiaCodigo: 'impresion_por_hoja' });
    expect(
      resolveNestingConfig(base, jobContext, null).printSheetCostSource,
    ).toBe('derivado');

    const config = resolveNestingConfig(
      paso({
        familiaCodigo: 'impresion_por_hoja',
        paramsPasoJson: {
          nestingConfig: {
            pliegoImpresion: {
              modo: 'automatico',
              origenCosto: 'por_candidato',
              candidatos: [
                {
                  id: 'a4',
                  nombre: 'A4',
                  anchoMm: 210,
                  altoMm: 297,
                  materiaPrimaVarianteId: 'variante-a4',
                },
                { id: 'sra3', nombre: 'SRA3', anchoMm: 325, altoMm: 475 },
              ],
            },
          },
        },
      }),
      jobContext,
      { atributosVarianteJson: { anchoMm: 320, largoMm: 460 } },
    );

    expect(config.printSheetMode).toBe('automatic');
    expect(config.printSheetCostSource).toBe('por_candidato');
    expect(config.printSheetCandidates).toHaveLength(2);
    expect(config.printSheetCandidates[0].materiaPrimaVarianteId).toBe(
      'variante-a4',
    );
    expect(config.printSheetCandidates[1].materiaPrimaVarianteId).toBeNull();
  });

  it('expone el precio de la MP del slot para el score derivado en $', () => {
    const config = resolveNestingConfig(
      paso({ familiaCodigo: 'impresion_por_hoja' }),
      jobContext,
      {
        atributosVarianteJson: { anchoMm: 320, largoMm: 460 },
        precioReferencia: 250,
      },
    );

    expect(config.purchaseSheetPrecio).toBe(250);
  });

  it('ignora ancho máximo de panel legacy demasiado chico', () => {
    const config = resolveNestingConfig(
      paso({
        paramsPasoJson: {
          nestingConfig: {
            panelizado: { enabled: true, maxPanelWidthMm: 80 },
          },
        },
        maquina: {
          id: 'maq-1',
          codigo: 'M1',
          nombre: 'Máquina',
          plantilla: 'impresora_gran_formato_por_area',
          parametrosTecnicosJson: {
            geometria: 'ROLLO',
            anchoMaxRolloMm: 1370,
            margenesNoImprimiblesMm: { izq: 5, der: 5 },
          },
        },
      }),
      jobContext,
      null,
    );

    expect(config.panelizado.maxPanelWidthMm).toBe(1355);
  });

  // ── Etapa A: de dónde salen márgenes y separación lo declara la familia ──
  // Estos casos fijan el comportamiento que antes vivía en los ifs por
  // familia de nesting-config (defaultMarginForFamily, defaultSeparation-
  // ForFamily, el origen del margen y la semántica de la separación).

  it('laminado lee el desperdicio de la laminadora, no el área no imprimible', () => {
    const config = resolveNestingConfig(
      paso({
        familiaCodigo: 'laminado',
        maquina: {
          id: 'maq-1',
          codigo: 'M1',
          nombre: 'Laminadora',
          plantilla: 'laminadora_bopp_rollo',
          parametrosTecnicosJson: {
            // El campo genérico existe y debe ser IGNORADO por laminado.
            margenesNoImprimiblesMm: { izq: 20, der: 20, sup: 20, inf: 20 },
            margenesDesperdicioMm: { izq: 3, der: 3, sup: 0, inf: 0 },
            margenEntrePliegosMm: 8,
          },
        },
      }),
      jobContext,
      null,
    );

    // El paso entre pliegos (8) alimenta la separación → demasía 4 por lado,
    // y el margen exterior es el desperdicio de la máquina más esa demasía.
    expect(config.pieceBleedMm).toBe(4);
    expect(config.separationHMm).toBe(8);
    expect(config.margins.leftMm).toBe(3 + 4);
    expect(config.margins.rightMm).toBe(3 + 4);
    // Y no los 20 mm del campo genérico, que laminado ignora.
    expect(config.margins.topMm).toBe(0 + 4);
  });

  it('laminado sin datos de máquina arranca con todo en cero', () => {
    const config = resolveNestingConfig(
      paso({ familiaCodigo: 'laminado' }),
      jobContext,
      null,
    );

    expect(config.margins).toMatchObject({
      leftMm: 0,
      rightMm: 0,
      topMm: 0,
      bottomMm: 0,
      startMm: 0,
      endMm: 0,
    });
  });

  it('el pouch toma el borde sellado del MATERIAL, igual en los 4 lados', () => {
    const config = resolveNestingConfig(
      paso({
        familiaCodigo: 'plastificado_pouch',
        maquina: {
          id: 'maq-1',
          codigo: 'M1',
          nombre: 'Plastificadora',
          plantilla: 'plastificadora',
          parametrosTecnicosJson: {
            margenesNoImprimiblesMm: { izq: 9, der: 9, sup: 9, inf: 9 },
          },
        },
      }),
      jobContext,
      { atributosVarianteJson: { anchoMm: 216, largoMm: 303, margenNoUsableMm: 4 } },
    );

    expect(config.margins).toMatchObject({
      leftMm: 4,
      rightMm: 4,
      topMm: 4,
      bottomMm: 4,
    });
  });

  it('en el pouch la separación es aire literal, no demasía por pieza', () => {
    const config = resolveNestingConfig(
      paso({
        familiaCodigo: 'plastificado_pouch',
        paramsPasoJson: { separacionEntrePiezasMm: 6 },
      }),
      jobContext,
      { atributosVarianteJson: { anchoMm: 216, largoMm: 303 } },
    );

    // Literal: los 6 mm se usan tal cual y no se agranda la pieza.
    expect(config.pieceBleedMm).toBe(0);
    expect(config.separationHMm).toBe(6);
    expect(config.separationVMm).toBe(6);
  });

  it('la misma separación en gran formato es demasía y vale el doble', () => {
    const config = resolveNestingConfig(
      paso({
        familiaCodigo: 'impresion_por_area',
        paramsPasoJson: { separacionEntrePiezasMm: 6 },
      }),
      jobContext,
      null,
    );

    expect(config.pieceBleedMm).toBe(3);
    expect(config.separationHMm).toBe(6);
  });

  it('gran formato y plotter arrancan con 5 mm de separación', () => {
    for (const familiaCodigo of ['impresion_por_area', 'plotter_corte']) {
      const config = resolveNestingConfig(
        paso({ familiaCodigo }),
        jobContext,
        null,
      );
      expect(config.pieceBleedMm).toBe(2.5);
    }
  });

  it('impresión por hoja arranca con 5 mm de margen alrededor', () => {
    const config = resolveNestingConfig(
      paso({ familiaCodigo: 'impresion_por_hoja' }),
      jobContext,
      null,
    );

    expect(config.margins).toMatchObject({
      leftMm: 5,
      rightMm: 5,
      topMm: 5,
      bottomMm: 5,
    });
  });
});
