import {
  DecisionAprobacionDocumento,
  TipoAprobacionDocumento,
} from '@prisma/client';
import {
  DesarrolloDocumentalService,
  decisionRequiereComentario,
  gateDocumentoEstaCumplido,
} from './desarrollo-documental.service';

describe('control documental de producción', () => {
  it('bloquea si el documento no tiene una revisión explícitamente liberada', () => {
    expect(
      gateDocumentoEstaCumplido({
        tipoAprobacion: TipoAprobacionDocumento.CLIENTE,
        archivoMaestro: { revisionLiberada: null },
      }),
    ).toBe(false);
  });

  it('bloquea si la revisión liberada no tiene el tipo de aprobación exigido', () => {
    expect(
      gateDocumentoEstaCumplido({
        tipoAprobacion: TipoAprobacionDocumento.CLIENTE,
        archivoMaestro: {
          revisionLiberada: {
            solicitudes: [{ tipo: TipoAprobacionDocumento.DISENO }],
          },
        },
      }),
    ).toBe(false);
  });

  it('habilita sólo la revisión liberada con la aprobación requerida', () => {
    expect(
      gateDocumentoEstaCumplido({
        tipoAprobacion: TipoAprobacionDocumento.CLIENTE,
        archivoMaestro: {
          revisionLiberada: {
            solicitudes: [
              { tipo: TipoAprobacionDocumento.DISENO },
              { tipo: TipoAprobacionDocumento.CLIENTE },
            ],
          },
        },
      }),
    ).toBe(true);
  });

  it('exige fundamento para observar o rechazar, pero no para aprobar', () => {
    expect(
      decisionRequiereComentario(DecisionAprobacionDocumento.OBSERVAR),
    ).toBe(true);
    expect(
      decisionRequiereComentario(DecisionAprobacionDocumento.RECHAZAR),
    ).toBe(true);
    expect(
      decisionRequiereComentario(DecisionAprobacionDocumento.APROBAR),
    ).toBe(false);
  });
});

it('un componente de un lote respeta también la aprobación pendiente del producto comercial', async () => {
  const findMany = jest
    .fn()
    .mockResolvedValue([
      {
        nombre: 'Arte aprobado',
        tipoAprobacion: TipoAprobacionDocumento.CLIENTE,
        archivoMaestro: { revisionLiberada: null },
      },
    ]);
  const padres: Record<
    string,
    { parentItemId: string | null; loteEntregaId?: string }
  > = {
    componente: { parentItemId: 'lote', loteEntregaId: 'entrega-a' },
    lote: { parentItemId: 'producto' },
    producto: { parentItemId: null },
  };
  const db = {
    ordenTrabajoItem: {
      findFirst: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(padres[where.id]),
      ),
    },
    gateProduccionDocumento: { findMany },
  };
  const service = new DesarrolloDocumentalService(
    db as never,
    {} as never,
    {} as never,
  );
  await expect(
    service.exigirGatesCumplidos('ot', 'paso', 'componente'),
  ).rejects.toThrow('Arte aprobado');
  expect(findMany.mock.calls[0][0].where.OR).toContainEqual({
    alcance: 'ITEM',
    ordenItemId: { in: ['componente', 'lote', 'producto'] },
  });
});
