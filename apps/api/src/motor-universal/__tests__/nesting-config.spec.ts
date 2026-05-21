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
});
