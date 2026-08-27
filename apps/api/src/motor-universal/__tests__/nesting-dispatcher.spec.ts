import {
  esSustratoRollo,
  fuenteMedidaEfectiva,
  geometriaDispatchValida,
  resolverFormatoFisicoMaterial,
  runNestingForPaso,
} from '../nesting-dispatcher';

describe('formato físico del material', () => {
  it('reconoce un rollo especial por metadata sin confundir su subfamilia ambigua', () => {
    const imanFlexible = {
      subfamilia: 'IMAN_CERAMICO_FLEXIBLE',
      materiaPrimaTemplateId: 'iman_flexible_rollo_v1',
      materiaPrimaTipoTecnico: 'iman_flexible_rollo_heladera',
      unidadStock: 'METRO_LINEAL',
      atributosVarianteJson: {
        anchoMm: 610,
        largoRolloMm: 20_000,
      },
    };

    expect(resolverFormatoFisicoMaterial(imanFlexible)).toBe('rollo');
    expect(esSustratoRollo(imanFlexible)).toBe(true);
  });

  it('no convierte un imán cerámico unitario en rollo', () => {
    expect(
      resolverFormatoFisicoMaterial({
        subfamilia: 'IMAN_CERAMICO_FLEXIBLE',
        materiaPrimaTemplateId: 'iman_ceramico_redondo_v1',
        materiaPrimaTipoTecnico: 'iman_ceramico_redondo',
        unidadStock: 'UNIDAD',
        atributosVarianteJson: { diametroMm: 20 },
      }),
    ).toBe('plano');
  });

  it('reconoce futuros sustratos en rollo por geometría y unidad canónicas', () => {
    expect(
      resolverFormatoFisicoMaterial({
        subfamilia: 'OTRA_SUBFAMILIA',
        unidadStock: 'METRO_LINEAL',
        atributosVarianteJson: { anchoMm: 900, largoRolloMm: 30_000 },
      }),
    ).toBe('rollo');
  });

  it('prioriza una subfamilia plana aunque tenga atributos contradictorios', () => {
    expect(
      resolverFormatoFisicoMaterial({
        subfamilia: 'SUSTRATO_HOJA',
        unidadStock: 'METRO_LINEAL',
        atributosVarianteJson: { anchoMm: 325, largoRolloMm: 50_000 },
      }),
    ).toBe('plano');
  });
});

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
  it('acomoda cortes manuales sobre el ancho real de un rollo flexible', async () => {
    const paso = {
      ...buildPaso('auto'),
      familiaCodigo: 'corte_manual',
      modoTiempo: 'T-2',
      maquina: null,
    };
    const result = await runNestingForPaso(
      paso as never,
      {
        cantidad: 8,
        piezas: [{ cantidad: 8, anchoMm: 280, altoMm: 400 }],
      },
      {
        id: 'vinilo-esmerilado-61',
        subfamilia: 'SUSTRATO_ROLLO_FLEXIBLE',
        materiaPrimaTemplateId: 'vinilo_esmerilado_rollo_v1',
        atributosVarianteJson: { anchoMm: 610, largoRolloMm: 50_000 },
      },
    );

    expect(result).not.toBeNull();
    expect(['shelf-rollo', 'maxrects-rollo']).toContain(result!.algorithm);
    expect(result!.unidad).toBe('m_lineales');
    expect(result!.visualConfig?.usableArea.widthMm).toBeGreaterThan(0);
    expect(result!.visualConfig?.usableArea.widthMm).toBeLessThanOrEqual(610);
    expect(result!.piezasAcomodadas).toBe(8);
  });

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

