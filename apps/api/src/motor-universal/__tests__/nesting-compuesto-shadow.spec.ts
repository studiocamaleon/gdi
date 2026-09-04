import type {
  ComponenteFabricadoCosteado,
  NestingEjecutado,
  PasoEjecutado,
} from '../tipos';
import {
  aplicarNestingCompuestoRectangular,
  analizarNestingCompuestoShadow,
  leerExclusionNestingComponente,
  leerPoliticaNestingCompuesto,
} from '../nesting-compuesto-shadow';
import {
  crearProblemaNestingIrregular,
  resolverProblemaNestingIrregular,
  type DemandaNesting,
} from '../geometria-vectorial/contrato-nesting';

const nestingIrregular = (
  pieceId: string,
  componenteCodigo: string,
): NestingEjecutado => {
  const demanda: DemandaNesting = {
    schemaVersion: 1,
    id: pieceId,
    cantidad: 1,
    propietario: { componenteCodigo },
    geometria: {
      tipo: 'POLIGONO',
      anchoMm: 60,
      altoMm: 60,
      areaMm2: 1_800,
      perimetroMm: 204.85,
      contornos: [
        {
          esHueco: false,
          puntos: [
            { x: 0, y: 60 },
            { x: 30, y: 0 },
            { x: 60, y: 60 },
          ],
        },
      ],
    },
  };
  const solucion = resolverProblemaNestingIrregular(
    crearProblemaNestingIrregular({
      demandas: [demanda],
      anchoPlacaMm: 100,
      altoPlacaMm: 100,
      permitirRotacion: true,
      permitirSegmentacion: false,
    }),
  );
  return {
    algorithm: 'irregular-2d-bottom-left-v1',
    cantidadCalculada: solucion.resultado.placas,
    unidad: 'pliegos',
    aprovechamientoPct: solucion.resultado.aprovechamientoPct,
    maquina: { id: 'maquina-1', nombre: 'Mesa de corte' },
    perfil: { id: 'perfil-1', nombre: 'Calidad normal' },
    sustrato: { materialVarianteId: 'material-1', nombre: 'PVC 1 mm' },
    substrates: Array.from({ length: solucion.resultado.placas }, () => ({
      kind: 'sheet' as const,
      count: 1,
      widthMm: 100,
      heightMm: 100,
    })),
    placements: solucion.resultado.placements.map((placement) => ({
      pieceId: placement.pieceId,
      substrateIndex: placement.substrateIndex,
      xMm: placement.xMm,
      yMm: placement.yMm,
      widthMm: placement.anchoMm,
      heightMm: placement.altoMm,
      rotated: placement.rotacion !== 0,
      meta: { contornos: placement.contornos },
    })),
    piezasAcomodadas: solucion.resultado.placements.length,
    demandaNesting: [demanda],
    solucionNesting: solucion,
    estrategiaDisposicion: 'nesting_optimizado',
    visualConfig: {
      margins: { leftMm: 0, rightMm: 0, topMm: 0, bottomMm: 0 },
      spacing: { horizontalMm: 0, verticalMm: 0 },
      allowRotation: true,
      usableArea: { xMm: 0, yMm: 0, widthMm: 100, heightMm: 100 },
    },
    modoColor: 'CMYK',
    tecnologia: 'UV',
    carasProcesadas: 1,
  };
};

const nestingBase = (
  overrides: Partial<NestingEjecutado> = {},
): NestingEjecutado => ({
  algorithm: 'grid-2d-single',
  cantidadCalculada: 1,
  unidad: 'pliegos',
  aprovechamientoPct: 24,
  maquina: { id: 'maquina-1', nombre: 'Mesa UV' },
  perfil: { id: 'perfil-1', nombre: 'Calidad normal' },
  sustrato: { materialVarianteId: 'material-1', nombre: 'PVC 1 mm' },
  substrates: [{ kind: 'sheet', count: 1, widthMm: 100, heightMm: 100 }],
  placements: [
    {
      pieceId: 'pieza',
      substrateIndex: 0,
      xMm: 0,
      yMm: 0,
      widthMm: 60,
      heightMm: 40,
      rotated: false,
    },
  ],
  piezasAcomodadas: 1,
  demandaRectangular: [
    { pieceId: 'pieza', cantidad: 1, anchoMm: 60, altoMm: 40 },
  ],
  visualConfig: {
    margins: { leftMm: 0, rightMm: 0, topMm: 0, bottomMm: 0 },
    spacing: { horizontalMm: 0, verticalMm: 0 },
    allowRotation: false,
    usableArea: { xMm: 0, yMm: 0, widthMm: 100, heightMm: 100 },
  },
  modoColor: 'CMYK',
  tecnologia: 'UV',
  carasProcesadas: 1,
  ...overrides,
});

