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
    | 'grid-2d-multi',
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

function buildPasoPouch(separacionEntrePiezasMm = 0) {
  return {
    rutaPasoId: 'rp-pouch',
    rutaPasoOrden: 1,
    familiaCodigo: 'plastificado_pouch',
    configPasoId: 'cp-pouch',
    modoActivacion: 'OBLIGATORIO',
    condicionActivacionJson: null,
    modoTiempo: 'T-2',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    mecanismoCantidadConfigJson: null,
    multiplicadoresActivos: [],
    paramsPasoJson: {
      separacionEntrePiezasMm,
      nestingConfig: {
        algorithm: 'grid-2d-single',
        allowRotation: true,
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

function buildPasoImpresionPorHoja(plantilla = 'IMPRESORA_LASER') {
  return {
    rutaPasoId: 'rp-hoja',
    rutaPasoOrden: 1,
    familiaCodigo: 'impresion_por_hoja',
    configPasoId: 'cp-hoja',
    modoActivacion: 'OBLIGATORIO',
    condicionActivacionJson: null,
    modoTiempo: 'T-3',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    mecanismoCantidadConfigJson: null,
    multiplicadoresActivos: [],
    paramsPasoJson: {
      nestingConfig: {
        algorithm: 'grid-2d-single',
        allowRotation: true,
        separationHMm: 0,
        separationVMm: 0,
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
      id: 'm-hoja',
      codigo: 'LASER',
      nombre: 'Laser',
      plantilla,
      parametrosTecnicosJson: {
        geometria: 'PLIEGO',
        margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 5, inf: 5 },
      },
    },
  };
}

function buildPasoPlotterCorte(modoOperacion: 'ROLLO' | 'HOJAS') {
  return {
    rutaPasoId: 'rp-plotter',
    rutaPasoOrden: 1,
    familiaCodigo: 'plotter_corte',
    configPasoId: 'cp-plotter',
    modoActivacion: 'OBLIGATORIO',
    condicionActivacionJson: null,
    modoTiempo: 'T-3',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    mecanismoCantidadConfigJson: null,
    multiplicadoresActivos: [],
    paramsPasoJson: {
      nestingConfig: {
        algorithm: 'auto',
        allowRotation: false,
      },
    },
    maquinaM1Id: 'm-plotter',
    perfilM1Id: 'perfil-plotter',
    setupOverrideMin: null,
    cleanupOverrideMin: null,
    tiempoFijoOverrideMin: null,
    slots: [],
    cargosDirectosPaso: [],
    maquina: {
      id: 'm-plotter',
      codigo: 'PLOTTER',
      nombre: 'Plotter',
      plantilla: 'PLOTTER_DE_CORTE',
      parametrosTecnicosJson: {
        geometria: 'ROLLO',
        margenesNoImprimiblesMm: { izq: 10, der: 10, sup: 10, inf: 10 },
      },
    },
    perfil: {
      id: 'perfil-plotter',
      nombre: modoOperacion === 'HOJAS' ? 'Hoja' : 'Rollo',
      tipoPerfil: 'corte',
      productivityValue: 36,
      productivityUnit: 'm2_h',
      setupMin: 0,
      cleanupMin: 0,
      detalleJson: { modoOperacion },
    },
  };
}

function buildPasoAreaPlaca() {
  return {
    rutaPasoId: 'rp-area',
    rutaPasoOrden: 1,
    familiaCodigo: 'impresion_por_area',
    configPasoId: 'cp-area',
    modoActivacion: 'OBLIGATORIO',
    condicionActivacionJson: null,
    modoTiempo: 'T-3',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    mecanismoCantidadConfigJson: null,
    multiplicadoresActivos: [],
    paramsPasoJson: {
      nestingConfig: {
        algorithm: 'grid-2d-multi',
        allowRotation: true,
        separationHMm: 0,
        separationVMm: 0,
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
      id: 'm-area',
      codigo: 'UV',
      nombre: 'UV mesa',
      plantilla: 'IMPRESORA_GRAN_FORMATO_POR_AREA',
      parametrosTecnicosJson: {
        geometria: 'MESA_EXTENSORA',
        anchoMesaMm: 1220,
        largoMesaMm: 2440,
        margenesNoImprimiblesMm: { izq: 0, der: 0, sup: 0, inf: 0 },
      },
    },
  };
}

const materialPouchA4 = {
  id: 'pouch-a4',
  atributosVarianteJson: {
    formatoComercial: 'A4',
    anchoMm: 216,
    altoMm: 303,
    margenNoUsableMm: 3,
    espesorMicrones: 125,
  },
};

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

const materialPliego = {
  id: 'papel-22x34',
  atributosVarianteJson: { anchoMm: 220, altoMm: 340 },
};

const materialPlaca = {
  id: 'pvc-122x244',
  atributosVarianteJson: { anchoMm: 1220, largoMm: 2440 },
};

describe('runNestingForPaso rollo optimizado', () => {
  it('ejecuta maxrects-rollo cuando se configura explicitamente', async () => {
    const result = await runNestingForPaso(
      buildPaso('maxrects-rollo') as never,
      jobContext,
      material,
    );

    expect(result).not.toBeNull();
    expect(result!.algorithm).toBe('maxrects-rollo');
    expect(result!.unidad).toBe('m_lineales');
  });

  it('conserva shelf-rollo cuando se configura explicitamente', async () => {
    const result = await runNestingForPaso(
      buildPaso('shelf-rollo') as never,
      jobContext,
      material,
    );

    expect(result).not.toBeNull();
    expect(result!.algorithm).toBe('shelf-rollo');
  });

  it('en auto elige el menor largo consumido', async () => {
    const shelf = await runNestingForPaso(
      buildPaso('shelf-rollo') as never,
      jobContext,
      material,
    );
    const auto = await runNestingForPaso(
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

describe('runNestingForPaso plastificado pouch', () => {
  it('calcula piezas por pouch y pouches necesarios sin separación', async () => {
    const result = await runNestingForPaso(
      buildPasoPouch(0) as never,
      {
        cantidad: 100,
        piezas: [{ cantidad: 100, anchoMm: 40, altoMm: 40 }],
      },
      materialPouchA4,
    );

    expect(result).not.toBeNull();
    expect(result!.algorithm).toBe('grid-2d-single');
    expect(result!.unidad).toBe('pouches');
    expect(result!.piezasPorPouch).toBe(35);
    expect(result!.cantidadCalculada).toBe(3);
    expect(result!.visualConfig?.substrateLabel).toBe('Pouch');
  });

  it('reduce la capacidad cuando hay separación entre piezas', async () => {
    const result = await runNestingForPaso(
      buildPasoPouch(3) as never,
      {
        cantidad: 100,
        piezas: [{ cantidad: 100, anchoMm: 40, altoMm: 40 }],
      },
      materialPouchA4,
    );

    expect(result).not.toBeNull();
    expect(result!.piezasPorPouch).toBe(24);
    expect(result!.cantidadCalculada).toBe(5);
  });

  it('usa el margen no usable del pouch para descontar área útil', async () => {
    const sinMargen = await runNestingForPaso(
      buildPasoPouch(0) as never,
      {
        cantidad: 10,
        piezas: [{ cantidad: 10, anchoMm: 100, altoMm: 100 }],
      },
      {
        ...materialPouchA4,
        atributosVarianteJson: {
          ...materialPouchA4.atributosVarianteJson,
          margenNoUsableMm: 0,
        },
      },
    );
    const conMargen = await runNestingForPaso(
      buildPasoPouch(0) as never,
      {
        cantidad: 10,
        piezas: [{ cantidad: 10, anchoMm: 100, altoMm: 100 }],
      },
      {
        ...materialPouchA4,
        atributosVarianteJson: {
          ...materialPouchA4.atributosVarianteJson,
          margenNoUsableMm: 10,
        },
      },
    );

    expect(sinMargen!.piezasPorPouch).toBe(6);
    expect(conMargen!.piezasPorPouch).toBe(2);
  });

  it('permite rotación cuando mejora el aprovechamiento', async () => {
    const result = await runNestingForPaso(
      buildPasoPouch(0) as never,
      {
        cantidad: 100,
        piezas: [{ cantidad: 100, anchoMm: 80, altoMm: 50 }],
      },
      materialPouchA4,
    );

    expect(result).not.toBeNull();
    expect(result!.piezasPorPouch).toBe(12);
    expect(result!.placements[0]?.rotated).toBe(true);
  });

  it('devuelve null cuando la pieza no entra en el pouch', async () => {
    const result = await runNestingForPaso(
      buildPasoPouch(0) as never,
      {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 250, altoMm: 350 }],
      },
      materialPouchA4,
    );

    expect(result).toBeNull();
  });
});

describe('runNestingForPaso centrado visual de placements', () => {
  it('activa el centrado solo para impresion laser por hoja', async () => {
    const result = await runNestingForPaso(
      buildPasoImpresionPorHoja() as never,
      {
        cantidad: 100,
        piezas: [{ cantidad: 100, anchoMm: 90, altoMm: 50 }],
      },
      materialPliego,
    );

    expect(result).not.toBeNull();
    expect(result!.algorithm).toBe('grid-2d-single');
    expect(result!.visualConfig?.centerPlacements).toBe(true);
  });

  it('no activa el centrado en impresion por area sobre placa', async () => {
    const result = await runNestingForPaso(
      buildPasoAreaPlaca() as never,
      {
        cantidad: 4,
        piezas: [{ cantidad: 4, anchoMm: 100, altoMm: 450 }],
      },
      materialPlaca,
    );

    expect(result).not.toBeNull();
    expect(result!.unidad).toBe('pliegos');
    expect(result!.visualConfig?.centerPlacements).toBeUndefined();
  });
});

describe('runNestingForPaso plotter de corte', () => {
  it('no genera nesting cuando el perfil operativo trabaja sobre hojas', async () => {
    const result = await runNestingForPaso(
      buildPasoPlotterCorte('HOJAS') as never,
      {
        cantidad: 100,
        piezas: [{ cantidad: 100, anchoMm: 30, altoMm: 30 }],
      },
      {
        id: 'papel-a4',
        atributosVarianteJson: { anchoMm: 210, altoMm: 297 },
      },
    );

    expect(result).toBeNull();
  });

  it('mantiene nesting de rollo cuando el perfil operativo trabaja sobre rollo', async () => {
    const result = await runNestingForPaso(
      buildPasoPlotterCorte('ROLLO') as never,
      {
        cantidad: 100,
        piezas: [{ cantidad: 100, anchoMm: 30, altoMm: 30 }],
      },
      {
        id: 'vinilo-61',
        atributosVarianteJson: { anchoMm: 610 },
      },
    );

    expect(result).not.toBeNull();
    expect(['shelf-rollo', 'maxrects-rollo']).toContain(result!.algorithm);
    expect(result!.unidad).toBe('m_lineales');
  });
});

describe('runNestingForPaso montaje sobre sustrato', () => {
  it('calcula material de montaje en rollo usando pliegos impresos publicados', async () => {
    const result = await runNestingForPaso(
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

  it('calcula material de montaje en placa sin tratar el ancho de placa como rollo', async () => {
    const result = await runNestingForPaso(
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
    // 10 piezas de la misma medida: grid-2d-multi degrada a single (el
    // acomodo en placa ya no pasa por el solver externo retirado).
    expect(result!.algorithm).toBe('grid-2d-single');
    expect(result!.unidad).toBe('pliegos');
    expect(result!.piezasAcomodadas).toBe(10);
  });
});
