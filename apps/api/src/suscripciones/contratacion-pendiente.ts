import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { contratoPublicado, contratoSuscripcion } from './contrato-suscripcion';
import type { ClaveCapacidad } from './evaluador-capacidades';

export const ESTADOS_CONTRATACION_PENDIENTE = [
  'enviando',
  'checkout',
  'verificar',
];

/** El caller conserva el lock de Tenant. El vencimiento de una revisión no
 * demuestra que un pago enviado haya sido cancelado por el proveedor. */
export async function limitesContratacionPendiente(
  tx: Prisma.TransactionClient,
  tenantId: string,
) {
  const pendiente = await tx.planContratacion.findFirst({
    where: { tenantId, estado: { in: ESTADOS_CONTRATACION_PENDIENTE } },
    include: { oferta: { include: { version: true } } },
  });
  if (!pendiente) return null;
  const contrato = contratoPublicado(pendiente.oferta.version);
  const incluidos = contrato.limites.usuariosMax;
  const gb = contrato.limites.almacenamiento.gb;
  return {
    id: pendiente.id,
    usuarios: incluidos === null ? null : incluidos + pendiente.adicionales,
    bytes: gb && gb > 0 ? BigInt(Math.floor(gb * 1024 ** 3)) : null,
  };
}

export async function exigirSinContratacionPendiente(
  tx: Prisma.TransactionClient,
  tenantId: string,
) {
  const pendiente = await tx.planContratacion.findFirst({
    where: { tenantId, estado: { in: ESTADOS_CONTRATACION_PENDIENTE } },
    select: { id: true },
  });
  if (pendiente)
    throw new ConflictException({
      code: 'CONTRATACION_PENDIENTE',
      contratacionId: pendiente.id,
      message:
        'Hay una contratación pendiente. Verificá o cancelá ese pago desde Plan y facturación antes de modificar el contrato.',
    });
}

/** El escritor conserva el lock de Tenant desde antes de validar el contrato
 * hasta guardar el compromiso. Sólo restringe funciones que el pago pendiente
 * retiraría: no concede ampliaciones ni impide consultar o cerrar lo existente. */
export async function exigirContinuidadCompromiso(
  tx: Prisma.TransactionClient,
  tenantId: string,
  funciones: ClaveCapacidad[],
) {
  const pendiente = await tx.planContratacion.findFirst({
    where: { tenantId, estado: { in: ESTADOS_CONTRATACION_PENDIENTE } },
    include: { oferta: { include: { version: true } } },
  });
  if (!pendiente) return;
  const suscripcion = await tx.suscripcion.findUnique({
    where: { tenantId },
    include: { plan: true, planVersion: true },
  });
  const actual = contratoSuscripcion(suscripcion);
  const destino = contratoPublicado(pendiente.oferta.version);
  const retiradas = [...new Set(funciones)].filter(
    (f) => actual.funciones[f] && !destino.funciones[f],
  );
  if (retiradas.length)
    throw new ConflictException({
      code: 'CAMBIO_PLAN_PENDIENTE',
      contratacionId: pendiente.id,
      capacidades: retiradas,
      message:
        'Hay un cambio de plan pendiente que retira funciones necesarias para este trabajo. Resolvé ese cambio desde Plan y facturación antes de iniciar una nueva operación.',
    });
}
