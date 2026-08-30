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
            recetaRevisionId: 'revision-hija',
            cantidad: 3,
            unidad: 'unidad',
          },
        ],
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
            clave: 'ruta:control',
            nombre: 'Control del frente',
            familiaCodigo: 'control_calidad',
            orden: 1,
          },
        ],
      },
      topologiaProduccion: 'LINEAL',
      grafoProduccionJson: {
        topologia: 'LINEAL',
        nodos: [
          { clave: 'ruta:corte', indice: 0 },
          { clave: 'ruta:control', indice: 1, gates: ['CALIDAD'] },
        ],
        aristas: [{ desdeClave: 'ruta:corte', haciaClave: 'ruta:control' }],
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
        findMany: jest.fn().mockResolvedValue([
          { id: 'paso-corte', nodoClave: 'ruta:corte' },
          { id: 'paso-control', nodoClave: 'ruta:control' },
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
    expect(dependenciasCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          predecesorPasoId: 'paso-control',
          sucesorPasoId: 'paso-armado',
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
});
