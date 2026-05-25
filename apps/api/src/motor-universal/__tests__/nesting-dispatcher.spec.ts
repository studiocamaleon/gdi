import { runNestingForPaso } from '../nesting-dispatcher';

function buildPaso(algorithm: 'auto' | 'shelf-rollo' | 'maxrects-rollo') {
  return {
    rutaPasoId: 'rp-rollo',
    rutaPasoOrden: 1,
    familiaCodigo: 'impresion_por_area',
    configPasoId: 'cp-rollo',
    modoActivacion: 'OBLIGATORIO',
    condicionActivacionJson: null,
    modoTiempo: 'T-3',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    mecanismoCantidadConfigJson: null,
    multiplicadoresActivos: [],
    paramsPasoJson: {
      nestingConfig: {
        algorithm,
        allowRotation: true,
        separationHMm: 5,
        separationVMm: 5,
      },
    },
    maquinaM1Id: null,
    perfilM1Id: null,
    setupOverrideMin: null,
    cleanupOverrideMin: null,
    tiempoFijoOverrideMin: null,
    slots: [],
    cargosDirectosPaso: [],
    maquina: {
      id: 'm-rollo',
      codigo: 'ROLLO',
      nombre: 'Rollo',
      plantilla: 'IMPRESORA_GRAN_FORMATO_POR_AREA',
      parametrosTecnicosJson: {
        geometria: 'ROLLO',
        anchoMaxRolloMm: 1370,
        margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 10, inf: 10 },
      },
    },
  };
}

function buildPasoMontaje(
  algorithm:
    | 'auto'
    | 'shelf-rollo'
    | 'maxrects-rollo'
    | 'grid-2d-single'
    | 'grid-2d-multi'
    | 'packingsolver-rectangle',
  fuentePiezasMontaje = 'piezas_jobcontext',
) {
  return {
    rutaPasoId: 'rp-montaje',
    rutaPasoOrden: 1,
    familiaCodigo: 'montaje_sobre_sustrato',
    configPasoId: 'cp-montaje',
    modoActivacion: 'OBLIGATORIO',
    condicionActivacionJson: null,
    modoTiempo: 'T-2',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    mecanismoCantidadConfigJson: null,
    multiplicadoresActivos: [],
    paramsPasoJson: {
      fuentePiezasMontaje,
      nestingConfig: {
        algorithm,
        allowRotation: true,
        separationHMm: 5,
        separationVMm: 5,
      },
    },
    maquinaM1Id: null,
    perfilM1Id: null,
    setupOverrideMin: null,
    cleanupOverrideMin: null,
    tiempoFijoOverrideMin: null,
    slots: [],
    cargosDirectosPaso: [],
    maquina: null,
  };
}

const jobContext = {
  cantidad: 1,
  piezas: [
    { anchoMm: 900, altoMm: 700, cantidad: 1 },
    { anchoMm: 450, altoMm: 250, cantidad: 1 },
    { anchoMm: 220, altoMm: 220, cantidad: 5 },
  ],
};

const material = {
  id: 'vinilo-137',
  atributosVarianteJson: { anchoMm: 1370 },
};

describe('runNestingForPaso rollo optimizado', () => {
  it('ejecuta maxrects-rollo cuando se configura explicitamente', () => {
    const result = runNestingForPaso(
      buildPaso('maxrects-rollo') as never,
      jobContext,
      material,
    );

    expect(result).not.toBeNull();
    expect(result!.algorithm).toBe('maxrects-rollo');
    expect(result!.unidad).toBe('m_lineales');
  });

  it('conserva shelf-rollo cuando se configura explicitamente', () => {
    const result = runNestingForPaso(
      buildPaso('shelf-rollo') as never,
      jobContext,
      material,
    );

    expect(result).not.toBeNull();
    expect(result!.algorithm).toBe('shelf-rollo');
  });

  it('en auto elige el menor largo consumido', () => {
    const shelf = runNestingForPaso(
      buildPaso('shelf-rollo') as never,
      jobContext,
      material,
    );
    const auto = runNestingForPaso(
      buildPaso('auto') as never,
      jobContext,
      material,
    );

    expect(shelf).not.toBeNull();
    expect(auto).not.toBeNull();
    expect(auto!.algorithm).toBe('maxrects-rollo');
    expect(auto!.consumedLengthMm).toBeLessThan(shelf!.consumedLengthMm!);
  });
});

describe('runNestingForPaso montaje sobre sustrato', () => {
  it('calcula material de montaje en rollo usando pliegos impresos publicados', () => {
    const result = runNestingForPaso(
      buildPasoMontaje('shelf-rollo', 'pliegos_impresos') as never,
      {
        cantidad: 10,
        pliegos_impresos: 10,
        pliego_impresion_ancho_mm: 210,
        pliego_impresion_alto_mm: 297,
      },
      {
        id: 'iman-rollo-60',
        atributosVarianteJson: {
          anchoMm: 600,
          largoRolloMm: 50_000,
        },
      },
    );

    expect(result).not.toBeNull();
    expect(result!.algorithm).toBe('shelf-rollo');
    expect(result!.unidad).toBe('m_lineales');
    expect(result!.piezasAcomodadas).toBe(10);
    expect(result!.consumedLengthMm).toBeGreaterThan(0);
  });

  it('calcula material de montaje en placa sin tratar el ancho de placa como rollo', () => {
    const result = runNestingForPaso(
      buildPasoMontaje('auto') as never,
      {
        cantidad: 10,
        piezas: [{ cantidad: 10, anchoMm: 200, altoMm: 300 }],
      },
      {
        id: 'pvc-122x244',
        atributosVarianteJson: {
          anchoMm: 1220,
          largoMm: 2440,
        },
      },
    );

    expect(result).not.toBeNull();
    expect(result!.algorithm).toBe('packingsolver-rectangle');
    expect(result!.unidad).toBe('pliegos');
    expect(result!.piezasAcomodadas).toBe(10);
  });
});
