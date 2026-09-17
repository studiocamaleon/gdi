import { OrdenesTrabajoService } from '../ordenes-trabajo.service';
import { idLoteEnItem } from '../snapshot-componente';

describe('lotes registrados en la OT', () => {
  it('materializa una impresión y un corte; reúne sus dependencias antes del ensamble', async () => {
    const codigos = [
      'cuerpo',
      'soporte',
      'faldon',
      'estante',
      'costilla',
      'header',
    ];
    const pasos = new Map(
      codigos.flatMap((c) =>
        ['impresion', 'laser'].map(
          (tipo) =>
            [
              `${tipo}-${c}`,
              {
                id: `${tipo}-${c}`,
                rutaPasoId: tipo,
                nombre: tipo,
                nestingLoteRol: null,
              },
            ] as const,
        ),
      ),
    );
    const dependencias = codigos.flatMap((c) => [
      {
        predecesorPasoId: 'revision',
        sucesorPasoId: `impresion-${c}`,
        tipo: 'precedencia',
        obligatoria: true,
      },
      {
        predecesorPasoId: `impresion-${c}`,
        sucesorPasoId: `laser-${c}`,
        tipo: 'precedencia',
        obligatoria: true,
      },
      {
        predecesorPasoId: `laser-${c}`,
        sucesorPasoId: 'ensamble',
        tipo: 'precedencia',
        obligatoria: true,
      },
    ]);
    const lotes = ['impresion', 'laser'].map((tipo) => ({
      id: `lote-${tipo}`,
      layoutOrigenLoteId: tipo === 'laser' ? 'lote-impresion' : undefined,
      participantes: codigos.map((componenteCodigo, i) => ({
        componenteCodigo,
        rutaPasoId: tipo,
        esPasoOperativo: i === 0,
      })),
      duracionEstimadaMin: tipo === 'laser' ? 90 : 60,
    }));
    const update = jest.fn(async ({ where, data }) => {
      Object.assign(pasos.get(where.id)!, data);
    });
    const tx = {
      ordenTrabajoItem: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            ordenId: 'ot',
            cotizacionItem: {
              trazabilidadJson: {
                analisisNestingCompuesto: {
                  grupos: lotes.map((lote) => ({
                    lote,
                    aplicacion: { aplicado: true },
                  })),
                },
              },
            },
          }),
        findMany: jest
          .fn()
          .mockResolvedValue(
            codigos.map((componenteCodigo) => ({
              componenteCodigo,
              pasos: ['impresion', 'laser'].map((t) =>
                pasos.get(`${t}-${componenteCodigo}`),
              ),
            })),
          ),
      },
      ordenTrabajoItemPaso: {
        update,
        updateMany: jest.fn(async ({ where, data }) => {
          where.id.in.forEach((id: string) =>
            Object.assign(pasos.get(id)!, data),
          );
        }),
      },
      ordenTrabajoPasoDependencia: {
        findMany: jest.fn(async () => dependencias),
        createMany: jest.fn(async ({ data }) => {
          dependencias.push(...data);
        }),
      },
      ordenTrabajoPasoGate: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn(),
      },
    };
    const servicio = Object.create(OrdenesTrabajoService.prototype) as any;
    await servicio.materializarLotesNestingCompuesto(tx, 'tenant', ['padre']);
    const operativos = [...pasos.values()].filter(
      (p) => p.nestingLoteRol === 'OPERATIVO',
    );
    expect(operativos.map((p) => p.id)).toEqual([
      'impresion-cuerpo',
      'laser-cuerpo',
    ]);
    expect(
      [...pasos.values()].filter((p) => p.nestingLoteRol === 'PARTICIPANTE'),
    ).toHaveLength(10);
    const visibles = new Set([
      'revision',
      'ensamble',
      ...operativos.map((p) => p.id),
    ]);
    const enlaces = [
      ...new Set(
        dependencias
          .filter(
            (d) =>
              visibles.has(d.predecesorPasoId) && visibles.has(d.sucesorPasoId),
          )
          .map((d) => `${d.predecesorPasoId}->${d.sucesorPasoId}`),
      ),
    ];
    expect(enlaces.sort()).toEqual(
      [
        'impresion-cuerpo->laser-cuerpo',
        'laser-cuerpo->ensamble',
        'revision->impresion-cuerpo',
      ].sort(),
    );
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'laser-cuerpo' },
        data: expect.objectContaining({
          duracionEstimadaMin: 90,
          nestingLoteId: idLoteEnItem('padre', 'lote-laser'),
        }),
      }),
    );
  });
});
