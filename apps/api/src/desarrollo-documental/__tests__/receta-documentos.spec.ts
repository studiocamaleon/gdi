import { DesarrolloDocumentalService } from '../desarrollo-documental.service';

function servicio() {
  return new DesarrolloDocumentalService(
    {} as never,
    {} as never,
    {} as never,
    undefined,
  );
}

function txFixture(opts?: { existente?: boolean; conPaso?: boolean }) {
  const documento = {
    id: 'doc-receta-1',
    codigo: 'ARTE-FINAL',
    nombre: 'Arte final aprobado',
    proposito: 'PRINT',
    etapa: 'DISENO',
    tipoAprobacion: 'CLIENTE',
    requerido: true,
    descripcion: null,
    pasoClave: 'ruta:paso-ruta-1',
    orden: 0,
  };
  return {
    ordenTrabajo: {
      findFirst: jest.fn().mockResolvedValue({
        items: [
          {
            id: 'item-1',
            codigo: 'EXH-01',
            pasos: opts?.conPaso
              ? [{ id: 'paso-ot-1', rutaPasoId: 'paso-ruta-1' }]
              : [],
            recetaRevision: { documentos: [documento] },
          },
        ],
      }),
    },
    archivoMaestro: {
      findUnique: jest
        .fn()
        .mockResolvedValue(opts?.existente ? { id: 'maestro-1' } : null),
      create: jest.fn().mockResolvedValue({ id: 'maestro-1' }),
    },
    gateProduccionDocumento: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest
        .fn()
        .mockResolvedValue(opts?.existente ? { id: 'gate-1' } : null),
      create: jest.fn().mockResolvedValue({ id: 'gate-1' }),
      update: jest.fn().mockResolvedValue({ id: 'gate-1' }),
    },
  };
}

describe('requisitos documentales de receta en OT', () => {
  const args = {
    tenantId: 'tenant-1',
    ordenId: 'orden-1',
    proyectoCampanaId: 'campana-1',
    actorUserId: 'user-1',
    actorNombre: 'Lucas',
  };

  it('crea el maestro de campaña y un gate trazado a receta e item', async () => {
    const tx = txFixture({ conPaso: true });

    await servicio().materializarRequisitosReceta(tx as never, args);

    expect(tx.archivoMaestro.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          proyectoCampanaId: 'campana-1',
          nombre: 'EXH-01 · Arte final aprobado',
        }),
      }),
    );
    expect(tx.gateProduccionDocumento.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ordenItemId: 'item-1',
        pasoId: 'paso-ot-1',
        recetaDocumentoId: 'doc-receta-1',
        archivoMaestroId: 'maestro-1',
        tipoAprobacion: 'CLIENTE',
      }),
    });
  });

  it('es idempotente y enlaza el paso al emitir un borrador', async () => {
    const tx = txFixture({ existente: true, conPaso: true });

    const resultado = await servicio().materializarRequisitosReceta(
      tx as never,
      args,
    );

    expect(tx.archivoMaestro.create).not.toHaveBeenCalled();
    expect(tx.gateProduccionDocumento.create).not.toHaveBeenCalled();
    expect(tx.gateProduccionDocumento.update).toHaveBeenCalledWith({
      where: { id: 'gate-1' },
      data: expect.objectContaining({ pasoId: 'paso-ot-1', activo: true }),
    });
    expect(resultado).toEqual({ documentosCreados: 0, gatesCreados: 0 });
  });
});
