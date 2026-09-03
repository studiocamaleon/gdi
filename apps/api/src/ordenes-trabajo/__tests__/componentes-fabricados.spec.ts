/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { OrdenesTrabajoService } from '../ordenes-trabajo.service';

describe('materialización de componentes fabricados', () => {
  it('crea el ítem hijo congelado y conecta su terminal al ensamble padre', async () => {
    const padre = {
      id: 'item-padre',
      ordenId: 'orden',
      codigo: 'EXHIBIDOR',
      cantidad: 2,
      ordenIndice: 0,
      recetaRevision: {
        componentes: [
          {
            codigo: 'acrilico',
            nombre: 'Frente de acrílico',
            politicaEjecucion: 'INDEPENDIENTE',
            nodoIncorporacionClave: 'ruta:armado',
            nodosPredecesoresClaves: ['ruta:preparacion'],
            recetaRevisionId: 'revision-hija',
            cantidad: 3,
            unidad: 'unidad',
          },
        ],
      },
      cotizacionItem: {
        jobContextJson: { cantidad: 2 },
        trazabilidadJson: {
          componentesFabricados: [
            {
              codigo: 'acrilico',
              jobContext: { cantidad: 6 },
              pasos: [
                {
                  rutaPasoId: 'corte',
                  familiaCodigo: 'corte_laser',
                  nombreVisible: 'Corte láser',
                  activado: true,
                },
                {
                  rutaPasoId: 'diseno',
                  familiaCodigo: 'diseno_grafico',
                  nombreVisible: 'Diseño gráfico',
                  activado: false,
                },
                {
                  rutaPasoId: 'control',
                  familiaCodigo: 'control_calidad',
                  nombreVisible: 'Control del frente',
                  activado: true,
                },
              ],
            },
          ],
        },
      },
    };
    const revisionHija = {
      id: 'revision-hija',
      numero: 4,
      huellaConfiguracion: 'huella',
      snapshotJson: {
        pasos: [
          {
            clave: 'ruta:corte',
            nombre: 'Corte láser',
            familiaCodigo: 'corte_laser',
            orden: 0,
          },
          {
            clave: 'ruta:diseno',
            nombre: 'Diseño gráfico',
            familiaCodigo: 'diseno_grafico',
            orden: 1,
          },
          {
            clave: 'ruta:control',
            nombre: 'Control del frente',
            familiaCodigo: 'control_calidad',
            orden: 2,
          },
        ],
      },
      topologiaProduccion: 'LINEAL',
      grafoProduccionJson: {
        topologia: 'LINEAL',
        nodos: [
          { clave: 'ruta:corte', indice: 0 },
          { clave: 'ruta:diseno', indice: 1 },
          { clave: 'ruta:control', indice: 2, gates: ['CALIDAD'] },
        ],
        aristas: [
          { desdeClave: 'ruta:corte', haciaClave: 'ruta:diseno' },
          { desdeClave: 'ruta:diseno', haciaClave: 'ruta:control' },
        ],
        raices: ['ruta:corte'],
        terminales: ['ruta:control'],
      },
      recursos: [],
    };
    const itemCreate = jest.fn().mockResolvedValue({
      id: 'item-hijo',
      ordenId: 'orden',
      codigo: 'EXHIBIDOR/acrilico',
    });
    const pasosCreateMany = jest.fn().mockResolvedValue({ count: 2 });
    const dependenciasCreateMany = jest.fn().mockResolvedValue({ count: 2 });
    const gatesCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const itemFindFirst = jest
      .fn()
      .mockResolvedValueOnce(padre)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const pasoFindFirst = jest.fn().mockResolvedValue({ id: 'paso-armado' });
    const tx = {
      ordenTrabajoItem: {
        findFirst: itemFindFirst,
        create: itemCreate,
      },
      productoRecetaRevision: {
        findFirst: jest.fn().mockResolvedValue(revisionHija),
      },
      ordenTrabajoItemPaso: {
        createMany: pasosCreateMany,
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            { id: 'paso-corte', nodoClave: 'ruta:corte' },
            { id: 'paso-control', nodoClave: 'ruta:control' },
          ])
          .mockResolvedValueOnce([
            { id: 'paso-preparacion', nodoClave: 'ruta:preparacion' },
          ]),
        findFirst: pasoFindFirst,
      },
      ordenTrabajoPasoDependencia: {
        createMany: dependenciasCreateMany,
      },
      ordenTrabajoPasoGate: {
        createMany: gatesCreateMany,
      },
    };
    const service = Object.create(
      OrdenesTrabajoService.prototype,
    ) as OrdenesTrabajoService;

    await (
      service as unknown as {
        materializarComponentesFabricados: (
          tx: unknown,
          tenantId: string,
          padres: string[],
        ) => Promise<void>;
      }
    ).materializarComponentesFabricados(tx, 'tenant', ['item-padre']);

    expect(itemCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        parentItemId: 'item-padre',
        componenteCodigo: 'acrilico',
        nodoIncorporacionClave: 'ruta:armado',
        recetaRevisionId: 'revision-hija',
        cantidad: 6,
      }),
    });
    expect(pasosCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          itemId: 'item-hijo',
          nodoClave: 'ruta:control',
          esTerminal: true,
        }),
      ]),
      skipDuplicates: true,
    });
    expect(pasosCreateMany).not.toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ nodoClave: 'ruta:diseno' }),
      ]),
      skipDuplicates: true,
    });
    expect(dependenciasCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          predecesorPasoId: 'paso-corte',
          sucesorPasoId: 'paso-control',
        }),
        expect.objectContaining({
          predecesorPasoId: 'paso-control',
          sucesorPasoId: 'paso-armado',
          tipo: 'componente_fabricado',
        }),
        expect.objectContaining({
          predecesorPasoId: 'paso-preparacion',
          sucesorPasoId: 'paso-corte',
          tipo: 'componente_fabricado',
        }),
      ]),
      skipDuplicates: true,
    });
    expect(gatesCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          pasoId: 'paso-control',
          tipo: 'CALIDAD',
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('materializa una sola operación para el lote de nesting y conserva los aliases', async () => {
    const lote = {
      id: 'nesting-compuesto-firma',
      versionContrato: 1,
      estado: 'CONGELADO',
      firmaCompatibilidad: 'firma',
      materialVarianteId: 'material',
      materialNombre: 'PVC 1 mm',
      participantes: [
        {
          componenteCodigo: 'frente',
          productoId: 'producto-vinilo',
          pasoClave: 'paso-frente',
          rutaPasoId: 'impresion-frente',
          piezas: ['frente'],
          areaUtilMm2: 100,
          porcentajeAsignacion: 50,
          costoMaterialAsignado: 5,
          costoPreparacionAsignado: 3,
          esPasoOperativo: true,
        },
        {
          componenteCodigo: 'dorso',
          productoId: 'producto-vinilo',
          pasoClave: 'paso-dorso',
          rutaPasoId: 'impresion-dorso',
          piezas: ['dorso'],
          areaUtilMm2: 100,
          porcentajeAsignacion: 50,
          costoMaterialAsignado: 5,
          costoPreparacionAsignado: 3,
          esPasoOperativo: false,
        },
      ],
      nestingResult: {
        algorithm: 'grid-2d-multi',
        substrates: [{ kind: 'sheet', count: 1, widthMm: 100, heightMm: 100 }],
        placements: [],
        aprovechamientoPct: 48,
      },
      costoMaterialTotal: 10,
      costoPreparacionTotal: 6,
      costoTotalAsignado: 16,
      duracionEstimadaMin: 26,
    };
    const itemFindFirst = jest.fn().mockResolvedValue({
      ordenId: 'orden',
      cotizacionItem: {
        trazabilidadJson: {
          analisisNestingCompuesto: {
            grupos: [{ aplicacion: { aplicado: true }, lote }],
          },
        },
      },
    });
    const itemsFindMany = jest.fn().mockResolvedValue([
      {
        componenteCodigo: 'frente',
        pasos: [
          {
            id: 'paso-frente',
            rutaPasoId: 'impresion-frente',
            nombre: 'Impresión frente',
          },
        ],
      },
      {
        componenteCodigo: 'dorso',
        pasos: [
          {
            id: 'paso-dorso',
            rutaPasoId: 'impresion-dorso',
            nombre: 'Impresión dorso',
          },
        ],
      },
    ]);
    const dependenciasCreateMany = jest.fn().mockResolvedValue({ count: 2 });
    const gatesCreateMany = jest.fn().mockResolvedValue({ count: 2 });
    const pasoUpdate = jest.fn().mockResolvedValue({ id: 'paso-frente' });
    const pasoUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      ordenTrabajoItem: {
        findFirst: itemFindFirst,
        findMany: itemsFindMany,
      },
      ordenTrabajoItemPaso: {
        update: pasoUpdate,
        updateMany: pasoUpdateMany,
      },
      ordenTrabajoPasoDependencia: {
        findMany: jest.fn().mockResolvedValue([
          {
            predecesorPasoId: 'pre-frente',
            sucesorPasoId: 'paso-frente',
            tipo: 'precedencia',
            obligatoria: true,
          },
          {
            predecesorPasoId: 'pre-dorso',
            sucesorPasoId: 'paso-dorso',
            tipo: 'precedencia',
            obligatoria: true,
          },
          {
            predecesorPasoId: 'paso-dorso',
            sucesorPasoId: 'post-dorso',
            tipo: 'precedencia',
            obligatoria: true,
          },
        ]),
        createMany: dependenciasCreateMany,
      },
      ordenTrabajoPasoGate: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ tipo: 'MATERIAL' }, { tipo: 'CALIDAD' }]),
        createMany: gatesCreateMany,
      },
    };
    const service = Object.create(
      OrdenesTrabajoService.prototype,
    ) as OrdenesTrabajoService;

    await (
      service as unknown as {
        materializarLotesNestingCompuesto: (
          tx: unknown,
          tenantId: string,
          padres: string[],
        ) => Promise<void>;
      }
    ).materializarLotesNestingCompuesto(tx, 'tenant', ['item-padre']);

    expect(pasoUpdate).toHaveBeenCalledWith({
      where: { id: 'paso-frente' },
      data: expect.objectContaining({
        nestingLoteId: lote.id,
        nestingLoteRol: 'OPERATIVO',
        nestingLoteSnapshotJson: lote,
        nombre: 'Nesting compartido · Impresión frente',
        duracionEstimadaMin: 26,
      }),
    });
    expect(pasoUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['paso-dorso'] } },
      data: expect.objectContaining({
        nestingLoteId: lote.id,
        nestingLoteRol: 'PARTICIPANTE',
        duracionEstimadaMin: 0,
      }),
    });
    expect(dependenciasCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          predecesorPasoId: 'pre-dorso',
          sucesorPasoId: 'paso-frente',
        }),
        expect.objectContaining({
          predecesorPasoId: 'paso-frente',
          sucesorPasoId: 'post-dorso',
        }),
      ]),
      skipDuplicates: true,
    });
    expect(gatesCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ pasoId: 'paso-frente', tipo: 'MATERIAL' }),
        expect.objectContaining({ pasoId: 'paso-frente', tipo: 'CALIDAD' }),
      ]),
      skipDuplicates: true,
    });
  });
});
