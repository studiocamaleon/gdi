import {
  DecisionAprobacionDocumento,
  TipoAprobacionDocumento,
} from '@prisma/client';
import {
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
