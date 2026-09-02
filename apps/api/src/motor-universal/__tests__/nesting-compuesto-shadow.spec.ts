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
});