describe('runNestingForPaso geometría vectorial', () => {
  it('acepta encastres irregulares aunque se superpongan sus rectángulos envolventes', () => {
    const base = {
      cantidadCalculada: 1,
      unidad: 'pliegos' as const,
      aprovechamientoPct: 50,
      substrates: [
        { kind: 'sheet' as const, count: 1, widthMm: 100, heightMm: 100 },
      ],
      placements: [
        {
          pieceId: 'pieza-a',
          substrateIndex: 0,
          xMm: 10,
          yMm: 10,
          widthMm: 60,
          heightMm: 60,
          rotated: false,
        },
        {
          pieceId: 'pieza-b',
          substrateIndex: 0,
          xMm: 40,
          yMm: 40,
          widthMm: 50,
          heightMm: 50,
          rotated: false,
        },
      ],
    };

    expect(
      geometriaDispatchValida({
        ...base,
        algorithm: 'irregular-2d-bottom-left-v1',
      }),
    ).toBe(true);
    expect(
      geometriaDispatchValida({
        ...base,
        algorithm: 'grid-2d-multi',
      }),
    ).toBe(false);
  });

  it.each(['cnc', 'corte_laser', 'corte_hilo_caliente'])(
    'convierte el nesting irregular de %s en placas costeables por el motor',
    async (familiaCodigo) => {
      const paso = {
        rutaPasoId: 'rp-cnc',
        rutaPasoOrden: 1,
        familiaCodigo,
        configPasoId: 'cp-cnc',
        modoActivacion: 'OBLIGATORIO',
        condicionActivacionJson: null,
        modoTiempo: 'T-3',
        mecanismoCantidad: 'CALCULADO_POR_PASO',
        mecanismoCantidadConfigJson: null,
        multiplicadoresActivos: [],
        paramsPasoJson: {
          usarDisenoVectorial: familiaCodigo !== 'corte_hilo_caliente',
          nestingConfig: { allowRotation: false, separationHMm: 0 },
        },
        slots: [],
        cargosDirectosPaso: [],
        maquina: null,
      };
      const result = await runNestingForPaso(
        paso as never,
        {
          cantidad: 2,
          geometriaVectorial: {
            schemaVersion: 1,
            anchoMm: 50,
            altoMm: 50,
            areaTotalMm2: 1_250,
            perimetroTotalMm: 170.711,
            hashFuente: 'fixture',
            piezas: [
              {
                id: 'triangulo',
                anchoMm: 50,
                altoMm: 50,
                areaMm2: 1_250,
                perimetroMm: 170.711,
                contornos: [
                  {
                    esHueco: false,
                    puntos: [
                      { x: 0, y: 50 },
                      { x: 25, y: 0 },
                      { x: 50, y: 50 },
                    ],
                  },
                ],
              },
            ],
          },
        },
        {
          id: 'polyfan-30',
          subfamilia: 'SUSTRATO_RIGIDO',
          precioReferencia: 1_000,
          atributosVarianteJson: {
            anchoMm: 140,
            altoMm: 80,
            margenNoUtilizableMm: 5,
          },
        },
      );

      expect(result?.algorithm).toBe('irregular-2d-bottom-left-v1');
      expect(result?.cantidadCalculada).toBe(1);
      expect(result?.unidad).toBe('pliegos');
      expect(result?.placements).toHaveLength(2);
    },
  );

  it('acomoda el SVG de MDF en la placa heredada aunque la placa rote sobre la cama láser', async () => {
    const paso = {
      rutaPasoId: 'rp-laser-mdf',
      rutaPasoOrden: 2,
      familiaCodigo: 'corte_laser',
      configPasoId: 'extra-laser-mdf',
      modoActivacion: 'OBLIGATORIO',
      condicionActivacionJson: null,
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      mecanismoCantidadConfigJson: null,
      multiplicadoresActivos: [],
      paramsPasoJson: {
        usarDisenoVectorial: true,
        nestingConfig: { allowRotation: true, separationHMm: 0 },
      },
      slots: [],
      cargosDirectosPaso: [],
      maquina: {
        id: 'laser-co2',
        codigo: 'LASER-CO2',
        nombre: 'Cortadora Laser CO2',
        plantilla: 'CORTADORA_LASER',
        anchoUtil: 1_000,
        largoUtil: 1_300,
        parametrosTecnicosJson: { tipoLaser: 'CO2' },
        consumibles: [],
        componentesDesgaste: [],
      },
    };

    const result = await runNestingForPaso(
      paso as never,
      {
        cantidad: 1,
        geometriaVectorial: {
          schemaVersion: 1,
          anchoMm: 254.566,
          altoMm: 198.227,
          areaTotalMm2: 50_455.87,
          perimetroTotalMm: 905.586,
          hashFuente: 'mdf-254x198',
          piezas: [
            {
              id: 'pieza-mdf',
              anchoMm: 254.566,
              altoMm: 198.227,
              areaMm2: 50_455.87,
              perimetroMm: 905.586,
              contornos: [
                {
                  esHueco: false,
                  puntos: [
                    { x: 0, y: 0 },
                    { x: 254.566, y: 0 },
                    { x: 254.566, y: 198.227 },
                    { x: 0, y: 198.227 },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        id: 'mdf-1300-900',
        subfamilia: 'SUSTRATO_RIGIDO',
        precioReferencia: 1_000,
        atributosVarianteJson: {
          anchoMm: 1_300,
          altoMm: 900,
          espesorMm: 3,
        },
      },
    );

    expect(result?.algorithm).toBe('irregular-2d-bottom-left-v1');
    expect(result?.cantidadCalculada).toBe(1);
    expect(result?.substrates).toEqual([
      expect.objectContaining({
        kind: 'sheet',
        widthMm: 1_300,
        heightMm: 900,
      }),
    ]);
    expect(result?.placements).toHaveLength(1);
  });

  it('conserva la orientación impresa aunque la placa deba girarse al cargarla en el láser', async () => {
    const geometriaVectorial = {
      schemaVersion: 1 as const,
      anchoMm: 254.566,
      altoMm: 198.227,
      areaTotalMm2: 50_455.87,
      perimetroTotalMm: 905.586,
      hashFuente: 'mdf-layout-compartido',
      piezas: [
        {
          id: 'pieza-mdf',
          anchoMm: 254.566,
          altoMm: 198.227,
          areaMm2: 50_455.87,
          perimetroMm: 905.586,
          contornos: [
            {
              esHueco: false,
              puntos: [
                { x: 0, y: 0 },
                { x: 254.566, y: 0 },
                { x: 254.566, y: 198.227 },
                { x: 0, y: 198.227 },
              ],
            },
          ],
        },
      ],
    };
    const jobContext = {
      cantidad: 2,
      geometriaVectorial,
      layout_produccion: {
        schemaVersion: 1 as const,
        sourceRutaPasoId: 'rp-impresion-uv',
        sourceConfigPasoId: 'cp-impresion-uv',
        sourceFamiliaCodigo: 'impresion_por_area',
        algorithm: 'grid-2d-multi' as const,
        substrates: [
          { kind: 'sheet' as const, count: 1, widthMm: 1_300, heightMm: 900 },
        ],
        placements: [
          {
            pieceId: 'pieza-mdf',
            substrateIndex: 0,
            xMm: 10,
            yMm: 20,
            widthMm: 254.566,
            heightMm: 198.227,
            rotated: false,
          },
          {
            pieceId: 'pieza-mdf',
            substrateIndex: 0,
            xMm: 300,
            yMm: 100,
            widthMm: 198.227,
            heightMm: 254.566,
            rotated: true,
          },
        ],
      },
    };
    const paso = {
      rutaPasoId: 'rp-laser-mdf',
      rutaPasoOrden: 2,
      familiaCodigo: 'corte_laser',
      configPasoId: 'extra-laser-mdf',
      modoActivacion: 'OBLIGATORIO',
      condicionActivacionJson: null,
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      mecanismoCantidadConfigJson: null,
      multiplicadoresActivos: [],
      paramsPasoJson: { usarDisenoVectorial: true },
      slots: [],
      cargosDirectosPaso: [],
      maquina: {
        id: 'laser-co2',
        codigo: 'LASER-CO2',
        nombre: 'Cortadora Laser CO2',
        plantilla: 'CORTADORA_LASER',
        anchoUtil: 1_000,
        largoUtil: 1_300,
        parametrosTecnicosJson: { tipoLaser: 'CO2' },
        consumibles: [],
        componentesDesgaste: [],
      },
    };

    const result = await runNestingForPaso(paso as never, jobContext, {
      id: 'mdf-1300-900',
      subfamilia: 'SUSTRATO_RIGIDO',
      precioReferencia: 1_000,
      atributosVarianteJson: { anchoMm: 1_300, altoMm: 900, espesorMm: 3 },
    });

    expect(result?.substrates).toEqual([
      { kind: 'sheet', count: 1, widthMm: 1_300, heightMm: 900 },
    ]);
    expect(result?.placements).toHaveLength(2);
    expect(result?.placements[0]).toMatchObject({
      pieceId: 'pieza-mdf',
      substrateIndex: 0,
      xMm: 10,
      yMm: 20,
      widthMm: 254.566,
      heightMm: 198.227,
      rotated: false,
    });
    expect(result?.placements[1]).toMatchObject({
      pieceId: 'pieza-mdf',
      substrateIndex: 0,
      xMm: 300,
      yMm: 100,
      widthMm: 198.227,
      heightMm: 254.566,
      rotated: true,
    });
    expect(result?.metricasRaw).toMatchObject({
      layoutHeredadoDeImpresion: true,
      placaRequiereRotacionEnMaquina: true,
      sourceRutaPasoId: 'rp-impresion-uv',
      perimetroCorteMm: 1_811.172,
    });
  });

  it('cotiza directamente la cantidad manual de placas y el corte estimado', async () => {
    const paso = {
      rutaPasoId: 'rp-corte-manual',
      rutaPasoOrden: 1,
      familiaCodigo: 'corte_hilo_caliente',
      configPasoId: 'cp-corte-manual',
      modoActivacion: 'OBLIGATORIO',
      condicionActivacionJson: null,
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      mecanismoCantidadConfigJson: null,
      multiplicadoresActivos: [],
      paramsPasoJson: { nestingConfig: { allowRotation: false } },
      slots: [],
      cargosDirectosPaso: [],
      maquina: null,
    };
    const jobContext = {
      cantidad: 1,
      placasVectorialesManuales: 3,
      metrosCortePorPlacaVectorial: 12,
    };
    const result = await runNestingForPaso(paso as never, jobContext, {
      id: 'polyfan-30',
      subfamilia: 'SUSTRATO_RIGIDO',
      precioReferencia: 1_000,
      atributosVarianteJson: { anchoMm: 1200, altoMm: 600 },
    });

    expect(result?.cantidadCalculada).toBe(3);
    expect(result?.substrates).toEqual([
      { kind: 'sheet', count: 3, widthMm: 1200, heightMm: 600 },
    ]);
    expect(result?.metricasRaw.perimetroCorteMm).toBe(36_000);
    expect(jobContext).toMatchObject({
      piezaAreaTotalM2: 2.16,
      piezaPerimetroTotalM: 36,
    });
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
  it('monta pliegos impresos sobre imán flexible usando nesting de rollo', async () => {
    const result = await runNestingForPaso(
      buildPasoMontaje('auto', 'pliegos_impresos') as never,
      {
        cantidad: 100,
        pliegos_impresos: 4,
        pliego_impresion_ancho_mm: 325,
        pliego_impresion_alto_mm: 475,
      },
      {
        id: 'iman-heladera-610',
        subfamilia: 'IMAN_CERAMICO_FLEXIBLE',
        materiaPrimaTemplateId: 'iman_flexible_rollo_v1',
        materiaPrimaTipoTecnico: 'iman_flexible_rollo_heladera',
        unidadStock: 'METRO_LINEAL',
        atributosVarianteJson: {
          anchoMm: 610,
          largoMm: 20_000,
          largoRolloMm: 20_000,
        },
      },
    );

    expect(result).not.toBeNull();
    expect(['shelf-rollo', 'maxrects-rollo']).toContain(result!.algorithm);
    expect(result!.unidad).toBe('m_lineales');
    expect(result!.substrates[0]).toMatchObject({
      kind: 'roll',
      widthMm: 610,
    });
    expect(result!.consumedLengthMm).toBeGreaterThan(0);
  });

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

  it('publica cada placa física y sus placements en un nesting uniforme multplaca', async () => {
    const result = await runNestingForPaso(
      buildPasoMontaje('auto') as never,
      {
        cantidad: 5,
        piezas: [{ cantidad: 5, anchoMm: 600, altoMm: 400 }],
      },
      {
        id: 'mdf-130x90',
        subfamilia: 'SUSTRATO_RIGIDO',
        atributosVarianteJson: { anchoMm: 1300, altoMm: 900 },
      },
    );

    expect(result).not.toBeNull();
    expect(result!.algorithm).toBe('grid-2d-single');
    expect(result!.cantidadCalculada).toBe(2);
    expect(result!.substrates).toEqual([
      { kind: 'sheet', count: 1, widthMm: 1300, heightMm: 900 },
      { kind: 'sheet', count: 1, widthMm: 1300, heightMm: 900 },
    ]);
    expect(result!.placements).toHaveLength(5);
    expect(
      result!.placements.filter((placement) => placement.substrateIndex === 0),
    ).toHaveLength(4);
    expect(
      result!.placements.filter((placement) => placement.substrateIndex === 1),
    ).toHaveLength(1);
    expect(result!.metricasRaw.perSubstrate).toHaveLength(2);
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
