import { fuenteMedidaEfectiva, runNestingForPaso } from '../nesting-dispatcher';

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

function buildPasoPlotterCorte() {
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
      nombre: 'Corte',
      tipoPerfil: 'corte',
      productivityValue: 36,
      productivityUnit: 'm2_h',
      setupMin: 0,
      cleanupMin: 0,
      detalleJson: {},
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
  it('no genera nesting cuando el material cargado es hoja/placa', async () => {
    const result = await runNestingForPaso(
      buildPasoPlotterCorte() as never,
      {
        cantidad: 100,
        piezas: [{ cantidad: 100, anchoMm: 30, altoMm: 30 }],
      },
      {
        id: 'papel-a4',
        subfamilia: 'SUSTRATO_HOJA',
        atributosVarianteJson: { anchoMm: 210, altoMm: 297 },
      },
    );

    expect(result).toBeNull();
  });

  it('mantiene nesting de rollo cuando el material cargado es rollo', async () => {
    const result = await runNestingForPaso(
      buildPasoPlotterCorte() as never,
      {
        cantidad: 100,
        piezas: [{ cantidad: 100, anchoMm: 30, altoMm: 30 }],
      },
      {
        id: 'vinilo-61',
        subfamilia: 'VINILO_CORTE',
        atributosVarianteJson: { anchoMm: 610 },
      },
    );

    expect(result).not.toBeNull();
    expect(['shelf-rollo', 'maxrects-rollo']).toContain(result!.algorithm);
    expect(result!.unidad).toBe('m_lineales');
  });

  it('heredado de una cadena de pliegos: no nestea (los pliegos van enteros)', async () => {
    const result = await runNestingForPaso(
      buildPasoPlotterCorte() as never,
      {
        cantidad: 100,
        piezas: [{ cantidad: 100, anchoMm: 30, altoMm: 30 }],
        pliegos_impresos: 4,
        pliego_impresion_ancho_mm: 325,
        pliego_impresion_alto_mm: 500,
      } as never,
      null,
    );

    expect(result).toBeNull();
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

  it('invariante: pieza más grande que la hoja → null (no la coloca desbordada)', async () => {
    // 2500×1400 no entra en la hoja 1220×2440 ni rotada (1400 > 1220 y
    // 2500 > 2440). Sin panelizado, el motor NO debe acomodarla desbordada:
    // devuelve null y el guard corta con "no entra, activá panelizado".
    const result = await runNestingForPaso(
      buildPasoMontaje('auto') as never,
      { cantidad: 1, piezas: [{ cantidad: 1, anchoMm: 2500, altoMm: 1400 }] },
      {
        id: 'chapa-122x244',
        atributosVarianteJson: { anchoMm: 1220, largoMm: 2440 },
      },
    );
    expect(result).toBeNull();
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

  // ── Etapa A: qué piezas acomoda el paso lo declara la familia ──────
  // Laminado y montaje heredaban pliegos con dos tablas de claves gemelas
  // en el dispatcher. Ahora es una sola ruta y la diferencia entre ambos
  // queda declarada, no escondida en el código.

  function buildPasoLaminado() {
    return {
      rutaPasoId: 'rp-laminado',
      rutaPasoOrden: 2,
      familiaCodigo: 'laminado',
      configPasoId: 'cp-laminado',
      modoActivacion: 'OBLIGATORIO',
      condicionActivacionJson: null,
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      mecanismoCantidadConfigJson: null,
      multiplicadoresActivos: [],
      paramsPasoJson: { nestingConfig: { algorithm: 'shelf-rollo' } },
      maquinaM1Id: null,
      perfilM1Id: null,
      setupOverrideMin: null,
      cleanupOverrideMin: null,
      tiempoFijoOverrideMin: null,
      slots: [],
      cargosDirectosPaso: [],
      maquina: {
        id: 'm-lam',
        codigo: 'LAM',
        nombre: 'Laminadora',
        plantilla: 'LAMINADORA_BOPP_ROLLO',
        parametrosTecnicosJson: { anchoMaxRolloMm: 720 },
      },
    };
  }

  const filmEnRollo = {
    id: 'film-bopp',
    atributosVarianteJson: { anchoMm: 720, largoRolloMm: 200_000 },
  };

  it('el laminado lamina el PLIEGO impreso, no la pieza del cliente', async () => {
    const result = await runNestingForPaso(
      buildPasoLaminado() as never,
      {
        // 500 tarjetas chicas que salieron de 25 pliegos A3.
        cantidad: 500,
        piezas: [{ cantidad: 500, anchoMm: 90, altoMm: 50 }],
        pliegos_impresos: 25,
        pliego_impresion_ancho_mm: 297,
        pliego_impresion_alto_mm: 420,
      } as never,
      filmEnRollo,
    );

    expect(result).not.toBeNull();
    // Acomoda 25 pliegos, no 500 tarjetas.
    expect(result!.piezasAcomodadas).toBe(25);
  });

  it('el laminado no acomoda nada si el paso anterior no imprimió', async () => {
    const result = await runNestingForPaso(
      buildPasoLaminado() as never,
      {
        cantidad: 500,
        piezas: [{ cantidad: 500, anchoMm: 90, altoMm: 50 }],
      } as never,
      filmEnRollo,
    );

    expect(result).toBeNull();
  });

  it('el laminado exige impresión real: el pliego calculado no le alcanza', async () => {
    const result = await runNestingForPaso(
      buildPasoLaminado() as never,
      {
        cantidad: 500,
        piezas: [{ cantidad: 500, anchoMm: 90, altoMm: 50 }],
        // Sólo el cálculo de pre-prensa, sin impresión que lo respalde.
        pliegos_calculados: 25,
        pliego_impresion_ancho_mm: 297,
        pliego_impresion_alto_mm: 420,
      } as never,
      filmEnRollo,
    );

    expect(result).toBeNull();
  });

  it('el montaje sí acepta el pliego calculado como respaldo', async () => {
    const result = await runNestingForPaso(
      buildPasoMontaje('grid-2d-multi', 'pliegos_impresos') as never,
      {
        cantidad: 500,
        piezas: [{ cantidad: 500, anchoMm: 90, altoMm: 50 }],
        pliegos_calculados: 4,
        pliego_impresion_ancho_mm: 297,
        pliego_impresion_alto_mm: 420,
      } as never,
      { id: 'pvc', atributosVarianteJson: { anchoMm: 1220, largoMm: 2440 } },
    );

    expect(result).not.toBeNull();
    expect(result!.piezasAcomodadas).toBe(4);
  });
});

describe('lona bruta (efecto POST del bastidor)', () => {
  // La impresión de un cartel con bastidor debe imprimir la LONA BRUTA que el
  // bastidor publicó (visible + demasía de agarre), no la pieza visible.
  // docs/efectos-entre-pasos-diseno.md §8.
  const piezaVisible = [{ anchoMm: 500, altoMm: 500, cantidad: 1 }];

  it('imprime la lonaBrutaMm publicada, no la pieza visible', async () => {
    const sinBruta = await runNestingForPaso(
      buildPaso('shelf-rollo') as never,
      { cantidad: 1, piezas: piezaVisible },
      material,
    );
    const conBruta = await runNestingForPaso(
      buildPaso('shelf-rollo') as never,
      {
        cantidad: 1,
        piezas: piezaVisible,
        lonaBrutaMm: { anchoMm: 1000, altoMm: 1000 },
      },
      material,
    );
    expect(sinBruta).not.toBeNull();
    expect(conBruta).not.toBeNull();
    // 1000×1000 consume más rollo que 500×500: el efecto POST está enganchado.
    expect(conBruta!.cantidadCalculada).toBeGreaterThan(
      sinBruta!.cantidadCalculada,
    );
  });

  it('sin lonaBrutaMm publicada, imprime la pieza de siempre (no-op)', async () => {
    const a = await runNestingForPaso(
      buildPaso('shelf-rollo') as never,
      { cantidad: 1, piezas: piezaVisible },
      material,
    );
    const b = await runNestingForPaso(
      buildPaso('shelf-rollo') as never,
      { cantidad: 1, piezas: piezaVisible },
      material,
    );
    expect(a!.cantidadCalculada).toBe(b!.cantidadCalculada);
  });
});

describe('fuente de medida output:<clave> (modelo unificado)', () => {
  const chapaRollo = {
    id: 'chapa-1220',
    atributosVarianteJson: { anchoMm: 1220, largoRolloMm: 50_000 },
  };

  it('paneliza una LISTA de tiras publicada por un paso anterior (cenefaTirasMm)', async () => {
    const result = await runNestingForPaso(
      buildPasoMontaje('shelf-rollo', 'output:cenefaTirasMm') as never,
      {
        cantidad: 1,
        cenefaTirasMm: [
          { largoMm: 1000, anchoMm: 220 },
          { largoMm: 1000, anchoMm: 220 },
          { largoMm: 500, anchoMm: 220 },
          { largoMm: 500, anchoMm: 220 },
        ],
      },
      chapaRollo,
    );
    expect(result).not.toBeNull();
    // Las 4 tiras se acomodan como piezas (largo × desarrollo).
    expect(result!.piezasAcomodadas).toBe(4);
    expect(result!.consumedLengthMm).toBeGreaterThan(0);
  });

  it('paneliza un RECTÁNGULO publicado (fondoMm)', async () => {
    const result = await runNestingForPaso(
      buildPasoMontaje('shelf-rollo', 'output:fondoMm') as never,
      { cantidad: 1, fondoMm: { anchoMm: 900, altoMm: 700 } },
      chapaRollo,
    );
    expect(result).not.toBeNull();
    expect(result!.piezasAcomodadas).toBe(1);
  });

  it('sin el output publicado, no acomoda (null)', async () => {
    const result = await runNestingForPaso(
      buildPasoMontaje('shelf-rollo', 'output:cenefaTirasMm') as never,
      { cantidad: 1 },
      chapaRollo,
    );
    expect(result).toBeNull();
  });
});

describe('fuenteMedidaEfectiva — override por slot vs param del paso (§8)', () => {
  const mkPaso = (opts: {
    fuentePiezasMontaje?: string;
    slots?: Array<{ slotRol?: string; fuenteMedida?: string | null }>;
  }) =>
    ({
      paramsPasoJson: opts.fuentePiezasMontaje
        ? { fuentePiezasMontaje: opts.fuentePiezasMontaje }
        : {},
      slots: opts.slots ?? [],
    }) as never;

  it('sin fuenteMedida en los slots → cae al param del paso (neutral)', () => {
    expect(
      fuenteMedidaEfectiva(
        mkPaso({
          fuentePiezasMontaje: 'piezas_visibles',
          slots: [{ slotRol: 'SUSTRATO' }],
        }),
      ),
    ).toBe('piezas_visibles');
  });

  it('slot SUSTRATO con fuenteMedida → overridea el param del paso', () => {
    expect(
      fuenteMedidaEfectiva(
        mkPaso({
          fuentePiezasMontaje: 'piezas_jobcontext',
          slots: [
            { slotRol: 'SUSTRATO', fuenteMedida: 'output:cenefaTirasMm' },
          ],
        }),
      ),
    ).toBe('output:cenefaTirasMm');
  });

  it('fuenteMedida en un slot NO sustrato se ignora', () => {
    expect(
      fuenteMedidaEfectiva(
        mkPaso({
          fuentePiezasMontaje: 'piezas_visibles',
          slots: [{ slotRol: 'COMPONENTE', fuenteMedida: 'output:fondoMm' }],
        }),
      ),
    ).toBe('piezas_visibles');
  });

  it('sin fuente por ningún lado → null', () => {
    expect(fuenteMedidaEfectiva(mkPaso({}))).toBeNull();
  });
});

describe('panelizado sobre hoja', () => {
  const chapa = {
    id: 'chapa-100',
    subfamilia: 'SUSTRATO_RIGIDO',
    atributosVarianteJson: { anchoMm: 100, altoMm: 100 },
  };

  it('preserva identidad, orden y solapes de cada panel automático', async () => {
    const paso = buildPasoMontaje('auto') as ReturnType<
      typeof buildPasoMontaje
    >;
    paso.paramsPasoJson.nestingConfig = {
      ...paso.paramsPasoJson.nestingConfig,
      allowRotation: false,
      pieceBleedMm: 0,
      separationHMm: 0,
      separationVMm: 0,
      panelizado: {
        enabled: true,
        mode: 'automatic',
        axis: 'vertical',
        overlapMm: 10,
      },
    };

    const result = await runNestingForPaso(
      paso as never,
      {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 250, altoMm: 80 }],
      },
      chapa,
    );

    expect(result).not.toBeNull();
    expect(result!.placements).toHaveLength(4);
    expect(
      result!.placements.map((placement) => placement.panelIndex).sort(),
    ).toEqual([1, 2, 3, 4]);
    expect(
      result!.placements.every((placement) => placement.panelCount === 4),
    ).toBe(true);
    expect(
      result!.placements.every(
        (placement) => placement.pieceId === 'piece-0-0',
      ),
    ).toBe(true);
  });

  it('respeta un layout manual válido en vez de recalcularlo', async () => {
    const paso = buildPasoMontaje('auto') as ReturnType<
      typeof buildPasoMontaje
    >;
    paso.paramsPasoJson.nestingConfig = {
      ...paso.paramsPasoJson.nestingConfig,
      allowRotation: false,
      pieceBleedMm: 0,
      separationHMm: 0,
      separationVMm: 0,
      panelizado: {
        enabled: true,
        mode: 'manual',
        axis: 'vertical',
        overlapMm: 10,
        manualLayout: {
          items: [
            {
              sourcePieceId: 'piece-0-0',
              pieceWidthMm: 180,
              pieceHeightMm: 80,
              axis: 'vertical',
              panels: [
                {
                  panelIndex: 1,
                  usefulWidthMm: 90,
                  usefulHeightMm: 80,
                  overlapStartMm: 0,
                  overlapEndMm: 10,
                  finalWidthMm: 100,
                  finalHeightMm: 80,
                },
                {
                  panelIndex: 2,
                  usefulWidthMm: 90,
                  usefulHeightMm: 80,
                  overlapStartMm: 10,
                  overlapEndMm: 0,
                  finalWidthMm: 100,
                  finalHeightMm: 80,
                },
              ],
            },
          ],
        },
      },
    };

    const result = await runNestingForPaso(
      paso as never,
      {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 180, altoMm: 80 }],
      },
      chapa,
    );

    expect(result).not.toBeNull();
    expect(result!.placements).toHaveLength(2);
    expect(
      result!.placements.map((placement) => placement.panelIndex).sort(),
    ).toEqual([1, 2]);
  });
});