const nestingRollo = (
  pieceId: string,
  anchoMm: number,
  altoMm: number,
  rollWidthMm = 800,
): NestingEjecutado => ({
  algorithm: 'shelf-rollo',
  cantidadCalculada: altoMm / 1000,
  unidad: 'm_lineales',
  aprovechamientoPct: 0,
  maquina: { id: 'maquina-rollo', nombre: 'Impresora de rollo' },
  perfil: { id: 'perfil-rollo', nombre: 'Calidad normal' },
  sustrato: { materialVarianteId: 'rollo-800', nombre: 'Vinilo 80 cm' },
  substrates: [{ kind: 'roll', lengthMm: altoMm, widthMm: rollWidthMm }],
  placements: [
    {
      pieceId,
      substrateIndex: 0,
      xMm: 0,
      yMm: 0,
      widthMm: anchoMm,
      heightMm: altoMm,
      rotated: false,
    },
  ],
  consumedLengthMm: altoMm,
  piezasAcomodadas: 1,
  demandaRectangular: [{ pieceId, cantidad: 1, anchoMm, altoMm }],
  visualConfig: {
    margins: { leftMm: 0, rightMm: 0, topMm: 0, bottomMm: 0 },
    spacing: { horizontalMm: 0, verticalMm: 0 },
    allowRotation: false,
    usableArea: { xMm: 0, yMm: 0, widthMm: rollWidthMm, heightMm: altoMm },
    printableArea: {
      xMm: 0,
      yMm: 0,
      widthMm: rollWidthMm,
      heightMm: altoMm,
    },
  },
  modoColor: 'CMYK',
  tecnologia: 'ECOSOLVENTE',
  carasProcesadas: 1,
});

function componente(
  codigo: string,
  nesting = nestingBase(),
  overrides: Partial<ComponenteFabricadoCosteado> = {},
): ComponenteFabricadoCosteado {
  const paso: PasoEjecutado = {
    rutaPasoId: `ruta-${codigo}`,
    rutaPasoOrden: 1,
    familiaCodigo: 'impresion_por_area',
    nombreVisible: 'Impresión UV',
    configPasoId: `paso-${codigo}`,
    activado: true,
    costoTotal: 30,
    tiempo: {
      setupMin: 5,
      runMin: 10,
      cleanupMin: 1,
      tiempoFijoMin: 0,
      totalMin: 16,
      maquinaId: 'maquina-1',
      tarifaHora: 60,
      dotacionOperarios: 1,
      costo: 16,
    },
    nestingResult: nesting,
    materiales: [
      {
        slotCodigo: 'sustrato_principal',
        materialVarianteId: 'material-1',
        materialNombre: 'PVC-1',
        materialSku: 'PVC-1',
        materialDisplayName: 'PVC 1 mm',
        tipoLineaCosto: 'MATERIAL',
        cantidad: 1,
        unidad: 'hoja',
        precioUnitario: 10,
        costoTotal: 10,
        estrategiaCosto: 'simple',
        detalleCosteoNesting: {
          strategy: 'simple',
          totalCost: 10,
          unitPrice: 10,
          pricePerM2: 1_000,
          fullUnits: 1,
          fullUnitsCost: 10,
          lastUnit: null,
          units: [
            { index: 0, occupationPct: 24, segmentApplied: null, cost: 10 },
          ],
        },
        modoSeleccion: 'HARDCODED',
      },
    ],
  };
  return {
    productoId: `producto-${codigo}`,
    codigo,
    nombre: codigo,
    politicaEjecucion: 'INDEPENDIENTE',
    cantidad: 1,
    unidad: 'unidad',
    jobContext: { cantidad: 1 },
    recetaRevisionId: `revision-${codigo}`,
    recetaVersion: 1,
    recetaHuella: `huella-${codigo}`,
    costoUnitario: 30,
    costoTotal: 30,
    pasos: [paso],
    ...overrides,
  };
}

const analizar = (componentes: ComponenteFabricadoCosteado[]) =>
  analizarNestingCompuestoShadow({
    politica: 'CONSOLIDAR_COMPATIBLES',
    tenantId: 'tenant-1',
    productoPadreId: 'padre-1',
    recetaRevisionId: 'revision-padre-1',
    componentes,
  });

describe('F4.4.1 nesting compuesto en modo sombra', () => {
  it('mantiene INDEPENDIENTE por defecto y exige opt-in versionado', () => {
    expect(leerPoliticaNestingCompuesto(null)).toBe('INDEPENDIENTE');
    expect(
      leerPoliticaNestingCompuesto({
        nestingCompuesto: { version: 1, politica: 'CONSOLIDAR_COMPATIBLES' },
      }),
    ).toBe('CONSOLIDAR_COMPATIBLES');
    expect(
      analizarNestingCompuestoShadow({
        politica: 'INDEPENDIENTE',
        tenantId: 'tenant-1',
        productoPadreId: 'padre-1',
        recetaRevisionId: 'revision-padre-1',
        componentes: [componente('A'), componente('B')],
      }),
    ).toBeUndefined();
  });

  it('compara dos demandas compatibles sin modificar sus costos', () => {
    const componentes = [componente('A'), componente('B')];
    const costosAntes = componentes.map((item) => item.costoTotal);

    const resultado = analizar(componentes)!;

    expect(resultado).toMatchObject({
      version: 1,
      modo: 'SOMBRA',
      politica: 'CONSOLIDAR_COMPATIBLES',
      aplicadoACostos: false,
      grupos: [
        {
          firmaVersion: 1,
          independiente: { sustratos: 2, aprovechamientoPct: 24 },
          consolidado: {
            algoritmo: 'grid-2d-multi',
            sustratos: 1,
            aprovechamientoPct: 48,
          },
          diferencia: {
            sustratos: 1,
            ahorroPct: 50,
            ahorroPotencial: true,
          },
        },
      ],
      exclusiones: [],
    });
    expect(resultado.grupos[0].firmaCompatibilidad).toMatch(/^[a-f0-9]{64}$/);
    expect(
      resultado.grupos[0].consolidado.placements.map(
        (placement) =>
          (placement.meta as { componenteCodigo: string }).componenteCodigo,
      ),
    ).toEqual(['A', 'B']);
    expect(componentes.map((item) => item.costoTotal)).toEqual(costosAntes);
  });

  it('consolida dos ocurrencias distintas del mismo producto hijo', () => {
    const resultado = analizar([
      componente('VINILO-FRENTE', nestingBase(), {
        productoId: 'producto-vinilo',
        nombre: 'Vinilo frente',
      }),
      componente('VINILO-LATERAL', nestingBase(), {
        productoId: 'producto-vinilo',
        nombre: 'Vinilo lateral',
      }),
    ])!;

    expect(resultado.grupos).toHaveLength(1);
    expect(
      resultado.grupos[0].consolidado.placements.map(
        (placement) =>
          (placement.meta as { componenteCodigo: string }).componenteCodigo,
      ),
    ).toEqual(['VINILO-FRENTE', 'VINILO-LATERAL']);
  });

  it('consolida contornos vectoriales compatibles conservando su propietario', () => {
    const componentes = [
      componente('VECTOR-A', nestingIrregular('triangulo', 'VECTOR-A')),
      componente('VECTOR-B', nestingIrregular('triangulo', 'VECTOR-B')),
    ];

    const resultado = aplicarNestingCompuestoRectangular({
      politica: 'CONSOLIDAR_COMPATIBLES',
      tenantId: 'tenant-1',
      productoPadreId: 'padre-1',
      recetaRevisionId: 'revision-padre-1',
      componentes,
    })!;
    const grupo = resultado.grupos[0];

    expect(grupo).toMatchObject({
      consolidado: {
        algoritmo: 'irregular-2d-bottom-left-v1',
        sustratos: 1,
      },
      diferencia: { sustratos: 1, ahorroPotencial: true },
      aplicacion: { aplicado: true },
    });
    expect(grupo.lote?.nestingResult.demandaNesting).toHaveLength(2);
    expect(grupo.lote?.nestingResult.solucionNesting).toMatchObject({
      versionAlgoritmo: 1,
      problema: { demandas: [{ cantidad: 1 }, { cantidad: 1 }] },
    });
    expect(
      grupo.lote?.nestingResult.placements.map(
        (placement) =>
          (
            placement.meta as {
              propietario: { componenteCodigo: string };
            }
          ).propietario.componenteCodigo,
      ),
    ).toEqual(expect.arrayContaining(['VECTOR-A', 'VECTOR-B']));
  });

  it('no consolida una composición vectorial que debe conservar su negativo', () => {
    const primero = nestingIrregular('pieza-a', 'VECTOR-A');
    const segundo = nestingIrregular('pieza-b', 'VECTOR-B');
    primero.estrategiaDisposicion = 'composicion_original';

    const resultado = analizar([
      componente('VECTOR-A', primero),
      componente('VECTOR-B', segundo),
    ])!;

    expect(resultado.grupos).toHaveLength(0);
    expect(resultado.exclusiones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          componenteCodigo: 'VECTOR-A',
          codigo: 'CONFIGURACION_INCOMPLETA',
          motivo: expect.stringMatching(/disposición original/i),
        }),
      ]),
    );
  });

  it('no separa la impresión de un corte vectorial registrado', () => {
    const registrado = nestingBase({
      layoutVinculadoGeometriaVectorial: true,
    });
    const resultado = analizar([
      componente('IMPRESO-A', registrado),
      componente('IMPRESO-B'),
    ])!;

    expect(resultado.grupos).toHaveLength(0);
    expect(resultado.exclusiones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          componenteCodigo: 'IMPRESO-A',
          codigo: 'CONFIGURACION_INCOMPLETA',
          motivo: expect.stringMatching(/impresión.*corte vectorial/i),
        }),
      ]),
    );
  });

  it('aplica un único consumo y preparación con reparto reconciliado', () => {
    const componentes = [componente('A'), componente('B')];

    const resultado = aplicarNestingCompuestoRectangular({
      politica: 'CONSOLIDAR_COMPATIBLES',
      tenantId: 'tenant-1',
      productoPadreId: 'padre-1',
      recetaRevisionId: 'revision-padre-1',
      componentes,
    })!;

    expect(resultado).toMatchObject({
      modo: 'APLICADO',
      aplicadoACostos: true,
      grupos: [
        {
          aplicacion: {
            aplicado: true,
            costoMaterialIndependiente: 20,
            costoMaterialConsolidado: 10,
            costoPreparacionIndependiente: 12,
            costoPreparacionConsolidado: 6,
            ahorroCostoTotal: 16,
          },
          lote: {
            versionContrato: 1,
            estado: 'CONGELADO',
            costoMaterialTotal: 10,
            costoPreparacionTotal: 6,
            costoTotalAsignado: 16,
            nestingResult: {
              algorithm: 'grid-2d-multi',
              cantidadCalculada: 1,
              unidad: 'pliegos',
              piezasAcomodadas: 2,
              maquina: { id: 'maquina-1', nombre: 'Mesa UV' },
              sustrato: {
                materialVarianteId: 'material-1',
                nombre: 'PVC 1 mm',
              },
              substrates: [
                { kind: 'sheet', count: 1, widthMm: 100, heightMm: 100 },
              ],
              placements: expect.arrayContaining([
                expect.objectContaining({ substrateIndex: 0 }),
              ]),
              visualConfig: expect.objectContaining({
                allowRotation: false,
                usableArea: { xMm: 0, yMm: 0, widthMm: 100, heightMm: 100 },
              }),
            },
            costeoSustrato: expect.objectContaining({
              strategy: 'simple',
              totalCost: 10,
              unitPrice: 10,
              units: [expect.objectContaining({ index: 0, cost: 10 })],
            }),
            participantes: [
              expect.objectContaining({
                componenteCodigo: 'A',
                costoMaterialAsignado: 5,
                costoPreparacionAsignado: 3,
                esPasoOperativo: true,
              }),
              expect.objectContaining({
                componenteCodigo: 'B',
                costoMaterialAsignado: 5,
                costoPreparacionAsignado: 3,
                esPasoOperativo: false,
              }),
            ],
          },
        },
      ],
    });
    expect(componentes.map((item) => item.costoTotal)).toEqual([22, 22]);
    expect(
      componentes
        .flatMap((item) => item.pasos ?? [])
        .map((paso) => ({
          costo: paso.costoTotal,
          setup: paso.tiempo?.setupMin,
          cleanup: paso.tiempo?.cleanupMin,
          material: paso.materiales?.[0].costoTotal,
        })),
    ).toEqual([
      { costo: 22, setup: 2.5, cleanup: 0.5, material: 5 },
      { costo: 22, setup: 2.5, cleanup: 0.5, material: 5 },
    ]);
    expect(
      componentes.reduce((total, item) => total + item.costoTotal, 0),
    ).toBe(44);
  });

  it('conserva la merma operativa al consolidar y congela su costo por separado', () => {
    const componentes = [componente('A'), componente('B')];
    for (const item of componentes) {
      const material = item.pasos?.[0].materiales?.[0];
      if (!material) throw new Error('fixture inválido');
      material.cantidad = 1.2;
      material.costoTotal = 12;
      material.mermaAdicional = {
        porcentaje: 20,
        cantidadTrabajo: 1,
        cantidadMerma: 0.2,
      };
    }

    const resultado = aplicarNestingCompuestoRectangular({
      politica: 'CONSOLIDAR_COMPATIBLES',
      tenantId: 'tenant-1',
      productoPadreId: 'padre-1',
      recetaRevisionId: 'revision-padre-1',
      componentes,
    })!;
    const grupo = resultado.grupos[0];

    expect(grupo.aplicacion).toMatchObject({
      aplicado: true,
      costoMaterialIndependiente: 24,
      costoMaterialConsolidado: 12,
    });
    expect(grupo.lote?.costeoSustrato).toMatchObject({
      totalCost: 10,
      mermaOperativa: {
        porcentaje: 20,
        costoBase: 10,
        costoMerma: 2,
        costoTotal: 12,
      },
    });
    expect(componentes.map((item) => item.pasos?.[0].materiales?.[0])).toEqual([
      expect.objectContaining({
        cantidad: 0.6,
        costoTotal: 6,
        mermaAdicional: {
          porcentaje: 20,
          cantidadTrabajo: 0.5,
          cantidadMerma: 0.1,
        },
      }),
      expect.objectContaining({
        cantidad: 0.6,
        costoTotal: 6,
        mermaAdicional: {
          porcentaje: 20,
          cantidadTrabajo: 0.5,
          cantidadMerma: 0.1,
        },
      }),
    ]);
  });

  it('no mezcla en un lote pasos con distinta merma operativa', () => {
    const componentes = [componente('A'), componente('B')];
    componentes.forEach((item, index) => {
      const material = item.pasos?.[0].materiales?.[0];
      if (!material) throw new Error('fixture inválido');
      const porcentaje = index === 0 ? 10 : 20;
      material.mermaAdicional = {
        porcentaje,
        cantidadTrabajo: 1,
        cantidadMerma: porcentaje / 100,
      };
    });

    const resultado = analizar(componentes)!;

    expect(resultado.grupos).toEqual([]);
    expect(resultado.aplicadoACostos).toBe(false);
    expect(resultado.exclusiones).toEqual([
      expect.objectContaining({
        componenteCodigo: 'A',
        codigo: 'SIN_PAR_COMPATIBLE',
      }),
      expect.objectContaining({
        componenteCodigo: 'B',
        codigo: 'SIN_PAR_COMPATIBLE',
      }),
    ]);
  });

  it('costea y dibuja el consolidado sobre el lado largo de una placa apaisada', () => {
    const nestingPlaca = (pieceId: string, anchoMm: number, altoMm: number) =>
      nestingBase({
        aprovechamientoPct: 0,
        substrates: [{ kind: 'sheet', count: 1, widthMm: 1300, heightMm: 900 }],
        placements: [
          {
            pieceId,
            substrateIndex: 0,
            xMm: 5,
            yMm: 5,
            widthMm: anchoMm,
            heightMm: altoMm,
            rotated: false,
          },
        ],
        demandaRectangular: [{ pieceId, cantidad: 1, anchoMm, altoMm }],
        costingSegmentSteps: [15, 30, 45, 60, 75, 90, 100],
        visualConfig: {
          margins: { leftMm: 5, rightMm: 5, topMm: 5, bottomMm: 5 },
          spacing: { horizontalMm: 6, verticalMm: 6 },
          allowRotation: true,
          usableArea: { xMm: 5, yMm: 5, widthMm: 1290, heightMm: 890 },
        },
      });
    const componentes = [
      componente('A', nestingPlaca('principal', 700, 400)),
      componente('B', nestingPlaca('secundaria', 500, 400)),
    ];
    for (const item of componentes) {
      const material = item.pasos?.[0].materiales?.[0];
      if (!material?.detalleCosteoNesting) throw new Error('fixture inválido');
      material.precioUnitario = 1000;
      material.costoTotal = 1000;
      material.estrategiaCosto = 'plate-segments';
      material.detalleCosteoNesting = {
        strategy: 'plate-segments',
        totalCost: 1000,
        unitPrice: 1000,
        pricePerM2: 854.7,
        fullUnits: 1,
        fullUnitsCost: 1000,
        lastUnit: null,
        units: [
          {
            index: 0,
            occupationPct: 100,
            segmentApplied: 100,
            cost: 1000,
          },
        ],
      };
    }

    const resultado = aplicarNestingCompuestoRectangular({
      politica: 'CONSOLIDAR_COMPATIBLES',
      tenantId: 'tenant-1',
      productoPadreId: 'padre-1',
      recetaRevisionId: 'revision-padre-1',
      componentes,
    })!;
    const grupo = resultado.grupos[0];

    expect(grupo.aplicacion).toMatchObject({
      aplicado: true,
      costoMaterialIndependiente: 2000,
      costoMaterialConsolidado: 600,
    });
    expect(grupo.lote?.costeoSustrato?.units).toEqual([
      {
        index: 0,
        occupationPct: 54.62,
        segmentApplied: 60,
        cost: 600,
      },
    ]);
    expect(grupo.lote?.nestingResult.costingPreview).toMatchObject({
      chargedRatio: 0.6,
      chargedLengthMm: 780,
      chargedBounds: {
        xMm: 0,
        yMm: 0,
        widthMm: 780,
        heightMm: 900,
      },
    });
  });

  it('conserva el cálculo independiente si la alternativa empeora consumo o costo', () => {
    const demandaExigente = nestingBase({
      demandaRectangular: [
        { pieceId: 'pieza', cantidad: 3, anchoMm: 60, altoMm: 40 },
      ],
    });
    const componentes = [
      componente('A', demandaExigente),
      componente(
        'B',
        nestingBase({
          demandaRectangular: [
            { pieceId: 'pieza', cantidad: 3, anchoMm: 60, altoMm: 40 },
          ],
        }),
      ),
    ];

    const resultado = aplicarNestingCompuestoRectangular({
      politica: 'CONSOLIDAR_COMPATIBLES',
      tenantId: 'tenant-1',
      productoPadreId: 'padre-1',
      recetaRevisionId: 'revision-padre-1',
      componentes,
    })!;

    expect(resultado).toMatchObject({
      modo: 'APLICADO',
      aplicadoACostos: false,
      grupos: [
        {
          aplicacion: {
            aplicado: false,
            motivoNoAplicado: expect.stringContaining('empeora'),
            costoMaterialIndependiente: 20,
            costoMaterialConsolidado: 30,
            ahorroCostoTotal: -4,
          },
        },
      ],
    });
    expect(componentes.map((item) => item.costoTotal)).toEqual([30, 30]);
  });

  it('separa el mismo material ante cualquier diferencia productiva crítica', () => {
    const incompatibles: NestingEjecutado[] = [
      nestingBase({ maquina: { id: 'maquina-2', nombre: 'Otra mesa' } }),
      nestingBase({ perfil: { id: 'perfil-2', nombre: 'Alta calidad' } }),
      nestingBase({ modoColor: 'ESCALA_GRISES' }),
      nestingBase({ tecnologia: 'LATEX' }),
      nestingBase({ carasProcesadas: 2 }),
      nestingBase({ tintasAdicionales: ['BLANCO'] }),
    ];

    for (const nestingIncompatible of incompatibles) {
      const resultado = analizar([
        componente('A'),
        componente('B', nestingIncompatible),
      ])!;

      expect(resultado.grupos).toHaveLength(0);
      expect(resultado.exclusiones).toEqual([
        expect.objectContaining({
          componenteCodigo: 'A',
          codigo: 'SIN_PAR_COMPATIBLE',
        }),
        expect.objectContaining({
          componenteCodigo: 'B',
          codigo: 'SIN_PAR_COMPATIBLE',
        }),
      ]);
    }
  });

  it('respeta la exclusión explícita de una relación BOM', () => {
    expect(
      leerExclusionNestingComponente({
        nestingCompuesto: {
          version: 1,
          excluido: true,
          motivo: 'Se imprime en otro turno',
        },
      }),
    ).toEqual({ excluido: true, motivo: 'Se imprime en otro turno' });

    const resultado = analizar([
      componente('A'),
      componente('B', nestingBase(), {
        nestingCompartido: {
          excluido: true,
          motivo: 'Se imprime en otro turno',
        },
      }),
    ])!;

    expect(resultado.grupos).toHaveLength(0);
    expect(resultado.exclusiones).toEqual([
      expect.objectContaining({
        componenteCodigo: 'A',
        codigo: 'SIN_PAR_COMPATIBLE',
      }),
      expect.objectContaining({
        componenteCodigo: 'B',
        codigo: 'COMPONENTE_EXCLUIDO',
        motivo: 'Se imprime en otro turno',
      }),
    ]);
  });

  it('consolida rollos y congela exactamente el largo que costea', () => {
    const componentes = [
      componente('VINILO-A', nestingRollo('frente', 500, 300)),
      componente('VINILO-B', nestingRollo('lateral', 300, 300)),
    ];
    for (const item of componentes) {
      const material = item.pasos?.[0].materiales?.[0];
      if (!material) throw new Error('fixture inválido');
      material.materialVarianteId = 'rollo-800';
      material.materialNombre = 'VINILO-800';
      material.materialSku = 'VINILO-800';
      material.materialDisplayName = 'Vinilo 80 cm';
      material.materiaPrimaId = 'vinilo-base';
      material.unidad = 'm_lineales';
      material.precioUnitario = 10;
      material.cantidad = 0.3;
      material.costoTotal = 3;
      material.estrategiaCosto = 'consumed-length';
      material.detalleCosteoNesting = undefined;
      item.costoTotal = 23;
      item.costoUnitario = 23;
      item.pasos![0].costoTotal = 23;
    }

    const resultado = aplicarNestingCompuestoRectangular({
      politica: 'CONSOLIDAR_COMPATIBLES',
      tenantId: 'tenant-1',
      productoPadreId: 'padre-1',
      recetaRevisionId: 'revision-padre-1',
      componentes,
    })!;
    const grupo = resultado.grupos[0];

    expect(grupo).toMatchObject({
      independiente: { sustratos: 2, largoMm: 600 },
      consolidado: {
        algoritmo: 'shelf-rollo',
        sustratos: 1,
        largoMm: 300,
        substrates: [{ kind: 'roll', widthMm: 800, lengthMm: 300 }],
      },
      diferencia: { largoMm: 300, ahorroPct: 50, ahorroPotencial: true },
      aplicacion: {
        aplicado: true,
        costoMaterialIndependiente: 6,
        costoMaterialConsolidado: 3,
      },
      lote: {
        materialVarianteId: 'rollo-800',
        nestingResult: {
          algorithm: 'shelf-rollo',
          unidad: 'm_lineales',
          cantidadCalculada: 0.3,
          consumedLengthMm: 300,
          substrates: [{ kind: 'roll', widthMm: 800, lengthMm: 300 }],
        },
        costeoSustrato: {
          strategy: 'consumed-length',
          totalCost: 3,
        },
      },
    });
    expect(grupo.lote?.nestingResult.placements).toHaveLength(2);
    expect(
      grupo.lote?.nestingResult.placements.map(
        (placement) =>
          (placement.meta as { componenteCodigo: string }).componenteCodigo,
      ),
    ).toEqual(expect.arrayContaining(['VINILO-A', 'VINILO-B']));
  });

  it('reevalúa los anchos automáticos y elige el menor costo del lote completo', () => {
    const componentes = [
      componente('VINILO-A', nestingRollo('frente', 600, 300)),
      componente('VINILO-B', nestingRollo('lateral', 400, 300)),
    ];
    componentes[0].pasos![0].nestingResult!.algorithmPolicy = 'auto';
    componentes[1].pasos![0].nestingResult!.algorithm = 'maxrects-rollo';
    componentes[1].pasos![0].nestingResult!.algorithmPolicy = 'auto';
    for (const item of componentes) {
      const material = item.pasos?.[0].materiales?.[0];
      if (!material) throw new Error('fixture inválido');
      material.materialVarianteId = 'rollo-800';
      material.materialNombre = 'VINILO-800';
      material.materialSku = 'VINILO-800';
      material.materialDisplayName = 'Vinilo 80 cm';
      material.materiaPrimaId = 'vinilo-base';
      material.unidad = 'm_lineales';
      material.precioUnitario = 8;
      material.cantidad = 0.3;
      material.costoTotal = 2.4;
      material.estrategiaCosto = 'consumed-length';
      material.detalleCosteoNesting = undefined;
      material.modoSeleccion = 'MOTOR_ELIGE_AUTO';
      material.opcionesNestingRollo = [
        {
          materialVarianteId: 'rollo-800',
          materialSku: 'VINILO-800',
          materialDisplayName: 'Vinilo 80 cm',
          materiaPrimaId: 'vinilo-base',
          materiaPrimaNombre: 'Vinilo',
          materiaPrimaTemplateId: 'vinilo-template',
          materiaPrimaTipoTecnico: 'VINILO',
          atributosVarianteJson: { anchoMm: 800 },
          anchoMm: 800,
          unidad: 'm_lineales',
          precioUnitario: 8,
        },
        {
          materialVarianteId: 'rollo-1000',
          materialSku: 'VINILO-1000',
          materialDisplayName: 'Vinilo 100 cm',
          materiaPrimaId: 'vinilo-base',
          materiaPrimaNombre: 'Vinilo',
          materiaPrimaTemplateId: 'vinilo-template',
          materiaPrimaTipoTecnico: 'VINILO',
          atributosVarianteJson: { anchoMm: 1000 },
          anchoMm: 1000,
          unidad: 'm_lineales',
          precioUnitario: 12,
        },
      ];
      item.costoTotal = 22.4;
      item.costoUnitario = 22.4;
      item.pasos![0].costoTotal = 22.4;
    }

    const resultado = aplicarNestingCompuestoRectangular({
      politica: 'CONSOLIDAR_COMPATIBLES',
      tenantId: 'tenant-1',
      productoPadreId: 'padre-1',
      recetaRevisionId: 'revision-padre-1',
      componentes,
    })!;
    const grupo = resultado.grupos[0];

    // Individualmente gana 800 mm ($2,40 por pieza). En conjunto, 1000 mm
    // ubica ambas en una fila y cuesta $3,60 contra $4,80 del rollo de 800.
    expect(grupo.aplicacion).toMatchObject({
      aplicado: true,
      costoMaterialIndependiente: 4.8,
      costoMaterialConsolidado: 3.6,
    });
    expect(grupo).toMatchObject({
      independiente: { areaMm2: 480_000 },
      consolidado: { areaMm2: 300_000 },
      diferencia: { areaMm2: 180_000, ahorroPct: 37.5 },
    });
    expect(grupo.lote).toMatchObject({
      materialVarianteId: 'rollo-1000',
      materialNombre: 'Vinilo 100 cm',
      nestingResult: {
        consumedLengthMm: 300,
        substrates: [{ kind: 'roll', widthMm: 1000, lengthMm: 300 }],
      },
    });
    expect(
      componentes.map(
        (item) => item.pasos?.[0].materiales?.[0].materialVarianteId,
      ),
    ).toEqual(['rollo-1000', 'rollo-1000']);
  });

  it('no consolida automáticamente un panelizado manual', () => {
    const manual = nestingRollo('frente', 600, 300);
    manual.visualConfig!.panelizado = {
      enabled: true,
      mode: 'manual',
      axis: 'vertical',
      overlapMm: 20,
      maxPanelWidthMm: 500,
      distribution: 'equilibrada',
      widthInterpretation: 'total',
      panelCount: 2,
    };
    const resultado = analizar([
      componente('VINILO-A', manual),
      componente('VINILO-B', nestingRollo('lateral', 400, 300)),
    ])!;

    expect(resultado.grupos).toEqual([]);
    expect(resultado.exclusiones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          componenteCodigo: 'VINILO-A',
          codigo: 'CONFIGURACION_INCOMPLETA',
          motivo: expect.stringContaining('panelizado manual'),
        }),
      ]),
    );
  });
});
